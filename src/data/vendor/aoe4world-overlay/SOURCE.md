# Vendored civ-flag assets — source manifest

- **Source:** [aoe4world/overlay](https://github.com/aoe4world/overlay) — `src/assets/flags/*.png`
- **Pinned commit:** `426f7d057d93e5c7ae4521a06710121026d99241`
- **Fetched:** 2026-06-29
- **Files:** 24 civilization flag PNGs (incl. `unknown.png` fallback), 104×56 RGBA.
- **Used by:** the in-game overlay matchup bar (`src/renderer/overlay/MatchupBar.tsx` via `flags.ts`).

## Unit + building icons (`units/`, `buildings/`)

- **Source:** `data.aoe4world.com/images/{units,buildings}/<slug>-<n>.png` (the
  CDN the overlay previously fetched from at match start).
- **Fetched:** 2026-07-07 via `scripts/vendor-unit-icons.mjs` (re-run it after
  adding units to `src/domain/civUnits.ts` or slugs to `buildIcons.ts`; it
  regenerates `units.ts` + `buildings.ts`).
- **Files:** 46 unit + 13 building icon PNGs — every `CivKeyUnit.icon` slug in
  the troop cheat-sheet plus every build-order widget slug.
- **Used by:** the matchup bar's troop rows (`MatchupBar.tsx` via `units.ts`)
  and the build-order widget (`buildIcons.ts`), with the CDN kept as a
  fallback for not-yet-vendored slugs.

## License / attribution

These flag images depict *Age of Empires IV* civilizations and are © Microsoft,
used for non-commercial purposes under Microsoft's
[Game Content Usage Rules](https://www.xbox.com/en-US/developers/rules). RTSLytics
is not affiliated with Microsoft, Relic Entertainment, or aoe4world.
