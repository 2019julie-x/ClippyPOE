/**
 * Integration tests – IPC channel allowlists
 *
 * These tests verify that the preload bridge only exposes channels that are
 * intentionally whitelisted, and that the bridge rejects arbitrary channels
 * silently (no crash, no data leak).
 *
 * We cannot run real Electron IPC here, so we mock ipcRenderer and
 * contextBridge, then evaluate preload.js in that context.
 */

const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Mock electron module
// ---------------------------------------------------------------------------

let ipcListeners = {};
let sentMessages = [];
let sentSyncMessages = [];
let invokedMessages = [];

const mockIpcRenderer = {
  send: jest.fn((channel, data) => sentMessages.push({ channel, data })),
  sendSync: jest.fn((channel, data) => {
    sentSyncMessages.push({ channel, data });
    return `sync-result-${channel}`;
  }),
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

// ---------------------------------------------------------------------------
// Reset mocks between tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  sentMessages = [];
  sentSyncMessages = [];
  invokedMessages = [];
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// api.send() – fire-and-forget channels
// ---------------------------------------------------------------------------

describe('preload – api.send()', () => {
  const validChannels = [
    'open-settings',
    'close-window',
    'minimize-window',
    'save-progress',
    'toggle-objective',
    'save-settings',
    'reset-progress',
    'overlay-activate',
    'overlay-deactivate',
    'overlay-toggle',
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
});

// ---------------------------------------------------------------------------
// api.sendSync() – synchronous channels
// ---------------------------------------------------------------------------

describe('preload – api.sendSync()', () => {
  const validChannels = [
    'get-settings',
    'save-settings',
    'get-progress',
    'save-progress',
    'reset-progress',
    'toggle-objective',
    'timer-toggle',
    'timer-reset',
    'timer-split',
    'timer-get',
  ];

  validChannels.forEach((channel) => {
    test(`allows valid channel: ${channel}`, () => {
      const result = api.sendSync(channel);
      expect(mockIpcRenderer.sendSync).toHaveBeenCalledWith(channel, undefined);
      expect(result).toBe(`sync-result-${channel}`);
    });
  });

  test('returns undefined for unlisted channels (no IPC call)', () => {
    const result = api.sendSync('evil-sync-channel');
    expect(mockIpcRenderer.sendSync).not.toHaveBeenCalled();
    expect(result).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// api.invoke() – async request-reply channels
// ---------------------------------------------------------------------------

describe('preload – api.invoke()', () => {
  const validChannels = [
    'browse-client-txt',
    'load-guide-data',
    'load-gem-data',
    'load-cheatsheet-data',
    'get-platform-info',
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

// ---------------------------------------------------------------------------
// api.receive() – incoming IPC event subscriptions
// ---------------------------------------------------------------------------

describe('preload – api.receive()', () => {
  const validChannels = [
    'zone-changed',
    'level-changed',
    'progress-reset',
    'overlay-opacity',
    'overlay-mode-changed',
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
