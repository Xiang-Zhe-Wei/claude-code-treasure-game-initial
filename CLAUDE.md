# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm install` — install dependencies
- `npm run dev` — Vite dev server on port 3000 (auto-opens browser); proxies `/api` to port 3001
- `npm run server` — API server (`server/index.mjs`, port 3001, SQLite at `server/game.db`, needs Node with `node:sqlite`, i.e. v22.5+); `npm run dev:all` starts both
- `npm run build` — production build to `build/` (not `dist/`)

There is no test runner, linter, or TypeScript config/typecheck script; Vite (SWC) only transpiles.

## Architecture

A single-page React 18 + Vite + TypeScript treasure-chest game (3 chests, one hides treasure). The README is a step-by-step Claude Code tutorial script (sounds, hover key cursor, SQLite sign-in/score storage, Vercel/GitHub Pages deploy commands); the deploy commands are still future work.

- All game logic and UI live in `src/App.tsx` (state: `boxes`, `score`, `gameEnded`). Treasure is +$150, skeleton is -$50; the game ends when treasure is found or all boxes are open. Animation uses `motion/react`.
- Audio (`src/audios/`) and images (`src/assets/`) are imported as ES modules and are wired into `App.tsx` (chest sounds, key hover cursor).
- Auth: `server/index.mjs` is a dependency-free `node:http` + `node:sqlite` API (`/api/signup|login|logout|me|scores`), scrypt-hashed passwords, HttpOnly session cookie. `App.tsx` has views `loading | auth | game`; signed-in users get the final score POSTed once when `gameEnded` flips, guests (via `AuthPanel`'s guest button) store nothing. Client fetch helpers are in `src/lib/api.ts`. The SQLite server can't run on Vercel/GitHub Pages as-is.
- `src/components/ui/` is a shadcn/ui-style Radix component library (mostly unused; only `Button` is used). `src/components/figma/` holds Figma-export helpers. Treat these as vendored; edit sparingly.
- Styling is Tailwind utility classes; global CSS in `src/index.css` and `src/styles/globals.css`.
- `vite.config.ts` has many version-pinned aliases (e.g. `'sonner@2.0.3': 'sonner'`) so Figma-generated imports with `pkg@version` specifiers resolve; keep them when adding UI components. `@` aliases to `src/`.
- `src/guidelines/Guidelines.md` is an unfilled template.
