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
    if (!this.server) {
      console.warn("Broadcaster: Server not set, cannot broadcast");
      return;
    }
    console.log("Broadcaster: toRoomExcept", roomId, message);
    this.server.publish(roomId, JSON.stringify(message));
  }
}

// Singleton instance for easy access across the application
export const broadcaster = new Broadcaster();
