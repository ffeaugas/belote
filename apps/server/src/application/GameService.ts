import type {
  Card,
  PlayerPosition,
  BidValue,
  Suit,
  Player,
  ChatMessage,
  TablePhase,
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

  async joinOrCreateGame(
    roomId: string,
    playerId: string,
    socket: ElysiaWS,
  ): Promise<GameState> {
    let game = await this.repository.findById(roomId);

    if (!game) {
      game = GameState.create(roomId, playerId);
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
        players: game.getPlayers(),
        chatMessages,
      }),
    );

    return game;
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

  // Future methods for gameplay
  async playCard(
    roomId: string,
    playerId: string,
    card: Card,
  ): Promise<ServiceResult> {
    const game = await this.repository.findById(roomId);
    if (!game) {
      return { success: false, error: "Game not found" };
    }

    const player = game.getPlayer(playerId);
    if (!player || !player.hand) {
      return { success: false, error: "Player not found or has no hand" };
    }

    // Validate using domain rules
    // TODO: Get current trick, trump, and lead suit from game state
    const validation = GameRules.canPlayCard(
      player.hand,
      card,
      [],
      "hearts",
      null,
    );
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // TODO: Apply card play to game state
    // TODO: Check if trick is complete
    // TODO: Check if round is complete
    // TODO: Broadcast updates

    await this.repository.save(game);
    return { success: true };
  }

  async placeBid(
    roomId: string,
    playerId: string,
    value: BidValue | "pass",
    suit?: Suit,
  ): Promise<ServiceResult> {
    const game = await this.repository.findById(roomId);
    if (!game) {
      return { success: false, error: "Game not found" };
    }

    // TODO: Get player position, current bidder, highest bid from game state
    const validation = GameRules.canBid(
      game.phase,
      "bottom",
      "bottom",
      value,
      null,
    );
    if (!validation.valid) {
      return { success: false, error: validation.reason };
    }

    // TODO: Apply bid to game state
    // TODO: Broadcast bid

    await this.repository.save(game);
    return { success: true };
  }
}
