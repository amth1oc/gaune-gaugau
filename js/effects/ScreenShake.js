/**
 * ScreenShake.js — Rung màn hình khi có tác động mạnh
 */
export class ScreenShake {
  /**
   * @param {HTMLElement} element - Element cần rung (thường là #screen-battle)
   */
  constructor(element) {
    this.element = element;
    this._intensity = 0;
    this._duration = 0;
    this._timer = 0;
    this._active = false;
    this._savedTransform = '';
  }

  /**
   * Trigger shake.
   * @param {number} intensity - Max pixel offset (default 10)
   * @param {number} durationMs - Bao lâu (ms)
   */
  shake(intensity = 10, durationMs = 350) {
    // Stack shake: lấy max intensity
    this._intensity = Math.max(this._intensity, intensity);
    this._duration = durationMs;
    this._timer = durationMs;
    this._active = true;
  }

  /**
   * Update mỗi frame.
   * @param {number} dt - ms
   */
  update(dt) {
    if (!this._active) return;

    this._timer -= dt;
    if (this._timer <= 0) {
      this._timer = 0;
      this._intensity = 0;
      this._active = false;
      this.element.style.transform = '';
      return;
    }

    // Progress: 1.0 → 0.0 (intensity giảm dần)
    const progress = this._timer / this._duration;
    const cur = this._intensity * progress;

    const x = (Math.random() - 0.5) * 2 * cur;
    const y = (Math.random() - 0.5) * 2 * cur;
    this.element.style.transform = `translate(${x}px, ${y}px)`;
  }

  stop() {
    this._active = false;
    this._timer = 0;
    this._intensity = 0;
    this.element.style.transform = '';
  }

  get isActive() { return this._active; }
}
