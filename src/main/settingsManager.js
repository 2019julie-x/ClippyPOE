const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SettingsManager {
  constructor() {
    this.configDir = path.join(app.getPath('userData'), 'config');
    this.settingsPath = path.join(this.configDir, 'settings.json');
    this.backupPath = path.join(this.configDir, 'settings.json.bak');

    this.defaultSettings = {
      clientTxtPath: '',
      opacity: 0.95,
      windowPosition: { x: 100, y: 100 },
      windowSize: { width: 400, height: 600 },
      autoDetect: true,
      theme: 'dark',
      hotkeys: {
        toggleOverlay: 'Shift+Space',
        hideOverlay: 'Shift+F1',
        nextZone: 'Shift+F2',
        prevZone: 'Shift+F3',
        toggleTimer: 'Shift+F4',
      },
      magnetization: {
        enabled: true,
        snapDistance: 20,
      },
      activeTab: 'guide',
      currentProgress: {
        act: 1,
        zone: null,
        completedObjectives: [],
        currentLevel: 1,
      },
    };

    // Debounce disk writes for high-frequency updates (window move/resize)
    this.saveTimeout = null;
    this.saveDelayMs = 500;

    this.ensureConfigDirectory();
    this.loadSettings();
  }

  ensureConfigDirectory() {
    if (!fs.existsSync(this.configDir)) {
      fs.mkdirSync(this.configDir, { recursive: true });
    }
  }

  loadSettings() {
    try {
      let dataToParse = null;
      if (fs.existsSync(this.settingsPath)) {
        dataToParse = fs.readFileSync(this.settingsPath, 'utf8');
        fs.copyFileSync(this.settingsPath, this.backupPath);
      } else if (fs.existsSync(this.backupPath)) {
        dataToParse = fs.readFileSync(this.backupPath, 'utf8');
      }

      if (dataToParse) {
        const parsed = JSON.parse(dataToParse);
        // Deep merge to preserve new defaults for nested objects
        this.settings = {
          ...this.defaultSettings,
          ...parsed,
          hotkeys: { ...this.defaultSettings.hotkeys, ...(parsed.hotkeys || {}) },
          magnetization: { ...this.defaultSettings.magnetization, ...(parsed.magnetization || {}) },
          currentProgress: {
            ...this.defaultSettings.currentProgress,
            ...(parsed.currentProgress || {}),
          },
        };
      } else {
        this.settings = { ...this.defaultSettings };
        this.saveSettingsToFile(true);
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      this.settings = { ...this.defaultSettings };
    }
  }

  saveSettingsToFile(immediate = false) {
    if (this.saveTimeout) {
      clearTimeout(this.saveTimeout);
    }

    if (immediate) {
      try {
        const tempPath = this.settingsPath + '.tmp';
        const data = JSON.stringify(this.settings, null, 2);
        // Atomic write: write to temp then rename
        fs.writeFileSync(tempPath, data, 'utf8');
        fs.renameSync(tempPath, this.settingsPath);
      } catch (err) {
        console.error('Error saving settings:', err);
      }
    } else {
      const performSave = async () => {
        this.saveTimeout = null;
        try {
          const tempPath = this.settingsPath + '.tmp';
          const data = JSON.stringify(this.settings, null, 2);
          // Atomic write: write to temp then rename asynchronously
          await fs.promises.writeFile(tempPath, data, 'utf8');
          await fs.promises.rename(tempPath, this.settingsPath);
        } catch (err) {
          console.error('Error saving settings:', err);
        }
      };
      this.saveTimeout = setTimeout(performSave, this.saveDelayMs);
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  saveSettings(newSettings) {
    // Carefully merging settings here so we don't accidentally erase any parts
    this.settings = {
      ...this.settings,
      ...newSettings,
      hotkeys: {
        ...this.settings.hotkeys,
        ...(newSettings.hotkeys || {}),
      },
      magnetization: {
        ...this.settings.magnetization,
        ...(newSettings.magnetization || {}),
      },
      currentProgress: {
        ...this.settings.currentProgress,
        ...(newSettings.currentProgress || {}),
      },
    };
    this.saveSettingsToFile();
  }

  getClientTxtPath() {
    return this.settings.clientTxtPath;
  }

  getWindowPosition() {
    return this.settings.windowPosition;
  }

  saveWindowPosition(x, y) {
    this.settings.windowPosition = { x, y };
    this.saveSettingsToFile();
  }

  getWindowSize() {
    return this.settings.windowSize;
  }

  saveWindowSize(width, height) {
    this.settings.windowSize = { width, height };
    this.saveSettingsToFile();
  }

  getProgress() {
    return { ...this.settings.currentProgress };
  }

  saveProgress(progress) {
    this.settings.currentProgress = {
      ...this.settings.currentProgress,
      ...progress,
    };
    this.saveSettingsToFile();
  }

  resetProgress() {
    this.settings.currentProgress = {
      act: 1,
      zone: null,
      completedObjectives: [],
      currentLevel: 1,
    };
    this.saveSettingsToFile();
  }
}

module.exports = SettingsManager;
