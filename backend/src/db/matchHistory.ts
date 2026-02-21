import { getRedis, isRedisAvailable } from "./redis";
import { getDB, isSQLiteAvailable } from "./sqlite";

export interface MatchResult {
  roomId: string;
  winnerId: string;
  winnerName: string;
  playerCount: number;
  matchDuration: number;
  isDraw: boolean;
}

/**
 * Save match result to Redis (fast cache) and SQLite (persistent).
 * Both are optional — if either is unavailable, we skip gracefully.
 */
export async function saveMatchResult(result: MatchResult): Promise<void> {
  const json = JSON.stringify(result);

  // ── Redis: push to recent matches list ──
  if (isRedisAvailable()) {
    try {
      const redis = getRedis()!;
      await redis.lpush("chaos:match_history", json);
      await redis.ltrim("chaos:match_history", 0, 99); // keep last 100
      console.log("📝 Match result saved to Redis");
    } catch (err: any) {
      console.warn(`⚠️  Redis save failed: ${err.message}`);
    }
  }

  // ── SQLite: insert into match_history ──
  if (isSQLiteAvailable()) {
    try {
      const db = getDB()!;
      const stmt = db.prepare(
        `INSERT INTO match_history (room_id, winner_id, winner_name, player_count, match_duration, is_draw)
         VALUES (?, ?, ?, ?, ?, ?)`
      );
      stmt.run(
        result.roomId,
        result.winnerId,
        result.winnerName,
        result.playerCount,
        result.matchDuration,
        result.isDraw ? 1 : 0
      );
      console.log("📝 Match result saved to SQLite");
    } catch (err: any) {
      console.warn(`⚠️  SQLite save failed: ${err.message}`);
    }
  }
}

/**
 * Get recent match results. Tries Redis first, falls back to SQLite.
 */
export async function getRecentMatches(limit: number = 10): Promise<MatchResult[]> {
  // Try Redis first (faster)
  if (isRedisAvailable()) {
    try {
      const redis = getRedis()!;
      const results = await redis.lrange("chaos:match_history", 0, limit - 1);
      return results.map((r) => JSON.parse(r) as MatchResult);
    } catch (err: any) {
      console.warn(`⚠️  Redis read failed: ${err.message}`);
    }
  }

  // Fallback to SQLite
  if (isSQLiteAvailable()) {
    try {
      const db = getDB()!;
      const rows = db.prepare(
        `SELECT room_id, winner_id, winner_name, player_count, match_duration, is_draw
         FROM match_history ORDER BY created_at DESC LIMIT ?`
      ).all(limit) as any[];
      return rows.map((row) => ({
        roomId: row.room_id,
        winnerId: row.winner_id,
        winnerName: row.winner_name,
        playerCount: row.player_count,
        matchDuration: row.match_duration,
        isDraw: Boolean(row.is_draw),
      }));
    } catch (err: any) {
      console.warn(`⚠️  SQLite read failed: ${err.message}`);
    }
  }

  return []; // No DB available
}
