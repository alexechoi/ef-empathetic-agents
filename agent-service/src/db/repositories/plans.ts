import { getDb } from "../index.js";
import { OutreachPlanSchema, type OutreachPlan } from "../../schemas.js";

function rowToPlan(row: { data: string }): OutreachPlan {
  return OutreachPlanSchema.parse(JSON.parse(row.data));
}

export function insertPlans(plans: OutreachPlan[]): OutreachPlan[] {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO outreach_plans (id, user_id, event_id, data, created_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
  );
  const insertAll = db.transaction((items: OutreachPlan[]) => {
    for (const plan of items) {
      const parsed = OutreachPlanSchema.parse(plan);
      stmt.run(
        parsed.id,
        parsed.userId,
        parsed.eventId,
        JSON.stringify(parsed),
        parsed.createdAt,
      );
    }
  });
  insertAll(plans);
  return plans.map((p) => OutreachPlanSchema.parse(p));
}

export function deletePlansForUser(userId: string): void {
  getDb().prepare(`DELETE FROM outreach_plans WHERE user_id = ?`).run(userId);
}

export function listPlans(userId: string): OutreachPlan[] {
  const rows = getDb()
    .prepare(
      `SELECT data FROM outreach_plans WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(userId) as { data: string }[];
  return rows.map(rowToPlan);
}

export function getPlan(id: string): OutreachPlan | null {
  const row = getDb()
    .prepare(`SELECT data FROM outreach_plans WHERE id = ?`)
    .get(id) as { data: string } | undefined;
  return row ? rowToPlan(row) : null;
}
