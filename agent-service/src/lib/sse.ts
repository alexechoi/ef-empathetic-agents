import type { Response } from "express";

/** Starts a Server-Sent Events response without buffering. */
export function startSse(res: Response): void {
  res.status(200);
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders();
}

/** Writes one named SSE event. Data must be JSON serializable. */
export function sendSse(res: Response, event: string, data: unknown): void {
  if (res.writableEnded || res.destroyed) return;
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export function endSse(res: Response): void {
  if (!res.writableEnded && !res.destroyed) res.end();
}

/**
 * Keeps the connection alive while long LLM calls run between events —
 * proxies (e.g. the Next.js rewrite in front of the UI) kill idle streams.
 * Returns a stop function; call it in the route's finally block.
 */
export function startSseHeartbeat(res: Response, intervalMs = 10_000): () => void {
  const timer = setInterval(
    () => sendSse(res, "ping", { at: new Date().toISOString() }),
    intervalMs,
  );
  return () => clearInterval(timer);
}
