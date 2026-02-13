import type { RedisClient } from "bun";
import type {
  Player,
  TablePhase,
  TableConfig,
  ChatMessage,
  InstanceState,
} from "@belote/shared";
import { GameState } from "../../domain/GameState";

const ROOM_PREFIX = "room:";
const TTL = 60 * 60 * 24; // 24 hours

// Redis key helpers
const keys = {
  metadata: (roomId: string) => `${ROOM_PREFIX}${roomId}`,
  players: (roomId: string) => `${ROOM_PREFIX}${roomId}:players`,
  chat: (roomId: string) => `${ROOM_PREFIX}${roomId}:chat`,
};

interface RoomMetadata {
  id: string;
  name: string;
  createdAt: number;
  createdBy: string;
  phase: TablePhase;
  config: TableConfig;
}

/**
 * Infrastructure layer: Handles persistence of game state to Redis.
 *
 * Redis structure:
 * - room:{id}         → Hash (metadata: id, phase, config, createdAt, createdBy)
 * - room:{id}:players → Hash (playerId → JSON player)
 * - room:{id}:chat    → List (JSON messages, appended with RPUSH)
 */
export class GameRepository {
  constructor(private redis: RedisClient) {}

  // =========================================================================
  // Full state operations (for backwards compatibility)
  // =========================================================================

  async findById(roomId: string): Promise<GameState | null> {
    const exists = await this.exists(roomId);
    if (!exists) return null;

    try {
      const [metadata, players, chat] = await Promise.all([
        this.getMetadata(roomId),
        this.getAllPlayers(roomId),
        this.getChatMessages(roomId),
      ]);

      if (!metadata) return null;

      const state: InstanceState = {
        id: metadata.id,
        name: metadata.name,
        createdAt: metadata.createdAt,
        createdBy: metadata.createdBy,
        config: metadata.config,
        phase: metadata.phase,
        players,
        chat,
      };

      return new GameState(state);
    } catch (e) {
      console.error(`Failed to load game state for ${roomId}:`, e);
      return null;
    }
  }

  /**
   * Full save - only use for initial room creation.
   * For updates, prefer granular methods: updatePlayer(), updatePhase(), addChatMessage()
   */
  async save(game: GameState): Promise<void> {
    const state = game.toJSON();

    await Promise.all([
      this.setMetadata(state.id, {
        id: state.id,
        name: state.name,
        createdAt: state.createdAt,
        createdBy: state.createdBy,
        phase: state.phase,
        config: state.config,
      }),
      this.setAllPlayers(state.id, state.players),
      this.setAllChatMessages(state.id, state.chat),
    ]);
  }

  /**
   * Initial save with TTL - use only when creating a new room.
   */
  async create(game: GameState): Promise<void> {
    await this.save(game);
    await this.refreshTTL(game.id);
  }

  async delete(roomId: string): Promise<void> {
    await Promise.all([
      this.redis.del(keys.metadata(roomId)),
      this.redis.del(keys.players(roomId)),
      this.redis.del(keys.chat(roomId)),
    ]);
  }

  async exists(roomId: string): Promise<boolean> {
    const result = await this.redis.exists(keys.metadata(roomId));
    return Boolean(result);
  }

  // =========================================================================
  // Metadata operations (Hash)
  // =========================================================================

  async getMetadata(roomId: string): Promise<RoomMetadata | null> {
    const data = await this.redis.hgetall(keys.metadata(roomId));
    if (!data || Object.keys(data).length === 0) return null;
    if (!data.id || !data.name || !data.createdBy || !data.config) return null;

    return {
      id: data.id,
      name: data.name,
      createdAt: Number(data.createdAt),
      createdBy: data.createdBy,
      phase: data.phase as TablePhase,
      config: JSON.parse(data.config),
    };
  }

  async setMetadata(roomId: string, metadata: RoomMetadata): Promise<void> {
    await this.redis.hset(keys.metadata(roomId), {
      id: metadata.id,
      name: metadata.name,
      createdAt: String(metadata.createdAt),
      createdBy: metadata.createdBy,
      phase: metadata.phase,
      config: JSON.stringify(metadata.config),
    });
  }

  async updatePhase(roomId: string, phase: TablePhase): Promise<void> {
    await this.redis.hset(keys.metadata(roomId), { phase });
  }

  async getPhase(roomId: string): Promise<TablePhase | null> {
    const phase = await this.redis.hget(keys.metadata(roomId), "phase");
    return phase as TablePhase | null;
  }

  // =========================================================================
  // Player operations (List: JSON players array)
  // =========================================================================

  async getPlayer(roomId: string, playerId: string): Promise<Player | null> {
    const players = await this.getAllPlayers(roomId);
    return players.find((p) => p.id === playerId) ?? null;
  }

  async getAllPlayers(roomId: string): Promise<Player[]> {
    const data = await this.redis.lrange(keys.players(roomId), 0, -1);
    if (!data) return [];
    return data.map((json) => JSON.parse(json));
  }

  async setAllPlayers(roomId: string, players: Player[]): Promise<void> {
    const key = keys.players(roomId);
    await this.redis.del(key);
    for (const player of players) {
      await this.redis.rpush(key, JSON.stringify(player));
    }
  }

  async addPlayer(roomId: string, player: Player): Promise<void> {
    await this.redis.rpush(keys.players(roomId), JSON.stringify(player));
  }

  async removePlayer(roomId: string, playerId: string): Promise<void> {
    const players = await this.getAllPlayers(roomId);
    const filtered = players.filter((p) => p.id !== playerId);
    await this.setAllPlayers(roomId, filtered);
  }

  async getPlayerCount(roomId: string): Promise<number> {
    return await this.redis.llen(keys.players(roomId));
  }

  async updatePlayer(roomId: string, player: Player): Promise<void> {
    const players = await this.getAllPlayers(roomId);
    const index = players.findIndex((p) => p.id === player.id);
    if (index !== -1) {
      players[index] = player;
      await this.setAllPlayers(roomId, players);
    }
  }

  // =========================================================================
  // Chat operations (List: append-only)
  // =========================================================================

  async addChatMessage(roomId: string, message: ChatMessage): Promise<void> {
    await this.redis.rpush(keys.chat(roomId), JSON.stringify(message));
  }

  async getChatMessages(
    roomId: string,
    limit?: number,
    offset = 0,
  ): Promise<ChatMessage[]> {
    const start = offset;
    const stop = limit ? offset + limit - 1 : -1;
    const data = await this.redis.lrange(keys.chat(roomId), start, stop);
    return data.map((json) => JSON.parse(json));
  }

  async setAllChatMessages(
    roomId: string,
    messages: ChatMessage[],
  ): Promise<void> {
    const key = keys.chat(roomId);
    await this.redis.del(key);
    for (const message of messages) {
      await this.redis.rpush(key, JSON.stringify(message));
    }
  }

  async getChatMessageCount(roomId: string): Promise<number> {
    return await this.redis.llen(keys.chat(roomId));
  }

  // =========================================================================
  // TTL management
  // =========================================================================

  async refreshTTL(roomId: string): Promise<void> {
    await Promise.all([
      this.redis.expire(keys.metadata(roomId), TTL),
      this.redis.expire(keys.players(roomId), TTL),
      this.redis.expire(keys.chat(roomId), TTL),
    ]);
  }
}
