import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";
import { ItemState } from "./GrassState";

export class GameState extends Schema {
  /** Map of sessionId → PlayerState */
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  /** Active items (mines, boosters) */
  @type([ItemState]) items = new ArraySchema<ItemState>();

  /** Grid of grass states (0=dirt, 1=cut once, 2=full grass) */
  @type(["uint8"]) grid = new ArraySchema<number>();

  /** Has the match started? */
  @type("boolean") matchStarted: boolean = false;

  /** Is the match over? */
  @type("boolean") matchEnded: boolean = false;

  /** Time remaining in seconds */
  @type("float32") matchTimer: number = 60;

  /** Current arena boundary */
  @type("float32") arenaBoundaryX: number = 800;
  @type("float32") arenaBoundaryY: number = 600;

  /** Session ID of the match winner */
  @type("string") winnerId: string = "";

  /** Countdown seconds before match starts (0 = go) */
  @type("uint8") countdown: number = 0;

  /** Last event label (broadcast to clients for UI) */
  @type("string") lastEvent: string = "";
}
