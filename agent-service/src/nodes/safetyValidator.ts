import { logger } from "../lib/logger.js";
import type { Memory, OutreachPlan } from "../schemas.js";
import { validateOutreach } from "../safety/validate.js";
import { trace, type PlannerStateType, type PlannerUpdate } from "../state.js";

const log = logger.child({ node: "safetyValidator" });

/**
 * Runs deterministic guardrails on every plan that proposes contact. Plans that
 * do not contact keep their pending status (no call will be placed).
 */
export async function safetyValidator(
  state: PlannerStateType,
): Promise<PlannerUpdate> {
  const { plans, memories, profile, contactsThisWeek } = state;
  const byId = new Map(memories.map((m) => [m.id, m]));
  const eventById = new Map(state.events.map((e) => [e.id, e]));

  const validated: OutreachPlan[] = plans.map((plan) => {
    if (!plan.shouldContact) return plan;

    const event = eventById.get(plan.eventId);
    if (!event) {
      return { ...plan, safetyStatus: "blocked" as const };
    }

    const selected = plan.selectedMemoryIds
      .map((id) => byId.get(id))
      .filter((m): m is Memory => Boolean(m));

    const report = validateOutreach({
      profile,
      event,
      memories: selected,
      openingMessage: plan.openingMessage ?? "",
      purpose: plan.purpose ?? "",
      proposedTime: plan.proposedTime ?? new Date().toISOString(),
      contactsThisWeek,
    });

    return { ...plan, safetyStatus: report.status, safetyReport: report };
  });

  const approved = validated.filter((p) => p.safetyStatus === "approved").length;
  const blocked = validated.filter((p) => p.safetyStatus === "blocked").length;
  log.info({ approved, blocked }, "Safety validation complete");

  return {
    plans: validated,
    trace: [
      trace(
        "safety_validation",
        "Ran safety guardrails",
        approved > 0 ? "ok" : blocked > 0 ? "blocked" : "info",
        `${approved} approved, ${blocked} blocked`,
      ),
    ],
  };
}
