import { getDb } from "../index.js";
import { UserProfileSchema, type UserProfile } from "../../schemas.js";

export function upsertUser(profile: UserProfile): UserProfile {
  const parsed = UserProfileSchema.parse(profile);
  getDb()
    .prepare(
      `INSERT INTO users (id, data) VALUES (?, ?)
       ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
    )
    .run(parsed.id, JSON.stringify(parsed));
  return parsed;
}

export function getUser(id: string): UserProfile | null {
  const row = getDb().prepare(`SELECT data FROM users WHERE id = ?`).get(id) as
    | { data: string }
    | undefined;
  return row ? UserProfileSchema.parse(JSON.parse(row.data)) : null;
}
