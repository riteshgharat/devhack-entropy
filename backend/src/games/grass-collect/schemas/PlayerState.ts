import { Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  /** Horizontal position (world units) */
  @type("float32") x: number = 0;

  /** Vertical position (world units) */
  @type("float32") y: number = 0;

  /** Horizontal velocity */
  @type("float32") velocityX: number = 0;

  /** Vertical velocity */
  @type("float32") velocityY: number = 0;

  /** Grass collected */
  @type("uint16") score: number = 0;

  /** Speed multiplier (e.g., from speed booster) */
  @type("float32") speedMultiplier: number = 1;

  /** Time left for stun effect (e.g., from bomb or rocket) */
  @type("float32") stunTimer: number = 0;

  /** Display name shown in-game */
  @type("string") displayName: string = "";

  /** Unique player ID */
  @type("string") playerId: string = "";

  /** Player color */
  @type("string") color: string = "#ffffff";
}
