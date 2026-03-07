const OverlayController = require('../../src/main/overlayController');
// Helpers
function makeMockWindow(destroyed = false) {
  return {
    isDestroyed: jest.fn(() => destroyed),
    setIgnoreMouseEvents: jest.fn(),
    setAlwaysOnTop: jest.fn(),
    focus: jest.fn(),
    getSize: jest.fn(() => [400, 600]),
    setSize: jest.fn(),
    webContents: {
      send: jest.fn(),
    },
  };
}
const linuxPlatform   = { isLinux: true,  isWindows: false, isMac: false };
const windowsPlatform = { isLinux: false, isWindows: true,  isMac: false };
const macPlatform     = { isLinux: false, isWindows: false, isMac: true  };
// Constructor
describe('OverlayController – constructor', () => {
  test('initialises with interactive = false', () => {
    const ctrl = new OverlayController(windowsPlatform);
    expect(ctrl.interactive).toBe(false);
  });
  test('uses default baseOpacity of 0.95', () => {
    const ctrl = new OverlayController(windowsPlatform);
    expect(ctrl.baseOpacity).toBeCloseTo(0.95);
  });
  test('accepts custom baseOpacity', () => {
    const ctrl = new OverlayController(windowsPlatform, 0.7);
    expect(ctrl.baseOpacity).toBeCloseTo(0.7);
  });
  test('freezes the platform object', () => {
    const ctrl = new OverlayController(windowsPlatform);
    expect(Object.isFrozen(ctrl.platform)).toBe(true);
  });
  test('win is null before setWindow', () => {
    const ctrl = new OverlayController(windowsPlatform);
    expect(ctrl.win).toBeNull();
  });
});
// setWindow()
describe('OverlayController – setWindow()', () => {
  test('binds window reference', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    expect(ctrl.win).toBe(win);
  });
});
// activate()
describe('OverlayController – activate()', () => {
  test('sets interactive to true', () => {
    const ctrl = new OverlayController(windowsPlatform);
    ctrl.setWindow(makeMockWindow());
    ctrl.activate();
    expect(ctrl.interactive).toBe(true);
  });
  test('calls setIgnoreMouseEvents(false)', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.activate();
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(false);
  });
  test('calls setAlwaysOnTop with screen-saver level', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.activate();
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
  });
  test('calls focus() on non-Linux platforms', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.activate();
    expect(win.focus).toHaveBeenCalled();
  });
  test('does NOT call focus() on Linux', () => {
    const ctrl = new OverlayController(linuxPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.activate();
    expect(win.focus).not.toHaveBeenCalled();
  });
  test('sends overlay-opacity to renderer', () => {
    const ctrl = new OverlayController(windowsPlatform, 0.8);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.activate();
    expect(win.webContents.send).toHaveBeenCalledWith('overlay-opacity', 0.8);
  });
  test('is a no-op when window is destroyed', () => {
    const ctrl = new OverlayController(windowsPlatform);
    ctrl.setWindow(makeMockWindow(true));
    expect(() => ctrl.activate()).not.toThrow();
    expect(ctrl.interactive).toBe(false); // unchanged
  });
  test('is a no-op when no window is bound', () => {
    const ctrl = new OverlayController(windowsPlatform);
    expect(() => ctrl.activate()).not.toThrow();
  });
});
// deactivate()
describe('OverlayController – deactivate()', () => {
  test('sets interactive to false', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.activate();
    ctrl.deactivate();
    expect(ctrl.interactive).toBe(false);
  });
  test('calls setIgnoreMouseEvents(true, { forward: true }) on Windows', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.deactivate();
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
  });
  test('calls setIgnoreMouseEvents(true, { forward: true }) on macOS', () => {
    const ctrl = new OverlayController(macPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.deactivate();
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true, { forward: true });
  });
  test('calls setIgnoreMouseEvents(true) WITHOUT forward on Linux', () => {
    const ctrl = new OverlayController(linuxPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.deactivate();
    expect(win.setIgnoreMouseEvents).toHaveBeenCalledWith(true);
    expect(win.setIgnoreMouseEvents).not.toHaveBeenCalledWith(true, expect.anything());
  });
  test('keeps overlay always-on-top in clickthrough mode', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.deactivate();
    expect(win.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');
  });
  test('sends reduced opacity (35% of base) to renderer', () => {
    const ctrl = new OverlayController(windowsPlatform, 1.0);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.deactivate();
    expect(win.webContents.send).toHaveBeenCalledWith('overlay-opacity', 0.35);
  });
  test('is a no-op when no window bound', () => {
    const ctrl = new OverlayController(windowsPlatform);
    expect(() => ctrl.deactivate()).not.toThrow();
  });
});
// toggle()
describe('OverlayController – toggle()', () => {
  test('toggles from non-interactive to interactive', () => {
    const ctrl = new OverlayController(windowsPlatform);
    ctrl.setWindow(makeMockWindow());
    expect(ctrl.interactive).toBe(false);
    ctrl.toggle();
    expect(ctrl.interactive).toBe(true);
  });
  test('toggles from interactive back to clickthrough', () => {
    const ctrl = new OverlayController(windowsPlatform);
    ctrl.setWindow(makeMockWindow());
    ctrl.activate();
    ctrl.toggle();
    expect(ctrl.interactive).toBe(false);
  });
  test('double-toggle returns to original state', () => {
    const ctrl = new OverlayController(windowsPlatform);
    ctrl.setWindow(makeMockWindow());
    const initial = ctrl.interactive;
    ctrl.toggle();
    ctrl.toggle();
    expect(ctrl.interactive).toBe(initial);
  });
});
// getEffectiveOpacity()
describe('OverlayController – getEffectiveOpacity()', () => {
  test('returns baseOpacity in interactive mode', () => {
    const ctrl = new OverlayController(windowsPlatform, 0.9);
    ctrl.setWindow(makeMockWindow());
    ctrl.activate();
    expect(ctrl.getEffectiveOpacity()).toBeCloseTo(0.9);
  });
  test('returns 35% of baseOpacity in clickthrough mode', () => {
    const ctrl = new OverlayController(windowsPlatform, 1.0);
    expect(ctrl.getEffectiveOpacity()).toBeCloseTo(0.35);
  });
  test('clickthrough opacity is always less than interactive opacity', () => {
    const ctrl = new OverlayController(windowsPlatform, 0.8);
    ctrl.setWindow(makeMockWindow());
    ctrl.activate();
    const interactiveOpacity = ctrl.getEffectiveOpacity();
    ctrl.deactivate();
    const clickthroughOpacity = ctrl.getEffectiveOpacity();
    expect(clickthroughOpacity).toBeLessThan(interactiveOpacity);
  });
  test('opacity ratio is exactly 0.35', () => {
    const base = 0.6;
    const ctrl = new OverlayController(windowsPlatform, base);
    expect(ctrl.getEffectiveOpacity()).toBeCloseTo(base * 0.35);
  });
});
// setBaseOpacity()
describe('OverlayController – setBaseOpacity()', () => {
  test('updates baseOpacity', () => {
    const ctrl = new OverlayController(windowsPlatform, 0.5);
    ctrl.setWindow(makeMockWindow());
    ctrl.setBaseOpacity(0.8);
    expect(ctrl.baseOpacity).toBeCloseTo(0.8);
  });
  test('immediately sends updated opacity to renderer', () => {
    const ctrl = new OverlayController(windowsPlatform, 0.5);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.activate(); // interactive mode
    win.webContents.send.mockClear();
    ctrl.setBaseOpacity(0.75);
    expect(win.webContents.send).toHaveBeenCalledWith('overlay-opacity', 0.75);
  });
});
// collapse / expand
describe('OverlayController – collapse()', () => {
  test('sets collapsed to true', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.collapse();
    expect(ctrl.collapsed).toBe(true);
  });
  test('stores the previous height before collapsing', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    win.getSize.mockReturnValue([400, 500]);
    ctrl.setWindow(win);
    ctrl.collapse();
    expect(ctrl._expandedHeight).toBe(500);
  });
  test('resizes window to collapsed height (36px)', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    win.getSize.mockReturnValue([400, 600]);
    ctrl.setWindow(win);
    ctrl.collapse();
    expect(win.setSize).toHaveBeenCalledWith(400, 36);
  });
  test('sends overlay-collapsed true to renderer', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.collapse();
    expect(win.webContents.send).toHaveBeenCalledWith('overlay-collapsed', true);
  });
  test('is a no-op when already collapsed', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.collapse();
    win.setSize.mockClear();
    ctrl.collapse();
    expect(win.setSize).not.toHaveBeenCalled();
  });
  test('is a no-op when no window bound', () => {
    const ctrl = new OverlayController(windowsPlatform);
    expect(() => ctrl.collapse()).not.toThrow();
    expect(ctrl.collapsed).toBe(false);
  });
});
describe('OverlayController – expand()', () => {
  test('sets collapsed to false', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.collapse();
    ctrl.expand();
    expect(ctrl.collapsed).toBe(false);
  });
  test('restores the previous height', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    win.getSize.mockReturnValue([400, 500]);
    ctrl.setWindow(win);
    ctrl.collapse();
    win.getSize.mockReturnValue([400, 36]);
    ctrl.expand();
    expect(win.setSize).toHaveBeenLastCalledWith(400, 500);
  });
  test('sends overlay-collapsed false to renderer', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.collapse();
    win.webContents.send.mockClear();
    ctrl.expand();
    expect(win.webContents.send).toHaveBeenCalledWith('overlay-collapsed', false);
  });
  test('defaults to 600 when no previous height stored', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    // Force collapsed state without going through collapse()
    ctrl.collapsed = true;
    ctrl._expandedHeight = null;
    ctrl.expand();
    expect(win.setSize).toHaveBeenCalledWith(400, 600);
  });
  test('is a no-op when not collapsed', () => {
    const ctrl = new OverlayController(windowsPlatform);
    const win = makeMockWindow();
    ctrl.setWindow(win);
    ctrl.expand();
    expect(win.setSize).not.toHaveBeenCalled();
  });
});
describe('OverlayController – toggleCollapse()', () => {
  test('collapses when expanded', () => {
    const ctrl = new OverlayController(windowsPlatform);
    ctrl.setWindow(makeMockWindow());
    ctrl.toggleCollapse();
    expect(ctrl.collapsed).toBe(true);
  });
  test('expands when collapsed', () => {
    const ctrl = new OverlayController(windowsPlatform);
    ctrl.setWindow(makeMockWindow());
    ctrl.collapse();
    ctrl.toggleCollapse();
    expect(ctrl.collapsed).toBe(false);
  });
  test('double toggle returns to original state', () => {
    const ctrl = new OverlayController(windowsPlatform);
    ctrl.setWindow(makeMockWindow());
    ctrl.toggleCollapse();
    ctrl.toggleCollapse();
    expect(ctrl.collapsed).toBe(false);
  });
});