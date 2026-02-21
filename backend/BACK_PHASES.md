# Chaos Arena â€“ Backend Execution Phases

This document outlines the structured backend implementation plan for Chaos Arena, integrating the core product requirements (PRD) and the scalable architecture (BACKEND.md).

**Tech Stack:**
- Node.js & TypeScript
- Colyseus (Multiplayer Framework)
- WebSockets
- Redis (Presence, Pub/Sub, Leaderboard, Queue)
- PostgreSQL (Persistent Data: Profiles, Match History)
- AI Provider (Groq / Gemini / OpenRouter) via BullMQ Worker

---

# PHASE 1: Server Setup & Core Multiplayer Foundation

## Objective
Set up a working authoritative multiplayer server using Colyseus with real-time WebSocket communication, basic game state synchronization, and the scalable project structure.

---

## 1.1 Environment & Structure Setup

### Project Structure
Set up the monorepo-style backend structure:
- `api/` (Express/Fastify for REST endpoints)
- `game-server/` (Colyseus rooms and core logic)
- `worker/` (Optional AI Layer via BullMQ)

### Install Required Packages

Core Dependencies:
- `colyseus`, `@colyseus/ws-transport`
- `express`
- `ws` (WebSocket support)
- `typescript`, `ts-node-dev`
- `cors`, `dotenv`

Initialize project:
- `npm init`
- Setup TypeScript config (`tsconfig.json`)
- Create `src/` directory matching the structure above.

---

## 1.2 Colyseus Server Initialization

Steps:
1. Create Colyseus server instance.
2. Attach Express app (for API routes like `/health`).
3. Define `GameRoom` class.
4. Define `GameState` schema.
5. Register room type (`arena_room`).
6. Start HTTP + WebSocket server.

Deliverable:
Server running with WebSocket support and basic API endpoints.

---

## 1.3 Basic Room Flow

Room Responsibilities:
- Handle player join/leave
- Store player state
- Broadcast state updates
- Manage max player limit (2â€“8)

GameState should include:
- `players` (Map of PlayerState)
- `isAlive` (boolean)
- `position` (x, y)
- `isJumping` / `isDodging` (boolean - from PRD mechanics)
- `survivalTime` (number)
- `emojiActivity` (number - for AI reactions)
- `matchStarted` (boolean)

Deliverable:
Two browser tabs can join the same room and see synchronized movement.

---

## 1.4 Basic Game Loop

Implement server-side tick loop (60 FPS or simplified interval).

Each tick:
- Process player inputs (movement, jump/dodge)
- Update positions
- Validate boundaries
- Detect elimination (fall or collision)
- Update survival timers
- Broadcast updated state

Deliverable:
Authoritative server-controlled movement with basic physics.

---

# PHASE 2: Game Engine Logic & Database Integration

## Objective
Implement full survival logic, arena mutations, and persistent storage using Redis and PostgreSQL.

---

## 2.1 Game Engine Logic

Add structured game state processing:

### Leader & Weakest Detection
- **Leader:** Player with highest `survivalTime`.
- **Weakest:** Lowest `survivalTime` among alive players.

### Elimination Logic
- Player falls below boundary.
- Player collides with hazard.
- Mark `isAlive = false`.
- Reduce `aliveCount`.

### Match End Condition
If `aliveCount == 1`:
- Announce winner.
- Trigger match end event.
- Reset room after delay.

Deliverable:
Complete survival loop with winner detection.

---

## 2.2 Arena Mutation Engine

Create predefined action modules (Hybrid Model):
- `spawn_falling_block()`
- `shrink_boundary()`
- `rotate_obstacle()`
- `speed_modifier()`
- `target_player_trap()`

These should mutate `GameState` safely. AI will only trigger these modules.

Deliverable:
Backend can trigger arena transformations via simple function calls.

---

## 2.3 Database Integration (Redis + PostgreSQL)

For hackathon: Database is optional but recommended for completeness.

### Redis (Fast Data)
- Presence & Pub/Sub
- Live Leaderboard (Sorted Sets)
- Match history buffer (pushed to Postgres later)

### PostgreSQL (Persistent Data)
- User Profiles
- Match History & Results
- Tournament Data

Install:
- `pg` (Postgres)
- `redis`

Deliverable:
Match results persist, and live leaderboards function via Redis.

---

# PHASE 3: Agentic AI Integration

## Objective
Integrate a sadistic, funny, chaotic meme-driven AI Game Master without blocking the main game loop.

---

## 3.1 AI Provider & Worker Setup

Choose one:
- Groq (recommended for low latency)
- Gemini
- OpenRouter

Architecture:
- Use **BullMQ** (Redis-backed queue) to offload AI processing to the `worker/` layer.
- Install `axios` or native `fetch`.
- Use `zod` for JSON validation.

---

## 3.2 AI Orchestrator Service

Create separate module: `aiService.ts` (runs in worker)

Responsibilities:
1. Accept simplified GameState snapshot:
   ```json
   {
     "alivePlayers": 4,
     "leader": "Player1",
     "weakest": "Player3",
     "emojiIntensity": "High",
     "timeLeft": 60
   }
   ```
2. Send structured prompt to LLM (instructing it to be sadistic, funny, and target the leader/weakest).
3. Receive JSON response:
   ```json
   {
     "action": "target_player_trap",
     "targetPlayer": "Player1",
     "intensity": "high",
     "commentary": "Looks like Player1 is getting too comfortable! Have a trap! í¸ˆ"
   }
   ```
4. Validate with Zod schema.
5. Return safe response to the GameRoom.

---

## 3.3 AI Loop Integration

Inside Room:
Set interval (every 10â€“15 seconds):
1. Snapshot state.
2. Dispatch job to BullMQ (or call `aiService` asynchronously).
3. Await response.
4. Apply arena mutation.
5. Broadcast commentary to clients.

Important: AI calls must not block the tick loop.

---

## 3.4 Fail-Safe Logic

If Timeout, API error, or Invalid JSON:
- Fallback: Trigger random predefined event.
- Use default chaotic commentary.
- Never freeze the match.

Deliverable:
AI actively influences gameplay and provides meme-driven commentary in a controlled way.

---

# PHASE 4: Polish & Deployment Flow

## Objective
Deploy stable backend with WebSocket support for live hackathon demo.

---

## 4.1 Hosting Options

Recommended:
- Render
- Railway
- Fly.io

Requirements:
- WebSocket support
- Single instance (or sticky sessions if clustered)
- Environment variable support

---

## 4.2 Environment Configuration

Set environment variables:
- `PORT`
- `REDIS_URL`
- `DATABASE_URL`
- `AI_API_KEY`
- `AI_PROVIDER`
- `NODE_ENV=production`

Disable verbose logs in production.

---

## 4.3 Build Process

Steps:
1. Compile TypeScript: `tsc`
2. Ensure build folder contains server entry.
3. Define start script: `node dist/index.js`

---

## 4.4 WebSocket Validation

Before demo:
- Test multiple devices.
- Test same WiFi & different networks.
- Validate latency.
- Test AI timeout fallback.

---

## 4.5 Demo Stability Checklist

Must confirm:
- Room creation works.
- Player sync stable.
- AI triggers at least twice per match.
- Winner detected properly.
- No server crashes under 6 players.
- Judges instantly understand the innovation within 3 minutes.

---

# Backend Completion Criteria

Backend is considered complete when:
- Multiplayer rooms functional.
- Server authoritative movement.
- Survival logic stable.
- Arena mutation modules working.
- AI integration stable (with personality and commentary).
- Deployment accessible publicly.
- Demo tested across devices.

---

# Final Backend Philosophy

Keep architecture clean.
Avoid overengineering.
Control AI via predefined modules.
Ensure async safety.
Prioritize demo reliability over scalability.

In hackathons:
Stability > Features.
Impact > Infrastructure.
