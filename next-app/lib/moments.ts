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

export interface TraceStep {
  step: string;
  label: string;
  status: "ok" | "skip" | "blocked" | "info";
  detail?: string;
}

/** One derived deliberation row on a card, mirroring the 4 planner nodes. */
export interface MomentStep {
  label: string;
  detail?: string;
  tone: "ok" | "muted" | "blocked";
}

export interface Moment {
  id: string;
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
