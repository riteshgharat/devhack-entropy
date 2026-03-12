# 🎮 CHAOS ARENA

> A real-time multiplayer browser game platform with cross-device WebRTC voice chat and a global leaderboard.

![Chaos Arena Main Screen](utils/images/ss1.png)

---

## Table of Contents

- [Overview](#overview)
- [Game Modes](#game-modes)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [REST API](#rest-api)
- [WebSocket Messages](#websocket-messages)

---

## Overview

Chaos Arena is a hackathon-built real-time multiplayer game platform where 2–8 players compete across three arcade-style mini-games. Players race to mow glowing grass, pass a ticking dynamite, or score goals. Players can also talk to each other via **WebRTC peer-to-peer voice chat** relayed through the game server.

---

## Game Modes

### 🌿 Grass Collect
A 60-second collection sprint. Players race to mow glowing grass tiles across an 800×600 arena with momentum-based physics. Highest score at zero seconds wins.

### 🧨 Hot Dynamite
An elimination brawl where a ticking dynamite is forcefully attached to a random player. Move into another player to pass it before it explodes — eliminating the holder instantly. The timer accelerates as players drop. Last stickman alive wins.

### ⚽ Turf Soccer
A chaotic 2-team soccer match. Players battle for ball control and goals in a physics-driven pitch. First team to the point threshold wins.

---

## Architecture

```mermaid
graph TB
    subgraph CLIENT["🖥️ Client — React + Vite + TailwindCSS"]
        direction TB
        APP[App.tsx\nState orchestrator]
        LOBBY[MultiplayerLobby\nRoom create / join / leaderboard]
        GAMEARENA[GameArena\nCanvas wrapper]
        subgraph GAMES["Game Components"]
            GG[GrassGame]
            RDG[RedDynamiteGame]
            TSG[TurfSoccerGame]
        end
        subgraph COMMS["CommunicationHub"]
            CHAT[Chat panel]
            VOICEPANEL[Voice Channel panel]
        end
        OVERLAY[BigOverlayBanner\nAI overlay VFX]
        subgraph SERVICES["Client Services"]
            GCLIENT[gameClient\nColyseus.js wrapper]
            TTS_SVC[voiceCommentary\nTTS playback queue]
            VCHAT[voiceChat\nWebRTC full-mesh]
            VCHAT_HOOK[useVoiceChat\nReact hook]
        end
    end

    subgraph BACKEND["⚙️ Backend — Node.js + Colyseus + Express"]
        direction TB
        EXPRESS[Express HTTP Server\nREST API: /health /api/matches\n/api/leaderboard /api/player/:id\nPOST /api/tts]
        subgraph ROOMS["Colyseus Game Rooms"]
            GR[GameRoom\ngrass_collect_room]
            RDR[RedDynamiteRoom\nred_dynamite_room]
            TSR[TurfSoccerRoom\nturf_soccer_room]
        end
        ROOMCOMMS[RoomComms\nAI + Chat + Emoji\n+ Voice Signaling Relay]
        subgraph AI["AI Layer"]
            GEMINI[geminiService\nGemini 2.0 Flash]
            SARVAM[sarvamTTS\nbulbul:v3]
        end
        subgraph DB["Persistence"]
            REDIS[(Redis\nMatch results cache)]
            SQLITE[(SQLite\nLeaderboard + Player stats)]
        end
    end

    subgraph EXTERNAL["☁️ External Services"]
        GEMINI_API[Google Gemini 2.0 Flash\nAI Game Master commentary]
        SARVAM_API[Sarvam AI bulbul:v3\nLive voice TTS]
        STUN[Google STUN servers]
        TURN[Open Relay TURN\nCross-NAT relay]
    end

    GCLIENT -->|"WebSocket (Colyseus)"| ROOMS
    APP -->|REST fetch| EXPRESS

    GR --> ROOMCOMMS
    RDR --> ROOMCOMMS
    TSR --> ROOMCOMMS

    ROOMCOMMS -->|"10s tick"| GEMINI
    EXPRESS -->|TTS proxy| SARVAM

    GEMINI -->|REST| GEMINI_API
    SARVAM -->|REST| SARVAM_API

    GR & RDR & TSR -->|match result| REDIS
    GR & RDR & TSR -->|player stats| SQLITE

    VCHAT -->|"voice_join/offer/answer/ice\n(Colyseus signaling)"| ROOMCOMMS
    VCHAT -->|ICE resolution| STUN
    VCHAT -->|media relay| TURN

    TTS_SVC -->|POST /api/tts| EXPRESS

    APP --> LOBBY
    APP --> GAMEARENA
    GAMEARENA --> GAMES
    APP --> COMMS
    APP --> OVERLAY
    COMMS --> CHAT
    COMMS --> VOICEPANEL
    VCHAT_HOOK --> VCHAT
    VOICEPANEL --> VCHAT_HOOK
    CHAT --> TTS_SVC
```

### How It Fits Together

| Layer | Responsibility |
|---|---|
| **Colyseus Rooms** | Authoritative game state, physics tick, match lifecycle |
| **RoomComms** | Shared service injected into every room — handles chat, emoji, voice signaling relay, AI ticks |
| **geminiService** | Calls Gemini 2.0 Flash every 10 s; returns commentary + arena event + overlay + emoji burst |
| **sarvamTTS** | Backend proxy for Sarvam `bulbul:v3` TTS; keeps API key server-side |
| **voiceChat** | Full WebRTC mesh — one `RTCPeerConnection` per peer pair; Colyseus is the signaling channel |
| **voiceCommentary** | Client-side playback queue; decodes base64 WAV → Web Audio API; dual-host alternation |
| **SQLite** | Persistent player stats and match history |
| **Redis** | Fast match result caching (recent matches endpoint) |

---

## Tech Stack

### Backend
| Package | Purpose |
|---|---|
| `colyseus` + `@colyseus/ws-transport` | Real-time multiplayer server |
| `express` | REST API |
| `better-sqlite3` | Leaderboard & player stats persistence |
| `ioredis` | Match result caching |
| `dotenv` | Environment config |

### Client
| Package | Purpose |
|---|---|
| `react` 19 + `vite` | UI framework + bundler |
| `colyseus.js` | WebSocket game client |
| `tailwindcss` | Utility CSS |
| `motion` (Framer Motion) | Animations |
| `lucide-react` | Icons |
| Web Audio API | TTS playback decoding |
| WebRTC (browser native) | Peer-to-peer voice chat |

### AI / External
| Service | Usage |
|---|---|
| Google Gemini 2.0 Flash | AI Game Master commentary + arena events |
| Sarvam AI `bulbul:v3` | Live bilingual voice commentary (EN/HI, 4 speakers) |
| Google STUN (`stun.l.google.com`) | WebRTC ICE candidate resolution |
| Open Relay TURN (`openrelay.metered.ca`) | Cross-NAT WebRTC media relay |

---

## Project Structure

```
devhack-entropy/
├── backend/
│   ├── src/
│   │   ├── index.ts                   # Express + Colyseus server entry
│   │   ├── ai/
│   │   │   ├── geminiService.ts       # Gemini 2.0 Flash AI Game Master
│   │   │   ├── roomComms.ts           # Chat, emoji, voice signaling, AI ticks
│   │   │   ├── sarvamTTS.ts           # Sarvam bulbul:v3 TTS service
│   │   │   └── types.ts               # Shared AI types
│   │   ├── db/
│   │   │   ├── sqlite.ts              # SQLite init + schema
│   │   │   ├── redis.ts               # Redis client
│   │   │   └── matchHistory.ts        # Leaderboard + stats queries
│   │   └── games/
│   │       ├── grass-collect/         # Grass Collect game room
│   │       ├── red-dynamite/          # Hot Dynamite game room
│   │       └── turf-soccer/           # Turf Soccer game room
│   └── tests/
├── client/
│   ├── src/
│   │   ├── App.tsx                    # Root component, routing, settings
│   │   ├── components/
│   │   │   ├── CommunicationHub.tsx   # Chat + voice channel UI
│   │   │   ├── BigOverlayBanner.tsx   # AI overlay fullscreen VFX
│   │   │   ├── GameArena.tsx          # Canvas game wrapper
│   │   │   ├── MultiplayerLobby.tsx   # Room browser + leaderboard
│   │   │   ├── SplashScreen.tsx       # Intro screen
│   │   │   └── games/
│   │   │       ├── GrassGame.tsx
│   │   │       ├── RedDynamiteGame.tsx
│   │   │       └── TurfSoccerGame.tsx
│   │   └── services/
│   │       ├── gameClient.ts          # Colyseus.js connection wrapper
│   │       ├── voiceCommentary.ts     # TTS queue + Web Audio playback
│   │       ├── voiceChat.ts           # WebRTC full-mesh voice chat
│   │       └── useVoiceChat.ts        # React hook for voice chat
│   └── index.html
└── games.txt                          # Game mode design document
```

---

## Getting Started

### Prerequisites

- Docker and Docker Compose

### Setup with Docker

1. **Configure Environment Variables**
   - Copy `backend/.env.example` to `backend/.env` and add your API keys.
   - (Optional) Copy `client/.env.example` to `client/.env` if you need to customize the backend URL.

2. **Run with Docker Compose**
   ```bash
   docker-compose up --build
   ```

   The application will be available at:
   - **Frontend:** http://localhost:5173
   - **Backend:** http://localhost:3000
   - **Redis:** localhost:6379

### Manual Setup (Development)

#### Backend

```bash
cd backend
cp .env.example .env        # fill in API keys
npm install
npm run dev                 # starts on http://localhost:3000
```

### Client

```bash
cd client
cp .env.example .env        # or create .env with VITE_BACKEND_URL
npm install
npm run dev                 # starts on http://localhost:5173
```

### Running over ngrok (multi-device)

```bash
# Expose backend to internet
ngrok http 3000

# Set in client/.env
VITE_BACKEND_URL=https://<your-ngrok-url>.ngrok-free.app
VITE_NGROK=true
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `PORT` | Server port (default `3000`) |
| `REDIS_URL` | Redis connection string (default `redis://localhost:6379`) |
| `GEMINI_API_KEY` | Google AI Studio API key |
| `SARVAM_API_KEY` | Sarvam AI API key (get from `app.sarvam.ai`) |

### Client (`client/.env`)

| Variable | Description |
|---|---|
| `VITE_BACKEND_URL` | Backend URL (default `http://localhost:3000`) |
| `VITE_NGROK` | Set `true` to add `ngrok-skip-browser-warning` header |

---

## REST API

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | Server status |
| `GET` | `/api/matches` | Recent match history (last 10) |
| `GET` | `/api/leaderboard` | Global top 10 leaderboard |
| `GET` | `/api/player/:id` | Individual player stats |
| `POST` | `/api/tts` | TTS proxy — `{ text, language, gender }` → `{ audio: base64wav }` |

---

## WebSocket Messages

All messages are relayed through Colyseus rooms via `room.send(type, payload)` / `room.onMessage(type, handler)`.

### Chat & Social
| Type | Direction | Payload |
|---|---|---|
| `chat_message` | ↑ client→server | `{ text }` |
| `chat_message` | ↓ server→client | `{ id, playerId, displayName, text, createdAt }` |
| `emoji_reaction` | ↑↓ | `{ emoji }` |

### AI Events
| Type | Direction | Payload |
|---|---|---|
| `ai_overlay` | ↓ | `{ id, title, subtitle, severity, durationMs }` |
| `ai_emoji_burst` | ↓ | `{ emoji, target }` |
| `arena_event` | ↓ | `{ type, payload }` |

### Voice Chat (WebRTC Signaling)
| Type | Direction | Payload |
|---|---|---|
| `voice_join` | ↑ | `{}` |
| `voice_peers` | ↓ | `{ peers: [{ sessionId, displayName }] }` |
| `voice_joined` | ↓ | `{ sessionId, displayName }` |
| `voice_left` | ↓ | `{ sessionId }` |
| `voice_offer` | ↑ relay ↓ | `{ to/from, sdp }` |
| `voice_answer` | ↑ relay ↓ | `{ to/from, sdp }` |
| `voice_ice` | ↑ relay ↓ | `{ to/from, candidate }` |
| `voice_speaking` | ↑↓ | `{ speaking: boolean }` |
