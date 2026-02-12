import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { z } from "zod";

// Infrastructure
import { redis } from "./redis";
import { GameRepository } from "./infrastructure/repositories/GameMemoryRepository";
import { broadcaster } from "./infrastructure/broadcast/Broadcaster";

// Application
import { GameService } from "./application/GameService";

// Transport
import { createGameSocket } from "./transport/gameSocket";

// Validation schemas
const createRoomSchema = z.object({
  name: z.string().min(1).max(50),
});

// Wire up dependencies
const gameRepository = new GameRepository(redis);
const gameService = new GameService(gameRepository, broadcaster);
const gameSocket = createGameSocket(gameService);

const app = new Elysia()
  .use(cors())
  .use(gameSocket)
  .get("/", () => "Hello Elysia backend")
  .get("/health", () => ({ status: "ok", timestamp: Date.now() }))
  .post("/api/rooms", async ({ body }) => {
    const parsed = createRoomSchema.safeParse(body);

    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid request" };
    }

    const result = await gameService.createRoom(parsed.data.name, "anonymous");

    if (!result.success) {
      return { error: result.error };
    }

    return result.data;
  })
  .listen(3001);

// Set the server reference for broadcasting
if (app.server) {
  broadcaster.setServer(app.server);
}

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
