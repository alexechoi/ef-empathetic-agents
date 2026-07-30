import { logger } from "../lib/logger.js";
import { placeOutboundCall } from "../lib/elevenlabs.js";
import type { AgentStateType, AgentUpdate } from "../state.js";

const log = logger.child({ node: "caller" });

/**
 * Call layer. Executes the voice interaction described by the brief via the
 * ElevenLabs Conversational AI agent. Assumes the orchestrator already decided
 * a call is warranted (routing is enforced in the graph).
 */
export async function caller(state: AgentStateType): Promise<AgentUpdate> {
  const { brief, contact } = state;

  if (!brief) {
    log.error("Caller invoked without a brief");
    return {
      callResult: { status: "failed", detail: "No brief available to place a call." },
    };
  }

  log.info({ objective: brief.objective, to: contact.phoneNumber }, "Placing call");

  const callResult = await placeOutboundCall({
    toNumber: contact.phoneNumber,
    firstMessage: brief.firstMessage,
    dynamicVariables: brief.dynamicVariables,
  });

  return { callResult };
}
