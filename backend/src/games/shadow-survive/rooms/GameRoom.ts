import { Room, Client } from "colyseus";
import { GameState } from "../schemas/GameState";
import { PlayerState } from "../schemas/PlayerState";
import { PlatformState } from "../schemas/PlatformState";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_SPEED,
  JUMP_FORCE,
  GRAVITY,
  MATCH_COUNTDOWN,
  MATCH_RESET_DELAY,
  TICK_RATE,
  PLAYER_WIDTH,
  PLAYER_HEIGHT,
} from "../utils/constants";
import { saveMatchResult, savePlayerStats } from "../../../db/matchHistory";

interface MoveInput {
  dx: number;
  jump?: boolean;
}

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
      this.handleInput(client, data);
    });

    this.setSimulationInterval((deltaTime: number) => {
      this.update(deltaTime);
    }, 1000 / TICK_RATE);
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerState();
    player.x = ARENA_WIDTH / 2;
    player.y = ARENA_HEIGHT - 100;
    player.displayName = options?.displayName || `Bouncer_${client.sessionId.slice(0, 4)}`;
    player.playerId = options?.playerId || client.sessionId;

    const colors = ["#818cf8", "#6366f1", "#4f46e5", "#4338ca", "#3730a3", "#312e81"];
    player.color = options?.color || colors[this.state.players.size % colors.length];

    this.state.players.set(client.sessionId, player);
    this.tryStartCountdown();
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    if (this.state.matchStarted && !this.state.matchEnded) {
      const alivePlayers = Array.from(this.state.players.values()).filter(p => p.isAlive);
      if (alivePlayers.length === 0) {
        this.endMatch();
      }
    }
  }

  private handleInput(client: Client, data: MoveInput) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isAlive || !this.state.matchStarted || this.state.matchEnded) return;

    // Horizontal steering (only while airborne, on ground player is stationary)
    if (!player.isGrounded) {
      player.velocityX = (data.dx || 0) * PLAYER_SPEED;
    }

    // Jump with directional impulse
    if (data.jump && player.isGrounded) {
      player.velocityY = JUMP_FORCE;
      if (data.dx !== 0) {
        player.velocityX = data.dx * PLAYER_SPEED * 1.5;
      }
      player.isGrounded = false;
    }
  }

  private update(deltaTime: number) {
    const dt = deltaTime / 1000;

    if (!this.state.matchStarted || this.state.matchEnded) return;

    this.state.matchTimer += dt;
    this.state.difficultyScale = 1 + (this.state.matchTimer / 30);

    // ── Process Players ──
    let aliveCount = 0;
    this.state.players.forEach((player, sessionId) => {
      if (!player.isAlive) return;
      aliveCount++;

      // Gravity
      player.velocityY += GRAVITY * dt;

      // Position update
      player.x += player.velocityX * dt;
      player.y += player.velocityY * dt;

      // Solid block collisions (all 4 sides)
      let groundedThisFrame = false;
      this.state.platforms.forEach(platform => {
        const pLeft = platform.x - platform.width / 2;
        const pRight = platform.x + platform.width / 2;
        const pTop = platform.y - platform.height / 2;
        const pBottom = platform.y + platform.height / 2;
        const hw = PLAYER_WIDTH / 2;
        const hh = PLAYER_HEIGHT / 2;

        if (
          player.x + hw > pLeft &&
          player.x - hw < pRight &&
          player.y + hh > pTop &&
          player.y - hh < pBottom
        ) {
          const oTop = (player.y + hh) - pTop;
          const oBot = pBottom - (player.y - hh);
          const oLeft = (player.x + hw) - pLeft;
          const oRight = pRight - (player.x - hw);
          const min = Math.min(oTop, oBot, oLeft, oRight);

          if (min === oTop && player.velocityY >= 0) {
            player.y = pTop - hh;
            player.velocityY = 0;
            player.velocityX = 0; // Stop on landing
            groundedThisFrame = true;

            if (platform.id === "goal_core") {
              this.handleLevelComplete(sessionId, player);
            }
          } else if (min === oBot && player.velocityY < 0) {
            player.y = pBottom + hh;
            player.velocityY = 0;
          } else if (min === oLeft) {
            player.x = pLeft - hw;
            player.velocityX = 0;
          } else if (min === oRight) {
            player.x = pRight + hw;
            player.velocityX = 0;
          }
        }
      });
      player.isGrounded = groundedThisFrame;

      // Wall bounds
      if (player.x < PLAYER_WIDTH / 2) player.x = PLAYER_WIDTH / 2;
      if (player.x > ARENA_WIDTH - PLAYER_WIDTH / 2) player.x = ARENA_WIDTH - PLAYER_WIDTH / 2;

      // Fall death
      if (player.y > ARENA_HEIGHT + 50) {
        this.eliminatePlayer(sessionId, player, "fell into the void");
      }

      // Score
      if (player.isAlive) {
        player.score += Math.floor(10 * dt * this.state.difficultyScale);
      }
    });

    if (aliveCount === 0 && this.state.players.size > 0) {
      this.endMatch();
    }
  }

  private eliminatePlayer(sessionId: string, player: PlayerState, reason: string) {
    player.isAlive = false;
    this.state.lastEvent = `${player.displayName} ${reason}!`;
    this.broadcast("player_eliminated", {
      sessionId,
      displayName: player.displayName,
      score: player.score,
      reason
    });
  }

  private tryStartCountdown() {
    if (this.state.matchStarted || this.countdownInterval) return;
    if (this.state.players.size < MIN_PLAYERS) return;

    this.state.countdown = MATCH_COUNTDOWN;
    this.countdownInterval = setInterval(() => {
      this.state.countdown--;
      if (this.state.countdown <= 0) {
        clearInterval(this.countdownInterval!);
        this.countdownInterval = null;
        this.startMatch();
      }
    }, 1000);
  }

  private startMatch() {
    this.state.matchStarted = true;
    this.state.matchEnded = false;
    this.state.matchTimer = 0;
    this.state.difficultyScale = 1;
    this.state.level = 1;

    this.generateLevel();

    this.state.players.forEach(p => {
      p.isAlive = true;
      p.score = 0;
      this.respawnPlayer(p);
    });

    this.broadcast("match_start", { playerCount: this.state.players.size });
  }

  private generateLevel() {
    this.state.platforms.splice(0);
    this.state.lastEvent = `Level ${this.state.level} — Reach the red goal!`;

    // Goal (red core) — random position, gets smaller each level
    const goal = new PlatformState();
    goal.id = "goal_core";
    goal.width = Math.max(35, 70 - (this.state.level * 4));
    goal.height = goal.width;
    goal.x = 120 + Math.random() * (ARENA_WIDTH - 240);
    goal.y = 80 + Math.random() * (ARENA_HEIGHT - 280);
    goal.type = "goal";
    this.state.platforms.push(goal);

    // Random stepping blocks — all normal, no traps
    const blockCount = 8 + (this.state.level * 3);
    for (let i = 0; i < blockCount; i++) {
      const plat = new PlatformState();
      plat.id = `block_${i}`;
      plat.width = 40 + Math.random() * 30;
      plat.height = 40 + Math.random() * 30;
      plat.x = 40 + Math.random() * (ARENA_WIDTH - 80);
      plat.y = 40 + Math.random() * (ARENA_HEIGHT - 120);
      plat.type = "normal";

      // Don't overlap with goal
      const dx = plat.x - goal.x;
      const dy = plat.y - goal.y;
      if (Math.sqrt(dx * dx + dy * dy) > 90) {
        this.state.platforms.push(plat);
      }
    }

    // Base platform for spawning
    const base = new PlatformState();
    base.id = "base";
    base.width = 350;
    base.height = 35;
    base.x = ARENA_WIDTH / 2;
    base.y = ARENA_HEIGHT - 40;
    base.type = "normal";
    this.state.platforms.push(base);
  }

  private respawnPlayer(player: PlayerState) {
    player.x = ARENA_WIDTH / 2;
    player.y = ARENA_HEIGHT - 90;
    player.velocityY = 0;
    player.velocityX = 0;
    player.isGrounded = false;
  }

  private handleLevelComplete(sessionId: string, player: PlayerState) {
    player.score += 100 * this.state.level;
    this.state.level += 1;
    this.state.difficultyScale += 0.2;

    this.state.lastEvent = `${player.displayName} cleared Level ${this.state.level - 1}!`;
    this.broadcast("level_complete", { sessionId, level: this.state.level });

    this.generateLevel();
    this.state.players.forEach(p => {
      if (p.isAlive) this.respawnPlayer(p);
    });
  }

  private endMatch() {
    this.state.matchEnded = true;
    let winnerId = "";
    let maxScore = -1;
    this.state.players.forEach((p, id) => {
      if (p.score > maxScore) {
        maxScore = p.score;
        winnerId = id;
      }
    });

    const winner = this.state.players.get(winnerId);
    this.state.winnerId = winnerId;

    this.broadcast("match_end", {
      winnerId,
      winnerName: winner?.displayName || "Nobody",
      maxScore,
    });

    const stats: any[] = [];
    this.state.players.forEach((p, id) => {
      stats.push({
        id: p.playerId || id,
        displayName: p.displayName,
        isWinner: id === winnerId,
        score: p.score
      });
    });
    savePlayerStats(stats).catch(console.error);

    this.resetTimeout = setTimeout(() => this.resetMatch(), MATCH_RESET_DELAY);
  }

  private resetMatch() {
    this.state.matchStarted = false;
    this.state.matchEnded = false;
    this.state.platforms.splice(0);
    this.tryStartCountdown();
  }
}
