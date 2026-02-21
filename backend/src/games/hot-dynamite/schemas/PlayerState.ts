import { Schema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") velocityX: number = 0;
  @type("float32") velocityY: number = 0;
  @type("boolean") isAlive: boolean = true;
  @type("boolean") hasDynamite: boolean = false;
  @type("float32") stunTimer: number = 0;
  @type("string") displayName: string = "";
  @type("string") playerId: string = "";
  @type("string") color: string = "#ef4444";
}
