import { logger } from "../lib/logger.js";
import type { CalendarEvent, Memory, UserProfile } from "../schemas.js";
import { getUser, upsertUser } from "./repositories/users.js";
import { getMemory, insertMemories } from "./repositories/memories.js";
import { getEvent, upsertEvents } from "./repositories/events.js";

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
    {
      ...base,
      id: "mem-next-step",
      sourceType: "written",
      summary:
        "When Alex worried about mistakes, Dad encouraged focusing only on the next manageable step.",
      transcript:
        "You don't need the whole staircase. Just take the next step.",
      themes: ["encouragement", "anxiety", "resilience"],
      relatedEvents: ["job_interview", "exam", "new_job"],
      emotionalTone: "steady",
      sensitivity: "low",
    },
    {
      ...base,
      id: "mem-sunday-roast",
      sourceType: "written",
      summary:
        "Sunday lunch was roast chicken, crispy potatoes, carrots and Dad's repeatedly checked gravy.",
      themes: ["family", "food", "sunday_lunch", "tradition"],
      relatedEvents: ["family_tradition"],
      emotionalTone: "fond",
      sensitivity: "low",
    },
    {
      ...base,
      id: "mem-sunday-music",
      sourceType: "written",
      summary:
        "Dad played Motown while cooking Sunday lunch and quietly sang the wrong lyrics.",
      themes: ["family", "music", "humour", "tradition"],
      relatedEvents: ["family_tradition"],
      emotionalTone: "playful",
      sensitivity: "low",
    },
    {
      ...base,
      id: "mem-tea",
      sourceType: "written",
      summary:
        "Dad took tea with a splash of milk and two sugars; Alex joked it was dessert.",
      themes: ["routine", "tea", "humour"],
      relatedEvents: ["family_tradition"],
      emotionalTone: "playful",
      sensitivity: "low",
    },
    {
      ...base,
      id: "mem-wimbledon",
      sourceType: "written",
      summary:
        "Alex and Dad watched Wimbledon with strawberries in the first set and tea in the second.",
      themes: ["tennis", "family", "tradition"],
      relatedEvents: ["family_tradition"],
      emotionalTone: "nostalgic",
      sensitivity: "low",
    },
    {
      ...base,
      id: "mem-cornwall",
      sourceType: "written",
      summary:
        "On a rainy Cornwall trip, Dad insisted on a beach walk and then bought everyone hot chips.",
      themes: ["travel", "family", "humour"],
      relatedEvents: ["family_tradition", "holiday"],
      emotionalTone: "fond",
      sensitivity: "low",
    },
    {
      ...base,
      id: "mem-tomato-pasta",
      sourceType: "written",
      summary:
        "Dad's quick dinner was tomato pasta with garlic, basil and far too much parmesan.",
      themes: ["food", "cooking", "routine"],
      relatedEvents: ["family_tradition"],
      emotionalTone: "warm",
      sensitivity: "low",
    },
    {
      ...base,
      id: "mem-birthday-voicemail",
      sourceType: "written",
      summary:
        "Dad left birthday voice messages early in the morning before the birthday person woke up.",
      themes: ["birthday", "family", "tradition"],
      relatedEvents: ["birthday"],
      emotionalTone: "warm",
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
 * Seeds missing deterministic demo records without overwriting user edits to
 * existing profiles, memory approvals, or calendar events. Idempotent.
 */
export function seedIfEmpty(): void {
  if (!getUser(DEMO_USER_ID)) upsertUser(demoProfile());

  const missingMemories = demoMemories().filter(
    (memory) => !getMemory(memory.id),
  );
  const missingEvents = demoEvents().filter((event) => !getEvent(event.id));
  if (missingMemories.length > 0) insertMemories(missingMemories);
  if (missingEvents.length > 0) upsertEvents(missingEvents);

  log.info(
    {
      userId: DEMO_USER_ID,
      memoriesAdded: missingMemories.length,
      eventsAdded: missingEvents.length,
    },
    "Demo data ready",
  );
}
