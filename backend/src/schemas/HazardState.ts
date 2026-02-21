import { Schema, type } from "@colyseus/schema";

export type HazardType = "falling_block" | "obstacle" | "trap" | "speed_zone";

export class HazardState extends Schema {
  @type("string") id: string = "";
  @type("string") hazardType: string = "falling_block"; // HazardType

  // Position & size
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") width: number = 60;
  @type("float32") height: number = 60;

  // Movement (falling blocks)
  @type("float32") velocityX: number = 0;
  @type("float32") velocityY: number = 0;

  // Rotation (obstacles)
  @type("float32") rotation: number = 0;
  @type("float32") rotationSpeed: number = 0;

  // Targeting (traps)
  @type("string") targetPlayerId: string = "";

  // Speed zones
  @type("float32") speedMultiplier: number = 1;

  // Lifecycle
  @type("boolean") active: boolean = true;
  @type("float32") lifetime: number = 8; // seconds remaining
}
