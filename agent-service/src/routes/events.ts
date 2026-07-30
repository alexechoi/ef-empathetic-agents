import { randomUUID } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { CalendarEventSchema } from "../schemas.js";
import { asyncHandler, parseOrThrow } from "../lib/http.js";
import { listEvents, upsertEvents } from "../db/repositories/events.js";

export const eventsRouter = Router();

const UpsertEventsRequestSchema = z.object({
  userId: z.string(),
  events: z
    .array(
      CalendarEventSchema.partial({ id: true, userId: true }).extend({
        title: z.string(),
        startsAt: z.string(),
      }),
    )
    .min(1),
});

/** Upsert one or more calendar events (mock or real Google Calendar sync). */
eventsRouter.post(
  "/",
  asyncHandler(async (req, res) => {
    const { userId, events } = parseOrThrow(UpsertEventsRequestSchema, req.body);
    const normalised = events.map((event) =>
      parseOrThrow(CalendarEventSchema, {
        ...event,
        id: event.id ?? randomUUID(),
        userId,
      }),
    );
    res.status(201).json(upsertEvents(normalised));
  }),
);

eventsRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.query.userId;
    if (typeof userId !== "string") {
      res.status(400).json({ error: "userId query param is required" });
      return;
    }
    res.json(listEvents(userId));
  }),
);
