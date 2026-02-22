import { Room, Client, matchMaker } from "colyseus";
import { RoomComms } from "../../../ai/roomComms";
import { GameState } from "../schemas/GameState";
import { PlayerState } from "../schemas/PlayerState";
import { ItemState } from "../schemas/GrassState";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_SPEED,
  MAX_VELOCITY,
  SPAWN_MARGIN,
  MATCH_COUNTDOWN,
  MATCH_RESET_DELAY,
  TICK_RATE,
  MATCH_DURATION,
  TILE_SIZE,
  COLS,
  ROWS,
  PLAYER_RADIUS,
  BOMB_STUN_DURATION,
  ROCKET_STUN_DURATION,
  SPEED_BOOST_DURATION,
  SPEED_BOOST_MULTIPLIER,
  NUM_BOMBS,
  NUM_ROCKETS,
  NUM_BOOSTERS,
} from "../utils/constants";
import {
  saveMatchResult,
  savePlayerStats,
  updatePlayerName,
} from "../../../db/matchHistory";

// ─── Message types from the client ───────────────────────
interface MoveInput {
  dx: number; // -1, 0, or 1
  dy: number; // -1, 0, or 1
}

interface JoinOptions {
  displayName?: string;
}

export class GameRoom extends Room<GameState> {
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private resetTimeout: ReturnType<typeof setTimeout> | null = null;
  private playerCutTimers: Map<string, Map<string, number>> = new Map();
  private comms!: RoomComms;

  // ───── Room lifecycle ────────────────────────────────────

  private _emptyRoomTimeout: ReturnType<typeof setTimeout> | null = null;

  async onCreate(options: any) {
    if (options.customRoomId) {
      this.roomId = options.customRoomId;
    }
    this.state = new GameState();
    this.maxClients = MAX_PLAYERS;

    // Prevent auto-dispose so clients have time to join after transition
    this.autoDispose = false;

    // For transition rooms, don't lock immediately - allows joinById to work
    // The matchmaker won't find it via joinOrCreate because it uses a customId
    // and we only broadcast the ID to specific players anyway.
    if (options.isTransitionRoom) {
      // this.lock(); // REMOVED: joinById respects the lock in some setups
    }

    // If nobody joins within 15 seconds, dispose manually
    this._emptyRoomTimeout = setTimeout(() => {
      if (this.state.players.size === 0) {
        console.log(`🏟️ No players joined ${this.roomId}, disposing.`);
        this.disconnect();
      }
    }, 15000);

    // Set arena boundaries on state
    this.state.arenaBoundaryX = ARENA_WIDTH;
    this.state.arenaBoundaryY = ARENA_HEIGHT;

    // Register message handlers
    this.onMessage("move", (client: Client, data: MoveInput) => {
      this.handleMove(client, data);
    });

    this.onMessage("updateName", async (client: Client, name: string) => {
      const player = this.state.players.get(client.sessionId);
      if (player && name && name.length <= 15) {
        player.displayName = name;
        console.log(`👤 Name update: ${name} (${client.sessionId})`);

        if (player.playerId) {
          await updatePlayerName(player.playerId, name);
        }
      }
    });

    this.onMessage("ready", (client: Client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || this.state.matchStarted) return;
      player.isReady = !player.isReady;
      const status = player.isReady ? "✅ READY" : "⏳ NOT READY";
      console.log(`${status}: ${player.displayName}`);
      this.tryStartCountdown();
    });

    // Set up the authoritative simulation loop
    this.setSimulationInterval((deltaTime: number) => {
      this.update(deltaTime);
    }, 1000 / TICK_RATE);

    // AI Game-Master & communication hub
    this.comms = new RoomComms(this, "grass");

    console.log(`🏟️  GameRoom created | Room ID: ${this.roomId}`);
  }

  onJoin(client: Client, options: any) {
    console.log(`🏟️ Client joining ${this.roomId}:`, JSON.stringify(options));
    // Cancel auto-dispose since someone joined
    if (this._emptyRoomTimeout) {
      clearTimeout(this._emptyRoomTimeout);
      this._emptyRoomTimeout = null;
    }

    const player = new PlayerState();

    // Random spawn position within safe margin
    player.x = SPAWN_MARGIN + Math.random() * (ARENA_WIDTH - 2 * SPAWN_MARGIN);
    player.y = SPAWN_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * SPAWN_MARGIN);
    // Carry over score from previous game so the leaderboard stays cumulative
    player.score = options?.previousScore ?? 0;
    player.displayName =
      options?.displayName || `Player_${client.sessionId.slice(0, 4)}`;
    player.playerId = options?.playerId || client.sessionId;

    const colors = [
      "#ef4444",
      "#3b82f6",
      "#22c55e",
      "#eab308",
      "#a855f7",
      "#ec4899",
      "#14b8a6",
      "#f97316",
    ];
    player.color =
      options?.color || colors[this.state.players.size % colors.length];

    this.state.players.set(client.sessionId, player);

    // First player becomes the room owner
    if (this.state.players.size === 1) {
      this.state.ownerId = client.sessionId;
    }

    console.log(
      `✅ ${player.displayName} joined | ` +
        `Session: ${client.sessionId} | ` +
        `Players: ${this.state.players.size}/${MAX_PLAYERS}`,
    );
    // No auto-start — wait for all players to send "ready"
  }

  onLeave(client: Client, _consented?: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    this.comms.onClientLeave(client.sessionId);
    console.log(`❌ ${player.displayName} left | Session: ${client.sessionId}`);

    this.state.players.delete(client.sessionId);

    // If a game in progress is left with only 1 player, it's forfeit
    if (this.state.matchStarted && !this.state.matchEnded) {
      if (this.state.players.size < MIN_PLAYERS) {
        this.endMatch();
      }
    }

    // ZOMBIE CLEANUP: If the room is now empty, ensure it disposes after 10 seconds.
    // This is necessary because autoDispose is set to false in onCreate.
    if (this.state.players.size === 0) {
      this.resetEmptyRoomTimeout();
    }
  }

  private resetEmptyRoomTimeout() {
    if (this._emptyRoomTimeout) clearTimeout(this._emptyRoomTimeout);
    this._emptyRoomTimeout = setTimeout(() => {
      if (this.state.players.size === 0) {
        console.log(`🏟️ Emergency disposing empty room ${this.roomId}`);
        this.disconnect();
      }
    }, 15000); // Wait 15s to allow for transitions or rejoin
  }

  onDispose() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.resetTimeout) clearTimeout(this.resetTimeout);
    if (this._emptyRoomTimeout) clearTimeout(this._emptyRoomTimeout);
    console.log(`���️  GameRoom disposed | Room ID: ${this.roomId}`);
  }

  // ───── Message handlers ──────────────────────────────────

  private handleMove(client: Client, data: MoveInput) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.state.matchStarted || this.state.matchEnded) return;
    if (player.stunTimer > 0) return; // Cannot move while stunned

    const dx = Math.sign(data.dx || 0);
    const dy = Math.sign(data.dy || 0);

    player.velocityX = dx * PLAYER_SPEED * player.speedMultiplier;
    player.velocityY = dy * PLAYER_SPEED * player.speedMultiplier;
  }

  // ───── Simulation tick ───────────────────────────────────

  private update(deltaTime: number) {
    const dt = deltaTime / 1000; // ms → seconds

    // AI Game-Master tick
    if (this.state.matchStarted && !this.state.matchEnded) {
      this.comms.tick(deltaTime);
    }

    if (!this.state.matchStarted || this.state.matchEnded) return;

    // Update match timer
    this.state.matchTimer -= dt;
    if (this.state.matchTimer <= 0) {
      this.state.matchTimer = 0;
      this.endMatch();
      return;
    }

    // ── Process players ──
    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      // Update timers
      if (player.stunTimer > 0) {
        player.stunTimer -= dt;
        if (player.stunTimer <= 0) {
          player.stunTimer = 0;
        }
      }

      if (player.stunTimer <= 0) {
        // Apply velocity to position
        player.x += player.velocityX * dt;
        player.y += player.velocityY * dt;

        // Clamp velocity magnitude
        const speed = Math.sqrt(
          player.velocityX * player.velocityX +
            player.velocityY * player.velocityY,
        );
        if (speed > MAX_VELOCITY * player.speedMultiplier) {
          const scale = (MAX_VELOCITY * player.speedMultiplier) / speed;
          player.velocityX *= scale;
          player.velocityY *= scale;
        }

        // Friction
        player.velocityX *= 0.9;
        player.velocityY *= 0.9;
        if (Math.abs(player.velocityX) < 1) player.velocityX = 0;
        if (Math.abs(player.velocityY) < 1) player.velocityY = 0;

        // Clamp position to arena
        player.x = Math.max(0, Math.min(this.state.arenaBoundaryX, player.x));
        player.y = Math.max(0, Math.min(this.state.arenaBoundaryY, player.y));
      }

      // ── Check Grass Collection ──
      const c = Math.floor(player.x / TILE_SIZE);
      const r = Math.floor(player.y / TILE_SIZE);
      if (r >= 0 && r < ROWS && c >= 0 && c < COLS) {
        const idx = r * COLS + c;
        const tileVal = this.state.grid[idx];
        if (tileVal > 0) {
          const key = `${r},${c}`;
          const playerTimers = this.playerCutTimers.get(sessionId);
          const lastCut = playerTimers?.get(key) || 0;
          const now = Date.now();
          if (now - lastCut > 500) {
            this.state.grid[idx]--;
            playerTimers?.set(key, now);

            // Big grass just cut (2→1): reveal any hidden items at this tile
            if (tileVal === 2 && this.state.grid[idx] === 1) {
              this.triggerHiddenItems(sessionId, player, r, c);
            }

            if (this.state.grid[idx] === 0) {
              player.score += 10;

              if (player.score % 50 === 0 && player.score > 0) {
                this.comms.addEvent(
                  `${player.displayName} hits ${player.score} points!`,
                );
              }
            }
          }
        }
      }

      // ── Check Revealed Item Collection (boosters & rockets) ──
      for (let i = this.state.items.length - 1; i >= 0; i--) {
        const item = this.state.items[i];
        if (!item.active || !item.revealed || item.type === "bomb") continue;

        const dx = player.x - item.x;
        const dy = player.y - item.y;
        if (Math.sqrt(dx * dx + dy * dy) < PLAYER_RADIUS + TILE_SIZE / 2) {
          item.active = false;

          if (item.type === "booster") {
            player.speedMultiplier = SPEED_BOOST_MULTIPLIER;
            this.comms.addEvent(
              `⚡ ${player.displayName} grabbed speed boost!`,
            );
            this.broadcast("booster_collected", {
              x: item.x,
              y: item.y,
              playerId: sessionId,
              playerName: player.displayName,
            });
            setTimeout(() => {
              if (this.state.players.has(sessionId)) {
                this.state.players.get(sessionId)!.speedMultiplier = 1;
              }
            }, SPEED_BOOST_DURATION * 1000);
          } else if (item.type === "rocket") {
            // Stun ALL other players
            this.state.players.forEach((p, id) => {
              if (id !== sessionId) {
                p.stunTimer = ROCKET_STUN_DURATION;
              }
            });
            this.comms.addEvent(
              `🚀 ${player.displayName} launched a ROCKET!`,
            );
            this.broadcast("rocket_launched", {
              x: item.x,
              y: item.y,
              launcherId: sessionId,
              launcherName: player.displayName,
            });
          }
        }
      }
    });

    // Check if all grass collected
    let grassLeft = false;
    for (let i = 0; i < this.state.grid.length; i++) {
      if (this.state.grid[i] > 0) {
        grassLeft = true;
        break;
      }
    }
    if (!grassLeft) {
      this.endMatch();
    }
  }

  // ───── Game logic helpers ────────────────────────────────

  /** When a grass tile is fully cleared, trigger any hidden item at that cell */
  private triggerHiddenItems(
    sessionId: string,
    player: PlayerState,
    r: number,
    c: number,
  ) {
    for (let i = 0; i < this.state.items.length; i++) {
      const item = this.state.items[i];
      if (!item.active || item.revealed) continue;

      const itemC = Math.floor(item.x / TILE_SIZE);
      const itemR = Math.floor(item.y / TILE_SIZE);
      if (itemC !== c || itemR !== r) continue;

      if (item.type === "bomb") {
        // INSTANT explosion — stuns the player who uncovered it
        player.stunTimer = BOMB_STUN_DURATION;
        player.score = Math.max(0, player.score - 5);
        item.revealed = true;
        item.active = false;
        this.broadcast("bomb_explode", {
          x: item.x,
          y: item.y,
          victimId: sessionId,
          victimName: player.displayName,
        });
        this.comms.addEvent(
          `💣 ${player.displayName} uncovered a bomb! Stunned!`,
        );
      } else {
        // Booster or Rocket — pop out of the grass, must be collected separately
        item.revealed = true;
        this.broadcast("item_pop", {
          id: item.id,
          type: item.type,
          x: item.x,
          y: item.y,
        });
      }
    }
  }

  private tryStartCountdown() {
    if (this.state.matchStarted || this.countdownInterval) return;
    if (this.state.players.size < MIN_PLAYERS) return;

    // All players must have clicked Ready
    let allReady = true;
    this.state.players.forEach((p) => {
      if (!p.isReady) allReady = false;
    });
    if (!allReady) return;

    console.log(`⏳ All players ready — countdown starting...`);
    this.state.countdown = MATCH_COUNTDOWN;

    this.countdownInterval = setInterval(() => {
      this.state.countdown--;
      console.log(`⏳ ${this.state.countdown}...`);

      if (this.state.countdown <= 0) {
        if (this.countdownInterval) {
          clearInterval(this.countdownInterval);
          this.countdownInterval = null;
        }
        this.startMatch();
      }
    }, 1000);
  }

  private startMatch() {
    this.state.matchStarted = true;
    this.state.matchEnded = false;
    this.state.matchTimer = MATCH_DURATION;
    this.state.winnerId = "";
    this.state.lastEvent = "Match Started!";

    // Reset arena boundaries
    this.state.arenaBoundaryX = ARENA_WIDTH;
    this.state.arenaBoundaryY = ARENA_HEIGHT;

    // Initialize Grid
    this.state.grid.clear();
    for (let i = 0; i < ROWS * COLS; i++) {
      this.state.grid.push(2); // 2 = full grass
    }

    // Spawn exactly 8 bombs, 8 rockets, 8 speed boosters at random unique tiles
    this.state.items.clear();
    const allTiles: { r: number; c: number }[] = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        allTiles.push({ r, c });
      }
    }
    // Fisher-Yates shuffle
    for (let i = allTiles.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allTiles[i], allTiles[j]] = [allTiles[j], allTiles[i]];
    }
    const itemDefs: { type: string; count: number }[] = [
      { type: "bomb", count: NUM_BOMBS },
      { type: "rocket", count: NUM_ROCKETS },
      { type: "booster", count: NUM_BOOSTERS },
    ];
    let tileIdx = 0;
    for (const def of itemDefs) {
      for (let n = 0; n < def.count && tileIdx < allTiles.length; n++) {
        const { r, c } = allTiles[tileIdx++];
        const item = new ItemState();
        item.id = `item_${r}_${c}`;
        item.x = c * TILE_SIZE + TILE_SIZE / 2;
        item.y = r * TILE_SIZE + TILE_SIZE / 2;
        item.type = def.type;
        item.revealed = false;
        item.active = true;
        item.timer = 0;
        this.state.items.push(item);
      }
    }

    this.playerCutTimers.clear();

    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      // score is NOT reset here — it carries over from previousScore set in onJoin
      player.speedMultiplier = 1;
      player.stunTimer = 0;
      player.velocityX = 0;
      player.velocityY = 0;
      player.x =
        SPAWN_MARGIN + Math.random() * (ARENA_WIDTH - 2 * SPAWN_MARGIN);
      player.y =
        SPAWN_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * SPAWN_MARGIN);
      this.playerCutTimers.set(sessionId, new Map());
    });

    console.log(
      `��� Match started! ${this.state.players.size} players in the arena.`,
    );
    this.broadcast("match_start", { playerCount: this.state.players.size });
  }

  private endMatch() {
    this.state.matchEnded = true;

    // Lock so the matchmaker won't route Quick Connect players into this finished room
    this.lock();

    let winnerId = "";
    let winnerName = "";
    let maxScore = -1;
    let isDraw = false;

    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      if (player.score > maxScore) {
        maxScore = player.score;
        winnerId = sessionId;
        winnerName = player.displayName;
        isDraw = false;
      } else if (player.score === maxScore) {
        isDraw = true;
      }
    });

    if (isDraw) {
      winnerId = "";
      winnerName = "Nobody";
    }

    this.state.winnerId = winnerId;

    console.log(
      isDraw
        ? `��� Draw — multiple players tied with ${maxScore} grass!`
        : `��� ${winnerName} wins with ${maxScore} grass!`,
    );

    this.broadcast("match_end", {
      winnerId,
      winnerName,
      maxScore,
      isDraw,
    });

    const playerStatsToSave: {
      id: string;
      displayName: string;
      isWinner: boolean;
      score: number;
    }[] = [];
    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      playerStatsToSave.push({
        id: player.playerId || sessionId,
        displayName: player.displayName,
        isWinner: !isDraw && sessionId === winnerId,
        score: player.score,
      });
    });

    savePlayerStats(playerStatsToSave).catch((err) =>
      console.warn(`⚠️  Failed to save player stats: ${err.message}`),
    );

    // Persist match result to database (async, non-blocking)
    saveMatchResult({
      roomId: this.roomId,
      winnerId,
      winnerName,
      playerCount: this.state.players.size,
      matchDuration: MATCH_DURATION - this.state.matchTimer,
      isDraw,
    }).catch((err) => console.warn(`⚠️  Failed to save match: ${err.message}`));

    // Auto-reset room after delay
    this.resetTimeout = setTimeout(async () => {
      try {
        const nextRoomId = this.roomId + "_rd";
        await matchMaker.createRoom("red_dynamite_room", {
          customRoomId: nextRoomId,
          isTransitionRoom: true,
        });
        this.broadcast("next_game", {
          roomId: nextRoomId,
          roomName: "red_dynamite_room",
        });
      } catch (e) {
        console.error("Failed to create next room", e);
        this.resetMatch();
      }
    }, MATCH_RESET_DELAY);
  }

  /** Reset the room for a new match */
  private resetMatch() {
    this.state.matchStarted = false;
    this.state.matchEnded = false;
    this.state.matchTimer = MATCH_DURATION;
    this.state.winnerId = "";
    this.state.countdown = 0;
    this.state.lastEvent = "";

    // Clear grid and items
    this.state.grid.clear();
    this.state.items.clear();

    this.state.players.forEach((player: PlayerState) => {
      player.score = 0;
      player.speedMultiplier = 1;
      player.stunTimer = 0;
      player.velocityX = 0;
      player.velocityY = 0;
      player.isReady = false;
      player.x =
        SPAWN_MARGIN + Math.random() * (ARENA_WIDTH - 2 * SPAWN_MARGIN);
      player.y =
        SPAWN_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * SPAWN_MARGIN);
    });

    console.log(`��� Room reset. ${this.state.players.size} players ready.`);
    this.broadcast("match_reset", { playerCount: this.state.players.size });

    // Start new countdown if enough players
    this.tryStartCountdown();
  }
}
