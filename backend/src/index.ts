import dotenv from "dotenv";
dotenv.config();

import { Server, defineRoom } from "colyseus";
import { GameRoom } from "./rooms/GameRoom";

const PORT = Number(process.env.PORT) || 3000;

// ─── Colyseus game server ─────────────────────────────────
const gameServer = new Server({
  // Configure Express middleware via the express callback
  express: (app) => {
    // Health check endpoint
    app.get("/health", (_req, res) => {
      res.json({
        name: "Chaos Arena",
        status: "running",
        version: "1.0.0",
      });
    });
  },
});

// Register game rooms
gameServer.define("arena_room", GameRoom);

// ─── Start listening ──────────────────────────────────────
gameServer.listen(PORT).then(() => {
  console.log(`\n🎮 ═══════════════════════════════════════════`);
  console.log(`   CHAOS ARENA — Backend Server`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`   WebSocket ready on ws://localhost:${PORT}`);
  console.log(`   Room type: arena_room`);
  console.log(`🎮 ═══════════════════════════════════════════\n`);
});
