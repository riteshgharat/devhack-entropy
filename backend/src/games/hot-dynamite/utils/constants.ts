export const ARENA_WIDTH = 800;
export const ARENA_HEIGHT = 600;
export const MAX_PLAYERS = 8;
export const MIN_PLAYERS = 2;
export const PLAYER_SPEED = 280;
export const PLAYER_WIDTH = 24;
export const PLAYER_HEIGHT = 40;
export const TICK_RATE = 30;
export const MATCH_COUNTDOWN = 3;
export const MATCH_RESET_DELAY = 8000;

// Island boundary — circular arena
export const ISLAND_CENTER_X = ARENA_WIDTH / 2;
export const ISLAND_CENTER_Y = ARENA_HEIGHT / 2;
export const ISLAND_RADIUS = 250;

// Dynamite settings
export const DYNAMITE_TIMER_START = 20;     // seconds before explosion (first round)
export const DYNAMITE_TIMER_MIN = 4;        // minimum timer as rounds progress
export const DYNAMITE_TIMER_DECREASE = 0.5; // seconds reduced per round
export const PASS_RADIUS = 42;              // how close players must be to pass
export const STUN_DURATION = 1.2;           // seconds stunned after receiving dynamite
