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

// Grace period before fully removing a disconnected player (ms)
const DISCONNECT_GRACE_PERIOD = 3000;

/**
 * Application layer: Orchestrates game operations.
 * Coordinates between domain logic, persistence, and broadcasting.
 */
export class GameService {
  // Track pending disconnection timers by playerId
  private disconnectTimers = new Map<string, Timer>();

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

    // Use create() which sets TTL only once at room creation
    await this.repository.create(game);

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

    // Check if this is a reconnection (player exists but was disconnected)
    const existingPlayer = game.getPlayer(playerId);
    let player: Player;

    if (existingPlayer) {
      // Cancel any pending removal timer
      const timer = this.disconnectTimers.get(playerId);
      if (timer) {
        clearTimeout(timer);
        this.disconnectTimers.delete(playerId);
      }

      // Reconnect: update status to connected
      player = game.reconnectPlayer(playerId);
      await this.repository.updatePlayer(roomId, player);

      this.broadcaster.toRoom(roomId, {
        type: "player_reconnected",
        playerId: player.id,
        players: game.getPlayers(),
      });
    } else {
      // New player joining
      player = game.addPlayer(playerId);
      await this.repository.addPlayer(roomId, player);

      this.broadcaster.toRoom(roomId, {
        type: "player_joined",
        playerId: player.id,
        players: game.getPlayers(),
      });
    }

    const chatMessages = game.getChatMessages();

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

    const player = game.getPlayer(playerId);
    if (!player) {
      return { success: false, error: "Player not found" };
    }

    // Mark player as disconnected (don't remove yet)
    const disconnectedPlayer = game.disconnectPlayer(playerId);
    await this.repository.updatePlayer(roomId, disconnectedPlayer);

    this.broadcaster.toRoom(roomId, {
      type: "player_disconnected",
      playerId,
      players: game.getPlayers(),
    });

    // Schedule actual removal after grace period
    const timer = setTimeout(async () => {
      this.disconnectTimers.delete(playerId);
      await this.finalizePlayerRemoval(roomId, playerId);
    }, DISCONNECT_GRACE_PERIOD);

    this.disconnectTimers.set(playerId, timer);

    return { success: true };
  }

  private async finalizePlayerRemoval(
    roomId: string,
    playerId: string,
  ): Promise<void> {
    const game = await this.repository.findById(roomId);
    if (!game) return;

    const player = game.getPlayer(playerId);
    // Only remove if still disconnected (didn't reconnect)
    if (!player || player.status !== "disconnected") return;

    game.removePlayer(playerId);

    if (game.isEmpty) {
      await this.repository.delete(roomId);
    } else {
      await this.repository.removePlayer(roomId, playerId);
      this.broadcaster.toRoom(roomId, {
        type: "player_left",
        playerId,
        players: game.getPlayers(),
      });
    }
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
    const player = game.getPlayer(playerId);
    if (player) {
      await this.repository.updatePlayer(roomId, player);
    }

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
    await this.repository.updatePhase(roomId, game.phase);

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
    await this.repository.updatePhase(roomId, game.phase);

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
    await this.repository.addChatMessage(roomId, message);

    this.broadcaster.toRoom(roomId, {
      type: "chat",
      content: message,
    });

    return { success: true, data: message };
  }
}
