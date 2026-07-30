import { getDb } from "../index.js";
import { CalendarEventSchema, type CalendarEvent } from "../../schemas.js";

function rowToEvent(row: { data: string }): CalendarEvent {
  return CalendarEventSchema.parse(JSON.parse(row.data));
}

export function upsertEvents(events: CalendarEvent[]): CalendarEvent[] {
  const db = getDb();
  const stmt = db.prepare(
    `INSERT INTO calendar_events (id, user_id, data) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET data = excluded.data`,
  );
  const upsertAll = db.transaction((items: CalendarEvent[]) => {
    for (const event of items) {
      const parsed = CalendarEventSchema.parse(event);
      stmt.run(parsed.id, parsed.userId, JSON.stringify(parsed));
    }
  });
  upsertAll(events);
  return events.map((e) => CalendarEventSchema.parse(e));
}

export function listEvents(userId: string): CalendarEvent[] {
  const rows = getDb()
    .prepare(`SELECT data FROM calendar_events WHERE user_id = ?`)
    .all(userId) as { data: string }[];
  return rows
    .map(rowToEvent)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

export function getEvent(id: string): CalendarEvent | null {
  const row = getDb()
    .prepare(`SELECT data FROM calendar_events WHERE id = ?`)
    .get(id) as { data: string } | undefined;
  return row ? rowToEvent(row) : null;
}
