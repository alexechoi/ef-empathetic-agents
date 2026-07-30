-- Full domain persisted as JSON documents validated by Zod on read/write.
-- Keeping payloads in a `data` column keeps schemas.ts the single source of truth
-- while still giving us indexed lookups by id / user_id.

CREATE TABLE IF NOT EXISTS users (
  id   TEXT PRIMARY KEY,
  data TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_user ON memories (user_id);

CREATE TABLE IF NOT EXISTS calendar_events (
  id      TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  data    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_user ON calendar_events (user_id);

CREATE TABLE IF NOT EXISTS outreach_plans (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  event_id   TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_plans_user ON outreach_plans (user_id);

CREATE TABLE IF NOT EXISTS calls (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL,
  plan_id    TEXT NOT NULL,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_calls_user ON calls (user_id);

CREATE TABLE IF NOT EXISTS contact_history (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL,
  plan_id      TEXT,
  channel      TEXT,
  contacted_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_contact_user ON contact_history (user_id);
