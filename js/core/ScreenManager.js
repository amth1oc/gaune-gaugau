/**
 * ScreenManager.js — Quản lý chuyển đổi giữa các màn hình
 *
 * Cách dùng:
 *   sm.register('menu', domElement, screenController);
 *   sm.show('battle', { playerChar, aiChar, stage });
 */
export class ScreenManager {
  constructor() {
    /** @type {Map<string, {el: HTMLElement, ctrl: object}>} */
    this._screens = new Map();
    this._current = null;
    /** Gọi mỗi khi chuyển màn hình: (tênMớI, tênCũ) — dùng để đổi nhạc nền */
    this.onChange = null;
  }

  /**
   * Đăng ký màn hình.
   * @param {string} name - Tên định danh
   * @param {HTMLElement} el - DOM element của màn hình
   * @param {object} ctrl - Controller object có phương thức show(data?) và hide()
   */
  register(name, el, ctrl = {}) {
    this._screens.set(name, { el, ctrl });
  }

  /**
   * Chuyển sang màn hình mới.
   * @param {string} name
   * @param {*} data - Dữ liệu truyền vào controller.show(data)
   */
  show(name, data = null) {
    if (!this._screens.has(name)) {
      console.warn(`[ScreenManager] Màn hình không tồn tại: "${name}"`);
      return;
    }

    const prevName = this._current;

    // Ẩn màn hình hiện tại
    if (this._current && this._current !== name) {
      const prev = this._screens.get(this._current);
      if (prev) {
        prev.el.classList.remove('active');
        // Gọi hook hide() nếu có
        prev.ctrl?.hide?.();
      }
    }

    // Hiện màn hình mới
    const next = this._screens.get(name);
    next.el.classList.add('active');
    this._current = name;
    document.documentElement.dataset.screen = name;     // để CSS biết đang ở màn nào (ẩn/hiện nút Ngôn ngữ-Sáng/Tối, nền chung…)

    // Gọi hook show() nếu có
    next.ctrl?.show?.(data);
    try { this.onChange?.(name, prevName); } catch (e) { console.warn('[ScreenManager] onChange lỗi:', e); }
  }

  /** Lấy tên màn hình hiện tại */
  getCurrent() {
    return this._current;
  }

  /** Lấy controller của màn hình theo tên */
  getCtrl(name) {
    return this._screens.get(name)?.ctrl;
  }
}
