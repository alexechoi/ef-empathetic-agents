import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { logger } from "../lib/logger.js";
import { DEFAULT_MODEL, OPENAI_BASE_URL } from "../lib/openai.js";
import type { Memory, OutreachPlan, UserProfile } from "../schemas.js";
import { isoMinusHours } from "../lib/time.js";
import {
  trace,
  type EventAssessment,
  type PlannerStateType,
  type PlannerUpdate,
} from "../state.js";

const log = logger.child({ node: "generateProposal" });

interface Message {
  openingMessage: string;
  purpose: string;
}

function fallbackMessage(
  profile: UserProfile,
  assessment: EventAssessment,
): Message {
  const { userName, lovedOneName, relationship } = profile;
  return {
    openingMessage: `Hi ${userName}. You have ${assessment.event.title.toLowerCase()} coming up. I found a memory you saved about your ${relationship}, ${lovedOneName}, that might help — would you like to hear it?`,
    purpose: `Share an encouraging memory of ${lovedOneName} before ${assessment.event.title}.`,
  };
}

const MessageSchema = z.object({
  openingMessage: z
    .string()
    .describe(
      "A short, warm phone opening that ends with a question offering an easy decline.",
    ),
  purpose: z.string().describe("One sentence: the goal of the call."),
});

async function llmMessage(
  profile: UserProfile,
  assessment: EventAssessment,
  memories: Memory[],
): Promise<Message | null> {
  if (!process.env.OPENAI_API_KEY) return null;
  try {
    const model = new ChatOpenAI({
      model: DEFAULT_MODEL,
      temperature: 0.5,
      configuration: { baseURL: OPENAI_BASE_URL },
    }).withStructuredOutput(MessageSchema, { name: "message" });
    return await model.invoke([
      {
        role: "system",
        content: [
          "Write the opening for a gentle proactive phone call to someone grieving.",
          "Rules: never imply the loved one is alive/present/communicating; frame as 'a memory you saved'.",
          "No medical/legal/financial advice. End the opening with a question that makes declining easy.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `User: ${profile.userName}`,
          `Loved one: ${profile.lovedOneName} (${profile.relationship}, deceased)`,
          `Event: ${assessment.event.title}`,
          `Memories to reference: ${memories.map((m) => m.summary).join(" | ")}`,
        ].join("\n"),
      },
    ]);
  } catch (error) {
    log.error({ err: error }, "LLM message generation failed; using fallback");
    return null;
  }
}

/**
 * Turns assessments + selected memories into OutreachPlans. Emits a plan for
 * every event so the calendar can show each decision (contact vs no-contact).
 * Safety status is left "pending" here; the safety node decides it next.
 */
export async function generateProposal(
  state: PlannerStateType,
): Promise<PlannerUpdate> {
  const { assessments, selections, memories, profile } = state;
  const byId = new Map(memories.map((m) => [m.id, m]));
  const now = new Date().toISOString();
  const plans: OutreachPlan[] = [];

  for (const assessment of assessments) {
    const selectedIds = selections[assessment.event.id] ?? [];
    const selectedMemories = selectedIds
      .map((id) => byId.get(id))
      .filter((m): m is Memory => Boolean(m));
    const shouldContact = assessment.important && selectedMemories.length > 0;

    const base = {
      id: randomUUID(),
      userId: profile.id,
      eventId: assessment.event.id,
      selectedMemoryIds: selectedIds,
      confidence: assessment.important ? assessment.importance : 0.2,
      safetyStatus: "pending" as const,
      createdAt: now,
    };

    if (!shouldContact) {
      const reason =
        assessment.important && selectedMemories.length === 0
          ? "No relevant approved memories available for this event"
          : assessment.reason;
      plans.push({
        ...base,
        shouldContact: false,
        reasoningSummary: reason,
      });
      continue;
    }

    const message =
      (await llmMessage(profile, assessment, selectedMemories)) ??
      fallbackMessage(profile, assessment);

    plans.push({
      ...base,
      shouldContact: true,
      channel: "phone_call",
      proposedTime: isoMinusHours(assessment.event.startsAt, 2),
      purpose: message.purpose,
      openingMessage: message.openingMessage,
      reasoningSummary: `${assessment.reason}; ${selectedMemories.length} memory(ies) selected`,
    });
  }

  const contactCount = plans.filter((p) => p.shouldContact).length;
  log.info({ plans: plans.length, contactCount }, "Proposals generated");

  return {
    plans,
    trace: [
      trace(
        "generate_proposal",
        "Generated outreach proposal",
        contactCount > 0 ? "ok" : "skip",
        `${contactCount} plan(s) propose contact`,
      ),
    ],
  };
}
