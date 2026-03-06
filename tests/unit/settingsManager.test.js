const fs = require('fs');
const path = require('path');
const os = require('os');
// Mock electron's app so we can run tests in plain Node.js
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => require('path').join(require('os').tmpdir(), `poe-settings-test-${Date.now()}`)),
  },
}));
// Re-require after mock so each describe block gets a fresh tmp dir
function makeSettingsManager() {
  jest.resetModules();
  // Give each instance its own tmp directory
  const { app } = require('electron');
  const tmpDir = path.join(os.tmpdir(), `poe-test-${Date.now()}-${Math.random()}`);
  app.getPath.mockReturnValue(tmpDir);
  const SettingsManager = require('../../src/main/settingsManager');
  return { sm: new SettingsManager(), tmpDir };
}
// Helpers
function cleanup(tmpDir) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (_) { /* ignore */ }
}
// Initialisation
describe('SettingsManager – initialisation', () => {
  test('creates config directory if it does not exist', () => {
    const { sm, tmpDir } = makeSettingsManager();
    const configDir = path.join(tmpDir, 'config');
    expect(fs.existsSync(configDir)).toBe(true);
    cleanup(tmpDir);
  });
  test('loads default settings on first run', () => {
    const { sm, tmpDir } = makeSettingsManager();
    const s = sm.getSettings();
    expect(s.opacity).toBeCloseTo(0.95);
    expect(s.theme).toBe('dark');
    expect(s.autoDetect).toBe(true);
    cleanup(tmpDir);
  });
  test('writes settings.json to disk on first run', () => {
    const { sm, tmpDir } = makeSettingsManager();
    const settingsPath = path.join(tmpDir, 'config', 'settings.json');
    // Allow debounce to flush
    expect(fs.existsSync(settingsPath)).toBe(true);
    cleanup(tmpDir);
  });
  test('default hotkeys are present', () => {
    const { sm, tmpDir } = makeSettingsManager();
    const hk = sm.getSettings().hotkeys;
    expect(hk.toggleOverlay).toBe('Shift+Space');
    expect(hk.hideOverlay).toBe('Shift+F1');
    expect(hk.nextZone).toBe('Shift+F2');
    expect(hk.prevZone).toBe('Shift+F3');
    expect(hk.toggleTimer).toBe('Shift+F4');
    cleanup(tmpDir);
  });
});
// saveSettings() / getSettings()
describe('SettingsManager – saveSettings() / getSettings()', () => {
  test('persists new values', () => {
    const { sm, tmpDir } = makeSettingsManager();
    sm.saveSettings({ opacity: 0.5 });
    expect(sm.getSettings().opacity).toBeCloseTo(0.5);
    cleanup(tmpDir);
  });
  test('merges with existing settings (does not clobber unrelated fields)', () => {
    const { sm, tmpDir } = makeSettingsManager();
    sm.saveSettings({ opacity: 0.6 });
    sm.saveSettings({ theme: 'light' });
    const s = sm.getSettings();
    expect(s.opacity).toBeCloseTo(0.6);
    expect(s.theme).toBe('light');
    cleanup(tmpDir);
  });
  test('getSettings() returns a copy, not the internal reference', () => {
    const { sm, tmpDir } = makeSettingsManager();
    const s1 = sm.getSettings();
    s1.opacity = 0;
    const s2 = sm.getSettings();
    expect(s2.opacity).not.toBe(0);
    cleanup(tmpDir);
  });
});
// Window position / size
describe('SettingsManager – window position & size', () => {
  test('saveWindowPosition stores x and y', () => {
    const { sm, tmpDir } = makeSettingsManager();
    sm.saveWindowPosition(200, 350);
    const pos = sm.getWindowPosition();
    expect(pos.x).toBe(200);
    expect(pos.y).toBe(350);
    cleanup(tmpDir);
  });
  test('saveWindowSize stores width and height', () => {
    const { sm, tmpDir } = makeSettingsManager();
    sm.saveWindowSize(500, 700);
    const size = sm.getWindowSize();
    expect(size.width).toBe(500);
    expect(size.height).toBe(700);
    cleanup(tmpDir);
  });
  test('default window position is returned when not overridden', () => {
    const { sm, tmpDir } = makeSettingsManager();
    const pos = sm.getWindowPosition();
    expect(typeof pos.x).toBe('number');
    expect(typeof pos.y).toBe('number');
    cleanup(tmpDir);
  });
});
// Progress
describe('SettingsManager – progress', () => {
  test('getProgress returns default values on first run', () => {
    const { sm, tmpDir } = makeSettingsManager();
    const p = sm.getProgress();
    expect(p.act).toBe(1);
    expect(p.currentLevel).toBe(1);
    expect(p.zone).toBeNull();
    expect(p.completedObjectives).toEqual([]);
    cleanup(tmpDir);
  });
  test('saveProgress persists act and zone', () => {
    const { sm, tmpDir } = makeSettingsManager();
    sm.saveProgress({ act: 3, zone: 'The Lunaris Temple Level 2', currentLevel: 45 });
    const p = sm.getProgress();
    expect(p.act).toBe(3);
    expect(p.zone).toBe('The Lunaris Temple Level 2');
    expect(p.currentLevel).toBe(45);
    cleanup(tmpDir);
  });
  test('saveProgress merges – does not erase completedObjectives', () => {
    const { sm, tmpDir } = makeSettingsManager();
    sm.saveProgress({ completedObjectives: ['1-0-0', '1-0-1'] });
    sm.saveProgress({ act: 2 });
    const p = sm.getProgress();
    expect(p.completedObjectives).toEqual(['1-0-0', '1-0-1']);
    cleanup(tmpDir);
  });
  test('resetProgress sets everything back to defaults', () => {
    const { sm, tmpDir } = makeSettingsManager();
    sm.saveProgress({ act: 5, zone: 'Oriath', currentLevel: 55, completedObjectives: ['x'] });
    sm.resetProgress();
    const p = sm.getProgress();
    expect(p.act).toBe(1);
    expect(p.zone).toBeNull();
    expect(p.currentLevel).toBe(1);
    expect(p.completedObjectives).toEqual([]);
    cleanup(tmpDir);
  });
  test('getProgress returns a copy, not the internal reference', () => {
    const { sm, tmpDir } = makeSettingsManager();
    const p1 = sm.getProgress();
    p1.act = 99;
    const p2 = sm.getProgress();
    expect(p2.act).toBe(1);
    cleanup(tmpDir);
  });
});
// getClientTxtPath()
describe('SettingsManager – getClientTxtPath()', () => {
  test('returns empty string by default', () => {
    const { sm, tmpDir } = makeSettingsManager();
    expect(sm.getClientTxtPath()).toBe('');
    cleanup(tmpDir);
  });
  test('returns saved path after saveSettings', () => {
    const { sm, tmpDir } = makeSettingsManager();
    sm.saveSettings({ clientTxtPath: '/home/user/poe/Client.txt' });
    expect(sm.getClientTxtPath()).toBe('/home/user/poe/Client.txt');
    cleanup(tmpDir);
  });
});
// Persistence across instances (round-trip)
describe('SettingsManager – round-trip persistence', () => {
  test('settings written by one instance are loaded by a new instance', (done) => {
    jest.resetModules();
    const { app } = require('electron');
    const tmpDir = path.join(os.tmpdir(), `poe-roundtrip-${Date.now()}`);
    app.getPath.mockReturnValue(tmpDir);
    const SettingsManager = require('../../src/main/settingsManager');
    const sm1 = new SettingsManager();
    sm1.saveSettings({ opacity: 0.42, theme: 'light' });
    // Force the debounced write to flush immediately
    // We access the internal performSave via a short timeout
    setTimeout(() => {
      jest.resetModules();
      const { app: app2 } = require('electron');
      app2.getPath.mockReturnValue(tmpDir);
      const SM2 = require('../../src/main/settingsManager');
      const sm2 = new SM2();
      expect(sm2.getSettings().opacity).toBeCloseTo(0.42);
      expect(sm2.getSettings().theme).toBe('light');
      cleanup(tmpDir);
      done();
    }, 700); // longer than the 500ms debounce
  });
});