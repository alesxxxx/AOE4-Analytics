# Changelog

All notable changes to RTSLytics are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added a Turning-Point Story and Adaptive Build Coach recovery plans to post-game review.
- Added recent public matches and exact personal head-to-head history to Scout.
- Added Benchmark Lens comparisons with a visible sample size for every metric.
- Added Matchup Lab with directional global matchup data and separately labeled personal local results.
- Added public civilization-based team plans and raw post-game contribution breakdowns.
- Added a patch-aware Data Studio with bookmarkable filters for civilization, opponent, map, format, patch or season, result, duration, and time window.

## [0.4.1] - 2026-07-09

### Added

- Added sortable post-game score, economy, technology, military, resource-over-time, score-over-time, and build-order breakdowns.
- Added an in-app overlay arrangement preview, labeled drag handles, and a Settings shortcut for placing every overlay widget before a match.
- Added dashboard latest-game review, leaderboard profile links, searchable build orders, deep-linkable Civ Meta filters, Settings section navigation, and project/support links.

### Changed

- Improved matchup troop labels, match-prep instruction wrapping, overlay placement guidance, and post-game player identification in mirror matches.
- Release metadata aligned for the 0.4.1 portable Windows build.

### Fixed

- Isolated in-flight match syncs per account so switching accounts cannot write results into the wrong history store.
- Sorted numeric local match folders correctly and kept missing post-game metrics out of table comparisons.

## [0.4.0] - 2026-07-07

### Added

- Session tracker overlay widget: today's record at a glance ("3W – 1L +42")
  during the match and on the post-game screen. Placeable like the other
  widgets; toggle in Settings → Overlay.
- Win odds on the matchup bar: your Elo-expected win chance from the rating
  gap ("62% by rating") for ranked 1v1s with two rated players.
- Trend arrows on the My Stats performance tiles (APM / win rate / economy
  direction across your recent games).

### Changed

- All overlay unit and building icons are now bundled with the app — the
  matchup troops row and build-order widget render instantly and fully
  offline instead of fetching from aoe4world's CDN at match start.
- Win rates render at one consistent precision app-wide (whole percent);
  durations use one shared formatter.
- Charts follow your accent colour and the app theme (rating history and
  post-game summary charts previously used fixed colours).
- Guides and Civ Meta tabs are URL-addressable (deep-link + refresh restore
  the tab) and expose proper tab semantics to screen readers.
- The Scout report uses the page width; leaderboard country filter covers ~60
  countries; ledger-style headers across Scout, leaderboard, and civ tables.
- The live APM counter only counts input while the game is focused —
  alt-tabbed typing no longer inflates your APM.

### Fixed

- Your per-civ win rate on civ pages now counts team games (previously they
  were dropped there but counted on My Stats).
- The Dashboard ladder panel refreshes right after a game ends or a sync
  completes, instead of waiting for a window refocus.
- The main window now recovers automatically if its renderer crashes or
  hangs, matching the overlay's existing self-recovery.
- A crash-safety net logs unhandled errors in the main process instead of
  letting a stray rejection take the app down.
- The Settings custom-colour picker opens on the actual current accent
  instead of always suggesting blue.
- Empty leaderboard filters and empty civ map tables show a friendly message
  instead of a blank area; failed game launches surface an error.

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

[0.4.1]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.2.3...v0.3.0
[0.2.2]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.2.1...v0.2.3
[0.2.1]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/alesxxxx/AOE4-Analytics/releases/tag/v0.1.0
