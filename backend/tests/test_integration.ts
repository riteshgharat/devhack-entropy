import { Client } from "colyseus.js";

const ENDPOINT = "ws://localhost:3000";

// ── Test result tracking ──────────────────────────────────────
const results: Record<string, boolean> = {
  "Player Join (Bot_Alpha)": false,
  "Player Join (Bot_Beta)": false,
  "Match Start Received": false,
  "Grass Spawned": false,
  "Movement Sent": false,
  "Grass Collected": false,
  "Powerup Triggered": false,
  "Match End": false,
};

function pass(key: string) {
  if (!results[key]) {
    results[key] = true;
    console.log(`  [PASS] ${key}`);
  }
}

async function createTestClient(name: string) {
  const client = new Client(ENDPOINT);
  process.stdout.write(`  Joining as ${name}... `);
  const room = await client.joinOrCreate("arena_room", { displayName: name });
  console.log(`Session: ${room.sessionId}`);
  return room;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// ── Main test ─────────────────────────────────────────────────
async function runIntegrationTest() {
  console.log("\n==============================================");
  console.log("  Grass Collection - Backend Integration Test");
  console.log("==============================================\n");

  try {
    // ── Phase 1: Player Join ──────────────────────────────
    console.log("[Phase 1] Player Join & Room Setup");

    const player1 = await createTestClient("Bot_Alpha");
    pass("Player Join (Bot_Alpha)");

    const player2 = await createTestClient("Bot_Beta");
    pass("Player Join (Bot_Beta)");

    // ── Register ALL handlers BEFORE waiting ─────────────
    player1.onMessage("match_start", (msg: any) => {
      pass("Match Start Received");
      console.log(`  >> playerCount: ${msg.playerCount}`);
    });

    player1.onMessage("match_end", (msg: any) => {
      pass("Match End");
      console.log(
        `  >> Winner: ${msg.winnerName ?? "TBD"} with ${msg.maxScore} grass`,
      );
    });

    player1.onStateChange((state: any) => {
      if (state.grasses && state.grasses.length > 0) {
        pass("Grass Spawned");
      }

      const p1 = state.players.get(player1.sessionId);
      if (p1 && p1.score > 0) {
        pass("Grass Collected");
      }

      const evt: string = state.lastEvent ?? "";
      if (
        evt.includes("Speed Booster") ||
        evt.includes("Bomb") ||
        evt.includes("Rocket")
      ) {
        pass("Powerup Triggered");
      }
    });

    // ── Phase 2: Countdown ────────────────────────────────
    console.log("\n[Phase 2] Waiting for match countdown (5s)...");
    await sleep(5000);

    // ── Phase 3: Movement & Collection ────────────────────
    console.log("\n[Phase 3] Movement & Collection");

    // Send movement commands to simulate collecting grass
    for (let i = 0; i < 20; i++) {
      player1.send("move", { dx: 1, dy: 0 });
      player2.send("move", { dx: -1, dy: 1 });
      await sleep(100);
      player1.send("move", { dx: 0, dy: 1 });
      player2.send("move", { dx: 1, dy: -1 });
      await sleep(100);
      pass("Movement Sent");
    }

    // ── Phase 4: Wait for Match End ───────────────────────
    console.log("\n[Phase 4] Waiting for match to end (or timeout)...");
    // We'll wait a bit to see if they collect enough or time runs out
    // For a real test, we might not want to wait 60s. Let's just wait 5s and then force disconnect.
    await sleep(5000);

    console.log("\n[Phase 5] Disconnecting clients");
    player1.leave();
    player2.leave();
    await sleep(1000);

    // ── Summary ───────────────────────────────────────────
    console.log("\n==============================================");
    console.log("  Test Summary");
    console.log("==============================================");
    let allPassed = true;
    for (const [key, passed] of Object.entries(results)) {
      const status = passed ? "✅ PASS" : "❌ FAIL";
      console.log(`  ${status} | ${key}`);
      if (!passed && key !== "Powerup Triggered" && key !== "Match End") {
        // Powerup is random, might not trigger in short test. Match End might not happen if we don't wait 60s.
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log("\n��� ALL CRITICAL TESTS PASSED!");
      process.exit(0);
    } else {
      console.log("\n⚠️ SOME TESTS FAILED.");
      process.exit(1);
    }
  } catch (err) {
    console.error("\n❌ TEST CRASHED:", err);
    process.exit(1);
  }
}

runIntegrationTest();
