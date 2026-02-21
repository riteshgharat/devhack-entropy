import { Schema, MapSchema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";

export class GameState extends Schema {
  /** Map of sessionId → PlayerState */
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  /** Has the match started? */
  @type("boolean") matchStarted: boolean = false;

  /** Elapsed match time in seconds */
  @type("float32") matchTimer: number = 0;

  /** Current arena boundary size (can shrink over time) */
  @type("float32") arenaBoundaryX: number = 800;
  @type("float32") arenaBoundaryY: number = 600;

  /** Number of players currently alive */
  @type("uint8") aliveCount: number = 0;

  /** Session ID of the match winner (empty until match ends) */
  @type("string") winnerId: string = "";

  /** Is the match over? */
  @type("boolean") matchEnded: boolean = false;

  /** Countdown seconds before match starts (0 = go) */
  @type("uint8") countdown: number = 0;
}
