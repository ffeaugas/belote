import type {
  Card,
  PlayerPosition,
  BidValue,
  Suit,
  Player,
  ChatMessage,
  TablePhase,
  CreateRoomResponse,
} from "@belote/shared";
import { GameState } from "../domain/GameState";
import { GameRules } from "../domain/rules/GameRules";
import type { GameRepository } from "../infrastructure/repositories/GameMemoryRepository";
import type {
  Broadcaster,
  BroadcastMessage,
} from "../infrastructure/broadcast/Broadcaster";
import { ElysiaWS } from "elysia/ws";

export interface ServiceResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Application layer: Orchestrates game operations.
 * Coordinates between domain logic, persistence, and broadcasting.
 */
export class GameService {
  constructor(
    private repository: GameRepository,
    private broadcaster: Broadcaster,
  ) {}

  async createRoom(
    name: string,
    createdBy: string,
  ): Promise<ServiceResult<CreateRoomResponse>> {
    const roomId = crypto.randomUUID().slice(0, 8);
    const game = GameState.create(roomId, name, createdBy);

    await this.repository.save(game);

    return {
      success: true,
      data: { id: roomId, name },
    };
  }

  async joinGame(
    roomId: string,
    playerId: string,
    socket: ElysiaWS,
  ): Promise<ServiceResult<GameState>> {
    const game = await this.repository.findById(roomId);

    if (!game) {
      socket.send(
        JSON.stringify({
          type: "error",
          message: "Room not found",
        }),
      );
      return { success: false, error: "Room not found" };
    }

    const player = game.addPlayer(playerId);
    const chatMessages = game.getChatMessages();

    await this.repository.save(game);

    this.broadcaster.toRoom(roomId, {
      type: "player_joined",
      playerId: player.id,
      players: game.getPlayers(),
    });

    socket.send(
      JSON.stringify({
        type: "welcome_message",
        playerId: player.id,
        roomName: game.name,
        players: game.getPlayers(),
        chatMessages,
      }),
    );

    return { success: true, data: game };
  }

  async leaveGame(roomId: string, playerId: string): Promise<ServiceResult> {
    const game = await this.repository.findById(roomId);
    if (!game) {
      return { success: false, error: "Game not found" };
    }

    game.removePlayer(playerId);

    if (game.isEmpty) {
      await this.repository.delete(roomId);
    } else {
      await this.repository.save(game);
      this.broadcaster.toRoom(roomId, {
        type: "player_left",
        playerId,
        players: game.getPlayers(),
      });
    }

    return { success: true };
  }

  async toggleReady(
    roomId: string,
    playerId: string,
  ): Promise<ServiceResult<{ isReady: boolean }>> {
    const game = await this.repository.findById(roomId);
    if (!game) {
      return { success: false, error: "Game not found" };
    }

    const isReady = game.togglePlayerReady(playerId);
    await this.repository.save(game);

    this.broadcaster.toRoom(roomId, {
      type: "player_ready_changed",
      playerId,
      isReady,
      players: game.getPlayers(),
    });

    return { success: true, data: { isReady } };
  }

  async startGame(roomId: string, playerId: string): Promise<ServiceResult> {
    const game = await this.repository.findById(roomId);
    if (!game) {
      return { success: false, error: "Game not found" };
    }

    // Validate using domain rules
    const validation = GameRules.canStartGame(game.getPlayers());
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // Transition to READY_TO_START
    game.changePhase("READY_TO_START");
    await this.repository.save(game);

    this.broadcaster.toRoom(roomId, {
      type: "phase_changed",
      phase: game.phase,
    });

    // Schedule transition to BIDDING
    setTimeout(async () => {
      await this.transitionToBidding(roomId);
    }, 5000);

    return { success: true };
  }

  private async transitionToBidding(roomId: string): Promise<void> {
    const game = await this.repository.findById(roomId);
    if (!game || game.phase !== "READY_TO_START") return;

    game.changePhase("BIDDING");
    await this.repository.save(game);

    this.broadcaster.toRoom(roomId, {
      type: "phase_changed",
      phase: game.phase,
    });
  }

  async sendChatMessage(
    roomId: string,
    playerId: string,
    text: string,
  ): Promise<ServiceResult<ChatMessage>> {
    const game = await this.repository.findById(roomId);
    if (!game) {
      return { success: false, error: "Game not found" };
    }

    const message = game.addChatMessage(playerId, text);
    await this.repository.save(game);

    this.broadcaster.toRoom(roomId, {
      type: "chat",
      content: message,
    });

    return { success: true, data: message };
  }
}
