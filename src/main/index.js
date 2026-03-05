const { app, BrowserWindow, ipcMain, dialog, globalShortcut } = require('electron');
const path = require('path');
const fs = require('fs');
const LogParser = require('./logParser');
const SettingsManager = require('./settingsManager');
const OverlayController = require('./overlayController');
const {
  getPlatformInfo,
  getDefaultClientTxtPaths,
  configureAppForPlatform,
  getOverlayWindowOptions,
  applyOverlayBehavior,
} = require('./platformUtils');

// ---------------------------------------------------------------------------
// Platform detection & early configuration (MUST happen before app.whenReady)
// ---------------------------------------------------------------------------
const platformInfo = getPlatformInfo();
configureAppForPlatform(app, platformInfo);

// ---------------------------------------------------------------------------
// Global state
// ---------------------------------------------------------------------------
let mainWindow = null;
let settingsWindow = null;
let logParser = null;
let settingsManager = null;
let overlayController = null;
let cachedGuideData = null;
let cachedGemData = null;
let cachedCheatsheetData = null;

// Timer state (managed in main so it persists across renderer reloads)
let timerState = { running: false, elapsed: 0, startTime: null, splits: [] };
let timerInterval = null;

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

function createMainWindow() {
  const overlayOpts = getOverlayWindowOptions(platformInfo);

  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    minWidth: 320,
    minHeight: 200,
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

  // Show only when the renderer is ready (prevents transparent flash)
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    // Start in interactive mode
    overlayController.activate();
  });

  // Restore window position from settings
  const position = settingsManager.getWindowPosition();
  if (position) {
    mainWindow.setPosition(position.x, position.y);
  }

  // Restore window size from settings
  const size = settingsManager.getWindowSize();
  if (size) {
    mainWindow.setSize(size.width, size.height);
  }

  // Save window position on move (debounced inside settingsManager)
  mainWindow.on('move', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [x, y] = mainWindow.getPosition();
      settingsManager.saveWindowPosition(x, y);
    }
  });

  // Save window size on resize
  mainWindow.on('resize', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      const [width, height] = mainWindow.getSize();
      settingsManager.saveWindowSize(width, height);
    }
  });

  mainWindow.on('closed', () => {
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

// ---------------------------------------------------------------------------
// Global hotkeys
// ---------------------------------------------------------------------------

function registerHotkeys() {
  const settings = settingsManager.getSettings();

  // Toggle overlay interactive / clickthrough
  const toggleKey = settings.hotkeys?.toggleOverlay || 'Shift+Space';
  try {
    globalShortcut.register(toggleKey, () => {
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
  } catch (err) {
    console.warn(`Failed to register hotkey "${toggleKey}":`, err.message);
  }

  // Toggle overlay visibility
  const hideKey = settings.hotkeys?.hideOverlay || 'Shift+F1';
  try {
    globalShortcut.register(hideKey, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isVisible()) {
          mainWindow.hide();
        } else {
          mainWindow.show();
        }
      }
    });
  } catch (err) {
    console.warn(`Failed to register hotkey "${hideKey}":`, err.message);
  }

  // Navigate next zone
  const nextZoneKey = settings.hotkeys?.nextZone || 'Shift+F2';
  try {
    globalShortcut.register(nextZoneKey, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-next-zone');
      }
    });
  } catch (err) {
    console.warn(`Failed to register hotkey "${nextZoneKey}":`, err.message);
  }

  // Navigate prev zone
  const prevZoneKey = settings.hotkeys?.prevZone || 'Shift+F3';
  try {
    globalShortcut.register(prevZoneKey, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('hotkey-prev-zone');
      }
    });
  } catch (err) {
    console.warn(`Failed to register hotkey "${prevZoneKey}":`, err.message);
  }

  // Toggle timer
  const timerKey = settings.hotkeys?.toggleTimer || 'Shift+F4';
  try {
    globalShortcut.register(timerKey, () => {
      toggleTimer();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('timer-state', timerState);
      }
    });
  } catch (err) {
    console.warn(`Failed to register hotkey "${timerKey}":`, err.message);
  }
}

// ---------------------------------------------------------------------------
// Timer logic
// ---------------------------------------------------------------------------

function toggleTimer() {
  if (timerState.running) {
    // Pause
    timerState.elapsed += Date.now() - timerState.startTime;
    timerState.startTime = null;
    timerState.running = false;
    if (timerInterval) {
      clearInterval(timerInterval);
      timerInterval = null;
    }
  } else {
    // Start / resume
    timerState.startTime = Date.now();
    timerState.running = true;
    timerInterval = setInterval(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('timer-tick', getTimerElapsed());
      }
    }, 1000);
  }
}

function getTimerElapsed() {
  if (timerState.running && timerState.startTime) {
    return timerState.elapsed + (Date.now() - timerState.startTime);
  }
  return timerState.elapsed;
}

function resetTimer() {
  timerState = { running: false, elapsed: 0, startTime: null, splits: [] };
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function addTimerSplit(label) {
  timerState.splits.push({ label, time: getTimerElapsed() });
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  settingsManager = new SettingsManager();
  overlayController = new OverlayController(
    platformInfo,
    settingsManager.getSettings().opacity || 0.95
  );

  createMainWindow();
  registerHotkeys();

  // Initialize log parser if Client.txt path is configured
  const clientTxtPath = settingsManager.getClientTxtPath();
  if (clientTxtPath && fs.existsSync(clientTxtPath)) {
    initLogParser(clientTxtPath);
  } else {
    // Show settings window on first run
    setTimeout(() => {
      createSettingsWindow();
    }, 1000);
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  if (logParser) {
    logParser.stop();
  }
  if (timerInterval) {
    clearInterval(timerInterval);
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

// ---------------------------------------------------------------------------
// IPC Handlers – Window management
// ---------------------------------------------------------------------------

ipcMain.on('open-settings', () => {
  // Make overlay interactive so the settings modal works
  if (overlayController) overlayController.activate();
  createSettingsWindow();
});

ipcMain.on('close-window', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) mainWindow.minimize();
});

// ---------------------------------------------------------------------------
// IPC Handlers – Overlay control
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// IPC Handlers – Settings
// ---------------------------------------------------------------------------

ipcMain.on('get-settings', (event) => {
  event.returnValue = settingsManager.getSettings();
});

ipcMain.on('save-settings', (event, settings) => {
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
      event.returnValue = false;
      return;
    }
  }

  settingsManager.saveSettings(settings);

  // Update overlay opacity if changed
  if (settings.opacity !== undefined && overlayController) {
    overlayController.setBaseOpacity(settings.opacity);
  }

  // Re-register hotkeys if changed
  if (settings.hotkeys) {
    globalShortcut.unregisterAll();
    registerHotkeys();
  }

  // Restart log parser with new path
  if (logParser) logParser.stop();
  if (rawPath && fs.existsSync(rawPath)) {
    initLogParser(rawPath);
  }

  event.returnValue = true;
});

// ---------------------------------------------------------------------------
// IPC Handlers – Data loading
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// IPC Handlers – File browser
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// IPC Handlers – Progress
// ---------------------------------------------------------------------------

ipcMain.on('get-progress', (event) => {
  event.returnValue = settingsManager.getProgress();
});

ipcMain.on('save-progress', (event, progress) => {
  settingsManager.saveProgress(progress);
  event.returnValue = true;
});

ipcMain.on('reset-progress', (event) => {
  settingsManager.resetProgress();
  resetTimer();
  if (mainWindow) mainWindow.webContents.send('progress-reset');
  event.returnValue = true;
});

ipcMain.on('toggle-objective', (event, objectiveId) => {
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
  event.returnValue = true;
});

// ---------------------------------------------------------------------------
// IPC Handlers – Timer
// ---------------------------------------------------------------------------

ipcMain.on('timer-toggle', (event) => {
  toggleTimer();
  event.returnValue = timerState;
});

ipcMain.on('timer-reset', (event) => {
  resetTimer();
  event.returnValue = timerState;
});

ipcMain.on('timer-split', (event, label) => {
  addTimerSplit(label);
  event.returnValue = timerState;
});

ipcMain.on('timer-get', (event) => {
  event.returnValue = { ...timerState, elapsed: getTimerElapsed() };
});

// ---------------------------------------------------------------------------
// Log parser
// ---------------------------------------------------------------------------

function initLogParser(clientTxtPath) {
  logParser = new LogParser(clientTxtPath);

  logParser.on('zone-entered', (zoneName) => {
    console.log('Zone entered:', zoneName);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('zone-changed', zoneName);
    }
    // Auto-split timer on zone change
    if (timerState.running) {
      addTimerSplit(zoneName);
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

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

process.on('SIGINT', () => {
  if (logParser) logParser.stop();
  app.quit();
});
