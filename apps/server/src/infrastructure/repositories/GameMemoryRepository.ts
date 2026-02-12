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
        createdAt: metadata.createdAt,
        createdBy: metadata.createdBy,
        config: metadata.config,
        phase: metadata.phase,
        players: new Map(players.map((p) => [p.id, p])),
        chat,
      };

      return new GameState(state);
    } catch (e) {
      console.error(`Failed to load game state for ${roomId}:`, e);
      return null;
    }
  }

  async save(game: GameState): Promise<void> {
    const roomId = game.id;
    const players = game.getPlayers();
    const json = game.toJSON() as any;

    await Promise.all([
      this.setMetadata(roomId, {
        id: roomId,
        createdAt: json.createdAt,
        createdBy: json.createdBy,
        phase: json.phase,
        config: json.config,
      }),
      this.setAllPlayers(roomId, players),
      this.setAllChatMessages(roomId, json.chat),
    ]);

    await this.refreshTTL(roomId);
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

    return {
      id: data.id,
      createdAt: Number(data.createdAt),
      createdBy: data.createdBy,
      phase: data.phase as TablePhase,
      config: JSON.parse(data.config),
    };
  }

  async setMetadata(roomId: string, metadata: RoomMetadata): Promise<void> {
    await this.redis.hset(keys.metadata(roomId), {
      id: metadata.id,
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
  // Player operations (Hash: playerId → JSON)
  // =========================================================================

  async getPlayer(roomId: string, playerId: string): Promise<Player | null> {
    const data = await this.redis.hget(keys.players(roomId), playerId);
    if (!data) return null;
    return JSON.parse(data);
  }

  async getAllPlayers(roomId: string): Promise<Player[]> {
    const data = await this.redis.hgetall(keys.players(roomId));
    if (!data) return [];
    return Object.values(data).map((json) => JSON.parse(json as string));
  }

  async setPlayer(roomId: string, player: Player): Promise<void> {
    await this.redis.hset(keys.players(roomId), {
      [player.id]: JSON.stringify(player),
    });
  }

  async setAllPlayers(roomId: string, players: Player[]): Promise<void> {
    const key = keys.players(roomId);
    // Clear existing and set new
    await this.redis.del(key);
    if (players.length > 0) {
      const entries: Record<string, string> = {};
      for (const player of players) {
        entries[player.id] = JSON.stringify(player);
      }
      await this.redis.hset(key, entries);
    }
  }

  async removePlayer(roomId: string, playerId: string): Promise<void> {
    await this.redis.hdel(keys.players(roomId), playerId);
  }

  async getPlayerCount(roomId: string): Promise<number> {
    return await this.redis.hlen(keys.players(roomId));
  }

  async updatePlayerField<K extends keyof Player>(
    roomId: string,
    playerId: string,
    field: K,
    value: Player[K],
  ): Promise<void> {
    const player = await this.getPlayer(roomId, playerId);
    if (player) {
      player[field] = value;
      await this.setPlayer(roomId, player);
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
    if (messages.length > 0) {
      const jsonMessages = messages.map((m) => JSON.stringify(m));
      await this.redis.rpush(key, ...jsonMessages);
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
