import { Schema, type, MapSchema } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("string") playerId: string = "";
  @type("string") displayName: string = "Player";
  @type("string") color: string = "#ef4444";

  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") velocityX: number = 0;
  @type("number") velocityY: number = 0;

  @type("boolean") isAlive: boolean = true;
  @type("boolean") hasDynamite: boolean = false;
  @type("number") passCooldown: number = 0;
  @type("number") score: number = 0; // Points for surviving
}

export class RedDynamiteState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  @type("boolean") matchStarted: boolean = false;
  @type("boolean") matchEnded: boolean = false;
  @type("number") countdown: number = 0;
  @type("number") matchTimer: number = 0; // Time remaining in match (seconds)

  @type("string") roundState: string = "waiting"; // waiting, playing, explosionDelay
  @type("number") currentDynamiteTimer: number = 0;
  @type("number") maxTimer: number = 20; // Max timer for dynamite (seconds)
  @type("number") roundDelay: number = 0;

  @type("string") winnerId: string = "";
  @type("string") lastEvent: string = "";
}
