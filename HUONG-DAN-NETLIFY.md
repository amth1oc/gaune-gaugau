# Đưa game lên Netlify (Gaune – Gâu Gâu 🐾)

## Cách đưa lên
Kéo-thả **cả thư mục `gau-gau-battle`** (có `index.html` ở gốc) vào Netlify. Phải có đủ các file: `_headers`, `sw.js`, `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, thư mục `icons/`, `assets/`, `js/`, `css/`.

## BẠN CẦN SỬA 1 CHỖ: địa chỉ trang web
Mình đã điền sẵn `https://game-cho-sua.netlify.app/` (lấy từ ảnh chụp của bạn). Nếu bạn đổi tên miền, hãy thay chuỗi đó trong:
`index.html` (canonical, og:url, og:image, twitter:image, JSON-LD), `robots.txt`, `sitemap.xml`.
Sau khi lên mạng: dán link vào Facebook Sharing Debugger / Zalo để kiểm tra ảnh xem trước; gửi `sitemap.xml` cho Google Search Console.

## Khi thêm / đổi ảnh, âm thanh, hoặc file .js
Bấm `cap-nhat-assets.bat` (cần Node.js): cập nhật `assets/files.json` (Netlify không liệt kê được thư mục) và danh sách tải song song `modulepreload` trong `index.html`.
- Thay ảnh/âm thanh **cùng tên**: người chơi cũ sẽ thấy bản mới ở lần mở sau (service worker tự kiểm tra ở nền).
- Sửa code JS/CSS: không cần làm gì thêm, lần mở sau sẽ lấy bản mới.
- Muốn ép mọi máy bỏ bộ nhớ cũ: đổi `VERSION` ở đầu `sw.js`.

## Bảo mật (`_headers`)
Có `Content-Security-Policy` chỉ cho chạy mã của chính trang + Google Fonts + PeerJS (đấu online). Nếu bạn dùng máy chủ PeerJS/TURN riêng (`net-config.js` → `PEER_SERVER`), thêm tên máy chủ đó vào `connect-src` trong `_headers`, nếu không đấu online sẽ bị chặn.
`frame-ancestors 'self'`: trang không nhúng được vào iframe của web khác. Muốn nhúng (itch.io, Facebook...) thì sửa dòng đó.

## Online: TURN Metered + giấu IP (KHÔNG để khoá trong code)
File JS của game công khai, nên **không** ghi user/password TURN vào đó nữa. Game xin thông tin TẠM THỜI (sống 3 giờ) từ hàm máy chủ `/api/turn` (`netlify/functions/turn.mjs`); khoá bí mật chỉ nằm ở biến môi trường của Netlify.

**Làm một lần:**
1. Metered → **Developers**: lấy *tên app* (phần trước `.metered.live`) và **Secret Key**.
2. Netlify → Site configuration → **Environment variables**, thêm: `METERED_APP` = tên app, `METERED_SECRET_KEY` = Secret Key. (Tuỳ chọn: `ALLOWED_ORIGINS` = tên miền khác được gọi, cách nhau dấu phẩy.)
3. **Xoá credential cũ** trong Metered → TURN Server (cái từng nằm trong `net-config.js` đã lộ, coi như hỏng) và nếu muốn thì tạo lại Secret Key.
4. Triển khai bằng **Git** (nối repo) hoặc **Netlify CLI** (`npx netlify deploy --prod` trong thư mục này). **Kéo-thả thư mục trên web thường KHÔNG chạy được Functions**: game vẫn chơi được nhưng sẽ dùng TURN công cộng dự phòng (hay chậm/đầy).

Kiểm tra: mở `https://<site>/api/turn` → thấy JSON có `iceServers`; trong game → Online → "Kiểm tra lại" phải thấy "✔ Giấu IP đang bật và TURN hoạt động".

Lưu ý thật thà: trình duyệt cần user/password TURN để kết nối nên không thể giấu hoàn toàn với người biết mở công cụ nhà phát triển. Cách này chỉ biến nó thành thứ **hết hạn sau 3 giờ**, còn khoá thật (Secret Key) không bao giờ rời máy chủ. Nên đặt cảnh báo/giới hạn dung lượng trong Metered.

**Chế độ riêng tư (giấu IP)**: mặc định BẬT (`HIDE_IP_DEFAULT`), người chơi đổi ở Cài đặt → Riêng tư hoặc ngay ở sảnh. Mỗi người chỉ giấu IP của chính mình: muốn hai bên giấu nhau thì cả hai cùng bật. Khi bật, game KHÔNG BAO GIỜ tự quay về STUN/kết nối thẳng.

## Bản quyền âm thanh
Xem `CREDITS.md`. Phần ghi công đã có trong game: Cài đặt → Ghi công.
