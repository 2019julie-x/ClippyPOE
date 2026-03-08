# Changelog

All notable changes to ClippyPOE are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.2.0] - 2026-03-07

### Added
- Collapse mode: hotkey to shrink overlay to a 36px header strip
- Aggressive clickthrough dimming: overlay dims to 35% opacity when not in focus
- Configurable collapse hotkey in settings UI
- MIT License

### Changed
- Replaced Electron `globalShortcut` with `uiohook-napi` for system-level hotkey capture (works even when the game has focus)

### Fixed
- Alt-Tab breakage: modifier keys no longer get stuck after switching windows
- Window collapse leaving a ghost interactable zone
- Collapse artifacts on expand

## [1.1.3] - 2026-02-XX

### Changed
- Updated `.gitignore` to exclude generated artifacts (`.slim/`)
- Bumped version

## [1.1.2] - 2026-02-XX

### Fixed
- Enabled hardware acceleration on Wayland to fix transparent windows

## [1.1.1] - 2026-02-XX

### Fixed
- Switched to native Wayland via Ozone platform
- Suppressed VA-API errors on Linux

## [1.1.0] - 2026-02-XX

### Added
- Window edge snapping (magnetization) — overlay snaps to screen edges when dragged within threshold

### Changed
- Migrated sync IPC to async throughout
- Extracted timer into standalone module
- Migrated ESLint config to flat format (ESLint v10)

### Fixed
- Magnetization feedback loop

## [1.0.0] - Initial Release

### Added
- Act 1–10 campaign guide overlay with zone-by-zone objectives
- Automatic zone detection via `Client.txt` log parsing
- Skill gem reward tracking and recommendations
- Cheatsheets: Betrayal, Incursion, Delve, vendor recipes, bandit choices
- Speedrun timer with automatic zone-based splits
- Passive tree skill point checkpoints
- Quest completion tracking
- Configurable opacity and hotkeys
- Window edge magnetization
- Cross-platform support: Windows, Linux (X11/Wayland), macOS
