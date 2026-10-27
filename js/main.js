/**
 * main.js — Entry point của game
 *
 * Khởi tạo tất cả modules và kết nối chúng:
 *   EventBus → ScreenManager → Screens → Game systems
 */

import { EventBus }      from './core/EventBus.js';
import { ScreenManager } from './core/ScreenManager.js';
import { SaveManager }   from './core/SaveManager.js';
import { SoundManager }  from './audio/SoundManager.js';
import { Assets }        from './core/AssetLoader.js';
import { Perf }          from './core/Perf.js';
import { MicTest }       from './audio/MicTest.js';
import { I18n, t }       from './core/I18n.js';
import { Theme }         from './core/Theme.js';
import { initToggles }   from './core/Toggles.js';

import { MenuScreen }            from './screens/MenuScreen.js';
import { CharacterSelectScreen } from './screens/CharacterSelectScreen.js';
import { BattleScreen }          from './screens/BattleScreen.js';
import { ResultScreen }          from './screens/ResultScreen.js';
import { OnlineLobbyScreen }     from './screens/OnlineLobbyScreen.js';
import { isHideIp, setHideIp }  from './net/net-config.js';
import { OnboardingScreen }      from './screens/OnboardingScreen.js';

import { CHARACTERS } from './data/characters.js';
import { STAGES }     from './data/stages.js';

// ── Canvas roundRect polyfill ───────────────────────
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x, y, w, h, r = 0) {
    const rad = typeof r === 'number' ? r : r[0];
    this.beginPath();
    this.moveTo(x + rad, y);
    this.lineTo(x + w - rad, y);
    this.arcTo(x + w, y, x + w, y + rad, rad);
    this.lineTo(x + w, y + h - rad);
    this.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    this.lineTo(x + rad, y + h);
    this.arcTo(x, y + h, x, y + h - rad, rad);
    this.lineTo(x, y + rad);
    this.arcTo(x, y, x + rad, y, rad);
    this.closePath();
    return this;
  };
}

// ── Ngôn ngữ + giao diện sáng/tối: áp dụng NGAY (trước cả lúc nạp assets) ─────
I18n.init();
Theme.init();

// ── Nạp assets (ảnh/âm thanh trong thư mục assets/) ─────
// Không có file nào → game tự dùng hình vẽ bằng code. Tối đa chờ 6 giây.
const assetsLoading = Assets.load().catch(e => console.warn('[Assets] lỗi nạp:', e));
await Promise.race([assetsLoading, new Promise(r => setTimeout(r, 6000))]);

// ── Init ────────────────────────────────────────────
const bus    = new EventBus();
const sm     = new ScreenManager();
const sound  = new SoundManager();
sound.setFiles(Assets.audioFiles);
// Âm thanh tải nền xong → nạp vào bộ phát. PHẢI chờ assetsLoading rồi mới lấy audioReady thật:
// nếu mạng chậm (>6 giây) thì lúc này audioReady vẫn là Promise cũ đã xong sẵn → nhạc nền không bao giờ được nạp.
assetsLoading.then(() => Assets.audioReady).then(() => sound.setFiles(Assets.audioFiles));

// Khởi tạo sound sau user interaction (autoplay policy)
let soundInited = false;
function initSound() {
  if (soundInited) return;
  soundInited = true;
  sound.init();

  // Apply saved settings
  const settings = SaveManager.getSettings();
  sound.setVolume((settings.sfxVolume ?? 7) / 10);
  sound.setMusicVolume((settings.musicVolume ?? 6) / 10);
  sound.setMuted(settings.muted ?? false);
}
document.addEventListener('click',      initSound, { once: true });
document.addEventListener('pointerdown',initSound, { once: true });
document.addEventListener('keydown',    initSound, { once: true });
// iOS/Safari chỉ mở khoá âm thanh khi chạm xong (touchend/click) và có thể tạm dừng lại sau khi dùng mic:
// mỗi lần chạm, nếu âm thanh đang bị dừng thì bật lại (nhạc nền xếp hàng sẽ tự phát).
['pointerdown', 'touchend', 'click', 'keydown'].forEach(ev =>
  document.addEventListener(ev, () => sound.unlock(), { capture: true, passive: true }));

// Shared context
const ctx = { bus, screenManager: sm, soundManager: sound };
initToggles(sound);          // nút Ngôn ngữ + Sáng/Tối (menu và các màn phụ)

// ── Nhạc nền theo màn hình ───────────────────────────
// menu / chọn chó / sảnh online / xếp hạng / cài đặt → nhạc menu
// vào trận → im lặng suốt phần đếm ngược (để nghe rõ tiếng bíp), "SỦA ĐI!" mới vào nhạc trận
// hết trận / màn kết quả → im để nghe tiếng KO, thắng, thua
sm.onChange = (name) => {
  if (name === 'battle' || name === 'result') sound.stopMusic(0.5);
  else sound.playMusic('menuMusic', { volume: 1, fade: 1.2 });
};
bus.on('battle:start', () => sound.playMusic('battleMusic', { volume: 0.6, fade: 0.5 }));   // nhỏ hơn menu: mic nghe nhạc ít hơn
bus.on('battle:end',   () => sound.stopMusic(0.4));
// Sảnh online tạo TRƯỚC để màn trận / kết quả dùng chung phiên kết nối
const onlineScreen = new OnlineLobbyScreen(ctx);
ctx.online = onlineScreen;

// ── Create screens ───────────────────────────────────
const menuScreen      = new MenuScreen(ctx);
const charSelectScreen= new CharacterSelectScreen(ctx);
const battleScreen    = new BattleScreen(ctx);
const resultScreen    = new ResultScreen(ctx);

// ── Register screens ────────────────────────────────
sm.register('menu',             document.getElementById('screen-menu'),             menuScreen);
sm.register('character-select', document.getElementById('screen-character-select'), charSelectScreen);
sm.register('battle',           document.getElementById('screen-battle'),           battleScreen);
sm.register('result',           document.getElementById('screen-result'),           resultScreen);
sm.register('online',           document.getElementById('screen-online'),           onlineScreen);
sm.register('onboarding',       document.getElementById('screen-onboarding'),       new OnboardingScreen(ctx));

// ── Extra screens (rankings, settings) ─────────────
sm.register('rankings', document.getElementById('screen-rankings'), {
  show() { _buildRankings(); },
  hide() {},
});

// ── Rankings ────────────────────────────────────────
function _buildRankings() {
  const el = document.getElementById('rankings-content');
  if (!el) return;

  const history = SaveManager.getMatchHistory();
  const stats   = SaveManager.getStats();

  if (history.length === 0) {
    el.innerHTML = `
      <div style="text-align:center;color:var(--c-text-3);padding:40px;font-size:1rem;">
        ${I18n.tHtml('rank.empty')}
      </div>`;
    return;
  }

  const rows = history.slice(0, 20).map((m, i) => {
    const num = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);   // dữ liệu từ localStorage: ép về số, không chèn HTML
    const date = new Date(num(m.date)).toLocaleDateString(I18n.locale);
    const charData = CHARACTERS.find(c => c.id === m.charId);
    const icon = charData?.emoji ?? '🐕';
    const isWin = m.winner === 'player';
    return `
      <div style="
        display:flex;align-items:center;gap:12px;
        background:var(--c-bg-card);border:1px solid var(--c-border);
        border-radius:12px;padding:12px 16px;
        border-left: 3px solid ${isWin ? 'var(--c-primary)' : 'var(--c-ai)'};
      ">
        <span style="font-size:1.5rem">${icon}</span>
        <div style="flex:1">
          <div style="font-weight:700;color:${isWin ? 'var(--c-primary)' : 'var(--c-ai)'}">
            ${I18n.tHtml(isWin ? 'rank.win' : 'rank.lose')} — ${I18n.tHtml(m.reason === 'ko' ? 'rank.ko' : m.reason === 'forfeit' ? 'rank.forfeit' : 'rank.time')}${m.online ? ' · 🌐' : ''}
          </div>
          <div style="font-size:0.75rem;color:var(--c-text-3);margin-top:2px;">
            ${I18n.tHtml('rank.detail', { date, barks: num(m.barkCount), combo: num(m.maxCombo), wp: num(m.wpGained) })}
          </div>
        </div>
        <div style="font-family:var(--font-display);color:var(--c-primary);font-size:1.2rem">
          +${num(m.wpGained)}
        </div>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div style="
      display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap;justify-content:center;
    ">
      <div style="background:var(--c-bg-card);border:1px solid var(--c-border);border-radius:12px;padding:14px 24px;text-align:center;">
        <div style="font-family:var(--font-display);font-size:2rem;color:var(--c-primary)">${Number(stats.totalWins) | 0}</div>
        <div style="font-size:0.7rem;color:var(--c-text-3);letter-spacing:2px">${I18n.tHtml('rank.wins')}</div>
      </div>
      <div style="background:var(--c-bg-card);border:1px solid var(--c-border);border-radius:12px;padding:14px 24px;text-align:center;">
        <div style="font-family:var(--font-display);font-size:2rem;color:var(--c-ai)">${Number(stats.totalLosses) | 0}</div>
        <div style="font-size:0.7rem;color:var(--c-text-3);letter-spacing:2px">${I18n.tHtml('rank.losses')}</div>
      </div>
      <div style="background:var(--c-bg-card);border:1px solid var(--c-border);border-radius:12px;padding:14px 24px;text-align:center;">
        <div style="font-family:var(--font-display);font-size:2rem;color:var(--c-success)">${Number(stats.wp) | 0}</div>
        <div style="font-size:0.7rem;color:var(--c-text-3);letter-spacing:2px">${I18n.tHtml('rank.totalWp')}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:8px;">${rows}</div>
  `;
}

// Đổi ngôn ngữ khi đang xem Xếp hạng → dựng lại cho đúng chữ
I18n.onChange(() => { if (sm.getCurrent() === 'rankings') _buildRankings(); });

// ── Settings ─────────────────────────────────────────
const micTest = new MicTest({
  getLevel: () => parseInt(document.getElementById('setting-threshold')?.value ?? 5),
  setLevel: (n) => { const s = document.getElementById('setting-threshold'); if (s) { s.value = n; document.getElementById('setting-threshold-val').textContent = n; } },
});
micTest.onState = (on) => sound.setMusicDuck(on ? 0 : 1);   // đang đo mic → tạm tắt nhạc nền cho số đo chuẩn
sm.register('settings', document.getElementById('screen-settings'), {
  show() { _buildSettings(); },
  hide() { micTest.stop(); },
});
function _buildSettings() {
  const settings = SaveManager.getSettings();

  const threshSlider = document.getElementById('setting-threshold');
  const sfxSlider    = document.getElementById('setting-sfx-vol');
  const muteCheck    = document.getElementById('setting-mute');
  const musicSlider  = document.getElementById('setting-music-vol');

  if (threshSlider) {
    threshSlider.value = settings.thresholdLevel ?? 5;
    document.getElementById('setting-threshold-val').textContent = threshSlider.value;
    threshSlider.oninput = () => {
      document.getElementById('setting-threshold-val').textContent = threshSlider.value;
    };
  }
  const hideIpCb = document.getElementById('setting-hide-ip');
  if (hideIpCb) {
    hideIpCb.checked = isHideIp();
    hideIpCb.onchange = () => setHideIp(hideIpCb.checked);
    window.addEventListener('gaune-hideip', () => { hideIpCb.checked = isHideIp(); });
  }
  const perfSel = document.getElementById('setting-perf');
  if (perfSel) { perfSel.value = Perf.mode; perfSel.onchange = () => Perf.setMode(perfSel.value); }
  micTest.bind();
  document.getElementById('mic-test-msg').textContent = '';
  document.getElementById('mic-test-panel')?.classList.add('hidden');
  if (sfxSlider) {
    sfxSlider.value = settings.sfxVolume ?? 7;
    document.getElementById('setting-sfx-vol-val').textContent = sfxSlider.value;
    sfxSlider.oninput = () => {
      const v = parseInt(sfxSlider.value);
      document.getElementById('setting-sfx-vol-val').textContent = v;
      sound.setVolume(v / 10);
    };
  }
  if (musicSlider) {
    musicSlider.value = settings.musicVolume ?? 6;
    document.getElementById('setting-music-vol-val').textContent = musicSlider.value;
    musicSlider.oninput = () => {
      const v = parseInt(musicSlider.value);
      document.getElementById('setting-music-vol-val').textContent = v;
      sound.setMusicVolume(v / 10);
    };
  }
  if (muteCheck) {
    muteCheck.checked = settings.muted ?? false;
    muteCheck.onchange = () => sound.setMuted(muteCheck.checked);
  }

}

// Nút Quay lại / Xóa dữ liệu của Cài đặt: gắn MỘT LẦN (trước đây bị gắn thêm mỗi lần mở màn hình)
document.getElementById('btn-back-from-settings')?.addEventListener('click', () => {
  micTest.stop();
  SaveManager.saveSettings({
    thresholdLevel: parseInt(document.getElementById('setting-threshold')?.value ?? 5),
    sfxVolume:      parseInt(document.getElementById('setting-sfx-vol')?.value ?? 7),
    musicVolume:    parseInt(document.getElementById('setting-music-vol')?.value ?? 6),
    muted:          document.getElementById('setting-mute')?.checked ?? false,
  });
  sound.playClick();
  sm.show('menu');
});

document.getElementById('btn-reset-data')?.addEventListener('click', () => {
  if (confirm(t('set.confirmReset'))) {
    SaveManager.reset();
    alert(t('set.resetDone'));
    sm.show('menu');
  }
});

// Back buttons for simple screens
document.getElementById('btn-back-from-rankings')?.addEventListener('click', () => {
  sound.playClick();
  sm.show('menu');
});

// ── Menu: nền + logo từ assets/ui (nếu có) ───────────
(function applyMenuAssets() {
  const bg = Assets.getUI('menuBackground');
  if (bg) {
    const el = document.getElementById('screen-menu');
    el.style.backgroundImage =
      `linear-gradient(rgba(8,8,16,0.45), rgba(8,8,16,0.78)), url('${bg}')`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = 'center';
  }
  const logo = Assets.getUI('logo');
  if (logo) {
    const text = document.querySelector('.logo-text');
    if (text) {
      const img = document.createElement('img');
      img.src = logo; img.alt = 'Gaune – Gâu Gâu'; img.className = 'logo-img'; img.draggable = false;
      text.replaceWith(img);
    }
  }
})();

// ── Start ────────────────────────────────────────────
// Mở từ liên kết mời: ?room=ABCDE → vào phòng ngay (bỏ qua màn chào người mới)
const _room = new URLSearchParams(location.search).get('room');
// Lần đầu vào game: chuẩn hoá mic → hướng dẫn → menu (bỏ qua được)
sm.show(!_room && !SaveManager.isOnboarded() ? 'onboarding' : 'menu');
document.getElementById('boot')?.remove();
document.getElementById('btn-online')?.addEventListener('click', () => { sound.playClick(); sm.show('online'); });
document.getElementById('btn-redo-onboarding')?.addEventListener('click', () => { sound.playClick(); sm.show('onboarding'); });
if (_room) { history.replaceState(null, '', location.pathname); onlineScreen.autoJoin(_room); }

console.log(`
  🐾 Gaune – Gâu Gâu - Loaded!
  GP hiện tại: ${SaveManager.getWP()}
  Nhân vật đã mở: ${SaveManager.getUnlockedChars().join(', ')}
`);

// ── Tự cập nhật ảnh khi bạn thả file mới vào assets/ rồi quay lại cửa sổ game ──
// Chỉ nạp lại khi KHÔNG đang đánh (menu / chọn nhân vật / kết quả...), để không phá trận.
{
  let sig = null, busy = false, pending = false;
  const toast = (msg) => {
    const t = document.createElement('div'); t.className = 'assets-toast'; t.textContent = msg;
    document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
  };
  const check = async () => {
    if (busy) return; busy = true;
    try {
      const now = await Assets.signature();
      if (sig === null) { sig = now; return; }
      if (now === sig) { if (pending && sm.getCurrent() !== 'battle') { pending = false; toast(t('asset.applying')); setTimeout(() => location.reload(), 500); } return; }
      sig = now;
      if (sm.getCurrent() === 'battle') { pending = true; toast(t('asset.afterMatch')); return; }
      toast(t('asset.updating'));
      setTimeout(() => location.reload(), 700);
    } finally { busy = false; }
  };
  const isDev = /^(localhost|127\.|192\.168\.|10\.|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
  if (isDev) {
    Assets.signature().then(s => { sig = s; }).catch(() => {});
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  }
  window.__refreshAssets = check;      // gõ __refreshAssets() trong Console để ép kiểm tra
}

// ── Service worker: vào lại nhanh + chơi offline (trừ online). Không bật khi đang chỉnh sửa trên máy (localhost/LAN);
// muốn thử trên máy: mở ...?sw=1
{
  const dev = /^(localhost|127\.|192\.168\.|10\.|\[::1\])/.test(location.hostname) || location.protocol === 'file:';
  if ('serviceWorker' in navigator && ((location.protocol === 'https:' && !dev) || /[?&]sw=1\b/.test(location.search))) {
    const reg = () => navigator.serviceWorker.register('sw.js').catch(() => {});
    if (document.readyState === 'complete') reg(); else window.addEventListener('load', reg, { once: true });   // main.js chờ ảnh nên 'load' thường đã qua
    // Khi ảnh nền + âm thanh tải xong → bảo service worker lưu mọi thứ đã tải (để lần sau vào nhanh/offline)
    Promise.all([Assets.audioReady, Assets.backgroundsReady]).then(() => navigator.serviceWorker.ready).then((r) => {
      const urls = [location.href, ...performance.getEntriesByType('resource').map(x => x.name)];
      r.active?.postMessage({ type: 'precache', urls });
    }).catch(() => {});
  }
}
