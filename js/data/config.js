/**
 * config.js — Tất cả hằng số và cấu hình game
 * Thay đổi ở đây sẽ ảnh hưởng toàn bộ game.
 */

export const CONFIG = {
  // ──────────────────────────────────────────
  // MIC / AUDIO INPUT
  // ──────────────────────────────────────────
  MIC: {
    /** RMS vượt ngưỡng này → bắt đầu tính là đang sủa */
    THRESHOLD: 0.05,
    /** RMS tụt xuống dưới ngưỡng này → kết thúc 1 lần sủa */
    RELEASE: 0.018,
    /**
     * Khoảng nghỉ chống nhiễu (ms) sau mỗi tiếng sủa bằng MIC — chung cho mọi chó.
     * Cố ý rất ngắn: người sủa 1 tiếng thì chó sủa đúng 1 tiếng, không bị chỉ số speed chặn.
     * (Chỉ số speed chỉ còn áp cho nút chạm, AI và thưởng nhịp nhanh — xem STATS.)
     */
    COOLDOWN_MS: 60,
    /** Bark được tính NGAY khi vượt ngưỡng; chờ chừng này ms để đo đỉnh âm lượng rồi mới bắn */
    ONSET_PEAK_MS: 20,
    /** Sau khi bắn, tiếp tục theo dõi đỉnh chừng này ms; nếu to hơn rõ rệt thì cộng bù lực (đỉnh thật của tiếng sủa) */
    TOPUP_MS: 70,
    /** Đỉnh phải vượt đỉnh lúc bắn bao nhiêu lần mới tính bù */
    TOPUP_RATIO: 1.2,
    /** Thời gian cửa sổ (ms) để tính combo liên tiếp */
    COMBO_WINDOW_MS: 2200,
    /** Nhân hệ số tối đa của combo */
    COMBO_MAX_MULT: 2.0,
    /** Hệ số tăng mỗi bark trong combo (0.25 = +25% mỗi bark) */
    COMBO_STEP: 0.25,
    /** FFT size cho AnalyserNode */
    FFT_SIZE: 256,
    /** Sample rate mong muốn */
    SAMPLE_RATE: 44100,
  },

  // ──────────────────────────────────────────
  // CHỈ SỐ NHÂN VẬT (1–5) → thông số chơi thật (xem js/game/CharStats.js)
  // Chỉ số 3 = giá trị mặc định cũ (cooldown 350ms, combo 2.2s, bậc ×0.25)
  // ──────────────────────────────────────────
  STATS: {
    /** speed 1 → nghỉ lâu, speed 5 → nghỉ ngắn (ms giữa 2 tiếng sủa) — CHỈ áp cho nút chạm + AI */
    COOLDOWN_SLOW_MS: 400,
    COOLDOWN_FAST_MS: 300,
    /** combo 1 → giữ combo ngắn, combo 5 → giữ lâu (ms) */
    COMBO_WINDOW_LOW_MS: 2000,
    COMBO_WINDOW_HIGH_MS: 2500,
    /** combo 1 → mỗi bậc cộng ít, combo 5 → cộng nhiều */
    COMBO_STEP_LOW: 0.20,
    COMBO_STEP_HIGH: 0.20,
    /** power: mỗi bậc chênh so với 3 đổi lực ±15% (power 1 = ×0.70 … power 5 = ×1.30) */
    POWER_STEP: 0.05,
    /**
     * THƯỞNG NHỊP NHANH (thay cho việc speed chặn tiếng sủa bằng mic):
     * hai tiếng sủa cách nhau ≤ TEMPO_FULL_MS → thưởng đầy đủ, giảm dần về 0 tại TEMPO_WINDOW_MS.
     * Thưởng tối đa = TEMPO_MAX × (speed-1)/4  → speed 1: +0%, speed 3: +10%, speed 5: +20% lực.
     */
    TEMPO_WINDOW_MS: 600,
    TEMPO_FULL_MS: 300,
    TEMPO_MAX: 0.08,
    /** Special 'volumeBoost' (Chow): nhân volume khi tính lực */
    VOLUME_BOOST_MULT: 1.05,
    /** Special 'heavyHitter' (Pug): nhân lực khi combo chưa cao */
    HEAVY_HITTER_MULT: 1.08,
    /** Special 'fastCombo' (Corgi): nhân cửa sổ combo */
    FAST_COMBO_WINDOW_MULT: 1.25,
  },

  // ──────────────────────────────────────────
  // TAP MODE (nút chạm để sủa khi không có mic)
  // ──────────────────────────────────────────
  TAP: {
    /**
     * Mỗi lần bấm = 1 tiếng sủa NGAY (không còn bị cooldown của chó chặn như trước).
     * MIN_GAP_MS chỉ để chống 1 lần bấm bị nhận đôi (chuột + cảm ứng).
     */
    MIN_GAP_MS: 70,
    /**
     * Cân bằng với mic: người sủa thật được ~4 tiếng/giây nhưng ngón tay bấm được 8+ lần/giây.
     * Bấm cách nhau ≥ FULL_MS → đủ lực; bấm dồn hơn thì mỗi lần yếu dần (tối thiểu MIN_FACTOR),
     * nên bấm nhanh vẫn thấy chó sủa theo từng lần bấm mà không "cheat" áp đảo mic.
     */
    FULL_MS: 280,
    MIN_FACTOR: 0.35,
    /** Âm lượng giả lập mỗi lần chạm (tương đương tiếng sủa vừa) */
    VOL_MIN: 0.12,
    VOL_MAX: 0.30,
  },

  // ──────────────────────────────────────────
  // GAUGE (Thanh kéo co)
  // ──────────────────────────────────────────
  GAUGE: {
    /** Giá trị khởi đầu (50 = chính giữa) */
    START: 50,
    MIN: 0,
    MAX: 100,
    /**
     * volume × PUSH_BASE = lực đẩy gốc mỗi lần sủa.
     * Điều chỉnh để cân bằng game.
     */
    PUSH_BASE: 9,
    /** Lực thêm mỗi bark count trong combo */
    BARK_COUNT_BONUS: 1.0,
    /** Combo tối đa được tính vào bonus (chống cuốn tuyết: sủa nhỏ vẫn thắng nhanh) */
    BARK_BONUS_CAP: 5,
    /** Gauge từ từ trở về giữa khi không có ai sủa (units/sec) */
    DECAY_TO_CENTER: 0.4,
    /** Tốc độ lerp animation của indicator UI */
    INDICATOR_LERP: 0.12,
  },

  // ──────────────────────────────────────────
  // BATTLE
  // ──────────────────────────────────────────
  BATTLE: {
    /** Thời gian mỗi hiệp (giây) */
    ROUND_TIME: 30,
    /** Pause (ms) sau KO trước khi chuyển sang màn kết quả */
    KO_PAUSE_MS: 2200,
    /** Số lần đếm ngược trước trận */
    COUNTDOWN_FROM: 3,
  },

  // ──────────────────────────────────────────
  // AI OPPONENT
  // ──────────────────────────────────────────
  AI: {
    // ── Nhịp sủa theo ĐỢT (độ khó t = 0 → 1 ứng với difficulty 1 → 5; số ms nhân thêm với chỉ số speed của nhân vật bot) ──
    /** Nhịp giữa 2 tiếng trong một đợt: độ khó 1 → INTRA_SLOW, độ khó 5 → INTRA_FAST (ms) */
    INTRA_SLOW_MS: 480,
    INTRA_FAST_MS: 270,
    /** Nghỉ giữa 2 đợt: độ khó 1 → GAP_SLOW, độ khó 5 → GAP_FAST (ms) */
    GAP_SLOW_MS: 1250,
    GAP_FAST_MS: 600,
    /** Số tiếng mỗi đợt (ngẫu nhiên trong [MIN, MAX]); LOW = độ khó 1, HIGH = độ khó 5 */
    BURST_MIN_LOW: 1, BURST_MIN_HIGH: 3,
    BURST_MAX_LOW: 2, BURST_MAX_HIGH: 6,
    /** Cửa sổ giữ combo của bot = cửa sổ nhân vật × (FRAC_MIN … 1) theo độ khó (độ khó thấp: combo dễ đứt) */
    COMBO_WINDOW_FRAC_MIN: 0.45,
    // ── Âm lượng ──
    VOL_MEAN_LOW: 0.20, VOL_MEAN_HIGH: 0.34,
    VOL_SPREAD: 0.07,
    BASE_VOLUME_MIN: 0.08,
    BASE_VOLUME_MAX: 0.80,
    /** Xác suất một tiếng "rất to" (×1.45); nhân với (0.4 + độ khó chuẩn hoá) */
    BIG_BARK_CHANCE: 0.12,
    // ── Đuổi theo khi đang bị dẫn trước (tăng dần từ độ khó 1 → đủ ở 4) ──
    CHASE_STRENGTH: 1.0,
    /** gauge lệch về phía người chơi bao nhiêu thì bot dồn hết cỡ */
    CHASE_FULL_AT: 25,
    /** Mỗi trận thắng, difficulty tăng thêm lượng này (SaveManager dùng bản riêng, giữ để tham khảo) */
    DIFFICULTY_INCREMENT: 0.15,
    DIFFICULTY_MAX: 5.0,
  },

  // ──────────────────────────────────────────
  // EFFECTS
  // ──────────────────────────────────────────
  EFFECTS: {
    /** Cường độ rung màn hình tối đa (px) */
    SHAKE_INTENSITY_MAX: 18,
    SHAKE_DURATION_MS: 380,
    FLASH_DURATION_MS: 280,
    /** Scale chó phóng to tối đa khi sủa lớn */
    DOG_SCALE_MAX: 1.22,
    DOG_SCALE_BARK_DURATION: 250,
    /** Kích thước chó theo gauge (video gốc): bên thắng thế phình to, bên thua teo nhỏ */
    DOM_GROW: 0.75,     // thắng thế tuyệt đối → to thêm 75%
    DOM_SHRINK: 0.50,   // thua tuyệt đối → nhỏ còn 50%
    /** Màn hình ngả đỏ/cam khi bạn thắng thế (0..1 = độ đậm tối đa), xanh xám khi bị lép vế */
    TINT_WARM_MAX: 0.65,
    TINT_COOL_MAX: 0.4,
    /** Chữ sủa: số chữ mỗi tiếng = BASE + volume × PER_VOL (tối đa MAX_ALIVE chữ cùng lúc) */
    BARK_TEXT_BASE: 7,
    BARK_TEXT_PER_VOL: 16,
    BARK_TEXT_MAX_ALIVE: 80,
    /** Số lượng particle mỗi lần sủa */
    PARTICLES_PER_BARK: 14,
    BARK_TEXT_COUNT_MAX: 5,
  },

  // ──────────────────────────────────────────
  // WP (WIN POINTS)
  // ──────────────────────────────────────────
  WP: {
    WIN_KO: 150,
    WIN_TIMEOUT: 75,
    LOSS_KO: 20,
    LOSS_TIMEOUT: 35,
    /** Hệ số WP khi THẮNG bot theo cấp bot 1..5 (đấu bot khó hơn → thưởng nhiều hơn; online không áp dụng) */
    TIER_WIN_MULT: [1, 1.2, 1.4, 1.7, 2.0],
    /** WP thưởng một lần khi mở khoá cấp bot mới */
    TIER_UP_BONUS: 200,
  },

  // ──────────────────────────────────────────
  // CẤP BOT (thăng cấp để đấu bot khó hơn)
  // ──────────────────────────────────────────
  TIERS: {
    COUNT: 5,
    /** Số trận thắng ở cấp cao nhất đã mở để mở cấp kế tiếp */
    WINS_TO_UNLOCK: 3,
    /** Trong một cấp, độ khó nhích thêm sau mỗi trận thắng (tối đa INNER_MAX) / giảm nhẹ khi thua */
    INNER_UP: 0.15, INNER_DOWN: 0.05, INNER_MAX: 0.9,
  },

  // ──────────────────────────────────────────
  // RENDERING
  // ──────────────────────────────────────────
  RENDER: {
    /** Vị trí X % của chó player */
    PLAYER_X_PCT: 0.22,
    /** Vị trí X % của chó AI */
    AI_X_PCT: 0.78,
    /** Vị trí Y % của chân chó */
    DOG_Y_PCT: 0.68,
    /** Kích thước cơ bản chó (relative to canvas height) */
    DOG_SIZE_PCT: 0.18,
  },
};
