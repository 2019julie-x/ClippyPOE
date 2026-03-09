// Renderer script

// State variables
let currentGuideData = null;
let gemData = null;
let cheatsheetData = null;
let currentZoneIndex = 0;
let currentAct = 1;
let currentLevel = 1;
let completedObjectives = [];
let activeTab = 'guide';
let activeCheatsheet = null;
let overlayInteractive = true;
let isCollapsed = false;

// Load data

async function loadGuideData() {
  try {
    currentGuideData = await window.api.invoke('load-guide-data');
    if (currentGuideData) console.log('Guide data loaded');
  } catch (err) {
    console.error('Failed to load guide data:', err);
    showLoadError('guide');
  }
}

async function loadGemData() {
  try {
    gemData = await window.api.invoke('load-gem-data');
    if (gemData) console.log('Gem data loaded');
  } catch (err) {
    console.error('Failed to load gem data:', err);
  }
}

async function loadCheatsheetData() {
  try {
    cheatsheetData = await window.api.invoke('load-cheatsheet-data');
    if (cheatsheetData) console.log('Cheatsheet data loaded');
  } catch (err) {
    console.error('Failed to load cheatsheet data:', err);
  }
}

// Show error UI when data fails to load

function showLoadError(type) {
  const targets = {
    guide: 'objectives-list',
  };
  const elId = targets[type];
  if (!elId) return;

  const container = document.getElementById(elId);
  if (!container) return;

  container.innerHTML = '';
  const errorDiv = document.createElement('div');
  errorDiv.className = 'load-error';

  const text = document.createElement('span');
  text.className = 'error-text';
  text.textContent = 'Failed to load guide data. ';
  errorDiv.appendChild(text);

  const retryBtn = document.createElement('button');
  retryBtn.className = 'retry-btn';
  retryBtn.textContent = 'Retry';
  retryBtn.addEventListener('click', async () => {
    text.textContent = 'Retrying...';
    retryBtn.disabled = true;
    await loadGuideData();
    if (currentGuideData) {
      updateUI();
    }
  });
  errorDiv.appendChild(retryBtn);

  container.appendChild(errorDiv);
}

// Init

async function init() {
  await Promise.all([loadGuideData(), loadGemData(), loadCheatsheetData()]);
  await loadProgress();
  updateUI();
  updateGemUI();
  initCheatsheets();
  await initTimer();
  attachEventListeners();
  attachIPCListeners();
}

// Progress management

async function loadProgress() {
  const progress = await window.api.invoke('get-progress');
  if (progress) {
    currentAct = progress.act || 1;
    currentLevel = progress.currentLevel || 1;
    completedObjectives = progress.completedObjectives || [];

    if (progress.zone && currentGuideData) {
      const zones = getAllZones();
      // Prefer matching zone in the saved act
      let index = zones.findIndex(
        (z) => z.name === progress.zone && z.act === currentAct
      );
      if (index === -1) {
        index = zones.findIndex((z) => z.name === progress.zone);
      }
      if (index !== -1) currentZoneIndex = index;
    }
  }
}

function saveProgress() {
  const zones = getAllZones();
  const currentZone = zones[currentZoneIndex];
  window.api.send('save-progress', {
    act: currentAct,
    zone: currentZone ? currentZone.name : null,
    completedObjectives,
    currentLevel,
  });
}

// Zone helpers

function getAllZones() {
  if (!currentGuideData || !currentGuideData.acts) return [];
  const zones = [];
  for (const act of currentGuideData.acts) {
    for (const zone of act.zones) {
      zones.push({ ...zone, act: act.act });
    }
  }
  return zones;
}

function findZoneByName(zoneName, areaLevel) {
  const zones = getAllZones();
  if (!zones.length) return -1;

  // Phase 1: Area level match (highest confidence, when available)
  if (areaLevel != null) {
    const idx = zones.findIndex(
      (z) => z.name === zoneName && z.areaLevel === areaLevel
    );
    if (idx !== -1) return idx;
  }

  // Phase 2: Exact match in current act
  let idx = zones.findIndex((z) => z.act === currentAct && z.name === zoneName);
  if (idx !== -1) return idx;

  // Phase 3: Exact match anywhere — pick closest to current position
  // (handles backward waypoint travel better than adjacency bias)
  const exactMatches = [];
  zones.forEach((z, i) => {
    if (z.name === zoneName) exactMatches.push(i);
  });
  if (exactMatches.length === 1) return exactMatches[0];
  if (exactMatches.length > 1) {
    return exactMatches.reduce((best, candidate) =>
      Math.abs(candidate - currentZoneIndex) < Math.abs(best - currentZoneIndex)
        ? candidate
        : best
    );
  }

  // Phase 4: Partial match, preferring current act
  idx = zones.findIndex(
    (z) =>
      z.act === currentAct &&
      (z.name.toLowerCase().includes(zoneName.toLowerCase()) ||
        zoneName.toLowerCase().includes(z.name.toLowerCase()))
  );
  if (idx !== -1) return idx;

  // Phase 5: Partial match anywhere
  idx = zones.findIndex(
    (z) =>
      z.name.toLowerCase().includes(zoneName.toLowerCase()) ||
      zoneName.toLowerCase().includes(z.name.toLowerCase())
  );
  return idx;
}

// Guide UI

function updateUI() {
  const zones = getAllZones();
  if (!zones.length) {
    document.getElementById('zone-title').textContent = 'No guide data';
    document.getElementById('objectives-list').innerHTML =
      '<div class="no-data">Guide data not loaded</div>';
    return;
  }

  const currentZone = zones[currentZoneIndex];
  if (!currentZone) return;

  // Header
  document.getElementById('act-title').textContent = `Act ${currentZone.act}`;
  document.getElementById('zone-title').textContent = currentZone.name;
  document.getElementById('level-indicator').textContent = `Lv ${currentLevel}`;

  // Objectives
  const objectivesList = document.getElementById('objectives-list');
  objectivesList.innerHTML = '';

  if (currentZone.objectives && currentZone.objectives.length > 0) {
    currentZone.objectives.forEach((objective, index) => {
      const objectiveId = `${currentZone.act}-${currentZoneIndex}-${index}`;
      const isCompleted = completedObjectives.includes(objectiveId);

      const item = document.createElement('div');
      item.className = `objective-item${isCompleted ? ' completed' : ''}`;

      const checkbox = document.createElement('div');
      checkbox.className = 'objective-checkbox';
      checkbox.textContent = isCompleted ? '\u2713' : '';

      const text = document.createElement('div');
      text.className = 'objective-text';
      text.textContent = objective;

      item.appendChild(checkbox);
      item.appendChild(text);
      objectivesList.appendChild(item);

      item.addEventListener('click', () => toggleObjective(objectiveId));
    });
  } else {
    objectivesList.innerHTML = '<div class="no-data">No objectives for this zone</div>';
  }

  // Tips
  const tipsSection = document.getElementById('tips-section');
  const tipsContent = document.getElementById('tips-content');
  if (currentZone.tips) {
    tipsSection.style.display = 'block';
    tipsContent.textContent = currentZone.tips;
  } else {
    tipsSection.style.display = 'none';
  }

  // Waypoint indicator
  if (currentZone.waypoint) {
    const wp = document.createElement('span');
    wp.className = 'waypoint-indicator';
    wp.title = 'Waypoint in this zone';
    document.getElementById('zone-title').appendChild(wp);
  }

  updatePassiveRecommendations();
  updateQuestInfo(currentZone.act);
}

function updatePassiveRecommendations() {
  if (!currentGuideData || !currentGuideData.acts) return;

  const section = document.getElementById('passive-section');
  const content = document.getElementById('passive-content');

  const actData = currentGuideData.acts.find((a) => a.act === currentAct);
  if (!actData || !actData.passiveCheckpoints) {
    section.style.display = 'none';
    return;
  }

  const checkpoint = actData.passiveCheckpoints.find(
    (cp) => cp.level === currentLevel
  );
  if (checkpoint && checkpoint.nodes && checkpoint.nodes.length > 0) {
    section.style.display = 'block';
    content.innerHTML = '';
    checkpoint.nodes.forEach((node) => {
      const item = document.createElement('div');
      item.className = 'passive-item';
      item.textContent = node;
      content.appendChild(item);
    });
  } else {
    section.style.display = 'none';
  }
}

function updateQuestInfo(act) {
  if (!currentGuideData || !currentGuideData.acts) return;

  const section = document.getElementById('quest-section');
  const content = document.getElementById('quest-content');

  const actData = currentGuideData.acts.find((a) => a.act === act);
  if (!actData || !actData.quests || actData.quests.length === 0) {
    section.style.display = 'none';
    return;
  }

  const nextQuest = actData.quests.find((q) => q.reward && q.required);
  if (nextQuest) {
    section.style.display = 'block';
    content.innerHTML = '';

    const nameRow = document.createElement('div');
    const star = document.createElement('span');
    star.className = 'quest-required';
    star.textContent = '\u2605 ';
    nameRow.appendChild(star);
    nameRow.appendChild(document.createTextNode(nextQuest.name));

    const rewardRow = document.createElement('div');
    rewardRow.textContent = 'Reward: ';
    const rewardSpan = document.createElement('span');
    rewardSpan.className = 'quest-reward';
    rewardSpan.textContent = nextQuest.reward;
    rewardRow.appendChild(rewardSpan);

    content.appendChild(nameRow);
    content.appendChild(rewardRow);
  } else {
    section.style.display = 'none';
  }
}

// Gem UI

function updateGemUI() {
  const container = document.getElementById('gem-rewards-content');
  if (!gemData || !gemData.questRewards) {
    container.innerHTML = '<div class="no-data">No gem data available</div>';
    return;
  }

  container.innerHTML = '';

  // Grabbing only the gems I care about for my current level
  const relevantRewards = gemData.questRewards.filter(
    (r) => r.act >= currentAct - 1 && r.act <= currentAct + 1
  );

  if (relevantRewards.length === 0) {
    container.innerHTML = '<div class="no-data">No gem rewards for current acts</div>';
    return;
  }

  relevantRewards.forEach((reward) => {
    const group = document.createElement('div');
    group.className = 'gem-quest-group';

    const title = document.createElement('div');
    title.className = 'gem-quest-title';
    title.textContent = `Act ${reward.act} – ${reward.quest} (Lv ${reward.level})`;
    group.appendChild(title);

    if (reward.gems) {
      reward.gems.forEach((gem) => {
        const item = document.createElement('div');
        item.className = 'gem-item';

        const name = document.createElement('span');
        name.className = 'gem-name';
        name.textContent = gem.name;

        const classes = document.createElement('span');
        classes.className = 'gem-classes';
        const classText = Array.isArray(gem.classes)
          ? gem.classes.join(', ')
          : 'all';
        classes.textContent = classText;

        item.appendChild(name);
        item.appendChild(classes);
        group.appendChild(item);
      });
    }

    container.appendChild(group);
  });
}

// Cheatsheet UI

function initCheatsheets() {
  const nav = document.getElementById('cheatsheet-nav');
  if (!cheatsheetData || !cheatsheetData.cheatsheets) {
    nav.innerHTML = '';
    document.getElementById('cheatsheet-content').innerHTML =
      '<div class="no-data">No cheatsheet data available</div>';
    return;
  }

  nav.innerHTML = '';
  cheatsheetData.cheatsheets.forEach((cs, i) => {
    const btn = document.createElement('button');
    btn.className = 'cheatsheet-nav-btn' + (i === 0 ? ' active' : '');
    btn.textContent = cs.title;
    btn.dataset.csId = cs.id;
    btn.addEventListener('click', () => selectCheatsheet(cs.id));
    nav.appendChild(btn);
  });

  // Show the first one
  if (cheatsheetData.cheatsheets.length > 0) {
    selectCheatsheet(cheatsheetData.cheatsheets[0].id);
  }
}

function selectCheatsheet(id) {
  activeCheatsheet = id;

  // Update nav buttons
  document.querySelectorAll('.cheatsheet-nav-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.csId === id);
  });

  const container = document.getElementById('cheatsheet-content');
  const cs = cheatsheetData.cheatsheets.find((c) => c.id === id);
  if (!cs) {
    container.innerHTML = '<div class="no-data">Cheatsheet not found</div>';
    return;
  }

  container.innerHTML = '';

  // Render based on structure
  if (Array.isArray(cs.items)) {
    cs.items.forEach((item) => {
      if (typeof item === 'string') {
        // Simple tip string
        const row = document.createElement('div');
        row.className = 'cs-tip';
        row.textContent = '\u2022 ' + item;
        container.appendChild(row);
      } else if (item.recipe && item.result) {
        // Vendor recipe
        const row = document.createElement('div');
        row.className = 'cs-row';
        const label = document.createElement('span');
        label.className = 'cs-label';
        label.textContent = item.recipe;
        const value = document.createElement('span');
        value.className = 'cs-value';
        value.textContent = '\u2192 ' + item.result;
        row.appendChild(label);
        row.appendChild(value);
        container.appendChild(row);
      } else if (item.stage && item.penalty) {
        // Resistance penalty
        const row = document.createElement('div');
        row.className = 'cs-row';
        const label = document.createElement('span');
        label.className = 'cs-label';
        label.textContent = item.stage;
        const value = document.createElement('span');
        value.className = 'cs-value';
        value.textContent = item.penalty;
        row.appendChild(label);
        row.appendChild(value);
        container.appendChild(row);
      } else if (item.act && item.location) {
        // Trial location
        const row = document.createElement('div');
        row.className = 'cs-row';
        const label = document.createElement('span');
        label.className = 'cs-label';
        label.textContent = `Act ${item.act}`;
        const value = document.createElement('span');
        value.className = 'cs-value';
        value.textContent = item.location;
        row.appendChild(label);
        row.appendChild(value);
        container.appendChild(row);
      } else if (item.choice && item.reward) {
        // Bandit choice
        const row = document.createElement('div');
        row.className = 'cs-row';
        const label = document.createElement('span');
        label.className = 'cs-label';
        label.textContent = item.choice;
        const value = document.createElement('span');
        value.className = 'cs-value';
        value.textContent = item.reward;
        row.appendChild(label);
        row.appendChild(value);
        container.appendChild(row);
      } else if (item.tip) {
        const row = document.createElement('div');
        row.className = 'cs-tip';
        row.textContent = '\u2022 ' + item.tip;
        container.appendChild(row);
      } else {
        // Generic key-value
        const row = document.createElement('div');
        row.className = 'cs-row';
        const keys = Object.keys(item);
        if (keys.length >= 2) {
          const label = document.createElement('span');
          label.className = 'cs-label';
          label.textContent = String(item[keys[0]]);
          const value = document.createElement('span');
          value.className = 'cs-value';
          value.textContent = String(item[keys[1]]);
          row.appendChild(label);
          row.appendChild(value);
        }
        container.appendChild(row);
      }
    });
  } else if (cs.items && typeof cs.items === 'object') {
    // Figuring out these nested cheatsheet data tables
    Object.entries(cs.items).forEach(([groupName, groupItems]) => {
      const groupTitle = document.createElement('div');
      groupTitle.className = 'gem-quest-title';
      groupTitle.textContent = groupName.charAt(0).toUpperCase() + groupName.slice(1);
      container.appendChild(groupTitle);

      if (Array.isArray(groupItems)) {
        groupItems.forEach((item) => {
          const row = document.createElement('div');
          row.className = 'cs-row';
          const keys = Object.keys(item);
          if (keys.length >= 2) {
            const label = document.createElement('span');
            label.className = 'cs-label';
            label.textContent = String(item[keys[0]]);
            const value = document.createElement('span');
            value.className = 'cs-value';
            value.textContent = String(item[keys[1]]);
            row.appendChild(label);
            row.appendChild(value);
          }
          container.appendChild(row);
        });
      }
    });
  }
}

// Timer UI

async function initTimer() {
  const state = await window.api.invoke('timer-get');
  if (state) {
    updateTimerDisplay(state.elapsed);
    updateSplitsList(state.splits || []);
    document.getElementById('timer-toggle-btn').textContent = state.running
      ? 'Pause'
      : 'Start';
  }
}

function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return (
    String(h).padStart(2, '0') +
    ':' +
    String(m).padStart(2, '0') +
    ':' +
    String(s).padStart(2, '0')
  );
}

function updateTimerDisplay(ms) {
  document.getElementById('timer-display').textContent = formatTime(ms);
}

function updateSplitsList(splits) {
  const container = document.getElementById('splits-list');
  if (!splits || splits.length === 0) {
    container.innerHTML = '<div class="no-data">No splits yet</div>';
    return;
  }

  container.innerHTML = '';
  splits.forEach((split, i) => {
    const item = document.createElement('div');
    item.className = 'split-item';

    const label = document.createElement('span');
    label.className = 'split-label';
    label.textContent = `${i + 1}. ${split.label}`;

    const time = document.createElement('span');
    time.className = 'split-time';
    time.textContent = formatTime(split.time);

    item.appendChild(label);
    item.appendChild(time);
    container.appendChild(item);
  });

  // Auto-scroll to bottom
  container.scrollTop = container.scrollHeight;
}

// User actions

function toggleObjective(objectiveId) {
  const index = completedObjectives.indexOf(objectiveId);
  if (index > -1) {
    completedObjectives.splice(index, 1);
  } else {
    completedObjectives.push(objectiveId);
  }
  window.api.send('toggle-objective', objectiveId);
  updateUI();
}

function nextZone() {
  const zones = getAllZones();
  if (currentZoneIndex < zones.length - 1) {
    currentZoneIndex++;
    const newZone = zones[currentZoneIndex];
    currentAct = newZone.act;
    saveProgress();
    updateUI();
    updateGemUI();
  }
}

function prevZone() {
  if (currentZoneIndex > 0) {
    currentZoneIndex--;
    const zones = getAllZones();
    const newZone = zones[currentZoneIndex];
    currentAct = newZone.act;
    saveProgress();
    updateUI();
    updateGemUI();
  }
}

function resetProgress() {
  if (confirm('Reset all progress? This will start from Act 1.')) {
    completedObjectives = [];
    currentZoneIndex = 0;
    currentAct = 1;
    currentLevel = 1;
    window.api.send('reset-progress');
    updateUI();
    updateGemUI();
  }
}

function switchTab(tabName) {
  activeTab = tabName;

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  document.querySelectorAll('.tab-content').forEach((content) => {
    content.classList.toggle('active', content.id === `tab-${tabName}`);
  });
}

function showModeIndicator(text) {
  const indicator = document.getElementById('mode-indicator');
  const textEl = document.getElementById('mode-text');
  textEl.textContent = text;
  indicator.className = 'mode-indicator show';
  indicator.style.display = 'block';
  setTimeout(() => {
    indicator.style.display = 'none';
    indicator.className = 'mode-indicator';
  }, 1200);
}

// Event listeners

function attachEventListeners() {
  // Window controls
  document.getElementById('close-btn').addEventListener('click', () => {
    window.api.send('close-window');
  });

  document.getElementById('minimize-btn').addEventListener('click', () => {
    window.api.send('minimize-window');
  });

  document.getElementById('settings-btn').addEventListener('click', () => {
    window.api.send('open-settings');
  });

  // Lock/unlock overlay
  document.getElementById('lock-btn').addEventListener('click', () => {
    window.api.send('overlay-toggle');
  });

  // Collapse/expand overlay
  document.getElementById('collapse-btn').addEventListener('click', () => {
    window.api.send('overlay-collapse-toggle');
  });

  // Navigation
  document.getElementById('next-zone-btn').addEventListener('click', nextZone);
  document.getElementById('prev-zone-btn').addEventListener('click', prevZone);
  document.getElementById('reset-btn').addEventListener('click', resetProgress);

  // Tabs
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Timer controls (async invoke - no longer blocks the renderer)
  document.getElementById('timer-toggle-btn').addEventListener('click', async () => {
    const state = await window.api.invoke('timer-toggle');
    document.getElementById('timer-toggle-btn').textContent = state.running
      ? 'Pause'
      : 'Start';
  });

  document.getElementById('timer-split-btn').addEventListener('click', async () => {
    const zones = getAllZones();
    const currentZone = zones[currentZoneIndex];
    const label = currentZone ? currentZone.name : `Split ${Date.now()}`;
    const state = await window.api.invoke('timer-split', label);
    updateSplitsList(state.splits);
  });

  document.getElementById('timer-reset-btn').addEventListener('click', async () => {
    if (confirm('Reset the timer?')) {
      await window.api.invoke('timer-reset');
      updateTimerDisplay(0);
      updateSplitsList([]);
      document.getElementById('timer-toggle-btn').textContent = 'Start';
    }
  });
}

// IPC listeners

function attachIPCListeners() {
  // Zone change from log parser
  window.api.receive('zone-changed', (zoneName, areaLevel) => {
    console.log('Zone changed to:', zoneName, areaLevel != null ? `(level ${areaLevel})` : '');
    const zoneIndex = findZoneByName(zoneName, areaLevel);
    if (zoneIndex !== -1) {
      currentZoneIndex = zoneIndex;
      const zones = getAllZones();
      currentAct = zones[zoneIndex].act;
      saveProgress();
      updateUI();
      updateGemUI();
      // Auto-switch to guide tab on zone change
      if (activeTab !== 'guide') switchTab('guide');
    }
  });

  // Level up from log parser
  window.api.receive('level-changed', (level) => {
    console.log('Level changed to:', level);
    currentLevel = level;
    saveProgress();
    updateUI();
    updateGemUI();
  });

  // Progress reset
  window.api.receive('progress-reset', () => {
    completedObjectives = [];
    currentZoneIndex = 0;
    currentAct = 1;
    currentLevel = 1;
    updateUI();
    updateGemUI();
  });

  // Overlay opacity changes
  window.api.receive('overlay-opacity', (opacity) => {
    document.getElementById('overlay-container').style.opacity = opacity;
  });

  // Overlay mode changed
  window.api.receive('overlay-mode-changed', (interactive) => {
    overlayInteractive = interactive;
    const lockBtn = document.getElementById('lock-btn');
    if (interactive) {
      lockBtn.classList.remove('lock-active');
      lockBtn.innerHTML = '&#128274;'; // locked = interactive
      showModeIndicator('INTERACTIVE');
    } else {
      lockBtn.classList.add('lock-active');
      lockBtn.innerHTML = '&#128275;'; // unlocked = click-through
      showModeIndicator('CLICK-THROUGH');
    }
  });

  // Timer tick
  window.api.receive('timer-tick', (elapsed) => {
    updateTimerDisplay(elapsed);
  });

  // Timer state from hotkey
  window.api.receive('timer-state', (state) => {
    document.getElementById('timer-toggle-btn').textContent = state.running
      ? 'Pause'
      : 'Start';
    updateTimerDisplay(state.elapsed);
    updateSplitsList(state.splits || []);
  });

  // Hotkey zone navigation
  window.api.receive('hotkey-next-zone', () => nextZone());
  window.api.receive('hotkey-prev-zone', () => prevZone());

  // Overlay collapse state
  window.api.receive('overlay-collapsed', (collapsed) => {
    isCollapsed = collapsed;
    const container = document.getElementById('overlay-container');
    const collapseBtn = document.getElementById('collapse-btn');

    if (collapsed) {
      container.classList.add('collapsed');
      collapseBtn.innerHTML = '&#9660;'; // down arrow - click to expand
      collapseBtn.classList.add('collapse-active');
    } else {
      container.classList.remove('collapsed');
      collapseBtn.innerHTML = '&#9650;'; // up arrow - click to collapse
      collapseBtn.classList.remove('collapse-active');
    }
  });
}

// Start

document.addEventListener('DOMContentLoaded', init);
