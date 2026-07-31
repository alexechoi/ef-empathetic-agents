import { Router } from "express";
import { TriggerCallRequestSchema } from "../schemas.js";
import { asyncHandler, parseOrThrow } from "../lib/http.js";
import {
  getCallByConversationId,
  listCalls,
  updateCall,
} from "../db/repositories/calls.js";
import { logger } from "../lib/logger.js";
import { endSse, sendSse, startSse, startSseHeartbeat } from "../lib/sse.js";
import {
  CallExecutionError,
  executeCall,
  type CallObserver,
} from "../services/caller.js";
import { monitorConversation } from "../lib/elevenlabs-monitor.js";

const log = logger.child({ route: "calls" });

export const callsRouter = Router();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function transcriptTurns(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : [];
}

function formatTranscript(value: unknown): string | undefined {
  if (typeof value === "string") return value;
  const lines = transcriptTurns(value)
    .map((turn) => {
      const role = typeof turn.role === "string" ? turn.role : "?";
      const message =
        typeof turn.message === "string"
          ? turn.message
          : typeof turn.text === "string"
            ? turn.text
            : "";
      return message ? `${role}: ${message}` : "";
    })
    .filter(Boolean);
  return lines.length > 0 ? lines.join("\n") : undefined;
}

function extractReasoningSummaries(value: unknown): string[] {
  return transcriptTurns(value).flatMap((turn) => {
    if (typeof turn.reasoning === "string") return [turn.reasoning];
    if (!isRecord(turn.reasoning)) return [];
    const summary =
      typeof turn.reasoning.summary === "string"
        ? turn.reasoning.summary
        : typeof turn.reasoning.reasoning_summary === "string"
          ? turn.reasoning.reasoning_summary
          : undefined;
    return summary ? [summary] : [];
  });
}

/**
 * Triggers an approved outreach plan: re-runs the safety guardrails against the
 * latest data, dials via ElevenLabs when they pass, and records the outcome.
 * Blocked plans are recorded as skipped rather than dialled.
 */
callsRouter.post(
  "/trigger",
  asyncHandler(async (req, res) => {
    const request = parseOrThrow(TriggerCallRequestSchema, req.body);
    try {
      const result = await executeCall(request);
      log.info(
        { planId: request.planId, status: result.status },
        "Call triggered",
      );
      res.status(result.httpStatus).json({
        status: result.status,
        safetyReport: result.safetyReport,
        call: result.call,
      });
    } catch (error) {
      if (error instanceof CallExecutionError) {
        res.status(error.httpStatus).json({ error: error.message });
        return;
      }
      throw error;
    }
  }),
);

/** Streams caller preflight, guardrails, initiation and persistence. */
callsRouter.post("/trigger/stream", async (req, res) => {
  let request;
  try {
    request = parseOrThrow(TriggerCallRequestSchema, req.body);
  } catch (error) {
    log.error({ err: error }, "Invalid call stream request");
    res.status(400).json({ error: "Validation failed" });
    return;
  }

  startSse(res);
  const stopHeartbeat = startSseHeartbeat(res);
  const observer: CallObserver = {
    trace: (step) => sendSse(res, "trace", step),
    context: (context) => sendSse(res, "call_context", context),
  };
  sendSse(res, "started", {
    planId: request.planId,
    at: new Date().toISOString(),
  });

  try {
    const result = await executeCall(request, observer);
    sendSse(res, "result", {
      status: result.status,
      safetyReport: result.safetyReport,
      call: result.call,
    });
    sendSse(res, "complete", {
      status: result.status,
      conversationId: result.call.conversationId,
    });
  } catch (error) {
    const message =
      error instanceof CallExecutionError
        ? error.message
        : "Caller stream failed";
    log.error({ err: error, planId: request.planId }, "Caller stream failed");
    sendSse(res, "error", { message });
  } finally {
    stopHeartbeat();
    endSse(res);
  }
});

/**
 * Proxies ElevenLabs' active-call monitor as sanitized SSE. The conversation
 * must belong to a call in our database; the ElevenLabs API key stays private.
 */
callsRouter.get("/:conversationId/stream", async (req, res) => {
  const conversationId = String(req.params.conversationId);
  const call = getCallByConversationId(conversationId);
  if (!call) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }
  if (conversationId.startsWith("dry-run-")) {
    res.status(409).json({ error: "Dry-run calls cannot be monitored" });
    return;
  }

  startSse(res);
  const abort = new AbortController();
  res.on("close", () => abort.abort());
  sendSse(res, "monitor_connecting", { conversationId });

  try {
    await monitorConversation(
      conversationId,
      ({ event, data }) => sendSse(res, event, data),
      abort.signal,
    );
    if (!abort.signal.aborted) {
      sendSse(res, "complete", { conversationId });
    }
  } catch (error) {
    if (!abort.signal.aborted) {
      log.error({ err: error, conversationId }, "Live call monitor failed");
      sendSse(res, "error", { message: "Live call monitor failed" });
    }
  } finally {
    endSse(res);
  }
});

/** ElevenLabs post-call webhook: persist status and transcript when we can. */
callsRouter.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (secret && req.get("x-webhook-secret") !== secret) {
      res.status(401).json({ error: "Invalid webhook secret" });
      return;
    }

    const body = isRecord(req.body) ? req.body : {};
    const data = isRecord(body.data) ? body.data : body;
    const conversationId =
      typeof data.conversation_id === "string"
        ? data.conversation_id
        : typeof data.conversationId === "string"
          ? data.conversationId
          : undefined;
    const transcript = data.transcript;
    const transcriptText = formatTranscript(transcript);
    const reasoningSummaries = extractReasoningSummaries(transcript);
    const analysis = isRecord(data.analysis) ? data.analysis : undefined;

    if (conversationId) {
      const existing = getCallByConversationId(conversationId);
      if (existing) {
        updateCall(existing.id, {
          status: "completed",
          transcript: transcriptText,
          reasoningSummaries,
          analysis,
        });
        log.info({ conversationId }, "Call webhook applied");
      } else {
        log.warn({ conversationId }, "Webhook for unknown conversation");
      }
    } else {
      log.warn("Webhook received without a conversation id");
    }

    res.status(200).json({ received: true });
  }),
);

callsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.query.userId;
    if (typeof userId !== "string") {
      res.status(400).json({ error: "userId query param is required" });
      return;
    }
    res.json(listCalls(userId));
  }),
);
