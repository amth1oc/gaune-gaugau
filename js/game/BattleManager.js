/**
 * BattleManager.js — Bộ điều phối chính của trận đấu
 *
 * Ba chế độ (opts.mode):
 *   'ai'    — đấu máy (mặc định)
 *   'host'  — online, máy này là "trọng tài": tính lực, gauge, đồng hồ; gửi kết quả cho guest
 *   'guest' — online, chỉ gửi tiếng sủa cho host rồi hiển thị theo số liệu host gửi về
 *
 * Gauge luôn tính theo góc nhìn CỦA MÁY ĐANG CHƠI: 0 = bạn thắng, 100 = đối thủ thắng.
 * (guest nhận số từ host rồi đảo lại: 100 − g)
 *
 * Events phát ra qua EventBus:
 *   'battle:countdown'   {value: number|'GO!'|null}
 *   'battle:start'
 *   'player:bark'        {volume, force, comboMult, comboCount, barkWord}
 *   'player:combo'       {count}
 *   'ai:bark'            {volume, force, barkWord}      (cũng dùng cho đối thủ online)
 *   'battle:end'         {winner:'player'|'ai'|'none', reason:'ko'|'timeout'|'forfeit'|'disconnect'}
 */
import { CONFIG }          from '../data/config.js';
import { DogCharacter }    from './DogCharacter.js';
import { AIOpponent }      from './AIOpponent.js';
import { GaugeController } from './GaugeController.js';
import { ComboSystem }     from './ComboSystem.js';
import { CharStats }       from './CharStats.js';

const STATE_SYNC_MS   = 100;   // host gửi số liệu mỗi 100ms
const REMOTE_RATE     = 16;    // tiếng/giây tối đa host chấp nhận từ guest (trung bình) — bằng trần của mic host
const REMOTE_BURST    = 4;     // cho phép dồn tối đa chừng này tiếng khi gói tin tới cùng lúc (mạng giật)
/** Ép số nhận từ mạng vào khoảng hợp lệ (NaN/chuỗi/vô cực → giá trị mặc định). */
const clampNum = (x, lo, hi, def = lo) => { const n = Number(x); return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def; };
const MAX_VOL         = 0.8;   // trần âm lượng tin được từ mạng
const MAX_GRACE       = 200;   // ân hạn cuối trận tối đa (ms)
const MAX_HOST_DELAY  = 80;
const HOST_SILENT_MS  = 6000;  // guest: đang đánh mà host im (không gửi 'st' mỗi 100ms) quá chừng này → coi như mất kết nối (host chuyển tab/đóng băng nhưng ping vẫn sống)    // host tự làm chậm tiếng sủa của mình tối đa chừng này (xem onPlayerBark)

export class BattleManager {
  constructor({ playerChar, aiChar, stage, difficulty, bus, soundManager, mode = 'ai', net = null }) {
    this.stage = stage;
    this.bus = bus;
    this.sound = soundManager;
    this.mode = mode;
    this.net = net;

    this.playerChar = new DogCharacter(playerChar, true);
    this.aiChar     = new DogCharacter(aiChar, false);

    this.gauge = new GaugeController();
    this.combo = new ComboSystem(
      CharStats.comboWindowMs(playerChar),
      CharStats.comboStep(playerChar),
      CONFIG.MIC.COMBO_MAX_MULT,
    );
    if (playerChar.special === 'fastCombo') this.combo.applyFastCombo(CONFIG.STATS.FAST_COMBO_WINDOW_MULT);

    // Đối thủ: AI hoặc người chơi từ xa
    this.ai = new AIOpponent(difficulty, aiChar);
    this.ai.onBark = (vol) => this._onAIBark(vol);
    this.remoteCombo = new ComboSystem(
      CharStats.comboWindowMs(aiChar), CharStats.comboStep(aiChar), CONFIG.MIC.COMBO_MAX_MULT);
    if (aiChar.special === 'fastCombo') this.remoteCombo.applyFastCombo(CONFIG.STATS.FAST_COMBO_WINDOW_MULT);
    this._tokens = REMOTE_BURST; this._tokT = performance.now();   // xô token chống spam
    this._pending = [];            // guest: lực đã dự đoán nhưng host chưa xác nhận {t,f,boost}
    this._myMult = 1; this._oppMult = 1;   // hệ số combo×nhịp của tiếng sủa gần nhất (để cộng bù)
    this._lastPlayerBarkAt = null;   // để tính thưởng nhịp nhanh (speed)
    this._lastOppBarkAt = null;
    this._syncTimer = 0;
    this._guestReady = false;
    this._stGap = 0;               // guest: cộng dồn thời gian (theo dt của khung hình) kể từ lần cuối nhận 'st' của host
    this._graceEnd = null;
    this._rdyTimer = null;

    /** @type {'idle'|'countdown'|'fighting'|'ended'} */
    this.state = 'idle';
    this.timeLeft = CONFIG.BATTLE.ROUND_TIME;
    this.barkCount = 0;
    this.maxCombo = 0;
    this.opponentCombo = 0;     // combo của đối thủ (để hiển thị)
    this.remoteBarkCount = 0;   // số tiếng sủa của đối thủ online (để phân định khi hoà)
    this.cancelled = false;

    this._unsubNet = null;
    if (this.online) this._unsubNet = this.net.on((m) => this._onNet(m));
  }

  get online() { return this.mode !== 'ai' && !!this.net; }

  // ─── Public API ────────────────────────────────────

  async start() {
    this.state = 'countdown';
    // Đối thủ đã rớt mạng từ lúc vào trận (tin '__close' bắn lúc BattleManager chưa kịp đăng ký, vì màn trận chờ mic tới 4 giây):
    // trước đây host đợi trọn 30s rồi đánh một mình với "bóng ma", guest kẹt mãi ở đếm ngược. Nay kết thúc ngay là "mất kết nối".
    if (this.online && !this.net.connected) { this._endBattle('none', 'disconnect'); return; }
    if (this.mode === 'guest') {             // guest báo "sẵn sàng" liên tục tới khi host bắt đầu đếm ngược
      const t0 = performance.now();
      const ping = () => {
        if (this.cancelled || this.state !== 'countdown') return clearInterval(this._rdyTimer);
        // Host biến mất hoặc không bao giờ bắt đầu → không kẹt vô hạn
        if (!this.net.connected || performance.now() - t0 > 35000) { clearInterval(this._rdyTimer); this._endBattle('none', 'disconnect'); return; }
        this.net.send({ t: 'rdy' });
      };
      ping(); this._rdyTimer = setInterval(ping, 400);
      return;
    }
    if (this.mode === 'host') {              // chờ guest tạo xong trận (có thể đang xin quyền mic)
      const t0 = performance.now();
      while (!this._guestReady && !this.cancelled && performance.now() - t0 < 30000) {
        if (!this.net.connected) { this._endBattle('none', 'disconnect'); return; }
        await this._wait(100);
      }
      if (this.cancelled) return;
    }
    await this._runCountdown();
    if (this.cancelled) return;
    this.state = 'fighting';
    if (this.mode === 'ai') this.ai.start();
    this.bus.emit('battle:start');
  }

  destroy() {
    this.cancelled = true;
    this.state = 'ended';
    this.ai.stop();
    this._unsubNet?.(); this._unsubNet = null;
    clearInterval(this._rdyTimer);
  }

  /** Người chơi này sủa (mic hoặc nút chạm). */
  onPlayerBark(volume) {
    if (this.state !== 'fighting') return;

    this.barkCount++;
    const comboCount = this.combo.addBark();
    if (comboCount > this.maxCombo) this.maxCombo = comboCount;
    const comboMult = this.combo.getMultiplier();
    const nowT = performance.now();
    const tempoMult = CharStats.tempoMult(this.playerChar.data, this._lastPlayerBarkAt == null ? null : nowT - this._lastPlayerBarkAt);
    this._lastPlayerBarkAt = nowT;
    this._myMult = comboMult * tempoMult;

    // CÔNG BẰNG ĐỘ TRỄ: host không có độ trễ còn guest bị trễ ~RTT/2, nên host tự làm chậm
    // tác động lên gauge của chính mình đúng bằng một nửa ping (tối đa MAX_HOST_DELAY).
    // Hình ảnh/âm thanh của host vẫn tức thì, chỉ lực đẩy gauge đến muộn.
    const delayMs = this.mode === 'host' ? Math.min(MAX_HOST_DELAY, (this.net.latency || 0) / 2) : 0;
    let force = 0;
    const applyPush = () => {
      if (this.state !== 'fighting') return;
      force = this.gauge.pushByPlayer(volume, this.playerChar.data, comboMult, comboCount, tempoMult);
      if (this.mode === 'guest') this._pending.push({ t: performance.now(), f: force, boost: false });   // dự đoán: chờ host xác nhận
      if (this.mode === 'host') this.net.send({ t: 'bk', s: 'h', v: volume, w: barkWord, c: comboCount, g: this.gauge.value });
      if (delayMs > 0) this._checkWin();
    };
    const barkWord = this._randomBarkWord(this.playerChar.data);
    if (delayMs > 0) setTimeout(applyPush, delayMs); else applyPush();
    this.playerChar.bark(volume);
    this.aiChar.damage();

    this.bus.emit('player:bark', { volume, force, comboMult, comboCount, barkWord });

    // Luôn phát tiếng sủa thật (trước đây từ cú sủa thứ 2 liên tiếp tiếng sủa bị thay bằng tiếng bíp "tứng tứng")
    this.sound.playBark(volume, comboCount, 1 + (3 - (this.playerChar.data.stats?.power ?? 3)) * 0.05);   // chó khỏe sủa trầm hơn, chó nhỏ sủa thanh hơn
    if (comboCount >= 2) {
      this.bus.emit('player:combo', { count: comboCount });
      this.sound.playCombo(comboCount);      // chỉ chồng thêm nếu có file combo; không còn bíp tổng hợp
    }

    if (this.mode === 'guest') {
      this.net.send({ t: 'bk', v: volume, w: barkWord });   // host tính lực thật; ở đây chỉ dự đoán cho mượt
    }
    this._checkWin();
  }

  /**
   * Đỉnh thật của tiếng sủa vừa rồi to hơn lúc bắn → cộng bù phần lực chênh (không tăng combo, không phát thêm tiếng).
   * @param {number} extraVol phần âm lượng chênh (đã chuẩn hoá)
   */
  onPlayerBoost(extraVol) {
    if (this.state !== 'fighting' || !(extraVol > 0.01)) return;
    extraVol = Math.min(extraVol, MAX_VOL);
    const f = this.gauge.boostByPlayer(extraVol, this.playerChar.data, this._myMult);
    if (this.mode === 'guest') {
      this._pending.push({ t: performance.now(), f, boost: true });
      this.net.send({ t: 'bb', v: extraVol });
    }
    this._checkWin();
  }

  /** guest: ghép số của host với những tiếng sủa của mình mà host chưa kịp xử lý → thanh lực không bị giật lùi. */
  _reconcile(hostG, ackBark = false) {
    hostG = Number(hostG); if (!Number.isFinite(hostG)) return;     // dữ liệu lạ từ mạng → bỏ qua
    hostG = Math.max(0, Math.min(100, hostG));
    const now = performance.now();
    if (ackBark) { const i = this._pending.findIndex(p => !p.boost); if (i >= 0) this._pending.splice(i, 1); }
    // Tiếng sủa đã gửi quá 1 vòng ping thì host chắc chắn đã xử lý (hoặc đã bỏ) → số của host đã gồm nó (hoặc không bao giờ gồm)
    const rtt = Math.max(60, Math.min(800, this.net?.latency || 0));
    this._pending = this._pending.filter(p => now - p.t < (ackBark ? 1500 : rtt));
    let ahead = 0; for (const p of this._pending) ahead += p.f;
    this.gauge.setValue((100 - hostG) - ahead);
  }

  update(dt) {
    if (this.state !== 'fighting') {
      this.playerChar.update(dt);
      this.aiChar.update(dt);
      this.gauge.settle(dt);
      return;
    }

    this.combo.update(dt);
    this.playerChar.update(dt);
    this.aiChar.update(dt);

    if (this.mode === 'guest') {
      // Chỉ làm mượt + đếm lùi cục bộ; số thật do host gửi
      this.gauge.settle(dt);
      this.remoteCombo.update(dt);
      this.timeLeft = Math.max(0, this.timeLeft - dt / 1000);
      // Bộ canh: tính theo dt (đã giới hạn 100ms/khung) nên khi CHÍNH guest bị ẩn/đóng băng rồi quay lại sẽ không báo nhầm
      this._stGap += dt;
      if (this._stGap > HOST_SILENT_MS) { this._endBattle('none', 'disconnect'); return; }
    } else {
      if (this.mode === 'ai') this.ai.update(dt, this.gauge.value);
      else this.remoteCombo.update(dt);
      this.gauge.update(dt);

      if (this.timeLeft > 0) this.timeLeft -= dt / 1000;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        // ÂN HẠN CUỐI TRẬN (online): chờ ~1 ping (tối đa 200ms) để tiếng sủa cuối của guest kịp tới host
        if (this._graceEnd === null) this._graceEnd = performance.now() + (this.mode === 'host' ? Math.min(MAX_GRACE, this.net.latency || 0) : 0);
        if (performance.now() < this._graceEnd) { this._syncState(); return; }
        let leader = this.gauge.getLeader();
        if (this.mode === 'host' && leader === 'tie') leader = this._tieBreak();   // online: không để host thắng mặc định
        this._endBattle(leader === 'ai' ? 'ai' : 'player', 'timeout');
        return;
      }
      if (this.mode === 'host') { this._syncTimer += dt; if (this._syncTimer >= STATE_SYNC_MS) this._syncState(); }
    }

  }

  /** Hết giờ mà gauge nằm trong vùng hoà (online): ai nhích hơn thì thắng; bằng nhau → ai sủa nhiều hơn; vẫn bằng → tung đồng xu. */
  _tieBreak() {
    const v = this.gauge.value;
    if (v < 50) return 'player';
    if (v > 50) return 'ai';
    if (this.remoteBarkCount !== this.barkCount) return this.remoteBarkCount > this.barkCount ? 'ai' : 'player';
    return Math.random() < 0.5 ? 'player' : 'ai';
  }

  _syncState() {
    if (this.mode !== 'host') return;
    this._syncTimer = 0;
    this.net.send({ t: 'st', g: this.gauge.value, tl: this.timeLeft, hc: this.combo.count, gc: this.remoteCombo.count });
  }

  // ─── Đối thủ ────────────────────────────────────────

  _onAIBark(volume) {
    if (this.state !== 'fighting') return;
    const aiCombo = this.ai.comboCount;
    const aiMult  = Math.min(CONFIG.MIC.COMBO_MAX_MULT, 1 + (aiCombo - 1) * CharStats.comboStep(this.aiChar.data));
    this._opponentBark(volume, aiCombo, aiMult, this._randomBarkWord(this.aiChar.data));
  }

  /** Host nhận tiếng sủa của guest. */
  _onRemoteBark(volume, word) {
    if (this.mode !== 'host' || this.state !== 'fighting') return;
    const now = performance.now();
    // Xô token: tốc độ trung bình tối đa REMOTE_RATE, nhưng cho dồn REMOTE_BURST tiếng (gói tin mạng hay tới dồn cục)
    this._tokens = Math.min(REMOTE_BURST, this._tokens + (now - this._tokT) / 1000 * REMOTE_RATE);
    this._tokT = now;
    if (this._tokens < 1) {
      // Bỏ tiếng sủa (spam / mạng dồn gói): vẫn báo cho guest để nó gỡ lực dự đoán ngay, không bị giật lùi 1,5 giây sau
      this.net.send({ t: 'bk', s: 'g', d: 1, g: this.gauge.value });
      return;
    }
    this._tokens -= 1;
    volume = Math.max(0.04, Math.min(MAX_VOL, Number(volume) || 0.1));
    this._bbCredit = true; this._lastRemoteBarkAt = now;     // mở 1 suất cộng bù cho tiếng sủa này
    word = typeof word === 'string' ? word.slice(0, 12) : this._randomBarkWord(this.aiChar.data);

    this.remoteBarkCount++;
    const count = this.remoteCombo.addBark();
    const mult  = this.remoteCombo.getMultiplier();
    this._opponentBark(volume, count, mult, word);
    this.net.send({ t: 'bk', s: 'g', v: volume, w: word, c: count, g: this.gauge.value });
  }

  _opponentBark(volume, comboCount, comboMult, barkWord) {
    this.opponentCombo = comboCount;
    const nowT = performance.now();
    const tempoMult = CharStats.tempoMult(this.aiChar.data, this._lastOppBarkAt == null ? null : nowT - this._lastOppBarkAt);
    this._lastOppBarkAt = nowT;
    this._oppMult = comboMult * tempoMult;
    const force = this.gauge.pushByAI(volume, this.aiChar.data, comboMult, comboCount, tempoMult);
    this.aiChar.bark(volume);
    this.playerChar.damage();
    this.bus.emit('ai:bark', { volume, force, barkWord });
    this.sound.playAIBark(volume);
    this._checkWin();
  }

  _checkWin() {
    if (this.state !== 'fighting' || this.mode === 'guest') return;   // guest chờ host báo
    if (this.gauge.isPlayerWin())  this._endBattle('player', 'ko');
    else if (this.gauge.isAIWin()) this._endBattle('ai', 'ko');
  }

  _endBattle(winner, reason) {
    if (this.state === 'ended') return;
    this.state = 'ended';
    this.ai.stop();

    const fling = reason === 'ko';
    if (reason !== 'disconnect') { if (winner === 'player') this.aiChar.ko(fling); else this.playerChar.ko(fling); }

    if (this.mode === 'host' && reason !== 'forfeit' && reason !== 'disconnect') {
      this.net.send({ t: 'end', w: winner === 'player' ? 'h' : 'g', r: reason, g: this.gauge.value });
    }
    this.bus.emit('battle:end', { winner, reason, barkCount: this.barkCount, maxCombo: this.maxCombo });
  }

  // ─── Mạng ───────────────────────────────────────────

  _onNet(m) {
    if (this.cancelled) return;
    switch (m.t) {
      case 'quit':
        // Đối thủ CHỦ ĐỘNG thoát (bấm thoát / đóng tab) → bạn thắng
        if (this.state !== 'ended') this._endBattle('player', 'forfeit');
        break;
      case '__close':
        // Mất kết nối: không biết ai rớt (có thể chính máy này) → KHÔNG ai thắng, không cộng WP, không ghi lịch sử.
        // (Trước đây cả hai bên đều bị tính "thắng bỏ cuộc" và nhận thưởng.)
        if (this.state !== 'ended') this._endBattle('none', 'disconnect');
        break;

      case 'rdy':
        if (this.mode === 'host') this._guestReady = true;
        break;

      // ── host nhận ──
      case 'bk':
        if (this.mode === 'host' && m.s === undefined) this._onRemoteBark(m.v, m.w);
        else if (this.mode === 'guest' && m.s === 'h') this._onHostBark(m);   // host sủa
        else if (this.mode === 'guest' && m.s === 'g') this._reconcile(m.g, true);   // xác nhận của host
        break;

      case 'bb':   // host nhận: guest cộng bù đỉnh thật của tiếng sủa
        if (this.mode === 'host' && this.state === 'fighting') {
          // Chỉ chấp nhận 1 lần cộng bù cho mỗi tiếng sủa vừa được duyệt, trong 250ms (chống guest spam tin 'bb' để tự đẩy thanh lực)
          const nowBB = performance.now();
          if (!this._bbCredit || nowBB - this._lastRemoteBarkAt > 250) break;
          this._bbCredit = false;
          const ev = Math.max(0, Math.min(MAX_VOL, Number(m.v) || 0));
          if (ev > 0.01) { this.gauge.boostByAI(ev, this.aiChar.data, this._oppMult); this._checkWin(); }
        }
        break;

      // ── guest nhận ──
      case 'cd':
        if (this.mode !== 'guest') break;
        clearInterval(this._rdyTimer);
        this.bus.emit('battle:countdown', { value: m.v });
        if (!(m.v === null || m.v === 'GO!' || (Number.isInteger(m.v) && m.v >= 0 && m.v <= 10))) break;     // chỉ nhận đúng các giá trị đếm ngược
        if (typeof m.v === 'number') this.sound.playCountdownTick();
        if (m.v === 'GO!') this.sound.playCountdownGo();
        if (m.v === null && this.state === 'countdown') { this._stGap = 0; this.state = 'fighting'; this.bus.emit('battle:start'); }
        break;
      case 'st':
        if (this.mode !== 'guest') break;
        this._stGap = 0;
        // Guest vào trận trễ (xin mic lâu) nên lỡ tin đếm ngược → thấy host đang đánh thì vào trận luôn, không kẹt ở "countdown"
        if (this.state === 'countdown') {
          clearInterval(this._rdyTimer);
          this.bus.emit('battle:countdown', { value: null });
          this.state = 'fighting'; this.bus.emit('battle:start');
        }
        this._reconcile(m.g, false);
        this.timeLeft = clampNum(m.tl, 0, CONFIG.BATTLE.ROUND_TIME, this.timeLeft);
        this.opponentCombo = clampNum(m.hc, 0, 999, 0) | 0;
        break;
      case 'end':
        if (this.mode !== 'guest' || this.state === 'ended') break;
        if (m.w !== 'h' && m.w !== 'g') break;                       // không rõ ai thắng → bỏ qua (nhịp tim/đứt mạng sẽ xử lý)
        this._pending.length = 0;
        this.gauge.setValue(100 - clampNum(m.g, 0, 100, 50));
        this._endBattle(m.w === 'g' ? 'player' : 'ai', m.r === 'ko' ? 'ko' : 'timeout');
        break;
    }
  }

  /** guest: host vừa sủa */
  _onHostBark(m) {
    if (this.state !== 'fighting') return;
    this._reconcile(m.g, false);
    this.opponentCombo = clampNum(m.c, 0, 999, 0) | 0;
    const volume = Math.max(0.04, Math.min(MAX_VOL, Number(m.v) || 0.1));
    this.aiChar.bark(volume);
    this.playerChar.damage();
    const barkWord = typeof m.w === 'string' ? m.w.slice(0, 12) : this._randomBarkWord(this.aiChar.data);
    this.bus.emit('ai:bark', { volume, force: 0, barkWord });
    this.sound.playAIBark(volume);
  }

  async _runCountdown() {
    const emit = (v) => {
      this.bus.emit('battle:countdown', { value: v });
      if (this.mode === 'host') this.net.send({ t: 'cd', v });
    };
    for (let i = CONFIG.BATTLE.COUNTDOWN_FROM; i >= 1; i--) {
      if (this.cancelled) return;
      emit(i);
      this.sound.playCountdownTick();
      await this._wait(1000);
    }
    if (this.cancelled) return;
    emit('GO!');
    this.sound.playCountdownGo();
    await this._wait(700);
    if (this.cancelled) return;
    emit(null);
  }

  _wait(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

  _randomBarkWord(charData) {
    const words = charData.barkWords || ['GÂU!'];
    return words[Math.floor(Math.random() * words.length)];
  }
}
