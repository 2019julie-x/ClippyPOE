const { globalShortcut } = require('electron');

class HotkeyManager {
  constructor() {
    this.bindings = new Map();
    this.isRunning = false;
  }

  start() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.registerAll();
    }
  }

  stop() {
    if (this.isRunning) {
      globalShortcut.unregisterAll();
      this.isRunning = false;
    }
  }

  clearAll() {
    this.bindings.clear();
    if (this.isRunning) {
      globalShortcut.unregisterAll();
    }
  }

  /**
   * Parses a string like "Shift+F5" or "Ctrl+Alt+Space" into an Electron accelerator string
   */
  parseHotkeyString(hotkeyStr) {
    if (!hotkeyStr) return null;

    const parts = hotkeyStr.split('+').map(p => p.trim());
    const formattedParts = [];

    for (const part of parts) {
      const upper = part.toUpperCase();
      if (upper === 'CTRL' || upper === 'CONTROL') formattedParts.push('CommandOrControl');
      else if (upper === 'ALT') formattedParts.push('Alt');
      else if (upper === 'SHIFT') formattedParts.push('Shift');
      else if (upper === 'SUPER' || upper === 'META' || upper === 'CMD' || upper === 'WIN') formattedParts.push('Super');
      else {
        // Handle numbers and letters
        if (/^[0-9A-Z]$/i.test(part)) {
          formattedParts.push(part.toUpperCase());
        }
        // Handle F-keys
        else if (/^F[1-9][0-2]?$/i.test(part)) {
          formattedParts.push(part.toUpperCase());
        }
        // Handle Space, Enter, etc.
        else {
          const formattedKey = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          formattedParts.push(formattedKey);
        }
      }
    }

    return formattedParts.join('+');
  }

  register(hotkeyStr, callback) {
    const accelerator = this.parseHotkeyString(hotkeyStr);
    if (!accelerator) return false;

    this.bindings.set(accelerator, callback);
    
    if (this.isRunning) {
      try {
        globalShortcut.register(accelerator, callback);
      } catch (e) {
        console.error(`Failed to register hotkey: ${accelerator}`, e);
        return false;
      }
    }
    return true;
  }

  registerAll() {
    globalShortcut.unregisterAll();
    for (const [accelerator, callback] of this.bindings.entries()) {
      try {
        globalShortcut.register(accelerator, callback);
      } catch (e) {
        console.error(`Failed to register hotkey: ${accelerator}`, e);
      }
    }
  }
}

module.exports = new HotkeyManager();
