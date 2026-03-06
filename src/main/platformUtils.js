const os = require('os');
const path = require('path');

// I need to figure out what OS and display server we're running on to handle things correctly
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

// Let's grab a list of default Client.txt paths for this OS
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

// Applying Chromium switches early to fix Linux transparency and force XWayland
function configureAppForPlatform(app, platformInfo) {
  const info = platformInfo || getPlatformInfo();

  if (info.isLinux) {
    app.disableHardwareAcceleration();
    app.commandLine.appendSwitch('disable-gpu-compositing');

    if (info.isWayland) {
      app.commandLine.appendSwitch('ozone-platform', 'x11'); // force XWayland
    }
  }
}

// Setting up the base transparent window options based on the platform
function getOverlayWindowOptions(platformInfo) {
  const info = platformInfo || getPlatformInfo();

  const options = {
    frame: false,
    transparent: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    show: false, // shown explicitly after ready-to-show to avoid transparent flash
  };

  if (info.isLinux) {
    options.type = 'toolbar'; // X11 window type hint so compositors treat it as a panel
  }

  return options;
}

// Applying overlay behaviors like always-on-top and clickthrough to the window
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

module.exports = {
  getPlatformInfo,
  getDefaultClientTxtPaths,
  configureAppForPlatform,
  getOverlayWindowOptions,
  applyOverlayBehavior,
};
