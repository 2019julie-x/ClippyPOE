
// DOM setup helpers
function buildDOM() {
  document.body.innerHTML = `
    <div id="overlay-container" style="opacity:1"></div>
    <span id="act-title">Act 1</span>
    <span id="zone-title">Loading...</span>
    <span id="level-indicator">Lv 1</span>
    <div id="objectives-list"></div>
    <div id="tips-section" style="display:none"></div>
    <div id="tips-content"></div>
    <div id="passive-section" style="display:none"></div>
    <div id="passive-content"></div>
    <div id="quest-section" style="display:none"></div>
    <div id="quest-content"></div>
    <div id="tab-guide" class="tab-content active"></div>
    <div id="tab-gems" class="tab-content"></div>
    <div id="tab-cheatsheets" class="tab-content"></div>
    <div id="tab-timer" class="tab-content"></div>
    <button class="tab-btn active" data-tab="guide">Guide</button>
    <button class="tab-btn" data-tab="gems">Gems</button>
    <button class="tab-btn" data-tab="cheatsheets">Info</button>
    <button class="tab-btn" data-tab="timer">Timer</button>
    <div id="gem-rewards-content"></div>
    <div id="cheatsheet-nav"></div>
    <div id="cheatsheet-content"></div>
    <div id="timer-display">00:00:00</div>
    <button id="timer-toggle-btn">Start</button>
    <button id="timer-split-btn">Split</button>
    <button id="timer-reset-btn">Reset</button>
    <div id="splits-list"></div>
    <div id="mode-indicator" style="display:none"></div>
    <span id="mode-text"></span>
    <button id="close-btn"></button>
    <button id="minimize-btn"></button>
    <button id="settings-btn"></button>
    <button id="lock-btn">&#128274;</button>
    <button id="prev-zone-btn"></button>
    <button id="next-zone-btn"></button>
    <button id="reset-btn">Reset</button>
  `;
}
// Minimal guide data fixture
const mockGuideData = {
  acts: [
    {
      act: 1,
      name: 'The Awakening',
      zones: [
        {
          name: 'The Twilight Strand',
          order: 1,
          objectives: ['Kill Hillock', 'Enter Lioneye\'s Watch'],
          tips: 'Skip all monsters except Hillock.',
          waypoint: false,
        },
        {
          name: 'The Coast',
          order: 2,
          objectives: ['Find waypoint'],
          tips: 'Head to top-left.',
          waypoint: true,
        },
        {
          name: 'The Mud Flats',
          order: 3,
          objectives: ['Collect 3 Glyphs'],
          tips: null,
          waypoint: false,
        },
      ],
      passiveCheckpoints: [
        { level: 2, nodes: ['Str Node', 'Life Node'] },
      ],
      quests: [
        { name: 'Enemy at the Gate', reward: 'Skill Gem', required: true },
      ],
    },
  ],
};
const mockGemData = {
  questRewards: [
    {
      act: 1,
      quest: 'Enemy at the Gate',
      level: 1,
      gems: [
        { name: 'Freezing Pulse', classes: ['Witch', 'Shadow'] },
        { name: 'Ground Slam', classes: ['Marauder'] },
      ],
    },
  ],
};
const mockCheatsheetData = {
  cheatsheets: [
    {
      id: 'vendor-recipes',
      title: 'Vendor Recipes',
      items: [
        { recipe: '6-socket item', result: '7 Jeweller\'s Orbs' },
      ],
    },
    {
      id: 'tips',
      title: 'Tips',
      items: ['Keep moving'],
    },
  ],
};
// Mock window.api (preload bridge)
function buildMockApi({ guideData = mockGuideData, gemData = mockGemData,
                        cheatsheetData = mockCheatsheetData, progress = {},
                        timerState = { running: false, elapsed: 0, splits: [] } } = {}) {
  return {
    invoke: jest.fn(async (channel) => {
      if (channel === 'load-guide-data') return guideData;
      if (channel === 'load-gem-data') return gemData;
      if (channel === 'load-cheatsheet-data') return cheatsheetData;
      return null;
    }),
    send: jest.fn(),
    sendSync: jest.fn((channel) => {
      if (channel === 'get-progress') return progress;
      if (channel === 'timer-get') return timerState;
      if (channel === 'timer-toggle') return { ...timerState, running: !timerState.running };
      if (channel === 'timer-reset') return { running: false, elapsed: 0, splits: [] };
      if (channel === 'timer-split') return { ...timerState, splits: [...(timerState.splits || []), { label: 'x', time: 0 }] };
      return null;
    }),
    receive: jest.fn(),
  };
}
// Utility: load app.js into the current jsdom context
const fs = require('fs');
const path = require('path');
const APP_JS_RAW = fs.readFileSync(
  path.join(__dirname, '../../src/renderer/app.js'), 'utf8'
);
function patchForGlobals(src) {
  // 1. Top-level `let varName = …` or `let varName;`  →  `window.varName = …`
  let out = src.replace(/^let ([a-zA-Z_$][a-zA-Z0-9_$]*)/gm, 'window.$1');
  // 2. Top-level `function name(` → `window.name = function name(`
  out = out.replace(/^function ([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/gm,
    'window.$1 = function $1(');
  return out;
}
const APP_JS_PATCHED = patchForGlobals(APP_JS_RAW);
function loadApp(apiOverrides = {}) {
  buildDOM();
  window.api = buildMockApi(apiOverrides);
  // Reset all app-level state on window before evaluating the script so
  // repeated loadApp() calls start with a clean slate.
  Object.assign(window, {
    currentGuideData: null,
    gemData: null,
    cheatsheetData: null,
    currentZoneIndex: 0,
    currentAct: 1,
    currentLevel: 1,
    completedObjectives: [],
    activeTab: 'guide',
    activeCheatsheet: null,
    overlayInteractive: true,
  });
  // eslint-disable-next-line no-eval
  eval(APP_JS_PATCHED);
  // Manually seed guide data (normally loaded async in init()) so sync tests work
  if (apiOverrides.guideData !== undefined) {
    window.currentGuideData = apiOverrides.guideData;
  } else {
    window.currentGuideData = mockGuideData;
  }
  if (apiOverrides.gemData !== undefined) {
    window.gemData = apiOverrides.gemData;
  } else {
    window.gemData = mockGemData;
  }
  if (apiOverrides.cheatsheetData !== undefined) {
    window.cheatsheetData = apiOverrides.cheatsheetData;
  } else {
    window.cheatsheetData = mockCheatsheetData;
  }
}
// formatTime()
describe('formatTime()', () => {
  beforeEach(() => loadApp());
  test('formats 0ms as 00:00:00', () => {
    expect(window.formatTime(0)).toBe('00:00:00');
  });
  test('formats 1 second correctly', () => {
    expect(window.formatTime(1000)).toBe('00:00:01');
  });
  test('formats 1 minute correctly', () => {
    expect(window.formatTime(60 * 1000)).toBe('00:01:00');
  });
  test('formats 1 hour correctly', () => {
    expect(window.formatTime(3600 * 1000)).toBe('01:00:00');
  });
  test('formats mixed h:m:s', () => {
    expect(window.formatTime((2 * 3600 + 15 * 60 + 33) * 1000)).toBe('02:15:33');
  });
  test('pads single-digit values with leading zero', () => {
    expect(window.formatTime(9 * 1000)).toBe('00:00:09');
  });
});
// getAllZones()
describe('getAllZones()', () => {
  beforeEach(() => loadApp());
  test('returns flat list of all zones across acts', () => {
    const zones = window.getAllZones();
    expect(zones).toHaveLength(3);
  });
  test('each zone has an act property', () => {
    window.getAllZones().forEach((z) => expect(z.act).toBe(1));
  });
  test('returns empty array when no guide data', () => {
    loadApp({ guideData: null });
    expect(window.getAllZones()).toEqual([]);
  });
  test('returns empty array when acts array is empty', () => {
    loadApp({ guideData: { acts: [] } });
    expect(window.getAllZones()).toEqual([]);
  });
});
// findZoneByName()
describe('findZoneByName()', () => {
  beforeEach(() => loadApp());
  test('finds zone by exact name', () => {
    expect(window.findZoneByName('The Coast')).toBe(1);
  });
  test('finds zone by partial match (query contains zone name)', () => {
    const idx = window.findZoneByName('Coast');
    expect(idx).toBeGreaterThanOrEqual(0);
  });
  test('returns -1 for completely unknown zone', () => {
    expect(window.findZoneByName('ZZZ Unknown Zone XYZ')).toBe(-1);
  });
  test('prefers exact match over partial', () => {
    expect(window.findZoneByName('The Mud Flats')).toBe(2);
  });
});
// updateUI() – visual output checks
describe('updateUI()', () => {
  beforeEach(() => loadApp());
  test('renders act title', () => {
    window.updateUI();
    expect(document.getElementById('act-title').textContent).toBe('Act 1');
  });
  test('renders first zone name', () => {
    window.updateUI();
    expect(document.getElementById('zone-title').textContent).toContain('The Twilight Strand');
  });
  test('renders objective items', () => {
    window.updateUI();
    const items = document.querySelectorAll('.objective-item');
    expect(items.length).toBe(2);
  });
  test('renders objective text correctly', () => {
    window.updateUI();
    const texts = [...document.querySelectorAll('.objective-text')].map((el) => el.textContent);
    expect(texts).toContain('Kill Hillock');
    expect(texts).toContain("Enter Lioneye's Watch");
  });
  test('shows tips section when zone has tips', () => {
    window.updateUI();
    expect(document.getElementById('tips-section').style.display).not.toBe('none');
  });
  test('hides tips section when zone has no tips', () => {
    window.currentZoneIndex = 2;
    window.updateUI();
    expect(document.getElementById('tips-section').style.display).toBe('none');
  });
  test('renders "No guide data" when guideData is null', () => {
    loadApp({ guideData: null });
    window.updateUI();
    expect(document.getElementById('zone-title').textContent).toContain('No guide data');
  });
  test('shows passive section when level checkpoint exists', () => {
    window.currentLevel = 2;
    window.updateUI();
    expect(document.getElementById('passive-section').style.display).not.toBe('none');
  });
  test('hides passive section when no level checkpoint', () => {
    window.currentLevel = 1;
    window.updateUI();
    expect(document.getElementById('passive-section').style.display).toBe('none');
  });
});
// Objective toggle
describe('toggleObjective()', () => {
  beforeEach(() => loadApp());
  test('marks objective as completed', () => {
    window.toggleObjective('test-obj-1');
    expect(window.completedObjectives).toContain('test-obj-1');
  });
  test('un-marks a completed objective', () => {
    window.toggleObjective('test-obj-1');
    window.toggleObjective('test-obj-1');
    expect(window.completedObjectives).not.toContain('test-obj-1');
  });
  test('sends toggle-objective IPC message', () => {
    window.toggleObjective('1-0-0');
    expect(window.api.send).toHaveBeenCalledWith('toggle-objective', '1-0-0');
  });
});
// Zone navigation
describe('nextZone() / prevZone()', () => {
  beforeEach(() => loadApp());
  test('nextZone advances zone index', () => {
    const before = window.currentZoneIndex;
    window.nextZone();
    expect(window.currentZoneIndex).toBe(before + 1);
  });
  test('nextZone does not exceed last zone', () => {
    window.currentZoneIndex = 2; // last zone in fixture (index 2 of 3)
    window.nextZone();
    expect(window.currentZoneIndex).toBe(2);
  });
  test('prevZone decrements zone index', () => {
    window.currentZoneIndex = 1;
    window.prevZone();
    expect(window.currentZoneIndex).toBe(0);
  });
  test('prevZone does not go below 0', () => {
    window.currentZoneIndex = 0;
    window.prevZone();
    expect(window.currentZoneIndex).toBe(0);
  });
  test('nextZone updates currentAct', () => {
    window.nextZone();
    expect(window.currentAct).toBe(1);
  });
});
// switchTab()
describe('switchTab()', () => {
  beforeEach(() => loadApp());
  test('adds active class to selected tab button', () => {
    window.switchTab('gems');
    const btn = document.querySelector('[data-tab="gems"]');
    expect(btn.classList.contains('active')).toBe(true);
  });
  test('removes active class from previously active tab button', () => {
    window.switchTab('gems');
    const guideBtn = document.querySelector('[data-tab="guide"]');
    expect(guideBtn.classList.contains('active')).toBe(false);
  });
  test('shows correct tab content panel', () => {
    window.switchTab('timer');
    expect(document.getElementById('tab-timer').classList.contains('active')).toBe(true);
  });
  test('hides other tab content panels', () => {
    window.switchTab('gems');
    expect(document.getElementById('tab-guide').classList.contains('active')).toBe(false);
    expect(document.getElementById('tab-cheatsheets').classList.contains('active')).toBe(false);
    expect(document.getElementById('tab-timer').classList.contains('active')).toBe(false);
  });
});
// updateGemUI()
describe('updateGemUI()', () => {
  beforeEach(() => loadApp());
  test('renders gem quest groups', () => {
    window.updateGemUI();
    const groups = document.querySelectorAll('.gem-quest-group');
    expect(groups.length).toBeGreaterThan(0);
  });
  test('shows no-data message when gemData is null', () => {
    loadApp({ gemData: null });
    window.updateGemUI();
    expect(document.getElementById('gem-rewards-content').textContent).toContain('No gem data');
  });
  test('renders gem names', () => {
    window.updateGemUI();
    const names = document.querySelectorAll('.gem-name');
    const texts = [...names].map((el) => el.textContent);
    expect(texts).toContain('Freezing Pulse');
  });
});
// updateTimerDisplay()
describe('updateTimerDisplay()', () => {
  beforeEach(() => loadApp());
  test('updates timer-display element', () => {
    window.updateTimerDisplay(3661000); // 1h 1m 1s
    expect(document.getElementById('timer-display').textContent).toBe('01:01:01');
  });
  test('displays 00:00:00 for 0ms', () => {
    window.updateTimerDisplay(0);
    expect(document.getElementById('timer-display').textContent).toBe('00:00:00');
  });
});
// updateSplitsList()
describe('updateSplitsList()', () => {
  beforeEach(() => loadApp());
  test('shows no-data message for empty splits', () => {
    window.updateSplitsList([]);
    expect(document.getElementById('splits-list').textContent).toContain('No splits yet');
  });
  test('renders split items', () => {
    window.updateSplitsList([
      { label: 'The Coast', time: 12000 },
      { label: 'The Mud Flats', time: 35000 },
    ]);
    const items = document.querySelectorAll('.split-item');
    expect(items.length).toBe(2);
  });
  test('renders split labels with index', () => {
    window.updateSplitsList([{ label: 'The Coast', time: 12000 }]);
    const label = document.querySelector('.split-label');
    expect(label.textContent).toContain('The Coast');
    expect(label.textContent).toContain('1.');
  });
  test('renders formatted split times', () => {
    window.updateSplitsList([{ label: 'The Coast', time: 65000 }]);
    const time = document.querySelector('.split-time');
    expect(time.textContent).toBe('00:01:05');
  });
});
// showModeIndicator()
describe('showModeIndicator()', () => {
  beforeEach(() => loadApp());
  test('displays the mode text', () => {
    window.showModeIndicator('CLICK-THROUGH');
    expect(document.getElementById('mode-text').textContent).toBe('CLICK-THROUGH');
  });
  test('adds show class to mode indicator', () => {
    window.showModeIndicator('INTERACTIVE');
    const indicator = document.getElementById('mode-indicator');
    expect(indicator.classList.contains('show')).toBe(true);
  });
  test('hides the indicator after timeout', (done) => {
    jest.useFakeTimers();
    window.showModeIndicator('TEST');
    jest.advanceTimersByTime(1300);
    expect(document.getElementById('mode-indicator').style.display).toBe('none');
    jest.useRealTimers();
    done();
  });
});