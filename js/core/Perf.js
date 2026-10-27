/**
 * Perf.js — Tự điều chỉnh chất lượng theo sức máy để điện thoại yếu không lag / không nóng.
 *
 * 2 mức:
 *   'high' — đầy đủ hiệu ứng (tối đa 60fps, độ nét ≤ 1.75x)
 *   'lite' — máy yếu: 30fps, độ nét 1x, tắt kính mờ (backdrop-filter) + hoạt ảnh lặp vô hạn + bớt chữ/hạt hiệu ứng
 *
 * Người chơi chọn ở Cài đặt → Hiệu năng: Tự động (mặc định) | Tiết kiệm | Đẹp nhất.
 * Chế độ Tự động: đoán theo RAM/số nhân CPU, rồi ĐO fps thật trong trận; < 38fps thì tự chuyển sang 'lite' (và nhớ lại).
 */
const KEY_MODE = 'chosua_perf_mode';     // 'auto' | 'lite' | 'high'
const KEY_AUTO = 'chosua_perf_auto';     // kết quả đo lần trước: 'lite' | 'high'

const ls = {
  get(k)    { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

function guessTier() {
  const mem = navigator.deviceMemory;              // GB (Chrome/Android; iOS không có)
  const cores = navigator.hardwareConcurrency || 4;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection?.saveData;
  if (reduce || saveData) return 'lite';
  if (mem && mem <= 3) return 'lite';
  if (cores <= 4 && /Android/i.test(navigator.userAgent)) return 'lite';
  if (cores <= 2) return 'lite';                  // iPhone đời cũ (iOS không cho biết RAM) thường báo 2 nhân; máy 1–2 nhân khác cũng yếu
  return 'high';
}

export const Perf = {
  mode: 'auto',
  tier: 'high',

  init() {
    this.mode = ls.get(KEY_MODE) || 'auto';
    this._resolve();
  },

  /** Kết quả đo lần trước (chỉ nhớ 7 ngày: máy hết nóng / thoát chế độ pin yếu thì tự thử lại ở mức đẹp). Bản cũ lưu chuỗi trơn → bỏ. */
  _savedAuto() {
    try {
      const o = JSON.parse(ls.get(KEY_AUTO) || 'null');
      if (o && o.tier === 'lite' && Date.now() - o.at < 7 * 864e5) return 'lite';
      if (ls.get(KEY_AUTO)) localStorage.removeItem(KEY_AUTO);
    } catch { try { localStorage.removeItem(KEY_AUTO); } catch {} }
    return null;
  },

  _resolve() {
    this.tier = this.mode === 'lite' ? 'lite' : this.mode === 'high' ? 'high' : (this._savedAuto() || guessTier());
    document.documentElement.dataset.perf = this.tier;
  },

  setMode(m) {
    this.mode = ['auto', 'lite', 'high'].includes(m) ? m : 'auto';
    ls.set(KEY_MODE, this.mode);
    if (this.mode === 'auto') try { localStorage.removeItem(KEY_AUTO); } catch {}
    this._resolve();
  },

  get lite()     { return this.tier === 'lite'; },
  /** Số khung hình tối đa mỗi giây */
  get fpsCap()   { return this.lite ? 30 : 60; },
  /** Trần độ nét canvas (devicePixelRatio) */
  get dprCap()   { return this.lite ? 1 : 1.75; },
  /** Hệ số số lượng chữ/hạt hiệu ứng */
  get fx()       { return this.lite ? 0.4 : 1; },
  /** Hệ số độ đậm lớp phủ màu (lite bỏ blend nên giảm độ đậm) */
  get tintScale(){ return this.lite ? 0.6 : 1; },

  /**
   * Báo fps đo được trong trận. Chỉ có tác dụng ở chế độ Tự động đang ở mức 'high'.
   * @returns {boolean} true nếu vừa tự hạ xuống 'lite' (nơi gọi cần đổi cỡ canvas)
   */
  reportFps(avgFps) {
    if (this.mode !== 'auto' || this.tier !== 'high') return false;
    if (avgFps >= 38) return false;
    ls.set(KEY_AUTO, JSON.stringify({ tier: 'lite', at: Date.now() }));
    this._resolve();
    console.info(`[Perf] Máy chạy ${avgFps.toFixed(0)}fps → chuyển sang chế độ tiết kiệm.`);
    return true;
  },
};

Perf.init();

/** Giữ màn hình sáng khi đang chơi/chờ phòng (tránh điện thoại tắt màn hình làm đứt mạng) */
let _wake = null;
export const WakeLock = {
  async on() {
    try { if (!_wake && navigator.wakeLock) { _wake = await navigator.wakeLock.request('screen'); _wake.addEventListener('release', () => { _wake = null; }); } } catch { _wake = null; }
  },
  off() { try { _wake?.release(); } catch {} _wake = null; },
};
// Wake lock tự nhả khi tab ẩn → xin lại khi quay lại (chỉ nếu trước đó đang bật)
let _want = false;
const _on = WakeLock.on.bind(WakeLock), _off = WakeLock.off.bind(WakeLock);
WakeLock.on  = () => { _want = true;  return _on(); };
WakeLock.off = () => { _want = false; _off(); };
document.addEventListener('visibilitychange', () => { if (_want && document.visibilityState === 'visible') _on(); });
