/**
 * MenuHero.js — Hai chú chó đối mặt nhau ở đầu menu: nhún nhảy kiểu hoạt hình (co dãn khi chạm đất),
 * thỉnh thoảng một chú sủa. Mỗi lần mở menu bốc ngẫu nhiên 2 chú trong danh sách nhân vật.
 */
import { DogRenderer } from '../rendering/DogRenderer.js';
import { CHARACTERS }  from '../data/characters.js';
import { Perf }        from '../core/Perf.js';

export class MenuHero {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas?.getContext('2d') || null;
    this._raf = null;
    this._t0 = 0;
    this._pair = null;
  }

  _pick() {
    const pool = CHARACTERS.slice();
    const a = pool.splice(Math.floor(Math.random() * pool.length), 1)[0];
    const b = pool.length ? pool[Math.floor(Math.random() * pool.length)] : a;
    this._pair = [a, b];
  }

  start() {
    if (!this.ctx || this._raf) return;
    this._pick();
    this._t0 = performance.now();
    let last = 0;
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      if (now - last < 1000 / (Perf.lite ? 24 : 45)) return;      // menu không cần 60fps
      last = now; this._draw((now - this._t0) / 1000);
    };
    this._raf = requestAnimationFrame(loop);
  }

  stop() { if (this._raf) cancelAnimationFrame(this._raf); this._raf = null; }

  _draw(t) {
    const { ctx, canvas } = this;
    const w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    if (!this._pair) return;

    const size = h * 0.52, feet = h * 0.94, y = feet - size * 0.48;
    const dogs = [
      { ch: this._pair[0], x: w * 0.28, right: true,  ph: 0 },
      { ch: this._pair[1], x: w * 0.72, right: false, ph: 1.7 },
    ];
    for (const d of dogs) {
      const cyc  = (t * 0.9 + d.ph) % 3;                       // vòng 3 nhịp: đứng gầm gừ, đứng, SỦA
      const bark = cyc > 2.2 && cyc < 2.7;
      const k    = bark ? Math.sin((cyc - 2.2) / 0.5 * Math.PI) : 0;          // 0→1→0 trong lúc sủa
      const breath = Math.sin(t * 2.2 + d.ph) * 0.012;
      const shake = bark ? (Math.random() - 0.5) * 5 : 0;
      const sc = 1 + k * 0.2 + breath;                          // phình to khi sủa, như trong trận

      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.ellipse(d.x, feet, size * (0.42 + k * 0.1), size * 0.05, 0, 0, 7); ctx.fill();

      ctx.save();
      ctx.translate(shake, 0);
      DogRenderer.draw(ctx, d.x, y, size, d.ch, d.right, bark ? 'bark' : 'idle', sc, t, { dom: k * 0.6, noShadow: true });
      ctx.restore();

      if (k > 0.1) {                                            // vạch xung kích cam-vàng quanh miệng
        ctx.save(); ctx.strokeStyle = `rgba(243,210,122,${k})`; ctx.lineWidth = 3; ctx.lineCap = 'round';
        const mx = d.x + (d.right ? 1 : -1) * size * 0.72, my = feet - size * 0.95;
        for (let i = -1; i <= 1; i++) {
          const ang = i * 0.45 + (d.right ? 0 : Math.PI) , r0 = size * 0.14, r1 = size * (0.24 + k * 0.1);
          ctx.beginPath(); ctx.moveTo(mx + Math.cos(ang) * r0, my + Math.sin(ang) * r0 - size * 0.02); ctx.lineTo(mx + Math.cos(ang) * r1, my + Math.sin(ang) * r1 - size * 0.02); ctx.stroke();
        }
        ctx.restore();
      }
    }
  }
}
