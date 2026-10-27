/**
 * MicNormalizer.js — Quy âm lượng mic về cùng một thang, để "sủa to" của máy nào cũng như nhau.
 *
 * Mic điện thoại / laptop / tai nghe chênh nhau vài lần về độ nhạy (autoGain tắt). Nếu dùng thẳng RMS thì
 * ai có mic nhạy hơn sẽ mạnh hơn hẳn — đặc biệt bất công khi chơi online.
 * Cách làm: nhớ mức "sủa to" của CHÍNH người chơi (phân vị 85 của các tiếng sủa gần đây, lưu qua các trận)
 * rồi quy về TARGET. Sủa nhỏ hơn mức của mình vẫn ra lực nhỏ, sủa to hơn thì ra lực lớn → vẫn là kỹ năng người chơi.
 */
const KEY = 'chosua_mic_ref';
const DEFAULT_REF = 0.30;
const TARGET = 0.35;
const MIN_REF = 0.04, MAX_REF = 0.9;

export class MicNormalizer {
  constructor() {
    let base = DEFAULT_REF;
    try { const v = parseFloat(localStorage.getItem(KEY)); if (v > MIN_REF && v < MAX_REF) base = v; } catch {}
    this.base = base; this.ref = base; this.samples = []; this._n = 0;
  }

  /** Ghi nhận một tiếng sủa (raw RMS) để cập nhật mức tham chiếu. */
  learn(raw) {
    if (!(raw >= 0.03)) return;
    this.samples.push(raw);
    if (this.samples.length > 40) this.samples.shift();
    if (this.samples.length < 4) return;
    const sorted = [...this.samples].sort((a, b) => a - b);
    const p85 = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.85))];
    const w = Math.min(1, this.samples.length / 12);                // càng nhiều mẫu càng tin mẫu mới
    this.ref = Math.max(MIN_REF, Math.min(MAX_REF, this.base * (1 - w) + p85 * w));
    if (++this._n % 10 === 0) this.save();
  }

  /** raw RMS → âm lượng chuẩn hoá [0.03, 0.8]. */
  scale(raw) { return Math.max(0.03, Math.min(0.8, raw / this.ref * TARGET)); }

  /** Đặt thẳng mức tham chiếu (sau bước chuẩn hoá mic lúc mới vào game). */
  setRef(v) {
    if (!(v > 0)) return;
    this.base = this.ref = Math.max(MIN_REF, Math.min(MAX_REF, v));
    this.samples = []; this.save();
  }

  save() { try { localStorage.setItem(KEY, this.ref.toFixed(4)); } catch {} }
}
