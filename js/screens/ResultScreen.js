/**
 * ResultScreen.js — Màn kết quả kiểu video: bảng nâu mờ phủ lên chính cảnh trận
 * (ảnh chụp canvas lúc kết thúc), chữ K.O. đỏ phía sau, hai nút nhỏ.
 * Trận online: "Trận tiếp" = đấu lại (cả hai bên cùng bấm), "Menu chính" = rời phòng.
 */
import { SaveManager } from '../core/SaveManager.js';
import { I18n, t }     from '../core/I18n.js';
import { CONFIG }      from '../data/config.js';
import { WakeLock }    from '../core/Perf.js';
import { Popup }       from '../core/Popup.js';

export class ResultScreen {
  constructor({ bus, screenManager, soundManager, online }) {
    this.bus = bus;
    this.sm = screenManager;
    this.sound = soundManager;
    this.online = online || null;
    this._data = null;
    this._setupListeners();
  }

  _setupListeners() {
    const next = document.getElementById('btn-next-match');
    const back = document.getElementById('btn-back-to-title');

    next?.addEventListener('click', () => {
      this.sound.playClick();
      if (this._data?.online) { this.online?.requestRematch(); return; }
      this.sm.show('character-select');
    });
    back?.addEventListener('click', () => {
      this.sound.playClick();
      if (this._data?.online) { this.online?.leave(); return; }
      this.sm.show('menu');
    });

    // Trạng thái đấu lại / đối thủ rời phòng (online)
    this.bus.on('online:rematch', ({ me, opp }) => {
      if (!this._data?.online) return;
      this._setNext(me ? 'res.waitOpp' : (opp ? 'res.oppWants' : 'res.rematch'), me);
    });
    this.bus.on('online:closed', () => {
      if (!this._data?.online) return;
      this._setNext('res.oppLeft', true);
      if (this.sm.getCurrent() === 'result') this._popLeft();      // đang xem kết quả mà đối thủ rời/đứt → báo bằng popup
    });
  }

  /** Popup "đối thủ đã rời / mất kết nối" tuỳ vai trò. */
  _popLeft() {
    const host = this.online?.role === 'host';
    Popup.alert({ title: t('pop.t.left'), icon: '👋', text: t(host ? 'on.oppLeftHost' : 'on.hostLeft') });
  }

  /** key = khoá I18n của nhãn nút (gồm cả dòng phụ); gắn khoá nên đổi ngôn ngữ là tự dịch lại */
  _setNext(key, disabled) {
    const b = document.getElementById('btn-next-match');
    if (!b) return;
    I18n.bind(b, key);
    b.disabled = !!disabled;
  }

  show(data) {
    this._data = data;
    const isWin = data.winner === 'player';

    // Nền: ảnh chụp cảnh trận + màu phủ (đỏ cam khi thắng, xanh xám khi thua)
    const snap = document.getElementById('result-snapshot');
    snap.style.backgroundImage = data.snapshot ? `url(${data.snapshot})` : 'none';
    const tint = document.getElementById('result-tint');
    tint.className = `result-tint ${data.snapshot ? (isWin ? 'win' : 'lose') : 'none'}`;

    // K.O. đỏ phía sau bảng
    const verdict = document.getElementById('result-verdict');
    verdict.textContent = data.reason === 'ko' ? 'ĐO VÁN!' : data.reason === 'forfeit' ? 'THẮNG' : data.reason === 'disconnect' ? '🌐' : 'HẾT GIỜ!';
    verdict.style.animation = 'none'; void verdict.offsetWidth; verdict.style.animation = '';

    // Bảng
    const wl = document.getElementById('result-win-lose');
    if (data.reason === 'forfeit') I18n.bind(wl, 'res.forfeit');
    else if (data.reason === 'disconnect') I18n.bind(wl, 'res.disconnect');
    else I18n.setText(wl, data.reason === 'ko' ? (isWin ? 'THẮNG ĐẸP!' : 'THUA ĐAU...') : (isWin ? 'HẾT GIỜ — THẮNG!' : 'HẾT GIỜ — THUA...'));
    wl.className = `result-win-lose ${isWin ? 'win-text' : 'lose-text'}`;

    this._animateCounter(document.getElementById('result-wp-number'), 0, data.wpGained, 800);
    document.getElementById('stat-bark-count').textContent = data.barkCount ?? 0;
    document.getElementById('stat-max-combo').textContent = data.maxCombo ?? 0;
    document.getElementById('stat-total-wp').textContent = SaveManager.getWP().toLocaleString();

    // Cấp bot: thông báo mở khoá hoặc tiến độ lên cấp (chỉ khi đấu bot)
    this._renderTier(data);

    // Nút
    if (data.online) {
      WakeLock.on();
      // Đối thủ đã thoát/mất kết nối trước khi màn này hiện (sự kiện 'online:closed' bắn lúc còn ở màn trận nên bị lỡ)
      if (!this.online?.net?.connected) this._setNext('res.oppLeft', true);
      else if (this.online?.rematchOpp) this._setNext('res.oppWants', false);     // đối thủ đã bấm đấu lại từ lúc mình còn ở màn trận
      else this._setNext('res.rematch', false);
      if (this.online?.consumeFreshGuest?.()) setTimeout(() => { if (this.sm.getCurrent() === 'result') this.sm.show('online'); }, 400);
    }
    else this._setNext('res.next', false);

    if (data.reason !== 'disconnect') { isWin ? this.sound.playWin() : this.sound.playLose(); }

    // Popup giữa màn hình cho các tình huống online bất thường (trước đây chỉ có dòng toast nhỏ ở trận, dễ bỏ sót)
    if (data.online) {
      if (data.reason === 'disconnect') Popup.alert({ title: t('pop.t.lost'), icon: '🌐', text: t('b.disconnect') });
      else if (data.reason === 'forfeit') Popup.alert({ title: t('pop.t.win'), icon: '🏳️', text: t('b.forfeit') });
      else if (!this.online?.net?.connected) this._popLeft();
    }
  }

  _renderTier(data) {
    const el = document.getElementById('result-tier');
    if (!el) return;
    if (data.online || !data.tier) { el.className = 'result-tier hidden'; el.textContent = ''; return; }
    const bot = SaveManager.getBot();
    if (data.tierUp) {
      I18n.bind(el, 'tier.up', { n: data.tierUp.to, name: t(`tier.${data.tierUp.to}`), wp: CONFIG.WP.TIER_UP_BONUS });
      el.className = 'result-tier up';
      return;
    }
    const n = data.tier, name = t(`tier.${n}`);
    if (n >= CONFIG.TIERS.COUNT) I18n.bind(el, 'tier.progMax', { n, name });
    else if (n < bot.maxTier) I18n.bind(el, 'tier.progLower', { n, name });
    else I18n.bind(el, 'tier.prog', { n, name, w: bot.wins, need: bot.need, next: n + 1 });
    el.className = 'result-tier';
  }

  _animateCounter(el, from, to, ms) {
    if (!el) return;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / ms);
      el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  hide() {}
}
