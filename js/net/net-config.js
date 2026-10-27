/**
 * net-config.js — Cấu hình mạng cho phòng online 2 người.
 *
 * Lưu ý: file này công khai (ai mở web cũng đọc được), nên chỉ dùng tài khoản Metered MIỄN PHÍ, đừng dùng gói trả tiền.
 *
 * PEER_SERVER: máy chủ ghép phòng. null = máy chủ công cộng của PeerJS (miễn phí, thỉnh thoảng chậm/đầy).
 */
/** Phiên bản giao thức mạng: ĐỔI SỐ NÀY mỗi khi sửa định dạng tin nhắn online. Hai máy khác số sẽ báo lỗi thay vì chơi lệch. */
export const PROTOCOL_VERSION = 3;

export const NET_CONFIG = {
  /**
   * TURN riêng: KHÔNG để user/password trong file này nữa (file công khai, ai cũng đọc được).
   * Game tự xin thông tin TẠM THỜI (sống 3 giờ) từ hàm máy chủ /api/turn (netlify/functions/turn.mjs); khoá bí mật nằm ở biến môi trường Netlify.
   * Hai ô dưới chỉ là phương án CUỐI cho ai không dùng được hàm máy chủ — để trống là an toàn nhất.
   */
  TURN_ENDPOINT: '/api/turn',
  METERED_USER: '',
  METERED_PASS: '',

  /** Chế độ riêng tư (giấu IP) mặc định cho người chưa chọn. Người chơi đổi được ở Cài đặt → Riêng tư. */
  HIDE_IP_DEFAULT: true,

  PEER_SERVER: null,      // ví dụ: { host: 'peer.example.com', port: 443, path: '/', secure: true }

  /** Không nhận được tin nào của đối thủ quá chừng này (ms) → coi như đứt mạng. */
  DEAD_AFTER_MS: 7000,
  /** Ở sảnh (chưa vào trận) khoan dung hơn: người chơi hay chuyển app (copy mã, đổi quyền mic) vài chục giây. */
  LOBBY_DEAD_AFTER_MS: 12000,
  /** Chu kỳ gửi ping (ms). Ping cũng đóng vai trò "giữ nhịp" để phát hiện đứt mạng nhanh. */
  PING_EVERY_MS: 1500,
};

// ── Chế độ riêng tư (giấu IP) ───────────────────────────
const LS_HIDE_IP = 'gaune_hide_ip';

/** Đang bật giấu IP? (lưu theo từng máy; chưa chọn thì theo HIDE_IP_DEFAULT) */
export function isHideIp() {
  try { const v = localStorage.getItem(LS_HIDE_IP); if (v === '1') return true; if (v === '0') return false; } catch {}
  return !!NET_CONFIG.HIDE_IP_DEFAULT;
}
export function setHideIp(on) {
  try { localStorage.setItem(LS_HIDE_IP, on ? '1' : '0'); } catch {}
  try { window.dispatchEvent(new Event('gaune-hideip')); } catch {}     // để Cài đặt và Sảnh cập nhật công tắc cho khớp nhau
}

/**
 * TURN công cộng dự phòng (chỉ dùng khi hàm máy chủ không trả được thông tin riêng).
 * Đây là tài khoản công khai ai cũng dùng — KHÔNG phải bí mật. Hay quá tải nên không đảm bảo.
 */
export const FALLBACK_ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  { urls: 'turn:openrelay.metered.ca:80',                 username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443',                username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:443?transport=tcp',  username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turn:openrelay.metered.ca:80?transport=tcp',   username: 'openrelayproject', credential: 'openrelayproject' },
  { urls: 'turns:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },   // TLS 443: qua được cả mạng 4G/Wi-Fi công ty chặn UDP
];
