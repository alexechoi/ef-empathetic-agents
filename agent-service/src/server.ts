import "dotenv/config";
import express from "express";
import cors from "cors";
import { logger } from "./lib/logger.js";
import { errorMiddleware } from "./lib/http.js";
import { getDb } from "./db/index.js";
import { seedIfEmpty } from "./db/seed.js";
import { mountRoutes } from "./routes/index.js";

const log = logger.child({ module: "server" });

export function createServer(): express.Express {
  const app = express();
  app.use(
    cors({ origin: process.env.WEB_APP_ORIGIN ?? "http://localhost:3000" }),
  );
  app.use(express.json({ limit: "2mb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "agent-service" });
  });

  mountRoutes(app);
  app.use(errorMiddleware);
  return app;
}

function start(): void {
  getDb();
  seedIfEmpty();

  const app = createServer();
  const port = Number(process.env.PORT ?? 2024);
  app.listen(port, () => {
    log.info({ port }, "agent-service listening");
  });
}

start();
