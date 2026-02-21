import { GameState } from "../schemas/GameState";
import { HazardState } from "../schemas/HazardState";
import { PlayerState } from "../schemas/PlayerState";
import {
  ARENA_WIDTH,
  ARENA_HEIGHT,
  FALLING_BLOCK_SPEED,
  FALLING_BLOCK_SIZE,
  OBSTACLE_SIZE,
  OBSTACLE_ROTATION_SPEED,
  SPEED_ZONE_SIZE,
  TRAP_SIZE,
  HAZARD_LIFETIME,
  BOUNDARY_SHRINK_AMOUNT,
  HAZARD_COLLISION_RADIUS,
} from "../utils/constants";

let hazardCounter = 0;
function nextHazardId(): string {
  return `hazard_${++hazardCounter}_${Date.now()}`;
}

// ─── Arena Mutation Functions ─────────────────────────────

/**
 * Spawn a falling block at a random X position at the top of the arena.
 * The block falls downward and eliminates players on collision.
 */
export function spawnFallingBlock(state: GameState): HazardState {
  const hazard = new HazardState();
  hazard.id = nextHazardId();
  hazard.hazardType = "falling_block";
  hazard.x = Math.random() * (state.arenaBoundaryX - FALLING_BLOCK_SIZE);
  hazard.y = -FALLING_BLOCK_SIZE; // start above arena
  hazard.width = FALLING_BLOCK_SIZE;
  hazard.height = FALLING_BLOCK_SIZE;
  hazard.velocityX = 0;
  hazard.velocityY = FALLING_BLOCK_SPEED;
  hazard.lifetime = HAZARD_LIFETIME;
  hazard.active = true;

  state.hazards.push(hazard);
  console.log(`🧱 Falling block spawned at x=${hazard.x.toFixed(0)}`);
  return hazard;
}

/**
 * Shrink the arena boundary inward by a fixed amount.
 * Players outside the new boundary will be eliminated by the tick loop.
 */
export function shrinkBoundary(state: GameState, amount: number = BOUNDARY_SHRINK_AMOUNT): void {
  const minBoundary = 200; // don't shrink below this
  state.arenaBoundaryX = Math.max(minBoundary, state.arenaBoundaryX - amount);
  state.arenaBoundaryY = Math.max(minBoundary, state.arenaBoundaryY - amount);
  console.log(`📐 Arena shrunk to ${state.arenaBoundaryX.toFixed(0)}x${state.arenaBoundaryY.toFixed(0)}`);
}

/**
 * Spawn a rotating obstacle at a random position in the arena.
 */
export function rotateObstacle(state: GameState): HazardState {
  const hazard = new HazardState();
  hazard.id = nextHazardId();
  hazard.hazardType = "obstacle";
  hazard.x = OBSTACLE_SIZE + Math.random() * (state.arenaBoundaryX - 2 * OBSTACLE_SIZE);
  hazard.y = OBSTACLE_SIZE + Math.random() * (state.arenaBoundaryY - 2 * OBSTACLE_SIZE);
  hazard.width = OBSTACLE_SIZE;
  hazard.height = OBSTACLE_SIZE;
  hazard.rotation = 0;
  hazard.rotationSpeed = OBSTACLE_ROTATION_SPEED * (Math.random() > 0.5 ? 1 : -1);
  hazard.lifetime = HAZARD_LIFETIME * 1.5; // obstacles last longer
  hazard.active = true;

  state.hazards.push(hazard);
  console.log(`🔄 Rotating obstacle spawned at (${hazard.x.toFixed(0)}, ${hazard.y.toFixed(0)})`);
  return hazard;
}

/**
 * Create a speed modifier zone. Players inside get slowed or sped up.
 * If targetId is provided, the zone spawns near that player.
 */
export function speedModifier(
  state: GameState,
  targetId?: string,
  multiplier: number = 0.5
): HazardState {
  const hazard = new HazardState();
  hazard.id = nextHazardId();
  hazard.hazardType = "speed_zone";
  hazard.width = SPEED_ZONE_SIZE;
  hazard.height = SPEED_ZONE_SIZE;
  hazard.speedMultiplier = multiplier;
  hazard.lifetime = HAZARD_LIFETIME;
  hazard.active = true;

  if (targetId) {
    const player = state.players.get(targetId);
    if (player && player.isAlive) {
      // Spawn near the target player
      hazard.x = player.x + (Math.random() - 0.5) * 100;
      hazard.y = player.y + (Math.random() - 0.5) * 100;
      hazard.targetPlayerId = targetId;
    } else {
      hazard.x = Math.random() * state.arenaBoundaryX;
      hazard.y = Math.random() * state.arenaBoundaryY;
    }
  } else {
    hazard.x = Math.random() * state.arenaBoundaryX;
    hazard.y = Math.random() * state.arenaBoundaryY;
  }

  state.hazards.push(hazard);
  console.log(`⚡ Speed zone (${multiplier}x) at (${hazard.x.toFixed(0)}, ${hazard.y.toFixed(0)})`);
  return hazard;
}

/**
 * Spawn a trap directly targeting a specific player's current position.
 */
export function targetPlayerTrap(state: GameState, playerId: string): HazardState | null {
  const player = state.players.get(playerId);
  if (!player || !player.isAlive) return null;

  const hazard = new HazardState();
  hazard.id = nextHazardId();
  hazard.hazardType = "trap";
  // Spawn slightly ahead of the player's movement direction
  hazard.x = player.x + player.velocityX * 0.5;
  hazard.y = player.y + player.velocityY * 0.5;
  hazard.width = TRAP_SIZE;
  hazard.height = TRAP_SIZE;
  hazard.targetPlayerId = playerId;
  hazard.lifetime = HAZARD_LIFETIME * 0.75; // traps expire faster
  hazard.active = true;

  state.hazards.push(hazard);
  console.log(`🪤 Trap targeting ${player.displayName} at (${hazard.x.toFixed(0)}, ${hazard.y.toFixed(0)})`);
  return hazard;
}

// ─── Hazard Tick Processing ───────────────────────────────

/**
 * Update all active hazards: move them, rotate them, expire them.
 * Called every tick from GameRoom.update().
 */
export function updateHazards(state: GameState, dt: number): void {
  const toRemove: number[] = [];

  for (let i = 0; i < state.hazards.length; i++) {
    const h = state.hazards[i];
    if (!h.active) {
      toRemove.push(i);
      continue;
    }

    // Decrease lifetime
    h.lifetime -= dt;
    if (h.lifetime <= 0) {
      h.active = false;
      toRemove.push(i);
      continue;
    }

    // Move (falling blocks)
    if (h.hazardType === "falling_block") {
      h.x += h.velocityX * dt;
      h.y += h.velocityY * dt;

      // Remove if fallen below arena
      if (h.y > state.arenaBoundaryY + 100) {
        h.active = false;
        toRemove.push(i);
      }
    }

    // Rotate (obstacles)
    if (h.hazardType === "obstacle") {
      h.rotation += h.rotationSpeed * dt;
    }
  }

  // Remove expired hazards (iterate in reverse to preserve indices)
  for (let i = toRemove.length - 1; i >= 0; i--) {
    state.hazards.splice(toRemove[i], 1);
  }
}

/**
 * Check for collisions between alive players and active hazards.
 * Returns array of { sessionId, player, hazard } for each collision.
 */
export function checkHazardCollisions(
  state: GameState
): Array<{ sessionId: string; player: PlayerState; hazard: HazardState }> {
  const collisions: Array<{ sessionId: string; player: PlayerState; hazard: HazardState }> = [];

  state.players.forEach((player: PlayerState, sessionId: string) => {
    if (!player.isAlive) return;

    for (let i = 0; i < state.hazards.length; i++) {
      const h = state.hazards[i];
      if (!h.active) continue;

      // Skip speed zones — they don't kill, they modify speed
      if (h.hazardType === "speed_zone") continue;

      // Simple AABB collision check
      const dx = player.x - (h.x + h.width / 2);
      const dy = player.y - (h.y + h.height / 2);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < HAZARD_COLLISION_RADIUS + Math.max(h.width, h.height) / 2) {
        collisions.push({ sessionId, player, hazard: h });
      }
    }
  });

  return collisions;
}

/**
 * Check if a player is inside a speed zone and return the multiplier.
 * Returns 1.0 if no speed zone applies.
 */
export function getSpeedMultiplier(state: GameState, player: PlayerState): number {
  for (let i = 0; i < state.hazards.length; i++) {
    const h = state.hazards[i];
    if (!h.active || h.hazardType !== "speed_zone") continue;

    const dx = player.x - (h.x + h.width / 2);
    const dy = player.y - (h.y + h.height / 2);
    if (Math.abs(dx) < h.width / 2 && Math.abs(dy) < h.height / 2) {
      return h.speedMultiplier;
    }
  }
  return 1.0;
}
