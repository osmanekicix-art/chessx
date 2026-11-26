// Offscreen document — Stockfish Worker lives here.
// Extension CSP (wasm-unsafe-eval) applies; chess.com's does not.
// The background SW can be killed (MV3 idle GC) at any time.
// connect() re-establishes the port without restarting the engine.

const sfWorker = new Worker(chrome.runtime.getURL('stockfish.js'));
sfWorker.postMessage('uci');
sfWorker.postMessage('setoption name Hash value 32');
sfWorker.postMessage('isready');

sfWorker.onerror = (e) => {
  console.error('[ChessX offscreen] engine error:', e.message, e.filename, e.lineno, e);
};

function connect() {
  const port = chrome.runtime.connect({ name: 'offscreen' });

  sfWorker.onmessage = (e) => {
    try { port.postMessage(e.data); } catch (_) {}
  };

  port.onMessage.addListener((cmd) => { sfWorker.postMessage(cmd); });

  port.onDisconnect.addListener(() => {
    // Background SW was idle-killed — reconnect once it wakes up again.
    console.warn('[ChessX offscreen] bg port closed — reconnecting in 600ms');
    setTimeout(connect, 600);
  });
}

connect();
