import { Room, Client } from "colyseus";
import { RoomComms } from "../../../ai/roomComms";
import {
  TurfSoccerState,
  PlayerState,
  BallState,
} from "../schemas/TurfSoccerState";
import { saveMatchResult, savePlayerStats } from "../../../db/matchHistory";

// ─── Constants ──────────────────────────────────────────
const TICK_RATE = 60;
const TIME_STEP = 1000 / TICK_RATE;

const FIELD_WIDTH = 1200;
const FIELD_HEIGHT = 800;
const FIELD_CX = FIELD_WIDTH / 2;
const FIELD_CY = FIELD_HEIGHT / 2;

const GOAL_WIDTH = 60;
const GOAL_HEIGHT = 160;
const BALL_RADIUS = 14;
const PLAYER_SIZE = 32;
const PLAYER_SPEED = 240;
const BALL_FRICTION = 0.98;

const MIN_PLAYERS = 2;
const MAX_PLAYERS = 8;
const COUNTDOWN_SECONDS = 3;
const MATCH_DURATION = 90;
const MATCH_RESET_DELAY = 5000;
const GOAL_DELAY = 2.5;

const BALL_BORDER_THRESHOLD = 30;
const BALL_BORDER_RESET_TIME = 3.5;

const TEAM1_BOT_COLORS = ["#43a047"];
const TEAM2_BOT_COLORS = ["#fdd835"];

const POINTS_PER_GOAL = 30;
const POINTS_WIN_BONUS = 50;

export class TurfSoccerRoom extends Room<TurfSoccerState> {
  private countdownInterval?: NodeJS.Timeout;
  private resetTimeout?: NodeJS.Timeout;
  private _emptyRoomTimeout?: NodeJS.Timeout;
  private ballBorderTimer: number = 0;
  private botIdCounter: number = 0;
  private comms!: RoomComms;

  onCreate(options: any) {
    this.maxClients = MAX_PLAYERS;
    this.setState(new TurfSoccerState());

    this.autoDispose = false;

    if (options.customRoomId) {
      this.roomId = options.customRoomId;
    }
    if (options.isTransitionRoom) {
      // this.lock(); // REMOVED
    }

    this._emptyRoomTimeout = setTimeout(() => {
      if (this.getHumanCount() === 0) {
        console.log(`⚽ No players joined ${this.roomId}, disposing.`);
        this.disconnect();
      }
    }, 15000);

    // Initialize ball
    this.state.ball.x = FIELD_CX;
    this.state.ball.y = FIELD_CY;

    this.onMessage("move", (client, data) => {
      const player = this.state.players.get(client.sessionId);
      if (player && !player.isBot) {
        player.vx = data.dx || 0;
        player.vy = data.dy || 0;
      }
    });

    this.onMessage("updateName", (client, name: string) => {
      const player = this.state.players.get(client.sessionId);
      if (player && name && name.length <= 15) {
        player.displayName = name;
      }
    });

    this.onMessage("ready", (client) => {
      const player = this.state.players.get(client.sessionId);
      if (!player || player.isBot || this.state.matchStarted) return;
      player.isReady = !player.isReady;
      console.log(`${player.isReady ? "✅" : "⏳"} READY: ${player.displayName}`);
      this.tryStartCountdown();
    });

    this.setSimulationInterval(
      (deltaTime) => this.update(deltaTime),
      TIME_STEP,
    );

    // AI Game-Master & communication hub
    this.comms = new RoomComms(this, "turf_soccer");

    console.log(`⚽ Turf Soccer Room created: ${this.roomId}`);
  }

  onJoin(client: Client, options: any) {
    if (this._emptyRoomTimeout) {
      clearTimeout(this._emptyRoomTimeout);
      this._emptyRoomTimeout = undefined;
    }

    const player = new PlayerState();
    player.playerId = options.playerId || client.sessionId;
    player.displayName =
      options.displayName || `Player_${Math.floor(Math.random() * 1000)}`;
    player.color = options.color || "#ef4444";
    player.score = options?.previousScore ?? 0;
    player.isBot = false;

    // Balance teams
    const t1 = this.getTeamHumanCount(1);
    const t2 = this.getTeamHumanCount(2);
    player.team = t1 <= t2 ? 1 : 2;
    player.facingX = player.team === 1 ? 1 : -1;

    this.spawnHuman(player);
    this.state.players.set(client.sessionId, player);

    // First human becomes room owner
    if (this.getHumanCount() === 1) {
      this.state.ownerId = client.sessionId;
    }

    console.log(
      `⚽ ${player.displayName} joined (Team ${player.team}) | Players: ${this.getHumanCount()}`,
    );
    // No auto-start — wait for all players to send "ready"
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    if (player) console.log(`⚽ ${player.displayName} left`);
    this.comms.onClientLeave(client.sessionId);
    this.state.players.delete(client.sessionId);

    if (this.getHumanCount() < MIN_PLAYERS) {
      this.cancelCountdown();
      if (this.state.matchStarted && !this.state.matchEnded) {
        this.endMatch();
      }
    }

    // ZOMBIE CLEANUP: If the room is now empty, ensure it disposes after 15 seconds.
    if (this.getHumanCount() === 0) {
      this.resetEmptyRoomTimeout();
    }
  }

  private resetEmptyRoomTimeout() {
    if (this._emptyRoomTimeout) clearTimeout(this._emptyRoomTimeout);
    this._emptyRoomTimeout = setTimeout(() => {
      if (this.getHumanCount() === 0) {
        console.log(`⚽ Emergency disposing empty room ${this.roomId}`);
        this.disconnect();
      }
    }, 15000); // 15s to allow transitions
  }

  onDispose() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    if (this.resetTimeout) clearTimeout(this.resetTimeout);
    if (this._emptyRoomTimeout) clearTimeout(this._emptyRoomTimeout);
    console.log(`⚽ Room disposed: ${this.roomId}`);
  }

  // ─── Helpers ──────────────────────────────────────────

  private getTeamHumanCount(team: number): number {
    let c = 0;
    this.state.players.forEach((p) => {
      if (p.team === team && !p.isBot) c++;
    });
    return c;
  }

  private getTeamTotalCount(team: number): number {
    let c = 0;
    this.state.players.forEach((p) => {
      if (p.team === team) c++;
    });
    return c;
  }

  private getHumanCount(): number {
    let c = 0;
    this.state.players.forEach((p) => {
      if (!p.isBot) c++;
    });
    return c;
  }

  private spawnHuman(player: PlayerState) {
    const isTeam1 = player.team === 1;
    player.x = isTeam1 ? FIELD_CX - 150 : FIELD_CX + 150;
    player.y = FIELD_CY - 80;
    player.vx = 0;
    player.vy = 0;
  }

  private addBots() {
    // Fill each team to 2 with bots
    for (let t = 1; t <= 2; t++) {
      let total = this.getTeamTotalCount(t);
      let botColorIdx = 0;
      while (total < 2) {
        const bot = new PlayerState();
        const botId = `bot_${this.botIdCounter++}`;
        bot.playerId = botId;
        bot.isBot = true;
        bot.team = t;
        bot.facingX = t === 1 ? 1 : -1;

        if (t === 1) {
          bot.displayName = "Green Bot";
          bot.color = TEAM1_BOT_COLORS[botColorIdx % TEAM1_BOT_COLORS.length];
          bot.x = FIELD_CX - 150;
          bot.y = FIELD_CY + 80;
        } else {
          bot.displayName = "Yellow Bot";
          bot.color = TEAM2_BOT_COLORS[botColorIdx % TEAM2_BOT_COLORS.length];
          bot.x = FIELD_CX + 150;
          bot.y = FIELD_CY + 80;
        }

        this.state.players.set(botId, bot);
        total++;
        botColorIdx++;
      }
    }
  }

  private removeBots() {
    const botKeys: string[] = [];
    this.state.players.forEach((p, key) => {
      if (p.isBot) botKeys.push(key);
    });
    botKeys.forEach((k) => this.state.players.delete(k));
  }

  // ─── Match Flow ───────────────────────────────────────

  private tryStartCountdown() {
    if (
      this.getHumanCount() >= MIN_PLAYERS &&
      !this.state.matchStarted &&
      this.state.countdown === 0
    ) {
      // All human players must be ready
      let allReady = true;
      this.state.players.forEach((p) => {
        if (!p.isBot && !p.isReady) allReady = false;
      });
      if (!allReady) return;

      this.state.countdown = COUNTDOWN_SECONDS;
      this.countdownInterval = setInterval(() => {
        this.state.countdown--;
        if (this.state.countdown <= 0) {
          clearInterval(this.countdownInterval!);
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
    }
  }

  private startMatch() {
    this.addBots();

    this.state.matchStarted = true;
    this.state.matchEnded = false;
    this.state.matchTimer = MATCH_DURATION;
    this.state.scoreTeam1 = 0;
    this.state.scoreTeam2 = 0;
    this.state.winnerId = "";

    this.resetPositions();

    this.state.roundState = "countdown";
    this.state.roundDelay = COUNTDOWN_SECONDS;
    this.state.countdown = COUNTDOWN_SECONDS;

    this.broadcast("match_start", { playerCount: this.state.players.size });
    console.log(
      `⚽ Match started! ${this.state.players.size} entities on the pitch.`,
    );
  }

  private resetPositions() {
    // Team 1 players on the left half
    let t1idx = 0;
    let t2idx = 0;
    this.state.players.forEach((p) => {
      p.vx = 0;
      p.vy = 0;
      if (p.team === 1) {
        p.x = FIELD_CX - 150;
        p.y = FIELD_CY + (t1idx === 0 ? -80 : 80);
        p.facingX = 1;
        t1idx++;
      } else {
        p.x = FIELD_CX + 150;
        p.y = FIELD_CY + (t2idx === 0 ? -80 : 80);
        p.facingX = -1;
        t2idx++;
      }
    });

    // Reset ball to center
    this.state.ball.x = FIELD_CX;
    this.state.ball.y = FIELD_CY;
    this.state.ball.vx = 0;
    this.state.ball.vy = 0;
    this.ballBorderTimer = 0;
  }

  private triggerGoal(teamId: number) {
    this.state.roundState = "goal";
    this.state.roundDelay = GOAL_DELAY;

    if (teamId === 1) this.state.scoreTeam1++;
    else this.state.scoreTeam2++;

    // Award points to all players on the scoring team
    this.state.players.forEach((p) => {
      if (p.team === teamId && !p.isBot) {
        p.score += POINTS_PER_GOAL;
      }
    });

    this.broadcast("goal", {
      teamId,
      scoreTeam1: this.state.scoreTeam1,
      scoreTeam2: this.state.scoreTeam2,
    });
    console.log(
      `⚽ GOAL! Team ${teamId} scores. ${this.state.scoreTeam1} - ${this.state.scoreTeam2}`,
    );

    const scoreDiff = Math.abs(this.state.scoreTeam1 - this.state.scoreTeam2);
    if (scoreDiff === 0) {
      this.comms.addEvent(
        `TIED GAME! ${this.state.scoreTeam1}-${this.state.scoreTeam2}`,
      );
    } else if (scoreDiff >= 2) {
      const leadingTeam =
        this.state.scoreTeam1 > this.state.scoreTeam2 ? "Red" : "Blue";
      this.comms.addEvent(
        `${leadingTeam} Team dominating ${this.state.scoreTeam1}-${this.state.scoreTeam2}!`,
      );
    } else {
      this.comms.addEvent(
        `Team ${teamId} SCORES! ${this.state.scoreTeam1}-${this.state.scoreTeam2}`,
      );
    }
  }

  // ─── Physics / Simulation ─────────────────────────────

  private update(deltaTime: number) {
    // AI Game-Master tick
    if (this.state.matchStarted && !this.state.matchEnded) {
      this.comms.tick(deltaTime);
    }

    if (!this.state.matchStarted || this.state.matchEnded) return;
    const dt = deltaTime / 1000;

    // ── Round state machine ──
    if (this.state.roundState === "countdown") {
      this.state.roundDelay -= dt;
      this.state.countdown = Math.ceil(this.state.roundDelay);
      if (this.state.roundDelay <= 0) {
        this.state.roundState = "playing";
        this.state.countdown = 0;
      }
      // Still update positions so entities slow down
      this.updateAllEntities(dt, false);
      this.updateBallPhysics(dt, false);
      return;
    }

    if (this.state.roundState === "goal") {
      this.state.roundDelay -= dt;
      this.updateAllEntities(dt, false);
      this.updateBallPhysics(dt, false);
      if (this.state.roundDelay <= 0) {
        this.resetPositions();
        this.state.roundState = "countdown";
        this.state.roundDelay = COUNTDOWN_SECONDS;
        this.state.countdown = COUNTDOWN_SECONDS;
      }
      return;
    }

    // ── Playing ──
    this.state.matchTimer -= dt;
    if (this.state.matchTimer <= 0) {
      this.state.matchTimer = 0;
      this.endMatch();
      return;
    }

    this.updateAllEntities(dt, true);
    this.updateBallPhysics(dt, true);
    this.checkGoals();
    this.checkBallBorder(dt);
  }

  private updateAllEntities(dt: number, allowInput: boolean) {
    const playerEntries: [string, PlayerState][] = [];
    this.state.players.forEach((p, id) => playerEntries.push([id, p]));

    // Update each entity
    for (const [id, p] of playerEntries) {
      if (allowInput) {
        if (p.isBot) {
          this.updateBotAI(p);
        }
        // Normalize and apply speed
        const mag = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
        if (mag > 0) {
          p.vx = (p.vx / mag) * PLAYER_SPEED;
          p.vy = (p.vy / mag) * PLAYER_SPEED;
          p.facingX = p.vx > 0 ? 1 : -1;
        }
      } else {
        // Slow down during non-play
        p.vx *= 0.9;
        p.vy *= 0.9;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // Clamp to field
      const half = PLAYER_SIZE / 2;
      if (p.x < half) p.x = half;
      if (p.y < half) p.y = half;
      if (p.x > FIELD_WIDTH - half) p.x = FIELD_WIDTH - half;
      if (p.y > FIELD_HEIGHT - half) p.y = FIELD_HEIGHT - half;
    }

    // Ball-player collisions
    for (const [, p] of playerEntries) {
      this.checkBallPlayerCollision(p);
    }

    // Player-player collisions
    for (let i = 0; i < playerEntries.length; i++) {
      for (let j = i + 1; j < playerEntries.length; j++) {
        this.checkPlayerPlayerCollision(
          playerEntries[i][1],
          playerEntries[j][1],
        );
      }
    }
  }

  private updateBallPhysics(dt: number, playing: boolean) {
    const ball = this.state.ball;
    if (playing) {
      ball.vx *= BALL_FRICTION;
      ball.vy *= BALL_FRICTION;
    } else {
      ball.vx *= 0.9;
      ball.vy *= 0.9;
    }

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    // Top/bottom walls
    if (ball.y < BALL_RADIUS) {
      ball.y = BALL_RADIUS;
      ball.vy *= -0.8;
    }
    if (ball.y > FIELD_HEIGHT - BALL_RADIUS) {
      ball.y = FIELD_HEIGHT - BALL_RADIUS;
      ball.vy *= -0.8;
    }

    // Left/right walls (excluding goal openings)
    const inGoalY =
      ball.y > FIELD_CY - GOAL_HEIGHT / 2 + BALL_RADIUS &&
      ball.y < FIELD_CY + GOAL_HEIGHT / 2 - BALL_RADIUS;

    if (ball.x < BALL_RADIUS) {
      if (!inGoalY || this.state.roundState !== "playing") {
        ball.x = BALL_RADIUS;
        ball.vx *= -0.8;
      }
    }
    if (ball.x > FIELD_WIDTH - BALL_RADIUS) {
      if (!inGoalY || this.state.roundState !== "playing") {
        ball.x = FIELD_WIDTH - BALL_RADIUS;
        ball.vx *= -0.8;
      }
    }
  }

  private checkGoals() {
    const ball = this.state.ball;
    const inGoalY =
      ball.y > FIELD_CY - GOAL_HEIGHT / 2 + BALL_RADIUS &&
      ball.y < FIELD_CY + GOAL_HEIGHT / 2 - BALL_RADIUS;

    if (ball.x < 0 && inGoalY) {
      this.triggerGoal(2); // Team 2 scores in left goal
    } else if (ball.x > FIELD_WIDTH && inGoalY) {
      this.triggerGoal(1); // Team 1 scores in right goal
    }
  }

  private checkBallBorder(dt: number) {
    const ball = this.state.ball;
    const inGoalY =
      ball.y > FIELD_CY - GOAL_HEIGHT / 2 &&
      ball.y < FIELD_CY + GOAL_HEIGHT / 2;
    const nearLeftRight =
      ball.x < BALL_BORDER_THRESHOLD ||
      ball.x > FIELD_WIDTH - BALL_BORDER_THRESHOLD;
    const nearTopBottom =
      ball.y < BALL_BORDER_THRESHOLD ||
      ball.y > FIELD_HEIGHT - BALL_BORDER_THRESHOLD;
    const nearGoalOpening = nearLeftRight && inGoalY;

    if ((nearLeftRight || nearTopBottom) && !nearGoalOpening) {
      this.ballBorderTimer += dt;
      if (this.ballBorderTimer >= BALL_BORDER_RESET_TIME) {
        ball.x = FIELD_CX;
        ball.y = FIELD_CY;
        ball.vx = 0;
        ball.vy = 0;
        this.ballBorderTimer = 0;
        this.broadcast("ball_reset", {});
        console.log(`⚽ Ball reset to center (stuck at border)`);
      }
    } else {
      this.ballBorderTimer = 0;
    }
  }

  private checkBallPlayerCollision(p: PlayerState) {
    const ball = this.state.ball;
    const half = PLAYER_SIZE / 2;
    const dx = ball.x - p.x;
    const dy = ball.y - p.y;
    const dist = Math.hypot(dx, dy);
    const minDist = half + BALL_RADIUS;

    if (dist < minDist && dist > 0) {
      const nx = dx / dist;
      const ny = dy / dist;
      const overlap = minDist - dist;

      ball.x += nx * overlap;
      ball.y += ny * overlap;

      const dot = p.vx * nx + p.vy * ny;
      if (dot > 0) {
        ball.vx += nx * dot * 1.5;
        ball.vy += ny * dot * 1.5;
      } else {
        ball.vx += nx * 100;
        ball.vy += ny * 100;
      }
    }
  }

  private checkPlayerPlayerCollision(a: PlayerState, b: PlayerState) {
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const dist = Math.hypot(dx, dy);
    const minDist = PLAYER_SIZE;

    if (dist < minDist && dist > 0) {
      const overlap = (minDist - dist) * 0.5;
      a.x += (dx / dist) * overlap;
      a.y += (dy / dist) * overlap;
      b.x -= (dx / dist) * overlap;
      b.y -= (dy / dist) * overlap;
    }
  }

  private updateBotAI(bot: PlayerState) {
    const ball = this.state.ball;
    bot.vx = 0;
    bot.vy = 0;

    // Target: the opponent's goal
    const targetGoalX = bot.team === 1 ? FIELD_WIDTH : 0;
    const dirToGoalX = targetGoalX - ball.x;
    const dirToGoalY = FIELD_CY - ball.y;
    const distToGoal = Math.hypot(dirToGoalX, dirToGoalY) || 1;

    const ntx = dirToGoalX / distToGoal;
    const nty = dirToGoalY / distToGoal;

    let approachX = ball.x - ntx * 30;
    let approachY = ball.y - nty * 30;

    const distToBall = Math.hypot(ball.x - bot.x, ball.y - bot.y) || 1;
    const toBallX = (ball.x - bot.x) / distToBall;

    const isBehind =
      (bot.team === 1 && toBallX < -0.2) || (bot.team === 2 && toBallX > 0.2);

    if (isBehind && distToBall < 100) {
      approachX = ball.x - ntx * 80;
      approachY = ball.y + (bot.y > ball.y ? 80 : -80);
    }

    bot.vx = approachX - bot.x;
    bot.vy = approachY - bot.y;
  }

  // ─── End Match ────────────────────────────────────────

  private endMatch() {
    this.state.matchEnded = true;
    this.state.roundState = "waiting";
    this.lock();

    let winnerId = "";
    let winnerName = "";
    let isDraw = false;

    if (this.state.scoreTeam1 > this.state.scoreTeam2) {
      // Team 1 wins — find the human player on team 1 with highest score
      this.state.players.forEach((p, sid) => {
        if (p.team === 1 && !p.isBot) {
          p.score += POINTS_WIN_BONUS;
          if (!winnerId) {
            winnerId = sid;
            winnerName = p.displayName;
          }
        }
      });
    } else if (this.state.scoreTeam2 > this.state.scoreTeam1) {
      this.state.players.forEach((p, sid) => {
        if (p.team === 2 && !p.isBot) {
          p.score += POINTS_WIN_BONUS;
          if (!winnerId) {
            winnerId = sid;
            winnerName = p.displayName;
          }
        }
      });
    } else {
      isDraw = true;
      winnerName = "Nobody";
    }

    this.state.winnerId = winnerId;

    console.log(
      isDraw
        ? `⚽ Draw! ${this.state.scoreTeam1} - ${this.state.scoreTeam2}`
        : `⚽ ${winnerName}'s team wins! ${this.state.scoreTeam1} - ${this.state.scoreTeam2}`,
    );

    this.broadcast("match_end", {
      winnerId,
      winnerName,
      scoreTeam1: this.state.scoreTeam1,
      scoreTeam2: this.state.scoreTeam2,
      isDraw,
    });

    const playerStatsToSave: {
      id: string;
      displayName: string;
      isWinner: boolean;
      score: number;
    }[] = [];
    this.state.players.forEach((p, sid) => {
      if (!p.isBot) {
        playerStatsToSave.push({
          id: p.playerId || sid,
          displayName: p.displayName,
          isWinner:
            !isDraw &&
            ((this.state.scoreTeam1 > this.state.scoreTeam2 && p.team === 1) ||
              (this.state.scoreTeam2 > this.state.scoreTeam1 && p.team === 2)),
          score: p.score,
        });
      }
    });

    savePlayerStats(playerStatsToSave).catch((err) =>
      console.warn(`⚠️ ${err.message}`),
    );
    saveMatchResult({
      roomId: this.roomId,
      winnerId,
      winnerName,
      playerCount: this.getHumanCount(),
      matchDuration: MATCH_DURATION - this.state.matchTimer,
      isDraw,
    }).catch((err) => console.warn(`⚠️ ${err.message}`));

    // After delay, create the next room for the chain (client will show final leaderboard)
    this.resetTimeout = setTimeout(async () => {
      try {
        const nextRoomId = this.roomId + "_gc";
        const { matchMaker } = await import("colyseus");
        await matchMaker.createRoom("arena_room", {
          customRoomId: nextRoomId,
          isTransitionRoom: true,
        });
        this.broadcast("next_game", {
          roomId: nextRoomId,
          roomName: "arena_room",
        });
      } catch (e) {
        console.error("Failed to create next room", e);
      }
    }, MATCH_RESET_DELAY);
  }
}
