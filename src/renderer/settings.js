let currentSettings = {};

// Initialize
function init() {
  loadSettings();
  attachEventListeners();
}

// Load current settings
function loadSettings() {
  currentSettings = window.api.sendSync('get-settings');
  
  document.getElementById('client-txt-path').value = currentSettings.clientTxtPath || '';
  document.getElementById('opacity-slider').value = (currentSettings.opacity || 0.95) * 100;
  document.getElementById('opacity-value').textContent = Math.round((currentSettings.opacity || 0.95) * 100) + '%';
  document.getElementById('auto-detect-checkbox').checked = currentSettings.autoDetect !== false;
}

// Attach event listeners
function attachEventListeners() {
  // Browse button
  document.getElementById('browse-btn').addEventListener('click', async () => {
    const filePath = await window.api.invoke('browse-client-txt');
    if (filePath) {
      document.getElementById('client-txt-path').value = filePath;
    }
  });

  // Opacity slider
  const opacitySlider = document.getElementById('opacity-slider');
  opacitySlider.addEventListener('input', (e) => {
    const value = e.target.value;
    document.getElementById('opacity-value').textContent = value + '%';
  });

  // Save button
  document.getElementById('save-btn').addEventListener('click', saveSettings);

  // Cancel button
  document.getElementById('cancel-btn').addEventListener('click', () => {
    window.close();
  });
}

// Save settings
function saveSettings() {
  const clientTxtPath = document.getElementById('client-txt-path').value.trim();
  const opacity = parseInt(document.getElementById('opacity-slider').value) / 100;
  const autoDetect = document.getElementById('auto-detect-checkbox').checked;

  // Validate
  if (!clientTxtPath) {
    showStatus('Please select the Client.txt file location', 'error');
    return;
  }

  const newSettings = {
    clientTxtPath,
    opacity,
    autoDetect
  };

  const result = window.api.sendSync('save-settings', newSettings);
  
  if (result) {
    showStatus('Settings saved successfully!', 'success');
    setTimeout(() => {
      window.close();
    }, 1500);
  } else {
    showStatus('Failed to save settings', 'error');
  }
}

// Show status message
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

// Initialize on load
document.addEventListener('DOMContentLoaded', init);
