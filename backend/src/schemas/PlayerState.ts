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

  /** Whether this player is still in the match */
  @type("boolean") isAlive: boolean = true;

  /** Seconds survived in the current match */
  @type("float32") survivalTime: number = 0;

  /** Display name shown in-game */
  @type("string") displayName: string = "";
}
