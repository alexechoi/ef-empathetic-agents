import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { logger } from "../lib/logger.js";
import { DEFAULT_MODEL, OPENAI_BASE_URL } from "../lib/openai.js";
import type { CalendarEvent } from "../schemas.js";
import {
  trace,
  type EventAssessment,
  type PlannerStateType,
  type PlannerUpdate,
} from "../state.js";

const log = logger.child({ node: "evaluateImportance" });

const IMPORTANCE_THRESHOLD = 0.6;

const BASE_IMPORTANCE: Record<string, number> = {
  job_interview: 0.9,
  exam: 0.85,
  medical: 0.75,
  birthday: 0.8,
  anniversary: 0.8,
  family_tradition: 0.45,
  other: 0.2,
};

/** Keyword classifier mapping an event to a lowercase event kind. */
export function classifyEventKind(event: CalendarEvent): string {
  const text = `${event.title} ${event.description ?? ""}`.toLowerCase();
  if (/interview/.test(text)) return "job_interview";
  if (/exam|test|assessment/.test(text)) return "exam";
  if (/doctor|hospital|gp|clinic|appointment|surgery|medical/.test(text))
    return "medical";
  if (/birthday/.test(text)) return "birthday";
  if (/anniversary/.test(text)) return "anniversary";
  if (/lunch|dinner|tradition|family|holiday|christmas|thanksgiving/.test(text))
    return "family_tradition";
  return "other";
}

const LlmScoreSchema = z.object({
  importance: z.number().min(0).max(1),
  reason: z.string(),
});

async function llmScore(
  event: CalendarEvent,
  kind: string,
): Promise<{ importance: number; reason: string } | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const model = new ChatOpenAI({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      configuration: { baseURL: OPENAI_BASE_URL },
    }).withStructuredOutput(LlmScoreSchema, { name: "importance" });
    return await model.invoke([
      {
        role: "system",
        content:
          "Rate how emotionally meaningful this upcoming event is for someone who is grieving, where a supportive check-in could genuinely help. 0 = routine, 1 = deeply significant. Give one short reason.",
      },
      {
        role: "user",
        content: `Kind: ${kind}\nTitle: ${event.title}\nDescription: ${event.description ?? "(none)"}`,
      },
    ]);
  } catch (error) {
    log.error({ err: error }, "LLM importance scoring failed; using heuristic");
    return null;
  }
}

/**
 * Classifies and scores each upcoming event. An event is "important" only when
 * its kind is enabled by the user AND its score clears the threshold, so routine
 * or opted-out events are skipped.
 */
export async function evaluateImportance(
  state: PlannerStateType,
): Promise<PlannerUpdate> {
  const { events, profile } = state;
  const assessments: EventAssessment[] = [];

  for (const event of events) {
    const eventKind = classifyEventKind(event);
    const scored = await llmScore(event, eventKind);
    const importance = scored?.importance ?? BASE_IMPORTANCE[eventKind] ?? 0.2;
    const enabled = profile.enabledEventTypes.includes(eventKind);
    const important = enabled && importance >= IMPORTANCE_THRESHOLD;

    let reason: string;
    if (!enabled) reason = `User has not enabled outreach for ${eventKind} events`;
    else if (!important) reason = `Scored ${importance.toFixed(2)} — treated as routine`;
    else reason = scored?.reason ?? `${eventKind} is a meaningful moment`;

    assessments.push({ event, eventKind, important, importance, reason });
  }

  const importantCount = assessments.filter((a) => a.important).length;
  log.info({ total: assessments.length, importantCount }, "Events assessed");

  return {
    assessments,
    trace: [
      trace(
        "evaluate_importance",
        "Evaluated event importance",
        importantCount > 0 ? "ok" : "skip",
        `${importantCount} of ${assessments.length} event(s) look meaningful`,
      ),
    ],
  };
}
