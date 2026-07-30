import { randomUUID } from "node:crypto";
import { buildCallContext } from "../calls/context.js";
import {
  countContactsSince,
  insertCall,
  recordContact,
} from "../db/repositories/calls.js";
import { getEvent } from "../db/repositories/events.js";
import { getMemoriesByIds } from "../db/repositories/memories.js";
import { getPlan } from "../db/repositories/plans.js";
import { getUser } from "../db/repositories/users.js";
import { placeOutboundCall } from "../lib/elevenlabs.js";
import {
  CallRecordSchema,
  type CallRecord,
  type SafetyReport,
  type TraceStep,
  type TriggerCallRequest,
} from "../schemas.js";
import { validateOutreach } from "../safety/validate.js";

export class CallExecutionError extends Error {
  constructor(
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
  }
}

export interface CallObserver {
  trace(step: TraceStep): void;
  context(data: {
    eventId: string;
    purpose: string;
    selectedMemoryIds: string[];
    reasoningSummary: string;
  }): void;
}

export interface CallExecutionOutput {
  httpStatus: number;
  status: CallRecord["status"];
  safetyReport: SafetyReport;
  call: CallRecord;
}

function callTrace(
  step: string,
  label: string,
  status: TraceStep["status"],
  detail?: string,
): TraceStep {
  return { step, label, status, detail, at: new Date().toISOString() };
}

const noopObserver: CallObserver = {
  trace: () => undefined,
  context: () => undefined,
};

/**
 * Runs the complete, safety-gated caller workflow. Observer events are concise
 * audit summaries; raw prompts and model chain-of-thought never leave this layer.
 */
export async function executeCall(
  request: TriggerCallRequest,
  observer: CallObserver = noopObserver,
): Promise<CallExecutionOutput> {
  const plan = getPlan(request.planId);
  if (!plan) throw new CallExecutionError("Plan not found", 404);
  if (!plan.shouldContact) {
    throw new CallExecutionError("Plan does not propose contact", 409);
  }
  observer.trace(
    callTrace(
      "load_plan",
      "Loaded approved outreach plan",
      "ok",
      plan.reasoningSummary,
    ),
  );

  const profile = getUser(plan.userId);
  const event = getEvent(plan.eventId);
  if (!profile || !event) {
    throw new CallExecutionError("Plan's user or event no longer exists", 404);
  }
  const memories = getMemoriesByIds(plan.selectedMemoryIds);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const report = validateOutreach({
    profile,
    event,
    memories,
    openingMessage: plan.openingMessage ?? "",
    purpose: plan.purpose ?? "",
    proposedTime: plan.proposedTime ?? new Date().toISOString(),
    contactsThisWeek: countContactsSince(profile.id, sevenDaysAgo),
  });
  const passedChecks = report.checks.filter((check) => check.passed).length;
  observer.trace(
    callTrace(
      "safety_recheck",
      "Re-checked call guardrails",
      report.status === "approved" ? "ok" : "blocked",
      `${passedChecks}/${report.checks.length} guardrails passed`,
    ),
  );

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
    observer.trace(
      callTrace(
        "persist_call",
        "Stored blocked call attempt",
        "blocked",
        "No call was placed",
      ),
    );
    return { httpStatus: 200, status: "skipped", safetyReport: report, call };
  }

  const context = buildCallContext({ profile, event, plan, memories });
  observer.context({
    eventId: event.id,
    purpose: context.purpose,
    selectedMemoryIds: memories.map((memory) => memory.id),
    reasoningSummary: plan.reasoningSummary,
  });
  observer.trace(
    callTrace(
      "build_context",
      "Built restricted call context",
      "ok",
      `${memories.length} approved memory(ies) included`,
    ),
  );

  const result = await placeOutboundCall(
    request.phoneNumber ?? profile.phoneNumber,
    context,
    profile.voiceCloningConsent,
  );
  observer.trace(
    callTrace(
      "initiate_call",
      "Initiated ElevenLabs call",
      result.status === "initiated" ? "ok" : "blocked",
      result.detail,
    ),
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
  observer.trace(
    callTrace(
      "persist_call",
      "Stored call record",
      result.status === "initiated" ? "ok" : "blocked",
      `Call status: ${result.status}`,
    ),
  );
  return { httpStatus: 201, status: result.status, safetyReport: report, call };
}
