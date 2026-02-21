import { Room, Client } from "colyseus";
import { GameState } from "../schemas/GameState";
import { PlayerState } from "../schemas/PlayerState";
import { GrassState } from "../schemas/GrassState";
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
  GRASS_COUNT,
  GRASS_RADIUS,
  PLAYER_RADIUS,
} from "../utils/constants";
import { saveMatchResult } from "../../../db/matchHistory";

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

    // Set up the authoritative simulation loop
    this.setSimulationInterval((deltaTime: number) => {
      this.update(deltaTime);
    }, 1000 / TICK_RATE);

    console.log(`���️  GameRoom created | Room ID: ${this.roomId}`);
  }

  onJoin(client: Client, options: JoinOptions) {
    const player = new PlayerState();

    // Random spawn position within safe margin
    player.x = SPAWN_MARGIN + Math.random() * (ARENA_WIDTH - 2 * SPAWN_MARGIN);
    player.y = SPAWN_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * SPAWN_MARGIN);
    player.score = 0;
    player.displayName =
      options?.displayName || `Player_${client.sessionId.slice(0, 4)}`;

    this.state.players.set(client.sessionId, player);

    console.log(
      `✅ ${player.displayName} joined | ` +
        `Session: ${client.sessionId} | ` +
        `Players: ${this.state.players.size}/${MAX_PLAYERS}`
    );

    // Start countdown if we have enough players
    this.tryStartCountdown();
  }

  onLeave(client: Client, _consented?: boolean) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;

    console.log(
      `❌ ${player.displayName} left | Session: ${client.sessionId}`
    );

    this.state.players.delete(client.sessionId);

    if (this.state.matchStarted && !this.state.matchEnded) {
      if (this.state.players.size < MIN_PLAYERS) {
        this.endMatch();
      }
    }
  }

  onDispose() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.resetTimeout) clearTimeout(this.resetTimeout);
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
            player.velocityY * player.velocityY
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
      for (let i = this.state.grasses.length - 1; i >= 0; i--) {
        const grass = this.state.grasses[i];
        const dx = player.x - grass.x;
        const dy = player.y - grass.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < PLAYER_RADIUS + GRASS_RADIUS) {
          // Collected!
          player.score += 1;
          this.state.grasses.splice(i, 1);
          this.handlePowerup(sessionId, player);
        }
      }
    });

    // Check if all grass collected
    if (this.state.grasses.length === 0) {
      this.endMatch();
    }
  }

  private handlePowerup(collectorId: string, player: PlayerState) {
    const rand = Math.random();
    if (rand < 0.05) {
      // 5% chance: Speed Booster
      player.speedMultiplier = 2;
      this.state.lastEvent = `${player.displayName} found a Speed Booster!`;
      setTimeout(() => {
        if (this.state.players.has(collectorId)) {
          this.state.players.get(collectorId)!.speedMultiplier = 1;
        }
      }, 5000);
    } else if (rand < 0.10) {
      // 5% chance: Bomb (stun self)
      player.stunTimer = 3;
      this.state.lastEvent = `${player.displayName} stepped on a Bomb!`;
    } else if (rand < 0.12) {
      // 2% chance: Rocket (stun others)
      this.state.lastEvent = `${player.displayName} launched a Rocket!`;
      this.state.players.forEach((p, id) => {
        if (id !== collectorId) {
          p.stunTimer = 3;
        }
      });
    }
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
    this.state.matchTimer = MATCH_DURATION;
    this.state.winnerId = "";
    this.state.lastEvent = "Match Started!";

    // Reset arena boundaries
    this.state.arenaBoundaryX = ARENA_WIDTH;
    this.state.arenaBoundaryY = ARENA_HEIGHT;

    // Spawn Grass
    while (this.state.grasses.length > 0) {
      this.state.grasses.pop();
    }
    for (let i = 0; i < GRASS_COUNT; i++) {
      const grass = new GrassState();
      grass.id = `grass_${i}`;
      grass.x = SPAWN_MARGIN + Math.random() * (ARENA_WIDTH - 2 * SPAWN_MARGIN);
      grass.y = SPAWN_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * SPAWN_MARGIN);
      this.state.grasses.push(grass);
    }

    this.state.players.forEach((player: PlayerState) => {
      player.score = 0;
      player.speedMultiplier = 1;
      player.stunTimer = 0;
      player.velocityX = 0;
      player.velocityY = 0;
      player.x = SPAWN_MARGIN + Math.random() * (ARENA_WIDTH - 2 * SPAWN_MARGIN);
      player.y = SPAWN_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * SPAWN_MARGIN);
    });

    console.log(`��� Match started! ${this.state.players.size} players in the arena.`);
    this.broadcast("match_start", { playerCount: this.state.players.size });
  }

  private endMatch() {
    this.state.matchEnded = true;

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
        : `��� ${winnerName} wins with ${maxScore} grass!`
    );

    this.broadcast("match_end", {
      winnerId,
      winnerName,
      maxScore,
      isDraw,
    });

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
    this.resetTimeout = setTimeout(() => {
      this.resetMatch();
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

    // Clear grass
    while (this.state.grasses.length > 0) {
      this.state.grasses.pop();
    }

    this.state.players.forEach((player: PlayerState) => {
      player.score = 0;
      player.speedMultiplier = 1;
      player.stunTimer = 0;
      player.velocityX = 0;
      player.velocityY = 0;
      player.x = SPAWN_MARGIN + Math.random() * (ARENA_WIDTH - 2 * SPAWN_MARGIN);
      player.y = SPAWN_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * SPAWN_MARGIN);
    });

    console.log(`��� Room reset. ${this.state.players.size} players ready.`);
    this.broadcast("match_reset", { playerCount: this.state.players.size });

    // Start new countdown if enough players
    this.tryStartCountdown();
  }
}
