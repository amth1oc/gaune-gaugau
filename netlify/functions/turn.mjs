/**
 * /api/turn — cấp thông tin TURN TẠM THỜI cho trình duyệt (Netlify Function).
 *
 * Vì sao cần: file JS của game là công khai, để user/password TURN trong đó thì ai cũng lấy được và dùng hết hạn mức của bạn.
 * Cách này: khoá bí mật (METERED_SECRET_KEY) chỉ nằm trong biến môi trường của Netlify; trình duyệt chỉ nhận một user/password
 * SỐNG 3 GIỜ (Metered tự xoá khi hết hạn). Lộ ra thì chỉ dùng được vài giờ.
 *
 * Biến môi trường (Netlify → Site configuration → Environment variables):
 *   METERED_APP         tên app Metered, ví dụ "gaune"  (địa chỉ gaune.metered.live)
 *   METERED_SECRET_KEY  Secret Key (Metered → Developers). TUYỆT ĐỐI không đưa vào code/JS phía trình duyệt.
 *   ALLOWED_ORIGINS     (tuỳ chọn) danh sách tên miền được gọi, cách nhau bằng dấu phẩy. Mặc định: chính site này.
 */
const TTL_SEC = 3 * 3600;          // credential sống 3 giờ
const REUSE_MS = 30 * 60 * 1000;   // dùng lại cùng một credential tối đa 30 phút trong một instance (đỡ tạo quá nhiều, đỡ bị rút hạn mức)

let cached = null;                 // { at, user, pass }

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra },
});

function originAllowed(req) {
  const origin = req.headers.get('origin') || req.headers.get('referer') || '';
  if (!origin) return true;        // trình duyệt gọi cùng nguồn (same-origin GET) thường không gửi Origin
  let host = '';
  try { host = new URL(origin).host; } catch { return false; }
  const self = new URL(req.url).host;
  const extra = (process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  return host === self || host === 'localhost:8888' || extra.includes(host);
}

async function createCredential(app, secret) {
  const r = await fetch(`https://${app}.metered.live/api/v1/turn/credential?secretKey=${encodeURIComponent(secret)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiryInSeconds: TTL_SEC, label: 'gaune-web' }),
  });
  if (!r.ok) throw new Error('metered ' + r.status);
  const j = await r.json();
  if (!j.username || !j.password) throw new Error('metered bad body');
  return { at: Date.now(), user: j.username, pass: j.password };
}

export default async (req) => {
  if (req.method !== 'GET') return json({ error: 'method' }, 405);
  if (!originAllowed(req)) return json({ error: 'origin' }, 403);

  const app = process.env.METERED_APP, secret = process.env.METERED_SECRET_KEY;
  if (!app || !secret) return json({ error: 'not-configured' }, 503);

  try {
    if (!cached || Date.now() - cached.at > REUSE_MS) cached = await createCredential(app, secret);
  } catch (e) {
    return json({ error: 'upstream' }, 502);
  }
  const { user, pass } = cached;
  const host = 'global.relay.metered.ca';
  const left = Math.max(60, TTL_SEC - Math.floor((Date.now() - cached.at) / 1000));   // thời gian còn sống thật của credential này
  return json({
    ttl: left,
    iceServers: [
      { urls: 'stun:stun.relay.metered.ca:80' },
      { urls: `turn:${host}:80`, username: user, credential: pass },
      { urls: `turn:${host}:80?transport=tcp`, username: user, credential: pass },
      { urls: `turn:${host}:443`, username: user, credential: pass },
      { urls: `turns:${host}:443?transport=tcp`, username: user, credential: pass },
    ],
  });
};

export const config = { path: '/api/turn' };
