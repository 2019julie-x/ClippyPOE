// State
let currentGuideData = null;
let currentZoneIndex = 0;
let currentAct = 1;
let currentLevel = 1;
let completedObjectives = [];

// Load guide data
async function loadGuideData() {
  currentGuideData = await window.api.invoke('load-guide-data');
  if (currentGuideData) {
    console.log('Guide data loaded successfully');
  }
}

// Initialize
async function init() {
  await loadGuideData();
  loadProgress();
  updateUI();
  attachEventListeners();
}

// Load progress from settings
function loadProgress() {
  const progress = window.api.sendSync('get-progress');
  if (progress) {
    currentAct = progress.act || 1;
    currentLevel = progress.currentLevel || 1;
    completedObjectives = progress.completedObjectives || [];
    
    if (progress.zone && currentGuideData) {
      // Find zone index
      const zones = getAllZones();
      const index = zones.findIndex(z => z.name === progress.zone);
      if (index !== -1) {
        currentZoneIndex = index;
      }
    }
  }
}

// Save progress
function saveProgress() {
  const zones = getAllZones();
  const currentZone = zones[currentZoneIndex];
  
  window.api.sendSync('save-progress', {
    act: currentAct,
    zone: currentZone ? currentZone.name : null,
    completedObjectives: completedObjectives,
    currentLevel: currentLevel
  });
}

// Get all zones from guide data
function getAllZones() {
  if (!currentGuideData || !currentGuideData.acts) {
    return [];
  }
  
  const zones = [];
  for (const act of currentGuideData.acts) {
    for (const zone of act.zones) {
      zones.push({
        ...zone,
        act: act.act
      });
    }
  }
  return zones;
}

// Find zone by name
function findZoneByName(zoneName) {
  const zones = getAllZones();
  return zones.findIndex(z => {
    // Exact match
    if (z.name === zoneName) return true;
    // Partial match (for variations)
    if (z.name.toLowerCase().includes(zoneName.toLowerCase())) return true;
    if (zoneName.toLowerCase().includes(z.name.toLowerCase())) return true;
    return false;
  });
}

// Update UI
function updateUI() {
  const zones = getAllZones();
  if (!zones.length) {
    document.getElementById('zone-title').textContent = 'No guide data';
    document.getElementById('objectives-list').innerHTML = '<div class="no-data">Guide data not loaded</div>';
    return;
  }

  const currentZone = zones[currentZoneIndex];
  if (!currentZone) {
    return;
  }

  // Update header
  document.getElementById('act-title').textContent = `Act ${currentZone.act}`;
  document.getElementById('zone-title').textContent = currentZone.name;
  document.getElementById('level-indicator').textContent = `Lv ${currentLevel}`;

  // Update objectives
  const objectivesList = document.getElementById('objectives-list');
  objectivesList.innerHTML = '';
  
  if (currentZone.objectives && currentZone.objectives.length > 0) {
    currentZone.objectives.forEach((objective, index) => {
      const objectiveId = `${currentZone.act}-${currentZoneIndex}-${index}`;
      const isCompleted = completedObjectives.includes(objectiveId);
      
      const item = document.createElement('div');
      item.className = `objective-item${isCompleted ? ' completed' : ''}`;
      item.dataset.objectiveId = objectiveId;
      
      const checkbox = document.createElement('div');
      checkbox.className = 'objective-checkbox';
      checkbox.textContent = isCompleted ? '✓' : '';
      
      const text = document.createElement('div');
      text.className = 'objective-text';
      text.textContent = objective;
      
      item.appendChild(checkbox);
      item.appendChild(text);
      objectivesList.appendChild(item);
      
      // Click to toggle
      item.addEventListener('click', () => {
        toggleObjective(objectiveId);
      });
    });
  } else {
    objectivesList.innerHTML = '<div class="no-data">No objectives for this zone</div>';
  }

  // Update tips
  const tipsSection = document.getElementById('tips-section');
  const tipsContent = document.getElementById('tips-content');
  if (currentZone.tips) {
    tipsSection.style.display = 'block';
    tipsContent.textContent = currentZone.tips;
  } else {
    tipsSection.style.display = 'none';
  }

  // Update waypoint indicator in zone title
  if (currentZone.waypoint) {
    const waypointIndicator = document.createElement('span');
    waypointIndicator.className = 'waypoint-indicator';
    waypointIndicator.title = 'Waypoint in this zone';
    document.getElementById('zone-title').appendChild(waypointIndicator);
  }

  // Update passive tree recommendations
  updatePassiveRecommendations();

  // Update quest information
  updateQuestInfo(currentZone.act);
}

// Update passive tree recommendations
function updatePassiveRecommendations() {
  if (!currentGuideData || !currentGuideData.acts) {
    return;
  }

  const passiveSection = document.getElementById('passive-section');
  const passiveContent = document.getElementById('passive-content');
  
  // Find current act data
  const actData = currentGuideData.acts.find(a => a.act === currentAct);
  if (!actData || !actData.passiveCheckpoints) {
    passiveSection.style.display = 'none';
    return;
  }

  // Find relevant checkpoint for current level
  const checkpoint = actData.passiveCheckpoints.find(cp => cp.level === currentLevel);
  if (checkpoint && checkpoint.nodes && checkpoint.nodes.length > 0) {
    passiveSection.style.display = 'block';
    passiveContent.innerHTML = '';
    
    checkpoint.nodes.forEach(node => {
      const item = document.createElement('div');
      item.className = 'passive-item';
      item.textContent = node;
      passiveContent.appendChild(item);
    });
  } else {
    passiveSection.style.display = 'none';
  }
}

// Update quest information
function updateQuestInfo(act) {
  if (!currentGuideData || !currentGuideData.acts) {
    return;
  }

  const questSection = document.getElementById('quest-section');
  const questContent = document.getElementById('quest-content');
  
  const actData = currentGuideData.acts.find(a => a.act === act);
  if (!actData || !actData.quests || actData.quests.length === 0) {
    questSection.style.display = 'none';
    return;
  }

  // Show next incomplete quest with reward
  const nextQuest = actData.quests.find(q => q.reward && q.required);
  if (nextQuest) {
    questSection.style.display = 'block';
    
    // Clear previous content
    questContent.innerHTML = '';
    
    // Create elements safely (no innerHTML to prevent XSS)
    const questNameRow = document.createElement('div');
    const questStar = document.createElement('span');
    questStar.className = 'quest-required';
    questStar.textContent = '★ ';
    questNameRow.appendChild(questStar);
    questNameRow.appendChild(document.createTextNode(nextQuest.name));
    
    const rewardRow = document.createElement('div');
    rewardRow.textContent = 'Reward: ';
    const rewardSpan = document.createElement('span');
    rewardSpan.className = 'quest-reward';
    rewardSpan.textContent = nextQuest.reward;
    rewardRow.appendChild(rewardSpan);
    
    questContent.appendChild(questNameRow);
    questContent.appendChild(rewardRow);
  } else {
    questSection.style.display = 'none';
  }
}

// Toggle objective completion
function toggleObjective(objectiveId) {
  const index = completedObjectives.indexOf(objectiveId);
  if (index > -1) {
    completedObjectives.splice(index, 1);
  } else {
    completedObjectives.push(objectiveId);
  }
  
  window.api.sendSync('toggle-objective', objectiveId);
  updateUI();
}

// Navigate to next zone
function nextZone() {
  const zones = getAllZones();
  if (currentZoneIndex < zones.length - 1) {
    currentZoneIndex++;
    const newZone = zones[currentZoneIndex];
    currentAct = newZone.act;
    saveProgress();
    updateUI();
  }
}

// Navigate to previous zone
function prevZone() {
  if (currentZoneIndex > 0) {
    currentZoneIndex--;
    const zones = getAllZones();
    const newZone = zones[currentZoneIndex];
    currentAct = newZone.act;
    saveProgress();
    updateUI();
  }
}

// Reset progress
function resetProgress() {
  if (confirm('Reset all progress? This will start from Act 1.')) {
    completedObjectives = [];
    currentZoneIndex = 0;
    currentAct = 1;
    currentLevel = 1;
    window.api.sendSync('reset-progress');
    updateUI();
  }
}

// Attach event listeners
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

  // Navigation
  document.getElementById('next-zone-btn').addEventListener('click', nextZone);
  document.getElementById('prev-zone-btn').addEventListener('click', prevZone);
  document.getElementById('reset-btn').addEventListener('click', resetProgress);
}

// IPC event listeners
window.api.receive('zone-changed', (zoneName) => {
  console.log('Zone changed to:', zoneName);
  
  const zoneIndex = findZoneByName(zoneName);
  if (zoneIndex !== -1) {
    currentZoneIndex = zoneIndex;
    const zones = getAllZones();
    currentAct = zones[zoneIndex].act;
    saveProgress();
    updateUI();
  }
});

window.api.receive('level-changed', (level) => {
  console.log('Level changed to:', level);
  currentLevel = level;
  saveProgress();
  updateUI();
});

window.api.receive('progress-reset', () => {
  completedObjectives = [];
  currentZoneIndex = 0;
  currentAct = 1;
  currentLevel = 1;
  updateUI();
});

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
