/**
 * CharStats.js — Biến chỉ số nhân vật (1–5) thành thông số chơi thật.
 *
 *   power (sức mạnh) → lực mỗi tiếng sủa          (xử lý ở GaugeController)
 *   speed (tốc độ)   → (1) thưởng nhịp nhanh: sủa liền nhau thì lực cao hơn (mọi chế độ)
 *                      (2) thời gian nghỉ giữa 2 tiếng của nút chạm + nhịp sủa của AI
 *                      Mic KHÔNG bị chặn bởi speed: 1 tiếng sủa thật = 1 tiếng sủa trong game.
 *   combo            → cửa sổ giữ combo + hệ số nhân mỗi bậc (cao = lên combo bền & nhanh)
 *
 * Chỉ số 3 = giá trị mặc định cũ của game, nên Shiba (3/3/3) chơi y như trước.
 * Muốn chỉnh độ chênh lệch: sửa CONFIG.STATS trong js/data/config.js.
 */
import { CONFIG } from '../data/config.js';

const lerp = (a, b, t) => a + (b - a) * t;
/** 1..5 → 0..1 */
const t = (v) => (Math.max(1, Math.min(5, v)) - 1) / 4;

export const CharStats = {
  /** Hệ số lực mỗi tiếng sủa từ chỉ số power (3 → ×1.0). */
  powerMult(char) {
    return Math.max(0.3, 1 + (char.stats.power - 3) * CONFIG.STATS.POWER_STEP);
  },

  /**
   * Hệ số lực thưởng khi sủa liền nhau (1.0 = không thưởng).
   * @param {number|null} intervalMs ms kể từ tiếng sủa trước (null = tiếng đầu tiên)
   */
  tempoMult(char, intervalMs) {
    if (intervalMs == null || !(intervalMs >= 0)) return 1;
    const S = CONFIG.STATS;
    const fall = Math.max(1, S.TEMPO_WINDOW_MS - S.TEMPO_FULL_MS);
    const closeness = Math.max(0, Math.min(1, (S.TEMPO_WINDOW_MS - intervalMs) / fall));
    return 1 + S.TEMPO_MAX * t(char.stats.speed) * closeness;
  },

  /** Thời gian nghỉ sau mỗi tiếng sủa (ms) — dùng cho NÚT CHẠM và nhịp AI, không dùng cho mic. */
  barkCooldownMs(char) {
    const S = CONFIG.STATS;
    return lerp(S.COOLDOWN_SLOW_MS, S.COOLDOWN_FAST_MS, t(char.stats.speed));
  },

  /** Cửa sổ giữ combo (ms) — chưa tính special fastCombo. */
  comboWindowMs(char) {
    const S = CONFIG.STATS;
    return lerp(S.COMBO_WINDOW_LOW_MS, S.COMBO_WINDOW_HIGH_MS, t(char.stats.combo));
  },

  /** Hệ số nhân cộng thêm mỗi bậc combo. */
  comboStep(char) {
    const S = CONFIG.STATS;
    return lerp(S.COMBO_STEP_LOW, S.COMBO_STEP_HIGH, t(char.stats.combo));
  },

  /** Dùng cho màn chọn nhân vật: mô tả bằng chữ. */
  describe(char) {
    const cd  = Math.round(this.barkCooldownMs(char));
    let win   = this.comboWindowMs(char);
    if (char.special === 'fastCombo') win *= CONFIG.STATS.FAST_COMBO_WINDOW_MULT;
    return {
      cooldownMs: cd,
      windowSec: (win / 1000).toFixed(1),
      step: this.comboStep(char).toFixed(2),
      tempoPct: Math.round(CONFIG.STATS.TEMPO_MAX * t(char.stats.speed) * 100),
    };
  },
};
