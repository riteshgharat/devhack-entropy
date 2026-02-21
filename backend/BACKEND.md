# CHAOS ARENA – Backend Architecture (Scalable Multi-Game System)

## 1️⃣ System Philosophy

This backend is designed to:

✔ Support multiple real-time games  
✔ Be horizontally scalable  
✔ Maintain authoritative state  
✔ Enable live leaderboard  
✔ Allow optional AI workers later  
✔ Remain hackathon-buildable in simplified mode  

For hackathon:
→ Single node deployment  
→ Redis + PostgreSQL optional (can mock)  
→ AI Worker disabled  

Architecture remains production-ready.

---

# 2️⃣ High-Level System Overview

Client (React + TypeScript + KAPLAY)
        ↓
Edge CDN (Static Hosting)
        ↓
WebSocket Gateway (Sticky Sessions)
        ↓
Colyseus Game Cluster
        ↓
Redis (Presence + PubSub + Leaderboard)
        ↓
PostgreSQL (Persistent Data)
        ↓
AI Worker Layer (Optional - Future)

---

# 3️⃣ Tech Stack

## Core Runtime
- Node.js (LTS)
- TypeScript

## Multiplayer Engine
- Colyseus

## API Service
- Express or Fastify

## Realtime Infrastructure
- Redis
  - Presence
  - Pub/Sub
  - Sorted Sets (Leaderboard)

## Database
- PostgreSQL
  - User Profiles
  - Match History
  - Tournament Data

## Optional AI Layer (Future)
- BullMQ (Redis-backed queue)
- AI Provider:
  - Groq (Low latency)
  - Gemini
  - OpenRouter

Framework Suggestion for AI Later:
- Lightweight custom wrapper + Zod validation
Avoid heavy agent frameworks initially.

---

# 4️⃣ Project Structure

chaos-platform/

├── api/
│   ├── auth/
│   ├── users/
│   └── leaderboard/
│
├── game-server/
│   ├── games/
│   │     ├── arena/
│   │     ├── runner/
│   │     └── tiles/
│   ├── rooms/
│   ├── matchmaking/
│   ├── leaderboard/
│   └── core/
│
├── worker/   (AI Layer – future)
│
└── docker-compose.yml

---

# 5️⃣ Core Backend Services

## A️⃣ API Service (HTTP Only)

Responsibilities:

- User authentication (JWT)
- Profile management
- Match history retrieval
- Leaderboard REST access
- Tournament endpoints

This service does NOT handle real-time gameplay.

---

## B️⃣ Real-Time Game Cluster (Colyseus)

Each game is modular.

Example:

gameServer.define("arena_room", ArenaRoom);
gameServer.define("runner_room", RunnerRoom);
gameServer.define("tiles_room", TilesRoom);

Each Room:

- Has its own State Schema
- Own Physics Logic
- Own Scoring Logic
- Own Win Condition

Server authoritative simulation.

---

# 6️⃣ Game Room Lifecycle

1️⃣ Player selects game  
2️⃣ Matchmaking checks Redis for open room  
3️⃣ Player joins or new room created  
4️⃣ Room starts simulation loop  
5️⃣ Players send input only  
6️⃣ Server validates and updates state  
7️⃣ State patches broadcast to clients  
8️⃣ Match ends  
9️⃣ Score stored in Redis + PostgreSQL  

---

# 7️⃣ Real-Time Sync Architecture

## Transport
- WebSocket (Primary)
- WebRTC (Optional, future)

## Tick Strategy

Simulation: 60 FPS  
Network Sync: 20–30 FPS  

Colyseus sends:
✔ State patches (diff only)
❌ Never full state every frame

---

# 8️⃣ Matchmaking Architecture

Flow:

Player selects game  
↓  
Redis checks:
- Open room exists?
- Room full?
↓  
Join or create room  
↓  
Room registered in Redis  

Redis Used For:

- Room discovery
- Player count tracking
- Active matches
- Cross-node communication

---

# 9️⃣ Leaderboard System

Using Redis Sorted Sets.

Example:

ZADD leaderboard_arena 150 user123
ZADD leaderboard_arena 200 user456

Fetch Top 10:

ZREVRANGE leaderboard_arena 0 9 WITHSCORES

Flow:

Score updated inside Room  
↓  
Redis sorted set updated  
↓  
Publish leaderboard update  
↓  
Clients auto-refresh ranking  

Channel:
leaderboard_updates_arena

---

# 🔟 Session Management

Authentication:

- JWT issued via API service
- Token attached when joining room
- Verified before join

Session store in Redis:

SET session:userId sessionId

If new login:
→ invalidate old session

Prevents:
- Multi-tab abuse
- Ghost players
- Duplicate sessions

---

# 1️⃣1️⃣ Horizontal Scaling

Production Mode:

Game Node 1
Game Node 2
Game Node 3

All connected to:

- Same Redis Cluster
- Same PostgreSQL

Load Balancer:

- Nginx or Traefik
- Sticky WebSocket sessions

Ensures player remains on same node.

---

# 1️⃣2️⃣ Smooth Gameplay Design

✔ Server authoritative physics  
✔ Client-side prediction  
✔ Interpolation for other players  
✔ Reconciliation on mismatch  

Server:

this.setSimulationInterval(() => {
   this.updatePhysics();
}, 1000 / 60);

---

# 1️⃣3️⃣ AI Worker Layer (Deferred)

Future architecture:

Game Server
   ↓
BullMQ Queue
   ↓
AI Worker
   ↓
LLM Provider
   ↓
Validated Action
   ↓
Back to Game Room

For now:
This layer remains disabled.
Room logic uses deterministic rule engine.

---

# 1️⃣4️⃣ Hackathon Mode Deployment

Simplified:

✔ Single Colyseus instance  
✔ Single Redis instance  
✔ PostgreSQL optional (can mock)  
✔ No horizontal scaling  
✔ AI disabled  

Deployment Options:

- Render
- Railway
- Fly.io

WebSocket must be supported.

---

# 1️⃣5️⃣ Clean Production Diagram

CDN
  ↓
Nginx (Sticky WS)
  ↓
Colyseus Cluster
  ↓
Redis
  ↓
PostgreSQL

Optional:
  ↓
AI Worker Pool

---

# 1️⃣6️⃣ Backend Guarantees

✔ Multi-game support  
✔ Real-time multiplayer  
✔ Live leaderboard  
✔ Scalable cluster-ready  
✔ Clean session control  
✔ Efficient state patching  
✔ AI-ready architecture  

---

# 1️⃣7️⃣ Build Priority (Hackathon)

Must Build:

- Arena Room
- Matchmaking (basic)
- Score system
- Redis leaderboard
- JWT validation
- Authoritative sync

Build Later:

- Horizontal scaling
- AI worker
- Tournament system
- Advanced analytics

---

# Final Philosophy

The backend should feel invisible.

Real-time sync must be smooth.
Leaderboard must feel live.
Architecture must feel scalable.
AI can be plugged in later without refactor.

Design for scale.
Deploy for demo.