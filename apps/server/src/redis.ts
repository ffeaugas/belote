import { RedisClient } from "bun";

export const redis = new RedisClient(process.env.REDIS_URL ?? "redis://localhost:6379");

redis.onconnect = () => {
  console.log("Connected to Redis");
};

redis.onclose = (error) => {
  console.error("Redis connection closed", error);
};
