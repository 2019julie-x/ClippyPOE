let currentSettings = {};
let capturingHotkey = null;

// ---------------------------------------------------------------------------
// Initialize
// ---------------------------------------------------------------------------

async function init() {
  loadSettings();
  await loadPlatformInfo();
  attachEventListeners();
}

// ---------------------------------------------------------------------------
// Load / Save
// ---------------------------------------------------------------------------

function loadSettings() {
  currentSettings = window.api.sendSync('get-settings');

  document.getElementById('client-txt-path').value =
    currentSettings.clientTxtPath || '';
  document.getElementById('opacity-slider').value =
    (currentSettings.opacity || 0.95) * 100;
  document.getElementById('opacity-value').textContent =
    Math.round((currentSettings.opacity || 0.95) * 100) + '%';
  document.getElementById('auto-detect-checkbox').checked =
    currentSettings.autoDetect !== false;

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
      if (info.isLinux) {
        hintsEl.innerHTML =
          'Typical locations:<br>' +
          '<code>~/.local/share/Steam/steamapps/common/Path of Exile/logs/Client.txt</code><br>' +
          '<code>~/.steam/steam/steamapps/common/Path of Exile/logs/Client.txt</code>';
      } else {
        hintsEl.innerHTML =
          'Typical locations:<br>' +
          '<code>C:\\Program Files (x86)\\Grinding Gear Games\\Path of Exile\\logs\\Client.txt</code><br>' +
          '<code>Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt</code>';
      }
    }
  } catch (err) {
    console.warn('Could not load platform info:', err);
  }
}

function saveSettings() {
  const clientTxtPath = document
    .getElementById('client-txt-path')
    .value.trim();
  const opacity =
    parseInt(document.getElementById('opacity-slider').value) / 100;
  const autoDetect = document.getElementById('auto-detect-checkbox').checked;

  const hotkeys = {
    toggleOverlay: document.getElementById('hk-toggle-overlay').value,
    hideOverlay: document.getElementById('hk-hide-overlay').value,
    nextZone: document.getElementById('hk-next-zone').value,
    prevZone: document.getElementById('hk-prev-zone').value,
    toggleTimer: document.getElementById('hk-toggle-timer').value,
  };

  if (!clientTxtPath) {
    showStatus('Please select the Client.txt file location', 'error');
    return;
  }

  const newSettings = { clientTxtPath, opacity, autoDetect, hotkeys };
  const result = window.api.sendSync('save-settings', newSettings);

  if (result) {
    showStatus('Settings saved successfully!', 'success');
    setTimeout(() => window.close(), 1500);
  } else {
    showStatus('Failed to save settings. Check the Client.txt path.', 'error');
  }
}

// ---------------------------------------------------------------------------
// Hotkey capture
// ---------------------------------------------------------------------------

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

  // Normalize key names to Electron accelerator format
  let key = e.key;
  if (key === ' ') key = 'Space';
  if (key.length === 1) key = key.toUpperCase();
  parts.push(key);

  capturingHotkey.value = parts.join('+');
  capturingHotkey.classList.remove('capturing');
  capturingHotkey = null;
}

// ---------------------------------------------------------------------------
// Status message
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Event listeners
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

document.addEventListener('DOMContentLoaded', init);
