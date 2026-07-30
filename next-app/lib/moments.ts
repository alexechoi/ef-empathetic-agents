// UI view-model over the agent-service shapes. Types below mirror
// agent-service/src/schemas.ts — copy shapes from there, never invent.

export type Decision = "reach_out" | "ask_first" | "stay_quiet" | "held_back";

export type SourceType = "voice_note" | "chat" | "written" | "calendar";

export interface Memory {
  id: string;
  sourceType: SourceType;
  summary: string;
  transcript?: string;
  themes: string[];
  emotionalTone: string;
  approvedForUse: boolean;
}

export interface SafetyCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface SafetyReport {
  status: "pending" | "approved" | "blocked";
  checks: SafetyCheck[];
}

/** A single step emitted by the planner graph, surfaced as the live trace. */
export interface TraceStep {
  step: string;
  label: string;
  status: "ok" | "skip" | "blocked" | "info";
  detail?: string;
  /** Present on live-streamed steps; absent on mock/static trace data. */
  at?: string;
  node?: string;
}

/** One derived deliberation row on a card, mirroring the 4 planner nodes. */
export interface MomentStep {
  label: string;
  detail?: string;
  tone: "ok" | "muted" | "blocked";
}

export interface Moment {
  id: string;
  /** Backend CalendarEvent id — event_decision SSE events key by this, not planId. */
  eventId: string;
  title: string;
  when: string;
  decision: Decision;
  reasoningSummary: string;
  steps: MomentStep[];
  confidence?: number;
  purpose?: string;
  openingMessage?: string;
  audioSrc?: string;
  memoryIds: string[];
  safetyReport?: SafetyReport;
}

// --- Backend shapes (copied from agent-service/src/schemas.ts) --------------

export interface CalendarEvent {
  id: string;
  userId: string;
  title: string;
  description?: string;
  startsAt: string;
  endsAt?: string;
  attendees: string[];
  location?: string;
}

export type Channel = "phone_call" | "voice_note";

export interface OutreachPlan {
  id: string;
  userId: string;
  eventId: string;
  shouldContact: boolean;
  proposedTime?: string;
  channel?: Channel;
  purpose?: string;
  selectedMemoryIds: string[];
  openingMessage?: string;
  confidence: number;
  reasoningSummary: string;
  safetyStatus: "pending" | "approved" | "blocked";
  safetyReport?: SafetyReport;
  createdAt: string;
}

/** Auditable, frontend-safe explanation of one planner decision (SSE event). */
export interface EventDecision {
  eventId: string;
  title: string;
  eventKind: string;
  importance: number;
  eventTypeEnabled: boolean;
  shouldContact: boolean;
  selectedMemoryIds: string[];
  reasoningSummary: string;
  safetyStatus: "pending" | "approved" | "blocked";
  failedGuardrails: SafetyCheck[];
}

// --- Adapter: backend shapes -> UI view-model --------------------------------

/**
 * Decision mapping (see SPEC.md "Data model"): the backend has no ask/sent
 * distinction — consent is a UI state layered on top of approved plans.
 * `reach_out` is set post-approval by use-moment-actions, never derived here.
 */
export function decisionFromPlan(plan: {
  shouldContact: boolean;
  safetyStatus: "pending" | "approved" | "blocked";
}): Decision {
  if (!plan.shouldContact) return "stay_quiet";
  if (plan.safetyStatus === "blocked") return "held_back";
  return "ask_first";
}

/** Per-card steps derived from plan fields — fallback for GET /plans + mocks. */
export function stepsFromPlan(plan: OutreachPlan): MomentStep[] {
  const steps: MomentStep[] = [
    {
      label: "Assessed importance",
      detail: `${plan.reasoningSummary} — confidence ${Math.round(plan.confidence * 100)}%`,
      tone: "ok",
    },
    {
      label:
        plan.selectedMemoryIds.length > 0
          ? "Retrieved memories"
          : "No memories retrieved",
      detail:
        plan.selectedMemoryIds.length > 0
          ? `${plan.selectedMemoryIds.length} memor${plan.selectedMemoryIds.length === 1 ? "y" : "ies"} selected`
          : undefined,
      tone: plan.selectedMemoryIds.length > 0 ? "ok" : "muted",
    },
    {
      label: plan.shouldContact ? "Proposed outreach" : "No contact proposed",
      detail: plan.purpose,
      tone: plan.shouldContact ? "ok" : "muted",
    },
  ];

  if (plan.safetyStatus === "blocked") {
    const failed = plan.safetyReport?.checks.filter((c) => !c.passed) ?? [];
    steps.push({
      label: "Blocked by safety",
      detail:
        failed.length > 0
          ? failed
              .map((c) => `${c.name}${c.detail ? ` — ${c.detail}` : ""}`)
              .join("; ")
          : undefined,
      tone: "blocked",
    });
  } else if (plan.safetyStatus === "approved") {
    steps.push({ label: "Safety checks passed", tone: "ok" });
  } else {
    steps.push({ label: "Awaiting safety review", tone: "muted" });
  }

  return steps;
}

/** Richer per-card steps derived from the stream's event_decision payload. */
export function stepsFromDecision(decision: EventDecision): MomentStep[] {
  const importancePct = Math.round(decision.importance * 100);
  const steps: MomentStep[] = [
    {
      label: "Assessed importance",
      detail: `${decision.eventKind.replaceAll("_", " ")} — importance ${importancePct}%${
        decision.eventTypeEnabled ? "" : " (event type not enabled)"
      }`,
      tone: decision.eventTypeEnabled ? "ok" : "muted",
    },
    {
      label:
        decision.selectedMemoryIds.length > 0
          ? "Retrieved memories"
          : "No memories retrieved",
      detail:
        decision.selectedMemoryIds.length > 0
          ? `${decision.selectedMemoryIds.length} memor${decision.selectedMemoryIds.length === 1 ? "y" : "ies"} selected`
          : undefined,
      tone: decision.selectedMemoryIds.length > 0 ? "ok" : "muted",
    },
    {
      label: decision.shouldContact ? "Proposed outreach" : "No contact proposed",
      detail: decision.reasoningSummary,
      tone: decision.shouldContact ? "ok" : "muted",
    },
  ];

  if (decision.safetyStatus === "blocked") {
    steps.push({
      label: "Blocked by safety",
      detail:
        decision.failedGuardrails.length > 0
          ? decision.failedGuardrails
              .map((c) => `${c.name}${c.detail ? ` — ${c.detail}` : ""}`)
              .join("; ")
          : undefined,
      tone: "blocked",
    });
  } else if (decision.safetyStatus === "approved") {
    steps.push({ label: "Safety checks passed", tone: "ok" });
  } else {
    steps.push({ label: "Awaiting safety review", tone: "muted" });
  }

  return steps;
}

/** Maps a run-level TraceStep's status onto a card-level MomentStep tone. */
export function traceToMomentStep(step: TraceStep): MomentStep {
  return {
    label: step.label,
    detail: step.detail,
    tone:
      step.status === "blocked" ? "blocked" : step.status === "skip" ? "muted" : "ok",
  };
}

/**
 * Deterministic, timezone-correct "when" copy. Today/Tomorrow are determined
 * by comparing `en-CA` (YYYY-MM-DD) date strings in Europe/London — never by
 * doing our own DST-sensitive date math.
 */
export function formatWhen(startsAt: string): string {
  const date = new Date(startsAt);
  const dayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const timeFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "numeric",
    minute: "2-digit",
  });

  const todayKey = dayKey.format(new Date());
  const tomorrowKey = dayKey.format(new Date(Date.now() + 86_400_000));
  const dateKey = dayKey.format(date);
  const time = timeFmt.format(date);

  if (dateKey === todayKey) return `Today, ${time}`;
  if (dateKey === tomorrowKey) return `Tomorrow, ${time}`;

  const longFmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${longFmt.format(date)}, ${time}`;
}

/** Pre-generated ElevenLabs demo clips, keyed by calendar event id. */
export const AUDIO_BY_EVENT: Record<string, string> = {
  "evt-interview": "/audio/interview.mp3",
  "evt-birthday": "/audio/birthday.mp3",
};

/**
 * Joins a CalendarEvent and its OutreachPlan into the UI view-model. Steps
 * come from the richer `EventDecision` when the live stream provided one,
 * else are hand-derived from the plan fields (GET /plans path, mock data).
 */
export function toMoment(
  event: CalendarEvent,
  plan: OutreachPlan,
  decision?: EventDecision,
): Moment {
  return {
    id: plan.id,
    eventId: event.id,
    title: event.title,
    when: formatWhen(event.startsAt),
    decision: decisionFromPlan(plan),
    reasoningSummary: decision?.reasoningSummary ?? plan.reasoningSummary,
    steps: decision ? stepsFromDecision(decision) : stepsFromPlan(plan),
    confidence: plan.confidence,
    purpose: plan.purpose,
    openingMessage: plan.openingMessage,
    audioSrc: AUDIO_BY_EVENT[event.id],
    memoryIds: plan.selectedMemoryIds,
    safetyReport: plan.safetyReport,
  };
}

// --- Synthetic demo data (mirrors agent-service/src/db/seed.ts) -------------

export const memories: Memory[] = [
  {
    id: "mem-interview-eve",
    sourceType: "voice_note",
    summary:
      "Dad always called the night before big interviews to remind Alex to just be themselves and breathe.",
    transcript:
      "Hey, it's Dad. Big day tomorrow. Just be yourself and breathe — you've got this.",
    themes: ["encouragement", "interviews", "calm"],
    emotionalTone: "warm",
    approvedForUse: true,
  },
  {
    id: "mem-first-day",
    sourceType: "voice_note",
    summary:
      "Before Alex's first day at work, Dad said he was proud no matter how it went.",
    transcript:
      "First day, huh? I'm proud of you already, whatever happens today.",
    themes: ["encouragement", "first_day", "pride"],
    emotionalTone: "proud",
    approvedForUse: true,
  },
  {
    id: "mem-exam-line",
    sourceType: "voice_note",
    summary:
      "Dad's classic line before exams: you've done the work, now go show them.",
    transcript: "You've done the work. Now go show them what you've got.",
    themes: ["encouragement", "exams", "confidence"],
    emotionalTone: "reassuring",
    approvedForUse: true,
  },
];

export const moments: Moment[] = [
  {
    id: "plan-interview",
    eventId: "evt-interview",
    title: "Final job interview",
    when: "Tomorrow, 10:00 AM",
    decision: "reach_out",
    reasoningSummary:
      "High-stakes moment matching Dad's pre-interview ritual; 2 memories selected",
    steps: [
      {
        label: "Assessed importance",
        detail: "Final round of the role Alex has been chasing — importance 0.92",
        tone: "ok",
      },
      {
        label: "Retrieved memories",
        detail: "2 voice notes matched: interview-eve pep talk, exam confidence",
        tone: "ok",
      },
      {
        label: "Proposed outreach",
        detail: "Voice message this evening, 2 hours before quiet hours",
        tone: "ok",
      },
      {
        label: "Safety checks passed",
        detail: "11/11 — consented, in frequency limit, offers easy decline",
        tone: "ok",
      },
    ],
    confidence: 0.92,
    purpose: "Share an encouraging memory of Dad before the final interview.",
    openingMessage:
      "Hi Alex. Big one tomorrow — the final interview. I found the voice note you saved from Dad, the one about breathing and being yourself. Would you like to hear it tonight?",
    audioSrc: "/audio/interview.mp3",
    memoryIds: ["mem-interview-eve", "mem-exam-line"],
    safetyReport: {
      status: "approved",
      checks: [
        { name: "opted_in", passed: true },
        { name: "outside_quiet_hours", passed: true },
        { name: "within_frequency_limit", passed: true, detail: "Contacts this week: 0 / 1" },
        { name: "offers_easy_decline", passed: true },
      ],
    },
  },
  {
    id: "plan-birthday",
    eventId: "evt-birthday",
    title: "Mum's birthday",
    when: "Friday",
    decision: "ask_first",
    reasoningSummary:
      "Meaningful family date — the first birthday without Dad; asking before reaching out",
    steps: [
      {
        label: "Assessed importance",
        detail: "First family birthday since Dad passed — emotionally heavy",
        tone: "ok",
      },
      {
        label: "Retrieved memories",
        detail: "1 voice note matched: Dad singing, 2022",
        tone: "ok",
      },
      {
        label: "Proposed outreach",
        detail: "Grief anniversaries cut both ways — proposing, not sending",
        tone: "ok",
      },
      {
        label: "Awaiting Alex's go-ahead",
        detail: "Approved by safety; consent-first for sensitive dates",
        tone: "muted",
      },
    ],
    confidence: 0.71,
    purpose: "Offer a warm memory of Dad ahead of Mum's birthday — only if wanted.",
    openingMessage:
      "Hi Alex. Friday is Mum's birthday — the first one without Dad. There's a memory you saved of him singing to her. Would it help to hear it, or shall I leave it be?",
    audioSrc: "/audio/birthday.mp3",
    memoryIds: ["mem-first-day"],
    safetyReport: {
      status: "approved",
      checks: [
        { name: "opted_in", passed: true },
        { name: "outside_quiet_hours", passed: true },
        { name: "within_frequency_limit", passed: true, detail: "Contacts this week: 0 / 1" },
        { name: "offers_easy_decline", passed: true },
      ],
    },
  },
  {
    id: "plan-lunch",
    eventId: "evt-lunch",
    title: "Family Sunday lunch",
    when: "Sunday, 1:00 PM",
    decision: "held_back",
    reasoningSummary:
      "A long-standing tradition worth marking — but the weekly contact limit is already used",
    steps: [
      {
        label: "Assessed importance",
        detail: "Recurring family tradition — importance 0.55",
        tone: "ok",
      },
      {
        label: "Retrieved memories",
        detail: "1 memory matched: first-day pride",
        tone: "ok",
      },
      {
        label: "Proposed outreach",
        detail: "Voice note Sunday morning",
        tone: "ok",
      },
      {
        label: "Blocked by safety",
        detail: "within_frequency_limit failed — Contacts this week: 1 / 1",
        tone: "blocked",
      },
    ],
    confidence: 0.55,
    memoryIds: ["mem-first-day"],
    safetyReport: {
      status: "blocked",
      checks: [
        { name: "opted_in", passed: true },
        { name: "outside_quiet_hours", passed: true },
        {
          name: "within_frequency_limit",
          passed: false,
          detail: "Contacts this week: 1 / 1",
        },
        { name: "offers_easy_decline", passed: true },
      ],
    },
  },
  {
    id: "plan-tuesday",
    eventId: "evt-tuesday",
    title: "Tuesday",
    when: "Nothing planned",
    decision: "stay_quiet",
    reasoningSummary:
      "No significant events; presence needs space to mean something",
    steps: [
      {
        label: "Assessed importance",
        detail: "No significant events on the calendar",
        tone: "muted",
      },
      {
        label: "No memories retrieved",
        tone: "muted",
      },
      {
        label: "No contact proposed",
        detail: "Reached out 2 days ago — staying quiet",
        tone: "muted",
      },
    ],
    confidence: 0.2,
    memoryIds: [],
  },
];

/** Run-level planner trace (one step per graph node), mock until wiring. */
export const plannerTrace: TraceStep[] = [
  {
    step: "evaluate_importance",
    label: "Evaluated event importance",
    status: "ok",
    detail: "4 events assessed, 3 important",
  },
  {
    step: "retrieve_memories",
    label: "Retrieved matching memories",
    status: "ok",
    detail: "3 approved memories considered",
  },
  {
    step: "generate_proposal",
    label: "Generated outreach proposal",
    status: "ok",
    detail: "3 plan(s) propose contact",
  },
  {
    step: "safety_validation",
    label: "Ran safety guardrails",
    status: "blocked",
    detail: "2 approved, 1 blocked",
  },
];

// --- Calls (mirror agent-service CallRecordSchema) ---------------------------

export type CallStatus = "initiated" | "skipped" | "failed" | "completed";

export interface CallRecord {
  id: string;
  planId: string;
  status: CallStatus;
  conversationId?: string;
  transcript?: string;
  detail?: string;
  createdAt: string;
}

export const recentCalls: CallRecord[] = [
  {
    id: "call-1",
    planId: "plan-earlier",
    status: "completed",
    conversationId: "conv-demo-1",
    detail: "Encouragement before Monday's presentation",
    transcript:
      "Agent: Hi Alex — I have a memory of Dad you saved for days like this. Would you like to hear it?\nAlex: Yes, please.",
    createdAt: "2026-07-28T18:05:00.000Z",
  },
];

// --- Knowledge graph (mirror agent-service KnowledgeGraphSchema) -------------

export interface KnowledgeGraphNode {
  id: string;
  type: "memory" | "person" | "theme" | "event";
  label: string;
  metadata: Record<string, string | number | boolean>;
}

export interface KnowledgeGraphEdge {
  id: string;
  source: string;
  target: string;
  type: "MENTIONS" | "HAS_THEME" | "RELATES_TO";
}

export interface KnowledgeGraph {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
}

export const memoryGraph: KnowledgeGraph = {
  nodes: [
    ...memories.map((m) => ({
      id: `memory:${m.id}`,
      type: "memory" as const,
      label: m.summary,
      metadata: {
        sourceType: m.sourceType,
        emotionalTone: m.emotionalTone,
        approvedForUse: m.approvedForUse,
      },
    })),
    { id: "person:dad", type: "person", label: "Dad", metadata: {} },
    { id: "person:alex", type: "person", label: "Alex", metadata: {} },
    { id: "theme:encouragement", type: "theme", label: "encouragement", metadata: {} },
    { id: "theme:interviews", type: "theme", label: "interviews", metadata: {} },
    { id: "theme:pride", type: "theme", label: "pride", metadata: {} },
    { id: "theme:confidence", type: "theme", label: "confidence", metadata: {} },
    { id: "event:evt-interview", type: "event", label: "Final job interview", metadata: { eventKind: "job_interview" } },
    { id: "event:evt-lunch", type: "event", label: "Family Sunday lunch", metadata: { eventKind: "family_tradition" } },
    { id: "event:evt-birthday", type: "event", label: "Mum's birthday", metadata: { eventKind: "family_tradition" } },
  ],
  edges: [
    { id: "e1", source: "memory:mem-interview-eve", target: "person:dad", type: "MENTIONS" },
    { id: "e2", source: "memory:mem-interview-eve", target: "theme:encouragement", type: "HAS_THEME" },
    { id: "e3", source: "memory:mem-interview-eve", target: "theme:interviews", type: "HAS_THEME" },
    { id: "e4", source: "memory:mem-interview-eve", target: "event:evt-interview", type: "RELATES_TO" },
    { id: "e5", source: "memory:mem-first-day", target: "person:dad", type: "MENTIONS" },
    { id: "e6", source: "memory:mem-first-day", target: "theme:pride", type: "HAS_THEME" },
    { id: "e7", source: "memory:mem-first-day", target: "event:evt-lunch", type: "RELATES_TO" },
    { id: "e8", source: "memory:mem-exam-line", target: "person:dad", type: "MENTIONS" },
    { id: "e9", source: "memory:mem-exam-line", target: "theme:confidence", type: "HAS_THEME" },
    { id: "e10", source: "memory:mem-exam-line", target: "theme:encouragement", type: "HAS_THEME" },
    { id: "e11", source: "memory:mem-exam-line", target: "event:evt-interview", type: "RELATES_TO" },
    { id: "e12", source: "memory:mem-interview-eve", target: "person:alex", type: "MENTIONS" },
  ],
};
