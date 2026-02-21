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
  GRASS_RADIUS,
  PLAYER_RADIUS,
} from "../utils/constants";
import { saveMatchResult, savePlayerStats } from "../../../db/matchHistory";

interface MoveInput {
  dx: number;
  dy: number;
}

const TILE_SIZE = 64;
const COLS = 12;
const ROWS = 8;

// Corner spawn positions (offset from corners by SPAWN_MARGIN)
const CORNER_SPAWNS = [
  { x: SPAWN_MARGIN, y: SPAWN_MARGIN },                                       // top-left
  { x: ARENA_WIDTH - SPAWN_MARGIN, y: SPAWN_MARGIN },                         // top-right
  { x: SPAWN_MARGIN, y: ARENA_HEIGHT - SPAWN_MARGIN },                        // bottom-left
  { x: ARENA_WIDTH - SPAWN_MARGIN, y: ARENA_HEIGHT - SPAWN_MARGIN },          // bottom-right
  { x: ARENA_WIDTH / 2, y: SPAWN_MARGIN },                                    // top-center
  { x: ARENA_WIDTH / 2, y: ARENA_HEIGHT - SPAWN_MARGIN },                     // bottom-center
  { x: SPAWN_MARGIN, y: ARENA_HEIGHT / 2 },                                   // left-center
  { x: ARENA_WIDTH - SPAWN_MARGIN, y: ARENA_HEIGHT / 2 },                     // right-center
];

// Power-up counts
const BOMB_COUNT = 5;
const ROCKET_COUNT = 5;
const SPEED_COUNT = 5;

export class GameRoom extends Room<GameState> {
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private resetTimeout: ReturnType<typeof setTimeout> | null = null;

  async onCreate(options: any) {
    if (options.customRoomId) {
      this.roomId = options.customRoomId;
    }
    this.state = new GameState();
    this.maxClients = MAX_PLAYERS;

    this.state.arenaBoundaryX = ARENA_WIDTH;
    this.state.arenaBoundaryY = ARENA_HEIGHT;

    this.onMessage("move", (client: Client, data: MoveInput) => {
      this.handleMove(client, data);
    });

    this.setSimulationInterval((deltaTime: number) => {
      this.update(deltaTime);
    }, 1000 / TICK_RATE);

    console.log(`🏟️  GameRoom created | Room ID: ${this.roomId}`);
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerState();

    // Spawn at corners
    const spawnIndex = this.state.players.size % CORNER_SPAWNS.length;
    const spawn = CORNER_SPAWNS[spawnIndex];
    player.x = spawn.x;
    player.y = spawn.y;
    player.score = 0;
    player.displayName =
      options?.displayName || `Player_${client.sessionId.slice(0, 4)}`;
    player.playerId = options?.playerId || client.sessionId;

    const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#ec4899", "#14b8a6", "#f97316"];
    player.color = options?.color || colors[this.state.players.size % colors.length];

    this.state.players.set(client.sessionId, player);

    console.log(
      `✅ ${player.displayName} joined | ` +
      `Session: ${client.sessionId} | ` +
      `Players: ${this.state.players.size}/${MAX_PLAYERS}`
    );

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
    console.log(`🗑️  GameRoom disposed | Room ID: ${this.roomId}`);
  }

  private handleMove(client: Client, data: MoveInput) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !this.state.matchStarted || this.state.matchEnded) return;
    if (player.stunTimer > 0) return;

    const dx = Math.sign(data.dx || 0);
    const dy = Math.sign(data.dy || 0);

    player.velocityX = dx * PLAYER_SPEED * player.speedMultiplier;
    player.velocityY = dy * PLAYER_SPEED * player.speedMultiplier;
  }

  private update(deltaTime: number) {
    const dt = deltaTime / 1000;

    if (!this.state.matchStarted || this.state.matchEnded) return;

    this.state.matchTimer -= dt;
    if (this.state.matchTimer <= 0) {
      this.state.matchTimer = 0;
      this.endMatch();
      return;
    }

    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      if (player.stunTimer > 0) {
        player.stunTimer -= dt;
        if (player.stunTimer <= 0) {
          player.stunTimer = 0;
        }
      }

      if (player.stunTimer <= 0) {
        player.x += player.velocityX * dt;
        player.y += player.velocityY * dt;

        const speed = Math.sqrt(
          player.velocityX * player.velocityX +
          player.velocityY * player.velocityY
        );
        if (speed > MAX_VELOCITY * player.speedMultiplier) {
          const scale = (MAX_VELOCITY * player.speedMultiplier) / speed;
          player.velocityX *= scale;
          player.velocityY *= scale;
        }

        player.velocityX *= 0.9;
        player.velocityY *= 0.9;
        if (Math.abs(player.velocityX) < 1) player.velocityX = 0;
        if (Math.abs(player.velocityY) < 1) player.velocityY = 0;

        player.x = Math.max(PLAYER_RADIUS, Math.min(this.state.arenaBoundaryX - PLAYER_RADIUS, player.x));
        player.y = Math.max(PLAYER_RADIUS, Math.min(this.state.arenaBoundaryY - PLAYER_RADIUS, player.y));
      }

      // ── TWO-PHASE GRASS COLLECTION ──
      for (let i = this.state.grasses.length - 1; i >= 0; i--) {
        const grass = this.state.grasses[i];
        const dx = player.x - grass.x;
        const dy = player.y - grass.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        const collisionDist = PLAYER_RADIUS + (grass.phase === 1 ? GRASS_RADIUS : GRASS_RADIUS * 0.6);

        if (dist < collisionDist) {
          if (grass.phase === 1) {
            // Phase 1 → Phase 2: Big grass becomes small grass
            player.score += 1;
            grass.phase = 2;
            // Broadcast that a big grass was collected
            this.broadcast("grass_collected", {
              id: grass.id,
              x: grass.x,
              y: grass.y,
              playerId: sessionId,
            });
          } else if (grass.phase === 2) {
            // Phase 2: Small grass collected → remove it
            const powerUp = grass.powerUp;
            this.state.grasses.splice(i, 1);

            if (powerUp === "bomb") {
              player.stunTimer = 3;
              this.state.lastEvent = `${player.displayName} stepped on a Bomb!`;
            } else if (powerUp === "rocket") {
              this.state.lastEvent = `${player.displayName} launched a Rocket!`;
              this.state.players.forEach((p, id) => {
                if (id !== sessionId) {
                  p.stunTimer = 3;
                }
              });
            } else if (powerUp === "speed") {
              player.speedMultiplier = 2;
              this.state.lastEvent = `${player.displayName} found a Speed Booster!`;
              setTimeout(() => {
                if (this.state.players.has(sessionId)) {
                  this.state.players.get(sessionId)!.speedMultiplier = 1;
                }
              }, 5000);
            }
            // No powerUp = just a normal small grass, score +1
            player.score += 1;

            this.broadcast("small_grass_collected", {
              id: grass.id,
              x: grass.x,
              y: grass.y,
              powerUp,
              playerId: sessionId,
            });
          }
          break; // Only collect ONE grass per tick per player
        }
      }
    });

    // Check if all grass collected (both phases)
    if (this.state.grasses.length === 0) {
      this.endMatch();
    }
  }

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

    this.state.arenaBoundaryX = ARENA_WIDTH;
    this.state.arenaBoundaryY = ARENA_HEIGHT;

    // Clear existing
    while (this.state.grasses.length > 0) {
      this.state.grasses.pop();
    }

    // Build grass grid (12x8 = 96 tiles)
    const allPositions: { row: number; col: number }[] = [];
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        allPositions.push({ row, col });
      }
    }

    // Randomly assign power-ups to 15 of the 96 tiles
    const shuffled = [...allPositions].sort(() => Math.random() - 0.5);
    const powerUpMap = new Map<string, string>();
    for (let i = 0; i < BOMB_COUNT; i++) {
      const pos = shuffled[i];
      powerUpMap.set(`${pos.row}_${pos.col}`, "bomb");
    }
    for (let i = BOMB_COUNT; i < BOMB_COUNT + ROCKET_COUNT; i++) {
      const pos = shuffled[i];
      powerUpMap.set(`${pos.row}_${pos.col}`, "rocket");
    }
    for (let i = BOMB_COUNT + ROCKET_COUNT; i < BOMB_COUNT + ROCKET_COUNT + SPEED_COUNT; i++) {
      const pos = shuffled[i];
      powerUpMap.set(`${pos.row}_${pos.col}`, "speed");
    }

    // Create all 96 grass tiles as phase 1 (big) with hidden power-ups
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const grass = new GrassState();
        grass.id = `grass_${row}_${col}`;
        grass.x = col * TILE_SIZE + TILE_SIZE / 2;
        grass.y = row * TILE_SIZE + TILE_SIZE / 2;
        grass.phase = 1;
        grass.powerUp = powerUpMap.get(`${row}_${col}`) || "";
        this.state.grasses.push(grass);
      }
    }

    // Spawn players at corners
    let spawnIdx = 0;
    this.state.players.forEach((player: PlayerState) => {
      player.score = 0;
      player.speedMultiplier = 1;
      player.stunTimer = 0;
      player.velocityX = 0;
      player.velocityY = 0;
      const spawn = CORNER_SPAWNS[spawnIdx % CORNER_SPAWNS.length];
      player.x = spawn.x;
      player.y = spawn.y;
      spawnIdx++;
    });

    console.log(`🎮 Match started! ${this.state.players.size} players, ${this.state.grasses.length} grass tiles.`);
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
        ? `🏆 Draw — tied at ${maxScore}!`
        : `🏆 ${winnerName} wins with ${maxScore}!`
    );

    this.broadcast("match_end", {
      winnerId,
      winnerName,
      maxScore,
      isDraw,
    });

    const playerStatsToSave: { id: string, displayName: string, isWinner: boolean, score: number }[] = [];
    this.state.players.forEach((player: PlayerState, sessionId: string) => {
      playerStatsToSave.push({
        id: player.playerId || sessionId,
        displayName: player.displayName,
        isWinner: !isDraw && sessionId === winnerId,
        score: player.score
      });
    });

    savePlayerStats(playerStatsToSave).catch((err) => console.warn(`⚠️  Failed to save player stats: ${err.message}`));

    saveMatchResult({
      roomId: this.roomId,
      winnerId,
      winnerName,
      playerCount: this.state.players.size,
      matchDuration: MATCH_DURATION - this.state.matchTimer,
      isDraw,
    }).catch((err) => console.warn(`⚠️  Failed to save match: ${err.message}`));

    this.resetTimeout = setTimeout(() => {
      this.resetMatch();
    }, MATCH_RESET_DELAY);
  }

  private resetMatch() {
    this.state.matchStarted = false;
    this.state.matchEnded = false;
    this.state.matchTimer = MATCH_DURATION;
    this.state.winnerId = "";
    this.state.countdown = 0;
    this.state.lastEvent = "";

    while (this.state.grasses.length > 0) {
      this.state.grasses.pop();
    }

    let spawnIdx = 0;
    this.state.players.forEach((player: PlayerState) => {
      player.score = 0;
      player.speedMultiplier = 1;
      player.stunTimer = 0;
      player.velocityX = 0;
      player.velocityY = 0;
      const spawn = CORNER_SPAWNS[spawnIdx % CORNER_SPAWNS.length];
      player.x = spawn.x;
      player.y = spawn.y;
      spawnIdx++;
    });

    console.log(`🔄 Room reset. ${this.state.players.size} players ready.`);
    this.broadcast("match_reset", { playerCount: this.state.players.size });

    this.tryStartCountdown();
  }
}