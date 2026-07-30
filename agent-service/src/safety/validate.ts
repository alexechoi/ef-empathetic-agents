import type {
  CalendarEvent,
  Memory,
  SafetyCheck,
  SafetyReport,
  UserProfile,
} from "../schemas.js";
import { isWithinQuietHours } from "../lib/time.js";

export interface SafetyInput {
  profile: UserProfile;
  event: CalendarEvent;
  /** The full memory objects selected for this outreach. */
  memories: Memory[];
  openingMessage: string;
  purpose: string;
  /** ISO instant the call is proposed for. */
  proposedTime: string;
  contactsThisWeek: number;
}

/** Phrases that imply the loved one is still alive / present / communicating. */
const ALIVE_CLAIMS = [
  "is alive",
  "still with us",
  "still here with you",
  "watching over you",
  "from heaven",
  "speaking to you",
  "wants you to know",
  "is here with you",
  "back with you",
];

const MEDICAL_LEGAL_FINANCIAL = [
  "diagnos",
  "prescri",
  "medication",
  "you should take",
  "lawsuit",
  "sue them",
  "legal advice",
  "invest in",
  "you should buy",
];

const DEPENDENCY_PHRASES = [
  "call me anytime",
  "i'm always here",
  "i am always here",
  "you can always rely on me",
  "talk to me whenever",
  "i'll always be here",
];

const CERTAINTY_PHRASES = [
  "i know you feel",
  "i know how you feel",
  "you must be devastated",
  "you are definitely",
  "i know exactly how",
];

function includesAny(haystack: string, needles: string[]): string | null {
  const lower = haystack.toLowerCase();
  return needles.find((n) => lower.includes(n)) ?? null;
}

/**
 * Deterministic guardrails. Every outreach must pass ALL checks before a call.
 * When a required signal is missing or ambiguous we fail closed (block).
 */
export function validateOutreach(input: SafetyInput): SafetyReport {
  const { profile, memories, openingMessage, purpose, proposedTime } = input;
  const message = `${openingMessage}\n${purpose}`;
  const checks: SafetyCheck[] = [];

  const add = (name: string, passed: boolean, detail?: string) =>
    checks.push({ name, passed, detail });

  add(
    "opted_in",
    profile.proactiveCallsConsent === true,
    profile.proactiveCallsConsent ? undefined : "User has not enabled proactive calls",
  );

  const inQuiet = isWithinQuietHours(
    proposedTime,
    profile.timeZone,
    profile.quietHours.start,
    profile.quietHours.end,
  );
  add(
    "outside_quiet_hours",
    !inQuiet,
    inQuiet ? "Proposed time falls within the user's quiet hours" : undefined,
  );

  add(
    "within_frequency_limit",
    input.contactsThisWeek < profile.maxContactsPerWeek,
    `Contacts this week: ${input.contactsThisWeek} / ${profile.maxContactsPerWeek}`,
  );

  add(
    "memories_present",
    memories.length > 0,
    memories.length === 0 ? "No memories selected for the interaction" : undefined,
  );

  const unapproved = memories.filter((m) => !m.approvedForUse);
  add(
    "memories_approved",
    memories.length > 0 && unapproved.length === 0,
    unapproved.length > 0
      ? `Unapproved memories: ${unapproved.map((m) => m.id).join(", ")}`
      : undefined,
  );

  const memoryText = memories
    .map((m) => `${m.summary} ${m.themes.join(" ")} ${m.transcript ?? ""}`)
    .join(" ");
  const prohibitedHit = profile.prohibitedTopics
    .map((t) => t.toLowerCase().trim())
    .filter(Boolean)
    .find((t) => `${message} ${memoryText}`.toLowerCase().includes(t));
  add(
    "no_prohibited_topics",
    !prohibitedHit,
    prohibitedHit ? `Mentions prohibited topic: ${prohibitedHit}` : undefined,
  );

  const aliveHit = includesAny(message, ALIVE_CLAIMS);
  add(
    "no_alive_claim",
    !aliveHit,
    aliveHit ? `Implies the loved one is present/alive: "${aliveHit}"` : undefined,
  );

  const adviceHit = includesAny(message, MEDICAL_LEGAL_FINANCIAL);
  add(
    "no_medical_legal_financial_advice",
    !adviceHit,
    adviceHit ? `Contains advice-like language: "${adviceHit}"` : undefined,
  );

  const dependencyHit = includesAny(message, DEPENDENCY_PHRASES);
  add(
    "no_dependency_encouragement",
    !dependencyHit,
    dependencyHit ? `Encourages dependency: "${dependencyHit}"` : undefined,
  );

  const certaintyHit = includesAny(message, CERTAINTY_PHRASES);
  add(
    "no_emotional_certainty",
    !certaintyHit,
    certaintyHit ? `Claims certainty about feelings: "${certaintyHit}"` : undefined,
  );

  const offersDecline =
    openingMessage.includes("?") ||
    /would you like|if you'?d like|only if|no pressure|happy to leave/i.test(
      openingMessage,
    );
  add(
    "offers_easy_decline",
    offersDecline,
    offersDecline ? undefined : "Opening does not offer an easy way to decline",
  );

  const status = checks.every((c) => c.passed) ? "approved" : "blocked";
  return { status, checks };
}
