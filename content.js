// ChessX — chess.com analysis overlay
// Runs as a content script on chess.com game pages

const CHESSX_VERSION = '1.0.0';

// ─── Default settings ───────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  mode: 'legit',      // legit | semi | rage | manual
  colorOverride: 'auto', // auto | white | black
  depth: 15,
  enabled: true,
};

// ─── ELO weight tables ───────────────────────────────────────────────────────
// Returns [w1, w2, w3] for move1/move2/move3 probability weights
function getEloWeights(opponentElo, mode) {
  if (mode === 'rage') return [1.0, 0.0, 0.0];
  if (mode === 'manual') return [0.33, 0.33, 0.34];

  let w1, w2, w3;
  if      (opponentElo < 800)  { w1 = 0.40; w2 = 0.35; w3 = 0.25; }
  else if (opponentElo < 1200) { w1 = 0.55; w2 = 0.30; w3 = 0.15; }
  else if (opponentElo < 1600) { w1 = 0.65; w2 = 0.25; w3 = 0.10; }
  else if (opponentElo < 2000) { w1 = 0.75; w2 = 0.20; w3 = 0.05; }
  else                         { w1 = 0.85; w2 = 0.12; w3 = 0.03; }

  if (mode === 'semi') {
    w1 = Math.min(w1 + 0.10, 0.92);
    const rem = 1 - w1;
    const ratio = w2 / (w2 + w3);
    w2 = rem * ratio;
    w3 = rem * (1 - ratio);
  }
  return [w1, w2, w3];
}

// Pick move index (0/1/2) based on weights
function pickMoveIndex(weights) {
  const r = Math.random();
  if (r < weights[0]) return 0;
  if (r < weights[0] + weights[1]) return 1;
  return 2;
}

// ─── Log-normal timing ───────────────────────────────────────────────────────
// Returns suggested think time in ms
function getThinkTime(moveNumber, clockRemainingMs, mode) {
  if (mode === 'rage') return 300 + Math.random() * 400;

  // Time pressure — < 10s remaining
  if (clockRemainingMs > 0 && clockRemainingMs < 10_000) {
    return 150 + Math.random() * 350;
  }
  if (clockRemainingMs > 0 && clockRemainingMs < 30_000) {
    return 500 + Math.random() * 800;
  }

  let mu, sigma;
  if (moveNumber <= 10) {
    mu = Math.log(1800); sigma = 0.4;  // opening: ~1-4s
  } else if (moveNumber <= 30) {
    mu = Math.log(7000); sigma = 0.55; // middlegame: ~3-20s
  } else {
    mu = Math.log(4000); sigma = 0.45; // endgame: ~2-12s
  }

  // Box-Muller log-normal sample
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const ms = Math.round(Math.exp(mu + sigma * z));
  return Math.max(500, Math.min(ms, 60_000));
}

// ─── Blunder tracker ─────────────────────────────────────────────────────────
class BlunderTracker {
  constructor() {
    this.reset();
  }

  reset() {
    this.blundersUsed = 0;
    this.target = 2 + Math.floor(Math.random() * 2); // 2–3 per game
    this.scheduledMoves = new Set();
    this.totalMoves = 0;
  }

  // Returns true if this move should be a blunder
  shouldBlunder(mode) {
    if (mode !== 'legit') return false;
    if (this.blundersUsed >= this.target) return false;
    // Don't blunder in first 5 or last 5 estimated moves
    if (this.totalMoves < 5) return false;

    const blundersLeft = this.target - this.blundersUsed;
    // Rising probability as game goes on
    const p = blundersLeft / Math.max(10, 25 - this.totalMoves);
    return Math.random() < p;
  }

  recordMove(wasBlunder) {
    this.totalMoves++;
    if (wasBlunder) this.blundersUsed++;
  }
}

// ─── Board reader ─────────────────────────────────────────────────────────────
class BoardReader {
  // Returns the chess-board element or null
  getBoard() {
    return document.querySelector('chess-board') ||
           document.querySelector('wc-chess-board') ||
           document.querySelector('[class*="board-layout"]');
  }

  // Determines which color the user is playing
  // Returns 'white' | 'black' | null
  detectMyColor(override) {
    if (override && override !== 'auto') return override;

    const board = this.getBoard();
    if (!board) return null;

    // chess.com sets flipped class/attribute when playing as black
    if (board.classList.contains('flipped')) return 'black';
    if (board.hasAttribute('flipped')) return 'black';

    // Check board orientation via perspective attribute
    const orientation = board.getAttribute('orientation');
    if (orientation === 'black') return 'black';
    if (orientation === 'white') return 'white';

    // Fallback: check which player panel is at the bottom
    const bottomPlayer = document.querySelector(
      '.board-layout-player-bottom .user-tagline-username, ' +
      '[class*="playerBottom"] [class*="username"], ' +
      '.player-component-bottom [class*="username"]'
    );
    // If we can't determine, check player component positions
    const playerComps = document.querySelectorAll('[class*="player-component"]');
    // The bottom component contains the user's info
    // chess.com usually shows the logged-in user at bottom

    return 'white'; // safe default
  }

  // Build FEN position string from DOM pieces
  buildFenPosition() {
    const board = this.getBoard();
    if (!board) return null;

    const grid = Array.from({ length: 8 }, () => Array(8).fill('.'));

    // Piece divs: class contains "piece {color}{type} square-{file}{rank}"
    const pieces = board.querySelectorAll('[class*="piece "], [class*=" piece"]');

    for (const el of pieces) {
      const cls = el.className || '';

      // Extract square number from "square-XY"
      const sqMatch = cls.match(/square-(\d)(\d)/);
      if (!sqMatch) continue;

      const file = parseInt(sqMatch[1]) - 1; // 0=a … 7=h
      const rank = parseInt(sqMatch[2]) - 1; // 0=rank1 … 7=rank8

      if (file < 0 || file > 7 || rank < 0 || rank > 7) continue;

      // Extract piece: "wp" "bn" etc.
      const pcMatch = cls.match(/\b([wb])([pnbrqk])\b/i);
      if (!pcMatch) continue;

      const color = pcMatch[1].toLowerCase();
      const type  = pcMatch[2].toLowerCase();

      let ch = type.toUpperCase();
      if (color === 'b') ch = type.toLowerCase();

      // FEN: rank 8 at top → grid[7-rank][file]
      grid[7 - rank][file] = ch;
    }

    // Build FEN position string
    return grid.map(row => {
      let s = '';
      let empty = 0;
      for (const cell of row) {
        if (cell === '.') { empty++; }
        else {
          if (empty) { s += empty; empty = 0; }
          s += cell;
        }
      }
      if (empty) s += empty;
      return s;
    }).join('/');
  }

  // Determine whose turn it is
  // Returns 'w' | 'b' | null
  detectTurn() {
    // Try move count from move list (even = white to move)
    const movePairs = document.querySelectorAll(
      '.move-list-row, [class*="moveList"] [class*="row"], .move-row'
    );

    // Another approach: count total half-moves (ply)
    const halfMoves = document.querySelectorAll(
      '.node.selected ~ .node, ' +
      '[class*="move"][class*="selected"] ~ [class*="move"]'
    );

    // Most reliable: check if there's a visual turn indicator
    const turnIndicator = document.querySelector('[class*="turn"][class*="white"], [class*="to-move-white"]');
    if (turnIndicator) return 'w';
    const turnBlack = document.querySelector('[class*="turn"][class*="black"], [class*="to-move-black"]');
    if (turnBlack) return 'b';

    // Count moves in the move list
    const allMoves = document.querySelectorAll(
      '.node, [class*="PGNMove"], [class*="pgn-move"], .move'
    );
    // Odd count → black to move, even → white to move
    if (allMoves.length > 0) {
      return allMoves.length % 2 === 0 ? 'w' : 'b';
    }

    return 'w'; // default: white starts
  }

  // Build full FEN string
  buildFen() {
    const position = this.buildFenPosition();
    if (!position) return null;

    const turn = this.detectTurn();

    // We don't track castling rights from DOM — use defaults for analysis
    // (this means analysis might miss castling but is correct for most positions)
    return `${position} ${turn} KQkq - 0 1`;
  }

  // Read clock time for a color — returns ms remaining or -1
  readClock(color) {
    const selectors = [
      `.clock-component.clock-${color} .clock-time-monospace`,
      `.clock-${color} .time`,
      `[class*="clock"][class*="${color}"] [class*="time"]`,
      `.player-component-${color} [class*="clock"]`,
      `[data-player-side="${color}"] [class*="time"]`,
    ];

    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const text = el.textContent.trim();
        const ms = parseTimeToMs(text);
        if (ms >= 0) return ms;
      }
    }

    // Try all clock elements, pick by position (bottom = player's clock)
    const allClocks = document.querySelectorAll('[class*="clock-time"]');
    for (const cl of allClocks) {
      const text = cl.textContent.trim();
      const ms = parseTimeToMs(text);
      if (ms >= 0) return ms;
    }

    return -1;
  }

  // Read opponent's ELO rating — returns number or 0
  readOpponentRating(myColor) {
    const opponentSide = myColor === 'white' ? 'black' : 'white';

    const selectors = [
      `.player-component-${opponentSide} .user-tagline-rating`,
      `[class*="player"][class*="${opponentSide}"] [class*="rating"]`,
      `.opponent-rating`,
      `[class*="tagline"] [class*="rating"]`,
    ];

    for (const sel of selectors) {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        const text = el.textContent.trim().replace(/[()]/g, '');
        const rating = parseInt(text);
        if (rating > 0 && rating < 4000) return rating;
      }
    }

    // Try to find any rating number near opponent username
    const ratingEls = document.querySelectorAll('[class*="rating"]');
    for (const el of ratingEls) {
      const text = el.textContent.trim().replace(/[()]/g, '');
      const rating = parseInt(text);
      if (rating >= 100 && rating <= 3500) return rating;
    }

    return 1200; // fallback: treat as average
  }
}

// Parse "5:00", "0:05.3", "1:23.4" → ms
function parseTimeToMs(text) {
  const m = text.match(/^(\d+):(\d+)(?:\.(\d))?$/);
  if (!m) return -1;
  const mins = parseInt(m[1]);
  const secs = parseInt(m[2]);
  const tenth = m[3] ? parseInt(m[3]) * 100 : 0;
  return (mins * 60 + secs) * 1000 + tenth;
}

// UCI move "e2e4" → { from: "e2", to: "e4" }
function parseUciMove(uci) {
  if (!uci || uci.length < 4) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promo: uci[4] || null };
}

// "e4" → { file: 4 (1-indexed), rank: 4 }
function algebraicToCoords(square) {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0) + 1; // 1–8
  const rank  = parseInt(square[1]); // 1–8
  return { file, rank };
}

// ─── Overlay renderer ─────────────────────────────────────────────────────────
class OverlayRenderer {
  constructor() {
    this.svg = null;
    this.boardEl = null;
  }

  // Colors for move rankings
  static COLORS = {
    0: { stroke: '#22c55e', fill: '#22c55e', opacity: 0.85 }, // green - best
    1: { stroke: '#eab308', fill: '#eab308', opacity: 0.80 }, // yellow - 2nd
    2: { stroke: '#f97316', fill: '#f97316', opacity: 0.75 }, // orange - 3rd
    blunder: { stroke: '#ef4444', fill: '#ef4444', opacity: 0.80 }, // red
  };

  mount(boardEl) {
    this.boardEl = boardEl;
    this.removeSvg();

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'chessx-overlay';
    svg.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      pointer-events: none;
      z-index: 9999;
      overflow: visible;
    `;

    // Arrow marker defs
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    ['green', 'yellow', 'orange', 'red'].forEach((name, i) => {
      const colors = [OverlayRenderer.COLORS[0], OverlayRenderer.COLORS[1],
                      OverlayRenderer.COLORS[2], OverlayRenderer.COLORS.blunder];
      defs.appendChild(this._makeMarker(`chessx-arrow-${name}`, colors[i].stroke));
    });
    svg.appendChild(defs);

    // Ensure board has relative positioning for absolute overlay
    const boardStyle = window.getComputedStyle(boardEl);
    if (boardStyle.position === 'static') boardEl.style.position = 'relative';

    boardEl.appendChild(svg);
    this.svg = svg;
  }

  _makeMarker(id, color) {
    const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    marker.setAttribute('id', id);
    marker.setAttribute('markerWidth', '4');
    marker.setAttribute('markerHeight', '4');
    marker.setAttribute('refX', '2');
    marker.setAttribute('refY', '2');
    marker.setAttribute('orient', 'auto');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M 0 0 L 4 2 L 0 4 z');
    path.setAttribute('fill', color);
    marker.appendChild(path);
    return marker;
  }

  removeSvg() {
    const old = document.getElementById('chessx-overlay');
    if (old) old.remove();
    this.svg = null;
  }

  // Draw analysis results on board
  // moves: [{ from, to, rank }] where rank 0=best
  // isFlipped: board orientation
  // suggestedIdx: which move is "suggested" (highlighted move)
  // isBlunder: if the suggested move is an intentional blunder
  render(moves, isFlipped, suggestedIdx, isBlunder = false) {
    if (!this.svg || !this.boardEl) return;

    // Clear previous arrows
    while (this.svg.lastChild && this.svg.lastChild.tagName !== 'defs') {
      this.svg.removeChild(this.svg.lastChild);
    }

    const rect = this.boardEl.getBoundingClientRect();
    const sq = rect.width / 8;

    moves.forEach((move, idx) => {
      if (!move || !move.from || !move.to) return;

      const isSelected = idx === suggestedIdx;
      let colorKey = idx;
      if (isSelected && isBlunder) colorKey = 'blunder';

      const colorScheme = OverlayRenderer.COLORS[colorKey] || OverlayRenderer.COLORS[2];

      const from = algebraicToCoords(move.from);
      const to   = algebraicToCoords(move.to);

      // Convert chess coords to SVG pixel coords
      const fFile = isFlipped ? (9 - from.file) : from.file;
      const fRank = isFlipped ? from.rank : (9 - from.rank);
      const tFile = isFlipped ? (9 - to.file) : to.file;
      const tRank = isFlipped ? to.rank : (9 - to.rank);

      const x1 = (fFile - 0.5) * sq;
      const y1 = (fRank - 0.5) * sq;
      const x2 = (tFile - 0.5) * sq;
      const y2 = (tRank - 0.5) * sq;

      // Draw "from" circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x1);
      circle.setAttribute('cy', y1);
      circle.setAttribute('r', sq * 0.42);
      circle.setAttribute('fill', colorScheme.fill);
      circle.setAttribute('fill-opacity', colorScheme.opacity * (isSelected ? 1 : 0.5));
      circle.setAttribute('stroke', 'none');
      this.svg.appendChild(circle);

      // Draw arrow line
      const markerNames = ['green', 'yellow', 'orange', 'red'];
      const markerName = isSelected && isBlunder ? 'red' : markerNames[colorKey] || 'orange';

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', colorScheme.stroke);
      line.setAttribute('stroke-width', isSelected ? sq * 0.14 : sq * 0.09);
      line.setAttribute('stroke-opacity', colorScheme.opacity * (isSelected ? 1 : 0.55));
      line.setAttribute('marker-end', `url(#chessx-arrow-${markerName})`);
      this.svg.appendChild(line);

      // Label rank on arrow
      if (moves.length > 1) {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2;
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', mx);
        text.setAttribute('y', my);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('font-size', sq * 0.22);
        text.setAttribute('font-weight', 'bold');
        text.setAttribute('fill', 'white');
        text.setAttribute('fill-opacity', '0.9');
        text.textContent = idx + 1;
        this.svg.appendChild(text);
      }
    });
  }

  clear() {
    if (!this.svg) return;
    while (this.svg.lastChild && this.svg.lastChild.tagName !== 'defs') {
      this.svg.removeChild(this.svg.lastChild);
    }
  }
}

// ─── Info panel ───────────────────────────────────────────────────────────────
class InfoPanel {
  constructor() {
    this.el = null;
  }

  mount() {
    this.remove();
    const panel = document.createElement('div');
    panel.id = 'chessx-panel';
    panel.style.cssText = `
      position: fixed;
      top: 80px;
      right: 16px;
      width: 220px;
      background: rgba(18, 18, 20, 0.92);
      color: #e2e8f0;
      border: 1px solid #334155;
      border-radius: 10px;
      padding: 12px 14px;
      font-family: 'Segoe UI', system-ui, sans-serif;
      font-size: 12px;
      z-index: 999999;
      box-shadow: 0 4px 24px rgba(0,0,0,0.5);
      user-select: none;
      line-height: 1.6;
    `;
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:13px;font-weight:700;color:#818cf8">ChessX</span>
        <span id="chessx-status" style="font-size:10px;color:#64748b">initializing…</span>
      </div>
      <div id="chessx-info" style="color:#94a3b8">waiting for game…</div>
    `;
    document.body.appendChild(panel);
    this.el = panel;
  }

  update(data) {
    if (!this.el) return;
    const status = this.el.querySelector('#chessx-status');
    const info   = this.el.querySelector('#chessx-info');
    if (status) status.textContent = data.status || '';
    if (info)   info.innerHTML     = data.html   || '';
  }

  remove() {
    const old = document.getElementById('chessx-panel');
    if (old) old.remove();
    this.el = null;
  }
}

// ─── Stockfish engine wrapper ─────────────────────────────────────────────────
// stockfish.js (nmrugg/chess.com build) sets up its own onmessage/postMessage
// UCI loop when loaded as a Worker — communicate with plain string messages.
class EngineWrapper {
  constructor() {
    this.worker = null;
    this.ready  = false;
    this.currentMoves  = [];
    this.onResult = null; // callback(moves[])
  }

  init() {
    if (this.worker) return;

    try {
      this.worker = new Worker(chrome.runtime.getURL('stockfish.js'));
    } catch (e) {
      console.error('[ChessX] Worker init failed:', e);
      return;
    }

    this.worker.onmessage = (e) => this._handleLine(e.data);
    this.worker.onerror   = (e) => console.error('[ChessX] Worker error:', e.message);

    // Boot UCI handshake
    this.worker.postMessage('uci');
    this.worker.postMessage('isready');
  }

  _handleLine(line) {
    if (typeof line !== 'string') return;

    if (line === 'readyok') {
      this.ready = true;
      return;
    }

    // Parse multipv info lines: "info depth 15 multipv 1 ... pv e2e4 ..."
    const pvMatch = line.match(/multipv (\d+).*? pv (\S+)/);
    if (pvMatch) {
      const idx  = parseInt(pvMatch[1]) - 1; // 0-indexed
      const move = pvMatch[2];
      this.currentMoves[idx] = parseUciMove(move);
    }

    // bestmove signals analysis complete for this position
    if (line.startsWith('bestmove')) {
      const moves = this.currentMoves.filter(Boolean);
      if (this.onResult && moves.length > 0) {
        this.onResult([...moves]);
      }
      this.currentMoves = [];
    }
  }

  analyze(fen, depth = 15, multiPV = 3) {
    if (!this.worker) return;
    this.currentMoves = [];
    this.worker.postMessage('stop');
    this.worker.postMessage(`setoption name MultiPV value ${multiPV}`);
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth}`);
  }

  stop() {
    if (this.worker) this.worker.postMessage('stop');
  }

  newGame() {
    if (this.worker) {
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage('isready');
    }
    this.currentMoves = [];
  }

  destroy() {
    if (this.worker) {
      this.worker.postMessage('quit');
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
  }
}

// ─── Main controller ──────────────────────────────────────────────────────────
class ChessX {
  constructor() {
    this.settings    = { ...DEFAULT_SETTINGS };
    this.boardReader = new BoardReader();
    this.overlay     = new OverlayRenderer();
    this.panel       = new InfoPanel();
    this.engine      = new EngineWrapper();
    this.blunders    = new BlunderTracker();

    this.lastFen     = null;
    this.myColor     = null;
    this.moveCount   = 0;
    this.bestMoves   = [];
    this.suggestedIdx = 0;
    this.isBlunder   = false;
    this.thinkMs     = 0;

    this.pollId      = null;
    this.mounted     = false;
  }

  async loadSettings() {
    return new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (s) => {
        if (s) this.settings = { ...DEFAULT_SETTINGS, ...s };
        resolve();
      });
    });
  }

  async start() {
    await this.loadSettings();
    if (!this.settings.enabled) return;

    this.engine.init();
    this.engine.onResult = (moves) => this._onEngineResult(moves);

    this.panel.mount();
    this.panel.update({ status: 'ready', html: 'Waiting for board…' });

    this._mountOverlay();
    this._startPolling();

    // Listen for settings changes from popup
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'SETTINGS_UPDATED') {
        this.settings = { ...DEFAULT_SETTINGS, ...msg.settings };
        this._onSettingsChange();
      }
    });
  }

  _mountOverlay() {
    const board = this.boardReader.getBoard();
    if (board && !this.mounted) {
      this.overlay.mount(board);
      this.mounted = true;
    }
  }

  _startPolling() {
    if (this.pollId) clearInterval(this.pollId);
    // Poll board state every 400ms
    this.pollId = setInterval(() => this._tick(), 400);
  }

  _tick() {
    if (!this.settings.enabled) return;

    // Re-mount overlay if board was replaced (e.g. game restart)
    this._mountOverlay();

    const fen = this.boardReader.buildFen();
    if (!fen || fen === this.lastFen) return;

    this.lastFen = fen;
    this.moveCount++;

    // Detect my color
    this.myColor = this.boardReader.detectMyColor(this.settings.colorOverride);

    // Check if it's my turn
    const turn = fen.split(' ')[1]; // 'w' or 'b'
    const myTurn = (this.myColor === 'white' && turn === 'w') ||
                   (this.myColor === 'black' && turn === 'b');

    if (!myTurn) {
      this.overlay.clear();
      this.panel.update({
        status: 'waiting',
        html: `<b>Opponent's turn</b><br>Color: ${this.myColor || '?'}`
      });
      return;
    }

    // Start analysis
    const opponentElo = this.boardReader.readOpponentRating(this.myColor);
    const clockMs     = this.boardReader.readClock(this.myColor);
    this.thinkMs      = getThinkTime(this.moveCount, clockMs, this.settings.mode);

    this.panel.update({
      status: 'analyzing…',
      html: `
        Mode: <b>${this.settings.mode}</b><br>
        Color: <b>${this.myColor}</b><br>
        Opp ELO: <b>${opponentElo}</b><br>
        Clock: <b>${clockMs >= 0 ? (clockMs / 1000).toFixed(1) + 's' : '?'}</b><br>
        Think: <b>${(this.thinkMs / 1000).toFixed(1)}s</b>
      `
    });

    this.engine.analyze(fen, this.settings.depth, 3);
  }

  _onEngineResult(moves) {
    this.bestMoves = moves;

    const opponentElo = this.boardReader.readOpponentRating(this.myColor);
    const weights     = getEloWeights(opponentElo, this.settings.mode);

    // Decide blunder
    this.isBlunder = this.blunders.shouldBlunder(this.settings.mode);

    if (this.settings.mode === 'manual') {
      // Show all moves, no highlight
      this.suggestedIdx = -1;
    } else if (this.isBlunder && moves.length > 1) {
      // Pick worst move (last in list)
      this.suggestedIdx = moves.length - 1;
    } else {
      // Pick based on ELO weights — only among available moves
      const available = Math.min(moves.length, weights.length);
      const slicedWeights = weights.slice(0, available);
      const total = slicedWeights.reduce((a, b) => a + b, 0);
      const norm  = slicedWeights.map(w => w / total);
      this.suggestedIdx = pickMoveIndex(norm);
    }

    this.blunders.recordMove(this.isBlunder);

    const isFlipped = this.myColor === 'black';
    this.overlay.render(moves, isFlipped, this.suggestedIdx, this.isBlunder);

    const suggested = moves[this.suggestedIdx];
    const moveStr   = suggested
      ? `<b style="color:${this.isBlunder ? '#f87171' : '#86efac'}">${suggested.from}→${suggested.to}</b>${this.isBlunder ? ' ⚠ blunder' : ''}`
      : '—';

    this.panel.update({
      status: 'ready',
      html: `
        Mode: <b>${this.settings.mode}</b><br>
        Color: <b>${this.myColor}</b><br>
        Suggested: ${moveStr}<br>
        Think: <b>${(this.thinkMs / 1000).toFixed(1)}s</b><br>
        Opp ELO: <b>${this.boardReader.readOpponentRating(this.myColor)}</b>
        ${moves.map((m, i) =>
          `<br><span style="color:${['#86efac','#fde047','#fb923c'][i] || '#94a3b8'}">${i + 1}. ${m.from}→${m.to}</span>`
        ).join('')}
      `
    });
  }

  _onSettingsChange() {
    // Reset blunder tracker on mode change
    if (this.settings.mode === 'legit') this.blunders.reset();
    this.engine.newGame();
    this.lastFen = null; // force re-analysis
  }

  stop() {
    if (this.pollId) { clearInterval(this.pollId); this.pollId = null; }
    this.engine.stop();
    this.overlay.removeSvg();
    this.panel.remove();
    this.mounted = false;
  }
}

// ─── Bootstrap ───────────────────────────────────────────────────────────────
let instance = null;

function bootstrap() {
  if (instance) instance.stop();
  instance = new ChessX();
  instance.start();
}

// Wait for chess.com board to load
function waitForBoard(cb, maxTries = 20) {
  let tries = 0;
  const id = setInterval(() => {
    tries++;
    if (document.querySelector('chess-board, wc-chess-board') || tries > maxTries) {
      clearInterval(id);
      cb();
    }
  }, 500);
}

waitForBoard(bootstrap);

// Handle SPA navigation — chess.com is a React SPA
let lastPath = location.pathname;
setInterval(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    setTimeout(() => waitForBoard(bootstrap), 1000);
  }
}, 1000);
