# Thư mục assets/ — thả ảnh vào là game tự nhận

**Không cần đặt tên đúng chuẩn, không cần sửa code.** Game quét thư mục, đoán ảnh nào dùng cho gì theo tên file.
Thả file xong, **bấm lại vào cửa sổ game**: game tự phát hiện ảnh mới/đổi ảnh và tải lại (không làm gián đoạn trận đang đánh).
Mở F12 → Console để xem dòng `[Assets] …` cho biết file nào đã được nhận.

> Game cần chạy qua Live Server / localhost (danh sách thư mục do server cung cấp). Nếu host lên GitHub Pages/Netlify
> (không xem được danh sách thư mục) thì bấm đúp **`cap-nhat-assets.bat`** (cần Node.js) sau mỗi lần thêm ảnh để tạo `assets/files.json`.

## 1. Bối cảnh — `assets/backgrounds/`
Thả ảnh bất kỳ (png/jpg/webp), tên gì cũng được.
- Tên có từ khoá của bối cảnh có sẵn thì **thay** bối cảnh đó:
  `village` ← village, vietnam, làng, quê… | `valley` ← valley, water, lake, thung… | `street` ← street, plaza, town, cafe, phố…
  | `beach` ← beach, sea, biển… | `temple` ← temple, pagoda, chùa…
  (vd. *Golden Hour in a Vietnamese Village.png* → Làng Quê)
- Ảnh **không khớp** bối cảnh nào → **tự thành bối cảnh mới** (tên hiển thị lấy từ tên file, màu hiệu ứng lấy theo ảnh).
- Khi đã có ít nhất 1 ảnh nền, bối cảnh nào không có ảnh sẽ được ẩn (muốn giữ cảnh vẽ bằng code: `manifest.json` → `"keepCodeDrawn": true`).
- Ảnh ngang 16:9 (vd 1920×1080) là đẹp nhất; mặt đất nên ở khoảng 68% chiều cao, khác thì chỉnh `groundY` trong manifest.

## 2. Nhân vật — `assets/characters/`
Cách A (khuyên dùng): mỗi nhân vật một thư mục `characters/<tên>/` chứa ảnh PNG nền trong suốt, **chân sát mép dưới**, quay mặt sang **phải**.
Tên file chứa từ khoá để gán trạng thái (không có từ khoá → ảnh đầu là đứng yên, ảnh thứ hai là sủa):

| Trạng thái | Từ khoá trong tên file |
|---|---|
| đứng yên | idle, stand, normal, bth, đứng… |
| sủa | bark, sua, woof, attack, angry, zoom… |
| bị đau | damage, hurt, hit… |
| hạ gục | ko, faint, down… |
| ảnh nhỏ (thẻ chọn) | icon, avatar, thumb, head… |

Cách B: ảnh lẻ ngay trong `characters/`: `Husky.png`, `Husky_bark.png`…

- Tên thư mục/ảnh khớp nhân vật có sẵn (`shiba, golden, husky, corgi, pug, poodle, beagle, labrador, malamute, chow`
  hoặc đúng tên hiển thị) → thay hình nhân vật đó.
- Tên **lạ** → **tự thành nhân vật mới** (chỉ số ngẫu nhiên 2–4, mở sẵn, màu lấy theo ảnh). Muốn chỉnh chỉ số/tên/mô tả: thêm một khối vào `js/data/characters.js` với đúng `id` (= tên thư mục viết thường, không dấu).
- Nhân vật không có ảnh sẽ bị ẩn khi đã có ảnh của nhân vật khác (`keepCodeDrawn` để giữ).
- Chỉnh to/nhỏ, cao/thấp, quay hướng: `manifest.json` → `characters.<id>` → `scale`, `offsetY`, `facing` (`"left"` nếu ảnh quay trái).
- Khi sủa, ảnh `bark` thường to hơn `idle`: hãy giữ nguyên tỉ lệ pixel giữa hai ảnh (cùng chiều cao khung, chân sát đáy), game sẽ hiện đúng độ "phình" của tư thế sủa.

## 3. Menu — `assets/ui/`
Ảnh có chữ `logo` trong tên → thay chữ logo. Ảnh có `menu`/`bg`/`background` → nền menu.

## 4. Âm thanh — `assets/audio/` (mp3, ogg, wav)
Tên file chứa từ khoá nào thì game gán cho loại đó. Nhiều file cùng loại → mỗi lần phát chọn ngẫu nhiên 1 file.

| Loại | Từ khoá trong tên file | Phát khi |
|---|---|---|
| `bark` | bark, woof, sua, gau | **ta** sủa (nghe lệch trái) |
| `aiBark` | aibark, enemy, opponent | **địch** sủa (nghe lệch phải) |
| `countdownTick` | tick, count, beep | mỗi số 3 – 2 – 1 |
| `countdownGo` | go, start, fight | "SỦA ĐI!" |
| `menuMusic` | menu, lobby | nhạc nền menu / chọn chó / online / cài đặt (lặp) |
| `battleMusic` | battle, bgm, ingame | nhạc nền trong trận, vào ngay sau tiếng GO (lặp) |
| `combo`, `ko`, `win`, `lose`, `click` | combo, ko, win, lose, click | như tên gọi |

- Nhạc nền: thêm nhiều file `menu`/`battle` thì mỗi lần vào chọn ngẫu nhiên 1 bài. Muốn nhạc lặp **liền mạch**, hãy dùng file đã cắt đúng độ dài vòng lặp.
- Không có file nhạc → game im lặng (không có nhạc thay thế). Không có file tiếng sủa/bíp → dùng tiếng tổng hợp sẵn trong code.
- Âm lượng: Cài đặt → "Âm lượng hiệu ứng" và "Âm lượng nhạc nền". Nhạc trong trận tự nhỏ hơn nhạc menu (mic có thể nghe lẫn nhạc).
- **Nguồn âm thanh hiện tại**: `bark-1..5` (của ta) và `aibark-1..5` (của địch) được cắt từ bản thu tiếng chó sủa thật (`tieng_cho_sua-www_tiengdong_com.mp3`); tiếng địch hạ cao độ ~16% và nhấn trầm để nghe to, dữ hơn. `music-menu` / `music-battle` làm từ bản nhạc *A Pirate's Adventures* (emmraan, Pixabay): menu = 53 giây lặp liền mạch, trận = đoạn dồn dập nhất tăng tốc 15%. Bíp đếm ngược do `tools/tao-am-thanh.py` tạo.
- **Trước khi đăng game công khai, hãy tự kiểm tra giấy phép** của file tiếng chó (tiengdong.com) và của bài nhạc (trang tải về ghi điều kiện sử dụng/ghi công tác giả).
- Chạy trên Netlify/GitHub Pages: sau khi thêm/đổi file âm thanh nhớ bấm `cap-nhat-assets.bat` để cập nhật `assets/files.json`.
- Cũng có thể khai báo thủ công trong `manifest.json` → `"audio"`.

## 5. Bản quyền
Chỉ dùng hình/âm thanh bạn tự làm hoặc được phép dùng (đặc biệt nếu đăng game lên mạng).


## 4. Ảnh nền chế độ tối — `assets/theme/`
`night-backyard.webp` (máy tính) và `night-backyard-sm.webp` (điện thoại ≤700px) là nền ban đêm. Thay ảnh cùng tên là đổi nền. Thư mục này KHÔNG bị quét như backgrounds/ (không biến thành bối cảnh trận đấu).
