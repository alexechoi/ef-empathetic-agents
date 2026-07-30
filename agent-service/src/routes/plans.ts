import { Router } from "express";
import {
  GeneratePlansRequestSchema,
  type OutreachPlan,
  type TraceStep,
} from "../schemas.js";
import { asyncHandler, parseOrThrow } from "../lib/http.js";
import { plannerGraph } from "../graph.js";
import { listPlans } from "../db/repositories/plans.js";
import { logger } from "../lib/logger.js";
import { endSse, sendSse, startSse } from "../lib/sse.js";
import {
  buildEventDecisions,
  loadPlannerInput,
  persistPlannerPlans,
  runAndPersistPlanner,
} from "../services/planner.js";
import type { EventAssessment } from "../state.js";

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
    const result = await runAndPersistPlanner(userId);
    if (!result) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    log.info({ userId, plans: result.plans.length }, "Plans generated");
    res.status(201).json({ plans: result.plans, trace: result.trace });
  }),
);

interface PlannerStreamUpdate {
  assessments?: EventAssessment[];
  plans?: OutreachPlan[];
  trace?: TraceStep[];
}

/** Streams each LangGraph node update and the final per-event decisions. */
plansRouter.post("/generate/stream", async (req, res) => {
  let userId: string;
  try {
    ({ userId } = parseOrThrow(GeneratePlansRequestSchema, req.body));
  } catch (error) {
    log.error({ err: error }, "Invalid planner stream request");
    res.status(400).json({ error: "Validation failed" });
    return;
  }

  const input = loadPlannerInput(userId);
  if (!input) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  startSse(res);
  const abort = new AbortController();
  res.on("close", () => abort.abort());
  sendSse(res, "started", { userId, at: new Date().toISOString() });

  let assessments: EventAssessment[] = [];
  let plans: OutreachPlan[] = [];

  try {
    const stream = await plannerGraph.stream(input, {
      streamMode: "updates",
      signal: abort.signal,
    });
    for await (const rawChunk of stream) {
      const chunk = rawChunk as Record<string, PlannerStreamUpdate>;
      for (const [node, update] of Object.entries(chunk)) {
        if (update.assessments) assessments = update.assessments;
        if (update.plans) plans = update.plans;
        for (const step of update.trace ?? []) {
          sendSse(res, "trace", { node, ...step });
        }
      }
    }

    persistPlannerPlans(userId, plans);
    for (const decision of buildEventDecisions(
      assessments,
      plans,
      input.profile.enabledEventTypes,
    )) {
      sendSse(res, "event_decision", decision);
    }
    sendSse(res, "plans", plans);
    sendSse(res, "complete", { planCount: plans.length });
    log.info({ userId, plans: plans.length }, "Planner stream complete");
  } catch (error) {
    if (!abort.signal.aborted) {
      log.error({ err: error, userId }, "Planner stream failed");
      sendSse(res, "error", { message: "Planner stream failed" });
    }
  } finally {
    endSse(res);
  }
});

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
