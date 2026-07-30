import { Annotation } from "@langchain/langgraph";
import type {
  CalendarEvent,
  Memory,
  OutreachPlan,
  TraceStep,
  UserProfile,
} from "./schemas.js";

const replace = <T>(_prev: T, next: T): T => next;
const append = <T>(prev: T[], next: T[]): T[] => [...prev, ...next];

/** Per-event importance verdict produced by the first planner node. */
export interface EventAssessment {
  event: CalendarEvent;
  eventKind: string;
  important: boolean;
  importance: number;
  reason: string;
}

/**
 * Shared planner state. Inputs are loaded from SQLite before invocation; the
 * nodes progressively fill `assessments`, `selections`, `plans` and always
 * append to `trace` so the caller can surface a live workflow trace.
 */
export const PlannerState = Annotation.Root({
  profile: Annotation<UserProfile>({ reducer: replace }),
  events: Annotation<CalendarEvent[]>({ reducer: replace, default: () => [] }),
  memories: Annotation<Memory[]>({ reducer: replace, default: () => [] }),
  contactsThisWeek: Annotation<number>({ reducer: replace, default: () => 0 }),
  now: Annotation<string>({
    reducer: replace,
    default: () => new Date().toISOString(),
  }),
  assessments: Annotation<EventAssessment[]>({
    reducer: replace,
    default: () => [],
  }),
  /** eventId -> selected memory ids. */
  selections: Annotation<Record<string, string[]>>({
    reducer: replace,
    default: () => ({}),
  }),
  plans: Annotation<OutreachPlan[]>({ reducer: replace, default: () => [] }),
  trace: Annotation<TraceStep[]>({ reducer: append, default: () => [] }),
});

export type PlannerStateType = typeof PlannerState.State;
export type PlannerUpdate = typeof PlannerState.Update;

/** Helper to build a trace step with a timestamp. */
export function trace(
  step: string,
  label: string,
  status: TraceStep["status"],
  detail?: string,
): TraceStep {
  return { step, label, status, detail, at: new Date().toISOString() };
}
