# ClippyPOE

[![Test & Lint](https://github.com/2019julie-x/ClippyPOE/workflows/Test%20&%20Lint/badge.svg)](https://github.com/2019julie-x/ClippyPOE/actions)
[![Release Build](https://github.com/2019julie-x/ClippyPOE/workflows/Release%20Build/badge.svg)](https://github.com/2019julie-x/ClippyPOE/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Path of Exile Campaign Guide Overlay. This application provides a transparent, click-through overlay to guide you through acts 1-10 during your Path of Exile campaign journey.

## Features
- **Act 1-10 Walkthrough**: Step-by-step guidance for completing the campaign.
- **Passives Tracking**: Never miss a skill point from quests.
- **Cheatsheets**: Quick references for Betrayal, Incursion, Delve, and vendor recipes.
- **Speedrun Timer**: Built-in timer with auto-splitting per zone.
- **Window Edge Snapping**: Automatically align overlay to screen edges for precise positioning.
- **Non-blocking Performance**: State saves are fully asynchronous so you won't drop frames.
- **Highly Configurable**: Change opacity, hotkeys, snap distance, and click-through behaviors.

## Installation

Download the latest release from the [Releases](https://github.com/2019julie-x/ClippyPOE/releases) page.

- **Windows**: Download the `.exe` installer
- **Linux**: Download the `.AppImage` (make it executable: `chmod +x ClippyPOE*.AppImage`)
- **macOS**: Download the `.dmg`

## Usage

By default, the overlay starts in interactive mode. Use the following hotkeys (configurable in Settings):
- **Toggle Interactive/Clickthrough**: `Shift+Space`
- **Show/Hide Overlay**: `Shift+F1`
- **Next Zone**: `Shift+F2`
- **Previous Zone**: `Shift+F3`
- **Toggle Timer**: `Shift+F4`

To read your client logs for auto-zone tracking, open Settings and browse to your Path of Exile `Client.txt` file.

## Development

1. Clone the repository
   ```bash
   git clone https://github.com/2019julie-x/ClippyPOE.git
   cd ClippyPOE
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Run in development mode
   ```bash
   npm run dev
   ```

4. Run tests
   ```bash
   npm test
   ```

5. Build for your platform
   ```bash
   npm run build
   ```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## CI/CD

This project uses GitHub Actions for automated testing and releases:
- **Test & Lint**: Runs on every push and PR
- **Release Build**: Automatically triggered on version tags (e.g., `v1.0.0`)
- **Dependabot**: Weekly dependency updates

See [.github/workflows/README.md](.github/workflows/README.md) for details.

And also Trans Rights :3 
## License

MIT
