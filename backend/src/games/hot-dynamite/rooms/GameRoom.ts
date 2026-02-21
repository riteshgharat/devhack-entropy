import { Room, Client } from "colyseus";
import { GameState } from "../schemas/GameState";
import { PlayerState } from "../schemas/PlayerState";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  MAX_PLAYERS,
  MIN_PLAYERS,
  PLAYER_SPEED,
  MATCH_COUNTDOWN,
  MATCH_RESET_DELAY,
  TICK_RATE,
  DYNAMITE_TIMER_START,
  DYNAMITE_TIMER_MIN,
  DYNAMITE_TIMER_DECREASE,
  PASS_RADIUS,
  STUN_DURATION,
  ISLAND_CENTER_X,
  ISLAND_CENTER_Y,
  ISLAND_RADIUS,
} from "../utils/constants";
import { savePlayerStats } from "../../../db/matchHistory";

interface MoveInput {
  dx: number;
  dy: number;
}

export class HotDynamiteRoom extends Room<GameState> {
  private countdownInterval: ReturnType<typeof setInterval> | null = null;
  private resetTimeout: ReturnType<typeof setTimeout> | null = null;

  async onCreate(options: any) {
    if (options.customRoomId) this.roomId = options.customRoomId;
    this.state = new GameState();
    this.maxClients = MAX_PLAYERS;
    this.state.arenaBoundaryX = ARENA_WIDTH;
    this.state.arenaBoundaryY = ARENA_HEIGHT;

    this.onMessage("move", (client: Client, data: MoveInput) => {
      this.handleInput(client, data);
    });

    this.setSimulationInterval((dt: number) => this.update(dt), 1000 / TICK_RATE);
  }

  onJoin(client: Client, options: any) {
    const player = new PlayerState();
    player.displayName = options?.displayName || `Player_${client.sessionId.slice(0, 4)}`;
    player.playerId = options?.playerId || client.sessionId;
    const colors = ["#ef4444", "#3b82f6", "#22c55e", "#eab308", "#a855f7", "#f97316", "#ec4899", "#06b6d4"];
    player.color = options?.color || colors[this.state.players.size % colors.length];
    this.spawnPlayerOnIsland(player);
    this.state.players.set(client.sessionId, player);
    this.tryStartCountdown();
  }

  onLeave(client: Client) {
    const player = this.state.players.get(client.sessionId);
    const hadDynamite = player?.hasDynamite;
    this.state.players.delete(client.sessionId);
    if (hadDynamite && this.state.matchStarted && !this.state.matchEnded) {
      this.state.dynamiteHolderId = "";
      this.assignDynamiteRandom();
    }
    if (this.state.matchStarted && !this.state.matchEnded) this.checkForWinner();
  }

  private handleInput(client: Client, data: MoveInput) {
    const player = this.state.players.get(client.sessionId);
    if (!player || !player.isAlive || !this.state.matchStarted || this.state.matchEnded) return;
    if (player.stunTimer > 0) return;
    player.velocityX = (data.dx || 0) * PLAYER_SPEED;
    player.velocityY = (data.dy || 0) * PLAYER_SPEED;
  }

  private update(deltaTime: number) {
    const dt = deltaTime / 1000;
    if (!this.state.matchStarted || this.state.matchEnded) return;
    this.state.matchTimer += dt;

    // Dynamite countdown
    if (this.state.dynamiteHolderId) {
      this.state.dynamiteTimer -= dt;
      if (this.state.dynamiteTimer <= 0) { this.explodeDynamite(); return; }
    }

    // Update players
    this.state.players.forEach((player, sessionId) => {
      if (!player.isAlive) return;

      if (player.stunTimer > 0) {
        player.stunTimer = Math.max(0, player.stunTimer - dt);
      }

      player.x += player.velocityX * dt;
      player.y += player.velocityY * dt;

      // Friction
      player.velocityX *= 0.88;
      player.velocityY *= 0.88;

      // ── Circular island boundary ──
      const dx = player.x - ISLAND_CENTER_X;
      const dy = player.y - ISLAND_CENTER_Y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > ISLAND_RADIUS - 14) {
        // Push back inside
        const angle = Math.atan2(dy, dx);
        player.x = ISLAND_CENTER_X + Math.cos(angle) * (ISLAND_RADIUS - 14);
        player.y = ISLAND_CENTER_Y + Math.sin(angle) * (ISLAND_RADIUS - 14);
        // Reflect velocity inward
        const dot = player.velocityX * Math.cos(angle) + player.velocityY * Math.sin(angle);
        if (dot > 0) {
          player.velocityX -= 2 * dot * Math.cos(angle) * 0.5;
          player.velocityY -= 2 * dot * Math.sin(angle) * 0.5;
        }
      }
    });

    // Dynamite passing (collision)
    if (this.state.dynamiteHolderId) {
      const holder = this.state.players.get(this.state.dynamiteHolderId);
      if (holder && holder.isAlive && holder.stunTimer <= 0) {
        this.state.players.forEach((other, otherId) => {
          if (otherId === this.state.dynamiteHolderId || !other.isAlive || other.stunTimer > 0) return;
          const dx = holder.x - other.x;
          const dy = holder.y - other.y;
          if (Math.sqrt(dx * dx + dy * dy) < PASS_RADIUS) {
            this.passDynamite(this.state.dynamiteHolderId, otherId);
          }
        });
      }
    }
  }

  private passDynamite(fromId: string, toId: string) {
    const from = this.state.players.get(fromId);
    const to = this.state.players.get(toId);
    if (!from || !to) return;

    from.hasDynamite = false;
    to.hasDynamite = true;
    to.stunTimer = STUN_DURATION;
    this.state.dynamiteHolderId = toId;

    // Push apart
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const push = 320;
    to.velocityX = (dx / dist) * push;
    to.velocityY = (dy / dist) * push;
    from.velocityX = -(dx / dist) * push * 0.4;
    from.velocityY = -(dy / dist) * push * 0.4;

    this.state.lastEvent = `${from.displayName} → ${to.displayName}!`;
    this.broadcast("dynamite_passed", { from: fromId, to: toId });
  }

  private explodeDynamite() {
    const holderId = this.state.dynamiteHolderId;
    const holder = this.state.players.get(holderId);
    if (!holder) return;

    holder.isAlive = false;
    holder.hasDynamite = false;
    this.state.dynamiteHolderId = "";
    this.state.dynamiteTimer = 0;
    this.state.lastEvent = `💥 ${holder.displayName} EXPLODED!`;
    this.broadcast("player_eliminated", { sessionId: holderId, displayName: holder.displayName });

    if (!this.checkForWinner()) {
      setTimeout(() => { if (!this.state.matchEnded) this.startNewRound(); }, 2000);
    }
  }

  private checkForWinner(): boolean {
    const alive = Array.from(this.state.players.entries()).filter(([_, p]) => p.isAlive);
    if (alive.length <= 1) {
      if (alive.length === 1) {
        this.state.winnerId = alive[0][0];
        this.state.lastEvent = `🏆 ${alive[0][1].displayName} WINS!`;
      }
      this.endMatch();
      return true;
    }
    return false;
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
    this.state.round = 0;
    this.state.players.forEach(p => {
      p.isAlive = true;
      p.hasDynamite = false;
      p.stunTimer = 0;
      this.spawnPlayerOnIsland(p);
    });
    this.broadcast("match_start", { playerCount: this.state.players.size });
    this.startNewRound();
  }

  private startNewRound() {
    this.state.round++;
    const timer = Math.max(DYNAMITE_TIMER_MIN, DYNAMITE_TIMER_START - (this.state.round - 1) * DYNAMITE_TIMER_DECREASE);
    this.state.dynamiteTimer = timer;
    this.state.players.forEach(p => { if (p.isAlive) { p.hasDynamite = false; p.stunTimer = 0; } });
    this.assignDynamiteRandom();
    this.state.lastEvent = `Round ${this.state.round} — ${timer.toFixed(0)}s fuse!`;
    this.broadcast("round_start", { round: this.state.round, timer });
  }

  private assignDynamiteRandom() {
    const alive = Array.from(this.state.players.entries()).filter(([_, p]) => p.isAlive);
    if (alive.length === 0) return;
    const [id, player] = alive[Math.floor(Math.random() * alive.length)];
    player.hasDynamite = true;
    player.stunTimer = STUN_DURATION;
    this.state.dynamiteHolderId = id;
  }

  private spawnPlayerOnIsland(player: PlayerState) {
    // Spawn within the circular island
    const angle = Math.random() * Math.PI * 2;
    const r = Math.random() * (ISLAND_RADIUS - 40);
    player.x = ISLAND_CENTER_X + Math.cos(angle) * r;
    player.y = ISLAND_CENTER_Y + Math.sin(angle) * r;
    player.velocityX = 0;
    player.velocityY = 0;
  }

  private endMatch() {
    this.state.matchEnded = true;
    const stats: any[] = [];
    this.state.players.forEach((p, id) => {
      stats.push({ id: p.playerId || id, displayName: p.displayName, isWinner: id === this.state.winnerId, score: id === this.state.winnerId ? 1 : 0 });
    });
    savePlayerStats(stats).catch(console.error);
    this.broadcast("match_end", { winnerId: this.state.winnerId, winnerName: this.state.players.get(this.state.winnerId)?.displayName || "Nobody" });
    this.resetTimeout = setTimeout(() => this.resetMatch(), MATCH_RESET_DELAY);
  }

  private resetMatch() {
    this.state.matchStarted = false;
    this.state.matchEnded = false;
    this.state.winnerId = "";
    this.state.dynamiteHolderId = "";
    this.state.dynamiteTimer = 0;
    this.state.round = 0;
    this.state.players.forEach(p => { p.isAlive = true; p.hasDynamite = false; p.stunTimer = 0; });
    this.tryStartCountdown();
  }
}
