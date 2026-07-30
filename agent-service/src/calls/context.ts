import {
  CallContextSchema,
  type CalendarEvent,
  type CallContext,
  type Memory,
  type OutreachPlan,
  type UserProfile,
} from "../schemas.js";

export interface BuildCallContextInput {
  profile: UserProfile;
  event: CalendarEvent;
  plan: OutreachPlan;
  memories: Memory[];
}

/**
 * Assembles the narrow, restricted context package handed to the call agent.
 * Only the plan's selected memories and the user's stated preferences flow in —
 * never the full memory store.
 */
export function buildCallContext(input: BuildCallContextInput): CallContext {
  const { profile, event, plan, memories } = input;
  return CallContextSchema.parse({
    userName: profile.userName,
    lovedOneName: profile.lovedOneName,
    relationship: profile.relationship,
    event,
    purpose: plan.purpose ?? `Share a supportive memory before ${event.title}.`,
    memories,
    approvedOpeningMessage: plan.openingMessage ?? "",
    prohibitedTopics: profile.prohibitedTopics,
  });
}
