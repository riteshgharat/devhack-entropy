import { Client } from "colyseus.js";

async function runTest() {
    console.log("🚀 Starting Chaos Arena Test Client...");
    
    const client = new Client("ws://localhost:3000");

    try {
        console.log("🔗 Connecting to arena_room...");
        const room = await client.joinOrCreate("arena_room", {
            displayName: "TestBot_" + Math.floor(Math.random() * 1000)
        });

        console.log(`✅ Joined successfully! Room ID: ${room.id} | Session ID: ${room.sessionId}`);

        // Listen for state changes
        room.onStateChange((state) => {
            const player = state.players.get(room.sessionId);
            if (player) {
                console.log(`📍 Position: (${player.x.toFixed(2)}, ${player.y.toFixed(2)}) | Alive: ${player.isAlive} | Survivors: ${state.aliveCount}`);
            }
        });

        // Listen for events
        room.onMessage("match_start", (message) => {
            console.log("🔥 MATCH STARTED!", message);
        });

        room.onMessage("player_eliminated", (message) => {
            console.log("💀 PLAYER ELIMINATED:", message);
        });

        room.onMessage("match_end", (message) => {
            console.log("🏆 MATCH ENDED:", message);
        });

        // Test Movement after 2 seconds
        setTimeout(() => {
            console.log("⌨️ Sending Move: RIGHT");
            room.send("move", { dx: 1, dy: 0 });
        }, 2000);

        // Test Movement after 4 seconds
        setTimeout(() => {
            console.log("⌨️ Sending Move: DOWN");
            room.send("move", { dx: 0, dy: 1 });
        }, 4000);

        // Keep alive for 15 seconds to witness countdown if another player joins
        setTimeout(() => {
            console.log("👋 Test complete. Leaving room.");
            room.leave();
            process.exit(0);
        }, 15000);

    } catch (e) {
        console.error("❌ Connection failed:", e);
        process.exit(1);
    }
}

runTest();
