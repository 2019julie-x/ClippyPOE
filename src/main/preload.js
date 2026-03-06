const { contextBridge, ipcRenderer } = require('electron');

// Keeping track of our IPC listeners so we don't mess up the original functions
const listenerMap = new WeakMap();

// Securing our API context bridge so the renderer can only call what we allow
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
      // Tracking these wrappers securely so we can remove listeners later if needed
      let channelMap = listenerMap.get(func);
      if (!channelMap) {
        channelMap = new Map();
        listenerMap.set(func, channelMap);
      }

      if (channelMap.has(channel)) {
        ipcRenderer.removeListener(channel, channelMap.get(channel));
      }

      const wrapper = (event, ...args) => func(...args); // strip the event object before forwarding
      channelMap.set(channel, wrapper);
      ipcRenderer.on(channel, wrapper);
    }
  },
});
