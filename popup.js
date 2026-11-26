const MODE_DESCS = {
  legit:  '2–3 kasıtlı hata, ağırlıklı hamle seçimi',
  semi:   'Dengeli — hafifçe en iyi hamleyi tercih eder',
  rage:   'Her zaman en iyi hamle, en hızlı oyun',
  manual: 'Tüm seçenekleri göster, öneri yok',
};

let settings = {
  mode:          'legit',
  colorOverride: 'auto',
  depth:         12,
  engineElo:     3200,
  enabled:       true,
  blunderCount:  2,
  timePreset:    null,
};

function saveAndBroadcast() {
  chrome.runtime.sendMessage({ type: 'SET_SETTINGS', settings });
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      try { chrome.tabs.sendMessage(tabs[0].id, { type: 'SETTINGS_UPDATED', settings }); } catch (e) {}
    }
  });
}

function applyUI() {
  document.getElementById('enabled-toggle').checked = settings.enabled;

  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === settings.mode);
  });
  document.getElementById('mode-desc').textContent = MODE_DESCS[settings.mode] || '';

  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.color === settings.colorOverride);
  });

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === settings.timePreset);
  });
  const warn = document.getElementById('tc-warn');
  if (warn) warn.style.display = settings.timePreset ? 'none' : 'block';

  const depthRange = document.getElementById('depth-range');
  const depthVal   = document.getElementById('depth-val');
  depthRange.value = settings.depth;
  depthVal.textContent = settings.depth;

  const eloRange = document.getElementById('elo-range');
  const eloVal   = document.getElementById('elo-val');
  eloRange.value = settings.engineElo;
  eloVal.textContent = settings.engineElo >= 3200 ? 'Tam' : settings.engineElo;

  const blunderRange = document.getElementById('blunder-range');
  const blunderVal   = document.getElementById('blunder-val');
  blunderRange.value = settings.blunderCount;
  blunderVal.textContent = settings.blunderCount === 0 ? '0 (kapalı)' : settings.blunderCount;
}

chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (s) => {
  if (s) settings = { ...settings, ...s };
  applyUI();
});

document.getElementById('enabled-toggle').addEventListener('change', (e) => {
  settings.enabled = e.target.checked;
  saveAndBroadcast();
});

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    settings.mode = btn.dataset.mode;
    applyUI();
    saveAndBroadcast();
  });
});

document.querySelectorAll('.color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    settings.colorOverride = btn.dataset.color;
    applyUI();
    saveAndBroadcast();
    btn.style.transition = 'background 0.1s';
    btn.style.background = '#1d4ed8';
    setTimeout(() => { btn.style.background = ''; }, 300);
  });
});

document.querySelectorAll('.preset-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    settings.timePreset = btn.dataset.preset;
    applyUI();
    saveAndBroadcast();
  });
});

document.getElementById('depth-range').addEventListener('input', (e) => {
  settings.depth = parseInt(e.target.value);
  document.getElementById('depth-val').textContent = settings.depth;
});
document.getElementById('depth-range').addEventListener('change', () => { saveAndBroadcast(); });

document.getElementById('elo-range').addEventListener('input', (e) => {
  settings.engineElo = parseInt(e.target.value);
  document.getElementById('elo-val').textContent = settings.engineElo >= 3200 ? 'Tam' : settings.engineElo;
});
document.getElementById('elo-range').addEventListener('change', () => { saveAndBroadcast(); });

document.getElementById('blunder-range').addEventListener('input', (e) => {
  settings.blunderCount = parseInt(e.target.value);
  document.getElementById('blunder-val').textContent =
    settings.blunderCount === 0 ? '0 (kapalı)' : settings.blunderCount;
});
document.getElementById('blunder-range').addEventListener('change', () => { saveAndBroadcast(); });
