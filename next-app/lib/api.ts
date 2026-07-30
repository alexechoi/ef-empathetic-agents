// Typed client over agent-service, consumed through the /api/agent rewrite
// (see next.config.ts). Every shape here mirrors agent-service/src/schemas.ts —
// copy shapes, never invent parallel ones.

import type {
  CallRecord,
  CalendarEvent,
  KnowledgeGraph,
  Memory,
  OutreachPlan,
  SourceType,
  TraceStep,
} from "./moments";

export const USER_ID = "demo-user";

export const API_BASE = process.env.NEXT_PUBLIC_AGENT_URL ?? "/api/agent";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? "GET"} ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function getEvents(userId: string = USER_ID): Promise<CalendarEvent[]> {
  return request(`/events?userId=${encodeURIComponent(userId)}`);
}

export function getPlans(userId: string = USER_ID): Promise<OutreachPlan[]> {
  return request(`/plans?userId=${encodeURIComponent(userId)}`);
}

export function getMemories(userId: string = USER_ID): Promise<Memory[]> {
  return request(`/memories?userId=${encodeURIComponent(userId)}`);
}

export function getCalls(userId: string = USER_ID): Promise<CallRecord[]> {
  return request(`/calls?userId=${encodeURIComponent(userId)}`);
}

export function getMemoryGraph(
  userId: string = USER_ID,
): Promise<KnowledgeGraph> {
  return request(`/memories/graph?userId=${encodeURIComponent(userId)}`);
}

export function generatePlans(
  userId: string = USER_ID,
): Promise<{ plans: OutreachPlan[]; trace: TraceStep[] }> {
  return request(`/plans/generate`, {
    method: "POST",
    body: JSON.stringify({ userId }),
  });
}

export interface TriggerCallResult {
  status: "initiated" | "skipped" | "failed" | "completed";
  safetyReport?: {
    status: "pending" | "approved" | "blocked";
    checks: { name: string; passed: boolean; detail?: string }[];
  };
  call: CallRecord;
}

export function triggerCall(
  planId: string,
  phoneNumber?: string,
): Promise<TriggerCallResult> {
  return request(`/calls/trigger`, {
    method: "POST",
    body: JSON.stringify({ planId, phoneNumber }),
  });
}

export function ingestText(
  text: string,
  sourceType: SourceType = "chat",
  userId: string = USER_ID,
): Promise<Memory[]> {
  return request(`/memories/ingest`, {
    method: "POST",
    body: JSON.stringify({ userId, text, sourceType }),
  });
}

export async function uploadAudio(
  file: File,
  userId: string = USER_ID,
): Promise<{ transcript: string; memories: Memory[] }> {
  const formData = new FormData();
  formData.append("userId", userId);
  formData.append("audio", file);

  const res = await fetch(`${API_BASE}/memories/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    throw new Error(`POST /memories/upload failed: ${res.status}`);
  }
  return res.json();
}

export function approveMemory(
  id: string,
  approvedForUse: boolean,
): Promise<Memory> {
  return request(`/memories/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ approvedForUse }),
  });
}

/**
 * POST-based SSE is consumed with fetch() rather than EventSource — copied
 * from agent-service/README.md "Frontend streaming", adapted to API_BASE.
 */
export async function streamPost(
  path: string,
  body: unknown,
  onEvent: (event: string, data: unknown) => void,
): Promise<void> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!response.ok || !response.body) throw new Error("Stream failed");

  const reader = response.body
    .pipeThrough(new TextDecoderStream())
    .getReader();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += value;
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const event = frame.match(/^event: (.+)$/m)?.[1];
      const data = frame.match(/^data: (.+)$/m)?.[1];
      if (event && data) onEvent(event, JSON.parse(data));
    }
  }
}
