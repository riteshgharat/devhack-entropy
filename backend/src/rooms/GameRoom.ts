import { Room, Client } from "colyseus";
import { GameState } from "../schemas/GameState";
import { PlayerState } from "../schemas/PlayerState";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_SPEED,
  MAX_VELOCITY,
  SPAWN_MARGIN,
  ELIMINATION_BUFFER,
  MATCH_COUNTDOWN,
  MATCH_RESET_DELAY,
  TICK_RATE,
} from "../utils/constants";
import {
  spawnFallingBlock,
  shrinkBoundary,
  rotateObstacle,
  speedModifier,
  targetPlayerTrap,
  updateHazards,
  checkHazardCollisions,
  getSpeedMultiplier,
} from "../arena/ArenaMutationEngine";
import { saveMatchResult } from "../db/matchHistory";

// ─── Message types from the client ───────────────────────
interface MoveInput {
  dx: number; // -1, 0, or 1
  dy: number; // -1, 0, or 1
}

interface JoinOptions {
  displayName?: string;
}

interface MutationMessage {
  mutation:
    | "spawn_falling_block"
    | "shrink_boundary"
    | "rotate_obstacle"
    | "speed_modifier"
    | "target_player_trap";
  targetSessionId?: string;
}

export class GameRoom extends Room<{ state: GameState }> {
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private resetTimeout: ReturnType<typeof setTimeout> | null = null;

  // ───── Room lifecycle ────────────────────────────────────

  onCreate(_options: any) {
    this.state = new GameState();
    this.maxClients = MAX_PLAYERS;

    // Set arena boundaries on state
    this.state.arenaBoundaryX = ARENA_WIDTH;
    this.state.arenaBoundaryY = ARENA_HEIGHT;

    // Register message handlers
    this.onMessage("move", (client: Client, data: MoveInput) => {
      this.handleMove(client, data);
    });

    this.onMessage("arena_mutation", (_client: Client, data: MutationMessage) => {
      this.triggerMutation(data.mutation, data.targetSessionId);
    });

    // Set up the authoritative simulation loop
    this.setSimulationInterval((deltaTime: number) => {
      this.update(deltaTime);
    }, 1000 / TICK_RATE);

    console.log(`🏟️  GameRoom created | Room ID: ${this.roomId}`);
  }

  onJoin(client: Client, options: JoinOptions) {
    const player = new PlayerState();

    // Random spawn position within safe margin
    player.x = SPAWN_MARGIN + Math.random() * (ARENA_WIDTH - 2 * SPAWN_MARGIN);
    player.y = SPAWN_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * SPAWN_MARGIN);
    player.isAlive = true;
    player.survivalTime = 0;
    player.displayName =
      options?.displayName || `Player_${client.sessionId.slice(0, 4)}`;

    this.state.players.set(client.sessionId, player);
    this.state.aliveCount++;

    console.log(
      `✅ ${player.displayName} joined | ` +
        `Session: ${client.sessionId} | ` +
        `Players: ${this.state.players.size}/${MAX_PLAYERS}`
    );

    // Start countdown if we have enough players
    this.tryStartCountdown();
  }

  onLeave(client: Client, _code?: number) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    console.log(
      `❌ ${player.displayName} left | Session: ${client.sessionId}`
    );

    if (player.isAlive) {
      player.isAlive = false;
      this.state.aliveCount = Math.max(0, this.state.aliveCount - 1);
    }

    this.state.players.delete(client.sessionId);

    if (this.state.matchStarted && !this.state.matchEnded) {
      this.checkWinCondition();
    }
  }

  onDispose() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.resetTimeout) clearTimeout(this.resetTimeout);
    console.log(`🗑️  GameRoom disposed | Room ID: ${this.roomId}`);
  }

  // ───── Message handlers ──────────────────────────────────

  private handleMove(client: Client, data: MoveInput) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isAlive || !this.state.matchStarted) return;

    const dx = Math.sign(data.dx || 0);
    const dy = Math.sign(data.dy || 0);

    // Apply speed zone modifier
    const speedMult = getSpeedMultiplier(this.state, player);
    player.velocityX = dx * PLAYER_SPEED * speedMult;
    player.velocityY = dy * PLAYER_SPEED * speedMult;
  }

  private triggerMutation(
    mutation: MutationMessage["mutation"],
    targetSessionId?: string
  ) {
    switch (mutation) {
      case "spawn_falling_block":
        spawnFallingBlock(this.state);
        this.state.lastArenaEvent = "block";
        break;
      case "shrink_boundary":
        shrinkBoundary(this.state);
        this.state.lastArenaEvent = "boundary";
        break;
      case "rotate_obstacle":
        rotateObstacle(this.state);
        this.state.lastArenaEvent = "rotate";
        break;
      case "speed_modifier": {
        const targetId = targetSessionId ?? this.state.weakestId ?? undefined;
        speedModifier(this.state, targetId);
        this.state.lastArenaEvent = "speed";
        break;
      }
      case "target_player_trap": {
        const trapTarget = targetSessionId ?? this.state.leaderId;
        if (trapTarget) {
          targetPlayerTrap(this.state, trapTarget);
          this.state.lastArenaEvent = "trap";
        }
        break;
      }
    }
    console.log(`🎲 Arena mutation triggered: ${mutation}`);
  }

  // ───── Simulation tick ───────────────────────────────────

  private update(deltaTime: number) {
    const dt = deltaTime / 1000; // ms → seconds

    if (!this.state.matchStarted || this.state.matchEnded) return;

    // Update match timer
    this.state.matchTimer += dt;

    // ── Phase 2: Update hazards ──
    updateHazards(this.state, dt);

    // ── Phase 2: Check hazard collisions ──
    const collisions = checkHazardCollisions(this.state);
    for (const c of collisions) {
      this.eliminatePlayer(c.sessionId, c.player, `hit by ${c.hazard.hazardType}`);
    }

    // ── Process players ──
    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      if (!player.isAlive) return;

      // Apply speed zone modifier to velocity
      const speedMult = getSpeedMultiplier(this.state, player);

      // Apply velocity to position
      player.x += player.velocityX * speedMult * dt;
      player.y += player.velocityY * speedMult * dt;

      // Clamp velocity magnitude
      const speed = Math.sqrt(
        player.velocityX * player.velocityX +
          player.velocityY * player.velocityY
      );
      if (speed > MAX_VELOCITY) {
        const scale = MAX_VELOCITY / speed;
        player.velocityX *= scale;
        player.velocityY *= scale;
      }

      // Friction
      player.velocityX *= 0.9;
      player.velocityY *= 0.9;
      if (Math.abs(player.velocityX) < 1) player.velocityX = 0;
      if (Math.abs(player.velocityY) < 1) player.velocityY = 0;

      // ── Elimination: out of arena bounds ──
      if (
        player.x < -ELIMINATION_BUFFER ||
        player.x > this.state.arenaBoundaryX + ELIMINATION_BUFFER ||
        player.y < -ELIMINATION_BUFFER ||
        player.y > this.state.arenaBoundaryY + ELIMINATION_BUFFER
      ) {
        this.eliminatePlayer(sessionId, player, "fell out of bounds");
        return;
      }

      // Clamp position to arena
      player.x = Math.max(0, Math.min(this.state.arenaBoundaryX, player.x));
      player.y = Math.max(0, Math.min(this.state.arenaBoundaryY, player.y));

      // Increment survival time
      player.survivalTime += dt;
    });

    // ── Phase 2: Leader & weakest detection ──
    this.updateLeaderAndWeakest();

    // Check win condition
    this.checkWinCondition();
  }

  // ───── Game logic helpers ────────────────────────────────

  private tryStartCountdown() {
    if (this.state.matchStarted || this.countdownInterval) return;
    if (this.state.players.size < MIN_PLAYERS) return;

    console.log(`⏳ Countdown starting...`);
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
    this.state.matchTimer = 0;
    this.state.winnerId = "";
    this.state.leaderId = "";
    this.state.weakestId = "";

    // Reset arena boundaries
    this.state.arenaBoundaryX = ARENA_WIDTH;
    this.state.arenaBoundaryY = ARENA_HEIGHT;

    // Clear any leftover hazards
    while (this.state.hazards.length > 0) {
      this.state.hazards.pop();
    }

    let alive = 0;
    this.state.players.forEach((player: PlayerState) => {
      player.isAlive = true;
      player.survivalTime = 0;
      alive++;
    });
    this.state.aliveCount = alive;

    console.log(`🚀 Match started! ${alive} players in the arena.`);
    this.broadcast("match_start", { playerCount: alive });
  }

  private eliminatePlayer(sessionId: string, player: PlayerState, reason: string = "unknown") {
    if (!player.isAlive) return;

    player.isAlive = false;
    player.velocityX = 0;
    player.velocityY = 0;
    this.state.aliveCount = Math.max(0, this.state.aliveCount - 1);

    console.log(
      `💀 ${player.displayName} eliminated (${reason})! | ` +
        `Survived: ${player.survivalTime.toFixed(1)}s | ` +
        `Remaining: ${this.state.aliveCount}`
    );

    this.broadcast("player_eliminated", {
      sessionId,
      displayName: player.displayName,
      survivalTime: player.survivalTime,
      reason,
    });
  }

  /** Phase 2: Track leader (highest survivalTime) and weakest (lowest) */
  private updateLeaderAndWeakest() {
    let leaderId = "";
    let leaderTime = -1;
    let weakestId = "";
    let weakestTime = Infinity;

    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      if (!player.isAlive) return;

      if (player.survivalTime > leaderTime) {
        leaderTime = player.survivalTime;
        leaderId = sessionId;
      }
      if (player.survivalTime < weakestTime) {
        weakestTime = player.survivalTime;
        weakestId = sessionId;
      }
    });

    this.state.leaderId = leaderId;
    this.state.weakestId = weakestId;
  }

  private checkWinCondition() {
    if (this.state.matchEnded) return;
    if (this.state.aliveCount > 1) return;

    let winnerId = "";
    let winnerName = "";

    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      if (player.isAlive) {
        winnerId = sessionId;
        winnerName = player.displayName;
      }
    });

    if (this.state.aliveCount === 1 && winnerId) {
      this.endMatch(winnerId, winnerName);
    } else if (this.state.aliveCount === 0) {
      this.endMatch("", "Nobody");
    }
  }

  private endMatch(winnerId: string, winnerName: string) {
    this.state.matchEnded = true;
    this.state.winnerId = winnerId;

    const isDraw = winnerId === "";
    console.log(
      isDraw
        ? `🤝 Draw — all players eliminated!`
        : `🏆 ${winnerName} wins! | Match duration: ${this.state.matchTimer.toFixed(1)}s`
    );

    this.broadcast("match_end", {
      winnerId,
      winnerName,
      matchDuration: this.state.matchTimer,
      isDraw,
    });

    // Persist match result to database (async, non-blocking)
    saveMatchResult({
      roomId: this.roomId,
      winnerId,
      winnerName,
      playerCount: this.state.players.size,
      matchDuration: this.state.matchTimer,
      isDraw,
    }).catch((err) => console.warn(`⚠️  Failed to save match: ${err.message}`));

    // Auto-reset room after delay
    this.resetTimeout = setTimeout(() => {
      this.resetMatch();
    }, MATCH_RESET_DELAY);
  }

  /** Reset the room for a new match */
  private resetMatch() {
    this.state.matchStarted = false;
    this.state.matchEnded = false;
    this.state.matchTimer = 0;
    this.state.winnerId = "";
    this.state.leaderId = "";
    this.state.weakestId = "";
    this.state.countdown = 0;
    this.state.arenaBoundaryX = ARENA_WIDTH;
    this.state.arenaBoundaryY = ARENA_HEIGHT;

    // Clear hazards
    while (this.state.hazards.length > 0) {
      this.state.hazards.pop();
    }

    // Re-spawn all connected players
    let alive = 0;
    this.state.players.forEach((player: PlayerState) => {
      player.isAlive = true;
      player.survivalTime = 0;
      player.velocityX = 0;
      player.velocityY = 0;
      player.x = SPAWN_MARGIN + Math.random() * (ARENA_WIDTH - 2 * SPAWN_MARGIN);
      player.y = SPAWN_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * SPAWN_MARGIN);
      alive++;
    });
    this.state.aliveCount = alive;

    console.log(`🔄 Room reset. ${alive} players ready.`);
    this.broadcast("match_reset", { playerCount: alive });

    // Start new countdown if enough players
    this.tryStartCountdown();
  }
}
