import { Schema, type } from "@colyseus/schema";

export class PlatformState extends Schema {
  @type("string") id: string = "";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("float32") width: number = 120;
  @type("float32") height: number = 20;
  @type("string") type: string = "normal";
}
