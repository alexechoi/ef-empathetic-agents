import { randomUUID } from "node:crypto";
import { z } from "zod";
import { ChatOpenAI } from "@langchain/openai";
import { logger } from "../lib/logger.js";
import { DEFAULT_MODEL, OPENAI_BASE_URL } from "../lib/openai.js";
import {
  ExtractedMemorySchema,
  MemorySchema,
  type Memory,
  type SourceType,
} from "../schemas.js";

const log = logger.child({ module: "memory/extract" });

export interface ExtractInput {
  userId: string;
  text: string;
  sourceType: SourceType;
}

const ExtractionResultSchema = z.object({
  memories: z
    .array(ExtractedMemorySchema)
    .describe("Distinct memories found in the input. Empty if none."),
});

const SYSTEM_PROMPT = [
  "You extract structured memories about a user's deceased loved one from text the user provided",
  "(chat logs, written notes, or a transcribed voice note).",
  "Each memory should be a single, self-contained moment, habit, or saying.",
  "Summarise faithfully; never invent facts that are not supported by the text.",
  "themes are short lowercase tags (e.g. encouragement, interviews, cooking).",
  "relatedEvents are lowercase event kinds this memory would help with (e.g. job_interview, exam, birthday).",
  "emotionalTone is one or two words. sensitivity is low, medium, or high.",
].join(" ");

function personIdFor(userId: string): string {
  return `${userId}:loved-one`;
}

/** Deterministic fallback when no LLM key is configured or the call fails. */
function heuristicMemory(input: ExtractInput): Memory[] {
  const trimmed = input.text.trim();
  const summary =
    trimmed.length > 200 ? `${trimmed.slice(0, 197)}...` : trimmed;
  return [
    MemorySchema.parse({
      id: randomUUID(),
      userId: input.userId,
      personId: personIdFor(input.userId),
      sourceType: input.sourceType,
      summary,
      transcript: input.sourceType === "voice_note" ? trimmed : undefined,
      people: [],
      themes: [],
      relatedEvents: [],
      emotionalTone: "neutral",
      sensitivity: "medium",
      approvedForUse: false,
    }),
  ];
}

/**
 * Extracts structured memories from free text. Uses the hackathon LLM gateway
 * when OPENAI_API_KEY is set, otherwise falls back to a single heuristic memory
 * so ingestion always returns something usable for the demo.
 */
export async function extractMemories(input: ExtractInput): Promise<Memory[]> {
  if (!process.env.OPENAI_API_KEY) {
    log.warn("OPENAI_API_KEY not set; using heuristic memory extraction");
    return heuristicMemory(input);
  }

  try {
    const model = new ChatOpenAI({
      model: DEFAULT_MODEL,
      temperature: 0.2,
      configuration: { baseURL: OPENAI_BASE_URL },
      // Gateway can stall under event load — fail fast to heuristic fallbacks.
      timeout: 20_000,
      maxRetries: 1,
    }).withStructuredOutput(ExtractionResultSchema, { name: "extraction" });

    const { memories } = await model.invoke([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Source type: ${input.sourceType}\n---\n${input.text}`,
      },
    ]);

    if (memories.length === 0) {
      log.info("LLM found no memories; falling back to heuristic");
      return heuristicMemory(input);
    }

    return memories.map((m) =>
      MemorySchema.parse({
        ...m,
        id: randomUUID(),
        userId: input.userId,
        personId: personIdFor(input.userId),
        sourceType: input.sourceType,
        approvedForUse: false,
      }),
    );
  } catch (error) {
    log.error({ err: error }, "LLM extraction failed; using heuristic");
    return heuristicMemory(input);
  }
}
