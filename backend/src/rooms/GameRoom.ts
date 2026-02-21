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
  TICK_RATE,
} from "../utils/constants";

// ─── Message types from the client ───────────────────────
interface MoveInput {
  dx: number; // -1, 0, or 1
  dy: number; // -1, 0, or 1
}

interface JoinOptions {
  displayName?: string;
}

export class GameRoom extends Room<{ state: GameState }> {
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

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

    console.log(`🏟️  GameRoom created | Room ID: ${this.roomId}`);
  }

  onJoin(client: Client, options: JoinOptions) {
    const player = new PlayerState();

    // Random spawn position within safe margin
    player.x =
      SPAWN_MARGIN + Math.random() * (ARENA_WIDTH - 2 * SPAWN_MARGIN);
    player.y =
      SPAWN_MARGIN + Math.random() * (ARENA_HEIGHT - 2 * SPAWN_MARGIN);
    player.isAlive = true;
    player.survivalTime = 0;
    player.displayName = options?.displayName || `Player_${client.sessionId.slice(0, 4)}`;

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
      `❌ ${player.displayName} left | ` +
      `Session: ${client.sessionId}`
    );

    if (player.isAlive) {
      player.isAlive = false;
      this.state.aliveCount = Math.max(0, this.state.aliveCount - 1);
    }

    // Remove player immediately (no reconnect grace for hackathon simplicity)
    this.state.players.delete(client.sessionId);

    // Check win condition after a player leaves
    if (this.state.matchStarted && !this.state.matchEnded) {
      this.checkWinCondition();
    }
  }

  onDispose() {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
    }
    console.log(`🗑️  GameRoom disposed | Room ID: ${this.roomId}`);
  }

  // ───── Message handlers ──────────────────────────────────

  private handleMove(client: Client, data: MoveInput) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isAlive || !this.state.matchStarted) return;

    // Normalize direction input to -1, 0, or 1
    const dx = Math.sign(data.dx || 0);
    const dy = Math.sign(data.dy || 0);

    // Set velocity based on input direction
    player.velocityX = dx * PLAYER_SPEED;
    player.velocityY = dy * PLAYER_SPEED;
  }

  // ───── Simulation tick ───────────────────────────────────

  private update(deltaTime: number) {
    // deltaTime is in milliseconds, convert to seconds
    const dt = deltaTime / 1000;

    if (!this.state.matchStarted || this.state.matchEnded) return;

    // Update match timer
    this.state.matchTimer += dt;

    // Process each alive player
    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      if (!player.isAlive) return;

      // Apply velocity to position
      player.x += player.velocityX * dt;
      player.y += player.velocityY * dt;

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

      // Apply friction (gradual deceleration)
      player.velocityX *= 0.9;
      player.velocityY *= 0.9;

      // Stop very small velocities (avoid drifting)
      if (Math.abs(player.velocityX) < 1) player.velocityX = 0;
      if (Math.abs(player.velocityY) < 1) player.velocityY = 0;

      // Check elimination: out of arena bounds
      if (
        player.x < -ELIMINATION_BUFFER ||
        player.x > this.state.arenaBoundaryX + ELIMINATION_BUFFER ||
        player.y < -ELIMINATION_BUFFER ||
        player.y > this.state.arenaBoundaryY + ELIMINATION_BUFFER
      ) {
        this.eliminatePlayer(sessionId, player);
        return;
      }

      // Clamp position to arena (soft boundary — keeps players inside)
      player.x = Math.max(0, Math.min(this.state.arenaBoundaryX, player.x));
      player.y = Math.max(0, Math.min(this.state.arenaBoundaryY, player.y));

      // Increment survival time
      player.survivalTime += dt;
    });

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

    // Reset alive count to current connected players
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

  private eliminatePlayer(sessionId: string, player: PlayerState) {
    if (!player.isAlive) return;

    player.isAlive = false;
    player.velocityX = 0;
    player.velocityY = 0;
    this.state.aliveCount = Math.max(0, this.state.aliveCount - 1);

    console.log(
      `💀 ${player.displayName} eliminated! | ` +
      `Survived: ${player.survivalTime.toFixed(1)}s | ` +
      `Remaining: ${this.state.aliveCount}`
    );

    this.broadcast("player_eliminated", {
      sessionId,
      displayName: player.displayName,
      survivalTime: player.survivalTime,
    });
  }

  private checkWinCondition() {
    if (this.state.matchEnded) return;
    if (this.state.aliveCount > 1) return;

    // Find the winner (last alive player)
    let winnerId = "";
    let winnerName = "";

    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      if (player.isAlive) {
        winnerId = sessionId;
        winnerName = player.displayName;
      }
    });

    if (this.state.aliveCount === 1 && winnerId) {
      this.state.matchEnded = true;
      this.state.winnerId = winnerId;

      console.log(
        `🏆 ${winnerName} wins! | ` +
        `Match duration: ${this.state.matchTimer.toFixed(1)}s`
      );

      this.broadcast("match_end", {
        winnerId,
        winnerName,
        matchDuration: this.state.matchTimer,
      });
    } else if (this.state.aliveCount === 0) {
      // Everyone eliminated (draw)
      this.state.matchEnded = true;
      console.log(`🤝 Draw — all players eliminated!`);
      this.broadcast("match_end", {
        winnerId: "",
        winnerName: "Nobody",
        matchDuration: this.state.matchTimer,
      });
    }
  }
}
