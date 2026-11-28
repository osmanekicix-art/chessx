import { Chess } from './chess.esm.js';

// ── Stockfish worker ──────────────────────────────────────────────────────────
let sf = null;
let sfReady = false;
let sfCallback = null;

function initSF() {
  return new Promise((resolve) => {
    sf = new Worker(chrome.runtime.getURL('stockfish.js'));
    sf.onmessage = (e) => {
      const line = e.data;
      if (line === 'uciok') {
        sf.postMessage('setoption name Hash value 64');
        sf.postMessage('setoption name Threads value 1');
        sf.postMessage('isready');
        return;
      }
      if (line === 'readyok') { sfReady = true; resolve(); return; }
      if (sfCallback) sfCallback(line);
    };
    sf.onerror = (e) => console.error('[analyzer] SF error', e);
    sf.postMessage('uci');
  });
}

function sfAnalyze(fen, depth) {
  return new Promise((resolve) => {
    const infos = [];
    sfCallback = (line) => {
      if (line.startsWith('info') && line.includes(' score ')) infos.push(line);
      if (line.startsWith('bestmove')) {
        sfCallback = null;
        const best = line.split(' ')[1] || '0000';
        const last = infos[infos.length - 1] || '';
        resolve({ best, info: last });
      }
    };
    sf.postMessage('position fen ' + fen);
    sf.postMessage('go depth ' + depth);
  });
}

// ── Score helpers ─────────────────────────────────────────────────────────────
function parseScore(infoLine) {
  const cp   = infoLine.match(/score cp (-?\d+)/);
  const mate = infoLine.match(/score mate (-?\d+)/);
  if (mate) {
    const m = parseInt(mate[1]);
    return m > 0 ? 29000 - m * 10 : -29000 - m * 10;
  }
  if (cp) return parseInt(cp[1]);
  return null;
}

// Stockfish returns score from the side-to-move perspective.
// Convert to White's perspective.
function toWhiteScore(raw, fen) {
  return / w /.test(fen) ? raw : -raw;
}

// Chess.com accuracy formula:
// 1. Convert eval to win% using sigmoid
// 2. Compute win% loss per move
// 3. accuracy = 103.1668 × e^(−0.04354 × avg_win_pct_loss) − 3.1668
function cpToWinPct(cp) {
  if (cp >= 2900)  return 99.5;
  if (cp <= -2900) return 0.5;
  return 1 / (1 + Math.exp(-0.00368208 * cp)) * 100;
}

function accuracyFromWinPctLoss(avgWinPctLoss) {
  return Math.min(100, Math.max(0,
    Math.round(103.1668 * Math.exp(-0.04354 * avgWinPctLoss) - 3.1668)
  ));
}

// ── Move classification (by win% loss) ───────────────────────────────────────
// win% loss thresholds based on Chess.com public research
function classifyByWPL(wpl, isEngineBest, legalCount) {
  if (legalCount === 1) return 'forced';
  if (isEngineBest && wpl < 1)  return 'best';
  if (wpl < 1)   return 'excellent';
  if (wpl < 3)   return 'excellent';
  if (wpl < 6)   return 'good';
  if (wpl < 10)  return 'inaccuracy';
  if (wpl < 20)  return 'mistake';
  return 'blunder';
}

function isBrilliant(wpl, isEngineBest, moveObj) {
  if (!isEngineBest || wpl > 1) return false;
  // Heuristic: best move that involves a capture (sacrifice candidate)
  return !!moveObj.captured;
}

// ── PGN helpers ───────────────────────────────────────────────────────────────
function parsePGN(raw) {
  const text = raw.replace(/\r\n/g, '\n').trim();
  const headers = {};
  for (const m of text.matchAll(/\[(\w+)\s+"([^"]*)"\]/g)) headers[m[1]] = m[2];
  const moveStart = text.indexOf('\n\n');
  if (moveStart === -1) throw new Error('PGN formatı geçersiz: hamle bölümü bulunamadı.');
  let movesRaw = text.slice(moveStart + 2).trim();
  movesRaw = movesRaw
    .replace(/\{[^}]*\}/g, '')
    .replace(/\([^)]*\)/g, '')
    .replace(/\$\d+/g, '')
    .trim();
  const chess = new Chess();
  try { chess.loadPgn(movesRaw); } catch (e) { throw new Error('PGN parse hatası: ' + e.message); }
  const history = chess.history({ verbose: true });
  if (!history.length) throw new Error('Oyunda hiç hamle bulunamadı.');
  return { headers, history };
}

function detectOpening(history) {
  if (!history.length) return 'Bilinmeyen Açılış';
  const m = (i) => history[i]?.san;
  if (m(0) === 'e4' && m(1) === 'e5') return 'Açık Oyun (1.e4 e5)';
  if (m(0) === 'e4' && m(1) === 'c5') return 'Sicilya Savunması';
  if (m(0) === 'e4' && m(1) === 'e6') return 'Fransız Savunması';
  if (m(0) === 'e4' && m(1) === 'c6') return 'Caro-Kann Savunması';
  if (m(0) === 'd4' && m(1) === 'd5') return 'Kapalı Oyun (1.d4 d5)';
  if (m(0) === 'd4' && m(1) === 'Nf6') return 'Hindistan Savunmaları';
  if (m(0) === 'Nf3') return 'Reti Açılışı';
  if (m(0) === 'e4') return '1.e4 Açılışı';
  if (m(0) === 'd4') return '1.d4 Açılışı';
  return 'Bilinmeyen Açılış';
}

// ── UI helpers ────────────────────────────────────────────────────────────────
const BADGE = {
  brilliant:  ['b-brilliant', 'Brilliant !!'],
  best:       ['b-best',      'Best !'],
  excellent:  ['b-excellent', 'Excellent'],
  good:       ['b-good',      'Good'],
  inaccuracy: ['b-inaccuracy','Inaccuracy ?!'],
  mistake:    ['b-mistake',   'Mistake ?'],
  blunder:    ['b-blunder',   'Blunder ??'],
  forced:     ['b-forced',    'Forced'],
};
function badge(cat) {
  const [cls, label] = BADGE[cat] || ['b-forced', '?'];
  return `<span class="badge ${cls}">${label}</span>`;
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function stars(n) {
  return Array.from({length:5}, (_, i) =>
    `<div class="star${i < n ? ' on' : ''}"></div>`
  ).join('');
}
function setProgress(pct, msg) {
  document.getElementById('progress-fill').style.width = Math.round(pct) + '%';
  document.getElementById('progress-text').textContent = msg;
}

// ── Main analysis ─────────────────────────────────────────────────────────────
async function runAnalysis(pgn, depth) {
  const { headers, history } = parsePGN(pgn);
  const total = history.length;

  if (!sfReady) {
    setProgress(0, 'Stockfish motor başlatılıyor…');
    await initSF();
  }
  sf.postMessage('ucinewgame');

  // Build all pre-move FENs + legal move counts
  const replay = new Chess();
  const preFens   = [];
  const preLegal  = [];
  for (let i = 0; i < total; i++) {
    preFens.push(replay.fen());
    preLegal.push(replay.moves().length);
    replay.move(history[i].san);
  }
  const finalFen = replay.fen();

  // Analyze n+1 positions (each pre-move FEN + final)
  // Single pass: get whiteScore + bestmove for each
  const posData = [];
  setProgress(0, `Analiz ediliyor (0 / ${total + 1})…`);
  for (let i = 0; i <= total; i++) {
    const fen = i < total ? preFens[i] : finalFen;
    const res = await sfAnalyze(fen, depth);
    const raw = parseScore(res.info) ?? 0;
    posData.push({
      whiteScore: toWhiteScore(raw, fen),
      winPct:     cpToWinPct(toWhiteScore(raw, fen)),
      best:       res.best,
    });
    setProgress((i + 1) / (total + 1) * 100,
      `Analiz ediliyor (${i + 1} / ${total + 1})…`);
  }

  // Build per-move analysis
  const analysed = history.map((move, i) => {
    const isWhite   = move.color === 'w';
    const wpBefore  = isWhite ? posData[i].winPct : (100 - posData[i].winPct);
    const wpAfter   = isWhite ? posData[i+1].winPct : (100 - posData[i+1].winPct);
    const wpl       = Math.max(0, wpBefore - wpAfter);            // win% loss
    const cpLoss    = Math.max(0,
      isWhite
        ? posData[i].whiteScore   - posData[i+1].whiteScore
        : posData[i+1].whiteScore - posData[i].whiteScore
    );
    const uci       = move.from + move.to + (move.promotion || '');
    const isEngineBest = uci === posData[i].best;
    let cat = classifyByWPL(wpl, isEngineBest, preLegal[i]);
    if (isBrilliant(wpl, isEngineBest, move)) cat = 'brilliant';
    return {
      move, wpl, cpLoss, isEngineBest, cat,
      wsBefore: posData[i].whiteScore,
      wsAfter:  posData[i+1].whiteScore,
      bestUCI:  posData[i].best,
    };
  });

  buildReport(headers, history, analysed, depth);
}

// ── Report builder ────────────────────────────────────────────────────────────
function buildReport(headers, history, analysed, depth) {
  const white   = headers.White  || 'Beyaz';
  const black   = headers.Black  || 'Siyah';
  const result  = headers.Result || '*';
  const event   = headers.Event  || '';
  const date    = headers.Date   || '';
  const opening = detectOpening(history);
  const totalHalves = history.length;

  const wMoves = analysed.filter(a => a.move.color === 'w');
  const bMoves = analysed.filter(a => a.move.color === 'b');

  function counts(list) {
    const c = {};
    for (const a of list) c[a.cat] = (c[a.cat] || 0) + 1;
    return c;
  }
  const wC = counts(wMoves);
  const bC = counts(bMoves);

  function avgWPL(list) {
    const real = list.filter(a => a.cat !== 'forced');
    return real.length ? real.reduce((s, a) => s + a.wpl, 0) / real.length : 0;
  }
  function avgCPL(list) {
    const real = list.filter(a => a.cat !== 'forced');
    return real.length ? Math.round(real.reduce((s, a) => s + a.cpLoss, 0) / real.length) : 0;
  }

  const wAvgWPL = avgWPL(wMoves);
  const bAvgWPL = avgWPL(bMoves);
  const wCPL    = avgCPL(wMoves);
  const bCPL    = avgCPL(bMoves);
  const wAcc    = accuracyFromWinPctLoss(wAvgWPL);
  const bAcc    = accuracyFromWinPctLoss(bAvgWPL);

  // ── 1. Künye ────────────────────────────────────────────────────────────────
  const kunyeHtml = `
<div class="section-card">
  <div class="card-title">♟ Oyun Künyesi</div>
  <div class="game-info">
    <div class="gi-row"><span class="gi-key">Beyaz:</span><span class="gi-val">${esc(white)}</span></div>
    <div class="gi-row"><span class="gi-key">Siyah:</span><span class="gi-val">${esc(black)}</span></div>
    <div class="gi-row"><span class="gi-key">Sonuç:</span><span class="gi-val">${esc(result)}</span></div>
    <div class="gi-row"><span class="gi-key">Açılış:</span><span class="gi-val">${esc(opening)}</span></div>
    <div class="gi-row"><span class="gi-key">Toplam Hamle:</span><span class="gi-val">${Math.ceil(totalHalves/2)}</span></div>
    <div class="gi-row"><span class="gi-key">Turnuva:</span><span class="gi-val">${esc(event||'—')}</span></div>
    <div class="gi-row"><span class="gi-key">Tarih:</span><span class="gi-val">${esc(date||'—')}</span></div>
    <div class="gi-row"><span class="gi-key">Derinlik:</span><span class="gi-val">${depth}</span></div>
  </div>
</div>`;

  // ── 2. Genel performans ──────────────────────────────────────────────────────
  const statsHtml = `
<div class="section-card">
  <div class="card-title">📊 Genel Performans</div>
  <table class="stats-table">
    <thead><tr><th>İstatistik</th><th>${esc(white)}</th><th>${esc(black)}</th></tr></thead>
    <tbody>
      <tr><td>Doğruluk</td>
        <td><span class="acc-val">${wAcc}%</span></td>
        <td><span class="acc-val">${bAcc}%</span></td></tr>
      <tr><td>Ortalama CPL</td><td>${wCPL}</td><td>${bCPL}</td></tr>
      <tr><td>Brilliant (!!) </td><td>${wC.brilliant||0}</td><td>${bC.brilliant||0}</td></tr>
      <tr><td>Best (!)</td><td>${wC.best||0}</td><td>${bC.best||0}</td></tr>
      <tr><td>Excellent</td><td>${wC.excellent||0}</td><td>${bC.excellent||0}</td></tr>
      <tr><td>Good</td><td>${wC.good||0}</td><td>${bC.good||0}</td></tr>
      <tr><td>Inaccuracy (?!)</td><td>${wC.inaccuracy||0}</td><td>${bC.inaccuracy||0}</td></tr>
      <tr><td>Mistake (?)</td><td>${wC.mistake||0}</td><td>${bC.mistake||0}</td></tr>
      <tr><td>Blunder (??)</td><td>${wC.blunder||0}</td><td>${bC.blunder||0}</td></tr>
    </tbody>
  </table>
  <p style="font-size:11px;color:var(--dim);margin-top:8px">
    * Doğruluk: Chess.com win% kayıp formülüne dayalı tahmin. Resmi Chess.com değeriyle birebir aynı değildir.
  </p>
</div>`;

  // ── 3. Hamle hamle ──────────────────────────────────────────────────────────
  let rows = '';
  let moveNum = 0;
  for (const a of analysed) {
    if (a.move.color === 'w') moveNum++;
    const numStr  = a.move.color === 'w' ? `${moveNum}.` : `${moveNum}…`;
    const wplStr  = a.cat === 'forced' ? '—' : a.wpl.toFixed(1) + '%';
    const wplCls  = a.wpl >= 20 ? ' cpl-high' : a.wpl >= 10 ? ' cpl-mid' : '';
    const bestAlt = !a.isEngineBest && a.cat !== 'forced'
      ? `<div class="best-alt">Motor: ${esc(a.bestUCI)}</div>` : '';
    rows += `<tr>
      <td class="move-num">${numStr}</td>
      <td><span class="move-san">${esc(a.move.san)}</span>${bestAlt}</td>
      <td>${badge(a.cat)}</td>
      <td class="cpl-cell${wplCls}">${wplStr}</td>
      <td><span class="move-desc">${getMoveDesc(a)}</span></td>
    </tr>`;
  }

  const moveTableHtml = `
<div class="section-card">
  <div class="card-title">🎯 Hamle Hamle Analiz</div>
  <div style="overflow-x:auto">
    <table class="move-table">
      <thead><tr><th>#</th><th>Hamle</th><th>Değerlendirme</th><th>W% Kayıp</th><th>Not</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>
</div>`;

  // ── 4. Kritik anlar ──────────────────────────────────────────────────────────
  const criticals = findCriticals(analysed, white, black);
  let critHtml = `<div class="section-card"><div class="card-title">🔥 Kritik Anlar</div>`;
  if (!criticals.length) {
    critHtml += `<p style="color:var(--muted);font-size:13px">Kritik an tespit edilmedi.</p>`;
  } else {
    for (const c of criticals) {
      critHtml += `<div class="critical-item ct-${c.type}">
        <div class="critical-type">${c.typeLabel}</div>
        <div class="critical-move">${c.moveStr}</div>
        <div class="critical-desc">${c.desc}</div>
      </div>`;
    }
  }
  critHtml += '</div>';

  // ── 5. Oyuncu profili ────────────────────────────────────────────────────────
  const profileHtml = `
<div class="section-card">
  <div class="card-title">🧠 Oyuncu Profili</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div>
      <div style="font-weight:700;margin-bottom:10px;color:var(--muted)">${esc(white)}</div>
      ${renderProfile(wMoves, wC, wAvgWPL)}
    </div>
    <div>
      <div style="font-weight:700;margin-bottom:10px;color:var(--muted)">${esc(black)}</div>
      ${renderProfile(bMoves, bC, bAvgWPL)}
    </div>
  </div>
</div>`;

  // ── 6. Gelişim raporu ────────────────────────────────────────────────────────
  const imps = buildImprovements(analysed, wMoves, bMoves, wAvgWPL, bAvgWPL, white, black);
  let impHtml = `<div class="section-card"><div class="card-title">📈 Gelişim Raporu</div>`;
  imps.forEach((imp, i) => {
    impHtml += `<div class="improvement-item">
      <div class="imp-title"><span class="imp-num">${i+1}</span>${imp.title}</div>
      <div class="imp-body">${imp.body}</div>
      <div class="imp-tip">💡 ${imp.tip}</div>
    </div>`;
  });
  impHtml += '</div>';

  // ── 7. Özet ─────────────────────────────────────────────────────────────────
  const bestMove  = analysed.find(a => a.cat === 'brilliant')
    || analysed.filter(a => a.cat === 'best').sort((a, b) => b.cpLoss - a.cpLoss)[0]
    || analysed[0];
  const worstMove = analysed.filter(a => a.cat === 'blunder').sort((a, b) => b.wpl - a.wpl)[0]
    || analysed.filter(a => a.cat === 'mistake').sort((a, b) => b.wpl - a.wpl)[0];
  const overallScore = Math.round((wAcc + bAcc) / 2);
  const scoreColor = overallScore >= 80 ? 'var(--best)' : overallScore >= 60 ? 'var(--inaccuracy)' : 'var(--blunder)';

  const sumHtml = `
<div class="section-card">
  <div class="card-title">📋 Özet</div>
  <div class="summary-grid">
    <div class="sum-item">
      <div class="sum-label">Genel Puan / 100</div>
      <div class="sum-val score" style="color:${scoreColor}">${overallScore}</div>
      <div class="score-bar"><div class="score-fill" style="width:${overallScore}%"></div></div>
    </div>
    <div class="sum-item">
      <div class="sum-label">En İyi Hamle</div>
      <div class="sum-val">${bestMove
        ? esc(bestMove.move.san) + ' (' + esc(bestMove.move.color === 'w' ? white : black) + ')'
        : '—'}</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">En Kötü Hamle</div>
      <div class="sum-val" style="color:var(--blunder)">${worstMove
        ? esc(worstMove.move.san) + ' (' + esc(worstMove.move.color === 'w' ? white : black)
          + ', −' + worstMove.wpl.toFixed(1) + '% kazanış)'
        : 'Yok'}</div>
    </div>
    <div class="sum-item">
      <div class="sum-label">En Önemli Ders</div>
      <div class="sum-val" style="font-size:12px">${getLesson(analysed)}</div>
    </div>
    <div class="sum-item" style="grid-column:1/-1">
      <div class="sum-label">Gelişim Hedefi</div>
      <div class="sum-val" style="font-size:13px">${imps[0]?.tip || 'Tutarlılığı artır.'}</div>
    </div>
  </div>
</div>`;

  document.getElementById('report').innerHTML =
    kunyeHtml + statsHtml + moveTableHtml + critHtml + profileHtml + impHtml + sumHtml;
  document.getElementById('report').style.display = 'block';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getMoveDesc(a) {
  const { cat, wpl } = a;
  if (cat === 'forced')    return 'Neredeyse zorunlu hamle.';
  if (cat === 'brilliant') return 'Olağanüstü hamle — büyük taktiksel derinlik.';
  if (cat === 'best')      return 'Motor en iyi hamlesi.';
  if (cat === 'excellent') return 'Çok güçlü hamle.';
  if (cat === 'good')      return 'İyi hamle.';
  if (cat === 'inaccuracy')return `Küçük hata (−${wpl.toFixed(1)}% kazanış). Daha iyi alternatiﬁ vardı.`;
  if (cat === 'mistake')   return `Belirgin hata — ${wpl.toFixed(1)}% kazanış kaybı.`;
  if (cat === 'blunder')   return `Büyük hata — ${wpl.toFixed(1)}% kazanış kaybı! Motor: ${esc(a.bestUCI)}`;
  return '';
}

function findCriticals(analysed, white, black) {
  const result = [];
  let moveNum = 0;
  for (const a of analysed) {
    if (a.move.color === 'w') moveNum++;
    const player = a.move.color === 'w' ? white : black;
    const numStr = a.move.color === 'w' ? `${moveNum}.` : `${moveNum}…`;
    if (a.cat === 'blunder') {
      result.push({ type: 'blunder', typeLabel: 'Blunder',
        moveStr: `${numStr} ${esc(a.move.san)} (${esc(player)})`,
        desc: `${a.wpl.toFixed(1)}% kazanış kaybı. Motor en iyisi: ${esc(a.bestUCI)}.` });
    }
    if (a.cat === 'brilliant') {
      result.push({ type: 'best', typeLabel: 'Brilliant Hamle',
        moveStr: `${numStr} ${esc(a.move.san)} (${esc(player)})`,
        desc: 'Olağanüstü ve zor bulunan hamle.' });
    }
  }
  // Dönüm noktası: en büyük skor değişimi
  let maxSwing = 0, turningIdx = -1;
  for (let i = 0; i < analysed.length; i++) {
    const swing = Math.abs(analysed[i].wsAfter - analysed[i].wsBefore);
    if (swing > maxSwing && analysed[i].cat !== 'forced') { maxSwing = swing; turningIdx = i; }
  }
  if (turningIdx >= 0 && maxSwing >= 150) {
    const a = analysed[turningIdx];
    const player = a.move.color === 'w' ? white : black;
    result.push({ type: 'turning', typeLabel: 'Dönüm Noktası',
      moveStr: `${esc(a.move.san)} (${esc(player)})`,
      desc: `Bu hamleden sonra pozisyon ${maxSwing} cp değişti. Oyunun kritik kavşağı.` });
  }
  return result.slice(0, 6);
}

function renderProfile(moves, c, avgWPL) {
  const total   = moves.length || 1;
  const badRate  = ((c.mistake||0) + (c.blunder||0)) / total;
  const goodRate = ((c.brilliant||0) + (c.best||0) + (c.excellent||0)) / total;
  const tactic   = Math.max(1, Math.min(5, Math.round(5 - badRate * 10 + goodRate * 3)));
  const strategy = Math.max(1, Math.min(5, goodRate > 0.4 ? 4 : goodRate > 0.2 ? 3 : 2));
  const quality  = avgWPL < 2 ? 5 : avgWPL < 4 ? 4 : avgWPL < 7 ? 3 : avgWPL < 12 ? 2 : 1;
  const items = [
    ['Taktik Görüş',       tactic,   'Hamle taktiksel kalitesi'],
    ['Stratejik Anlayış',  strategy, 'Plan & pozisyon yönetimi'],
    ['Hamle Kalitesi',     quality,  `Ort. kazanış kaybı: ${avgWPL.toFixed(1)}%`],
  ];
  return `<div class="profile-grid">${items.map(([label, score, note]) => `
    <div class="profile-item">
      <div class="profile-cat">${label}</div>
      <div class="profile-stars">${stars(score)}</div>
      <div class="profile-note">${note}</div>
    </div>`).join('')}</div>`;
}

function buildImprovements(analysed, wMoves, bMoves, wWPL, bWPL, white, black) {
  const imps = [];
  const blunders = analysed.filter(a => a.cat === 'blunder');
  if (blunders.length > 0) {
    const names = [...new Set(blunders.slice(0, 3).map(b => b.move.san))].join(', ');
    imps.push({
      title: `Büyük hataları azalt (${blunders.length} blunder)`,
      body: `Tespit edilen büyük hatalar: ${esc(names)}. Bu hatalar kazanış şansını ortalama ${
        (blunders.reduce((s,b)=>s+b.wpl,0)/blunders.length).toFixed(1)}% düşürdü.`,
      tip: 'Her hamlede "rakibim buna nasıl yanıt verir?" diye sor. Özellikle taş değiş tokuşlarında sonucu iki kez hesapla.'
    });
  }
  const mistakes = analysed.filter(a => a.cat === 'inaccuracy' || a.cat === 'mistake');
  if (mistakes.length > 3) {
    imps.push({
      title: `Pozisyon değerlendirmesini geliştir (${mistakes.length} hata)`,
      body: 'Bu hatalar genellikle pozisyonun gerektirdiği planı tam olarak görmemekten kaynaklanır.',
      tip: 'Her hamleden önce tahtadaki en zayıf taşını ve en güçlü rakip tehdidini belirle.'
    });
  }
  const weakWPL  = Math.max(wWPL, bWPL);
  const weakSide = wWPL > bWPL ? white : black;
  if (weakWPL > 5) {
    imps.push({
      title: `${esc(weakSide)}: Hamle kalitesini artır (Ort. ${weakWPL.toFixed(1)}% kayıp)`,
      body: 'Her hamledeki ortalama kazanış kaybını 3–4% altına çekebilirsen doğruluk %85+ olur.',
      tip: 'Günde 15 dakika taktik çöz. Taktik otomasyonu doğrudan pozisyon hesabını hızlandırır.'
    });
  }
  if (!imps.length) {
    imps.push({
      title: 'Mevcut seviyeyi koru',
      body: 'Oyun genel olarak yüksek kalitede oynandı.',
      tip: 'Zor piyon yapısı ve kale bitiş oyunlarını çalış.'
    });
  }
  return imps.slice(0, 3);
}

function getLesson(analysed) {
  const blunders = analysed.filter(a => a.cat === 'blunder');
  if (blunders.length > 2) return 'Hızlı karar vermeden önce rakibin taktik tehditlerini kontrol et.';
  if (blunders.length > 0) return 'Büyük materyal değiş tokuşlarında sonucu iki kez hesapla.';
  const mistakes = analysed.filter(a => a.cat === 'mistake');
  if (mistakes.length > 3) return 'Pozisyonun uzun vadeli planını belirle ve her hamleyle bu plana yaklaş.';
  return 'Kritik anlarda sakin kal ve sezgine güven.';
}

// ── Event wiring ──────────────────────────────────────────────────────────────
document.getElementById('depth-slider').addEventListener('input', (e) => {
  document.getElementById('depth-label').textContent = e.target.value;
});

document.getElementById('analyze-btn').addEventListener('click', async () => {
  const pgn         = document.getElementById('pgn-input').value.trim();
  const depth       = parseInt(document.getElementById('depth-slider').value);
  const errorBox    = document.getElementById('error-box');
  const progressWrap= document.getElementById('progress-wrap');
  const btn         = document.getElementById('analyze-btn');
  const report      = document.getElementById('report');

  errorBox.style.display = 'none';
  report.style.display   = 'none';
  if (!pgn) {
    errorBox.textContent   = 'Lütfen bir PGN yapıştırın.';
    errorBox.style.display = 'block';
    return;
  }

  btn.disabled    = true;
  btn.textContent = 'Analiz ediliyor…';
  progressWrap.style.display = 'block';
  setProgress(0, 'Başlatılıyor…');

  try {
    await runAnalysis(pgn, depth);
    progressWrap.style.display = 'none';
    report.scrollIntoView({ behavior: 'smooth' });
  } catch (err) {
    progressWrap.style.display = 'none';
    errorBox.textContent   = 'Hata: ' + err.message;
    errorBox.style.display = 'block';
    console.error('[analyzer]', err);
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Analiz Et';
  }
});

// Auto-load PGN from storage if opened from popup
chrome.storage.local.get('analyzerPgn', ({ analyzerPgn }) => {
  if (analyzerPgn) {
    document.getElementById('pgn-input').value = analyzerPgn;
    chrome.storage.local.remove('analyzerPgn');
  }
});
