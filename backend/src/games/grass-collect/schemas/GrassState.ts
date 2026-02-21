import { Schema, type } from "@colyseus/schema";

export class GrassState extends Schema {
  @type("string") id: string = "";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
}
