/**
 * MicTest.js — Kiểm tra micro trong Cài đặt.
 *
 * Bấm "Kiểm tra mic" → xin quyền → hiện thanh âm lượng sống + thông tin thiết bị.
 * Dùng đúng BarkDetector với ngưỡng đang chọn nên đếm "số tiếng sủa nhận được" giống hệt trong trận.
 * Có bước "đo nền ồn" (1,5s im lặng) rồi gợi ý mức nhạy phù hợp với phòng + micro của bạn.
 */
import { MicrophoneManager } from './MicrophoneManager.js';
import { BarkDetector }      from './BarkDetector.js';
import { CONFIG }            from '../data/config.js';
import { I18n, t }          from '../core/I18n.js';

const $ = (id) => document.getElementById(id);

export class MicTest {
  /** @param {{ getLevel:()=>number, setLevel:(n:number)=>void }} opts  đọc/ghi thanh trượt ngưỡng */
  constructor({ getLevel, setLevel }) {
    this.getLevel = getLevel; this.setLevel = setLevel;
    this.mic = null; this.det = null; this._raf = 0; this._running = false;
    this._bound = false;
    /** (đangĐo:boolean) => void — để tắt nhạc nền lúc đo, tránh nhạc lọt vào mic */
    this.onState = null;
  }

  bind() {
    if (this._bound) return; this._bound = true;
    $('btn-mic-test')?.addEventListener('click', () => (this._running ? this.stop() : this.start()));
    $('btn-mic-apply')?.addEventListener('click', () => {
      if (this._suggest) { this.setLevel(this._suggest); this._say(t('mt.applied', { n: this._suggest }), 'ok'); }
    });
    // Rời trang/chuyển tab → tắt mic ngay (tiết kiệm pin, tắt chấm đỏ ghi âm)
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.stop(); });
    window.addEventListener('pagehide', () => this.stop());
  }

  _say(text, kind = '') {
    const el = $('mic-test-msg'); if (!el) return;
    el.textContent = text; el.className = 'mic-test-msg' + (kind ? ' ' + kind : '');
  }

  async start() {
    if (this._running) return;
    this._running = true;
    this.onState?.(true);
    const btn = $('btn-mic-test'); if (btn) { I18n.bind(btn, 'mt.stop'); btn.disabled = true; }
    $('btn-mic-apply')?.classList.add('hidden'); this._suggest = 0;
    this._say(t('mt.asking'));

    const mic = this.mic = new MicrophoneManager();
    try { await mic.init(); }
    catch (e) { if (e?.name === 'AbortError' || this.mic !== mic) return; this._fail(e); return; }    // đã bấm dừng/rời màn hình trong lúc chờ quyền
    if (this.mic !== mic || !this._running) { try { mic.destroy(); } catch {} return; }
    if (btn) btn.disabled = false;

    this.mic.onProblem = (k) => {
      if (k === 'ended') { this._say(t('mt.ended'), 'bad'); this.stop(); }
    };

    this.det = new BarkDetector({ cooldownMs: CONFIG.MIC.COOLDOWN_MS, peakWindowMs: CONFIG.MIC.ONSET_PEAK_MS });
    this.det.setThresholdLevel(this.getLevel());
    this.barks = 0; this.peak = 0; this.floor = 0; this._t = 0; this._floorMax = 0; this._sawSignal = false;
    this.det.onBark = () => { this.barks++; $('mic-test-barks').textContent = this.barks; };

    const inf = this.mic.info();
    $('mic-test-info').textContent = `${inf.label} · ${Math.round(inf.sampleRate / 1000)} kHz · ${inf.state}`;
    $('mic-test-panel')?.classList.remove('hidden');
    this._say(t('mt.floor'));

    let last = performance.now();
    const loop = (now) => {
      if (!this._running) return;
      const dt = Math.min(100, now - last); last = now; this._t += dt;
      const rms = this.mic.getRMS(dt);
      this.det.setThresholdLevel(this.getLevel());          // theo thanh trượt đang kéo
      this.det.update(rms, dt);
      if (rms > this.peak) this.peak = rms;
      this._draw(rms);

      if (this._t < 1500) { this._floorMax = Math.max(this._floorMax, rms); }
      else if (!this._phase2) {
        this._phase2 = true; this.floor = this._floorMax;
        this._say(t('mt.bark'));
      } else if (this._t > 6000 && !this._done) { this._done = true; this._conclude(); }
      this._raf = requestAnimationFrame(loop);
    };
    this._phase2 = false; this._done = false;
    this._raf = requestAnimationFrame(loop);
  }

  _draw(rms) {
    const pct = Math.min(100, rms * 500), thr = this.det.threshold;
    const bar = $('mic-test-bar'); if (!bar) return;
    bar.style.width = pct + '%';
    bar.classList.toggle('hot', rms >= thr);
    $('mic-test-thr').style.left = Math.min(95, thr * 500) + '%';
    $('mic-test-pct').textContent = Math.round(pct) + '%';
  }

  /** Đánh giá sau ~6s */
  _conclude() {
    const { peak, floor, barks } = this;
    const peakPct = Math.round(Math.min(100, peak * 500));
    if (peak < 0.00002) {
      this._say(t('mt.none'), 'bad'); return;
    }
    if (peak < 0.02) {
      this._say(t('mt.weak', { p: peakPct }), 'warn');
    } else if (barks === 0) {
      this._say(t('mt.noBark', { p: peakPct }), 'warn');
    } else {
      this._say(t('mt.good', { p: peakPct, n: barks }), 'ok');
    }
    // Gợi ý ngưỡng: trên nền ồn ≥ 3 lần nhưng dưới ~40% đỉnh sủa của bạn
    if (peak >= 0.02) {
      const want = Math.max(floor * 3, Math.min(peak * 0.4, 0.14));
      const lvl = Math.max(1, Math.min(10, Math.round((want - 0.02) / 0.014 + 1)));
      this._suggest = lvl;
      const ap = $('btn-mic-apply');
      if (ap && lvl !== this.getLevel()) { ap.textContent = t('mt.useLevel', { n: lvl }); ap.classList.remove('hidden'); }
      if (floor > 0.03) this._say($('mic-test-msg').textContent + t('mt.noisy', { p: Math.round(floor * 500) }), 'warn');
    }
  }

  _fail(e) {
    const n = e?.name || '';
    const m = n === 'NotAllowedError' || n === 'SecurityError' || n === 'PermissionDeniedError'
      ? t('mt.errDenied')
      : n === 'NotFoundError' || n === 'DevicesNotFoundError' ? t('mt.errNone')
      : n === 'NotReadableError' ? t('mt.errBusy')
      : n === 'InsecureContext' ? t('mt.errInsecure')
      : t('mt.errOther', { n: n || t('b.unknownErr') });
    this._say(m, 'bad');
    this.stop(true);
  }

  stop(keepMsg = false) {
    this._running = false;
    this.onState?.(false);
    cancelAnimationFrame(this._raf);
    this.mic?.destroy(); this.mic = null; this.det = null;
    const btn = $('btn-mic-test'); if (btn) { I18n.bind(btn, 'mt.start'); btn.disabled = false; }
    if (!keepMsg && !this._done && $('mic-test-msg')?.textContent) this._say(t('mt.stopped'));
    const bar = $('mic-test-bar'); if (bar) bar.style.width = '0%';
  }
}
