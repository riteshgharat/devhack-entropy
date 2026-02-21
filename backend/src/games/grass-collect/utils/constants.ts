// ─── Game Constants ───────────────────────────────────────

/** Server tick rate (simulation frames per second) */
export const TICK_RATE = 60;

/** Arena dimensions (world units) */
export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;

/** Player limits per room */
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;

/** Movement */
export const PLAYER_SPEED = 200; // units per second
export const MAX_VELOCITY = 300; // clamp magnitude

/** Spawn */
export const SPAWN_MARGIN = 50; // distance from arena edge for spawning

/** Match countdown (seconds) before the game starts once MIN_PLAYERS join */
export const MATCH_COUNTDOWN = 3;

/** Delay (ms) before room resets after match ends */
export const MATCH_RESET_DELAY = 5000;

/** Grass Collection Game Constants */
export const MATCH_DURATION = 60; // seconds
export const GRASS_COUNT = 50; // total grass to spawn
export const GRASS_RADIUS = 15;
export const PLAYER_RADIUS = 15;
