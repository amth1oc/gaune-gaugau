/**
 * MicrophoneManager.js — Quản lý microphone input qua Web Audio API
 *
 * Mỗi frame gọi getRMS(dt) để lấy giá trị âm lượng (0.0 → 1.0).
 *
 * Độ bền (quan trọng trên điện thoại):
 *  - Tự `resume()` AudioContext sau khi cấp quyền và mỗi khi bị hệ thống tạm dừng (iOS Safari hay làm vậy,
 *    lúc đó mic trả về toàn số 0 → game "không nghe thấy gì").
 *  - Bộ đệm 4096 mẫu (~85ms) để máy yếu chạy 15–20 fps vẫn không bỏ sót đoạn âm thanh nào.
 *  - Phát hiện mic chết (track kết thúc / im tuyệt đối) và báo qua `onProblem`.
 */
import { I18n } from '../core/I18n.js';

/**
 * Cờ toàn cục `window.__micActive` (SoundManager dùng để biết có được dựng lại AudioContext không).
 * Trước đây là biến true/false đặt tay: mic bị tắt giữa lúc đang xin quyền (rời Cài đặt/trận quá nhanh) thì luồng mic vừa mở
 * không ai tắt, cờ kẹt ở true → âm thanh KHÔNG dựng lại được sau khi chuyển app, iPhone kẹt phiên 'ghi âm' (tiếng nhỏ/câm) cho tới khi thoát hẳn.
 * Nay cờ được TÍNH từ các luồng mic còn sống thật sự nên tự hết kẹt.
 */
const LIVE = new Set();
try {
  Object.defineProperty(window, '__micActive', {
    configurable: true,
    get() { for (const m of [...LIVE]) { if (m._pending || (m.stream && m.stream.active)) return true; LIVE.delete(m); } return false; },
    set() { /* chỉ đọc: được tính từ luồng mic thật */ },
  });
} catch {}

export class MicrophoneManager {
  constructor() {
    /** @type {AudioContext|null} */ this.context = null;
    /** @type {AnalyserNode|null} */ this.analyser = null;
    /** @type {MediaStreamAudioSourceNode|null} */ this.source = null;
    /** @type {MediaStream|null} */ this.stream = null;
    /** @type {Float32Array|null} */ this.dataArray = null;
    this.active = false;
    this._lastRMS = 0;
    this.minRMS = 0;
    this._silentMs = 0;
    this.deviceLabel = '';
    /** Gọi khi mic gặp sự cố giữa chừng: (kind: 'ended'|'silent'|'suspended') => void */
    this.onProblem = null;
    this._stateHandler = null;
    this._destroyed = false;
  }

  /** Mic có dùng được ở ngữ cảnh này không (cần https hoặc localhost)? */
  static supported() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia) && (window.isSecureContext !== false);
  }

  /**
   * Yêu cầu quyền mic và khởi tạo audio pipeline.
   * @throws Error (name: NotAllowedError | NotFoundError | NotReadableError | InsecureContext | ...)
   */
  async init(sharedContext = null) {
    if (!MicrophoneManager.supported()) {
      const err = new Error('Không có mediaDevices (không phải https/localhost?)');
      err.name = 'InsecureContext'; throw err;
    }
    // iPhone: AudioContext tạo MỚI mà không có cú chạm (vào trận do tin nhắn mạng) sẽ bị Safari giữ ở trạng thái dừng
    // → mic trả về toàn số 0. Nên dùng lại AudioContext của game (đã được mở khoá ở lần chạm đầu tiên).
    if (sharedContext && sharedContext.state !== 'closed') {
      this.context = sharedContext; this._ownsContext = false;
    } else {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.context = new AC({ latencyHint: 'interactive' });
      this._ownsContext = true;
    }

    LIVE.add(this); this._pending = true;   // đang chờ quyền mic: cũng coi là "mic đang dùng" để không dựng lại AudioContext giữa chừng
    try {
      // echoCancellation bật: tiếng chó sủa phát ra loa của game không bị mic nghe lại rồi tự kích hoạt.
      try {
        try { navigator.audioSession && (navigator.audioSession.type = 'play-and-record'); } catch {}
        this.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false, channelCount: 1, latency: { ideal: 0 } },
        });
      } catch (e) {
        if (e.name === 'OverconstrainedError' || e.name === 'ConstraintNotSatisfiedError')
          this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });   // trình duyệt kén điều kiện → xin mic mặc định
        else throw e;
      }
    } catch (e) {
      this._pending = false; LIVE.delete(this);
      if (this._ownsContext) { try { await this.context?.close(); } catch {} }
      this.context = null;
      try { navigator.audioSession && !window.__micActive && (navigator.audioSession.type = 'playback'); } catch {}
      throw e;
    }

    this._pending = false;
    // Bị destroy() trong lúc chờ quyền mic: tắt NGAY luồng vừa mở (trước đây luồng này rò rỉ, mic bật mãi và kẹt âm thanh)
    if (this._destroyed) {
      this.stream?.getTracks().forEach(t => t.stop());
      this.stream = null; LIVE.delete(this);
      try { navigator.audioSession && !window.__micActive && (navigator.audioSession.type = 'playback'); } catch {}
      const err = new Error('Mic đã bị huỷ trong lúc chờ quyền'); err.name = 'AbortError'; throw err;
    }

    // iOS/Safari/Chrome Android có thể để AudioContext ở trạng thái "suspended" → mic toàn số 0
    // KHÔNG được chờ resume() vô hạn: máy host vào trận do tin nhắn mạng (không có thao tác chạm) nên
    // Safari/Chrome có thể giữ resume() ở trạng thái chờ → init() treo → mic không bao giờ bật.
    await Promise.race([this.resume(), new Promise(r => setTimeout(r, 400))]);
    if (this._destroyed || !this.context) { this.destroy(); const err = new Error('Mic đã bị huỷ'); err.name = 'AbortError'; throw err; }
    // Chưa chạy được thì đợi cú chạm/bấm phím đầu tiên rồi bật lại
    if (this.context.state !== 'running') {
      const wake = () => { this.resume(); if (this.context?.state === 'running') off(); };
      const off = () => ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach(e => window.removeEventListener(e, wake, true));
      ['pointerdown', 'touchstart', 'touchend', 'keydown', 'click'].forEach(e => window.addEventListener(e, wake, true));
      this._wakeOff = off;
    }

    const track = this.stream.getAudioTracks()[0];
    this.deviceLabel = track?.label || '';
    if (track) track.addEventListener('ended', () => { this.active = false; this.onProblem?.('ended'); });

    this.source = this.context.createMediaStreamSource(this.stream);
    this.analyser = this.context.createAnalyser();
    this.analyser.fftSize = 4096;               // ~85ms ở 48kHz: không bỏ sót âm thanh dù máy lag
    this.analyser.smoothingTimeConstant = 0;
    this.source.connect(this.analyser);         // không nối ra loa → không hú

    this.dataArray = new Float32Array(this.analyser.fftSize);
    this.active = true;
    this._silentMs = 0;

    this._stateHandler = () => {
      if (this.context && (this.context.state === 'suspended' || this.context.state === 'interrupted')) {
        this.context.resume?.().catch(() => {});
        this.onProblem?.('suspended');
      }
    };
    this.context.addEventListener?.('statechange', this._stateHandler);
  }

  /**
   * RMS lớn nhất trong phần âm thanh MỚI kể từ lần gọi trước (cửa sổ trượt 256 mẫu, cùng thang đo cũ).
   * @param {number} dtMs thời gian từ lần gọi trước (ms)
   * @returns {number} [0.0, 1.0]
   */
  getRMS(dtMs = 16) {
    if (!this.active || !this.analyser || !this.dataArray) return 0;

    this.analyser.getFloatTimeDomainData(this.dataArray);

    const N = this.dataArray.length;
    const WIN = 256, STRIDE = 64;
    const sr = this.context?.sampleRate || 44100;
    const fresh = Math.min(N, Math.ceil((Math.max(1, dtMs) * sr) / 1000) + WIN);

    let best = 0, lowest = Infinity;
    for (let end = N; end - WIN >= N - fresh; end -= STRIDE) {
      let sumSq = 0;
      for (let i = end - WIN; i < end; i++) { const v = this.dataArray[i]; sumSq += v * v; }
      const rms = Math.sqrt(sumSq / WIN);
      if (rms > best) best = rms;
      if (rms < lowest) lowest = rms;
    }
    this._lastRMS = Math.min(1.0, best);
    // Đáy âm lượng trong khung này: giúp thấy được quãng nghỉ rất ngắn giữa hai tiếng sủa dồn (max thì nuốt mất)
    this.minRMS = Math.min(this._lastRMS, lowest === Infinity ? best : lowest);

    // Im tuyệt đối (toàn số 0) quá 3 giây = mic bị tắt tiếng/ngữ cảnh âm thanh bị treo → thử khôi phục + báo
    if (best < 0.00002) {
      this._silentMs += dtMs;
      if (this._silentMs > 3000) {
        this._silentMs = 0;
        this.resume();
        this.onProblem?.('silent');
      }
    } else this._silentMs = 0;

    return this._lastRMS;
  }

  /** Peak lớn nhất trong buffer hiện tại [0,1] */
  getPeak() {
    if (!this.active || !this.analyser || !this.dataArray) return 0;
    this.analyser.getFloatTimeDomainData(this.dataArray);
    let peak = 0;
    for (const s of this.dataArray) { const a = Math.abs(s); if (a > peak) peak = a; }
    return Math.min(1.0, peak);
  }

  /** Thông tin kỹ thuật để hiển thị khi kiểm tra mic */
  info() {
    const t = this.stream?.getAudioTracks()[0];
    const st = t?.getSettings?.() || {};
    return {
      label: this.deviceLabel || I18n.t('mt.defaultMic'),
      state: this.context?.state || '—',
      sampleRate: this.context?.sampleRate || 0,
      echoCancellation: st.echoCancellation,
      trackState: t?.readyState || '—',
      muted: !!t?.muted,
    };
  }

  destroy() {
    this._destroyed = true;
    try { this._wakeOff?.(); } catch {}
    this.stream?.getTracks().forEach(t => t.stop());
    LIVE.delete(this);
    try { navigator.audioSession && !window.__micActive && (navigator.audioSession.type = 'playback'); } catch {}
    try { this.context?.removeEventListener?.('statechange', this._stateHandler); } catch {}
    try { this.source?.disconnect(); } catch {}
    if (this._ownsContext && this.context && this.context.state !== 'closed') this.context.close().catch(() => {});
    this.active = false;
    this.analyser = null; this.source = null; this.stream = null; this.dataArray = null; this.context = null;
  }

  /** Resume AudioContext nếu bị suspended (autoplay policy / iOS) */
  async resume() {
    try { if (this.context && this.context.state !== 'running' && this.context.state !== 'closed') await this.context.resume(); } catch {}
  }

  get isActive() { return this.active; }

  /** Luồng mic còn sống thật không? (iPhone hay làm chết luồng khi chuyển app / có cuộc gọi) */
  isLive() {
    const t = this.stream?.getAudioTracks?.()[0];
    return !!(this.active && t && t.readyState === 'live');
  }
}
