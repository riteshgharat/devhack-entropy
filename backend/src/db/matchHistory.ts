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

export interface PlayerStat {
  id: string;
  displayName: string;
  matches: number;
  wins: number;
  score: number;
}

export async function savePlayerStats(
  players: {
    id: string;
    displayName: string;
    isWinner: boolean;
    score: number;
  }[],
): Promise<void> {
  if (isSQLiteAvailable()) {
    try {
      const db = getDB()!;
      const stmt = db.prepare(`
        INSERT INTO players (id, display_name, matches, wins, score)
        VALUES (?, ?, 1, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          display_name = excluded.display_name,
          matches = matches + 1,
          wins = wins + excluded.wins,
          score = score + excluded.score
      `);

      const transaction = db.transaction((playersList) => {
        for (const p of playersList) {
          stmt.run(p.id, p.displayName, p.isWinner ? 1 : 0, p.score);
        }
      });

      transaction(players);
      console.log("📝 Player stats saved to SQLite");
    } catch (err: any) {
      console.warn(`⚠️  SQLite player stats save failed: ${err.message}`);
    }
  }
}

export async function updatePlayerName(
  playerId: string,
  displayName: string,
): Promise<void> {
  if (isSQLiteAvailable()) {
    try {
      const db = getDB()!;
      db.prepare(
        `
        INSERT INTO players (id, display_name, matches, wins, score)
        VALUES (?, ?, 0, 0, 0)
        ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name
      `,
      ).run(playerId, displayName);
      console.log(`📝 Player name updated in SQLite: ${displayName}`);
    } catch (err: any) {
      console.warn(`⚠️  SQLite player name update failed: ${err.message}`);
    }
  }
}

export async function getLeaderboard(
  limit: number = 10,
): Promise<PlayerStat[]> {
  if (isSQLiteAvailable()) {
    try {
      const db = getDB()!;
      const rows = db
        .prepare(
          `SELECT id, display_name, matches, wins, score
         FROM players ORDER BY wins DESC, score DESC LIMIT ?`,
        )
        .all(limit) as any[];
      return rows.map((row) => ({
        id: row.id,
        displayName: row.display_name,
        matches: row.matches,
        wins: row.wins,
        score: row.score,
      }));
    } catch (err: any) {
      console.warn(`⚠️  SQLite leaderboard read failed: ${err.message}`);
    }
  }
  return [];
}

export async function getPlayerStats(
  playerId: string,
): Promise<(PlayerStat & { rank: number }) | null> {
  if (isSQLiteAvailable()) {
    try {
      const db = getDB()!;
      const row = db
        .prepare(
          `SELECT id, display_name, matches, wins, score
         FROM players WHERE id = ?`,
        )
        .get(playerId) as any;
      if (row) {
        const rankRow = db
          .prepare(
            `SELECT COUNT(*) as rank FROM players WHERE wins > ? OR (wins = ? AND score > ?)`,
          )
          .get(row.wins, row.wins, row.score) as any;
        return {
          id: row.id,
          displayName: row.display_name,
          matches: row.matches,
          wins: row.wins,
          score: row.score,
          rank: rankRow.rank + 1,
        };
      }
    } catch (err: any) {
      console.warn(`⚠️  SQLite player stats read failed: ${err.message}`);
    }
  }
  return null;
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
         VALUES (?, ?, ?, ?, ?, ?)`,
      );
      stmt.run(
        result.roomId,
        result.winnerId,
        result.winnerName,
        result.playerCount,
        result.matchDuration,
        result.isDraw ? 1 : 0,
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
export async function getRecentMatches(
  limit: number = 10,
): Promise<MatchResult[]> {
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
      const rows = db
        .prepare(
          `SELECT room_id, winner_id, winner_name, player_count, match_duration, is_draw
         FROM match_history ORDER BY created_at DESC LIMIT ?`,
        )
        .all(limit) as any[];
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
