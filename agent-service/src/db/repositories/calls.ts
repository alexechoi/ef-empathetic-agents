import { randomUUID } from "node:crypto";
import { getDb } from "../index.js";
import { CallRecordSchema, type CallRecord } from "../../schemas.js";

function rowToCall(row: { data: string }): CallRecord {
  return CallRecordSchema.parse(JSON.parse(row.data));
}

export function insertCall(call: CallRecord): CallRecord {
  const parsed = CallRecordSchema.parse(call);
  getDb()
    .prepare(
      `INSERT INTO calls (id, user_id, plan_id, data, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(
      parsed.id,
      parsed.userId,
      parsed.planId,
      JSON.stringify(parsed),
      parsed.createdAt,
    );
  return parsed;
}

export function updateCall(
  id: string,
  patch: Partial<CallRecord>,
): CallRecord | null {
  const existing = getCall(id);
  if (!existing) return null;
  const updated = CallRecordSchema.parse({ ...existing, ...patch, id });
  getDb()
    .prepare(`UPDATE calls SET data = ? WHERE id = ?`)
    .run(JSON.stringify(updated), id);
  return updated;
}

export function getCall(id: string): CallRecord | null {
  const row = getDb().prepare(`SELECT data FROM calls WHERE id = ?`).get(id) as
    | { data: string }
    | undefined;
  return row ? rowToCall(row) : null;
}

export function getCallByConversationId(
  conversationId: string,
): CallRecord | null {
  const rows = getDb()
    .prepare(`SELECT data FROM calls ORDER BY created_at DESC`)
    .all() as { data: string }[];
  return (
    rows.map(rowToCall).find((c) => c.conversationId === conversationId) ?? null
  );
}

export function listCalls(userId: string): CallRecord[] {
  const rows = getDb()
    .prepare(`SELECT data FROM calls WHERE user_id = ? ORDER BY created_at DESC`)
    .all(userId) as { data: string }[];
  return rows.map(rowToCall);
}

// --- Contact history (drives the max-frequency guardrail) -----------------

export function recordContact(
  userId: string,
  planId: string,
  channel: string,
  contactedAt = new Date().toISOString(),
): void {
  getDb()
    .prepare(
      `INSERT INTO contact_history (id, user_id, plan_id, channel, contacted_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(randomUUID(), userId, planId, channel, contactedAt);
}

export function countContactsSince(userId: string, sinceIso: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS n FROM contact_history
       WHERE user_id = ? AND contacted_at >= ?`,
    )
    .get(userId, sinceIso) as { n: number };
  return row.n;
}
