import type { RedisClient } from "bun";
import type { InstanceState } from "@belote/shared";
import { GameState } from "../../domain/GameState";

const ROOM_PREFIX = "room:";
const TTL = 60 * 60 * 24; // 24 hours

/**
 * Infrastructure layer: Handles persistence of game state to Redis.
 *
 * Redis structure:
 * - room:{id} → String (JSON serialized InstanceState)
 */
export class GameRepository {
  constructor(private redis: RedisClient) {}

  private key(roomId: string): string {
    return `${ROOM_PREFIX}${roomId}`;
  }

  private serialize(game: GameState): string {
    return JSON.stringify(game.getState());
  }

  private deserialize(data: string): GameState {
    const state: InstanceState = JSON.parse(data);
    return new GameState(state);
  }

  async findById(roomId: string): Promise<GameState | null> {
    const data = await this.redis.get(this.key(roomId));
    if (!data) return null;
    return this.deserialize(data);
  }

  async save(game: GameState): Promise<void> {
    await this.redis.set(this.key(game.id), this.serialize(game));
  }

  async create(game: GameState): Promise<void> {
    const key = this.key(game.id);
    await this.redis.set(key, this.serialize(game));
    await this.redis.expire(key, TTL);
  }

  async delete(roomId: string): Promise<void> {
    await this.redis.del(this.key(roomId));
  }

  async exists(roomId: string): Promise<boolean> {
    const result = await this.redis.exists(this.key(roomId));
    return Boolean(result);
  }

  async refreshTTL(roomId: string): Promise<void> {
    await this.redis.expire(this.key(roomId), TTL);
  }
}
