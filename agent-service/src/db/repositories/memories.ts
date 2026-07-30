import { getDb } from "../index.js";
import { MemorySchema, type Memory } from "../../schemas.js";

function rowToMemory(row: { data: string }): Memory {
  return MemorySchema.parse(JSON.parse(row.data));
}

export function insertMemories(memories: Memory[]): Memory[] {
  const db = getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO memories (id, user_id, data, created_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
  );
  const insertAll = db.transaction((items: Memory[]) => {
    for (const memory of items) {
      const parsed = MemorySchema.parse(memory);
      stmt.run(parsed.id, parsed.userId, JSON.stringify(parsed), now);
    }
  });
  insertAll(memories);
  return memories.map((m) => MemorySchema.parse(m));
}

export function listMemories(userId: string): Memory[] {
  const rows = getDb()
    .prepare(
      `SELECT data FROM memories WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(userId) as { data: string }[];
  return rows.map(rowToMemory);
}

export function getMemory(id: string): Memory | null {
  const row = getDb()
    .prepare(`SELECT data FROM memories WHERE id = ?`)
    .get(id) as { data: string } | undefined;
  return row ? rowToMemory(row) : null;
}

export function getMemoriesByIds(ids: string[]): Memory[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => "?").join(", ");
  const rows = getDb()
    .prepare(`SELECT data FROM memories WHERE id IN (${placeholders})`)
    .all(...ids) as { data: string }[];
  return rows.map(rowToMemory);
}

export function setMemoryApproval(
  id: string,
  approvedForUse: boolean,
): Memory | null {
  const existing = getMemory(id);
  if (!existing) return null;
  const updated: Memory = { ...existing, approvedForUse };
  getDb()
    .prepare(`UPDATE memories SET data = ? WHERE id = ?`)
    .run(JSON.stringify(updated), id);
  return updated;
}
