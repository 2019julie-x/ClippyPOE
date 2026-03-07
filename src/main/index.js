const { app, BrowserWindow, ipcMain, dialog, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const LogParser = require('./logParser');
const SettingsManager = require('./settingsManager');
const OverlayController = require('./overlayController');
const WindowMagnetizer = require('./windowMagnetizer');
const TimerManager = require('./timer');
const hotkeyManager = require('./hotkeyManager');
const {
  getPlatformInfo,
  getDefaultClientTxtPaths,
  configureAppForPlatform,
  getOverlayWindowOptions,
  applyOverlayBehavior,
  validateWindowPosition,
} = require('./platformUtils');

// Platform config
const platformInfo = getPlatformInfo();
configureAppForPlatform(app, platformInfo);

// Global state
let mainWindow = null;
let settingsWindow = null;
let logParser = null;
let settingsManager = null;
let overlayController = null;
let windowMagnetizer = null;
let timerManager = null;
let cachedGuideData = null;
let cachedGemData = null;
let cachedCheatsheetData = null;

// Guard flag to prevent infinite move loop during magnetization snap
let isSnapping = false;

// Guard flag to suppress move/resize saves during startup restoration
let isWindowReady = false;

// Create windows

function createMainWindow() {
  const overlayOpts = getOverlayWindowOptions(platformInfo);

  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 320,
    minHeight: 36,
    ...overlayOpts,
    resizable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Apply platform-specific overlay behaviour (alwaysOnTop, workspaces, etc.)
  applyOverlayBehavior(mainWindow, platformInfo);

  // Bind to overlay controller
  overlayController.setWindow(mainWindow);

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Restore saved bounds before showing (setPosition/setSize fire move/resize
  // events — the isWindowReady guard keeps them from overwriting the config)
  const savedPosition = settingsManager.getWindowPosition();
  const savedSize = settingsManager.getWindowSize();

  if (savedSize) {
    mainWindow.setSize(savedSize.width, savedSize.height);
  }

  if (savedPosition) {
    // Validate against active displays so we don't spawn off-screen
    const validatedPos = validateWindowPosition(
      savedPosition.x,
      savedPosition.y,
      savedSize ? savedSize.width : 400,
      savedSize ? savedSize.height : 600,
      screen.getAllDisplays(),
      screen.getPrimaryDisplay()
    );
    mainWindow.setPosition(validatedPos.x, validatedPos.y);
  }

  // Show only when the renderer is ready (prevents transparent flash)
  mainWindow.once('ready-to-show', () => {
    // Startup restoration is finished — start persisting moves/resizes
    isWindowReady = true;
    mainWindow.show();
    // Start in interactive mode
    overlayController.activate();
  });

  // Save window position on move with magnetization support
  mainWindow.on('move', () => {
    if (!isWindowReady || isSnapping) return;
    if (!mainWindow || mainWindow.isDestroyed()) return;

    // Minimizing on Windows moves the window to ~(-32000,-32000) — never save that
    if (mainWindow.isMinimized()) return;

    // On Wayland, getPosition() returns [0,0] and setPosition() is a no-op,
    // so skip magnetization and position persistence entirely
    if (platformInfo.isWayland) return;

    // Check if window should snap to edges
    const snapPosition = windowMagnetizer.calculateSnapPosition(mainWindow);

    if (snapPosition) {
      isSnapping = true;
      mainWindow.setPosition(snapPosition.x, snapPosition.y);
      settingsManager.saveWindowPosition(snapPosition.x, snapPosition.y);
      isSnapping = false;
    } else {
      const [x, y] = mainWindow.getPosition();
      settingsManager.saveWindowPosition(x, y);
    }
  });

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (!isWindowReady) return;
    if (!mainWindow || mainWindow.isDestroyed()) return;
    // Minimizing can trigger a resize to 0×0 on some platforms
    if (mainWindow.isMinimized()) return;

    const [width, height] = mainWindow.getSize();
    settingsManager.saveWindowSize(width, height);
  });

  // Re-apply overlay state after restore — minimizing an alwaysOnTop window
  // can drop the z-order flag on some platforms (macOS, some Linux WMs)
  mainWindow.on('restore', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (overlayController) {
      if (overlayController.interactive) {
        overlayController.activate();
      } else {
        overlayController.deactivate();
      }
    }
  });

  mainWindow.on('closed', () => {
    isWindowReady = false;
    mainWindow = null;
  });

  // Open DevTools in dev mode
  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

function createSettingsWindow() {
  if (settingsWindow) {
    settingsWindow.focus();
    return;
  }

  settingsWindow = new BrowserWindow({
    width: 550,
    height: 520,
    parent: mainWindow,
    modal: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

// Register hotkeys

function registerHotkeys() {
  const settings = settingsManager.getSettings();
  hotkeyManager.clearAll();

  // Toggle overlay interactive / clickthrough
  const toggleKey = settings.hotkeys?.toggleOverlay ?? 'Shift+Space';
  if (toggleKey) {
    hotkeyManager.register(toggleKey, () => {
      if (overlayController) {
        overlayController.toggle();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(
            'overlay-mode-changed',
            overlayController.interactive
          );
        }
      }
    });
  }

  // Toggle overlay visibility
  const hideKey = settings.hotkeys?.hideOverlay ?? 'Shift+F1';
  if (hideKey) {
    hotkeyManager.register(hideKey, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
          if (mainWindow.isMinimized()) mainWindow.restore();
        }
      }
    });
  }

  // Navigate next zone
  const nextZoneKey = settings.hotkeys?.nextZone ?? 'Shift+F2';
  if (nextZoneKey) {
    hotkeyManager.register(nextZoneKey, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-next-zone');
      }
    });
  }

  // Navigate prev zone
  const prevZoneKey = settings.hotkeys?.prevZone ?? 'Shift+F3';
  if (prevZoneKey) {
    hotkeyManager.register(prevZoneKey, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-prev-zone');
      }
    });
  }

  // Toggle timer
  const timerKey = settings.hotkeys?.toggleTimer ?? 'Shift+F4';
  if (timerKey) {
    hotkeyManager.register(timerKey, () => {
      const state = timerManager.toggle();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('timer-state', state);
      }
    });
  }

  // Collapse/expand overlay
  const collapseKey = settings.hotkeys?.collapseOverlay ?? 'Shift+F5';
  if (collapseKey) {
    hotkeyManager.register(collapseKey, () => {
      if (overlayController) {
        overlayController.toggleCollapse();
      }
    });
  }

  hotkeyManager.start();
}

// App lifecycle

app.whenReady().then(() => {
  settingsManager = new SettingsManager();
  overlayController = new OverlayController(
    platformInfo,
    settingsManager.getSettings().opacity || 0.95
  );

  // Initialize window magnetizer with settings
  const settings = settingsManager.getSettings();
  windowMagnetizer = new WindowMagnetizer(settings.magnetization || {});

  // Initialize timer (lives in main process so it persists across renderer reloads)
  timerManager = new TimerManager();
  timerManager.onTick = (elapsed) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('timer-tick', elapsed);
    }
  };

  createMainWindow();
  registerHotkeys();

  // Initialize log parser if Client.txt path is configured and autoDetect is enabled
  const autoDetect = settings.autoDetect !== false;
  const clientTxtPath = settingsManager.getClientTxtPath();
  if (autoDetect && clientTxtPath && fs.existsSync(clientTxtPath)) {
    initLogParser(clientTxtPath);
  } else if (!clientTxtPath) {
    // Show settings window on first run
    setTimeout(() => {
      createSettingsWindow();
    }, 1000);
  }
});

app.on('will-quit', () => {
  hotkeyManager.stop();
  if (logParser) {
    logParser.stop();
  }
  if (timerManager) {
    timerManager.destroy();
  }
  if (settingsManager) {
    settingsManager.destroy();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow();
  }
});

// Window operations (fire-and-forget)

ipcMain.on('open-settings', () => {
  // Make overlay interactive so the settings modal works
  if (overlayController) overlayController.activate();
  createSettingsWindow();
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    // Since the overlay has skipTaskbar: true, minimizing it makes it disappear
    // completely with no way to restore via UI. Hiding it is safer, as the
    // global hotkey (Shift+F1) toggles visibility.
    mainWindow.hide();
  }
});

// Overlay control (fire-and-forget)

ipcMain.on('overlay-activate', () => {
  if (overlayController) overlayController.activate();
});

ipcMain.on('overlay-deactivate', () => {
  if (overlayController) overlayController.deactivate();
});

ipcMain.on('overlay-toggle', () => {
  if (overlayController) {
    overlayController.toggle();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(
        'overlay-mode-changed',
        overlayController.interactive
      );
    }
  }
});

ipcMain.on('overlay-collapse-toggle', () => {
  if (overlayController) {
    overlayController.toggleCollapse();
  }
});

// Settings handlers (async invoke – no longer blocks the renderer)

ipcMain.handle('get-settings', async () => {
  return settingsManager.getSettings();
});

ipcMain.handle('save-settings', async (_event, settings) => {
  // Validate clientTxtPath
  const rawPath = settings && settings.clientTxtPath;
  if (rawPath !== undefined && rawPath !== '') {
    if (
      typeof rawPath !== 'string' ||
      !path.isAbsolute(rawPath) ||
      path.extname(rawPath).toLowerCase() !== '.txt' ||
      rawPath.length > 512
    ) {
      console.error('save-settings: rejected invalid clientTxtPath:', rawPath);
      return false;
    }
  }

  settingsManager.saveSettings(settings);

  // Update overlay opacity if changed
  if (settings.opacity !== undefined && overlayController) {
    overlayController.setBaseOpacity(settings.opacity);
  }

  // Update magnetization config if changed
  if (settings.magnetization && windowMagnetizer) {
    windowMagnetizer.updateConfig(settings.magnetization);
  }

  // Re-register hotkeys if changed
  if (settings.hotkeys) {
    registerHotkeys();
  }

  // Restart log parser with new path
  if (logParser) logParser.stop();
  if (rawPath && fs.existsSync(rawPath)) {
    initLogParser(rawPath);
  }

  return true;
});

// Load guide data

ipcMain.handle('load-guide-data', async () => {
  try {
    if (cachedGuideData) return cachedGuideData;
    const guidePath = path.join(__dirname, '../../data/guides/campaign.json');
    const data = fs.readFileSync(guidePath, 'utf8');
    cachedGuideData = JSON.parse(data);
    return cachedGuideData;
  } catch (err) {
    console.error('Failed to load guide data:', err);
    return null;
  }
});

ipcMain.handle('load-gem-data', async () => {
  try {
    if (cachedGemData) return cachedGemData;
    const gemPath = path.join(__dirname, '../../data/guides/gem_rewards.json');
    if (!fs.existsSync(gemPath)) return null;
    const data = fs.readFileSync(gemPath, 'utf8');
    cachedGemData = JSON.parse(data);
    return cachedGemData;
  } catch (err) {
    console.error('Failed to load gem data:', err);
    return null;
  }
});

ipcMain.handle('load-cheatsheet-data', async () => {
  try {
    if (cachedCheatsheetData) return cachedCheatsheetData;
    const csPath = path.join(__dirname, '../../data/guides/cheatsheets.json');
    if (!fs.existsSync(csPath)) return null;
    const data = fs.readFileSync(csPath, 'utf8');
    cachedCheatsheetData = JSON.parse(data);
    return cachedCheatsheetData;
  } catch (err) {
    console.error('Failed to load cheatsheet data:', err);
    return null;
  }
});

ipcMain.handle('get-platform-info', async () => {
  return platformInfo;
});

// File dialog

ipcMain.handle('browse-client-txt', async (event) => {
  const defaults = getDefaultClientTxtPaths(platformInfo);
  const defaultPath = defaults.find((p) => {
    try { return fs.existsSync(path.dirname(p)); } catch { return false; }
  });

  const window = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(window, {
    title: 'Select Path of Exile Client.txt',
    defaultPath: defaultPath || undefined,
    filters: [
      { name: 'Log Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] },
    ],
    properties: ['openFile'],
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

// Progress handlers

ipcMain.handle('get-progress', async () => {
  return settingsManager.getProgress();
});

ipcMain.on('save-progress', (_event, progress) => {
  settingsManager.saveProgress(progress);
});

ipcMain.on('reset-progress', () => {
  settingsManager.resetProgress();
  timerManager.reset();
  if (mainWindow) mainWindow.webContents.send('progress-reset');
});

ipcMain.on('toggle-objective', (_event, objectiveId) => {
  const progress = settingsManager.getProgress();
  const completed = progress.completedObjectives || [];

  const index = completed.indexOf(objectiveId);
  if (index > -1) {
    completed.splice(index, 1);
  } else {
    completed.push(objectiveId);
  }

  progress.completedObjectives = completed;
  settingsManager.saveProgress(progress);
});

// Timer IPC (async invoke)

ipcMain.handle('timer-toggle', async () => {
  return timerManager.toggle();
});

ipcMain.handle('timer-reset', async () => {
  return timerManager.reset();
});

ipcMain.handle('timer-split', async (_event, label) => {
  return timerManager.addSplit(label);
});

ipcMain.handle('timer-get', async () => {
  return timerManager.getState();
});

// Init log parser

function initLogParser(clientTxtPath) {
  logParser = new LogParser(clientTxtPath);

  logParser.on('zone-entered', (zoneName) => {
    console.log('Zone entered:', zoneName);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('zone-changed', zoneName);
    }
    // Auto-split timer on zone change
    if (timerManager.state.running) {
      timerManager.addSplit(zoneName);
    }
  });

  logParser.on('level-up', (level) => {
    console.log('Level up:', level);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('level-changed', level);
    }
  });

  logParser.on('error', (error) => {
    console.error('Log parser error:', error);
  });

  logParser.start();
}

// Cleanup

process.on('SIGINT', () => {
  if (logParser) logParser.stop();
  app.quit();
});
