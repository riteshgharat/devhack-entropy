import dotenv from "dotenv";
dotenv.config();

import { Server } from "colyseus";
import { GameRoom } from "./rooms/GameRoom";
import { initRedis } from "./db/redis";
import { initSQLite } from "./db/sqlite";
import { getRecentMatches } from "./db/matchHistory";

const PORT = Number(process.env.PORT) || 3000;

// ─── Colyseus game server ─────────────────────────────────
const gameServer = new Server({
  express: (app) => {
    // Health check
    app.get("/health", (_req, res) => {
      res.json({
        name: "Chaos Arena",
        status: "running",
        version: "1.0.0",
      });
    });

    // Recent matches endpoint
    app.get("/api/matches", async (_req, res) => {
      try {
        const matches = await getRecentMatches(10);
        res.json({ matches });
      } catch {
        res.status(500).json({ error: "Failed to fetch matches" });
      }
    });
  },
});

// Register game rooms
gameServer.define("arena_room", GameRoom);

// ─── Initialize databases (optional, graceful fallback) ───
initRedis();
initSQLite();

// ─── Start listening ──────────────────────────────────────
gameServer.listen(PORT).then(() => {
  console.log(`\n🎮 ═══════════════════════════════════════════`);
  console.log(`   CHAOS ARENA — Backend Server`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   WebSocket ready on ws://localhost:${PORT}`);
  console.log(`   Room type: arena_room`);
  console.log(`   GET /health — server status`);
  console.log(`   GET /api/matches — recent match history`);
  console.log(`🎮 ═══════════════════════════════════════════\n`);
});
