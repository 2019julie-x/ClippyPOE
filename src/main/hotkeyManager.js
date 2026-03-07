const { uIOhook, UiohookKey } = require('uiohook-napi');

class HotkeyManager {
  constructor() {
    this.bindings = new Map();
    this.isRunning = false;
    this.altTabTimeout = null;

    uIOhook.on('keydown', (e) => {
      this.handleKeydown(e);
    });
  }

  start() {
    if (!this.isRunning) {
      uIOhook.start();
      this.isRunning = true;
    }
  }

  stop() {
    if (this.isRunning) {
      uIOhook.stop();
      this.isRunning = false;
    }
  }

  clearAll() {
    this.bindings.clear();
  }

  /**
   * Parses a string like "Shift+F5" or "Ctrl+Alt+Space" into a binding object
   */
  parseHotkeyString(hotkeyStr) {
    if (!hotkeyStr) return null;

    const parts = hotkeyStr.split('+').map(p => p.trim());
    const binding = {
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      keycode: null
    };

    for (const part of parts) {
      const upper = part.toUpperCase();
      if (upper === 'CTRL' || upper === 'CONTROL') binding.ctrlKey = true;
      else if (upper === 'ALT') binding.altKey = true;
      else if (upper === 'SHIFT') binding.shiftKey = true;
      else if (upper === 'SUPER' || upper === 'META' || upper === 'CMD' || upper === 'WIN') binding.metaKey = true;
      else {
        // Map the key to UiohookKey
        // Handle numbers
        if (/^[0-9]$/.test(part)) {
          binding.keycode = UiohookKey[part];
        } 
        // Handle letters
        else if (/^[A-Z]$/i.test(part)) {
          binding.keycode = UiohookKey[part.toUpperCase()];
        }
        // Handle F-keys, Space, etc.
        else {
          // Capitalize first letter for UiohookKey matching (e.g., "Space", "F5")
          const formattedKey = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
          if (UiohookKey[formattedKey] !== undefined) {
            binding.keycode = UiohookKey[formattedKey];
          } else if (UiohookKey[part.toUpperCase()] !== undefined) {
            binding.keycode = UiohookKey[part.toUpperCase()];
          }
        }
      }
    }

    if (binding.keycode === null) {
      console.warn(`Could not parse keycode from hotkey string: ${hotkeyStr}`);
      return null;
    }

    return binding;
  }

  register(hotkeyStr, callback) {
    const binding = this.parseHotkeyString(hotkeyStr);
    if (!binding) return false;

    // Create a unique signature for this binding
    const signature = `${binding.ctrlKey ? '1' : '0'}${binding.altKey ? '1' : '0'}${binding.shiftKey ? '1' : '0'}${binding.metaKey ? '1' : '0'}_${binding.keycode}`;
    
    this.bindings.set(signature, callback);
    return true;
  }

  handleKeydown(e) {
    // Alt-Tab workaround: OS swallows keyup events during window switching,
    // leaving libuiohook with stuck modifier states.
    if (e.keycode === UiohookKey.Tab && e.altKey) {
      if (this.altTabTimeout) clearTimeout(this.altTabTimeout);
      this.altTabTimeout = setTimeout(() => {
        if (this.isRunning) {
          uIOhook.stop();
          uIOhook.start();
        }
      }, 1000);
    }

    // Ignore bare modifier presses
    if (
      e.keycode === UiohookKey.Ctrl || e.keycode === UiohookKey.CtrlRight ||
      e.keycode === UiohookKey.Alt || e.keycode === UiohookKey.AltRight ||
      e.keycode === UiohookKey.Shift || e.keycode === UiohookKey.ShiftRight ||
      e.keycode === UiohookKey.Meta || e.keycode === UiohookKey.MetaRight
    ) {
      return;
    }

    const signature = `${e.ctrlKey ? '1' : '0'}${e.altKey ? '1' : '0'}${e.shiftKey ? '1' : '0'}${e.metaKey ? '1' : '0'}_${e.keycode}`;
    
    const callback = this.bindings.get(signature);
    if (callback) {
      callback();
    }
  }
}

module.exports = new HotkeyManager();