# ClippyPOE

Path of Exile Campaign Guide Overlay. This application provides a transparent, click-through overlay to guide you through acts 1-10 during your Path of Exile campaign journey.

## Features
- **Act 1-10 Walkthrough**: Step-by-step guidance for completing the campaign.
- **Passives Tracking**: Never miss a skill point from quests.
- **Cheatsheets**: Quick references for Betrayal, Incursion, Delve, and vendor recipes.
- **Speedrun Timer**: Built-in timer with auto-splitting per zone.
- **Non-blocking Performance**: State saves are fully asynchronous so you won't drop frames.
- **Highly Configurable**: Change opacity, hotkeys, and click-through behaviors.

## Installation

Download the latest release from the [Releases](https://github.com/yourusername/ClippyPOE/releases) page.

- **Windows**: Download the `.exe` installer.
- **Linux**: Download the `.AppImage`.

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
2. Run `npm install`
3. Run `npm run dev` to start the app in development mode with devtools attached.
4. Run `npm run build` to package the app for your platform.

## License

MIT
