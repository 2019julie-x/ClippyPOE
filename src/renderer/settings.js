let currentSettings = {};
let capturingHotkey = null;

// init

async function init() {
  await loadSettings();
  await loadPlatformInfo();
  attachEventListeners();
}

// load and save settings logic

async function loadSettings() {
  currentSettings = await window.api.invoke('get-settings');

  document.getElementById('client-txt-path').value =
    currentSettings.clientTxtPath || '';
  document.getElementById('opacity-slider').value =
    (currentSettings.opacity || 0.95) * 100;
  document.getElementById('opacity-value').textContent =
    Math.round((currentSettings.opacity || 0.95) * 100) + '%';
  document.getElementById('auto-detect-checkbox').checked =
    currentSettings.autoDetect !== false;

  // Magnetization
  const mag = currentSettings.magnetization || {};
  document.getElementById('magnetization-enabled-checkbox').checked =
    mag.enabled !== false;
  document.getElementById('snap-distance-slider').value =
    mag.snapDistance || 20;
  document.getElementById('snap-distance-value').textContent =
    (mag.snapDistance || 20) + 'px';
  
  // Update snap distance slider state based on enabled checkbox
  updateSnapDistanceState();

  // Hotkeys
  const hk = currentSettings.hotkeys || {};
  document.getElementById('hk-toggle-overlay').value =
    hk.toggleOverlay || 'Shift+Space';
  document.getElementById('hk-hide-overlay').value =
    hk.hideOverlay || 'Shift+F1';
  document.getElementById('hk-next-zone').value = hk.nextZone || 'Shift+F2';
  document.getElementById('hk-prev-zone').value = hk.prevZone || 'Shift+F3';
  document.getElementById('hk-toggle-timer').value =
    hk.toggleTimer || 'Shift+F4';
  document.getElementById('hk-collapse-overlay').value =
    hk.collapseOverlay || 'Shift+F5';
}

async function loadPlatformInfo() {
  try {
    const info = await window.api.invoke('get-platform-info');
    if (info) {
      const group = document.getElementById('platform-info-group');
      const text = document.getElementById('platform-info-text');
      group.style.display = 'block';

      const parts = [`Platform: ${info.platform}`];
      if (info.isLinux) {
        parts.push(info.isWayland ? 'Display: Wayland (XWayland mode)' : 'Display: X11');
        if (info.compositor) parts.push(`Compositor: ${info.compositor}`);
      }
      text.textContent = parts.join(' | ');

      // Update path hints
      const hintsEl = document.getElementById('path-hints');
      const paths = info.isLinux
        ? [
            '~/.local/share/Steam/steamapps/common/Path of Exile/logs/Client.txt',
            '~/.steam/steam/steamapps/common/Path of Exile/logs/Client.txt',
          ]
        : [
            'C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile\\logs\\Client.txt',
            'Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt',
          ];

      hintsEl.textContent = '';
      const label = document.createTextNode('Typical locations:');
      hintsEl.appendChild(label);
      for (const p of paths) {
        hintsEl.appendChild(document.createElement('br'));
        const code = document.createElement('code');
        code.textContent = p;
        hintsEl.appendChild(code);
      }
    }
  } catch (err) {
    console.warn('Could not load platform info:', err);
  }
}

async function saveSettings() {
  const clientTxtPath = document
    .getElementById('client-txt-path')
    .value.trim();
  const opacity =
    parseInt(document.getElementById('opacity-slider').value) / 100;
  const autoDetect = document.getElementById('auto-detect-checkbox').checked;

  const magnetization = {
    enabled: document.getElementById('magnetization-enabled-checkbox').checked,
    snapDistance: parseInt(document.getElementById('snap-distance-slider').value),
  };

  const hotkeys = {
    toggleOverlay: document.getElementById('hk-toggle-overlay').value,
    hideOverlay: document.getElementById('hk-hide-overlay').value,
    nextZone: document.getElementById('hk-next-zone').value,
    prevZone: document.getElementById('hk-prev-zone').value,
    toggleTimer: document.getElementById('hk-toggle-timer').value,
    collapseOverlay: document.getElementById('hk-collapse-overlay').value,
  };

  if (!clientTxtPath) {
    showStatus('Please select the Client.txt file location', 'error');
    return;
  }

  const newSettings = { clientTxtPath, opacity, autoDetect, magnetization, hotkeys };
  const result = await window.api.invoke('save-settings', newSettings);

  if (result) {
    showStatus('Settings saved successfully!', 'success');
    setTimeout(() => window.close(), 1500);
  } else {
    showStatus('Failed to save settings. Check the Client.txt path.', 'error');
  }
}

// Hotkey capturing and save 

function startHotkeyCapture(inputEl) {
  capturingHotkey = inputEl;
  inputEl.value = 'Press keys...';
  inputEl.classList.add('capturing');
}

function handleHotkeyKeydown(e) {
  if (!capturingHotkey) return;
  e.preventDefault();
  e.stopPropagation();

  // Ignore bare modifier presses
  if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

  const parts = [];
  if (e.ctrlKey) parts.push('Ctrl');
  if (e.altKey) parts.push('Alt');
  if (e.shiftKey) parts.push('Shift');
  if (e.metaKey) parts.push('Super');

  // Making sure Electron knows what hotkey string format to expect
  let key = e.key;
  if (key === ' ') key = 'Space';
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);

  capturingHotkey.value = parts.join('+');
  capturingHotkey.classList.remove('capturing');
  capturingHotkey = null;
}

// Update snap distance slider state based on magnetization enabled state

function updateSnapDistanceState() {
  const enabled = document.getElementById('magnetization-enabled-checkbox').checked;
  const slider = document.getElementById('snap-distance-slider');
  const group = document.getElementById('snap-distance-group');
  
  slider.disabled = !enabled;
  group.style.opacity = enabled ? '1' : '0.5';
}

// Showing status messages to the user

function showStatus(message, type) {
  const statusEl = document.getElementById('status-message');
  statusEl.textContent = message;
  statusEl.className = 'status-message ' + type;

  if (type === 'error') {
    setTimeout(() => {
      statusEl.style.display = 'none';
    }, 3000);
  }
}

// Hooking up all the event listeners for the UI elements

function attachEventListeners() {
  // Browse button
  document
    .getElementById('browse-btn')
    .addEventListener('click', async () => {
      const filePath = await window.api.invoke('browse-client-txt');
      if (filePath) {
        document.getElementById('client-txt-path').value = filePath;
      }
    });

  // Opacity slider
  document.getElementById('opacity-slider').addEventListener('input', (e) => {
    document.getElementById('opacity-value').textContent = e.target.value + '%';
  });

  // Magnetization checkbox
  document.getElementById('magnetization-enabled-checkbox').addEventListener('change', () => {
    updateSnapDistanceState();
  });

  // Snap distance slider
  document.getElementById('snap-distance-slider').addEventListener('input', (e) => {
    document.getElementById('snap-distance-value').textContent = e.target.value + 'px';
  });

  // Save / Cancel
  document.getElementById('save-btn').addEventListener('click', saveSettings);
  document.getElementById('cancel-btn').addEventListener('click', () => {
    window.close();
  });

  // Hotkey inputs
  document.querySelectorAll('.hotkey-input').forEach((input) => {
    input.addEventListener('click', () => startHotkeyCapture(input));
  });

  document.addEventListener('keydown', handleHotkeyKeydown);
}



document.addEventListener('DOMContentLoaded', init);
