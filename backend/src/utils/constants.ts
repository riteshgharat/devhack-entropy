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

/** Elimination boundary buffer – once outside this, player is eliminated */
export const ELIMINATION_BUFFER = 20;

/** Match countdown (seconds) before the game starts once MIN_PLAYERS join */
export const MATCH_COUNTDOWN = 3;

/** Delay (ms) before room resets after match ends */
export const MATCH_RESET_DELAY = 5000;

/** Hazard defaults */
export const HAZARD_LIFETIME = 8; // seconds before a hazard expires
export const FALLING_BLOCK_SPEED = 150; // units/sec downward
export const FALLING_BLOCK_SIZE = 60;
export const OBSTACLE_SIZE = 50;
export const OBSTACLE_ROTATION_SPEED = 2; // radians/sec
export const SPEED_ZONE_SIZE = 80;
export const TRAP_SIZE = 40;
export const BOUNDARY_SHRINK_AMOUNT = 20; // units per shrink call
export const HAZARD_COLLISION_RADIUS = 25; // simplified circle collision
