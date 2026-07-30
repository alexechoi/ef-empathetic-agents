import { Router } from "express";
import multer from "multer";
import { z } from "zod";
import { IngestMemoryRequestSchema } from "../schemas.js";
import { asyncHandler, parseOrThrow } from "../lib/http.js";
import { extractMemories } from "../memory/extract.js";
import { transcribeAudio } from "../lib/transcribe.js";
import {
  insertMemories,
  listMemories,
  setMemoryApproval,
} from "../db/repositories/memories.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ route: "memories" });
const upload = multer({ storage: multer.memoryStorage() });

export const memoriesRouter = Router();

/** Ingest pasted chat / written memories: extract, store, return. */
memoriesRouter.post(
  "/ingest",
  asyncHandler(async (req, res) => {
    const { userId, text, sourceType } = parseOrThrow(
      IngestMemoryRequestSchema,
      req.body,
    );
    const memories = await extractMemories({ userId, text, sourceType });
    res.status(201).json(insertMemories(memories));
  }),
);

/**
 * Upload a voice note: transcribe (or use a provided `transcript` fallback),
 * extract memories, store, return them plus the transcript used.
 */
memoriesRouter.post(
  "/upload",
  upload.single("audio"),
  asyncHandler(async (req, res) => {
    const userId = String(req.body?.userId ?? "");
    if (!userId) {
      res.status(400).json({ error: "userId form field is required" });
      return;
    }

    const providedTranscript =
      typeof req.body?.transcript === "string"
        ? req.body.transcript.trim()
        : "";
    let transcript = providedTranscript;

    if (!transcript) {
      if (!req.file) {
        res
          .status(400)
          .json({ error: "Provide an `audio` file or a `transcript` field" });
        return;
      }
      try {
        transcript = await transcribeAudio(req.file.buffer, req.file.originalname);
      } catch {
        res.status(502).json({
          error:
            "Audio transcription is unavailable on this gateway. Resend with a `transcript` field.",
        });
        return;
      }
    }

    const memories = await extractMemories({
      userId,
      text: transcript,
      sourceType: "voice_note",
    });
    res.status(201).json({ transcript, memories: insertMemories(memories) });
  }),
);

memoriesRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.query.userId;
    if (typeof userId !== "string") {
      res.status(400).json({ error: "userId query param is required" });
      return;
    }
    res.json(listMemories(userId));
  }),
);

const ApprovalSchema = z.object({ approvedForUse: z.boolean() });

/** Toggle whether a memory may be used in outreach (feeds the safety layer). */
memoriesRouter.patch(
  "/:id",
  asyncHandler(async (req, res) => {
    const { approvedForUse } = parseOrThrow(ApprovalSchema, req.body);
    const updated = setMemoryApproval(String(req.params.id), approvedForUse);
    if (!updated) {
      res.status(404).json({ error: "Memory not found" });
      return;
    }
    log.info({ id: updated.id, approvedForUse }, "Memory approval updated");
    res.json(updated);
  }),
);
