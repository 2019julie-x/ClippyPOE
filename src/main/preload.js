const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

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
      let validChannels = ['browse-client-txt'];
      if (validChannels.includes(channel)) {
        return ipcRenderer.invoke(channel, data);
      }
    },
    receive: (channel, func) => {
      let validChannels = ['zone-changed', 'level-changed', 'progress-reset'];
      if (validChannels.includes(channel)) {
        // Deliberately strip event as it includes `sender` 
        ipcRenderer.on(channel, (event, ...args) => func(...args));
      }
    },
    // We expose limited fs/path functionality to the renderer for loading guide data
    // so we don't need to refactor the entire app.js
    loadGuideData: () => {
      try {
        const guidePath = path.join(__dirname, '../../data/guides/campaign.json');
        const data = fs.readFileSync(guidePath, 'utf8');
        return JSON.parse(data);
      } catch (err) {
        console.error('Error loading guide data:', err);
        return null;
      }
    }
  }
);