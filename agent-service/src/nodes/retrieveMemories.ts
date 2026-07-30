import { logger } from "../lib/logger.js";
import type { Memory } from "../schemas.js";
import {
  trace,
  type EventAssessment,
  type PlannerStateType,
  type PlannerUpdate,
} from "../state.js";

const log = logger.child({ node: "retrieveMemories" });

const MAX_MEMORIES_PER_EVENT = 2;

/** Scores an approved memory's relevance to an event kind. Higher is better. */
function scoreMemory(memory: Memory, eventKind: string): number {
  let score = 0;
  if (memory.relatedEvents.includes(eventKind)) score += 3;
  if (memory.themes.includes("encouragement")) score += 1;
  // Soft token overlap between the event kind and memory themes.
  const kindTokens = eventKind.split("_");
  if (memory.themes.some((t) => kindTokens.some((k) => t.includes(k)))) score += 1;
  return score;
}

function selectForEvent(memories: Memory[], assessment: EventAssessment): string[] {
  return memories
    .filter((m) => m.approvedForUse)
    .map((m) => ({ m, score: scoreMemory(m, assessment.eventKind) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_MEMORIES_PER_EVENT)
    .map((x) => x.m.id);
}

/**
 * For each important event, selects the most relevant *approved* memories.
 * Unapproved memories are never surfaced here.
 */
export async function retrieveMemories(
  state: PlannerStateType,
): Promise<PlannerUpdate> {
  const { assessments, memories } = state;
  const selections: Record<string, string[]> = {};

  for (const assessment of assessments) {
    if (!assessment.important) continue;
    selections[assessment.event.id] = selectForEvent(memories, assessment);
  }

  const withMemories = Object.values(selections).filter((ids) => ids.length > 0)
    .length;
  const importantCount = assessments.filter((a) => a.important).length;
  log.info({ importantCount, withMemories }, "Memories retrieved");

  return {
    selections,
    trace: [
      trace(
        "retrieve_memories",
        "Retrieved relevant memories",
        withMemories > 0 ? "ok" : "skip",
        `Found approved memories for ${withMemories} of ${importantCount} meaningful event(s)`,
      ),
    ],
  };
}
