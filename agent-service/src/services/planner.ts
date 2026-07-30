import { countContactsSince } from "../db/repositories/calls.js";
import { listEvents } from "../db/repositories/events.js";
import { listMemories } from "../db/repositories/memories.js";
import {
  deletePlansForUser,
  insertPlans,
} from "../db/repositories/plans.js";
import { getUser } from "../db/repositories/users.js";
import { plannerGraph } from "../graph.js";
import {
  EventDecisionSchema,
  type EventDecision,
  type OutreachPlan,
  type TraceStep,
} from "../schemas.js";
import type { EventAssessment } from "../state.js";

export interface PlannerInput {
  profile: NonNullable<ReturnType<typeof getUser>>;
  events: ReturnType<typeof listEvents>;
  memories: ReturnType<typeof listMemories>;
  contactsThisWeek: number;
  now: string;
}

export interface PlannerResult {
  plans: OutreachPlan[];
  trace: TraceStep[];
}

export function loadPlannerInput(userId: string): PlannerInput | null {
  const profile = getUser(userId);
  if (!profile) return null;

  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  return {
    profile,
    events: listEvents(userId),
    memories: listMemories(userId),
    contactsThisWeek: countContactsSince(userId, sevenDaysAgo),
    now,
  };
}

export function persistPlannerPlans(
  userId: string,
  plans: OutreachPlan[],
): OutreachPlan[] {
  deletePlansForUser(userId);
  return insertPlans(plans);
}

export async function runPlanner(input: PlannerInput): Promise<PlannerResult> {
  const result = await plannerGraph.invoke(input);
  return { plans: result.plans, trace: result.trace };
}

export async function runAndPersistPlanner(
  userId: string,
): Promise<PlannerResult | null> {
  const input = loadPlannerInput(userId);
  if (!input) return null;
  const result = await runPlanner(input);
  persistPlannerPlans(userId, result.plans);
  return result;
}

/** Builds concise, auditable event explanations without model chain-of-thought. */
export function buildEventDecisions(
  assessments: EventAssessment[],
  plans: OutreachPlan[],
  enabledEventTypes: string[],
): EventDecision[] {
  const plansByEvent = new Map(plans.map((plan) => [plan.eventId, plan]));
  return assessments.map((assessment) => {
    const plan = plansByEvent.get(assessment.event.id);
    return EventDecisionSchema.parse({
      eventId: assessment.event.id,
      title: assessment.event.title,
      eventKind: assessment.eventKind,
      importance: assessment.importance,
      eventTypeEnabled: enabledEventTypes.includes(assessment.eventKind),
      shouldContact: plan?.shouldContact ?? false,
      selectedMemoryIds: plan?.selectedMemoryIds ?? [],
      reasoningSummary: plan?.reasoningSummary ?? assessment.reason,
      safetyStatus: plan?.safetyStatus ?? "pending",
      failedGuardrails:
        plan?.safetyReport?.checks.filter((check) => !check.passed) ?? [],
    });
  });
}
