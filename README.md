# ChessX — Chess.com Analysis Overlay

Chrome extension (MV3) — Stockfish analysis overlay for chess.com.

## Kurulum

### 1. Stockfish dosyaları (zaten dahil)
`stockfish.js` ve `stockfish.wasm` repo'da mevcut (nmrugg/stockfish.js v19 lite-single build).

### 2. Chrome'a yükle
1. `chrome://extensions/` aç
2. **Developer mode** → ON
3. **Load unpacked** → bu klasörü seç

## Özellikler

| Özellik | Detay |
|---|---|
| **Legit modu** | Oyun başına 2–3 intentional blunder, ELO'ya göre ağırlıklı hamle seçimi |
| **Semi modu** | Dengeli — en iyi hamleye hafif ağırlık |
| **Rage modu** | Hep en iyi hamle, minimum bekleme süresi gösterimi |
| **Manual modu** | 3 hamleyi göster, öneri yok |
| **Renk tespiti** | Otomatik, veya popup'tan manuel seçim |
| **ELO ağırlığı** | Rakip rating'ine göre hamle1/hamle2/hamle3 dağılımı |
| **Log-normal timing** | Açılış hızlı, mid-game log-normal, zaman baskısında kısalır |
| **Kalan süre** | chess.com saatinden ms cinsinden okur |
| **SVG overlay** | Tahta üzerinde renkli oklar (yeşil=1., sarı=2., turuncu=3., kırmızı=blunder) |

## ELO Ağırlık Tablosu (Legit modu)

| Rakip ELO | Hamle 1 | Hamle 2 | Hamle 3 |
|---|---|---|---|
| < 800 | 40% | 35% | 25% |
| 800–1200 | 55% | 30% | 15% |
| 1200–1600 | 65% | 25% | 10% |
| 1600–2000 | 75% | 20% | 5% |
| 2000+ | 85% | 12% | 3% |

## Dosya Yapısı

```
chessx/
├── manifest.json         MV3 manifest
├── background.js         Service worker (settings storage)
├── content.js            Ana logic — board reader, overlay, engine wrapper
├── stockfish.js          Stockfish 19 lite-single JS loader
├── stockfish.wasm        Stockfish 19 lite-single WASM engine (~1.8MB)
├── popup.html            Ayarlar UI
├── popup.js              Popup logic
└── icons/                Extension icons
```
