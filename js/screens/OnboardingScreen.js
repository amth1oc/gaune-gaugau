/**
 * OnboardingScreen.js — Lần đầu vào game: (1) chuẩn hoá mic → (2) cách chơi → (3) vào game.
 * Mọi bước đều bỏ qua được. Chạy lại bất cứ lúc nào từ Cài đặt.
 *
 * NHẸ MÁY: chỉ BƯỚC 1 mới mở mic, và mic được TẮT NGAY khi đo xong / bỏ qua / đổi bước / ẩn tab.
 * Bước 2–3 là hướng dẫn thuần (hoạt ảnh CSS chỉ chạy ở thẻ đang xem, không có vòng lặp JS).
 */
import { MicrophoneManager } from '../audio/MicrophoneManager.js';
import { BarkDetector }      from '../audio/BarkDetector.js';
import { MicNormalizer }     from '../audio/MicNormalizer.js';
import { SaveManager }       from '../core/SaveManager.js';
import { CONFIG }            from '../data/config.js';
import { I18n }             from '../core/I18n.js';

const $ = (id) => document.getElementById(id);
const FLOOR_MS = 1200, NEED = 3, GIVE_UP_MS = 20000, TICK_MS = 12, UI_MS = 40;

export class OnboardingScreen {
  constructor({ bus, screenManager, soundManager }) {
    this.bus = bus; this.sm = screenManager; this.sound = soundManager;
    this.mic = null; this.det = null; this.norm = null; this._timer = null;
    this.step = 1; this.slide = 0; this.calibrated = false; this._phase = 'idle';
    this._bind();
  }

  _bind() {
    $('ob-skip-all')?.addEventListener('click', () => this._finish());
    $('ob-next-1')?.addEventListener('click', () => { this.sound.playClick(); this._go(2); });
    $('ob-mic-start')?.addEventListener('click', () => { this.sound.playClick(); this._startCalib(); });
    $('ob-skip-2')?.addEventListener('click', () => { this.sound.playClick(); this._go(3); });
    $('ob-next-2')?.addEventListener('click', () => {
      this.sound.playClick();
      if (this.slide < this._slides().length - 1) this._scrollTo(this.slide + 1); else this._go(3);
    });
    $('ob-finish')?.addEventListener('click', () => this._finish());
    $('ob-redo')?.addEventListener('click', () => { this.sound.playClick(); this._go(1); this._startCalib(); });
    // vuốt thẻ: cập nhật chấm + nút "Tiếp/Xong"
    let raf = 0;
    $('ob-slides')?.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0; const el = $('ob-slides');
        this._setSlide(Math.max(0, Math.min(this._slides().length - 1, Math.round(el.scrollLeft / (el.clientWidth || 1)))));
      });
    }, { passive: true });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this._stopMic(); });
  }

  show() {
    this.calibrated = false; this._phase = 'idle'; this.slide = 0;
    this._ui1('idle');
    this._go(1);
  }
  hide() { this._stopMic(); }

  // ── Điều hướng ─────────────────────────────────────
  _go(n) {
    this._stopMic();                                   // rời bước 1 (hay vào lại) đều đảm bảo mic đã tắt
    this.step = n;
    for (let i = 1; i <= 3; i++) $('ob-step-' + i).classList.toggle('on', i === n);
    document.querySelectorAll('.ob-steps li').forEach((li) => {
      const s = +li.dataset.s; li.className = s === n ? 'on' : s < n ? 'done' : '';
    });
    $('ob-skip-all').style.visibility = n === 3 ? 'hidden' : 'visible';
    if (n === 1) this._ui1('idle');
    if (n === 2) { this._scrollTo(0, true); this._setSlide(0); }
    if (n === 3) this._summary();
  }

  _slides() { return $('ob-slides').children; }
  _scrollTo(i, instant = false) {
    const el = $('ob-slides'); el.scrollTo({ left: i * el.clientWidth, behavior: instant ? 'auto' : 'smooth' });
    this._setSlide(i);
  }
  _setSlide(i) {
    this.slide = i;
    [...this._slides()].forEach((s, k) => s.classList.toggle('on', k === i));
    document.querySelectorAll('#ob-dots2 i').forEach((d, k) => d.classList.toggle('on', k === i));
    I18n.bind($('ob-next-2'), i === this._slides().length - 1 ? 'ob.doneBtn' : 'ob.next');
  }

  _summary() {
    const box = $('ob-summary'); box.innerHTML = '';
    const chip = (cls, key) => { const d = document.createElement('div'); d.className = 'ob-chip' + (cls ? ' ' + cls : ''); I18n.bind(d, key); box.appendChild(d); };
    chip(this.calibrated ? 'ok' : '', this.calibrated ? 'ob.chipOk' : 'ob.chipNo');
    chip('', 'ob.chipRedo');
  }

  _finish() {
    SaveManager.setOnboarded();
    this.sound.playClick();
    this.sm.show('menu');                              // ScreenManager gọi hide() → mic chắc chắn đã tắt
  }

  // ── Bước 1: chuẩn hoá mic ──────────────────────────
  /** Cập nhật giao diện bước 1 theo pha. text/msg là KHOÁ I18n (gắn vào phần tử → tự dịch lại khi đổi ngôn ngữ). */
  _ui1(phase, text = '', msg = '', kind = '', msgParams = null) {
    const st = $('ob-stage');
    st.className = 'ob-stage' + (phase === 'idle' ? ' wait' : phase === 'done' ? ' ok' : '');
    $('ob-pulse').style.transform = '';
    $('ob-core-ico').textContent = phase === 'bark' ? '🐕' : phase === 'done' ? '✔' : '🎤';
    const ph = text || (phase === 'idle' ? 'ob.ready' : '');
    if (ph) I18n.bind($('ob-phase'), ph); else I18n.setText($('ob-phase'), '');
    const m = $('ob-mic-msg'), mk = msg || (phase === 'idle' ? 'ob.idleMsg' : '');
    if (mk) I18n.bind(m, mk, msgParams); else I18n.setText(m, '');
    m.className = 'ob-msg' + (kind ? ' ' + kind : '');
    if (phase === 'idle') {
      document.querySelectorAll('#ob-paws span').forEach((p) => p.classList.remove('lit'));
      const b = $('ob-mic-start'); b.disabled = false; I18n.bind(b, 'ob.start');
      I18n.bind($('ob-next-1'), 'ob.skipStep');
    }
  }

  async _startCalib() {
    this._stopMic();
    $('ob-mic-start').disabled = true;
    this._phase = 'opening';
    this._ui1('opening', 'ob.opening', 'ob.openingMsg');
    const m = new MicrophoneManager(); this.mic = m;
    try { await m.init(this.sound?.audioContext || null); }
    catch (e) { if (e?.name === 'AbortError' || this.mic !== m) return; this._micFail(e); return; }
    if (this._phase !== 'opening' || this.mic !== m) { try { m.destroy(); } catch {} return; }   // đã rời bước trong lúc chờ quyền → tắt hẳn mic vừa mở         // người dùng đã rời bước trong lúc chờ quyền
    this.det = new BarkDetector({ cooldownMs: CONFIG.MIC.COOLDOWN_MS, peakWindowMs: CONFIG.MIC.ONSET_PEAK_MS, topUpMs: CONFIG.MIC.TOPUP_MS, topUpRatio: CONFIG.MIC.TOPUP_RATIO });
    this.det.setThresholdLevel(SaveManager.getSettings().thresholdLevel || 5);
    this.norm = new MicNormalizer();
    this._peaks = []; this._floorMax = 0; this._t = 0; this._phase = 'floor';
    this.det.onBark  = (raw) => { if (this._phase === 'bark') { this._peaks.push(raw); this._paws(); } };
    this.det.onBoost = (a, b) => { if (this._phase === 'bark' && this._peaks.length) this._peaks[this._peaks.length - 1] = b; };
    this.sound.setMusicDuck?.(0);                                       // tắt nhạc nền lúc đo để không lọt vào mic
    this._ui1('floor', 'ob.quiet', 'ob.quietMsg');

    let last = performance.now(), ui = 0;
    this._timer = setInterval(() => {
      if (!this.mic?.isActive) return;
      const now = performance.now(), dt = Math.min(100, now - last); last = now;
      if (dt <= 0) return;
      const rms = this.mic.getRMS(dt);
      this._tick(rms, dt);
      this.det?.update(rms, dt, this.mic?.minRMS ?? rms);
      if (now - ui > UI_MS) { ui = now; this._meter(rms); }
    }, TICK_MS);
  }

  _tick(rms, dt) {
    this._t += dt;
    if (this._phase === 'floor') {
      this._floorMax = Math.max(this._floorMax, rms);
      if (this._t >= FLOOR_MS) {
        this._phase = 'bark'; this._t = 0;
        const thr = Math.max(0.035, this._floorMax * 3);                 // ngưỡng riêng khi đo: trên nền ồn ≥3 lần
        this.det.threshold = thr; this.det.release = thr * 0.35;
        this._ui1('bark', 'ob.barkNow', 'ob.barkMsg');
      }
    } else if (this._phase === 'bark') {
      if (this._peaks.length >= NEED && this._t > 120) this._calibDone();   // chờ chút để bắt nốt đỉnh thật của tiếng thứ 3
      else if (this._t > GIVE_UP_MS && !this._peaks.length) {
        this._stopMic(); this._ui1('idle', 'ob.heardNone', 'ob.heardNoneMsg', 'bad');
        I18n.bind($('ob-mic-start'), 'ob.retry');
      }
    }
  }

  _meter(rms) {
    if (this._phase !== 'floor' && this._phase !== 'bark') return;
    const thr = this.det?.threshold ?? 0.05;
    $('ob-pulse').style.transform = `scale(${(0.62 + Math.min(1, rms * 3) * 0.55).toFixed(3)})`;   // chỉ transform → không bắt trình duyệt tính lại bố cục
    $('ob-stage').classList.toggle('hot', rms >= thr);
  }

  _paws() {
    const n = Math.min(NEED, this._peaks.length);
    document.querySelectorAll('#ob-paws span').forEach((p, i) => p.classList.toggle('lit', i < n));
  }

  _calibDone() {
    const peaks = this._peaks.slice(0, NEED), avg = peaks.reduce((a, b) => a + b, 0) / peaks.length, top = Math.max(...peaks);
    this.norm.setRef(avg);
    // ngưỡng hợp với phòng + mic này (đã có chuẩn hoá âm lượng nên không cần cao: chỉ cần trên nền ồn, tối đa mức 8)
    const want = Math.max(this._floorMax * 3, Math.min(top * 0.25, 0.10));
    const lvl = Math.max(2, Math.min(8, Math.round((want - 0.02) / 0.014 + 1)));
    SaveManager.saveSettings({ ...SaveManager.getSettings(), thresholdLevel: lvl });
    this.calibrated = true;
    const doneKey = avg > 0.6 ? 'ob.doneHot' : avg < 0.08 ? 'ob.doneWeak' : 'ob.calibrated';
    this._stopMic();                                                   // ĐO XONG LÀ TẮT MIC NGAY
    this._ui1('done', 'ob.awesome', doneKey, 'ok');
    this._paws();
    const b = $('ob-mic-start'); b.disabled = false; I18n.bind(b, 'ob.measureAgain');
    I18n.bind($('ob-next-1'), 'ob.nextStep');
  }

  _micFail(e) {
    const n = e?.name || '';
    const key = n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError' ? 'ob.errDenied'
      : n === 'NotFoundError' ? 'ob.errNone'
      : n === 'InsecureContext' ? 'ob.errInsecure'
      : 'ob.errOther';
    this._stopMic();
    this._ui1('idle', 'ob.errTitle', key, 'bad', key === 'ob.errOther' ? { n: n || I18n.t('b.unknownErr') } : null);
    I18n.bind($('ob-mic-start'), 'ob.retry');
  }

  /** Tắt mic + timer, trả lại nhạc nền. An toàn khi gọi nhiều lần. */
  _stopMic() {
    clearInterval(this._timer); this._timer = null;
    if (this._phase === 'opening' || this._phase === 'floor' || this._phase === 'bark') this._phase = 'idle';   // đo dở bị ngắt
    if (this.mic) { try { this.mic.destroy(); } catch {} this.mic = null; }
    this.det = null;
    this.sound.setMusicDuck?.(1);
  }
}
