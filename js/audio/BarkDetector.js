/**
 * BarkDetector.js — Phát hiện tiếng sủa từ RMS stream
 *
 * Bark được tính NGAY khi âm lượng vượt ngưỡng (không chờ tiếng sủa kết thúc như trước),
 * để chó trong game sủa cùng lúc với người chơi.
 *
 *   IDLE      → rms ≥ threshold → DETECTING (bắt đầu đo đỉnh)
 *   DETECTING → sau peakWindowMs (hoặc sớm hơn nếu tiếng sủa tắt) → bắn onBark(peak) ngay
 *               rồi chờ rms < release mới được sủa tiếp (tiếng sủa kéo dài không bị tính 2 lần)
 *   COOLDOWN  → khoảng nghỉ chống nhiễu rất ngắn (cooldownMs) → IDLE
 *
 * Mỗi lần onBark = đúng 1 tiếng sủa. Không còn phụ thuộc chỉ số speed của chó.
 */
export class BarkDetector {
  /**
   * @param {object} options
   * @param {number} options.threshold    - RMS để bắt đầu detect
   * @param {number} options.release      - RMS để coi như tiếng sủa đã tắt
   * @param {number} options.cooldownMs   - nghỉ chống nhiễu sau khi tiếng sủa tắt (ms)
   * @param {number} options.peakWindowMs - thời gian đo đỉnh âm lượng sau khi vượt ngưỡng (ms)
   */
  constructor({ threshold = 0.05, release = 0.018, cooldownMs = 60, peakWindowMs = 45, topUpMs = 70, topUpRatio = 1.2 } = {}) {
    this.topUpMs = topUpMs; this.topUpRatio = topUpRatio;
    this._firedPeak = 0; this._boostLeft = 0; this._runPeak = 0;
    this.threshold = threshold;
    this.release = release;
    this.cooldownMs = cooldownMs;
    this.peakWindowMs = peakWindowMs;

    /** @type {'idle'|'detecting'|'cooldown'} */
    this._state = 'idle';
    this._peakVolume = 0;
    this._cooldownTimer = 0;
    this._maxDetectMs = 800; // tiếng kéo dài quá 800ms (ồn nền, hú) → ép kết thúc
    this._detectTimer = 0;
    this._fired = false;
    this._trough = Infinity;     // đáy âm lượng thấp nhất kể từ tiếng sủa vừa rồi
    this._sinceFire = 0;         // ms kể từ lần bắn gần nhất

    /** Callback khi phát hiện bark: (peakVolume: number) => void */
    this.onBark = null;
    /** Callback cộng bù: đỉnh thật (newPeak) to hơn rõ rệt so với lúc bắn (firedPeak) */
    this.onBoost = null;
  }

  _fire() {
    this._fired = true;
    this._sinceFire = 0;
    this._trough = Infinity;
    this._firedPeak = this._peakVolume; this._boostLeft = this.topUpMs;
    this._runPeak = this._peakVolume;     // đỉnh của tiếng vừa bắn: mốc để nhận ra tiếng sau (đáy tương đối)
    if (this.onBark && this._peakVolume >= this.threshold) this.onBark(this._peakVolume);
  }

  /** Hết cửa sổ theo dõi: nếu đỉnh thật to hơn hẳn lúc bắn thì báo để cộng bù lực. */
  _maybeBoost() {
    if (this._boostLeft <= 0) return;
    this._boostLeft = 0;
    if (this._fired && this._peakVolume >= this._firedPeak * this.topUpRatio) this.onBoost?.(this._firedPeak, this._peakVolume);
  }

  /**
   * Gọi mỗi frame với RMS lớn nhất kể từ frame trước.
   * @param {number} rms - [0.0, 1.0]
   * @param {number} dt  - ms từ frame trước
   * @param {number} [minRms] - âm lượng thấp nhất trong khung này (để thấy quãng nghỉ ngắn giữa 2 tiếng sủa dồn)
   */
  update(rms, dt, minRms = rms) {
    switch (this._state) {
      case 'idle':
        if (rms >= this.threshold) {
          this._state = 'detecting';
          this._peakVolume = rms;
          this._detectTimer = dt;          // tính luôn khung đầu → bắn sớm hơn 1 khung hình
          this._fired = false;
          // Khung đầu đã đủ đo đỉnh (hoặc frame dài) → bắn luôn, không trễ thêm
          if (dt >= this.peakWindowMs) this._fire();
        }
        break;

      case 'detecting': {
        const low = Math.min(rms, minRms);
        this._sinceFire += dt;
        if (this._fired) {
          if (low < this._trough) this._trough = low;
          // SỦA DỒN: âm lượng tụt xuống một đáy rồi vọt lên lại → tiếng sủa MỚI, dù chưa hề im hẳn
          // (sủa to/gần mic, phòng vang… thì giữa hai tiếng âm lượng không xuống tới ngưỡng release).
          if (rms > this._runPeak) this._runPeak = rms;
          // Đáy phải thấp hơn ngưỡng tuyệt đối HOẶC thấp hơn hẳn đỉnh vừa rồi (đáy TƯƠNG ĐỐI: sủa to/gần mic thì giữa hai tiếng
          // âm lượng chỉ tụt ~40–50% đỉnh, trước đây bị coi là 1 tiếng kéo dài → chó bỏ lỡ gần hết các tiếng sủa nhanh).
          // Và tiếng sau phải vọt lên gần bằng đỉnh trước (≥80%) để không nhận nhầm đuôi tiếng vang/gợn sóng khi tiếng đang tắt dần.
          const deepDip = this._trough <= this.threshold * 0.75 || this._trough <= this._runPeak * 0.6;
          const climbed = rms >= this._trough * 1.5 && (this._trough <= this.threshold * 0.75 ? rms >= this._trough * 1.8 : rms >= this._runPeak * 0.8);
          if (this._sinceFire >= 60 && deepDip && rms >= this.threshold && climbed) {
            this._maybeBoost();
            this._peakVolume = rms;
            this._detectTimer = dt;
            this._fired = false;
            if (dt >= this.peakWindowMs) this._fire();
            break;
          }
        }
        if (rms > this._peakVolume) this._peakVolume = rms;
        this._detectTimer += dt;
        if (this._fired && this._boostLeft > 0) { this._boostLeft -= dt; if (this._boostLeft <= 0) { this._boostLeft = 1e-6; this._maybeBoost(); } }

        // Đo đỉnh đủ lâu → bắn bark NGAY (người chơi chưa cần sủa xong)
        if (!this._fired && this._detectTimer >= this.peakWindowMs) this._fire();

        // Tiếng sủa tắt (hoặc kéo quá dài) → sẵn sàng cho tiếng tiếp theo
        if (low < this.release || this._detectTimer >= this._maxDetectMs) {
          if (!this._fired) this._fire();          // sủa ngắn hơn cửa sổ đo đỉnh
          else this._maybeBoost();
          this._peakVolume = 0;
          this._detectTimer = 0;
          this._cooldownTimer = this.cooldownMs;
          this._state = 'cooldown';
        }
        break;
      }

      case 'cooldown':
        this._cooldownTimer -= dt;
        if (this._cooldownTimer <= 0) {
          this._state = 'idle';
          this._cooldownTimer = 0;
        }
        break;
    }
  }

  /** Cập nhật threshold dựa trên setting (level 1-10) */
  setThresholdLevel(level) {
    // Level 1 = 0.02 (rất nhạy), Level 10 = 0.15 (cần sủa to)
    this.threshold = 0.02 + (level - 1) * 0.014;
    this.release   = this.threshold * 0.35;
  }

  get state() { return this._state; }
  get isDetecting() { return this._state === 'detecting'; }
  get isCoolingDown() { return this._state === 'cooldown'; }

  reset() {
    this._state = 'idle';
    this._peakVolume = 0;
    this._cooldownTimer = 0;
    this._detectTimer = 0;
    this._fired = false;
    this._firedPeak = 0; this._boostLeft = 0; this._runPeak = 0;
    this._trough = Infinity;
    this._sinceFire = 0;
  }
}
