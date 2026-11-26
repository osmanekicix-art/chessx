// ChessX — chess.com analysis overlay
// Runs as a content script on chess.com game pages

const CHESSX_VERSION = '1.0.0';

// ─── Default settings ───────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  mode: 'legit',      // legit | semi | rage | manual
  colorOverride: 'auto', // auto | white | black
  depth: 15,
  engineElo: 3200,    // 800–3200; 3200 = full strength (no limit)
  enabled: true,
};

// ─── ELO weight tables ───────────────────────────────────────────────────────
// Returns [w1, w2, w3] for move1/move2/move3 probability weights
// elo = engine ELO slider value (your playing level)
function getEloWeights(elo, mode) {
  if (mode === 'rage') return [1.0, 0.0, 0.0];
  if (mode === 'manual') return [0.33, 0.33, 0.34];

  let w1, w2, w3;
  if      (elo >= 3200) { w1 = 1.00; w2 = 0.00; w3 = 0.00; }
  else if (elo >= 2500) { w1 = 0.85; w2 = 0.12; w3 = 0.03; }
  else if (elo >= 2000) { w1 = 0.825; w2 = 0.14; w3 = 0.035; }
  else if (elo >= 1600) { w1 = 0.75; w2 = 0.19; w3 = 0.06; }
  else if (elo >= 1200) { w1 = 0.70; w2 = 0.20; w3 = 0.10; }
  else                  { w1 = 0.50; w2 = 0.33; w3 = 0.17; }

  if (mode === 'semi') {
    w1 = Math.min(w1 + 0.10, 1.0);
    const rem = 1 - w1;
    if (rem > 0 && (w2 + w3) > 0) {
      const ratio = w2 / (w2 + w3);
      w2 = rem * ratio;
      w3 = rem * (1 - ratio);
    } else {
      w2 = 0; w3 = 0;
    }
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
    return 400 + Math.random() * 400;
  }
  if (clockRemainingMs > 0 && clockRemainingMs < 30_000) {
    return 1000 + Math.random() * 1000;
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

  // Arrow colors by semantic role
  static COLORS = {
    best:    { stroke: '#312e81', fill: '#312e81', opacity: 0.92 }, // near-black — engine best
    elo:     { stroke: '#22c55e', fill: '#22c55e', opacity: 0.88 }, // green — ELO-weighted pick
    weak:    { stroke: '#f97316', fill: '#f97316', opacity: 0.80 }, // orange — opponent -200 ELO
    blunder: { stroke: '#ef4444', fill: '#ef4444', opacity: 0.85 }, // red — intentional blunder
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
    ['best', 'elo', 'weak', 'blunder'].forEach(name => {
      defs.appendChild(this._makeMarker(`chessx-arrow-${name}`, OverlayRenderer.COLORS[name].stroke));
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

  // Draw the three semantic arrows.
  // bestMove  — engine's #1 (black)
  // eloMove   — ELO-weighted pick (green); may equal bestMove, still drawn
  // weakMove  — opponent -200 ELO suggestion (orange); may equal bestMove, still drawn
  // isBlunder — eloMove is an intentional blunder → swap green for red
  render({ bestMove, eloMove, weakMove, isFlipped, isBlunder = false }) {
    if (!this.svg || !this.boardEl) return;

    while (this.svg.lastChild && this.svg.lastChild.tagName !== 'defs') {
      this.svg.removeChild(this.svg.lastChild);
    }

    const rect = this.boardEl.getBoundingClientRect();
    const sq   = rect.width / 8;

    // Draw order: weak first (bottom), best second, elo on top
    const layers = [
      { move: weakMove,  key: 'weak',    width: 0.09, label: '±' },
      { move: bestMove,  key: 'best',    width: 0.11, label: '1' },
      { move: eloMove,   key: isBlunder ? 'blunder' : 'elo', width: 0.13, label: isBlunder ? '!' : '→' },
    ];

    for (const { move, key, width, label } of layers) {
      if (!move?.from || !move?.to) continue;

      const C    = OverlayRenderer.COLORS[key];
      const from = algebraicToCoords(move.from);
      const to   = algebraicToCoords(move.to);

      const fFile = isFlipped ? (9 - from.file) : from.file;
      const fRank = isFlipped ? from.rank : (9 - from.rank);
      const tFile = isFlipped ? (9 - to.file) : to.file;
      const tRank = isFlipped ? to.rank : (9 - to.rank);

      const x1 = (fFile - 0.5) * sq;
      const y1 = (fRank - 0.5) * sq;
      const x2 = (tFile - 0.5) * sq;
      const y2 = (tRank - 0.5) * sq;

      // "from" highlight circle
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x1);
      circle.setAttribute('cy', y1);
      circle.setAttribute('r', sq * 0.38);
      circle.setAttribute('fill', C.fill);
      circle.setAttribute('fill-opacity', C.opacity * 0.55);
      this.svg.appendChild(circle);

      // Arrow shaft
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1);
      line.setAttribute('y1', y1);
      line.setAttribute('x2', x2);
      line.setAttribute('y2', y2);
      line.setAttribute('stroke', C.stroke);
      line.setAttribute('stroke-width', sq * width);
      line.setAttribute('stroke-opacity', C.opacity);
      line.setAttribute('marker-end', `url(#chessx-arrow-${key})`);
      this.svg.appendChild(line);

      // Label near midpoint
      const mx = (x1 * 0.4 + x2 * 0.6);
      const my = (y1 * 0.4 + y2 * 0.6);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', mx);
      txt.setAttribute('y', my);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('dominant-baseline', 'central');
      txt.setAttribute('font-size', sq * 0.20);
      txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('fill', 'white');
      txt.setAttribute('fill-opacity', '0.95');
      txt.textContent = label;
      this.svg.appendChild(txt);
    }
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

    // Inject pulse keyframe once
    if (!document.getElementById('chessx-anim')) {
      const style = document.createElement('style');
      style.id = 'chessx-anim';
      style.textContent = `
        @keyframes chessx-pulse {
          0%,100% { opacity:1; transform:scale(1); }
          50%      { opacity:0.75; transform:scale(1.03); }
        }
        .chessx-playnow { animation: chessx-pulse 0.75s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }
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
// Two-phase analysis:
//   Phase 'main' — MultiPV 3, full strength → onResult([move0, move1, move2])
//   Phase 'weak' — MultiPV 1, UCI_LimitStrength at (opponentElo-200) → onWeakResult(move)
class EngineWrapper {
  constructor() {
    this.worker       = null;
    this.ready        = false;
    this.phase        = null;   // 'main' | 'weak' | null
    this.currentMoves = [];
    this.onResult     = null;   // callback(moves[])
    this.onWeakResult = null;   // callback(move)
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
    this.worker.postMessage('uci');
    this.worker.postMessage('isready');
  }

  _handleLine(line) {
    if (typeof line !== 'string') return;

    if (line === 'readyok') { this.ready = true; return; }

    if (this.phase === 'main') {
      const pvMatch = line.match(/multipv (\d+).*? pv (\S+)/);
      if (pvMatch) {
        const idx = parseInt(pvMatch[1]) - 1;
        this.currentMoves[idx] = parseUciMove(pvMatch[2]);
      }
      if (line.startsWith('bestmove')) {
        const moves = this.currentMoves.filter(Boolean);
        this.phase = null;
        this.currentMoves = [];
        if (this.onResult && moves.length > 0) this.onResult([...moves]);
      }
    } else if (this.phase === 'weak') {
      // Single PV — grab first pv move
      const pvMatch = line.match(/\bpv (\S+)/);
      if (pvMatch && !this.currentMoves[0]) {
        this.currentMoves[0] = parseUciMove(pvMatch[1]);
      }
      if (line.startsWith('bestmove')) {
        const move = this.currentMoves[0] || null;
        this.phase = null;
        this.currentMoves = [];
        // Restore full-strength for next main analysis
        this.worker.postMessage('setoption name UCI_LimitStrength value false');
        this.worker.postMessage('setoption name MultiPV value 3');
        if (this.onWeakResult) this.onWeakResult(move);
      }
    }
  }

  // Phase 1 — main analysis, top 3 moves (full strength or limited by engineElo)
  analyze(fen, depth = 15, engineElo = 3200) {
    if (!this.worker) return;
    this.phase = 'main';
    this.currentMoves = [];
    this.worker.postMessage('stop');
    if (engineElo < 3200) {
      this.worker.postMessage('setoption name UCI_LimitStrength value true');
      this.worker.postMessage(`setoption name UCI_Elo value ${Math.max(100, Math.min(3190, engineElo))}`);
    } else {
      this.worker.postMessage('setoption name UCI_LimitStrength value false');
    }
    this.worker.postMessage('setoption name MultiPV value 3');
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth}`);
  }

  // Phase 2 — strength-limited, single best move at weakElo
  analyzeWeak(fen, weakElo, depth = 12) {
    if (!this.worker) return;
    const elo = Math.max(100, Math.min(3190, weakElo));
    this.phase = 'weak';
    this.currentMoves = [];
    this.worker.postMessage('stop');
    this.worker.postMessage('setoption name UCI_LimitStrength value true');
    this.worker.postMessage(`setoption name UCI_Elo value ${elo}`);
    this.worker.postMessage('setoption name MultiPV value 1');
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth}`);
  }

  stop() {
    if (this.worker) { this.worker.postMessage('stop'); this.phase = null; }
  }

  newGame() {
    if (this.worker) {
      this.worker.postMessage('stop');
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage('isready');
    }
    this.phase = null;
    this.currentMoves = [];
  }

  destroy() {
    if (this.worker) { this.worker.postMessage('quit'); this.worker.terminate(); this.worker = null; }
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
    this.opponentElo = 1200;

    this.lastFen      = null;
    this.myColor      = null;
    this.moveCount    = 0;
    this.pendingFen   = null; // FEN waiting for weak analysis
    this.bestMoves    = [];   // top 3 from main analysis
    this.eloMove      = null; // ELO-weighted pick
    this.weakMove     = null; // opponent -200 ELO pick
    this.isBlunder    = false;
    this.thinkMs      = 0;

    this.pollId      = null;
    this.mounted     = false;

    this.playNowTimer = null;
    this.showPlayNow  = false;
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
    this.engine.onResult     = (moves) => this._onEngineResult(moves);
    this.engine.onWeakResult = (move)  => this._onWeakResult(move);

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

    // Reset play-now state on every new position
    this.showPlayNow = false;
    if (this.playNowTimer) { clearTimeout(this.playNowTimer); this.playNowTimer = null; }

    // Detect my color
    const detected = this.boardReader.detectMyColor(this.settings.colorOverride);

    // If auto-detection failed and no override set, show prompt and stop
    if (!detected && this.settings.colorOverride === 'auto') {
      this.overlay.clear();
      this.panel.update({
        status: '⚠ renk?',
        html: `
          <b style="color:#fbbf24">Renk tespit edilemedi.</b><br>
          Popup'tan manuel seç:<br>
          <b>Beyaz</b> veya <b>Siyah</b>
        `
      });
      return;
    }

    this.myColor = detected || 'white';

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
    this.opponentElo = this.boardReader.readOpponentRating(this.myColor);
    const clockMs    = this.boardReader.readClock(this.myColor);
    this.thinkMs     = getThinkTime(this.moveCount, clockMs, this.settings.mode);
    this.pendingFen  = fen;

    this.panel.update({
      status: 'analyzing…',
      html: `
        Mode: <b>${this.settings.mode}</b><br>
        Color: <b>${this.myColor}</b><br>
        Opp ELO: <b>${this.opponentElo}</b><br>
        Clock: <b>${clockMs >= 0 ? (clockMs / 1000).toFixed(1) + 's' : '?'}</b><br>
        Think: <b>${(this.thinkMs / 1000).toFixed(1)}s</b>
      `
    });

    this.engine.analyze(fen, this.settings.depth, this.settings.engineElo || 3200);

    // After thinkMs, signal the player it's time to move
    this.playNowTimer = setTimeout(() => {
      this.showPlayNow = true;
      this._renderAll();
    }, this.thinkMs);
  }

  _onEngineResult(moves) {
    this.bestMoves = moves;

    // legit/semi weights shaped by engine ELO slider (your level), not opponent ELO
    const weights = getEloWeights(this.settings.engineElo || 3200, this.settings.mode);

    // Pick ELO-weighted move
    this.isBlunder = this.blunders.shouldBlunder(this.settings.mode);

    if (this.isBlunder && moves.length > 1) {
      this.eloMove = moves[moves.length - 1]; // worst available = intentional blunder
    } else if (this.settings.mode === 'rage') {
      this.eloMove = moves[1] || moves[0]; // h2 — second best
    } else {
      const available = Math.min(moves.length, weights.length);
      const slice = weights.slice(0, available);
      const total = slice.reduce((a, b) => a + b, 0);
      const norm  = slice.map(w => w / total);
      this.eloMove = moves[pickMoveIndex(norm)];
    }

    this.blunders.recordMove(this.isBlunder);

    // Phase 2 — rage: h3 = bestMoves[2] directly; others: weak analysis (opponent ELO - 200)
    if (this.settings.mode === 'rage') {
      this.weakMove = moves[2] || moves[1] || moves[0]; // h3 — third best
    } else {
      this.weakMove = null;
      if (this.pendingFen) {
        this.engine.analyzeWeak(this.pendingFen, this.opponentElo - 200);
      }
    }

    // Partial render with what we have (weakMove = null until phase 2 completes)
    this._renderAll();
  }

  _onWeakResult(move) {
    this.weakMove = move;
    this._renderAll();
  }

  _renderAll() {
    const isFlipped = this.myColor === 'black';
    this.overlay.render({
      bestMove: this.bestMoves[0] || null,
      eloMove:  this.eloMove,
      weakMove: this.weakMove,
      isFlipped,
      isBlunder: this.isBlunder,
    });

    const best = this.bestMoves[0];
    const elo  = this.eloMove;
    const weak = this.weakMove;

    const playNowBanner = this.showPlayNow ? `
      <div class="chessx-playnow" style="
        background:#14532d;
        border:1px solid #22c55e;
        border-radius:6px;
        padding:6px 10px;
        margin-bottom:8px;
        text-align:center;
        font-size:15px;
        font-weight:800;
        color:#4ade80;
        letter-spacing:1.5px;
      ">▶ ŞİMDİ OYNA</div>
    ` : '';

    this.panel.update({
      status: this.showPlayNow ? '▶ oyna!' : (weak ? 'ready' : 'weak…'),
      html: `
        ${playNowBanner}
        Mode: <b>${this.settings.mode}</b> · Color: <b>${this.myColor}</b><br>
        Think: <b>${(this.thinkMs / 1000).toFixed(1)}s</b> · Opp: <b>${this.opponentElo}</b><br>
        <span style="color:#818cf8">●</span> Best: <b>${best ? best.from + '→' + best.to : '…'}</b><br>
        <span style="color:#86efac">●</span> ELO pick: <b style="color:${this.isBlunder ? '#f87171' : '#86efac'}">${elo ? elo.from + '→' + elo.to : '…'}${this.isBlunder ? ' ⚠' : ''}</b><br>
        <span style="color:#fb923c">●</span> -200 ELO: <b>${weak ? weak.from + '→' + weak.to : '…'}</b>
      `
    });
  }

  _onSettingsChange() {
    // Full clean restart — flush all stale analysis state
    this.engine.stop();
    this.engine.newGame();

    if (this.playNowTimer) { clearTimeout(this.playNowTimer); this.playNowTimer = null; }
    this.showPlayNow = false;

    this.lastFen    = null;
    this.pendingFen = null;
    this.bestMoves  = [];
    this.eloMove    = null;
    this.weakMove   = null;
    this.isBlunder  = false;
    this.thinkMs    = 0;
    this.moveCount  = 0;

    if (this.settings.mode === 'legit') this.blunders.reset();

    this.overlay.clear();
    this.panel.update({ status: 'restarted', html: 'Engine restarted — waiting for board…' });
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
