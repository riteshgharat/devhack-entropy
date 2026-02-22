# Chaos Arena – Backend Testing Guide

This guide explains how to verify that the Chaos Arena backend is functioning correctly.

## 1. Quick Health Check

Verify the server is running and the HTTP API is accessible.

**Command:**

```bash
curl http://localhost:3000/health
```

**Expected Response:**

```json
{ "name": "Chaos Arena", "status": "running", "version": "1.0.0" }
```

---

## 2. Automated Connection Test

We have provided a test script that simulates a player joining the arena and sending movement inputs.

### Setup

Install `colyseus.js` in the backend directory (only for testing):

```bash
npm install --save-dev colyseus.js
```

### Run Test

Run the automated test script:

```bash
npx ts-node tests/test_client.ts
```

---

## 3. Manual Testing Checklist

| Test Item         | Description                                            | Expected Result                                       |
| ----------------- | ------------------------------------------------------ | ----------------------------------------------------- |
| **Join Room**     | Connect to `ws://localhost:3000` and join `arena_room` | Server logs `✅ Player_xxxx joined`                   |
| **State Sync**    | Connect two clients                                    | Both clients receive `GameState` with 2 players       |
| **Movement**      | Send `{ dx: 1, dy: 0 }`                                | Player `x` position increases in the next state patch |
| **Countdown**     | Connect 2 players                                      | Server logs `⏳ Countdown starting...`                |
| **Match Start**   | Wait 3 seconds                                         | Server logs `🚀 Match started!`                       |
| **Elimination**   | Move a player out of bounds (x > 820 or x < -20)       | Server logs `💀 Player eliminated!`                   |
| **Win Condition** | One player left alive                                  | Server logs `🏆 Player x wins!`                       |

---

## 4. Troubleshooting

- **Port Conflict:** Ensure no other process is using port `3000`.
- **TypeScript Errors:** Run `npx tsc --noEmit` to check for compilation issues.
- **WebSocket Connection Refused:** Ensure the server is running (`npm run dev`).
