import express from "express";
import { createServer } from "http";
import dotenv from "dotenv";
dotenv.config();

import { Server } from "colyseus";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./games/grass-collect/rooms/GameRoom";
import { initRedis } from "./db/redis";
import { initSQLite } from "./db/sqlite";
import { getRecentMatches, getLeaderboard, getPlayerStats } from "./db/matchHistory";

import cors from "cors";

const PORT = Number(process.env.PORT) || 3000;

const app = express();
app.use(cors());
app.use(express.json());

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

// Leaderboard endpoint
app.get("/api/leaderboard", async (_req, res) => {
  try {
    const leaderboard = await getLeaderboard(10);
    res.json({ leaderboard });
  } catch {
    res.status(500).json({ error: "Failed to fetch leaderboard" });
  }
});

// Player stats endpoint
app.get("/api/player/:id", async (req, res) => {
  try {
    const stats = await getPlayerStats(req.params.id);
    if (stats) {
      res.json({ stats });
    } else {
      res.status(404).json({ error: "Player not found" });
    }
  } catch {
    res.status(500).json({ error: "Failed to fetch player stats" });
  }
});

const server = createServer(app);

// ─── Colyseus game server ─────────────────────────────────
const gameServer = new Server({
  transport: new WebSocketTransport({
    server
  })
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
