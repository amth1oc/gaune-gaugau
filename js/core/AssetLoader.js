/**
 * AssetLoader.js — Nạp ảnh / âm thanh từ thư mục assets/ — TỰ ĐỘNG NHẬN BẤT KỲ TÊN FILE NÀO
 *
 * Cách hoạt động (không cần sửa code):
 *  1. Quét thư mục assets/ (qua danh sách thư mục của server, hoặc file assets/files.json do
 *     `cap-nhat-assets.bat` / `node tools/scan-assets.mjs` tạo ra — dùng khi host lên GitHub Pages...).
 *  2. Nền  (assets/backgrounds/*.png|jpg|webp):  tên file có từ khoá của bối cảnh nào thì thay bối cảnh đó
 *     (vd "Golden Hour in a Vietnamese Village.png" → Làng Quê). File không khớp bối cảnh nào → TỰ THÀNH BỐI CẢNH MỚI.
 *  3. Nhân vật: thư mục assets/characters/<tên>/ chứa ảnh bất kỳ; tên file có "bark/sua", "damage/hurt", "ko",
 *     "icon" thì gán đúng trạng thái, còn lại là "idle". Thư mục lạ → TỰ THÀNH NHÂN VẬT MỚI.
 *     Ảnh lẻ cũng được: assets/characters/Husky.png, Husky_bark.png ...
 *  4. Nạp lại tự động khi bạn quay lại cửa sổ trình duyệt (xem main.js) — thả ảnh xong chỉ cần bấm lại vào game.
 *  5. assets/manifest.json vẫn dùng được để chỉnh scale, groundY, âm thanh... (xem assets/README.md)
 */
import { CHARACTERS } from '../data/characters.js';
import { STAGES }     from '../data/stages.js';

const BASE   = 'assets/';
const STATES = ['idle', 'bark', 'damage', 'ko'];
const IMG_RE = /\.(png|jpe?g|webp|gif|avif|svg)$/i;
const AUD_RE = /\.(mp3|ogg|wav|m4a)$/i;
const LOCAL  = /^(localhost|127\.|192\.168\.|10\.|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
const STAMP  = Date.now();

const CHAR_DEFAULTS = { scale: 1, offsetY: 0, facing: 'right', pixelArt: false };

// ── Từ khoá nhận diện ─────────────────────────────────
const STAGE_HINTS = {
  beach:   ['beach', 'sea', 'ocean', 'bien', 'coast', 'sand', 'shore', 'seaside', 'tropical'],
  village: ['village', 'vietnam', 'lang', 'que', 'countryside', 'rural', 'hamlet', 'xom', 'farm', 'rice', 'hour'],
  valley:  ['valley', 'water', 'lake', 'river', 'thung', 'pond', 'meadow', 'mountain', 'hill', 'waterside'],
  street:  ['street', 'plaza', 'town', 'cafe', 'city', 'pho', 'market', 'square', 'storybook', 'downtown'],
  temple:  ['temple', 'pagoda', 'chua', 'den', 'shrine', 'ancient', 'forest', 'jungle'],
};
const STATE_HINTS = {
  icon:   ['icon', 'avatar', 'thumb', 'thumbnail', 'head', 'face', 'portrait', 'card'],
  bark:   ['bark', 'sua', 'woof', 'attack', 'angry', 'roar', 'shout', 'zoom', 'growl'],
  damage: ['damage', 'hurt', 'hit', 'dau', 'pain', 'ouch'],
  ko:     ['ko', 'faint', 'down', 'dead', 'nga', 'knockout', 'lose'],
  idle:   ['idle', 'stand', 'normal', 'bth', 'default', 'dung', 'base', 'binhthuong', 'neutral'],
};
const AUDIO_HINTS = [
  ['menuMusic',     ['menu', 'lobby']],
  ['battleMusic',   ['battle', 'bgm', 'ingame']],
  ['aiBark',        ['aibark', 'ai-bark', 'enemy', 'opponent']],
  ['countdownGo',   ['go', 'start', 'fight']],
  ['countdownTick', ['tick', 'count', 'beep']],
  ['combo',         ['combo']],
  ['ko',            ['ko', 'knockout']],
  ['win',           ['win', 'victory']],
  ['lose',          ['lose', 'defeat', 'fail']],
  ['click',         ['click', 'tap', 'button', 'ui']],
  ['bark',          ['bark', 'woof', 'sua', 'gau']],
];

// ── Tiện ích ──────────────────────────────────────────
export function slug(s) {
  return String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/\.[a-z0-9]+$/i, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
const tokens = s => slug(s).split('-').filter(Boolean);
function hintHit(tok, hint) { return tok === hint || (hint.length > 3 && tok.startsWith(hint)); }
function score(toks, hints) { return hints.reduce((n, h) => n + (toks.some(t => hintHit(t, h)) ? 1 : 0), 0); }
function pretty(name) {
  const t = String(name).replace(/\.[a-z0-9]+$/i, '').replace(/[_\-]+/g, ' ').replace(/\s+/g, ' ').trim();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function url(p, bust = true) {
  if (!p) return null;
  const abs = /^(https?:)?\/\//.test(p) || p.startsWith('/');
  const u = abs ? p : BASE + p.split('/').map(encodeURIComponent).join('/').replace(/%2F/g, '/');
  const tag = LOCAL && bust ? STAMP : '';
  return tag && !abs ? `${u}${u.includes('?') ? '&' : '?'}v=${tag}` : u;
}
function loadImage(src) {
  return new Promise(resolve => {
    if (!src) return resolve(null);
    const img = new Image();
    img.decoding = 'async';
    img.onload  = () => resolve(img.naturalWidth > 0 ? img : null);
    img.onerror = () => resolve(null);
    img.src = url(src);
  });
}
async function loadBinary(src) {
  try { const r = await fetch(url(src)); return r.ok ? await r.arrayBuffer() : null; } catch { return null; }
}

/** Đọc danh sách thư mục từ trang "Index of /" của server (Live Server, python -m http.server, serve...) */
async function listDir(dir) {
  try {
    const r = await fetch(BASE + dir + '/', { cache: 'no-cache', headers: { Accept: 'text/html,application/json' } });
    if (!r.ok) return null;
    const ct = r.headers.get('content-type') || '';
    const out = { files: [], dirs: [] };
    if (ct.includes('json')) {
      const j = await r.json();
      for (const e of (Array.isArray(j) ? j : j.files || [])) {
        const n = typeof e === 'string' ? e : e.name; if (!n) continue;
        (e.type === 'directory' || n.endsWith('/') ? out.dirs : out.files).push(n.replace(/\/$/, ''));
      }
      return out;
    }
    const doc = new DOMParser().parseFromString(await r.text(), 'text/html');
    const links = [...doc.querySelectorAll('a[href]')];
    for (const a of links) {
      let h = a.getAttribute('href') || '';
      if (!h || h.startsWith('?') || h.startsWith('#') || h.startsWith('..') || /^[a-z]+:/i.test(h)) continue;
      h = h.split('?')[0].split('#')[0];
      const isDir = h.endsWith('/');
      const name = decodeURIComponent(h.replace(/\/$/, '').split('/').pop());
      if (!name || name.startsWith('.')) continue;
      (isDir ? out.dirs : out.files).push(name);
    }
    // Trang không phải danh sách thư mục (vd. SPA trả về index.html) → coi như không có
    if (!out.files.length && !out.dirs.length) return null;
    if (out.files.some(f => /^index\.html?$/i.test(f)) && !out.files.some(f => IMG_RE.test(f) || AUD_RE.test(f)) && !out.dirs.length) return null;
    return out;
  } catch { return null; }
}

/** Lấy màu trung bình của ảnh (để tự đặt màu cho bối cảnh / nhân vật mới) */
function sampleColors(img, region = [0, 0, 1, 1]) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 16;
    const x = c.getContext('2d', { willReadFrequently: true });
    const [rx, ry, rw, rh] = region;
    x.drawImage(img, img.naturalWidth * rx, img.naturalHeight * ry, img.naturalWidth * rw, img.naturalHeight * rh, 0, 0, 16, 16);
    const d = x.getImageData(0, 0, 16, 16).data; let r = 0, g = 0, b = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) { if (d[i + 3] < 100) continue; r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; }
    return n ? [r / n | 0, g / n | 0, b / n | 0] : [160, 140, 110];
  } catch { return [160, 140, 110]; }
}
const hex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v | 0)).toString(16).padStart(2, '0')).join('');
const mix = (c, t, k) => c.map((v, i) => v + (t[i] - v) * k);
function hueOf([r, g, b]) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; if (!d) return 40;
  let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}
function hashStr(s) { let h = 7; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h; }

class AssetLoaderClass {
  constructor() {
    this._man = {}; this._settings = { probe: true, pixelArt: false };
    this._bg = new Map(); this._chars = new Map(); this._ui = new Map(); this._audioRaw = new Map();
    this._files = [];           // mọi file đã dò thấy (để so sánh khi nạp lại)
    this.added = { stages: [], characters: [] };
    this.loaded = false;
    /** Promise: âm thanh đã tải xong (kể cả khi không có file nào) */
    this.audioReady = Promise.resolve();
    /** Promise: ảnh nền đã tải xong (bối cảnh mới tự thêm cũng đã có trong STAGES) */
    this.backgroundsReady = Promise.resolve();
  }

  // ── Dò file ────────────────────────────────────────
  /** Đọc assets/files.json (danh sách file do cap-nhat-assets.bat tạo) → cùng định dạng kết quả với dò thư mục */
  async _fromIndex() {
    try {
      const r = await fetch(BASE + 'files.json', { cache: 'no-cache' });
      if (!r.ok) return null;
      const index = await r.json();
      const res = { backgrounds: [], ui: [], audio: [], chars: new Map(), loose: [], via: 'files.json' };
      const pre = (arr, d) => (arr || []).map(f => `${d}/${f}`);
      res.backgrounds = pre(index.backgrounds, 'backgrounds'); res.ui = pre(index.ui, 'ui'); res.audio = pre(index.audio, 'audio');
      res.loose = pre(index.charactersLoose, 'characters');
      for (const [d, files] of Object.entries(index.characters || {})) res.chars.set(d, files.map(f => `characters/${d}/${f}`));
      return res;
    } catch { return null; }
  }

  async _discover() {
    // Trên máy chủ thật (Netlify...) không xem được danh sách thư mục → đọc files.json NGAY (1 yêu cầu thay vì 4 lượt dò thất bại).
    // Trên máy bạn (localhost) thì dò thư mục trước để thả file mới là thấy ngay, không cần chạy cap-nhat-assets.bat.
    if (!LOCAL) { const idx = await this._fromIndex(); if (idx) return idx; }
    const res = { backgrounds: [], ui: [], audio: [], chars: new Map(), loose: [], via: 'quy ước tên' };
    const [bg, ui, au, ch] = await Promise.all([listDir('backgrounds'), listDir('ui'), listDir('audio'), listDir('characters')]);
    if (bg || ui || au || ch) {
      res.via = 'thư mục server';
      res.backgrounds = (bg?.files || []).filter(f => IMG_RE.test(f)).map(f => `backgrounds/${f}`);
      res.ui    = (ui?.files || []).filter(f => IMG_RE.test(f)).map(f => `ui/${f}`);
      res.audio = (au?.files || []).filter(f => AUD_RE.test(f)).map(f => `audio/${f}`);
      if (ch) {
        res.loose = ch.files.filter(f => IMG_RE.test(f)).map(f => `characters/${f}`);
        await Promise.all(ch.dirs.map(async d => {
          const l = await listDir('characters/' + encodeURIComponent(d));
          if (l) res.chars.set(d, l.files.filter(f => IMG_RE.test(f)).map(f => `characters/${d}/${f}`));
        }));
      }
      return res;
    }
    return (await this._fromIndex()) || res;
  }

  /** Nạp toàn bộ. Không bao giờ throw — lỗi thì bỏ qua file đó. */
  async load() {
    if (this.loaded) return;
    try {
      const r = await fetch(BASE + 'manifest.json', { cache: 'no-cache' });
      if (r.ok) this._man = await r.json();
    } catch { /* không có manifest */ }
    this._settings = { ...this._settings, ...(this._man.settings || {}) };
    const probe = this._settings.probe !== false;
    const found = probe ? await this._discover() : { backgrounds: [], ui: [], audio: [], chars: new Map(), loose: [], via: 'tắt dò' };
    this._via = found.via;
    this._files = [...found.backgrounds, ...found.ui, ...found.audio, ...found.loose, ...[...found.chars.values()].flat()];

    // Chỉ chờ thứ MENU cần (nhân vật + UI). Ảnh nền (~0,6 MB) tải nền: màn chọn chó tự cập nhật khi xong.
    await Promise.all([this._loadCharacters(found, probe), this._loadUI(found, probe)]);
    this.backgroundsReady = this._loadBackgrounds(found, probe).catch(e => console.warn('[Assets] lỗi nạp nền:', e))
      .then(() => { this._pruneStages(); console.info(`[Assets] nền: ${[...this._bg].map(([k, v]) => `${k}←${v.file}`).join(', ') || '—'}`); });
    // Âm thanh (~0,9 MB) tải NỀN: không bắt người chơi đợi ở màn hình chờ; xong thì main.js nạp vào SoundManager
    this.audioReady = this._loadAudio(found).catch(e => console.warn('[Assets] lỗi nạp âm thanh:', e))
      .then(() => console.info(`[Assets] âm thanh: ${[...this._audioRaw.keys()].join(', ') || '—'}`));
    this._pruneChars();
    this.loaded = true;
    this._report();
  }

  /** Đã có ảnh thật thì ẩn nhân vật/bối cảnh chỉ có hình vẽ bằng code (cho khỏi lẫn lộn).
   *  Muốn giữ lại: manifest.json → "settings": { "keepCodeDrawn": true } */
  _pruneChars() {
    if (this._settings.keepCodeDrawn) return;
    if (this._chars.size)
      for (let i = CHARACTERS.length - 1; i >= 0; i--) if (!this._chars.has(CHARACTERS[i].id)) CHARACTERS.splice(i, 1);
  }
  _pruneStages() {
    if (this._settings.keepCodeDrawn) return;
    if (this._bg.size)
      for (let i = STAGES.length - 1; i >= 0; i--) if (!this._bg.has(STAGES[i].id)) STAGES.splice(i, 1);
  }

  // ── Nền ────────────────────────────────────────────
  async _loadBackgrounds(found, probe) {
    const assigned = new Map();                 // stageId → đường dẫn file
    const files = [...found.backgrounds];
    // 1) khai báo trong manifest được ưu tiên
    const specs = {};
    for (const stage of STAGES) {
      let spec = this._man.backgrounds?.[stage.id];
      if (typeof spec === 'string') spec = { src: spec };
      specs[stage.id] = spec || {};
    }
    // 2) ghép file ↔ bối cảnh theo tên (đúng id > từ khoá)
    const pairs = [];
    for (const f of files) {
      const name = f.split('/').pop(), s = slug(name), toks = tokens(name);
      for (const st of STAGES) {
        let sc = s === st.id ? 100 : 0;
        sc += score(toks, [st.id, ...tokens(st.name), ...(STAGE_HINTS[st.id] || [])].filter(h => h.length > 2));
        if (sc > 0) pairs.push({ f, id: st.id, sc });
      }
    }
    pairs.sort((a, b) => b.sc - a.sc);
    const used = new Set();
    for (const p of pairs) { if (assigned.has(p.id) || used.has(p.f)) continue; assigned.set(p.id, p.f); used.add(p.f); }
    // 3) file còn lại → bối cảnh mới
    const tasks = [];
    for (const f of files) {
      if (used.has(f)) continue;
      const base = f.split('/').pop(); let id = slug(base) || 'stage';
      while (STAGES.some(s => s.id === id)) id += '-2';
      const st = { id, name: pretty(base), description: 'Bối cảnh bạn tự thêm vào assets/backgrounds.', unlocked: true, wpCost: 0,
        skyTop: '#3a5a6a', skyBot: '#f0a050', groundTop: '#8aa05a', groundBot: '#5a7a3a', buildingColor: '#4a3a2a',
        buildingHighlight: '#6a5236', windowColor: 'rgba(255,190,80,0.3)', ambientColor: 'rgba(255,200,120,0.12)', effectHue: 40, custom: true };
      STAGES.push(st); this.added.stages.push(st); assigned.set(id, f); used.add(f); specs[id] = {};
    }
    for (const stage of STAGES) {
      const spec = specs[stage.id] || {};
      const manifestSrc = this._man.backgrounds?.[stage.id]?.src;
      const finalSrc = assigned.get(stage.id) || manifestSrc || null;
      if (!finalSrc && !spec.portrait) continue;
      tasks.push((async () => {
        const [img, portrait] = await Promise.all([loadImage(finalSrc), loadImage(spec.portrait)]);
        if (!img && !portrait) return;
        this._bg.set(stage.id, { img: img || portrait, portrait, file: finalSrc,
          focusX: spec.focusX ?? 0.5, focusY: spec.focusY ?? 0.5, groundY: spec.groundY ?? null });
        if (stage.custom && img) {            // tự lấy màu để hiệu ứng hợp với ảnh
          const top = sampleColors(img, [0, 0, 1, 0.4]), bot = sampleColors(img, [0, 0.7, 1, 0.3]), all = sampleColors(img);
          Object.assign(stage, { skyTop: hex(mix(top, [0, 0, 0], 0.2)), skyBot: hex(top), groundTop: hex(bot), groundBot: hex(mix(bot, [0, 0, 0], 0.3)),
            effectHue: hueOf(all), ambientColor: `rgba(${all.join(',')},0.12)` });
        }
      })());
    }
    await Promise.all(tasks);
  }

  // ── Nhân vật ───────────────────────────────────────
  _matchChar(s) {
    return CHARACTERS.find(c => c.id === s) || CHARACTERS.find(c => slug(c.name) === s)
        || CHARACTERS.find(c => s.startsWith(c.id + '-') || slug(c.name).startsWith(s + '-'));
  }
  _classify(files) {
    // → { idle, bark, damage, ko, icon } (đường dẫn) — theo tên file, thiếu thì đoán theo thứ tự
    const out = {}, rest = [];
    for (const f of files) {
      const toks = tokens(f.split('/').pop()); let best = null, bs = 0;
      for (const st of ['icon', 'bark', 'damage', 'ko', 'idle']) { const sc = score(toks, STATE_HINTS[st]); if (sc > bs) { bs = sc; best = st; } }
      if (best && !out[best]) out[best] = f; else rest.push(f);
    }
    rest.sort();
    if (!out.idle && rest.length) out.idle = rest.shift();
    if (!out.bark && rest.length) out.bark = rest.shift();
    return out;
  }
  async _loadCharacters(found, probe) {
    const groups = new Map();       // id|tên → {state: file}
    const add = (key, st, f) => { if (!groups.has(key)) groups.set(key, {}); if (!groups.get(key)[st]) groups.get(key)[st] = f; };
    for (const [dir, files] of found.chars) { const c = this._classify(files); for (const [st, f] of Object.entries(c)) add(dir, st, f); }
    // ảnh lẻ: Husky.png, Husky_bark.png, husky-ko.png
    for (const f of found.loose) {
      const toks = tokens(f.split('/').pop()); let st = 'idle', rest = toks;
      for (const k of ['icon', 'bark', 'damage', 'ko', 'idle']) {
        const i = toks.findIndex(t => STATE_HINTS[k].some(h => hintHit(t, h)));
        if (i > 0) { st = k; rest = toks.filter((_, j) => j !== i); break; }
      }
      add(rest.join('-'), st, f);
    }

    const tasks = [];
    const handled = new Set();
    for (const [key, st] of groups) {
      const s = slug(key); let ch = this._matchChar(s);
      if (!ch) {
        const sp = { }; const h = hashStr(s);
        ch = { id: s, name: pretty(key.replace(/-/g, ' ')), title: 'Chiến Binh Mới', emoji: '🐕',
          color: '#C99A5B', altColor: '#8B6340', bellyColor: '#F1DDBB',
          description: 'Nhân vật bạn tự thêm vào assets/characters.',
          stats: { power: 2 + (h % 3), speed: 2 + ((h >> 3) % 3), combo: 2 + ((h >> 6) % 3) },
          earType: 'pointy', unlocked: true, wpCost: 0,
          barkWords: ['GÂU!', 'GÂU GÂU!', 'WOF!', 'AU AU!', 'SỦA!'], barkColor: `hsl(${h % 360}, 85%, 58%)`,
          special: null, specialDesc: '', custom: true };
        CHARACTERS.push(ch); this.added.characters.push(ch);
      }
      handled.add(ch.id);
      tasks.push(this._buildChar(ch, st));
    }
    // nhân vật khai báo trong manifest (idle/bark... ghi rõ đường dẫn) hoặc theo quy ước cũ khi không dò được thư mục
    for (const ch of CHARACTERS) {
      if (handled.has(ch.id)) continue;
      const m = this._man.characters?.[ch.id] || {};
      const st = {};
      for (const s of [...STATES, 'icon']) {
        const v = m[s] ?? (probe && found.via === 'quy ước tên' ? `characters/${ch.id}/${s}.png` : null);
        if (v) st[s] = v;
      }
      if (Object.keys(st).length) tasks.push(this._buildChar(ch, st));
    }
    await Promise.all(tasks);
  }
  async _buildChar(ch, files) {
    const m = this._man.characters?.[ch.id] || {};
    const sprites = {};
    await Promise.all(STATES.map(async s => { sprites[s] = await loadImage(m[s] ?? files[s]); }));
    if (!Object.values(sprites).some(Boolean)) return;
    const iconSrc = m.icon ?? files.icon;
    const icon = iconSrc ? await loadImage(iconSrc) : null;
    const base = sprites.idle || Object.values(sprites).find(Boolean);
    const iconUrl = icon ? url(iconSrc) : (base ? base.src : null);
    if (ch.custom && base) {      // đặt màu theo ảnh để hiệu ứng/thanh hợp màu nhân vật
      const c = sampleColors(base, [0.15, 0.25, 0.7, 0.6]);
      ch.color = hex(c); ch.altColor = hex(mix(c, [0, 0, 0], 0.3)); ch.bellyColor = hex(mix(c, [255, 255, 255], 0.6));
      ch.barkColor = `hsl(${hueOf(c)}, 85%, 58%)`;
    }
    this._chars.set(ch.id, { sprites, iconUrl, file: files.idle,
      cfg: { scale: m.scale ?? CHAR_DEFAULTS.scale, offsetY: m.offsetY ?? CHAR_DEFAULTS.offsetY, facing: m.facing ?? CHAR_DEFAULTS.facing,
             pixelArt: m.pixelArt ?? this._settings.pixelArt ?? false } });
  }

  // ── UI ─────────────────────────────────────────────
  async _loadUI(found, probe) {
    const ui = this._man.ui || {};
    const pick = (hints) => found.ui.find(f => score(tokens(f.split('/').pop()), hints) > 0);
    const wanted = [['menuBackground', ui.menuBackground ?? pick(['menu', 'bg', 'background', 'nen']) ?? (probe && !found.ui.length && found.via === 'quy ước tên' ? 'ui/menu-bg.png' : null)],
                    ['logo',           ui.logo ?? pick(['logo', 'title']) ?? (probe && !found.ui.length && found.via === 'quy ước tên' ? 'ui/logo.png' : null)]];
    await Promise.all(wanted.map(async ([key, src]) => { if (!src) return; const img = await loadImage(src); if (img) this._ui.set(key, url(src)); }));
  }

  // ── Âm thanh ───────────────────────────────────────
  async _loadAudio(found) {
    const lists = new Map();
    for (const [name, list] of Object.entries(this._man.audio || {})) {
      const f = (Array.isArray(list) ? list : [list]).filter(Boolean); if (f.length) lists.set(name, f);
    }
    for (const f of found.audio) {
      const toks = tokens(f.split('/').pop());
      const hit = AUDIO_HINTS.find(([, hs]) => score(toks, hs) > 0);
      if (hit && !this._man.audio?.[hit[0]]?.length) { if (!lists.has(hit[0])) lists.set(hit[0], []); lists.get(hit[0]).push(f); }
    }
    await Promise.all([...lists].map(([name, files]) => Promise.all(files.map(loadBinary)).then(bufs => {
      const ok = bufs.filter(Boolean); if (ok.length) this._audioRaw.set(name, ok);
    })));
  }

  _report() {
    const chars = [...this._chars].map(([id, c]) => `${id}(${Object.entries(c.sprites).filter(([, v]) => v).map(([k]) => k).join(',')})`);
    console.info(
      `[Assets] (${this._via}) ` +
      `nhân vật: ${chars.join(' ') || '—'} | ui: ${[...this._ui.keys()].join(', ') || '—'}`);
    if (this.added.stages.length)     console.info('[Assets] bối cảnh mới tự thêm:', this.added.stages.map(s => s.name).join(', '));
    if (this.added.characters.length) console.info('[Assets] nhân vật mới tự thêm:', this.added.characters.map(c => c.name).join(', '));
  }

  /** Chữ ký các file hiện có (tên + ngày sửa + dung lượng). Khác lần trước = bạn vừa thêm/đổi ảnh. */
  async signature() {
    const found = await this._discover();
    const all = [...found.backgrounds, ...found.ui, ...found.audio, ...found.loose, ...[...found.chars.values()].flat()].sort();
    const parts = await Promise.all(all.map(async f => {
      try { const r = await fetch(url(f, false), { method: 'HEAD', cache: 'no-cache' });
            return `${f}|${r.headers.get('last-modified') || ''}|${r.headers.get('content-length') || r.headers.get('etag') || ''}`;
      } catch { return f; }
    }));
    return parts.join('\n');
  }

  // ── Getters ────────────────────────────────────────
  getBackground(stageId) { return this._bg.get(stageId) || null; }
  getGroundY(stageId) { return this._bg.get(stageId)?.groundY ?? null; }
  getBackgroundUrl(stageId) { return this._bg.get(stageId)?.img?.src || null; }
  /** Ảnh thu nhỏ (320px, ~10 KB) cho ô chọn bối cảnh: tránh giải mã 6 ảnh nền 1280px chỉ để vẽ ô nhỏ. Không có thì trả null (dùng ảnh gốc). */
  getBackgroundThumbUrl(stageId) {
    const f = this._bg.get(stageId)?.file;
    if (!f) return null;
    const base = f.split('/').pop().replace(/\.[^.]+$/, '');
    return `assets/theme/thumbs/${encodeURIComponent(base)}.webp`;
  }
  hasSprite(charId) { return this._chars.has(charId); }
  getSprite(charId, state = 'idle') {
    const c = this._chars.get(charId); if (!c) return null;
    const exact = c.sprites[state];
    const img = exact || c.sprites.idle || Object.values(c.sprites).find(Boolean);
    return img ? { img, cfg: c.cfg, exact: !!exact } : null;
  }
  iconHTML(char, cls = '') {
    const c = this._chars.get(char.id);
    if (c?.iconUrl) return `<img class="${cls}" src="${c.iconUrl}" alt="${char.name}" draggable="false">`;
    return char.emoji;
  }
  getUI(name) { return this._ui.get(name) || null; }
  get audioFiles() { return this._audioRaw; }
}

export const Assets = new AssetLoaderClass();
