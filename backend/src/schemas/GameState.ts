import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";
import { HazardState } from "./HazardState";

export class GameState extends Schema {
  /** Map of sessionId → PlayerState */
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  /** Active arena hazards */
  @type([HazardState]) hazards = new ArraySchema<HazardState>();

  /** Has the match started? */
  @type("boolean") matchStarted: boolean = false;

  /** Is the match over? */
  @type("boolean") matchEnded: boolean = false;

  /** Elapsed match time in seconds */
  @type("float32") matchTimer: number = 0;

  /** Current arena boundary (mutable — shrinks over time) */
  @type("float32") arenaBoundaryX: number = 800;
  @type("float32") arenaBoundaryY: number = 600;

  /** Number of players currently alive */
  @type("uint8") aliveCount: number = 0;

  /** Session ID of the match winner */
  @type("string") winnerId: string = "";

  /** Countdown seconds before match starts (0 = go) */
  @type("uint8") countdown: number = 0;

  /** Session ID of the current leader (highest survivalTime) */
  @type("string") leaderId: string = "";

  /** Session ID of the current weakest (lowest survivalTime) */
  @type("string") weakestId: string = "";

  /** Last arena mutation event label (broadcast to clients for UI) */
  @type("string") lastArenaEvent: string = "";
}
