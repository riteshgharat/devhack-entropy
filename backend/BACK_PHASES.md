# Chaos Arena – Backend Execution Phases

This document outlines the structured backend implementation plan for Chaos Arena using:

- Node.js
- TypeScript
- Colyseus (Multiplayer Framework)
- WebSockets
- Optional Database (PostgreSQL or MongoDB)
- AI Provider (Groq / Gemini / OpenRouter)

---

# PHASE 1: Server Setup & Core Multiplayer Foundation

## Objective
Set up a working authoritative multiplayer server using Colyseus with real-time WebSocket communication and basic game state synchronization.

---

## 1.1 Environment Setup

### Install Required Packages

Core Dependencies:
- colyseus
- express
- ws (WebSocket support)
- typescript
- ts-node-dev
- cors
- dotenv

Optional Dev Utilities:
- nodemon
- eslint
- prettier

Initialize project:
- npm init
- Setup TypeScript config
- Create src/ directory

---

## 1.2 Colyseus Server Initialization

Steps:

1. Create Colyseus server instance.
2. Attach Express app.
3. Define GameRoom class.
4. Define RoomState schema.
5. Register room type.
6. Start HTTP + WebSocket server.

Deliverable:
Server running with WebSocket support.

---

## 1.3 Basic Room Flow

Room Responsibilities:

- Handle player join
- Handle player leave
- Store player state
- Broadcast state updates
- Manage max player limit (2–8)

GameState should include:

- players (Map or Schema)
- isAlive
- position (x, y)
- survivalTime
- matchStarted flag

Deliverable:
Two browser tabs can join same room and see synchronized movement.

---

## 1.4 Basic Game Loop

Implement server-side tick loop (60 FPS or simplified interval).

Each tick:
- Process player inputs
- Update positions
- Validate boundaries
- Detect elimination
- Update survival timers
- Broadcast updated state

Deliverable:
Authoritative server-controlled movement.

---

# PHASE 2: Game Engine Logic & Database Integration

## Objective
Implement full survival logic and optional persistent storage.

---

## 2.1 Game Engine Logic

Add structured game state processing:

### Leader Detection
- Player with highest survivalTime.

### Weakest Detection
- Lowest survivalTime among alive players.

### Elimination Logic
- Player falls below boundary.
- Player collides with hazard.
- Mark isAlive = false.
- Reduce aliveCount.

### Match End Condition
If aliveCount == 1:
- Announce winner.
- Trigger match end event.
- Reset room after delay.

Deliverable:
Complete survival loop with winner detection.

---

## 2.2 Arena Mutation Engine

Create predefined action modules:

- spawn_falling_block()
- shrink_boundary()
- rotate_obstacle()
- speed_modifier()
- target_player_trap()

These should mutate GameState safely.

AI will only trigger these modules.

Deliverable:
Backend can trigger arena transformations via simple function calls.

---

## 2.3 Database Integration (Optional but Structured)

For hackathon:
Database is optional.

If included:

### Choose One:
- PostgreSQL (structured)
- MongoDB (faster setup)

Install:
- pg (Postgres)
OR
- mongoose (MongoDB)

Store:
- Player session ID
- Match result
- Winner ID
- Match duration

Avoid:
- Complex auth
- Heavy schemas

Deliverable:
Match results persist (optional).

---

# PHASE 3: Agentic AI Integration

## Objective
Integrate AI as a Game Master without blocking main game loop.

---

## 3.1 AI Provider Setup

Choose one:

- Groq (recommended for speed)
- Gemini
- OpenRouter

Install:
- axios or native fetch
- zod (for JSON validation)

---

## 3.2 AI Orchestrator Service

Create separate module:
aiService.ts

Responsibilities:

1. Accept simplified GameState snapshot:
   {
     alivePlayers,
     leader,
     weakest,
     emojiIntensity,
     timeLeft
   }

2. Send structured prompt to LLM.
3. Receive JSON response:
   {
     action,
     targetPlayer?,
     intensity?,
     commentary
   }

4. Validate with Zod schema.
5. Return safe response.

---

## 3.3 AI Loop Integration

Inside Room:

Set interval (every 10–15 seconds):

1. Snapshot state.
2. Call aiService asynchronously.
3. Await response.
4. Apply arena mutation.
5. Broadcast commentary.

Important:
AI calls must not block tick loop.

---

## 3.4 Fail-Safe Logic

If:
- Timeout
- API error
- Invalid JSON

Fallback:
- Trigger random predefined event.
- Use default commentary.

Never freeze match.

Deliverable:
AI actively influences gameplay in controlled way.

---

# PHASE 4: Deployment Flow

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
- Single instance
- Environment variable support

---

## 4.2 Environment Configuration

Set environment variables:

- PORT
- AI_API_KEY
- AI_PROVIDER
- NODE_ENV=production

Disable verbose logs in production.

---

## 4.3 Build Process

Steps:

1. Compile TypeScript:
   tsc
2. Ensure build folder contains server entry.
3. Define start script:
   node dist/index.js

---

## 4.4 WebSocket Validation

Before demo:

- Test multiple devices.
- Test same WiFi.
- Test different networks.
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

---

# Backend Completion Criteria

Backend is considered complete when:

- Multiplayer rooms functional.
- Server authoritative movement.
- Survival logic stable.
- Arena mutation modules working.
- AI integration stable.
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