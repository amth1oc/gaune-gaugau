/**
 * SoundManager.js — Phát âm thanh procedural bằng Web Audio API
 *
 * Có file trong assets/audio/ thì phát file (tiếng sủa, bíp đếm ngược, nhạc nền...),
 * không có thì tự tạo tiếng bằng oscillator (riêng NHẠC NỀN thì im lặng nếu thiếu file).
 */
import { I18n } from '../core/I18n.js';

const IS_IOS = typeof navigator !== 'undefined' &&
  (/iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export class SoundManager {
  constructor() {
    /** @type {AudioContext|null} */
    this._ctx = null;
    /** @type {GainNode|null} */
    this._masterGain = null;
    this._volume = 0.7;
    this._muted = false;
    /** name → ArrayBuffer[] (nạp từ assets/audio qua AssetLoader) */
    this._rawFiles = new Map();
    /** name → AudioBuffer[] (đã giải mã) */
    this._buffers = new Map();

    // ── Nhạc nền ──
    /** @type {GainNode|null} cổng chung của nhạc: âm lượng nhạc × tắt tiếng × hạ nhỏ tạm thời */
    this._musicBus = null;
    this._musicVol = 0.6;
    this._musicDuck = 1;
    /** bài đang MUỐN phát: { name, volume, fade } (nhớ lại để phát ngay khi AudioContext sẵn sàng) */
    this._wantMusic = null;
    this._stopFade = 0.8;
    /** bài ĐANG phát: { name, src, gain } */
    this._music = null;

    // ── Quay lại từ app khác (iOS) ──
    this._hiddenAt = 0;          // lúc trang bị ẩn (ms)
    this._needRebuild = false;   // true = AudioContext cũ coi như hỏng, phải dựng cái mới
    this._lastRebuildAt = 0;
    this._failTaps = 0;
    this._recoverToken = 0;
  }

  /** Nhận danh sách file âm thanh thô; sẽ giải mã khi init() */
  setFiles(map) {
    this._rawFiles = map || new Map();
    if (this._ctx) this._decodeAll();
  }

  async _decodeAll() {
    if (this._decoding) return;                    // đang giải mã: vòng lặp bên dưới sẽ tự nhặt thêm file mới về
    this._decoding = true;
    this._tried = this._tried || new Set();
    // Hiệu ứng nhỏ trước → nhạc menu → nhạc trận (nặng nhất, để sau cùng cho khỏi khựng lúc mới vào game)
    const rank = (n) => (n === 'battleMusic' ? 2 : n === 'menuMusic' ? 1 : 0);
    try {
      for (;;) {
        const names = [...this._rawFiles.keys()].filter(n => !this._tried.has(n)).sort((a, b) => rank(a) - rank(b));
        if (!names.length || !this._ctx) break;
        const name = names[0];
        this._tried.add(name);
        const out = [];
        const ctx0 = this._ctx; let swapped = false;
        for (const ab of this._rawFiles.get(name) || []) {
          try { out.push(await ctx0.decodeAudioData(ab.slice(0))); }
          catch (e) {
            if (this._ctx !== ctx0) { swapped = true; break; }   // context bị dựng lại giữa chừng (quay lại từ app khác) → giải mã lại bằng context mới
            console.warn(`[Sound] Không giải mã được file cho "${name}"`, e);
          }
        }
        if (swapped) { this._tried.delete(name); continue; }
        if (out.length) { this._buffers.set(name, out); this._syncMusic(); }
        await new Promise(r => setTimeout(r, rank(name) ? 80 : 0));     // nhường luồng chính cho giao diện
      }
    } finally { this._decoding = false; }
  }

  /** Phát file âm thanh nếu có. @returns {boolean} true nếu đã phát */
  _playFile(name, { gain = 1, rate = 1, pan = 0 } = {}) {
    if (!this._ctx || this._muted) return false;
    const list = this._buffers.get(name);
    if (!list || !list.length) return false;
    // Giới hạn số tiếng sủa phát cùng lúc: sủa dồn không chất đống node âm thanh (trả true = coi như đã phát)
    const isBark = name === 'bark' || name === 'aiBark';
    if (isBark) {
      // Đếm bằng danh sách có hạn sử dụng: trước đây dùng bộ đếm +1/−1 theo onended; onended không bắn (context bị đóng/ngắt) thì
      // bộ đếm kẹt ≥ 10 và MỌI tiếng sủa sau đó bị nuốt im lặng cho tới khi tải lại trang.
      const nowMs = performance.now();
      this._voiceList = (this._voiceList || []).filter(v => nowMs - v < 2500);
      if (this._voiceList.length >= 10) return true;
    }
    const src = this._ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.playbackRate.value = rate;
    const g = this._ctx.createGain();
    g.gain.value = Math.max(0, Math.min(1.5, gain));
    src.connect(g);
    let out = g;
    if (pan && this._ctx.createStereoPanner) {      // ta nghe lệch trái, địch lệch phải
      const p = this._ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      g.connect(p); out = p;
    }
    out.connect(this._masterGain);
    if (isBark) this._voiceList.push(performance.now());
    src.start();
    return true;
  }

  /** Khởi tạo AudioContext (gọi sau user gesture) */
  /**
   * iPhone: công tắc gạt "im lặng" (chuông tắt) làm Web Audio câm hoàn toàn → nghe không thấy nhạc nền lẫn tiếng sủa.
   * Cách xử lý: đặt kiểu phiên âm thanh = 'playback' (iOS 16.4+), và phát một đoạn im lặng bằng thẻ <audio> (iOS cũ hơn).
   * Cần gọi trong lúc người chơi chạm màn hình.
   */
  _iosUnmute() {
    try { if (navigator.audioSession && !window.__micActive) navigator.audioSession.type = 'playback'; } catch {}
    try {
      if (!this._silentEl) {
        // WAV im lặng ~0,2 giây, 8 kHz, 8-bit
        const n = 1600, h = (a) => String.fromCharCode(...a);
        const le32 = (v) => h([v & 255, (v >> 8) & 255, (v >> 16) & 255, (v >> 24) & 255]);
        const wav = 'RIFF' + le32(36 + n) + 'WAVEfmt ' + le32(16) + h([1, 0, 1, 0]) + le32(8000) + le32(8000) + h([1, 0, 8, 0]) + 'data' + le32(n) + '\x80'.repeat(n);
        const a = new Audio('data:audio/wav;base64,' + btoa(wav));
        a.loop = true; a.setAttribute('playsinline', ''); a.volume = 0.01;
        this._silentEl = a;
      }
      if (this._silentEl.paused) this._silentEl.play().catch(() => {});
    } catch {}
  }

  /** Dựng AudioContext + các cổng âm lượng. Tách riêng để có thể dựng lại khi iOS làm hỏng context cũ. */
  _buildGraph() {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    this._ctx = ctx;
    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = this._muted ? 0 : this._volume;
    this._masterGain.connect(ctx.destination);
    this._musicBus = ctx.createGain();
    this._musicBus.gain.value = this._muted ? 0 : this._musicVol * this._musicDuck;
    this._musicBus.connect(ctx.destination);
    this._voiceList = [];
    ctx.addEventListener?.('statechange', () => {
      if (this._ctx !== ctx) return;
      if (ctx.state === 'running' && this._pendingRestart && !document.hidden) this._restartMusic();
      else if (ctx.state !== 'running' && ctx.state !== 'closed' && !document.hidden) {
        // Bị ngắt khi trang vẫn đang hiện (cuộc gọi đến, Siri, cắm/rút tai nghe, thông báo…): iOS/Android không báo 'ẩn trang'
        // nên trước đây không ai bật lại → mất tiếng cho tới khi thoát vào lại. Nay: đánh dấu cần bật lại + thử resume ngay.
        this._pendingRestart = true;
        try { ctx.resume().catch(() => {}); } catch {}
        setTimeout(() => { if (this._ctx === ctx && ctx.state !== 'running' && !document.hidden) this._recover(); }, 800);
      }
      this._updateHint();
    });
  }

  init() {
    this._iosUnmute();
    if (this._ctx) return;
    try {
      this._buildGraph();
      this._decodeAll();
      this._bindLifecycle();
    } catch (e) {
      console.warn('[Sound] Web Audio không khả dụng:', e);
    }
  }

  /**
   * Vòng đời trang. Lỗi: thoát Safari sang app khác / màn hình chính rồi quay lại thì MẤT NHẠC.
   * Trên iPhone, AudioContext sau khi bị ngắt thường KHÔNG sống lại được (resume() bị từ chối, hoặc báo "running" nhưng câm),
   * nên cách chắc chắn là DỰNG AUDIOCONTEXT MỚI (bộ nhớ âm thanh đã giải mã dùng lại được, không phải tải lại).
   * Quay lại → dựng context mới → chờ cú chạm đầu tiên để resume (iOS bắt buộc) → phát lại nhạc nền từ đầu.
   * Trong lúc chờ cú chạm có dòng nhắc nhỏ "Chạm màn hình để bật lại nhạc".
   */
  _bindLifecycle() {
    if (this._visBound) return;
    this._visBound = true;
    document.addEventListener('visibilitychange', () => {
      if (!this._ctx) return;
      if (document.hidden) this._silenceForHide();
      else this._onShow();
    });
    // iOS: vuốt về màn hình chính / chuyển app đôi khi chỉ bắn pagehide hoặc freeze (không có visibilitychange) → vẫn phải tắt tiếng
    window.addEventListener('pagehide', () => this._silenceForHide());
    document.addEventListener('freeze', () => this._silenceForHide());
    window.addEventListener('pageshow', (e) => {              // quay lại từ bộ nhớ đệm trang (bfcache): context đã bị đóng băng
      if (e.persisted && IS_IOS) this._needRebuild = true;
      this._onShow();
    });
    window.addEventListener('focus', () => { if (this._pendingRestart || this._ctx?.state !== 'running') this._onShow(); });
  }

  /**
   * Rời trang (màn hình chính / app khác / khoá máy / tab nền): TẮT HẲN tiếng ngay.
   * Lỗi cũ: trên iPhone nhạc nền vẫn phát khi đã thoát ra ngoài (phiên âm thanh 'playback' + thẻ <audio> im lặng giữ app sống),
   * phải đóng hẳn tab mới hết. Nay: dừng nguồn nhạc, tạm dừng AudioContext (mọi nền tảng), nhả phiên âm thanh.
   * Quay lại: _onShow() → _recover() sẽ dựng/bật lại và phát nhạc từ đầu (xem bên dưới).
   */
  _silenceForHide() {
    if (!this._ctx) return;
    if (!this._hiddenAt) this._hiddenAt = performance.now();
    this._pendingRestart = true;                          // lần quay lại tới sẽ phát lại nhạc
    const cur = this._music;
    if (cur) {
      this._music = null;
      try { cur.gain.gain.cancelScheduledValues(0); cur.gain.gain.value = 0; } catch {}
      try { cur.src.stop(); } catch {}
      try { cur.src.disconnect(); cur.gain.disconnect(); } catch {}
    }
    try { this._silentEl?.pause(); } catch {}
    try { if (navigator.audioSession) navigator.audioSession.type = 'ambient'; } catch {}   // nhả phiên 'playback' để iOS không giữ âm thanh chạy nền
    try { this._ctx.suspend?.().catch(() => {}); } catch {}
    if (this._hintEl) this._hintEl.classList.remove('show');
  }

  _onShow() {
    if (document.hidden || !this._ctx) return;
    const away = this._hiddenAt ? performance.now() - this._hiddenAt : 0;
    this._hiddenAt = 0;
    if (IS_IOS && away > 1000) this._needRebuild = true;      // rời trang > 1 giây: coi như context cũ đã hỏng
    this._recover();
  }

  /**
   * Gọi khi mic vừa được tắt để dựng lại (màn trận quay lại từ app khác): cho phép dựng AudioContext mới ngay.
   * @returns {Promise<void>}
   */
  refreshAfterReturn() {
    if (!this._ctx || document.hidden) return Promise.resolve();
    if (IS_IOS) this._needRebuild = true;
    return this._recover();
  }

  /** Có được phép dựng lại context không? (mic đang dùng context hiện tại thì không đụng vào) */
  _canRebuild() { return !window.__micActive; }

  /** Thay AudioContext hỏng bằng cái mới, giữ nguyên âm lượng/tắt tiếng/bài đang muốn phát. */
  _rebuildContext() {
    const old = this._ctx, cur = this._music;
    try { this._buildGraph(); } catch (e) { console.warn('[Sound] Không dựng lại được AudioContext:', e); return false; }
    this._music = null;
    this._needRebuild = false;
    this._pendingRestart = true;
    this._lastRebuildAt = performance.now();
    if (cur) { try { cur.src.stop(); } catch {} try { cur.src.disconnect(); cur.gain.disconnect(); } catch {} }
    try { old?.close?.(); } catch {}
    if (this._decoding === false && this._rawFiles.size) this._decodeAll();   // file nào chưa giải mã xong thì làm tiếp bằng context mới
    return true;
  }

  /** Bật lại âm thanh sau khi quay lại trang. */
  async _recover() {
    if (!this._ctx || document.hidden || this._ctx.state === 'closed') return;
    const token = ++this._recoverToken;
    this._iosUnmute();
    if (this._needRebuild && this._canRebuild()) this._rebuildContext();
    const ctx = this._ctx;
    try { await Promise.race([ctx.resume(), sleep(600)]); } catch {}
    if (token !== this._recoverToken || ctx !== this._ctx || document.hidden) return;
    if (ctx.state === 'running') {
      if (this._pendingRestart) this._restartMusic();
      this._retry = 0;
    } else {
      this._pendingRestart = true;     // iOS đòi cú chạm: unlock() sẽ bật lại ở cú chạm đầu tiên
      if ((this._retry = (this._retry || 0) + 1) <= 3) setTimeout(() => { if (!document.hidden && this._ctx?.state !== 'running') this._recover(); }, 700);
    }
    this._updateHint();
  }

  /** Dòng nhắc nhỏ khi nhạc đang chờ cú chạm để bật lại. */
  _updateHint() {
    const need = !!(this._ctx && this._ctx.state !== 'running' && this._ctx.state !== 'closed' && this._pendingRestart && !document.hidden);
    let el = this._hintEl;
    if (!el) {
      if (!need) return;
      el = this._hintEl = document.createElement('div');
      el.className = 'audio-hint'; el.setAttribute('role', 'status'); el.setAttribute('aria-live', 'polite');
      el.dataset.i18n = 'snd.tap'; el.textContent = I18n.t('snd.tap');
      document.body.appendChild(el);
    }
    el.classList.toggle('show', need);
  }

  /** Dựng lại nguồn nhạc nền từ đầu (nguồn cũ có thể đã chết ngầm sau khi hệ điều hành ngắt âm thanh). */
  _restartMusic() {
    this._pendingRestart = false;
    const ctx = this._ctx;
    if (!ctx) return;
    const cur = this._music;
    if (cur) {
      this._music = null;
      try { cur.src.stop(); } catch {}
      try { cur.src.disconnect(); cur.gain.disconnect(); } catch {}
    }
    if (this._wantMusic) this._wantMusic = { ...this._wantMusic, fade: 0.4 };
    this._syncMusic();
    this._updateHint();
  }

  async _resume() {
    const st = this._ctx?.state;
    if (st && st !== 'running' && st !== 'closed') {       // gồm cả 'interrupted' (iOS sau khi dùng mic/cuộc gọi)
      try { await this._ctx.resume(); } catch {}
    }
  }

  /** AudioContext chung của game (null nếu chưa mở khoá bằng cú chạm đầu tiên) */
  get audioContext() { return this._ctx; }

  /** Gọi trong lúc người chơi chạm màn hình: bật lại âm thanh nếu trình duyệt đang giữ ở trạng thái dừng. */
  unlock() {
    if (document.hidden) return;
    this._iosUnmute();
    if (!this._ctx) return;
    let ctx = this._ctx;
    if (this._needRebuild && this._canRebuild()) { this._rebuildContext(); ctx = this._ctx; }   // quay lại chưa kịp dựng → dựng ngay trong cú chạm
    if (ctx.state === 'closed') return;
    if (ctx.state === 'running') {
      this._failTaps = 0;
      if (this._pendingRestart) this._restartMusic();
      return;
    }
    // Chạm mà context vẫn không chịu chạy ≥ 2 lần liên tiếp → dựng mới NGAY trong cú chạm (lúc này mới được phép bắt đầu phát)
    if (++this._failTaps >= 2 && IS_IOS && this._canRebuild() && performance.now() - this._lastRebuildAt > 1500) {
      this._failTaps = 0; this._rebuildContext(); ctx = this._ctx;
    }
    const resumed = ctx.resume();
    Promise.race([resumed, sleep(800)]).then(() => {
      if (ctx !== this._ctx) return;
      if (ctx.state === 'running' && this._pendingRestart) this._restartMusic();
      this._updateHint();
    }).catch(() => {});
  }

  setVolume(v) {
    this._volume = Math.max(0, Math.min(1, v));
    if (this._masterGain) this._masterGain.gain.value = this._muted ? 0 : this._volume;
  }

  setMuted(m) {
    this._muted = m;
    if (this._masterGain) this._masterGain.gain.value = m ? 0 : this._volume;
    this._applyMusicBus();
  }

  // ─── Nhạc nền ─────────────────────────────

  /** Âm lượng nhạc nền 0..1 (tách riêng với hiệu ứng) */
  setMusicVolume(v) {
    this._musicVol = Math.max(0, Math.min(1, v));
    this._applyMusicBus();
  }

  /** Hạ nhỏ/tắt nhạc tạm thời (1 = bình thường, 0 = im), vd. lúc đang kiểm tra mic */
  setMusicDuck(f) {
    this._musicDuck = Math.max(0, Math.min(1, f));
    this._applyMusicBus();
  }

  _applyMusicBus() {
    if (!this._musicBus || !this._ctx) return;
    const v = this._muted ? 0 : this._musicVol * this._musicDuck;
    this._musicBus.gain.setTargetAtTime(v, this._ctx.currentTime, 0.08);
  }

  /**
   * Phát nhạc nền lặp vô hạn; đang phát bài khác thì chuyển mượt (cross-fade).
   * Gọi lại với cùng tên bài thì không làm gì. Chưa bật được âm thanh (chưa chạm màn hình)
   * hoặc chưa giải mã xong thì nhớ lại và tự phát sau.
   * @param {string} name   'menuMusic' | 'battleMusic'
   * @param {{volume?:number, fade?:number}} opts  volume 0..1 (độ lớn riêng của bài), fade (giây)
   */
  playMusic(name, { volume = 1, fade = 1.2 } = {}) {
    const w = this._wantMusic;
    if (w && w.name === name) {
      w.volume = volume;
      if (this._music?.name === name && this._ctx)
        this._music.gain.gain.setTargetAtTime(volume, this._ctx.currentTime, 0.2);
      return;
    }
    this._wantMusic = { name, volume, fade };
    this._syncMusic();
  }

  /** Tắt nhạc nền dần trong `fade` giây */
  stopMusic(fade = 0.8) {
    this._wantMusic = null;
    this._stopFade = fade;
    this._syncMusic();
  }

  /** Đưa trạng thái đang phát về đúng bài muốn phát */
  _syncMusic() {
    const ctx = this._ctx;
    if (!ctx) return;
    const want = this._wantMusic, cur = this._music;
    if (cur && want && cur.name === want.name) return;
    if (!cur && !want) return;
    const list = want ? this._buffers.get(want.name) : null;
    if (want && !(list && list.length)) {
      // bài mới chưa sẵn sàng (đang giải mã / không có file): giữ nguyên bài cũ nếu muốn đổi, im lặng nếu không
      if (cur) { this._fadeOutMusic(cur, want.fade); this._music = null; }
      return;
    }
    if (cur) { this._fadeOutMusic(cur, want ? want.fade : this._stopFade); this._music = null; }
    if (!want) return;

    this._resume();
    const src = ctx.createBufferSource();
    src.buffer = list[Math.floor(Math.random() * list.length)];
    src.loop = true;                                   // file nhạc được tạo để lặp liền mạch
    const g = ctx.createGain();
    const now = ctx.currentTime;
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(want.volume, now + Math.max(0.05, want.fade));
    src.connect(g); g.connect(this._musicBus);
    src.start(0);
    this._music = { name: want.name, src, gain: g };
  }

  _fadeOutMusic(m, fade) {
    const ctx = this._ctx, now = ctx.currentTime, f = Math.max(0.05, fade);
    try {
      m.gain.gain.cancelScheduledValues(now);
      m.gain.gain.setValueAtTime(m.gain.gain.value, now);
      m.gain.gain.linearRampToValueAtTime(0, now + f);
      m.src.stop(now + f + 0.05);
    } catch { /* đã dừng */ }
    setTimeout(() => { try { m.src.disconnect(); m.gain.disconnect(); } catch {} }, (f + 0.3) * 1000);
  }

  // ─── Low-level helpers ────────────────────

  /**
   * Phát một tone đơn giản.
   * @param {number} freq - Hz
   * @param {number} duration - giây
   * @param {'sine'|'square'|'sawtooth'|'triangle'} type
   * @param {number} gainVal - 0.0-1.0
   * @param {number} startDelay - giây delay
   */
  _tone(freq, duration, type = 'sine', gainVal = 0.3, startDelay = 0) {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime + startDelay;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);

    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    osc.connect(gain);
    gain.connect(this._masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.01);
  }

  /**
   * Phát noise (tiếng ồn trắng).
   * @param {number} duration - giây
   * @param {number} gainVal
   * @param {number} startDelay
   */
  _noise(duration, gainVal = 0.2, startDelay = 0) {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx;
    const now = ctx.currentTime + startDelay;
    const sampleRate = ctx.sampleRate;
    const bufLen = Math.ceil(sampleRate * duration);
    const buf = ctx.createBuffer(1, bufLen, sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;

    // Bandpass để tạo âm thanh giống tiếng sủa
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.Q.value = 0.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(gainVal, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this._masterGain);
    src.start(now);
  }

  // ─── Public sound effects ─────────────────

  /** Tiếng sủa ngắn (GÂU!) */
  async playBark(volume = 0.5, comboCount = 1, pitch = 1) {
    if (this._ctx && this._ctx.state !== 'running') await this._resume();      // đang chạy thì phát NGAY, không chờ microtask
    const up = Math.min(Math.max(comboCount - 1, 0), 4) * 0.02;       // combo càng cao tiếng càng "cao" một chút
    if (this._playFile('bark', { gain: 0.5 + volume, rate: (0.94 + Math.random() * 0.12 + up) * pitch * (1.04 - Math.min(volume, 0.8) * 0.1), pan: -0.25 })) return;
    const v = Math.min(1, volume * 1.2);
    this._noise(0.12, v * 0.5);
    this._tone(280 + volume * 200, 0.15, 'sawtooth', v * 0.25);
    this._tone(180, 0.1, 'sine', v * 0.15, 0.05);
  }

  /** Tiếng sủa AI */
  async playAIBark(volume = 0.4) {
    if (this._ctx && this._ctx.state !== 'running') await this._resume();
    if (this._playFile('aiBark', { gain: 0.45 + volume, rate: 0.92 + Math.random() * 0.1, pan: 0.3 })) return;
    const v = Math.min(1, volume * 1.0);
    this._noise(0.1, v * 0.4);
    this._tone(200 + volume * 150, 0.12, 'sawtooth', v * 0.2);
  }

  /** Tiếng KO (slam) */
  async playKO() {
    await this._resume();
    if (this._playFile('ko')) return;
    // Boom xuống
    if (!this._ctx) return;
    const ctx = this._ctx;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.5);
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc.connect(gain);
    gain.connect(this._masterGain);
    osc.start(now);
    osc.stop(now + 0.65);
    // Impact noise
    this._noise(0.08, 0.8);
  }

  /** Tiếng combo lên */
  async playCombo(comboCount) {
    await this._resume();
    this._playFile('combo', { rate: 1 + Math.min(comboCount - 2, 4) * 0.06 });   // không có file thì im (tiếng sủa đã phát rồi)
  }

  /** Một nốt có "vào – ra" mượt (không bị lách tách như _tone). */
  _note(freq, dur, { type = 'triangle', gain = 0.25, delay = 0, attack = 0.012, slideTo = null, lowpass = 0, vibrato = 0 } = {}) {
    if (!this._ctx || this._muted) return;
    const ctx = this._ctx, t0 = ctx.currentTime + delay, t1 = t0 + dur;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t1);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + attack);
    g.gain.setValueAtTime(gain, Math.max(t0 + attack, t1 - Math.min(0.25, dur * 0.5)));
    g.gain.exponentialRampToValueAtTime(0.0001, t1);
    let node = osc;
    if (lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; f.Q.value = 1.2; osc.connect(f); node = f; }
    node.connect(g); g.connect(this._masterGain);
    if (vibrato) {
      const lfo = ctx.createOscillator(), lg = ctx.createGain();
      lfo.frequency.value = 6; lg.gain.value = vibrato;
      lfo.connect(lg); lg.connect(osc.frequency); lfo.start(t0); lfo.stop(t1 + 0.05);
    }
    osc.start(t0); osc.stop(t1 + 0.05);
  }

  /** Countdown beep */
  async playCountdownTick() {
    await this._resume();
    if (this._playFile('countdownTick', { gain: 1.1 })) return;
    this._tone(440, 0.1, 'sine', 0.3);
  }

  /** Countdown GO! */
  async playCountdownGo() {
    await this._resume();
    if (this._playFile('countdownGo', { gain: 1.1 })) return;
    this._tone(880, 0.12, 'sine', 0.4);
    this._tone(1100, 0.12, 'sine', 0.3, 0.1);
  }

  /** Nhạc thắng — kèn "ta-ta-ta-TAAA" + hợp âm vang + vài tiếng lấp lánh (tự tổng hợp, không dùng file ngoài) */
  async playWin() {
    await this._resume();
    if (this._playFile('win')) return;
    const N = { G4: 392, C5: 523.25, E5: 659.25, G5: 784, C6: 1046.5, E6: 1318.5 };
    // Mở đầu: 3 nốt ngắn đi lên (kèn)
    [[N.G4, 0], [N.C5, 0.13], [N.E5, 0.26]].forEach(([f, d]) =>
      this._note(f, 0.16, { type: 'square', gain: 0.10, delay: d, lowpass: 2200 }));
    // Nốt chốt dài + hợp âm C trưởng
    const t = 0.42;
    [[N.G5, 0.13], [N.E5, 0.10], [N.C5, 0.10], [N.C6, 0.08]].forEach(([f, g]) => {
      this._note(f, 1.0, { type: 'triangle', gain: g, delay: t, attack: 0.02 });
      this._note(f * 1.004, 1.0, { type: 'sawtooth', gain: g * 0.25, delay: t, attack: 0.03, lowpass: 2600 });
    });
    // Lấp lánh
    [N.C6, N.E6, N.G5 * 2, N.C6 * 2].forEach((f, i) =>
      this._note(f, 0.18, { type: 'sine', gain: 0.07, delay: t + 0.25 + i * 0.09 }));
  }

  /** Nhạc thua — "wah-wah-wah-waaah" kiểu kèn buồn */
  async playLose() {
    await this._resume();
    if (this._playFile('lose')) return;
    const o = { type: 'sawtooth', gain: 0.13, lowpass: 900, attack: 0.03 };
    this._note(392,    0.26, { ...o, delay: 0,    slideTo: 380 });
    this._note(370,    0.26, { ...o, delay: 0.30, slideTo: 358 });
    this._note(349.2,  0.26, { ...o, delay: 0.60, slideTo: 338 });
    this._note(329.6,  1.00, { ...o, delay: 0.92, slideTo: 246, vibrato: 7, lowpass: 700 });   // nốt cuối kéo dài, tụt xuống
  }

  /** UI click sound */
  playClick() {
    if (!this._ctx || this._muted) return;
    if (this._playFile('click')) return;
    this._tone(600, 0.06, 'sine', 0.15);
  }
}
