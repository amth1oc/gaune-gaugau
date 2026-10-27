/**
 * NetSession.js — Kết nối 2 người chơi qua WebRTC (PeerJS)
 *
 * - Người tạo phòng (host) nhận một MÃ 5 ký tự; người vào phòng (guest) nhập mã đó.
 * - PeerJS chỉ dùng máy chủ công cộng để "bắt tay" ban đầu; sau đó dữ liệu đi thẳng máy–máy (hoặc qua TURN).
 * - Mọi tin nhắn là object JSON có trường `t` (loại tin).
 * - Tin nội bộ phát ra cho người nghe: { t:'__close' } khi đứt kết nối, { t:'__error', message }.
 *
 * Độ ổn định:
 *  - Có "nhịp tim": nếu DEAD_AFTER_MS không nhận được tin nào → coi như đứt (không phải chờ trình duyệt báo 30–60s).
 *  - Vào phòng tự thử lại khi phòng chưa kịp đăng ký trên máy chủ ghép phòng.
 *  - Báo lỗi ICE "failed" ngay (thường do mạng cần TURN) thay vì chờ hết 25s.
 *  - Ping làm mượt (EWMA) + đo dao động (jitter) để đánh giá chất lượng: good / ok / bad.
 */
import { NET_CONFIG, FALLBACK_ICE, isHideIp } from './net-config.js';
import { I18n } from '../core/I18n.js';          // chỉ để dịch thông báo hiển thị; KHÔNG dùng trong giao thức/tin nhắn mạng

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // bỏ O/0/I/1 cho dễ đọc
const PREFIX   = 'gaugau-';          // tiền tố ID trên máy chủ ghép phòng (đổi cùng tên game: bản cũ và mới không vào nhầm phòng của nhau)

function randomCode(n = 5) {
  // Dùng bộ sinh số ngẫu nhiên của trình duyệt (khó đoán hơn Math.random) để mã phòng không dò ra được
  const buf = new Uint32Array(n);
  try { crypto.getRandomValues(buf); } catch { for (let i = 0; i < n; i++) buf[i] = Math.floor(Math.random() * 4294967296); }
  let s = '';
  for (let i = 0; i < n; i++) s += ALPHABET[buf[i] % ALPHABET.length];   // 32 ký tự → chia hết 2^32, không lệch
  return s;
}

/** Trình duyệt nhúng trong app (Zalo, Messenger, Facebook, Instagram, TikTok, Line…): hay chặn mic / WebRTC. */
export function inAppBrowserName() {
  const ua = (typeof navigator !== 'undefined' && navigator.userAgent) || '';
  if (/Zalo/i.test(ua)) return 'Zalo';
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(ua)) return 'Facebook/Messenger';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/musical_ly|TikTok|BytedanceWebview/i.test(ua)) return 'TikTok';
  if (/Line\//i.test(ua)) return 'Line';
  if (/Telegram/i.test(ua)) return 'Telegram';
  return '';
}

export function normalizeCode(raw) {
  return String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

// ── ICE (STUN/TURN) ─────────────────────────────────────
let _iceCache = null;   // { raw, source, at, ttl }  (raw = danh sách gốc; lọc theo chế độ riêng tư mỗi lần lấy, nên bật/tắt có hiệu lực ngay)

/** Xin thông tin TURN tạm thời từ hàm máy chủ (khoá bí mật không bao giờ xuống trình duyệt). null nếu không có/lỗi. */
async function fetchTempTurn() {
  const url = NET_CONFIG.TURN_ENDPOINT;
  if (!url || typeof fetch !== 'function') return null;
  for (let attempt = 0; attempt < 2; attempt++) {     // hàm khởi động nguội có thể chậm vài giây ở lần gọi đầu: thử lại 1 lần trước khi bỏ cuộc
    const r = await fetchTempTurnOnce(url, attempt === 0 ? 7000 : 5000);
    if (r) return r;
    if (r === false) return null;                     // 404/503…: không có hàm hoặc chưa cấu hình, thử lại cũng vô ích
  }
  return null;
}

/** @returns {Promise<{list,ttl}|null|false>} null = lỗi tạm (đáng thử lại), false = chắc chắn không có hàm */
async function fetchTempTurnOnce(url, timeoutMs) {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = setTimeout(() => ctl?.abort(), timeoutMs);
  try {
    const r = await fetch(url, { cache: 'no-store', signal: ctl?.signal });
    if (r.status === 404 || r.status === 503 || r.status === 403 || r.status === 405) return false;
    if (!r.ok) return null;
    const j = await r.json();
    const list = Array.isArray(j?.iceServers) ? j.iceServers.filter(s => s && s.urls && /^(stun|turns?):/i.test([].concat(s.urls)[0])) : [];
    if (!list.some(s => /^turns?:/i.test([].concat(s.urls)[0]) && s.username && s.credential)) return null;
    // Nhớ tới trước khi credential hết hạn 10 phút (tối đa 30 phút)
    const ttl = Math.max(60, Math.min(30 * 60, (Number(j.ttl) || 1800) - 600)) * 1000;
    return { list, ttl };
  } catch { return null; }
  finally { clearTimeout(timer); }
}

let _icePending = null;   // yêu cầu xin ICE đang chạy: prefetch, kiểm tra mạng, tạo/vào phòng cùng hỏi thì dùng chung MỘT lần gọi /api/turn (tránh 2–3 lần khởi động nguội song song)
function loadIce() {
  if (_iceCache && Date.now() - _iceCache.at < _iceCache.ttl) return Promise.resolve(_iceCache);
  return _icePending || (_icePending = _loadIceUncached().finally(() => { _icePending = null; }));
}

/** Bỏ key đã nhớ: gọi khi thử relay thất bại bằng key Metered (credential hỏng/chưa lan) để lần sau xin key MỚI thay vì dùng lại key xấu tới 30 phút. */
export function resetIce() { _iceCache = null; }

async function _loadIceUncached() {
  // 0) Thông tin TURN tạm thời từ máy chủ (cách khuyến nghị)
  const tmp = await fetchTempTurn();
  if (tmp) return (_iceCache = { raw: [...tmp.list, ...FALLBACK_ICE], source: 'metered', at: Date.now(), ttl: tmp.ttl });
  // 1) TURN riêng (Metered) + TURN công cộng làm dự phòng phía sau: Metered hết hạn mức/lỗi thì vẫn còn đường khác
  const { METERED_USER: u, METERED_PASS: pw } = NET_CONFIG;
  if (u && pw) {
    const host = 'global.relay.metered.ca';
    const own = [
      { urls: 'stun:stun.relay.metered.ca:80' },
      { urls: `turn:${host}:80`, username: u, credential: pw },
      { urls: `turn:${host}:80?transport=tcp`, username: u, credential: pw },
      { urls: `turn:${host}:443`, username: u, credential: pw },
      { urls: `turns:${host}:443?transport=tcp`, username: u, credential: pw },
    ];
    return (_iceCache = { raw: [...own, ...FALLBACK_ICE], source: 'metered', at: Date.now(), ttl: 10 * 60 * 1000 });
  }
  // 2) Dự phòng công cộng. Nhớ ngắn (30 giây) để lần sau thử lại hàm máy chủ sớm.
  return (_iceCache = { raw: FALLBACK_ICE, source: 'public', at: Date.now(), ttl: 15 * 1000 });
}

/** Gọi sớm (khi mở màn Online) để lúc bấm Tạo phòng/Kiểm tra lại không phải chờ hàm máy chủ nữa. */
export function prefetchIce() { loadIce().catch(() => {}); }

/** Lấy danh sách ICE theo chế độ riêng tư hiện tại. */
export async function getIceServers() {
  const c = await loadIce();
  return { servers: onlyRelay(c.raw), source: c.source };
}

/**
 * Giấu IP bật → bỏ mọi máy chủ STUN (không để Google/Twilio thấy IP) và chỉ giữ TURN.
 * Nếu không còn TURN nào thì trả danh sách RỖNG (kết nối sẽ thất bại và báo lỗi) — TUYỆT ĐỐI không quay về STUN làm lộ IP.
 */
function onlyRelay(list) {
  if (!isHideIp()) return list;
  return list.filter(s => [].concat(s.urls || []).some(u => /^turns?:/i.test(u)));
}

function peerOptions(iceServers) {
  const o = { config: { iceServers, iceCandidatePoolSize: 2, ...(isHideIp() ? { iceTransportPolicy: 'relay' } : {}) }, debug: 0 };
  if (NET_CONFIG.PEER_SERVER) Object.assign(o, NET_CONFIG.PEER_SERVER);
  return o;
}

export class NetSession {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.role = null;          // 'host' | 'guest'
    this.code = '';
    this.connected = false;
    this.latency = 0;          // ms (vòng đi-về, đã làm mượt)
    this.jitter = 0;           // ms (dao động ping)
    this.lost = 0;             // số ping không được trả lời liên tiếp
    this._listeners = new Set();
    this._pingTimer = null;
    this._deadTimer = null;
    this._lastRx = 0;
    this._closed = false;
    this._visibilityHandler = null;
    this._reconnects = 0;
    this.deadAfterMs = null;   // null = dùng NET_CONFIG.DEAD_AFTER_MS; sảnh đặt dài hơn cho người đang đổi quyền mic / chuyển app
  }

  static available() { return typeof window !== 'undefined' && typeof window.Peer === 'function'; }

  /** Đánh giá chất lượng kết nối hiện tại */
  get quality() {
    if (!this.connected) return 'none';
    if (this.lost >= 2 || this.latency > 400 || this.jitter > 150) return 'bad';
    if (this.latency > 180 || this.jitter > 60) return 'ok';
    return 'good';
  }

  /**
   * Kiểm tra máy chủ ghép phòng: thử mở một kết nối thật và đo thời gian.
   * @returns {Promise<{ok:boolean, ms?:number, reason?:string}>}
   */
  static async checkServer(timeoutMs = 12000) {
    if (!NetSession.available()) return { ok: false, reason: I18n.t('net.noPeerLib') };
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { ok: false, reason: I18n.t('net.offline') };
    const { servers } = await getIceServers();
    return new Promise((resolve) => {
      let done = false, peer = null;
      const t0 = performance.now();
      const finish = (r) => { if (done) return; done = true; clearTimeout(timer); try { peer?.destroy(); } catch {} resolve(r); };
      const timer = setTimeout(() => finish({ ok: false, reason: I18n.t('net.srvTimeout') }), timeoutMs);
      try {
        peer = new window.Peer(PREFIX + 'chk' + randomCode(), peerOptions(servers));
        peer.on('open', () => finish({ ok: true, ms: Math.round(performance.now() - t0) }));
        peer.on('error', (err) => finish({ ok: false, reason: new NetSession()._friendly(err).message }));
      } catch (e) { finish({ ok: false, reason: e.message }); }
    });
  }

  /**
   * Chẩn đoán xuyên NAT: thu thập ICE candidate và xem có
   *   srflx (STUN hoạt động → kết nối trực tiếp được với đa số mạng) và
   *   relay (TURN hoạt động → kết nối được cả mạng 4G/5G, Wi-Fi công ty khắt khe).
   * @returns {Promise<{ok:boolean, stun:boolean, turn:boolean, source:string, ms:number, reason?:string}>}
   */
  static async diagnose(timeoutMs = 10000) {
    if (typeof RTCPeerConnection === 'undefined') return { ok: false, stun: false, turn: false, source: '-', ms: 0, reason: I18n.t('net.noWebrtc') };
    const { servers, source } = await getIceServers();
    return new Promise((resolve) => {
      const t0 = performance.now();
      let pc, stun = false, turn = false, done = false;
      const errs = [], seen = new Set();
      const finish = () => {
        if (done) return; done = true; clearTimeout(timer);
        try { pc.close(); } catch {}
        // Chi tiết kỹ thuật khi không có relay: giúp biết do mạng chặn (701), sai tài khoản (401/403) hay tiện ích trình duyệt chặn WebRTC (không có lỗi nào)
        const detail = turn ? '' : (errs.length ? [...new Set(errs)].slice(0, 3).join(' · ') : (seen.size ? 'candidates: ' + [...seen].join(',') : 'no candidates'));
        resolve({ ok: isHideIp() ? turn : (stun || turn), stun, turn, source, detail, ms: Math.round(performance.now() - t0) });
      };
      const timer = setTimeout(finish, timeoutMs);
      try {
        pc = new RTCPeerConnection({ iceServers: servers, ...(isHideIp() ? { iceTransportPolicy: 'relay' } : {}) });
        pc.createDataChannel('probe');
        pc.onicecandidateerror = (e) => { errs.push(`${e.errorCode || '?'} ${String(e.url || '').replace(/\?.*$/, '')}`.trim()); };
        pc.onicecandidate = (e) => {
          if (!e.candidate) return finish();                    // thu thập xong
          const c = e.candidate.candidate || '';
          const m = c.match(/ typ (\w+)/); if (m) seen.add(m[1]);
          if (/ typ srflx /.test(c)) stun = true;
          if (/ typ relay /.test(c)) { turn = true; if (stun || isHideIp()) finish(); }
        };
        pc.createOffer().then(o => pc.setLocalDescription(o)).catch(finish);
      } catch { finish(); }
    });
  }

  /** Đăng ký nhận tin. Trả về hàm huỷ. */
  on(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }

  _emit(msg) { for (const fn of [...this._listeners]) { try { fn(msg); } catch (e) { console.error('[Net]', e); } } }

  send(msg) {
    if (!this.conn || !this.connected) return false;
    try { this.conn.send(msg); return true; } catch { return false; }
  }

  /** Tạo phòng. Resolve với mã phòng ngay khi sẵn sàng; `onGuest` gọi khi có người vào. */
  async host(onGuest) {
    this.role = 'host';
    this._setupVisibility();
    if (!NetSession.available()) throw new Error(I18n.t('net.noPeerLib2'));
    const { servers } = await getIceServers();
    return new Promise((resolve, reject) => {
      let tries = 0;
      const timer = setTimeout(() => { if (!this.code) { reject(new Error(I18n.t('net.hostSlow'))); this.close(); } }, 15000);
      const create = () => {
        const code = randomCode();
        const peer = new window.Peer(PREFIX + code, peerOptions(servers));
        this.peer = peer;
        peer.on('open', () => {
          clearTimeout(timer); this.code = code; this._reconnects = 0; resolve(code);
          // Đang chờ bạn vào: cứ vài giây kiểm tra phòng còn đăng ký trên máy chủ không (bắt được cả trường hợp socket chết im lặng)
          clearInterval(this._sigTimer);
          this._sigTimer = setInterval(() => { if (!this._closed && !this.connected && document.visibilityState === 'visible') this._ensureSignaling(); }, 4000);
        });
        peer.on('connection', (conn) => {
          // Phòng chỉ 2 người. NHƯNG nếu người cũ đã im quá ~3 nhịp ping (rớt mạng / bị tắt app nhưng kết nối chưa kịp báo đứt)
          // thì nhường chỗ cho lần vào lại — trước đây phải chờ 7–25 giây và bị báo "Phòng đã đầy hoặc bị đóng".
          if (this.conn && this.connected) {
            const stale = performance.now() - this._lastRx > NET_CONFIG.PING_EVERY_MS * 3;
            if (!stale) { try { conn.close(); } catch {} return; }
            this.connected = false; this._stopBeat();
            this._emit({ t: '__close' });
          }
          // Lần thử trước chưa kịp mở (ICE hỏng, điện thoại chuyển app…) → bỏ kết nối chết, nhận người vào lại.
          // (Trước đây host giữ conn chết mãi và từ chối mọi lần vào lại với lỗi "Phòng đã đầy".)
          if (this.conn) { try { this.conn.close(); } catch {} this.conn = null; }
          this._attach(conn);
          conn.on('open', () => { this.connected = true; this._startBeat(); onGuest?.(); });
        });
        peer.on('error', (err) => {
          if (this.code) {
            // Đã có phòng: nối lại máy chủ ghép phòng bị đứt có thể gặp 'unavailable-id' (máy chủ còn giữ socket cũ vài giây).
            // TUYỆT ĐỐI không tạo mã mới (trước đây mã đổi ngầm, màn hình vẫn hiện mã cũ → bạn nhập mã cũ báo \"không tìm thấy phòng\").
            if (err.type === 'unavailable-id') { this._reconnects = Math.min(this._reconnects, 6); setTimeout(() => this._reconnectSignaling(), 3000); return; }
            if (!this.connected) this._emit({ t: '__error', message: this._friendly(err).message });
            return;
          }
          if (err.type === 'unavailable-id' && tries++ < 5) { try { peer.destroy(); } catch {} return create(); }
          clearTimeout(timer); return reject(this._friendly(err));
        });
        peer.on('disconnected', () => this._reconnectSignaling());
      };
      create();
    });
  }

  /**
   * Máy chủ ghép phòng còn nghe mình không? iOS/Android hay giết WebSocket nền (host chuyển sang Zalo/Messenger gửi link)
   * mà KHÔNG báo 'disconnected' → phòng biến mất khỏi máy chủ, bạn bấm link báo "không tìm thấy phòng" dù host vẫn thấy mã.
   * Gọi khi quay lại app / có mạng lại / định kỳ lúc host đang chờ khách. `reset` = cho thử lại từ đầu (bỏ giới hạn số lần).
   */
  _ensureSignaling(reset = false) {
    const p = this.peer;
    if (this._closed || !p || p.destroyed) return;
    const sock = p.socket;
    const wsDead = !!sock && typeof sock._wsOpen === 'function' && !sock._wsOpen();
    if (!p.disconnected && !wsDead) return;
    if (reset) this._reconnects = 0;
    if (!p.disconnected) { try { p.disconnect(); } catch {} return; }     // bắn 'disconnected' → _reconnectSignaling tự nối lại
    this._reconnectSignaling();
  }

  /** Nối lại máy chủ ghép phòng (giữ nguyên mã phòng), thử tối đa vài lần với độ trễ tăng dần. */
  _reconnectSignaling() {
    if (this._closed || !this.peer || this.peer.destroyed || !this.peer.disconnected) return;
    if (this._reconnects >= 8) return;
    const wait = Math.min(8000, 800 * 2 ** this._reconnects++);
    setTimeout(() => {
      if (this._closed || !this.peer || this.peer.destroyed) return;
      if (this.peer.disconnected) { try { this.peer.reconnect(); } catch {} setTimeout(() => this._reconnectSignaling(), 2500); }
      else this._reconnects = 0;
    }, wait);
  }

  /** Vào phòng bằng mã. Resolve khi kết nối mở. Tự thử lại nếu phòng chưa kịp đăng ký. */
  async join(rawCode) {
    this.role = 'guest';
    this._setupVisibility();
    const code = normalizeCode(rawCode);
    if (!NetSession.available()) throw new Error(I18n.t('net.noPeerLib2'));
    if (code.length !== 5) throw new Error(I18n.t('on.codeLen'));
    const { servers } = await getIceServers();

    return new Promise((resolve, reject) => {
      let settled = false, attempts = 0, retryTimer = null, iceTimer = null, retrying = false;
      const fail = (err) => { if (settled) return; settled = true; clearTimeout(overall); clearTimeout(retryTimer); clearInterval(iceTimer); this.close(); reject(err); };
      const ok   = () => { if (settled) return; settled = true; clearTimeout(overall); clearTimeout(retryTimer); clearInterval(iceTimer); this.code = code; this.connected = true; this._startBeat(); resolve(code); };
      const overall = setTimeout(() => fail(new Error(I18n.t('net.join25'))), 25000);

      const peer = new window.Peer(PREFIX + 'g' + randomCode(), peerOptions(servers));
      this.peer = peer;
      peer.on('error', (err) => {
        // 'peer-unavailable' = mã sai / phòng đã đóng, NHƯNG cũng xảy ra thoáng qua khi host đang nối lại máy chủ ghép phòng
        // (host đang chuyển sang Zalo/Messenger gửi link nên socket nền bị hệ điều hành cắt) → khách kiên nhẫn thử lại tối đa 9 lần cách nhau 2s (~18s) chờ host quay lại rồi mới báo.
        if (err?.type === 'peer-unavailable' && !settled && attempts < 9 && !this._closed) {
          retrying = true; clearTimeout(retryTimer);
          retryTimer = setTimeout(() => { retrying = false; connect(); }, 2000);
          return;
        }
        fail(this._friendly(err));
      });
      peer.on('disconnected', () => this._reconnectSignaling());

      const connect = () => {
        if (settled || this._closed) return;
        attempts++;
        try { this.conn?.close(); } catch {}
        const conn = peer.connect(PREFIX + code, { reliable: true, serialization: 'json' });
        this._attach(conn, /*joining*/ true);
        conn.on('open', ok);
        conn.on('close', () => { if (!settled && !retrying && this.conn === conn) fail(new Error(I18n.t('net.full'))); });
        // Theo dõi ICE: 'failed' = hai mạng không thông được với nhau nếu thiếu TURN
        clearInterval(iceTimer);
        iceTimer = setInterval(() => {
          const st = conn.peerConnection?.iceConnectionState;
          if (st === 'failed') fail(new Error(I18n.t('net.nat')));
        }, 500);
      };
      peer.on('open', connect);
    });
  }

  _setupVisibility() {
    if (typeof document === 'undefined' || this._visibilityHandler) return;
    this._visibilityHandler = () => {
      if (document.visibilityState !== 'visible' || this._closed) return;
      // Quay lại tab sau khi chuyển app (Zalo/Messenger…): khôi phục socket ghép phòng và kiểm tra ngay kết nối
      if (this.peer && !this.peer.destroyed) {
        this._ensureSignaling(true);
        // iOS đôi khi chỉ phát hiện socket chết sau một nhịp: kiểm tra lại sau 1,5s
        setTimeout(() => this._ensureSignaling(true), 1500);
      }
      if (this.connected) { this._lastRx = performance.now(); this.send({ t: 'ping', ts: performance.now() }); }
    };
    document.addEventListener('visibilitychange', this._visibilityHandler);
    // Có mạng lại / cửa sổ được focus / bật lại từ bộ nhớ đệm trang: cũng kiểm tra phòng còn sống không
    this._wakeHandler = () => { if (!this._closed && document.visibilityState === 'visible') this._ensureSignaling(true); };
    window.addEventListener('online', this._wakeHandler);
    window.addEventListener('focus', this._wakeHandler);
    window.addEventListener('pageshow', this._wakeHandler);
    // Đóng tab / vuốt tắt app: báo ngay cho đối thủ thay vì để họ chờ 7 giây mới biết
    this._pageHideHandler = (e) => { if (e && e.persisted) return; if (this.connected) this.send({ t: 'quit' }); };
    window.addEventListener('pagehide', this._pageHideHandler);
  }

  _attach(conn, joining = false) {
    this.conn = conn;
    conn.on('data', (msg) => {
      if (!msg || typeof msg !== 'object') return;
      this._lastRx = performance.now();
      if (msg.t === 'ping') { this.send({ t: 'pong', ts: msg.ts }); return; }
      if (msg.t === 'pong') { this._onPong(performance.now() - msg.ts); return; }
      this._emit(msg);
    });
    const gone = () => {
      if (this._closed || conn !== this.conn) return;      // kết nối cũ đã bị thay bằng kết nối mới → không được làm rớt người mới
      if (!this.connected && !joining) return;
      const wasConnected = this.connected;
      this.connected = false;
      this._stopBeat();
      if (wasConnected) this._emit({ t: '__close' });
    };
    conn.on('close', gone);
    conn.on('error', gone);
  }

  _onPong(rtt) {
    if (!(rtt >= 0) || rtt > 20000) return;
    this.lost = 0; this._awaiting = false;
    const prev = this.latency || rtt;
    this.latency = Math.round(prev * 0.7 + rtt * 0.3);               // EWMA
    this.jitter  = Math.round(this.jitter * 0.7 + Math.abs(rtt - prev) * 0.3);
  }

  /** Nhịp tim: gửi ping đều đặn + phát hiện đối thủ "im" quá lâu */
  _startBeat() {
    this._stopBeat();
    this._lastRx = performance.now();
    this._awaiting = false; this.lost = 0;
    this._pingTimer = setInterval(() => {
      if (this._awaiting) this.lost++;               // ping trước chưa được trả lời
      this._awaiting = this.send({ t: 'ping', ts: performance.now() });
    }, NET_CONFIG.PING_EVERY_MS);
    this._deadTimer = setInterval(() => {
      if (!this.connected) return;
      // Tab bị hệ điều hành đóng băng (khoá màn hình) thì timer cũng bị dừng → khi chạy lại mới so sánh, tránh báo nhầm lúc vừa quay lại
      if (document.visibilityState === 'hidden') { this._lastRx = performance.now(); return; }
      if (performance.now() - this._lastRx > (this.deadAfterMs || NET_CONFIG.DEAD_AFTER_MS)) {
        this.connected = false; this._stopBeat();
        try { this.conn?.close(); } catch {}          // đóng hẳn kết nối chết để bên kia cũng biết (và host nhận được người vào lại)
        this._emit({ t: '__close' });
      }
    }, 1000);
  }

  _stopBeat() { clearInterval(this._pingTimer); clearInterval(this._deadTimer); this._pingTimer = this._deadTimer = null; }

  _friendly(err) {
    const t = err?.type;
    if (t === 'peer-unavailable') return new Error(I18n.t('net.notFound'));
    if (t === 'network' || t === 'server-error' || t === 'socket-error' || t === 'socket-closed')
      return new Error(I18n.t('net.noServer'));
    if (t === 'browser-incompatible') return new Error(I18n.t('net.incompat'));
    if (t === 'unavailable-id') return new Error(I18n.t('net.dupId'));
    return new Error(I18n.t('net.generic', { t: t || err?.message || I18n.t('net.unknown') }));
  }

  close() {
    const wasConnected = this.connected && !this._closed;
    this._closed = true;
    this.connected = false;
    this._stopBeat();
    if (this._visibilityHandler && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this._visibilityHandler);
      this._visibilityHandler = null;
    }
    if (this._pageHideHandler) { window.removeEventListener('pagehide', this._pageHideHandler); this._pageHideHandler = null; }
    if (this._wakeHandler) { for (const ev of ['online', 'focus', 'pageshow']) window.removeEventListener(ev, this._wakeHandler); this._wakeHandler = null; }
    clearInterval(this._sigTimer); this._sigTimer = null;
    const conn = this.conn, peer = this.peer;
    // Báo cho đối thủ biết mình rời phòng NGAY (trước đây chỉ im lặng đóng kết nối → bên kia chờ cả chục giây, nhiều khi không thấy báo gì)
    if (wasConnected) { try { conn?.send({ t: 'quit' }); } catch {} }
    const finish = () => { try { conn?.close(); } catch {} try { peer?.destroy(); } catch {} };
    if (wasConnected) setTimeout(finish, 250); else finish();
    this.conn = null; this.peer = null; this._listeners.clear();
  }

  /** Đối thủ đã báo rời: đánh dấu đứt ngay để phòng nhận được người vào lại (không chờ hết nhịp tim). */
  markGone() {
    this.connected = false; this._stopBeat();
    try { this.conn?.close(); } catch {}
  }
}
