/**
 * BattleScreen.js — Controller + Renderer cho màn chiến đấu
 *
 * Giống video gốc:
 *  - chó thắng thế phình to + mặt dữ tợn, chó thua teo nhỏ + sợ hãi, K.O. thì bị hất bay
 *  - màn hình ngả đỏ/cam đậm dần khi bạn thắng thế
 *  - chữ sủa dày đặc nhiều kiểu chữ, đếm ngược số vàng → SỦA ĐI!
 * Hỗ trợ trận online (config.online = { role, net }).
 */
import { CONFIG }              from '../data/config.js';
import { BattleManager }       from '../game/BattleManager.js';
import { MicrophoneManager }   from '../audio/MicrophoneManager.js';
import { BarkDetector }        from '../audio/BarkDetector.js';
import { MicNormalizer }       from '../audio/MicNormalizer.js';
import { ScreenShake }         from '../effects/ScreenShake.js';
import { BarkTextEffect }      from '../effects/BarkTextEffect.js';
import { ParticleSystem }      from '../effects/ParticleSystem.js';
import { DogRenderer }         from '../rendering/DogRenderer.js';
import { SaveManager }         from '../core/SaveManager.js';
import { Assets }              from '../core/AssetLoader.js';
import { Perf, WakeLock }      from '../core/Perf.js';
import { Popup }               from '../core/Popup.js';
import { I18n, t }             from '../core/I18n.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class BattleScreen {
  constructor({ bus, screenManager, soundManager, online }) {
    this.bus    = bus;
    this.sm     = screenManager;
    this.sound  = soundManager;
    this.online = online || null;     // OnlineLobbyScreen (chế độ 2 người)

    const $ = (id) => document.getElementById(id);
    this.screenEl       = $('screen-battle');
    this.canvas         = $('game-canvas');
    this.ctx            = this.canvas.getContext('2d');
    this.timerEl        = $('battle-timer');
    this.gaugeIndicator = $('gauge-indicator');
    this.gaugePctEl     = $('gauge-pct');
    this.gaugeFillPlayer= $('gauge-fill-player');
    this.micBar         = $('mic-bar');
    this.micVolText     = $('mic-volume-text');
    this.micThreshLine  = $('mic-threshold-line');
    this.comboCountEl   = $('combo-count');
    this.comboDisplayEl = $('combo-display');
    this.barkTotalEl    = $('bark-total-count');
    this.effectsOverlay = $('effects-overlay');
    this.flashEl        = $('screen-flash');
    this.countdownEl    = $('countdown-overlay');
    this.countdownNumEl = $('countdown-number');
    this.koOverlay      = $('ko-overlay');
    this.hudPlayerName  = $('hud-player-name');
    this.hudAIName      = $('hud-ai-name');
    this.pingEl         = $('battle-ping');
    this.tintWarm       = $('tint-warm');
    this.tintCool       = $('tint-cool');
    this.toastEl        = $('battle-toast');
    this.micSection     = $('mic-section');
    this.micIcon        = $('mic-status-icon');

    this.shake      = new ScreenShake(this.screenEl);
    this.barkText   = new BarkTextEffect(this.effectsOverlay);
    this.particles  = new ParticleSystem(this.ctx);

    this.battle = null; this.mic = null; this.barkDetector = null;
    this._raf = null; this._lastTime = 0; this._time = 0;
    this._currentVol = 0; this._barkCount = 0; this._maxCombo = 0;
    this._battleConfig = null; this._micAvailable = false; this._toastTimer = null;
    this._goPulse = 0;          // nháy đỏ khi hô "SỦA ĐI!"
    this._fx = null;            // vị trí/cỡ chó của khung hình gần nhất (để đặt chữ, hạt)
    this._ended = false;
    this._pingTimer = null;
    this._micTimer = null; this._peakSinceFrame = 0; this.norm = null;

    this.vw = window.innerWidth; this.vh = window.innerHeight; this.dpr = 1;
    this._setupListeners();
  }

  get isOnline() { return !!this._battleConfig?.online; }

  // ── Lifecycle ──────────────────────────────────────

  async show(config) {
    const token = this._showToken = (this._showToken || 0) + 1;   // mỗi lần vào/thoát trận đổi token → tác vụ chờ cũ biết mình đã lỗi thời
    this._battleConfig = config;
    this._barkCount = 0; this._maxCombo = 0; this._currentVol = 0; this._time = 0;
    this._goPulse = 0; this._ended = false; this._fx = null;

    this._resizeCanvas();
    this._onResize = () => this._resizeCanvas();
    window.addEventListener('resize', this._onResize);
    window.addEventListener('orientationchange', this._onResize);
    // Quay lại từ app khác (Zalo/Messenger/cuộc gọi…) giữa trận: mic + âm thanh thường chết → dựng lại, khỏi phải thoát ra vào lại.
    this._onVisible = () => { if (document.visibilityState === 'visible') this._recoverAudioAfterReturn(token); };
    document.addEventListener('visibilitychange', this._onVisible);

    const on = config.online;
    const pName = I18n.charName(config.playerChar), aName = I18n.charName(config.aiChar);    // chỉ để hiển thị — dữ liệu đồng bộ online vẫn dùng id nhân vật
    this.hudPlayerName.textContent = t(on ? 'b.you' : 'b.youSolo', { name: pName });
    this.hudAIName.textContent     = t(on ? 'b.opp' : 'b.ai', { name: aName });

    this.koOverlay.classList.add('hidden');
    this.countdownEl.classList.add('hidden');
    this.barkText.clear(); this.particles.clear(); this.shake.stop();
    this.flashEl.style.opacity = '0';
    this.tintWarm.style.opacity = '0'; this.tintCool.style.opacity = '0';
    this._updateGaugeUI(50);

    clearInterval(this._pingTimer);
    this.pingEl.classList.toggle('hidden', !on);
    if (on) {
      const upd = () => {
        const q = on.net.quality;
        this.pingEl.textContent = `🌐 ${on.net.latency || '--'} ms${q === 'bad' ? ' ⚠' : ''}`;
        this.pingEl.classList.remove('q-good', 'q-ok', 'q-bad'); if (q !== 'none') this.pingEl.classList.add('q-' + q);
        // Mạng yếu liên tục ≥ 3 giây → báo nổi (tối đa 15 giây một lần) để người chơi biết vì sao giật
        this._badSecs = q === 'bad' ? (this._badSecs || 0) + 1 : 0;
        if (this._badSecs >= 3 && performance.now() - (this._weakAt || -1e9) > 15000 && this.battle?.state === 'fighting') {
          this._weakAt = performance.now(); Popup.toast(t('b.weak'), { kind: 'warn', ms: 3500 });
        }
      };
      upd(); this._pingTimer = setInterval(upd, 1000);
    }

    WakeLock.on();
    if (on) on.net.deadAfterMs = null;     // trong trận dùng ngưỡng mất kết nối nhanh (net-config.js)
    // Xin mic KHÔNG được chặn vào trận: người chơi để hộp thoại quyền mic treo / vào Cài đặt đổi quyền thì trước đây
    // màn hình đứng im, host chờ, kết nối rớt mà không ai hay. Chờ tối đa 4 giây rồi vào trận; mic bật xong sau vẫn tự gắn vào.
    await Promise.race([this._initMic(token), new Promise(r => setTimeout(r, 4000))]);
    if (token !== this._showToken) return;          // đã thoát khỏi trận trong lúc chờ → đừng dựng trận "ma" ở nền

    this.battle = new BattleManager({
      playerChar: config.playerChar, aiChar: config.aiChar, stage: config.stage,
      difficulty: config.difficulty || 1, bus: this.bus, soundManager: this.sound,
      mode: on ? on.role : 'ai', net: on ? on.net : null,
    });

    this._startLoop();
    this.battle.start();
  }

  hide() { this._cleanup(); }

  // ── Game Loop ──────────────────────────────────────

  _startLoop() {
    this._lastTime = performance.now();
    this._fpsAcc = 0; this._fpsN = 0; this._fpsDone = false; this._fightMs = 0; this._fpsWins = []; this._shownBarks = -1;
    const loop = (ts) => {
      this._raf = requestAnimationFrame(loop);
      const raw = ts - this._lastTime;
      if (raw < 1000 / Perf.fpsCap - 2) return;            // máy yếu: giới hạn 30fps cho đỡ nóng
      const dt = Math.min(raw, 100);
      this._lastTime = ts;
      // Đo fps thật: bỏ 1,5 giây đầu của trận (ảnh/JIT còn đang khởi động), rồi đo 2 đợt × 2,5 giây.
      // Chỉ hạ xuống chế độ tiết kiệm khi CẢ HAI đợt đều chậm → không bị oan vì một cú khựng lúc vào trận.
      if (!this._fpsDone && this.battle?.state === 'fighting' && raw < 200) {
        this._fightMs += raw;
        if (this._fightMs > 1500) {
          this._fpsAcc += raw; this._fpsN++;
          if (this._fpsAcc > 2500) {
            const avg = 1000 * this._fpsN / this._fpsAcc;
            this._fpsAcc = 0; this._fpsN = 0; this._fpsWins.push(avg);
            if (avg >= 38) this._fpsDone = true;                                   // đợt này mượt → thôi đo
            else if (this._fpsWins.length >= 2) {
              this._fpsDone = true;
              if (Perf.reportFps(Math.max(...this._fpsWins))) this._resizeCanvas();
            }
          }
        }
      }
      this._time += dt / 1000;
      this._update(dt);
      this._render();
    };
    this._raf = requestAnimationFrame(loop);
  }

  /** Thế trận: -1 (đối thủ áp đảo) … +1 (bạn áp đảo) */
  _dominance() {
    const g = this.battle?.gauge.displayValue ?? 50;
    return clamp((50 - g) / 50, -1, 1);
  }

  _update(dt) {
    if (this.mic?.isActive && this.barkDetector) {
      // Bộ phát hiện sủa chạy ở timer riêng 10ms (_startMicLoop) → không bị trễ theo fps; ở đây chỉ vẽ thanh âm lượng
      const rms = this._peakSinceFrame; this._peakSinceFrame = 0;
      this._currentVol = rms;
      this._updateMicUI(rms);
    } else {
      this._updateMicUI(this._currentVol * 0.8);
      this._currentVol *= 0.8;
    }

    if (this.battle) {
      this.battle.update(dt);

      const tl = Math.ceil(this.battle.timeLeft);
      if (this.timerEl.textContent !== String(tl)) this.timerEl.textContent = tl;
      this.timerEl.classList.toggle('timer-warning', tl <= 10);

      this._updateGaugeUI(this.battle.gauge.displayValue);
      this._updateTint(dt);

      const cc = this.battle.combo.count;
      if (this.comboCountEl.textContent !== String(cc)) this.comboCountEl.textContent = cc;
      this.comboDisplayEl.classList.toggle('combo-active', cc >= 2);
      if (this._shownBarks !== this._barkCount) { this._shownBarks = this._barkCount; this.barkTotalEl.textContent = this._barkCount; }
    }

    this.shake.update(dt);
    this.particles.update(dt);
  }

  /** Màn hình ngả đỏ/cam khi bạn thắng thế (đậm dần), xanh xám khi bị lép vế */
  _updateTint(dt) {
    const d = this._dominance();
    this._goPulse = Math.max(0, this._goPulse - dt / 1400);
    const k = Perf.tintScale;
    const warm = d > 0 ? Math.pow(d, 0.85) * CONFIG.EFFECTS.TINT_WARM_MAX * k : 0;
    const cool = d < 0 ? Math.pow(-d, 0.9) * CONFIG.EFFECTS.TINT_COOL_MAX * k : 0;
    this.tintWarm.style.opacity = Math.min(1, warm + this._goPulse * 0.55).toFixed(3);
    this.tintCool.style.opacity = cool.toFixed(3);
  }

  _dogLayout() {
    const { vw: w, vh: h } = this;
    const groundY = Assets.getGroundY(this.battle?.stage?.id) ?? CONFIG.RENDER.DOG_Y_PCT;
    return {
      playerX: w * CONFIG.RENDER.PLAYER_X_PCT,
      aiX:     w * CONFIG.RENDER.AI_X_PCT,
      y:       h * groundY,
      size:    Math.min(h * CONFIG.RENDER.DOG_SIZE_PCT, w * 0.30),
    };
  }

  _render() {
    if (!this.battle) return;
    const { ctx } = this;
    const w = this.vw, h = this.vh;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    DogRenderer.drawBackground(ctx, w, h, this.battle.stage, this._time);
    this.particles.draw();

    const L = this._dogLayout();
    const dom = this._dominance();
    this._fx = {
      player: this._drawFighter(ctx, 'player', L, dom),
      ai:     this._drawFighter(ctx, 'ai', L, -dom),
    };
  }

  /** Vẽ 1 chú chó: cỡ theo thế trận, bị hất bay khi K.O. Trả về vị trí để đặt chữ/hạt. */
  _drawFighter(ctx, who, L, d) {
    const isPlayer = who === 'player';
    const ch = isPlayer ? this.battle.playerChar : this.battle.aiChar;
    const { DOM_GROW, DOM_SHRINK } = CONFIG.EFFECTS;
    const base = d >= 0 ? 1 + DOM_GROW * d : 1 + DOM_SHRINK * d;      // thắng → to, thua → teo
    let scale = base * ch.scale;                                       // + nảy nhẹ khi sủa
    let x = (isPlayer ? L.playerX : L.aiX) + (isPlayer ? 1 : -1) * d * this.vw * 0.05;   // thắng tiến lại gần, thua lùi ra
    let y = L.y, rot = 0, flying = false;

    if (ch.state === 'ko' && ch.flung) {                              // K.O. → hất bay ra khỏi màn hình
      const p = Math.min(1, (ch.koTime || 0) / 900), e = 1 - Math.pow(1 - p, 3);
      const away = isPlayer ? -1 : 1;
      x += away * this.vw * 0.8 * e;
      y -= this.vh * 0.5 * e;
      rot = away * e * Math.PI * 5;
      scale *= 1 - 0.25 * e;
      flying = true;
    }

    ctx.save();
    ctx.translate(ch.shakeX, ch.shakeY);
    DogRenderer.draw(ctx, x, y, L.size, ch.data, isPlayer, ch.visualState, scale, this._time, { dom: d, rot, flying });
    if (ch.state === 'bark' && ch.scale > 1.04) this._drawBarkAura(ctx, x, y + L.size * 0.48 - L.size * 0.45 * scale, L.size * scale * 0.78, ch.scale);
    ctx.restore();

    const feetY = y + L.size * 0.48;
    return { x, y, size: L.size, scale, feetY,
             headX: x + (isPlayer ? 1 : -1) * L.size * scale * 0.10,
             headY: feetY - L.size * scale * 0.66 };
  }

  /** Vòng tròn mờ quanh chú chó đang sủa (như video) */
  _drawBarkAura(ctx, cx, cy, r, scale) {
    const a = clamp((scale - 1) * 3, 0, 0.7);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  // ── UI Updates ─────────────────────────────────────

  _updateMicUI(rms) {
    const pct = Math.min(100, rms * 500);
    const thresh = this.barkDetector?.threshold ?? CONFIG.MIC.THRESHOLD;
    this.micBar.style.width = `${pct}%`;
    this.micBar.style.background = rms >= thresh
      ? 'linear-gradient(90deg, #f5a623, #ff4400)' : 'linear-gradient(90deg, #2ecc71, #3498db)';
    this.micVolText.textContent = this._micAvailable ? `${Math.round(pct)}%` : 'OFF';
    this.micThreshLine.style.left = `${Math.min(95, thresh * 500)}%`;
  }

  /** value: 0 = bạn thắng, 100 = đối thủ thắng. Con trượt hiện % phần BẠN đang chiếm. */
  _updateGaugeUI(value) {
    const pos = clamp(100 - value, 0, 100);
    this.gaugeIndicator.style.left = `${clamp(pos, 4, 96)}%`;
    this.gaugeFillPlayer.style.width = `${pos}%`;
    this.gaugePctEl.textContent = `${Math.round(pos)}%`;
    this.gaugeIndicator.className = value < 18 ? 'danger-player' : value > 82 ? 'danger-ai' : '';
  }

  // ── Event Listeners ────────────────────────────────

  _setupListeners() {
    this.bus.on('battle:countdown', ({ value }) => {
      if (value === null) { this.countdownEl.classList.add('hidden'); return; }
      this.countdownEl.classList.remove('hidden');
      const go = value === 'GO!';
      this.countdownNumEl.textContent = go ? t('b.go') : value;
      // gán lại class để chạy lại animation
      this.countdownNumEl.className = 'countdown-number';
      void this.countdownNumEl.offsetWidth;
      if (go) { this.countdownNumEl.classList.add('go-text'); this._goPulse = 1; }
    });

    this.bus.on('player:bark', ({ volume, comboCount, barkWord }) => {
      this._barkCount++;
      if (comboCount > this._maxCombo) this._maxCombo = comboCount;

      this.shake.shake(Math.min(CONFIG.EFFECTS.SHAKE_INTENSITY_MAX, volume * 20), CONFIG.EFFECTS.SHAKE_DURATION_MS);
      this._flash('rgba(255,170,0,0.12)', 160);

      const f = this._fx?.player;
      this.barkText.spawnBurst(barkWord, 'left', volume, this._battleConfig?.playerChar, f && { x: f.headX, y: f.headY });
      const L = this._dogLayout();
      this.particles.emit(f?.headX ?? L.playerX, f?.headY ?? L.y, {
        count: Math.floor(CONFIG.EFFECTS.PARTICLES_PER_BARK * Perf.fx * Math.min(1, volume * 1.5)),
        color: `hsl(${38 + Math.random() * 14}, 95%, ${58 + volume * 15}%)`,
        speed: 5 + volume * 6, spread: Math.PI * 0.9, angle: -Math.PI * 0.45,
      });
      if (comboCount >= 3) this.barkText.spawnComboText(`${comboCount}x COMBO!`, this.vw * 0.5 - 60, this.vh * 0.32);
    });

    this.bus.on('ai:bark', ({ volume, barkWord }) => {
      this._flash('rgba(200,20,20,0.10)', 160);
      const f = this._fx?.ai;
      this.barkText.spawnBurst(barkWord, 'right', volume, this._battleConfig?.aiChar, f && { x: f.headX, y: f.headY });
      const L = this._dogLayout();
      this.particles.emit(f?.headX ?? L.aiX, f?.headY ?? L.y, {
        count: Math.floor(CONFIG.EFFECTS.PARTICLES_PER_BARK * 0.7 * Perf.fx * Math.min(1, volume * 1.4)),
        color: `hsl(${Math.random() * 15}, 85%, 55%)`,
        speed: 4 + volume * 5, spread: Math.PI * 0.9, angle: -Math.PI * 0.55,
      });
    });

    this.bus.on('battle:end', async (r) => { await this._handleBattleEnd(r.winner, r.reason); });

    let lastTap = -1e9;
    document.getElementById('btn-tap-bark')?.addEventListener('pointerdown', (e) => {
      if (e.cancelable) e.preventDefault();
      if (!this.battle || this.battle.state !== 'fighting') return;
      const now = performance.now();
      const gap = now - lastTap;
      if (gap < CONFIG.TAP.MIN_GAP_MS) return;          // chỉ chống nhận đôi 1 lần bấm
      lastTap = now;
      const { VOL_MIN, VOL_MAX, FULL_MS, MIN_FACTOR } = CONFIG.TAP;
      const factor = Math.max(MIN_FACTOR, Math.min(1, gap / FULL_MS));   // bấm dồn → mỗi lần nhẹ hơn
      this.battle.onPlayerBark((VOL_MIN + Math.random() * (VOL_MAX - VOL_MIN)) * factor);
    });

    this.micSection?.addEventListener('click', () => this._retryMic());

    document.getElementById('btn-exit-battle')?.addEventListener('click', () => {
      this.sound.playClick();
      const on = this._battleConfig?.online;
      if (on) { on.net.send({ t: 'quit' }); this._cleanup(); this.online?.leave(); return; }
      this._cleanup();
      this.sm.show('menu');
    });
  }

  async _handleBattleEnd(winner, reason) {
    if (this._ended) return;
    this._ended = true;
    const isWin = winner === 'player';
    const on = this._battleConfig?.online;

    if (reason === 'ko') {
      this.koOverlay.classList.remove('hidden');
      document.getElementById('ko-text').textContent = 'ĐO VÁN!';
      this.shake.shake(20, 800);
      this._flash(isWin ? 'rgba(255,170,0,0.3)' : 'rgba(220,30,30,0.3)', 1000);
    } else if (reason === 'forfeit') {
      Popup.toast(t('b.forfeit'), { kind: 'ok', ms: 3000 });
    } else if (reason === 'disconnect') {
      Popup.toast(t('b.disconnect'), { kind: 'warn', ms: 3000 });
    }

    // Mất kết nối: không thắng/thua, không thưởng, không ghi lịch sử
    const noScore = reason === 'disconnect';
    let wpGained = noScore ? 0 : this._calcWP(isWin, reason);
    if (!noScore) SaveManager.addWP(wpGained);
    const tierBefore = this._battleConfig?.tier || 0;
    const rec = noScore ? null : SaveManager.addMatchResult({
      winner, reason, barkCount: this._barkCount, maxCombo: this._maxCombo, wpGained,
      charId: this._battleConfig?.playerChar?.id, aiCharId: this._battleConfig?.aiChar?.id, online: !!on,
    });
    const tierUp = rec?.tierUp || null;
    if (tierUp) { SaveManager.addWP(CONFIG.WP.TIER_UP_BONUS); wpGained += CONFIG.WP.TIER_UP_BONUS; }   // thưởng mở cấp mới

    const battleAtEnd = this.battle;
    await new Promise(r => setTimeout(r, reason === 'forfeit' || reason === 'disconnect' ? 1800 : CONFIG.BATTLE.KO_PAUSE_MS));
    if (this.battle !== battleAtEnd) return;       // đã thoát trong lúc chờ

    // Chụp cảnh trận để làm nền cho màn kết quả (bảng mờ phủ lên chính cảnh trận như video)
    let snapshot = null;
    try { snapshot = this.canvas.toDataURL('image/jpeg', 0.85); } catch { /* canvas bị "tainted" → dùng nền tối */ }
    const dominance = this._dominance();

    this._cleanup();
    this.sm.show('result', {
      winner, reason, wpGained, snapshot, dominance, tierUp, tier: tierBefore,
      barkCount: this._barkCount, maxCombo: this._maxCombo,
      playerChar: this._battleConfig?.playerChar, aiChar: this._battleConfig?.aiChar,
      online: !!on,
    });
  }

  _calcWP(isWin, reason) {
    if (isWin) {
      const base = reason === 'ko' ? CONFIG.WP.WIN_KO : CONFIG.WP.WIN_TIMEOUT;
      const tier = this._battleConfig?.tier;                      // đấu bot ở cấp cao → thưởng nhiều hơn (online không có cấp)
      const mult = !this._battleConfig?.online && tier ? (CONFIG.WP.TIER_WIN_MULT[tier - 1] ?? 1) : 1;
      return Math.round(base * mult);
    }
    return reason === 'ko' ? CONFIG.WP.LOSS_KO : CONFIG.WP.LOSS_TIMEOUT;
  }

  _flash(color, durationMs) {
    this.flashEl.style.transition = 'none';
    this.flashEl.style.background = color;
    this.flashEl.style.opacity = '1';
    requestAnimationFrame(() => {
      this.flashEl.style.transition = `opacity ${durationMs}ms ease`;
      this.flashEl.style.opacity = '0';
    });
  }

  // ── Mic ───────────────────────────────────────────

  async _initMic(token = this._showToken) {
    clearInterval(this._micTimer);
    if (this.mic) { this.mic.destroy(); this.mic = null; }
    let mic = null;
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        const err = new Error('Không có mediaDevices (không phải https/localhost?)');
        err.name = 'InsecureContext'; throw err;
      }
      mic = this.mic = new MicrophoneManager();
      let warned = false;
      mic.onProblem = (k) => {
        if (k === 'suspended' && !warned) { warned = true; this._showToast(t('b.micTap'), 5000); }
        if (k === 'ended') { this._micAvailable = false; this._setMicStatus(false, { name: 'NotReadableError' }); }
        else if (k === 'silent' && !warned) { warned = true; this._showToast(t('b.micSilent'), 5000); }
      };
      await mic.init(this.sound?.audioContext || null);
      if (token !== this._showToken || this.mic !== mic) { try { mic.destroy(); } catch {} return; }   // người chơi đã thoát trong lúc chờ quyền → tắt hẳn mic vừa mở (trước đây mic cứ bật mãi)
      const settings = SaveManager.getSettings();
      this.barkDetector = new BarkDetector({ threshold: CONFIG.MIC.THRESHOLD, release: CONFIG.MIC.RELEASE, cooldownMs: CONFIG.MIC.COOLDOWN_MS, peakWindowMs: CONFIG.MIC.ONSET_PEAK_MS });
      this.barkDetector.setThresholdLevel(settings.thresholdLevel || 5);
      this.norm = new MicNormalizer();     // quy mic máy nào cũng về cùng một thang "to / nhỏ"
      this.barkDetector.onBark  = (raw) => { this.norm.learn(raw); this.battle?.onPlayerBark(this.norm.scale(raw)); };
      this.barkDetector.onBoost = (a, b) => { const ex = this.norm.scale(b) - this.norm.scale(a); this.norm.learn(b); this.battle?.onPlayerBoost(ex); };
      this.barkDetector.topUpMs = CONFIG.MIC.TOPUP_MS; this.barkDetector.topUpRatio = CONFIG.MIC.TOPUP_RATIO;
      this._startMicLoop();
      this._micAvailable = true;
      this._setMicStatus(true);
      if (this.mic.context && this.mic.context.state !== 'running')
        this._showToast(t('b.micTapIos'), 6000);
    } catch (e) {
      if (e?.name === 'AbortError') return;       // mic này đã bị thay/huỷ có chủ đích (vào lại từ app khác, thoát trận)
      console.warn('[BattleScreen] Mic không khả dụng:', e.name, e.message);
      if (mic) { try { mic.destroy(); } catch {} }
      if (token !== this._showToken) return;        // đã thoát trận: không báo lỗi mic ở màn hình khác
      if (this.mic === mic) this.mic = null;
      this.barkDetector = null; this._micAvailable = false;
      this._setMicStatus(false, e);
    }
  }

  /** Vòng đọc mic + phát hiện sủa tách khỏi vòng vẽ: độ trễ ~10ms thay vì cả khung hình (33ms khi máy yếu chạy 30fps). */
  _startMicLoop() {
    clearInterval(this._micTimer);
    let last = performance.now();
    this._micTimer = setInterval(() => {
      const mic = this.mic, det = this.barkDetector;
      if (!mic?.isActive || !det) return;
      const now = performance.now(), dt = Math.min(100, now - last); last = now;
      if (dt <= 0) return;
      const rms = mic.getRMS(dt);
      if (rms > this._peakSinceFrame) this._peakSinceFrame = rms;
      det.update(rms, dt, mic.minRMS);
    }, 10);
  }

  /**
   * Trang hiện lại sau khi bị ẩn: kiểm tra mic và loa, hỏng thì dựng lại.
   * Mic phải tắt TRƯỚC thì SoundManager mới được phép dựng AudioContext mới (mic đang gắn vào context cũ).
   */
  async _recoverAudioAfterReturn(token) {
    if (token !== this._showToken || this._ended || this._recovering) return;
    this._recovering = true;
    try {
      await new Promise(r => setTimeout(r, 250));                       // chờ hệ điều hành trả lại mic/loa
      if (token !== this._showToken || document.hidden) return;
      const micBad = this._micAvailable ? !this.mic?.isLive() : false;
      const ctx = this.sound?.audioContext;
      const ctxBad = !!ctx && ctx.state !== 'running';
      if (this.mic && (micBad || ctxBad)) {
        try { this.mic.destroy(); } catch {}
        this.mic = null; this._micAvailable = false;
        await this.sound?.refreshAfterReturn?.();
        if (token !== this._showToken) return;
        await this._initMic(token);
      } else if (this.mic) {
        await this.mic.resume();
      } else if (!this._micAvailable) {
        await this.sound?.refreshAfterReturn?.();
      }
    } finally { this._recovering = false; }
  }

  async _retryMic() {
    if (!this._micAvailable) await this._initMic();
    else await this.mic?.resume();      // mic đang bật nhưng im: thử đánh thức AudioContext
  }

  _setMicStatus(ok, err = null) {
    if (this.micIcon) this.micIcon.textContent = ok ? '🎤' : '🚫';
    this.micSection?.classList.toggle('mic-off', !ok);
    if (this.micSection) this.micSection.title = t(ok ? 'b.micOk' : 'b.micOff');
    const tapBtn = document.getElementById('btn-tap-bark');
    if (tapBtn) {
      tapBtn.style.opacity = ok ? '0.92' : '1';
      tapBtn.title = t(ok ? 'b.tapTitleMic' : 'b.tapTitle');
    }
    if (ok) { this._showToast(t('b.micOn'), 1800); return; }
    const name = err?.name || '';
    let msg;
    if (name === 'NotAllowedError' || name === 'SecurityError' || name === 'PermissionDeniedError')
      msg = t('b.micDenied');
    else if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
      msg = t('b.micNone');
    else if (name === 'NotReadableError')
      msg = t('b.micBusy');
    else if (name === 'InsecureContext')
      msg = t('b.micInsecure');
    else msg = t('b.micFail', { name: name || t('b.unknownErr') });
    this._showToast(msg, 7000);
  }

  _showToast(msg, ms = 3000) {
    if (!this.toastEl) return;
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('hidden');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => this.toastEl.classList.add('hidden'), ms);
  }

  // ── Cleanup ───────────────────────────────────────

  _cleanup() {
    Popup.clearToast(); this._badSecs = 0;
    this._showToken = (this._showToken || 0) + 1;     // hủy mọi tác vụ chờ (xin mic…) còn treo của lần vào trận trước
    WakeLock.off();
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
    clearInterval(this._micTimer); this._micTimer = null;
    this.norm?.save(); this.norm = null;
    if (this.mic) { this.mic.destroy(); this.mic = null; }
    if (this.battle) { this.battle.destroy(); this.battle = null; }
    this.barkDetector = null;
    clearInterval(this._pingTimer);
    this.particles.clear(); this.barkText.clear(); this.shake.stop();
    if (this._onVisible) { document.removeEventListener('visibilitychange', this._onVisible); this._onVisible = null; }
    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      window.removeEventListener('orientationchange', this._onResize);
      this._onResize = null;
    }
    clearTimeout(this._toastTimer);
    this.toastEl?.classList.add('hidden');
    this.flashEl.style.opacity = '0';
    this.countdownEl.classList.add('hidden');
    this.koOverlay.classList.add('hidden');
    this.effectsOverlay.innerHTML = '';
  }

  _resizeCanvas() {
    this.vw  = Math.max(1, this.canvas.clientWidth  || window.innerWidth);
    this.vh  = Math.max(1, this.canvas.clientHeight || window.innerHeight);
    this.dpr = Math.min(window.devicePixelRatio || 1, Perf.dprCap);
    this.canvas.width  = Math.round(this.vw * this.dpr);
    this.canvas.height = Math.round(this.vh * this.dpr);
  }
}
