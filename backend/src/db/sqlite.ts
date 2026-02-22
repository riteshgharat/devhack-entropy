import Database from "better-sqlite3";
import path from "path";

let db: Database.Database | null = null;
let isConnected = false;

const DB_PATH =
  process.env.SQLITE_PATH ||
  path.join(process.cwd(), "./src/db/data/chaos_arena.db");

/**
 * Initialize SQLite database.
 * Creates the file and schema if they don't exist.
 * Synchronous — better-sqlite3 is entirely sync.
 */
export function initSQLite(): Database.Database | null {
  try {
    db = new Database(DB_PATH);

    // WAL mode — better concurrent read performance
    db.pragma("journal_mode = WAL");

    // Create match_history table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS match_history (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id       TEXT    NOT NULL,
        winner_id     TEXT,
        winner_name   TEXT,
        player_count  INTEGER NOT NULL,
        match_duration REAL   NOT NULL,
        is_draw       INTEGER DEFAULT 0,
        created_at    TEXT    DEFAULT (datetime('now'))
      );
    `);

    // Create players table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS players (
        id            TEXT PRIMARY KEY,
        display_name  TEXT NOT NULL,
        matches       INTEGER DEFAULT 0,
        wins          INTEGER DEFAULT 0,
        score         INTEGER DEFAULT 0,
        created_at    TEXT DEFAULT (datetime('now'))
      );
    `);

    isConnected = true;
    console.log(`🗃️  SQLite connected — ${DB_PATH}`);
    console.log("🗃️  match_history table ready");
    return db;
  } catch (err: any) {
    console.warn(
      `⚠️  SQLite unavailable: ${err.message}. Running without SQLite.`,
    );
    db = null;
    isConnected = false;
    return null;
  }
}

export function getDB(): Database.Database | null {
  return isConnected ? db : null;
}

export function isSQLiteAvailable(): boolean {
  return isConnected && db !== null;
}
