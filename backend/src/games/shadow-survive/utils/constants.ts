// ─── Shadow Survive Game Constants ───────────────────────────────────────

/** Server tick rate (simulation frames per second) */
export const TICK_RATE = 60;

/** Arena dimensions (world units) */
export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;

/** Player limits per room */
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 1; // Allow 1 for testing if needed, though lobby says 2

/** Movement */
export const PLAYER_SPEED = 300; 
export const MAX_VELOCITY_X = 500;
export const JUMP_FORCE = -850;
export const GRAVITY = 1800;

/** Spawn */
export const SPAWN_X_MARGIN = 100;

/** Match countdown (seconds) */
export const MATCH_COUNTDOWN = 3;

/** Delay (ms) before room resets after match ends */
export const MATCH_RESET_DELAY = 5000;

/** Bouncy Tiles Game Specifics */
export const PLATFORM_SPEED_START = 0;
export const PLATFORM_SPEED_MAX = 0;
export const PLATFORM_WIDTH = 120;
export const PLATFORM_HEIGHT = 20;
export const PLAYER_WIDTH = 30;
export const PLAYER_HEIGHT = 40;
export const TRAP_CHANCE = 0.2;
export const SCORE_PER_SECOND = 10;
export const SURVIVAL_BONUS_INCREMENT = 0.5; // Difficulty increases over time
