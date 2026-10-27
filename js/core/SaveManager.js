/**
 * SaveManager.js — Quản lý lưu/tải dữ liệu game qua localStorage
 *
 * Schema mặc định:
 * {
 *   wp: number,
 *   unlockedChars: string[],
 *   unlockedStages: string[],
 *   totalWins: number,
 *   totalLosses: number,
 *   winStreak: number,
 *   difficulty: number,
 *   matchHistory: MatchResult[],
 *   settings: { thresholdLevel, sfxVolume, muted },
 * }
 */

import { CONFIG } from '../data/config.js';

const SAVE_KEY = 'cho-sua-fighter-v1';

const DEFAULT_SAVE = {
  wp: 0,
  unlockedChars: ['shiba'],
  unlockedStages: ['street'],
  totalWins: 0,
  totalLosses: 0,
  winStreak: 0,
  difficulty: 1.0,
  botTier: 1,          // cấp bot đang chọn (1..5)
  botMaxTier: 1,       // cấp cao nhất đã mở khoá
  botTierWins: 0,      // số trận thắng ở cấp cao nhất đã mở (tiến độ mở cấp kế tiếp)
  botInner: 0,         // độ khó nhích thêm trong cấp đang chọn (0..0.9)
  matchHistory: [],
  settings: {
    thresholdLevel: 5,
    sfxVolume: 7,
    musicVolume: 6,
    muted: false,
  },
};

function load() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return { ...DEFAULT_SAVE };
    const p = JSON.parse(raw);
    if (!p || typeof p !== 'object' || Array.isArray(p)) return { ...DEFAULT_SAVE };
    const out = { ...DEFAULT_SAVE, ...p, settings: { ...DEFAULT_SAVE.settings, ...(p.settings && typeof p.settings === 'object' ? p.settings : {}) } };
    if (!Number.isFinite(out.wp)) out.wp = DEFAULT_SAVE.wp;       // file lưu bị sửa/hỏng → về mặc định, không NaN
    return normalizeTier(out, p);
  } catch {
    return { ...DEFAULT_SAVE };
  }
}

const TIER_COUNT = CONFIG.TIERS.COUNT;
/** Đưa dữ liệu cấp bot về dạng hợp lệ; bản lưu cũ (chỉ có `difficulty` 1–5) tự đổi sang cấp: 2.8 → cấp 2 + 0.8. */
function normalizeTier(o, raw) {
  const clampI = (v, a, b) => Math.max(a, Math.min(b, Math.floor(Number.isFinite(v) ? v : a)));
  if (!raw || raw.botMaxTier == null) {
    const d = Math.max(1, Math.min(5, Number(o.difficulty) || 1));
    const tier = Math.min(TIER_COUNT, Math.floor(d));
    o.botMaxTier = tier; o.botTier = tier; o.botTierWins = 0;
    o.botInner = tier >= TIER_COUNT ? 0 : Math.min(0.9, d - tier);
  }
  o.botMaxTier = clampI(o.botMaxTier, 1, TIER_COUNT);
  o.botTier = clampI(o.botTier, 1, o.botMaxTier);
  o.botTierWins = clampI(o.botTierWins, 0, 99);
  o.botInner = o.botTier >= TIER_COUNT ? 0 : Math.max(0, Math.min(0.9, Number(o.botInner) || 0));
  o.unlockedChars = [...(o.unlockedChars || [])]; o.unlockedStages = [...(o.unlockedStages || [])];   // không dùng chung mảng với DEFAULT_SAVE
  return o;
}

function save(data) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[SaveManager] Không thể lưu:', e);
  }
}

export const SaveManager = {
  // ── WP ──────────────────────────────
  getWP() {
    return load().wp;
  },

  addWP(amount) {
    const data = load();
    data.wp = Math.max(0, (data.wp || 0) + amount);
    save(data);
    return data.wp;
  },

  spendWP(amount) {
    const data = load();
    if (data.wp < amount) return false;
    data.wp -= amount;
    save(data);
    return true;
  },

  // ── UNLOCK ──────────────────────────
  getUnlockedChars() {
    return load().unlockedChars || ['shiba'];
  },

  getUnlockedStages() {
    return load().unlockedStages || ['street'];
  },

  unlockChar(charId, cost) {
    const data = load();
    if (data.wp < cost) return { ok: false, reason: 'Không đủ WP' };
    if (data.unlockedChars.includes(charId)) return { ok: true };
    data.wp -= cost;
    data.unlockedChars.push(charId);
    save(data);
    return { ok: true };
  },

  unlockStage(stageId, cost) {
    const data = load();
    if (data.wp < cost) return { ok: false, reason: 'Không đủ WP' };
    if (data.unlockedStages.includes(stageId)) return { ok: true };
    data.wp -= cost;
    data.unlockedStages.push(stageId);
    save(data);
    return { ok: true };
  },

  isCharUnlocked(charId) {
    return load().unlockedChars.includes(charId);
  },

  // ── MATCH HISTORY & STATS ───────────
  addMatchResult({ winner, reason, barkCount, maxCombo, wpGained, charId, aiCharId, online = false }) {
    const data = load();
    const tierAtStart = data.botTier;
    const isWin = winner === 'player';

    let tierUp = null;
    const TC = { WINS: CONFIG.TIERS.WINS_TO_UNLOCK, UP: CONFIG.TIERS.INNER_UP, DOWN: CONFIG.TIERS.INNER_DOWN, MAX: CONFIG.TIERS.INNER_MAX };
    if (isWin) {
      data.totalWins = (data.totalWins || 0) + 1;
      data.winStreak = (data.winStreak || 0) + 1;
      if (!online) {
        data.botInner = data.botTier >= TIER_COUNT ? 0 : Math.min(TC.MAX, (data.botInner || 0) + TC.UP);
        // Chỉ thắng ở cấp CAO NHẤT đã mở mới tính tiến độ mở cấp tiếp theo (đánh lại cấp thấp để luyện tay, không "cày" mở khoá)
        if (data.botTier === data.botMaxTier && data.botMaxTier < TIER_COUNT) {
          data.botTierWins = (data.botTierWins || 0) + 1;
          if (data.botTierWins >= TC.WINS) {
            const from = data.botMaxTier;
            data.botMaxTier = from + 1; data.botTier = data.botMaxTier; data.botTierWins = 0; data.botInner = 0;
            tierUp = { from, to: data.botMaxTier };
          }
        }
      }
    } else {
      data.totalLosses = (data.totalLosses || 0) + 1;
      data.winStreak = 0;
      if (!online) data.botInner = Math.max(0, (data.botInner || 0) - TC.DOWN);     // thua thì hạ nhẹ để không nản
    }
    data.difficulty = Math.min(5, data.botTier + (data.botInner || 0));              // giữ trường cũ cho tương thích

    // Giữ tối đa 50 trận gần nhất
    const record = {
      date: Date.now(),
      winner,
      reason,
      barkCount,
      maxCombo,
      wpGained,
      charId,
      aiCharId,
      online,
      tier: online ? 0 : tierAtStart,
    };
    data.matchHistory = [record, ...(data.matchHistory || [])].slice(0, 50);

    save(data);
    return { tierUp };
  },

  getMatchHistory() {
    return load().matchHistory || [];
  },

  getStats() {
    const d = load();
    return {
      totalWins: d.totalWins || 0,
      totalLosses: d.totalLosses || 0,
      winStreak: d.winStreak || 0,
      wp: d.wp || 0,
      difficulty: d.difficulty || 1.0,
    };
  },

  getDifficulty() {
    const d = load();
    return Math.min(5, d.botTier + (d.botInner || 0));
  },

  // ── CẤP BOT ─────────────────────────
  /** @returns {{tier:number, maxTier:number, wins:number, need:number, difficulty:number}} */
  getBot() {
    const d = load();
    return { tier: d.botTier, maxTier: d.botMaxTier, wins: d.botTierWins, need: CONFIG.TIERS.WINS_TO_UNLOCK, difficulty: Math.min(5, d.botTier + (d.botInner || 0)) };
  },
  /** Chọn cấp bot để đấu (chỉ cấp đã mở khoá). Đổi cấp thì độ khó trong cấp quay về đầu cấp. */
  setBotTier(tier) {
    const d = load();
    tier = Math.floor(tier);
    if (!(tier >= 1 && tier <= d.botMaxTier)) return false;
    if (tier !== d.botTier) { d.botTier = tier; d.botInner = 0; d.difficulty = tier; save(d); }
    return true;
  },

  // ── SETTINGS ────────────────────────
  getSettings() {
    return load().settings || DEFAULT_SAVE.settings;
  },

  saveSettings(settings) {
    const data = load();
    data.settings = { ...DEFAULT_SAVE.settings, ...settings };
    save(data);
  },

  // ── ONBOARDING ───────────────────────
  /** Đã qua (hoặc bỏ qua) màn chào người mới? Người đã từng đánh trận thì coi như đã biết chơi. */
  isOnboarded() {
    try { if (localStorage.getItem('chosua_onboarded')) return true; } catch { return true; }
    return (load().matchHistory || []).length > 0;
  },
  setOnboarded() { try { localStorage.setItem('chosua_onboarded', '1'); } catch {} },

  // ── RESET ────────────────────────────
  reset() {
    try { localStorage.removeItem('chosua_onboarded'); localStorage.removeItem('chosua_mic_ref'); } catch {}
    localStorage.removeItem(SAVE_KEY);
  },
};
