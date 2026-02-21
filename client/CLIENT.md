# CHAOS ARENA – Frontend 2D Game Architecture

## 1️⃣ Frontend Philosophy

The frontend is responsible for:

✔ Rendering smooth 2D gameplay  
✔ Handling client-side prediction  
✔ Interpolating remote players  
✔ Managing room connections  
✔ Rendering real-time leaderboard  
✔ Supporting multiple games modularly  
✔ Running smoothly on mobile & desktop  

The frontend NEVER:
❌ Decides authoritative game results  
❌ Trusts local physics permanently  
❌ Calculates final score  

Server is always authoritative.

---

# 2️⃣ Tech Stack

Core:

- React.js
- TypeScript
- KAPLAY (Kaboom.js)
- Colyseus JS Client

Optional UI:

- Tailwind CSS
- Zustand (lightweight state management)

---

# 3️⃣ Folder Structure

client/

├── games/
│   ├── arena-brawl/
│   │     ├── ArenaScene.ts
│   │     ├── physics.ts
│   │     ├── input.ts
│   │     └── score.ts
│   │
│   ├── trap-runner/
│   │     ├── RunnerScene.ts
│   │
│   └── chaos-tiles/
│         ├── TilesScene.ts
│
├── core/
│   ├── network.ts
│   ├── stateSync.ts
│   ├── prediction.ts
│   ├── reconciliation.ts
│   └── interpolation.ts
│
├── ui/
│   ├── Lobby.tsx
│   ├── Room.tsx
│   ├── Leaderboard.tsx
│   └── HUD.tsx
│
└── main.tsx

Each game is isolated and self-contained.
Core handles networking logic shared across games.

---

# 4️⃣ Core Architecture Layers

## A️⃣ Rendering Layer (KAPLAY)

Responsible for:

- Player sprites
- Arena obstacles
- Particle effects
- Camera
- Physics visuals

Each game registers its own scene:

kaplay.scene("arena", ArenaScene)
kaplay.scene("runner", RunnerScene)

Only one scene active at a time.

---

## B️⃣ Networking Layer

Located in:

core/network.ts

Responsibilities:

- Connect to Colyseus room
- Handle join/leave
- Listen to state patches
- Send player input only

Client NEVER sends:
❌ Position
❌ Score
❌ Game results

Only sends:
✔ Direction
✔ Jump
✔ Action key

---

## C️⃣ Client-Side Prediction

File:
prediction.ts

Flow per frame (60 FPS):

1. Capture input
2. Apply movement locally
3. Send input to server
4. Render predicted position

This ensures smooth gameplay.

---

## D️⃣ Server Reconciliation

When authoritative state arrives:

1. Compare local predicted position
2. If mismatch:
   - Snap if large difference
   - Smoothly lerp if small difference

Never allow drift.

---

## E️⃣ Interpolation (Other Players)

Server sync rate: 20–30Hz  
Client render rate: 60Hz  

For remote players:

- Store previous state
- Store next state
- Interpolate between frames

Ensures smooth remote movement.

---

# 5️⃣ Game Scene Structure (Example: Arena)

ArenaScene Responsibilities:

✔ Spawn player
✔ Render arena modules
✔ Detect visual collisions
✔ Handle camera
✔ Display HUD
✔ Trigger local effects on server events

Server Event Example:

{
  type: "spawn_trap",
  x: 400,
  y: 200
}

Frontend:
- Spawn visual trap
- Play sound
- Animate effect

Physics authority still server-side.

---

# 6️⃣ Input Handling

Desktop:
- WASD / Arrow Keys
- Space for jump

Mobile:
- Virtual joystick
- Tap to jump

Input abstraction layer:

input.ts

This ensures both mobile & desktop use same core logic.

---

# 7️⃣ Leaderboard UI

Source:
Redis → Colyseus → Client

Frontend:

- Receives leaderboard update event
- Renders sorted list
- Updates in real-time

HUD shows:

- Player rank
- Score
- Alive count
- Match timer

---

# 8️⃣ Multi-Game Switching

Flow:

1. User selects game in Lobby
2. Connect to specific room type
3. Load matching scene
4. Start simulation

Example:

if (gameType === "arena") {
   kaplay.go("arena")
}

Each game:

- Has isolated logic
- Shares network layer
- Shares prediction system

---

# 9️⃣ Performance Strategy

Target:

60 FPS on:
- Desktop
- Mid-range mobile

Optimization Rules:

✔ Avoid heavy sprite assets
✔ Reuse objects
✔ Avoid full scene re-renders
✔ Use diff-based state updates
✔ Avoid excessive React re-renders

React handles UI only.
Game rendering stays inside KAPLAY.

---

# 🔟 Mobile Optimization

✔ Fixed joystick zone
✔ Simplified particle effects
✔ Reduced shadow effects
✔ Touch-friendly UI
✔ Large buttons

Test on:

- Mid-range Android
- iPhone Safari

---

# 1️⃣1️⃣ WebSocket Lifecycle

On Join:

- Connect
- Authenticate
- Join room
- Load scene

On Disconnect:

- Show reconnect overlay
- Attempt rejoin
- Clean up scene if failed

---

# 1️⃣2️⃣ Animation & Effects Layer

Used for:

- Player elimination
- Arena mutation
- Trap spawn
- Victory screen

Keep effects lightweight.

Do NOT use heavy shader effects for hackathon.

---

# 1️⃣3️⃣ Error Handling Strategy

Handle:

- Room full
- Invalid JWT
- Server disconnect
- Desync correction

Display friendly overlay instead of crashing scene.

---

# 1️⃣4️⃣ Hackathon Mode Simplification

Build first:

✔ Arena game only
✔ Basic prediction
✔ Basic interpolation
✔ Leaderboard UI
✔ Clean HUD

Add later:

- Multiple games
- Advanced animations
- Spectator mode
- Replay system

---

# 1️⃣5️⃣ Final Frontend Guarantees

✔ Smooth 60 FPS gameplay  
✔ Authoritative server sync  
✔ Client-side prediction  
✔ Clean modular multi-game support  
✔ Real-time leaderboard updates  
✔ Mobile & desktop compatibility  

---

# Final Philosophy

Frontend should feel:

Smooth.
Responsive.
Predictive.
Visually chaotic.
Network-stable.

Let the backend decide truth.
Let the frontend make it beautiful.