import type { Express } from "express";
import { usersRouter } from "./users.js";
import { eventsRouter } from "./events.js";
import { memoriesRouter } from "./memories.js";
import { plansRouter } from "./plans.js";
import { callsRouter } from "./calls.js";

/** Mounts every feature router onto the app. */
export function mountRoutes(app: Express): void {
  app.use("/users", usersRouter);
  app.use("/events", eventsRouter);
  app.use("/memories", memoriesRouter);
  app.use("/plans", plansRouter);
  app.use("/calls", callsRouter);
}
