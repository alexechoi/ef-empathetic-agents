import { Router } from "express";
import { GeneratePlansRequestSchema } from "../schemas.js";
import { asyncHandler, parseOrThrow } from "../lib/http.js";
import { plannerGraph } from "../graph.js";
import { getUser } from "../db/repositories/users.js";
import { listEvents } from "../db/repositories/events.js";
import { listMemories } from "../db/repositories/memories.js";
import {
  deletePlansForUser,
  insertPlans,
  listPlans,
} from "../db/repositories/plans.js";
import { countContactsSince } from "../db/repositories/calls.js";
import { logger } from "../lib/logger.js";

const log = logger.child({ route: "plans" });

export const plansRouter = Router();

/**
 * Runs the planner graph over the user's stored profile, calendar and memories,
 * persists the resulting plans, and returns them with the live workflow trace.
 */
plansRouter.post(
  "/generate",
  asyncHandler(async (req, res) => {
    const { userId } = parseOrThrow(GeneratePlansRequestSchema, req.body);

    const profile = getUser(userId);
    if (!profile) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const result = await plannerGraph.invoke({
      profile,
      events: listEvents(userId),
      memories: listMemories(userId),
      contactsThisWeek: countContactsSince(userId, sevenDaysAgo),
      now: new Date().toISOString(),
    });

    deletePlansForUser(userId);
    insertPlans(result.plans);
    log.info({ userId, plans: result.plans.length }, "Plans generated");

    res.status(201).json({ plans: result.plans, trace: result.trace });
  }),
);

plansRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const userId = req.query.userId;
    if (typeof userId !== "string") {
      res.status(400).json({ error: "userId query param is required" });
      return;
    }
    res.json(listPlans(userId));
  }),
);
