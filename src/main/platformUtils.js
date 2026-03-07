// @ts-check
'use strict';

const os = require('os');
const path = require('path');

/**
 * @typedef {Object} PlatformInfo
 * @property {string} platform - Node.js process.platform value
 * @property {boolean} isWindows
 * @property {boolean} isLinux
 * @property {boolean} isMac
 * @property {boolean} isWayland - true when running under a Wayland session
 * @property {boolean} isX11 - true when running under X11
 * @property {string | null} compositor - XDG_CURRENT_DESKTOP value (Linux only)
 */

/**
 * Detect the current platform, display server, and compositor.
 * @returns {PlatformInfo}
 */
function getPlatformInfo() {
  const platform = process.platform;
  const isWindows = platform === 'win32';
  const isLinux   = platform === 'linux';
  const isMac     = platform === 'darwin';

  let isWayland  = false;
  let isX11      = false;
  let compositor = null;

  if (isLinux) {
    const waylandDisplay = process.env.WAYLAND_DISPLAY || '';
    const sessionType    = (process.env.XDG_SESSION_TYPE || '').toLowerCase();
    const currentDesktop = process.env.XDG_CURRENT_DESKTOP || null;

    // A non-empty WAYLAND_DISPLAY is the most reliable indicator; fall back to XDG_SESSION_TYPE
    isWayland  = waylandDisplay.length > 0 || sessionType === 'wayland';
    isX11      = !isWayland && (sessionType === 'x11' || sessionType === '');
    compositor = currentDesktop;
  }

  return { platform, isWindows, isLinux, isMac, isWayland, isX11, compositor };
}

/**
 * Return an array of likely default Client.txt paths for the current OS.
 * @param {PlatformInfo} [platformInfo]
 * @returns {string[]}
 */
function getDefaultClientTxtPaths(platformInfo) {
  const info = platformInfo || getPlatformInfo();
  const home = os.homedir();

  if (info.isWindows) {
    return [
      'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile\\logs\\Client.txt',
      'C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt',
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
 * Apply Chromium command-line switches early to fix Linux transparency,
 * suppress VA-API probe errors, and enable native Wayland via Ozone.
 * @param {Electron.App} app
 * @param {PlatformInfo} [platformInfo]
 */
function configureAppForPlatform(app, platformInfo) {
  const info = platformInfo || getPlatformInfo();

  if (info.isLinux) {
    // Hardware acceleration breaks transparent windows on native Wayland,
    // but is often needed to prevent flickering/crashes on X11.
    if (!info.isWayland) {
      app.disableHardwareAcceleration();
      app.commandLine.appendSwitch('disable-gpu-compositing');
    }

    // Suppress VA-API probe errors (harmless)
    app.commandLine.appendSwitch('disable-features', 'VaapiVideoDecoder,VaapiVideoEncoder');

    if (info.isWayland) {
      // Use native Wayland via Ozone instead of forcing XWayland, which avoids
      // "XGetWindowAttributes failed" errors on wlroots compositors (Hyprland, Sway)
      app.commandLine.appendSwitch('ozone-platform-hint', 'auto');
      app.commandLine.appendSwitch('enable-features', 'WaylandWindowDecorations');
    }
  }
}

/**
 * Build base BrowserWindow options for a transparent overlay.
 * @param {PlatformInfo} [platformInfo]
 * @returns {Partial<Electron.BrowserWindowConstructorOptions>}
 */
function getOverlayWindowOptions(platformInfo) {
  const info = platformInfo || getPlatformInfo();

  const options = {
    frame: false,
    transparent: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    hasShadow: false, // Crucial for Wayland to prevent compositor shadow artifacts
    show: false, // shown explicitly after ready-to-show to avoid transparent flash
  };

  if (info.isLinux && !info.isWayland) {
    options.type = 'toolbar'; // X11 window type hint so compositors treat it as a panel
  }

  return options;
}

/**
 * Apply overlay behaviours like always-on-top and click-through to a window.
 * @param {Electron.BrowserWindow} win
 * @param {PlatformInfo} [platformInfo]
 */
function applyOverlayBehavior(win, platformInfo) {
  const info = platformInfo || getPlatformInfo();

  if (info.isWindows) {
    win.setAlwaysOnTop(true, 'screen-saver', 1); // z-order boost keeps us above fullscreen DX/GL windows
  } else {
    win.setAlwaysOnTop(true, 'screen-saver');
  }

  if (info.isLinux || info.isMac) {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  }

  // Keeping mouse events flowing through the transparent window on Windows and Mac
  if (info.isWindows || info.isMac) {
    win.setIgnoreMouseEvents(true, { forward: true });
  }
}

/**
 * Validates that a window position is visible on at least one active display.
 * If the position is off-screen (e.g., monitor unplugged), returns the center of the primary display.
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @param {number} height
 * @param {Electron.Display[]} displays
 * @param {Electron.Display} primaryDisplay
 * @returns {{x: number, y: number}}
 */
function validateWindowPosition(x, y, width, height, displays, primaryDisplay) {
  const isVisible = displays.some(display => {
    const bounds = display.bounds;
    return (
      x < bounds.x + bounds.width &&
      x + width > bounds.x &&
      y < bounds.y + bounds.height &&
      y + height > bounds.y
    );
  });

  if (isVisible) {
    return { x, y };
  }

  return {
    x: Math.floor(primaryDisplay.workArea.x + (primaryDisplay.workArea.width - width) / 2),
    y: Math.floor(primaryDisplay.workArea.y + (primaryDisplay.workArea.height - height) / 2)
  };
}

module.exports = {
  getPlatformInfo,
  getDefaultClientTxtPaths,
  configureAppForPlatform,
  getOverlayWindowOptions,
  applyOverlayBehavior,
  validateWindowPosition,
};
