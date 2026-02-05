import type { Server } from "bun";

let server: Server<unknown> | null = null;

export function setServer(s: Server<unknown>) {
  server = s;
}

export function broadcast(topic: string, message: string) {
  server?.publish(topic, message);
}
