/**
 * ComboSystem.js — Theo dõi và tính combo bark liên tiếp
 *
 * Mỗi bark trong cửa sổ thời gian = +1 combo count.
 * Combo multiplier tăng theo count.
 * Nếu không bark trong windowMs → reset về 0.
 */
export class ComboSystem {
  /**
   * @param {number} windowMs - Thời gian giữ combo (ms)
   * @param {number} step - Tỉ lệ tăng multiplier mỗi bark
   * @param {number} maxMult - Multiplier tối đa
   */
  constructor(windowMs = 2200, step = 0.25, maxMult = 3.0) {
    this.windowMs = windowMs;
    this.step = step;
    this.maxMult = maxMult;

    this._count = 0;
    this._timer = 0;
    this._maxCount = 0; // Combo cao nhất trong trận
    this.active = false;
  }

  /**
   * Gọi khi có bark mới.
   * @returns {number} Combo count hiện tại (sau khi thêm)
   */
  addBark() {
    this._count++;
    this._timer = this.windowMs;
    this.active = true;
    if (this._count > this._maxCount) this._maxCount = this._count;
    return this._count;
  }

  /**
   * Tính hệ số nhân lực từ combo hiện tại.
   * - Combo 1: ×1.0
   * - Combo 2: ×1.25
   * - Combo 3: ×1.5
   * - Tối đa: ×3.0 (configurable)
   */
  getMultiplier() {
    if (!this.active || this._count < 2) return 1.0;
    const mult = 1.0 + (this._count - 1) * this.step;
    return Math.min(mult, this.maxMult);
  }

  /**
   * Gọi mỗi frame để giảm timer.
   * @param {number} dt - ms từ frame trước
   */
  update(dt) {
    if (!this.active) return;
    this._timer -= dt;
    if (this._timer <= 0) {
      this._count = 0;
      this._timer = 0;
      this.active = false;
    }
  }

  /** Thời gian còn lại của combo (0 → hết) */
  get timeRemainingPct() {
    if (!this.active) return 0;
    return Math.max(0, this._timer / this.windowMs);
  }

  get count() { return this._count; }
  get maxCount() { return this._maxCount; }

  reset() {
    this._count = 0;
    this._timer = 0;
    this._maxCount = 0;
    this.active = false;
  }

  /** Áp dụng special của character Corgi (faster combo) */
  applyFastCombo(mult = 1.5) {
    this.windowMs *= mult; // Cửa sổ rộng hơn → dễ combo hơn
  }
}
