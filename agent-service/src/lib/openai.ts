import OpenAI from "openai";
import { logger } from "./logger.js";

const log = logger.child({ module: "openai" });

/**
 * The hackathon gateway speaks the OpenAI API. Only two things differ from a
 * normal OpenAI setup: the base URL and the team key. Both come from env.
 */
export const OPENAI_BASE_URL =
  process.env.OPENAI_BASE_URL ?? "https://4.231.223.10.nip.io";

/** Default model to develop against — fast and cheap per the handbook. */
export const DEFAULT_MODEL = process.env.OPENAI_MODEL ?? "gpt-5.4-mini";

let client: OpenAI | null = null;

/**
 * Shared OpenAI client pointed at the hackathon gateway. Import this anywhere
 * you need chat/audio/etc. instead of constructing a client per call site.
 *
 * @example
 * const res = await getOpenAI().chat.completions.create({
 *   model: DEFAULT_MODEL,
 *   messages: [{ role: "user", content: "Hi" }],
 * });
 */
export function getOpenAI(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    log.error("OPENAI_API_KEY is not set");
    throw new Error(
      "OPENAI_API_KEY is not set. Add your team key to agent-service/.env.",
    );
  }
  client ??= new OpenAI({ apiKey, baseURL: OPENAI_BASE_URL });
  return client;
}
