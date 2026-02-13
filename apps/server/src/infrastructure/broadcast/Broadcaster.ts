import type { Server } from "bun";

export interface BroadcastMessage {
  type: string;
  [key: string]: unknown;
}

/**
 * Infrastructure layer: Handles WebSocket broadcasting.
 * Abstracts the underlying WebSocket server implementation.
 */
export class Broadcaster {
  private server: Server<unknown> | null = null;

  setServer(server: Server<unknown>): void {
    this.server = server;
  }

  toRoom(roomId: string, message: BroadcastMessage): void {
    console.log("Broadcaster: toRoom", roomId, message.type);

    if (!this.server) {
      console.warn("Broadcaster: Server not set, cannot broadcast");
      return;
    }

    this.server.publish(roomId, JSON.stringify(message));
  }
}

export const broadcaster = new Broadcaster();
