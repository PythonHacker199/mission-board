const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

/**
 * Opens (or creates) the SQLite database and makes sure the tables exist.
 * Pass ':memory:' for a throwaway database (used by the tests).
 */
function createDb(file = process.env.DB_FILE || path.join(__dirname, '..', 'data', 'missions.db')) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL'); // faster, safer concurrent reads
  db.pragma('foreign_keys = ON');  // SQLite ignores FOREIGN KEY rules unless this is on

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      name          TEXT    NOT NULL,
      email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT    NOT NULL,
      created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS missions (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title       TEXT    NOT NULL,
      description TEXT    NOT NULL DEFAULT '',
      priority    TEXT    NOT NULL DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High')),
      status      TEXT    NOT NULL DEFAULT 'To Do'  CHECK (status IN ('To Do', 'In Progress', 'Done')),
      created_at  TEXT    NOT NULL DEFAULT (datetime('now')),
      updated_at  TEXT    NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_missions_user ON missions(user_id);
  `);

  return db;
}

module.exports = { createDb };
