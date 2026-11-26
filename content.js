// ChessX — chess.com analysis overlay
// Runs as a content script on chess.com game pages

const CHESSX_VERSION = '1.0.0';

// ─── Opening book ─────────────────────────────────────────────────────────────
// Key: FEN position part (piece placement only)
// Value: [{m: 'uci_move', w: weight}, ...]
// Opening book: Carlsen (4314g) + Kasparov (2129g) + Nakamura (4812g) = 11,255 games.
// + ECO theory database (2681 openings, A00–E99) → 951 total positions.
// Grandmaster positions use real game frequencies; ECO fills remaining gaps.
const OPENING_BOOK = {
  // ── Move 1 ────────────────────────────────────────────────────────────────
  // Nakamura's signature 1.Nf3 bumps it from 7% to 14%
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR': [
    {m:'e2e4',w:40},{m:'d2d4',w:33},{m:'g1f3',w:14},{m:'c2c4',w:8},{m:'b2b3',w:2}
  ],
  // ── After 1.e4 ────────────────────────────────────────────────────────────
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'e7e5',w:40},{m:'c7c5',w:39},{m:'g7g6',w:5},{m:'c7c6',w:5},{m:'e7e6',w:3}
  ],
  // ── After 1.d4 ────────────────────────────────────────────────────────────
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR': [
    {m:'g8f6',w:68},{m:'d7d5',w:18},{m:'g7g6',w:6},{m:'f7f5',w:3},{m:'e7e6',w:2}
  ],
  // ── After 1.c4 ────────────────────────────────────────────────────────────
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR': [
    {m:'g8f6',w:35},{m:'e7e5',w:27},{m:'g7g6',w:17},{m:'e7e6',w:9},{m:'c7c5',w:6},{m:'c7c6',w:5}
  ],
  // ── After 1.Nf3 ───────────────────────────────────────────────────────────
  // Nakamura influence: d5:38% (solid, classical response)
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R': [
    {m:'g8f6',w:41},{m:'d7d5',w:38},{m:'g7g6',w:8},{m:'c7c5',w:5},{m:'e7e6',w:2}
  ],
  // ── 1.e4 e5: Open game ────────────────────────────────────────────────────
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'g1f3',w:90},{m:'b1c3',w:4},{m:'f1c4',w:3},{m:'f2f4',w:2}
  ],
  // ── 1.e4 c5: Sicilian ─────────────────────────────────────────────────────
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'g1f3',w:86},{m:'b1c3',w:10},{m:'c2c3',w:2},{m:'g1e2',w:1}
  ],
  // ── 1.e4 e6: French ───────────────────────────────────────────────────────
  'rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'d2d4',w:80},{m:'g1f3',w:12},{m:'b1c3',w:8}
  ],
  // ── 1.e4 c6: Caro-Kann ────────────────────────────────────────────────────
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'d2d4',w:80},{m:'b1c3',w:10},{m:'g1f3',w:10}
  ],
  // ── 1.e4 d5: Scandinavian ─────────────────────────────────────────────────
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'e4d5',w:80},{m:'b1c3',w:12},{m:'e4e5',w:8}
  ],
  // ── 1.e4 d6: Pirc/Modern ──────────────────────────────────────────────────
  'rnbqkbnr/ppp1pppp/3p4/8/4P3/8/PPPP1PPP/RNBQKBNR': [
    {m:'d2d4',w:70},{m:'g1f3',w:20},{m:'b1c3',w:10}
  ],
  // ── 1.e4 e5 2.Nf3: Black responds ────────────────────────────────────────
  // All three GMs agree: Nc6 dominant (98%)
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'b8c6',w:98},{m:'g8f6',w:2}
  ],
  // ── 1.e4 c5 2.Nf3: Black responds (Sicilian) ─────────────────────────────
  // Nakamura also prefers d6 Najdorf → d6:58%, Nc6:27%, e6:13%
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'d7d6',w:58},{m:'b8c6',w:27},{m:'e7e6',w:13}
  ],
  // ── 1.e4 e5 2.Nf3 Nc6: White continues ───────────────────────────────────
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'f1b5',w:70},{m:'f1c4',w:14},{m:'d2d4',w:12},{m:'b1c3',w:3}
  ],
  // ── 1.e4 e5 2.Nf3 Nc6 3.Bb5 (Ruy Lopez): Black ───────────────────────────
  // Nakamura Berlin specialist: Nf6 flips to 54% vs a6:41%
  'r1bqkbnr/pppp1ppp/2n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R': [
    {m:'g8f6',w:54},{m:'a7a6',w:41},{m:'g7g6',w:2},{m:'f8c5',w:2}
  ],
  // ── 1.e4 e5 2.Nf3 Nc6 3.Bb5 a6 4.Ba4 Nf6: White (Ruy Lopez main) ────────
  'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R': [
    {m:'e1g1',w:86},{m:'d2d3',w:12}
  ],
  // ── 1.e4 e5 2.Nf3 Nc6 3.Bc4 (Italian): Black ────────────────────────────
  // Nakamura Classical Italian: Bc5 rises to 87%
  'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R': [
    {m:'f8c5',w:87},{m:'g8f6',w:13}
  ],
  // ── 1.e4 e5 2.Nf3 Nf6 (Petroff): White ───────────────────────────────────
  'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'f1e2',w:40},{m:'d2d4',w:30},{m:'b1c3',w:20},{m:'f1c4',w:10}
  ],
  // ── 1.e4 c5 2.Nf3 Nc6: White continues (Sicilian Nc6) ────────────────────
  'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'d2d4',w:39},{m:'f1b5',w:39},{m:'b1c3',w:23}
  ],
  // ── 1.e4 c5 2.Nf3 d6: White continues (Sicilian Najdorf) ─────────────────
  'rnbqkbnr/pp2pppp/3p4/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'d2d4',w:61},{m:'f1b5',w:26},{m:'b1c3',w:5},{m:'c2c3',w:5}
  ],
  // ── 1.e4 c5 2.Nf3 e6: White continues ────────────────────────────────────
  'rnbqkbnr/pp1p1ppp/4p3/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': [
    {m:'d2d4',w:60},{m:'b2b3',w:11},{m:'g2g3',w:9},{m:'d2d3',w:6},{m:'c2c3',w:6}
  ],
  // ── 1.d4 d5: White continues ──────────────────────────────────────────────
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR': [
    {m:'c2c4',w:86},{m:'g1f3',w:7},{m:'c1f4',w:4},{m:'b1c3',w:2}
  ],
  // ── 1.d4 Nf6: White continues ─────────────────────────────────────────────
  'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR': [
    {m:'c2c4',w:76},{m:'g1f3',w:16},{m:'c1g5',w:4},{m:'c1f4',w:4}
  ],
  // ── 1.d4 d5 2.c4: Black responds ──────────────────────────────────────────
  'rnbqkbnr/ppp1pppp/8/3p4/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'c7c6',w:45},{m:'e7e6',w:36},{m:'d5c4',w:18}
  ],
  // ── 1.d4 Nf6 2.c4: Black responds ────────────────────────────────────────
  // Nakamura KID: g6 rises to 37%, e6:57%
  'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'e7e6',w:57},{m:'g7g6',w:37},{m:'c7c5',w:4}
  ],
  // ── 1.d4 d5 2.c4 e6 (QGD): White ─────────────────────────────────────────
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'b1c3',w:73},{m:'g1f3',w:26}
  ],
  // ── 1.d4 d5 2.c4 c6 (Slav): White ────────────────────────────────────────
  'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'g1f3',w:67},{m:'b1c3',w:29},{m:'e2e3',w:3}
  ],
  // ── 1.d4 Nf6 2.c4 e6: White ──────────────────────────────────────────────
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'g1f3',w:57},{m:'b1c3',w:38},{m:'g2g3',w:5}
  ],
  // ── 1.d4 Nf6 2.c4 e6 3.Nf3: Black responds (QID/Nimzo) ──────────────────
  // Nakamura: d5 dominant at 68%, b6 (QID) drops to 24%
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R': [
    {m:'d7d5',w:68},{m:'b7b6',w:24},{m:'f8b4',w:4},{m:'c7c5',w:3}
  ],
  // ── 1.d4 Nf6 2.c4 g6 (KID): White ────────────────────────────────────────
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/8/PP2PPPP/RNBQKBNR': [
    {m:'b1c3',w:69},{m:'g1f3',w:14},{m:'g2g3',w:10},{m:'f2f3',w:6}
  ],
  // ── 1.d4 Nf6 2.c4 e6 3.Nc3: Black (Nimzo-Indian) ─────────────────────────
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/2N5/PP2PPPP/R1BQKBNR': [
    {m:'f8b4',w:60},{m:'d7d5',w:28},{m:'b7b6',w:7},{m:'c7c5',w:5}
  ],
  // ── 1.d4 Nf6 2.c4 e6 3.Nf3 d5 (QGD): White ─────────────────────────────
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R': [
    {m:'b1c3',w:81},{m:'g2g3',w:16},{m:'c1g5',w:2}
  ],
  // ── 1.d4 Nf6 2.c4 e6 3.Nf3 b6 (Queen's Indian): White ───────────────────
  'rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R': [
    {m:'b1c3',w:45},{m:'g2g3',w:35},{m:'e2e3',w:12},{m:'c1f4',w:8}
  ],
  // ── 1.c4 Nf6: White continues ────────────────────────────────────────────
  'rnbqkb1r/pppppppp/5n2/8/2P5/8/PP1PPPPP/RNBQKBNR': [
    {m:'b1c3',w:50},{m:'g1f3',w:30},{m:'g2g3',w:20}
  ],
  // ── 1.Nf3 d5 / 1.Nf3 Nf6: White continues ───────────────────────────────
  'rnbqkbnr/ppp1pppp/8/3p4/8/5N2/PPPPPPPP/RNBQKB1R': [
    {m:'d2d4',w:50},{m:'c2c4',w:35},{m:'g2g3',w:15}
  ],
  'rnbqkb1r/pppppppp/5n2/8/8/5N2/PPPPPPPP/RNBQKB1R': [
    {m:'d2d4',w:50},{m:'c2c4',w:35},{m:'g2g3',w:15}
  ],
  // ── ECO theory positions (2681 openings, A00–E99) ──────────────────────────
  'r1b1k1nr/pppp1ppp/2n2q2/2b5/3NP3/2P1B3/PP3PPP/RN1QKB1R': [{m:'g8e7',w:80},{m:'f6g6',w:20}],
  'r1b1k1nr/pppp1ppp/2n2q2/2b5/3NP3/4B3/PPP2PPP/RN1QKB1R': [{m:'c2c3',w:83},{m:'d4b5',w:17}],
  'r1b1k2r/ppppnppp/2n2q2/2b5/3NP3/2P1B3/PP3PPP/RN1QKB1R': [{m:'f1b5',w:50},{m:'d4c2',w:25},{m:'d1d2',w:25}],
  'r1b1kbnr/pp3ppp/1qn1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R': [{m:'f1d3',w:67},{m:'a2a3',w:33}],
  'r1b1kbnr/pppp1ppp/2n5/8/3NP2q/8/PPP2PPP/RNBQKB1R': [{m:'b1c3',w:33},{m:'c1e3',w:17},{m:'d4b5',w:17},{m:'d4f3',w:17},{m:'d4f5',w:17}],
  'r1b1kbnr/pppp1ppp/2n5/8/3PPp1q/2N5/PPP1K1PP/R1BQ1BNR': [{m:'b7b6',w:25},{m:'d7d5',w:25},{m:'d7d6',w:25},{m:'g7g5',w:25}],
  'r1b1kbnr/pppp1ppp/2n5/8/3PPp1q/2N5/PPP3PP/R1BQKBNR': [{m:'e1e2',w:100}],
  'r1b1kbnr/ppqp1ppp/2n1p3/8/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'c1e3',w:67},{m:'d4b5',w:33}],
  'r1b2rk1/2q1bppp/p2p1n2/npp1p3/3PP3/2P2N1P/PPB2PP1/RNBQR1K1': [{m:'b1d2',w:80},{m:'d4d5',w:20}],
  'r1b2rk1/2q1bppp/p2p1n2/npp1p3/3PP3/2P2N1P/PPBN1PP1/R1BQR1K1': [{m:'a5c6',w:67},{m:'c5d4',w:33}],
  'r1b2rk1/pp1nqppp/2p1p3/3n4/2BP4/2N1PN2/PP3PPP/2RQ1RK1': [{m:'d5c3',w:100}],
  'r1b2rk1/pp1nqppp/2p1p3/3n4/2BP4/2N1PN2/PP3PPP/2RQK2R': [{m:'e1g1',w:75},{m:'c3e4',w:25}],
  'r1b2rk1/pp1nqppp/2p1p3/8/2BP4/2n1PN2/PP3PPP/2RQ1RK1': [{m:'c1c3',w:100}],
  'r1bq1rk1/2p1bppp/p1n2n2/1p1pp3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1': [{m:'e4d5',w:80},{m:'d2d4',w:20}],
  'r1bq1rk1/2p1bppp/p1n2n2/1p1Pp3/8/1BP2N2/PP1P1PPP/RNBQR1K1': [{m:'f6d5',w:75},{m:'e5e4',w:25}],
  'r1bq1rk1/2p1bppp/p1n5/1p1nN3/8/1BP5/PP1P1PPP/RNBQR1K1': [{m:'c6e5',w:100}],
  'r1bq1rk1/2p1bppp/p1n5/1p1np3/8/1BP2N2/PP1P1PPP/RNBQR1K1': [{m:'f3e5',w:100}],
  'r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1': [{m:'c6a5',w:47},{m:'c6b8',w:32},{m:'a6a5',w:5},{m:'c8b7',w:5},{m:'c8e6',w:5},{m:'h7h6',w:5}],
  'r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1': [{m:'h2h3',w:79},{m:'a2a3',w:7},{m:'d2d4',w:7},{m:'b3c2',w:4},{m:'d2d3',w:4}],
  'r1bq1rk1/2p1bppp/p2p1n2/np2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1': [{m:'b3c2',w:100}],
  'r1bq1rk1/2p1bppp/p2p1n2/np2p3/4P3/2P2N1P/PPBP1PP1/RNBQR1K1': [{m:'c7c5',w:100}],
  'r1bq1rk1/2p1bppp/p7/1p1nn3/8/1BP5/PP1P1PPP/RNBQR1K1': [{m:'e1e5',w:100}],
  'r1bq1rk1/2p1bppp/p7/1p1nR3/8/1BP5/PP1P1PPP/RNBQ2K1': [{m:'c7c6',w:100}],
  'r1bq1rk1/2pnbppp/p2p1n2/1p2p3/3PP3/1BP2N1P/PP3PP1/RNBQR1K1': [{m:'c3c4',w:33},{m:'b1d2',w:33},{m:'f3h4',w:33}],
  'r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1': [{m:'c2c3',w:91},{m:'a2a4',w:9}],
  'r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1': [{m:'d7d5',w:67},{m:'d7d6',w:22},{m:'c6a5',w:11}],
  'r1bq1rk1/4bppp/p1p5/1p1nR3/8/1BP5/PP1P1PPP/RNBQ2K1': [{m:'b3d5',w:33},{m:'d2d4',w:33},{m:'g2g3',w:33}],
  'r1bq1rk1/4bppp/p2p1n2/npp1p3/3PP3/2P2N1P/PPB2PP1/RNBQR1K1': [{m:'d8c7',w:75},{m:'a5c6',w:13},{m:'f6d7',w:13}],
  'r1bq1rk1/4bppp/p2p1n2/npp1p3/4P3/2P2N1P/PPBP1PP1/RNBQR1K1': [{m:'d2d4',w:100}],
  'r1bq1rk1/pp1nbppp/2p1p3/3n2B1/2BP4/2N1PN2/PP3PPP/2RQK2R': [{m:'g5e7',w:80},{m:'h2h4',w:20}],
  'r1bq1rk1/pp1nBppp/2p1p3/3n4/2BP4/2N1PN2/PP3PPP/2RQK2R': [{m:'d8e7',w:100}],
  'r1bq1rk1/pp1nbppp/2p1pn2/3p2B1/2PP4/2N1PN2/PP3PPP/2RQKB1R': [{m:'f1d3',w:80},{m:'d1c2',w:20}],
  'r1bq1rk1/pp1nbppp/2p1pn2/3p2B1/2PP4/2NBPN2/PP3PPP/2RQK2R': [{m:'d5c4',w:100}],
  'r1bq1rk1/pp1nbppp/2p1pn2/3p4/2PP4/5NP1/PPQ1PPBP/RNB2RK1': [{m:'b1d2',w:67},{m:'f1d1',w:33}],
  'r1bq1rk1/pp1nbppp/2p1pn2/6B1/2BP4/2N1PN2/PP3PPP/2RQK2R': [{m:'f6d5',w:86},{m:'b7b5',w:14}],
  'r1bq1rk1/pp1nbppp/2p1pn2/6B1/2pP4/2NBPN2/PP3PPP/2RQK2R': [{m:'d3c4',w:100}],
  'r1bq1rk1/pp1pppbp/2n2np1/2p5/2P5/2N2NP1/PP1PPPBP/R1BQ1RK1': [{m:'b2b3',w:33},{m:'d2d3',w:33},{m:'d2d4',w:33}],
  'r1bq1rk1/pp2bppp/2n2n2/2pp2B1/3P4/2N2NP1/PP2PPBP/R2Q1RK1': [{m:'c8e6',w:50},{m:'c5c4',w:25},{m:'c5d4',w:25}],
  'r1bq1rk1/pp2bppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQ1RK1': [{m:'c1g5',w:71},{m:'d4c5',w:29}],
  'r1bq1rk1/pp2ppbp/2n3p1/2p5/2BPP3/2P1B3/P3NPPP/R2Q1RK1': [{m:'c5d4',w:100}],
  'r1bq1rk1/pp2ppbp/2n3p1/2p5/2BPP3/2P5/P3NPPP/R1BQ1RK1': [{m:'c1e3',w:100}],
  'r1bq1rk1/pp2ppbp/2np1np1/8/2BNP3/2N1BP2/PPPQ2PP/R3K2R': [{m:'c8d7',w:50},{m:'f6d7',w:25},{m:'c6d4',w:25}],
  'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1B3/PPP1BPPP/R2Q1RK1': [{m:'d4b3',w:80},{m:'f2f4',w:20}],
  'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R': [{m:'f1c4',w:83},{m:'g2g4',w:17}],
  'r1bq1rk1/pp2ppbp/2np1np1/8/4P3/1NN1B3/PPP1BPPP/R2Q1RK1': [{m:'c8e6',w:67},{m:'a7a5',w:33}],
  'r1bq1rk1/pp3ppp/2n1pn2/2pp4/1bPP4/2NBPN2/PP3PPP/R1BQ1RK1': [{m:'a2a3',w:100}],
  'r1bq1rk1/pp3ppp/2n1pn2/2pp4/1bPP4/P1NBPN2/1P3PPP/R1BQ1RK1': [{m:'b4c3',w:67},{m:'d5c4',w:33}],
  'r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1': [{m:'f3e1',w:50},{m:'b2b4',w:38},{m:'c1d2',w:13}],
  'r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N5/PP2BPPP/R1BQNRK1': [{m:'f6d7',w:100}],
  'r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1': [{m:'a7a6',w:25},{m:'c8f5',w:25},{m:'c8g4',w:25},{m:'e7e5',w:25}],
  'r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQK2R': [{m:'e1g1',w:100}],
  'r1bq1rk1/ppp1ppbp/2np1np1/8/2PPP3/2N1BP2/PP2N1PP/R2QKB1R': [{m:'a7a6',w:67},{m:'a8b8',w:33}],
  'r1bq1rk1/ppp1ppbp/2np1np1/8/2PPP3/2N1BP2/PP4PP/R2QKBNR': [{m:'g1e2',w:100}],
  'r1bq1rk1/ppp2pbp/2np1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1': [{m:'c6e7',w:100}],
  'r1bq1rk1/ppp2pbp/2np1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1': [{m:'d4d5',w:100}],
  'r1bq1rk1/ppp2ppp/2np1n2/1B2p1B1/1b2P3/2NP1N2/PPP2PPP/R2Q1RK1': [{m:'b4c3',w:67},{m:'c6e7',w:33}],
  'r1bq1rk1/ppp2ppp/2np1n2/1B2p3/1b2P3/2NP1N2/PPP2PPP/R1BQ1RK1': [{m:'c1g5',w:75},{m:'c3e2',w:25}],
  'r1bq1rk1/pppnbppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/2RQKB1R': [{m:'c7c6',w:79},{m:'b7b6',w:14},{m:'a7a6',w:7}],
  'r1bq1rk1/pppnbppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R': [{m:'a1c1',w:79},{m:'d1c2',w:11},{m:'f1d3',w:5},{m:'d1b3',w:5}],
  'r1bq1rk1/pppnbppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1': [{m:'d1c2',w:80},{m:'b1c3',w:20}],
  'r1bq1rk1/pppnbppp/4pn2/3p4/2PP4/5NP1/PPQ1PPBP/RNB2RK1': [{m:'c7c6',w:100}],
  'r1bq1rk1/pppnnpbp/3p2p1/3Pp3/2P1P3/2N5/PP2BPPP/R1BQNRK1': [{m:'f2f3',w:67},{m:'c1e3',w:33}],
  'r1bq1rk1/pppp1ppp/2n2n2/1B2p3/1b2P3/2N2N2/PPPP1PPP/R1BQ1RK1': [{m:'d2d3',w:78},{m:'b5c6',w:11},{m:'c3d5',w:11}],
  'r1bq1rk1/pppp1ppp/2n2n2/1B2p3/1b2P3/2NP1N2/PPP2PPP/R1BQ1RK1': [{m:'d7d6',w:71},{m:'b4c3',w:29}],
  'r1bqk1nr/pp1pppbp/2n3p1/1Bp5/4P3/5N2/PPPP1PPP/RNBQ1RK1': [{m:'c2c3',w:67},{m:'f1e1',w:33}],
  'r1bqk1nr/pp1pppbp/2n3p1/2p5/2P5/2N2NP1/PP1PPPBP/R1BQK2R': [{m:'g8f6',w:100}],
  'r1bqk1nr/pp1pppbp/2n3p1/2p5/2P5/2N3P1/PP1PPPBP/R1BQK1NR': [{m:'g1f3',w:71},{m:'e2e3',w:14},{m:'e2e4',w:14}],
  'r1bqk1nr/pp1pppbp/2n3p1/2p5/4P3/2N3P1/PPPP1PBP/R1BQK1NR': [{m:'d2d3',w:100}],
  'r1bqk1nr/pp1pppbp/2n3p1/2p5/4P3/2NP2P1/PPP2PBP/R1BQK1NR': [{m:'d7d6',w:100}],
  'r1bqk1nr/pp2ppbp/2np2p1/2p5/4P3/2NP2P1/PPP2PBP/R1BQK1NR': [{m:'f2f4',w:67},{m:'c1e3',w:33}],
  'r1bqk1nr/ppp2ppp/1bnp4/8/2BPP3/5N2/P4PPP/RNBQ1RK1': [{m:'b1c3',w:60},{m:'d4d5',w:40}],
  'r1bqk1nr/ppp2ppp/2np4/2b5/2BpP3/2P2N2/P4PPP/RNBQ1RK1': [{m:'c3d4',w:100}],
  'r1bqk1nr/ppp2ppp/2np4/2b5/2BPP3/5N2/P4PPP/RNBQ1RK1': [{m:'c5b6',w:100}],
  'r1bqk1nr/ppp2ppp/2np4/b3p3/2BPP3/2P2N2/P4PPP/RNBQK2R': [{m:'c1g5',w:33},{m:'e1g1',w:33},{m:'d1b3',w:33}],
  'r1bqk1nr/pppp1pbp/2n3p1/4p3/2P5/2N3P1/PP1PPPBP/R1BQK1NR': [{m:'d2d3',w:50},{m:'a1b1',w:17},{m:'e2e3',w:17},{m:'e2e4',w:17}],
  'r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/2P2N2/PP1P1PPP/RNBQK2R': [{m:'c5b6',w:20},{m:'d7d5',w:20},{m:'f7f5',w:20},{m:'g8f6',w:20},{m:'d8e7',w:20}],
  'r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/5N2/PPPP1PPP/RNBQK2R': [{m:'c2c3',w:63},{m:'e1g1',w:25},{m:'b2b4',w:13}],
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R': [{m:'c5b4',w:92},{m:'c5b6',w:4},{m:'d7d5',w:4}],
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R': [{m:'d2d4',w:100}],
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R': [{m:'g8f6',w:69},{m:'d8e7',w:19},{m:'d7d6',w:6},{m:'f7f5',w:6}],
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R': [{m:'g8f6',w:67},{m:'f7f5',w:33}],
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R': [{m:'b2b4',w:51},{m:'c2c3',w:35},{m:'d2d3',w:8},{m:'c4f7',w:2},{m:'d2d4',w:2},{m:'b1c3',w:2}],
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2BPP3/2P2N2/P4PPP/RNBQK2R': [{m:'e5d4',w:100}],
  'r1bqk1nr/pppp1ppp/2n5/2b5/2BpP3/2P2N2/P4PPP/RNBQ1RK1': [{m:'d7d6',w:100}],
  'r1bqk1nr/pppp1ppp/2n5/2b5/2BpP3/2P2N2/P4PPP/RNBQK2R': [{m:'e1g1',w:100}],
  'r1bqk1nr/pppp1ppp/2n5/2b5/3NP3/4B3/PPP2PPP/RN1QKB1R': [{m:'d8f6',w:100}],
  'r1bqk1nr/pppp1ppp/2n5/2b5/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'c1e3',w:60},{m:'d4b3',w:30},{m:'d4c6',w:10}],
  'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R': [{m:'b4a5',w:57},{m:'b4c5',w:29},{m:'b4e7',w:10},{m:'b4d6',w:5}],
  'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/5N2/P1PP1PPP/RNBQK2R': [{m:'c2c3',w:100}],
  'r1bqk1nr/pppp1ppp/2n5/b3p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R': [{m:'d2d4',w:82},{m:'e1g1',w:18}],
  'r1bqk1nr/pppp1ppp/2n5/b3p3/2BPP3/2P2N2/P4PPP/RNBQK2R': [{m:'e5d4',w:56},{m:'d7d6',w:33},{m:'b7b5',w:11}],
  'r1bqk1nr/pppp1ppp/2n5/b7/2BpP3/2P2N2/P4PPP/RNBQ1RK1': [{m:'b7b5',w:25},{m:'d7d6',w:25},{m:'d4c3',w:25},{m:'g8e7',w:25}],
  'r1bqk1nr/pppp1ppp/2n5/b7/2BpP3/2P2N2/P4PPP/RNBQK2R': [{m:'e1g1',w:100}],
  'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1': [{m:'f1e1',w:87},{m:'d1e2',w:5},{m:'d2d4',w:4},{m:'a4c6',w:2},{m:'b1c3',w:2}],
  'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQR1K1': [{m:'b7b5',w:94},{m:'d7d6',w:6}],
  'r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1': [{m:'c2c3',w:97},{m:'d2d4',w:3}],
  'r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1': [{m:'e8g8',w:96},{m:'c6a5',w:4}],
  'r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1': [{m:'d7d6',w:70},{m:'e8g8',w:26},{m:'c8b7',w:5}],
  'r1bqk2r/2ppbppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQR1K1': [{m:'a4b3',w:100}],
  'r1bqk2r/p1ppbppp/2pn4/4p3/3P4/5N2/PPP1QPPP/RNB2RK1': [{m:'d4e5',w:100}],
  'r1bqk2r/p1ppbppp/2pn4/4P3/8/5N2/PPP1QPPP/RNB2RK1': [{m:'d6b7',w:80},{m:'d6f5',w:20}],
  'r1bqk2r/pnppbppp/2p5/4P3/8/5N2/PPP1QPPP/RNB2RK1': [{m:'b2b3',w:25},{m:'c2c4',w:25},{m:'b1c3',w:25},{m:'f3d4',w:25}],
  'r1bqk2r/pp1n1ppp/2pbpn2/3p4/2PP4/2N1PN2/PPQ2PPP/R1B1KB1R': [{m:'e3e4',w:67},{m:'g2g4',w:33}],
  'r1bqk2r/pp1p1ppp/2n1p3/2P5/1bP1n3/1QN2N2/PP1BPPPP/R3KB1R': [{m:'e4c5',w:50},{m:'e4d2',w:50}],
  'r1bqk2r/pp1p1ppp/2n1p3/2P5/1bP1n3/1QN2N2/PP2PPPP/R1B1KB1R': [{m:'c1d2',w:100}],
  'r1bqk2r/pp1p1ppp/2n1pn2/2P5/1bP5/1QN2N2/PP2PPPP/R1B1KB1R': [{m:'f6e4',w:100}],
  'r1bqk2r/pp1p1ppp/2n1pn2/2P5/1bP5/1QN5/PP2PPPP/R1B1KBNR': [{m:'g1f3',w:100}],
  'r1bqk2r/pp1pppbp/2n2np1/2p5/2P5/2N2NP1/PP1PPPBP/R1BQ1RK1': [{m:'e8g8',w:100}],
  'r1bqk2r/pp1pppbp/2n2np1/2p5/2P5/2N2NP1/PP1PPPBP/R1BQK2R': [{m:'e1g1',w:100}],
  'r1bqk2r/pp2bppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQ1RK1': [{m:'e8g8',w:100}],
  'r1bqk2r/pp2bppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQK2R': [{m:'e1g1',w:100}],
  'r1bqk2r/pp2ppbp/2np1np1/8/3NP3/2N1B3/PPP1BPPP/R2Q1RK1': [{m:'e8g8',w:100}],
  'r1bqk2r/pp2ppbp/2np1np1/8/3NP3/2N1B3/PPP1BPPP/R2QK2R': [{m:'e1g1',w:67},{m:'d1d2',w:22},{m:'d4b3',w:11}],
  'r1bqk2r/ppp1bppp/2n5/3p4/3Pn3/3B1N2/PPP2PPP/RNBQ1RK1': [{m:'c2c4',w:50},{m:'f1e1',w:50}],
  'r1bqk2r/pppp1ppp/2n2n2/1B2p3/1b2P3/2N2N2/PPPP1PPP/R1BQ1RK1': [{m:'e8g8',w:100}],
  'r1bqk2r/pppp1ppp/2n2n2/1B2p3/1b2P3/2N2N2/PPPP1PPP/R1BQK2R': [{m:'e1g1',w:100}],
  'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R': [{m:'d2d4',w:70},{m:'b2b4',w:10},{m:'d2d3',w:10},{m:'e1g1',w:10}],
  'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R': [{m:'e5d4',w:100}],
  'r1bqk2r/pppp1ppp/2n2n2/2b5/2BpP3/2P2N2/PP3PPP/RNBQK2R': [{m:'c3d4',w:83},{m:'e1g1',w:17}],
  'r1bqk2r/pppp1ppp/2n2n2/2b5/2BPP3/5N2/PP3PPP/RNBQK2R': [{m:'c5b4',w:100}],
  'r1bqk2r/pppp1ppp/2n2n2/2b5/2BpP3/5N2/PPP2PPP/RNBQ1RK1': [{m:'e4e5',w:100}],
  'r1bqk2r/pppp1ppp/2n2n2/4p3/1b1PP3/2N2N2/PPP2PPP/R1BQKB1R': [{m:'f3e5',w:67},{m:'d4d5',w:33}],
  'r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/2N2N2/PP3PPP/R1BQK2R': [{m:'f6e4',w:100}],
  'r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/5N2/PP3PPP/RNBQK2R': [{m:'b1c3',w:75},{m:'e1f1',w:25}],
  'r1bqk2r/pppp1ppp/2n5/8/1bBPn3/2N2N2/PP3PPP/R1BQ1RK1': [{m:'b4c3',w:67},{m:'e4c3',w:33}],
  'r1bqk2r/pppp1ppp/2n5/8/1bBPn3/2N2N2/PP3PPP/R1BQK2R': [{m:'e1g1',w:100}],
  'r1bqk2r/ppppbppp/2Bn4/4p3/3P4/5N2/PPP1QPPP/RNB2RK1': [{m:'b7c6',w:100}],
  'r1bqk2r/ppppbppp/2n5/1B2p3/3Pn3/5N2/PPP1QPPP/RNB2RK1': [{m:'e4d6',w:83},{m:'d7d5',w:17}],
  'r1bqk2r/ppppbppp/2n5/1B2p3/3Pn3/5N2/PPP2PPP/RNBQ1RK1': [{m:'d1e2',w:86},{m:'d4e5',w:14}],
  'r1bqk2r/ppppbppp/2nn4/1B2p3/3P4/5N2/PPP1QPPP/RNB2RK1': [{m:'b5c6',w:100}],
  'r1bqkb1r/1p3ppp/p1np1n2/1N2p1B1/4P3/2N5/PPP2PPP/R2QKB1R': [{m:'b5a3',w:100}],
  'r1bqkb1r/1p3ppp/p1np1n2/4p1B1/4P3/N1N5/PPP2PPP/R2QKB1R': [{m:'b7b5',w:67},{m:'c8e6',w:33}],
  'r1bqkb1r/1p3ppp/p1nppn2/6B1/3NP3/2N5/PPPQ1PPP/2KR1B1R': [{m:'c8d7',w:100}],
  'r1bqkb1r/1p3ppp/p1nppn2/6B1/3NP3/2N5/PPPQ1PPP/R3KB1R': [{m:'e1c1',w:100}],
  'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1': [{m:'f8e7',w:62},{m:'f6e4',w:30},{m:'b7b5',w:4}],
  'r1bqkb1r/1ppp1ppp/p1n5/4p3/B2Pn3/5N2/PPP2PPP/RNBQ1RK1': [{m:'b7b5',w:96},{m:'e5d4',w:4}],
  'r1bqkb1r/1ppp1ppp/p1n5/4p3/B3n3/5N2/PPPP1PPP/RNBQ1RK1': [{m:'d2d4',w:88},{m:'b1c3',w:4},{m:'d1e2',w:4},{m:'f1e1',w:4}],
  'r1bqkb1r/2p2ppp/p1n5/1p1pp3/3Pn3/1B3N2/PPP2PPP/RNBQ1RK1': [{m:'d4e5',w:85},{m:'a2a4',w:10},{m:'c2c4',w:5}],
  'r1bqkb1r/2p2ppp/p1n5/1p1pP3/4n3/1B3N2/PPP2PPP/RNBQ1RK1': [{m:'c8e6',w:94},{m:'c6e7',w:6}],
  'r1bqkb1r/2pp1ppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQ1RK1': [{m:'c8b7',w:33},{m:'f8e7',w:33},{m:'d7d6',w:33}],
  'r1bqkb1r/2pp1ppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1': [{m:'a4b3',w:100}],
  'r1bqkb1r/2pp1ppp/p1n5/1p2p3/3Pn3/1B3N2/PPP2PPP/RNBQ1RK1': [{m:'d7d5',w:100}],
  'r1bqkb1r/2pp1ppp/p1n5/1p2p3/B2Pn3/5N2/PPP2PPP/RNBQ1RK1': [{m:'a4b3',w:91},{m:'d4d5',w:5},{m:'f3e5',w:5}],
  'r1bqkb1r/3n1ppp/p1p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R': [{m:'e3e4',w:86},{m:'e1g1',w:14}],
  'r1bqkb1r/3n1ppp/p1p1pn2/1p6/3PP3/2NB1N2/PP3PPP/R1BQK2R': [{m:'c6c5',w:80},{m:'b5b4',w:20}],
  'r1bqkb1r/3n1ppp/p3pn2/1p2P3/3p4/2NB1N2/PP3PPP/R1BQK2R': [{m:'c3b5',w:100}],
  'r1bqkb1r/3n1ppp/p3pn2/1pp1P3/3P4/2NB1N2/PP3PPP/R1BQK2R': [{m:'c5d4',w:100}],
  'r1bqkb1r/3n1ppp/p3pn2/1pp5/3PP3/2NB1N2/PP3PPP/R1BQK2R': [{m:'e4e5',w:100}],
  'r1bqkb1r/p2n1ppp/2p1pn2/1p6/2BP4/2N1PN2/PP3PPP/R1BQK2R': [{m:'c4d3',w:100}],
  'r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R': [{m:'a7a6',w:73},{m:'c8b7',w:18},{m:'b5b4',w:9}],
  'r1bqkb1r/p4ppp/2p2n2/nB2p1N1/8/8/PPPP1PPP/RNBQK2R': [{m:'b5e2',w:60},{m:'d1f3',w:40}],
  'r1bqkb1r/pp1n1ppp/2p1pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR': [{m:'g1f3',w:100}],
  'r1bqkb1r/pp1n1ppp/2p1pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R': [{m:'d8a5',w:100}],
  'r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R': [{m:'f1d3',w:76},{m:'d1c2',w:19},{m:'f3e5',w:5}],
  'r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2N1PN2/PPQ2PPP/R1B1KB1R': [{m:'f8d6',w:100}],
  'r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R': [{m:'d5c4',w:80},{m:'f8b4',w:7},{m:'f8d6',w:7},{m:'f8e7',w:7}],
  'r1bqkb1r/pp1n1ppp/2p1pn2/8/2BP4/2N1PN2/PP3PPP/R1BQK2R': [{m:'b7b5',w:100}],
  'r1bqkb1r/pp1n1ppp/2p1pn2/8/2pP4/2NBPN2/PP3PPP/R1BQK2R': [{m:'d3c4',w:100}],
  'r1bqkb1r/pp1p1ppp/2n1pn2/1N6/4P3/2N5/PPP2PPP/R1BQKB1R': [{m:'f8b4',w:67},{m:'f8c5',w:33}],
  'r1bqkb1r/pp1p1ppp/2n1pn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'d4b5',w:100}],
  'r1bqkb1r/pp1p1ppp/2n2n2/1N2p3/4P3/2N5/PPP2PPP/R1BQKB1R': [{m:'d7d6',w:100}],
  'r1bqkb1r/pp1p1ppp/2n2n2/4p3/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'d4b5',w:80},{m:'d4f3',w:20}],
  'r1bqkb1r/pp1ppppp/2n2n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'e7e5',w:100}],
  'r1bqkb1r/pp1ppppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'b1c3',w:100}],
  'r1bqkb1r/pp2pppp/2n2n2/3p2B1/2PP4/2N5/PP3PPP/R2QKBNR': [{m:'e7e6',w:33},{m:'d8a5',w:33},{m:'d8b6',w:33}],
  'r1bqkb1r/pp2pppp/2n2n2/3p4/2PP4/2N5/PP3PPP/R1BQKBNR': [{m:'c1g5',w:100}],
  'r1bqkb1r/pp2pppp/2np1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R': [{m:'e7e6',w:92},{m:'g7g6',w:8}],
  'r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP1BPPP/R1BQK2R': [{m:'e7e5',w:100}],
  'r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'c1g5',w:61},{m:'f1e2',w:17},{m:'f1c4',w:9},{m:'f1d3',w:4},{m:'g2g3',w:4},{m:'d4e2',w:4}],
  'r1bqkb1r/pp3ppp/2n2n2/2pp4/3P4/2N2NP1/PP2PP1P/R1BQKB1R': [{m:'f1g2',w:100}],
  'r1bqkb1r/pp3ppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQK2R': [{m:'f8e7',w:90},{m:'c8g4',w:10}],
  'r1bqkb1r/pp3ppp/2np1n2/1N2p1B1/4P3/2N5/PPP2PPP/R2QKB1R': [{m:'a7a6',w:100}],
  'r1bqkb1r/pp3ppp/2np1n2/1N2p3/4P3/2N5/PPP2PPP/R1BQKB1R': [{m:'c1g5',w:100}],
  'r1bqkb1r/pp3ppp/2nppn2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R': [{m:'d1d2',w:73},{m:'f1b5',w:9},{m:'d4b3',w:9},{m:'d4c6',w:9}],
  'r1bqkb1r/pp3ppp/2nppn2/6B1/3NP3/2N5/PPPQ1PPP/R3KB1R': [{m:'a7a6',w:57},{m:'f8e7',w:29},{m:'d8b6',w:14}],
  'r1bqkb1r/pp3ppp/2nppn2/8/2BNP3/2N5/PPP2PPP/R1BQK2R': [{m:'c1e3',w:100}],
  'r1bqkb1r/pp3ppp/2p2n2/nB1Pp1N1/8/8/PPPP1PPP/RNBQK2R': [{m:'d5c6',w:100}],
  'r1bqkb1r/pp3ppp/2P2n2/nB2p1N1/8/8/PPPP1PPP/RNBQK2R': [{m:'b7c6',w:100}],
  'r1bqkb1r/ppp2ppp/2n2n2/3pp1N1/2B1P3/8/PPPP1PPP/RNBQK2R': [{m:'e4d5',w:100}],
  'r1bqkb1r/ppp2ppp/2n2n2/3Pp1N1/2B5/8/PPPP1PPP/RNBQK2R': [{m:'c6a5',w:53},{m:'b7b5',w:13},{m:'c6d4',w:13},{m:'f6d5',w:13},{m:'c6b4',w:7}],
  'r1bqkb1r/ppp2ppp/2np1n2/1B2p3/3PP3/5N2/PPP2PPP/RNBQ1RK1': [{m:'c8d7',w:100}],
  'r1bqkb1r/ppp2ppp/2np1n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1': [{m:'d2d4',w:100}],
  'r1bqkb1r/ppp2ppp/5n2/n2Pp1N1/2B5/8/PPPP1PPP/RNBQK2R': [{m:'c4b5',w:71},{m:'d2d3',w:29}],
  'r1bqkb1r/ppp2ppp/5n2/nB1Pp1N1/8/8/PPPP1PPP/RNBQK2R': [{m:'c7c6',w:100}],
  'r1bqkb1r/pppn1ppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR': [{m:'c7c6',w:67},{m:'f8b4',w:33}],
  'r1bqkb1r/pppn1ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR': [{m:'e2e3',w:75},{m:'g1f3',w:25}],
  'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/2N2N2/PPPP1PPP/R1BQK2R': [{m:'f8b4',w:71},{m:'f8c5',w:14},{m:'a7a6',w:7},{m:'c6d4',w:7}],
  'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/3P1N2/PPP2PPP/RNBQK2R': [{m:'d7d6',w:40},{m:'c6e7',w:40},{m:'f8c5',w:20}],
  'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1': [{m:'f6e4',w:60},{m:'d7d6',w:30},{m:'f8c5',w:5},{m:'f6g4',w:5}],
  'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R': [{m:'e1g1',w:77},{m:'d2d3',w:19},{m:'d2d4',w:4}],
  'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R': [{m:'d7d5',w:83},{m:'f8c5',w:11},{m:'f6e4',w:6}],
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R': [{m:'f3g5',w:63},{m:'d2d4',w:30},{m:'c2c3',w:3},{m:'d2d3',w:3}],
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R': [{m:'e5d4',w:100}],
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2P5/2N2N2/PP1PPPPP/R1BQKB1R': [{m:'e2e3',w:33},{m:'d2d4',w:22},{m:'a2a3',w:11},{m:'d2d3',w:11},{m:'e2e4',w:11},{m:'g2g3',w:11}],
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/3PP3/2N2N2/PPP2PPP/R1BQKB1R': [{m:'f8b4',w:60},{m:'e5d4',w:40}],
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R': [{m:'f1b5',w:58},{m:'d2d4',w:23},{m:'a2a3',w:8},{m:'f1c4',w:8},{m:'f3e5',w:4}],
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R': [{m:'f1c4',w:33},{m:'d2d3',w:33},{m:'d2d4',w:33}],
  'r1bqkb1r/pppp1ppp/2n2n2/8/2BpP3/5N2/PPP2PPP/RNBQ1RK1': [{m:'f8c5',w:50},{m:'f6e4',w:50}],
  'r1bqkb1r/pppp1ppp/2n2n2/8/2BpP3/5N2/PPP2PPP/RNBQK2R': [{m:'e1g1',w:88},{m:'f3g5',w:13}],
  'r1bqkb1r/pppp1ppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'d4c6',w:50},{m:'e4e5',w:25},{m:'b1c3',w:25}],
  'r1bqkb1r/pppp1ppp/2n5/1B2p3/3Pn3/5N2/PPP2PPP/RNBQ1RK1': [{m:'f8e7',w:73},{m:'e4d6',w:18},{m:'a7a6',w:9}],
  'r1bqkb1r/pppp1ppp/2n5/1B2p3/4n3/5N2/PPPP1PPP/RNBQ1RK1': [{m:'d2d4',w:100}],
  'r1bqkbnr/1pp2ppp/p1Bp4/4p3/4P3/5N2/PPPP1PPP/RNBQK2R': [{m:'b7c6',w:100}],
  'r1bqkbnr/1pp2ppp/p1np4/4p3/B3P3/2P2N2/PP1P1PPP/RNBQK2R': [{m:'c8d7',w:50},{m:'f7f5',w:50}],
  'r1bqkbnr/1pp2ppp/p1np4/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R': [{m:'c2c3',w:45},{m:'a4c6',w:27},{m:'c2c4',w:9},{m:'d2d4',w:9},{m:'e1g1',w:9}],
  'r1bqkbnr/1pp2ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQ1RK1': [{m:'f8d6',w:25},{m:'c8g4',w:25},{m:'f7f6',w:25},{m:'d8d6',w:25}],
  'r1bqkbnr/1pp2ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R': [{m:'e1g1',w:83},{m:'d2d4',w:17}],
  'r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R': [{m:'d7c6',w:67},{m:'b7c6',w:33}],
  'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R': [{m:'b5a4',w:93},{m:'b5c6',w:7}],
  'r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R': [{m:'g8f6',w:83},{m:'d7d6',w:11},{m:'b7b5',w:3},{m:'f7f5',w:2}],
  'r1bqkbnr/2pp1ppp/p1n5/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQK2R': [{m:'c6a5',w:67},{m:'f8c5',w:33}],
  'r1bqkbnr/2pp1ppp/p1n5/1p2p3/B3P3/5N2/PPPP1PPP/RNBQK2R': [{m:'a4b3',w:100}],
  'r1bqkbnr/pp1n1ppp/2pp4/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R': [{m:'e1g1',w:50},{m:'c2c3',w:25},{m:'b1c3',w:25}],
  'r1bqkbnr/pp1npppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR': [{m:'f1c4',w:50},{m:'g1f3',w:25},{m:'e4g5',w:25}],
  'r1bqkbnr/pp1p1ppp/2n1p3/8/2B1P3/2N2N2/PP3PPP/R1BQK2R': [{m:'a7a6',w:50},{m:'f8b4',w:17},{m:'f8c5',w:17},{m:'d7d6',w:17}],
  'r1bqkbnr/pp1p1ppp/2n1p3/8/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'d8c7',w:50},{m:'a7a6',w:25},{m:'g8f6',w:25}],
  'r1bqkbnr/pp1p1ppp/2n1p3/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'b1c3',w:82},{m:'d4b5',w:18}],
  'r1bqkbnr/pp1p1ppp/2n1p3/8/4P3/2N2N2/PP3PPP/R1BQKB1R': [{m:'f1c4',w:100}],
  'r1bqkbnr/pp1ppp1p/2n3p1/1Bp5/4P3/5N2/PPPP1PPP/RNBQ1RK1': [{m:'f8g7',w:100}],
  'r1bqkbnr/pp1ppp1p/2n3p1/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R': [{m:'e1g1',w:100}],
  'r1bqkbnr/pp1ppp1p/2n3p1/2p5/2P5/2N3P1/PP1PPP1P/R1BQKBNR': [{m:'f1g2',w:100}],
  'r1bqkbnr/pp1ppp1p/2n3p1/2p5/2P5/2N3P1/PP1PPPBP/R1BQK1NR': [{m:'f8g7',w:100}],
  'r1bqkbnr/pp1ppp1p/2n3p1/2p5/4P3/2N3P1/PPPP1P1P/R1BQKBNR': [{m:'f1g2',w:100}],
  'r1bqkbnr/pp1ppp1p/2n3p1/2p5/4P3/2N3P1/PPPP1PBP/R1BQK1NR': [{m:'f8g7',w:100}],
  'r1bqkbnr/pp1ppp1p/2n3p1/8/2PNP3/8/PP3PPP/RNBQKB1R': [{m:'f8g7',w:75},{m:'g8f6',w:25}],
  'r1bqkbnr/pp1ppp1p/2n3p1/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'c2c4',w:83},{m:'b1c3',w:17}],
  'r1bqkbnr/pp1ppppp/2n5/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R': [{m:'g7g6',w:80},{m:'c6a5',w:20}],
  'r1bqkbnr/pp1ppppp/2n5/2p5/2P5/2N3P1/PP1PPP1P/R1BQKBNR': [{m:'g7g6',w:100}],
  'r1bqkbnr/pp1ppppp/2n5/2p5/2P5/2N5/PP1PPPPP/R1BQKBNR': [{m:'g2g3',w:100}],
  'r1bqkbnr/pp1ppppp/2n5/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'c5d4',w:100}],
  'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N3P1/PPPP1P1P/R1BQKBNR': [{m:'g7g6',w:100}],
  'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR': [{m:'g2g3',w:56},{m:'f2f4',w:22},{m:'d2d3',w:11},{m:'g1e2',w:11}],
  'r1bqkbnr/pp1ppppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'g8f6',w:40},{m:'g7g6',w:35},{m:'e7e5',w:10},{m:'d7d5',w:5},{m:'d8b6',w:5},{m:'d8c7',w:5}],
  'r1bqkbnr/pp1ppppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R': [{m:'f3d4',w:100}],
  'r1bqkbnr/pp1ppppp/2n5/8/4P3/2N2N2/PP3PPP/R1BQKB1R': [{m:'e7e6',w:75},{m:'d7d6',w:25}],
  'r1bqkbnr/pp1ppppp/2n5/8/4P3/2N5/PP3PPP/R1BQKBNR': [{m:'g1f3',w:100}],
  'r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R': [{m:'d8b6',w:75},{m:'c8d7',w:25}],
  'r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P5/PP3PPP/RNBQKBNR': [{m:'g1f3',w:100}],
  'r1bqkbnr/pp3ppp/2n5/2pp4/3P4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'g2g3',w:93},{m:'d4c5',w:7}],
  'r1bqkbnr/pp3ppp/2n5/2pp4/3P4/2N2NP1/PP2PP1P/R1BQKB1R': [{m:'g8f6',w:92},{m:'c5c4',w:8}],
  'r1bqkbnr/ppp1pppp/2n5/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'d5c4',w:33},{m:'e7e5',w:33},{m:'g8f6',w:33}],
  'r1bqkbnr/ppp1pppp/2n5/3p4/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'b1c3',w:43},{m:'c4d5',w:29},{m:'g1f3',w:29}],
  'r1bqkbnr/ppp1pppp/2n5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR': [{m:'d5e4',w:33},{m:'a7a6',w:17},{m:'e7e5',w:17},{m:'g7g6',w:17},{m:'g8f6',w:17}],
  'r1bqkbnr/ppp1pppp/2n5/3p4/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'b1c3',w:70},{m:'e4d5',w:20},{m:'c1e3',w:10}],
  'r1bqkbnr/ppp2ppp/2n5/3pp3/4P3/2P2N2/PP1P1PPP/RNBQKB1R': [{m:'d1a4',w:60},{m:'f1b5',w:40}],
  'r1bqkbnr/ppp2ppp/2n5/3pp3/Q3P3/2P2N2/PP1P1PPP/RNB1KB1R': [{m:'c8d7',w:33},{m:'f7f6',w:33},{m:'g8f6',w:33}],
  'r1bqkbnr/pppn1ppp/3p4/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R': [{m:'c7c6',w:80},{m:'d7b6',w:20}],
  'r1bqkbnr/pppn1ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'f1c4',w:83},{m:'b1c3',w:17}],
  'r1bqkbnr/pppp1p1p/2n3p1/4p3/2P5/2N3P1/PP1PPP1P/R1BQKBNR': [{m:'f1g2',w:100}],
  'r1bqkbnr/pppp1p1p/2n3p1/4p3/2P5/2N3P1/PP1PPPBP/R1BQK1NR': [{m:'f8g7',w:100}],
  'r1bqkbnr/pppp1p1p/2n5/6p1/4Pp2/2N2N2/PPPP2PP/R1BQKB1R': [{m:'h2h4',w:50},{m:'f1c4',w:25},{m:'d2d4',w:25}],
  'r1bqkbnr/pppp1ppp/2n5/4p3/2P5/2N2N2/PP1PPPPP/R1BQKB1R': [{m:'g8f6',w:100}],
  'r1bqkbnr/pppp1ppp/2n5/4p3/2P5/2N3P1/PP1PPP1P/R1BQKBNR': [{m:'g7g6',w:100}],
  'r1bqkbnr/pppp1ppp/2n5/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR': [{m:'g1f3',w:58},{m:'g2g3',w:42}],
  'r1bqkbnr/pppp1ppp/2n5/4p3/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'d4d5',w:67},{m:'d4e5',w:33}],
  'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'e5d4',w:94},{m:'c6d4',w:6}],
  'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'d4e5',w:88},{m:'d4d5',w:13}],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R': [{m:'g8f6',w:87},{m:'g7g6',w:6},{m:'f8b4',w:3},{m:'f7f5',w:3}],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR': [{m:'f2f4',w:70},{m:'f1c4',w:10},{m:'d2d4',w:10},{m:'g2g3',w:10}],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R': [{m:'d7d5',w:45},{m:'g8f6',w:36},{m:'f7f5',w:18}],
  'r1bqkbnr/pppp1ppp/2n5/4P3/4P3/8/PPP2PPP/RNBQKBNR': [{m:'c6e5',w:43},{m:'f8c5',w:14},{m:'d7d6',w:14},{m:'f7f6',w:14},{m:'d8h4',w:14}],
  'r1bqkbnr/pppp1ppp/2n5/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR': [{m:'e5f4',w:92},{m:'f8c5',w:8}],
  'r1bqkbnr/pppp1ppp/2n5/4P3/8/5N2/PPP1PPPP/RNBQKB1R': [{m:'d8e7',w:33},{m:'f8c5',w:17},{m:'f7f6',w:17},{m:'h7h6',w:17},{m:'g8e7',w:17}],
  'r1bqkbnr/pppp1ppp/2n5/4P3/8/8/PPP1PPPP/RNBQKBNR': [{m:'g1f3',w:100}],
  'r1bqkbnr/pppp1ppp/2n5/8/2BpP3/5N2/PPP2PPP/RNBQK2R': [{m:'f8c5',w:50},{m:'f8b4',w:25},{m:'f8e7',w:25}],
  'r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'f8c5',w:48},{m:'d8h4',w:30},{m:'g8f6',w:17},{m:'f8b4',w:4}],
  'r1bqkbnr/pppp1ppp/2n5/8/3pP3/2P2N2/PP3PPP/RNBQKB1R': [{m:'d4c3',w:67},{m:'d7d5',w:33}],
  'r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R': [{m:'f3d4',w:71},{m:'f1c4',w:15},{m:'c2c3',w:12},{m:'f1b5',w:3}],
  'r1bqkbnr/pppp1ppp/2n5/8/3PPp2/2N5/PPP3PP/R1BQKBNR': [{m:'d8h4',w:100}],
  'r1bqkbnr/pppp1ppp/2n5/8/3QP3/8/PPP2PPP/RNB1KBNR': [{m:'d4e3',w:75},{m:'d4c4',w:25}],
  'r1bqkbnr/pppp1ppp/2n5/8/4Pp2/2N2N2/PPPP2PP/R1BQKB1R': [{m:'g7g5',w:80},{m:'f8e7',w:20}],
  'r1bqkbnr/pppp1ppp/2n5/8/4Pp2/2N5/PPPP2PP/R1BQKBNR': [{m:'g1f3',w:55},{m:'d2d4',w:45}],
  'r1bqkbnr/pppp1ppp/8/4n3/4P3/8/PPP2PPP/RNBQKBNR': [{m:'f2f4',w:33},{m:'b1c3',w:33},{m:'g1f3',w:33}],
  'r1bqkbnr/pppp2pp/2n5/1B2p3/4N3/5N2/PPPP1PPP/R1BQK2R': [{m:'f8e7',w:33},{m:'d7d5',w:33},{m:'g8f6',w:33}],
  'r1bqkbnr/pppp2pp/2n5/1B2p3/4p3/2N2N2/PPPP1PPP/R1BQK2R': [{m:'c3e4',w:100}],
  'r1bqkbnr/pppp2pp/2n5/1B2pp2/4P3/2N2N2/PPPP1PPP/R1BQK2R': [{m:'f5e4',w:60},{m:'c6d4',w:20},{m:'g8f6',w:20}],
  'r1bqkbnr/pppp2pp/2n5/1B2pp2/4P3/5N2/PPPP1PPP/RNBQK2R': [{m:'b1c3',w:67},{m:'b5c6',w:11},{m:'d2d4',w:11},{m:'e4f5',w:11}],
  'r1bqkbnr/pppppppp/2n5/8/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'e7e5',w:100}],
  'r1bqkbnr/pppppppp/2n5/8/3P4/8/PPP1PPPP/RNBQKBNR': [{m:'c2c4',w:60},{m:'d4d5',w:40}],
  'r1bqkbnr/pppppppp/2n5/8/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'d7d5',w:46},{m:'e7e5',w:38},{m:'d7d6',w:4},{m:'e7e6',w:4},{m:'f7f6',w:4},{m:'g7g6',w:4}],
  'r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R': [{m:'f7f5',w:40},{m:'d7d6',w:20},{m:'e7e6',w:20},{m:'g8f6',w:20}],
  'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR': [{m:'d2d4',w:75},{m:'g1f3',w:16},{m:'b2b4',w:3},{m:'f1b5',w:3},{m:'b1c3',w:3}],
  'r2qk2r/2p2ppp/p1n1b3/1pbpP3/4n3/1BP2N2/PP3PPP/RNBQ1RK1': [{m:'b1d2',w:50},{m:'d1d3',w:50}],
  'r2qk2r/pppbbppp/2np1n2/1B2p3/3PP3/2N2N2/PPP2PPP/R1BQ1RK1': [{m:'c1g5',w:33},{m:'b5c6',w:33},{m:'f1e1',w:33}],
  'r2qkb1r/2p2ppp/p1n1b3/1p1pP3/4n3/1B3N2/PPP2PPP/RNBQ1RK1': [{m:'c2c3',w:64},{m:'d1e2',w:21},{m:'b1d2',w:14}],
  'r2qkb1r/2p2ppp/p1n1b3/1p1pP3/4n3/1BP2N2/PP3PPP/RNBQ1RK1': [{m:'f8c5',w:63},{m:'f8e7',w:25},{m:'e4c5',w:13}],
  'r2qkb1r/pppb1ppp/2np1n2/1B2p3/3PP3/2N2N2/PPP2PPP/R1BQ1RK1': [{m:'f8e7',w:80},{m:'e5d4',w:20}],
  'r2qkb1r/pppb1ppp/2np1n2/1B2p3/3PP3/5N2/PPP2PPP/RNBQ1RK1': [{m:'b1c3',w:100}],
  'rn1q1rk1/pbppbppp/1p2pn2/8/2PP4/5NP1/PP2PPBP/RNBQ1RK1': [{m:'b1c3',w:43},{m:'d4d5',w:29},{m:'b2b3',w:14},{m:'f1e1',w:14}],
  'rn1q1rk1/ppp1ppbp/5np1/8/2QPP1b1/2N2N2/PP3PPP/R1B1KB1R': [{m:'c1e3',w:67},{m:'f1e2',w:33}],
  'rn1qk2r/pbppbppp/1p2pn2/8/2PP4/5NP1/PP2PPBP/RNBQ1RK1': [{m:'e8g8',w:100}],
  'rn1qk2r/pbppbppp/1p2pn2/8/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'e1g1',w:80},{m:'b1c3',w:20}],
  'rn1qkb1r/3ppppp/b4n2/2pP4/8/2N5/PP2PPPP/R1BQKBNR': [{m:'d7d6',w:75},{m:'g7g6',w:25}],
  'rn1qkb1r/3ppppp/b4n2/2pP4/8/8/PP2PPPP/RNBQKBNR': [{m:'b1c3',w:100}],
  'rn1qkb1r/4pppp/b2p1n2/2pP4/8/2N5/PP2PPPP/R1BQKBNR': [{m:'e2e4',w:67},{m:'f2f4',w:33}],
  'rn1qkb1r/p1pp1ppp/bp2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R': [{m:'b2b3',w:33},{m:'d1a4',w:33},{m:'d1b3',w:33}],
  'rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'a2a3',w:60},{m:'c1g5',w:40}],
  'rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R': [{m:'f1g2',w:100}],
  'rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'f8e7',w:61},{m:'f8b4',w:17},{m:'c7c5',w:17},{m:'d8c8',w:6}],
  'rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/P1N2N2/1P2PPPP/R1BQKB1R': [{m:'d7d5',w:67},{m:'g7g6',w:33}],
  'rn1qkb1r/pp2pppp/2p2n2/3p1b2/2PP4/4PN2/PP3PPP/RNBQKB1R': [{m:'c4d5',w:100}],
  'rn1qkb1r/pp2pppp/2p2n2/3P1b2/3P4/4PN2/PP3PPP/RNBQKB1R': [{m:'c6d5',w:100}],
  'rn1qkb1r/pp2pppp/2p2n2/4Nb2/P1pP4/2N5/1P2PPPP/R1BQKB1R': [{m:'e7e6',w:50},{m:'b8a6',w:25},{m:'b8d7',w:25}],
  'rn1qkb1r/pp2pppp/2p2n2/5b2/P1pP4/2N2N2/1P2PPPP/R1BQKB1R': [{m:'f3e5',w:56},{m:'e2e3',w:33},{m:'f3h4',w:11}],
  'rn1qkb1r/pp2pppp/5n2/3p1b2/3P4/4PN2/PP3PPP/RNBQKB1R': [{m:'d1b3',w:67},{m:'b1c3',w:33}],
  'rn1qkb1r/ppp1pppp/3p4/3nP3/3P2b1/5N2/PPP2PPP/RNBQKB1R': [{m:'f1e2',w:33},{m:'c2c4',w:33},{m:'h2h3',w:33}],
  'rn1qkb1r/ppp1pppp/5n2/5b2/3Pp3/2N2P2/PPP3PP/R1BQKBNR': [{m:'f1c4',w:29},{m:'g2g4',w:29},{m:'c1f4',w:14},{m:'d4d5',w:14},{m:'f3e4',w:14}],
  'rn1qkbnr/pbpp1ppp/1p2p3/8/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'e2e4',w:100}],
  'rn1qkbnr/pbpp1ppp/1p2p3/8/2PPP3/2N5/PP3PPP/R1BQKBNR': [{m:'f7f5',w:100}],
  'rn1qkbnr/pbpp2pp/1p2p3/5p2/2PPP3/2N5/PP3PPP/R1BQKBNR': [{m:'e4f5',w:67},{m:'d4d5',w:33}],
  'rn1qkbnr/pbpppppp/1p6/8/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'f1d3',w:40},{m:'c1g5',w:20},{m:'f2f3',w:20},{m:'g1f3',w:20}],
  'rn1qkbnr/pp2pppp/2p3b1/8/3P4/6N1/PPP2PPP/R1BQKBNR': [{m:'h2h4',w:67},{m:'g1h3',w:33}],
  'rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/8/PPP2PPP/RNBQKBNR': [{m:'b1c3',w:29},{m:'b2b4',w:14},{m:'g2g4',w:14},{m:'h2h4',w:14},{m:'g1e2',w:14},{m:'g1f3',w:14}],
  'rn1qkbnr/pp2pppp/2p5/5b2/3P4/6N1/PPP2PPP/R1BQKBNR': [{m:'f5g6',w:100}],
  'rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR': [{m:'e4g3',w:100}],
  'rn1qkbnr/ppp1pppp/8/3p1b2/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'e7e6',w:100}],
  'rn1qkbnr/ppp1pppp/8/3p1b2/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'b1c3',w:60},{m:'c4d5',w:40}],
  'rn1qkbnr/ppp2ppp/4p3/3p1b2/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'g1f3',w:67},{m:'d1b3',w:33}],
  'rnb1k1nr/pppp1pbp/8/6p1/2B1Pp1q/2N5/PPPP2PP/R1BQ1KNR': [{m:'d2d4',w:50},{m:'g2g3',w:50}],
  'rnb1k2r/pppnqppp/4p3/3pP3/3P4/2N5/PPP2PPP/R2QKBNR': [{m:'f1d3',w:20},{m:'f2f4',w:20},{m:'c3b5',w:20},{m:'d1d2',w:20},{m:'d1g4',w:20}],
  'rnb1kbnr/ppp1pppp/8/3q4/8/2N5/PPPP1PPP/R1BQKBNR': [{m:'d5a5',w:67},{m:'d5d6',w:33}],
  'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR': [{m:'b1c3',w:100}],
  'rnb1kbnr/ppp1pppp/8/q7/3P4/2N5/PPP2PPP/R1BQKBNR': [{m:'g8f6',w:60},{m:'e7e5',w:40}],
  'rnb1kbnr/ppp1pppp/8/q7/8/2N5/PPPP1PPP/R1BQKBNR': [{m:'d2d4',w:83},{m:'b2b4',w:17}],
  'rnb1kbnr/ppp1qppp/8/8/2Bp4/1Q2P3/PP3PPP/RNB1K1NR': [{m:'e1f1',w:33},{m:'b1d2',w:33},{m:'g1f3',w:33}],
  'rnb1kbnr/ppp3pp/3p1q2/4Np2/3PP3/8/PPP2PPP/RNBQKB1R': [{m:'e5c4',w:100}],
  'rnb1kbnr/ppp3pp/3p1q2/5p2/2NPP3/8/PPP2PPP/RNBQKB1R': [{m:'f5e4',w:100}],
  'rnb1kbnr/ppp3pp/3p1q2/8/2NPp3/8/PPP2PPP/RNBQKB1R': [{m:'f1e2',w:33},{m:'c4e3',w:33},{m:'d1h5',w:33}],
  'rnb1kbnr/pppp1p1p/5q2/8/2B1Pp2/5Q2/PPPP2PP/RNB2RK1': [{m:'e4e5',w:40},{m:'b1c3',w:40},{m:'c4f7',w:20}],
  'rnb1kbnr/pppp1p1p/8/4N3/2B1Pppq/8/PPPP2PP/RNBQ1K1R': [{m:'g8h6',w:40},{m:'f4f3',w:20},{m:'b8c6',w:20},{m:'g8f6',w:20}],
  'rnb1kbnr/pppp1p1p/8/4N3/2B1Pppq/8/PPPP2PP/RNBQK2R': [{m:'e1f1',w:100}],
  'rnb1kbnr/pppp1p1p/8/6p1/2B1Pp1q/2N5/PPPP2PP/R1BQ1KNR': [{m:'f8g7',w:100}],
  'rnb1kbnr/pppp1p1p/8/6p1/2B1Pp1q/8/PPPP2PP/RNBQ1KNR': [{m:'b1c3',w:80},{m:'d1f3',w:20}],
  'rnb1kbnr/pppp1ppp/8/8/2B1Pp1q/8/PPPP2PP/RNBQ1KNR': [{m:'g7g5',w:55},{m:'b7b5',w:9},{m:'f8c5',w:9},{m:'d7d6',w:9},{m:'b8c6',w:9},{m:'g8f6',w:9}],
  'rnb1kbnr/pppp1ppp/8/8/2B1Pp1q/8/PPPP2PP/RNBQK1NR': [{m:'e1f1',w:100}],
  'rnb1kbnr/pppp2pp/5q2/4Np2/3PP3/8/PPP2PPP/RNBQKB1R': [{m:'d7d6',w:100}],
  'rnb1kbnr/pppp2pp/5q2/4Np2/4P3/8/PPPP1PPP/RNBQKB1R': [{m:'d2d4',w:63},{m:'e5c4',w:38}],
  'rnb2rk1/ppp1qpp1/4p2p/3p4/2PPn3/2N1PN2/PP3PPP/R2QKB1R': [{m:'c4d5',w:67},{m:'d1c2',w:33}],
  'rnbq1bnr/pppp1k2/7p/8/4PppP/8/PPPP2P1/RNBQKB1R': [{m:'f1c4',w:50},{m:'d2d4',w:25},{m:'d1g4',w:25}],
  'rnbq1rk1/2p1bppp/p2p1n2/1p2p3/3PP3/1BP2N1P/PP3PP1/RNBQR1K1': [{m:'b8d7',w:100}],
  'rnbq1rk1/2p1bppp/p2p1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1': [{m:'d2d4',w:100}],
  'rnbq1rk1/pp2ppbp/2pp1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1': [{m:'d8a5',w:50},{m:'c8f5',w:25},{m:'d8b6',w:25}],
  'rnbq1rk1/pp2ppbp/2pp1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQK2R': [{m:'e1g1',w:100}],
  'rnbq1rk1/pp2ppbp/3p1np1/2p5/2PPPP2/2N5/PP2B1PP/R1BQK1NR': [{m:'g1f3',w:67},{m:'d4d5',w:33}],
  'rnbq1rk1/pp2ppbp/3p1np1/8/3NP3/2N1BP2/PPP3PP/R2QKB1R': [{m:'d1d2',w:100}],
  'rnbq1rk1/pp2ppbp/3p1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R': [{m:'b8c6',w:100}],
  'rnbq1rk1/pp2ppbp/6p1/2p5/2BPP3/2P5/P3NPPP/R1BQ1RK1': [{m:'b8c6',w:100}],
  'rnbq1rk1/pp2ppbp/6p1/2p5/2BPP3/2P5/P3NPPP/R1BQK2R': [{m:'e1g1',w:100}],
  'rnbq1rk1/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP2BPPP/R1BQ1RK1': [{m:'f8e8',w:67},{m:'a7a6',w:33}],
  'rnbq1rk1/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP2BPPP/R1BQK2R': [{m:'e1g1',w:100}],
  'rnbq1rk1/pp3pbp/3p1np1/2pP4/8/2N2NP1/PP2PPBP/R1BQ1RK1': [{m:'a7a6',w:67},{m:'b8d7',w:33}],
  'rnbq1rk1/pp3pbp/3p1np1/2pP4/8/2N2NP1/PP2PPBP/R1BQK2R': [{m:'e1g1',w:100}],
  'rnbq1rk1/pp3ppp/4pn2/2p5/1bBP4/2N1PN2/PP3PPP/R1BQ1RK1': [{m:'b8d7',w:33},{m:'d8e7',w:33},{m:'b7b6',w:17},{m:'c8d7',w:17}],
  'rnbq1rk1/pp3ppp/4pn2/2p5/1bpP4/2NBPN2/PP3PPP/R1BQ1RK1': [{m:'d3c4',w:100}],
  'rnbq1rk1/pp3ppp/4pn2/2pp4/1bPP4/2NBPN2/PP3PPP/R1BQ1RK1': [{m:'d5c4',w:58},{m:'b8c6',w:33},{m:'b7b6',w:8}],
  'rnbq1rk1/pp3ppp/4pn2/2pp4/1bPP4/2NBPN2/PP3PPP/R1BQK2R': [{m:'e1g1',w:100}],
  'rnbq1rk1/ppp1b1pp/3ppn2/5p2/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1': [{m:'d8e8',w:100}],
  'rnbq1rk1/ppp1b1pp/3ppn2/5p2/2PP4/5NP1/PP2PPBP/RNBQ1RK1': [{m:'b1c3',w:100}],
  'rnbq1rk1/ppp1b1pp/4pn2/3p1p2/2PP4/5NP1/PP2PPBP/RNBQ1RK1': [{m:'b2b3',w:67},{m:'b1c3',w:33}],
  'rnbq1rk1/ppp1bpp1/4p2p/3p4/2PPn2B/2N1PN2/PP3PPP/R2QKB1R': [{m:'h4e7',w:100}],
  'rnbq1rk1/ppp1Bpp1/4p2p/3p4/2PPn3/2N1PN2/PP3PPP/R2QKB1R': [{m:'d8e7',w:100}],
  'rnbq1rk1/ppp1bpp1/4pn1p/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R': [{m:'g5h4',w:78},{m:'g5f6',w:22}],
  'rnbq1rk1/ppp1bpp1/4pn1p/3p4/2PP3B/2N1PN2/PP3PPP/R2QKB1R': [{m:'f6e4',w:67},{m:'b7b6',w:33}],
  'rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR': [{m:'g1f3',w:97},{m:'a1c1',w:3}],
  'rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R': [{m:'b8d7',w:65},{m:'h7h6',w:32},{m:'b7b6',w:3}],
  'rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1': [{m:'b8d7',w:100}],
  'rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'e1g1',w:100}],
  'rnbq1rk1/ppp1ppbp/3p1np1/6B1/2PPP3/2N5/PP2BPPP/R2QK1NR': [{m:'c7c5',w:33},{m:'a7a6',w:17},{m:'h7h6',w:17},{m:'b8a6',w:17},{m:'b8d7',w:17}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PP4/2N2NP1/PP2PP1P/R1BQKB1R': [{m:'f1g2',w:100}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQK2R': [{m:'b8c6',w:45},{m:'c7c5',w:20},{m:'c7c6',w:20},{m:'b8d7',w:15}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'b1c3',w:86},{m:'e1g1',w:14}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N1BP2/PP4PP/R2QKBNR': [{m:'e7e5',w:50},{m:'b8c6',w:33},{m:'b7b6',w:8},{m:'c7c6',w:8}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R': [{m:'e7e5',w:100}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R': [{m:'f1e2',w:92},{m:'c1e3',w:4},{m:'c1g5',w:4}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2P2/PP4PP/R1BQKBNR': [{m:'c1e3',w:86},{m:'c1g5',w:7},{m:'g1e2',w:7}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP2BPPP/R1BQK1NR': [{m:'c1g5',w:88},{m:'c1e3',w:13}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP2B1PP/R1BQK1NR': [{m:'c7c5',w:100}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP4PP/R1BQKBNR': [{m:'f1e2',w:80},{m:'g1f3',w:20}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/3PP3/2N2N2/PPP1BPPP/R1BQ1RK1': [{m:'c8g4',w:33},{m:'c7c6',w:33},{m:'b8c6',w:33}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/3PP3/2N2N2/PPP1BPPP/R1BQK2R': [{m:'e1g1',w:100}],
  'rnbq1rk1/ppp1ppbp/3p1np1/8/3PPP2/2N2N2/PPP3PP/R1BQKB1R': [{m:'f1d3',w:33},{m:'c1e3',w:33},{m:'e4e5',w:33}],
  'rnbq1rk1/ppp1ppbp/5np1/3p4/2PP1B2/2N1P3/PP3PPP/R2QKBNR': [{m:'a1c1',w:75},{m:'c4d5',w:25}],
  'rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R': [{m:'f1d3',w:33},{m:'d1b3',w:33},{m:'b2b4',w:17},{m:'c1d2',w:17}],
  'rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R': [{m:'c7c6',w:100}],
  'rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1': [{m:'c7c6',w:60},{m:'d5c4',w:20},{m:'b8c6',w:20}],
  'rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'e1g1',w:67},{m:'c4d5',w:33}],
  'rnbq1rk1/ppp1ppbp/5np1/3P4/3P4/5NP1/PP2PPBP/RNBQK2R': [{m:'f6d5',w:100}],
  'rnbq1rk1/ppp1ppbp/5np1/8/2QP4/2N2N2/PP2PPPP/R1B1KB1R': [{m:'e2e4',w:100}],
  'rnbq1rk1/ppp1ppbp/5np1/8/2QPP3/2N2N2/PP3PPP/R1B1KB1R': [{m:'c8g4',w:44},{m:'a7a6',w:11},{m:'b7b6',w:11},{m:'c7c6',w:11},{m:'b8a6',w:11},{m:'b8c6',w:11}],
  'rnbq1rk1/ppp1ppbp/6p1/3n4/3P4/5NP1/PP2PPBP/RNBQ1RK1': [{m:'c7c5',w:67},{m:'d5b6',w:33}],
  'rnbq1rk1/ppp1ppbp/6p1/3n4/3P4/5NP1/PP2PPBP/RNBQK2R': [{m:'e1g1',w:100}],
  'rnbq1rk1/ppp1ppbp/6p1/8/2BPP3/2P5/P3NPPP/R1BQK2R': [{m:'c7c5',w:56},{m:'d8d7',w:22},{m:'b7b6',w:11},{m:'b8c6',w:11}],
  'rnbq1rk1/ppp1ppbp/6p1/8/2BPP3/2P5/P4PPP/R1BQK1NR': [{m:'g1e2',w:100}],
  'rnbq1rk1/ppp2pbp/3p1np1/3Pp3/2P1P3/2N1BP2/PP4PP/R2QKBNR': [{m:'c7c6',w:67},{m:'f6h5',w:33}],
  'rnbq1rk1/ppp2pbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQK2R': [{m:'b8d7',w:67},{m:'a7a5',w:33}],
  'rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N1BP2/PP4PP/R2QKBNR': [{m:'d4d5',w:80},{m:'g1e2',w:20}],
  'rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1': [{m:'b8c6',w:67},{m:'b8d7',w:13},{m:'a7a5',w:7},{m:'c7c6',w:7},{m:'b8a6',w:7}],
  'rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQK2R': [{m:'e1g1',w:76},{m:'d4d5',w:19},{m:'c1e3',w:5}],
  'rnbq1rk1/ppp2ppp/4pn2/3p4/1bPP4/2N1PN2/PP3PPP/R1BQKB1R': [{m:'f1d3',w:91},{m:'a2a3',w:9}],
  'rnbq1rk1/ppp2ppp/4pn2/3p4/1bPP4/2NBP3/PP3PPP/R1BQK1NR': [{m:'g1f3',w:80},{m:'a2a3',w:20}],
  'rnbq1rk1/ppp2ppp/4pn2/3p4/1bPP4/2NBPN2/PP3PPP/R1BQK2R': [{m:'c7c5',w:93},{m:'b7b6',w:7}],
  'rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR': [{m:'g1f3',w:56},{m:'f1d3',w:28},{m:'g1e2',w:16}],
  'rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2N1PN2/PP3PPP/R1BQKB1R': [{m:'d7d5',w:92},{m:'c7c5',w:8}],
  'rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2NBP3/PP3PPP/R1BQK1NR': [{m:'d7d5',w:100}],
  'rnbq1rk1/pppp1ppp/4pn2/8/2PP4/P1P5/4PPPP/R1BQKBNR': [{m:'e2e3',w:100}],
  'rnbq1rk1/ppppb1pp/4pn2/5p2/2PP4/5NP1/PP2PPBP/RNBQ1RK1': [{m:'d7d6',w:56},{m:'d7d5',w:33},{m:'f6e4',w:11}],
  'rnbq1rk1/ppppb1pp/4pn2/5p2/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'e1g1',w:100}],
  'rnbq1rk1/ppppp1bp/5np1/5p2/2PP4/5NP1/PP2PPBP/RNBQ1RK1': [{m:'d7d6',w:100}],
  'rnbq1rk1/ppppp1bp/5np1/5p2/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'e1g1',w:100}],
  'rnbqk1nr/pp3ppp/4p3/2ppP3/1b1P4/2N5/PPP2PPP/R1BQKBNR': [{m:'a2a3',w:67},{m:'c1d2',w:22},{m:'d1g4',w:11}],
  'rnbqk1nr/pp3ppp/4p3/2ppP3/1b1P4/P1N5/1PP2PPP/R1BQKBNR': [{m:'b4a5',w:40},{m:'b4c3',w:40},{m:'c5d4',w:20}],
  'rnbqk1nr/ppp1ppbp/3p2p1/8/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'e2e4',w:100}],
  'rnbqk1nr/ppp1ppbp/3p2p1/8/2PPP3/2N5/PP3PPP/R1BQKBNR': [{m:'c7c5',w:33},{m:'f7f5',w:33},{m:'b8c6',w:33}],
  'rnbqk1nr/ppp1ppbp/3p2p1/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R': [{m:'c7c6',w:67},{m:'e7e6',w:33}],
  'rnbqk1nr/ppp1ppbp/3p2p1/8/3PP3/2N5/PPP2PPP/R1BQKBNR': [{m:'g1f3',w:50},{m:'f1c4',w:25},{m:'f2f4',w:25}],
  'rnbqk1nr/ppp1ppbp/3p2p1/8/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'b1c3',w:50},{m:'c2c3',w:25},{m:'c2c4',w:25}],
  'rnbqk1nr/ppp2ppp/3p4/2b1p3/4PP2/5N2/PPPP2PP/RNBQKB1R': [{m:'c2c3',w:50},{m:'b2b4',w:25},{m:'b1c3',w:25}],
  'rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR': [{m:'e4e5',w:57},{m:'c1d2',w:14},{m:'e4d5',w:10},{m:'g1e2',w:10},{m:'a2a3',w:5},{m:'f1d3',w:5}],
  'rnbqk1nr/ppp2ppp/4p3/3pP3/1b1P4/2N5/PPP2PPP/R1BQKBNR': [{m:'c7c5',w:91},{m:'d8d7',w:9}],
  'rnbqk1nr/pppp1pb1/7p/6p1/2B1Pp1P/5N2/PPPP2P1/RNBQK2R': [{m:'d2d4',w:100}],
  'rnbqk1nr/pppp1pb1/7p/6p1/2BPPp1P/5N2/PPP3P1/RNBQK2R': [{m:'d7d6',w:100}],
  'rnbqk1nr/pppp1pbp/8/6p1/2B1Pp1P/5N2/PPPP2P1/RNBQK2R': [{m:'h7h6',w:100}],
  'rnbqk1nr/pppp1pbp/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQK2R': [{m:'h2h4',w:67},{m:'d2d4',w:17},{m:'e1g1',w:17}],
  'rnbqk1nr/pppp1ppp/8/2b1p3/2B1P3/2P5/PP1P1PPP/RNBQK1NR': [{m:'d7d5',w:100}],
  'rnbqk1nr/pppp1ppp/8/2b1p3/2B1P3/8/PPPP1PPP/RNBQK1NR': [{m:'c2c3',w:36},{m:'b2b4',w:27},{m:'d1e2',w:18},{m:'d2d4',w:9},{m:'f2f4',w:9}],
  'rnbqk1nr/pppp1ppp/8/2b1p3/4PP2/5N2/PPPP2PP/RNBQKB1R': [{m:'d7d6',w:80},{m:'g7g5',w:20}],
  'rnbqk1nr/pppp1ppp/8/2b1p3/4PP2/8/PPPP2PP/RNBQKBNR': [{m:'g1f3',w:100}],
  'rnbqk1nr/ppppbppp/8/8/2B1Pp2/5N2/PPPP2PP/RNBQK2R': [{m:'e7h4',w:67},{m:'g8f6',w:33}],
  'rnbqk1nr/ppppbppp/8/8/4Pp2/5N2/PPPP2PP/RNBQKB1R': [{m:'f1c4',w:100}],
  'rnbqk1nr/ppppppbp/6p1/8/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'d7d6',w:71},{m:'c7c5',w:29}],
  'rnbqk1nr/ppppppbp/6p1/8/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'b1c3',w:67},{m:'e2e4',w:33}],
  'rnbqk1nr/ppppppbp/6p1/8/2PPP3/8/PP3PPP/RNBQKBNR': [{m:'d7d6',w:40},{m:'e7e5',w:20},{m:'c7c5',w:20},{m:'d7d5',w:20}],
  'rnbqk1nr/ppppppbp/6p1/8/3PP3/2N5/PPP2PPP/R1BQKBNR': [{m:'d7d6',w:57},{m:'c7c5',w:14},{m:'c7c6',w:14},{m:'d7d5',w:14}],
  'rnbqk1nr/ppppppbp/6p1/8/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'d7d6',w:80},{m:'b7b6',w:20}],
  'rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'b1c3',w:39},{m:'g1f3',w:28},{m:'f1c4',w:11},{m:'c2c4',w:11},{m:'c1d2',w:6},{m:'f1d3',w:6}],
  'rnbqk2r/1p2bppp/p2ppn2/6B1/3NPP2/2N2Q2/PPP3PP/R3KB1R': [{m:'h7h6',w:67},{m:'d8c7',w:33}],
  'rnbqk2r/1p2bppp/p2ppn2/6B1/3NPP2/2N5/PPP3PP/R2QKB1R': [{m:'d1f3',w:100}],
  'rnbqk2r/pp1p1ppp/4pn2/2P5/1bP5/1QN5/PP2PPPP/R1B1KBNR': [{m:'b8c6',w:100}],
  'rnbqk2r/pp1p1ppp/4pn2/2p5/1bPP4/1QN5/PP2PPPP/R1B1KBNR': [{m:'d4c5',w:100}],
  'rnbqk2r/pp1p1ppp/4pn2/2p5/1bPP4/2N1P3/PP3PPP/R1BQKBNR': [{m:'g1e2',w:50},{m:'f1d3',w:25},{m:'g1f3',w:25}],
  'rnbqk2r/pp1p1ppp/4pn2/2p5/1bPP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'d4d5',w:60},{m:'g2g3',w:40}],
  'rnbqk2r/pp1p1ppp/4pn2/2p5/2PP4/P1P2P2/4P1PP/R1BQKBNR': [{m:'d7d5',w:100}],
  'rnbqk2r/pp1p1ppp/4pn2/2p5/2PP4/P1P5/4PPPP/R1BQKBNR': [{m:'f2f3',w:57},{m:'e2e3',w:43}],
  'rnbqk2r/pp2ppbp/3p1np1/8/3NP3/2N1B3/PPP1BPPP/R2QK2R': [{m:'b8c6',w:100}],
  'rnbqk2r/pp2ppbp/3p1np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R': [{m:'f1e2',w:53},{m:'f2f3',w:47}],
  'rnbqk2r/pp2ppbp/3p1np1/8/3NP3/2N1BP2/PPP3PP/R2QKB1R': [{m:'e8g8',w:100}],
  'rnbqk2r/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP2BPPP/R1BQK2R': [{m:'e8g8',w:100}],
  'rnbqk2r/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP3PPP/R1BQKB1R': [{m:'f1e2',w:89},{m:'c1g5',w:11}],
  'rnbqk2r/pp3pbp/3p1np1/2pP4/4PP2/2N5/PP4PP/R1BQKBNR': [{m:'g1f3',w:60},{m:'f1b5',w:20},{m:'e4e5',w:20}],
  'rnbqk2r/pp3pbp/3p1np1/2pP4/8/2N2NP1/PP2PP1P/R1BQKB1R': [{m:'f1g2',w:100}],
  'rnbqk2r/pp3pbp/3p1np1/2pP4/8/2N2NP1/PP2PPBP/R1BQK2R': [{m:'e8g8',w:100}],
  'rnbqk2r/pp3ppp/4pn2/2pp4/2PP4/P1P2P2/4P1PP/R1BQKBNR': [{m:'c4d5',w:75},{m:'e2e3',w:25}],
  'rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR': [{m:'e8g8',w:97},{m:'f6e4',w:3}],
  'rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR': [{m:'e2e3',w:94},{m:'g5f6',w:3},{m:'g1f3',w:3}],
  'rnbqk2r/ppp1bppp/4pn2/3p2B1/3PP3/2N5/PPP2PPP/R2QKBNR': [{m:'e4e5',w:94},{m:'g5f6',w:6}],
  'rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR': [{m:'g1f3',w:100}],
  'rnbqk2r/ppp1bppp/4pn2/3pP1B1/3P4/2N5/PPP2PPP/R2QKBNR': [{m:'f6d7',w:80},{m:'f6g8',w:13},{m:'f6e4',w:7}],
  'rnbqk2r/ppp1bppp/8/3p4/3Pn3/3B1N2/PPP2PPP/RNBQ1RK1': [{m:'b8c6',w:80},{m:'e8g8',w:20}],
  'rnbqk2r/ppp1bppp/8/3p4/3Pn3/3B1N2/PPP2PPP/RNBQK2R': [{m:'e1g1',w:100}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'g2g3',w:94},{m:'c1g5',w:6}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PP4/2N2NP1/PP2PP1P/R1BQKB1R': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PP4/6P1/PP2PPBP/RNBQK1NR': [{m:'g1f3',w:100}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2P2/PP4PP/R1BQKBNR': [{m:'e8g8',w:94},{m:'e7e5',w:6}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP2BPPP/R1BQK1NR': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR': [{m:'g1f3',w:42},{m:'f2f3',w:27},{m:'f1e2',w:14},{m:'f2f4',w:13},{m:'g2g3',w:3},{m:'c1g5',w:2}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP4PP/R1BQKBNR': [{m:'e8g8',w:71},{m:'c7c5',w:14},{m:'b8a6',w:14}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/3PP3/2N2N2/PPP1BPPP/R1BQK2R': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R': [{m:'f1e2',w:80},{m:'h2h3',w:20}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/3PPP2/2N2N2/PPP3PP/R1BQKB1R': [{m:'e8g8',w:75},{m:'c7c5',w:25}],
  'rnbqk2r/ppp1ppbp/3p1np1/8/3PPP2/2N5/PPP3PP/R1BQKBNR': [{m:'g1f3',w:83},{m:'f1c4',w:17}],
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP1B2/2N1P3/PP3PPP/R2QKBNR': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP1B2/2N5/PP2PPPP/R2QKBNR': [{m:'e2e3',w:100}],
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/1QN2N2/PP2PPPP/R1B1KB1R': [{m:'d5c4',w:100}],
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/2N1P3/PP3PPP/R1BQKBNR': [{m:'g1f3',w:100}],
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'d1b3',w:58},{m:'e2e3',w:21},{m:'c1f4',w:11},{m:'c1g5',w:5},{m:'d1a4',w:5}],
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR': [{m:'g1f3',w:77},{m:'c4d5',w:23}],
  'rnbqk2r/ppp1ppbp/5np1/3P4/3P4/6P1/PP2PPBP/RNBQK1NR': [{m:'f6d5',w:100}],
  'rnbqk2r/ppp1ppbp/5np1/8/2BP4/2N2N2/PPP3PP/R1BQK2R': [{m:'e1g1',w:50},{m:'h2h4',w:25},{m:'f3e5',w:25}],
  'rnbqk2r/ppp1ppbp/5np1/8/2pP4/1QN2N2/PP2PPPP/R1B1KB1R': [{m:'b3c4',w:100}],
  'rnbqk2r/ppp1ppbp/5np1/8/2QP4/2N2N2/PP2PPPP/R1B1KB1R': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1ppbp/6p1/8/2BPP3/2P5/P4PPP/R1BQK1NR': [{m:'e8g8',w:100}],
  'rnbqk2r/ppp1ppbp/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR': [{m:'f1c4',w:83},{m:'g1f3',w:17}],
  'rnbqk2r/ppp2p1p/3b1n2/3PN3/2B2ppP/8/PPPP2P1/RNBQK2R': [{m:'e1g1',w:67},{m:'d2d4',w:33}],
  'rnbqk2r/ppp2pp1/4pn1p/3pP1B1/1b1P4/2N5/PPP2PPP/R2QKBNR': [{m:'g5d2',w:38},{m:'e5f6',w:25},{m:'g5c1',w:13},{m:'g5e3',w:13},{m:'g5h4',w:13}],
  'rnbqk2r/ppp2pp1/4pn1p/3pP3/1b1P4/2N5/PPPB1PPP/R2QKBNR': [{m:'b4c3',w:67},{m:'f6d7',w:33}],
  'rnbqk2r/ppp2ppp/4pn2/3p2B1/1b1PP3/2N5/PPP2PPP/R2QKBNR': [{m:'e4e5',w:89},{m:'g1e2',w:11}],
  'rnbqk2r/ppp2ppp/4pn2/3P4/1b1P4/2N5/PPQ1PPPP/R1B1KBNR': [{m:'e6d5',w:100}],
  'rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N5/PPQ1PPPP/R1B1KBNR': [{m:'a2a3',w:57},{m:'c4d5',w:43}],
  'rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/P1N5/1PQ1PPPP/R1B1KBNR': [{m:'b4c3',w:100}],
  'rnbqk2r/ppp2ppp/4pn2/3p4/2PP4/P1b5/1PQ1PPPP/R1B1KBNR': [{m:'c2c3',w:100}],
  'rnbqk2r/ppp2ppp/4pn2/3p4/2PP4/P1Q5/1P2PPPP/R1B1KBNR': [{m:'f6e4',w:67},{m:'b8c6',w:33}],
  'rnbqk2r/ppp2ppp/4pn2/3pP1B1/1b1P4/2N5/PPP2PPP/R2QKBNR': [{m:'h7h6',w:100}],
  'rnbqk2r/pppnbppp/4p3/3pP1B1/3P3P/2N5/PPP2PP1/R2QKBNR': [{m:'a7a6',w:20},{m:'e7g5',w:20},{m:'c7c5',w:20},{m:'f7f6',w:20},{m:'e8g8',w:20}],
  'rnbqk2r/pppnbppp/4p3/3pP1B1/3P4/2N5/PPP2PPP/R2QKBNR': [{m:'g5e7',w:50},{m:'h2h4',w:50}],
  'rnbqk2r/pppnBppp/4p3/3pP3/3P4/2N5/PPP2PPP/R2QKBNR': [{m:'d8e7',w:100}],
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/1QN5/PP2PPPP/R1B1KBNR': [{m:'c7c5',w:100}],
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR': [{m:'e8g8',w:70},{m:'c7c5',w:14},{m:'b7b6',w:8},{m:'b8c6',w:5},{m:'d7d5',w:3}],
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'c7c5',w:83},{m:'d7d5',w:17}],
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR': [{m:'e2e3',w:45},{m:'d1c2',w:20},{m:'a2a3',w:15},{m:'g1f3',w:8},{m:'d1b3',w:7},{m:'c1g5',w:4}],
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PPQ1PPPP/R1B1KBNR': [{m:'d7d5',w:50},{m:'c7c5',w:19},{m:'b8c6',w:19},{m:'e8g8',w:13}],
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/5N2/PP2PPPP/RNBQKB1R': [{m:'c1d2',w:67},{m:'b1d2',w:33}],
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/P1N5/1P2PPPP/R1BQKBNR': [{m:'b4c3',w:100}],
  'rnbqk2r/pppp1ppp/4pn2/8/2PP4/P1b5/1P2PPPP/R1BQKBNR': [{m:'b2c3',w:100}],
  'rnbqk2r/pppp1ppp/4pn2/8/2PP4/P1P5/4PPPP/R1BQKBNR': [{m:'c7c5',w:64},{m:'e8g8',w:36}],
  'rnbqk2r/ppppb1pp/4pn2/5p2/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'e8g8',w:100}],
  'rnbqk2r/ppppb1pp/4pn2/5p2/2PP4/6P1/PP2PPBP/RNBQK1NR': [{m:'g1f3',w:90},{m:'b1c3',w:10}],
  'rnbqk2r/ppppp1bp/5np1/5p2/2PP4/5NP1/PP2PPBP/RNBQK2R': [{m:'e8g8',w:100}],
  'rnbqk2r/ppppp1bp/5np1/5p2/2PP4/6P1/PP2PPBP/RNBQK1NR': [{m:'g1f3',w:100}],
  'rnbqk2r/ppppppbp/5np1/8/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'d7d6',w:100}],
  'rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'e2e4',w:79},{m:'g1f3',w:20}],
  'rnbqk2r/ppppppbp/5np1/8/2PP4/6P1/PP2PP1P/RNBQKBNR': [{m:'f1g2',w:100}],
  'rnbqk2r/ppppppbp/5np1/8/2PP4/6P1/PP2PPBP/RNBQK1NR': [{m:'d7d6',w:70},{m:'d7d5',w:20},{m:'e8g8',w:10}],
  'rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR': [{m:'d7d6',w:100}],
  'rnbqkb1r/1p2pppp/p2p1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R': [{m:'e7e6',w:100}],
  'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'c1g5',w:63},{m:'f1e2',w:11},{m:'c1e3',w:11},{m:'f1c4',w:5},{m:'f2f4',w:5},{m:'g2g3',w:5}],
  'rnbqkb1r/1p3ppp/p2ppn2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R': [{m:'f2f4',w:100}],
  'rnbqkb1r/1p3ppp/p2ppn2/6B1/3NPP2/2N5/PPP3PP/R2QKB1R': [{m:'f8e7',w:44},{m:'d8b6',w:33},{m:'b7b5',w:22}],
  'rnbqkb1r/1p3ppp/p2ppn2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R': [{m:'g2g4',w:67},{m:'f2f3',w:33}],
  'rnbqkb1r/1p3ppp/p3pn2/2p5/2BP4/4PN2/PP2QPPP/RNB2RK1': [{m:'b7b5',w:60},{m:'b8c6',w:40}],
  'rnbqkb1r/1p3ppp/p3pn2/2p5/2BP4/4PN2/PP3PPP/RNBQ1RK1': [{m:'d1e2',w:75},{m:'d4c5',w:13},{m:'e3e4',w:13}],
  'rnbqkb1r/3ppppp/p4n2/1PpP4/8/8/PP2PPPP/RNBQKBNR': [{m:'b5a6',w:45},{m:'b1c3',w:27},{m:'b5b6',w:9},{m:'e2e3',w:9},{m:'f2f3',w:9}],
  'rnbqkb1r/3ppppp/P4n2/2pP4/8/8/PP2PPPP/RNBQKBNR': [{m:'c8a6',w:100}],
  'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'c8b7',w:100}],
  'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R': [{m:'g2g3',w:67},{m:'b1c3',w:17},{m:'a2a3',w:8},{m:'e2e3',w:6},{m:'c1f4',w:3}],
  'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R': [{m:'c8b7',w:83},{m:'c8a6',w:17}],
  'rnbqkb1r/p1pppppp/1p3n2/8/3P4/5N2/PPP1PPPP/RNBQKB1R': [{m:'g2g3',w:50},{m:'c1g5',w:25},{m:'c2c3',w:25}],
  'rnbqkb1r/p2p1ppp/4pn2/1ppP4/2P5/5N2/PP2PPPP/RNBQKB1R': [{m:'c1g5',w:50},{m:'d5e6',w:25},{m:'e2e4',w:25}],
  'rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP2PPPP/RNBQKBNR': [{m:'c4b5',w:71},{m:'a2a4',w:6},{m:'c1g5',w:6},{m:'e2e4',w:6},{m:'f2f3',w:6},{m:'g2g4',w:6}],
  'rnbqkb1r/p2ppppp/5n2/1PpP4/8/8/PP2PPPP/RNBQKBNR': [{m:'a7a6',w:100}],
  'rnbqkb1r/p4p2/2p1pn1p/1p2P1p1/2pP3B/2N2N2/PP3PPP/R2QKB1R': [{m:'f3g5',w:67},{m:'e5f6',w:33}],
  'rnbqkb1r/p4pp1/2p1pn1p/1p2P1B1/2pP4/2N2N2/PP3PPP/R2QKB1R': [{m:'g5h4',w:100}],
  'rnbqkb1r/p4pp1/2p1pn1p/1p2P3/2pP3B/2N2N2/PP3PPP/R2QKB1R': [{m:'g7g5',w:100}],
  'rnbqkb1r/p4ppp/2p1pn2/1p2P1B1/2pP4/2N2N2/PP3PPP/R2QKB1R': [{m:'h7h6',w:100}],
  'rnbqkb1r/p4ppp/2p1pn2/1p4B1/2pPP3/2N2N2/PP3PPP/R2QKB1R': [{m:'e4e5',w:100}],
  'rnbqkb1r/pp1n1ppp/4p3/2ppP3/3P1P2/2N5/PPP3PP/R1BQKBNR': [{m:'d4c5',w:67},{m:'g1f3',w:33}],
  'rnbqkb1r/pp1p1ppp/4pn2/2p5/2PP4/5N2/PP2PPPP/RNBQKB1R': [{m:'d4d5',w:100}],
  'rnbqkb1r/pp1p1ppp/4pn2/2pP4/2P5/2N5/PP2PPPP/R1BQKBNR': [{m:'e6d5',w:100}],
  'rnbqkb1r/pp1p1ppp/4pn2/2pP4/2P5/5N2/PP2PPPP/RNBQKB1R': [{m:'b7b5',w:100}],
  'rnbqkb1r/pp1p1ppp/4pn2/2pP4/2P5/8/PP2PPPP/RNBQKBNR': [{m:'b1c3',w:100}],
  'rnbqkb1r/pp1p1ppp/4pn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'f8b4',w:50},{m:'b8c6',w:33},{m:'d8b6',w:17}],
  'rnbqkb1r/pp1p1ppp/4pn2/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'b1c3',w:100}],
  'rnbqkb1r/pp1p1ppp/5n2/2pp4/2P5/2N5/PP2PPPP/R1BQKBNR': [{m:'c4d5',w:100}],
  'rnbqkb1r/pp1p1ppp/5n2/2pP4/8/2N5/PP2PPPP/R1BQKBNR': [{m:'d7d6',w:96},{m:'f8d6',w:4}],
  'rnbqkb1r/pp1ppppp/5n2/2p5/2P5/2N5/PP1PPPPP/R1BQKBNR': [{m:'g1f3',w:60},{m:'g2g3',w:40}],
  'rnbqkb1r/pp1ppppp/5n2/2p5/2P5/5N2/PP1PPPPP/RNBQKB1R': [{m:'d2d4',w:63},{m:'g2g3',w:25},{m:'b2b4',w:13}],
  'rnbqkb1r/pp1ppppp/5n2/2p5/2PP4/5N2/PP2PPPP/RNBQKB1R': [{m:'c5d4',w:100}],
  'rnbqkb1r/pp1ppppp/5n2/2p5/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'d4d5',w:98},{m:'d4c5',w:2}],
  'rnbqkb1r/pp1ppppp/5n2/2pP4/2P5/8/PP2PPPP/RNBQKBNR': [{m:'e7e6',w:52},{m:'b7b5',w:36},{m:'e7e5',w:5},{m:'f6e4',w:4},{m:'d7d6',w:4}],
  'rnbqkb1r/pp1ppppp/5n2/2pP4/8/8/PPP1PPPP/RNBQKBNR': [{m:'g1f3',w:60},{m:'c2c4',w:20},{m:'b1c3',w:20}],
  'rnbqkb1r/pp1ppppp/5n2/8/2PN4/8/PP2PPPP/RNBQKB1R': [{m:'e7e6',w:100}],
  'rnbqkb1r/pp1ppppp/5n2/8/2Pp4/5N2/PP2PPPP/RNBQKB1R': [{m:'f3d4',w:100}],
  'rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R': [{m:'f8g7',w:100}],
  'rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'c1e3',w:86},{m:'f1e2',w:5},{m:'f2f4',w:5},{m:'g2g3',w:5}],
  'rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'d5c4',w:82},{m:'a7a6',w:5},{m:'c6c5',w:5},{m:'g7g6',w:5},{m:'d8b6',w:5}],
  'rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/4PN2/PP3PPP/RNBQKB1R': [{m:'c8f5',w:80},{m:'c8g4',w:20}],
  'rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R': [{m:'b1c3',w:68},{m:'e2e3',w:18},{m:'c4d5',w:9},{m:'c1g5',w:3},{m:'b1d2',w:3}],
  'rnbqkb1r/pp2pppp/2p2n2/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'a2a4',w:82},{m:'e2e3',w:12},{m:'e2e4',w:6}],
  'rnbqkb1r/pp2pppp/2p2N2/8/3P4/8/PPP2PPP/R1BQKBNR': [{m:'e7f6',w:67},{m:'g7f6',w:33}],
  'rnbqkb1r/pp2pppp/2p2n2/8/3PN3/8/PPP2PPP/R1BQKBNR': [{m:'e4f6',w:75},{m:'f1d3',w:25}],
  'rnbqkb1r/pp2pppp/2p2n2/8/P1pP4/2N2N2/1P2PPPP/R1BQKB1R': [{m:'c8f5',w:77},{m:'c8g4',w:8},{m:'e7e6',w:8},{m:'b8a6',w:8}],
  'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'b8c6',w:28},{m:'a7a6',w:24},{m:'g7g6',w:24},{m:'e7e6',w:21}],
  'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'b1c3',w:97},{m:'f2f3',w:2}],
  'rnbqkb1r/pp2pppp/5n2/3p4/2PP4/2N5/PP3PPP/R1BQKBNR': [{m:'b8c6',w:100}],
  'rnbqkb1r/pp2pppp/5n2/3p4/2PP4/8/PP3PPP/RNBQKBNR': [{m:'b1c3',w:100}],
  'rnbqkb1r/pp3p1p/3p1np1/2pP4/4P3/2N2N2/PP3PPP/R1BQKB1R': [{m:'f8g7',w:100}],
  'rnbqkb1r/pp3p1p/3p1np1/2pP4/4P3/2N5/PP3PPP/R1BQKBNR': [{m:'g1f3',w:63},{m:'f2f4',w:38}],
  'rnbqkb1r/pp3p1p/3p1np1/2pP4/4PP2/2N5/PP4PP/R1BQKBNR': [{m:'f8g7',w:100}],
  'rnbqkb1r/pp3p1p/3p1np1/2pP4/8/2N2N2/PP2PPPP/R1BQKB1R': [{m:'g2g3',w:71},{m:'c1g5',w:14},{m:'f3d2',w:14}],
  'rnbqkb1r/pp3p1p/3p1np1/2pP4/8/2N2NP1/PP2PP1P/R1BQKB1R': [{m:'f8g7',w:100}],
  'rnbqkb1r/pp3ppp/2p1pn2/3p2B1/2PP4/2N2N2/PP2PPPP/R2QKB1R': [{m:'d5c4',w:83},{m:'h7h6',w:17}],
  'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R': [{m:'b8d7',w:92},{m:'a7a6',w:4},{m:'f6e4',w:4}],
  'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'e2e3',w:78},{m:'c1g5',w:22}],
  'rnbqkb1r/pp3ppp/2p1pn2/6B1/2pP4/2N2N2/PP2PPPP/R2QKB1R': [{m:'e2e4',w:100}],
  'rnbqkb1r/pp3ppp/2p1pn2/6B1/2pPP3/2N2N2/PP3PPP/R2QKB1R': [{m:'b7b5',w:100}],
  'rnbqkb1r/pp3ppp/3p1n2/2pP4/4P3/2N5/PP3PPP/R1BQKBNR': [{m:'g7g6',w:100}],
  'rnbqkb1r/pp3ppp/3p1n2/2pP4/8/2N2N2/PP2PPPP/R1BQKB1R': [{m:'g7g6',w:100}],
  'rnbqkb1r/pp3ppp/3p1n2/2pP4/8/2N5/PP2PPPP/R1BQKBNR': [{m:'e2e4',w:68},{m:'g1f3',w:32}],
  'rnbqkb1r/pp3ppp/3ppn2/8/2BNP3/2N5/PPP2PPP/R1BQK2R': [{m:'b8c6',w:80},{m:'a7a6',w:20}],
  'rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R': [{m:'a7a6',w:100}],
  'rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N5/PPP1BPPP/R1BQK2R': [{m:'a7a6',w:100}],
  'rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': [{m:'f1c4',w:35},{m:'f1e2',w:24},{m:'c1e3',w:18},{m:'f2f4',w:12},{m:'f1b5',w:6},{m:'g2g3',w:6}],
  'rnbqkb1r/pp3ppp/4pn2/2p5/2BP4/4PN2/PP3PPP/RNBQ1RK1': [{m:'a7a6',w:82},{m:'c5d4',w:9},{m:'b8c6',w:9}],
  'rnbqkb1r/pp3ppp/4pn2/2p5/2BP4/4PN2/PP3PPP/RNBQK2R': [{m:'e1g1',w:100}],
  'rnbqkb1r/pp3ppp/4pn2/2pp2B1/2PP4/2N5/PP2PPPP/R2QKBNR': [{m:'c4d5',w:67},{m:'g1f3',w:33}],
  'rnbqkb1r/pp3ppp/4pn2/2pp4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'c4d5',w:75},{m:'c1g5',w:25}],
  'rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R': [{m:'f8g7',w:100}],
  'rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N5/PPP2PPP/R1BQKBNR': [{m:'f2f4',w:33},{m:'g1f3',w:33},{m:'f1e2',w:14},{m:'c1e3',w:10},{m:'f1c4',w:5},{m:'c1g5',w:5}],
  'rnbqkb1r/ppp1pp1p/3p1np1/8/3PPP2/2N5/PPP3PP/R1BQKBNR': [{m:'f8g7',w:100}],
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP1B2/2N5/PP2PPPP/R2QKBNR': [{m:'f8g7',w:100}],
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N1P3/PP3PPP/R1BQKBNR': [{m:'f8g7',w:90},{m:'c7c6',w:10}],
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'f8g7',w:100}],
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'g1f3',w:37},{m:'c4d5',w:28},{m:'e2e3',w:18},{m:'c1f4',w:11},{m:'c1g5',w:4},{m:'f2f3',w:4}],
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/6P1/PP2PP1P/RNBQKBNR': [{m:'f1g2',w:100}],
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR': [{m:'f8g7',w:100}],
  'rnbqkb1r/ppp1pp1p/5np1/3P4/3P4/2N5/PP2PPPP/R1BQKBNR': [{m:'f6d5',w:100}],
  'rnbqkb1r/ppp1pp1p/5np1/8/2BP4/2N2N2/PPP3PP/R1BQK2R': [{m:'f8g7',w:100}],
  'rnbqkb1r/ppp1pp1p/5np1/8/3P4/2N2N2/PPP3PP/R1BQKB1R': [{m:'f1c4',w:67},{m:'c1f4',w:17},{m:'f3e5',w:17}],
  'rnbqkb1r/ppp1pp1p/6p1/3n4/3P4/2N5/PP2PPPP/R1BQKBNR': [{m:'e2e4',w:87},{m:'g2g3',w:7},{m:'c3a4',w:7}],
  'rnbqkb1r/ppp1pp1p/6p1/3n4/3PP3/2N5/PP3PPP/R1BQKBNR': [{m:'d5c3',w:100}],
  'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2n5/PP3PPP/R1BQKBNR': [{m:'b2c3',w:100}],
  'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR': [{m:'f8g7',w:100}],
  'rnbqkb1r/ppp1pppp/1n1p4/4P3/2PP4/8/PP3PPP/RNBQKBNR': [{m:'f2f4',w:75},{m:'c4c5',w:25}],
  'rnbqkb1r/ppp1pppp/3p1n2/8/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'e7e5',w:50},{m:'c8f5',w:33},{m:'b8d7',w:17}],
  'rnbqkb1r/ppp1pppp/3p1n2/8/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'b1c3',w:75},{m:'g2g4',w:13},{m:'g1f3',w:13}],
  'rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/2N5/PPP2PPP/R1BQKBNR': [{m:'g7g6',w:92},{m:'c7c6',w:4},{m:'b8d7',w:4}],
  'rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'b1c3',w:92},{m:'f2f3',w:4},{m:'g1f3',w:4}],
  'rnbqkb1r/ppp1pppp/3p4/3nP3/2PP4/8/PP3PPP/RNBQKBNR': [{m:'d5b6',w:100}],
  'rnbqkb1r/ppp1pppp/3p4/3nP3/3P4/5N2/PPP2PPP/RNBQKB1R': [{m:'c8g4',w:44},{m:'g7g6',w:33},{m:'d6e5',w:11},{m:'d5b6',w:11}],
  'rnbqkb1r/ppp1pppp/3p4/3nP3/3P4/8/PPP2PPP/RNBQKBNR': [{m:'g1f3',w:67},{m:'c2c4',w:27},{m:'f1c4',w:7}],
  'rnbqkb1r/ppp1pppp/5n2/3p2B1/3P4/2N5/PPP1PPPP/R2QKBNR': [{m:'c8f5',w:29},{m:'b8d7',w:29},{m:'e7e6',w:14},{m:'f6e4',w:14},{m:'c7c5',w:14}],
  'rnbqkb1r/ppp1pppp/5n2/3p2B1/3P4/5N2/PPP1PPPP/RN1QKB1R': [{m:'e7e6',w:33},{m:'g7g6',w:33},{m:'f6e4',w:33}],
  'rnbqkb1r/ppp1pppp/5n2/3p4/2P5/2N5/PP1PPPPP/R1BQKBNR': [{m:'c4d5',w:100}],
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/2N5/PPP1PPPP/R1BQKBNR': [{m:'c1g5',w:80},{m:'e2e4',w:20}],
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/4PN2/PPP2PPP/RNBQKB1R': [{m:'e7e6',w:75},{m:'c8f5',w:25}],
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R': [{m:'e2e3',w:36},{m:'c1g5',w:29},{m:'c1f4',w:14},{m:'c2c4',w:14},{m:'g2g3',w:7}],
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5P2/PPP1P1PP/RNBQKBNR': [{m:'e2e4',w:50},{m:'g2g4',w:50}],
  'rnbqkb1r/ppp1pppp/5n2/3P4/3P4/8/PPP2PPP/RNBQKBNR': [{m:'f6d5',w:56},{m:'c8g4',w:22},{m:'c7c6',w:11},{m:'g7g6',w:11}],
  'rnbqkb1r/ppp1pppp/5n2/3p4/4P3/2N5/PPPP1PPP/R1BQKBNR': [{m:'e4d5',w:50},{m:'d2d3',w:25},{m:'e4e5',w:25}],
  'rnbqkb1r/ppp1pppp/5n2/3P4/8/2N5/PP1PPPPP/R1BQKBNR': [{m:'f6d5',w:100}],
  'rnbqkb1r/ppp1pppp/5n2/3P4/8/8/PPPP1PPP/RNBQKBNR': [{m:'d2d4',w:82},{m:'c2c4',w:18}],
  'rnbqkb1r/ppp1pppp/5n2/8/2pP4/4PN2/PP3PPP/RNBQKB1R': [{m:'e7e6',w:81},{m:'c8e6',w:6},{m:'c8g4',w:6},{m:'g7g6',w:6}],
  'rnbqkb1r/ppp1pppp/5n2/8/2pP4/5N2/PP2PPPP/RNBQKB1R': [{m:'e2e3',w:85},{m:'b1c3',w:10},{m:'d1a4',w:5}],
  'rnbqkb1r/ppp1pppp/5n2/8/3P4/2N2N2/PPP3PP/R1BQKB1R': [{m:'g7g6',w:50},{m:'e7e6',w:21},{m:'b7b6',w:7},{m:'c8f5',w:7},{m:'c8g4',w:7},{m:'c7c5',w:7}],
  'rnbqkb1r/ppp1pppp/5n2/8/3P4/2N2p2/PPP3PP/R1BQKBNR': [{m:'g1f3',w:86},{m:'d1f3',w:14}],
  'rnbqkb1r/ppp1pppp/5n2/8/3Pp3/2N2P2/PPP3PP/R1BQKBNR': [{m:'e4f3',w:64},{m:'c8f5',w:21},{m:'e7e6',w:6},{m:'c7c5',w:3},{m:'c7c6',w:3},{m:'e4e3',w:3}],
  'rnbqkb1r/ppp1pppp/5n2/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': [{m:'f2f3',w:93},{m:'c1g5',w:5},{m:'c1e3',w:2}],
  'rnbqkb1r/ppp1pppp/8/3n4/3P4/8/PPP2PPP/RNBQKBNR': [{m:'c2c4',w:50},{m:'g1f3',w:50}],
  'rnbqkb1r/ppp1pppp/8/3n4/8/2N5/PP1PPPPP/R1BQKBNR': [{m:'g2g3',w:50},{m:'g1f3',w:50}],
  'rnbqkb1r/ppp2p1p/5n2/3pN3/2B1PppP/8/PPPP2P1/RNBQK2R': [{m:'e4d5',w:100}],
  'rnbqkb1r/ppp2p1p/5n2/3PN3/2B2ppP/8/PPPP2P1/RNBQK2R': [{m:'f8d6',w:80},{m:'f8g7',w:20}],
  'rnbqkb1r/ppp2ppp/3p1n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R': [{m:'e5f3',w:76},{m:'d2d4',w:10},{m:'e5c4',w:5},{m:'e5d3',w:5},{m:'e5f7',w:5}],
  'rnbqkb1r/ppp2ppp/3p1n2/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'d4e5',w:40},{m:'f1c4',w:20},{m:'b1c3',w:20},{m:'f3g5',w:20}],
  'rnbqkb1r/ppp2ppp/3p1n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R': [{m:'f6e4',w:100}],
  'rnbqkb1r/ppp2ppp/3p4/8/3Pn3/5N2/PPP2PPP/RNBQKB1R': [{m:'d6d5',w:100}],
  'rnbqkb1r/ppp2ppp/3p4/8/4n3/5N2/PPPP1PPP/RNBQKB1R': [{m:'d2d4',w:63},{m:'d1e2',w:13},{m:'f1d3',w:6},{m:'c2c4',w:6},{m:'d2d3',w:6},{m:'b1c3',w:6}],
  'rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR': [{m:'f8e7',w:74},{m:'b8d7',w:18},{m:'c7c5',w:8}],
  'rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/5N2/PP2PPPP/RN1QKB1R': [{m:'h7h6',w:50},{m:'f8b4',w:25},{m:'b8d7',w:25}],
  'rnbqkb1r/ppp2ppp/4pn2/3p2B1/3PP3/2N5/PPP2PPP/R2QKBNR': [{m:'f8e7',w:59},{m:'f8b4',w:34},{m:'d5e4',w:7}],
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2P5/5NP1/PP1PPP1P/RNBQKB1R': [{m:'f1g2',w:100}],
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2P5/5NP1/PP1PPPBP/RNBQK2R': [{m:'f8e7',w:75},{m:'d5c4',w:25}],
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'c7c6',w:77},{m:'c7c5',w:12},{m:'f8b4',w:7},{m:'f8e7',w:2},{m:'d5c4',w:2}],
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'c1g5',w:51},{m:'g1f3',w:44},{m:'c4d5',w:4}],
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/4PN2/PP3PPP/RNBQKB1R': [{m:'c7c6',w:100}],
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PP1P/RNBQKBNR': [{m:'f1g2',w:100}],
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR': [{m:'f8e7',w:50},{m:'d5c4',w:43},{m:'c7c5',w:7}],
  'rnbqkb1r/ppp2ppp/4pn2/3P4/3P4/2N5/PP2PPPP/R1BQKBNR': [{m:'e6d5',w:100}],
  'rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR': [{m:'c1g5',w:79},{m:'e4e5',w:13},{m:'f1d3',w:3},{m:'c1e3',w:3},{m:'e4d5',w:3}],
  'rnbqkb1r/ppp2ppp/4pn2/3pP3/3P4/2N5/PPP2PPP/R1BQKBNR': [{m:'f6d7',w:100}],
  'rnbqkb1r/ppp2ppp/4pn2/8/2BP4/4PN2/PP3PPP/RNBQK2R': [{m:'c7c5',w:100}],
  'rnbqkb1r/ppp2ppp/4pn2/8/2pP4/4PN2/PP3PPP/RNBQKB1R': [{m:'f1c4',w:100}],
  'rnbqkb1r/ppp2ppp/4pn2/8/2pP4/6P1/PP2PPBP/RNBQK1NR': [{m:'g1f3',w:60},{m:'d1a4',w:40}],
  'rnbqkb1r/ppp2ppp/5n2/3p4/3P4/2N5/PP2PPPP/R1BQKBNR': [{m:'c1g5',w:67},{m:'g1f3',w:33}],
  'rnbqkb1r/ppp2ppp/5n2/3P4/4pP2/3P4/PPP3PP/RNBQKBNR': [{m:'b1c3',w:33},{m:'b1d2',w:33},{m:'d1e2',w:33}],
  'rnbqkb1r/ppp2ppp/5n2/3pP3/4P3/2N5/PPPP2PP/R1BQKBNR': [{m:'f6e4',w:100}],
  'rnbqkb1r/ppp2ppp/5n2/3pp3/4PP2/2N5/PPPP2PP/R1BQKBNR': [{m:'f4e5',w:86},{m:'d2d3',w:14}],
  'rnbqkb1r/ppp2ppp/8/3p4/3Pn3/3B1N2/PPP2PPP/RNBQK2R': [{m:'f8e7',w:56},{m:'f8d6',w:33},{m:'b8c6',w:11}],
  'rnbqkb1r/ppp2ppp/8/3p4/3Pn3/5N2/PPP2PPP/RNBQKB1R': [{m:'f1d3',w:100}],
  'rnbqkb1r/ppp2ppp/8/3pP3/4n3/2N5/PPPP2PP/R1BQKBNR': [{m:'d2d3',w:33},{m:'g1f3',w:33},{m:'d1f3',w:33}],
  'rnbqkb1r/pppn1ppp/4p3/3pP3/3P1P2/2N5/PPP3PP/R1BQKBNR': [{m:'c7c5',w:100}],
  'rnbqkb1r/pppn1ppp/4p3/3pP3/3P4/2N5/PPP2PPP/R1BQKBNR': [{m:'f2f4',w:75},{m:'d1g4',w:25}],
  'rnbqkb1r/pppp1p1p/5n2/4N3/2B1PppP/8/PPPP2P1/RNBQK2R': [{m:'d7d5',w:100}],
  'rnbqkb1r/pppp1p1p/5n2/4N3/4PppP/8/PPPP2P1/RNBQKB1R': [{m:'f1c4',w:71},{m:'d2d4',w:14},{m:'e5g4',w:14}],
  'rnbqkb1r/pppp1ppp/3n4/4p2Q/2B5/2N5/PPPP1PPP/R1B1K1NR': [{m:'c4b3',w:100}],
  'rnbqkb1r/pppp1ppp/3n4/4p2Q/8/1BN5/PPPP1PPP/R1B1K1NR': [{m:'f8e7',w:50},{m:'b8c6',w:50}],
  'rnbqkb1r/pppp1ppp/4pn2/6B1/3P4/5N2/PPP1PPPP/RN1QKB1R': [{m:'c7c5',w:67},{m:'h7h6',w:33}],
  'rnbqkb1r/pppp1ppp/4pn2/8/2P1P3/2N5/PP1P1PPP/R1BQKBNR': [{m:'c7c5',w:67},{m:'b8c6',w:33}],
  'rnbqkb1r/pppp1ppp/4pn2/8/2P5/2N2N2/PP1PPPPP/R1BQKB1R': [{m:'f8b4',w:67},{m:'b7b6',w:33}],
  'rnbqkb1r/pppp1ppp/4pn2/8/2P5/2N5/PP1PPPPP/R1BQKBNR': [{m:'e2e4',w:57},{m:'g1f3',w:43}],
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/6P1/PP2PP1P/RNBQKBNR': [{m:'d7d5',w:94},{m:'e6e5',w:6}],
  'rnbqkb1r/pppp1ppp/4pn2/8/3P4/5N2/PPP1PPPP/RNBQKB1R': [{m:'c1g5',w:67},{m:'c1f4',w:17},{m:'e2e3',w:17}],
  'rnbqkb1r/pppp1ppp/5n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R': [{m:'d7d6',w:88},{m:'f6e4',w:8},{m:'b8c6',w:4}],
  'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/2N5/PPPP1PPP/R1BQK1NR': [{m:'f6e4',w:58},{m:'f8c5',w:17},{m:'b7b5',w:8},{m:'f8b4',w:8},{m:'b8c6',w:8}],
  'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/3P4/PPP2PPP/RNBQK1NR': [{m:'b8c6',w:50},{m:'f8c5',w:25},{m:'f8e7',w:25}],
  'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR': [{m:'d2d3',w:31},{m:'d2d4',w:31},{m:'b1c3',w:15},{m:'f2f3',w:8},{m:'f2f4',w:8},{m:'g1e2',w:8}],
  'rnbqkb1r/pppp1ppp/5n2/4p3/2BPP3/8/PPP2PPP/RNBQK1NR': [{m:'e5d4',w:100}],
  'rnbqkb1r/pppp1ppp/5n2/4p3/2P5/2N3P1/PP1PPP1P/R1BQKBNR': [{m:'g7g6',w:40},{m:'f8b4',w:20},{m:'c7c6',w:20},{m:'d7d5',w:20}],
  'rnbqkb1r/pppp1ppp/5n2/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR': [{m:'g2g3',w:67},{m:'g1f3',w:22},{m:'f2f4',w:11}],
  'rnbqkb1r/pppp1ppp/5n2/4P3/2P5/8/PP2PPPP/RNBQKBNR': [{m:'f6g4',w:75},{m:'f6e4',w:25}],
  'rnbqkb1r/pppp1ppp/5n2/4p3/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'d4e5',w:100}],
  'rnbqkb1r/pppp1ppp/5n2/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'e5d4',w:50},{m:'f6e4',w:33},{m:'d7d5',w:17}],
  'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR': [{m:'f1c4',w:48},{m:'f2f4',w:35},{m:'g2g3',w:13},{m:'a2a3',w:4}],
  'rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR': [{m:'d7d5',w:100}],
  'rnbqkb1r/pppp1ppp/5n2/8/2BpP3/8/PPP2PPP/RNBQK1NR': [{m:'g1f3',w:67},{m:'c2c3',w:33}],
  'rnbqkb1r/pppp1ppp/5n2/8/3pP3/5N2/PPP2PPP/RNBQKB1R': [{m:'e4e5',w:67},{m:'f1c4',w:33}],
  'rnbqkb1r/pppp1ppp/8/4n3/2P1P3/8/PP3PPP/RNBQKBNR': [{m:'f2f4',w:100}],
  'rnbqkb1r/pppp1ppp/8/4n3/2P1PP2/8/PP4PP/RNBQKBNR': [{m:'f8c5',w:33},{m:'b8c6',w:33},{m:'e5c6',w:33}],
  'rnbqkb1r/pppp1ppp/8/4p2Q/2B1n3/2N5/PPPP1PPP/R1B1K1NR': [{m:'e4d6',w:100}],
  'rnbqkb1r/pppp1ppp/8/4p3/2B1n3/2N5/PPPP1PPP/R1BQK1NR': [{m:'d1h5',w:80},{m:'g1f3',w:20}],
  'rnbqkb1r/pppp1ppp/8/4P3/2P1P1n1/8/PP3PPP/RNBQKBNR': [{m:'g4e5',w:75},{m:'d7d6',w:25}],
  'rnbqkb1r/pppp1ppp/8/4P3/2P3n1/8/PP2PPPP/RNBQKBNR': [{m:'e2e4',w:63},{m:'c1f4',w:25},{m:'g1f3',w:13}],
  'rnbqkb1r/pppp2pp/4pn2/5p2/2PP4/6P1/PP2PP1P/RNBQKBNR': [{m:'f1g2',w:100}],
  'rnbqkb1r/pppp2pp/4pn2/5p2/2PP4/6P1/PP2PPBP/RNBQK1NR': [{m:'f8e7',w:92},{m:'f8b4',w:8}],
  'rnbqkb1r/ppppp1pp/5n2/5p2/2PP4/6P1/PP2PP1P/RNBQKBNR': [{m:'e7e6',w:75},{m:'g7g6',w:25}],
  'rnbqkb1r/ppppp1pp/5n2/5p2/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'g2g3',w:88},{m:'b1c3',w:13}],
  'rnbqkb1r/ppppp1pp/5n2/5p2/3P4/6P1/PPP1PP1P/RNBQKBNR': [{m:'f1g2',w:100}],
  'rnbqkb1r/ppppp1pp/5n2/5p2/3P4/6P1/PPP1PPBP/RNBQK1NR': [{m:'e7e6',w:50},{m:'d7d6',w:25},{m:'g7g6',w:25}],
  'rnbqkb1r/ppppp1pp/5n2/6B1/3Pp3/2N5/PPP2PPP/R2QKBNR': [{m:'b7b6',w:33},{m:'c7c6',w:33},{m:'g7g6',w:33}],
  'rnbqkb1r/ppppp1pp/5n2/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': [{m:'c1g5',w:67},{m:'f2f3',w:17},{m:'g2g4',w:17}],
  'rnbqkb1r/ppppp2p/5np1/5p2/2PP4/6P1/PP2PP1P/RNBQKBNR': [{m:'f1g2',w:100}],
  'rnbqkb1r/ppppp2p/5np1/5p2/2PP4/6P1/PP2PPBP/RNBQK1NR': [{m:'f8g7',w:100}],
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'f8g7',w:58},{m:'d7d5',w:42}],
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/6P1/PP2PP1P/RNBQKBNR': [{m:'d7d5',w:58},{m:'f8g7',w:42}],
  'rnbqkb1r/pppppp1p/5np1/8/3P4/5N2/PPP1PPPP/RNBQKB1R': [{m:'c1f4',w:29},{m:'c1g5',w:29},{m:'e2e3',w:14},{m:'g2g3',w:14},{m:'b1c3',w:14}],
  'rnbqkb1r/pppppppp/1n6/4P3/2P5/8/PP1P1PPP/RNBQKBNR': [{m:'c4c5',w:75},{m:'b2b3',w:25}],
  'rnbqkb1r/pppppppp/5n2/4P3/8/8/PPPP1PPP/RNBQKBNR': [{m:'f6d5',w:90},{m:'f6g8',w:7},{m:'f6e4',w:3}],
  'rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR': [{m:'f6e4',w:75},{m:'c7c5',w:25}],
  'rnbqkb1r/pppppppp/5n2/8/2P5/2N5/PP1PPPPP/R1BQKBNR': [{m:'e7e6',w:57},{m:'d7d5',w:36},{m:'g7g6',w:7}],
  'rnbqkb1r/pppppppp/5n2/8/3P2P1/8/PPP1PP1P/RNBQKBNR': [{m:'f6g4',w:75},{m:'e7e5',w:25}],
  'rnbqkb1r/pppppppp/5n2/8/3P4/2N5/PPP1PPPP/R1BQKBNR': [{m:'c7c5',w:40},{m:'d7d5',w:40},{m:'e7e5',w:20}],
  'rnbqkb1r/pppppppp/5n2/8/3P4/5N2/PPP1PPPP/RNBQKB1R': [{m:'g7g6',w:35},{m:'e7e6',w:26},{m:'b7b6',w:22},{m:'c7c5',w:9},{m:'b7b5',w:4},{m:'c7c6',w:4}],
  'rnbqkb1r/pppppppp/5n2/8/3P4/5P2/PPP1P1PP/RNBQKBNR': [{m:'d7d5',w:67},{m:'c7c5',w:17},{m:'e7e6',w:17}],
  'rnbqkb1r/pppppppp/5n2/8/4P3/2N5/PPPP1PPP/R1BQKBNR': [{m:'d7d5',w:100}],
  'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR': [{m:'e4e5',w:77},{m:'b1c3',w:13},{m:'f1c4',w:5},{m:'d2d3',w:3},{m:'g1f3',w:3}],
  'rnbqkb1r/pppppppp/8/3nP3/2P5/8/PP1P1PPP/RNBQKBNR': [{m:'d5b6',w:100}],
  'rnbqkb1r/pppppppp/8/3nP3/3P4/8/PPP2PPP/RNBQKBNR': [{m:'d7d6',w:94},{m:'c7c5',w:6}],
  'rnbqkb1r/pppppppp/8/3nP3/8/8/PPPP1PPP/RNBQKBNR': [{m:'d2d4',w:65},{m:'c2c4',w:19},{m:'b2b3',w:4},{m:'f1c4',w:4},{m:'e5e6',w:4},{m:'b1a3',w:4}],
  'rnbqkb1r/pppppppp/8/6B1/3Pn3/8/PPP1PPPP/RN1QKBNR': [{m:'g5h4',w:50},{m:'h2h4',w:33},{m:'g5f4',w:17}],
  'rnbqkbnr/1p1p1ppp/p3p3/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'f1d3',w:43},{m:'c2c4',w:43},{m:'b1c3',w:14}],
  'rnbqkbnr/1p1ppppp/p7/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R': [{m:'d7d6',w:33},{m:'e7e6',w:33},{m:'b8c6',w:33}],
  'rnbqkbnr/1p1ppppp/p7/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'c5d4',w:100}],
  'rnbqkbnr/1p1ppppp/p7/2p5/4P3/2P2N2/PP1P1PPP/RNBQKB1R': [{m:'b7b5',w:25},{m:'d7d5',w:25},{m:'d7d6',w:25},{m:'g8f6',w:25}],
  'rnbqkbnr/1p1ppppp/p7/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': [{m:'d2d4',w:33},{m:'c2c3',w:28},{m:'c2c4',w:22},{m:'b2b3',w:6},{m:'b2b4',w:6},{m:'f1e2',w:6}],
  'rnbqkbnr/1p1ppppp/p7/8/3pP3/5N2/PPP2PPP/RNBQKB1R': [{m:'f3d4',w:40},{m:'f1c4',w:20},{m:'c2c3',w:20},{m:'d1d4',w:20}],
  'rnbqkbnr/1pp1pppp/p7/8/2pP4/5N2/PP2PPPP/RNBQKB1R': [{m:'e2e3',w:75},{m:'e2e4',w:25}],
  'rnbqkbnr/1ppppppp/p7/8/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'e7e6',w:43},{m:'b7b5',w:29},{m:'e7e5',w:14},{m:'b8c6',w:14}],
  'rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR': [{m:'d2d4',w:100}],
  'rnbqkbnr/p1pp1ppp/1p2p3/8/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'e2e4',w:50},{m:'b1c3',w:50}],
  'rnbqkbnr/p1pppppp/1p6/8/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'c8b7',w:71},{m:'c8a6',w:14},{m:'c7c5',w:14}],
  'rnbqkbnr/p1pppppp/1p6/8/4P3/8/PPPP1PPP/RNBQKBNR': [{m:'d2d4',w:100}],
  'rnbqkbnr/pp1p1ppp/4p3/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'c5d4',w:97},{m:'d7d5',w:3}],
  'rnbqkbnr/pp1p1ppp/4p3/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'b8c6',w:43},{m:'a7a6',w:29},{m:'g8f6',w:25},{m:'d8b6',w:4}],
  'rnbqkbnr/pp1p1ppp/4p3/8/3pP3/5N2/PPP2PPP/RNBQKB1R': [{m:'f3d4',w:100}],
  'rnbqkbnr/pp1p1ppp/4p3/8/4P3/2N5/PP3PPP/R1BQKBNR': [{m:'g1f3',w:67},{m:'f1c4',w:33}],
  'rnbqkbnr/pp1ppp1p/6p1/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'f7f5',w:67},{m:'f8g7',w:33}],
  'rnbqkbnr/pp1ppp1p/6p1/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': [{m:'d2d4',w:75},{m:'c2c4',w:25}],
  'rnbqkbnr/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'d7d5',w:94},{m:'f7f5',w:2},{m:'b8a6',w:2},{m:'g8f6',w:2}],
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/2N5/PPPP1PPP/R1BQKBNR': [{m:'d7d5',w:100}],
  'rnbqkbnr/pp1ppppp/8/2p5/1P2P3/8/P1PP1PPP/RNBQKBNR': [{m:'c5b4',w:100}],
  'rnbqkbnr/pp1ppppp/8/2p5/2P5/2N5/PP1PPPPP/R1BQKBNR': [{m:'b8c6',w:67},{m:'g8f6',w:33}],
  'rnbqkbnr/pp1ppppp/8/2p5/2P5/5N2/PP1PPPPP/RNBQKB1R': [{m:'g8f6',w:100}],
  'rnbqkbnr/pp1ppppp/8/2p5/2P5/8/PP1PPPPP/RNBQKBNR': [{m:'b1c3',w:64},{m:'g1f3',w:32},{m:'b2b4',w:4}],
  'rnbqkbnr/pp1ppppp/8/2p5/3P4/8/PPP1PPPP/RNBQKBNR': [{m:'d4d5',w:70},{m:'d4c5',w:15},{m:'g1f3',w:10},{m:'b2b4',w:5}],
  'rnbqkbnr/pp1ppppp/8/2p5/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'c5d4',w:100}],
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR': [{m:'b8c6',w:77},{m:'e7e6',w:15},{m:'d7d6',w:8}],
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/2P5/PP1P1PPP/RNBQKBNR': [{m:'g8f6',w:67},{m:'d7d5',w:33}],
  'rnbqkbnr/pp1ppppp/8/2pP4/8/8/PPP1PPPP/RNBQKBNR': [{m:'g8f6',w:43},{m:'d7d6',w:14},{m:'e7e5',w:14},{m:'f7f5',w:14},{m:'e7e6',w:7},{m:'b8a6',w:7}],
  'rnbqkbnr/pp1ppppp/8/8/1p2P3/8/P1PP1PPP/RNBQKBNR': [{m:'a2a3',w:60},{m:'c1b2',w:20},{m:'c2c4',w:20}],
  'rnbqkbnr/pp1ppppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR': [{m:'d4c3',w:68},{m:'d4d3',w:11},{m:'d7d5',w:5},{m:'e7e5',w:5},{m:'g8f6',w:5},{m:'d8a5',w:5}],
  'rnbqkbnr/pp1ppppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR': [{m:'c2c3',w:88},{m:'g1f3',w:8},{m:'f2f4',w:4}],
  'rnbqkbnr/pp1ppppp/8/8/4P3/2N5/PP3PPP/R1BQKBNR': [{m:'b8c6',w:67},{m:'e7e6',w:25},{m:'d7d6',w:8}],
  'rnbqkbnr/pp1ppppp/8/8/4P3/2p5/PP3PPP/RNBQKBNR': [{m:'b1c3',w:100}],
  'rnbqkbnr/pp2pppp/2p5/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R': [{m:'b2b3',w:100}],
  'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'e7e5',w:67},{m:'d5c4',w:33}],
  'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R': [{m:'g8f6',w:97},{m:'c8f5',w:3}],
  'rnbqkbnr/pp2pppp/2p5/3P4/3P4/8/PPP2PPP/RNBQKBNR': [{m:'c6d5',w:100}],
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR': [{m:'d5e4',w:81},{m:'g7g6',w:10},{m:'b7b5',w:5},{m:'g8f6',w:5}],
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'b1c3',w:49},{m:'e4e5',w:20},{m:'e4d5',w:16},{m:'f2f3',w:7},{m:'b1d2',w:7},{m:'f1d3',w:2}],
  'rnbqkbnr/pp2pppp/2p5/3p4/4P3/2N2N2/PPPP1PPP/R1BQKB1R': [{m:'c8g4',w:67},{m:'d5e4',w:33}],
  'rnbqkbnr/pp2pppp/2p5/3p4/4P3/2N5/PPPP1PPP/R1BQKBNR': [{m:'g1f3',w:67},{m:'d2d3',w:17},{m:'d1f3',w:17}],
  'rnbqkbnr/pp2pppp/2p5/3P4/8/8/PPPP1PPP/RNBQKBNR': [{m:'d5c6',w:100}],
  'rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR': [{m:'c8f5',w:88},{m:'c6c5',w:13}],
  'rnbqkbnr/pp2pppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR': [{m:'b8d7',w:33},{m:'g8f6',w:33},{m:'c8f5',w:27},{m:'h7h6',w:7}],
  'rnbqkbnr/pp2pppp/2p5/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': [{m:'c3e4',w:88},{m:'f1c4',w:6},{m:'f2f3',w:6}],
  'rnbqkbnr/pp2pppp/2P5/8/8/8/PPPP1PPP/RNBQKBNR': [{m:'e7e5',w:67},{m:'b8c6',w:33}],
  'rnbqkbnr/pp2pppp/3p4/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R': [{m:'c8d7',w:50},{m:'b8c6',w:50}],
  'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'c5d4',w:98}],
  'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R': [{m:'g8f6',w:100}],
  'rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R': [{m:'f3d4',w:97},{m:'d1d4',w:2}],
  'rnbqkbnr/pp2pppp/8/2pp4/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'c4d5',w:67},{m:'d4c5',w:33}],
  'rnbqkbnr/pp2pppp/8/3p4/2PP4/8/PP3PPP/RNBQKBNR': [{m:'g8f6',w:100}],
  'rnbqkbnr/pp2pppp/8/3p4/3P4/8/PPP2PPP/RNBQKBNR': [{m:'c2c4',w:100}],
  'rnbqkbnr/pp3ppp/2p1p3/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'d5c4',w:100}],
  'rnbqkbnr/pp3ppp/2p1p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'g1f3',w:44},{m:'e2e4',w:33},{m:'e2e3',w:22}],
  'rnbqkbnr/pp3ppp/2p1p3/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'c1g5',w:50},{m:'a2a4',w:25},{m:'g2g3',w:25}],
  'rnbqkbnr/pp3ppp/4p3/2pp4/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'c4d5',w:95},{m:'e2e3',w:5}],
  'rnbqkbnr/pp3ppp/4p3/2pP4/3P4/2N5/PP2PPPP/R1BQKBNR': [{m:'e6d5',w:89},{m:'c5d4',w:11}],
  'rnbqkbnr/pp3ppp/4p3/2pP4/3P4/8/PPPN1PPP/R1BQKBNR': [{m:'e6d5',w:50},{m:'g8f6',w:25},{m:'d8d5',w:25}],
  'rnbqkbnr/pp3ppp/4p3/2pp4/3PP3/8/PPPN1PPP/R1BQKBNR': [{m:'e4d5',w:100}],
  'rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/2P5/PP3PPP/RNBQKBNR': [{m:'b8c6',w:83},{m:'d8b6',w:17}],
  'rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/8/PPP2PPP/RNBQKBNR': [{m:'c2c3',w:60},{m:'g1f3',w:20},{m:'b2b4',w:10},{m:'d1g4',w:10}],
  'rnbqkbnr/pp3ppp/8/2pp4/3P4/2N2N2/PP2PPPP/R1BQKB1R': [{m:'b8c6',w:100}],
  'rnbqkbnr/pp3ppp/8/2pp4/3P4/2N5/PP2PPPP/R1BQKBNR': [{m:'g1f3',w:88},{m:'d4c5',w:6},{m:'e2e4',w:6}],
  'rnbqkbnr/ppp1pppp/3p4/8/3P4/8/PPP1PPPP/RNBQKBNR': [{m:'c2c4',w:75},{m:'g1f3',w:25}],
  'rnbqkbnr/ppp1pppp/3p4/8/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'g8f6',w:87},{m:'e7e5',w:6},{m:'e7e6',w:3},{m:'f7f5',w:3}],
  'rnbqkbnr/ppp1pppp/8/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R': [{m:'d5d4',w:50},{m:'c7c6',w:17},{m:'d5c4',w:17},{m:'e7e6',w:17}],
  'rnbqkbnr/ppp1pppp/8/3p4/2P5/8/PP1PPPPP/RNBQKBNR': [{m:'c4d5',w:100}],
  'rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR': [{m:'c7c5',w:100}],
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/2N5/PPP1PPPP/R1BQKBNR': [{m:'g8f6',w:62},{m:'c8f5',w:8},{m:'c8g4',w:8},{m:'c7c5',w:8},{m:'e7e5',w:8},{m:'f7f5',w:8}],
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R': [{m:'g8f6',w:75},{m:'c8g4',w:10},{m:'c7c5',w:10},{m:'b8c6',w:5}],
  'rnbqkbnr/ppp1pppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'d5e4',w:100}],
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/2N5/PPPP1PPP/R1BQKBNR': [{m:'d5e4',w:100}],
  'rnbqkbnr/ppp1pppp/8/3p4/5P2/8/PPPPP1PP/RNBQKBNR': [{m:'e2e4',w:67},{m:'c2c4',w:33}],
  'rnbqkbnr/ppp1pppp/8/3p4/6P1/8/PPPPPP1P/RNBQKBNR': [{m:'f1g2',w:67},{m:'e2e4',w:17},{m:'h2h3',w:17}],
  'rnbqkbnr/ppp1pppp/8/3p4/6P1/8/PPPPPPBP/RNBQK1NR': [{m:'c8g4',w:50},{m:'c7c6',w:50}],
  'rnbqkbnr/ppp1pppp/8/3p4/8/2N5/PPPPPPPP/R1BQKBNR': [{m:'e2e4',w:100}],
  'rnbqkbnr/ppp1pppp/8/3P4/8/8/PP1PPPPP/RNBQKBNR': [{m:'e7e6',w:33},{m:'g8f6',w:33},{m:'d8d5',w:33}],
  'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR': [{m:'g8f6',w:44},{m:'d8d5',w:37},{m:'c7c6',w:11},{m:'e7e5',w:7}],
  'rnbqkbnr/ppp1pppp/8/8/2pP4/4P3/PP3PPP/RNBQKBNR': [{m:'e7e5',w:100}],
  'rnbqkbnr/ppp1pppp/8/8/2pP4/5N2/PP2PPPP/RNBQKB1R': [{m:'g8f6',w:68},{m:'a7a6',w:16},{m:'c7c5',w:6},{m:'b7b5',w:3},{m:'e7e6',w:3},{m:'b8d7',w:3}],
  'rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR': [{m:'g1f3',w:67},{m:'e2e4',w:23},{m:'e2e3',w:8},{m:'b1c3',w:2}],
  'rnbqkbnr/ppp1pppp/8/8/2pPP3/8/PP3PPP/RNBQKBNR': [{m:'c7c5',w:30},{m:'e7e5',w:20},{m:'f7f5',w:20},{m:'b7b5',w:10},{m:'b8c6',w:10},{m:'g8f6',w:10}],
  'rnbqkbnr/ppp1pppp/8/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': [{m:'g8f6',w:75},{m:'e7e5',w:11},{m:'c8f5',w:5},{m:'e7e6',w:5},{m:'c8d7',w:2},{m:'c7c5',w:2}],
  'rnbqkbnr/ppp1pppp/8/8/3Pp3/8/PPP2PPP/RNBQKBNR': [{m:'b1c3',w:92},{m:'f2f3',w:5},{m:'f1c4',w:2},{m:'c1e3',w:2}],
  'rnbqkbnr/ppp1pppp/8/8/4p3/2N5/PPPP1PPP/R1BQKBNR': [{m:'d2d3',w:33},{m:'f2f3',w:33},{m:'c3e4',w:33}],
  'rnbqkbnr/ppp2ppp/3p4/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR': [{m:'g2g3',w:50},{m:'g1f3',w:50}],
  'rnbqkbnr/ppp2ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': [{m:'b8d7',w:30},{m:'e5d4',w:26},{m:'g8f6',w:26},{m:'f7f5',w:9},{m:'c8d7',w:4},{m:'c8g4',w:4}],
  'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': [{m:'d2d4',w:96},{m:'f1c4',w:4}],
  'rnbqkbnr/ppp2ppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R': [{m:'f3d4',w:40},{m:'f1c4',w:20},{m:'c2c3',w:20},{m:'d1d4',w:20}],
  'rnbqkbnr/ppp2ppp/4p3/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R': [{m:'g2g3',w:89},{m:'b2b3',w:11}],
  'rnbqkbnr/ppp2ppp/4p3/3p4/2P5/5NP1/PP1PPP1P/RNBQKB1R': [{m:'g8f6',w:83},{m:'c7c6',w:17}],
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': [{m:'g8f6',w:74},{m:'c7c5',w:15},{m:'c7c6',w:7}],
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R': [{m:'g8f6',w:73},{m:'c7c5',w:18},{m:'c7c6',w:9}],
  'rnbqkbnr/ppp2ppp/4p3/3P4/3P4/8/PPP2PPP/RNBQKBNR': [{m:'e6d5',w:100}],
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR': [{m:'g8f6',w:57},{m:'f8b4',w:32},{m:'d5e4',w:10}],
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'b1c3',w:67},{m:'b1d2',w:13},{m:'e4e5',w:13},{m:'e4d5',w:3},{m:'c1e3',w:2},{m:'g1f3',w:2}],
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR': [{m:'c7c5',w:38},{m:'b8c6',w:31},{m:'g8f6',w:15},{m:'f8e7',w:8},{m:'f7f5',w:8}],
  'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR': [{m:'c7c5',w:83},{m:'c8d7',w:17}],
  'rnbqkbnr/ppp2ppp/4p3/8/3PN3/8/PPP2PPP/R1BQKBNR': [{m:'b8d7',w:50},{m:'e6e5',w:25},{m:'d8d5',w:25}],
  'rnbqkbnr/ppp2ppp/4p3/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': [{m:'c3e4',w:50},{m:'c1e3',w:25},{m:'f2f3',w:25}],
  'rnbqkbnr/ppp2ppp/8/3P4/4pP2/3P4/PPP3PP/RNBQKBNR': [{m:'g8f6',w:100}],
  'rnbqkbnr/ppp2ppp/8/3P4/4pP2/8/PPPP2PP/RNBQKBNR': [{m:'d2d3',w:80},{m:'f1b5',w:20}],
  'rnbqkbnr/ppp2ppp/8/3pP3/2P5/8/PP2PPPP/RNBQKBNR': [{m:'d5d4',w:100}],
  'rnbqkbnr/ppp2ppp/8/3pp3/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'d4e5',w:100}],
  'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R': [{m:'e4d5',w:80},{m:'f3e5',w:20}],
  'rnbqkbnr/ppp2ppp/8/3pp3/4PP2/8/PPPP2PP/RNBQKBNR': [{m:'e4d5',w:86},{m:'d2d4',w:7},{m:'g1f3',w:7}],
  'rnbqkbnr/ppp2ppp/8/3Pp3/5P2/8/PPPP2PP/RNBQKBNR': [{m:'e5e4',w:55},{m:'c7c6',w:27},{m:'f8c5',w:9},{m:'e5f4',w:9}],
  'rnbqkbnr/ppp2ppp/8/3Pp3/8/5N2/PPPP1PPP/RNBQKB1R': [{m:'f8d6',w:75},{m:'e5e4',w:25}],
  'rnbqkbnr/ppp2ppp/8/4p3/2BP4/4P3/PP3PPP/RNBQK1NR': [{m:'e5d4',w:100}],
  'rnbqkbnr/ppp2ppp/8/4p3/2pP4/4P3/PP3PPP/RNBQKBNR': [{m:'f1c4',w:100}],
  'rnbqkbnr/ppp2ppp/8/4P3/2Pp4/5N2/PP2PPPP/RNBQKB1R': [{m:'b8c6',w:67},{m:'c7c5',w:33}],
  'rnbqkbnr/ppp2ppp/8/4P3/2Pp4/8/PP2PPPP/RNBQKBNR': [{m:'g1f3',w:80},{m:'e2e3',w:20}],
  'rnbqkbnr/ppp2ppp/8/4p3/3Pp3/2N5/PPP2PPP/R1BQKBNR': [{m:'c1e3',w:20},{m:'d4e5',w:20},{m:'g1e2',w:20},{m:'c3e4',w:20},{m:'d1h5',w:20}],
  'rnbqkbnr/ppp2ppp/8/8/2Bp4/1Q2P3/PP3PPP/RNB1K1NR': [{m:'d8e7',w:100}],
  'rnbqkbnr/ppp2ppp/8/8/2Bp4/4P3/PP3PPP/RNBQK1NR': [{m:'d1b3',w:100}],
  'rnbqkbnr/pppp1N2/7p/8/4PppP/8/PPPP2P1/RNBQKB1R': [{m:'e8f7',w:100}],
  'rnbqkbnr/pppp1p1p/8/4N3/2B1Ppp1/8/PPPP2PP/RNBQK2R': [{m:'d8h4',w:100}],
  'rnbqkbnr/pppp1p1p/8/4N3/4PppP/8/PPPP2P1/RNBQKB1R': [{m:'g8f6',w:62},{m:'f8g7',w:8},{m:'d7d5',w:8},{m:'d7d6',w:8},{m:'h7h5',w:8},{m:'h7h6',w:8}],
  'rnbqkbnr/pppp1p1p/8/6N1/4PppP/8/PPPP2P1/RNBQKB1R': [{m:'h7h6',w:100}],
  'rnbqkbnr/pppp1p1p/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQK2R': [{m:'g5g4',w:73},{m:'f8g7',w:21},{m:'d7d6',w:3},{m:'b8c6',w:3}],
  'rnbqkbnr/pppp1p1p/8/6p1/4Pp1P/5N2/PPPP2P1/RNBQKB1R': [{m:'g5g4',w:100}],
  'rnbqkbnr/pppp1p1p/8/6p1/4Pp2/5N2/PPPP2PP/RNBQKB1R': [{m:'f1c4',w:55},{m:'h2h4',w:35},{m:'d2d4',w:8},{m:'b1c3',w:2}],
  'rnbqkbnr/pppp1p1p/8/8/2B1Pp2/5p2/PPPP2PP/RNBQ1RK1': [{m:'d1f3',w:100}],
  'rnbqkbnr/pppp1p1p/8/8/2B1Pp2/5Q2/PPPP2PP/RNB2RK1': [{m:'d8f6',w:75},{m:'b8c6',w:13},{m:'d8e7',w:13}],
  'rnbqkbnr/pppp1p1p/8/8/2B1Ppp1/5N2/PPPP2PP/RNBQ1RK1': [{m:'g4f3',w:80},{m:'d7d5',w:10},{m:'d8e7',w:10}],
  'rnbqkbnr/pppp1p1p/8/8/2B1Ppp1/5N2/PPPP2PP/RNBQK2R': [{m:'e1g1',w:46},{m:'f3e5',w:25},{m:'d2d4',w:13},{m:'c4f7',w:8},{m:'h2h4',w:4},{m:'b1c3',w:4}],
  'rnbqkbnr/pppp1p1p/8/8/4PppP/5N2/PPPP2P1/RNBQKB1R': [{m:'f3e5',w:76},{m:'f3g5',w:24}],
  'rnbqkbnr/pppp1p2/7p/6N1/4PppP/8/PPPP2P1/RNBQKB1R': [{m:'g5f7',w:100}],
  'rnbqkbnr/pppp1ppp/4p3/8/2P5/5N2/PP1PPPPP/RNBQKB1R': [{m:'d7d5',w:90},{m:'g8f6',w:10}],
  'rnbqkbnr/pppp1ppp/4p3/8/2P5/8/PP1PPPPP/RNBQKBNR': [{m:'g1f3',w:91},{m:'d2d4',w:9}],
  'rnbqkbnr/pppp1ppp/4p3/8/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'b7b6',w:50},{m:'f8b4',w:17},{m:'c7c5',w:17},{m:'e6e5',w:8},{m:'f7f5',w:8}],
  'rnbqkbnr/pppp1ppp/4p3/8/3P4/8/PPP1PPPP/RNBQKBNR': [{m:'c2c4',w:92},{m:'c1f4',w:8}],
  'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'d7d5',w:97}],
  'rnbqkbnr/pppp1ppp/8/4p3/1P6/8/P1PPPPPP/RNBQKBNR': [{m:'c1b2',w:75},{m:'a2a3',w:25}],
  'rnbqkbnr/pppp1ppp/8/4p3/1P6/8/PBPPPPPP/RN1QKBNR': [{m:'f7f6',w:67},{m:'c7c5',w:33}],
  'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR': [{m:'g8f6',w:45},{m:'f8c5',w:39},{m:'b7b5',w:6},{m:'f7f5',w:6},{m:'d7d5',w:3}],
  'rnbqkbnr/pppp1ppp/8/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR': [{m:'b8c6',w:56},{m:'g8f6',w:28},{m:'d7d6',w:11},{m:'f8b4',w:3},{m:'f7f5',w:3}],
  'rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR': [{m:'b1c3',w:86},{m:'g1f3',w:5},{m:'e2e3',w:2},{m:'f2f4',w:2},{m:'g2g3',w:2},{m:'d1a4',w:2}],
  'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR': [{m:'d4e5',w:83},{m:'d4d5',w:17}],
  'rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'e5d4',w:91},{m:'d7d5',w:5},{m:'d7d6',w:5}],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR': [{m:'g8f6',w:48},{m:'b8c6',w:40},{m:'f8c5',w:6},{m:'f8b4',w:4},{m:'d7d6',w:2}],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/3P4/PPP2PPP/RNBQKBNR': [{m:'d7d5',w:33},{m:'f7f5',w:33},{m:'g8f6',w:33}],
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5P2/PPPP2PP/RNBQKBNR': [{m:'g8f6',w:100}],
  'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR': [{m:'e5f4',w:82},{m:'d7d5',w:10},{m:'f8c5',w:4},{m:'b8c6',w:2}],
  'rnbqkbnr/pppp1ppp/8/4p3/8/2N1P3/PPPP1PPP/R1BQKBNR': [{m:'d7d5',w:33},{m:'b8c6',w:33},{m:'g8f6',w:33}],
  'rnbqkbnr/pppp1ppp/8/4p3/8/2N5/PPPPPPPP/R1BQKBNR': [{m:'a2a3',w:33},{m:'f2f4',w:33},{m:'g1f3',w:33}],
  'rnbqkbnr/pppp1ppp/8/4p3/8/4P3/PPPP1PPP/RNBQKBNR': [{m:'b1c3',w:60},{m:'f1c4',w:20},{m:'c2c4',w:20}],
  'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPP1PPPP/RNBQKBNR': [{m:'b8c6',w:70},{m:'d7d6',w:10},{m:'f7f6',w:10},{m:'d8h4',w:10}],
  'rnbqkbnr/pppp1ppp/8/8/2B1P3/2p5/PP3PPP/RNBQK1NR': [{m:'c3b2',w:100}],
  'rnbqkbnr/pppp1ppp/8/8/2B1P3/8/PB3PPP/RN1QK1NR': [{m:'f8b4',w:25},{m:'d7d5',w:25},{m:'g8f6',w:25},{m:'d8e7',w:25}],
  'rnbqkbnr/pppp1ppp/8/8/2B1P3/8/Pp3PPP/RNBQK1NR': [{m:'c1b2',w:100}],
  'rnbqkbnr/pppp1ppp/8/8/2B1Pp2/8/PPPP2PP/RNBQK1NR': [{m:'d8h4',w:60},{m:'g8f6',w:15},{m:'d7d5',w:10},{m:'b7b5',w:5},{m:'c7c6',w:5},{m:'f7f5',w:5}],
  'rnbqkbnr/pppp1ppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR': [{m:'d4c3',w:71},{m:'d7d5',w:14},{m:'g8e7',w:14}],
  'rnbqkbnr/pppp1ppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR': [{m:'c2c3',w:42},{m:'d1d4',w:26},{m:'f2f4',w:11},{m:'g1f3',w:11},{m:'f1c4',w:5},{m:'f1d3',w:5}],
  'rnbqkbnr/pppp1ppp/8/8/3QP3/8/PPP2PPP/RNB1KBNR': [{m:'b8c6',w:100}],
  'rnbqkbnr/pppp1ppp/8/8/4P3/2p5/PP3PPP/RNBQKBNR': [{m:'f1c4',w:100}],
  'rnbqkbnr/pppp1ppp/8/8/4Pp2/5N2/PPPP2PP/RNBQKB1R': [{m:'g7g5',w:85},{m:'f8e7',w:5},{m:'d7d5',w:3},{m:'d7d6',w:3},{m:'g8f6',w:3}],
  'rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP2PP/RNBQKBNR': [{m:'g1f3',w:72},{m:'f1c4',w:21},{m:'f1e2',w:2},{m:'g2g3',w:2},{m:'e1f2',w:2},{m:'b1c3',w:2}],
  'rnbqkbnr/pppp2pp/4p3/5p2/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'e2e4',w:50},{m:'b1c3',w:50}],
  'rnbqkbnr/pppp2pp/8/4N3/2B1p3/8/PPPP1PPP/RNBQK2R': [{m:'d8g5',w:67},{m:'d7d5',w:33}],
  'rnbqkbnr/pppp2pp/8/4Np2/4P3/8/PPPP1PPP/RNBQKB1R': [{m:'d8f6',w:73},{m:'b8c6',w:9},{m:'g8f6',w:9},{m:'d8e7',w:9}],
  'rnbqkbnr/pppp2pp/8/4p3/2B1p3/5N2/PPPP1PPP/RNBQK2R': [{m:'f3e5',w:100}],
  'rnbqkbnr/pppp2pp/8/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R': [{m:'f5e4',w:60},{m:'b7b5',w:20},{m:'g8f6',w:20}],
  'rnbqkbnr/pppp2pp/8/4pp2/4P3/5N2/PPPP1PPP/RNBQKB1R': [{m:'f3e5',w:52},{m:'f1c4',w:29},{m:'b2b4',w:5},{m:'c2c4',w:5},{m:'d2d3',w:5},{m:'d2d4',w:5}],
  'rnbqkbnr/ppppp1pp/8/5p2/2P5/8/PP1PPPPP/RNBQKBNR': [{m:'e2e4',w:43},{m:'g2g4',w:29},{m:'b2b4',w:14},{m:'g1f3',w:14}],
  'rnbqkbnr/ppppp1pp/8/5p2/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'g8f6',w:81},{m:'e7e6',w:13},{m:'g7g6',w:6}],
  'rnbqkbnr/ppppp1pp/8/5p2/3P4/3Q4/PPP1PPPP/RNB1KBNR': [{m:'g8f6',w:33},{m:'d7d5',w:17},{m:'d7d6',w:17},{m:'e7e6',w:17},{m:'g7g6',w:17}],
  'rnbqkbnr/ppppp1pp/8/5p2/3P4/6P1/PPP1PP1P/RNBQKBNR': [{m:'g8f6',w:67},{m:'g7g6',w:33}],
  'rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR': [{m:'c2c4',w:52},{m:'e2e4',w:16},{m:'g2g3',w:11},{m:'d1d3',w:11},{m:'g2g4',w:5},{m:'b1c3',w:5}],
  'rnbqkbnr/ppppp1pp/8/5p2/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'f5e4',w:89},{m:'d7d6',w:11}],
  'rnbqkbnr/ppppp1pp/8/5p2/5P2/8/PPPPP1PP/RNBQKBNR': [{m:'d2d4',w:67},{m:'e2e4',w:33}],
  'rnbqkbnr/ppppp1pp/8/5p2/8/5N2/PPPPPPPP/RNBQKB1R': [{m:'e2e4',w:75},{m:'d2d3',w:25}],
  'rnbqkbnr/ppppp1pp/8/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': [{m:'g8f6',w:100}],
  'rnbqkbnr/ppppp1pp/8/8/3Pp3/8/PPP2PPP/RNBQKBNR': [{m:'b1c3',w:86},{m:'b1d2',w:14}],
  'rnbqkbnr/pppppp1p/6p1/8/2PP4/8/PP2PPPP/RNBQKBNR': [{m:'f8g7',w:100}],
  'rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR': [{m:'c2c4',w:91},{m:'h2h4',w:9}],
  'rnbqkbnr/pppppp1p/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'f8g7',w:86},{m:'f7f5',w:5},{m:'g8f6',w:5},{m:'g8h6',w:5}],
  'rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR': [{m:'d2d4',w:96},{m:'f1c4',w:4}],
  'rnbqkbnr/pppppp1p/8/6p1/3PP3/8/PPP2PPP/RNBQKBNR': [{m:'f8g7',w:33},{m:'e7e5',w:33},{m:'h7h6',w:33}],
  'rnbqkbnr/pppppp1p/8/6p1/4P3/8/PPPP1PPP/RNBQKBNR': [{m:'d2d4',w:100}],
  'rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR': [{m:'e7e5',w:40},{m:'c7c6',w:20},{m:'c7c5',w:10},{m:'d7d5',w:10},{m:'b8a6',w:10},{m:'b8c6',w:10}],
  'rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR': [{m:'d7d5',w:36},{m:'f7f5',w:27},{m:'e7e5',w:9},{m:'g7g5',w:9},{m:'g8f6',w:9},{m:'g8h6',w:9}],
  'rnbqkbnr/pppppppp/8/8/6P1/8/PPPPPP1P/RNBQKBNR': [{m:'d7d5',w:55},{m:'e7e5',w:9},{m:'f7f5',w:9},{m:'g7g5',w:9},{m:'g7g6',w:9},{m:'g8h6',w:9}],
  'rnbqkbnr/pppppppp/8/8/8/1P6/P1PPPPPP/RNBQKBNR': [{m:'e7e5',w:33},{m:'g8f6',w:22},{m:'b7b6',w:11},{m:'c7c5',w:11},{m:'d7d5',w:11},{m:'f7f5',w:11}],
  'rnbqkbnr/pppppppp/8/8/8/2N5/PPPPPPPP/R1BQKBNR': [{m:'e7e5',w:33},{m:'d7d5',w:25},{m:'c7c5',w:17},{m:'a7a6',w:8},{m:'f7f5',w:8},{m:'g7g6',w:8}],
  'rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR': [{m:'c7c5',w:33},{m:'e7e5',w:33},{m:'g7g6',w:33}],
  'rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR': [{m:'e7e5',w:86},{m:'d7d5',w:14}],
  'rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPP1P/RNBQKBNR': [{m:'d7d5',w:50},{m:'e7e5',w:25},{m:'h7h5',w:25}],
  'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR': [{m:'a7a5',w:33},{m:'e7e5',w:33},{m:'g7g6',w:33}],
  'rnbqkbnr/pppppppp/8/8/P7/8/1PPPPPPP/RNBQKBNR': [{m:'b7b5',w:33},{m:'b7b6',w:33},{m:'e7e5',w:33}],
  'rnbqr1k1/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP2BPPP/R1BQ1RK1': [{m:'f3d2',w:100}],
};

const OPENING_NAMES = {
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR': 'Larsen-Santasiere (McDonnell Attack) Variation, Sicilian; B21',
  'rnbqkbnr/pppppppp/8/8/8/P7/1PPPPPPP/RNBQKBNR': 'Polish Gambit, Anderssen\'s Opening',
  'rnbqkbnr/pppppppp/8/8/P7/8/1PPPPPPP/RNBQKBNR': 'Cologne Gambit, Ware Opening',
  'rnbqkbnr/pppppppp/8/8/8/1P6/P1PPPPPP/RNBQKBNR': 'Symmetrical Variation, Larsen',
  'rnbqkbnr/pppppppp/8/8/1P6/8/P1PPPPPP/RNBQKBNR': 'Karniewski; Tubingen Variation, Polish',
  'rnbqkbnr/pppp1ppp/8/4p3/1P6/8/P1PPPPPP/RNBQKBNR': 'Schiffler-Sokolsky; Tartakower Gambit',
  'rnbqkbnr/pppp1ppp/8/4p3/1P6/8/PBPPPPPP/RN1QKBNR': 'Schiffler-Sokolsky; Tartakower Gambit',
  'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR': 'Fianchetto Lines, Two Knights Variation, English; A24',
  'rn1qkbnr/pbpp1ppp/1p2p3/8/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Hartlaub Gambit, English',
  'rn1qkbnr/pbpp1ppp/1p2p3/8/2PPP3/2N5/PP3PPP/R1BQKBNR': 'Hartlaub Gambit, English',
  'rn1qkbnr/pbpp2pp/1p2p3/5p2/2PPP3/2N5/PP3PPP/R1BQKBNR': 'Hartlaub Gambit, English',
  'rnbqkbnr/pp1ppppp/8/2p5/2P5/8/PP1PPPPP/RNBQKBNR': 'Two Knights Variation, Symmetrical English; A35',
  'rnbqkbnr/pp1ppppp/8/2p5/2P5/2N5/PP1PPPPP/R1BQKBNR': 'Two Knights Variation, Symmetrical English; A35',
  'r1bqkbnr/pp1ppppp/2n5/2p5/2P5/2N5/PP1PPPPP/R1BQKBNR': 'Fianchetto Variation, Symmetrical English; A36',
  'r1bqkbnr/pp1ppppp/2n5/2p5/2P5/2N3P1/PP1PPP1P/R1BQKBNR': 'Botvinnik System Reversed, Symmetrical English',
  'r1bqkbnr/pp1ppp1p/2n3p1/2p5/2P5/2N3P1/PP1PPP1P/R1BQKBNR': 'Botvinnik System Reversed, Symmetrical English',
  'r1bqkbnr/pp1ppp1p/2n3p1/2p5/2P5/2N3P1/PP1PPPBP/R1BQK1NR': 'Botvinnik System Reversed, Symmetrical English',
  'r1bqk1nr/pp1pppbp/2n3p1/2p5/2P5/2N3P1/PP1PPPBP/R1BQK1NR': 'Botvinnik System Reversed, Symmetrical English',
  'r1bqk1nr/pp1pppbp/2n3p1/2p5/2P5/2N2NP1/PP1PPPBP/R1BQK2R': 'Full Symmetry Line, Symmetrical English; A38',
  'r1bqk2r/pp1pppbp/2n2np1/2p5/2P5/2N2NP1/PP1PPPBP/R1BQK2R': 'Mecking Variation, Symmetrical English; A39',
  'r1bqk2r/pp1pppbp/2n2np1/2p5/2P5/2N2NP1/PP1PPPBP/R1BQ1RK1': 'Mecking Variation, Symmetrical English; A39',
  'r1bq1rk1/pp1pppbp/2n2np1/2p5/2P5/2N2NP1/PP1PPPBP/R1BQ1RK1': 'Mecking Variation, Symmetrical English; A39',
  'rnbqkb1r/pp1ppppp/5n2/2p5/2P5/2N5/PP1PPPPP/R1BQKBNR': 'Fianchetto Variation, Symmetrical English  ',
  'rnbqkbnr/pp1ppppp/8/2p5/2P5/5N2/PP1PPPPP/RNBQKB1R': 'Anti-Benoni Variation, Symmetrical English; A31',
  'rnbqkb1r/pp1ppppp/5n2/2p5/2P5/5N2/PP1PPPPP/RNBQKB1R': 'Anti-Benoni Variation, Symmetrical English; A31',
  'rnbqkb1r/pp1ppppp/5n2/2p5/2PP4/5N2/PP2PPPP/RNBQKB1R': 'Spielmann Defense, Symmetrical English; A32',
  'rnbqkb1r/pp1ppppp/5n2/8/2Pp4/5N2/PP2PPPP/RNBQKB1R': 'Spielmann Defense, Symmetrical English; A32',
  'rnbqkb1r/pp1ppppp/5n2/8/2PN4/8/PP2PPPP/RNBQKB1R': 'Spielmann Defense, Symmetrical English; A32',
  'rnbqkbnr/pp2pppp/2p5/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R': 'London V; New York V, Reti',
  'rnbqkbnr/ppp1pppp/8/3p4/2P5/8/PP1PPPPP/RNBQKBNR': 'Malvinas Variation, English',
  'rnbqkbnr/ppp1pppp/8/3P4/8/8/PP1PPPPP/RNBQKBNR': 'Malvinas Variation, English',
  'rnbqkbnr/pppp1ppp/8/4p3/2P5/8/PP1PPPPP/RNBQKBNR': 'Fianchetto Lines, Two Knights Variation, English; A24',
  'rnbqkbnr/pppp1ppp/8/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR': 'Fianchetto Lines, Two Knights Variation, English; A24',
  'rnbqkbnr/ppp2ppp/3p4/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR': 'General Variation, King\'s English',
  'r1bqkbnr/pppp1ppp/2n5/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR': 'Closed System, Full Symmetry, King\'s English',
  'r1bqkbnr/pppp1ppp/2n5/4p3/2P5/2N3P1/PP1PPP1P/R1BQKBNR': 'Closed System, Full Symmetry, King\'s English',
  'r1bqkbnr/pppp1p1p/2n3p1/4p3/2P5/2N3P1/PP1PPP1P/R1BQKBNR': 'Closed System, Full Symmetry, King\'s English',
  'r1bqkbnr/pppp1p1p/2n3p1/4p3/2P5/2N3P1/PP1PPPBP/R1BQK1NR': 'Closed System, Full Symmetry, King\'s English',
  'r1bqk1nr/pppp1pbp/2n3p1/4p3/2P5/2N3P1/PP1PPPBP/R1BQK1NR': 'Closed System, Full Symmetry, King\'s English',
  'r1bqkbnr/pppp1ppp/2n5/4p3/2P5/2N2N2/PP1PPPPP/R1BQKB1R': 'Fianchetto Line, Four Knights English; A29',
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2P5/2N2N2/PP1PPPPP/R1BQKB1R': 'Fianchetto Line, Four Knights English; A29',
  'rnbqkb1r/pppp1ppp/5n2/4p3/2P5/2N5/PP1PPPPP/R1BQKBNR': 'Fianchetto Lines, Two Knights Variation, English; A24',
  'rnbqkb1r/pppp1ppp/5n2/4p3/2P5/2N3P1/PP1PPP1P/R1BQKBNR': 'Fianchetto Lines, Two Knights Variation, English; A24',
  'rnbqkbnr/pppp1ppp/4p3/8/2P5/8/PP1PPPPP/RNBQKBNR': 'King\'s Knight Variation, English',
  'rnbqkbnr/pppp1ppp/4p3/8/2PP4/8/PP2PPPP/RNBQKBNR': 'Transpositional Variation, Keres Defense',
  'rnbqkbnr/pppp1ppp/4p3/8/2P5/5N2/PP1PPPPP/RNBQKB1R': 'King\'s Knight Variation, English',
  'rnbqkbnr/ppp2ppp/4p3/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R': 'Neo Catalan Declined, English',
  'rnbqkbnr/ppp2ppp/4p3/3p4/2P5/5NP1/PP1PPP1P/RNBQKB1R': 'Neo Catalan Declined, English',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2P5/5NP1/PP1PPP1P/RNBQKB1R': 'Neo Catalan Declined, English',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2P5/5NP1/PP1PPPBP/RNBQK2R': 'Neo Catalan Declined, English',
  'rnbqkbnr/ppppp1pp/8/5p2/2P5/8/PP1PPPPP/RNBQKBNR': 'Porcupine Variation, English',
  'rnbqk1nr/ppppppbp/6p1/8/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Pterodactyl Variation, Modern',
  'rnbqkb1r/pppppppp/5n2/8/2P5/2N5/PP1PPPPP/R1BQKBNR': 'Flohr-Mikenas-Carls Variation, English; A18',
  'rnbqkb1r/ppp1pppp/5n2/3p4/2P5/2N5/PP1PPPPP/R1BQKBNR': 'Korchnoi\'s Variation, English',
  'rnbqkb1r/ppp1pppp/5n2/3P4/8/2N5/PP1PPPPP/R1BQKBNR': 'Korchnoi\'s Variation, English',
  'rnbqkb1r/ppp1pppp/8/3n4/8/2N5/PP1PPPPP/R1BQKBNR': 'Korchnoi\'s Variation, English',
  'rnbqkb1r/pppp1ppp/4pn2/8/2P5/2N5/PP1PPPPP/R1BQKBNR': 'Flohr-Mikenas-Carls Variation, English; A18',
  'rnbqkb1r/pppp1ppp/4pn2/8/2P1P3/2N5/PP1P1PPP/R1BQKBNR': 'Floh-Mikenas-Carls Variation, English; A19',
  'rnbqkb1r/pppp1ppp/4pn2/8/2P5/2N2N2/PP1PPPPP/R1BQKB1R': 'Zviagintsev-Krasenkov Attack, English',
  'rnbqkbnr/pppppppp/8/8/8/3P4/PPP1PPPP/RNBQKBNR': 'Spike Deferred; Myers Spike Attack',
  'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR': 'Bronstein Variation, Nimzo-Indian; E45; Byrne Variation',
  'rnbqkbnr/pp1ppppp/8/2p5/3P4/8/PPP1PPPP/RNBQKBNR': 'Blockade Variation; Semi-Benoni; Russian Variation',
  'rnbqkbnr/pp1ppppp/8/2pP4/8/8/PPP1PPPP/RNBQKBNR': 'Blockade Variation; Semi-Benoni; Russian Variation',
  'rnbqkb1r/pp1ppppp/5n2/2pP4/8/8/PPP1PPPP/RNBQKBNR': 'Habichd; Hawk Variation, Benoni',
  'rnbqkb1r/pp1ppppp/5n2/2pP4/2P5/8/PP2PPPP/RNBQKBNR': 'Nimzovich Variation, Knight\'s Tour Variation, Benoni',
  'rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR': 'Steinitz Countergambit, Queen Pawn Game',
  'rn1qkbnr/ppp1pppp/8/3p1b2/2PP4/8/PP2PPPP/RNBQKBNR': 'Queen Attack, Baltic Defens, QGD',
  'rn1qkbnr/ppp1pppp/8/3p1b2/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Queen Attack, Baltic Defens, QGD',
  'rn1qkbnr/ppp2ppp/4p3/3p1b2/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Queen Attack, Baltic Defens, QGD',
  'rnbqkbnr/pp2pppp/8/2pp4/2PP4/8/PP2PPPP/RNBQKBNR': 'Salvio Countergambit, QGD',
  'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Winawer Counter Gambit, Slav',
  'rnbqkbnr/pp2pppp/2p5/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R': 'Mareschall Variation, Slav; Lasker Variation',
  'rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R': 'Mareschall Variation, Slav; Lasker Variation',
  'rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/4PN2/PP3PPP/RNBQKB1R': 'Schallopp Defense, Slav; D12',
  'rn1qkb1r/pp2pppp/2p2n2/3p1b2/2PP4/4PN2/PP3PPP/RNBQKB1R': 'Amsterdam Variation, Slav',
  'rn1qkb1r/pp2pppp/2p2n2/3P1b2/3P4/4PN2/PP3PPP/RNBQKB1R': 'Amsterdam Variation, Slav',
  'rn1qkb1r/pp2pppp/5n2/3p1b2/3P4/4PN2/PP3PPP/RNBQKB1R': 'Amsterdam Variation, Slav',
  'rnbqkb1r/pp2pppp/2p2n2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Mareschall Variation, Slav; Lasker Variation',
  'rnbqkb1r/pp2pppp/2p2n2/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R': 'Mareschall Variation, Slav; Lasker Variation',
  'rnbqkb1r/pp2pppp/2p2n2/8/P1pP4/2N2N2/1P2PPPP/R1BQKB1R': 'Mareschall Variation, Slav; Lasker Variation',
  'rn1qkb1r/pp2pppp/2p2n2/5b2/P1pP4/2N2N2/1P2PPPP/R1BQKB1R': 'Mareschall Variation, Slav; Lasker Variation',
  'rn1qkb1r/pp2pppp/2p2n2/4Nb2/P1pP4/2N5/1P2PPPP/R1BQKB1R': 'Sharp Line, Wiesbaden Variation, Slav',
  'rnbqkbnr/ppp1pppp/8/8/2pP4/8/PP2PPPP/RNBQKBNR': 'Blackburne\'s Move, QGA; Normal Variation, QGA; D21',
  'rnbqkbnr/ppp1pppp/8/8/2pP4/4P3/PP3PPP/RNBQKBNR': 'Christensen Gambit, QGA',
  'rnbqkbnr/ppp2ppp/8/4p3/2pP4/4P3/PP3PPP/RNBQKBNR': 'Christensen Gambit, QGA',
  'rnbqkbnr/ppp2ppp/8/4p3/2BP4/4P3/PP3PPP/RNBQK1NR': 'Christensen Gambit, QGA',
  'rnbqkbnr/ppp2ppp/8/8/2Bp4/4P3/PP3PPP/RNBQK1NR': 'Christensen Gambit, QGA',
  'rnbqkbnr/ppp2ppp/8/8/2Bp4/1Q2P3/PP3PPP/RNB1K1NR': 'Christensen Gambit, QGA',
  'rnb1kbnr/ppp1qppp/8/8/2Bp4/1Q2P3/PP3PPP/RNB1K1NR': 'Christensen Gambit, QGA',
  'rnbqkbnr/ppp1pppp/8/8/2pPP3/8/PP3PPP/RNBQKBNR': 'Versov; Betbeder; Schwartz Defense, QGA',
  'rnbqkbnr/ppp1pppp/8/8/2pP4/5N2/PP2PPPP/RNBQKB1R': 'Alekhine System, Classical Defense, QGA; D28',
  'rnbqkbnr/1pp1pppp/p7/8/2pP4/5N2/PP2PPPP/RNBQKB1R': 'Borisenko-Furman Variation, QGA',
  'rnbqkb1r/ppp1pppp/5n2/8/2pP4/5N2/PP2PPPP/RNBQKB1R': 'Alekhine System, Classical Defense, QGA; D28',
  'rnbqkb1r/ppp1pppp/5n2/8/2pP4/4PN2/PP3PPP/RNBQKB1R': 'Alekhine System, Classical Defense, QGA; D28',
  'rnbqkb1r/ppp2ppp/4pn2/8/2pP4/4PN2/PP3PPP/RNBQKB1R': 'Alekhine System, Classical Defense, QGA; D28',
  'rnbqkb1r/ppp2ppp/4pn2/8/2BP4/4PN2/PP3PPP/RNBQK2R': 'Alekhine System, Classical Defense, QGA; D28',
  'rnbqkb1r/pp3ppp/4pn2/2p5/2BP4/4PN2/PP3PPP/RNBQK2R': 'Alekhine System, Classical Defense, QGA; D28',
  'rnbqkb1r/pp3ppp/4pn2/2p5/2BP4/4PN2/PP3PPP/RNBQ1RK1': 'Alekhine System, Classical Defense, QGA; D28',
  'rnbqkb1r/1p3ppp/p3pn2/2p5/2BP4/4PN2/PP3PPP/RNBQ1RK1': 'Alekhine System, Classical Defense, QGA; D28',
  'rnbqkb1r/1p3ppp/p3pn2/2p5/2BP4/4PN2/PP2QPPP/RNB2RK1': 'Smyslov Variation, Classical Defense, QGA',
  'rnbqkbnr/ppp2ppp/8/3pp3/2PP4/8/PP2PPPP/RNBQKBNR': 'Fianchetto Variation, Albin Countergambit; D09',
  'rnbqkbnr/ppp2ppp/8/3pP3/2P5/8/PP2PPPP/RNBQKBNR': 'Fianchetto Variation, Albin Countergambit; D09',
  'rnbqkbnr/ppp2ppp/8/4P3/2Pp4/8/PP2PPPP/RNBQKBNR': 'Fianchetto Variation, Albin Countergambit; D09',
  'rnbqkbnr/ppp2ppp/8/4P3/2Pp4/5N2/PP2PPPP/RNBQKB1R': 'Fianchetto Variation, Albin Countergambit; D09',
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Exchange Variation, Tartakower Defense, QGD; D59',
  'rnbqkbnr/pp3ppp/4p3/2pp4/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Lodz; Schlecter; Rubinstein Var, QGD; D33',
  'rnbqkbnr/pp3ppp/4p3/2pP4/3P4/2N5/PP2PPPP/R1BQKBNR': 'Lodz; Schlecter; Rubinstein Var, QGD; D33',
  'rnbqkbnr/pp3ppp/8/2pp4/3P4/2N5/PP2PPPP/R1BQKBNR': 'Lodz; Schlecter; Rubinstein Var, QGD; D33',
  'rnbqkbnr/pp3ppp/8/2pp4/3P4/2N2N2/PP2PPPP/R1BQKB1R': 'Lodz; Schlecter; Rubinstein Var, QGD; D33',
  'r1bqkbnr/pp3ppp/2n5/2pp4/3P4/2N2N2/PP2PPPP/R1BQKB1R': 'Lodz; Schlecter; Rubinstein Var, QGD; D33',
  'r1bqkbnr/pp3ppp/2n5/2pp4/3P4/2N2NP1/PP2PP1P/R1BQKB1R': 'Rubinstein; Normal Position, QGD',
  'r1bqkb1r/pp3ppp/2n2n2/2pp4/3P4/2N2NP1/PP2PP1P/R1BQKB1R': 'Rubinstein; Normal Position, QGD',
  'r1bqkb1r/pp3ppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQK2R': 'Rubinstein; Normal Position, QGD',
  'r1bqk2r/pp2bppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQK2R': 'Rubinstein; Normal Position, QGD',
  'r1bqk2r/pp2bppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQ1RK1': 'Rubinstein; Normal Position, QGD',
  'r1bq1rk1/pp2bppp/2n2n2/2pp4/3P4/2N2NP1/PP2PPBP/R1BQ1RK1': 'Bogoljubow Variation, Tarrasch',
  'r1bq1rk1/pp2bppp/2n2n2/2pp2B1/3P4/2N2NP1/PP2PPBP/R2Q1RK1': 'Bogoljubow Variation, Tarrasch',
  'rnbqkbnr/pp3ppp/2p1p3/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Abrahams; Noteboom; Klaus Junge Var, QGD',
  'rnbqkbnr/pp3ppp/2p1p3/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Abrahams; Noteboom; Klaus Junge Var, QGD',
  'rnbqkbnr/pp3ppp/2p1p3/8/2pP4/2N2N2/PP2PPPP/R1BQKB1R': 'Abrahams; Noteboom; Klaus Junge Var, QGD',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Exchange Variation, Tartakower Defense, QGD; D59',
  'rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR': 'Exchange Variation, Tartakower Defense, QGD; D59',
  'rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR': 'Exchange Variation, Tartakower Defense, QGD; D59',
  'rnbqk2r/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR': 'Exchange Variation, Tartakower Defense, QGD; D59',
  'rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR': 'Exchange Variation, Tartakower Defense, QGD; D59',
  'rnbq1rk1/ppp1bppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R': 'Exchange Variation, Tartakower Defense, QGD; D59',
  'rnbq1rk1/ppp1bpp1/4pn1p/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R': 'Exchange Variation, Tartakower Defense, QGD; D59',
  'rnbq1rk1/ppp1bpp1/4pn1p/3p4/2PP3B/2N1PN2/PP3PPP/R2QKB1R': 'Exchange Variation, Tartakower Defense, QGD; D59',
  'rnbq1rk1/ppp1bpp1/4p2p/3p4/2PPn2B/2N1PN2/PP3PPP/R2QKB1R': 'Bernstein Variation, QGD',
  'rnbq1rk1/ppp1Bpp1/4p2p/3p4/2PPn3/2N1PN2/PP3PPP/R2QKB1R': 'Bernstein Variation, QGD',
  'rnb2rk1/ppp1qpp1/4p2p/3p4/2PPn3/2N1PN2/PP3PPP/R2QKB1R': 'Bernstein Variation, QGD',
  'r1bq1rk1/pppnbppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R': 'Rubinstein Variation, Orthodox Defense, QGD; D61',
  'r1bq1rk1/pppnbppp/4pn2/3p2B1/2PP4/2N1PN2/PP3PPP/2RQKB1R': 'Rubinstein Attack, Orthodox Defense, QGD;  D64',
  'r1bq1rk1/pp1nbppp/2p1pn2/3p2B1/2PP4/2N1PN2/PP3PPP/2RQKB1R': 'Rubinstein Attack, Orthodox Defense, QGD;  D64',
  'r1bq1rk1/pp1nbppp/2p1pn2/3p2B1/2PP4/2NBPN2/PP3PPP/2RQK2R': 'Fianchetto Variation, Orthodox Defense, QGD',
  'r1bq1rk1/pp1nbppp/2p1pn2/6B1/2pP4/2NBPN2/PP3PPP/2RQK2R': 'Fianchetto Variation, Orthodox Defense, QGD',
  'r1bq1rk1/pp1nbppp/2p1pn2/6B1/2BP4/2N1PN2/PP3PPP/2RQK2R': 'Fianchetto Variation, Orthodox Defense, QGD',
  'r1bq1rk1/pp1nbppp/2p1p3/3n2B1/2BP4/2N1PN2/PP3PPP/2RQK2R': 'Janowski Variation, Orthodox Defense, QGD',
  'r1bq1rk1/pp1nBppp/2p1p3/3n4/2BP4/2N1PN2/PP3PPP/2RQK2R': 'Classical Variation, QGD',
  'r1b2rk1/pp1nqppp/2p1p3/3n4/2BP4/2N1PN2/PP3PPP/2RQK2R': 'Classical Variation, QGD',
  'r1b2rk1/pp1nqppp/2p1p3/3n4/2BP4/2N1PN2/PP3PPP/2RQ1RK1': 'Classical Variation, QGD',
  'r1b2rk1/pp1nqppp/2p1p3/8/2BP4/2n1PN2/PP3PPP/2RQ1RK1': 'Classical Variation, QGD',
  'rnbqkb1r/pp3ppp/4pn2/2pp2B1/2PP4/2N5/PP2PPPP/R2QKBNR': 'Primitive Pillsbury Variation, QGD',
  'r1bqkb1r/pppn1ppp/4pn2/3p2B1/2PP4/2N5/PP2PPPP/R2QKBNR': 'Cambridge Springs; Pillsbury Variation, QGD',
  'r1bqkb1r/pppn1ppp/4pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR': 'Cambridge Springs; Pillsbury Variation, QGD',
  'r1bqkb1r/pp1n1ppp/2p1pn2/3p2B1/2PP4/2N1P3/PP3PPP/R2QKBNR': 'Cambridge Springs; Pillsbury Variation, QGD',
  'r1bqkb1r/pp1n1ppp/2p1pn2/3p2B1/2PP4/2N1PN2/PP3PPP/R2QKB1R': 'Cambridge Springs; Pillsbury Variation, QGD',
  'rnbqkb1r/ppp2ppp/4pn2/3P4/3P4/2N5/PP2PPPP/R1BQKBNR': 'Positional Variation, Exchange Variation, QGD',
  'rnbqkb1r/ppp2ppp/5n2/3p4/3P4/2N5/PP2PPPP/R1BQKBNR': 'Positional Variation, Exchange Variation, QGD',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Pillsbury Variation, Semi-Tarrasch',
  'rnbqkb1r/pp3ppp/4pn2/2pp4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Pillsbury Variation, Semi-Tarrasch',
  'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Semi-Slav Defense Accepted; D44',
  'rnbqkb1r/pp3ppp/2p1pn2/3p2B1/2PP4/2N2N2/PP2PPPP/R2QKB1R': 'Semi-Slav Defense Accepted; D44',
  'rnbqkb1r/pp3ppp/2p1pn2/6B1/2pP4/2N2N2/PP2PPPP/R2QKB1R': 'Lilienthal Variation, Semi-Slav',
  'rnbqkb1r/pp3ppp/2p1pn2/6B1/2pPP3/2N2N2/PP3PPP/R2QKB1R': 'Lilienthal Variation, Semi-Slav',
  'rnbqkb1r/p4ppp/2p1pn2/1p4B1/2pPP3/2N2N2/PP3PPP/R2QKB1R': 'Lilienthal Variation, Semi-Slav',
  'rnbqkb1r/p4ppp/2p1pn2/1p2P1B1/2pP4/2N2N2/PP3PPP/R2QKB1R': 'Lilienthal Variation, Semi-Slav',
  'rnbqkb1r/p4pp1/2p1pn1p/1p2P1B1/2pP4/2N2N2/PP3PPP/R2QKB1R': 'Lilienthal Variation, Semi-Slav',
  'rnbqkb1r/p4pp1/2p1pn1p/1p2P3/2pP3B/2N2N2/PP3PPP/R2QKB1R': 'Lilienthal Variation, Semi-Slav',
  'rnbqkb1r/p4p2/2p1pn1p/1p2P1p1/2pP3B/2N2N2/PP3PPP/R2QKB1R': 'Lilienthal Variation, Semi-Slav',
  'rnbqkb1r/pp3ppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/pp1n1ppp/2p1pn2/8/2pP4/2NBPN2/PP3PPP/R1BQK2R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/pp1n1ppp/2p1pn2/8/2BP4/2N1PN2/PP3PPP/R1BQK2R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/p2n1ppp/2p1pn2/1p6/2BP4/2N1PN2/PP3PPP/R1BQK2R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/p2n1ppp/2p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/3n1ppp/p1p1pn2/1p6/3P4/2NBPN2/PP3PPP/R1BQK2R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/3n1ppp/p1p1pn2/1p6/3PP3/2NB1N2/PP3PPP/R1BQK2R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/3n1ppp/p3pn2/1pp5/3PP3/2NB1N2/PP3PPP/R1BQK2R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/3n1ppp/p3pn2/1pp1P3/3P4/2NB1N2/PP3PPP/R1BQK2R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/3n1ppp/p3pn2/1p2P3/3p4/2NB1N2/PP3PPP/R1BQK2R': 'Blumenfeld Variation, QGD; D49',
  'r1bqkb1r/pp1n1ppp/2p1pn2/3p4/2PP4/2N1PN2/PPQ2PPP/R1B1KB1R': 'Mikhalchishin Line, Semi-Slav',
  'r1bqk2r/pp1n1ppp/2pbpn2/3p4/2PP4/2N1PN2/PPQ2PPP/R1B1KB1R': 'Mikhalchishin Line, Semi-Slav',
  'rnbqkbnr/ppp2ppp/4p3/3p4/2PP4/5N2/PP2PPPP/RNBQKB1R': 'Duras Variation, QGD; Capablanca Variation',
  'rnbqkb1r/ppp2ppp/4pn2/3p2B1/2PP4/5N2/PP2PPPP/RN1QKB1R': 'Duras Variation, QGD; Capablanca Variation',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/4PN2/PP3PPP/RNBQKB1R': 'Semmering Variation, Semi-Slav',
  'r1bqkbnr/ppp1pppp/2n5/3p4/2PP4/8/PP2PPPP/RNBQKBNR': 'Exchange Variation, Chigorin Defense',
  'r1bqkbnr/ppp1pppp/2n5/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Modern Gambit, Chigorin Defense',
  'rnbqkbnr/ppp1pppp/8/3p4/3PP3/8/PPP2PPP/RNBQKBNR': 'Lange Gambit; Alfred Lange Gambit; Simple Variation',
  'rnbqkbnr/ppp1pppp/8/8/3Pp3/8/PPP2PPP/RNBQKBNR': 'Lange Gambit; Alfred Lange Gambit; Simple Variation',
  'rnbqkbnr/ppp1pppp/8/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': 'Lange Gambit; Alfred Lange Gambit; Simple Variation',
  'rn1qkb1r/ppp1pppp/5n2/5b2/3Pp3/2N2P2/PPP3PP/R1BQKBNR': 'Soller; Vienna Var, BDG',
  'rnbqkbnr/ppp2ppp/8/4p3/3Pp3/2N5/PPP2PPP/R1BQKBNR': 'Lange Gambit; Alfred Lange Gambit; Simple Variation',
  'rnbqkbnr/ppp2ppp/4p3/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': 'Frere; Becker; Katilimov, Maric Var, French',
  'rnbqkb1r/ppp1pppp/5n2/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': 'Gunderam Defense, BDG; Rook Pawn Defense',
  'rnbqkb1r/ppp1pppp/5n2/8/3Pp3/2N2P2/PPP3PP/R1BQKBNR': 'Gunderam Defense, BDG; Rook Pawn Defense',
  'rnbqkb1r/ppp1pppp/5n2/8/3P4/2N2p2/PPP3PP/R1BQKBNR': 'Gunderam Defense, BDG; Rook Pawn Defense',
  'rnbqkb1r/ppp1pppp/5n2/8/3P4/2N2N2/PPP3PP/R1BQKB1R': 'Gunderam Defense, BDG; Rook Pawn Defense',
  'rnbqkb1r/ppp1pp1p/5np1/8/3P4/2N2N2/PPP3PP/R1BQKB1R': 'Nimzovich Attack, BDG',
  'rnbqkb1r/ppp1pp1p/5np1/8/2BP4/2N2N2/PPP3PP/R1BQK2R': 'Nimzovich Attack, BDG',
  'rnbqk2r/ppp1ppbp/5np1/8/2BP4/2N2N2/PPP3PP/R1BQK2R': 'Nimzovich Attack, BDG',
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/2N5/PPP1PPPP/R1BQKBNR': 'Richter-Veresov Opening; D01',
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/2N5/PPP1PPPP/R1BQKBNR': 'Richter-Veresov Opening; D01',
  'rnbqkb1r/ppp1pppp/5n2/3p2B1/3P4/2N5/PPP1PPPP/R2QKBNR': 'Two Knights System, Veresov',
  'rnbqkbnr/ppp1pppp/8/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R': 'Queen\'s Gambit Reversed; Krause Variation',
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5N2/PPP1PPPP/RNBQKB1R': 'London System; Queen\'s Bishop Opening',
  'rnbqkb1r/ppp1pppp/5n2/3p2B1/3P4/5N2/PPP1PPPP/RN1QKB1R': 'Grunfeld Variation, QP',
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/4PN2/PPP2PPP/RNBQKB1R': 'Classical Defense, Colle System; D05',
  'rnbqkbnr/ppp1pppp/3p4/8/3P4/8/PPP1PPPP/RNBQKBNR': 'Lisbon Gambit',
  'rnbqkbnr/pppp1ppp/8/4p3/3P4/8/PPP1PPPP/RNBQKBNR': 'Thuring Gambit; Hartlaub-Charlick Gambit',
  'rnbqkbnr/pppp1ppp/8/4P3/8/8/PPP1PPPP/RNBQKBNR': 'Thuring Gambit; Hartlaub-Charlick Gambit',
  'r1bqkbnr/pppp1ppp/2n5/4P3/8/8/PPP1PPPP/RNBQKBNR': 'Zilbermints Gambit II, Englund Gambit',
  'r1bqkbnr/pppp1ppp/2n5/4P3/8/5N2/PPP1PPPP/RNBQKB1R': 'Zilbermints Gambit II, Englund Gambit',
  'rnbqkbnr/pppp1ppp/4p3/8/3P4/8/PPP1PPPP/RNBQKBNR': 'Transpositional Variation, Keres Defense',
  'rnbqkbnr/p1pp1ppp/1p2p3/8/2PP4/8/PP2PPPP/RNBQKBNR': 'Hartlaub Gambit Declined',
  'rnbqkbnr/pppp2pp/4p3/5p2/2PP4/8/PP2PPPP/RNBQKBNR': 'Rubinstein Variation, Dutch',
  'rnbqkbnr/ppppp1pp/8/5p2/3P4/8/PPP1PPPP/RNBQKBNR': 'Alapin; Ulvestad; Manhattan; Kmoch Variation, Dutch',
  'rnbqkbnr/ppppp1pp/8/5p2/2PP4/8/PP2PPPP/RNBQKBNR': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbqkb1r/ppppp1pp/5n2/5p2/2PP4/8/PP2PPPP/RNBQKBNR': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbqkb1r/ppppp1pp/5n2/5p2/2PP4/6P1/PP2PP1P/RNBQKBNR': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbqkb1r/pppp2pp/4pn2/5p2/2PP4/6P1/PP2PP1P/RNBQKBNR': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbqkb1r/pppp2pp/4pn2/5p2/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbqk2r/ppppb1pp/4pn2/5p2/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbqk2r/ppppb1pp/4pn2/5p2/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbq1rk1/ppppb1pp/4pn2/5p2/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbq1rk1/ppppb1pp/4pn2/5p2/2PP4/5NP1/PP2PPBP/RNBQ1RK1': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbq1rk1/ppp1b1pp/4pn2/3p1p2/2PP4/5NP1/PP2PPBP/RNBQ1RK1': 'Botvinnik Variation, Dutch; A93',
  'rnbq1rk1/ppp1b1pp/3ppn2/5p2/2PP4/5NP1/PP2PPBP/RNBQ1RK1': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbq1rk1/ppp1b1pp/3ppn2/5p2/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1': 'Ilyin-Zhenevsky Variation, Dutch; A97',
  'rnbqkb1r/ppppp2p/5np1/5p2/2PP4/6P1/PP2PP1P/RNBQKBNR': 'Matulovic Variation, Dutch; A89',
  'rnbqkb1r/ppppp2p/5np1/5p2/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Matulovic Variation, Dutch; A89',
  'rnbqk2r/ppppp1bp/5np1/5p2/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Matulovic Variation, Dutch; A89',
  'rnbqk2r/ppppp1bp/5np1/5p2/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Matulovic Variation, Dutch; A89',
  'rnbq1rk1/ppppp1bp/5np1/5p2/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Matulovic Variation, Dutch; A89',
  'rnbq1rk1/ppppp1bp/5np1/5p2/2PP4/5NP1/PP2PPBP/RNBQ1RK1': 'Matulovic Variation, Dutch; A89',
  'rnbqkbnr/ppppp1pp/8/5p2/3PP3/8/PPP2PPP/RNBQKBNR': 'General Variation, Staunton Gambit, Dutch; A83',
  'rnbqkbnr/ppppp1pp/8/8/3Pp3/8/PPP2PPP/RNBQKBNR': 'General Variation, Staunton Gambit, Dutch; A83',
  'rnbqkbnr/ppppp1pp/8/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': 'General Variation, Staunton Gambit, Dutch; A83',
  'rnbqkb1r/ppppp1pp/5n2/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': 'General Variation, Staunton Gambit, Dutch; A83',
  'rnbqkb1r/ppppp1pp/5n2/6B1/3Pp3/2N5/PPP2PPP/R2QKBNR': 'Nimzovich Variation, Dutch',
  'rnbqkbnr/ppppp1pp/8/5p2/3P4/6P1/PPP1PP1P/RNBQKBNR': 'Ilyin-Genevsky Variation, Dutch',
  'rnbqkb1r/ppppp1pp/5n2/5p2/3P4/6P1/PPP1PP1P/RNBQKBNR': 'Ilyin-Genevsky Variation, Dutch',
  'rnbqkb1r/ppppp1pp/5n2/5p2/3P4/6P1/PPP1PPBP/RNBQK1NR': 'Ilyin-Genevsky Variation, Dutch',
  'rnbqkbnr/ppppp1pp/8/5p2/3P4/3Q4/PPP1PPPP/RNB1KBNR': 'Anti-Leningrad Variation, Dutch',
  'rnbqkbnr/pppppp1p/6p1/8/3P4/8/PPP1PPPP/RNBQKBNR': 'Lizard Defense; Pirc-Diemer Gambit',
  'rnbqkbnr/pppppp1p/6p1/8/2PP4/8/PP2PPPP/RNBQKBNR': 'Pterodactyl Variation, Modern',
  'rnbqk1nr/ppppppbp/6p1/8/2PP4/8/PP2PPPP/RNBQKBNR': 'Pterodactyl Variation, Modern',
  'rnbqk1nr/ppppppbp/6p1/8/2PPP3/8/PP3PPP/RNBQKBNR': 'Dunworth Variation, Modern Defense',
  'rnbqk1nr/ppp1ppbp/3p2p1/8/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Pterodactyl Variation, Modern',
  'rnbqk1nr/ppp1ppbp/3p2p1/8/2PPP3/2N5/PP3PPP/R1BQKBNR': 'Pterodactyl Variation, Modern',
  'r1bqkbnr/pppppppp/2n5/8/3P4/8/PPP1PPPP/RNBQKBNR': 'Cannstatter Variation, Mikenas',
  'r1bqkbnr/pppppppp/2n5/8/2PP4/8/PP2PPPP/RNBQKBNR': 'Cannstatter Variation, Mikenas',
  'r1bqkbnr/pppp1ppp/2n5/4p3/2PP4/8/PP2PPPP/RNBQKBNR': 'Cannstatter Variation, Mikenas',
  'rnbqkb1r/pppppppp/5n2/6B1/3P4/8/PPP1PPPP/RN1QKBNR': 'Poisoned Pawn Variation, Trompowsky',
  'rnbqkb1r/pppppppp/8/6B1/3Pn3/8/PPP1PPPP/RN1QKBNR': 'Hergert Gambit #2, Trompowsky',
  'rnbqkb1r/pp1ppppp/5n2/2p5/2PP4/8/PP2PPPP/RNBQKBNR': 'Nimzovich Variation, Knight\'s Tour Variation, Benoni',
  'rnbqkb1r/p2ppppp/5n2/1ppP4/2P5/8/PP2PPPP/RNBQKBNR': 'Benko Gambit Declined; Hjoerring Countergambit',
  'rnbqkb1r/p2ppppp/5n2/1PpP4/8/8/PP2PPPP/RNBQKBNR': 'Fully Accepted Variation, Benko Gambit; A58',
  'rnbqkb1r/3ppppp/p4n2/1PpP4/8/8/PP2PPPP/RNBQKBNR': 'Fully Accepted Variation, Benko Gambit; A58',
  'rnbqkb1r/3ppppp/P4n2/2pP4/8/8/PP2PPPP/RNBQKBNR': 'Central Storming Variation, Benko Gambit',
  'rn1qkb1r/3ppppp/b4n2/2pP4/8/8/PP2PPPP/RNBQKBNR': 'Central Storming Variation, Benko Gambit',
  'rn1qkb1r/3ppppp/b4n2/2pP4/8/2N5/PP2PPPP/R1BQKBNR': 'Central Storming Variation, Benko Gambit',
  'rn1qkb1r/4pppp/b2p1n2/2pP4/8/2N5/PP2PPPP/R1BQKBNR': 'Central Storming Variation, Benko Gambit',
  'rnbqkb1r/pp1p1ppp/4pn2/2pP4/2P5/8/PP2PPPP/RNBQKBNR': 'Nimzovich Variation, Knight\'s Tour Variation, Benoni',
  'rnbqkb1r/pp1p1ppp/4pn2/2pP4/2P5/2N5/PP2PPPP/R1BQKBNR': 'Nimzovich Variation, Knight\'s Tour Variation, Benoni',
  'rnbqkb1r/pp1p1ppp/5n2/2pp4/2P5/2N5/PP2PPPP/R1BQKBNR': 'Nimzovich Variation, Knight\'s Tour Variation, Benoni',
  'rnbqkb1r/pp1p1ppp/5n2/2pP4/8/2N5/PP2PPPP/R1BQKBNR': 'Nimzovich Variation, Knight\'s Tour Variation, Benoni',
  'rnbqkb1r/pp3ppp/3p1n2/2pP4/8/2N5/PP2PPPP/R1BQKBNR': 'Nimzovich Variation, Knight\'s Tour Variation, Benoni',
  'rnbqkb1r/pp3ppp/3p1n2/2pP4/4P3/2N5/PP3PPP/R1BQKBNR': 'Pawn Storm Variation, Benoni; A66',
  'rnbqkb1r/pp3p1p/3p1np1/2pP4/4P3/2N5/PP3PPP/R1BQKBNR': 'Pawn Storm Variation, Benoni; A66',
  'rnbqkb1r/pp3p1p/3p1np1/2pP4/4PP2/2N5/PP4PP/R1BQKBNR': 'Taimanov Variation, Benoni; A67',
  'rnbqk2r/pp3pbp/3p1np1/2pP4/4PP2/2N5/PP4PP/R1BQKBNR': 'Taimanov Variation, Benoni; A67',
  'rnbqkb1r/pp3p1p/3p1np1/2pP4/4P3/2N2N2/PP3PPP/R1BQKB1R': 'Argentine Attack, Benoni; A75',
  'rnbqk2r/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP3PPP/R1BQKB1R': 'Argentine Attack, Benoni; A75',
  'rnbqk2r/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP2BPPP/R1BQK2R': 'Argentine Attack, Benoni; A75',
  'rnbq1rk1/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP2BPPP/R1BQK2R': 'Argentine Attack, Benoni; A75',
  'rnbq1rk1/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP2BPPP/R1BQ1RK1': 'Argentine Attack, Benoni; A75',
  'rnbqr1k1/pp3pbp/3p1np1/2pP4/4P3/2N2N2/PP2BPPP/R1BQ1RK1': 'A77',
  'rnbqkb1r/pp3ppp/3p1n2/2pP4/8/2N2N2/PP2PPPP/R1BQKB1R': 'Nimzovich Variation, Knight\'s Tour Variation, Benoni',
  'rnbqkb1r/pp3p1p/3p1np1/2pP4/8/2N2N2/PP2PPPP/R1BQKB1R': 'Nimzovich Variation, Knight\'s Tour Variation, Benoni',
  'rnbqkb1r/pp3p1p/3p1np1/2pP4/8/2N2NP1/PP2PP1P/R1BQKB1R': 'Fianchetto Variation, Benoni',
  'rnbqk2r/pp3pbp/3p1np1/2pP4/8/2N2NP1/PP2PP1P/R1BQKB1R': 'Fianchetto Variation, Benoni',
  'rnbqk2r/pp3pbp/3p1np1/2pP4/8/2N2NP1/PP2PPBP/R1BQK2R': 'Hastings Defense, Benoni',
  'rnbq1rk1/pp3pbp/3p1np1/2pP4/8/2N2NP1/PP2PPBP/R1BQK2R': 'Hastings Defense, Benoni',
  'rnbq1rk1/pp3pbp/3p1np1/2pP4/8/2N2NP1/PP2PPBP/R1BQ1RK1': 'Hastings Defense, Benoni',
  'rnbqkb1r/ppp1pppp/3p1n2/8/2PP4/8/PP2PPPP/RNBQKBNR': 'Two Knights Variation, Old Indian; A54',
  'rnbqkb1r/ppp1pppp/3p1n2/8/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Two Knights Variation, Old Indian; A54',
  'rnbqkb1r/pppp1ppp/5n2/4p3/2PP4/8/PP2PPPP/RNBQKBNR': 'Center Play Variation, Budapest; Alekhine Variation',
  'rnbqkb1r/pppp1ppp/5n2/4P3/2P5/8/PP2PPPP/RNBQKBNR': 'Center Play Variation, Budapest; Alekhine Variation',
  'rnbqkb1r/pppp1ppp/8/4P3/2P3n1/8/PP2PPPP/RNBQKBNR': 'Center Play Variation, Budapest; Alekhine Variation',
  'rnbqkb1r/pppp1ppp/8/4P3/2P1P1n1/8/PP3PPP/RNBQKBNR': 'Balogh; Tartakower C-G, Budapest',
  'rnbqkb1r/pppp1ppp/8/4n3/2P1P3/8/PP3PPP/RNBQKBNR': 'Abonyi Variation, Budapest',
  'rnbqkb1r/pppp1ppp/8/4n3/2P1PP2/8/PP4PP/RNBQKBNR': 'Abonyi Variation, Budapest',
  'rnbqkb1r/pppp1ppp/4pn2/8/2PP4/6P1/PP2PP1P/RNBQKBNR': 'Modern Sharp Variation, Catalan',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PP1P/RNBQKBNR': 'Modern Sharp Variation, Catalan',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Modern Sharp Variation, Catalan',
  'rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Zagoriansky Variation, Catalan',
  'rnbqk2r/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Zagoriansky Variation, Catalan',
  'rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Zagoriansky Variation, Catalan',
  'rnbq1rk1/ppp1bppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1': 'Zagoriansky Variation, Catalan',
  'r1bq1rk1/pppnbppp/4pn2/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1': 'Zagoriansky Variation, Catalan',
  'r1bq1rk1/pppnbppp/4pn2/3p4/2PP4/5NP1/PPQ1PPBP/RNB2RK1': 'Zagoriansky Variation, Catalan',
  'r1bq1rk1/pp1nbppp/2p1pn2/3p4/2PP4/5NP1/PPQ1PPBP/RNB2RK1': 'Zagoriansky Variation, Catalan',
  'rnbqkb1r/ppp2ppp/4pn2/8/2pP4/6P1/PP2PPBP/RNBQK1NR': 'Modern Sharp Variation, Catalan',
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PP2PPPP/R1BQKBNR': 'Bronstein Variation, Nimzo-Indian; E45; Byrne Variation',
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/P1N5/1P2PPPP/R1BQKBNR': 'Accelerated Saemisch Variation, Nimzo-Indian',
  'rnbqk2r/pppp1ppp/4pn2/8/2PP4/P1b5/1P2PPPP/R1BQKBNR': 'Accelerated Saemisch Variation, Nimzo-Indian',
  'rnbqk2r/pppp1ppp/4pn2/8/2PP4/P1P5/4PPPP/R1BQKBNR': 'Saemisch Variation, Nimzo-Indian; E26',
  'rnbqk2r/pp1p1ppp/4pn2/2p5/2PP4/P1P5/4PPPP/R1BQKBNR': 'Saemisch Variation, Nimzo-Indian; E26',
  'rnbqk2r/pp1p1ppp/4pn2/2p5/2PP4/P1P2P2/4P1PP/R1BQKBNR': 'Romanovsky Variation, Nimzo-Indian',
  'rnbqk2r/pp3ppp/4pn2/2pp4/2PP4/P1P2P2/4P1PP/R1BQKBNR': 'Romanovsky Variation, Nimzo-Indian',
  'rnbq1rk1/pppp1ppp/4pn2/8/2PP4/P1P5/4PPPP/R1BQKBNR': 'Capablanca Variation, Nimzo-Indian',
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR': 'Bronstein Variation, Nimzo-Indian; E45; Byrne Variation',
  'rnbqk2r/pp1p1ppp/4pn2/2p5/1bPP4/2N1P3/PP3PPP/R1BQKBNR': 'Rubinstein Variation, Nimzo-Indian; E42',
  'rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2N1P3/PP3PPP/R1BQKBNR': 'Bernstein Defense; Gligoric System; E53',
  'rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2NBP3/PP3PPP/R1BQK1NR': 'Classical Defense, Nimzo-Indian; E48',
  'rnbq1rk1/ppp2ppp/4pn2/3p4/1bPP4/2NBP3/PP3PPP/R1BQK1NR': 'Botvinnik System, Nimzo-Indian; E49',
  'rnbq1rk1/ppp2ppp/4pn2/3p4/1bPP4/2NBPN2/PP3PPP/R1BQK2R': 'Bernstein Defense; Gligoric System; E53',
  'rnbq1rk1/pp3ppp/4pn2/2pp4/1bPP4/2NBPN2/PP3PPP/R1BQK2R': 'Bronstein Variation, Nimzo-Indian; E55',
  'rnbq1rk1/pp3ppp/4pn2/2pp4/1bPP4/2NBPN2/PP3PPP/R1BQ1RK1': 'Bronstein Variation, Nimzo-Indian; E55',
  'rnbq1rk1/pp3ppp/4pn2/2p5/1bpP4/2NBPN2/PP3PPP/R1BQ1RK1': 'Bronstein Variation, Nimzo-Indian; E55',
  'rnbq1rk1/pp3ppp/4pn2/2p5/1bBP4/2N1PN2/PP3PPP/R1BQ1RK1': 'Bronstein Variation, Nimzo-Indian; E55',
  'rnbq1rk1/pppp1ppp/4pn2/8/1bPP4/2N1PN2/PP3PPP/R1BQKB1R': 'Bernstein Defense; Gligoric System; E53',
  'rnbq1rk1/ppp2ppp/4pn2/3p4/1bPP4/2N1PN2/PP3PPP/R1BQKB1R': 'Bernstein Defense; Gligoric System; E53',
  'r1bq1rk1/pp3ppp/2n1pn2/2pp4/1bPP4/2NBPN2/PP3PPP/R1BQ1RK1': 'E58',
  'r1bq1rk1/pp3ppp/2n1pn2/2pp4/1bPP4/P1NBPN2/1P3PPP/R1BQ1RK1': 'E58',
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N2N2/PP2PPPP/R1BQKB1R': 'Romanishin Variation, Nimzo-Indian',
  'rnbqk2r/pp1p1ppp/4pn2/2p5/1bPP4/2N2N2/PP2PPPP/R1BQKB1R': 'Romanishin Variation, Nimzo-Indian',
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/1QN5/PP2PPPP/R1B1KBNR': 'San Remo Variation, Nimzo-Indian; Stahlberg Variation',
  'rnbqk2r/pp1p1ppp/4pn2/2p5/1bPP4/1QN5/PP2PPPP/R1B1KBNR': 'San Remo Variation, Nimzo-Indian; Stahlberg Variation',
  'rnbqk2r/pp1p1ppp/4pn2/2P5/1bP5/1QN5/PP2PPPP/R1B1KBNR': 'San Remo Variation, Nimzo-Indian; Stahlberg Variation',
  'r1bqk2r/pp1p1ppp/2n1pn2/2P5/1bP5/1QN5/PP2PPPP/R1B1KBNR': 'San Remo Variation, Nimzo-Indian; Stahlberg Variation',
  'r1bqk2r/pp1p1ppp/2n1pn2/2P5/1bP5/1QN2N2/PP2PPPP/R1B1KB1R': 'San Remo Variation, Nimzo-Indian; Stahlberg Variation',
  'r1bqk2r/pp1p1ppp/2n1p3/2P5/1bP1n3/1QN2N2/PP2PPPP/R1B1KB1R': 'San Remo Variation, Nimzo-Indian; Stahlberg Variation',
  'r1bqk2r/pp1p1ppp/2n1p3/2P5/1bP1n3/1QN2N2/PP1BPPPP/R3KB1R': 'San Remo Variation, Nimzo-Indian; Stahlberg Variation',
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/2N5/PPQ1PPPP/R1B1KBNR': 'Milner-Barry, Zurich Variation, Nimzo-Indian; E33',
  'rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/2N5/PPQ1PPPP/R1B1KBNR': 'Romanishin Variation, Nimzo-Indian',
  'rnbqk2r/ppp2ppp/4pn2/3p4/1bPP4/P1N5/1PQ1PPPP/R1B1KBNR': 'Botvinnik Variation, Nimzo-Indian',
  'rnbqk2r/ppp2ppp/4pn2/3p4/2PP4/P1b5/1PQ1PPPP/R1B1KBNR': 'Botvinnik Variation, Nimzo-Indian',
  'rnbqk2r/ppp2ppp/4pn2/3p4/2PP4/P1Q5/1P2PPPP/R1B1KBNR': 'Botvinnik Variation, Nimzo-Indian',
  'rnbqk2r/ppp2ppp/4pn2/3P4/1b1P4/2N5/PPQ1PPPP/R1B1KBNR': 'Romanishin Variation, Nimzo-Indian',
  'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5N2/PP2PPPP/RNBQKB1R': 'Kasparov-Petrosian Variation, QID',
  'rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/P1N2N2/1P2PPPP/R1BQKB1R': 'Hedgehog Variation, QID',
  'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R': 'Fianchetto Traditional, QID; E16',
  'rn1qkb1r/p1pp1ppp/bp2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R': 'Nimzovich Attack, QID',
  'rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/5NP1/PP2PP1P/RNBQKB1R': 'Traditional Variation, QID; E17',
  'rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Traditional Variation, QID; E17',
  'rn1qk2r/pbppbppp/1p2pn2/8/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Anti-Queen\'s Indian System',
  'rn1qk2r/pbppbppp/1p2pn2/8/2PP4/5NP1/PP2PPBP/RNBQ1RK1': 'Polugaevsky Gambit, QID',
  'rn1q1rk1/pbppbppp/1p2pn2/8/2PP4/5NP1/PP2PPBP/RNBQ1RK1': 'Polugaevsky Gambit, QID',
  'rnbqkb1r/p1pp1ppp/1p2pn2/8/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Kasparov-Petrosian Variation, QID',
  'rn1qkb1r/pbpp1ppp/1p2pn2/8/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Kasparov-Petrosian Variation, QID',
  'rnbqk2r/pppp1ppp/4pn2/8/1bPP4/5N2/PP2PPPP/RNBQKB1R': 'Nimzovich Variation, Bogo-Indian',
  'rnbqkb1r/pp1p1ppp/4pn2/2p5/2PP4/5N2/PP2PPPP/RNBQKB1R': 'Blumenfeld Countergambit Accepted',
  'rnbqkb1r/pp1p1ppp/4pn2/2pP4/2P5/5N2/PP2PPPP/RNBQKB1R': 'Blumenfeld Countergambit Accepted',
  'rnbqkb1r/p2p1ppp/4pn2/1ppP4/2P5/5N2/PP2PPPP/RNBQKB1R': 'Blumenfeld Countergambit Accepted',
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/6P1/PP2PP1P/RNBQKBNR': 'Ultra-delayed Exchange Variation, Neo-Grunfeld',
  'rnbqk2r/ppppppbp/5np1/8/2PP4/6P1/PP2PP1P/RNBQKBNR': 'Counterthrust Variation',
  'rnbqk2r/ppppppbp/5np1/8/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Counterthrust Variation',
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Ultra-delayed Exchange Variation, Neo-Grunfeld',
  'rnbqk2r/ppp1ppbp/5np1/3P4/3P4/6P1/PP2PPBP/RNBQK1NR': 'Exchange Variation, Neo-Grunfeld',
  'rnbq1rk1/ppp1ppbp/6p1/3n4/3P4/5NP1/PP2PPBP/RNBQK2R': 'Delayed Exchange Variation, Neo-Grunfeld; D74',
  'rnbq1rk1/ppp1ppbp/6p1/3n4/3P4/5NP1/PP2PPBP/RNBQ1RK1': 'Kemeri Variation',
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Bronstein Variation',
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Bronstein Variation',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Bronstein Variation',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQK2R': 'Lesser Simagin (Spassky) Variation, KID',
  'rnbq1rk1/pp2ppbp/2pp1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQK2R': 'Benjamin Defense, KID',
  'rnbq1rk1/pp2ppbp/2pp1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1': 'Benjamin Defense, KID',
  'r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQK2R': 'Lesser Simagin (Spassky) Variation, KID',
  'r1bq1rk1/ppp1ppbp/2np1np1/8/2PP4/2N2NP1/PP2PPBP/R1BQ1RK1': 'Lesser Simagin (Spassky) Variation, KID',
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/6P1/PP2PP1P/RNBQKBNR': 'Ultra-delayed Exchange Variation, Neo-Grunfeld',
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/6P1/PP2PPBP/RNBQK1NR': 'Ultra-delayed Exchange Variation, Neo-Grunfeld',
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Ultra-delayed Exchange Variation, Neo-Grunfeld',
  'rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/5NP1/PP2PPBP/RNBQK2R': 'Ultra-delayed Exchange Variation, Neo-Grunfeld',
  'rnbq1rk1/ppp1ppbp/5np1/3P4/3P4/5NP1/PP2PPBP/RNBQK2R': 'Delayed Exchange Variation, Neo-Grunfeld; D74',
  'rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/5NP1/PP2PPBP/RNBQ1RK1': 'Ultra-delayed Exchange Variation, Neo-Grunfeld',
  'rnbqkb1r/pppppp1p/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Exchange Variation, Four Pawns Attack, KID; E79',
  'rnbqk2r/ppppppbp/5np1/8/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Exchange Variation, Four Pawns Attack, KID; E79',
  'rnbqk2r/ppppppbp/5np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR': 'Exchange Variation, Four Pawns Attack, KID; E79',
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP3PPP/R1BQKBNR': 'Exchange Variation, Four Pawns Attack, KID; E79',
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP2BPPP/R1BQK1NR': 'Semi-Averbakh System, KID',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N5/PP2BPPP/R1BQK1NR': 'Semi-Averbakh System, KID',
  'rnbq1rk1/ppp1ppbp/3p1np1/6B1/2PPP3/2N5/PP2BPPP/R2QK1NR': 'Benoni Defense, KID; E74',
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2P2/PP4PP/R1BQKBNR': 'Normal Defesne, Sameisch Variation, KID; E81',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2P2/PP4PP/R1BQKBNR': 'Bobotsov-Korchnoi-Petrosian Variation, KID',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N1BP2/PP4PP/R2QKBNR': 'Orthodox Variation, KID; E85',
  'rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N1BP2/PP4PP/R2QKBNR': 'Closed Variation, KID; E87',
  'rnbq1rk1/ppp2pbp/3p1np1/3Pp3/2P1P3/2N1BP2/PP4PP/R2QKBNR': 'Bronstein Defense, KID',
  'r1bq1rk1/ppp1ppbp/2np1np1/8/2PPP3/2N1BP2/PP4PP/R2QKBNR': 'Panno Formation, KID',
  'r1bq1rk1/ppp1ppbp/2np1np1/8/2PPP3/2N1BP2/PP2N1PP/R2QKB1R': 'Panno Formation, KID',
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP4PP/R1BQKBNR': 'Exchange Variation, Four Pawns Attack, KID; E79',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP4PP/R1BQKBNR': 'Exchange Variation, Four Pawns Attack, KID; E79',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPPP2/2N5/PP2B1PP/R1BQK1NR': 'Exchange Variation, Four Pawns Attack, KID; E79',
  'rnbq1rk1/pp2ppbp/3p1np1/2p5/2PPPP2/2N5/PP2B1PP/R1BQK1NR': 'Exchange Variation, Four Pawns Attack, KID; E79',
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R': 'Aronin-Taimanov Variation, KID; E97',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP3PPP/R1BQKB1R': 'Aronin-Taimanov Variation, KID; E97',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PPP3/2N2N2/PP2BPPP/R1BQK2R': 'Aronin-Taimanov Variation, KID; E97',
  'rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQK2R': 'Aronin-Taimanov Variation, KID; E97',
  'rnbq1rk1/ppp2pbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQK2R': 'Keres Variation, KID',
  'rnbq1rk1/ppp2pbp/3p1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1': 'Aronin-Taimanov Variation, KID; E97',
  'r1bq1rk1/ppp2pbp/2np1np1/4p3/2PPP3/2N2N2/PP2BPPP/R1BQ1RK1': 'Benko Attack, KID; E99',
  'r1bq1rk1/ppp2pbp/2np1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1': 'Benko Attack, KID; E99',
  'r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N2N2/PP2BPPP/R1BQ1RK1': 'Benko Attack, KID; E99',
  'r1bq1rk1/ppp1npbp/3p1np1/3Pp3/2P1P3/2N5/PP2BPPP/R1BQNRK1': 'Benko Attack, KID; E99',
  'r1bq1rk1/pppnnpbp/3p2p1/3Pp3/2P1P3/2N5/PP2BPPP/R1BQNRK1': 'Benko Attack, KID; E99',
  'rnbqk2r/ppppppbp/5np1/8/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Lesser Simagin (Spassky) Variation, KID',
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Lesser Simagin (Spassky) Variation, KID',
  'rnbqk2r/ppp1ppbp/3p1np1/8/2PP4/2N2NP1/PP2PP1P/R1BQKB1R': 'Lesser Simagin (Spassky) Variation, KID',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/2PP4/2N2NP1/PP2PP1P/R1BQKB1R': 'Lesser Simagin (Spassky) Variation, KID',
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR': 'Accelerated Russian Variation, Grunfeld; D81',
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP1B2/2N5/PP2PPPP/R2QKBNR': 'Capablanca Variation, Grunfeld',
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP1B2/2N5/PP2PPPP/R2QKBNR': 'Capablanca Variation, Grunfeld',
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP1B2/2N1P3/PP3PPP/R2QKBNR': 'Capablanca Variation, Grunfeld',
  'rnbq1rk1/ppp1ppbp/5np1/3p4/2PP1B2/2N1P3/PP3PPP/R2QKBNR': 'Capablanca Variation, Grunfeld',
  'rnbqkb1r/ppp1pp1p/5np1/3P4/3P4/2N5/PP2PPPP/R1BQKBNR': 'Simagin Improved Variation, Grunfeld',
  'rnbqkb1r/ppp1pp1p/6p1/3n4/3P4/2N5/PP2PPPP/R1BQKBNR': 'Simagin Improved Variation, Grunfeld',
  'rnbqkb1r/ppp1pp1p/6p1/3n4/3PP3/2N5/PP3PPP/R1BQKBNR': 'Simagin Improved Variation, Grunfeld',
  'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2n5/PP3PPP/R1BQKBNR': 'Simagin Improved Variation, Grunfeld',
  'rnbqkb1r/ppp1pp1p/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR': 'Simagin Improved Variation, Grunfeld',
  'rnbqk2r/ppp1ppbp/6p1/8/3PP3/2P5/P4PPP/R1BQKBNR': 'Simagin Improved Variation, Grunfeld',
  'rnbqk2r/ppp1ppbp/6p1/8/2BPP3/2P5/P4PPP/R1BQK1NR': 'Simagin Improved Variation, Grunfeld',
  'rnbq1rk1/ppp1ppbp/6p1/8/2BPP3/2P5/P4PPP/R1BQK1NR': 'Simagin Improved Variation, Grunfeld',
  'rnbq1rk1/ppp1ppbp/6p1/8/2BPP3/2P5/P3NPPP/R1BQK2R': 'Simagin Improved Variation, Grunfeld',
  'rnbq1rk1/pp2ppbp/6p1/2p5/2BPP3/2P5/P3NPPP/R1BQK2R': 'Sokolsky Variation, Grunfeld',
  'rnbq1rk1/pp2ppbp/6p1/2p5/2BPP3/2P5/P3NPPP/R1BQ1RK1': 'Sokolsky Variation, Grunfeld',
  'r1bq1rk1/pp2ppbp/2n3p1/2p5/2BPP3/2P5/P3NPPP/R1BQ1RK1': 'Sokolsky Variation, Grunfeld',
  'r1bq1rk1/pp2ppbp/2n3p1/2p5/2BPP3/2P1B3/P3NPPP/R2Q1RK1': 'Sokolsky Variation, Grunfeld',
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N1P3/PP3PPP/R1BQKBNR': 'Schlechter Variation, Grunfeld',
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/2N1P3/PP3PPP/R1BQKBNR': 'Schlechter Variation, Grunfeld',
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R': 'Schlechter Variation, Grunfeld',
  'rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/2N1PN2/PP3PPP/R1BQKB1R': 'Schlechter Variation, Grunfeld',
  'rnbq1rk1/ppp1ppbp/5np1/3p4/2PP4/2NBPN2/PP3PPP/R1BQK2R': 'Schlechter Variation, Grunfeld',
  'rnbqkb1r/ppp1pp1p/5np1/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Szabo (Boleslavsky) Variation, Grunfeld',
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/2N2N2/PP2PPPP/R1BQKB1R': 'Szabo (Boleslavsky) Variation, Grunfeld',
  'rnbqk2r/ppp1ppbp/5np1/3p4/2PP4/1QN2N2/PP2PPPP/R1B1KB1R': 'Szabo (Boleslavsky) Variation, Grunfeld',
  'rnbqk2r/ppp1ppbp/5np1/8/2pP4/1QN2N2/PP2PPPP/R1B1KB1R': 'Szabo (Boleslavsky) Variation, Grunfeld',
  'rnbqk2r/ppp1ppbp/5np1/8/2QP4/2N2N2/PP2PPPP/R1B1KB1R': 'Szabo (Boleslavsky) Variation, Grunfeld',
  'rnbq1rk1/ppp1ppbp/5np1/8/2QP4/2N2N2/PP2PPPP/R1B1KB1R': 'Szabo (Boleslavsky) Variation, Grunfeld',
  'rnbq1rk1/ppp1ppbp/5np1/8/2QPP3/2N2N2/PP3PPP/R1B1KB1R': 'Szabo (Boleslavsky) Variation, Grunfeld',
  'rn1q1rk1/ppp1ppbp/5np1/8/2QPP1b1/2N2N2/PP3PPP/R1B1KB1R': 'Yugoslav Variation, Grunfeld',
  'rnbqkb1r/pppppppp/5n2/8/3P4/5P2/PPP1P1PP/RNBQKBNR': 'Blackmar-Diemer Gambit Deferred',
  'rnbqkb1r/ppp1pppp/5n2/3p4/3P4/5P2/PPP1P1PP/RNBQKBNR': 'Blackmar-Diemer Gambit Deferred',
  'rnbqkb1r/pppppppp/5n2/8/3P2P1/8/PPP1PP1P/RNBQKBNR': 'Gibbins-Wiedehagen Gambit Accepted',
  'rnbqkb1r/pppppppp/5n2/8/3P4/2N5/PPP1PPPP/R1BQKBNR': 'Reversed Chigorin Defense',
  'rnbqkb1r/pppppppp/5n2/8/3P4/5N2/PPP1PPPP/RNBQKB1R': 'Capablanca Variation, Indian Game; A47',
  'rnbqkb1r/p1pppppp/1p3n2/8/3P4/5N2/PPP1PPPP/RNBQKB1R': 'Marienbad Variation',
  'rnbqkb1r/pppp1ppp/4pn2/8/3P4/5N2/PPP1PPPP/RNBQKB1R': 'Nimzovich Variation, Torre Attack',
  'rnbqkb1r/pppp1ppp/4pn2/6B1/3P4/5N2/PPP1PPPP/RN1QKB1R': 'Nimzovich Variation, Torre Attack',
  'rnbqkb1r/pppppp1p/5np1/8/3P4/5N2/PPP1PPPP/RNBQKB1R': 'Fianchetto Defense, Torre Attack',
  'rnbqkbnr/pppppppp/8/8/8/4P3/PPPP1PPP/RNBQKBNR': 'Bouncing Bishop Variation',
  'rnbqkbnr/pppp1ppp/8/4p3/8/4P3/PPPP1PPP/RNBQKBNR': 'Bouncing Bishop Variation',
  'rnbqkbnr/pppp1ppp/8/4p3/8/2N1P3/PPPP1PPP/R1BQKBNR': 'Ekolu Variation',
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Larsen-Santasiere (McDonnell Attack) Variation, Sicilian; B21',
  'rnbqkbnr/1ppppppp/p7/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Zilbermints Gambit, St George Defense',
  'rnbqkbnr/1ppppppp/p7/8/3PP3/8/PPP2PPP/RNBQKBNR': 'Zilbermints Gambit, St George Defense',
  'rnbqkbnr/p1pppppp/1p6/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Naselwaus Variation, Owen\'s Defense',
  'rnbqkbnr/p1pppppp/1p6/8/3PP3/8/PPP2PPP/RNBQKBNR': 'Naselwaus Variation, Owen\'s Defense',
  'rn1qkbnr/pbpppppp/1p6/8/3PP3/8/PPP2PPP/RNBQKBNR': 'Naselwaus Variation, Owen\'s Defense',
  'rnbqkbnr/pp1ppppp/8/2p5/1P2P3/8/P1PP1PPP/RNBQKBNR': 'Abrahams Variation, Sicilian Wing Gambit',
  'rnbqkbnr/pp1ppppp/8/8/1p2P3/8/P1PP1PPP/RNBQKBNR': 'Abrahams Variation, Sicilian Wing Gambit',
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/2P5/PP1P1PPP/RNBQKBNR': 'Sherzer Variation, Sicilian',
  'rnbqkbnr/pp1ppppp/8/2p5/3PP3/8/PPP2PPP/RNBQKBNR': 'Classical Formation, Smith-Morra Accepted, Sicilian',
  'rnbqkbnr/pp1ppppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR': 'Classical Formation, Smith-Morra Accepted, Sicilian',
  'rnbqkbnr/pp1ppppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR': 'Classical Formation, Smith-Morra Accepted, Sicilian',
  'rnbqkbnr/pp1ppppp/8/8/4P3/2p5/PP3PPP/RNBQKBNR': 'Classical Formation, Smith-Morra Accepted, Sicilian',
  'rnbqkbnr/pp1ppppp/8/8/4P3/2N5/PP3PPP/R1BQKBNR': 'Classical Formation, Smith-Morra Accepted, Sicilian',
  'rnbqkbnr/pp1p1ppp/4p3/8/4P3/2N5/PP3PPP/R1BQKBNR': 'Taimanov Formation, Smith-Morra Accepted, Sicilian',
  'r1bqkbnr/pp1ppppp/2n5/8/4P3/2N5/PP3PPP/R1BQKBNR': 'Classical Formation, Smith-Morra Accepted, Sicilian',
  'r1bqkbnr/pp1ppppp/2n5/8/4P3/2N2N2/PP3PPP/R1BQKB1R': 'Classical Formation, Smith-Morra Accepted, Sicilian',
  'r1bqkbnr/pp1p1ppp/2n1p3/8/4P3/2N2N2/PP3PPP/R1BQKB1R': 'Paulsen Formation, Smith-Morra Accepted, Sicilian',
  'r1bqkbnr/pp1p1ppp/2n1p3/8/2B1P3/2N2N2/PP3PPP/R1BQK2R': 'Paulsen Formation, Smith-Morra Accepted, Sicilian',
  'rnbqkbnr/pp1ppppp/8/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Vinken System, Sicilian; Grand Prix Attack',
  'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Vinken System, Sicilian; Grand Prix Attack',
  'r1bqkbnr/pp1ppppp/2n5/2p5/4P3/2N3P1/PPPP1P1P/R1BQKBNR': 'Botvinnik Defense, Sicilian Closed',
  'r1bqkbnr/pp1ppp1p/2n3p1/2p5/4P3/2N3P1/PPPP1P1P/R1BQKBNR': 'Botvinnik Defense, Sicilian Closed',
  'r1bqkbnr/pp1ppp1p/2n3p1/2p5/4P3/2N3P1/PPPP1PBP/R1BQK1NR': 'Botvinnik Defense, Sicilian Closed',
  'r1bqk1nr/pp1pppbp/2n3p1/2p5/4P3/2N3P1/PPPP1PBP/R1BQK1NR': 'Botvinnik Defense, Sicilian Closed',
  'r1bqk1nr/pp1pppbp/2n3p1/2p5/4P3/2NP2P1/PPP2PBP/R1BQK1NR': 'Botvinnik Defense, Sicilian Closed',
  'r1bqk1nr/pp2ppbp/2np2p1/2p5/4P3/2NP2P1/PPP2PBP/R1BQK1NR': 'Botvinnik Defense, Sicilian Closed',
  'rnbqkbnr/1p1ppppp/p7/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Smith-Morra Line, O\'Kelly Sicilian',
  'rnbqkbnr/1p1ppppp/p7/2p5/4P3/2P2N2/PP1P1PPP/RNBQKB1R': 'Gambit Line, O\'Kelly Sicilian',
  'rnbqkbnr/1p1ppppp/p7/2p5/2P1P3/5N2/PP1P1PPP/RNBQKB1R': 'Robatsch Line, Sicilian',
  'rnbqkbnr/1p1ppppp/p7/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Smith-Morra Line, O\'Kelly Sicilian',
  'rnbqkbnr/1p1ppppp/p7/8/3pP3/5N2/PPP2PPP/RNBQKB1R': 'Smith-Morra Line, O\'Kelly Sicilian',
  'rnbqkbnr/pp2pppp/3p4/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R': 'Main Line, Canal Attack, Sicilian; B52',
  'rnbqkbnr/pp2pppp/3p4/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Poisoned Pawn Variation, Najdorf Sicilian; B97',
  'rnbqkbnr/pp2pppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R': 'Poisoned Pawn Variation, Najdorf Sicilian; B97',
  'rnbqkbnr/pp2pppp/3p4/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Poisoned Pawn Variation, Najdorf Sicilian; B97',
  'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Poisoned Pawn Variation, Najdorf Sicilian; B97',
  'rnbqkb1r/pp2pppp/3p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Poisoned Pawn Variation, Najdorf Sicilian; B97',
  'rnbqkb1r/1p2pppp/p2p1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Poisoned Pawn Variation, Najdorf Sicilian; B97',
  'rnbqkb1r/1p2pppp/p2p1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R': 'Poisoned Pawn Variation, Najdorf Sicilian; B97',
  'rnbqkb1r/1p3ppp/p2ppn2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R': 'Poisoned Pawn Variation, Najdorf Sicilian; B97',
  'rnbqkb1r/1p3ppp/p2ppn2/6B1/3NPP2/2N5/PPP3PP/R2QKB1R': 'Poisoned Pawn Variation, Najdorf Sicilian; B97',
  'rnbqk2r/1p2bppp/p2ppn2/6B1/3NPP2/2N5/PPP3PP/R2QKB1R': 'Browne Variation, Najdorf Sicilian',
  'rnbqk2r/1p2bppp/p2ppn2/6B1/3NPP2/2N2Q2/PPP3PP/R3KB1R': 'Browne Variation, Najdorf Sicilian',
  'rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Fischer Attack, Sozin Attack, Sicilian; B86',
  'rnbqkb1r/pp3ppp/3ppn2/8/2BNP3/2N5/PPP2PPP/R1BQK2R': 'Leonhardt Variation, Sicilian; B88',
  'r1bqkb1r/pp3ppp/2nppn2/8/2BNP3/2N5/PPP2PPP/R1BQK2R': 'Velimirovic Variation, Sicilian',
  'rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N5/PPP1BPPP/R1BQK2R': 'Modern Paulsen, Sicilian; B84',
  'rnbqkb1r/pp3ppp/3ppn2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R': 'English Attack, Scheveningen Sicilian',
  'rnbqkb1r/1p3ppp/p2ppn2/8/3NP3/2N1B3/PPP2PPP/R2QKB1R': 'English Attack, Scheveningen Sicilian',
  'rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Amsterdam (Battery) Variation, Sicilian',
  'rnbqkb1r/pp2pp1p/3p1np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R': 'Amsterdam (Battery) Variation, Sicilian',
  'rnbqk2r/pp2ppbp/3p1np1/8/3NP3/2N1B3/PPP2PPP/R2QKB1R': 'Amsterdam (Battery) Variation, Sicilian',
  'rnbqk2r/pp2ppbp/3p1np1/8/3NP3/2N1B3/PPP1BPPP/R2QK2R': 'Amsterdam (Battery) Variation, Sicilian',
  'r1bqk2r/pp2ppbp/2np1np1/8/3NP3/2N1B3/PPP1BPPP/R2QK2R': 'Amsterdam (Battery) Variation, Sicilian',
  'r1bqk2r/pp2ppbp/2np1np1/8/3NP3/2N1B3/PPP1BPPP/R2Q1RK1': 'Tartakower Line, Sicilian Dragon',
  'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1B3/PPP1BPPP/R2Q1RK1': 'Tartakower Line, Sicilian Dragon',
  'r1bq1rk1/pp2ppbp/2np1np1/8/4P3/1NN1B3/PPP1BPPP/R2Q1RK1': 'Tartakower Line, Sicilian Dragon',
  'rnbqk2r/pp2ppbp/3p1np1/8/3NP3/2N1BP2/PPP3PP/R2QKB1R': 'Yugoslav Attack, Sicilian Dragon; B76',
  'rnbq1rk1/pp2ppbp/3p1np1/8/3NP3/2N1BP2/PPP3PP/R2QKB1R': 'Czerniak Variation, Sicilian Dragon',
  'rnbq1rk1/pp2ppbp/3p1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R': 'Czerniak Variation, Sicilian Dragon',
  'r1bq1rk1/pp2ppbp/2np1np1/8/3NP3/2N1BP2/PPPQ2PP/R3KB1R': 'Czerniak Variation, Sicilian Dragon',
  'r1bq1rk1/pp2ppbp/2np1np1/8/2BNP3/2N1BP2/PPPQ2PP/R3K2R': 'Czerniak Variation, Sicilian Dragon',
  'r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Fianchetto Variation, Richter-Rauzer Sicilizn',
  'r1bqkb1r/pp2pppp/2np1n2/8/3NP3/2N5/PPP1BPPP/R1BQK2R': 'Boleslavsky Variation, Sicilian',
  'r1bqkb1r/pp2pppp/2np1n2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R': 'Exchange Variation, Richter-Rauzer Sicilian',
  'r1bqkb1r/pp3ppp/2nppn2/6B1/3NP3/2N5/PPP2PPP/R2QKB1R': 'Exchange Variation, Richter-Rauzer Sicilian',
  'r1bqkb1r/pp3ppp/2nppn2/6B1/3NP3/2N5/PPPQ1PPP/R3KB1R': 'Ivanov Variation, Sicilian',
  'r1bqkb1r/1p3ppp/p1nppn2/6B1/3NP3/2N5/PPPQ1PPP/R3KB1R': 'B67',
  'r1bqkb1r/1p3ppp/p1nppn2/6B1/3NP3/2N5/PPPQ1PPP/2KR1B1R': 'B67',
  'rnbqkbnr/pp1p1ppp/4p3/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Taimanov; Bastrikov, Paulsen Variation, Sicilian; B44',
  'rnbqkbnr/pp1p1ppp/4p3/8/3pP3/5N2/PPP2PPP/RNBQKB1R': 'Taimanov; Bastrikov, Paulsen Variation, Sicilian; B44',
  'rnbqkbnr/pp1p1ppp/4p3/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Taimanov; Bastrikov, Paulsen Variation, Sicilian; B44',
  'rnbqkbnr/1p1p1ppp/p3p3/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Swiss Cheese Variation, Sicilian',
  'r1bqkbnr/pp1p1ppp/2n1p3/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Bastrikov Variation, Sicilian; B47',
  'r1bqkbnr/pp1p1ppp/2n1p3/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Bastrikov Variation, Sicilian; B47',
  'r1bqkb1r/pp1p1ppp/2n1pn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Paulsen Variation, Sicilian',
  'r1bqkb1r/pp1p1ppp/2n1pn2/1N6/4P3/2N5/PPP2PPP/R1BQKB1R': 'Paulsen Variation, Sicilian',
  'r1b1kbnr/ppqp1ppp/2n1p3/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Ponomariov Gambit, Sicilian',
  'rnbqkb1r/pp1p1ppp/4pn2/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Pin Variation; Sicilian CounterAttack',
  'rnbqkb1r/pp1p1ppp/4pn2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Pin Variation; Sicilian CounterAttack',
  'rnbqkbnr/pp1ppp1p/6p1/2p5/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Hyperaccelerated Pterodactyl, Sic',
  'rnbqkbnr/pp1ppp1p/6p1/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Hyperaccelerated Pterodactyl, Sic',
  'r1bqkbnr/pp1ppppp/2n5/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R': 'Gurgenidze Variation, Sicilian',
  'r1bqkbnr/pp1ppp1p/2n3p1/1Bp5/4P3/5N2/PPPP1PPP/RNBQK2R': 'Gurgenidze Variation, Sicilian',
  'r1bqkbnr/pp1ppp1p/2n3p1/1Bp5/4P3/5N2/PPPP1PPP/RNBQ1RK1': 'Gurgenidze Variation, Sicilian',
  'r1bqk1nr/pp1pppbp/2n3p1/1Bp5/4P3/5N2/PPPP1PPP/RNBQ1RK1': 'Gurgenidze Variation, Sicilian',
  'r1bqkbnr/pp1ppppp/2n5/2p5/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Nimzovich Variation, Sicilian; Nimzo-American Variation',
  'r1bqkbnr/pp1ppppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R': 'Nimzovich Variation, Sicilian; Nimzo-American Variation',
  'r1bqkbnr/pp1ppppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Nimzovich Variation, Sicilian; Nimzo-American Variation',
  'r1bqkbnr/pp1ppp1p/2n3p1/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Breyer Variation, Sicilian; B39',
  'r1bqkbnr/pp1ppp1p/2n3p1/8/2PNP3/8/PP3PPP/RNBQKB1R': 'Breyer Variation, Sicilian; B39',
  'r1bqkb1r/pp1ppppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Lasker-Pelikan Variation, Sicilian',
  'r1bqkb1r/pp1ppppp/2n2n2/8/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Lasker-Pelikan Variation, Sicilian',
  'r1bqkb1r/pp1p1ppp/2n2n2/4p3/3NP3/2N5/PPP2PPP/R1BQKB1R': 'Chelyabinsk Variation, Sicilian',
  'r1bqkb1r/pp1p1ppp/2n2n2/1N2p3/4P3/2N5/PPP2PPP/R1BQKB1R': 'Chelyabinsk Variation, Sicilian',
  'r1bqkb1r/pp3ppp/2np1n2/1N2p3/4P3/2N5/PPP2PPP/R1BQKB1R': 'Chelyabinsk Variation, Sicilian',
  'r1bqkb1r/pp3ppp/2np1n2/1N2p1B1/4P3/2N5/PPP2PPP/R2QKB1R': 'Chelyabinsk Variation, Sicilian',
  'r1bqkb1r/1p3ppp/p1np1n2/1N2p1B1/4P3/2N5/PPP2PPP/R2QKB1R': 'Chelyabinsk Variation, Sicilian',
  'r1bqkb1r/1p3ppp/p1np1n2/4p1B1/4P3/N1N5/PPP2PPP/R2QKB1R': 'Chelyabinsk Variation, Sicilian',
  'rnbqkbnr/pp1ppppp/2p5/8/3PP3/8/PPP2PPP/RNBQKBNR': 'Milner-Barry Gambit, Caro; Rasa-Studier Gambit',
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/8/PPP2PPP/RNBQKBNR': 'Milner-Barry Gambit, Caro; Rasa-Studier Gambit',
  'rnbqkbnr/pp2pppp/2p5/3pP3/3P4/8/PPP2PPP/RNBQKBNR': 'Botvinnik-Carls Defense, Caro-Kann',
  'rn1qkbnr/pp2pppp/2p5/3pPb2/3P4/8/PPP2PPP/RNBQKBNR': 'Van der Wiel Attack, Caro-Kann',
  'rnbqkbnr/pp2pppp/2p5/3P4/3P4/8/PPP2PPP/RNBQKBNR': 'Panov-Botvinnik; Gunderam Attack',
  'rnbqkbnr/pp2pppp/8/3p4/3P4/8/PPP2PPP/RNBQKBNR': 'Panov-Botvinnik; Gunderam Attack',
  'rnbqkbnr/pp2pppp/8/3p4/2PP4/8/PP3PPP/RNBQKBNR': 'Reifir-Spielmann Line, Caro-Kann',
  'rnbqkb1r/pp2pppp/5n2/3p4/2PP4/8/PP3PPP/RNBQKBNR': 'Reifir-Spielmann Line, Caro-Kann',
  'rnbqkb1r/pp2pppp/5n2/3p4/2PP4/2N5/PP3PPP/R1BQKBNR': 'Reifir-Spielmann Line, Caro-Kann',
  'r1bqkb1r/pp2pppp/2n2n2/3p4/2PP4/2N5/PP3PPP/R1BQKBNR': 'Reifir-Spielmann Line, Caro-Kann',
  'r1bqkb1r/pp2pppp/2n2n2/3p2B1/2PP4/2N5/PP3PPP/R2QKBNR': 'Reifir-Spielmann Line, Caro-Kann',
  'rnbqkbnr/pp2pppp/2p5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR': 'Milner-Barry Gambit, Caro; Rasa-Studier Gambit',
  'rnbqkbnr/pp2pppp/2p5/8/3Pp3/2N5/PPP2PPP/R1BQKBNR': 'Milner-Barry Gambit, Caro; Rasa-Studier Gambit',
  'rnbqkbnr/pp2pppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR': 'Nimzovich; Bronstein-Larsen, Caro; B16',
  'rn1qkbnr/pp2pppp/2p5/5b2/3PN3/8/PPP2PPP/R1BQKBNR': 'Seirawan Variation, Caro-Kann',
  'rn1qkbnr/pp2pppp/2p5/5b2/3P4/6N1/PPP2PPP/R1BQKBNR': 'Seirawan Variation, Caro-Kann',
  'rn1qkbnr/pp2pppp/2p3b1/8/3P4/6N1/PPP2PPP/R1BQKBNR': 'Seirawan Variation, Caro-Kann',
  'r1bqkbnr/pp1npppp/2p5/8/3PN3/8/PPP2PPP/R1BQKBNR': 'Tiviakov-Fischer Attack, Caro-Kann',
  'rnbqkb1r/pp2pppp/2p2n2/8/3PN3/8/PPP2PPP/R1BQKBNR': 'Nimzovich; Bronstein-Larsen, Caro; B16',
  'rnbqkb1r/pp2pppp/2p2N2/8/3P4/8/PPP2PPP/R1BQKBNR': 'Nimzovich; Bronstein-Larsen, Caro; B16',
  'rnbqkbnr/pp1ppppp/2p5/8/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Retreat Line, Mindeno Variation, Caro-Kann',
  'rnbqkbnr/pp2pppp/2p5/3p4/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Retreat Line, Mindeno Variation, Caro-Kann',
  'rnbqkbnr/pp2pppp/2p5/3p4/4P3/2N2N2/PPPP1PPP/R1BQKB1R': 'Retreat Line, Mindeno Variation, Caro-Kann',
  'rnbqkbnr/ppp1pppp/8/3P4/8/8/PPPP1PPP/RNBQKBNR': 'Marshall Gambit, Scandanavian G; Modern Variation, CC',
  'rnbqkbnr/pp2pppp/2p5/3P4/8/8/PPPP1PPP/RNBQKBNR': 'Atkinson (Kloosterboer) Variation, Center Counter',
  'rnbqkbnr/pp2pppp/2P5/8/8/8/PPPP1PPP/RNBQKBNR': 'Atkinson (Kloosterboer) Variation, Center Counter',
  'rnbqkb1r/ppp1pppp/5n2/3P4/8/8/PPPP1PPP/RNBQKBNR': 'Portuguese Variation, Center Counter',
  'rnbqkb1r/ppp1pppp/5n2/3P4/3P4/8/PPP2PPP/RNBQKBNR': 'Portuguese Variation, Center Counter',
  'rnbqkb1r/ppp1pppp/8/3n4/3P4/8/PPP2PPP/RNBQKBNR': 'Gipslis Variation, Center Counter',
  'rnb1kbnr/ppp1pppp/8/3q4/8/8/PPPP1PPP/RNBQKBNR': 'Leonhardt (Rosen) Gambit, Center Counter',
  'rnb1kbnr/ppp1pppp/8/3q4/8/2N5/PPPP1PPP/R1BQKBNR': 'Leonhardt (Rosen) Gambit, Center Counter',
  'rnb1kbnr/ppp1pppp/8/q7/8/2N5/PPPP1PPP/R1BQKBNR': 'Leonhardt (Rosen) Gambit, Center Counter',
  'rnb1kbnr/ppp1pppp/8/q7/3P4/2N5/PPP2PPP/R1BQKBNR': 'Anderssen Variation, Center Counter',
  'rnbqkbnr/ppp1pppp/3p4/8/3PP3/8/PPP2PPP/RNBQKBNR': 'Panov; Opatijav; Byrne Variation, Pirc',
  'rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/8/PPP2PPP/RNBQKBNR': 'Panov; Opatijav; Byrne Variation, Pirc',
  'rnbqkb1r/ppp1pppp/3p1n2/8/3PP3/2N5/PPP2PPP/R1BQKBNR': 'Panov; Opatijav; Byrne Variation, Pirc',
  'rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N5/PPP2PPP/R1BQKBNR': 'Panov; Opatijav; Byrne Variation, Pirc',
  'rnbqkb1r/ppp1pp1p/3p1np1/8/3PPP2/2N5/PPP3PP/R1BQKBNR': 'Austrian; Yugoslav Defense, Pirc',
  'rnbqk2r/ppp1ppbp/3p1np1/8/3PPP2/2N5/PPP3PP/R1BQKBNR': 'Austrian; Yugoslav Defense, Pirc',
  'rnbqk2r/ppp1ppbp/3p1np1/8/3PPP2/2N2N2/PPP3PP/R1BQKB1R': 'Kurajica Variation, Pirc',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/3PPP2/2N2N2/PPP3PP/R1BQKB1R': 'Kurajica Variation, Pirc',
  'rnbqkb1r/ppp1pp1p/3p1np1/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R': 'Schlechter Variation, Pirc',
  'rnbqk2r/ppp1ppbp/3p1np1/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R': 'Schlechter Variation, Pirc',
  'rnbqk2r/ppp1ppbp/3p1np1/8/3PP3/2N2N2/PPP1BPPP/R1BQK2R': 'Parma Defense, Pirc',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/3PP3/2N2N2/PPP1BPPP/R1BQK2R': 'Parma Defense, Pirc',
  'rnbq1rk1/ppp1ppbp/3p1np1/8/3PP3/2N2N2/PPP1BPPP/R1BQ1RK1': 'Parma Defense, Pirc',
  'rnbqkbnr/pppp1ppp/8/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR': 'Classical Variation, Bishop; Boi Variation',
  'rnbqk1nr/pppp1ppp/8/2b1p3/2B1P3/8/PPPP1PPP/RNBQK1NR': 'Labourdonnais-Denker Gambit, Bishop',
  'rnbqk1nr/pppp1ppp/8/2b1p3/2B1P3/2P5/PP1P1PPP/RNBQK1NR': 'Lewis Counter-Gambit, Bishop',
  'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/8/PPPP1PPP/RNBQK1NR': 'Urusov; Ouroussoff; Keidansky G',
  'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/3P4/PPP2PPP/RNBQK1NR': 'Hromadka Variation, Bishop',
  'rnbqkb1r/pppp1ppp/5n2/4p3/2BPP3/8/PPP2PPP/RNBQK1NR': 'Urusov; Ouroussoff; Keidansky G',
  'rnbqkb1r/pppp1ppp/5n2/8/2BpP3/8/PPP2PPP/RNBQK1NR': 'Urusov; Ouroussoff; Keidansky G',
  'rnbqkb1r/pppp1ppp/5n2/4p3/2B1P3/2N5/PPPP1PPP/R1BQK1NR': 'Three Knights Variation, Vienna; C28',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/3P4/PPP2PPP/RNBQKBNR': 'King\'s Gambit Reversed ',
  'rnbqkbnr/pppp1ppp/8/4p3/3PP3/8/PPP2PPP/RNBQKBNR': 'Copenhagen Defense, Danish Gambit',
  'rnbqkbnr/pppp1ppp/8/8/3pP3/8/PPP2PPP/RNBQKBNR': 'Copenhagen Defense, Danish Gambit',
  'rnbqkbnr/pppp1ppp/8/8/3pP3/2P5/PP3PPP/RNBQKBNR': 'Copenhagen Defense, Danish Gambit',
  'rnbqkbnr/pppp1ppp/8/8/4P3/2p5/PP3PPP/RNBQKBNR': 'Copenhagen Defense, Danish Gambit',
  'rnbqkbnr/pppp1ppp/8/8/2B1P3/2p5/PP3PPP/RNBQK1NR': 'Copenhagen Defense, Danish Gambit',
  'rnbqkbnr/pppp1ppp/8/8/2B1P3/8/Pp3PPP/RNBQK1NR': 'Copenhagen Defense, Danish Gambit',
  'rnbqkbnr/pppp1ppp/8/8/2B1P3/8/PB3PPP/RN1QK1NR': 'Copenhagen Defense, Danish Gambit',
  'rnbqkbnr/pppp1ppp/8/8/3QP3/8/PPP2PPP/RNB1KBNR': 'Paulsen Attack Variation, Center',
  'r1bqkbnr/pppp1ppp/2n5/8/3QP3/8/PPP2PPP/RNB1KBNR': 'Paulsen Attack Variation, Center',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/5P2/PPPP2PP/RNBQKBNR': 'King\'s Head Opening',
  'rnbqkbnr/pppp1ppp/8/4p3/4PP2/8/PPPP2PP/RNBQKBNR': 'Scandinavian Variation, KGA; Modern Defense, KGA; C36',
  'rnbqk1nr/pppp1ppp/8/2b1p3/4PP2/8/PPPP2PP/RNBQKBNR': 'Heath Variation, KGD; Rotlewi Countergambit',
  'rnbqk1nr/pppp1ppp/8/2b1p3/4PP2/5N2/PPPP2PP/RNBQKB1R': 'Heath Variation, KGD; Rotlewi Countergambit',
  'rnbqk1nr/ppp2ppp/3p4/2b1p3/4PP2/5N2/PPPP2PP/RNBQKB1R': 'Heath Variation, KGD; Rotlewi Countergambit',
  'rnbqkbnr/ppp2ppp/8/3pp3/4PP2/8/PPPP2PP/RNBQKBNR': 'Modern Transfer, Falkbeer Countergambit, KGD',
  'rnbqkbnr/ppp2ppp/8/3Pp3/5P2/8/PPPP2PP/RNBQKBNR': 'Modern Transfer, Falkbeer Countergambit, KGD',
  'rnbqkbnr/ppp2ppp/8/3P4/4pP2/8/PPPP2PP/RNBQKBNR': 'Nimzovich Variation, KGD; Anderssen Attack',
  'rnbqkbnr/ppp2ppp/8/3P4/4pP2/3P4/PPP3PP/RNBQKBNR': 'Old Line, Falkbeer Countergambit, KGD',
  'rnbqkb1r/ppp2ppp/5n2/3P4/4pP2/3P4/PPP3PP/RNBQKBNR': 'Old Line, Falkbeer Countergambit, KGD',
  'rnbqkbnr/pppp1ppp/8/8/4Pp2/8/PPPP2PP/RNBQKBNR': 'Scandinavian Variation, KGA; Modern Defense, KGA; C36',
  'rnbqkbnr/pppp1ppp/8/8/2B1Pp2/8/PPPP2PP/RNBQK1NR': 'Kieseritzky Gambit, Bishop\'s Gambit, KGA',
  'rnb1kbnr/pppp1ppp/8/8/2B1Pp1q/8/PPPP2PP/RNBQK1NR': 'Classical Defense, KGA; Lopez Variation',
  'rnb1kbnr/pppp1ppp/8/8/2B1Pp1q/8/PPPP2PP/RNBQ1KNR': 'Classical Defense, KGA; Lopez Variation',
  'rnb1kbnr/pppp1p1p/8/6p1/2B1Pp1q/8/PPPP2PP/RNBQ1KNR': 'MacDonnell Attack, KGA',
  'rnb1kbnr/pppp1p1p/8/6p1/2B1Pp1q/2N5/PPPP2PP/R1BQ1KNR': 'MacDonnell Attack, KGA',
  'rnb1k1nr/pppp1pbp/8/6p1/2B1Pp1q/2N5/PPPP2PP/R1BQ1KNR': 'MacDonnell Attack, KGA',
  'rnbqkbnr/pppp1ppp/8/8/4Pp2/5N2/PPPP2PP/RNBQKB1R': 'Scandinavian Variation, KGA; Modern Defense, KGA; C36',
  'rnbqk1nr/ppppbppp/8/8/4Pp2/5N2/PPPP2PP/RNBQKB1R': 'Neo-Cunningham Gambit, KGA; McCormick Defense',
  'rnbqk1nr/ppppbppp/8/8/2B1Pp2/5N2/PPPP2PP/RNBQK2R': 'Neo-Cunningham Gambit, KGA; McCormick Defense',
  'rnbqkbnr/pppp1p1p/8/6p1/4Pp2/5N2/PPPP2PP/RNBQKB1R': 'Anderssen Defense, Kieseritsky Gambit, KGA',
  'rnbqkbnr/pppp1p1p/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQK2R': 'Muzio-Polerio Gambit, KGA; Wild Muzio',
  'rnbqk1nr/pppp1pbp/8/6p1/2B1Pp2/5N2/PPPP2PP/RNBQK2R': 'Greco; Calabrian Gambit, KGA',
  'rnbqk1nr/pppp1pbp/8/6p1/2B1Pp1P/5N2/PPPP2P1/RNBQK2R': 'Greco; Calabrian Gambit, KGA',
  'rnbqk1nr/pppp1pb1/7p/6p1/2B1Pp1P/5N2/PPPP2P1/RNBQK2R': 'Greco; Calabrian Gambit, KGA',
  'rnbqk1nr/pppp1pb1/7p/6p1/2BPPp1P/5N2/PPP3P1/RNBQK2R': 'Greco; Calabrian Gambit, KGA',
  'rnbqkbnr/pppp1p1p/8/8/2B1Ppp1/5N2/PPPP2PP/RNBQK2R': 'Muzio-Polerio Gambit, KGA; Wild Muzio',
  'rnbqkbnr/pppp1p1p/8/4N3/2B1Ppp1/8/PPPP2PP/RNBQK2R': 'Herzfeld; Portuguese; Vienna, KGA',
  'rnb1kbnr/pppp1p1p/8/4N3/2B1Pppq/8/PPPP2PP/RNBQK2R': 'Herzfeld; Portuguese; Vienna, KGA',
  'rnb1kbnr/pppp1p1p/8/4N3/2B1Pppq/8/PPPP2PP/RNBQ1K1R': 'Herzfeld; Portuguese; Vienna, KGA',
  'rnbqkbnr/pppp1p1p/8/8/2B1Ppp1/5N2/PPPP2PP/RNBQ1RK1': 'Kling & Horwitz Counter-Attack, KGA',
  'rnbqkbnr/pppp1p1p/8/8/2B1Pp2/5p2/PPPP2PP/RNBQ1RK1': 'Double Muzio Gambit, KGA',
  'rnbqkbnr/pppp1p1p/8/8/2B1Pp2/5Q2/PPPP2PP/RNB2RK1': 'Double Muzio Gambit, KGA',
  'rnb1kbnr/pppp1p1p/5q2/8/2B1Pp2/5Q2/PPPP2PP/RNB2RK1': 'Double Muzio Gambit, KGA',
  'rnbqkbnr/pppp1p1p/8/6p1/4Pp1P/5N2/PPPP2P1/RNBQKB1R': 'Anderssen Defense, Kieseritsky Gambit, KGA',
  'rnbqkbnr/pppp1p1p/8/8/4PppP/5N2/PPPP2P1/RNBQKB1R': 'Anderssen Defense, Kieseritsky Gambit, KGA',
  'rnbqkbnr/pppp1p1p/8/4N3/4PppP/8/PPPP2P1/RNBQKB1R': 'Anderssen Defense, Kieseritsky Gambit, KGA',
  'rnbqkb1r/pppp1p1p/5n2/4N3/4PppP/8/PPPP2P1/RNBQKB1R': 'Anderssen Defense, Kieseritsky Gambit, KGA',
  'rnbqkb1r/pppp1p1p/5n2/4N3/2B1PppP/8/PPPP2P1/RNBQK2R': 'Anderssen Defense, Kieseritsky Gambit, KGA',
  'rnbqkb1r/ppp2p1p/5n2/3pN3/2B1PppP/8/PPPP2P1/RNBQK2R': 'Anderssen Defense, Kieseritsky Gambit, KGA',
  'rnbqkb1r/ppp2p1p/5n2/3PN3/2B2ppP/8/PPPP2P1/RNBQK2R': 'Anderssen Defense, Kieseritsky Gambit, KGA',
  'rnbqk2r/ppp2p1p/3b1n2/3PN3/2B2ppP/8/PPPP2P1/RNBQK2R': 'Anderssen-Cordel Gambit, KGA',
  'rnbqkbnr/pppp1p1p/8/6N1/4PppP/8/PPPP2P1/RNBQKB1R': 'Walker (Urusov) Attack, KGA',
  'rnbqkbnr/pppp1p2/7p/6N1/4PppP/8/PPPP2P1/RNBQKB1R': 'Walker (Urusov) Attack, KGA',
  'rnbqkbnr/pppp1N2/7p/8/4PppP/8/PPPP2P1/RNBQKB1R': 'Walker (Urusov) Attack, KGA',
  'rnbq1bnr/pppp1k2/7p/8/4PppP/8/PPPP2P1/RNBQKB1R': 'Walker (Urusov) Attack, KGA',
  'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Three Knights Variation, Vienna; C28',
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Fraser-Minckwitz Variation, Vienna',
  'r1bqkbnr/pppp1ppp/2n5/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR': 'Fraser-Minckwitz Variation, Vienna',
  'r1bqkbnr/pppp1ppp/2n5/8/4Pp2/2N5/PPPP2PP/R1BQKBNR': 'Fraser-Minckwitz Variation, Vienna',
  'r1bqkbnr/pppp1ppp/2n5/8/3PPp2/2N5/PPP3PP/R1BQKBNR': 'Fraser-Minckwitz Variation, Vienna',
  'r1b1kbnr/pppp1ppp/2n5/8/3PPp1q/2N5/PPP3PP/R1BQKBNR': 'Fraser-Minckwitz Variation, Vienna',
  'r1b1kbnr/pppp1ppp/2n5/8/3PPp1q/2N5/PPP1K1PP/R1BQ1BNR': 'Fraser-Minckwitz Variation, Vienna',
  'r1bqkbnr/pppp1ppp/2n5/8/4Pp2/2N2N2/PPPP2PP/R1BQKB1R': 'Hamppe-Allgaier Gambit, Vienna',
  'r1bqkbnr/pppp1p1p/2n5/6p1/4Pp2/2N2N2/PPPP2PP/R1BQKB1R': 'Hamppe-Allgaier Gambit, Vienna',
  'rnbqkb1r/pppp1ppp/5n2/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Three Knights Variation, Vienna; C28',
  'rnbqkb1r/pppp1ppp/8/4p3/2B1n3/2N5/PPPP1PPP/R1BQK1NR': 'Boden-Kieseritzky Gambit, Vienna',
  'rnbqkb1r/pppp1ppp/8/4p2Q/2B1n3/2N5/PPPP1PPP/R1B1K1NR': 'Frankenstein-Dracula Var, Vienna',
  'rnbqkb1r/pppp1ppp/3n4/4p2Q/2B5/2N5/PPPP1PPP/R1B1K1NR': 'Frankenstein-Dracula Var, Vienna',
  'rnbqkb1r/pppp1ppp/3n4/4p2Q/8/1BN5/PPPP1PPP/R1B1K1NR': 'Frankenstein-Dracula Var, Vienna',
  'rnbqkb1r/pppp1ppp/5n2/4p3/4PP2/2N5/PPPP2PP/R1BQKBNR': 'Bardeleben Variation, Vienna',
  'rnbqkb1r/ppp2ppp/5n2/3pp3/4PP2/2N5/PPPP2PP/R1BQKBNR': 'Bardeleben Variation, Vienna',
  'rnbqkb1r/ppp2ppp/5n2/3pP3/4P3/2N5/PPPP2PP/R1BQKBNR': 'Bardeleben Variation, Vienna',
  'rnbqkb1r/ppp2ppp/8/3pP3/4n3/2N5/PPPP2PP/R1BQKBNR': 'Bardeleben Variation, Vienna',
  'rnbqkbnr/ppp2ppp/8/3pp3/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Maroczy; Elephant Gambit',
  'rnbqkbnr/ppp2ppp/8/3Pp3/8/5N2/PPPP1PPP/RNBQKB1R': 'Maroczy; Elephant Gambit',
  'rnbqkbnr/ppp2ppp/3p4/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Jaenisch Counter-Attack, Philidor; Nimzovich Variation',
  'rnbqkbnr/ppp2ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Jaenisch Counter-Attack, Philidor; Nimzovich Variation',
  'rnbqkbnr/ppp2ppp/3p4/8/3pP3/5N2/PPP2PPP/RNBQKB1R': 'Larsen Variation, Philidor',
  'r1bqkbnr/pppn1ppp/3p4/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Schlechter Variation, Philidor',
  'r1bqkbnr/pppn1ppp/3p4/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R': 'Schlechter Variation, Philidor',
  'r1bqkbnr/pp1n1ppp/2pp4/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R': 'Schlechter Variation, Philidor',
  'rnbqkb1r/ppp2ppp/3p1n2/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Sokolsky Variation, Philidor',
  'rnbqkbnr/pppp2pp/8/4pp2/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Foltys-Leonhardt Variation, Latvian Gambit',
  'rnbqkbnr/pppp2pp/8/4pp2/2B1P3/5N2/PPPP1PPP/RNBQK2R': 'Polerio-Svedenborg Variation, Latvian',
  'rnbqkbnr/pppp2pp/8/4p3/2B1p3/5N2/PPPP1PPP/RNBQK2R': 'Polerio-Svedenborg Variation, Latvian',
  'rnbqkbnr/pppp2pp/8/4N3/2B1p3/8/PPPP1PPP/RNBQK2R': 'Polerio-Svedenborg Variation, Latvian',
  'rnbqkbnr/pppp2pp/8/4Np2/4P3/8/PPPP1PPP/RNBQKB1R': 'Foltys-Leonhardt Variation, Latvian Gambit',
  'rnb1kbnr/pppp2pp/5q2/4Np2/4P3/8/PPPP1PPP/RNBQKB1R': 'Foltys-Leonhardt Variation, Latvian Gambit',
  'rnb1kbnr/pppp2pp/5q2/4Np2/3PP3/8/PPP2PPP/RNBQKB1R': 'Bilguer Variation, Latvian',
  'rnb1kbnr/ppp3pp/3p1q2/4Np2/3PP3/8/PPP2PPP/RNBQKB1R': 'Bilguer Variation, Latvian',
  'rnb1kbnr/ppp3pp/3p1q2/5p2/2NPP3/8/PPP2PPP/RNBQKB1R': 'Bronstein Attack, Latvian',
  'rnb1kbnr/ppp3pp/3p1q2/8/2NPp3/8/PPP2PPP/RNBQKB1R': 'Bronstein Attack, Latvian',
  'r1bqkbnr/1ppp1ppp/p1n5/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R': 'Furman-Taimanov; Wing Var, Ruy; Norwegian Variation',
  'r1bqkbnr/1ppp1ppp/p1n5/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R': 'Furman-Taimanov; Wing Var, Ruy; Norwegian Variation',
  'r1bqkbnr/2pp1ppp/p1n5/1p2p3/B3P3/5N2/PPPP1PPP/RNBQK2R': 'Furman-Taimanov; Wing Var, Ruy; Norwegian Variation',
  'r1bqkbnr/2pp1ppp/p1n5/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQK2R': 'Furman-Taimanov; Wing Var, Ruy; Norwegian Variation',
  'r1bqkbnr/1pp2ppp/p1np4/4p3/B3P3/5N2/PPPP1PPP/RNBQK2R': 'Richter Variation, Ruy Lopez',
  'r1bqkbnr/1pp2ppp/p1Bp4/4p3/4P3/5N2/PPPP1PPP/RNBQK2R': 'Richter Variation, Ruy Lopez',
  'r1bqkbnr/1pp2ppp/p1np4/4p3/B3P3/2P2N2/PP1P1PPP/RNBQK2R': 'Kopaiev Variation, Ruy Lopez',
  'r1bqkb1r/1ppp1ppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1': 'Russian Defense, Ruy Lopez; C79; Lasker Defense',
  'r1bqkb1r/2pp1ppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1': 'Neo-Steinitz Defense, Ruy Lopez',
  'r1bqkb1r/2pp1ppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQ1RK1': 'Neo-Steinitz Defense, Ruy Lopez',
  'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQ1RK1': 'Breyer; Retreat Variation, Ruy Lopez; C94',
  'r1bqk2r/1pppbppp/p1n2n2/4p3/B3P3/5N2/PPPP1PPP/RNBQR1K1': 'Breyer; Retreat Variation, Ruy Lopez; C94',
  'r1bqk2r/2ppbppp/p1n2n2/1p2p3/B3P3/5N2/PPPP1PPP/RNBQR1K1': 'Breyer; Retreat Variation, Ruy Lopez; C94',
  'r1bqk2r/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1': 'Breyer; Retreat Variation, Ruy Lopez; C94',
  'r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1': 'Breyer; Retreat Variation, Ruy Lopez; C94',
  'r1bqk2r/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1': 'Breyer; Retreat Variation, Ruy Lopez; C94',
  'r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1': 'Breyer; Retreat Variation, Ruy Lopez; C94',
  'r1bq1rk1/2p1bppp/p1np1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1': 'Breyer; Retreat Variation, Ruy Lopez; C94',
  'r1bq1rk1/2p1bppp/p2p1n2/np2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1': 'Chigorin Variation, Ruy Lopez; C97',
  'r1bq1rk1/2p1bppp/p2p1n2/np2p3/4P3/2P2N1P/PPBP1PP1/RNBQR1K1': 'Chigorin Variation, Ruy Lopez; C97',
  'r1bq1rk1/4bppp/p2p1n2/npp1p3/4P3/2P2N1P/PPBP1PP1/RNBQR1K1': 'Chigorin Variation, Ruy Lopez; C97',
  'r1bq1rk1/4bppp/p2p1n2/npp1p3/3PP3/2P2N1P/PPB2PP1/RNBQR1K1': 'Chigorin Variation, Ruy Lopez; C97',
  'r1b2rk1/2q1bppp/p2p1n2/npp1p3/3PP3/2P2N1P/PPB2PP1/RNBQR1K1': 'Classical Variation, Ruy Lopez',
  'r1b2rk1/2q1bppp/p2p1n2/npp1p3/3PP3/2P2N1P/PPBN1PP1/R1BQR1K1': 'Rauzer Variation, Ruy Lopez',
  'rnbq1rk1/2p1bppp/p2p1n2/1p2p3/4P3/1BP2N1P/PP1P1PP1/RNBQR1K1': 'Romanishin Variation, Ruy Lopez',
  'rnbq1rk1/2p1bppp/p2p1n2/1p2p3/3PP3/1BP2N1P/PP3PP1/RNBQR1K1': 'Romanishin Variation, Ruy Lopez',
  'r1bq1rk1/2pnbppp/p2p1n2/1p2p3/3PP3/1BP2N1P/PP3PP1/RNBQR1K1': 'Romanishin Variation, Ruy Lopez',
  'r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1B3N2/PPPP1PPP/RNBQR1K1': 'Anti-Marshall Variation, Ruy Lopez',
  'r1bq1rk1/2ppbppp/p1n2n2/1p2p3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1': 'Marshall Counter-Attack, Ruy Lopez',
  'r1bq1rk1/2p1bppp/p1n2n2/1p1pp3/4P3/1BP2N2/PP1P1PPP/RNBQR1K1': 'Marshall Counter-Attack, Ruy Lopez',
  'r1bq1rk1/2p1bppp/p1n2n2/1p1Pp3/8/1BP2N2/PP1P1PPP/RNBQR1K1': 'Steiner Variation, Ruy Lopez',
  'r1bq1rk1/2p1bppp/p1n5/1p1np3/8/1BP2N2/PP1P1PPP/RNBQR1K1': 'Fischer Variation, Ruy Lopez',
  'r1bq1rk1/2p1bppp/p1n5/1p1nN3/8/1BP5/PP1P1PPP/RNBQR1K1': 'Fischer Variation, Ruy Lopez',
  'r1bq1rk1/2p1bppp/p7/1p1nn3/8/1BP5/PP1P1PPP/RNBQR1K1': 'Fischer Variation, Ruy Lopez',
  'r1bq1rk1/2p1bppp/p7/1p1nR3/8/1BP5/PP1P1PPP/RNBQ2K1': 'Fischer Variation, Ruy Lopez',
  'r1bq1rk1/4bppp/p1p5/1p1nR3/8/1BP5/PP1P1PPP/RNBQ2K1': 'Fischer Variation, Ruy Lopez',
  'r1bqkb1r/1ppp1ppp/p1n5/4p3/B3n3/5N2/PPPP1PPP/RNBQ1RK1': 'Keres; Estonian; Howell; Moscow Var',
  'r1bqkb1r/1ppp1ppp/p1n5/4p3/B2Pn3/5N2/PPP2PPP/RNBQ1RK1': 'Keres; Estonian; Howell; Moscow Var',
  'r1bqkb1r/2pp1ppp/p1n5/1p2p3/B2Pn3/5N2/PPP2PPP/RNBQ1RK1': 'Keres; Estonian; Howell; Moscow Var',
  'r1bqkb1r/2pp1ppp/p1n5/1p2p3/3Pn3/1B3N2/PPP2PPP/RNBQ1RK1': 'Keres; Estonian; Howell; Moscow Var',
  'r1bqkb1r/2p2ppp/p1n5/1p1pp3/3Pn3/1B3N2/PPP2PPP/RNBQ1RK1': 'Keres; Estonian; Howell; Moscow Var',
  'r1bqkb1r/2p2ppp/p1n5/1p1pP3/4n3/1B3N2/PPP2PPP/RNBQ1RK1': 'Keres; Estonian; Howell; Moscow Var',
  'r2qkb1r/2p2ppp/p1n1b3/1p1pP3/4n3/1B3N2/PPP2PPP/RNBQ1RK1': 'Dilworth; Kleczynski Var, Ruy Lopez',
  'r2qkb1r/2p2ppp/p1n1b3/1p1pP3/4n3/1BP2N2/PP3PPP/RNBQ1RK1': 'Dilworth; Kleczynski Var, Ruy Lopez',
  'r2qk2r/2p2ppp/p1n1b3/1pbpP3/4n3/1BP2N2/PP3PPP/RNBQ1RK1': 'Dilworth; Kleczynski Var, Ruy Lopez',
  'r1bqkbnr/1ppp1ppp/p1B5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R': 'King\'s Bishop Variation, Ruy Lopez Exchange',
  'r1bqkbnr/1pp2ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQK2R': 'King\'s Bishop Variation, Ruy Lopez Exchange',
  'r1bqkbnr/1pp2ppp/p1p5/4p3/4P3/5N2/PPPP1PPP/RNBQ1RK1': 'King\'s Bishop Variation, Ruy Lopez Exchange',
  'r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/5N2/PPPP1PPP/RNBQK2R': 'Spanish Wing Gambit, Ruy Lopez',
  'r1bqk1nr/pppp1ppp/2n5/1Bb1p3/4P3/2P2N2/PP1P1PPP/RNBQK2R': 'Charousek Variation, Ruy Lopez',
  'r1bqkbnr/pppp2pp/2n5/1B2pp2/4P3/5N2/PPPP1PPP/RNBQK2R': 'Exchange Variation, Schliemann Ruy Lopez',
  'r1bqkbnr/pppp2pp/2n5/1B2pp2/4P3/2N2N2/PPPP1PPP/R1BQK2R': 'Soviet Youth Variation, Ruy Lopez',
  'r1bqkbnr/pppp2pp/2n5/1B2p3/4p3/2N2N2/PPPP1PPP/R1BQK2R': 'Tartakower Variation, Ruy Lopez',
  'r1bqkbnr/pppp2pp/2n5/1B2p3/4N3/5N2/PPPP1PPP/R1BQK2R': 'Tartakower Variation, Ruy Lopez',
  'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQK2R': 'Improved Steinitz Defense, Ruy Lopez; C66',
  'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/3P1N2/PPP2PPP/RNBQK2R': 'Anderssen Variation, Ruy Lopez',
  'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1': 'Improved Steinitz Defense, Ruy Lopez; C66',
  'r1bqkb1r/ppp2ppp/2np1n2/1B2p3/4P3/5N2/PPPP1PPP/RNBQ1RK1': 'Closed Bernstein Variation, Ruy Lopez',
  'r1bqkb1r/ppp2ppp/2np1n2/1B2p3/3PP3/5N2/PPP2PPP/RNBQ1RK1': 'Closed Bernstein Variation, Ruy Lopez',
  'r2qkb1r/pppb1ppp/2np1n2/1B2p3/3PP3/5N2/PPP2PPP/RNBQ1RK1': 'Closed Bernstein Variation, Ruy Lopez',
  'r2qkb1r/pppb1ppp/2np1n2/1B2p3/3PP3/2N2N2/PPP2PPP/R1BQ1RK1': 'Closed Bernstein Variation, Ruy Lopez',
  'r2qk2r/pppbbppp/2np1n2/1B2p3/3PP3/2N2N2/PPP2PPP/R1BQ1RK1': 'Closed Bernstein Variation, Ruy Lopez',
  'r1bqkb1r/pppp1ppp/2n5/1B2p3/4n3/5N2/PPPP1PPP/RNBQ1RK1': 'Berlin; Rio de Janerio Var, Ruy Lopez',
  'r1bqkb1r/pppp1ppp/2n5/1B2p3/3Pn3/5N2/PPP2PPP/RNBQ1RK1': 'Berlin; Rio de Janerio Var, Ruy Lopez',
  'r1bqk2r/ppppbppp/2n5/1B2p3/3Pn3/5N2/PPP2PPP/RNBQ1RK1': 'Berlin; Rio de Janerio Var, Ruy Lopez',
  'r1bqk2r/ppppbppp/2n5/1B2p3/3Pn3/5N2/PPP1QPPP/RNB2RK1': 'Berlin; Rio de Janerio Var, Ruy Lopez',
  'r1bqk2r/ppppbppp/2nn4/1B2p3/3P4/5N2/PPP1QPPP/RNB2RK1': 'Berlin; Rio de Janerio Var, Ruy Lopez',
  'r1bqk2r/ppppbppp/2Bn4/4p3/3P4/5N2/PPP1QPPP/RNB2RK1': 'Berlin; Rio de Janerio Var, Ruy Lopez',
  'r1bqk2r/p1ppbppp/2pn4/4p3/3P4/5N2/PPP1QPPP/RNB2RK1': 'Berlin; Rio de Janerio Var, Ruy Lopez',
  'r1bqk2r/p1ppbppp/2pn4/4P3/8/5N2/PPP1QPPP/RNB2RK1': 'Berlin; Rio de Janerio Var, Ruy Lopez',
  'r1bqk2r/pnppbppp/2p5/4P3/8/5N2/PPP1QPPP/RNB2RK1': 'Berlin; Rio de Janerio Var, Ruy Lopez',
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R': 'Lewis Defense, Italian; Closed Variation',
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/1PB1P3/5N2/P1PP1PPP/RNBQK2R': 'Stone-Ware Defense, Evans Gambit',
  'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/5N2/P1PP1PPP/RNBQK2R': 'Stone-Ware Defense, Evans Gambit',
  'r1bqk1nr/pppp1ppp/2n5/4p3/1bB1P3/2P2N2/P2P1PPP/RNBQK2R': 'Stone-Ware Defense, Evans Gambit',
  'r1bqk1nr/pppp1ppp/2n5/b3p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R': 'Leonhardt Variation, Evans',
  'r1bqk1nr/pppp1ppp/2n5/b3p3/2BPP3/2P2N2/P4PPP/RNBQK2R': 'Leonhardt Variation, Evans',
  'r1bqk1nr/ppp2ppp/2np4/b3p3/2BPP3/2P2N2/P4PPP/RNBQK2R': 'Sokolsky Variation, Evans',
  'r1bqk1nr/pppp1ppp/2n5/b7/2BpP3/2P2N2/P4PPP/RNBQK2R': 'Compromised Defense, Evans',
  'r1bqk1nr/pppp1ppp/2n5/b7/2BpP3/2P2N2/P4PPP/RNBQ1RK1': 'Compromised Defense, Evans',
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/P2P1PPP/RNBQK2R': 'Fraser Attack; Mortimer, Evans',
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2BPP3/2P2N2/P4PPP/RNBQK2R': 'Fraser Attack; Mortimer, Evans',
  'r1bqk1nr/pppp1ppp/2n5/2b5/2BpP3/2P2N2/P4PPP/RNBQK2R': 'Fraser Attack; Mortimer, Evans',
  'r1bqk1nr/pppp1ppp/2n5/2b5/2BpP3/2P2N2/P4PPP/RNBQ1RK1': 'Fraser Attack; Mortimer, Evans',
  'r1bqk1nr/ppp2ppp/2np4/2b5/2BpP3/2P2N2/P4PPP/RNBQ1RK1': 'Fraser Attack; Mortimer, Evans',
  'r1bqk1nr/ppp2ppp/2np4/2b5/2BPP3/5N2/P4PPP/RNBQ1RK1': 'Fraser Attack; Mortimer, Evans',
  'r1bqk1nr/ppp2ppp/1bnp4/8/2BPP3/5N2/P4PPP/RNBQ1RK1': 'Fraser Attack; Mortimer, Evans',
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R': 'Lewis Defense, Italian; Closed Variation',
  'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/2P2N2/PP1P1PPP/RNBQK2R': 'Moeller (Therkatz) Attack, Italian',
  'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2BPP3/2P2N2/PP3PPP/RNBQK2R': 'Moeller (Therkatz) Attack, Italian',
  'r1bqk2r/pppp1ppp/2n2n2/2b5/2BpP3/2P2N2/PP3PPP/RNBQK2R': 'Moeller (Therkatz) Attack, Italian',
  'r1bqk2r/pppp1ppp/2n2n2/2b5/2BPP3/5N2/PP3PPP/RNBQK2R': 'Moeller (Therkatz) Attack, Italian',
  'r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/5N2/PP3PPP/RNBQK2R': 'Moeller (Therkatz) Attack, Italian',
  'r1bqk2r/pppp1ppp/2n2n2/8/1bBPP3/2N2N2/PP3PPP/R1BQK2R': 'Moeller (Therkatz) Attack, Italian',
  'r1bqk2r/pppp1ppp/2n5/8/1bBPn3/2N2N2/PP3PPP/R1BQK2R': 'Moeller (Therkatz) Attack, Italian',
  'r1bqk2r/pppp1ppp/2n5/8/1bBPn3/2N2N2/PP3PPP/R1BQ1RK1': 'Moeller (Therkatz) Attack, Italian',
  'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R': 'Italian Four Knights Variation',
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R': 'Prussian Game; Knight Attack, Two Knights; C57',
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2BPP3/5N2/PPP2PPP/RNBQK2R': 'Perreux Variation, Two Knights Defense',
  'r1bqkb1r/pppp1ppp/2n2n2/8/2BpP3/5N2/PPP2PPP/RNBQK2R': 'Perreux Variation, Two Knights Defense',
  'r1bqkb1r/pppp1ppp/2n2n2/8/2BpP3/5N2/PPP2PPP/RNBQ1RK1': 'Double Gambit Accepted, Two Knights',
  'r1bqk2r/pppp1ppp/2n2n2/2b5/2BpP3/5N2/PPP2PPP/RNBQ1RK1': 'Marshall Variation, 2 Knights',
  'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R': 'Fried Liver; Fegatello Attack, 2 Knights',
  'r1bqkb1r/ppp2ppp/2n2n2/3pp1N1/2B1P3/8/PPPP1PPP/RNBQK2R': 'Fried Liver; Fegatello Attack, 2 Knights',
  'r1bqkb1r/ppp2ppp/2n2n2/3Pp1N1/2B5/8/PPPP1PPP/RNBQK2R': 'Fried Liver; Fegatello Attack, 2 Knights',
  'r1bqkb1r/ppp2ppp/5n2/n2Pp1N1/2B5/8/PPPP1PPP/RNBQK2R': 'Kieseritzky; Morphy Var, 2 Knights',
  'r1bqkb1r/ppp2ppp/5n2/nB1Pp1N1/8/8/PPPP1PPP/RNBQK2R': 'Bogoljubow Variation, Two Knights',
  'r1bqkb1r/pp3ppp/2p2n2/nB1Pp1N1/8/8/PPPP1PPP/RNBQK2R': 'Bogoljubow Variation, Two Knights',
  'r1bqkb1r/pp3ppp/2P2n2/nB2p1N1/8/8/PPPP1PPP/RNBQK2R': 'Bogoljubow Variation, Two Knights',
  'r1bqkb1r/p4ppp/2p2n2/nB2p1N1/8/8/PPPP1PPP/RNBQK2R': 'Bogoljubow Variation, Two Knights',
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R': 'Jaenisch Counterattack, Ponziani',
  'r1bqkbnr/ppp2ppp/2n5/3pp3/4P3/2P2N2/PP1P1PPP/RNBQKB1R': 'Leonhardt Variation, Ponziani',
  'r1bqkbnr/ppp2ppp/2n5/3pp3/Q3P3/2P2N2/PP1P1PPP/RNB1KB1R': 'Leonhardt Variation, Ponziani',
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R': 'Neumann Gambit, Ponziani',
  'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Double Pawn Sacrifice, Goering Gambit',
  'r1bqkbnr/pppp1ppp/2n5/8/3pP3/5N2/PPP2PPP/RNBQKB1R': 'Double Pawn Sacrifice, Goering Gambit',
  'r1bqkbnr/pppp1ppp/2n5/8/2BpP3/5N2/PPP2PPP/RNBQK2R': 'Paulsen; Anderssen C-A, Scotch',
  'r1bqkbnr/pppp1ppp/2n5/8/3pP3/2P2N2/PP3PPP/RNBQKB1R': 'Double Pawn Sacrifice, Goering Gambit',
  'r1bqkbnr/pppp1ppp/2n5/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Fleissig; Meitner Variation, Scotch',
  'r1bqk1nr/pppp1ppp/2n5/2b5/3NP3/8/PPP2PPP/RNBQKB1R': 'Fleissig; Meitner Variation, Scotch',
  'r1bqk1nr/pppp1ppp/2n5/2b5/3NP3/4B3/PPP2PPP/RN1QKB1R': 'Fleissig; Meitner Variation, Scotch',
  'r1b1k1nr/pppp1ppp/2n2q2/2b5/3NP3/4B3/PPP2PPP/RN1QKB1R': 'Fleissig; Meitner Variation, Scotch',
  'r1b1k1nr/pppp1ppp/2n2q2/2b5/3NP3/2P1B3/PP3PPP/RN1QKB1R': 'Fleissig; Meitner Variation, Scotch',
  'r1b1k2r/ppppnppp/2n2q2/2b5/3NP3/2P1B3/PP3PPP/RN1QKB1R': 'Fleissig; Meitner Variation, Scotch',
  'r1bqkb1r/pppp1ppp/2n2n2/8/3NP3/8/PPP2PPP/RNBQKB1R': 'Schmidt Var; Scotch Four Knights',
  'r1b1kbnr/pppp1ppp/2n5/8/3NP2q/8/PPP2PPP/RNBQKB1R': 'Steinitz Variation, Scotch',
  'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R': 'Double Ruy Lopez Opening, 4 Knights; C49',
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2N2N2/PPPP1PPP/R1BQKB1R': 'Double Ruy Lopez Opening, 4 Knights; C49',
  'r1bqkb1r/pppp1ppp/2n2n2/1B2p3/4P3/2N2N2/PPPP1PPP/R1BQK2R': 'Double Ruy Lopez Opening, 4 Knights; C49',
  'r1bqk2r/pppp1ppp/2n2n2/1B2p3/1b2P3/2N2N2/PPPP1PPP/R1BQK2R': 'Metger Unpin Variation, 4 Knights',
  'r1bqk2r/pppp1ppp/2n2n2/1B2p3/1b2P3/2N2N2/PPPP1PPP/R1BQ1RK1': 'Metger Unpin Variation, 4 Knights',
  'r1bq1rk1/pppp1ppp/2n2n2/1B2p3/1b2P3/2N2N2/PPPP1PPP/R1BQ1RK1': 'Metger Unpin Variation, 4 Knights',
  'r1bq1rk1/pppp1ppp/2n2n2/1B2p3/1b2P3/2NP1N2/PPP2PPP/R1BQ1RK1': 'Metger Unpin Variation, 4 Knights',
  'r1bq1rk1/ppp2ppp/2np1n2/1B2p3/1b2P3/2NP1N2/PPP2PPP/R1BQ1RK1': 'Metger Unpin Variation, 4 Knights',
  'r1bq1rk1/ppp2ppp/2np1n2/1B2p1B1/1b2P3/2NP1N2/PPP2PPP/R2Q1RK1': 'Metger Unpin Variation, 4 Knights',
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/3PP3/2N2N2/PPP2PPP/R1BQKB1R': 'Leonhardt Defense, Four Knights',
  'r1bqk2r/pppp1ppp/2n2n2/4p3/1b1PP3/2N2N2/PPP2PPP/R1BQKB1R': 'Leonhardt Defense, Four Knights',
  'rnbqkb1r/pppp1ppp/5n2/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Symmetrical Variation, Petroff',
  'rnbqkb1r/pppp1ppp/5n2/8/3pP3/5N2/PPP2PPP/RNBQKB1R': 'Suchting Gambit, Petroff',
  'rnbqkb1r/pppp1ppp/5n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R': 'Karklins-Martinovsky Variation, Petroff',
  'rnbqkb1r/ppp2ppp/3p1n2/4N3/4P3/8/PPPP1PPP/RNBQKB1R': 'Karklins-Martinovsky Variation, Petroff',
  'rnbqkb1r/ppp2ppp/3p1n2/8/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Mason-Showalter Variation, Petroff',
  'rnbqkb1r/ppp2ppp/3p4/8/4n3/5N2/PPPP1PPP/RNBQKB1R': 'Mason-Showalter Variation, Petroff',
  'rnbqkb1r/ppp2ppp/3p4/8/3Pn3/5N2/PPP2PPP/RNBQKB1R': 'Mason-Showalter Variation, Petroff',
  'rnbqkb1r/ppp2ppp/8/3p4/3Pn3/5N2/PPP2PPP/RNBQKB1R': 'Mason-Showalter Variation, Petroff',
  'rnbqkb1r/ppp2ppp/8/3p4/3Pn3/3B1N2/PPP2PPP/RNBQK2R': 'Mason-Showalter Variation, Petroff',
  'rnbqk2r/ppp1bppp/8/3p4/3Pn3/3B1N2/PPP2PPP/RNBQK2R': 'Jaenisch Variation, Petroff',
  'rnbqk2r/ppp1bppp/8/3p4/3Pn3/3B1N2/PPP2PPP/RNBQ1RK1': 'Jaenisch Variation, Petroff',
  'r1bqk2r/ppp1bppp/2n5/3p4/3Pn3/3B1N2/PPP2PPP/RNBQ1RK1': 'Jaenisch Variation, Petroff',
  'rnbqkbnr/pppp1ppp/4p3/8/3PP3/8/PPP2PPP/RNBQKBNR': 'Frere; Becker; Katilimov, Maric Var, French',
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPP2PPP/RNBQKBNR': 'Frere; Becker; Katilimov, Maric Var, French',
  'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR': 'Advance; Nimzovich; Steinitz Var, Fr',
  'rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/8/PPP2PPP/RNBQKBNR': 'Milner-Barry Gambit, French',
  'rnbqkbnr/pp3ppp/4p3/2ppP3/3P4/2P5/PP3PPP/RNBQKBNR': 'Milner-Barry Gambit, French',
  'r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P5/PP3PPP/RNBQKBNR': 'Milner-Barry Gambit, French',
  'r1bqkbnr/pp3ppp/2n1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R': 'Milner-Barry Gambit, French',
  'r1b1kbnr/pp3ppp/1qn1p3/2ppP3/3P4/2P2N2/PP3PPP/RNBQKB1R': 'Milner-Barry Gambit, French',
  'rnbqkbnr/ppp2ppp/4p3/3P4/3P4/8/PPP2PPP/RNBQKBNR': 'Monte Carlo Variation, French',
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR': 'Frere; Becker; Katilimov, Maric Var, French',
  'rnbqk1nr/ppp2ppp/4p3/3p4/1b1PP3/2N5/PPP2PPP/R1BQKBNR': 'Poisoned Pawn Variation, French Winawer',
  'rnbqk1nr/ppp2ppp/4p3/3pP3/1b1P4/2N5/PPP2PPP/R1BQKBNR': 'Poisoned Pawn Variation, French Winawer',
  'rnbqk1nr/pp3ppp/4p3/2ppP3/1b1P4/2N5/PPP2PPP/R1BQKBNR': 'Poisoned Pawn Variation, French Winawer',
  'rnbqk1nr/pp3ppp/4p3/2ppP3/1b1P4/P1N5/1PP2PPP/R1BQKBNR': 'Poisoned Pawn Variation, French Winawer',
  'rnbqkbnr/ppp2ppp/4p3/8/3PN3/8/PPP2PPP/R1BQKBNR': 'Frere; Becker; Katilimov, Maric Var, French',
  'rnbqkb1r/ppp2ppp/4pn2/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR': 'Vistaneckis (Nimzovich) Variation, French',
  'rnbqkb1r/ppp2ppp/4pn2/3p2B1/3PP3/2N5/PPP2PPP/R2QKBNR': 'Vistaneckis (Nimzovich) Variation, French',
  'rnbqk2r/ppp2ppp/4pn2/3p2B1/1b1PP3/2N5/PPP2PPP/R2QKBNR': 'Olland (Dutch) Variation, French',
  'rnbqk2r/ppp2ppp/4pn2/3pP1B1/1b1P4/2N5/PPP2PPP/R2QKBNR': 'Olland (Dutch) Variation, French',
  'rnbqk2r/ppp2pp1/4pn1p/3pP1B1/1b1P4/2N5/PPP2PPP/R2QKBNR': 'Olland (Dutch) Variation, French',
  'rnbqk2r/ppp2pp1/4pn1p/3pP3/1b1P4/2N5/PPPB1PPP/R2QKBNR': 'Tartakower Variation, French',
  'rnbqk2r/ppp1bppp/4pn2/3p2B1/3PP3/2N5/PPP2PPP/R2QKBNR': 'Vistaneckis (Nimzovich) Variation, French',
  'rnbqk2r/ppp1bppp/4pn2/3pP1B1/3P4/2N5/PPP2PPP/R2QKBNR': 'Vistaneckis (Nimzovich) Variation, French',
  'rnbqk2r/pppnbppp/4p3/3pP1B1/3P4/2N5/PPP2PPP/R2QKBNR': 'Chatard-Alekhine; Albin Attack, Fr',
  'rnbqk2r/pppnBppp/4p3/3pP3/3P4/2N5/PPP2PPP/R2QKBNR': 'Rubinstein Variation, French',
  'rnb1k2r/pppnqppp/4p3/3pP3/3P4/2N5/PPP2PPP/R2QKBNR': 'Rubinstein Variation, French',
  'rnbqk2r/pppnbppp/4p3/3pP1B1/3P3P/2N5/PPP2PP1/R2QKBNR': 'Albin-Chatard Gambit, French',
  'rnbqkb1r/ppp2ppp/4pn2/3pP3/3P4/2N5/PPP2PPP/R1BQKBNR': 'Brodsky-Jones Variation, French',
  'rnbqkb1r/pppn1ppp/4p3/3pP3/3P4/2N5/PPP2PPP/R1BQKBNR': 'Brodsky-Jones Variation, French',
  'rnbqkb1r/pppn1ppp/4p3/3pP3/3P1P2/2N5/PPP3PP/R1BQKBNR': 'Brodsky-Jones Variation, French',
  'rnbqkb1r/pp1n1ppp/4p3/2ppP3/3P1P2/2N5/PPP3PP/R1BQKBNR': 'Brodsky-Jones Variation, French',
  'rnbqkbnr/ppp2ppp/4p3/3p4/3PP3/8/PPPN1PPP/R1BQKBNR': 'Open System Tarrasch French; C07',
  'rnbqkbnr/pp3ppp/4p3/2pp4/3PP3/8/PPPN1PPP/R1BQKBNR': 'Shaposhnikov Gambit, French',
  'rnbqkbnr/pp3ppp/4p3/2pP4/3P4/8/PPPN1PPP/R1BQKBNR': 'Shaposhnikov Gambit, French',
  'rnbqkbnr/pppppp1p/8/6p1/4P3/8/PPPP1PPP/RNBQKBNR': 'Borg Defense; Troon Gambit',
  'rnbqkbnr/pppppp1p/8/6p1/3PP3/8/PPP2PPP/RNBQKBNR': 'Borg Defense; Troon Gambit',
  'rnbqkbnr/pppppp1p/6p1/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Two Knight Variation, Modern Defense',
  'rnbqkbnr/pppppp1p/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR': 'Two Knight Variation, Modern Defense',
  'rnbqk1nr/ppppppbp/6p1/8/3PP3/8/PPP2PPP/RNBQKBNR': 'Two Knight Variation, Modern Defense',
  'rnbqk1nr/ppppppbp/6p1/8/3PP3/2N5/PPP2PPP/R1BQKBNR': 'Two Knight Variation, Modern Defense',
  'rnbqk1nr/ppp1ppbp/3p2p1/8/3PP3/2N5/PPP2PPP/R1BQKBNR': 'Two Knight Variation, Modern Defense',
  'rnbqk1nr/ppp1ppbp/3p2p1/8/3PP3/2N2N2/PPP2PPP/R1BQKB1R': 'Suttles Variation, Modern Defense',
  'rnbqk1nr/ppppppbp/6p1/8/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Rossolimo Variation, Modern Defense',
  'rnbqk1nr/ppp1ppbp/3p2p1/8/3PP3/5N2/PPP2PPP/RNBQKB1R': 'Rossolimo Variation, Modern Defense',
  'r1bqkbnr/pppppppp/2n5/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Alekseev Variation, Nimzovich; Heinola-Deppe Gambit',
  'r1bqkbnr/pppppppp/2n5/8/3PP3/8/PPP2PPP/RNBQKBNR': 'Alekseev Variation, Nimzovich; Heinola-Deppe Gambit',
  'r1bqkbnr/ppp1pppp/2n5/3p4/3PP3/8/PPP2PPP/RNBQKBNR': 'Alekseev Variation, Nimzovich; Heinola-Deppe Gambit',
  'r1bqkbnr/ppp1pppp/2n5/3p4/3PP3/2N5/PPP2PPP/R1BQKBNR': 'Alekseev Variation, Nimzovich; Heinola-Deppe Gambit',
  'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/8/PPP2PPP/RNBQKBNR': 'Linksspringer Variation, Nimzovich Defense',
  'r1bqkbnr/pppp1ppp/2n5/4P3/4P3/8/PPP2PPP/RNBQKBNR': 'Bileefelder Gambit, Nimzovich Defense',
  'r1bqkbnr/pppp1ppp/8/4n3/4P3/8/PPP2PPP/RNBQKBNR': 'Riemann Defense, Nimzovich Defense',
  'r1bqkbnr/pppppppp/2n5/8/4P3/5N2/PPPP1PPP/RNBQKB1R': 'Colorado Counter Accepted, Nimzovich Defense',
  'rnbqkb1r/pppppppp/5n2/8/4P3/8/PPPP1PPP/RNBQKBNR': 'Hunt Gambit, Alekhine; Two Pawn Attack',
  'rnbqkb1r/pppppppp/5n2/4P3/8/8/PPPP1PPP/RNBQKBNR': 'Hunt Gambit, Alekhine; Two Pawn Attack',
  'rnbqkb1r/pppppppp/8/3nP3/8/8/PPPP1PPP/RNBQKBNR': 'Hunt Gambit, Alekhine; Two Pawn Attack',
  'rnbqkb1r/pppppppp/8/3nP3/2P5/8/PP1P1PPP/RNBQKBNR': 'Matsukevich Gambit, Alekhine',
  'rnbqkb1r/pppppppp/1n6/4P3/2P5/8/PP1P1PPP/RNBQKBNR': 'Matsukevich Gambit, Alekhine',
  'rnbqkb1r/pppppppp/8/3nP3/3P4/8/PPP2PPP/RNBQKBNR': 'Trifunovic Variation, Alekhine',
  'rnbqkb1r/ppp1pppp/3p4/3nP3/3P4/8/PPP2PPP/RNBQKBNR': 'Trifunovic Variation, Alekhine',
  'rnbqkb1r/ppp1pppp/3p4/3nP3/2PP4/8/PP3PPP/RNBQKBNR': 'Trifunovic Variation, Alekhine',
  'rnbqkb1r/ppp1pppp/1n1p4/4P3/2PP4/8/PP3PPP/RNBQKBNR': 'Trifunovic Variation, Alekhine',
  'rnbqkb1r/ppp1pppp/3p4/3nP3/3P4/5N2/PPP2PPP/RNBQKB1R': 'Alekhine Variation, Alekhine',
  'rn1qkb1r/ppp1pppp/3p4/3nP3/3P2b1/5N2/PPP2PPP/RNBQKB1R': 'Alekhine Variation, Alekhine',
  'rnbqkb1r/pppppppp/5n2/8/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Scandanavian Variation, Alekhine',
  'rnbqkb1r/ppp1pppp/5n2/3p4/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Spielmann Variation, Alekhine',
  'rnbqkbnr/pppppppp/8/8/5P2/8/PPPPP1PP/RNBQKBNR': 'Canard Formation; Double Duck',
  'rnbqkbnr/ppp1pppp/8/3p4/5P2/8/PPPPP1PP/RNBQKBNR': 'Prokofiev Gambit, Bird',
  'rnbqkbnr/ppppp1pp/8/5p2/5P2/8/PPPPP1PP/RNBQKBNR': 'Canard Formation; Double Duck',
  'rnbqkbnr/pppppppp/8/8/8/6P1/PPPPPP1P/RNBQKBNR': 'Lasker Simul Special',
  'rnbqkbnr/pppppppp/8/8/6P1/8/PPPPPP1P/RNBQKBNR': 'Romford Counter-Gambit, Grob',
  'rnbqkbnr/ppp1pppp/8/3p4/6P1/8/PPPPPP1P/RNBQKBNR': 'Romford Counter-Gambit, Grob',
  'rnbqkbnr/ppp1pppp/8/3p4/6P1/8/PPPPPPBP/RNBQK1NR': 'Romford Counter-Gambit, Grob',
  'rnbqkbnr/pppppppp/8/8/8/2N5/PPPPPPPP/R1BQKBNR': 'Novosibirsk Variation, Dunst',
  'rnbqkbnr/ppp1pppp/8/3p4/8/2N5/PPPPPPPP/R1BQKBNR': 'Pseudo-Diemer Gambit, Dunst',
  'rnbqkbnr/ppp1pppp/8/3p4/4P3/2N5/PPPP1PPP/R1BQKBNR': 'Pseudo-Diemer Gambit, Dunst',
  'rnbqkbnr/ppp1pppp/8/8/4p3/2N5/PPPP1PPP/R1BQKBNR': 'Pseudo-Diemer Gambit, Dunst',
  'rnbqkbnr/pppp1ppp/8/4p3/8/2N5/PPPPPPPP/R1BQKBNR': 'Irish Attack; Polish Attack',
  'rnbqkbnr/pppppppp/8/8/8/5N2/PPPPPPPP/RNBQKB1R': 'King\'s Indian Attack; Reti; Zukertort; A05',
  'rnbqkbnr/ppp1pppp/8/3p4/2P5/5N2/PP1PPPPP/RNBQKB1R': 'Benoni Reversed; Wing Blumenfeld',
  'rnbqkbnr/ppppp1pp/8/5p2/8/5N2/PPPPPPPP/RNBQKB1R': 'Polish G; Dalesio G; Pirc-Lisitsin G',
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
    if (this.openingPhase && this.moveCount <= 40 && this.settings.mode !== 'rage') {
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
      this.eloMove = moves[0];
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
  // Reset opening phase when a new game starts (rematch without navigation)
  if (instance && instance.moveCount > 0) {
    const fen = instance.boardReader.buildFen();
    const isStartPos = fen && fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR');
    if (isStartPos && instance.lastFen && !instance.lastFen.startsWith('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR')) {
      instance.moveCount   = 0;
      instance.openingPhase = true;
      instance.lastFen     = null;
    }
  }
}, 1000);
