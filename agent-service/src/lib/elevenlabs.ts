import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";
import { logger } from "./logger.js";
import type { CallContext } from "../schemas.js";

const log = logger.child({ module: "elevenlabs" });

export interface PlaceCallResult {
  status: "initiated" | "failed";
  conversationId?: string;
  callSid?: string;
  detail?: string;
}

interface ElevenLabsConfig {
  apiKey: string;
  agentId: string;
  agentPhoneNumberId: string;
  voiceId?: string;
}

function readConfig(): ElevenLabsConfig | null {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  const agentPhoneNumberId = process.env.ELEVENLABS_AGENT_PHONE_NUMBER_ID;
  if (!apiKey || !agentId || !agentPhoneNumberId) return null;
  return { apiKey, agentId, agentPhoneNumberId, voiceId: process.env.ELEVENLABS_VOICE_ID };
}

function isDryRun(config: ElevenLabsConfig | null): boolean {
  return process.env.DRY_RUN === "true" || config === null;
}

function formatEventTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Flattens the narrow CallContext into the string dynamic variables the
 * ElevenLabs agent prompt references. Only approved, in-scope data is included.
 */
export function buildDynamicVariables(
  ctx: CallContext,
): Record<string, string> {
  const memories = ctx.memories
    .map((m, i) => {
      const said = m.transcript ? ` (they used to say: "${m.transcript}")` : "";
      return `${i + 1}. ${m.summary}${said}`;
    })
    .join("\n");
  const knowledgeMemories = ctx.knowledgeMemories
    .map((memory, index) => {
      const details = [
        `people: ${memory.people.join(", ") || "none"}`,
        `themes: ${memory.themes.join(", ") || "none"}`,
        `related events: ${memory.relatedEvents.join(", ") || "none"}`,
      ].join("; ");
      const transcript = memory.transcript
        ? ` Saved wording: "${memory.transcript}"`
        : "";
      return `${index + 1}. ${memory.summary} (${details}).${transcript}`;
    })
    .join("\n");

  return {
    user_name: ctx.userName,
    loved_one_name: ctx.lovedOneName,
    relationship: ctx.relationship,
    event_title: ctx.event.title,
    event_time: formatEventTime(ctx.event.startsAt),
    purpose: ctx.purpose,
    opening_message: ctx.approvedOpeningMessage,
    memories: memories || "(no specific memory available)",
    knowledge_memories:
      knowledgeMemories || "(no additional approved memories available)",
    prohibited_topics: ctx.prohibitedTopics.join(", ") || "none",
  };
}

/**
 * Places an outbound Conversational AI call via ElevenLabs + Twilio. Falls back
 * to a simulated result in dry-run mode. Never throws: failures are logged and
 * returned so the calling flow can record and continue.
 */
export async function placeOutboundCall(
  toNumber: string,
  ctx: CallContext,
  useVoiceClone: boolean,
): Promise<PlaceCallResult> {
  const config = readConfig();
  const dynamicVariables = buildDynamicVariables(ctx);

  if (isDryRun(config)) {
    log.warn(
      { toNumber, reason: config ? "DRY_RUN=true" : "missing ElevenLabs config" },
      "Simulating outbound call (dry run)",
    );
    return {
      status: "initiated",
      conversationId: `dry-run-${Date.now()}`,
      detail:
        "Simulated call. Set DRY_RUN=false and configure ELEVENLABS_AGENT_PHONE_NUMBER_ID to dial for real.",
    };
  }

  try {
    const client = new ElevenLabsClient({ apiKey: config!.apiKey });
    const voiceId = useVoiceClone ? config!.voiceId : undefined;

    const response = await client.conversationalAi.twilio.outboundCall({
      agentId: config!.agentId,
      agentPhoneNumberId: config!.agentPhoneNumberId,
      toNumber,
      conversationInitiationClientData: {
        conversationConfigOverride: {
          agent: { firstMessage: ctx.approvedOpeningMessage },
          ...(voiceId ? { tts: { voiceId } } : {}),
        },
        dynamicVariables,
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
    log.error({ err: error, toNumber }, "Outbound call failed");
    return { status: "failed", detail };
  }
}
