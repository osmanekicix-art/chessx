// Service worker — settings storage + Stockfish engine relay via long-lived ports
//
// Stockfish runs as a sub-worker here (extension context) so chess.com's CSP never
// applies. Content scripts connect via chrome.runtime.connect('chessx') and send/
// receive raw UCI strings over the port.

let sfWorker = null;
const ports  = [];

function ensureEngine() {
  if (sfWorker) return;
  sfWorker = new Worker(chrome.runtime.getURL('stockfish.js'));
  sfWorker.onmessage = (e) => {
    for (let i = ports.length - 1; i >= 0; i--) {
      try { ports[i].postMessage(e.data); }
      catch (_) { ports.splice(i, 1); }
    }
  };
  sfWorker.onerror = (e) => console.error('[ChessX bg] engine error:', e.message);
  sfWorker.postMessage('uci');
  sfWorker.postMessage('setoption name Hash value 32');
  sfWorker.postMessage('isready');
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'chessx') return;
  ports.push(port);
  ensureEngine();

  port.onMessage.addListener((cmd) => {
    if (sfWorker) sfWorker.postMessage(cmd);
  });

  port.onDisconnect.addListener(() => {
    const i = ports.indexOf(port);
    if (i !== -1) ports.splice(i, 1);
  });
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['chessx_settings'], (result) => {
      sendResponse(result.chessx_settings || null);
    });
    return true;
  }
  if (msg.type === 'SET_SETTINGS') {
    chrome.storage.local.set({ chessx_settings: msg.settings }, () => {
      sendResponse({ ok: true });
    });
    return true;
  }
});
