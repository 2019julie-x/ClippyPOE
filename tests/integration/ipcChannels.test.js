const path = require('path');
const fs = require('fs');
// Mock electron module
let ipcListeners = {};
let sentMessages = [];
let invokedMessages = [];
const mockIpcRenderer = {
  send: jest.fn((channel, data) => sentMessages.push({ channel, data })),
  invoke: jest.fn(async (channel, data) => {
    invokedMessages.push({ channel, data });
    return `invoke-result-${channel}`;
  }),
  on: jest.fn((channel, fn) => {
    if (!ipcListeners[channel]) ipcListeners[channel] = [];
    ipcListeners[channel].push(fn);
  }),
  removeListener: jest.fn((channel, fn) => {
    if (ipcListeners[channel]) {
      ipcListeners[channel] = ipcListeners[channel].filter((f) => f !== fn);
    }
  }),
  removeAllListeners: jest.fn((channel) => {
    delete ipcListeners[channel];
  }),
};
const exposedApis = {};
const mockContextBridge = {
  exposeInMainWorld: jest.fn((key, api) => {
    exposedApis[key] = api;
  }),
};
jest.mock('electron', () => ({
  contextBridge: mockContextBridge,
  ipcRenderer: mockIpcRenderer,
}));
// Load preload.js
require('../../src/main/preload');
const api = exposedApis.api;
// Reset mocks between tests
beforeEach(() => {
  sentMessages = [];
  invokedMessages = [];
  jest.clearAllMocks();
});
// api.send() – fire-and-forget channels
describe('preload – api.send()', () => {
  const validChannels = [
    'open-settings',
    'close-window',
    'minimize-window',
    'save-progress',
    'toggle-objective',
    'reset-progress',
    'overlay-activate',
    'overlay-deactivate',
    'overlay-toggle',
    'overlay-collapse-toggle',
  ];
  validChannels.forEach((channel) => {
    test(`allows valid channel: ${channel}`, () => {
      api.send(channel, { test: true });
      expect(mockIpcRenderer.send).toHaveBeenCalledWith(channel, { test: true });
    });
  });
  test('silently ignores unlisted channels', () => {
    api.send('exec-arbitrary-code', 'payload');
    expect(mockIpcRenderer.send).not.toHaveBeenCalled();
  });
  test('silently ignores empty string channel', () => {
    api.send('', null);
    expect(mockIpcRenderer.send).not.toHaveBeenCalled();
  });
  test('silently ignores channels not in allowlist', () => {
    api.send('require', 'fs');
    api.send('__proto__', {});
    expect(mockIpcRenderer.send).not.toHaveBeenCalled();
  });
  test('save-settings and save-progress are no longer in send allowlist', () => {
    api.send('save-settings', {});
    expect(mockIpcRenderer.send).not.toHaveBeenCalled();
  });
});
// api.invoke() – async request-reply channels (now includes former sendSync channels)
describe('preload – api.invoke()', () => {
  const validChannels = [
    'browse-client-txt',
    'load-guide-data',
    'load-gem-data',
    'load-cheatsheet-data',
    'get-platform-info',
    // Migrated from sendSync
    'get-settings',
    'save-settings',
    'get-progress',
    'timer-toggle',
    'timer-reset',
    'timer-split',
    'timer-get',
  ];
  validChannels.forEach((channel) => {
    test(`allows valid channel: ${channel}`, async () => {
      const result = await api.invoke(channel);
      expect(mockIpcRenderer.invoke).toHaveBeenCalledWith(channel, undefined);
      expect(result).toBe(`invoke-result-${channel}`);
    });
  });
  test('returns undefined for unlisted channels', async () => {
    const result = await api.invoke('load-evil-data');
    expect(mockIpcRenderer.invoke).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});
// api.receive() – incoming IPC event subscriptions
describe('preload – api.receive()', () => {
  const validChannels = [
    'zone-changed',
    'level-changed',
    'progress-reset',
    'overlay-opacity',
    'overlay-mode-changed',
    'overlay-collapsed',
    'timer-tick',
    'timer-state',
    'hotkey-next-zone',
    'hotkey-prev-zone',
  ];
  validChannels.forEach((channel) => {
    test(`subscribes to valid channel: ${channel}`, () => {
      const callback = jest.fn();
      api.receive(channel, callback);
      expect(mockIpcRenderer.on).toHaveBeenCalledWith(channel, expect.any(Function));
    });
  });
  test('ignores unlisted channels (no subscription created)', () => {
    const callback = jest.fn();
    api.receive('__proto__', callback);
    api.receive('arbitrary-channel', callback);
    expect(mockIpcRenderer.on).not.toHaveBeenCalled();
  });
  test('strips the event object when forwarding to callback', () => {
    const callback = jest.fn();
    api.receive('zone-changed', callback);
    // Get the wrapper function that was registered
    const wrapperFn = mockIpcRenderer.on.mock.calls[0][1];
    const fakeEvent = { sender: {} };
    wrapperFn(fakeEvent, 'Lioneye\'s Watch');
    // callback should receive only the payload, not the event
    expect(callback).toHaveBeenCalledWith('Lioneye\'s Watch');
    expect(callback).not.toHaveBeenCalledWith(fakeEvent, expect.anything());
  });
  test('re-subscribing removes old listener before adding new one', () => {
    const cb = jest.fn();
    api.receive('zone-changed', cb);
    // First call: no prior wrapper, so removeListener not called yet
    expect(mockIpcRenderer.removeListener).not.toHaveBeenCalled();
    // Second call: cb now has _ipcWrapper, so removeListener IS called
    api.receive('zone-changed', cb);
    expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('zone-changed', expect.any(Function));
  });
});
// api.removeReceive() – unsubscribe from IPC events
describe('preload – api.removeReceive()', () => {
  test('removes a previously registered listener', () => {
    const cb = jest.fn();
    api.receive('timer-tick', cb);
    api.removeReceive('timer-tick', cb);
    expect(mockIpcRenderer.removeListener).toHaveBeenCalledWith('timer-tick', expect.any(Function));
  });
  test('does nothing for unlisted channels', () => {
    const cb = jest.fn();
    api.removeReceive('evil-channel', cb);
    expect(mockIpcRenderer.removeListener).not.toHaveBeenCalled();
  });
  test('does nothing if func was never registered', () => {
    const cb = jest.fn();
    api.removeReceive('zone-changed', cb);
    expect(mockIpcRenderer.removeListener).not.toHaveBeenCalled();
  });
});
// sendSync no longer exists
describe('preload – sendSync removed', () => {
  test('api.sendSync is not exposed', () => {
    expect(api.sendSync).toBeUndefined();
  });
});
