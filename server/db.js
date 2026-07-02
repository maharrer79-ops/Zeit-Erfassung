import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DB_PATH || join(__dirname, '..', 'data.sqlite');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS projects (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id    INTEGER NOT NULL,
    name       TEXT    NOT NULL,
    color      TEXT    NOT NULL DEFAULT '#4f46e5',
    created_at TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL,
    project_id  INTEGER,
    description TEXT    NOT NULL DEFAULT '',
    kind_code   TEXT    NOT NULL DEFAULT '0010',
    kind_label  TEXT    NOT NULL DEFAULT 'Kommen/Gehen',
    start_ts    TEXT    NOT NULL,
    end_ts      TEXT,
    created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id)    REFERENCES users(id)    ON DELETE CASCADE,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
  );

  CREATE INDEX IF NOT EXISTS idx_entries_user  ON entries(user_id);
  CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
`);

// Migration: Buchungsart-Spalten fuer bereits bestehende Datenbanken ergaenzen
const entryCols = db.prepare('PRAGMA table_info(entries)').all().map((c) => c.name);
if (!entryCols.includes('kind_code')) {
  db.exec("ALTER TABLE entries ADD COLUMN kind_code TEXT NOT NULL DEFAULT '0010'");
}
if (!entryCols.includes('kind_label')) {
  db.exec("ALTER TABLE entries ADD COLUMN kind_label TEXT NOT NULL DEFAULT 'Kommen/Gehen'");
}

export default db;
