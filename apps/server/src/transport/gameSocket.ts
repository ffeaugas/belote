import Elysia from "elysia";
import type { GameService } from "../application/GameService";

interface SocketData {
  playerId: string;
  roomId: string;
}

interface IncomingMessage {
  type: string;
  text?: string;
  card?: { suit: string; rank: string };
  value?: number | string;
  suit?: string;
}

/**
 * Transport layer: Handles WebSocket connections and routes messages to the service.
 * No business logic here - just parsing, validation, and delegation.
 */
export function createGameSocket(gameService: GameService) {
  return new Elysia().ws("/ws/:roomId", {
    async open(socket) {
      const roomId = socket.data.params.roomId;
      const url = new URL(socket.data.request.url);
      const playerId = url.searchParams.get("userId") ?? crypto.randomUUID();

      (socket.data as any).playerId = playerId;
      (socket.data as any).roomId = roomId;
      socket.subscribe(roomId);

      await gameService.joinGame(roomId, playerId, socket);
    },

    async message(socket, message: IncomingMessage) {
      const { roomId, playerId } = socket.data as unknown as SocketData;

      switch (message.type) {
        case "chat": {
          if (!message.text) return;
          await gameService.sendChatMessage(roomId, playerId, message.text);
          break;
        }

        case "toggle_player_ready": {
          await gameService.toggleReady(roomId, playerId);
          break;
        }

        case "start_game": {
          await gameService.startGame(roomId, playerId);
          break;
        }

        default:
          console.warn(`Unknown message type: ${message.type}`);
      }
    },

    async close(socket) {
      const { roomId, playerId } = socket.data as unknown as SocketData;

      if (roomId && playerId) {
        await gameService.leaveGame(roomId, playerId);
      }
    },
  });
}
