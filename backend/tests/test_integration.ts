import { Client } from "colyseus.js";

const ENDPOINT = "ws://localhost:3000";

// ── Test result tracking ──────────────────────────────────────
const results: Record<string, boolean> = {
    "Player Join (Bot_Alpha)":       false,
    "Player Join (Bot_Beta)":        false,
    "Match Start Received":          false,
    "Leader Detected":               false,
    "Mutation: spawn_falling_block": false,
    "Mutation: shrink_boundary":     false,
    "Mutation: rotate_obstacle":     false,
    "Mutation: speed_modifier":      false,
    "Mutation: target_player_trap":  false,
    "Movement Sent":                 false,
    "Elimination / Match End":       false,
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

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// ── Main test ─────────────────────────────────────────────────
async function runIntegrationTest() {
    console.log("\n==============================================");
    console.log("  Chaos Arena - Backend Integration Test");
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
            pass("Elimination / Match End");
            console.log(`  >> Winner: ${msg.winner ?? "TBD"}`);
        });

        player1.onStateChange((state: any) => {
            // Leader detection
            if (state.leaderId) {
                const leader = state.players.get(state.leaderId);
                if (leader) pass("Leader Detected");
            }
            // Mutation detection via lastArenaEvent
            const evt: string = state.lastArenaEvent ?? "";
            if (evt.includes("block"))    pass("Mutation: spawn_falling_block");
            if (evt.includes("boundary")) pass("Mutation: shrink_boundary");
            if (evt.includes("rotate"))   pass("Mutation: rotate_obstacle");
            if (evt.includes("speed"))    pass("Mutation: speed_modifier");
            if (evt.includes("trap"))     pass("Mutation: target_player_trap");
        });

        // ── Phase 2: Countdown ────────────────────────────────
        console.log("\n[Phase 2] Waiting for match countdown (5s)...");
        await sleep(5000);

        // ── Phase 3: Arena Mutations ──────────────────────────
        console.log("\n[Phase 3] Arena Mutations");

        const mutations = [
            "spawn_falling_block",
            "shrink_boundary",
            "rotate_obstacle",
            "speed_modifier",
        ] as const;

        for (const mutation of mutations) {
            console.log(`  -> ${mutation}`);
            player1.send("arena_mutation", { mutation });
            await sleep(1200);
        }

        console.log("  -> target_player_trap (targeting Bot_Beta)");
        player1.send("arena_mutation", { mutation: "target_player_trap", targetSessionId: player2.sessionId });
        await sleep(1200);

        // ── Phase 4: Movement ─────────────────────────────────
        console.log("\n[Phase 4] Movement");
        for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
            player1.send("move", { dx, dy });
        }
        pass("Movement Sent");
        await sleep(1000);        // ── Phase 5: Elimination ──────────────────────────────
        console.log("\n[Phase 5] Forcing Bot_Beta out-of-bounds...");
        for (let i = 0; i < 60; i++) {
            player2.send("move", { dx: -1, dy: -1 });
        }
        await sleep(3000);

        // ── Summary ───────────────────────────────────────────
        console.log("\n==============================================");
        console.log("  Test Summary");
        console.log("==============================================");

        let passed = 0;
        const total = Object.keys(results).length;
        for (const [name, ok] of Object.entries(results)) {
            console.log(`  ${ok ? "[PASS]" : "[FAIL]"} ${name}`);
            if (ok) passed++;
        }

        console.log("----------------------------------------------");
        console.log(`  Result: ${passed}/${total} checks passed`);
        console.log("==============================================\n");

        player1.leave();
        player2.leave();
        process.exit(passed === total ? 0 : 1);

    } catch (e) {
        console.error("\n[ERROR] Fatal:", e);
        process.exit(1);
    }
}

runIntegrationTest();
