import { randomUUID } from "node:crypto";
import { Router } from "express";
import { UserProfileSchema } from "../schemas.js";
import { asyncHandler, parseOrThrow } from "../lib/http.js";
import { getUser, upsertUser } from "../db/repositories/users.js";

export const usersRouter = Router();

/** Create or update a user's profile, preferences and consent. */
usersRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const profile = parseOrThrow(UserProfileSchema, {
      ...body,
      id: (body.id as string) ?? randomUUID(),
    });
    res.status(201).json(upsertUser(profile));
  }),
);

usersRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const profile = getUser(String(req.params.id));
    if (!profile) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(profile);
  }),
);
