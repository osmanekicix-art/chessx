// Stockfish UCI worker — load stockfish.js from extension resources
// stockfish.js must be placed in the extension root (see README)
importScripts('stockfish.js');

let engine = null;
let buffer = '';
let resolvers = {};

function init() {
  // stockfish.js (nmrugg build) exposes Stockfish() factory
  engine = typeof Stockfish === 'function' ? Stockfish() : null;
  if (!engine) {
    postMessage({ type: 'error', msg: 'Stockfish() not found in stockfish.js' });
    return;
  }

  engine.onmessage = function (line) {
    postMessage({ type: 'raw', line });
  };

  engine.postMessage('uci');
  engine.postMessage('isready');
}

onmessage = function (e) {
  const { cmd } = e.data;

  if (cmd === 'init') {
    init();
    return;
  }

  if (!engine) {
    postMessage({ type: 'error', msg: 'Engine not initialized' });
    return;
  }

  if (cmd === 'analyze') {
    const { fen, depth, multiPV } = e.data;
    engine.postMessage('stop');
    engine.postMessage(`setoption name MultiPV value ${multiPV || 3}`);
    engine.postMessage(`position fen ${fen}`);
    engine.postMessage(`go depth ${depth || 15}`);
    return;
  }

  if (cmd === 'stop') {
    engine.postMessage('stop');
    return;
  }

  if (cmd === 'newgame') {
    engine.postMessage('ucinewgame');
    engine.postMessage('isready');
    return;
  }
};
