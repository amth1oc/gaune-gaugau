# Gaune – Gâu Gâu

> **Buồn bực thì sủa lên!** Game web đối kháng bằng giọng nói: sủa vào micro để đẩy lùi đối thủ trên thanh kéo co. Chơi với bot hoặc đấu online 2 người. Không cần cài đặt, không tài khoản, không quảng cáo.

- Bản hiện tại: **v23** (27/10/2026) · Service worker `v35-2026-10-27` · Giao thức online `PROTOCOL_VERSION = 3`
- Công nghệ: HTML + CSS + **JavaScript ES Modules thuần** (không framework, không bundler cho JS, không `package.json`), Canvas 2D, Web Audio API, WebRTC (PeerJS), Netlify (hosting + 1 Function).
- Quy mô: ~8.100 dòng JS (không tính `vendor/`), ~184 file.
- Ngôn ngữ giao diện: Tiếng Việt / English · Giao diện sáng (hoàng hôn) / tối (ban đêm) · Cài được như PWA.

---

## Mục lục

1. [Cách chơi](#1-cách-chơi)
2. [Chạy trên máy](#2-chạy-trên-máy)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Kiến trúc tổng quan](#4-kiến-trúc-tổng-quan)
5. [Cơ chế game](#5-cơ-chế-game)
6. [Chế độ online](#6-chế-độ-online)
7. [Dữ liệu lưu trên máy](#7-dữ-liệu-lưu-trên-máy)
8. [Hệ thống assets](#8-hệ-thống-assets)
9. [Giao diện, ngôn ngữ, hiệu năng](#9-giao-diện-ngôn-ngữ-hiệu-năng)
10. [PWA, cache và bảo mật HTTP](#10-pwa-cache-và-bảo-mật-http)
11. [Triển khai lên Netlify](#11-triển-khai-lên-netlify)
12. [Quy trình sau khi sửa code / assets](#12-quy-trình-sau-khi-sửa-code--assets)
13. [Ghi công & pháp lý](#13-ghi-công--pháp-lý)

---

## 1. Cách chơi

- Mỗi trận **30 giây**, đếm ngược 3‑2‑1 rồi "SỦA ĐI!".
- **Thanh kéo co (gauge)** bắt đầu ở 50%. Bạn sủa → thanh chạy về phía đối thủ; đối thủ sủa → chạy ngược lại. Không ai sủa thì thanh tự trôi dần về giữa.
- **ĐO VÁN (KO)**: thanh chạm 0% (bạn thắng) hoặc 100% (đối thủ thắng). Con thua bị hất bay khỏi màn hình.
- **Hết giờ**: bên đang dẫn thắng. Gauge nằm trong vùng 48–52% là "hoà":
  - đấu bot → **người chơi thắng**;
  - đấu online → host xét ai nhích hơn, bằng nhau thì ai sủa nhiều hơn, vẫn bằng thì tung đồng xu (không để host thắng mặc định).
- **Sủa liên tục → combo** (hệ số nhân lực). **Sủa to → đẩy mạnh.** Thế trận thay đổi cỡ chó (thắng thế phình to, thua teo lại) và màu màn hình (ngả cam đỏ khi bạn dẫn).
- **Không có micro / từ chối quyền?** Dùng nút **"SỦA!"** trên màn hình (chạm/bấm).
- Thắng trận → nhận **GP (Gâu Point)** để mở khoá nhân vật và bối cảnh, thắng bot để mở **cấp bot** cao hơn.

Các màn hình: Onboarding (lần đầu) → Menu → Chọn nhân vật (+ bối cảnh + cấp bot) → Trận → Kết quả. Ngoài ra: Online, Xếp hạng, Cài đặt.

---

## 2. Chạy trên máy

Game cần **secure context** để dùng micro: chạy qua `https://` hoặc `http://localhost`. Mở thẳng `index.html` bằng `file://` sẽ không chạy được ES Modules đúng cách.

```bash
# Chọn một cách bất kỳ, chạy trong thư mục gaune/
python3 -m http.server 8000        # rồi mở http://localhost:8000
npx serve .                        # hoặc VS Code "Live Server"
npx netlify dev                    # chạy được cả hàm /api/turn (cần biến môi trường, xem mục 11)
```

Lưu ý khi thử trên điện thoại: mở bằng `http://192.168.x.x:...` (IP mạng LAN) **không phải secure context** → micro bị chặn (game báo "InsecureContext"). Dùng tunnel https (ngrok, Cloudflare Tunnel…) hoặc deploy Netlify rồi thử.

Hành vi riêng khi chạy `localhost`/IP LAN/`file://` (xem `js/main.js`):
- **Service worker tắt** (thêm `?sw=1` vào URL để thử).
- **Tự nạp lại khi bạn thả ảnh/âm thanh mới** vào `assets/` rồi quay lại cửa sổ game.

Công cụ build (chỉ cần Node.js, không cần `npm install`): xem [mục 12](#12-quy-trình-sau-khi-sửa-code--assets).

---

## 3. Cấu trúc thư mục

```
gaune/
├── index.html                 Toàn bộ DOM các màn hình + meta SEO/OG/JSON-LD + khối modulepreload (tự sinh)
├── manifest.webmanifest       PWA (tên, icon, màu)
├── sw.js                      Service worker (cache, offline)
├── _headers                   Netlify: CSP, HSTS, cache, Permissions-Policy (mic)
├── netlify.toml               Cấu hình khi deploy bằng Git/CLI (publish=".", functions)
├── netlify/functions/turn.mjs Hàm /api/turn: cấp credential TURN tạm thời 3 giờ
├── robots.txt, sitemap.xml    SEO (đang trỏ game-cho-sua.netlify.app)
├── privacy.html, terms.html   Trang pháp lý (còn chỗ trống phải điền, xem mục 14)
├── CREDITS.md                 Ghi công hình ảnh/âm thanh/thư viện
├── CHANGES.md                 Nhật ký thay đổi chi tiết (v3 → v23)
├── HUONG-DAN-NETLIFY.md       Hướng dẫn deploy + cấu hình TURN
├── cap-nhat-assets.bat        Windows: quét assets + sinh modulepreload
│
├── js/
│   ├── main.js                Điểm vào: khởi tạo, đăng ký màn hình, Xếp hạng, Cài đặt, service worker
│   ├── boot-prefs.js          Đặt ngôn ngữ + sáng/tối TRƯỚC khi vẽ (chống chớp)
│   ├── font-loader.js         Nạp Google Fonts không chặn hiển thị (tương thích CSP)
│   ├── core/                  EventBus, ScreenManager, SaveManager, AssetLoader, I18n, Theme,
│   │                          Toggles, Perf (+WakeLock), Popup
│   ├── data/                  config.js (mọi hằng số), characters.js, stages.js
│   ├── game/                  BattleManager (điều phối), GaugeController, ComboSystem, CharStats,
│   │                          AIOpponent, DogCharacter
│   ├── audio/                 MicrophoneManager, BarkDetector, MicNormalizer, MicTest, SoundManager
│   ├── net/                   NetSession (PeerJS/WebRTC), net-config.js (TURN, giấu IP, timeout)
│   ├── screens/               Menu, CharacterSelect, Battle, Result, OnlineLobby, Onboarding
│   ├── rendering/             DogRenderer, SceneRenderer (cảnh bãi biển vẽ bằng code)
│   ├── effects/               BarkTextEffect, ParticleSystem, ScreenShake, MenuHero
│   └── vendor/                peerjs.min.js (MIT) + PEERJS-LICENSE.txt
│
├── css/
│   ├── bundle.css             SINH TỰ ĐỘNG từ 16 file nguồn (đừng sửa tay)
│   ├── identity.css           Màu nhận diện + popup; nạp RIÊNG sau bundle (không nằm trong bundle)
│   ├── main.css, theme.css, cartoon.css, ui-polish.css, responsive.css, modes.css, lite.css
│   ├── components/            gauge.css, effects.css
│   └── screens/               menu, character-select, battle, result, online, online-v2, onboarding
│
├── assets/                    Ảnh/âm thanh — thả file vào là game tự nhận (xem mục 8)
│   ├── characters/<id>/       idle.webp, bark.webp, icon.webp (9 chó có ảnh; chow trống)
│   ├── backgrounds/           6 ảnh nền .webp (1280px)
│   ├── theme/                 night-backyard(.sm).webp (nền chế độ tối) + thumbs/ (320px)
│   ├── audio/                 bark-1..5, aibark-1..5, music-menu/battle, countdown-tick/go
│   ├── ui/                    (trống; logo/nền menu tuỳ chọn)
│   ├── manifest.json          Tinh chỉnh tuỳ chọn (scale, offsetY, groundY…)
│   └── files.json             Danh sách file (SINH TỰ ĐỘNG bằng tools/scan-assets.mjs)
│
├── icons/                     favicon, icon PWA (192/512/maskable), apple-touch-icon, og-gaune-v3.jpg
└── tools/                     scan-assets.mjs, gen-preload.mjs, build-css.mjs,
                               tao-icon-og.py, tao-og-tu-anh.py, tao-am-thanh.py
```

---

## 4. Kiến trúc tổng quan

### Luồng khởi động (`js/main.js`)
1. `index.html` nạp `css/bundle.css` + `css/identity.css`, `modulepreload` toàn bộ JS để tải song song, và chạy `boot-prefs.js` đồng bộ để đặt ngôn ngữ/giao diện trước lần vẽ đầu.
2. `I18n.init()`, `Theme.init()`.
3. `Assets.load()` (ảnh nhân vật + UI chờ; ảnh nền và âm thanh **tải nền**), tối đa chờ **6 giây**.
4. Tạo `EventBus`, `ScreenManager`, `SoundManager`; tạo `OnlineLobbyScreen` **trước** để trận/kết quả dùng chung phiên mạng.
5. Đăng ký 8 màn hình: `menu`, `character-select`, `battle`, `result`, `online`, `onboarding`, `rankings`, `settings`.
6. Vào `onboarding` nếu chưa từng chơi (và không có `?room=`), ngược lại vào `menu`. Có `?room=MÃ` → `onlineScreen.autoJoin(mã)`.
7. Đăng ký service worker (chỉ trên https thật) và gửi danh sách file đã tải để cache.

### Mô hình giao tiếp
- **`EventBus`** (pub/sub) nối game logic ↔ UI/âm thanh. Sự kiện chính: `battle:countdown`, `battle:start`, `player:bark`, `player:combo`, `ai:bark` (cũng dùng cho đối thủ online), `battle:end`, `online:rematch`, `online:closed`.
- **`ScreenManager`** hiện/ẩn màn hình theo tên, có hook `onChange` (dùng để đổi nhạc nền: màn trận/kết quả im, còn lại nhạc menu).
- **Nhạc**: im trong lúc đếm ngược để nghe rõ tiếng bíp; vào nhạc trận (×0.6 âm lượng để mic ít nghe lẫn) ngay khi "SỦA ĐI!"; im khi trận kết thúc để nghe KO/thắng/thua.

### `BattleManager` – 3 chế độ
| `mode` | Vai trò |
|---|---|
| `ai` | Đấu bot. Máy này tính tất cả. |
| `host` | Online, **trọng tài**: tính lực, gauge, đồng hồ, kết quả; gửi trạng thái cho guest mỗi 100 ms. |
| `guest` | Online: gửi tiếng sủa cho host, **dự đoán** cục bộ để mượt rồi đối chiếu (`_reconcile`) theo số của host. |

Máy trạng thái: `idle → countdown → fighting → ended`. Lý do kết thúc: `ko`, `timeout`, `forfeit` (đối thủ chủ động thoát), `disconnect` (đứt mạng — **không ai thắng/thua**).

Gauge luôn tính theo góc nhìn **máy đang chơi**: `0` = bạn thắng, `100` = đối thủ thắng (guest đảo lại `100 − g`).

---

## 5. Cơ chế game

Mọi hằng số nằm trong **`js/data/config.js`** (trừ khi ghi chú khác).

### 5.1 Từ micro đến tiếng sủa

```
getUserMedia → AnalyserNode (FFT 4096, ~85 ms) → getRMS(dt) [quét cả đoạn mới, lấy đỉnh]
   → BarkDetector (timer riêng 10 ms, không phụ thuộc FPS)
   → MicNormalizer.scale() → BattleManager.onPlayerBark(volume)
```

- Micro mở với `echoCancellation: true` (tiếng loa game không tự kích hoạt), `noiseSuppression: false`, `autoGainControl: false`.
- **Ngưỡng nhạy (Cài đặt, mức 1–10, mặc định 5)**: `threshold = 0.02 + (mức − 1) × 0.014` → mức 5 = **0.076**, mức 10 = 0.146; `release = 0.35 × threshold`. (`CONFIG.MIC.THRESHOLD/RELEASE` chỉ là giá trị khởi tạo, bị ghi đè bởi mức này.)
- **`BarkDetector`** – 3 trạng thái `idle → detecting → cooldown`:
  - Tính tiếng sủa **ngay khi vượt ngưỡng** (đo đỉnh trong `ONSET_PEAK_MS = 20 ms`), không chờ sủa xong → chó sủa cùng lúc với người.
  - **Sủa dồn**: nhận tiếng mới khi âm lượng tụt xuống một "đáy" (≤ 0.75×ngưỡng hoặc ≤ 60% đỉnh trước, cách tiếng trước ≥ 60 ms) rồi vọt lại ≥ 80% đỉnh trước.
  - **Cộng bù đỉnh thật** (`TOPUP`): trong 70 ms sau khi bắn, nếu đỉnh thật to hơn ≥ 1.2× lúc bắn thì cộng thêm phần lực chênh (không tăng combo, không phát thêm tiếng).
  - Chống nhiễu: nghỉ 60 ms sau mỗi tiếng; tiếng kéo dài > 800 ms bị ép kết thúc. **Chỉ số `speed` của chó không chặn mic** — 1 tiếng sủa thật = 1 tiếng sủa trong game.
- **`MicNormalizer`**: quy mic máy nào cũng về cùng thang (mic nhạy không mạnh hơn). Lấy phân vị 85 của 40 tiếng sủa gần nhất làm mốc `ref`, `volume = clamp(raw / ref × 0.35, 0.03, 0.8)`. Lưu mốc ở `chosua_mic_ref` giữa các trận; bước chuẩn hoá lúc onboarding đặt mốc ban đầu.
- **Nút "SỦA!" (tap)**: mỗi lần bấm = 1 tiếng ngay (chống nhận đôi 70 ms), âm lượng giả lập 0.12–0.30; bấm dồn nhanh hơn 280 ms/lần thì mỗi lần yếu dần (tối thiểu ×0.35) để không áp đảo người dùng mic.

### 5.2 Công thức lực đẩy (`GaugeController._calcForce`)

```
baseForce = volume × PUSH_BASE(9) × powerMult × specialMult × tempoMult
comboForce = baseForce × comboMult
loud       = clamp(volume / 0.25, 0.25, 1.5)
barkBonus  = (min(comboCount, 5) − 1) × 1.0 × loud
force      = comboForce + barkBonus          → trừ/cộng vào gauge
```

| Thành phần | Giá trị thực trong code |
|---|---|
| `powerMult` | `1 + (power − 3) × 0.05` → **×0.90 (power 1) … ×1.10 (power 5)** |
| `tempoMult` | `1 + 0.08 × (speed−1)/4 × closeness`; `closeness` = 1 khi 2 tiếng cách ≤ 300 ms, giảm về 0 tại 600 ms → **tối đa +8%** (speed 5) |
| `comboMult` | `1 + (count − 1) × 0.20`, **trần ×2.0** (đạt ở combo 6); combo bắt đầu tính từ tiếng thứ 2 |
| Cửa sổ giữ combo | `2000 ms (combo 1) … 2500 ms (combo 5)`; Corgi nhân thêm ×1.25 |
| Special Pug `heavyHitter` | ×1.08 lực khi combo < 2 |
| Special Chow `volumeBoost` | volume ×1.05 (trần 1) |
| Special Corgi `fastCombo` | cửa sổ combo ×1.25 |
| Trôi về giữa | `value += (50 − value) × 0.4 × dt` (lò xo: lệch càng xa càng bị kéo mạnh) |

Ví dụ: Shiba, `volume` chuẩn hoá 0.35, combo 1 → lực ≈ `0.35 × 9 = 3.15` đơn vị gauge/tiếng. Chênh lệch giữa các chó được cố ý giữ nhỏ (≲ 8–10%): kỹ năng người chơi quan trọng hơn chọn chó.

### 5.3 Nhân vật (`js/data/characters.js`)

| id | Tên | Power / Speed / Combo | Giá (GP) | Special | Ghi chú |
|---|---|:---:|---:|---|---|
| `shiba` | Shiba Inu | 3 / 3 / 3 | 0 | — | Mở sẵn |
| `golden` | Golden Retriever | 4 / 3 / 3 | 0 | — | Mở sẵn |
| `husky` | Husky | 3 / 3 / 4 | 150 | — | |
| `poodle` | Poodle Bông | 2 / 5 / 4 | 150 | — | |
| `pug` | Pug Chiến | 5 / 1 / 2 | 200 | heavyHitter | |
| `corgi` | Corgi Flash | 2 / 5 / 5 | 200 | fastCombo | |
| `beagle` | Beagle | 3 / 4 / 4 | 200 | — | |
| `labrador` | Labrador Đen | 5 / 2 / 3 | 250 | — | |
| `malamute` | Alaskan Malamute | 4 / 2 / 4 | 400 | — | |
| `chow` | Chow Chow Boss | 4 / 2 / 3 | 500 | volumeBoost | **Chưa có ảnh → bị ẩn** (xem mục 14) |

Tổng chi để mở hết 7 chó có giá: **1.550 GP**. Mỗi chó có bộ chữ sủa riêng (`barkWords`) và màu chữ. `speed` chỉ còn tác dụng: (1) thưởng nhịp nhanh, (2) thời gian nghỉ của **nút chạm** (400→300 ms) và nhịp sủa của **bot**. `combo` chỉ ảnh hưởng cửa sổ giữ combo (bước nhân 0.20 là hằng số cho mọi chó).

### 5.4 Bối cảnh (`js/data/stages.js`)
`beach` (Bãi Biển, vẽ bằng code), `village`, `valley`, `street` đều mở sẵn; `temple` (Đền Cổ) 300 GP. Ngoài ra mọi ảnh lạ thả vào `assets/backgrounds/` tự thành bối cảnh mới. Ảnh nền ánh xạ vào bối cảnh theo **từ khoá trong tên file** (xem [mục 8](#8-hệ-thống-assets)). Trong màn chọn có ô "Ngẫu nhiên".

### 5.5 Bot và cấp bot
- Bot **sủa theo đợt** (vài tiếng dồn rồi nghỉ), có **combo thật**, **đuổi theo** khi đang bị dẫn, và thỉnh thoảng một tiếng rất to (×1.45). Độ khó nội bộ `1.0 → 5.0`, mọi thông số trong `CONFIG.AI`:

| Thông số | Độ khó 1 | Độ khó 5 |
|---|---:|---:|
| Nhịp giữa 2 tiếng trong đợt | 480 ms | 270 ms |
| Nghỉ giữa 2 đợt | 1250 ms | 600 ms |
| Số tiếng mỗi đợt | 1–2 | 3–6 |
| Âm lượng trung bình | 0.20 | 0.34 |
| Cửa sổ combo (so với nhân vật) | ×0.45 | ×1.0 |

  Các số ms còn nhân với `barkCooldownMs(chó của bot) / 350` (Corgi sủa dồn hơn, Pug chậm hơn). Bot chọn ngẫu nhiên một chó **đã mở khoá** khác chó của bạn.
- **5 cấp bot**: Tập sự → Thường → Khó → Siêu khó → Boss (`tier.1..5` trong I18n). Độ khó thật = `cấp + botInner`.
  - Thắng **3 trận ở cấp cao nhất đã mở** → mở cấp kế tiếp, **+200 GP** một lần. Đánh lại cấp thấp không tính tiến độ.
  - Trong một cấp: thắng `+0.15`, thua `−0.05` (trần +0.9); đổi cấp thì về đầu cấp. Chỉ áp dụng khi đấu bot.
  - Bản lưu cũ chỉ có `difficulty` (vd 2.8) tự đổi sang cấp 2 + 0.8.

### 5.6 GP và phần thưởng

| Tình huống | GP |
|---|---:|
| Thắng KO | 150 |
| Thắng hết giờ (kể cả đối thủ bỏ cuộc `forfeit`) | 75 |
| Thua KO | 20 |
| Thua hết giờ | 35 |
| Đứt mạng (`disconnect`) | 0, không ghi lịch sử |
| Nhân khi thắng bot theo cấp 1..5 | ×1 / 1.2 / 1.4 / 1.7 / 2.0 (online không áp dụng) |
| Mở cấp bot mới | +200 một lần |

Lịch sử giữ 50 trận gần nhất, màn Xếp hạng hiện 20 trận + tổng thắng/thua/GP. Trận online vẫn nhận GP nhưng **không** đổi độ khó/cấp bot.

### 5.7 Hiệu ứng
Chó phình/teo theo thế trận (`DOM_GROW 0.75`, `DOM_SHRINK 0.5`), màn hình ngả cam đỏ khi dẫn (`TINT_WARM_MAX 0.65`) hoặc xanh xám khi bị lép, chữ sủa nhiều kiểu (trần 80 chữ cùng lúc), hạt (trần 220), rung màn hình, hất bay khi KO. Chế độ Tiết kiệm giảm số chữ/hạt còn 40%.

---

## 6. Chế độ online

### 6.1 Luồng
1. **Host** bấm *Tạo phòng* → nhận **mã 5 ký tự** (bảng chữ bỏ `O/0/I/1`, sinh bằng `crypto.getRandomValues`) hoặc link mời `?room=MÃ`. ID trên máy chủ ghép phòng là `gaugau-<MÃ>`.
2. **Guest** nhập mã (hoặc mở link). Dán cả đoạn lời mời vào ô mã vẫn tự lấy đúng mã.
3. Hai bên chọn chiến binh → cùng bấm **SẴN SÀNG** → host gửi `start` → vào trận. Sau trận có **Đấu lại**; phiên kết nối được giữ qua trận và màn kết quả.
4. Trình duyệt nhúng trong app (Zalo, Messenger, Facebook, Instagram, TikTok, Line, Telegram) hay chặn mic/WebRTC → game nhận diện và gợi ý mở bằng Safari/Chrome.

### 6.2 Kiến trúc mạng
- **PeerJS/WebRTC**. Máy chủ ghép phòng mặc định là máy chủ công cộng `0.peerjs.com` (`PEER_SERVER: null`); sau bắt tay, dữ liệu đi thẳng máy–máy hoặc qua TURN.
- **Host-authoritative**: host tính toàn bộ; guest gửi tiếng sủa, nhận số liệu.
- Mọi tin nhắn là JSON có trường `t`:

| `t` | Hướng | Ý nghĩa |
|---|---|---|
| `pick`, `ready`, `start`, `rematch` | sảnh | chọn chó (kèm kiểm tra `PROTOCOL_VERSION`), sẵn sàng, bắt đầu, đấu lại |
| `rdy` | guest→host | guest đã dựng xong trận (gửi 400 ms/lần tới khi host đếm ngược) |
| `cd` | host→guest | đếm ngược (`3,2,1,'GO!',null`) |
| `st` | host→guest | trạng thái mỗi 100 ms: `g` gauge, `tl` thời gian còn, `hc`/`gc` combo |
| `bk` | cả hai | tiếng sủa (`s:'h'` host sủa, `s:'g'` xác nhận của host cho guest, không `s` = guest sủa) |
| `bb` | guest→host | cộng bù đỉnh thật của tiếng sủa |
| `end` | host→guest | kết quả (`w`, `r`, `g`) |
| `quit` | cả hai | chủ động thoát (xử lý ngay ở mọi màn) |
| `__close`, `__error` | nội bộ | đứt kết nối / lỗi (không đi qua mạng) |

> **Đổi định dạng tin nhắn ⇒ tăng `PROTOCOL_VERSION`** trong `js/net/net-config.js`. Hai máy lệch số sẽ báo lỗi thay vì chơi lệch.

### 6.3 Công bằng và chống gian lận
- Host chỉ nhận tiếng sủa của guest theo **xô token** (16 tiếng/giây, dồn tối đa 4); tiếng bị bỏ vẫn được báo về để guest gỡ lực dự đoán (hết giật lùi).
- Tin `bb` chỉ được **1 lần cho mỗi tiếng sủa đã duyệt, trong 250 ms**.
- Âm lượng từ mạng bị ép ≤ `0.8`; số `g, tl, hc, c`, giá trị đếm ngược, người thắng đều được kiểm tra/ép khoảng; sảnh chỉ nhận `start` từ host với nhân vật hợp lệ.
- **Bù trễ**: host tự làm chậm lực đẩy gauge của mình `min(80 ms, ping/2)`; hết giờ host chờ thêm `min(200 ms, ping)` để tiếng sủa cuối của guest kịp tới.

### 6.4 Độ bền kết nối
- Nhịp tim: ping mỗi **1,5 s**; không nhận tin quá **7 s** (trong trận) / **12 s** (ở sảnh) → coi là đứt.
- Guest tự kết thúc "mất kết nối" nếu đang đánh mà không nhận `st` của host quá **6 s** (tính theo `dt` khung hình, nên tự bị ẩn rồi quay lại không báo nhầm); guest chờ host bắt đầu tối đa **35 s**, host chờ guest tối đa **30 s**.
- Host rời app đi gửi link vẫn **giữ được phòng** nếu quay lại kịp (kiểm tra socket ghép phòng khi quay lại/có mạng/focus; guest thử lại tới ~18 s).
- Chỉ khi đối thủ **chủ động** thoát (`quit`) bạn mới thắng; mất kết nối thì không ai được tính.
- Màn hình giữ sáng (Wake Lock) ở sảnh, trận và kết quả online.

### 6.5 Riêng tư và TURN
- **Chế độ riêng tư (giấu IP) mặc định BẬT** (`HIDE_IP_DEFAULT`, đổi ở Cài đặt → Riêng tư hoặc ngay sảnh; lưu ở `gaune_hide_ip`). Bật: bỏ toàn bộ STUN, đặt `iceTransportPolicy: 'relay'`; **không còn TURN thì kết nối thất bại chứ không tự quay về kết nối thẳng**. Mỗi người chỉ giấu IP của chính mình.
- Credential TURN **không nằm trong JS** (file công khai). Trình duyệt gọi `GET /api/turn` → `netlify/functions/turn.mjs` gọi Metered bằng `METERED_SECRET_KEY` (chỉ có ở biến môi trường Netlify) và trả username/password **sống 3 giờ**. Hàm dùng lại cùng credential tối đa 30 phút, chặn origin lạ, `Cache-Control: no-store`.
- Trình duyệt dùng chung **một** yêu cầu `/api/turn` đang chạy (prefetch / Kiểm tra lại / Tạo-Vào phòng), chờ 7 s + thử lại 1 lần (không thử lại với 403/404/405/503); thử relay thất bại bằng key Metered thì bỏ key đã nhớ để xin key mới.
- Có TURN công cộng `openrelayproject` làm **dự phòng** (xem mục 14 về hệ quả riêng tư).
- Trước lần online đầu tiên có **hộp đồng ý** (`gaune_online_consent_v1`).

---

## 7. Dữ liệu lưu trên máy

Toàn bộ nằm trong `localStorage` của trình duyệt; **không có server lưu dữ liệu người chơi**.

| Khoá | Nội dung |
|---|---|
| `cho-sua-fighter-v1` | Bản lưu chính: GP, chó/bối cảnh đã mở, thắng/thua/chuỗi thắng, `botTier`/`botMaxTier`/`botTierWins`/`botInner`, `difficulty` (tương thích cũ), 50 trận gần nhất, cài đặt (`thresholdLevel`, `sfxVolume`, `musicVolume`, `muted`) |
| `chosua_onboarded` | Đã qua màn chào |
| `chosua_mic_ref` | Mốc chuẩn hoá mic |
| `chosua_lang` / `chosua_theme` | Ngôn ngữ (`vi`/`en`) / giao diện (`day`/`night`) |
| `chosua_perf_mode` / `chosua_perf_auto` | Chế độ hiệu năng / kết quả đo FPS (chỉ nhớ 7 ngày) |
| `chosua_online_char` | Chiến binh đã chọn ở sảnh online |
| `gaune_hide_ip` | Công tắc giấu IP |
| `gaune_online_consent_v1` | Đã đồng ý điều kiện chơi online |

Các khoá/biến vẫn mang tên cũ (`cho-sua-fighter`, `chosua_*`, `WP`) **có chủ đích** để người chơi cũ không mất tiến độ sau các lần đổi tên game/đơn vị. Dữ liệu hỏng/thiếu được chuẩn hoá về mặc định khi nạp. *Cài đặt → Xoá dữ liệu* xoá bản lưu chính, mốc mic và cờ onboarding.

---

## 8. Hệ thống assets

Game **quét `assets/` và tự đoán công dụng theo tên file**, không cần sửa code. Chi tiết đầy đủ ở `assets/README.md`; tóm tắt:

- **Nhân vật**: thư mục `assets/characters/<id>/` chứa `idle`, `bark` (tuỳ chọn `damage`, `ko`, `icon`), PNG/WebP nền trong suốt, **chân sát mép dưới, quay mặt sang phải**. Tên thư mục lạ → tự thành nhân vật mới (chỉ số ngẫu nhiên 2–4). Chỉnh `scale`, `offsetY`, `facing` trong `assets/manifest.json` (hiện mọi chó `scale: 1.15`).
- **Bối cảnh**: ảnh trong `assets/backgrounds/`, ghép với bối cảnh có sẵn theo từ khoá (token) trong tên file (`STAGE_HINTS` trong `AssetLoader.js`: *village/vietnam/…*, *valley/water/lake/…*, *street/plaza/town/cafe/…*, *beach/sea/…*, *temple/pagoda/…*); không khớp → bối cảnh mới. Ô chọn dùng ảnh thu nhỏ cùng tên trong `assets/theme/thumbs/` (320px) để nhẹ RAM.
- **Âm thanh**: tên chứa `bark` (của ta), `aibark` (của địch), `tick`/`count` (bíp), `go`, `menu`, `battle`, `combo`, `ko`, `win`, `lose`, `click`. Nhiều file cùng loại → chọn ngẫu nhiên. Thiếu file sủa/bíp → dùng tiếng tổng hợp; thiếu nhạc → im lặng.
- **`assets/theme/`** (nền chế độ tối) **không** bị quét thành bối cảnh; chỉ tải khi bật chế độ tối lần đầu.
- **Đã có ảnh thật thì ẩn nhân vật/bối cảnh không có ảnh** (trừ khi `manifest.json → settings.keepCodeDrawn = true`).
- **Trên Netlify/GitHub Pages** (không liệt kê được thư mục) phải chạy `node tools/scan-assets.mjs` để sinh `assets/files.json` mỗi khi thêm/xoá file.
- Thay ảnh/âm thanh **cùng tên**: người chơi cũ thấy bản mới ở lần mở sau (service worker kiểm tra nền).

---

## 9. Giao diện, ngôn ngữ, hiệu năng

- **I18n** (`js/core/I18n.js`): bảng chuỗi dạng `'khoá': ['Tiếng Việt', 'English']`; HTML dùng `data-i18n`. Lần đầu: trình duyệt tiếng Việt → VI, còn lại → EN. Đổi ngôn ngữ giữa chừng vẫn đúng; **không ảnh hưởng online** (tin nhắn mạng chỉ dùng id nhân vật/bối cảnh). Thêm chữ mới = thêm một dòng.
- **Sáng/Tối** (`Theme.js`, `css/modes.css`): `<html data-theme="day|night">`, chuyển bằng mờ dần (chỉ opacity); `boot-prefs.js` đặt trước khi vẽ nên không chớp.
- **Hiệu năng** (`Perf.js`): hai mức `high` (≤ 60 fps, DPR ≤ 1.75) và `lite` (30 fps, DPR 1, tắt kính mờ, tắt hoạt ảnh lặp, bớt chữ/hạt). Cài đặt: *Tự động* (mặc định) / *Tiết kiệm* / *Đẹp nhất*. Tự động: đoán theo `deviceMemory ≤ 3`, `hardwareConcurrency ≤ 2` (hoặc ≤ 4 trên Android), `saveData`, `prefers-reduced-motion`; rồi **đo FPS thật** trong trận (bỏ 1,5 s đầu, 2 đợt × 2,5 s, chỉ hạ mức khi cả hai đợt < 38 fps) và nhớ 7 ngày.
- **Thông báo** (`Popup.js`): hộp thoại giữa màn hình có nút "Đã hiểu" cho sự cố online; bong bóng nổi cho thông tin nhẹ.
- **Âm thanh trên iOS** (`SoundManager`): xử lý ngắt phiên (cuộc gọi, chuyển app), dựng lại `AudioContext` khi quay lại, nhả phiên âm thanh khi trang ẩn (hết "nhạc ma"), nhắc "Chạm màn hình để bật lại âm thanh".
- **Trợ năng**: cho phép zoom, viền focus bàn phím, tôn trọng "giảm chuyển động", nhãn `aria-*` cho nút ngôn ngữ/giao diện.

---

## 10. PWA, cache và bảo mật HTTP

**Service worker** (`sw.js`, `VERSION = 'v35-2026-10-27'`):

| Loại | Chiến lược |
|---|---|
| `/assets/**`, `/icons/**` (trừ `files.json`, `manifest.json`) | *Stale‑while‑revalidate*: trả ngay bản cache, kiểm tra bản mới ở nền |
| html / js / css / json | *Network‑first* (chờ tối đa 3,5 s), mạng lỗi mới dùng cache → không trộn file cũ/mới sau deploy |
| Khác nguồn, `/api/*`, `/.netlify/*`, `range`, không phải GET | Bỏ qua (không cache) |

Trang gửi danh sách file đã tải để SW `precache` → lần đầu vào xong là lần sau chơi offline được (trừ online). **Muốn ép mọi máy bỏ cache cũ: đổi `VERSION` đầu `sw.js`.**

**`_headers`** (Netlify): `Content-Security-Policy` (`default-src 'self'`; `script-src 'self'`; font Google; `connect-src` cho `0.peerjs.com`; `object-src 'none'`; `frame-ancestors 'self'`…), `Strict-Transport-Security`, `Cross-Origin-Opener-Policy: same-origin`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy: microphone=(self)`. Cache: assets/icons 1 ngày; `files.json`, `manifest.json`, `sw.js` luôn kiểm tra; html/js/css `max-age=0, must-revalidate`.

> Dùng máy chủ PeerJS riêng (`PEER_SERVER`)? **Phải** thêm `https://<host>` và `wss://<host>` vào `connect-src`, nếu không online bị CSP chặn. Muốn nhúng game vào iframe (itch.io, Facebook…) thì sửa `frame-ancestors`.

---

## 11. Triển khai Netlify

1. **Static**: kéo-thả cả thư mục (có `index.html` ở gốc) vào Netlify. Game chạy được, nhưng **kéo-thả thường không chạy được Functions** ⇒ `/api/turn` không có ⇒ online dùng TURN công cộng dự phòng (hay chậm/đầy).
2. **Khuyến nghị – Git hoặc CLI** để có hàm TURN: nối repo, hoặc `npx netlify deploy --prod`. `netlify.toml` đã khai `publish = "."` và `functions = "netlify/functions"`.
3. **Biến môi trường** (Site configuration → Environment variables):
   - `METERED_APP` — tên app Metered (phần trước `.metered.live`)
   - `METERED_SECRET_KEY` — Secret Key (Metered → Developers). **Không bao giờ** đưa vào code.
   - `ALLOWED_ORIGINS` — (tuỳ chọn) tên miền khác được gọi hàm, cách nhau dấu phẩy.
4. **Xoá credential TURN cũ** từng nằm trong `net-config.js` (đã lộ), nên tạo lại Secret Key và đặt cảnh báo/giới hạn dung lượng trong Metered.
5. **Kiểm tra**: mở `https://<site>/api/turn` → thấy JSON có `iceServers`; trong game → Online → *Kiểm tra lại* phải báo "✔ Giấu IP đang bật và TURN hoạt động".
6. **Đổi tên miền**: thay `https://game-cho-sua.netlify.app/` trong `index.html` (canonical, `og:url`, `og:image`, `twitter:image`, JSON‑LD), `robots.txt`, `sitemap.xml`. Sau đó kiểm tra ảnh xem trước bằng Facebook Sharing Debugger/Zalo (Zalo nhớ ảnh theo từng link: thử `?v=2`) và gửi `sitemap.xml` cho Google Search Console.

Thành thật về TURN: trình duyệt cần user/password nên người biết mở DevTools vẫn lấy được; cách này chỉ khiến nó **hết hạn sau 3 giờ** và khoá thật không rời server.

---

## 12. Quy trình sau khi sửa code / assets

| Bạn vừa… | Việc cần làm |
|---|---|
| Thêm/xoá/đổi tên **ảnh hoặc âm thanh** | `node tools/scan-assets.mjs` (cập nhật `assets/files.json`) |
| Thêm/xoá/đổi tên **file `.js`** | `node tools/gen-preload.mjs` (ghi lại khối `MODULEPRELOAD` trong `index.html` — đừng sửa tay) |
| Sửa **CSS nguồn** (16 file, trừ `identity.css`) | `node tools/build-css.mjs` (sinh lại `css/bundle.css`; `lite.css` phải ở cuối thứ tự) |
| Làm hai việc đầu trên Windows | bấm đúp `cap-nhat-assets.bat` (gọi scan-assets + gen-preload) |
| Đổi **định dạng tin nhắn online** | tăng `PROTOCOL_VERSION` (`js/net/net-config.js`) |
| Muốn **mọi máy bỏ cache** | đổi `VERSION` trong `sw.js` |
| Đổi **ảnh chia sẻ** (OG) | `python3 tools/tao-og-tu-anh.py <ảnh>` (cần Pillow); đổi tên file ra để Zalo/Facebook không dùng cache cũ |
| Tạo lại icon PWA/OG | `python3 tools/tao-icon-og.py` (cần Pillow) |
| Tạo lại bíp đếm ngược | `python3 tools/tao-am-thanh.py` (cần numpy, scipy, ffmpeg). **Cờ `--tong-hop` GHI ĐÈ tiếng sủa và nhạc thật** |

Chỉnh cân bằng game: sửa `js/data/config.js` (`MIC`, `STATS`, `TAP`, `GAUGE`, `BATTLE`, `AI`, `WP`, `TIERS`, `EFFECTS`). Thêm nhân vật: thêm khối vào `js/data/characters.js` (với `id` = tên thư mục ảnh) và thả ảnh vào `assets/characters/<id>/`.

---

## 13. Ghi công & pháp lý

Chi tiết ở `CREDITS.md` (cũng hiện trong game: Cài đặt → Ghi công).

- **Hình ảnh** (nhân vật, bối cảnh, ảnh chia sẻ): tạo bằng ChatGPT (OpenAI) từ mô tả độc lập. Bản quyền ảnh do AI tạo còn chưa rõ ràng ở nhiều nước.
- **Nhạc nền**: *"A Pirates Adventures"* — Emmraan, Pixabay - Game đã cắt vòng lặp, chỉnh tốc độ, ghép vào game.
- **Tiếng chó sủa**: TiengDong.com — cho tải miễn phí, đề nghị ghi nguồn
- **Tự tạo**: bíp đếm ngược, icon, ảnh OG (`tools/`). **PeerJS** — MIT (`js/vendor/`).
- **Font**: Be Vietnam Pro, Baloo 2, Lobster (Google Fonts, tải từ máy chủ Google).
- Quyền riêng tư: không tài khoản, không quảng cáo, không analytics; âm thanh micro xử lý tại máy, **không ghi, không lưu, không gửi**. Khi online chỉ gửi sự kiện trận (thời điểm sủa, độ mạnh, chiến binh đã chọn). Xem `privacy.html`, `terms.html`.
