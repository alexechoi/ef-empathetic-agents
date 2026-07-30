import { toFile } from "openai";
import { getOpenAI } from "./openai.js";
import { logger } from "./logger.js";

const log = logger.child({ module: "transcribe" });

const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL ?? "whisper-1";

/**
 * Transcribes an audio buffer via the OpenAI-compatible gateway. Throws on
 * failure (callers can fall back to an accepted `transcript` field) and always
 * logs the error.
 */
export async function transcribeAudio(
  buffer: Buffer,
  filename = "voice-note.mp3",
): Promise<string> {
  try {
    const file = await toFile(buffer, filename);
    const result = await getOpenAI().audio.transcriptions.create({
      file,
      model: TRANSCRIBE_MODEL,
    });
    return result.text;
  } catch (error) {
    log.error({ err: error, model: TRANSCRIBE_MODEL }, "Transcription failed");
    throw error instanceof Error ? error : new Error(String(error));
  }
}
