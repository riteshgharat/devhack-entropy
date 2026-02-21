import { Schema, MapSchema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  @type("boolean") matchStarted: boolean = false;
  @type("boolean") matchEnded: boolean = false;
  @type("float32") matchTimer: number = 0;

  @type("float32") arenaBoundaryX: number = 800;
  @type("float32") arenaBoundaryY: number = 600;

  @type("string") winnerId: string = "";
  @type("uint8") countdown: number = 0;
  @type("string") lastEvent: string = "";

  @type("uint8") round: number = 0;
  @type("float32") dynamiteTimer: number = 0;
  @type("string") dynamiteHolderId: string = "";
}
