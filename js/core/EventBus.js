/**
 * EventBus.js — Hệ thống sự kiện pub/sub
 * Dùng để kết nối các module mà không cần phụ thuộc trực tiếp.
 *
 * Cách dùng:
 *   bus.on('player:bark', ({ volume }) => { ... });
 *   bus.emit('player:bark', { volume: 0.8 });
 *   bus.off('player:bark', handler);
 */
export class EventBus {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  /**
   * Đăng ký lắng nghe sự kiện.
   * @param {string} event
   * @param {Function} callback
   * @returns {Function} Hàm unsubscribe tiện lợi
   */
  on(event, callback) {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event).add(callback);
    // Trả về hàm để tự hủy đăng ký
    return () => this.off(event, callback);
  }

  /**
   * Đăng ký chỉ lắng nghe 1 lần.
   * @param {string} event
   * @param {Function} callback
   */
  once(event, callback) {
    const wrapper = (data) => {
      callback(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  /**
   * Hủy đăng ký.
   * @param {string} event
   * @param {Function} callback
   */
  off(event, callback) {
    const set = this._listeners.get(event);
    if (set) set.delete(callback);
  }

  /**
   * Phát sự kiện đến tất cả listener.
   * @param {string} event
   * @param {*} data
   */
  emit(event, data) {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return;
    // Duyệt bản sao để tránh mutation trong loop
    for (const cb of [...set]) {
      try {
        cb(data);
      } catch (err) {
        console.error(`[EventBus] Error in listener for "${event}":`, err);
      }
    }
  }

  /**
   * Xóa toàn bộ listener (thường gọi khi destroy game).
   */
  clear() {
    this._listeners.clear();
  }

  /**
   * Xóa toàn bộ listener của một event cụ thể.
   * @param {string} event
   */
  clearEvent(event) {
    this._listeners.delete(event);
  }
}

/** Singleton toàn cục — dùng cho toàn bộ game */
export const bus = new EventBus();
