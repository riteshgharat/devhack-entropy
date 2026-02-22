import { Room } from "@colyseus/core";
import { ChatMessage, EmojiEvent, AIInput, AIOutput } from "./types";
import { callGemini } from "./geminiService";

// How often the AI Game-Master fires (ms)
const AI_INTERVAL_MS = 10000;
// Per-player emoji cooldown (ms)
const EMOJI_COOLDOWN_MS = 2500;
// Max chat history kept in memory
const MAX_CHAT = 30;

type RoomType = "grass" | "red_dynamite" | "turf_soccer";

// Minimal interface so we don't import concrete room classes
interface IRoom {
  roomId: string;
  broadcast(type: string, data?: any, options?: { except?: any }): void;
  onMessage(type: string, handler: (client: any, data: any) => void): void;
  clients: any[];
  state: any;
}

export class RoomComms {
  private room: IRoom;
  private roomType: RoomType;
  private chat: ChatMessage[] = [];
  private emojiCooldowns = new Map<string, number>();
  private aiTimer = 0;
  private aiRunning = false;
  private recentEvents: string[] = [];
  private latestOutput: AIOutput | null = null;
  /** sessionId → displayName for current voice participants */
  private voiceParticipants = new Map<string, string>();

  constructor(room: IRoom, roomType: RoomType) {
    this.room = room;
    this.roomType = roomType;
    this._registerHandlers();
  }

  // ─── Call from the room's update/tick loop ─────────────────────────────────
  tick(deltaTimeMs: number) {
    this.aiTimer += deltaTimeMs;
    if (this.aiTimer >= AI_INTERVAL_MS && !this.aiRunning) {
      this.aiTimer = 0;
      this._runAI();
    }
  }

  // ─── Push notable game events for AI context (e.g. "player X eliminated") ─
  addEvent(description: string) {
    this.recentEvents.push(description);
    if (this.recentEvents.length > 15) this.recentEvents.shift();
  }

  // ─── Return the last AI output (optional: rooms can use this to apply arena events) ──
  getLatestOutput(): AIOutput | null {
    return this.latestOutput;
  }

  /** Call from the room's onLeave to clean up voice state */
  onClientLeave(sessionId: string): void {
    if (this.voiceParticipants.has(sessionId)) {
      this.voiceParticipants.delete(sessionId);
      this.room.broadcast("voice_left", { sessionId });
    }
  }

  // ─── Message handlers ──────────────────────────────────────────────────────
  private _registerHandlers() {
    this.room.onMessage("chat_message", (client: any, payload: any) => {
      const text = String(payload?.text ?? "")
        .trim()
        .slice(0, 200);
      if (!text) return;

      const state = this.room.state;
      const player = state?.players?.get?.(client.sessionId);
      const displayName =
        player?.displayName || `Player_${client.sessionId.slice(0, 4)}`;
      const playerId = player?.playerId || client.sessionId;

      const msg: ChatMessage = {
        id: `chat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        playerId,
        displayName,
        text,
        createdAt: Date.now(),
      };

      this.chat.push(msg);
      if (this.chat.length > MAX_CHAT) this.chat.shift();
      this.room.broadcast("chat_message", msg);
    });

    this.room.onMessage("emoji_reaction", (client: any, payload: any) => {
      const emoji = String(payload?.emoji ?? "🔥")
        .trim()
        .slice(0, 2);
      if (!emoji) return;

      const key = `${client.sessionId}_${emoji}`;
      const last = this.emojiCooldowns.get(key) ?? 0;
      if (Date.now() - last < EMOJI_COOLDOWN_MS) return; // enforce cooldown
      this.emojiCooldowns.set(key, Date.now());

      const state = this.room.state;
      const player = state?.players?.get?.(client.sessionId);
      const displayName =
        player?.displayName || `Player_${client.sessionId.slice(0, 4)}`;
      const playerId = player?.playerId || client.sessionId;

      const event: EmojiEvent = {
        id: `emoji_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        playerId,
        displayName,
        emoji,
        createdAt: Date.now(),
      };

      this.room.broadcast("emoji_reaction", event);
    });

    // ─── WebRTC Voice Chat Signaling ──────────────────────────────────────────

    /** Client wants to join voice chat */
    this.room.onMessage("voice_join", (client: any) => {
      const state = this.room.state;
      const player = state?.players?.get?.(client.sessionId);
      const displayName =
        player?.displayName || `Player_${client.sessionId.slice(0, 4)}`;

      this.voiceParticipants.set(client.sessionId, displayName);

      // Tell this newcomer who's already in voice
      const existingPeers = Array.from(this.voiceParticipants.entries())
        .filter(([id]) => id !== client.sessionId)
        .map(([sessionId, name]) => ({ sessionId, displayName: name }));

      client.send("voice_peers", { peers: existingPeers });

      // Notify everyone else that this person joined
      this._sendToOthers(client.sessionId, "voice_joined", {
        sessionId: client.sessionId,
        displayName,
      });
    });

    /** Client leaving voice chat */
    this.room.onMessage("voice_leave", (client: any) => {
      this.voiceParticipants.delete(client.sessionId);
      this.room.broadcast("voice_left", { sessionId: client.sessionId });
    });

    /** Relay SDP offer to a specific peer */
    this.room.onMessage("voice_offer", (client: any, payload: any) => {
      const target = this._findClient(payload?.to);
      if (target) {
        target.send("voice_offer", {
          from: client.sessionId,
          sdp: payload.sdp,
        });
      }
    });

    /** Relay SDP answer to a specific peer */
    this.room.onMessage("voice_answer", (client: any, payload: any) => {
      const target = this._findClient(payload?.to);
      if (target) {
        target.send("voice_answer", {
          from: client.sessionId,
          sdp: payload.sdp,
        });
      }
    });

    /** Relay ICE candidate to a specific peer */
    this.room.onMessage("voice_ice", (client: any, payload: any) => {
      const target = this._findClient(payload?.to);
      if (target) {
        target.send("voice_ice", {
          from: client.sessionId,
          candidate: payload.candidate,
        });
      }
    });

    /** Broadcast speaking status (throttled by client) */
    this.room.onMessage("voice_speaking", (client: any, payload: any) => {
      this.room.broadcast(
        "voice_speaking",
        {
          sessionId: client.sessionId,
          speaking: !!payload?.speaking,
        },
        { except: client },
      );
    });
  }

  // ─── Voice signaling helpers ────────────────────────────────────────────────

  private _findClient(sessionId: string): any | null {
    return (
      this.room.clients.find((c: any) => c.sessionId === sessionId) ?? null
    );
  }

  private _sendToOthers(
    excludeSessionId: string,
    type: string,
    data: any,
  ): void {
    this.room.clients.forEach((c: any) => {
      if (c.sessionId !== excludeSessionId) {
        c.send(type, data);
      }
    });
  }

  // ─── AI tick ───────────────────────────────────────────────────────────────
  private async _runAI() {
    this.aiRunning = true;
    try {
      const input = this._buildAIInput();
      const output = await callGemini(input);
      this.latestOutput = output;
      this._broadcastOutput(output);
    } catch (err) {
      console.warn("[RoomComms] AI tick error:", err);
    } finally {
      this.aiRunning = false;
    }
  }

  private _buildAIInput(): AIInput {
    const state = this.room.state;
    const players: any[] = [];
    state?.players?.forEach?.((p: any) => players.push(p));

    const alive = players.filter((p) => p.isAlive !== false);
    const sorted = [...players].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const leader = sorted[0]
      ? {
          name: sorted[0].displayName || "Unknown",
          score: sorted[0].score ?? 0,
        }
      : null;
    const weakest =
      sorted[sorted.length - 1] && sorted.length > 1
        ? {
            name: sorted[sorted.length - 1].displayName || "Unknown",
            score: sorted[sorted.length - 1].score ?? 0,
          }
        : null;

    return {
      roomType: this.roomType,
      timeRemaining: state?.matchTimer ?? 60,
      aliveCount: alive.length || players.length,
      totalPlayers: players.length,
      leader,
      weakest,
      recentEvents: [...this.recentEvents],
      chatHighlights: this.chat
        .slice(-5)
        .map((c) => `${c.displayName}: ${c.text}`),
    };
  }

  private _broadcastOutput(output: AIOutput) {
    // Send AI commentary as chat messages from "AI GAME-MASTER"
    if (output.commentary.length > 0) {
      output.commentary.forEach((comment) => {
        const aiMsg: ChatMessage = {
          id: comment.id,
          playerId: "ai_game_master",
          displayName: "🎮 AI GAME-MASTER",
          text: comment.text,
          createdAt: comment.createdAt,
        };
        this.chat.push(aiMsg);
        if (this.chat.length > MAX_CHAT) this.chat.shift();
        this.room.broadcast("chat_message", aiMsg);
      });
    }
    if (output.overlay) {
      this.room.broadcast("ai_overlay", output.overlay);
    }
    if (output.emojiBurst) {
      this.room.broadcast("ai_emoji_burst", output.emojiBurst);
    }
    if (output.arenaEvent && output.arenaEvent.type !== "none") {
      this.room.broadcast("arena_event", output.arenaEvent);
      console.log(
        `[RoomComms] Arena event broadcasted: ${output.arenaEvent.type}`,
      );
    }
  }
}
