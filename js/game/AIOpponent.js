/**
 * AIOpponent.js — Bot đối thủ (v15: mạnh hơn, sủa theo ĐỢT như người thật)
 *
 * Trước đây bot sủa ngẫu nhiên đều đều (700–2600ms/tiếng) và combo cố định → người sủa ≥2 tiếng/giây thắng 100%
 * ngay cả ở độ khó 5. Nay bot:
 *   • sủa theo từng ĐỢT: vài tiếng dồn (nhịp 270–480ms) rồi nghỉ, đợt dài/dồn hơn khi độ khó cao;
 *   • có COMBO thật (ComboSystem) → hệ số nhân và thưởng nhịp nhanh như người chơi; độ khó thấp giữ combo ngắn;
 *   • "đuổi theo": khi đang bị dẫn trước, bot nghỉ ít hơn và dồn hơn (tăng dần theo cấp) → trận kịch tính hơn, khó thắng nhàn;
 *   • âm lượng tăng theo độ khó (có dao động tự nhiên, thỉnh thoảng một tiếng rất to).
 * Độ khó 1.0 (dễ, người mới) → 5.0 (rất khó). Mọi thông số nằm trong CONFIG.AI.
 */
import { CONFIG } from '../data/config.js';
import { CharStats } from './CharStats.js';
import { ComboSystem } from './ComboSystem.js';

const lerp = (a, b, t) => a + (b - a) * t;
const rnd = (a, b) => a + Math.random() * (b - a);

export class AIOpponent {
  /**
   * @param {number} difficulty - 1.0 (dễ) → 5.0 (khó)
   * @param {object} charData - dữ liệu nhân vật của bot (speed/combo/power ảnh hưởng nhịp, combo, lực)
   */
  constructor(difficulty = 1.0, charData = null) {
    this.difficulty = Math.max(1, Math.min(5, difficulty));
    this.charData = charData;
    this.active = false;

    /** Callback khi AI sủa: (volume: number) => void */
    this.onBark = null;

    this.combo = this._freshCombo();

    this._wait = 0;        // ms còn lại đến tiếng kế tiếp
    this._left = 0;        // số tiếng còn lại trong đợt
    this._lead = 0;        // gauge lệch về phía NGƯỜI CHƠI bao nhiêu (0..50) → bot đuổi theo
    this._scheduleBurst(true);
  }

  get _t() { return (this.difficulty - 1) / 4; }

  start() { this.active = true; this._left = 0; this._scheduleBurst(true); this.combo = this._freshCombo(); }
  stop() { this.active = false; }

  _freshCombo() {
    const A = CONFIG.AI, cd = this.charData;
    const w = cd ? CharStats.comboWindowMs(cd) : 2250, s = cd ? CharStats.comboStep(cd) : 0.2;
    const c = new ComboSystem(w * lerp(A.COMBO_WINDOW_FRAC_MIN, 1, this._t), s, CONFIG.MIC.COMBO_MAX_MULT);
    if (cd?.special === 'fastCombo') c.applyFastCombo?.(CONFIG.STATS.FAST_COMBO_WINDOW_MULT);
    return c;
  }

  /**
   * Gọi mỗi frame.
   * @param {number} dt - ms
   * @param {number} [gauge] - giá trị gauge hiện tại (0 = người chơi thắng … 100 = bot thắng); có thì bot biết đang thua để đuổi theo
   */
  update(dt, gauge) {
    if (!this.active) return;
    if (typeof gauge === 'number') this._lead = Math.max(0, 50 - gauge);      // gauge < 50 = người chơi đang dẫn
    this.combo.update(dt);
    this._wait -= dt;
    if (this._wait <= 0) {
      this._doBark();
      if (--this._left > 0) this._wait = this._intraGap();
      else this._scheduleBurst(false);
    }
  }

  _doBark() {
    this.combo.addBark();
    this.onBark?.(this._randomVolume());
  }

  /** Hệ số nhịp của nhân vật bot: Corgi sủa dồn, Pug sủa chậm (Shiba = ×1.0). */
  get _speedMult() { return this.charData ? CharStats.barkCooldownMs(this.charData) / 350 : 1; }

  /** Mức "đuổi theo" 0..1: tăng dần theo độ khó và khi gauge lệch hẳn về phía người chơi. */
  get _chase() {
    const A = CONFIG.AI;
    if (this.difficulty <= 1) return 0;
    return Math.min(1, this._lead / A.CHASE_FULL_AT) * A.CHASE_STRENGTH * Math.min(1, (this.difficulty - 1) / 3);
  }

  _intraGap() { return lerp(CONFIG.AI.INTRA_SLOW_MS, CONFIG.AI.INTRA_FAST_MS, this._t) * this._speedMult * rnd(0.85, 1.2) * (1 - this._chase * 0.25); }

  _scheduleBurst(first) {
    const A = CONFIG.AI, t = this._t;
    const nMin = Math.round(lerp(A.BURST_MIN_LOW, A.BURST_MIN_HIGH, t));
    const nMax = Math.round(lerp(A.BURST_MAX_LOW, A.BURST_MAX_HIGH, t));
    this._left = Math.max(1, Math.round(rnd(nMin, nMax + 0.49)));
    const gap = lerp(A.GAP_SLOW_MS, A.GAP_FAST_MS, t) * this._speedMult * rnd(0.7, 1.3) * (1 - this._chase * 0.5);
    this._wait = first ? Math.max(700, gap * 0.6) : gap;
  }

  _randomVolume() {
    const A = CONFIG.AI, t = this._t;
    const mean = lerp(A.VOL_MEAN_LOW, A.VOL_MEAN_HIGH, t) * (1 + this._chase * 0.15);
    let v = mean + (Math.random() + Math.random() + Math.random() - 1.5) * 2 * A.VOL_SPREAD;   // gần chuẩn, dao động tự nhiên
    if (Math.random() < A.BIG_BARK_CHANCE * (0.4 + t)) v *= 1.45;                              // thỉnh thoảng một tiếng rất to
    return Math.max(A.BASE_VOLUME_MIN, Math.min(A.BASE_VOLUME_MAX, v));                        // (power của nhân vật đã được GaugeController áp, không nhân đôi)
  }

  /** Tăng độ khó (gọi sau mỗi trận thắng) */
  increaseDifficulty(amount = 0.15) {
    this.difficulty = Math.min(5, this.difficulty + amount);
  }

  get currentDifficulty() { return this.difficulty; }

  /** Combo thật của bot (đếm các tiếng sủa liên tiếp còn trong cửa sổ combo). */
  get comboCount() { return Math.max(1, this.combo.count); }
}
