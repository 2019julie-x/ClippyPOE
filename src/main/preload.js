const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  send: (channel, data) => {
    const validChannels = [
      'open-settings',
      'close-window',
      'minimize-window',
      'save-progress',
      'toggle-objective',
      'save-settings',
      'reset-progress',
      // Overlay control
      'overlay-activate',
      'overlay-deactivate',
      'overlay-toggle',
    ];
    if (validChannels.includes(channel)) {
      ipcRenderer.send(channel, data);
    }
  },

  sendSync: (channel, data) => {
    const validChannels = [
      'get-settings',
      'save-settings',
      'get-progress',
      'save-progress',
      'reset-progress',
      'toggle-objective',
      // Timer
      'timer-toggle',
      'timer-reset',
      'timer-split',
      'timer-get',
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.sendSync(channel, data);
    }
  },

  invoke: (channel, data) => {
    const validChannels = [
      'browse-client-txt',
      'load-guide-data',
      'load-gem-data',
      'load-cheatsheet-data',
      'get-platform-info',
    ];
    if (validChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, data);
    }
  },

  receive: (channel, func) => {
    const validChannels = [
      'zone-changed',
      'level-changed',
      'progress-reset',
      // Overlay events
      'overlay-opacity',
      'overlay-mode-changed',
      // Timer events
      'timer-tick',
      'timer-state',
      // Hotkey events
      'hotkey-next-zone',
      'hotkey-prev-zone',
    ];
    if (validChannels.includes(channel)) {
      // Use a named wrapper stored on the function so we can remove only OUR
      // listener on re-subscription, rather than nuking ALL listeners on
      // the channel (which could break other parts of the app).
      if (func._ipcWrapper) {
        ipcRenderer.removeListener(channel, func._ipcWrapper);
      }
      const wrapper = (event, ...args) => func(...args);
      func._ipcWrapper = wrapper;
      ipcRenderer.on(channel, wrapper);
    }
  },
});
