import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";

// Infrastructure
import { redis } from "./redis";
import { GameRepository } from "./infrastructure/repositories/GameMemoryRepository";
import { broadcaster } from "./infrastructure/broadcast/Broadcaster";

// Application
import { GameService } from "./application/GameService";

// Transport
import { createGameSocket } from "./transport/gameSocket";

// Wire up dependencies
const gameRepository = new GameRepository(redis);
const gameService = new GameService(gameRepository, broadcaster);
const gameSocket = createGameSocket(gameService);

const app = new Elysia()
  .use(cors())
  .use(gameSocket)
  .get("/", () => "Hello Elysia backend")
  .get("/health", () => ({ status: "ok", timestamp: Date.now() }))
  .listen(3001);

// Set the server reference for broadcasting
if (app.server) {
  broadcaster.setServer(app.server);
}

console.log(`Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export type App = typeof app;
