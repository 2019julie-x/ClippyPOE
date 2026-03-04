const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SettingsManager {
  constructor() {
    this.configDir = path.join(app.getPath('userData'), 'config');
    this.settingsPath = path.join(this.configDir, 'settings.json');
    this.defaultSettings = {
      clientTxtPath: '',
      opacity: 0.95,
      windowPosition: { x: 100, y: 100 },
      autoDetect: true,
      theme: 'dark',
      currentProgress: {
        act: 1,
        zone: null,
        completedObjectives: [],
        currentLevel: 1
      }
    };

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
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        this.settings = { ...this.defaultSettings, ...JSON.parse(data) };
      } else {
        this.settings = { ...this.defaultSettings };
        this.saveSettingsToFile();
      }
    } catch (err) {
      console.error('Error loading settings:', err);
      this.settings = { ...this.defaultSettings };
    }
  }

  saveSettingsToFile() {
    try {
      fs.writeFileSync(
        this.settingsPath,
        JSON.stringify(this.settings, null, 2),
        'utf8'
      );
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  }

  getSettings() {
    return { ...this.settings };
  }

  saveSettings(newSettings) {
    this.settings = { ...this.settings, ...newSettings };
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

  getProgress() {
    return { ...this.settings.currentProgress };
  }

  saveProgress(progress) {
    this.settings.currentProgress = { ...this.settings.currentProgress, ...progress };
    this.saveSettingsToFile();
  }

  resetProgress() {
    this.settings.currentProgress = {
      act: 1,
      zone: null,
      completedObjectives: [],
      currentLevel: 1
    };
    this.saveSettingsToFile();
  }
}

module.exports = SettingsManager;
