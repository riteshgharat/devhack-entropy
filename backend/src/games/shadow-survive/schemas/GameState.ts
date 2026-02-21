import { Schema, MapSchema, ArraySchema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";
import { PlatformState } from "./PlatformState";

export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type([PlatformState]) platforms = new ArraySchema<PlatformState>();

  @type("boolean") matchStarted: boolean = false;
  @type("boolean") matchEnded: boolean = false;
  @type("float32") matchTimer: number = 0;

  @type("float32") arenaBoundaryX: number = 800;
  @type("float32") arenaBoundaryY: number = 600;

  @type("string") winnerId: string = "";
  @type("uint8") countdown: number = 0;
  @type("string") lastEvent: string = "";
  
  @type("float32") difficultyScale: number = 1;
  @type("uint16") level: number = 1;
}
