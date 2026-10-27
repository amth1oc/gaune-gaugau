/**
 * Theme.js — Chế độ SÁNG (hoàng hôn, mặc định) / TỐI (ban đêm).
 * Chỉ đổi thuộc tính <html data-theme="day|night"> + màu thanh trình duyệt; mọi màu nằm trong CSS (css/modes.css),
 * không có vòng lặp JS, không chạm vào trận đấu hay kết nối online.
 * Giá trị đầu tiên được js/boot-prefs.js đặt TRƯỚC khi vẽ trang (tránh chớp sáng/tối).
 */
const LS_THEME = 'chosua_theme';
const THEME_COLOR = { day: '#241510', night: '#0a1030' };
const listeners = new Set();

function read() {
  try { const v = localStorage.getItem(LS_THEME); if (v === 'night' || v === 'day') return v; } catch { /* bỏ qua */ }
  return 'day';
}

export const Theme = {
  get mode() { return document.documentElement.dataset.theme === 'night' ? 'night' : 'day'; },

  init() { this._apply(read(), false); },

  set(mode) {
    if (mode !== 'day' && mode !== 'night') return;
    if (mode === this.mode) return;
    try { localStorage.setItem(LS_THEME, mode); } catch { /* bỏ qua */ }
    this._apply(mode, true);
  },

  toggle() { this.set(this.mode === 'night' ? 'day' : 'night'); },
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  _apply(mode, notify) {
    const root = document.documentElement;
    root.dataset.theme = mode;
    if (mode === 'night') root.dataset.nightLoaded = '1';     // từ giờ mới tải ảnh đêm (ban ngày không tốn băng thông)
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = THEME_COLOR[mode];
    const cs = document.querySelector('meta[name="color-scheme"]');
    if (cs) cs.content = mode === 'night' ? 'dark' : 'light';      // thanh cuộn / ô nhập theo đúng giao diện
    if (notify) listeners.forEach((fn) => { try { fn(mode); } catch (e) { console.warn('[Theme] listener lỗi:', e); } });
  },
};
