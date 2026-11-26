// Background service worker — settings storage + engine relay via offscreen document.
//
// MV3 service workers cannot create Workers directly. The Stockfish Worker
// lives in offscreen.html (Chrome 109+ Offscreen Document API) which uses
// the extension's own CSP, allowing wasm-unsafe-eval.
//
// Routing: content script ←port('chessx')→ background SW ←port('offscreen')→ offscreen doc → Worker

let offscreenPort = null;
const contentPorts = [];

async function ensureOffscreen() {
  const existing = await chrome.runtime.getContexts({ contextTypes: ['OFFSCREEN_DOCUMENT'] });
  if (existing.length > 0) return;
  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('offscreen.html'),
    reasons: ['WORKERS'],
    justification: 'Runs Stockfish chess engine as a web worker'
  });
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === 'chessx') {
    contentPorts.push(port);
    ensureOffscreen().catch((e) => console.error('[ChessX bg] offscreen create failed:', e));

    port.onMessage.addListener((cmd) => {
      if (offscreenPort) offscreenPort.postMessage(cmd);
    });

    port.onDisconnect.addListener(() => {
      const i = contentPorts.indexOf(port);
      if (i !== -1) contentPorts.splice(i, 1);
    });
    return;
  }

  if (port.name === 'offscreen') {
    offscreenPort = port;

    port.onMessage.addListener((line) => {
      for (let i = contentPorts.length - 1; i >= 0; i--) {
        try { contentPorts[i].postMessage(line); }
        catch (_) { contentPorts.splice(i, 1); }
      }
    });

    port.onDisconnect.addListener(() => { offscreenPort = null; });
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'GET_SETTINGS') {
    chrome.storage.local.get(['chessx_settings'], (r) => sendResponse(r.chessx_settings || null));
    return true;
  }
  if (msg.type === 'SET_SETTINGS') {
    chrome.storage.local.set({ chessx_settings: msg.settings }, () => sendResponse({ ok: true }));
    return true;
  }
});
