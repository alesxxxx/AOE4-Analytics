# Contributing to RTSLytics

Thanks for your interest in improving RTSLytics! This is an Age of Empires IV
companion + analytics app. Contributions of all kinds are
welcome — bug reports, build orders, guides, civ data, and code.

## The one hard rule (please read)

RTSLytics is **read-only**. It works only from:

- the user's **own local AoE4 files** (logs, match history, replay headers), and
- **public APIs** (AoE4World, Relic community API).

**Never read game memory. Never modify the game. Never attach to or inject into
the game process.** This keeps the app safe under the game's Terms of Service and
is load-bearing for the whole project. PRs that cross this line will be declined,
however cool the feature. If you're unsure whether something is allowed, open an
issue first.

## Getting started

Prerequisites:

- **Node.js 22** (see `.nvmrc`) and npm.
- On **Windows**, the native modules (`better-sqlite3`, `uiohook-napi`) may
  compile from source if no prebuilt binary matches. If `npm install` fails on
  them, install the
  [Visual Studio Build Tools](https://visualstudio.microsoft.com/downloads/)
  ("Desktop development with C++") and a matching Python 3.

```bash
npm install     # installs deps and rebuilds native modules for Electron's ABI
npm run dev      # electron-vite dev (main + overlay), hot reload
```

Useful commands:

```bash
npm run typecheck   # tsc --noEmit (node + web projects)
npm run lint         # eslint
npm test             # vitest run (all)
npm run verify       # typecheck + lint + test
npm run format       # prettier --write .
npm run pack         # production build → release/win-unpacked/RTSLytics.exe
npm run dist         # portable .exe → release/
```

## Before you open a PR

Please make sure the full verification suite is green:

```bash
npm run verify
```

For changes to the overlay, the Electron main process, or native/local-data
features, also run `npm run pack` and smoke-test the packaged build — those
features need the real game running and can't be covered by unit tests alone.

## How the project is laid out

RTSLytics is an Electron app with **three windows across two processes**:

| Layer | Where | What it does |
| --- | --- | --- |
| **Main** (Node) | `electron/` | All IO: file reads, the AoE4World + Relic API clients, polling, the overlay controller, native input hook. |
| **Preload** | `electron/ipc/contract.ts`, `electron/preload.ts` | The typed bridge. `contract.ts` is the **single source of truth** for IPC; it exposes `window.rtslytics`. |
| **Renderer — main app** | `src/renderer/main/` | The dashboard UI (React). Talks to main **only** through IPC. |
| **Renderer — overlay** | `src/renderer/overlay/` | The transparent, click-through in-game overlay. |
| **Domain** (pure) | `src/domain/` | The real logic — parsers, analysis, counters, scouting. Pure and Vitest-tested; no IO. |
| **Store** | `src/store/` | Settings (JSON) and analyzed-match history (SQLite, JSON fallback). |
| **Data** | `src/data/` | Bundled build orders + vendored AoE4World data/flags (see NOTICE). |

Rules of thumb:

- **The renderer never calls an API or reads a file directly** — only through IPC.
- **Put real logic in `src/domain/` (pure, tested); put IO in `electron/services/`.**
- **Add a feature contract-first:** edit `electron/ipc/contract.ts`, then
  `preload.ts`, then the handler/controller, then the renderer hook.
- Path aliases: `@domain`, `@api`, `@store`, `@ipc`, `@shared`, `@data`.

## Contributing data (no code required)

- **Build orders** live in `src/data/buildOrders/` as JSON (CraftySalamander /
  aoe4guides-compatible format). Add a file and it's picked up.
- **Guides** live in `src/data/guides.ts`.

## Platform notes

RTSLytics is **Windows-first**: the overlay, local-file reading, and the APM
input hook are Windows-only. The dashboard, scout, civ meta, tier lists, and
guides work cross-platform (they're powered by the public APIs). Cross-platform
fixes are welcome.

## Commit & PR conventions

- Branch off `main`.
- Keep PRs focused; describe **what** changed and **why**.
- Reference an issue where one exists.
- If you touched anything under the read-only rule above, say so explicitly in
  the PR description.

By contributing, you agree that your contributions are licensed under the
project's MIT License (code) and that any bundled game data you add remains
subject to the terms in [NOTICE](NOTICE).
