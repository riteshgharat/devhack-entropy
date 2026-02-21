# Chaos Arena – 12 Hour Execution Plan

## Goal

Deliver a playable, AI-driven multiplayer survival game within 12 hours.

Focus: Impact > Perfection

---

# 1. Frontend Phases

## Phase 1 (Hour 1–2): Multiplayer Rendering
- Initialize 2D game canvas.
- Render player objects.
- Connect WebSocket.
- Sync positions across browser tabs.

Deliverable:
Basic multiplayer visible and synced.

---

## Phase 2 (Hour 2–4): Core Player Mechanics
- Constant movement.
- Jump/dodge.
- Basic collision detection.
- Elimination logic.
- Display alive player count.

Deliverable:
Playable survival loop.

---

## Phase 3 (Hour 4–6): Arena Modules
Create modular environment elements:
- Moving platform
- Falling obstacle
- Shrinking boundary
- Rotating trap
- Random drop hazard

Each module must be triggerable via simple command.

Deliverable:
Environment responds to server commands.

---

## Phase 4 (Hour 8–9): AI Visual Layer
- Commentary panel.
- Large animated text overlay.
- Emoji panel with cooldown.
- Visual trigger for arena changes.

Deliverable:
AI visibly affects the game.

---

## Phase 5 (Hour 11–12): Polish
- Simple sound effects.
- Basic particles.
- Winner announcement animation.
- AI intro screen.

Deliverable:
Demo-ready experience.

---

# 2. Backend Phases

## Phase 1 (Hour 1–3): Basic Multiplayer Server
- Room creation.
- Player join.
- Store player state.
- Broadcast position updates.

No database.
Single server instance only.

---

## Phase 2 (Hour 3–5): Game State Logic
Maintain:
- Player list
- Alive status
- Survival timer
- Leader detection
- Weakest detection

Deliverable:
Server can determine leader and eliminations.

---

## Phase 3 (Hour 8–10): AI Integration
Every 10–15 seconds:
- Send simplified game state to AI.
- Receive structured action + commentary.
- Broadcast result to players.

Must be asynchronous.

Deliverable:
AI actively modifies match.

---

## Phase 4: Fail-Safe System
If AI fails:
- Trigger predefined random event.
- Never freeze gameplay.

Deliverable:
Stable demo under all conditions.

---

# 3. Connection Layer

## Phase 1: WebSocket Setup
- Single WebSocket server.
- In-memory room management.

---

## Phase 2: Server Authority
- Server validates movement.
- Clients receive corrected positions.
- Basic sync stability.

---

## Phase 3: AI Communication Flow

Frontend → Server  
Server → AI  
AI → Server  
Server → All Clients  

Single source of truth: Server

---

# 4. Time Allocation Summary

| Task | Hours |
|------|-------|
| Multiplayer Base | 3 |
| Player Mechanics | 2 |
| Arena Modules | 2 |
| AI Integration | 2 |
| UI & Commentary | 1 |
| Polish & Deploy | 2 |

Total: 12 Hours

---

# 5. Do NOT Build

- Authentication
- Database
- Scaling infra
- Leaderboards
- Advanced matchmaking
- Complex physics

Keep it focused.
Keep it demo-stable.
Keep it impressive.

---

# Final Reminder

In a hackathon:
Perceived intelligence > backend complexity.

Make AI personality loud.
Make arena changes dramatic.
Keep gameplay simple.
Ensure demo never breaks.
