/**
 * DogCharacter.js — Trạng thái nhân vật chó trong trận đấu
 *
 * Quản lý: state machine, scale animation, shake, KO animation.
 * Renderer (BattleScreen) đọc các thuộc tính này để vẽ.
 */
import { CONFIG } from '../data/config.js';

export class DogCharacter {
  /**
   * @param {object} charData - Dữ liệu từ characters.js
   * @param {boolean} isPlayer
   */
  constructor(charData, isPlayer = true) {
    this.data = charData;
    this.isPlayer = isPlayer;

    /** @type {'idle'|'bark'|'damage'|'ko'} */
    this.state = 'idle';

    // Scale animation
    this.scale = 1.0;
    this._targetScale = 1.0;
    this._scaleLerpSpeed = 0.25;

    // KO rotation (0 → π/2)
    this.koAngle = 0;
    this._koSpeed = 0.003; // radians per ms

    // Bark state timer
    this._stateTimer = 0;
    this._barkDuration = 140; // ms — ngắn để bấm/sủa dồn vẫn thấy từng nhịp (bark ↔ idle)

    // Hurt flash (hiện sprite damage)
    this._hurtTimer = 0;

    // Shake
    this.shakeX = 0;
    this.shakeY = 0;
    this._shakeIntensity = 0;
    this._shakeDuration = 0;
    this._shakeTimer = 0;

    // Idle bob (controlled externally via time)
    this.idleBobOffset = 0; // set by renderer
  }

  /**
   * Trigger bark animation — scale up + state = 'bark'.
   * @param {number} volume 0.0–1.0
   */
  bark(volume) {
    if (this.state === 'ko') return;
    this.state = 'bark';
    // Miệng chỉ mở theo đúng nhịp người chơi: sủa dồn thì mỗi tiếng ngắn lại để thấy "há – ngậm – há" từng cái
    const nowB = performance.now();
    const gapB = this._lastBarkAt ? nowB - this._lastBarkAt : Infinity;
    this._lastBarkAt = nowB;
    this._stateTimer = Math.max(70, Math.min(this._barkDuration, gapB * 0.75));

    // Scale lên dựa trên volume (max phụ thuộc character)
    const maxScale = CONFIG.EFFECTS.DOG_SCALE_MAX;
    this._targetScale = 1.0 + (maxScale - 1.0) * Math.min(1, volume * 1.4);
    // Mỗi tiếng sủa nảy lên một nhịp riêng (kể cả khi sủa dồn) để thấy chó sủa theo từng lần
    this.scale = Math.max(this.scale, Math.min(maxScale * 1.04, this._targetScale + 0.05));
  }

  /**
   * Trigger damage flash + shake.
   */
  damage() {
    if (this.state === 'ko') return;
    this._shakeIntensity = 6;
    this._shakeDuration = 180;
    this._shakeTimer = 180;
    this._hurtTimer = 220;
  }

  /**
   * Trigger KO — dog falls over.
   */
  ko(fling = false) {
    this.state = 'ko';
    this.koAngle = 0;
    this.koTime = 0;          // ms kể từ lúc bị hạ
    this.flung = fling;       // true: bị hất bay khỏi màn hình (K.O thật)
    this._targetScale = 1.0;
  }

  /**
   * Update mỗi frame.
   * @param {number} dt - ms
   */
  update(dt) {
    // State timer
    if (this._stateTimer > 0) {
      this._stateTimer -= dt;
      if (this._stateTimer <= 0 && this.state === 'bark') {
        this.state = 'idle';
        this._stateTimer = 0;
      }
    }

    if (this._hurtTimer > 0) this._hurtTimer -= dt;

    // Scale lerp về target
    const lerpK = 1 - Math.pow(1 - this._scaleLerpSpeed, dt / 16);
    this.scale += (this._targetScale - this.scale) * lerpK;

    // Target scale trở về 1 nếu không bark
    if (this.state !== 'bark') {
      this._targetScale += (1.0 - this._targetScale) * lerpK;
    }

    // Shake
    if (this._shakeTimer > 0) {
      this._shakeTimer -= dt;
      const p = this._shakeTimer / this._shakeDuration;
      this.shakeX = (Math.random() - 0.5) * this._shakeIntensity * p;
      this.shakeY = (Math.random() - 0.5) * this._shakeIntensity * p;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }

    // KO animation
    if (this.state === 'ko') {
      this.koTime = (this.koTime || 0) + dt;
      const targetAngle = Math.PI * 0.5;
      if (this.koAngle < targetAngle) {
        this.koAngle = Math.min(targetAngle, this.koAngle + this._koSpeed * dt);
      }
    }
  }

  /** Trạng thái để VẼ: 'idle' | 'bark' | 'damage' | 'ko' (khớp tên file ảnh trong assets) */
  get visualState() {
    if (this.state === 'ko')   return 'ko';
    if (this.state === 'bark') return 'bark';
    return this._hurtTimer > 0 ? 'damage' : 'idle';
  }

  get isKO() { return this.state === 'ko'; }
  get isBarking() { return this.state === 'bark'; }
}
