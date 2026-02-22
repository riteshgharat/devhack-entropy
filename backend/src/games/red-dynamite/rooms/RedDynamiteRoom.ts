import { Room, Client } from "colyseus";
import { RoomComms } from "../../../ai/roomComms";
import { RedDynamiteState, PlayerState } from "../schemas/RedDynamiteState";
import { saveMatchResult, savePlayerStats } from "../../../db/matchHistory";

const TICK_RATE = 60;
const TIME_STEP = 1000 / TICK_RATE;

const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;
const CX = ARENA_WIDTH / 2;
const CY = ARENA_HEIGHT / 2;
const ISLAND_RADIUS = Math.min(CX, CY) * 0.85;
const PLAYER_SIZE = 32; // TILE_SIZE * 0.8

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const COUNTDOWN_SECONDS = 3;
const MATCH_DURATION = 60; // seconds - Game 2 duration
const MATCH_RESET_DELAY = 5000;

export class RedDynamiteRoom extends Room<RedDynamiteState> {
  private updateInterval!: NodeJS.Timeout;
  private countdownInterval?: NodeJS.Timeout;
  private resetTimeout?: NodeJS.Timeout;
  private _emptyRoomTimeout?: NodeJS.Timeout;
  private comms!: RoomComms;
  private dynamitePaused = false;
  private dynamitePauseTimer = 0;

  onCreate(options: any) {
    this.maxClients = MAX_PLAYERS;
    this.setState(new RedDynamiteState());

    // Prevent auto-dispose so clients have time to join after transition
    this.autoDispose = false;

    if (options.customRoomId) {
      this.roomId = options.customRoomId;
    }

    // For transition rooms, don't lock immediately - allows joinById to work
    if (options.isTransitionRoom) {
      // this.lock(); // REMOVED
    }

    // If nobody joins within 15 seconds, dispose manually
    this._emptyRoomTimeout = setTimeout(() => {
      if (this.state.players.size === 0) {
        console.log(`🧨 No players joined ${this.roomId}, disposing.`);
        this.disconnect();
      }
    }, 15000);

    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && player.isAlive && this.state.roundState === "playing") {
        player.velocityX = data.dx || 0;
        player.velocityY = data.dy || 0;
      }
    });

    this.onMessage("updateName", (client, name: string) => {
      const player = this.state.players.get(client.sessionId);
      if (player && name && name.length <= 15) {
        player.displayName = name;
        console.log(
          `👤 Name update (RedDynamite): ${name} (${client.sessionId})`,
        );
      }
    });

    this.setSimulationInterval(
      (deltaTime) => this.update(deltaTime),
      TIME_STEP,
    );

    // AI Game-Master & communication hub
    this.comms = new RoomComms(this, "red_dynamite");

    console.log(`🧨 Red Dynamite Room created: ${this.roomId}`);
  }

  onJoin(client: Client, options: any) {
    // Cancel auto-dispose since someone joined
    if (this._emptyRoomTimeout) {
      clearTimeout(this._emptyRoomTimeout);
      this._emptyRoomTimeout = undefined;
    }
    console.log(`🧨 Client joined: ${client.sessionId}`);

    const player = new PlayerState();
    player.playerId = options.playerId || client.sessionId;
    player.displayName =
      options.displayName || `Player_${Math.floor(Math.random() * 1000)}`;
    player.color = options.color || "#ef4444";
    // Carry over score from previous game so the leaderboard stays cumulative
    player.score = options?.previousScore ?? 0;

    // Spawn in a circle
    const angle =
      (this.state.players.size / MAX_PLAYERS) * Math.PI * 2 + Math.PI / 4;
    const spawnRadius = ISLAND_RADIUS * 0.7;
    player.x = CX + Math.cos(angle) * spawnRadius;
    player.y = CY + Math.sin(angle) * spawnRadius;

    this.state.players.set(client.sessionId, player);

    this.tryStartCountdown();
  }

  onLeave(client: Client, consented: boolean) {
    console.log(`🧨 Client left: ${client.sessionId}`);
    this.comms.onClientLeave(client.sessionId);

    this.state.players.delete(client.sessionId);

    if (this.state.players.size < MIN_PLAYERS) {
      this.cancelCountdown();
      if (this.state.matchStarted && !this.state.matchEnded) {
        this.endMatch();
      }
    }

    // ZOMBIE CLEANUP: If the room is now empty, ensure it disposes after 15 seconds.
    if (this.state.players.size === 0) {
      this.resetEmptyRoomTimeout();
    }
  }

  private resetEmptyRoomTimeout() {
    if (this._emptyRoomTimeout) clearTimeout(this._emptyRoomTimeout);
    this._emptyRoomTimeout = setTimeout(() => {
      if (this.state.players.size === 0) {
        console.log(`🧨 Emergency disposing empty room ${this.roomId}`);
        this.disconnect();
      }
    }, 15000); // 15s to allow transitions
  }

  onDispose() {
    console.log(`🧨 Room disposed: ${this.roomId}`);
    clearInterval(this.updateInterval);
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.resetTimeout) clearTimeout(this.resetTimeout);
    if (this._emptyRoomTimeout) clearTimeout(this._emptyRoomTimeout);
  }

  private tryStartCountdown() {
    if (
      this.state.players.size >= MIN_PLAYERS &&
      !this.state.matchStarted &&
      this.state.countdown === 0
    ) {
      this.state.countdown = COUNTDOWN_SECONDS;
      console.log(`🧨 Starting countdown: ${this.state.countdown}`);

      this.countdownInterval = setInterval(() => {
        this.state.countdown--;
        if (this.state.countdown <= 0) {
          clearInterval(this.countdownInterval);
          this.startMatch();
        }
      }, 1000);
    }
  }

  private cancelCountdown() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = undefined;
      this.state.countdown = 0;
      console.log("🧨 Countdown cancelled (not enough players).");
    }
  }

  private startMatch() {
    this.state.matchStarted = true;
    this.state.matchEnded = false;
    this.state.winnerId = "";
    this.state.maxTimer = 15;
    this.state.matchTimer = MATCH_DURATION; // Initialize 60s match timer

    this.state.players.forEach((player) => {
      player.isAlive = true;
      player.hasDynamite = false;
      player.passCooldown = 0;
      // score is NOT reset here — it carries over from previousScore set in onJoin
      player.velocityX = 0;
      player.velocityY = 0;

      // Respawn in circle
      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = ISLAND_RADIUS * 0.7;
      player.x = CX + Math.cos(angle) * spawnRadius;
      player.y = CY + Math.sin(angle) * spawnRadius;
    });

    this.startRound();
    console.log(
      `🧨 Match started! ${this.state.players.size} players in the arena.`,
    );
    this.broadcast("match_start", { playerCount: this.state.players.size });
  }

  private startRound() {
    const alivePlayers = Array.from(this.state.players.values()).filter(
      (p) => p.isAlive,
    );

    if (alivePlayers.length <= 1) {
      this.endMatch();
      return;
    }

    alivePlayers.forEach((p) => {
      p.hasDynamite = false;
      p.passCooldown = 1.0; // 1 second cooldown at start of round
    });

    const randomPlayer =
      alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    randomPlayer.hasDynamite = true;

    this.state.currentDynamiteTimer = this.state.maxTimer;
    this.state.roundState = "playing";
  }

  private triggerExplosion() {
    this.state.roundState = "explosionDelay";
    this.state.roundDelay = 2.0; // 2 seconds delay

    let holderId = "";
    let holderName = "";
    this.state.players.forEach((player, sessionId) => {
      if (player.hasDynamite && player.isAlive) {
        player.isAlive = false;
        player.hasDynamite = false;
        holderId = sessionId;
        holderName = player.displayName;
      } else if (player.isAlive) {
        player.score += 10; // Points for surviving a round
      }
    });

    if (holderName) {
      this.comms.addEvent(`💥 ${holderName} EXPLODED holding the dynamite!`);
    }

    this.broadcast("explosion", { holderId });

    // Make next round faster
    const oldTimer = this.state.maxTimer;
    this.state.maxTimer = Math.max(5, this.state.maxTimer - 3);
    if (this.state.maxTimer < oldTimer) {
      this.comms.addEvent(
        `Timer speeds up! Now only ${this.state.maxTimer.toFixed(0)}s`,
      );
    }
  }

  private update(deltaTime: number) {
    // AI Game-Master tick
    if (this.state.matchStarted && !this.state.matchEnded) {
      this.comms.tick(deltaTime);

      // Apply AI arena events dynamically
      const aiOutput = this.comms.getLatestOutput();
      if (aiOutput?.arenaEvent) {
        const event = aiOutput.arenaEvent;
        if (event.type === "slow_mo" && !this.dynamitePaused) {
          this.dynamitePaused = true;
          this.dynamitePauseTimer = 5; // Pause for 5 seconds
          this.comms.addEvent("⏸️ DYNAMITE PAUSED! 5 second breather!");
        }
      }
    }

    if (!this.state.matchStarted || this.state.matchEnded) return;

    const dt = deltaTime / 1000;

    // Decrement match timer
    this.state.matchTimer -= dt;
    if (this.state.matchTimer <= 0) {
      this.state.matchTimer = 0;
      this.endMatch();
      return;
    }

    // Handle dynamite pause timer
    if (this.dynamitePaused) {
      this.dynamitePauseTimer -= dt;
      if (this.dynamitePauseTimer <= 0) {
        this.dynamitePaused = false;
        this.comms.addEvent("▶️ DYNAMITE ACTIVE AGAIN!");
      }
    }

    if (this.state.roundState === "playing") {
      // Only decrement timer if dynamite is not paused
      if (!this.dynamitePaused) {
        this.state.currentDynamiteTimer -= dt;
      }

      if (this.state.currentDynamiteTimer <= 0) {
        this.triggerExplosion();
      }

      // Update players
      const playersArray = Array.from(this.state.players.entries());

      playersArray.forEach(([id, player]) => {
        if (!player.isAlive) return;

        if (player.passCooldown > 0) {
          player.passCooldown -= dt;
        }

        const baseSpeed = 230;
        const currentSpeed = baseSpeed * (player.hasDynamite ? 1.2 : 1.0);

        let mag = Math.sqrt(
          player.velocityX * player.velocityX +
            player.velocityY * player.velocityY,
        );
        let vx = 0;
        let vy = 0;

        if (mag > 0) {
          vx = (player.velocityX / mag) * currentSpeed;
          vy = (player.velocityY / mag) * currentSpeed;
        }

        player.x += vx * dt;
        player.y += vy * dt;

        // Island Boundary Collision
        const distToCenter = Math.hypot(player.x - CX, player.y - CY);
        if (distToCenter > ISLAND_RADIUS - PLAYER_SIZE / 2) {
          const angle = Math.atan2(player.y - CY, player.x - CX);
          player.x = CX + Math.cos(angle) * (ISLAND_RADIUS - PLAYER_SIZE / 2);
          player.y = CY + Math.sin(angle) * (ISLAND_RADIUS - PLAYER_SIZE / 2);
        }
      });

      // Player-Player Collisions (Pass Dynamite & Push)
      for (let i = 0; i < playersArray.length; i++) {
        for (let j = i + 1; j < playersArray.length; j++) {
          const [id1, p1] = playersArray[i];
          const [id2, p2] = playersArray[j];

          if (!p1.isAlive || !p2.isAlive) continue;

          let dx = p1.x - p2.x;
          let dy = p1.y - p2.y;
          let dist = Math.hypot(dx, dy);
          const minDist = PLAYER_SIZE; // size/2 + size/2

          if (dist < minDist) {
            // Pass dynamite
            if (
              p1.hasDynamite &&
              !p2.hasDynamite &&
              p1.passCooldown <= 0 &&
              p2.passCooldown <= 0
            ) {
              p1.hasDynamite = false;
              p2.hasDynamite = true;
              p1.passCooldown = 0.5;
              p2.passCooldown = 0.5;
              this.comms.addEvent(
                `${p1.displayName} passed dynamite to ${p2.displayName}`,
              );
              this.broadcast("dynamite_passed", { from: id1, to: id2 });
            } else if (
              p2.hasDynamite &&
              !p1.hasDynamite &&
              p1.passCooldown <= 0 &&
              p2.passCooldown <= 0
            ) {
              p2.hasDynamite = false;
              p1.hasDynamite = true;
              p1.passCooldown = 0.5;
              p2.passCooldown = 0.5;
              this.comms.addEvent(
                `${p2.displayName} passed dynamite to ${p1.displayName}`,
              );
              this.broadcast("dynamite_passed", { from: id2, to: id1 });
            }

            // Soft push apart
            if (dist === 0) {
              dx = 1;
              dy = 0;
              dist = 1;
            }
            const push = (minDist - dist) * 0.5;
            const px = (dx / dist) * push;
            const py = (dy / dist) * push;
            p1.x += px;
            p1.y += py;
            p2.x -= px;
            p2.y -= py;
          }
        }
      }
    } else if (this.state.roundState === "explosionDelay") {
      this.state.roundDelay -= dt;
      if (this.state.roundDelay <= 0) {
        this.startRound();
      }
    }
  }

  private endMatch() {
    this.state.matchEnded = true;
    this.state.roundState = "waiting";

    // Lock so the matchmaker won't route Quick Connect players into this finished room
    this.lock();

    let winnerId = "";
    let winnerName = "";
    let maxScore = -1;
    let isDraw = false;

    const alivePlayers = Array.from(this.state.players.entries()).filter(
      ([id, p]) => p.isAlive,
    );

    if (alivePlayers.length === 1) {
      winnerId = alivePlayers[0][0];
      winnerName = alivePlayers[0][1].displayName;
      alivePlayers[0][1].score += 50; // Bonus for winning
    } else if (alivePlayers.length === 0) {
      isDraw = true;
      winnerName = "Nobody";
    }

    this.state.players.forEach((player, sessionId) => {
      if (player.score > maxScore) {
        maxScore = player.score;
      }
    });

    this.state.winnerId = winnerId;

    console.log(
      isDraw ? `🧨 Draw — everyone blew up!` : `🧨 ${winnerName} wins!`,
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

    saveMatchResult({
      roomId: this.roomId,
      winnerId,
      winnerName,
      playerCount: this.state.players.size,
      matchDuration: 0, // We don't track total duration here easily, could add it
      isDraw,
    }).catch((err) => console.warn(`⚠️  Failed to save match: ${err.message}`));

    // Auto-reset room after delay
    this.resetTimeout = setTimeout(async () => {
      try {
        // Chain to Turf Soccer as the third (final) game
        const nextRoomId = this.roomId + "_ts";
        const { matchMaker } = await import("colyseus");
        await matchMaker.createRoom("turf_soccer_room", {
          customRoomId: nextRoomId,
          isTransitionRoom: true,
        });
        this.broadcast("next_game", {
          roomId: nextRoomId,
          roomName: "turf_soccer_room",
        });
      } catch (e) {
        console.error("Failed to create next room", e);
        this.resetMatch();
      }
    }, MATCH_RESET_DELAY);
  }

  private resetMatch() {
    this.state.matchStarted = false;
    this.state.matchEnded = false;
    this.state.winnerId = "";
    this.state.countdown = 0;
    this.state.roundState = "waiting";

    this.state.players.forEach((player: PlayerState) => {
      player.score = 0;
      player.isAlive = true;
      player.hasDynamite = false;
      player.velocityX = 0;
      player.velocityY = 0;

      const angle = Math.random() * Math.PI * 2;
      const spawnRadius = ISLAND_RADIUS * 0.7;
      player.x = CX + Math.cos(angle) * spawnRadius;
      player.y = CY + Math.sin(angle) * spawnRadius;
    });

    console.log(`🧨 Room reset. ${this.state.players.size} players ready.`);
    this.broadcast("match_reset", { playerCount: this.state.players.size });

    this.tryStartCountdown();
  }
}
