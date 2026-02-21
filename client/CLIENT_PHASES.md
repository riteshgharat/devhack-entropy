# Chaos Arena – Frontend Execution Phases

Tech Stack:
- React.js
- TypeScript
- KAPLAY (Kaboom.js)
- Colyseus JS Client
- Optional: Tailwind CSS, Zustand

Goal:
Deliver a smooth, responsive 2D multiplayer experience that visually showcases AI-driven chaos.

Server is authoritative.
Frontend is predictive and visual.

---

# PHASE 1: Core Setup & Networking Foundation

## Objective
Establish working multiplayer rendering with WebSocket connectivity and basic scene setup.

---

## 1.1 Project Initialization

Install:

- react
- typescript
- kaplay (kaboom.js)
- colyseus.js
- tailwind (optional)
- zustand (optional)

Set up folder structure:

client/
├── core/
├── games/
├── ui/
└── main.tsx

---

## 1.2 KAPLAY Initialization

Create game canvas inside React container.

- Initialize KAPLAY once.
- Disable React re-render inside game canvas.
- Set fixed resolution.
- Enable debug mode temporarily.

Deliverable:
Blank canvas renders successfully.

---

## 1.3 WebSocket & Room Connection

Create:

core/network.ts

Responsibilities:

- Connect to Colyseus server
- Join room
- Listen for state changes
- Send input events only

DO NOT send:
❌ Player position
❌ Score
❌ Elimination state

Only send:
✔ Direction
✔ Jump
✔ Action triggers

Deliverable:
Two clients join same room and see each other.

---

## 1.4 Basic Scene Setup

Create:

games/arena-brawl/ArenaScene.ts

Scene responsibilities:

- Render players
- Render simple arena floor
- Update position from server state

Deliverable:
Basic multiplayer visual sync.

---

# PHASE 2: Game Engine Rendering & Sync Logic

## Objective
Implement prediction, interpolation, elimination visuals, and HUD.

---

## 2.1 Input System

Create:

games/arena-brawl/input.ts

Support:

Desktop:
- WASD / Arrow Keys
- Space (jump)

Mobile:
- Virtual joystick
- Tap-to-jump

Abstract input layer so both platforms share same logic.

Deliverable:
Smooth input capture.

---

## 2.2 Client-Side Prediction

Create:

core/prediction.ts

Each frame:

1. Capture input
2. Apply local movement instantly
3. Send input to server
4. Render predicted movement

Prevents lag feeling.

Deliverable:
Player movement feels instant.

---

## 2.3 Server Reconciliation

Create:

core/reconciliation.ts

When authoritative state arrives:

If large mismatch:
- Snap position

If small mismatch:
- Lerp smoothly

Never allow long-term drift.

Deliverable:
Stable sync without jitter.

---

## 2.4 Remote Player Interpolation

Create:

core/interpolation.ts

For other players:

- Store previous state
- Store next state
- Interpolate between frames (60 FPS)

Server tick: 20–30Hz
Client render: 60Hz

Deliverable:
Other players move smoothly.

---

## 2.5 HUD & Leaderboard

Create:

ui/HUD.tsx
ui/Leaderboard.tsx

Display:

- Alive count
- Player rank
- Timer
- Emoji panel
- AI commentary box

React handles UI only.
Game canvas remains separate.

Deliverable:
Clean game UI visible on mobile & desktop.

---

# PHASE 3: AI Visual Integration & Chaos Systems

## Objective
Visually reflect AI decisions and create dramatic chaos effects.

---

## 3.1 Arena Mutation Rendering

Frontend listens for server event:

{
  type: "spawn_trap",
  x: number,
  y: number
}

Trigger:

- Spawn visual object
- Play sound
- Animate effect

Create modular arena components:

- Falling block
- Shrinking boundary
- Rotating hazard
- Speed effect

Deliverable:
AI actions visibly change arena.

---

## 3.2 Commentary System

Create:

ui/CommentaryOverlay.tsx

When server sends:

{
  commentary: string
}

Render:

- Large animated text
- Fade-in/out
- Dramatic positioning

This is your WOW layer.

Deliverable:
AI feels alive and dominant.

---

## 3.3 Emoji Reaction System

UI:

- Emoji panel
- Cooldown indicator

Flow:

Player taps emoji →
Send event to server →
Server processes →
AI may respond next cycle

Add subtle:

- Screen shake
- Sound cue
- Glow effect

Deliverable:
Interactive AI feedback loop.

---

## 3.4 Elimination & Victory Effects

When server updates isAlive = false:

- Fade player
- Ghost effect
- Particle burst

When winner detected:

- Freeze movement
- Big victory overlay
- AI victory commentary

Deliverable:
Dramatic match end.

---

# PHASE 4: Deployment & Production Hardening

## Objective
Ensure frontend is stable, optimized, and demo-ready.

---

## 4.1 Build Optimization

- Remove debug logs
- Disable physics debug visuals
- Minify build
- Enable production mode

Test bundle size.

---

## 4.2 Performance Validation

Target:
60 FPS desktop
Stable 40–60 FPS mobile

Optimization Rules:

✔ Reuse objects
✔ Avoid React re-renders inside game loop
✔ Keep particle effects lightweight
✔ Avoid large sprite sheets
✔ Use diff-based updates

---

## 4.3 Mobile Optimization

✔ Fixed joystick area
✔ Large buttons
✔ Reduced visual clutter
✔ Simplified effects on small screens

Test on:
- Android Chrome
- iPhone Safari

---

## 4.4 WebSocket Lifecycle Handling

Handle:

- Server disconnect
- Room full
- Join failure
- Timeout

Show:

- Friendly reconnect overlay
- Retry button

Never crash scene silently.

---

## 4.5 Pre-Demo Checklist

Before judging:

✔ Two devices tested
✔ Mobile tested
✔ AI commentary triggers
✔ Arena mutation triggers
✔ Winner detection works
✔ No console errors
✔ Stable FPS

---

# Frontend Completion Criteria

Frontend is complete when:

- Multiplayer sync works smoothly
- Prediction + reconciliation stable
- AI visibly modifies arena
- Commentary displays correctly
- Emoji system functional
- Works on mobile & desktop
- 60 FPS stable

---

# Final Frontend Philosophy

Frontend should feel:

Smooth.
Responsive.
Predictive.
Visually chaotic.
Network-stable.

Server decides truth.
Frontend makes it beautiful.
AI makes it unforgettable.