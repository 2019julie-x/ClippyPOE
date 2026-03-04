const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const LogParser = require('./logParser');
const SettingsManager = require('./settingsManager');

let mainWindow = null;
let settingsWindow = null;
let logParser = null;
let settingsManager = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 380,
    height: 280,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  // Restore window position from settings
  const position = settingsManager.getWindowPosition();
  if (position) {
    mainWindow.setPosition(position.x, position.y);
  }

  // Save window position on move
  mainWindow.on('move', () => {
    const [x, y] = mainWindow.getPosition();
    settingsManager.saveWindowPosition(x, y);
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
    width: 500,
    height: 400,
    parent: mainWindow,
    modal: true,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));

  settingsWindow.once('ready-to-show', () => {
    settingsWindow.show();
  });

  settingsWindow.on('closed', () => {
    settingsWindow = null;
  });
}

app.whenReady().then(() => {
  settingsManager = new SettingsManager();
  createMainWindow();

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

// IPC Handlers
ipcMain.on('open-settings', () => {
  createSettingsWindow();
});

ipcMain.on('close-window', () => {
  if (mainWindow) {
    mainWindow.close();
  }
});

ipcMain.on('minimize-window', () => {
  if (mainWindow) {
    mainWindow.minimize();
  }
});

ipcMain.on('get-settings', (event) => {
  event.returnValue = settingsManager.getSettings();
});

ipcMain.on('save-settings', (event, settings) => {
  settingsManager.saveSettings(settings);
  
  // Restart log parser with new path
  if (logParser) {
    logParser.stop();
  }
  if (settings.clientTxtPath && fs.existsSync(settings.clientTxtPath)) {
    initLogParser(settings.clientTxtPath);
  }
  
  event.returnValue = true;
});

ipcMain.handle('browse-client-txt', async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(window, {
    title: 'Select Path of Exile Client.txt',
    defaultPath: 'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile\\logs',
    filters: [
      { name: 'Log Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ],
    properties: ['openFile']
  });

  if (!result.canceled && result.filePaths.length > 0) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.on('get-progress', (event) => {
  event.returnValue = settingsManager.getProgress();
});

ipcMain.on('save-progress', (event, progress) => {
  settingsManager.saveProgress(progress);
  event.returnValue = true;
});

ipcMain.on('reset-progress', (event) => {
  settingsManager.resetProgress();
  if (mainWindow) {
    mainWindow.webContents.send('progress-reset');
  }
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

function initLogParser(clientTxtPath) {
  logParser = new LogParser(clientTxtPath);
  
  logParser.on('zone-entered', (zoneName) => {
    console.log('Zone entered:', zoneName);
    if (mainWindow) {
      mainWindow.webContents.send('zone-changed', zoneName);
    }
  });

  logParser.on('level-up', (level) => {
    console.log('Level up:', level);
    if (mainWindow) {
      mainWindow.webContents.send('level-changed', level);
    }
  });

  logParser.on('error', (error) => {
    console.error('Log parser error:', error);
  });

  logParser.start();
}

// Graceful shutdown
process.on('SIGINT', () => {
  if (logParser) {
    logParser.stop();
  }
  app.quit();
});
