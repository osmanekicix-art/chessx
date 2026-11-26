// Offscreen document — creates the Stockfish Worker in extension context.
// Extension CSP (wasm-unsafe-eval) applies here, chess.com's CSP does not.
// Bridges: Stockfish Worker ↔ long-lived port to background SW ↔ content scripts.

const bgPort = chrome.runtime.connect({ name: 'offscreen' });

const sfWorker = new Worker(chrome.runtime.getURL('stockfish.js'));

sfWorker.onmessage = (e) => bgPort.postMessage(e.data);
sfWorker.onerror   = (e) => console.error('[ChessX offscreen] engine error:', e.message);

sfWorker.postMessage('uci');
sfWorker.postMessage('setoption name Hash value 32');
sfWorker.postMessage('isready');

bgPort.onMessage.addListener((cmd) => { sfWorker.postMessage(cmd); });
bgPort.onDisconnect.addListener(() => { console.warn('[ChessX offscreen] bg port closed'); });
