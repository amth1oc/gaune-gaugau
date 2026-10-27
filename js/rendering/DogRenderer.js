/**
 * DogRenderer.js — Vẽ nhân vật chó lên Canvas 2D
 *
 * Đây là module pure rendering — không có state, chỉ nhận params và vẽ.
 * BattleScreen và CharacterSelectScreen đều dùng module này.
 *
 * Cấu trúc chó:
 *   Shadow → Tail → Body → Back legs → Head → Ear → Snout → Nose
 *   → Mouth (open/closed) → Eye → Eyebrow → Front legs
 */
import { Assets } from '../core/AssetLoader.js';
import { SceneRenderer } from './SceneRenderer.js';

// Canvas phụ để tô đỏ sprite khi bị đau (dùng lại, không tạo mới mỗi frame)
let _tintCanvas = null;

export const DogRenderer = {

  /**
   * Vẽ 1 nhân vật chó (nét mực vẽ tay, mặt nhìn thẳng).
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} x          - Giữa thân theo chiều ngang
   * @param {number} y          - Tâm thân (chân chạm đất ở y + size×0.48)
   * @param {number} size       - Kích thước cơ bản (px)
   * @param {object} charData   - Từ characters.js
   * @param {boolean} facingRight
   * @param {string} state      - 'idle'|'bark'|'damage'|'ko'
   * @param {number} scale      - Scale hiện tại (đã gồm hiệu ứng theo gauge)
   * @param {number} time       - Thời gian chạy (giây)
   * @param {object} [opts]     - { dom: -1..1 (>0 đang thắng thế), rot: góc xoay (rad) khi bị hất bay, flying }
   */
  draw(ctx, x, y, size, charData, facingRight, state, scale, time, opts = {}) {
    if (this._drawSprite(ctx, x, y, size, charData, facingRight, state, scale, time, opts)) return;
    this._drawVector(ctx, x, y, size, charData, facingRight, state, scale, time, opts);
  },

  _drawVector(ctx, x, y, s, ch, facingRight, state, scale, time, opts) {
    const INK = '#3a2412';
    const dom = opts.dom || 0;
    const isBark = state === 'bark', isKO = state === 'ko', isHurt = state === 'damage';
    const mood = isKO ? 'ko' : dom > 0.3 ? 'fierce' : dom < -0.3 ? 'scared' : 'normal';
    const fur = ch.color, fur2 = ch.altColor, cream = ch.bellyColor;
    const lw = Math.max(1.2, s * 0.017);

    ctx.save();
    ctx.translate(x, y + s * 0.48);                       // gốc toạ độ = chân chạm đất
    if (opts.rot) {                                       // xoay quanh thân (bị hất bay)
      ctx.translate(0, -0.5 * s * scale); ctx.rotate(opts.rot); ctx.translate(0, 0.5 * s * scale);
    }
    if (!facingRight) ctx.scale(-1, 1);
    ctx.scale(scale, scale);
    if (isKO && !opts.flying) { ctx.translate(0, -s * 0.12); ctx.rotate(-Math.PI * 0.46); }   // nằm sõng soài
    if (!isKO && !isBark) ctx.translate(0, Math.sin(time * 2.4) * s * 0.010);                 // thở nhẹ
    if (isHurt) ctx.translate((Math.random() - 0.5) * s * 0.03, 0);

    // nét mực 2 lớp (lệch nhẹ) cho cảm giác vẽ tay
    const shape = (path, fill, w = lw) => {
      ctx.beginPath(); path();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = INK;
      ctx.globalAlpha = 0.9; ctx.lineWidth = w; ctx.stroke();
      ctx.restore();
      ctx.save(); ctx.translate(s * 0.005, -s * 0.004); ctx.beginPath(); path();
      ctx.lineJoin = 'round'; ctx.strokeStyle = INK; ctx.globalAlpha = 0.3; ctx.lineWidth = w * 0.6; ctx.stroke(); ctx.restore();
    };
    const line = (x1, y1, x2, y2, w = lw, col = INK) => {
      ctx.save(); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); ctx.restore();
    };
    const fillEllipse = (cx, cy, rx, ry, col, rot = 0) => {
      ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, rot, 0, 7); ctx.fill();
    };

    // ── bóng dưới chân ──
    fillEllipse(0.02 * s, 0.005 * s, 0.50 * s, 0.065 * s, 'rgba(60,40,20,0.30)');

    // ── đuôi cuộn ──
    const wag = Math.sin(time * (isBark ? 16 : 6)) * 0.14 + (isBark ? 0.18 : 0) + (mood === 'scared' ? -0.5 : 0);
    ctx.save();
    ctx.translate(-0.36 * s, -0.40 * s); ctx.rotate(-0.35 + wag);
    shape(() => { ctx.moveTo(-0.05 * s, 0.02 * s); ctx.quadraticCurveTo(-0.16 * s, -0.10 * s, -0.10 * s, -0.24 * s);
                  ctx.lineTo(0.06 * s, -0.20 * s); ctx.quadraticCurveTo(0.04 * s, -0.08 * s, 0.05 * s, 0.02 * s); ctx.closePath(); }, fur);
    shape(() => ctx.arc(-0.03 * s, -0.27 * s, 0.135 * s, 0, 7), fur);
    fillEllipse(-0.02 * s, -0.27 * s, 0.07 * s, 0.07 * s, cream);
    ctx.restore();

    // ── chân sau ──
    const leg = (cx, top, w, col) => {
      shape(() => { ctx.moveTo(cx - w / 2, top); ctx.lineTo(cx - w / 2, -0.02 * s); ctx.quadraticCurveTo(cx - w * 0.7, 0, cx, 0);
                    ctx.quadraticCurveTo(cx + w * 0.8, 0, cx + w / 2, -0.03 * s); ctx.lineTo(cx + w / 2, top); ctx.closePath(); }, col);
      ctx.save(); ctx.beginPath(); ctx.rect(cx - w, -0.075 * s, w * 2, 0.1 * s); ctx.clip();
      shape(() => { ctx.moveTo(cx - w / 2, top); ctx.lineTo(cx - w / 2, -0.02 * s); ctx.quadraticCurveTo(cx - w * 0.7, 0, cx, 0);
                    ctx.quadraticCurveTo(cx + w * 0.8, 0, cx + w / 2, -0.03 * s); ctx.lineTo(cx + w / 2, top); ctx.closePath(); }, cream);
      ctx.restore();
    };
    leg(-0.27 * s, -0.26 * s, 0.105 * s, fur2);
    leg(-0.13 * s, -0.26 * s, 0.105 * s, fur2);

    // ── thân ──
    const body = () => {
      ctx.moveTo(-0.39 * s, -0.33 * s);
      ctx.bezierCurveTo(-0.41 * s, -0.55 * s, -0.10 * s, -0.63 * s, 0.14 * s, -0.59 * s);
      ctx.bezierCurveTo(0.36 * s, -0.56 * s, 0.47 * s, -0.46 * s, 0.45 * s, -0.30 * s);
      ctx.bezierCurveTo(0.43 * s, -0.16 * s, 0.20 * s, -0.13 * s, 0.0, -0.14 * s);
      ctx.bezierCurveTo(-0.20 * s, -0.13 * s, -0.39 * s, -0.17 * s, -0.39 * s, -0.33 * s);
    };
    shape(body, fur);
    ctx.save(); ctx.beginPath(); body(); ctx.clip();
    fillEllipse(0.12 * s, -0.17 * s, 0.30 * s, 0.10 * s, cream);        // bụng kem
    ctx.globalAlpha = 0.28; fillEllipse(-0.15 * s, -0.52 * s, 0.30 * s, 0.07 * s, fur2); ctx.globalAlpha = 1;   // bóng lưng
    ctx.restore();
    for (let i = 0; i < 6; i++) line((-0.3 + i * 0.09) * s, -0.585 * s + Math.abs(i - 2.5) * 0.012 * s, (-0.3 + i * 0.09) * s + 0.02 * s, -0.54 * s, lw * 0.6);   // lông lưng

    // ── chân trước ──
    leg(0.19 * s, -0.27 * s, 0.11 * s, fur);
    leg(0.33 * s, -0.27 * s, 0.11 * s, fur);

    // ── ĐẦU (nhìn thẳng) ──
    const R = 0.275 * s;
    ctx.save();
    ctx.translate(0.27 * s + (isBark ? 0.02 * s : 0), -0.66 * s + (mood === 'scared' ? 0.02 * s : 0));
    ctx.rotate(isBark ? -0.09 : mood === 'scared' ? 0.07 : 0);
    if (mood === 'fierce') ctx.scale(1.04, 1.04);

    // tai
    const earY = (mood === 'scared') ? 0.55 : mood === 'fierce' ? 0.2 : 0;
    const earOut = (mood === 'scared') ? 0.55 : mood === 'fierce' ? 0.25 : 0;
    for (const sd of [-1, 1]) {
      if (ch.earType === 'floppy') {
        shape(() => ctx.ellipse(sd * 1.0 * R, 0.1 * R, 0.30 * R, 0.55 * R, sd * 0.25, 0, 7), fur2);
      } else if (ch.earType === 'round') {
        shape(() => ctx.arc(sd * 0.72 * R, -0.98 * R, 0.34 * R, 0, 7), fur2);
        fillEllipse(sd * 0.72 * R, -0.98 * R, 0.18 * R, 0.18 * R, 'rgba(240,170,150,0.7)');
      } else {
        shape(() => { ctx.moveTo(sd * 1.0 * R, -0.30 * R); ctx.lineTo(sd * (0.82 + earOut) * R, (-1.55 + earY) * R);
                      ctx.lineTo(sd * 0.22 * R, -0.88 * R); ctx.closePath(); }, fur);
        shape(() => { ctx.moveTo(sd * 0.86 * R, -0.52 * R); ctx.lineTo(sd * (0.78 + earOut) * R, (-1.30 + earY) * R);
                      ctx.lineTo(sd * 0.40 * R, -0.86 * R); ctx.closePath(); }, 'rgba(238,168,150,0.85)');
      }
    }
    // mặt + má lông xù
    const headPath = () => { ctx.ellipse(0, 0, 1.08 * R, 0.94 * R, 0, 0, 7); };
    shape(headPath, fur);
    const cheeks = (sd) => () => {
      ctx.moveTo(sd * 0.70 * R, -0.05 * R);
      for (const [px, py] of [[1.22, 0.08], [1.04, 0.20], [1.28, 0.36], [1.02, 0.46], [1.14, 0.64], [0.74, 0.80]]) ctx.lineTo(sd * px * R, py * R);
      ctx.lineTo(sd * 0.2 * R, 0.9 * R); ctx.lineTo(sd * 0.2 * R, 0.1 * R); ctx.closePath();
    };
    shape(cheeks(-1), cream, lw * 0.9); shape(cheeks(1), cream, lw * 0.9);
    fillEllipse(0, 0.42 * R, 0.66 * R, 0.5 * R, cream);                                // mõm kem
    for (const sd of [-1, 1]) fillEllipse(sd * 0.40 * R, -0.50 * R, 0.10 * R, 0.07 * R, cream);   // chấm lông mày
    for (let i = 0; i < 5; i++) line((-0.4 + i * 0.2) * R, -0.86 * R + Math.abs(i - 2) * 0.05 * R, (-0.4 + i * 0.2) * R, -0.72 * R, lw * 0.6);   // lông đỉnh đầu

    // mắt
    const ey = -0.12 * R, ex = 0.42 * R;
    const lookX = 0.05 * R;
    for (const sd of [-1, 1]) {
      const cx = sd * ex;
      if (mood === 'ko') {                                                           // mắt X
        const r = 0.13 * R;
        line(cx - r, ey - r, cx + r, ey + r, lw * 1.3); line(cx - r, ey + r, cx + r, ey - r, lw * 1.3);
      } else if (isHurt) {                                                           // nheo mắt > <
        const r = 0.13 * R;
        line(cx - sd * r, ey - r, cx + sd * r, ey, lw * 1.3); line(cx + sd * r, ey, cx - sd * r, ey + r, lw * 1.3);
      } else {
        let er = 0.20 * R, pr = 0.105 * R;
        if (isBark)             { er = 0.27 * R; pr = 0.065 * R; }
        else if (mood === 'fierce') { er = 0.22 * R; pr = 0.075 * R; }
        else if (mood === 'scared') { er = 0.25 * R; pr = 0.05 * R; }
        const jx = mood === 'scared' ? Math.sin(time * 38 + sd) * 0.025 * R : 0;
        fillEllipse(cx, ey, er, er, '#fffdf4');
        ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.9; ctx.beginPath(); ctx.arc(cx, ey, er, 0, 7); ctx.stroke(); ctx.restore();
        if (isBark || mood === 'fierce') {                                           // tia máu đỏ trong mắt
          ctx.save(); ctx.strokeStyle = 'rgba(200,30,30,0.8)'; ctx.lineWidth = lw * 0.55;
          for (let i = 0; i < 7; i++) { const a = i * 0.9 + sd;
            ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * er * 0.95, ey + Math.sin(a) * er * 0.95);
            ctx.lineTo(cx + Math.cos(a) * er * 0.45, ey + Math.sin(a) * er * 0.45); ctx.stroke(); }
          ctx.restore();
        }
        fillEllipse(cx + lookX + jx, ey, pr, pr, '#1a0c04');
        fillEllipse(cx + lookX + jx + pr * 0.35, ey - pr * 0.4, pr * 0.32, pr * 0.32, 'rgba(255,255,255,0.9)');
        if (isBark && mood !== 'scared') {                                           // vòng đỏ nguệch ngoạc quanh mắt (như video)
          ctx.save(); ctx.strokeStyle = 'rgba(205,35,30,0.85)'; ctx.lineWidth = lw * 0.9;
          ctx.beginPath(); ctx.ellipse(cx, ey, er * 1.5, er * 1.35, sd * 0.3, 0.3, 5.6); ctx.stroke(); ctx.restore();
        }
      }
    }
    // lông mày
    if (mood === 'fierce' || (isBark && mood !== 'scared')) {                       // cau có
      for (const sd of [-1, 1]) {
        ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = R * 0.12; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(sd * 0.80 * R, ey - 0.50 * R); ctx.lineTo(sd * 0.12 * R, ey - 0.20 * R); ctx.stroke(); ctx.restore();
      }
    } else if (mood === 'scared') {                                                 // lo âu
      for (const sd of [-1, 1]) line(sd * 0.75 * R, ey - 0.30 * R, sd * 0.18 * R, ey - 0.62 * R, R * 0.07);
    }

    // mũi
    shape(() => { ctx.moveTo(-0.16 * R, 0.14 * R); ctx.quadraticCurveTo(0, 0.08 * R, 0.16 * R, 0.14 * R);
                  ctx.quadraticCurveTo(0.12 * R, 0.30 * R, 0, 0.32 * R); ctx.quadraticCurveTo(-0.12 * R, 0.30 * R, -0.16 * R, 0.14 * R); }, '#2a160a', lw * 0.7);
    fillEllipse(-0.05 * R, 0.16 * R, 0.04 * R, 0.025 * R, 'rgba(255,255,255,0.45)');

    // miệng
    const my = 0.40 * R;
    if (mood === 'ko') {
      line(0, 0.32 * R, 0, my, lw);
      shape(() => ctx.ellipse(0, my + 0.06 * R, 0.2 * R, 0.1 * R, 0, 0, 7), '#7a1410', lw * 0.8);
      shape(() => { ctx.moveTo(-0.1 * R, my + 0.1 * R); ctx.lineTo(-0.1 * R, my + 0.5 * R); ctx.quadraticCurveTo(0, my + 0.62 * R, 0.1 * R, my + 0.5 * R); ctx.lineTo(0.1 * R, my + 0.1 * R); }, '#e8707c', lw * 0.8);
    } else if (isBark) {
      const open = 0.43 * R * (1 + 0.1 * Math.sin(time * 40));
      line(0, 0.32 * R, 0, my, lw);
      shape(() => { ctx.moveTo(-0.56 * R, my); ctx.quadraticCurveTo(0, my + 0.1 * R, 0.56 * R, my);
                    ctx.quadraticCurveTo(0.5 * R, my + open * 2, 0, my + open * 2.05); ctx.quadraticCurveTo(-0.5 * R, my + open * 2, -0.56 * R, my); }, '#7a1410');
      ctx.save(); ctx.beginPath(); ctx.moveTo(-0.56 * R, my); ctx.quadraticCurveTo(0, my + 0.1 * R, 0.56 * R, my);
      ctx.quadraticCurveTo(0.5 * R, my + open * 2, 0, my + open * 2.05); ctx.quadraticCurveTo(-0.5 * R, my + open * 2, -0.56 * R, my); ctx.clip();
      fillEllipse(0, my + open * 1.75, 0.34 * R, 0.30 * R, '#e8707c');                                      // lưỡi
      ctx.fillStyle = '#fffdf2';
      for (let i = -3; i <= 3; i++) {                                                                        // răng trên
        const tx = i * 0.14 * R, big = Math.abs(i) === 2 || i === 0;
        ctx.beginPath(); ctx.moveTo(tx - 0.06 * R, my + 0.04 * R); ctx.lineTo(tx + 0.06 * R, my + 0.04 * R); ctx.lineTo(tx, my + (big ? 0.34 : 0.22) * R); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.5; ctx.stroke();
      }
      ctx.restore();
    } else if (mood === 'fierce') {                                                 // gầm gừ, nhe nanh
      line(0, 0.32 * R, 0, my, lw);
      shape(() => { ctx.moveTo(-0.5 * R, my + 0.05 * R); ctx.quadraticCurveTo(0, my + 0.34 * R, 0.5 * R, my + 0.05 * R);
                    ctx.quadraticCurveTo(0, my + 0.14 * R, -0.5 * R, my + 0.05 * R); }, '#7a1410');
      ctx.fillStyle = '#fffdf2';
      for (const sd of [-1, 1]) { ctx.beginPath(); ctx.moveTo(sd * 0.28 * R, my + 0.09 * R); ctx.lineTo(sd * 0.38 * R, my + 0.1 * R); ctx.lineTo(sd * 0.33 * R, my + 0.3 * R); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = lw * 0.5; ctx.stroke(); }
      // dấu gân giận trên trán
      ctx.save(); ctx.strokeStyle = '#c42a22'; ctx.lineWidth = lw * 1.1; ctx.lineCap = 'round';
      const ax = 0.72 * R, ay = -0.78 * R, a = 0.14 * R;
      ctx.beginPath(); ctx.moveTo(ax - a * 1.6, ay - a * 0.5); ctx.lineTo(ax + a * 1.6, ay - a * 0.5); ctx.moveTo(ax - a * 1.6, ay + a * 0.5); ctx.lineTo(ax + a * 1.6, ay + a * 0.5);
      ctx.moveTo(ax - a * 0.5, ay - a * 1.6); ctx.lineTo(ax - a * 0.5, ay + a * 1.6); ctx.moveTo(ax + a * 0.5, ay - a * 1.6); ctx.lineTo(ax + a * 0.5, ay + a * 1.6); ctx.stroke(); ctx.restore();
    } else if (mood === 'scared') {                                                 // miệng run
      line(0, 0.32 * R, 0, my, lw);
      ctx.save(); ctx.strokeStyle = INK; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.beginPath();
      for (let i = 0; i <= 8; i++) { const px = (-0.3 + i * 0.075) * R, py = my + 0.14 * R + (i % 2 ? -0.03 : 0.03) * R; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); }
      ctx.stroke(); ctx.restore();
      for (const [dx, dy, ph] of [[-1.15, -0.55, 0], [1.2, -0.25, 1.5]]) {                                   // giọt mồ hôi
        const t = ((time * 1.6 + ph) % 1), yy = dy * R + t * 0.5 * R;
        ctx.globalAlpha = 1 - t * 0.8; shape(() => { ctx.moveTo(dx * R, yy - 0.16 * R); ctx.quadraticCurveTo(dx * R + 0.12 * R, yy + 0.04 * R, dx * R, yy + 0.1 * R); ctx.quadraticCurveTo(dx * R - 0.12 * R, yy + 0.04 * R, dx * R, yy - 0.16 * R); }, '#bfe3f2', lw * 0.7);
        ctx.globalAlpha = 1;
      }
    } else {                                                                         // vui vẻ: miệng há cười + lưỡi
      line(0, 0.32 * R, 0, my, lw);
      shape(() => { ctx.moveTo(-0.34 * R, my); ctx.quadraticCurveTo(0, my + 0.08 * R, 0.34 * R, my); ctx.quadraticCurveTo(0.3 * R, my + 0.55 * R, 0, my + 0.56 * R); ctx.quadraticCurveTo(-0.3 * R, my + 0.55 * R, -0.34 * R, my); }, '#7a1410');
      ctx.save(); ctx.beginPath(); ctx.moveTo(-0.34 * R, my); ctx.quadraticCurveTo(0, my + 0.08 * R, 0.34 * R, my); ctx.quadraticCurveTo(0.3 * R, my + 0.55 * R, 0, my + 0.56 * R); ctx.quadraticCurveTo(-0.3 * R, my + 0.55 * R, -0.34 * R, my); ctx.clip();
      fillEllipse(0, my + 0.5 * R, 0.2 * R, 0.17 * R, '#ee7a86'); ctx.restore();
    }
    // chấm râu
    for (const sd of [-1, 1]) for (const [dx, dy] of [[0.4, 0.34], [0.5, 0.44], [0.34, 0.46]]) fillEllipse(sd * dx * R, dy * R, 0.022 * R, 0.022 * R, 'rgba(58,36,18,0.55)');
    ctx.restore();   // hết đầu
    ctx.restore();   // hết chó
  },

  // ── Sprite (ảnh từ assets/) ──────────────────────────

  /**
   * Vẽ nhân vật bằng ảnh. Gốc toạ độ = chân nhân vật (giữa, đáy ảnh).
   * @returns {boolean} true nếu đã vẽ bằng ảnh
   */
  _drawSprite(ctx, x, y, size, charData, facingRight, state, scale, time, opts = {}) {
    const sp = Assets.getSprite(charData.id, state);
    if (!sp) return false;
    const { img, cfg, exact } = sp;

    const isKO      = state === 'ko';
    const isBarking = state === 'bark';
    const dh = size * 1.45 * cfg.scale;
    const dw = dh * (img.naturalWidth / img.naturalHeight);
    const feetY = y + size * 0.48 + cfg.offsetY * size;

    const artFacesRight = cfg.facing !== 'left';
    const mirror = facingRight !== artFacesRight;

    ctx.save();
    ctx.translate(x, feetY);

    // Bóng dưới chân
    if (!opts.noShadow) {
      ctx.fillStyle = 'rgba(35,40,74,0.24)';
      ctx.beginPath();
      ctx.ellipse(0, 0, dw * 0.36 * scale, size * 0.07, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    if (opts.rot) { ctx.translate(0, -dh * 0.5 * scale); ctx.rotate(opts.rot); ctx.translate(0, dh * 0.5 * scale); }
    if (mirror) ctx.scale(-1, 1);
    ctx.scale(scale, scale);
    if (!isKO && !isBarking) ctx.translate(0, Math.sin(time * 2.4) * 3.5);   // nhún nhẹ khi đứng
    if (isKO && !exact && !opts.flying) ctx.rotate(-Math.PI * 0.45);                        // không có ko.png → tự ngã

    ctx.imageSmoothingEnabled = !cfg.pixelArt;

    if (state === 'damage' && exact === false) {
      // Không có damage.png → tô đỏ ảnh idle
      const tw = Math.ceil(dw), th = Math.ceil(dh);
      if (!_tintCanvas) _tintCanvas = document.createElement('canvas');
      if (_tintCanvas.width !== tw || _tintCanvas.height !== th) { _tintCanvas.width = tw; _tintCanvas.height = th; }
      const t = _tintCanvas.getContext('2d');
      t.clearRect(0, 0, tw, th);
      t.globalCompositeOperation = 'source-over';
      t.drawImage(img, 0, 0, tw, th);
      t.globalCompositeOperation = 'source-atop';
      t.fillStyle = 'rgba(255,60,60,0.45)';
      t.fillRect(0, 0, tw, th);
      ctx.drawImage(_tintCanvas, -dw / 2, -dh, dw, dh);
    } else {
      ctx.drawImage(img, -dw / 2, -dh, dw, dh);
    }
    ctx.restore();
    return true;
  },

  // ── Helpers ──────────────────────────────────────────

  _drawLeg(ctx, x, y, size, color, angle, widthScale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.fillStyle = color;
    // Thân chân
    const w = size * 0.11 * widthScale;
    const h = size * 0.22;
    ctx.beginPath();
    ctx.roundRect?.(-w / 2, 0, w, h, w * 0.4) || ctx.rect(-w / 2, 0, w, h);
    ctx.fill();
    // Bàn chân
    ctx.fillStyle = _darkenHex(color, 0.15);
    ctx.beginPath();
    ctx.ellipse(0, h + size * 0.02, w * 0.8, size * 0.06, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  },

  _drawEar(ctx, hx, hy, hr, color, earType, isBarking) {
    ctx.save();
    ctx.fillStyle = color;

    if (earType === 'pointy') {
      // Shiba / Corgi: tai nhọn dựng đứng
      const tilt = isBarking ? -0.15 : 0;
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.15, hy - hr * 0.75);
      ctx.lineTo(hx - hr * 0.55 + tilt * 10, hy - hr * 1.45);
      ctx.lineTo(hx + hr * 0.12, hy - hr * 0.85);
      ctx.closePath();
      ctx.fill();
      // Inner ear
      ctx.fillStyle = 'rgba(255,180,140,0.5)';
      ctx.beginPath();
      ctx.moveTo(hx - hr * 0.18, hy - hr * 0.8);
      ctx.lineTo(hx - hr * 0.48 + tilt * 8, hy - hr * 1.3);
      ctx.lineTo(hx + hr * 0.06, hy - hr * 0.9);
      ctx.closePath();
      ctx.fill();

    } else if (earType === 'floppy') {
      // Pug: tai rủ xuống, dẹt
      ctx.beginPath();
      ctx.ellipse(hx - hr * 0.5, hy + hr * 0.15, hr * 0.22, hr * 0.42, -0.35, 0, Math.PI * 2);
      ctx.fill();

    } else { // round
      // Chow Chow: tai nhỏ tròn
      ctx.beginPath();
      ctx.arc(hx - hr * 0.35, hy - hr * 0.85, hr * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  },

  // Vẽ background cho battle (stage-based)
  drawBackground(ctx, w, h, stage, time) {
    // Có ảnh nền trong assets/ → phủ kín (cover), ưu tiên bản dọc khi màn hình dọc
    const bg = Assets.getBackground(stage.id);
    if (bg) {
      const img = (h > w && bg.portrait) ? bg.portrait : bg.img;
      this._drawCover(ctx, w, h, img, bg.focusX, bg.focusY);
      return;
    }

    // Bãi biển (tranh vẽ tay màu dịu, giống video gốc)
    if (stage.id === 'beach') { SceneRenderer.drawBeach(ctx, w, h, time); return; }

    // Sky gradient
    const sky = ctx.createLinearGradient(0, 0, 0, h * 0.68);
    sky.addColorStop(0, stage.skyTop);
    sky.addColorStop(1, stage.skyBot);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h * 0.68);

    // Buildings
    this._drawBuildings(ctx, w, h, stage);

    // Ambient particles (dust)
    if (time) {
      ctx.save();
      ctx.fillStyle = stage.ambientColor;
      for (let i = 0; i < 6; i++) {
        const px = ((i * 137.5 + time * 15) % w);
        const py = h * 0.2 + Math.sin(time * 0.4 + i) * h * 0.2;
        const r  = 2 + Math.sin(i * 2.1) * 2;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Ground
    const grd = ctx.createLinearGradient(0, h * 0.67, 0, h);
    grd.addColorStop(0, stage.groundTop);
    grd.addColorStop(1, stage.groundBot);
    ctx.fillStyle = grd;
    ctx.fillRect(0, h * 0.67, w, h * 0.33);

    // Ground line
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.67);
    ctx.lineTo(w, h * 0.67);
    ctx.stroke();
  },

  /** Vẽ ảnh phủ kín khung, giữ tỉ lệ (như object-fit: cover) */
  _drawCover(ctx, w, h, img, focusX = 0.5, focusY = 0.5) {
    // Vẽ sẵn nền (đã co đúng cỡ màn hình) vào canvas phụ MỘT LẦN, các khung sau chỉ chép lại → nhẹ hơn nhiều trên máy yếu
    const dpr = ctx.getTransform().a || 1;
    const pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    const c = this._bgCache;
    if (!c || c.img !== img || c.pw !== pw || c.ph !== ph || c.fx !== focusX || c.fy !== focusY) {
      const cv = c?.cv || document.createElement('canvas');
      cv.width = pw; cv.height = ph;
      const x = cv.getContext('2d');
      const s  = Math.max(pw / img.naturalWidth, ph / img.naturalHeight);
      const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
      x.drawImage(img, (pw - dw) * focusX, (ph - dh) * focusY, dw, dh);
      this._bgCache = { cv, img, pw, ph, fx: focusX, fy: focusY };
    }
    ctx.drawImage(this._bgCache.cv, 0, 0, w, h);
  },

  _drawBuildings(ctx, w, h, stage) {
    const ground = h * 0.67;
    // Co giãn theo màn hình (điện thoại nhỏ → toà nhà nhỏ lại)
    const k = Math.max(0.45, Math.min(1, w / 1000, h / 700));
    // Fixed layout: left side and right side
    const buildings = [
      { x: -15 * k,      bw: 115 * k, bh: 215 * k, side: 'L' },
      { x: 85 * k,       bw: 80 * k,  bh: 165 * k, side: 'L' },
      { x: 148 * k,      bw: 95 * k,  bh: 200 * k, side: 'L' },
      { x: w - 100 * k,  bw: 115 * k, bh: 210 * k, side: 'R' },
      { x: w - 200 * k,  bw: 85 * k,  bh: 170 * k, side: 'R' },
      { x: w - 295 * k,  bw: 90 * k,  bh: 195 * k, side: 'R' },
    ];

    const windowLayout = [
      [10,12],[30,12],[50,12],
      [10,38],[30,38],[50,38],
      [10,64],[30,64],[50,64],
      [10,90],[30,90],[50,90],
    ];

    for (const b of buildings) {
      const by = ground - b.bh;
      // Main building
      ctx.fillStyle = stage.buildingColor;
      ctx.fillRect(b.x, by, b.bw, b.bh);
      // Highlight edge
      ctx.fillStyle = stage.buildingHighlight;
      ctx.fillRect(b.x, by, 4 * k, b.bh);
      // Roof accent
      ctx.fillStyle = stage.buildingHighlight;
      ctx.fillRect(b.x, by, b.bw, 6 * k);
      // Windows (fixed positions)
      ctx.fillStyle = stage.windowColor;
      for (const [wx, wy] of windowLayout) {
        const wx2 = b.x + wx * k;
        if (wx2 + 12 * k < b.x + b.bw - 5 * k && by + wy * k + 14 * k < ground - 5 * k) {
          ctx.fillRect(wx2, by + wy * k, 12 * k, 14 * k);
        }
      }
    }
  },
};

// ── Local utility ────────────────────────────────────
function _darkenHex(hex, amount) {
  try {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    const d = 1 - amount;
    return `rgb(${Math.round(r*d)},${Math.round(g*d)},${Math.round(b*d)})`;
  } catch {
    return hex;
  }
}
