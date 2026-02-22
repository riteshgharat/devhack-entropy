import { Schema, type, MapSchema } from "@colyseus/schema";

export class BallState extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
}

export class PlayerState extends Schema {
  @type("string") playerId: string = "";
  @type("string") displayName: string = "Player";
  @type("string") color: string = "#ef4444";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") vx: number = 0;
  @type("number") vy: number = 0;
  @type("number") team: number = 1; // 1 = left, 2 = right
  @type("boolean") isBot: boolean = false;
  @type("number") score: number = 0;
  @type("number") facingX: number = 1;
}

export class TurfSoccerState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type(BallState) ball = new BallState();

  @type("number") scoreTeam1: number = 0;
  @type("number") scoreTeam2: number = 0;

  @type("boolean") matchStarted: boolean = false;
  @type("boolean") matchEnded: boolean = false;
  @type("number") countdown: number = 0;
  @type("number") matchTimer: number = 90;

  @type("string") roundState: string = "waiting"; // waiting, countdown, playing, goal
  @type("number") roundDelay: number = 0;
  @type("string") winnerId: string = "";
}
