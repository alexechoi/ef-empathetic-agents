import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { logger } from "./logger.js";
import type { CallResult } from "../state.js";

const log = logger.child({ module: "elevenlabs" });

export interface OutboundCallInput {
  toNumber: string;
  firstMessage: string;
  dynamicVariables: Record<string, string>;
}

interface ElevenLabsConfig {
  apiKey: string;
  agentId: string;
  agentPhoneNumberId: string;
}

/**
 * Reads ElevenLabs config from the environment. Returns null when anything is
 * missing so the caller node can degrade to a simulated (dry-run) call.
 */
function readConfig(): ElevenLabsConfig | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const agentPhoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;

  if (!apiKey || !agentId || !agentPhoneNumberId) return null;
  return { apiKey, agentId, agentPhoneNumberId };
}

function isDryRun(config: ElevenLabsConfig | null): boolean {
  return process.env.DRY_RUN === "true" || config === null;
}

/**
 * Places an outbound Conversational AI call via ElevenLabs + Twilio.
 * Falls back to a simulated result in dry-run mode. Never throws: failures are
 * logged and returned as a `failed` CallResult so the graph can complete.
 */
export async function placeOutboundCall(
  input: OutboundCallInput,
): Promise<CallResult> {
  const config = readConfig();

  if (isDryRun(config)) {
    log.warn(
      { toNumber: input.toNumber, reason: config ? "DRY_RUN=true" : "missing ElevenLabs config" },
      "Simulating outbound call (dry run)",
    );
    return {
      status: "initiated",
      conversationId: `dry-run-${Date.now()}`,
      detail: "Simulated call. Set DRY_RUN=false and configure ElevenLabs to dial for real.",
    };
  }

  try {
    const client = new ElevenLabsClient({ apiKey: config!.apiKey });
    const response = await client.conversationalAi.twilio.outboundCall({
      agentId: config!.agentId,
      agentPhoneNumberId: config!.agentPhoneNumberId,
      toNumber: input.toNumber,
      conversationInitiationClientData: {
        conversationConfigOverride: {
          agent: { firstMessage: input.firstMessage },
        },
        dynamicVariables: input.dynamicVariables,
      },
    });

    log.info(
      { conversationId: response.conversationId, callSid: response.callSid },
      "Outbound call initiated",
    );

    return {
      status: "initiated",
      conversationId: response.conversationId ?? undefined,
      callSid: response.callSid ?? undefined,
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    log.error({ err: error, toNumber: input.toNumber }, "Outbound call failed");
    return { status: "failed", detail };
  }
}
