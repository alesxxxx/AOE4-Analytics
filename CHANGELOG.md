# Changelog

All notable changes to RTSLytics are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2026-07-07

### Added

- Build-order overlay widget: pin any bundled build order from Guides ("Show in
  overlay") and follow current/next steps against the live game clock.
- The post-game result card has a ✕ button — click it to dismiss the card
  instead of waiting for the auto-hide.
- Age-up pace overlay widget with rank-bracket targets (on by default; toggle in
  Settings).
- Overlay widget size slider (75–150%) for high-resolution displays.
- Configurable hotkeys in Settings. Placement mode moved from `Ctrl+I` (which
  collided with italics system-wide) to `Ctrl+Alt+O` by default.
- Steam credential (password + Steam Guard) sign-in as an alternative to QR
  approval, for accounts without the Steam mobile app.
- Open-source project files: `LICENSE` (MIT), `NOTICE` (bundled-asset terms),
  `CONTRIBUTING.md`, issue/PR templates, and a pull-request CI
  workflow (typecheck + lint + test).

### Changed

- The overlay now follows the game to whichever monitor it is on, and spans the
  full display (widgets align correctly over borderless fullscreen).
- Overlay opacity now dims only widget panels; text and icons stay fully
  readable.
- Alt-tab no longer flickers the overlay: hiding waits for a sustained focus
  change, showing is immediate.
- Faster startup and much smaller install: screens load on demand, the backdrop
  image was recompressed (2.6 MB → 0.2 MB), and renderer packages are no longer
  double-shipped in the portable build.
- Lighter idle footprint: the game log is only re-read when it changes, process
  checks are skipped when the game's window is already in focus, and post-game
  summary caches are bounded.
- Removed the match-start tooltip from the overlay.

### Fixed

- Toggling Live APM off and on no longer multiplies the APM reading.
- The overlay recovers automatically if its renderer crashes, if the
  foreground watcher dies, or if another always-on-top window covers it.
- Steam disconnects now surface the reason in Settings, and failed avatar
  fetches retry instead of caching the failure.
- Concurrent post-game syncs (automatic + manual) no longer download the same
  stat summaries twice.
- Search results are keyboard-navigable; account removal asks for confirmation;
  Steam detection errors no longer leave a stuck spinner.

### Security

- Navigation away from the app document is now blocked in packaged builds
  (the previous check was ineffective for `file://` URLs).
- Settings patches from the renderer are validated and clamped before being
  persisted.
- A baseline Content-Security-Policy `<meta>` tag now covers `file://` loads.

## [0.2.2] – [0.2.3] - 2026

### Changed

- Portable-build and release-pipeline iterations (no changelog was kept for
  these versions; see the release notes).

## [0.2.1] - 2026

### Changed

- Portable-build optimizations (faster relaunch via a stable extraction dir;
  smaller/steadier packaged output).

## [0.2.0] - 2026

### Added

- Real post-game stats decoded from the game's own stat summary (exact resources
  gathered/spent, age-up timings, villager high, kills/losses).
- Command-bar app shell (single top bar; no sidebar) with the war-room ledger
  design language.
- Civilization themes: both windows re-accent to the live civ's colours during a
  match.
- Expanded civ playstyle stats and the scout ladder leaderboard as the default
  Scout view.

## [0.1.0] - 2026

### Added

- Initial release: pre-game scouting, in-game overlay, post-game review, and
  civ/guide/tier-list data, powered by local AoE4 files and public APIs.

[0.3.0]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.2.3...v0.3.0
[0.2.2]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.2.1...v0.2.3
[0.2.1]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/alesxxxx/AOE4-Analytics/releases/tag/v0.1.0
