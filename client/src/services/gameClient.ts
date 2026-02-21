import { Client, Room } from "colyseus.js";

const ENDPOINT = window.location.hostname === "localhost" 
  ? "ws://localhost:3000" 
  : `ws://${window.location.hostname}:3000`;

export class GameClient {
  private client: Client;
  private room: Room | null = null;

  constructor() {
    this.client = new Client(ENDPOINT);
  }

  async joinOrCreate(roomName: string, options: any = {}) {
    try {
      this.room = await this.client.joinOrCreate(roomName, options);
      return this.room;
    } catch (error) {
      console.error("Failed to join or create room:", error);
      throw error;
    }
  }

  async join(roomId: string, options: any = {}) {
    try {
      this.room = await this.client.joinById(roomId, options);
      return this.room;
    } catch (error) {
      console.error("Failed to join room:", error);
      throw error;
    }
  }

  getRoom() {
    return this.room;
  }

  leave() {
    if (this.room) {
      this.room.leave();
      this.room = null;
    }
  }

  sendMove(dx: number, dy: number) {
    if (this.room) {
      this.room.send("move", { dx, dy });
    }
  }
}

export const gameClient = new GameClient();
