import { z } from "zod";

/**
 * Single source of truth for the domain. Zod schemas here define both runtime
 * validation and the TypeScript types the rest of the service (and the frontend,
 * by copying these shapes) rely on. Keep this file free of side effects.
 */

export const SourceTypeSchema = z.enum([
  "voice_note",
  "chat",
  "written",
  "calendar",
]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const SensitivitySchema = z.enum(["low", "medium", "high"]);
export type Sensitivity = z.infer<typeof SensitivitySchema>;

/**
 * A structured memory extracted from something the user provided about their
 * loved one. `personId` identifies the loved one; `userId` scopes ownership.
 */
export const MemorySchema = z.object({
  id: z.string(),
  userId: z.string(),
  personId: z.string(),
  sourceType: SourceTypeSchema,
  summary: z.string(),
  transcript: z.string().optional(),
  people: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  relatedEvents: z.array(z.string()).default([]),
  emotionalTone: z.string().default("neutral"),
  sensitivity: SensitivitySchema.default("low"),
  approvedForUse: z.boolean().default(false),
});
export type Memory = z.infer<typeof MemorySchema>;

/** The fields an LLM produces per memory (ids/ownership are assigned by us). */
export const ExtractedMemorySchema = MemorySchema.omit({
  id: true,
  userId: true,
  personId: true,
  sourceType: true,
  approvedForUse: true,
});
export type ExtractedMemory = z.infer<typeof ExtractedMemorySchema>;

export const CalendarEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  startsAt: z.string(),
  endsAt: z.string().optional(),
  attendees: z.array(z.string()).default([]),
  location: z.string().optional(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const QuietHoursSchema = z.object({
  /** 24h "HH:MM" local to the user's timezone. */
  start: z.string().default("20:00"),
  end: z.string().default("08:00"),
});
export type QuietHours = z.infer<typeof QuietHoursSchema>;

/**
 * Onboarding profile + all the permissions/preferences the planner and safety
 * layer read. Consent defaults are conservative (off).
 */
export const UserProfileSchema = z.object({
  id: z.string(),
  userName: z.string(),
  lovedOneName: z.string(),
  relationship: z.string().default("loved one"),
  phoneNumber: z.string(),
  timeZone: z.string().default("Europe/London"),
  quietHours: QuietHoursSchema.default({ start: "20:00", end: "08:00" }),
  maxContactsPerWeek: z.number().int().nonnegative().default(1),
  proactiveCallsConsent: z.boolean().default(false),
  voiceCloningConsent: z.boolean().default(false),
  interactionStyle: z.string().default("warm and gentle"),
  /** Topics/events the user never wants mentioned. */
  prohibitedTopics: z.array(z.string()).default([]),
  /** Event categories allowed to trigger outreach, e.g. ["job_interview"]. */
  enabledEventTypes: z.array(z.string()).default([]),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const ChannelSchema = z.enum(["phone_call", "voice_note"]);
export type Channel = z.infer<typeof ChannelSchema>;

export const SafetyStatusSchema = z.enum(["pending", "approved", "blocked"]);
export type SafetyStatus = z.infer<typeof SafetyStatusSchema>;

export const SafetyCheckSchema = z.object({
  name: z.string(),
  passed: z.boolean(),
  detail: z.string().optional(),
});
export type SafetyCheck = z.infer<typeof SafetyCheckSchema>;

export const SafetyReportSchema = z.object({
  status: SafetyStatusSchema,
  checks: z.array(SafetyCheckSchema),
});
export type SafetyReport = z.infer<typeof SafetyReportSchema>;

export const OutreachPlanSchema = z.object({
  id: z.string(),
  userId: z.string(),
  eventId: z.string(),
  shouldContact: z.boolean(),
  proposedTime: z.string().optional(),
  channel: ChannelSchema.optional(),
  purpose: z.string().optional(),
  selectedMemoryIds: z.array(z.string()).default([]),
  openingMessage: z.string().optional(),
  confidence: z.number().min(0).max(1),
  reasoningSummary: z.string(),
  safetyStatus: SafetyStatusSchema.default("pending"),
  safetyReport: SafetyReportSchema.optional(),
  createdAt: z.string(),
});
export type OutreachPlan = z.infer<typeof OutreachPlanSchema>;

/** The narrow package handed to the call agent. No unrestricted data access. */
export const CallContextSchema = z.object({
  userName: z.string(),
  lovedOneName: z.string(),
  event: CalendarEventSchema,
  purpose: z.string(),
  memories: z.array(MemorySchema),
  approvedOpeningMessage: z.string(),
  prohibitedTopics: z.array(z.string()).default([]),
});
export type CallContext = z.infer<typeof CallContextSchema>;

export const CallStatusSchema = z.enum([
  "initiated",
  "skipped",
  "failed",
  "completed",
]);
export type CallStatus = z.infer<typeof CallStatusSchema>;

export const CallRecordSchema = z.object({
  id: z.string(),
  userId: z.string(),
  planId: z.string(),
  status: CallStatusSchema,
  conversationId: z.string().optional(),
  callSid: z.string().optional(),
  transcript: z.string().optional(),
  detail: z.string().optional(),
  createdAt: z.string(),
});
export type CallRecord = z.infer<typeof CallRecordSchema>;

/** A single step emitted by the planner graph, surfaced as the live trace. */
export const TraceStepSchema = z.object({
  step: z.string(),
  label: z.string(),
  status: z.enum(["ok", "skip", "blocked", "info"]),
  detail: z.string().optional(),
  at: z.string(),
});
export type TraceStep = z.infer<typeof TraceStepSchema>;

// --- Request DTOs (spec section 11) ---------------------------------------

export const IngestMemoryRequestSchema = z.object({
  userId: z.string(),
  text: z.string().min(1),
  sourceType: SourceTypeSchema.default("chat"),
});
export type IngestMemoryRequest = z.infer<typeof IngestMemoryRequestSchema>;

export const GeneratePlansRequestSchema = z.object({
  userId: z.string(),
});
export type GeneratePlansRequest = z.infer<typeof GeneratePlansRequestSchema>;

export const TriggerCallRequestSchema = z.object({
  planId: z.string(),
  phoneNumber: z.string().optional(),
});
export type TriggerCallRequest = z.infer<typeof TriggerCallRequestSchema>;
