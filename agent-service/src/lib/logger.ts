import pino from "pino";

/**
 * Centralised logger for the agent service. Every node and library wrapper
 * should log through a child of this instance so output is structured and
 * consistently tagged. Use `logger.child({ node: "caller" })` per module.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  base: { service: "agent-service" },
});

export type Logger = typeof logger;
