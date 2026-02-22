// ─── Shared types for AI Communication Layer ────────────────────────────────

export interface ChatMessage {
  id: string;
  playerId: string;
  displayName: string;
  text: string;
  createdAt: number;
}

export interface EmojiEvent {
  id: string;
  playerId: string;
  displayName: string;
  emoji: string;
  createdAt: number;
}

export interface AICommentary {
  id: string;
  text: string;
  tone: 'hype' | 'tense' | 'funny' | 'dramatic';
  createdAt: number;
}

export interface AIOverlay {
  id: string;
  title: string;
  subtitle?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  durationMs: number;
}

export type ArenaEventType =
  | 'none'
  | 'shrink_boundary'
  | 'spawn_random_hazard'
  | 'speed_up'
  | 'slow_mo'
  | 'spotlight_player';

export interface ArenaEvent {
  type: ArenaEventType;
  payload?: Record<string, unknown>;
}

export interface AIEmojiBurst {
  emoji: string;
  target: 'all' | 'leader' | 'weakest';
}

export interface AIOutput {
  commentary: AICommentary[];
  overlay: AIOverlay | null;
  emojiBurst: AIEmojiBurst | null;
  arenaEvent: ArenaEvent;
}

export interface AIInput {
  roomType: 'grass' | 'red_dynamite' | 'turf_soccer';
  timeRemaining: number;
  aliveCount: number;
  totalPlayers: number;
  leader: { name: string; score: number } | null;
  weakest: { name: string; score: number } | null;
  recentEvents: string[];
  chatHighlights: string[];
}
