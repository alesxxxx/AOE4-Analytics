# Changelog

All notable changes to RTSLytics are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project aims
to follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Steam credential (password + Steam Guard) sign-in as an alternative to QR
  approval, for accounts without the Steam mobile app.
- Open-source project files: `LICENSE` (MIT), `NOTICE` (bundled-asset terms),
  `CONTRIBUTING.md`, issue/PR templates, and a pull-request CI
  workflow (typecheck + lint + test).

### Changed

- Removed the match-start tooltip from the overlay.

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

[Unreleased]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.2.1...HEAD
[0.2.1]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/alesxxxx/AOE4-Analytics/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/alesxxxx/AOE4-Analytics/releases/tag/v0.1.0
