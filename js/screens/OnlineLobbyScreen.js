/**
 * OnlineLobbyScreen.js — Sảnh chơi online 2 người
 *
 * Luồng: [Tạo phòng | Vào phòng bằng mã] → chọn chiến binh → cả hai bấm SẴN SÀNG → host gửi 'start'
 * → cả hai vào màn trận (BattleScreen, mode 'host' / 'guest'). Phiên kết nối được giữ qua trận
 * và màn kết quả để đấu lại; rời phòng thì gọi leave().
 */
import { NetSession, normalizeCode, inAppBrowserName, prefetchIce, resetIce } from '../net/NetSession.js';
import { NET_CONFIG, PROTOCOL_VERSION, isHideIp, setHideIp } from '../net/net-config.js';
import { CHARACTERS, getCharById }   from '../data/characters.js';
import { getRandomStage, getStageById } from '../data/stages.js';
import { SaveManager }               from '../core/SaveManager.js';
import { Assets }                    from '../core/AssetLoader.js';
import { WakeLock }                  from '../core/Perf.js';
import { I18n, t }                   from '../core/I18n.js';
import { Popup }                     from '../core/Popup.js';

const $ = (id) => document.getElementById(id);
const LS_CHAR = 'chosua_online_char';

export class OnlineLobbyScreen {
  constructor({ bus, screenManager, soundManager }) {
    this.bus = bus; this.sm = screenManager; this.sound = soundManager;
    this.net = null; this._unsub = null; this._pingTimer = null;
    this._resetState();
    this._bindUI();
    // Đổi ngôn ngữ: các chuỗi gắn khoá tự dịch; phần dựng bằng JS (tên chó, trạng thái phòng) thì vẽ lại. Không đụng tới kết nối.
    I18n.onChange(() => {
      if (this.net && !$('online-room').classList.contains('hidden')) { this._renderChars(); this._renderRoom(); }
    });
  }

  _resetState() {
    this.myCharId = localStorage.getItem(LS_CHAR) || null;
    this.oppCharId = null;
    this.myReady = false; this.oppReady = false;
    this.rematchMe = false; this.rematchOpp = false;
    this.connected = false; this.starting = false;
  }

  get role() { return this.net?.role; }
  get unlocked() {
    const ids = SaveManager.getUnlockedChars();
    return CHARACTERS.filter(c => c.unlocked || ids.includes(c.id));
  }

  // ── UI ──────────────────────────────────────────────

  _bindUI() {
    $('btn-back-from-online')?.addEventListener('click', () => { this.sound.playClick(); this.leave(); });
    $('btn-host')?.addEventListener('click', () => this._host());
    $('btn-join')?.addEventListener('click', () => this._join(this._extractCode($('join-code').value)));
    // Dán cả liên kết mời (…?room=ABCDE) hay "Mã: ABCDE" đều lấy đúng mã (trước đây bị cắt thành "HTTPS")
    $('join-code')?.addEventListener('input', (e) => { e.target.value = normalizeCode(this._extractCode(e.target.value)); });
    $('join-code')?.addEventListener('keydown', (e) => { if (e.key === 'Enter') this._join(e.target.value); });
    $('btn-ready')?.addEventListener('click', () => this._toggleReady());
    $('btn-copy-link')?.addEventListener('click', () => this._copyLink());
    $('btn-recheck')?.addEventListener('click', () => { this.sound.playClick(); this._checkServer(); });
    // Công tắc riêng tư (giấu IP): đổi xong kiểm tra lại đường mạng; đồng bộ với công tắc trong Cài đặt
    const hip = $('online-hide-ip');
    if (hip) {
      hip.checked = isHideIp();
      hip.addEventListener('change', () => { setHideIp(hip.checked); this.sound.playClick(); this._lastOkAt = 0; this._checkServer(); });
      window.addEventListener('gaune-hideip', () => { hip.checked = isHideIp(); });
    }
  }

  _extractCode(raw) {
    const s = String(raw || '');
    const m = s.match(/[?&]room=([A-Za-z0-9]{5})/i);
    return m ? m[1] : s;
  }

  /** Thử kết nối tới máy chủ ghép phòng và hiện kết quả (xanh/vàng/đỏ + ms) */
  async _checkServer() {
    if (this._checking) return;
    this._checking = true;
    const box = $('server-status'), text = $('server-text'), btn = $('btn-recheck');
    box.className = 'server-status checking'; I18n.bind(text, 'on.checking'); btn.disabled = true;
    const diagEl = $('net-diag');
    diagEl.className = 'net-diag'; I18n.bind(diagEl, 'on.natTesting');
    // Lấy trước thông tin TURN (không tính vào thời gian máy chủ), rồi đo máy chủ ghép phòng MỘT MÌNH (trước đây chạy song song với thử TURN nên
    // hai phép thử tranh băng thông và con số ms bị đội lên), sau đó mới thử TURN.
    prefetchIce();
    const r = await NetSession.checkServer();
    let d = await NetSession.diagnose();
    // Metered vừa cấp credential mới đôi khi chưa kịp lan tới mọi máy chủ relay: không ra relay thì đợi một nhịp rồi thử lại 1 lần
    // Chỉ thử lại khi đang dùng key Metered (TURN công cộng thử lại cũng không khá hơn, chỉ tốn thêm ~10 giây).
    if (isHideIp() && !d.turn && !d.reason && d.source === 'metered') { await new Promise(res => setTimeout(res, 1500)); d = await NetSession.diagnose(); }
    // Vẫn không ra relay với key Metered → bỏ key này, lần Tạo/Vào phòng sau sẽ xin key mới (không kẹt key xấu 30 phút)
    if (isHideIp() && !d.turn && !d.reason && d.source === 'metered') resetIce();
    this._checking = false; btn.disabled = false;
    this._showDiag(diagEl, d);
    this._lastOkAt = (r.ok && d.ok) ? Date.now() : 0;
    if (!r.ok) { box.className = 'server-status bad'; I18n.setText(text, '✖ ' + r.reason); return; }
    if (r.ms < 800)       { box.className = 'server-status good'; I18n.bind(text, 'on.srvGood', { ms: r.ms }); }
    else if (r.ms < 2500) { box.className = 'server-status slow'; I18n.bind(text, 'on.srvSlow', { ms: r.ms }); }
    else                  { box.className = 'server-status slow'; I18n.bind(text, 'on.srvVSlow', { ms: r.ms }); }
  }

  /** Dòng chi tiết kỹ thuật (mã lỗi ICE) dưới thông báo lỗi chẩn đoán */
  _diagDetail(el, d, okLine = false) {
    if (okLine) d = { ...d, detail: `relay ${d.ms}ms` };
    if (!d.detail) return;
    const s = document.createElement('small');
    s.style.cssText = 'display:block;margin-top:4px;opacity:.75;word-break:break-all';
    s.textContent = `[${d.source}] ${d.detail}`;
    el.appendChild(s);
  }

  /** Kết quả chẩn đoán xuyên NAT, nói rõ "chơi được với ai" */
  _showDiag(el, d) {
    if (d.reason) { el.className = 'net-diag bad'; I18n.setText(el, '✖ ' + d.reason); return; }
    if (isHideIp()) {
      if (!d.turn) { el.className = 'net-diag bad'; I18n.bind(el, 'on.diagRelayNone'); this._diagDetail(el, d); return; }
      if (d.source !== 'metered') { el.className = 'net-diag'; I18n.bind(el, 'on.diagRelayPub'); return; }
      el.className = 'net-diag good'; I18n.bind(el, 'on.diagRelayOk'); this._diagDetail(el, d, true); return;
    }
    if (d.turn)      { el.className = 'net-diag good'; I18n.bind(el, d.source === 'metered' ? 'on.diagTurnOwn' : 'on.diagTurnPub'); }
    else if (d.stun) { el.className = 'net-diag'; I18n.bind(el, 'on.diagStun'); }
    else             { el.className = 'net-diag bad'; I18n.bind(el, 'on.diagNone'); this._diagDetail(el, d); }
  }

  show() {
    prefetchIce();
    const hip = $('online-hide-ip'); if (hip) hip.checked = isHideIp();
    if (this.net) { this.net.deadAfterMs = NET_CONFIG.LOBBY_DEAD_AFTER_MS; WakeLock.on(); this._showRoom(); } else this._showStart({ check: !this._skipCheck });
    this._skipCheck = false;
    clearInterval(this._pingTimer);
    this._pingTimer = setInterval(() => {
      const el = $('room-ping');
      if (!el) return;
      const q = this.net?.quality;
      el.textContent = this.net?.connected ? t('on.ping', { ms: this.net.latency || '--', q: t(q === 'good' ? 'on.qGood' : q === 'ok' ? 'on.qOk' : 'on.qBad') }) : '';
      el.classList.remove('q-good', 'q-ok', 'q-bad'); if (q && q !== 'none') el.classList.add('q-' + q);
    }, 1000);
  }
  hide() { clearInterval(this._pingTimer); if (!this.net) WakeLock.off(); }   // KHÔNG đóng kết nối: còn dùng trong trận

  /**
   * Thông báo dạng POPUP giữa màn hình (không còn dòng chữ nhỏ ở cuối trang):
   *   ok = true       → bong bóng nổi tự tắt (đã sao chép…)
   *   kind 'info'     → bong bóng giữ tới khi xong việc (đang tạo phòng / đang vào phòng…)
   *   kind 'error'    → hộp thoại có nút "Đã hiểu" (mất kết nối, đối thủ rời, lỗi vào phòng…)
   *   text rỗng       → dọn thông báo đang hiện
   */
  _show(text, kind = 'error', { title, icon } = {}) {
    if (!text) { Popup.clearToast(); if (this._modalUp) { Popup.close(); this._modalUp = false; } return; }
    if (kind === 'ok')   { Popup.toast(text, { kind: 'ok', ms: 2800 }); return; }
    if (kind === 'info') { Popup.toast(text, { kind: 'info', sticky: true }); return; }
    if (kind === 'warn') { Popup.toast(text, { kind: 'warn', ms: 3600 }); return; }
    Popup.clearToast();
    this._modalUp = true;
    Popup.alert({ title: title || t('pop.t.err'), text, icon: icon || '⚠️' }).then(() => { this._modalUp = false; });
  }
  _msg(text, ok = false, opts) { this._show(text, ok ? 'ok' : 'error', opts); }
  /** Thông báo theo khoá I18n; phân loại popup theo khoá */
  _msgK(key, params = null, ok = false) {
    const text = key ? t(key, params) : '';
    const META = {
      'on.creating':   { kind: 'info' },
      'on.joining':    { kind: 'info' },
      'on.codeLen':    { kind: 'warn' },
      'on.hostLeft':   { title: t('pop.t.lost'), icon: '🌐' },
      'on.oppLeftHost':{ title: t('pop.t.left'), icon: '👋' },
      'on.verMismatch':{ title: t('pop.t.ver'),  icon: '🔄' },
      'on.inApp':      { title: t('pop.t.app'),  icon: '📱' },
    };
    const m = META[key] || {};
    this._show(text, ok ? 'ok' : (m.kind || 'error'), m);
  }

  _showStart({ check = true } = {}) {
    $('online-start').classList.remove('hidden');
    $('online-room').classList.add('hidden');
    $('btn-host').disabled = false; $('btn-join').disabled = false;
    this._msg('');
    const app = inAppBrowserName();
    if (app && !this._inAppShown) { this._inAppShown = true; this._msgK('on.inApp', { app }); }      // cảnh báo trình duyệt trong app: hiện 1 lần mỗi lần mở game
    if (check && !(this._lastOkAt && Date.now() - this._lastOkAt < 60000)) this._checkServer();
  }

  _showRoom() {
    $('online-start').classList.add('hidden');
    $('online-room').classList.remove('hidden');
    $('room-code').textContent = this.net.code || '-----';
    $('room-code-wrap').style.display = this.role === 'host' ? '' : 'none';
    this._renderChars();
    this._renderRoom();
  }

  _renderChars() {
    const list = this.unlocked;
    if (!list.find(c => c.id === this.myCharId)) this.myCharId = list[0].id;
    const box = $('room-chars');
    box.innerHTML = '';
    for (const c of list) {
      const b = document.createElement('button');
      b.className = 'room-char' + (c.id === this.myCharId ? ' selected' : '');
      b.innerHTML = `${Assets.iconHTML(c, 'room-char-img')}<span></span>`;
      b.lastChild.textContent = I18n.charName(c);
      b.addEventListener('click', () => this._pick(c.id));
      box.appendChild(b);
    }
  }

  _renderRoom() {
    const me = getCharById(this.myCharId), opp = this.oppCharId ? getCharById(this.oppCharId) : null;
    $('slot-me-char').textContent = I18n.charName(me);
    $('slot-opp-char').textContent = opp ? I18n.charName(opp) : (this.connected ? '…' : '—');
    $('slot-me').classList.toggle('ready', this.myReady);
    $('slot-opp').classList.toggle('ready', this.oppReady);
    $('slot-me-ready').textContent = this.myReady ? t('on.readyTag') : '';
    $('slot-opp-ready').textContent = this.oppReady ? t('on.readyTag') : '';

    const st = $('room-status');
    st.classList.toggle('ok', this.connected);
    st.textContent = t(!this.connected ? (this.role === 'host' ? 'on.st.wait' : 'on.st.connecting')
      : this.myReady && !this.oppReady ? 'on.st.waitReady'
      : !this.myReady && this.oppReady ? 'on.st.yourTurn'
      : 'on.st.connected');
    const rb = $('btn-ready');
    rb.disabled = !this.connected || this.starting;
    rb.textContent = t(this.myReady ? 'on.btnCancel' : 'on.btnReady');
    for (const el of document.querySelectorAll('.room-char')) el.disabled = this.myReady;
  }

  // ── Tạo / vào phòng ─────────────────────────────────

  /** Hỏi đồng ý một lần trước khi vào online (IP/WebRTC). Trả về true nếu được phép tiếp tục. */
  _consent() {
    const KEY = 'gaune_online_consent_v1';
    try { if (localStorage.getItem(KEY) === '1') return Promise.resolve(true); } catch {}
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'consent-backdrop';
      wrap.innerHTML = '<div class="consent-box" role="dialog" aria-modal="true" aria-labelledby="consent-h"><h3 id="consent-h"></h3><p class="consent-p"></p><a class="consent-a" href="privacy.html" target="_blank" rel="noopener"></a><div class="consent-actions"><button type="button" class="consent-no"></button><button type="button" class="consent-yes"></button></div></div>';
      const q = (c) => wrap.querySelector(c);
      q('h3').textContent = t('consent.title'); q('.consent-p').textContent = t('consent.body');
      q('.consent-a').textContent = t('consent.link'); q('.consent-no').textContent = t('consent.cancel'); q('.consent-yes').textContent = t('consent.ok');
      const done = (v) => { wrap.remove(); if (v) { try { localStorage.setItem(KEY, '1'); } catch {} } resolve(v); };
      q('.consent-no').addEventListener('click', () => done(false));
      q('.consent-yes').addEventListener('click', () => done(true));
      document.body.appendChild(wrap); q('.consent-yes').focus();
    });
  }

  async _host() {
    // Chặn bấm đúp / Enter nhiều lần: mỗi lần gọi sẽ tạo thêm một NetSession mồ côi chiếm chỗ phòng
    if (this._joining || this.net) return;
    this._joining = true;
    try {
      this.sound.playClick();
      if (!(await this._consent())) return;
      $('btn-host').disabled = true; $('btn-join').disabled = true;
      this._msgK('on.creating');
      this._resetState();
      this.net = new NetSession();
      this.net.deadAfterMs = NET_CONFIG.LOBBY_DEAD_AFTER_MS;
      WakeLock.on();
      try {
        await this.net.host(() => this._onConnected());
        this._bindNet();
        this._msg('');
        this._showRoom();
      } catch (e) { this._fail(e); }
    } finally { this._joining = false; }
  }

  async _join(raw) {
    if (this._joining || this.net) return;     // phím Enter không bị khoá như nút: không chặn thì Enter 2 lần tạo 2 phiên, phiên mồ côi chiếm chỗ → "Phòng đã đầy"
    this.sound.playClick();
    const code = normalizeCode(raw);
    if (code.length !== 5) { this._msgK('on.codeLen'); return; }
    this._joining = true;
    try {
      if (!(await this._consent())) return;
      $('btn-host').disabled = true; $('btn-join').disabled = true;
      this._msgK('on.joining');
      this._resetState();
      this.net = new NetSession();
      this.net.deadAfterMs = NET_CONFIG.LOBBY_DEAD_AFTER_MS;
      WakeLock.on();
      try {
        this._bindNet();                       // đăng ký trước để không lỡ tin đầu tiên
        await this.net.join(code);
        this._msg('');
        this._showRoom();
        this._onConnected();
      } catch (e) { this._fail(e); }
    } finally { this._joining = false; }
  }

  /** Mở thẳng từ liên kết mời (?room=ABCDE) */
  autoJoin(code) {
    this._skipCheck = true;        // đang vào phòng thật rồi: không mở thêm kết nối dò máy chủ chạy song song (chậm mạng yếu)
    this.sm.show('online');
    $('join-code').value = normalizeCode(code);
    this._join(code);
  }

  _fail(e) {
    this._closeNet();
    this._showStart({ check: false });
    const app = inAppBrowserName();
    this._msg((e?.message || t('on.cantConnect')) + (app ? t('on.inAppSuffix', { app }) : ''), false, { title: t('pop.t.cant'), icon: '🌐' });
  }

  _bindNet() {
    this._unsub?.();
    this._unsub = this.net.on((m) => this._onMsg(m));
  }

  _onConnected() {
    this.connected = true;
    this._msg('');
    this.net.send({ t: 'pick', c: this.myCharId, v: PROTOCOL_VERSION });
    this._renderRoom();
    this.sound.playClick();
    if (this.role === 'host') Popup.toast(t('on.joined'), { kind: 'ok', ms: 2600 });
    // Host đang ở màn kết quả mà có khách MỚI vào → đưa về sảnh để hai bên bấm Sẵn sàng (trước đây host kẹt ở màn kết quả, không ai bắt đầu được)
    const cur = this.sm.getCurrent();
    if (cur === 'result') this.sm.show('online');
    else if (cur === 'battle') this._freshGuest = true;     // đang chờ hết trận: màn kết quả sẽ chuyển về sảnh
  }

  /** Màn kết quả hỏi: có khách mới vào trong lúc đang đánh không? (đọc xong thì xoá cờ) */
  consumeFreshGuest() { const v = !!this._freshGuest; this._freshGuest = false; return v && !!this.net?.connected; }

  // ── Tin nhắn ────────────────────────────────────────

  _onMsg(m) {
    switch (m.t) {
      case 'pick':
        if (m.v !== PROTOCOL_VERSION) { this._versionMismatch(); break; }
        if (CHARACTERS.some(c => c.id === m.c)) { this.oppCharId = m.c; this._renderRoomIfVisible(); }
        break;
      case 'ready':
        this.oppReady = !!m.v; this._renderRoomIfVisible(); this._maybeHostStart();
        break;
      case 'rematch':
        this.rematchOpp = true;
        this.bus.emit('online:rematch', { me: this.rematchMe, opp: true });
        if (this.role === 'host' && this.rematchMe) this._hostStart();
        break;
      case 'start':
        // Chỉ khách nhận lệnh bắt đầu, và chỉ khi nhân vật hợp lệ (không tin dữ liệu lạ từ mạng)
        if (this.role === 'guest' && this.connected && CHARACTERS.some(c => c.id === m.h) && CHARACTERS.some(c => c.id === m.g)) this._launch(m);
        break;
      case 'quit':
        // Đối thủ chủ động rời: đánh dấu đứt NGAY ở mọi màn (trước đây chỉ ở sảnh; ở màn kết quả phải chờ kênh dữ liệu tự báo đóng,
        // Safari có khi chậm cả chục giây → nút "Đấu lại" vẫn bấm được và chờ mãi). Trong trận BattleManager vẫn tự xử lý 'quit' thành thắng bỏ cuộc.
        this.net?.markGone();
        this._onMsg({ t: '__close' });
        break;
      case '__close':
        this.connected = false;
        if (this.role === 'host') {      // khách cũ đã đi: xoá mọi trạng thái của họ (kể cả cờ 'đấu lại'), để khách mới vào không bị dính
          this.oppCharId = null; this.oppReady = false; this.myReady = false; this.rematchMe = false; this.rematchOpp = false;
        }
        if (this.sm.getCurrent() === 'online') {
          // Trước đây: bị đá thẳng ra menu và thông báo ghi vào màn hình đã ẩn → người chơi không biết vì sao, phòng cũng mất.
          if (this.role === 'host') {
            // Host GIỮ PHÒNG (mã cũ vẫn dùng được): người bên kia chỉ rớt mạng/chuyển app thì vào lại ngay, hoặc mời người khác.
            this.oppCharId = null; this.oppReady = false; this.myReady = false;
            this._renderRoom();
            if (this._verBad) { this._verBad = false; this._msgK('on.verMismatch'); } else this._msgK('on.oppLeftHost');
          } else {
            this._closeNet(); this._showStart({ check: false });
            this._msgK('on.hostLeft');
          }
        } else this.bus.emit('online:closed');
        break;
      case '__error':
        this._msg(m.message);
        break;
    }
  }

  /** Hai máy khác phiên bản giao thức → ngắt, báo rõ lý do (không để vào trận rồi lệch số liệu). */
  _versionMismatch() {
    if (this.role === 'host') { this._verBad = true; try { this.net.conn?.close(); } catch {} }
    else { this._closeNet(); this._showStart({ check: false }); this._msgK('on.verMismatch'); }
  }

  _renderRoomIfVisible() { if (this.sm.getCurrent() === 'online' && this.net) this._renderRoom(); }

  _pick(id) {
    if (this.myReady) return;
    this.myCharId = id;
    localStorage.setItem(LS_CHAR, id);
    this.net?.send({ t: 'pick', c: id, v: PROTOCOL_VERSION });
    this.sound.playClick();
    this._renderChars(); this._renderRoom();
  }

  _toggleReady() {
    if (!this.connected) return;
    this.myReady = !this.myReady;
    this.net.send({ t: 'ready', v: this.myReady });
    this.sound.playClick();
    this._renderRoom();
    this._maybeHostStart();
  }

  _maybeHostStart() {
    if (this.role === 'host' && this.myReady && this.oppReady && this.oppCharId) this._hostStart();
  }

  _hostStart() {
    if (this.starting) return;
    // Khách vừa rớt mà host vẫn bấm/nhận 'sẵn sàng' → KHÔNG vào trận một mình (trước đây send() thất bại bị bỏ qua, host vào trận chờ ma 30 giây)
    if (!this.connected || !this.net?.connected) { this.myReady = false; this._renderRoomIfVisible(); return; }
    const stage = getRandomStage(SaveManager.getUnlockedStages());
    const msg = { t: 'start', h: this.myCharId, g: this.oppCharId, st: stage.id };
    if (!this.net.send(msg)) { this.myReady = false; this._renderRoomIfVisible(); return; }
    this._launch(msg);
  }

  _launch(m) {
    this.starting = true;
    const host = this.role === 'host';
    const mine = getCharById(host ? m.h : m.g), theirs = getCharById(host ? m.g : m.h);
    this.myReady = this.oppReady = this.rematchMe = this.rematchOpp = false;
    setTimeout(() => { this.starting = false; }, 500);
    this.sm.show('battle', {
      playerChar: mine, aiChar: theirs, stage: getStageById(m.st), difficulty: 1,
      online: { role: this.role, net: this.net },
    });
  }

  /** Từ màn kết quả: muốn đấu lại */
  requestRematch() {
    if (!this.net?.connected) return;
    this.rematchMe = true;
    this.net.send({ t: 'rematch' });
    this.bus.emit('online:rematch', { me: true, opp: this.rematchOpp });
    if (this.role === 'host' && this.rematchOpp) this._hostStart();
  }

  async _copyLink() {
    const url = `${location.origin}${location.pathname}?room=${this.net?.code || ''}`;
    // Lời mời kèm câu giới thiệu: dán vào Zalo/Messenger sẽ hiện thẻ xem trước (ảnh + mô tả) của game
    const text = t('on.shareText', { url });
    try { await navigator.clipboard.writeText(text); this._msgK('on.copied', null, true); }
    catch { this._msg(t('on.linkIs', { url }), false, { title: t('pop.t.link'), icon: '🔗' }); }
  }

  // ── Rời phòng ───────────────────────────────────────

  _closeNet() {
    WakeLock.off();
    this._unsub?.(); this._unsub = null;
    this.net?.close(); this.net = null;
    this._resetState();
  }

  leave() {
    this._closeNet();
    this.sm.show('menu');
  }
}
