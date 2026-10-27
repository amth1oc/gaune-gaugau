/**
 * SceneRenderer.js — Bối cảnh bãi biển (quán biển) vẽ bằng code, phong cách tranh vẽ tay màu xỉn
 * giống video gốc: bầu trời mờ, biển xám xanh, cát có hạt, quán biển, ô, cột đèn, xe đạp.
 *
 * Cảnh tĩnh được vẽ MỘT LẦN vào canvas phụ (cache theo kích thước), mỗi khung hình chỉ vẽ lại sóng.
 * Có file assets/backgrounds/beach.png thì file đó được ưu tiên (xem DogRenderer.drawBackground).
 */
const INK = '#3a2a1c';
const SIGN_FONT = "'Baloo 2','Be Vietnam Pro',Arial,sans-serif";

let _cache = null;           // { key, canvas }
if (typeof document !== 'undefined' && document.fonts?.ready) {
  document.fonts.ready.then(() => { _cache = null; });     // vẽ lại khi font chữ trên biển hiệu tải xong
}

function rng(seed) {                                       // mulberry32: ngẫu nhiên cố định → cảnh không nhấp nháy
  return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

/** Nét mực: vẽ 2 lần lệch nhẹ cho cảm giác vẽ tay */
function ink(c, draw, width = 2, alpha = 0.85) {
  c.save();
  c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = INK;
  c.globalAlpha = alpha; c.lineWidth = width; draw(0, 0); c.stroke();
  c.globalAlpha = alpha * 0.4; c.lineWidth = width * 0.7; draw(0.9, -0.7); c.stroke();
  c.restore();
}

function paintBeach(c, w, h, R) {
  const k = h / 576;
  const hy = h * 0.37;                                    // đường chân trời

  // ── Bầu trời mờ ──
  let g = c.createLinearGradient(0, 0, 0, hy);
  g.addColorStop(0, '#cfc8b4'); g.addColorStop(1, '#e0d9c6');
  c.fillStyle = g; c.fillRect(0, 0, w, hy + 2);
  for (let i = 0; i < 6; i++) {                           // mây loang
    const cx = R() * w, cy = hy * (0.15 + R() * 0.6), rw = (90 + R() * 160) * k;
    const cg = c.createRadialGradient(cx, cy, 0, cx, cy, rw);
    cg.addColorStop(0, 'rgba(255,252,240,0.38)'); cg.addColorStop(1, 'rgba(255,252,240,0)');
    c.fillStyle = cg; c.fillRect(cx - rw, cy - rw, rw * 2, rw * 2);
  }
  // núi xa
  c.fillStyle = 'rgba(132,148,150,0.5)';
  c.beginPath(); c.moveTo(0, hy);
  c.bezierCurveTo(w * 0.05, hy - 22 * k, w * 0.12, hy - 30 * k, w * 0.2, hy - 8 * k);
  c.bezierCurveTo(w * 0.26, hy - 14 * k, w * 0.3, hy - 4 * k, w * 0.34, hy); c.fill();

  // ── Biển ──
  g = c.createLinearGradient(0, hy, 0, hy + h * 0.075);
  g.addColorStop(0, '#8ea0a4'); g.addColorStop(1, '#a9b8b4');
  c.fillStyle = g; c.fillRect(0, hy, w, h * 0.075);
  c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.2 * k;
  for (let i = 0; i < 40; i++) {
    const x = R() * w, y = hy + 3 * k + R() * h * 0.06, l = (14 + R() * 30) * k;
    c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + l / 2, y - 2 * k, x + l, y); c.stroke();
  }

  // ── Cát ──
  const sy = hy + h * 0.065;
  g = c.createLinearGradient(0, sy, 0, h);
  g.addColorStop(0, '#d9c9a4'); g.addColorStop(0.35, '#c8b48c'); g.addColorStop(1, '#a58d68');
  c.fillStyle = g;
  c.beginPath(); c.moveTo(0, sy);
  for (let x = 0; x <= w + 24; x += 24) c.lineTo(x, sy + Math.sin(x * 0.011) * 3 * k + Math.sin(x * 0.037) * 1.5 * k);
  c.lineTo(w + 24, h); c.lineTo(0, h); c.closePath(); c.fill();
  // vệt cát ướt + vết lõm
  for (let i = 0; i < 9; i++) {
    const x = R() * w, y = sy + R() * (h - sy), rw = (40 + R() * 110) * k;
    c.fillStyle = R() > 0.5 ? 'rgba(110,86,52,0.10)' : 'rgba(255,240,205,0.12)';
    c.beginPath(); c.ellipse(x, y, rw, rw * 0.18, 0, 0, 7); c.fill();
  }
  for (let i = 0; i < Math.min(2600, w * h / 220); i++) {          // hạt cát
    c.fillStyle = R() > 0.5 ? 'rgba(80,60,36,0.16)' : 'rgba(255,248,225,0.22)';
    const r = (0.6 + R() * 1.4) * k;
    c.fillRect(R() * w, sy + R() * (h - sy), r, r);
  }
  // dấu chân
  c.fillStyle = 'rgba(95,72,44,0.18)';
  for (let i = 0; i < 12; i++) {
    const x = w * (0.08 + R() * 0.5), y = h * (0.5 + R() * 0.45);
    c.beginPath(); c.ellipse(x, y, 5 * k, 2.6 * k, 0.3, 0, 7); c.fill();
    c.beginPath(); c.ellipse(x + 12 * k, y + 4 * k, 5 * k, 2.6 * k, 0.3, 0, 7); c.fill();
  }

  // ── Người xa (bóng nhỏ) ──
  for (let i = 0; i < 7; i++) {
    const x = w * (0.04 + R() * 0.36), y = hy + h * 0.085 + R() * h * 0.025, s = (5 + R() * 3) * k;
    c.fillStyle = ['#6a4a3a', '#4a5a6a', '#8a6a4a', '#5a3a3a'][i % 4];
    c.fillRect(x - s * 0.3, y - s * 1.6, s * 0.6, s * 1.6);
    c.fillStyle = '#d8b896'; c.beginPath(); c.arc(x, y - s * 1.9, s * 0.38, 0, 7); c.fill();
  }

  // ── Ô che nắng + ghế ──
  const ux = w * 0.60, uTop = h * 0.20, uBase = h * 0.50;
  ink(c, () => { c.beginPath(); c.moveTo(ux, uTop); c.lineTo(ux + 6 * k, uBase); }, 3 * k);
  const rr = 74 * k, segs = 8;
  for (let i = 0; i < segs; i++) {
    const a0 = Math.PI + (i / segs) * Math.PI, a1 = Math.PI + ((i + 1) / segs) * Math.PI;
    c.fillStyle = i % 2 ? '#e9e0cc' : '#b4503a';
    c.beginPath(); c.moveTo(ux, uTop + 6 * k);
    c.ellipse(ux, uTop + 6 * k, rr, rr * 0.5, 0, a0, a1); c.closePath(); c.fill();
  }
  ink(c, () => { c.beginPath(); c.ellipse(ux, uTop + 6 * k, rr, rr * 0.5, 0, Math.PI, Math.PI * 2); c.lineTo(ux - rr, uTop + 6 * k); }, 2 * k);
  // ghế bố
  const cx0 = w * 0.50, cy0 = h * 0.47;
  ink(c, () => { c.beginPath(); c.moveTo(cx0, cy0 - 34 * k); c.lineTo(cx0 + 8 * k, cy0); c.lineTo(cx0 + 40 * k, cy0 + 2 * k);
    c.moveTo(cx0 + 8 * k, cy0); c.lineTo(cx0 - 4 * k, cy0 + 24 * k); c.moveTo(cx0 + 40 * k, cy0 + 2 * k); c.lineTo(cx0 + 46 * k, cy0 + 24 * k); }, 2.2 * k);
  c.fillStyle = 'rgba(70,92,120,0.8)'; c.beginPath(); c.moveTo(cx0 + 1, cy0 - 33 * k); c.lineTo(cx0 + 9 * k, cy0 - 2 * k); c.lineTo(cx0 + 38 * k, cy0 + k); c.lineTo(cx0 + 12 * k, cy0 - 36 * k); c.fill();

  // ── Quán biển (bên phải) ──
  const hx = w * 0.775, hw = w - hx + 8 * k, hTop = h * 0.20, hBot = h * 0.55;
  // khung gỗ + bóng tối bên trong
  c.fillStyle = '#4a3828'; c.fillRect(hx, hTop + 46 * k, hw, hBot - hTop - 46 * k);
  c.fillStyle = 'rgba(20,12,6,0.55)'; c.fillRect(hx + 10 * k, hTop + 70 * k, hw - 20 * k, hBot - hTop - 76 * k);
  // cột
  for (const px of [hx + 3 * k, hx + hw * 0.5, hx + hw - 9 * k]) {
    c.fillStyle = '#6a4c32'; c.fillRect(px, hTop + 40 * k, 8 * k, hBot - hTop - 30 * k);
    ink(c, () => { c.beginPath(); c.rect(px, hTop + 40 * k, 8 * k, hBot - hTop - 30 * k); }, 1.6 * k, 0.7);
  }
  // mái ngói
  c.fillStyle = '#5e6a72';
  c.beginPath(); c.moveTo(hx - 14 * k, hTop + 48 * k); c.lineTo(hx + 12 * k, hTop); c.lineTo(hx + hw, hTop); c.lineTo(hx + hw, hTop + 48 * k); c.closePath(); c.fill();
  c.strokeStyle = 'rgba(30,38,44,0.55)'; c.lineWidth = 1.2 * k;
  for (let i = 1; i < 6; i++) {
    const y = hTop + i * 8 * k; c.beginPath(); c.moveTo(hx - 14 * k + i * 4 * k, y); c.lineTo(hx + hw, y); c.stroke();
  }
  ink(c, () => { c.beginPath(); c.moveTo(hx - 14 * k, hTop + 48 * k); c.lineTo(hx + 12 * k, hTop); c.lineTo(hx + hw, hTop); }, 2.4 * k);
  // biển hiệu
  const sw = Math.min(hw * 0.78, 118 * k), sh = 38 * k, sx = hx + hw * 0.5 - sw / 2 + 6 * k, sy2 = hTop + 54 * k;
  c.fillStyle = '#e8dcc0'; c.fillRect(sx, sy2, sw, sh);
  ink(c, () => { c.beginPath(); c.rect(sx, sy2, sw, sh); }, 2.2 * k);
  c.fillStyle = INK; c.font = `800 ${Math.round(17 * k)}px ${SIGN_FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(document.documentElement.lang === 'en' ? 'BEACH SHACK' : 'QUÁN BIỂN', sx + sw / 2, sy2 + sh / 2 + 1);
  // rèm sọc xanh trắng
  for (let i = 0; i < 6; i++) {
    c.fillStyle = i % 2 ? '#dfe3e0' : '#4d6d8a';
    c.fillRect(hx + 8 * k + i * ((hw - 16 * k) / 6), sy2 + sh + 4 * k, (hw - 16 * k) / 6, 22 * k);
  }

  // ── Cột đèn ──
  const lx = w * 0.845;
  ink(c, () => { c.beginPath(); c.moveTo(lx, hTop - 8 * k); c.lineTo(lx, hBot + 6 * k); }, 4 * k);
  ink(c, () => { c.beginPath(); c.moveTo(lx, hTop - 2 * k); c.lineTo(lx - 22 * k, hTop - 4 * k); }, 3 * k);
  c.fillStyle = '#7a5a3a'; c.fillRect(lx - 34 * k, hTop - 14 * k, 18 * k, 16 * k);
  ink(c, () => { c.beginPath(); c.rect(lx - 34 * k, hTop - 14 * k, 18 * k, 16 * k); }, 1.6 * k);

  // ── Xe đạp ──
  const bx = w * 0.915, by = h * 0.62, wr = 22 * k;
  ink(c, () => { c.beginPath(); c.arc(bx - 34 * k, by, wr, 0, 7); c.moveTo(bx + 34 * k + wr, by); c.arc(bx + 34 * k, by, wr, 0, 7); }, 2.4 * k);
  ink(c, () => { c.beginPath(); c.moveTo(bx - 34 * k, by); c.lineTo(bx - 8 * k, by - 30 * k); c.lineTo(bx + 24 * k, by - 30 * k); c.lineTo(bx + 34 * k, by);
    c.moveTo(bx - 8 * k, by - 30 * k); c.lineTo(bx + 4 * k, by); c.lineTo(bx - 34 * k, by); c.moveTo(bx + 24 * k, by - 30 * k); c.lineTo(bx + 20 * k, by - 40 * k); c.lineTo(bx + 34 * k, by - 42 * k); }, 2.4 * k);

  // ── Lớp "giấy" + hạt + tối góc (cho cảm giác tranh in màu xỉn) ──
  c.fillStyle = 'rgba(232,216,184,0.22)'; c.fillRect(0, 0, w, h);                 // ám vàng nhạt
  for (let i = 0; i < Math.min(9000, w * h / 40); i++) {
    c.fillStyle = R() > 0.5 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.06)';
    c.fillRect(R() * w, R() * h, 1.2 * k, 1.2 * k);
  }
  const vg = c.createRadialGradient(w / 2, h * 0.55, h * 0.35, w / 2, h * 0.55, Math.max(w, h) * 0.78);
  vg.addColorStop(0, 'rgba(60,40,20,0)'); vg.addColorStop(1, 'rgba(60,40,20,0.34)');
  c.fillStyle = vg; c.fillRect(0, 0, w, h);
}

export const SceneRenderer = {
  /** Vẽ cảnh bãi biển lên ctx (kích thước logic w×h) */
  drawBeach(ctx, w, h, time = 0) {
    const dpr = ctx.getTransform ? ctx.getTransform().a || 1 : 1;
    const key = `${Math.round(w)}x${Math.round(h)}@${dpr}|${document.documentElement.lang}`;
    if (!_cache || _cache.key !== key) {
      const cv = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.ceil(w * dpr), Math.ceil(h * dpr))
                                                         : Object.assign(document.createElement('canvas'), { width: Math.ceil(w * dpr), height: Math.ceil(h * dpr) });
      const c = cv.getContext('2d');
      c.scale(dpr, dpr);
      paintBeach(c, w, h, rng(20240611));
      _cache = { key, canvas: cv };
    }
    ctx.drawImage(_cache.canvas, 0, 0, w, h);

    // sóng nhẹ chạy ở bờ biển (động duy nhất của nền)
    const k = h / 576, y0 = h * 0.37 + h * 0.075 - 2 * k;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 1.6 * k; ctx.lineCap = 'round';
    for (let r = 0; r < 3; r++) {
      ctx.beginPath();
      for (let x = 0; x <= w; x += 12) {
        const y = y0 + r * 5 * k + Math.sin(x * 0.02 + time * 1.2 + r * 1.7) * 2.2 * k;
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.globalAlpha = 0.5 - r * 0.14; ctx.stroke();
    }
    ctx.restore();
  },
};
