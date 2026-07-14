# RULES.md — RTSLytics project rules

> Project-specific operating rules for engineering agents working in this repository.
>
> Version: 2026-07-14
>
> Scope: the entire `RTSLYTICS` repository.
>
> Layering: read and follow `../RULES.md` first. This file refines it with RTSLytics-specific contracts and completion checks; it does not weaken its safety, authorization, workspace, or evidence requirements. `README.md` and `CONTRIBUTING.md` are the contributor-facing product and architecture references.

## 1. Project identity and hard boundary

RTSLytics is a Windows-first Electron and React companion for Age of Empires IV. It scouts players, renders a transparent overlay, and analyzes local and public match data.

The product is **read-only**. This boundary is load-bearing:

- Read only the user's own local AoE4 files and the network sources already approved by the application: AoE4World, Relic community services, and the existing user-initiated Steam/Relic authentication and summary-download flow.
- Never read game memory, attach to or inject into the game process, modify the game or its files, automate gameplay, or synthesize game input.
- Process detection and passive foreground-window checks are allowed. The existing APM feature may count key and mouse events through a global hook only while a live match and the game focus gate are active; never capture key identities, text, or raw input, and never send input.
- Do not promise unsupported live economy, unit, or command telemetry. Rich coaching comes from public match data and local post-game logs, history, replay headers, and summary blobs.
- Treat any proposed new data source or capability near this boundary as a product and Terms-of-Service decision. Do not quietly broaden it during implementation.

## 2. Ground truth and task start

- Confirm the repository root, then inspect `git status`, the relevant diff, and the current branch before editing. Preserve all pre-existing work.
- Read the smallest relevant path plus `package.json`, `CONTRIBUTING.md`, and the files named in the architecture map below. Current code and tests decide behavior when prose is stale.
- The ignored `.claude/loop.md` is legacy guidance: it references missing phase documents and requires unauthorized commits. Do not treat it as active project policy.
- Keep narrow requests narrow. For an explicit audit, investigate correctness, performance, packaging, privacy, and failure handling with measurements and concrete evidence.
- Do not edit generated output (`out/`, `release/`, `coverage/`, `dist/`) or dependencies in `node_modules/` as source.

## 3. Architecture contracts

| Layer                          | Source of truth                                                               | Contract                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Electron lifecycle and windows | `electron/main.ts`, `electron/windows/`                                       | Own startup, shutdown, window security, and process lifecycle.                                        |
| Main-process services          | `electron/services/`                                                          | Own filesystem, native modules, polling, process/window detection, authentication, and orchestration. |
| API clients                    | `src/api/`                                                                    | Main-side HTTP, rate limiting, request coalescing, response parsing, and disk caching.                |
| Persistence                    | `src/store/`                                                                  | Settings plus history storage; SQLite is preferred and JSON is the supported fallback.                |
| IPC                            | `electron/ipc/contract.ts`, `electron/preload.ts`, `electron/ipc/handlers.ts` | Typed boundary between the main process and both renderers.                                           |
| Dashboard renderer             | `src/renderer/main/`                                                          | React UI; no direct filesystem, Electron, native-module, or API access.                               |
| Overlay renderer               | `src/renderer/overlay/`                                                       | Transparent, click-through in-game UI driven by main-process state.                                   |
| Shared renderer code           | `src/renderer/shared/`                                                        | Browser-safe UI, hooks, formatting, and the single `ipc` wrapper.                                     |
| Domain logic                   | `src/domain/`                                                                 | Pure deterministic parsing, analysis, matchup, coaching, and layout logic. No IO.                     |
| Bundled data                   | `src/data/`                                                                   | Build orders, guides, and attributed vendored AoE4World assets.                                       |

Architecture rules:

- The runtime has one Electron main process and two `BrowserWindow` renderer entry points: dashboard and overlay. Do not repeat the stale "three windows" wording from `CONTRIBUTING.md`.
- Renderers MUST use `ipc` from `src/renderer/shared/ipc.ts`. Do not call raw `window.rtslytics`, `fetch`, Node APIs, Electron APIs, or filesystem APIs from renderer features.
- Add an IPC feature in this order: contract types/channels → preload implementation → handler/service → renderer query or component → contract and behavior tests.
- Keep IPC handlers thin. Put IO and orchestration in services; put reusable calculations in pure domain functions.
- Renderer imports from `src/api/` or `src/store/` must be type-only or proven browser-safe constants. Never pull a Node-backed implementation into a renderer bundle.
- `electron/ipc/contract.ts` is the single source of truth for `window.rtslytics`. Do not create ad hoc channels or duplicate request/response shapes.
- Return typed `IpcResult<T>` envelopes for fallible IPC work. Preserve useful error kinds and messages instead of throwing opaque renderer errors.
- Treat every renderer argument as untrusted. Validate, clamp, whitelist, or sanitize it in the main process before using or persisting it.
- Keep aliases synchronized between `tsconfig.json` and `electron.vite.config.ts` when adding or changing one.

## 4. Correctness and data invariants

- Capture the active account/profile identity before asynchronous work. Key caches, in-flight syncs, and history writes by the correct profile, and discard stale results after an account switch.
- Never use dashboard or cached account data as a fallback unless its `profileId` matches the active settings profile. Account switches must invalidate every account-scoped renderer query.
- Preserve team structure. `LiveMatchup.teams[0]` is the user's team; do not flatten team games into a 1v1 model or assume exactly one opponent.
- Preserve data honesty. Missing upstream or local values stay `null`, unknown, or explicitly unavailable; do not invent estimates and present them as observed stats.
- A user-removed history row is a tombstone that prevents re-import. Exclude hidden rows before applying a result limit by using `listVisibleMatches()` in both history backends.
- SQLite and JSON history implementations must obey the same `HistoryStore` behavior. A native SQLite load failure may fall back to JSON, but it must not crash or silently lose existing data.
- Settings changes must update the type, defaults, patch sanitizer, migration/merge behavior, IPC contract if exposed, UI, and tests together. Preserve stored-shape compatibility unless an explicit migration is supplied.
- Retain API rate limiting, caching, timeouts, and identical-request coalescing. Tests must cover cache misses, concurrent callers, error mapping, and malformed upstream data without depending on a live service.
- Cache failures are best-effort, not app failures. Delete a cached summary only after confirmed corruption; transient stat/read errors remain retryable. Validate game IDs before forming cache paths.
- Keep local-file work bounded: tail-read large logs and parse only the replay/header data the feature needs. Do not start consuming the replay command or economy stream as live telemetry.
- Do not turn process-level rejection/exception logging into a substitute for handling errors at the source. Background poll, auth, and IPC paths must settle predictably and clean up their state.

## 5. Electron, overlay, and native-module invariants

- Preserve Electron isolation: `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true` for every renderer window.
- Preserve the production CSP, navigation/redirect blocking, external-protocol allowlist, and window hardening in `electron/security.ts`. Do not add broad wildcards to make a resource load.
- Closing the dashboard must quit the app and its overlay. Shutdown must stop polling and APM hooks, dispose the overlay, unregister global shortcuts, and close history stores.
- The overlay canvas uses the display's full bounds, not the work area, so it aligns with borderless-fullscreen AoE4. Preserve multi-monitor following and avoid moving the canvas while placement mode is active.
- Locked overlay mode is click-through. Placement mode is manual, per-widget, persists widget positions, and shows placeholders when idle.
- Hotkeys are configurable. Current defaults are `Alt+O` for visibility and `Ctrl+Alt+O` for placement; update defaults, validation, settings UI, README, and tests together if they change. Do not restore the obsolete `Ctrl+I` binding without an explicit product request.
- Exclusive fullscreen is not a supported overlay target. Manual overlay validation uses Borderless or Windowed Fullscreen.
- Use Node.js 22, matching `.nvmrc` and `package.json`. Keep npm and `package-lock.json` authoritative.
- `better-sqlite3` and `uiohook-napi` are native Electron dependencies. Normal install/package flows must run the postinstall rebuild for Electron's ABI; `npm ci --ignore-scripts` is only for the pure Node CI job.
- Keep ASAR unpacking limited to the required `.node` binaries unless package inspection and a packaged smoke test prove a broader pattern is necessary.
- A Node test run can pass through the JSON history fallback. It does not prove that packaged SQLite or the input hook loads.

## 6. TypeScript, React, and change discipline

- Keep TypeScript strict. Respect `noUncheckedIndexedAccess`, `noImplicitOverride`, and `noFallthroughCasesInSwitch`; do not introduce explicit `any`.
- Do not use `@ts-ignore`, broad casts, skipped tests, disabled rules, or swallowed errors to force a green build. A narrow suppression needs an unavoidable boundary and a local explanation.
- Follow repository formatting: no semicolons, single quotes, trailing commas, 100-column print width, two spaces, and LF endings.
- Preserve React hook dependencies and query ownership. Use TanStack Query for server/main-process state and invalidate all related keys after mutations.
- Keep `HashRouter` for the dashboard; packaged `file:` navigation depends on it. Reuse the existing shared components, semantic theme tokens, and Lucide icons before adding a new UI system.
- Add or update focused Vitest coverage for changed behavior. Prefer synthetic or public, non-sensitive fixtures; never capture a real user's local files, credentials, tokens, signed URLs, or private match data.
- Avoid broad `npm run format` or `npm run lint:fix` on a focused change. Format only touched files and inspect the resulting diff.
- Despite the current wording in `CONTRIBUTING.md`, build-order files are not auto-discovered. Register new JSON in `src/data/buildOrders/index.ts`; order is functional because the first matching civilization build becomes the default.
- Do not hand-edit generated unit/building manifests or vendored datasets. Use the existing script/update path and preserve source pins, attribution, and license notices.

## 7. Verification matrix

Use focused tests while iterating, then run every applicable gate below:

| Change                                                                      | Required evidence                                                                                                                                       |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Documentation only                                                          | Inspect rendered Markdown, links, paths, and commands; run a targeted Prettier check when formatting changed.                                           |
| Domain, renderer, store, API, or normal TypeScript                          | Focused Vitest test(s), then `npm run verify`.                                                                                                          |
| Build config, preload, IPC, or renderer entry points                        | `npm run verify` and `npm run bundle`.                                                                                                                  |
| Overlay, Electron main process, local-data, store backend, or native module | `npm run verify`, `npm run pack`, then the packaged smoke test.                                                                                         |
| Dependencies                                                                | Relevant tests, `npm audit --omit=dev --audit-level=high`, `npm run verify`, and `npm run bundle`; package when production/native dependencies changed. |
| Release                                                                     | `npm run dist:verified`, artifact inspection, packaged smoke, and SHA-256 verification before publication.                                              |

Packaged smoke on Windows:

```powershell
$env:RTSLYTICS_SMOKE = '1'
try {
  & '.\release\win-unpacked\RTSLytics.exe'
} finally {
  Remove-Item Env:RTSLYTICS_SMOKE
}
```

The smoke path redirects user data away from normal AppData to the fixed temporary `rtslytics-diag` directory, skips live polling, Steam restore, and the input hook, and exercises successful boot, history initialization, overlay visibility, and close-to-quit. The diagnostic directory is reused, not cleared, so do not assume blank state between runs. For native-sensitive changes, confirm that packaged history reports `sqlite`; a JSON fallback is a packaging/ABI warning to investigate.

Do not claim headless checks prove real-game behavior. Manually verify, when relevant:

- transparency and click-through over Borderless/Windowed Fullscreen AoE4;
- visibility and placement hotkeys, including shortcut conflicts;
- placeholder placement, persistence, scaling, and multi-monitor bounds;
- live match detection and local log/replay paths;
- APM focus gating and optional Steam authentication.

If real-game verification is unavailable, name the exact manual checks that remain instead of simulating success.

## 8. Privacy, security, and data licensing

- Never log, commit, or expose Steam credentials, encrypted session material, refresh tokens, signed download URLs, real player files, AppData contents, `.env*`, logs, or `scratch/` captures.
- Keep authentication material in the existing OS-encrypted storage flow. Do not persist passwords, bypass Steam Guard, or move auth into renderer storage.
- Preserve request validation and safe path construction for local overrides and cache files. Do not widen filesystem scans beyond the documented AoE4 locations without an explicit requirement.
- Preserve the `steam-appticket` production dependency security override until the dependency tree and production audit prove it can be safely changed or removed.
- Assets under `src/data/vendor/` are not covered by the repository's MIT license. Keep their `SOURCE.md` pins, `NOTICE` attribution, Microsoft Game Content Usage Rules, and non-commercial restrictions intact.

## 9. Performance and packaging

- Measure before calling a change an optimization. Compare the same workload and report correctness, latency, request count, bundle/package size, or memory impact as appropriate.
- Preserve production minification, `.node`-only ASAR unpacking, lazy native loading, request coalescing, bounded caches, and the absence of unnecessary hidden-window startup API calls unless new evidence justifies a change.
- Polling intervals and API budgets are product behavior. Do not make them more aggressive to hide stale-state bugs.
- Inspect built artifacts rather than relying only on a successful command. Generated `out/`, `release/`, and `coverage/` content remains untracked.

## 10. Git, releases, and public wording

- The universal rule requiring current authorization for commits, pushes, tags, releases, history rewrites, and destructive actions applies without exception.
- A push to `main` is release-affecting: the portable-release workflow derives `v<package.version>` and may publish a Windows executable and checksum. Never treat a `main` push as routine housekeeping.
- A version bump signals release intent. Keep `package.json`, `package-lock.json`, `CHANGELOG.md`, artifact naming, and release notes aligned.
- Use `npm run dist:verified` for an authorized release. Do not delete or replace an existing tag/release merely to rerun the workflow.
- Keep public copy short, plain, and human. Do not add AI/agent promotional text or co-author credit unless the user explicitly requests it.
- Update `README.md`, `CONTRIBUTING.md`, screenshots, `NOTICE`, or `CHANGELOG.md` when their documented behavior, setup, attribution, or release state changes.

## 11. RTSLytics completion gate

Before saying a change is done, verify all applicable items:

1. The read-only product boundary still holds.
2. Renderer/main/domain ownership and the typed IPC contract remain intact.
3. Focused tests and `npm run verify` pass for code changes.
4. Bundle, package, audit, and packaged smoke checks pass when required by the matrix.
5. Real-game or visual behavior was inspected, or the exact unperformed manual checks are disclosed.
6. Account switching, team formats, hidden-history behavior, errors, empty states, and cleanup paths affected by the change were considered.
7. No real player data, credentials, generated output, debug residue, or unrelated edits entered the diff.
8. Documentation and attribution match the implemented behavior.
9. The final diff and `git status` were reviewed, and no unauthorized commit, push, tag, or release occurred.
