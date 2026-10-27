/**
 * BarkTextEffect.js — Chữ sủa bay ra màn hình, DÀY ĐẶC và chồng lên nhau như video gốc
 *
 * Mỗi tiếng sủa tạo hàng chục chữ: nhiều kiểu chữ (Việt + Anh), nhiều cỡ, nhiều góc xoay
 * (có chữ dọc), phun ra từ đầu con chó đang sủa, kèm các vệt gạch vàng bắn tia.
 * Dùng Web Animations API → không cần CSS keyframes riêng cho từng chữ.
 */
import { CONFIG } from '../data/config.js';
import { Perf }   from '../core/Perf.js';

const FONTS = [
  "'Baloo 2','Be Vietnam Pro',Impact,sans-serif",
  "'Lobster','Baloo 2',cursive",
  "'Be Vietnam Pro',Impact,sans-serif",
  "Impact,'Baloo 2',sans-serif",
];
const VIET  = ['GÂU!', 'GÂU GÂU!', 'GÂU!!', 'ẲNG!', 'GẦM!', 'AU AU!', 'GÂUUU!', 'SỦA!', 'GRỪ!', 'ÔNG ỔNG!'];
const LATIN = ['WOOF!', 'BARK!', 'BOW!', 'ARF!', 'GRRR!', 'WOOF WOOF!', 'YAP!', 'HOWL!'];

// Bảng màu: bạn = vàng/cam/trắng, đối thủ = đỏ/cam sẫm/trắng ngà
const PAL_PLAYER = ['#ffd21f', '#ffe066', '#ffbf1f', '#fff3b0', '#ff9d1f', '#e32b1c', '#ffffff'];
const PAL_AI     = ['#e32b1c', '#ff4d2e', '#ff8a3c', '#ffe9b0', '#b3140f', '#ffd21f'];

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const rand = (a, b) => a + Math.random() * (b - a);

export class BarkTextEffect {
  constructor(container) {
    this.container = container;
    this._ts = [];      // thời điểm các lần phun gần đây (để giảm số chữ khi sủa dồn)
  }

  /**
   * Phun chữ ra từ vị trí `origin` (đầu con chó đang sủa).
   * @param {string} text      - chữ chính của nhân vật (vd 'GÂU!')
   * @param {'left'|'right'} side
   * @param {number} volume    - 0..1 (to → nhiều chữ hơn, chữ lớn hơn)
   * @param {object} charData  - nhân vật (để lấy từ riêng)
   * @param {{x:number,y:number}} [origin]
   */
  spawnBurst(text, side, volume, charData = null, origin = null) {
    const cw = this.container.clientWidth  || window.innerWidth;
    const ch = this.container.clientHeight || window.innerHeight;
    const isLeft = side === 'left';
    const ox = origin?.x ?? (isLeft ? cw * 0.22 : cw * 0.78);
    const oy = origin?.y ?? ch * 0.55;
    const unit = Math.max(0.55, Math.min(1.25, Math.min(cw / 900, ch / 560)));   // co theo màn hình

    const { BARK_TEXT_BASE, BARK_TEXT_PER_VOL, BARK_TEXT_MAX_ALIVE } = CONFIG.EFFECTS;
    const nowT = performance.now();
    this._ts = this._ts.filter(t => nowT - t < 1000); this._ts.push(nowT);
    const rate = this._ts.length;                                    // số lần phun trong 1 giây qua
    const crowd = rate > 8 ? 0.4 : rate > 5 ? 0.65 : 1;              // sủa dồn → mỗi tiếng ít chữ hơn (đỡ tạo hàng trăm phần tử DOM)
    let n = Math.round((BARK_TEXT_BASE + Math.min(1, volume * 1.5) * BARK_TEXT_PER_VOL) * Perf.fx * crowd);
    if (!isLeft) n = Math.round(n * 0.6);                           // đối thủ ít chữ hơn → bạn "ồn" hơn
    const room = Math.round(BARK_TEXT_MAX_ALIVE * Perf.fx) - this.container.childElementCount;
    n = Math.max(1, Math.min(n, room));   // luôn ít nhất 1 chữ chính: mỗi tiếng sủa đều phải thấy phản hồi (trước đây hết chỗ thì mất hẳn)

    const pal = isLeft ? PAL_PLAYER : PAL_AI;
    const words = [text, ...(charData?.barkWords || []), ...VIET, ...LATIN];

    for (let i = 0; i < n; i++) {
      const delay = i * rand(8, 22);
      const word  = i === 0 ? text : pick(words);
      const jp    = false;   // (không còn chữ dọc: chỉ dùng chữ Việt/Anh)
      const big   = i < 2;
      const size  = (big ? rand(3.2, 4.6) + volume * 1.8 : rand(1.0, 3.2)) * unit;    // rem
      // hướng bay: toả ra xung quanh, thiên về phía đối thủ/trên cao
      const ang   = rand(-Math.PI, Math.PI);
      const dist  = rand(40, 260) * unit * (0.5 + volume);
      const dx    = Math.cos(ang) * dist * 1.5 + (isLeft ? 1 : -1) * rand(0, 80) * unit;
      const dy    = Math.sin(ang) * dist * 0.8 - rand(0, 40) * unit;
      this._word(word, {
        x: ox + rand(-30, 30) * unit, y: oy + rand(-30, 30) * unit,
        dx, dy, size, delay, color: pick(pal),
        rot: rand(-55, 55), vertical: jp && Math.random() < 0.28,
        font: pick(FONTS), life: rand(650, 1250),
      });
    }

    // vệt gạch vàng bắn tia
    const streaks = Math.max(0, Math.min(room - n, Math.round((6 + volume * 12) * Perf.fx * crowd)));
    for (let i = 0; i < streaks; i++) this._streak(ox, oy, unit, isLeft);
  }

  _word(word, o) {
    const el = document.createElement('div');
    el.className = 'bark-word';
    el.textContent = word;
    el.style.cssText = `left:${o.x}px;top:${o.y}px;font-size:${o.size}rem;color:${o.color};font-family:${o.font};` +
                       (o.vertical ? 'writing-mode:vertical-rl;' : '');
    this.container.appendChild(el);
    const s0 = 0.2, s1 = 1 + Math.random() * 0.25;
    const anim = el.animate([
      { opacity: 0,   transform: `translate(-50%,-50%) rotate(${o.rot}deg) scale(${s0})` },
      { opacity: 1,   transform: `translate(calc(-50% + ${o.dx * 0.35}px),calc(-50% + ${o.dy * 0.35}px)) rotate(${o.rot}deg) scale(${s1})`, offset: 0.22 },
      { opacity: 0.9, transform: `translate(calc(-50% + ${o.dx * 0.8}px),calc(-50% + ${o.dy * 0.8}px)) rotate(${o.rot + rand(-8, 8)}deg) scale(${s1 * 0.95})`, offset: 0.7 },
      { opacity: 0,   transform: `translate(calc(-50% + ${o.dx}px),calc(-50% + ${o.dy}px)) rotate(${o.rot + rand(-14, 14)}deg) scale(${s1 * 0.8})` },
    ], { duration: o.life, delay: o.delay, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    anim.onfinish = () => el.remove();
  }

  _streak(ox, oy, unit, isLeft) {
    const el = document.createElement('div');
    el.className = 'bark-streak';
    const len = rand(26, 95) * unit, ang = rand(-Math.PI, Math.PI), dist = rand(60, 280) * unit;
    el.style.cssText = `left:${ox}px;top:${oy}px;width:${len}px;height:${rand(2, 5) * unit}px;` +
                       `background:${Math.random() < 0.8 ? (isLeft ? '#ffd21f' : '#ff7a2e') : '#fff3b0'};`;
    this.container.appendChild(el);
    const a = ang * 180 / Math.PI, dx = Math.cos(ang) * dist, dy = Math.sin(ang) * dist * 0.75;
    const anim = el.animate([
      { opacity: 0, transform: `translate(-50%,-50%) rotate(${a}deg) scaleX(0.2)` },
      { opacity: 1, transform: `translate(calc(-50% + ${dx * 0.4}px),calc(-50% + ${dy * 0.4}px)) rotate(${a}deg) scaleX(1)`, offset: 0.25 },
      { opacity: 0, transform: `translate(calc(-50% + ${dx}px),calc(-50% + ${dy}px)) rotate(${a}deg) scaleX(0.6)` },
    ], { duration: rand(420, 800), easing: 'ease-out', fill: 'both' });
    anim.onfinish = () => el.remove();
  }

  /** Chữ pop ở giữa màn hình (combo) */
  spawnComboText(text, x, y) {
    const el = document.createElement('div');
    el.className = 'combo-popup';
    el.textContent = text;
    el.style.cssText = `left: ${x}px; top: ${y}px;`;
    this.container.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }

  clear() {
    for (const a of this.container.getAnimations?.({ subtree: true }) || []) a.onfinish = null;
    this.container.innerHTML = '';
  }
}
