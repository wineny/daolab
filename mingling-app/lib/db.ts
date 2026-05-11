import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

declare global {
  // eslint-disable-next-line no-var
  var __minglingDb: Database.Database | undefined;
}

function open(): Database.Database {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  const dbPath = path.join(dataDir, "mingling.db");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(`
    CREATE TABLE IF NOT EXISTS participants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL DEFAULT 'default',
      name TEXT NOT NULL,
      original_team INTEGER NOT NULL CHECK (original_team BETWEEN 1 AND 6),
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS participants_session_name
      ON participants(session_id, name);
    CREATE INDEX IF NOT EXISTS participants_session
      ON participants(session_id);
  `);
  return db;
}

export function getDb(): Database.Database {
  if (!global.__minglingDb) {
    global.__minglingDb = open();
  }
  return global.__minglingDb;
}

export type ParticipantRow = {
  id: number;
  session_id: string;
  name: string;
  original_team: number;
  created_at: string;
  updated_at: string;
};
