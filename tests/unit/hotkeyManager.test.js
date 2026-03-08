// Mock uiohook-napi before requiring the module
const mockUIOhook = {
  on: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
};

// UiohookKey codes matching the real library
const MockUiohookKey = {
  A: 30, B: 48, C: 46, D: 32, E: 18, F: 33, G: 34, H: 35,
  I: 23, J: 36, K: 37, L: 38, M: 50, N: 49, O: 24, P: 25,
  Q: 16, R: 19, S: 31, T: 20, U: 22, V: 47, W: 17, X: 45,
  Y: 21, Z: 44,
  0: 11, 1: 2, 2: 3, 3: 4, 4: 5, 5: 6, 6: 7, 7: 8, 8: 9, 9: 10,
  F1: 59, F2: 60, F3: 61, F4: 62, F5: 63, F6: 64, F7: 65,
  F8: 66, F9: 67, F10: 68, F11: 87, F12: 88,
  Space: 57, Tab: 15, Enter: 28,
  Ctrl: 29, CtrlRight: 3613,
  Alt: 56, AltRight: 3640,
  Shift: 42, ShiftRight: 54,
  Meta: 3675, MetaRight: 3676,
};

jest.mock('uiohook-napi', () => ({
  uIOhook: mockUIOhook,
  UiohookKey: MockUiohookKey,
}));

// HotkeyManager is a singleton — we need to get a fresh instance for testing
// The module exports an instance, so we access its class methods directly
let hotkeyManager;
let keydownHandler;

beforeEach(() => {
  jest.useFakeTimers();
  mockUIOhook.on.mockReset();
  mockUIOhook.start.mockReset();
  mockUIOhook.stop.mockReset();

  // Clear the module cache to get a fresh singleton
  jest.resetModules();
  jest.mock('uiohook-napi', () => ({
    uIOhook: mockUIOhook,
    UiohookKey: MockUiohookKey,
  }));
  hotkeyManager = require('../../src/main/hotkeyManager');

  // Capture the keydown handler registered in the constructor
  keydownHandler = mockUIOhook.on.mock.calls.find(
    ([event]) => event === 'keydown'
  )?.[1];
});

afterEach(() => {
  jest.useRealTimers();
});

// parseHotkeyString()

describe('HotkeyManager – parseHotkeyString()', () => {
  test('parses single modifier + F-key', () => {
    const result = hotkeyManager.parseHotkeyString('Shift+F5');
    expect(result).toEqual({
      ctrlKey: false, altKey: false, shiftKey: true, metaKey: false,
      keycode: MockUiohookKey.F5,
    });
  });

  test('parses multiple modifiers', () => {
    const result = hotkeyManager.parseHotkeyString('Ctrl+Shift+Space');
    expect(result).toEqual({
      ctrlKey: true, altKey: false, shiftKey: true, metaKey: false,
      keycode: MockUiohookKey.Space,
    });
  });

  test('parses single letter key with modifier', () => {
    const result = hotkeyManager.parseHotkeyString('Ctrl+A');
    expect(result).toEqual({
      ctrlKey: true, altKey: false, shiftKey: false, metaKey: false,
      keycode: MockUiohookKey.A,
    });
  });

  test('parses numeric key with modifier', () => {
    const result = hotkeyManager.parseHotkeyString('Alt+1');
    expect(result).toEqual({
      ctrlKey: false, altKey: true, shiftKey: false, metaKey: false,
      keycode: MockUiohookKey[1],
    });
  });

  test('handles Super/Meta/CMD/WIN modifiers', () => {
    for (const mod of ['Super', 'Meta', 'CMD', 'WIN']) {
      const result = hotkeyManager.parseHotkeyString(`${mod}+A`);
      expect(result.metaKey).toBe(true);
    }
  });

  test('handles Control as alias for Ctrl', () => {
    const result = hotkeyManager.parseHotkeyString('Control+F1');
    expect(result.ctrlKey).toBe(true);
    expect(result.keycode).toBe(MockUiohookKey.F1);
  });

  test('returns null for empty string', () => {
    expect(hotkeyManager.parseHotkeyString('')).toBeNull();
  });

  test('returns null for null input', () => {
    expect(hotkeyManager.parseHotkeyString(null)).toBeNull();
  });

  test('returns null for undefined input', () => {
    expect(hotkeyManager.parseHotkeyString(undefined)).toBeNull();
  });

  test('returns null for unrecognized key', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const result = hotkeyManager.parseHotkeyString('Shift+UnknownKey123');
    expect(result).toBeNull();
    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  test('parses all F-keys F1 through F12', () => {
    for (let i = 1; i <= 12; i++) {
      const result = hotkeyManager.parseHotkeyString(`Shift+F${i}`);
      expect(result).not.toBeNull();
      expect(result.keycode).toBe(MockUiohookKey[`F${i}`]);
    }
  });

  test('is case-insensitive for modifiers', () => {
    const result = hotkeyManager.parseHotkeyString('ctrl+shift+a');
    expect(result.ctrlKey).toBe(true);
    expect(result.shiftKey).toBe(true);
    expect(result.keycode).toBe(MockUiohookKey.A);
  });
});

// register()

describe('HotkeyManager – register()', () => {
  test('registers a valid hotkey and returns true', () => {
    const cb = jest.fn();
    expect(hotkeyManager.register('Shift+F5', cb)).toBe(true);
  });

  test('returns false for invalid hotkey string', () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    expect(hotkeyManager.register('InvalidHotkey!!!', jest.fn())).toBe(false);
    consoleSpy.mockRestore();
  });

  test('returns false for empty string', () => {
    expect(hotkeyManager.register('', jest.fn())).toBe(false);
  });

  test('overwrites binding when same hotkey is registered twice', () => {
    const cb1 = jest.fn();
    const cb2 = jest.fn();
    hotkeyManager.register('Shift+F1', cb1);
    hotkeyManager.register('Shift+F1', cb2);

    // Simulate keydown
    keydownHandler({
      keycode: MockUiohookKey.F1,
      ctrlKey: false, altKey: false, shiftKey: true, metaKey: false,
    });

    expect(cb1).not.toHaveBeenCalled();
    expect(cb2).toHaveBeenCalledTimes(1);
  });

  test('different modifier combos create distinct signatures', () => {
    const cbCtrl = jest.fn();
    const cbShift = jest.fn();
    hotkeyManager.register('Ctrl+A', cbCtrl);
    hotkeyManager.register('Shift+A', cbShift);

    keydownHandler({
      keycode: MockUiohookKey.A,
      ctrlKey: true, altKey: false, shiftKey: false, metaKey: false,
    });
    expect(cbCtrl).toHaveBeenCalledTimes(1);
    expect(cbShift).not.toHaveBeenCalled();

    keydownHandler({
      keycode: MockUiohookKey.A,
      ctrlKey: false, altKey: false, shiftKey: true, metaKey: false,
    });
    expect(cbShift).toHaveBeenCalledTimes(1);
  });
});

// clearAll()

describe('HotkeyManager – clearAll()', () => {
  test('removes all registered bindings', () => {
    const cb = jest.fn();
    hotkeyManager.register('Shift+F5', cb);
    hotkeyManager.clearAll();

    keydownHandler({
      keycode: MockUiohookKey.F5,
      ctrlKey: false, altKey: false, shiftKey: true, metaKey: false,
    });
    expect(cb).not.toHaveBeenCalled();
  });
});

// start() / stop()

describe('HotkeyManager – start/stop', () => {
  test('start() calls uIOhook.start() and sets isRunning', () => {
    hotkeyManager.start();
    expect(mockUIOhook.start).toHaveBeenCalledTimes(1);
    expect(hotkeyManager.isRunning).toBe(true);
  });

  test('start() is idempotent when already running', () => {
    hotkeyManager.start();
    hotkeyManager.start();
    expect(mockUIOhook.start).toHaveBeenCalledTimes(1);
  });

  test('stop() calls uIOhook.stop() and clears isRunning', () => {
    hotkeyManager.start();
    hotkeyManager.stop();
    expect(mockUIOhook.stop).toHaveBeenCalledTimes(1);
    expect(hotkeyManager.isRunning).toBe(false);
  });

  test('stop() is idempotent when not running', () => {
    hotkeyManager.stop();
    expect(mockUIOhook.stop).not.toHaveBeenCalled();
  });
});

// handleKeydown()

describe('HotkeyManager – handleKeydown()', () => {
  test('triggers matching callback', () => {
    const cb = jest.fn();
    hotkeyManager.register('Shift+Space', cb);

    keydownHandler({
      keycode: MockUiohookKey.Space,
      ctrlKey: false, altKey: false, shiftKey: true, metaKey: false,
    });

    expect(cb).toHaveBeenCalledTimes(1);
  });

  test('does not trigger callback for wrong modifiers', () => {
    const cb = jest.fn();
    hotkeyManager.register('Shift+F1', cb);

    keydownHandler({
      keycode: MockUiohookKey.F1,
      ctrlKey: true, altKey: false, shiftKey: false, metaKey: false,
    });

    expect(cb).not.toHaveBeenCalled();
  });

  test('ignores bare Ctrl press', () => {
    const cb = jest.fn();
    hotkeyManager.register('Ctrl+A', cb);

    keydownHandler({
      keycode: MockUiohookKey.Ctrl,
      ctrlKey: true, altKey: false, shiftKey: false, metaKey: false,
    });

    expect(cb).not.toHaveBeenCalled();
  });

  test('ignores bare Shift press', () => {
    const cb = jest.fn();
    hotkeyManager.register('Shift+A', cb);

    keydownHandler({
      keycode: MockUiohookKey.Shift,
      ctrlKey: false, altKey: false, shiftKey: true, metaKey: false,
    });

    expect(cb).not.toHaveBeenCalled();
  });

  test('ignores bare Alt press', () => {
    keydownHandler({
      keycode: MockUiohookKey.Alt,
      ctrlKey: false, altKey: true, shiftKey: false, metaKey: false,
    });
    // Should not throw
  });

  test('ignores bare right-side modifier presses', () => {
    for (const key of ['CtrlRight', 'AltRight', 'ShiftRight', 'MetaRight']) {
      keydownHandler({
        keycode: MockUiohookKey[key],
        ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
      });
      // Should not throw
    }
  });

  test('no-op when no bindings match', () => {
    // Should not throw
    keydownHandler({
      keycode: MockUiohookKey.Z,
      ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
    });
  });
});

// Alt-Tab workaround

describe('HotkeyManager – Alt-Tab workaround', () => {
  test('Alt+Tab sets a timeout to restart uIOhook', () => {
    hotkeyManager.start();
    mockUIOhook.stop.mockReset();
    mockUIOhook.start.mockReset();

    keydownHandler({
      keycode: MockUiohookKey.Tab,
      ctrlKey: false, altKey: true, shiftKey: false, metaKey: false,
    });

    // Before timeout fires, no restart
    expect(mockUIOhook.stop).not.toHaveBeenCalled();

    // After 1000ms
    jest.advanceTimersByTime(1000);

    expect(mockUIOhook.stop).toHaveBeenCalledTimes(1);
    expect(mockUIOhook.start).toHaveBeenCalledTimes(1);
  });

  test('rapid Alt+Tab resets the timeout (only one restart)', () => {
    hotkeyManager.start();
    mockUIOhook.stop.mockReset();
    mockUIOhook.start.mockReset();

    // First Alt+Tab
    keydownHandler({
      keycode: MockUiohookKey.Tab,
      ctrlKey: false, altKey: true, shiftKey: false, metaKey: false,
    });

    // 500ms later, second Alt+Tab
    jest.advanceTimersByTime(500);
    keydownHandler({
      keycode: MockUiohookKey.Tab,
      ctrlKey: false, altKey: true, shiftKey: false, metaKey: false,
    });

    // 500ms later (1000ms from second press, 1500ms from first)
    jest.advanceTimersByTime(500);
    expect(mockUIOhook.stop).not.toHaveBeenCalled();

    // 500ms more (1000ms from second press)
    jest.advanceTimersByTime(500);
    expect(mockUIOhook.stop).toHaveBeenCalledTimes(1);
    expect(mockUIOhook.start).toHaveBeenCalledTimes(1);
  });

  test('does not restart uIOhook if not running', () => {
    // Don't call start() — isRunning is false
    keydownHandler({
      keycode: MockUiohookKey.Tab,
      ctrlKey: false, altKey: true, shiftKey: false, metaKey: false,
    });

    jest.advanceTimersByTime(1000);

    expect(mockUIOhook.stop).not.toHaveBeenCalled();
    expect(mockUIOhook.start).not.toHaveBeenCalled();
  });

  test('Tab without Alt does not trigger workaround', () => {
    hotkeyManager.start();
    mockUIOhook.stop.mockReset();
    mockUIOhook.start.mockReset();

    keydownHandler({
      keycode: MockUiohookKey.Tab,
      ctrlKey: false, altKey: false, shiftKey: false, metaKey: false,
    });

    jest.advanceTimersByTime(1000);

    expect(mockUIOhook.stop).not.toHaveBeenCalled();
  });
});
