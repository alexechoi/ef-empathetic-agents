import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { logger } from "../lib/logger.js";
import type { AgentStateType, AgentUpdate, Brief, Contact } from "../state.js";

const log = logger.child({ node: "orchestrator" });

const briefSchema = z.object({
  shouldCall: z
    .boolean()
    .describe("True only if reaching out now is warranted and would help."),
  reason: z.string().describe("One sentence explaining the decision."),
  objective: z.string().describe("The single goal of the call."),
  firstMessage: z
    .string()
    .describe("Warm, empathetic opening line the voice agent will say first."),
  dynamicVariables: z
    .record(z.string(), z.string())
    .describe("Key facts for the caller, e.g. { contact_name, situation }."),
});

const SYSTEM_PROMPT = [
  "You are the orchestrator for an empathetic outreach system.",
  "Given a contact and a situation, decide whether a caring phone call should be made right now.",
  "Only choose to call when it is genuinely helpful and appropriate; otherwise set shouldCall to false.",
  "When calling, write a warm, human first message and a clear objective.",
].join(" ");

function buildFallbackBrief(contact: Contact, context: string): Brief {
  const shouldCall = context.trim().length > 0;
  return {
    shouldCall,
    reason: shouldCall
      ? "Heuristic fallback: a situation was provided, so we reach out."
      : "Heuristic fallback: no situation provided, nothing to act on.",
    objective: `Check in with ${contact.name} about their current situation.`,
    firstMessage: `Hi ${contact.name}, I'm reaching out to see how you're doing and whether there's anything I can help with.`,
    dynamicVariables: {
      contact_name: contact.name,
      situation: context.trim(),
    },
  };
}

async function buildLlmBrief(
  contact: Contact,
  context: string,
): Promise<Brief> {
  const model = new ChatOpenAI({
    model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
    temperature: 0.3,
  }).withStructuredOutput(briefSchema, { name: "brief" });

  const brief = await model.invoke([
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Contact: ${contact.name} (${contact.phoneNumber})\nSituation: ${context || "(none provided)"}`,
    },
  ]);

  return {
    ...brief,
    dynamicVariables: {
      contact_name: contact.name,
      situation: context.trim(),
      ...brief.dynamicVariables,
    },
  };
}

/**
 * Decision layer. Produces a Brief describing whether and how to reach out.
 * Uses an LLM when OPENAI_API_KEY is set, otherwise a deterministic heuristic.
 */
export async function orchestrator(
  state: AgentStateType,
): Promise<AgentUpdate> {
  const { contact, context } = state;
  const useLlm = Boolean(process.env.OPENAI_API_KEY);

  let brief: Brief;
  if (useLlm) {
    try {
      brief = await buildLlmBrief(contact, context);
    } catch (error) {
      log.error({ err: error }, "LLM brief failed; using heuristic fallback");
      brief = buildFallbackBrief(contact, context);
    }
  } else {
    log.warn("OPENAI_API_KEY not set; using heuristic brief");
    brief = buildFallbackBrief(contact, context);
  }

  log.info({ shouldCall: brief.shouldCall, reason: brief.reason }, "Brief ready");
  return { brief };
}
