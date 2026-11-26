// ChessX — chess.com analysis overlay
// Runs as a content script on chess.com game pages

const CHESSX_VERSION = '1.0.0';

// ─── Opening book ─────────────────────────────────────────────────────────────
// Key: FEN position part (piece placement only)
// Value: [{m: 'uci_move', w: weight}, ...]
const OPENING_BOOK = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR': [
    {m:'e2e4',w:35},{m:'d2d4',w:30},{m:'g1f3',w:15},{m:'c2c4',w:12},{m:'e2e3',w:4},{m:'b1c3',w:4}
  ],
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'e7e5',w:35},{m:'c7c5',w:30},{m:'e7e6',w:15},{m:'c7c6',w:10},{m:'d7d5',w:7},{m:'d7d6',w:3}
  ],
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR': [
    {m:'d7d5',w:30},{m:'g8f6',w:28},{m:'f7f5',w:12},{m:'e7e6',w:15},{m:'c7c5',w:15}
  ],
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR': [
    {m:'e7e5',w:25},{m:'c7c5',w:25},{m:'g8f6',w:28},{m:'e7e6',w:22}
  ],
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R': [
    {m:'d7d5',w:30},{m:'g8f6',w:25},{m:'c7c5',w:25},{m:'e7e6',w:20}
  ],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'g1f3',w:50},{m:'f1c4',w:20},{m:'b1c3',w:15},{m:'f2f4',w:10},{m:'d2d4',w:5}
  ],
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'g1f3',w:70},{m:'b1c3',w:15},{m:'c2c3',w:10},{m:'d2d4',w:5}
  ],
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'d2d4',w:80},{m:'g1f3',w:12},{m:'b1c3',w:8}
  ],
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'d2d4',w:80},{m:'g1f3',w:10},{m:'b1c3',w:10}
  ],
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'e4d5',w:80},{m:'b1c3',w:12},{m:'e4e5',w:8}
  ],
  'rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'d2d4',w:70},{m:'g1f3',w:20},{m:'b1c3',w:10}
  ],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'b8c6',w:60},{m:'g8f6',w:25},{m:'d7d6',w:10},{m:'f7f5',w:5}
  ],
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'d7d6',w:30},{m:'b8c6',w:25},{m:'e7e6',w:25},{m:'g8f6',w:20}
  ],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'f1b5',w:40},{m:'f1c4',w:35},{m:'d2d4',w:15},{m:'b1c3',w:10}
  ],
  'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'f1e2',w:40},{m:'d2d4',w:30},{m:'b1c3',w:20},{m:'f1c4',w:10}
  ],
  'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'d2d4',w:50},{m:'f1c4',w:30},{m:'b1c3',w:20}
  ],
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R': [
    {m:'a7a6',w:50},{m:'g8f6',w:25},{m:'f8c5',w:15},{m:'d7d6',w:10}
  ],
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R': [
    {m:'f8c5',w:50},{m:'g8f6',w:30},{m:'f8e7',w:15},{m:'d7d6',w:5}
  ],
  'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'d2d4',w:80},{m:'f1b5',w:12},{m:'c2c3',w:8}
  ],
  'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'d2d4',w:70},{m:'f1b5',w:20},{m:'f1c4',w:10}
  ],
  'rnbqkbnr/pp1p1ppp/4p3/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'d2d4',w:80},{m:'b1c3',w:12},{m:'f1b5',w:8}
  ],
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR': [
    {m:'c2c4',w:70},{m:'g1f3',w:20},{m:'e2e3',w:10}
  ],
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR': [
    {m:'c2c4',w:60},{m:'g1f3',w:25},{m:'e2e3',w:10},{m:'b1c3',w:5}
  ],
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'e7e6',w:40},{m:'c7c6',w:35},{m:'d5c4',w:15},{m:'e7e5',w:10}
  ],
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'b1c3',w:60},{m:'g1f3',w:25},{m:'c1f4',w:15}
  ],
  'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'g1f3',w:50},{m:'b1c3',w:30},{m:'e2e3',w:20}
  ],
  'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'e7e6',w:40},{m:'g7g6',w:35},{m:'c7c5',w:15},{m:'d7d5',w:10}
  ],
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'b1c3',w:50},{m:'g1f3',w:30},{m:'g2g3',w:20}
  ],
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'b1c3',w:60},{m:'g1f3',w:25},{m:'g2g3',w:15}
  ],
  'rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR': [
    {m:'b1c3',w:60},{m:'g1f3',w:25},{m:'g2g3',w:15}
  ],
  'rnbqkb1r/pppppppp/5n2/8/2P5/8/PP1PPPPP/RNBQKBNR': [
    {m:'b1c3',w:50},{m:'g1f3',w:30},{m:'g2g3',w:20}
  ],
  'rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKB1R': [
    {m:'d2d4',w:50},{m:'c2c4',w:35},{m:'g2g3',w:15}
  ],
  'rnbqkb1r/pppppppp/5n2/8/8/5N2/PPPPPPPP/RNBQKB1R': [
    {m:'d2d4',w:50},{m:'c2c4',w:35},{m:'g2g3',w:15}
  ],
};

const OPENING_NAMES = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR': 'Başlangıç',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR': '1.e4',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR': '1.d4',
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR': '1.c4 İngiliz',
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R': '1.Af3',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR': 'Açık Oyun',
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR': 'Sicilya',
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Fransız',
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Caro-Kann',
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR': 'İskandinav',
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R': 'Ruy Lopez',
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R': 'İtalyan',
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR': 'Vezir Gambiti',
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR': 'VGR',
  'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR': 'Slav',
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR': 'Hint Şahı',
};

// Time control scaling multipliers
const TIME_PRESETS = { bullet: 0.3, blitz: 1.0, rapid: 1.8 };

// ─── Default settings ─────────────────────────────────────────────────────────
const DEFAULT_SETTINGS = {
  mode:          'legit',
  colorOverride: 'auto',
  depth:         15,
  engineElo:     3200,
  enabled:       true,
  blunderCount:  2,       // intentional blunders per game (0–5)
  timePreset:    'blitz', // bullet | blitz | rapid
};

// ─── ELO weight tables ────────────────────────────────────────────────────────
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
    } else { w2 = 0; w3 = 0; }
  }
  return [w1, w2, w3];
}

function pickMoveIndex(weights) {
  const r = Math.random();
  if (r < weights[0]) return 0;
  if (r < weights[0] + weights[1]) return 1;
  return 2;
}

// ─── Log-normal timing ────────────────────────────────────────────────────────
function getThinkTime(moveNumber, clockRemainingMs, mode, timeMultiplier = 1.0) {
  if (mode === 'rage') return 300 + Math.random() * 400;

  if (clockRemainingMs > 0 && clockRemainingMs < 10_000) {
    return 400 + Math.random() * 400;
  }
  if (clockRemainingMs > 0 && clockRemainingMs < 30_000) {
    return 1000 + Math.random() * 1000;
  }

  let mu, sigma;
  if (moveNumber <= 10)      { mu = Math.log(1800); sigma = 0.4;  }
  else if (moveNumber <= 30) { mu = Math.log(7000); sigma = 0.55; }
  else                       { mu = Math.log(4000); sigma = 0.45; }

  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z  = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  const ms = Math.round(Math.exp(mu + sigma * z));
  return Math.max(500, Math.min(ms, 60_000)) * timeMultiplier;
}

// ─── Blunder tracker ──────────────────────────────────────────────────────────
class BlunderTracker {
  constructor() { this.reset(2); }

  reset(targetCount = 2) {
    this.blundersUsed = 0;
    this.target       = Math.max(0, Math.round(targetCount));
    this.totalMoves   = 0;
  }

  shouldBlunder(mode) {
    if (mode !== 'legit') return false;
    if (this.blundersUsed >= this.target) return false;
    if (this.totalMoves < 5) return false;
    const blundersLeft = this.target - this.blundersUsed;
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
  getBoard() {
    return document.querySelector('chess-board') ||
           document.querySelector('wc-chess-board') ||
           document.querySelector('[class*="board-layout"]');
  }

  detectMyColor(override) {
    if (override && override !== 'auto') return override;
    const board = this.getBoard();
    if (!board) return null;
    if (board.classList.contains('flipped')) return 'black';
    if (board.hasAttribute('flipped')) return 'black';
    const orientation = board.getAttribute('orientation');
    if (orientation === 'black') return 'black';
    if (orientation === 'white') return 'white';
    const bottomPlayer = document.querySelector(
      '.board-layout-player-bottom .user-tagline-username, ' +
      '[class*="playerBottom"] [class*="username"], ' +
      '.player-component-bottom [class*="username"]'
    );
    return 'white';
  }

  buildFenPosition() {
    const board = this.getBoard();
    if (!board) return null;
    const grid = Array.from({ length: 8 }, () => Array(8).fill('.'));
    const pieces = board.querySelectorAll('[class*="piece "], [class*=" piece"]');
    for (const el of pieces) {
      const cls = el.className || '';
      const sqMatch = cls.match(/square-(\d)(\d)/);
      if (!sqMatch) continue;
      const file = parseInt(sqMatch[1]) - 1;
      const rank = parseInt(sqMatch[2]) - 1;
      if (file < 0 || file > 7 || rank < 0 || rank > 7) continue;
      const pcMatch = cls.match(/\b([wb])([pnbrqk])\b/i);
      if (!pcMatch) continue;
      const color = pcMatch[1].toLowerCase();
      const type  = pcMatch[2].toLowerCase();
      let ch = type.toUpperCase();
      if (color === 'b') ch = type.toLowerCase();
      grid[7 - rank][file] = ch;
    }
    return grid.map(row => {
      let s = ''; let empty = 0;
      for (const cell of row) {
        if (cell === '.') { empty++; }
        else { if (empty) { s += empty; empty = 0; } s += cell; }
      }
      if (empty) s += empty;
      return s;
    }).join('/');
  }

  detectTurn() {
    const turnIndicator = document.querySelector('[class*="turn"][class*="white"], [class*="to-move-white"]');
    if (turnIndicator) return 'w';
    const turnBlack = document.querySelector('[class*="turn"][class*="black"], [class*="to-move-black"]');
    if (turnBlack) return 'b';
    const allMoves = document.querySelectorAll('.node, [class*="PGNMove"], [class*="pgn-move"], .move');
    if (allMoves.length > 0) return allMoves.length % 2 === 0 ? 'w' : 'b';
    return 'w';
  }

  buildFen() {
    const position = this.buildFenPosition();
    if (!position) return null;
    return `${position} ${this.detectTurn()} KQkq - 0 1`;
  }

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
      if (el) { const ms = parseTimeToMs(el.textContent.trim()); if (ms >= 0) return ms; }
    }
    const allClocks = document.querySelectorAll('[class*="clock-time"]');
    for (const cl of allClocks) {
      const ms = parseTimeToMs(cl.textContent.trim());
      if (ms >= 0) return ms;
    }
    return -1;
  }

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
        const rating = parseInt(el.textContent.trim().replace(/[()]/g, ''));
        if (rating > 0 && rating < 4000) return rating;
      }
    }
    const ratingEls = document.querySelectorAll('[class*="rating"]');
    for (const el of ratingEls) {
      const rating = parseInt(el.textContent.trim().replace(/[()]/g, ''));
      if (rating >= 100 && rating <= 3500) return rating;
    }
    return 1200;
  }
}

function parseTimeToMs(text) {
  const m = text.match(/^(\d+):(\d+)(?:\.(\d))?$/);
  if (!m) return -1;
  return (parseInt(m[1]) * 60 + parseInt(m[2])) * 1000 + (m[3] ? parseInt(m[3]) * 100 : 0);
}

function parseUciMove(uci) {
  if (!uci || uci.length < 4) return null;
  return { from: uci.slice(0, 2), to: uci.slice(2, 4), promo: uci[4] || null };
}

function algebraicToCoords(square) {
  return {
    file: square.charCodeAt(0) - 'a'.charCodeAt(0) + 1,
    rank: parseInt(square[1]),
  };
}

function formatScore(score) {
  if (score === undefined || score === null) return '';
  if (score >= 900) return '#';
  if (score <= -900) return '-#';
  const s = score.toFixed(1);
  return score > 0 ? `+${s}` : s;
}

// ─── Overlay renderer ─────────────────────────────────────────────────────────
class OverlayRenderer {
  constructor() { this.svg = null; this.boardEl = null; }

  static COLORS = {
    best:    { stroke: '#312e81', fill: '#312e81', opacity: 0.92 },
    elo:     { stroke: '#22c55e', fill: '#22c55e', opacity: 0.88 },
    weak:    { stroke: '#f97316', fill: '#f97316', opacity: 0.80 },
    blunder: { stroke: '#ef4444', fill: '#ef4444', opacity: 0.85 },
    book:    { stroke: '#06b6d4', fill: '#06b6d4', opacity: 0.90 },
  };

  mount(boardEl) {
    this.boardEl = boardEl;
    this.removeSvg();
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'chessx-overlay';
    svg.style.cssText = `position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;overflow:visible;`;
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    ['best', 'elo', 'weak', 'blunder', 'book'].forEach(name => {
      defs.appendChild(this._makeMarker(`chessx-arrow-${name}`, OverlayRenderer.COLORS[name].stroke));
    });
    svg.appendChild(defs);
    if (window.getComputedStyle(boardEl).position === 'static') boardEl.style.position = 'relative';
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

  render({ bestMove, eloMove, weakMove, isFlipped, isBlunder = false, isBook = false }) {
    if (!this.svg || !this.boardEl) return;
    while (this.svg.lastChild && this.svg.lastChild.tagName !== 'defs') this.svg.removeChild(this.svg.lastChild);

    const rect = this.boardEl.getBoundingClientRect();
    const sq   = rect.width / 8;

    const eloKey = isBook ? 'book' : (isBlunder ? 'blunder' : 'elo');
    const layers = [
      { move: weakMove, key: 'weak',   width: 0.09, label: '±' },
      { move: bestMove, key: 'best',   width: 0.11, label: '1' },
      { move: eloMove,  key: eloKey,   width: 0.13, label: isBook ? '📖' : (isBlunder ? '!' : '→') },
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
      const x1 = (fFile - 0.5) * sq, y1 = (fRank - 0.5) * sq;
      const x2 = (tFile - 0.5) * sq, y2 = (tRank - 0.5) * sq;

      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', x1); circle.setAttribute('cy', y1);
      circle.setAttribute('r', sq * 0.38);
      circle.setAttribute('fill', C.fill); circle.setAttribute('fill-opacity', C.opacity * 0.55);
      this.svg.appendChild(circle);

      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1); line.setAttribute('y1', y1);
      line.setAttribute('x2', x2); line.setAttribute('y2', y2);
      line.setAttribute('stroke', C.stroke);
      line.setAttribute('stroke-width', sq * width);
      line.setAttribute('stroke-opacity', C.opacity);
      line.setAttribute('marker-end', `url(#chessx-arrow-${key})`);
      this.svg.appendChild(line);

      const mx = (x1 * 0.4 + x2 * 0.6), my = (y1 * 0.4 + y2 * 0.6);
      const txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      txt.setAttribute('x', mx); txt.setAttribute('y', my);
      txt.setAttribute('text-anchor', 'middle'); txt.setAttribute('dominant-baseline', 'central');
      txt.setAttribute('font-size', sq * 0.20); txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('fill', 'white'); txt.setAttribute('fill-opacity', '0.95');
      txt.textContent = label;
      this.svg.appendChild(txt);
    }
  }

  clear() {
    if (!this.svg) return;
    while (this.svg.lastChild && this.svg.lastChild.tagName !== 'defs') this.svg.removeChild(this.svg.lastChild);
  }
}

// ─── Info panel ───────────────────────────────────────────────────────────────
class InfoPanel {
  constructor() { this.el = null; this._keyHandler = null; }

  mount() {
    this.remove();
    const panel = document.createElement('div');
    panel.id = 'chessx-panel';
    panel.style.cssText = `
      position:fixed;top:80px;right:16px;width:220px;
      background:rgba(18,18,20,0.92);color:#e2e8f0;
      border:1px solid #334155;border-radius:10px;
      padding:12px 14px;font-family:'Segoe UI',system-ui,sans-serif;
      font-size:12px;z-index:999999;box-shadow:0 4px 24px rgba(0,0,0,0.5);
      user-select:none;line-height:1.6;
    `;
    panel.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
        <span style="font-size:13px;font-weight:700;color:#818cf8">ChessX</span>
        <span id="chessx-status" style="font-size:10px;color:#64748b">initializing…</span>
      </div>
      <div id="chessx-info" style="color:#94a3b8">waiting for game…</div>
      <div style="margin-top:8px;font-size:9px;color:#1e293b;text-align:right">\ gizle/göster</div>
    `;
    document.body.appendChild(panel);
    this.el = panel;

    if (!document.getElementById('chessx-anim')) {
      const style = document.createElement('style');
      style.id = 'chessx-anim';
      style.textContent = `
        @keyframes chessx-pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.75;transform:scale(1.03)} }
        .chessx-playnow { animation:chessx-pulse 0.75s ease-in-out infinite; }
      `;
      document.head.appendChild(style);
    }

    this._keyHandler = (e) => {
      if ((e.key === '\\' || e.code === 'Backslash') && this.el) {
        this.el.style.display = this.el.style.display === 'none' ? 'block' : 'none';
      }
    };
    document.addEventListener('keydown', this._keyHandler);
  }

  update(data) {
    if (!this.el) return;
    const status = this.el.querySelector('#chessx-status');
    const info   = this.el.querySelector('#chessx-info');
    if (status) status.textContent = data.status || '';
    if (info)   info.innerHTML     = data.html   || '';
  }

  remove() {
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
      this._keyHandler = null;
    }
    const old = document.getElementById('chessx-panel');
    if (old) old.remove();
    this.el = null;
  }
}

// ─── Stockfish engine wrapper ─────────────────────────────────────────────────
class EngineWrapper {
  constructor() {
    this.worker       = null;
    this.ready        = false;
    this.phase        = null;
    this.currentMoves = [];
    this.onResult     = null;
    this.onWeakResult = null;
  }

  init() {
    if (this.worker) return;
    try { this.worker = new Worker(chrome.runtime.getURL('stockfish.js')); }
    catch (e) { console.error('[ChessX] Worker init failed:', e); return; }
    this.worker.onmessage = (e) => this._handleLine(e.data);
    this.worker.onerror   = (e) => console.error('[ChessX] Worker error:', e.message);
    this.worker.postMessage('uci');
    this.worker.postMessage('isready');
  }

  _handleLine(line) {
    if (typeof line !== 'string') return;
    if (line === 'readyok') { this.ready = true; return; }

    if (this.phase === 'main') {
      // Parse: multipv N ... score cp/mate M ... pv MOVE
      const pvMatch = line.match(/multipv (\d+).*?score (cp|mate) (-?\d+).*? pv (\S+)/);
      if (pvMatch) {
        const idx      = parseInt(pvMatch[1]) - 1;
        const scoreRaw = parseInt(pvMatch[3]);
        const score    = pvMatch[2] === 'cp' ? scoreRaw / 100 : (scoreRaw > 0 ? 999 : -999);
        const move     = parseUciMove(pvMatch[4]);
        if (move) this.currentMoves[idx] = { ...move, score };
      }
      if (line.startsWith('bestmove')) {
        const moves = this.currentMoves.filter(Boolean);
        this.phase = null; this.currentMoves = [];
        if (this.onResult && moves.length > 0) this.onResult([...moves]);
      }
    } else if (this.phase === 'weak') {
      const pvMatch = line.match(/\bpv (\S+)/);
      if (pvMatch && !this.currentMoves[0]) this.currentMoves[0] = parseUciMove(pvMatch[1]);
      if (line.startsWith('bestmove')) {
        const move = this.currentMoves[0] || null;
        this.phase = null; this.currentMoves = [];
        this.worker.postMessage('setoption name UCI_LimitStrength value false');
        this.worker.postMessage('setoption name MultiPV value 3');
        if (this.onWeakResult) this.onWeakResult(move);
      }
    }
  }

  analyze(fen, depth = 15, engineElo = 3200) {
    if (!this.worker) return;
    this.phase = 'main'; this.currentMoves = [];
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

  analyzeWeak(fen, weakElo, depth = 12) {
    if (!this.worker) return;
    const elo = Math.max(100, Math.min(3190, weakElo));
    this.phase = 'weak'; this.currentMoves = [];
    this.worker.postMessage('stop');
    this.worker.postMessage('setoption name UCI_LimitStrength value true');
    this.worker.postMessage(`setoption name UCI_Elo value ${elo}`);
    this.worker.postMessage('setoption name MultiPV value 1');
    this.worker.postMessage(`position fen ${fen}`);
    this.worker.postMessage(`go depth ${depth}`);
  }

  stop()    { if (this.worker) { this.worker.postMessage('stop'); this.phase = null; } }
  newGame() {
    if (this.worker) {
      this.worker.postMessage('stop');
      this.worker.postMessage('ucinewgame');
      this.worker.postMessage('isready');
    }
    this.phase = null; this.currentMoves = [];
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

    this.lastFen     = null;
    this.myColor     = null;
    this.moveCount   = 0;
    this.pendingFen  = null;
    this.bestMoves   = [];
    this.eloMove     = null;
    this.weakMove    = null;
    this.isBlunder   = false;
    this.isBook      = false;
    this.thinkMs     = 0;
    this.openingPhase     = true;
    this.currentOpening   = '';

    this.pollId      = null;
    this.mounted     = false;

    this.playNowTimer = null;
    this.showPlayNow  = false;
    this.soundPlayed  = false;
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
    chrome.runtime.onMessage.addListener((msg) => {
      if (msg.type === 'SETTINGS_UPDATED') {
        this.settings = { ...DEFAULT_SETTINGS, ...msg.settings };
        this._onSettingsChange();
      }
    });
  }

  _mountOverlay() {
    const board = this.boardReader.getBoard();
    if (board && !this.mounted) { this.overlay.mount(board); this.mounted = true; }
  }

  _startPolling() {
    if (this.pollId) clearInterval(this.pollId);
    this.pollId = setInterval(() => this._tick(), 400);
  }

  // Weighted random pick from opening book entries
  _checkOpeningBook(position) {
    const entries = OPENING_BOOK[position];
    if (!entries || entries.length === 0) return null;
    const total = entries.reduce((s, e) => s + e.w, 0);
    let r = Math.random() * total;
    for (const entry of entries) { r -= entry.w; if (r <= 0) return entry.m; }
    return entries[0].m;
  }

  _playSound() {
    try {
      const ctx  = new (window.AudioContext || window.webkitAudioContext)();
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = 'sine';
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.18);
    } catch (e) {}
  }

  _tick() {
    if (!this.settings.enabled) return;
    this._mountOverlay();

    const fen = this.boardReader.buildFen();
    if (!fen || fen === this.lastFen) return;
    this.lastFen = fen;
    this.moveCount++;

    this.showPlayNow = false;
    this.soundPlayed = false;
    if (this.playNowTimer) { clearTimeout(this.playNowTimer); this.playNowTimer = null; }

    const detected = this.boardReader.detectMyColor(this.settings.colorOverride);
    if (!detected && this.settings.colorOverride === 'auto') {
      this.overlay.clear();
      this.panel.update({
        status: '⚠ renk?',
        html: `<b style="color:#fbbf24">Renk tespit edilemedi.</b><br>Popup'tan manuel seç:<br><b>Beyaz</b> veya <b>Siyah</b>`
      });
      return;
    }
    this.myColor = detected || 'white';

    const turn   = fen.split(' ')[1];
    const myTurn = (this.myColor === 'white' && turn === 'w') || (this.myColor === 'black' && turn === 'b');
    if (!myTurn) {
      this.overlay.clear();
      this.panel.update({ status: 'waiting', html: `<b>Opponent's turn</b><br>Color: ${this.myColor || '?'}` });
      return;
    }

    this.opponentElo = this.boardReader.readOpponentRating(this.myColor);
    const clockMs   = this.boardReader.readClock(this.myColor);
    const mult      = TIME_PRESETS[this.settings.timePreset] || 1.0;
    this.thinkMs    = getThinkTime(this.moveCount, clockMs, this.settings.mode, mult);
    this.pendingFen = fen;

    // ── Opening book check ──────────────────────────────────────────────────
    const position = fen.split(' ')[0];
    if (this.openingPhase && this.moveCount <= 15) {
      const bookMoveUci = this._checkOpeningBook(position);
      const openingName = OPENING_NAMES[position] || '';
      if (bookMoveUci) {
        this.currentOpening = openingName;
        const move = parseUciMove(bookMoveUci);
        this.bestMoves  = [move];
        this.eloMove    = move;
        this.weakMove   = null;
        this.isBlunder  = false;
        this.isBook     = true;
        this.blunders.recordMove(false);
        this.panel.update({
          status: 'book',
          html: `
            ${openingName ? `<span style="color:#67e8f9;font-size:11px">📖 ${openingName}</span><br>` : ''}
            Mode: <b>${this.settings.mode}</b> · Color: <b>${this.myColor}</b><br>
            Think: <b>${(this.thinkMs/1000).toFixed(1)}s</b><br>
            <span style="color:#67e8f9">●</span> Kitap: <b style="color:#67e8f9">${move.from}→${move.to}</b>
          `
        });
        this._schedulePlayNow();
        this._renderAll();
        return;
      } else {
        this.openingPhase = false;
        this.isBook = false;
      }
    } else {
      this.isBook = false;
    }

    // ── Engine analysis ─────────────────────────────────────────────────────
    this.panel.update({
      status: 'analyzing…',
      html: `
        Mode: <b>${this.settings.mode}</b> · Color: <b>${this.myColor}</b><br>
        Opp ELO: <b>${this.opponentElo}</b> · Clock: <b>${clockMs >= 0 ? (clockMs/1000).toFixed(1)+'s' : '?'}</b><br>
        Think: <b>${(this.thinkMs/1000).toFixed(1)}s</b>
      `
    });
    this.engine.analyze(fen, this.settings.depth, this.settings.engineElo || 3200);
    this._schedulePlayNow();
  }

  _schedulePlayNow() {
    if (this.playNowTimer) { clearTimeout(this.playNowTimer); this.playNowTimer = null; }
    this.playNowTimer = setTimeout(() => {
      this.showPlayNow = true;
      this._renderAll();
    }, this.thinkMs);
  }

  _onEngineResult(moves) {
    this.bestMoves = moves;
    const weights  = getEloWeights(this.settings.engineElo || 3200, this.settings.mode);
    this.isBlunder = this.blunders.shouldBlunder(this.settings.mode);

    if (this.isBlunder && moves.length > 1) {
      this.eloMove = moves[moves.length - 1];
    } else if (this.settings.mode === 'rage') {
      this.eloMove = moves[1] || moves[0];
    } else {
      const available = Math.min(moves.length, weights.length);
      const slice = weights.slice(0, available);
      const total = slice.reduce((a, b) => a + b, 0);
      const norm  = slice.map(w => w / total);
      this.eloMove = moves[pickMoveIndex(norm)];
    }
    this.blunders.recordMove(this.isBlunder);

    if (this.settings.mode === 'rage') {
      this.weakMove = moves[2] || moves[1] || moves[0];
    } else {
      this.weakMove = null;
      if (this.pendingFen) this.engine.analyzeWeak(this.pendingFen, this.opponentElo - 200);
    }
    this._renderAll();
  }

  _onWeakResult(move) { this.weakMove = move; this._renderAll(); }

  _renderAll() {
    const isFlipped = this.myColor === 'black';
    this.overlay.render({
      bestMove: this.bestMoves[0] || null,
      eloMove:  this.eloMove,
      weakMove: this.weakMove,
      isFlipped,
      isBlunder: this.isBlunder,
      isBook:    this.isBook,
    });

    if (this.showPlayNow && !this.soundPlayed) {
      this._playSound();
      this.soundPlayed = true;
    }

    const best = this.bestMoves[0];
    const elo  = this.eloMove;
    const weak = this.weakMove;

    // Score display — from side-to-move perspective (positive = good for mover)
    const turn     = this.lastFen ? this.lastFen.split(' ')[1] : 'w';
    const scoreDir = turn === 'b' ? -1 : 1;
    const sc = (move) => move?.score !== undefined ? ` <span style="color:#64748b;font-size:10px">${formatScore(move.score * scoreDir)}</span>` : '';

    const playNowBanner = this.showPlayNow ? `
      <div class="chessx-playnow" style="
        background:#14532d;border:1px solid #22c55e;border-radius:6px;
        padding:6px 10px;margin-bottom:8px;text-align:center;
        font-size:15px;font-weight:800;color:#4ade80;letter-spacing:1.5px;
      ">▶ ŞİMDİ OYNA</div>
    ` : '';

    const bookLine = this.isBook
      ? `${this.currentOpening ? `<span style="color:#67e8f9;font-size:10px">📖 ${this.currentOpening}</span><br>` : ''}<span style="color:#67e8f9">●</span> Kitap: <b style="color:#67e8f9">${elo ? elo.from+'→'+elo.to : '…'}</b>`
      : `
        <span style="color:#818cf8">●</span> Best: <b>${best ? best.from+'→'+best.to : '…'}</b>${sc(best)}<br>
        <span style="color:#86efac">●</span> ELO pick: <b style="color:${this.isBlunder ? '#f87171' : '#86efac'}">${elo ? elo.from+'→'+elo.to : '…'}${this.isBlunder ? ' ⚠' : ''}</b>${sc(elo)}<br>
        <span style="color:#fb923c">●</span> -200 ELO: <b>${weak ? weak.from+'→'+weak.to : '…'}</b>${sc(weak)}
      `;

    this.panel.update({
      status: this.showPlayNow ? '▶ oyna!' : (this.isBook ? 'book' : (weak ? 'ready' : 'weak…')),
      html: `
        ${playNowBanner}
        Mode: <b>${this.settings.mode}</b> · Color: <b>${this.myColor}</b><br>
        Think: <b>${(this.thinkMs/1000).toFixed(1)}s</b> · Opp: <b>${this.opponentElo}</b><br>
        ${bookLine}
      `
    });
  }

  _onSettingsChange() {
    this.engine.stop();
    this.engine.newGame();
    if (this.playNowTimer) { clearTimeout(this.playNowTimer); this.playNowTimer = null; }
    this.showPlayNow  = false;
    this.soundPlayed  = false;
    this.lastFen      = null;
    this.pendingFen   = null;
    this.bestMoves    = [];
    this.eloMove      = null;
    this.weakMove     = null;
    this.isBlunder    = false;
    this.isBook       = false;
    this.thinkMs      = 0;
    this.moveCount    = 0;
    this.openingPhase = true;
    if (this.settings.mode === 'legit' || this.settings.mode === 'semi') {
      this.blunders.reset(this.settings.blunderCount ?? 2);
    }
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

function waitForBoard(cb, maxTries = 20) {
  let tries = 0;
  const id = setInterval(() => {
    tries++;
    if (document.querySelector('chess-board, wc-chess-board') || tries > maxTries) {
      clearInterval(id); cb();
    }
  }, 500);
}

waitForBoard(bootstrap);

let lastPath = location.pathname;
setInterval(() => {
  if (location.pathname !== lastPath) {
    lastPath = location.pathname;
    setTimeout(() => waitForBoard(bootstrap), 1000);
  }
}, 1000);
