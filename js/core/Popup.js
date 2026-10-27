/**
 * Popup.js — Thông báo nổi giữa màn hình (thay cho dòng chữ nhỏ nằm cuối trang, dễ bỏ sót trên điện thoại).
 *   Popup.alert({ title, text, icon, ok })  → hộp thoại có nút, phải bấm mới tắt (lỗi, mất kết nối, đối thủ rời…). Trả Promise.
 *   Popup.toast(text, { kind, ms, sticky }) → bong bóng nổi phía trên, tự tắt (đã sao chép, đang kết nối…). kind: ok | warn | info
 *   Popup.close() / Popup.clearToast()
 * Chỉ dùng opacity/transform → nhẹ cho máy yếu. Kiểu dáng ở css/identity.css (.pop-*).
 */
import { t } from './I18n.js';

let modal = null, modalResolve = null, toastEl = null, toastTimer = 0, prevFocus = null, lastKey = '';

function ensureToast() {
  if (toastEl && toastEl.isConnected) return toastEl;
  toastEl = document.createElement('div');
  toastEl.className = 'pop-toast';
  toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
  document.body.appendChild(toastEl);
  return toastEl;
}

export const Popup = {
  /** Hộp thoại. Gọi lại khi đang mở thì thay nội dung (cùng nội dung → bỏ qua, tránh nháy). */
  alert({ title = '', text = '', icon = '⚠️', ok = null } = {}) {
    const key = title + '|' + text;
    if (modal && key === lastKey) return Promise.resolve();
    Popup.close();
    lastKey = key;
    prevFocus = document.activeElement;
    const wrap = document.createElement('div');
    wrap.className = 'pop-backdrop';
    wrap.innerHTML = '<div class="pop-box" role="alertdialog" aria-modal="true" aria-labelledby="pop-h" aria-describedby="pop-p"><div class="pop-icon" aria-hidden="true"></div><h3 id="pop-h"></h3><p id="pop-p" class="pop-text"></p><button type="button" class="pop-ok"></button></div>';
    wrap.querySelector('.pop-icon').textContent = icon;
    wrap.querySelector('h3').textContent = title;
    wrap.querySelector('.pop-text').textContent = text;
    const btn = wrap.querySelector('.pop-ok');
    btn.textContent = ok || t('pop.ok');
    const done = () => Popup.close();
    btn.addEventListener('click', done);
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); done(); } });
    document.body.appendChild(wrap);
    modal = wrap;
    requestAnimationFrame(() => wrap.classList.add('show'));
    try { btn.focus({ preventScroll: true }); } catch {}
    return new Promise((r) => { modalResolve = r; });
  },

  close() {
    const w = modal, r = modalResolve;
    modal = null; modalResolve = null; lastKey = '';
    if (w) { w.classList.remove('show'); setTimeout(() => w.remove(), 180); }
    try { prevFocus?.focus?.({ preventScroll: true }); } catch {}
    prevFocus = null;
    r?.();
  },

  get isOpen() { return !!modal; },

  /** Bong bóng nổi. sticky = giữ tới khi clearToast() / toast khác. */
  toast(text, { kind = 'info', ms = 2600, sticky = false } = {}) {
    if (!text) return Popup.clearToast();
    const el = ensureToast();
    el.textContent = text;
    el.className = `pop-toast ${kind}`;
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    if (!sticky) toastTimer = setTimeout(() => Popup.clearToast(), ms);
  },

  clearToast() {
    clearTimeout(toastTimer);
    toastEl?.classList.remove('show');
  },
};
