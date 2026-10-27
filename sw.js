/* sw.js — Service worker: vào lại game nhanh + chơi được khi mất mạng (trừ chế độ online).
 *  • Ảnh/âm thanh trong /assets/ (và icons): trả ngay bản đã lưu (tức thì, cả khi mất mạng) và kiểm tra bản mới ở nền
 *    → bạn thay ảnh cùng tên thì lần mở sau là thấy, không cần đổi tên file.
 *  • Mã game (html/js/css/json): ưu tiên bản MỚI từ mạng (chờ tối đa 3,5 giây), mạng lỗi mới dùng bản đã lưu
 *    → không bao giờ trộn lẫn file cũ/mới khi bạn vừa cập nhật game.
 *  • Không đụng tới yêu cầu khác nguồn (font Google, PeerJS...) và không lưu phản hồi lỗi.
 * Muốn buộc mọi máy bỏ bộ nhớ cũ: đổi VERSION bên dưới.
 */
const VERSION = 'v35-2026-10-27';
const STATIC = `chosua-static-${VERSION}`;
const CODE = `chosua-code-${VERSION}`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (![STATIC, CODE].includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const isStatic = (u) => /\/(assets|icons)\//.test(u.pathname) && !/\/assets\/(files|manifest)\.json$/.test(u.pathname);

async function staleWhileRevalidate(e, req) {
  const c = await caches.open(STATIC);
  const hit = await c.match(req, { ignoreVary: true });
  const update = fetch(req, { cache: 'no-cache' }).then((res) => {            // hỏi máy chủ có bản mới không (thường chỉ 304, rất nhẹ)
    if (res.ok && res.status === 200) c.put(req, res.clone());
    return res;
  });
  if (hit) { e.waitUntil(update.catch(() => {})); return hit; }
  return update;
}

async function networkFirst(req) {
  const c = await caches.open(CODE);
  try {
    const res = await Promise.race([
      fetch(req),
      new Promise((_, rej) => setTimeout(() => rej(new Error('slow')), 3500)),
    ]);
    if (res.ok && res.status === 200) c.put(req, res.clone());
    return res;
  } catch {
    const hit = await c.match(req, { ignoreSearch: false }) || await c.match(req, { ignoreSearch: true });
    if (hit) return hit;
    return fetch(req);                         // chưa có bản lưu: đợi mạng thật
  }
}

// Trang gửi danh sách file vừa tải xong → lưu luôn (nhờ vậy vào lần ĐẦU là lần sau chơi offline được, không cần mở lần thứ hai)
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'precache' || !Array.isArray(e.data.urls)) return;
  e.waitUntil((async () => {
    for (const href of e.data.urls.slice(0, 300)) {
      try {
        const u = new URL(href, self.location.href);
        if (u.origin !== self.location.origin || u.pathname === '/sw.js') continue;
        const cache = await caches.open(isStatic(u) ? STATIC : CODE);
        if (await cache.match(u.href)) continue;
        const res = await fetch(u.href, { cache: 'force-cache' });          // thường lấy thẳng từ bộ nhớ đệm trình duyệt, không tốn mạng
        if (res.ok && res.status === 200) await cache.put(u.href, res);
      } catch { /* bỏ qua file lỗi */ }
    }
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || req.headers.has('range')) return;
  const u = new URL(req.url);
  if (u.origin !== self.location.origin || u.pathname === '/sw.js') return;
  if (u.pathname.startsWith('/.netlify/') || u.pathname.startsWith('/api/')) return;        // hàm máy chủ (thông tin TURN tạm thời): KHÔNG lưu vào bộ nhớ đệm
  e.respondWith(isStatic(u) ? staleWhileRevalidate(e, req) : networkFirst(req));
});
