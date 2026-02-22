# Chaos Arena – Product Requirements Document (PRD)

## 1. Product Overview

Chaos Arena is a browser-based multiplayer survival game where players compete inside an AI-controlled arena. The AI Game Master dynamically reshapes the environment and delivers real-time chaotic, meme-driven commentary.

This is designed as a hackathon project focused on immediate impact, playability, and entertainment.

---

## 2. Vision

To create a playable AI-driven chaos experience where:
- The AI feels alive and in control.
- Players compete in a simple survival format.
- The environment dynamically changes during gameplay.
- Judges instantly understand the innovation.

---

## 3. Objectives

### Primary Objective
Deliver a polished, playable multiplayer game within 12 hours that showcases real-time agentic AI interaction.

### Success Criteria
- Multiplayer works reliably (2–8 players).
- AI commentary is visible and entertaining.
- Arena visibly changes during gameplay.
- Clear winner determined.
- Judges react positively within 3 minutes of demo.

---

## 4. Target Audience

### Primary
- Hackathon judges
- Developers
- Technical audience

### Secondary (Post-hackathon potential)
- Casual competitive gamers
- Streamers
- Students

---

## 5. Core Gameplay

### Game Loop
1. Player enters via a stylish **Chaos Splash Screen**.
2. Persistent **identity** (Name, Color, ID) is synced across devices.
3. Player selects a mini-game from the catalog in the **Multiplayer Lobby**.
4. **AI Game Master** (Meme-driven, sadistic) introduces the mode.
5. Arena initializes with real-time physics and shared state.
6. Players compete for high scores or survival.
7. Post-match: Global **Leaderboard** updates with rank tracking.

---

## 6. Core Features

### 6.1 Mini-Game Catalog

#### Mode 1: Hot Dynamite (The Hot Potato Edition)
- **Objective**: Don't hold the bomb when it ticks to zero.
- **Chaos Factor**: The AI GM spawns "Safe Zones" that aren't actually safe.
- **Victory**: Last survivor or highest survival time.

#### Mode 2: Grass Collect (The Speed Farmer Edition)
- **Objective**: Touch as many grass patches as possible in 60 seconds.
- **Chaos Factor**: AI GM spawns "Poison Patches" or flips gravity/speed.
- **Victory**: Highest grass count.

### 6.2 AI Game Master (The "GM" Agent)

#### Personality & Behavior
- **Sadistic/Funny**: Delivered via top-bar commentary.
- **Dynamic Targeting**: Focuses on the "Sweaty" (Top Player) or the "Noob" (Bot-like players).
- **Arena Intervention**: Spawns obstacles, resets scores, or grants "Cursed" power-ups.

### 6.4 Emoji Interaction

- Players can send emojis
- AI reacts to emoji patterns
- Cooldown to prevent abuse
- Emoji activity influences AI decisions

---

## 7. User Experience Flow

### 7.1 Main Menu
- Create Room
- Join Room
- Minimal UI
- AI presence visible

### 7.2 Room Creation
- Select theme
- Set max players
- Generate room code

### 7.3 Match Start
- AI introduction
- Arena builds visually
- Countdown

### 7.4 During Match
- Player count visible
- Commentary overlay
- Emoji panel
- Dynamic arena changes

### 7.5 End Match
- AI announces winner
- Replay option

---

## 8. Security Considerations

- Server authoritative logic
- No client-trusted movement
- Emoji rate limiting
- Basic session validation

---

## 9. Potential Challenges

### AI Latency
Mitigation: Async processing and fallback logic.

### Over-Chaos
Mitigation: Controlled intervention frequency.

### UI Clutter on Mobile
Mitigation: Minimal design, collapsible emoji panel.

---

## 10. Future Expansion

- Spectator mode
- Twitch integration
- Custom AI personalities
- Full AI-generated arenas
- Ranking system
- AI Game Master SDK

---

## 11. Product Identity

Chaos Arena is a live AI performance system disguised as a survival game.

The AI is the star.
Players survive its chaos.
