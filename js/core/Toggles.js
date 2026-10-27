/**
 * Toggles.js — Gắn 2 nút "Ngôn ngữ" + "Sáng/Tối" (có nhiều bản sao trên các màn hình, cùng class).
 * Nút luôn hiển thị cái BẠN SẼ ĐỔI SANG (EN khi đang tiếng Việt, 🌙 khi đang sáng) và có chú thích rõ cho trình đọc màn hình.
 */
import { I18n } from './I18n.js';
import { Theme } from './Theme.js';

export function initToggles(sound) {
  const langBtns = document.querySelectorAll('.js-lang-btn');
  const themeBtns = document.querySelectorAll('.js-theme-btn');

  const refresh = () => {
    const nextLang = I18n.lang === 'vi' ? 'EN' : 'VI';
    const langLabel = I18n.t('tg.lang');
    langBtns.forEach((b) => {
      const code = b.querySelector('.tg-code'); if (code) code.textContent = nextLang;
      b.setAttribute('aria-label', langLabel); b.title = langLabel;
    });
    const night = Theme.mode === 'night';
    const themeLabel = I18n.t(night ? 'tg.toDay' : 'tg.toNight');
    themeBtns.forEach((b) => {
      b.setAttribute('aria-label', themeLabel); b.title = themeLabel;
      b.setAttribute('aria-pressed', night ? 'true' : 'false');
    });
  };

  langBtns.forEach((b) => b.addEventListener('click', () => { sound?.playClick(); I18n.toggle(); }));
  themeBtns.forEach((b) => b.addEventListener('click', () => { sound?.playClick(); Theme.toggle(); }));
  I18n.onChange(refresh);
  Theme.onChange(refresh);
  refresh();
}
