/**
 * ParticleSystem.js — Hệ thống particle vẽ trên Canvas
 *
 * Mỗi particle là mảnh nhỏ (hình chữ nhật xoay) bị trọng lực kéo xuống.
 * Spawn khi bark mạnh.
 */
const MAX_PARTICLES = 220;

export class ParticleSystem {
  /**
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
    /** @type {Particle[]} */
    this._particles = [];
  }

  /**
   * Tạo particles tại vị trí (x, y).
   * @param {number} x
   * @param {number} y
   * @param {object} opts
   * @param {number}   [opts.count=12]
   * @param {string}   [opts.color='hsl(35, 90%, 60%)']
   * @param {number}   [opts.speed=6]
   * @param {number}   [opts.spread=Math.PI*2]  - Góc spread (radian)
   * @param {number}   [opts.angle=0]            - Hướng trung tâm (radian)
   */
  emit(x, y, opts = {}) {
    const count    = opts.count  ?? 12;
    const color    = opts.color  ?? 'hsl(35, 90%, 60%)';
    const speed    = opts.speed  ?? 6;
    const spread   = opts.spread ?? Math.PI * 2;
    const baseAngle = opts.angle ?? -Math.PI * 0.5; // lên trên mặc định

    const room = MAX_PARTICLES - this._particles.length;     // trần: sủa dồn không làm vẽ hạt ngày càng nặng
    for (let i = 0, n = Math.min(count, room); i < n; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const v = speed * (0.5 + Math.random() * 0.8);
      this._particles.push({
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v - 2,
        life: 1.0,
        decay: 0.018 + Math.random() * 0.025,
        width:  4 + Math.random() * 10,
        height: 2 + Math.random() * 4,
        color,
        gravity: 0.25,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.18,
      });
    }
  }

  /**
   * Gọi mỗi frame để update vật lý.
   * @param {number} dt - ms
   */
  update(dt) {
    const scale = dt / 16; // Normalize to 60fps
    const arr = this._particles;
    let w = 0;                                   // nén mảng tại chỗ: không tạo mảng mới mỗi khung hình
    for (let i = 0; i < arr.length; i++) {
      const p = arr[i];
      p.x  += p.vx * scale;
      p.y  += p.vy * scale;
      p.vy += p.gravity * scale;
      p.vx *= 0.98; // Air resistance nhẹ
      p.life -= p.decay * scale;
      p.rotation += p.rotSpeed * scale;
      if (p.life > 0) arr[w++] = p;
    }
    arr.length = w;
  }

  /**
   * Vẽ tất cả particles lên canvas.
   */
  draw() {
    const ctx = this.ctx;
    ctx.save();
    for (const p of this._particles) {
      ctx.save();
      ctx.globalAlpha = p.life;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      ctx.restore();
    }
    ctx.restore();
  }

  /** Xóa tất cả particles */
  clear() {
    this._particles = [];
  }

  get count() { return this._particles.length; }
}
