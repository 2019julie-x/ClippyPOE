const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    send: (channel, data) => {
      // whitelist channels
      let validChannels = ['open-settings', 'close-window', 'minimize-window'];
      if (validChannels.includes(channel)) {
        ipcRenderer.send(channel, data);
      }
    },
    sendSync: (channel, data) => {
      // whitelist sync channels
      let validChannels = ['get-settings', 'save-settings', 'get-progress', 'save-progress', 'reset-progress', 'toggle-objective'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.sendSync(channel, data);
      }
    },
    invoke: (channel, data) => {
      let validChannels = ['browse-client-txt', 'load-guide-data'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
    receive: (channel, func) => {
      let validChannels = ['zone-changed', 'level-changed', 'progress-reset'];
      if (validChannels.includes(channel)) {
        // Remove any previously registered listeners on this channel before
        // adding a new one, so that reloads cannot stack duplicate handlers.
        ipcRenderer.removeAllListeners(channel);
        // Deliberately strip event as it includes `sender`
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
  }
);