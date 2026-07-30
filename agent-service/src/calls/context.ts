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
  knowledgeMemories: Memory[];
}

/**
 * Assembles the approved, user-scoped context package handed to the call agent.
 * Planner-selected memories stay prominent while the complete approved memory
 * set supports grounded follow-up questions.
 */
export function buildCallContext(input: BuildCallContextInput): CallContext {
  const { profile, event, plan, memories, knowledgeMemories } = input;
  return CallContextSchema.parse({
    userName: profile.userName,
    lovedOneName: profile.lovedOneName,
    relationship: profile.relationship,
    event,
    purpose: plan.purpose ?? `Share a supportive memory before ${event.title}.`,
    memories,
    knowledgeMemories,
    approvedOpeningMessage: plan.openingMessage ?? "",
    prohibitedTopics: profile.prohibitedTopics,
  });
}
