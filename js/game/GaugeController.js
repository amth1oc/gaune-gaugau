/**
 * GaugeController.js — Thanh kéo co (tug-of-war gauge)
 *
 * Giá trị: 0.0 = player thắng, 100.0 = AI thắng, 50.0 = giữa.
 *
 * Công thức lực đẩy mỗi lần sủa:
 *   force = volume × PUSH_BASE × powerMult × comboMult
 *           + (barkInCombo × BARK_COUNT_BONUS)
 */
import { CharStats } from './CharStats.js';
import { CONFIG } from '../data/config.js';

export class GaugeController {
  constructor() {
    this.value = CONFIG.GAUGE.START; // 50.0
    this._displayValue = CONFIG.GAUGE.START; // Smooth display version
  }

  /** Đặt giá trị trực tiếp (guest online nhận số từ host) */
  setValue(v) {
    if (!Number.isFinite(v)) return;            // dữ liệu mạng thiếu/sai → bỏ qua, không làm hỏng thanh lực
    this.value = Math.max(CONFIG.GAUGE.MIN, Math.min(CONFIG.GAUGE.MAX, v));
  }

  reset() {
    this.value = CONFIG.GAUGE.START;
    this._displayValue = CONFIG.GAUGE.START;
  }

  /**
   * Player sủa → đẩy gauge về phía AI (value giảm).
   * @param {number} volume - RMS peak [0,1]
   * @param {object} charData - Character data (stats.power)
   * @param {number} comboMult - Hệ số combo (1.0 → 3.0)
   * @param {number} comboCount - Số bark trong combo (bonus)
   * @param {number} tempoMult - Thưởng nhịp nhanh theo speed (CharStats.tempoMult)
   * @returns {number} Lực đẩy thực tế
   */
  pushByPlayer(volume, charData, comboMult = 1.0, comboCount = 1, tempoMult = 1.0) {
    const force = this._calcForce(volume, charData, comboMult, comboCount, tempoMult);
    this.value = Math.max(CONFIG.GAUGE.MIN, this.value - force);
    return force;
  }

  /**
   * AI sủa → đẩy gauge về phía player (value tăng).
   */
  pushByAI(volume, charData, comboMult = 1.0, comboCount = 1, tempoMult = 1.0) {
    const force = this._calcForce(volume, charData, comboMult, comboCount, tempoMult);
    this.value = Math.min(CONFIG.GAUGE.MAX, this.value + force);
    return force;
  }

  /**
   * Tính lực đẩy.
   * force = volume × PUSH_BASE × powerMult + barkBonus
   */
  _calcForce(volume, charData, comboMult, comboCount, tempoMult = 1.0) {
    const { PUSH_BASE, BARK_COUNT_BONUS, BARK_BONUS_CAP } = CONFIG.GAUGE;

    // Hệ số power (stat 1-5, normalize về 1.0 ở mức 3)
    const powerMult = charData ? CharStats.powerMult(charData) : 1.0;

    // Special của nhân vật
    let specialMult = 1.0;
    if (charData?.special === 'heavyHitter' && comboCount < 2) {
      specialMult = CONFIG.STATS.HEAVY_HITTER_MULT; // Pug: nhỉnh hơn một chút khi combo chưa cao
    } else if (charData?.special === 'volumeBoost') {
      volume = Math.min(1, volume * CONFIG.STATS.VOLUME_BOOST_MULT); // Chow: amplify volume
    }

    const baseForce = volume * PUSH_BASE * powerMult * specialMult * tempoMult;
    const comboForce = baseForce * comboMult;
    // Giới hạn combo tính bonus để không cuốn tuyết vô hạn
    // Thưởng combo TỈ LỆ theo âm lượng: sủa nhỏ spam không còn được cộng phẳng như sủa to
    const loud = Math.max(0.25, Math.min(1.5, volume / 0.25));
    const barkBonus = (Math.min(comboCount, BARK_BONUS_CAP) - 1) * BARK_COUNT_BONUS * loud;

    return Math.max(0, comboForce + barkBonus);
  }

  /** Cộng bù lực khi đỉnh thật của tiếng sủa to hơn lúc bắn (không tăng combo). */
  boostByPlayer(extraVol, charData, mult = 1.0) {
    const f = Math.max(0, extraVol) * CONFIG.GAUGE.PUSH_BASE * (charData ? CharStats.powerMult(charData) : 1) * mult;
    this.value = Math.max(CONFIG.GAUGE.MIN, this.value - f);
    return f;
  }
  boostByAI(extraVol, charData, mult = 1.0) {
    const f = Math.max(0, extraVol) * CONFIG.GAUGE.PUSH_BASE * (charData ? CharStats.powerMult(charData) : 1) * mult;
    this.value = Math.min(CONFIG.GAUGE.MAX, this.value + f);
    return f;
  }

  /**
   * Gauge dần drift về giữa khi không có ai sủa.
   * @param {number} dt - ms
   */
  update(dt) {
    const { DECAY_TO_CENTER } = CONFIG.GAUGE;
    const center = 50;
    const diff = center - this.value;
    // Lò xo kéo về giữa: càng lệch xa càng bị kéo mạnh (không hề "rất chậm")
    this.value += diff * DECAY_TO_CENTER * (dt / 1000);

    this.settle(dt);
  }

  /** Chỉ làm mượt giá trị hiển thị (dùng cả khi trận đã kết thúc) */
  settle(dt) {
    const k = 1 - Math.pow(0.85, dt / 16);   // độc lập tốc độ khung hình
    this._displayValue += (this.value - this._displayValue) * k;
  }

  /** Giá trị smooth cho UI display */
  get displayValue() { return this._displayValue; }

  isPlayerWin() { return this.value <= CONFIG.GAUGE.MIN; }
  isAIWin()     { return this.value >= CONFIG.GAUGE.MAX; }

  /** Ai đang dẫn? Returns 'player' | 'ai' | 'tie' */
  getLeader() {
    if (this.value < 48) return 'player';
    if (this.value > 52) return 'ai';
    return 'tie';
  }
}
