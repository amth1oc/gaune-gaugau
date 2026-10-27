/**
 * CharacterSelectScreen.js — Màn chọn nhân vật
 * Hiển thị character cards, preview canvas, confirm button.
 */
import { CHARACTERS }   from '../data/characters.js';
import { CONFIG }       from '../data/config.js';
import { STAGES, getRandomStage, getStageById } from '../data/stages.js';
import { Assets }       from '../core/AssetLoader.js';
import { CharStats }    from '../game/CharStats.js';
import { SaveManager }  from '../core/SaveManager.js';
import { DogRenderer }  from '../rendering/DogRenderer.js';
import { I18n, t }      from '../core/I18n.js';

export class CharacterSelectScreen {
  constructor({ screenManager, soundManager }) {
    this.sm = screenManager;
    this.sound = soundManager;

    this._selected = null;
    this._previewCanvas = document.getElementById('preview-canvas');
    this._previewCtx = this._previewCanvas?.getContext('2d');
    // Canvas x2 cho nét hơn trên màn hình retina / điện thoại (vẫn vẽ theo toạ độ 200×200)
    if (this._previewCanvas) {
      this._previewCanvas.width = 400;
      this._previewCanvas.height = 400;
      this._previewCtx.setTransform(2, 0, 0, 2, 0, 0);
    }
    this._stageId = 'random';
    this._previewAnim = null;
    this._previewTime = 0;

    this._buildGrid();
    this._buildStageChips();
    this._buildTierChips();
    // Ảnh nền tải nền sau menu → khi xong, dựng lại danh sách bối cảnh (có ảnh thật + bối cảnh mới thêm)
    Assets.backgroundsReady?.then(() => this._buildStageChips());
    this._setupListeners();
    // Đổi ngôn ngữ khi đang ở màn này → dựng lại thẻ nhân vật / bối cảnh / khung xem trước bằng chữ mới (giữ nguyên lựa chọn)
    I18n.onChange(() => { if (this.sm.getCurrent() === 'character-select') this._rerender(); });
  }

  _rerender() {
    this._buildGrid();
    this._buildStageChips();
    this._buildTierChips();
    if (this._selected) this._updatePreview(this._selected);
  }

  _buildGrid() {
    const grid = document.getElementById('character-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const unlockedIds = SaveManager.getUnlockedChars();

    CHARACTERS.forEach(char => {
      const isUnlocked = char.unlocked || unlockedIds.includes(char.id);
      const card = document.createElement('div');
      card.className = `char-card${isUnlocked ? '' : ' locked'}`;
      card.dataset.id = char.id;

      // Stat bars HTML
      const statBars = ['power', 'speed', 'combo'].map(s => `
        <div class="mini-stat">
          <div class="mini-stat-bar-bg">
            <div class="mini-stat-bar-fill" style="width:${char.stats[s] * 20}%; background:${s === 'power' ? '#e74c3c' : s === 'speed' ? '#3498db' : '#2ecc71'}"></div>
          </div>
          <div class="mini-stat-label">${t(s === 'power' ? 'sel.statPowerS' : s === 'speed' ? 'sel.statSpeedS' : 'sel.statComboS')}</div>
        </div>
      `).join('');

      card.innerHTML = `
        ${isUnlocked ? '' : `<div class="lock-badge">🔒 ${char.wpCost} GP</div>`}
        <div class="char-card-emoji">${Assets.iconHTML(char, 'char-card-img')}</div>
        <div class="char-card-name">${I18n.charName(char)}</div>
        <div class="char-card-title">${I18n.charTitle(char)}</div>
        <div class="char-card-stats">${statBars}</div>
      `;

      if (this._selected?.id === char.id && isUnlocked) {      // dựng lại (đổi ngôn ngữ / mở khoá) vẫn giữ nhân vật đang chọn
        card.classList.add('selected');
        card.insertAdjacentHTML('beforeend', `<div class="selected-badge">${t('sel.picked')}</div>`);
      }

      if (isUnlocked) {
        card.addEventListener('click', () => this._selectChar(char, card));
      } else {
        card.addEventListener('click', () => this._tryUnlock(char));
      }

      grid.appendChild(card);
    });
  }

  _selectChar(char, cardEl) {
    this.sound.playClick();
    this._selected = char;

    // Highlight card
    document.querySelectorAll('.char-card').forEach(c => {
      c.classList.remove('selected');
      c.querySelector('.selected-badge')?.remove();
    });
    cardEl.classList.add('selected');
    const badge = document.createElement('div');
    badge.className = 'selected-badge';
    badge.textContent = t('sel.picked');
    cardEl.appendChild(badge);

    // Update preview panel
    this._updatePreview(char);

    // Enable confirm button
    const btn = document.getElementById('btn-confirm-character');
    if (btn) btn.disabled = false;
  }

  // ── Chọn bối cảnh ─────────────────────────────────
  /** Chọn cấp bot (1..5): cấp chưa mở bị khoá; thắng đủ trận ở cấp cao nhất đã mở thì mở cấp kế tiếp. */
  _buildTierChips() {
    const box = document.getElementById('tier-chips');
    if (!box) return;
    const bot = SaveManager.getBot();
    const N = CONFIG.TIERS.COUNT;
    box.innerHTML = '';
    for (let n = 1; n <= N; n++) {
      const locked = n > bot.maxTier;
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `tier-chip${n === bot.tier ? ' selected' : ''}${locked ? ' locked' : ''}`;
      chip.setAttribute('role', 'radio');
      chip.setAttribute('aria-checked', String(n === bot.tier));
      chip.innerHTML = `<b>${locked ? '🔒 ' : ''}${t('tier.chip', { n })}</b><span>${t(`tier.${n}`)}</span>`;
      chip.addEventListener('click', () => {
        this.sound.playClick();
        if (locked) { this._showToast(t('tier.locked', { n, need: CONFIG.TIERS.WINS_TO_UNLOCK, max: bot.maxTier })); return; }
        SaveManager.setBotTier(n);
        this._buildTierChips();
      });
      box.appendChild(chip);
    }
    const hint = document.getElementById('tier-hint');
    if (hint) {
      const mult = CONFIG.WP.TIER_WIN_MULT[bot.tier - 1] ?? 1;
      hint.textContent = bot.maxTier >= N && bot.tier === N ? t('tier.hintMax', { mult })
        : bot.tier < bot.maxTier ? t('tier.hintLower', { max: bot.maxTier, mult })
        : t('tier.hintNext', { w: bot.wins, need: bot.need, next: bot.tier + 1, bonus: CONFIG.WP.TIER_UP_BONUS, mult });
    }
  }

  _buildStageChips() {
    const box = document.getElementById('stage-chips');
    if (!box) return;
    box.innerHTML = '';
    const unlockedIds = SaveManager.getUnlockedStages();
    const chips = [{ id: 'random', name: t('sel.random'), random: true }, ...STAGES];

    chips.forEach(st => {
      const isRandom   = !!st.random;
      const isUnlocked = isRandom || st.unlocked || unlockedIds.includes(st.id);
      const fullUrl = isRandom ? null : Assets.getBackgroundUrl(st.id);
      const thumbUrl = fullUrl ? Assets.getBackgroundThumbUrl(st.id) : null;
      const bgUrl = thumbUrl || fullUrl;
      const thumb = isRandom ? '' : bgUrl
        ? `background-image:url('${bgUrl}')`
        : `background-image:linear-gradient(${st.skyTop}, ${st.skyBot} 65%, ${st.groundTop})`;

      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'stage-chip'
        + (isUnlocked ? '' : ' locked')
        + (this._stageId === st.id ? ' selected' : '');
      chip.dataset.id = st.id;
      chip.innerHTML = `
        <span class="stage-thumb" style="${thumb}">${isRandom ? '🎲' : ''}</span>
        <span class="stage-name">${isRandom ? st.name : I18n.stageName(st)}</span>
        ${isUnlocked ? '' : `<span class="stage-lock">🔒 ${st.wpCost} GP</span>`}
      `;
      if (thumbUrl && fullUrl) {                       // ảnh thu nhỏ lỗi/thiếu (bối cảnh bạn tự thêm) → dùng ảnh gốc
        const probe = new Image();
        probe.onerror = () => { const th = chip.querySelector('.stage-thumb'); if (th) th.style.backgroundImage = `url('${fullUrl}')`; };
        probe.src = thumbUrl;
      }
      chip.addEventListener('click', () =>
        isUnlocked ? this._selectStage(st.id) : this._tryUnlockStage(st));
      box.appendChild(chip);
    });
  }

  _selectStage(id) {
    this.sound.playClick();
    this._stageId = id;
    document.querySelectorAll('.stage-chip').forEach(c =>
      c.classList.toggle('selected', c.dataset.id === id));
  }

  _tryUnlockStage(stage) {
    const wp = SaveManager.getWP();
    if (wp < stage.wpCost) {
      this._showToast(t('sel.needWp', { cost: stage.wpCost, wp }));
      return;
    }
    if (confirm(t('sel.confirmStage', { name: I18n.stageName(stage), cost: stage.wpCost }))) {
      const result = SaveManager.unlockStage(stage.id, stage.wpCost);
      if (result.ok) {
        this.sound.playWin();
        this._stageId = stage.id;
        this._buildStageChips();
        document.getElementById('select-wp-count').textContent =
          SaveManager.getWP().toLocaleString();
        this._showToast(t('sel.unlocked', { name: I18n.stageName(stage) }));
      }
    }
  }

  _tryUnlock(char) {
    const wp = SaveManager.getWP();
    if (wp < char.wpCost) {
      // Show toast: không đủ WP
      this._showToast(t('sel.needWp', { cost: char.wpCost, wp }));
      return;
    }
    if (confirm(t('sel.confirmChar', { name: I18n.charName(char), cost: char.wpCost }))) {
      const result = SaveManager.unlockChar(char.id, char.wpCost);
      if (result.ok) {
        this.sound.playWin();
        this._buildGrid(); // Rebuild grid với unlock mới
        this._showToast(t('sel.unlocked', { name: I18n.charName(char) }));
        document.getElementById('select-wp-count').textContent =
          SaveManager.getWP().toLocaleString();
      }
    }
  }

  _updatePreview(char) {
    // Name & desc
    I18n.setText(document.getElementById('preview-name'), I18n.charName(char));
    I18n.setText(document.getElementById('preview-desc'), I18n.charDesc(char));

    // Stats
    const statsEl = document.getElementById('preview-stats');
    if (statsEl) {
      statsEl.innerHTML = ['power','speed','combo'].map(s => {
        const val = char.stats[s];
        const color = s === 'power' ? '#e74c3c' : s === 'speed' ? '#3498db' : '#2ecc71';
        const label = t(s === 'power' ? 'sel.statPower' : s === 'speed' ? 'sel.statSpeed' : 'sel.statCombo');
        return `
          <div class="stat-row">
            <span class="stat-row-label">${label}</span>
            <div class="stat-row-bar-bg">
              <div class="stat-row-bar-fill" style="width:${val*20}%; background:${color}"></div>
            </div>
            <span class="stat-row-val">${val}</span>
          </div>
        `;
      }).join('');
    }

    // Thông số thật suy ra từ chỉ số
    if (statsEl) {
      const d = CharStats.describe(char);
      const tempo = d.tempoPct > 0 ? t('sel.tempoYes', { n: d.tempoPct }) : t('sel.tempoNo');
      statsEl.insertAdjacentHTML('beforeend', `
        <div class="stat-derived">
          ${t('sel.tempo', { v: tempo })}<br>
          ${t('sel.aiRhythm', { ms: d.cooldownMs })}<br>
          ${t('sel.window', { s: d.windowSec, step: d.step })}
        </div>`);
    }

    // Bark words
    const bwEl = document.getElementById('preview-barkwords');
    if (bwEl) {
      bwEl.innerHTML = char.barkWords.map(w =>
        `<span class="barkword-tag">${w}</span>`
      ).join('');
    }

    // Start preview animation
    this._startPreviewAnim(char);
  }

  _startPreviewAnim(char) {
    if (this._previewAnim) cancelAnimationFrame(this._previewAnim);
    this._previewTime = 0;
    let last = performance.now();

    const loop = (now) => {
      const dt = now - last;
      last = now;
      this._previewTime += dt;

      const ctx = this._previewCtx;
      if (!ctx) return;
      ctx.clearRect(0, 0, 200, 200);

      // Draw dog centered, facing right, idle animation
      DogRenderer.draw(ctx, 100, 130, 80, char, true, 'idle', 1.0, this._previewTime / 1000);

      this._previewAnim = requestAnimationFrame(loop);
    };
    this._previewAnim = requestAnimationFrame(loop);
  }

  _setupListeners() {
    document.getElementById('btn-back-from-select')?.addEventListener('click', () => {
      this.sound.playClick();
      this._cleanup();
      this.sm.show('menu');
    });

    document.getElementById('btn-confirm-character')?.addEventListener('click', () => {
      if (!this._selected) return;
      this.sound.playClick();

      // Pick random AI character (different breed)
      const unlockedIds = SaveManager.getUnlockedChars();
      const available = CHARACTERS.filter(c =>
        (c.unlocked || unlockedIds.includes(c.id)) && c.id !== this._selected.id
      );
      const aiChar = available.length > 0
        ? available[Math.floor(Math.random() * available.length)]
        : CHARACTERS.find(c => c.id !== this._selected.id) || CHARACTERS[0];

      const unlockedStages = SaveManager.getUnlockedStages();
      let stage = this._stageId === 'random' ? null : getStageById(this._stageId);
      if (!stage || !(stage.unlocked || unlockedStages.includes(stage.id))) {
        stage = getRandomStage(unlockedStages);
      }
      const bot = SaveManager.getBot();
      const difficulty = bot.difficulty;

      this._cleanup();
      this.sm.show('battle', {
        playerChar: this._selected,
        aiChar,
        stage,
        difficulty,
        tier: bot.tier,
      });
    });
  }

  _showToast(msg) {
    const el = document.createElement('div');
    el.className = 'toast-msg';            // kiểu dáng trong css/modes.css (tự xuống dòng, không tràn màn hình nhỏ)
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2500);
  }

  _cleanup() {
    if (this._previewAnim) {
      cancelAnimationFrame(this._previewAnim);
      this._previewAnim = null;
    }
  }

  show() {
    this._selected = null;
    // Reset confirm button
    const btn = document.getElementById('btn-confirm-character');
    if (btn) btn.disabled = true;
    // Remove selected state
    document.querySelectorAll('.char-card').forEach(c => {
      c.classList.remove('selected');
      c.querySelector('.selected-badge')?.remove();
    });
    // Clear preview
    if (this._previewCtx) {
      this._previewCtx.clearRect(0, 0, 200, 200);
    }
    I18n.bind(document.getElementById('preview-name'), 'sel.none');
    I18n.setText(document.getElementById('preview-desc'), '---');
    document.getElementById('preview-stats').innerHTML = '';
    document.getElementById('preview-barkwords').innerHTML = '';
    // Update WP
    document.getElementById('select-wp-count').textContent =
      SaveManager.getWP().toLocaleString();
    // Rebuild (phòng trường hợp có unlock mới)
    this._buildGrid();
    this._buildStageChips();
    this._buildTierChips();
  }

  hide() {
    this._cleanup();
  }
}
