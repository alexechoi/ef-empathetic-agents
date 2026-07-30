import { logger } from "../lib/logger.js";
import type { CalendarEvent, Memory, UserProfile } from "../schemas.js";
import { getUser, upsertUser } from "./repositories/users.js";
import { insertMemories } from "./repositories/memories.js";
import { upsertEvents } from "./repositories/events.js";

const log = logger.child({ module: "seed" });

export const DEMO_USER_ID = "demo-user";
const DEMO_PERSON_ID = "loved-one-dad";

/** Next occurrence of `hour:minute` local time, today if still ahead else tomorrow. */
function nextAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  if (d.getTime() <= Date.now()) d.setDate(d.getDate() + 1);
  return d;
}

/** Next given weekday (0=Sun) at hour:minute. */
function nextWeekdayAt(weekday: number, hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  const delta = (weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function daysFromNow(days: number, hour = 9): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

function demoProfile(): UserProfile {
  return {
    id: DEMO_USER_ID,
    userName: "Alex",
    lovedOneName: "Dad",
    relationship: "father",
    phoneNumber: process.env.DEMO_PHONE_NUMBER ?? "+440000000000",
    timeZone: "Europe/London",
    quietHours: { start: "20:00", end: "08:00" },
    maxContactsPerWeek: 1,
    proactiveCallsConsent: true,
    voiceCloningConsent: false,
    interactionStyle: "warm and gentle",
    prohibitedTopics: ["medical diagnoses", "money problems"],
    enabledEventTypes: ["job_interview", "family_tradition"],
  };
}

function demoMemories(): Memory[] {
  const base = {
    userId: DEMO_USER_ID,
    personId: DEMO_PERSON_ID,
    sourceType: "voice_note" as const,
    people: ["Dad", "Alex"],
    approvedForUse: true,
  };
  return [
    {
      ...base,
      id: "mem-interview-eve",
      summary:
        "Dad always called the night before big interviews to remind Alex to just be themselves and breathe.",
      transcript:
        "Hey, it's Dad. Big day tomorrow. Just be yourself and breathe — you've got this.",
      themes: ["encouragement", "interviews", "calm"],
      relatedEvents: ["job_interview"],
      emotionalTone: "warm",
      sensitivity: "low",
    },
    {
      ...base,
      id: "mem-first-day",
      summary:
        "Before Alex's first day at work, Dad said he was proud no matter how it went.",
      transcript:
        "First day, huh? I'm proud of you already, whatever happens today.",
      themes: ["encouragement", "first_day", "pride"],
      relatedEvents: ["job_interview", "new_job"],
      emotionalTone: "proud",
      sensitivity: "low",
    },
    {
      ...base,
      id: "mem-exam-line",
      summary:
        "Dad's classic line before exams: you've done the work, now go show them.",
      transcript: "You've done the work. Now go show them what you've got.",
      themes: ["encouragement", "exams", "confidence"],
      relatedEvents: ["job_interview", "exam"],
      emotionalTone: "reassuring",
      sensitivity: "low",
    },
  ];
}

function demoEvents(): CalendarEvent[] {
  return [
    {
      id: "evt-interview",
      userId: DEMO_USER_ID,
      title: "Final job interview",
      description: "Final round interview for the role Alex has been chasing.",
      startsAt: nextAt(10, 0).toISOString(),
      endsAt: nextAt(11, 0).toISOString(),
      attendees: ["Alex"],
      location: "Onsite",
    },
    {
      id: "evt-lunch",
      userId: DEMO_USER_ID,
      title: "Family Sunday lunch",
      description: "The usual family lunch — a long-standing tradition.",
      startsAt: nextWeekdayAt(0, 13, 0).toISOString(),
      attendees: ["Alex", "Family"],
      location: "Home",
    },
    {
      id: "evt-birthday",
      userId: DEMO_USER_ID,
      title: "Mum's birthday",
      description: "A meaningful family date.",
      startsAt: daysFromNow(30, 9).toISOString(),
      attendees: ["Alex", "Family"],
    },
  ];
}

/**
 * Seeds deterministic demo data (father, three voice-note memories, a calendar
 * with an upcoming interview) the first time the DB is empty. Idempotent.
 */
export function seedIfEmpty(): void {
  if (getUser(DEMO_USER_ID)) {
    log.info({ userId: DEMO_USER_ID }, "Demo data already present; skipping seed");
    return;
  }
  upsertUser(demoProfile());
  insertMemories(demoMemories());
  upsertEvents(demoEvents());
  log.info({ userId: DEMO_USER_ID }, "Seeded demo data");
}
