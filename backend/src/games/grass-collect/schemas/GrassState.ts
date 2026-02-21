import { Schema, type } from "@colyseus/schema";

export class GrassState extends Schema {
  @type("string") id: string = "";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  /** 1 = big grass (first pass), 2 = small grass (second pass) */
  @type("uint8") phase: number = 1;
  /** Hidden power-up under small grass: "" | "bomb" | "rocket" | "speed" */
  @type("string") powerUp: string = "";
}