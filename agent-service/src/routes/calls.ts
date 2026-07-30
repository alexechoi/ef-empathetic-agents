import { randomUUID } from "node:crypto";
import { Router } from "express";
import { CallRecordSchema, TriggerCallRequestSchema } from "../schemas.js";
import { asyncHandler, parseOrThrow } from "../lib/http.js";
import { getPlan } from "../db/repositories/plans.js";
import { getUser } from "../db/repositories/users.js";
import { getEvent } from "../db/repositories/events.js";
import { getMemoriesByIds } from "../db/repositories/memories.js";
import {
  countContactsSince,
  getCallByConversationId,
  insertCall,
  listCalls,
  recordContact,
  updateCall,
} from "../db/repositories/calls.js";
import { validateOutreach } from "../safety/validate.js";
import { buildCallContext } from "../calls/context.js";
import { placeOutboundCall } from "../lib/elevenlabs.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ route: "calls" });

export const callsRouter = Router();

/**
 * Triggers an approved outreach plan: re-runs the safety guardrails against the
 * latest data, dials via ElevenLabs when they pass, and records the outcome.
 * Blocked plans are recorded as skipped rather than dialled.
 */
callsRouter.post(
  "/trigger",
  asyncHandler(async (req, res) => {
    const { planId, phoneNumber } = parseOrThrow(
      TriggerCallRequestSchema,
      req.body,
    );

    const plan = getPlan(planId);
    if (!plan) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    if (!plan.shouldContact) {
      res.status(409).json({ error: "Plan does not propose contact" });
      return;
    }

    const profile = getUser(plan.userId);
    const event = getEvent(plan.eventId);
    if (!profile || !event) {
      res.status(404).json({ error: "Plan's user or event no longer exists" });
      return;
    }

    const memories = getMemoriesByIds(plan.selectedMemoryIds);
    const proposedTime = plan.proposedTime ?? new Date().toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();

    // Guardrail re-check immediately before dialling.
    const report = validateOutreach({
      profile,
      event,
      memories,
      openingMessage: plan.openingMessage ?? "",
      purpose: plan.purpose ?? "",
      proposedTime,
      contactsThisWeek: countContactsSince(profile.id, sevenDaysAgo),
    });

    const now = new Date().toISOString();

    if (report.status !== "approved") {
      const call = insertCall(
        CallRecordSchema.parse({
          id: randomUUID(),
          userId: profile.id,
          planId: plan.id,
          status: "skipped",
          detail: "Blocked by safety guardrails at trigger time",
          createdAt: now,
        }),
      );
      log.warn({ planId: plan.id }, "Call skipped by guardrails");
      res.status(200).json({ status: "skipped", safetyReport: report, call });
      return;
    }

    const ctx = buildCallContext({ profile, event, plan, memories });
    const toNumber = phoneNumber ?? profile.phoneNumber;
    const result = await placeOutboundCall(
      toNumber,
      ctx,
      profile.voiceCloningConsent,
    );

    const call = insertCall(
      CallRecordSchema.parse({
        id: randomUUID(),
        userId: profile.id,
        planId: plan.id,
        status: result.status,
        conversationId: result.conversationId,
        callSid: result.callSid,
        detail: result.detail,
        createdAt: now,
      }),
    );

    if (result.status === "initiated") {
      recordContact(profile.id, plan.id, "phone_call");
    }

    log.info({ planId: plan.id, status: result.status }, "Call triggered");
    res.status(201).json({ status: result.status, safetyReport: report, call });
  }),
);

/** ElevenLabs post-call webhook: persist status and transcript when we can. */
callsRouter.post(
  "/webhook",
  asyncHandler(async (req, res) => {
    const secret = process.env.ELEVENLABS_WEBHOOK_SECRET;
    if (secret && req.get("x-webhook-secret") !== secret) {
      res.status(401).json({ error: "Invalid webhook secret" });
      return;
    }

    const body = (req.body ?? {}) as Record<string, any>;
    const data = (body.data ?? body) as Record<string, any>;
    const conversationId: string | undefined =
      data.conversation_id ?? data.conversationId;
    const transcriptText =
      typeof data.transcript === "string"
        ? data.transcript
        : Array.isArray(data.transcript)
          ? data.transcript
              .map((t: any) => `${t.role ?? "?"}: ${t.message ?? t.text ?? ""}`)
              .join("\n")
          : undefined;

    if (conversationId) {
      const existing = getCallByConversationId(conversationId);
      if (existing) {
        updateCall(existing.id, {
          status: "completed",
          transcript: transcriptText,
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
