import { Schema, type } from "@colyseus/schema";

export class ItemState extends Schema {
  @type("string") id: string = "";
  @type("float32") x: number = 0;
  @type("float32") y: number = 0;
  @type("string") type: string = ""; // 'mine' or 'booster'
  @type("boolean") revealed: boolean = false;
  @type("boolean") active: boolean = true;
  @type("float32") timer: number = 0;
}
