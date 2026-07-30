import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { logger } from "../lib/logger.js";

const log = logger.child({ module: "db" });

const moduleDir = dirname(fileURLToPath(import.meta.url));

function resolveDbPath(): string {
  const configured = process.env.DATABASE_PATH ?? "./data/app.db";
  return resolve(process.cwd(), configured);
}

let db: Database.Database | null = null;

/**
 * Opens (once) and returns the shared SQLite handle, creating the parent
 * directory and running migrations on first use. Synchronous by design —
 * better-sqlite3 is blocking, which keeps repository code simple.
 */
export function getDb(): Database.Database {
  if (db) return db;

  const dbPath = resolveDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  const schema = readFileSync(resolve(moduleDir, "schema.sql"), "utf8");
  db.exec(schema);

  log.info({ dbPath }, "SQLite ready");
  return db;
}
