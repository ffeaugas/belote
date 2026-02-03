import { Elysia } from "elysia";
import { cors } from "@elysiajs/cors";
import { z } from "zod";

const ipMiddleware = new Elysia()
  .derive(
    { as: 'global' }, ({ server, request }) => console.log(server?.requestIP(request))
  )

const app = new Elysia()
  .use(cors())
  .use(ipMiddleware)
  .get("/", () => "Hello Elysia backend")
  .get('/id/:id', ({ params: { id }, query: { name } }) => {
    return {
      id,
      name
    }
  }, {
    params: z.object({
      id: z.coerce.number()
    }),
    query: z.object({
      name: z.string().min(1, "Name is required"),
    })
  })
  .listen(3001);

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
);

export type App = typeof app
