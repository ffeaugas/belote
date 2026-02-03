# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Belote is a monorepo with a Bun-based full-stack application: React 19 frontend and Elysia backend.

## Commands

### Client (apps/client/)
```bash
bun install          # Install dependencies
bun dev              # Development server with HMR
bun start            # Production server (NODE_ENV=production)
bun run build.ts     # Build for production (outputs to dist/)
```

### Server (apps/server/)
```bash
bun install          # Install dependencies
bun run dev          # Development server with watch mode (port 3001)
```

## Architecture

### Frontend (apps/client/)
- **Runtime:** Bun with HTML imports (no Vite/Webpack)
- **Framework:** React 19
- **Styling:** Tailwind CSS v4 with OKLCH color variables
- **Components:** shadcn/ui pattern (Radix UI + CVA for variants)

Entry points:
- `src/index.ts` - Bun.serve() server
- `src/index.html` - HTML template importing frontend.tsx
- `src/frontend.tsx` - React app mount with HMR support

### Backend (apps/server/)
- **Framework:** Elysia (Bun web framework)
- **Port:** 3001
- **Entry:** `src/index.ts`

### Client-Server Communication
Client fetches from `http://localhost:3001/`. CORS may need configuration.

## Bun-Specific Guidelines

Use Bun instead of Node.js:
- `bun <file>` instead of `node` or `ts-node`
- `bun install` instead of npm/yarn/pnpm
- `bun test` with `bun:test` API instead of Jest/Vitest
- `bunx <package>` instead of npx
- Bun automatically loads `.env` (no dotenv needed)

Prefer Bun APIs:
- `Bun.serve()` for HTTP/WebSocket (not Express)
- `bun:sqlite` for SQLite (not better-sqlite3)
- `Bun.file()` for file operations (not fs.readFile)

## Key Configuration

- **TypeScript:** Strict mode, bundler resolution, path alias `@/*` → `src/*`
- **Bun config:** `apps/client/bunfig.toml` enables bun-plugin-tailwind
- **shadcn/ui:** `apps/client/components.json` (New York style, Lucide icons)
- **Theme:** `apps/client/styles/globals.css` defines CSS variables for light/dark modes

## Component Patterns

UI components in `src/components/ui/` follow shadcn/ui conventions:
- Use CVA (class-variance-authority) for type-safe variants
- Use `cn()` utility from `src/lib/utils.ts` for class merging
- Support dark mode via Tailwind's `.dark` class
