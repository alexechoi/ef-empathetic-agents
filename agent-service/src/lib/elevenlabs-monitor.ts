import WebSocket, { type RawData } from "ws";
import { logger } from "./logger.js";

const log = logger.child({ module: "elevenlabs-monitor" });

export interface SanitizedMonitorEvent {
  event: string;
  data: Record<string, unknown>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function nestedRecord(
  source: Record<string, unknown>,
  key: string,
): Record<string, unknown> {
  return isRecord(source[key]) ? source[key] : {};
}

function stringValue(
  source: Record<string, unknown>,
  ...keys: string[]
): string | undefined {
  for (const key of keys) {
    if (typeof source[key] === "string") return source[key];
  }
  return undefined;
}

/**
 * Allow-lists safe observability fields from ElevenLabs. Unknown payloads,
 * prompts, audio, tool arguments/results and dynamic variables are discarded.
 */
export function sanitizeMonitorEvent(
  input: unknown,
): SanitizedMonitorEvent | null {
  if (!isRecord(input) || typeof input.type !== "string") return null;
  const type = input.type;

  if (type === "user_transcript") {
    const payload = nestedRecord(input, "user_transcription_event");
    const text = stringValue(payload, "user_transcript", "text");
    return text ? { event: "user_transcript", data: { text } } : null;
  }

  if (type === "agent_response") {
    const payload = nestedRecord(input, "agent_response_event");
    const text = stringValue(payload, "agent_response", "text");
    const reasoning = nestedRecord(payload, "reasoning");
    const summary = stringValue(
      reasoning,
      "summary",
      "reasoning_summary",
      "content",
    );
    if (summary) {
      return {
        event: "agent_response",
        data: { text, reasoningSummary: summary },
      };
    }
    return text ? { event: "agent_response", data: { text } } : null;
  }

  if (type === "agent_chat_response_part") {
    const payload = nestedRecord(input, "text_response_part");
    const text = stringValue(payload, "text");
    return text
      ? {
          event: "agent_response_part",
          data: { text, part: stringValue(payload, "type") },
        }
      : null;
  }

  if (type === "agent_response_correction") {
    const payload = nestedRecord(input, "agent_response_correction_event");
    const text = stringValue(
      payload,
      "corrected_agent_response",
      "agent_response",
      "text",
    );
    return text ? { event: "correction", data: { text } } : null;
  }

  if (
    type === "client_tool_call" ||
    type === "agent_tool_response" ||
    type === "mcp_tool_call"
  ) {
    const payload = nestedRecord(input, `${type}_event`);
    return {
      event: "tool",
      data: {
        kind: type,
        name: stringValue(payload, "tool_name", "name"),
        id: stringValue(payload, "tool_call_id", "id"),
      },
    };
  }

  if (type === "reasoning_summary") {
    const payload = nestedRecord(input, "reasoning_summary_event");
    const summary = stringValue(payload, "summary", "text", "content");
    return summary ? { event: "reasoning_summary", data: { summary } } : null;
  }

  if (
    type === "conversation_ended" ||
    type === "conversation_end" ||
    type === "call_ended"
  ) {
    return { event: "call_ended", data: { type } };
  }

  return null;
}

/**
 * Connects to ElevenLabs' active-conversation monitor until it closes or the
 * client aborts. The API key stays server-side.
 */
export function monitorConversation(
  conversationId: string,
  onEvent: (event: SanitizedMonitorEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    log.error("ELEVENLABS_API_KEY is not set for call monitoring");
    return Promise.reject(new Error("ElevenLabs monitoring is not configured"));
  }

  return new Promise((resolve, reject) => {
    const url = `wss://api.elevenlabs.io/v1/convai/conversations/${encodeURIComponent(conversationId)}/monitor`;
    const socket = new WebSocket(url, {
      headers: { "xi-api-key": apiKey },
      handshakeTimeout: 10_000,
    });
    let opened = false;
    let settled = false;

    const settle = (error?: Error) => {
      if (settled) return;
      settled = true;
      signal?.removeEventListener("abort", abort);
      if (error) reject(error);
      else resolve();
    };
    const abort = () => {
      socket.close();
      settle();
    };
    signal?.addEventListener("abort", abort, { once: true });

    socket.on("open", () => {
      opened = true;
      log.info({ conversationId }, "Connected to live call monitor");
      onEvent({ event: "monitor_connected", data: { conversationId } });
    });
    socket.on("message", (raw: RawData) => {
      try {
        const sanitized = sanitizeMonitorEvent(JSON.parse(raw.toString()));
        if (sanitized) onEvent(sanitized);
      } catch (error) {
        log.error(
          { err: error, conversationId },
          "Failed to process monitor event",
        );
      }
    });
    socket.on("close", () => settle());
    socket.on("error", (error) => {
      log.error({ err: error, conversationId }, "Call monitor failed");
      if (!opened) settle(error);
    });
  });
}
