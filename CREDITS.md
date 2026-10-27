# Ghi công & giấy phép


## Hình ảnh (nhân vật, bối cảnh, ảnh chia sẻ)
- Tạo bằng **ChatGPT (OpenAI)** từ mô tả độc lập, không dùng ảnh hay tên nhân vật của game khác làm tham chiếu.
- Theo điều khoản OpenAI, người dùng được dùng ảnh tạo ra, kể cả thương mại. Bản quyền cho ảnh do AI tạo còn chưa rõ ràng ở nhiều nước.
- **Hồ sơ lưu chứng cứ (bạn tự điền và giữ lại):** ngày tạo: [..] · gói tài khoản lúc tạo: [..] · nơi lưu prompt/ảnh chụp hội thoại: [..]
- Các file: `assets/characters/*`, `assets/backgrounds/*`, `assets/theme/*`, `icons/og-gaune-v3.jpg`.


## Nhạc nền (menu và trong trận)
- **"A Pirates Adventures"** — Emmraan, Pixabay: https://pixabay.com/vi/music/cu%E1%BB%99c-phi%C3%AAu-l%C6%B0u-a-pirates-adventures-254111/
- Giấy phép: Pixabay Content License (https://pixabay.com/service/license-summary/). Được dùng miễn phí, **không bắt buộc ghi công**, được chỉnh sửa. Không được bán/phân phối lại bài nhạc ở dạng nguyên bản (standalone) — game này đã cắt vòng lặp, chỉnh tốc độ và ghép vào game nên là tác phẩm mới.
- File trong game: `assets/audio/music-menu.mp3` (cả bài, lặp liền mạch) và `music-battle.mp3` (đoạn dồn dập nhất, tăng tốc 15%).

## Tiếng chó sủa
- Nguồn: **TiengDong.com** — https://tiengdong.com/tieng-cho-sua
- Trang này cho tải miễn phí và **đề nghị** ghi nguồn: "Download hiệu ứng âm thanh miễn phí: https://TiengDong.com (Tiếng Động chấm Com)". Họ nói rõ không cam kết pháp lý rằng mọi âm thanh đều miễn bản quyền và người dùng tự chịu trách nhiệm (https://tiengdong.com/copyright). Nếu sau này đăng lên nền tảng có kiểm tra bản quyền, hãy theo dõi cảnh báo.
- File trong game: `bark-1..5.mp3`, `aibark-1..5.mp3` (cắt từ bản thu, tiếng địch hạ cao độ).

## Do chương trình tạo
- `countdown-tick.mp3`, `countdown-go.mp3` (tổng hợp bằng `tools/tao-am-thanh.py`), icon và ảnh xem trước (`tools/tao-icon-og.py`), `js/vendor/peerjs.min.js` (PeerJS, giấy phép MIT).
