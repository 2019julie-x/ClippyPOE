const os = require('os');
const path = require('path');

/**
 * @typedef {'win32' | 'linux' | 'darwin'} Platform
 *
 * @typedef {Object} PlatformInfo
 * @property {Platform} platform        - The Node.js process platform identifier.
 * @property {boolean}  isWindows       - True when running on Windows.
 * @property {boolean}  isLinux         - True when running on Linux.
 * @property {boolean}  isMac           - True when running on macOS.
 * @property {boolean}  isWayland       - True when the session is Wayland-based (Linux only).
 * @property {boolean}  isX11           - True when the session is X11-based (Linux only).
 * @property {string | null} compositor - Detected compositor/desktop environment name, e.g.
 *                                        "Hyprland", "sway", "GNOME", or null if unknown.
 */

/**
 * Detect the current platform, display server protocol, and compositor.
 *
 * On Linux the function inspects the following environment variables (in order):
 *   1. `WAYLAND_DISPLAY`   – presence indicates a Wayland session.
 *   2. `XDG_SESSION_TYPE`  – "wayland" or "x11".
 *   3. `XDG_CURRENT_DESKTOP` – compositor / desktop environment name.
 *
 * On non-Linux platforms the Wayland / X11 / compositor fields are set to
 * sensible defaults (false / false / null).
 *
 * @returns {PlatformInfo}
 */
function getPlatformInfo() {
  const platform = process.platform;
  const isWindows = platform === 'win32';
  const isLinux = platform === 'linux';
  const isMac = platform === 'darwin';

  let isWayland = false;
  let isX11 = false;
  let compositor = null;

  if (isLinux) {
    const waylandDisplay = process.env.WAYLAND_DISPLAY || '';
    const sessionType = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
    const currentDesktop = process.env.XDG_CURRENT_DESKTOP || null;

    // A non-empty WAYLAND_DISPLAY is the most reliable indicator of a Wayland
    // session.  Fall back to XDG_SESSION_TYPE when the variable is absent.
    isWayland = waylandDisplay.length > 0 || sessionType === 'wayland';
    isX11 = !isWayland && (sessionType === 'x11' || sessionType === '');

    compositor = currentDesktop;
  }

  return {
    platform,
    isWindows,
    isLinux,
    isMac,
    isWayland,
    isX11,
    compositor,
  };
}

/**
 * Return an array of default Client.txt paths for the detected platform.
 *
 * The paths are ordered by likelihood – the caller should check each in turn
 * and use the first one that exists on disk.
 *
 * @param {PlatformInfo} [platformInfo] - Optional pre-computed platform info.
 *                                        When omitted, {@link getPlatformInfo}
 *                                        is called internally.
 * @returns {string[]} Candidate paths to Client.txt.
 */
function getDefaultClientTxtPaths(platformInfo) {
  const info = platformInfo || getPlatformInfo();
  const home = os.homedir();

  if (info.isWindows) {
    return [
      'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile\\logs\\Client.txt',
      path.join(
        'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt',
      ),
    ];
  }

  if (info.isLinux) {
    return [
      path.join(home, '.local', 'share', 'Steam', 'steamapps', 'common', 'Path of Exile', 'logs', 'Client.txt'),
      path.join(home, '.steam', 'steam', 'steamapps', 'common', 'Path of Exile', 'logs', 'Client.txt'),
    ];
  }

  if (info.isMac) {
    return [
      path.join(home, 'Library', 'Application Support', 'Steam', 'steamapps', 'common', 'Path of Exile', 'logs', 'Client.txt'),
    ];
  }

  return [];
}

/**
 * Apply early Electron `app`-level flags required for overlay compatibility on
 * the current platform.
 *
 * **Must be called before `app.whenReady()`** – Chromium command-line switches
 * and hardware-acceleration settings are only honoured when set before the GPU
 * process is spawned.
 *
 * Current behaviour:
 * - **Linux (all)**: disables hardware acceleration and appends
 *   `--disable-gpu-compositing` to work around compositor transparency issues.
 * - **Linux + Wayland**: forces XWayland mode via `--ozone-platform=x11`
 *   because native Wayland transparent frameless windows are broken in
 *   Electron 35.
 *
 * @param {import('electron').App} app - The Electron `app` singleton.
 * @param {PlatformInfo} [platformInfo] - Optional pre-computed platform info.
 */
function configureAppForPlatform(app, platformInfo) {
  const info = platformInfo || getPlatformInfo();

  if (info.isLinux) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu-compositing');

    if (info.isWayland) {
      // Force XWayland – native Wayland transparent frameless windows are
      // broken in Electron 35, which makes the overlay unusable.
      app.commandLine.appendSwitch('ozone-platform', 'x11');
    }
  }
}

/**
 * Build a `BrowserWindow` options object tailored to the current platform.
 *
 * The returned object contains **only** window-chrome and transparency related
 * options.  Callers should spread it into their own options and add
 * `webPreferences`, sizing, etc. as needed.
 *
 * `alwaysOnTop` is intentionally **not** included – it should be applied
 * post-creation via {@link applyOverlayBehavior} so that the correct
 * `setAlwaysOnTop` level can be used.
 *
 * @param {PlatformInfo} [platformInfo] - Optional pre-computed platform info.
 * @returns {import('electron').BrowserWindowConstructorOptions}
 */
function getOverlayWindowOptions(platformInfo) {
  const info = platformInfo || getPlatformInfo();

  /** @type {import('electron').BrowserWindowConstructorOptions} */
  const options = {
    frame: false,
    transparent: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    show: false,
  };

  if (info.isLinux) {
    // 'toolbar' sets the X11 window type hint so that compositors treat the
    // window as a panel / toolbar rather than a normal top-level window.
    options.type = 'toolbar';
  }

  return options;
}

/**
 * Apply post-creation overlay behaviour to a `BrowserWindow`.
 *
 * This covers:
 * - `setAlwaysOnTop` with the appropriate level and z-order for each platform.
 * - `setVisibleOnAllWorkspaces` on Linux and macOS so the overlay follows the
 *   user across virtual desktops.
 * - `setIgnoreMouseEvents` for click-through on Windows and macOS (the
 *   `forward` option is **not** supported on Linux, so it is skipped there).
 *
 * @param {import('electron').BrowserWindow} win - The overlay window instance.
 * @param {PlatformInfo} [platformInfo] - Optional pre-computed platform info.
 */
function applyOverlayBehavior(win, platformInfo) {
  const info = platformInfo || getPlatformInfo();

  if (info.isWindows) {
    // The third argument is a z-order boost that keeps the window above
    // full-screen DirectX/OpenGL windows on Windows.
    win.setAlwaysOnTop(true, 'screen-saver', 1);
  } else {
    win.setAlwaysOnTop(true, 'screen-saver');
  }

  if (info.isLinux || info.isMac) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  // Enable click-through for transparent regions so that mouse events pass
  // through to the game underneath.  The `forward` option keeps hover /
  // mouse-move events flowing to the overlay's renderer so that interactive
  // elements still work.
  //
  // `forward: true` is **not** supported on Linux and will throw, so we skip
  // it there entirely.
  if (info.isWindows || info.isMac) {
    win.setIgnoreMouseEvents(true, { forward: true });
  }
}

module.exports = {
  getPlatformInfo,
  getDefaultClientTxtPaths,
  configureAppForPlatform,
  getOverlayWindowOptions,
  applyOverlayBehavior,
};
