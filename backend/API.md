# Chaos Arena – Backend API & Database Reference

---

## Table of Contents

1. [HTTP Endpoints](#1-http-endpoints)
2. [WebSocket / Colyseus Room](#2-websocket--colyseus-room)
   - [Room: `arena_room`](#21-room-arena_room)
   - [Client → Server Messages](#22-client--server-messages)
   - [Server → Client Messages](#23-server--client-messages)
   - [Synchronized State](#24-synchronized-state)
3. [Database Integration](#3-database-integration)
   - [SQLite](#31-sqlite)
   - [Redis](#32-redis)
   - [Read Strategy](#33-read-strategy)
4. [Environment Variables](#4-environment-variables)
5. [Graceful Degradation](#5-graceful-degradation)

---

## 1. HTTP Endpoints

Base URL: `http://localhost:3000` (dev) or your deployed host.

> **Note on Ngrok:** If accessing the API via ngrok, ensure you include the header `ngrok-skip-browser-warning: true` in your requests to bypass the interstitial warning page.

---

### `GET /health`

Returns server status.

**Response `200`**
```json
{
  "name": "Chaos Arena",
  "status": "running",
  "version": "1.0.0"
}
```

---

### `GET /api/matches`

Returns recent match history (up to 10 entries). Reads from Redis first; falls back to SQLite.

**Response `200`**
```json
{
  "matches": [
    {
      "roomId": "abc123",
      "winnerId": "sessionId_xyz",
      "winnerName": "Bot_Alpha",
      "playerCount": 4,
      "matchDuration": 37.4,
      "isDraw": false
    }
  ]
}
```

**Response `500`**
```json
{ "error": "Failed to fetch matches" }
```

---

### `GET /api/leaderboard`

Returns the top players based on wins and score. Reads from SQLite.

**Response `200`**
```json
{
  "leaderboard": [
    {
      "id": "id_abc123",
      "displayName": "PixelKing",
      "matches": 15,
      "wins": 10,
      "score": 4500
    }
  ]
}
```

**Response `500`**
```json
{ "error": "Failed to fetch leaderboard" }
```

---

### `GET /api/player/:id`

Returns the stats for a specific player, including their global rank. Rank is calculated by counting players with more wins or the same wins and a higher score. Reads from SQLite.

**Response `200`**
```json
{
  "stats": {
    "id": "id_abc123",
    "displayName": "PixelKing",
    "matches": 15,
    "wins": 10,
    "score": 4500,
    "rank": 3
  }
}
```

**Response `404`**
```json
{ "error": "Player not found" }
```

**Response `500`**
```json
{ "error": "Failed to fetch player stats" }
```

---

### `POST /api/player/name`

Updates or creates a persistent player record with a new display name. Used for syncing character names across devices.

**Request Body**
```json
{
  "playerId": "id_abc123",
  "displayName": "NewName"
}
```

**Response `200`**
```json
{
  "success": true,
  "displayName": "NewName"
}
```

**Response `400`**
```json
{ "error": "Invalid playerId or displayName" }
```

**Response `500`**
```json
{ "error": "Failed to update player name" }
```

---

## 2. WebSocket / Colyseus Room

All real-time communication uses the Colyseus WebSocket protocol.

**Connect:** `ws://localhost:3000`

---

### 2.1 Room: `arena_room`

| Property | Value |
|---|---|
| Room type | `arena_room` |
| Max clients | 8 |
| Min to start | 2 |
| Tick rate | 60 FPS |
| Match countdown | 3 seconds |
| Post-match reset delay | configurable via `MATCH_RESET_DELAY` |

**Join Options** (sent via `joinOrCreate` options):

| Field | Type | Description |
|---|---|---|
| `displayName` | `string` (optional) | Player display name. Defaults to `Player_<id>` |
| `playerId` | `string` (optional) | Unique player ID. Defaults to `sessionId` |
| `color` | `string` (optional) | Player color hex code. Defaults to a random color |
| `customRoomId` | `string` (optional) | Custom room ID when creating a room |

```ts
const room = await client.joinOrCreate("arena_room", { displayName: "MyName", playerId: "id_123", color: "#ef4444" });
```

---

### 2.2 Client → Server Messages

#### `move`
Move the player in a direction. Server applies velocity authoritatively.

```json
{ "dx": 1, "dy": 0 }
```

| Field | Type | Values |
|---|---|---|
| `dx` | `number` | `-1` (left), `0`, `1` (right) |
| `dy` | `number` | `-1` (up), `0`, `1` (down) |

---

#### `updateName`
Updates the player's display name for both the current session and persistent storage.

```
"NewPlayerName" (sent as raw string)
```

| Type | Max Length | Description |
|---|---|---|
| `string` | 15 characters | The new name to display in the current game room and save to the backend. |

---

### 2.3 Server → Client Messages

#### `match_start`
Fired when the match begins after countdown.

```json
{ "playerCount": 4 }
```

---

#### `player_eliminated`
Fired when a player is eliminated.

```json
{
  "sessionId": "abc123",
  "displayName": "Bot_Beta",
  "survivalTime": 12.4,
  "reason": "fell out of bounds"
}
```

Elimination reasons: `fell out of bounds`, `hit by falling_block`, `hit by trap`, `hit by obstacle`

---

#### `match_end`
Fired when only one player remains or all are eliminated.

```json
{
  "winnerId": "sessionId_xyz",
  "winnerName": "Bot_Alpha",
  "matchDuration": 37.4,
  "isDraw": false
}
```

---

#### `match_reset`
Fired after the post-match delay when the room resets for a new round.

```json
{ "playerCount": 3 }
```

---

### 2.4 Synchronized State

The full game state is automatically synced to all clients via Colyseus `@Schema`. Key fields:

#### `GameState`

| Field | Type | Description |
|---|---|---|
| `players` | `MapSchema<PlayerState>` | Map of sessionId → player data |
| `hazards` | `ArraySchema<HazardState>` | Active arena hazards |
| `matchStarted` | `boolean` | Whether the match is running |
| `matchEnded` | `boolean` | Whether the match has ended |
| `matchTimer` | `float32` | Elapsed match time in seconds |
| `aliveCount` | `uint8` | Number of alive players |
| `countdown` | `uint8` | Pre-match countdown (3→0) |
| `leaderId` | `string` | Session ID of current leader |
| `weakestId` | `string` | Session ID of weakest player |
| `winnerId` | `string` | Session ID of winner (post-match) |
| `arenaBoundaryX` | `float32` | Current arena width (shrinks) |
| `arenaBoundaryY` | `float32` | Current arena height (shrinks) |
| `lastArenaEvent` | `string` | Last mutation label (`"block"`, `"boundary"`, `"rotate"`, `"speed"`, `"trap"`) |

#### `PlayerState`

| Field | Type | Description |
|---|---|---|
| `displayName` | `string` | Player display name |
| `playerId` | `string` | Unique player ID |
| `color` | `string` | Player color hex code |
| `x` | `float32` | X position |
| `y` | `float32` | Y position |
| `velocityX` | `float32` | X velocity |
| `velocityY` | `float32` | Y velocity |
| `isAlive` | `boolean` | Whether player is still in the match |
| `survivalTime` | `float32` | Seconds survived in current match |

#### `HazardState`

| Field | Type | Description |
|---|---|---|
| `id` | `string` | Unique hazard ID |
| `hazardType` | `string` | `falling_block`, `obstacle`, `speed_zone`, `trap` |
| `x`, `y` | `float32` | Position |
| `width`, `height` | `float32` | Hitbox size |
| `velocityX`, `velocityY` | `float32` | Movement velocity |
| `rotation` | `float32` | Current rotation angle |
| `rotationSpeed` | `float32` | Degrees/second rotation |
| `speedMultiplier` | `float32` | Speed modifier factor (speed_zone only) |
| `targetPlayerId` | `string` | Targeted player session ID |
| `lifetime` | `float32` | Remaining active lifetime (seconds) |
| `active` | `boolean` | Whether still active |

---

## 3. Database Integration

Both databases are **optional**. The game server runs fully without them.

---

### 3.1 SQLite

**Driver:** [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — synchronous, zero-config, embedded.

**Default file:** `chaos_arena.db` in the server working directory.

Override with: `SQLITE_PATH` env var.

**Pragmas applied at startup:**
```sql
PRAGMA journal_mode = WAL;
```

**Auto-created Schema:**

```sql
CREATE TABLE IF NOT EXISTS match_history (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id        TEXT    NOT NULL,
  winner_id      TEXT,
  winner_name    TEXT,
  player_count   INTEGER NOT NULL,
  match_duration REAL    NOT NULL,
  is_draw        INTEGER DEFAULT 0,
  created_at     TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS players (
  id            TEXT PRIMARY KEY,
  display_name  TEXT NOT NULL,
  matches       INTEGER DEFAULT 0,
  wins          INTEGER DEFAULT 0,
  score         INTEGER DEFAULT 0,
  created_at    TEXT DEFAULT (datetime('now'))
);
```

**Write — `saveMatchResult()`**: Called automatically at the end of every match.

```sql
INSERT INTO match_history (room_id, winner_id, winner_name, player_count, match_duration, is_draw)
VALUES (?, ?, ?, ?, ?, ?)
```

**Write — `savePlayerStats()`**: Called at the end of every match for all participants.

```sql
INSERT INTO players (id, display_name, matches, wins, score)
VALUES (?, ?, 1, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  display_name = excluded.display_name,
  matches = matches + 1,
  wins = wins + excluded.wins,
  score = score + excluded.score
```

**Write — `updatePlayerName()`**: Updates player name persistently.

```sql
INSERT INTO players (id, display_name, matches, wins, score)
VALUES (?, ?, 0, 0, 0)
ON CONFLICT(id) DO UPDATE SET
  display_name = excluded.display_name
```

**Read — `getRecentMatches(limit)`**: Used by `GET /api/matches`. Returns rows ordered by `created_at DESC`.

```sql
SELECT room_id, winner_id, winner_name, player_count, match_duration, is_draw
FROM match_history
ORDER BY created_at DESC
LIMIT ?
```

**Read — `getLeaderboard(limit)`**: Used by `GET /api/leaderboard`. Returns rows ordered by `wins DESC, score DESC`.

```sql
SELECT id, display_name, matches, wins, score
FROM players
ORDER BY wins DESC, score DESC
LIMIT ?
```

**Read — `getPlayerStats(id)`**: Used by `GET /api/player/:id`. Returns a single player's stats.

```sql
SELECT id, display_name, matches, wins, score
FROM players
WHERE id = ?
```

---

### 3.2 Redis

**Client:** [ioredis](https://github.com/redis/ioredis)

**Default URL:** `redis://localhost:6379`

Override with: `REDIS_URL` env var.

**Data Structure:**

| Key | Type | Description |
|---|---|---|
| `chaos:match_history` | `List` | Recent match results as JSON strings |

**Write — `saveMatchResult()`**: Pushes result JSON to the head of the list and trims to last 100 entries.

```
LPUSH chaos:match_history <json>
LTRIM chaos:match_history 0 99
```

**Read — `getRecentMatches(limit)`**: Returns the first N entries from the list.

```
LRANGE chaos:match_history 0 <limit-1>
```

---

### 3.3 Read Strategy

`getRecentMatches()` uses a **Redis-first, SQLite-fallback** strategy:

```
1. Redis available?
   └─ YES → LRANGE chaos:match_history → return
   └─ NO  → continue

2. SQLite available?
   └─ YES → SELECT from match_history → return
   └─ NO  → return []
```

---

## 4. Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | HTTP/WebSocket server port |
| `SQLITE_PATH` | `./chaos_arena.db` | Path to the SQLite database file |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection URL |
| `AI_API_KEY` | — | API key for AI provider (Phase 3) |
| `AI_PROVIDER` | — | `groq`, `gemini`, or `openrouter` (Phase 3) |
| `NODE_ENV` | `development` | Set to `production` to suppress verbose logs |

---

## 5. Graceful Degradation

Both databases are initialized at startup with full error handling. If unavailable:

| Scenario | Behaviour |
|---|---|
| SQLite unavailable at startup | Warning logged, game runs without persistence |
| Redis down at startup | Warning logged, game runs without cache |
| SQLite write fails mid-match | Warning logged, match data lost (no crash) |
| Redis write fails mid-match | Warning logged, falls back to SQLite on next read |
| Both databases down | `GET /api/matches` returns `{ "matches": [] }` |

The main game loop (`GameRoom` tick, WebSocket messages, state sync) is **never blocked** by database operations. All DB calls are `async`/non-blocking and wrapped in `try/catch`.
