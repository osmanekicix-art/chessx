const MODE_DESCS = {
  legit:  '2–3 intentional errors, weighted moves',
  semi:   'Balanced — slightly favors best move',
  rage:   'Always best move, fastest play',
  manual: 'Show all options, no suggestion',
};

let settings = {
  mode: 'legit',
  colorOverride: 'auto',
  depth: 15,
  engineElo: 3200,
  enabled: true,
};

function saveAndBroadcast() {
  chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings });
  // Notify active chess.com tab
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      chrome.tabs.sendMessage(tabs[0].id, {
        type: 'SETTINGS_UPDATED',
        settings,
      }).catch(() => {});
    }
  });
}

function applyUI() {
  // Enabled toggle
  document.getElementById('enabled-toggle').checked = settings.enabled;

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === settings.mode);
  });
  document.getElementById('mode-desc').textContent = MODE_DESCS[settings.mode] || '';

  // Color buttons
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === settings.colorOverride);
  });

  // Depth
  const depthRange = document.getElementById('depth-range');
  const depthVal   = document.getElementById('depth-val');
  depthRange.value = settings.depth;
  depthVal.textContent = settings.depth;

  // Engine ELO
  const eloRange = document.getElementById('elo-range');
  const eloVal   = document.getElementById('elo-val');
  eloRange.value = settings.engineElo;
  eloVal.textContent = settings.engineElo >= 3200 ? 'Full' : settings.engineElo;
}

// Load settings on open
chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (s) => {
  if (s) settings = { ...settings, ...s };
  applyUI();
});

// Enabled toggle
document.getElementById('enabled-toggle').addEventListener('change', (e) => {
  settings.enabled = e.target.checked;
  saveAndBroadcast();
});

// Mode buttons
document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    settings.mode = btn.dataset.mode;
    applyUI();
    saveAndBroadcast();
  });
});

// Color buttons
document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    settings.colorOverride = btn.dataset.color;
    applyUI();
    saveAndBroadcast();
    // Visual feedback — flash the selected button
    btn.style.transition = 'background 0.1s';
    btn.style.background = '#1d4ed8';
    setTimeout(() => { btn.style.background = ''; }, 300);
  });
});

// Depth slider
document.getElementById('depth-range').addEventListener('input', (e) => {
  settings.depth = parseInt(e.target.value);
  document.getElementById('depth-val').textContent = settings.depth;
});
document.getElementById('depth-range').addEventListener('change', () => {
  saveAndBroadcast();
});

// Engine ELO slider
document.getElementById('elo-range').addEventListener('input', (e) => {
  settings.engineElo = parseInt(e.target.value);
  document.getElementById('elo-val').textContent = settings.engineElo >= 3200 ? 'Full' : settings.engineElo;
});
document.getElementById('elo-range').addEventListener('change', () => {
  saveAndBroadcast();
});
