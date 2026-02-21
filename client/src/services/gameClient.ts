import { Client, Room } from "colyseus.js";

const ENDPOINT =
  import.meta.env.VITE_BACKEND_URL?.replace(/^http/, "ws") ||
  "ws://localhost:3000";

export class GameClient {
  private client: Client;
  private room: Room | null = null;

  constructor() {
    this.client = new Client(ENDPOINT);
  }

  private getHeaders() {
    const headers: Record<string, string> = {};
    if (import.meta.env.VITE_NGROK === 'true') {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    return headers;
  }

  async joinOrCreate(roomName: string, options: any = {}) {
    try {
      this.room = await this.client.joinOrCreate(roomName, { ...options, headers: this.getHeaders() });
      return this.room;
    } catch (error) {
      console.error("Failed to join or create room:", error);
      throw error;
    }
  }

  async create(roomName: string, options: any = {}) {
    try {
      this.room = await this.client.create(roomName, { ...options, headers: this.getHeaders() });
      return this.room;
    } catch (error) {
      console.error("Failed to create room:", error);
      throw error;
    }
  }

  async join(roomId: string, options: any = {}) {
    try {
      this.room = await this.client.joinById(roomId, { ...options, headers: this.getHeaders() });
      return this.room;
    } catch (error) {
      console.error("Failed to join room:", error);
      throw error;
    }
  }

  async reconnect(reconnectionToken: string) {
    try {
      this.room = await this.client.reconnect(reconnectionToken);
      return this.room;
    } catch (error) {
      console.error("Failed to reconnect to room:", error);
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
