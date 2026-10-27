# v23 (27/10/2026) — Ổn định online: key TURN, chặn bấm đúp, bộ canh host đóng băng
- **Xin key TURN dùng chung một lần gọi:** prefetch, Kiểm tra lại và Tạo/Vào phòng cùng hỏi thì chia sẻ MỘT yêu cầu `/api/turn` đang chạy (trước đó có thể 2–3 lần gọi song song → 2–3 lần khởi động nguội).
- **Không kẹt key xấu:** thử relay với key Metered mà vẫn không ra → `resetIce()` bỏ key đã nhớ, lần Tạo/Vào phòng sau xin key mới (trước đó dùng lại tới 30 phút). Chỉ thử lại relay khi nguồn là Metered (TURN công cộng thử lại cũng vô ích, chỉ tốn ~10 giây).
- **Sửa lỗi: bấm Enter nhiều lần ở ô mã / bấm đúp Tạo phòng** tạo thêm phiên mạng mồ côi chiếm chỗ phòng → người chơi thật bị báo "Phòng đã đầy". Nay `_join`/`_host` có cờ chặn chạy chồng.
- **Sửa lỗi: host chuyển tab giữa trận (máy tính)** làm trận đóng băng, guest treo ở 0 giây vì ping vẫn sống. Nay guest tự kết thúc "mất kết nối" nếu đang đánh mà không nhận `st` của host quá 6 giây (tính theo dt khung hình nên guest tự bị ẩn rồi quay lại không bị báo nhầm).
- Giữ nguyên từ bản trước: xin key sớm khi mở màn Online, chờ 7s + thử lại 1 lần (không thử lại với 404/503/403/405), đo máy chủ ghép phòng riêng trước TURN, thử lại relay sau 1,5s, dòng chi tiết `[metered] relay …ms`.
- sw.js v35.

# v22 (26/10/2026) — Sửa mất âm thanh, host rời app gửi link vẫn giữ được phòng
- **Mất tiếng "lâu lâu", phải thoát vào lại — các nguyên nhân đã sửa:**
  - Mic bị tắt đúng lúc đang chờ cấp quyền (rời Cài đặt/trận/hướng dẫn quá nhanh) thì luồng mic vừa mở KHÔNG ai tắt và cờ `__micActive` kẹt ở true → SoundManager không dựng lại được AudioContext, iPhone kẹt phiên "ghi âm" (tiếng nhỏ/câm). Nay `destroy()` luôn tắt luồng (kể cả đang chờ), cờ được TÍNH từ các luồng mic còn sống thật.
  - Bộ đếm "tối đa 10 tiếng sủa cùng lúc" dựa vào `onended`; `onended` không bắn (context bị ngắt/đóng) thì kẹt ≥ 10 và mọi tiếng sủa sau đó bị nuốt. Nay dùng danh sách có hạn sử dụng 2,5 giây.
  - Âm thanh bị ngắt khi trang vẫn hiện (cuộc gọi đến, Siri, tai nghe, thông báo) trước đây không ai bật lại. Nay theo dõi `statechange`, tự `resume()` và hiện nhắc "Chạm màn hình để bật lại âm thanh" (hiện cả khi không có nhạc nền).
  - Quay lại từ app khác ngay giữa TRẬN: màn trận kiểm tra mic + loa, hỏng thì tắt mic → dựng AudioContext mới → bật lại mic (trước đây mic đang dùng nên không được dựng lại, mất tiếng tới hết trận).
- **Host rời app đi gửi link (Zalo/Messenger…):** phòng KHÔNG mất, miễn host quay lại game. Nay: kiểm tra socket ghép phòng ngay khi quay lại / có mạng / focus / pageshow, và 4 giây một lần lúc đang chờ khách (bắt cả socket chết im lặng do iOS); khách kiên nhẫn thử lại tới ~18 giây (trước 3 lần ≈ 4,5 giây) khi host chưa quay lại.
- **Rà soát online 2 người (vào trận / trong trận / rời trận) — đã sửa:**
  - *Vào trận:* đối thủ rớt mạng lúc màn trận đang chờ mic (tối đa 4 giây) thì tin đứt kết nối bị lỡ → host chờ trọn 30 giây rồi đánh một mình với "bóng ma", guest kẹt mãi ở đếm ngược. Nay cả hai phía kiểm tra kết nối ngay lúc bắt đầu, trong lúc chờ nhau, và guest tự thoát sau 35 giây nếu host không bắt đầu → kết thúc "mất kết nối" (không thắng/thua, không thưởng).
  - *Vào trận:* host không còn vào trận khi khách vừa rớt (trước đây `send()` thất bại bị bỏ qua).
  - *Rời trận:* tin `quit` nay được xử lý NGAY ở mọi màn (trước chỉ ở sảnh): người kia ở màn kết quả thấy "đối thủ đã rời" liền, không phải chờ kênh dữ liệu tự báo đóng (Safari có khi chậm cả chục giây, nút Đấu lại bấm được và chờ mãi).
  - *Sau trận:* màn kết quả và sảnh online giữ màn hình sáng (màn trận vừa nhả wake lock → máy tự khoá màn lúc chờ đấu lại, kết nối rớt).
- **Thông báo online dạng POPUP giữa màn hình** (trước đây là dòng chữ nhỏ ở cuối trang, dễ bỏ sót): module mới `js/core/Popup.js` + kiểu `.pop-*` trong `css/identity.css`.
  - Hộp thoại có nút "Đã hiểu": mất kết nối / chủ phòng rời, đối thủ rời phòng, lỗi vào phòng, khác phiên bản, trình duyệt trong app (hiện 1 lần), link mời khi không sao chép được.
  - Bong bóng nổi trên cùng: "Đã sao chép lời mời", "Đang tạo phòng / đang vào phòng…" (giữ tới khi xong), nhập sai mã.
  - Màn kết quả online: popup khi mất kết nối, khi đối thủ thoát (thắng bỏ cuộc), khi đối thủ rời lúc đang xem kết quả.
  - Dòng `#online-msg` cũ được ẩn. Chữ mới: `pop.*` trong I18n (VI/EN).
- sw.js v29.

# v21 (26/10/2026) — Giấu IP có công tắc, dự phòng TURN, kiểm tra dữ liệu mạng
- **Chế độ riêng tư (giấu IP)** là công tắc của người chơi: Cài đặt → Riêng tư và ngay ở sảnh online; mặc định BẬT (`HIDE_IP_DEFAULT`). Bật: bỏ STUN + `iceTransportPolicy:'relay'`. Không còn TURN nào thì kết nối thất bại chứ KHÔNG tự quay về kết nối thẳng làm lộ IP. Sảnh cảnh báo khi chỉ có TURN công cộng.
- TURN Metered (USER/PASS trong `net-config.js`) nay có thêm TURN công cộng nối phía sau làm dự phòng.
- **Kiểm tra dữ liệu từ mạng**: khách ép/giới hạn các số `g`, `tl`, `hc`, `c`, giá trị đếm ngược, người thắng; sảnh chỉ nhận lệnh `start` từ host với nhân vật hợp lệ.
- sw.js v27, `_headers` bỏ `*.metered.live` khỏi CSP (TURN chạy qua WebRTC). privacy.html và hộp đồng ý cập nhật đúng chế độ riêng tư.

# v20 (26/10/2026) — trả kết nối online về như v16, gỡ dòng không liên kết
- **Kết nối online:** `NET_CONFIG.HIDE_IP` đặt lại `false` (như v16): dùng STUN + TURN, ưu tiên kết nối trực tiếp. Ở v17–v19 chế độ giấu IP ép `iceTransportPolicy:'relay'` nên mọi kết nối phụ thuộc TURN công cộng (hay quá tải) → dễ không vào được phòng khi chưa có key Metered.
- Cập nhật chữ hộp đồng ý, trang Quyền riêng tư và thông báo kiểm tra mạng cho đúng chế độ này.
- Gỡ dòng "không liên kết với Bow-wow Battle" ở privacy.html, terms.html (xoá mục 2, đánh số lại) và CREDITS.md.
- Gỡ chữ "Chủ game: điền METERED_APP/METERED_KEY" và "(Cấu hình TURN riêng…)" khỏi thông báo hiển thị cho người chơi.
- **Người kia rời phòng mà bên còn lại không được báo:** trước đây rời phòng chỉ đóng kết nối im lặng, sảnh không xử lý tin `quit`, và phải chờ 25 giây mới phát hiện đứt. Nay: rời phòng/đóng kết nối gửi `quit` trước, sảnh nhận `quit` là báo ngay (host giữ phòng mở, khách về màn nhập mã), và ngưỡng phát hiện đứt ở sảnh giảm 25 → 12 giây.
- Hỗ trợ TURN kiểu mới của Metered (Username + Password cố định): `METERED_USER`, `METERED_PASS` trong net-config.js (máy chủ global.relay.metered.ca).
- Đổi đơn vị Xương/Bones → **GP (Gâu Point)** ở mọi chữ hiển thị (menu, chọn nhân vật, kết quả, xếp hạng, khoá/mở khoá, trang pháp lý). Khoá lưu và tên biến giữ nguyên nên tiến độ cũ vẫn còn.
- sw.js: VERSION → v24.

# v17 (26/10/2026) — đổi nhận diện, thêm trang pháp lý
- Đổi tên: "Gâu Gâu Battle" → **Gaune – Gâu Gâu** (menu, tiêu đề, manifest, meta, ảnh chia sẻ `og-gaune-v3.jpg`, chuỗi VI/EN).
- Đổi đơn vị "WP" → **Xương** (VI) / **Bones** (EN) ở mọi chữ hiển thị. Khoá lưu và tên biến trong code giữ nguyên nên tiến độ cũ vẫn còn.
- Đổi chữ: "K.O!!" → **ĐO VÁN!**, "TIME!" → **HẾT GIỜ!**, kết quả: THẮNG ĐẸP! / THUA ĐAU... / HẾT GIỜ — THẮNG!/THUA...
- Đổi màu (file mới `css/identity.css`): thanh sức mạnh bạn = xanh bạc hà, đối thủ = tím; chữ ĐO VÁN vàng hổ phách viền xanh; bảng kết quả nền xanh đêm viền bạc hà. identity.css nạp riêng sau bundle nên chạy lại `tools/build-css.mjs` không làm mất.
- Thêm `privacy.html`, `terms.html` (có dòng "không liên kết với Bow-wow Battle"), link trong Cài đặt → Giới thiệu, thêm vào sitemap.
- CREDITS.md: thêm mục hình ảnh (ChatGPT) và hồ sơ chứng cứ.
- **Giấu IP online:** `NET_CONFIG.HIDE_IP` (mặc định bật) → bỏ STUN, `iceTransportPolicy:'relay'`, đối thủ không thấy IP. Cần TURN chạy ổn: điền METERED_APP/METERED_KEY. Muốn kết nối trực tiếp (nhanh hơn, lộ IP) thì đặt `HIDE_IP: false`.
- **Hộp đồng ý** trước lần chơi online đầu tiên (lưu `gaune_online_consent_v1`), có link trang riêng tư.
- Ảnh chia sẻ `og-gaune-v3.jpg` làm lại từ tranh mới (Gaune – Gâu Gâu), 1200×630.
- Màn kiểm tra mạng online: thông báo đúng với chế độ giấu IP (chỉ TURN), cảnh báo rõ khi TURN không dùng được.
- sw.js: VERSION → v21.

# v16 — Cấp bot (thăng cấp để đấu bot khó hơn)
- **5 cấp bot có tên**: Tập sự, Thường, Khó, Siêu khó, Boss. Chọn ngay ở màn chọn nhân vật (hàng "Cấp bot"); cấp chưa mở hiện 🔒.
- **Mở khoá**: thắng 3 trận ở cấp CAO NHẤT đã mở thì mở cấp kế tiếp (thưởng +200 WP một lần, tự chuyển sang cấp mới). Đánh lại cấp thấp để luyện tay thì không tính tiến độ.
- **Thưởng WP khi thắng bot theo cấp**: ×1 / ×1.2 / ×1.4 / ×1.7 / ×2.0 (online không áp dụng). Màn kết quả hiện thông báo mở khoá hoặc tiến độ "x/3".
- Trong mỗi cấp độ khó vẫn nhích +0.15 mỗi trận thắng (tối đa +0.9), −0.05 khi thua; đổi cấp thì quay về đầu cấp.
- **Tự chuyển dữ liệu cũ**: bản lưu có độ khó 2.8 → cấp 2 (+0.8), độ khó 5 → cấp 5. Người chơi cũ không bị mất tiến độ.
- Cấu hình: `CONFIG.TIERS`, `CONFIG.WP.TIER_WIN_MULT`, `CONFIG.WP.TIER_UP_BONUS`. Chuỗi dịch VI/EN: các khoá `tier.*`. Service worker v20.

# v15 — Bot mạnh hơn
- **Viết lại `AIOpponent`**: bot không còn sủa ngẫu nhiên đều đều. Nay sủa theo **đợt** (vài tiếng dồn rồi nghỉ), có **combo thật** (hệ số nhân + thưởng nhịp nhanh như người chơi), **đuổi theo** khi đang bị dẫn và thỉnh thoảng có tiếng rất to. Trước đây người sủa ≥ 2 tiếng/giây thắng 100% kể cả ở độ khó 5.
- Đã bỏ việc nhân đôi chỉ số power của bot (trước nhân 2 lần).
- Toàn bộ thông số nằm trong `CONFIG.AI` (nhịp, độ dài đợt, âm lượng, mức đuổi theo). Độ khó vẫn 1.0 → 5.0 và vẫn tự tăng +0.15 mỗi trận thắng.
- Mô phỏng (người = Shiba, 30 giây): sủa 2 tiếng/giây → thắng D1 100%, D2 98%, D3 55%, D4 3%, D5 0%; sủa 4 tiếng/giây → D3 100%, D4 90%, D5 42%.
- Service worker v19.

# v14 — Tối ưu cho máy yếu, nạp nhanh hơn, ổn định hơn
- **Ô chọn bối cảnh dùng ảnh thu nhỏ** (`assets/theme/thumbs/`, 320px, ~10 KB/ảnh, tổng ~58 KB) thay vì ảnh nền 1280px: trước đây 6 ô nhỏ buộc trình duyệt giải mã 6 ảnh lớn (~22 MB RAM). Bối cảnh bạn tự thêm chưa có ảnh thu nhỏ thì tự dùng ảnh gốc. Thêm bối cảnh mới: đặt ảnh thu nhỏ cùng tên file vào `assets/theme/thumbs/` (không bắt buộc).
- **Gộp 16 file CSS thành 1** (`css/bundle.css`, bỏ chú thích): ít yêu cầu chặn hiển thị hơn → vào game nhanh hơn trên mạng yếu. Sửa CSS ở file nguồn rồi chạy `node tools/build-css.mjs`.
- **Đo FPS đáng tin hơn**: bỏ 1,5 giây đầu trận, đo 2 đợt × 2,5 giây, chỉ chuyển sang chế độ tiết kiệm khi CẢ HAI đợt đều chậm. Kết quả "máy yếu" chỉ nhớ 7 ngày (trước đây nhớ vĩnh viễn, kể cả khi chỉ do chế độ pin yếu).
- **Máy ≤ 2 nhân CPU (iPhone đời cũ, máy rẻ) tự vào chế độ tiết kiệm ngay** thay vì chờ đo trong trận.
- Chỉ ghi số lần sủa lên màn hình khi giá trị đổi (trước ghi mỗi khung hình).
- `color-scheme` theo giao diện sáng/tối (trước luôn là tối → thanh cuộn/ô nhập sai màu ở giao diện sáng).
- Biển hiệu "QUÁN BIỂN" trên cảnh bãi biển đổi thành "BEACH SHACK" khi chọn tiếng Anh.
- Bỏ listener rỗng trong `Perf.js`. Service worker v18.

# v13 — Chế độ sáng/tối, tiếng Việt/Anh, đồng bộ tiêu đề, hết nhạc "ma" khi thoát app, ảnh chia sẻ Zalo mới
- **Nút Ngôn ngữ (VI/EN) + nút Sáng/Tối** — hai nút tròn kính mờ cùng kiểu với nút Cúp/Cài đặt: ở menu nằm trong thanh trên cùng; ở các màn phụ (chọn nhân vật, online, hướng dẫn, xếp hạng, cài đặt) là cụm cố định góc trên phải, đối xứng với nút "Quay lại" bên trái. Ẩn trong trận và màn kết quả để khỏi bấm nhầm. Lựa chọn được nhớ (`chosua_lang`, `chosua_theme`); lần đầu: trình duyệt tiếng Việt → Việt, còn lại → Anh; giao diện mặc định là sáng.
  - Dịch toàn bộ chữ: HTML (`data-i18n`), thông báo mic/online/lỗi mạng, thẻ nhân vật & bối cảnh, xếp hạng, hướng dẫn, kết quả, tiêu đề tab + mô tả. Đổi ngôn ngữ giữa chừng vẫn đúng (thẻ nhân vật giữ nguyên lựa chọn, trạng thái phòng online vẽ lại). Bảng chuỗi ở `js/core/I18n.js`; thêm chữ mới = thêm 1 dòng.
  - **Online không bị ảnh hưởng**: ngôn ngữ/giao diện chỉ đổi chữ + màu trên máy bạn; tin nhắn gửi qua mạng vẫn dùng id nhân vật/bối cảnh như cũ, hai bên chọn ngôn ngữ/giao diện khác nhau vẫn chơi bình thường.
- **Chế độ tối = ban đêm**: dùng ảnh "sân sau dưới trăng" (đã nén `assets/theme/night-backyard.webp` 134KB + bản nhỏ 57KB cho điện thoại, **chỉ tải khi bật chế độ tối lần đầu**). Bảng màu nâu ấm → xanh đêm (kính mờ, viền, chữ, thẻ banner, màn kết quả), vàng/cam giữ làm ánh đèn lồng. Trong trận phủ thêm 1 lớp màu đêm lên cảnh (1 lớp phẳng, không blend → nhẹ GPU). Chuyển sáng ↔ tối bằng mờ dần (chỉ opacity). `js/boot-prefs.js` đặt lại lựa chọn TRƯỚC khi vẽ trang nên không bị chớp sai màu.
- **Đồng bộ giao diện các màn hình** (Online ↔ Chọn nhân vật ↔ Cài đặt ↔ Xếp hạng)
  - Tiêu đề: bỏ kiểu riêng của màn Online (to hơn + gạch chân dày hơn); mọi màn dùng chung `.screen-title` (cỡ chữ, gạch chân 56×4, khoảng cách phía trên `--head-top` 64px / 56px điện thoại). Cài đặt & Xếp hạng trước cách trên 80px nay cùng 64px.
  - Đầu mục thẻ (`--h-section` 1.3rem), cỡ chữ nhãn/chú thích, kiểu thẻ (Online dùng chung kiểu thẻ Cài đặt), nút (mọi nút chính cùng một kiểu viên thuốc vàng–cam, chữ nâu đậm dễ đọc hơn chữ trắng cũ; nút phụ kính mờ).
- **Rà soát giao diện — lỗi đã sửa**
  - Thiếu biến `--backdrop-blur-sm` → thẻ nhân vật, ô bối cảnh, nhãn logo không có kính mờ. Đã định nghĩa.
  - Thiếu keyframe `fadeUp` + thông báo nổi dùng style nội tuyến `white-space:nowrap` (tràn màn hình nhỏ). Nay là `.toast-msg`, tự xuống dòng.
  - Mỗi màn hình có nền riêng với `background-attachment: fixed` (iOS không hỗ trợ → giật, tốn GPU) và màn hướng dẫn có nền khác hẳn. Nay là 1 lớp nền chung `#app-bg` cho tất cả.
  - Màn hướng dẫn: nút "Bỏ qua" chuyển sang góc trái (góc phải dành cho nút Ngôn ngữ/Sáng-Tối).
  - Mở khoá nhân vật/đổi ngôn ngữ không còn làm mất nhân vật đang chọn ở màn chọn nhân vật.
  - Dòng phụ tiếng Anh dư ("Bark loud and often…", "Next match ▸") tự ẩn khi đang ở tiếng Anh.
- **Hết nhạc "ma" khi thoát ra ngoài**: trên iPhone, vuốt về màn hình chính / chuyển app thì nhạc nền VẪN phát (phiên âm thanh `playback` + thẻ <audio> im lặng giữ trang sống), phải đóng hẳn tab mới hết. Nay khi trang bị ẩn (`visibilitychange`, `pagehide`, `freeze`): dừng nguồn nhạc, tạm dừng AudioContext trên MỌI nền tảng, nhả phiên âm thanh (`audioSession = ambient`), tạm dừng thẻ im lặng. Quay lại thì bật lại như v12 (dựng context mới, chạm 1 lần, nhạc phát lại từ đầu).
- **Ảnh xem trước khi gửi Zalo/Messenger/Facebook**: dùng tranh minh hoạ mới (logo + 2 chú chó + biển "Buồn bực? Sủa lên cho đỡ stress!") thay ảnh vẽ bằng code (chữ nhỏ, bị cắt). Ảnh 1200×630 giữ nguyên toàn bộ tranh, hai bên lấp bằng chính tranh làm mờ. File mới `icons/og-gau-gau-battle-v2.jpg` (đổi tên để bỏ qua bộ nhớ đệm). Công cụ: `python3 tools/tao-og-tu-anh.py <anh-goc>`.
  - Zalo nhớ ảnh theo từng link: gửi thử link có đuôi khác, vd `https://game-cho-sua.netlify.app/?v=2`, để thấy thẻ mới ngay.
- Service worker v17.

# v12 — Đổi tên thành "Gâu Gâu Battle", sửa mất nhạc (iPhone), chữ Online, rà soát online
- **Đổi tên toàn bộ → Gâu Gâu Battle** 🐾 (tên phụ để tìm kiếm: Gaune). Slogan: "Buồn bực thì sủa lên, xả stress cùng mình!"
  - Logo menu "GÂU GÂU / BATTLE" + huy hiệu "SỦA LÊN · XẢ STRESS"; tiêu đề trang, mô tả, Open Graph / Twitter (thẻ xem trước khi gửi Zalo, Messenger, Facebook), JSON-LD, manifest (tên cài lên màn hình chính: "Gâu Gâu"), noscript, mục Giới thiệu, câu phụ màn Online.
  - Ảnh xem trước khi chia sẻ vẽ lại: `icons/og-gau-gau-battle.jpg` (đổi tên file để Zalo/Facebook không dùng ảnh cũ trong bộ nhớ đệm). Công cụ: `python3 tools/tao-icon-og.py`.
  - Nút "Sao chép liên kết mời" nay copy kèm câu giới thiệu; dán cả đoạn vào ô mã phòng vẫn tự lấy đúng mã.
  - GIỮ NGUYÊN các khoá lưu trữ nội bộ (`cho-sua-fighter-v1`, `chosua_*`) để người chơi cũ không mất dữ liệu. Tiền tố ID phòng đổi thành `gaugau-` (bản cũ và mới không vào nhầm phòng nhau).
  - Địa chỉ web vẫn là `game-cho-sua.netlify.app`. Nếu đổi tên site trên Netlify, thay chuỗi đó trong `index.html`, `robots.txt`, `sitemap.xml` (xem HUONG-DAN-NETLIFY.md).
- **Mất nhạc khi thoát Safari sang app khác / màn hình chính rồi quay lại (sửa lại triệt để)**: bản v11 chỉ cố đánh thức AudioContext cũ — trên iPhone context này thường hỏng hẳn (resume bị từ chối hoặc báo "running" nhưng câm). Nay: rời trang > 1 giây → khi quay lại DỰNG AUDIOCONTEXT MỚI (nhạc/tiếng đã giải mã dùng lại, không tải lại), chờ cú chạm đầu tiên rồi phát lại nhạc từ đầu; có dòng nhắc "🔈 Chạm màn hình để bật lại nhạc". Không dựng lại khi mic đang dùng; chạm 2 lần mà vẫn câm thì dựng mới ngay trong cú chạm. Có kiểm thử mô phỏng.
- **Giao diện Online**: chữ tiêu đề trở lại kiểu cũ (trắng ấm + bóng mềm như các trang khác, bỏ chữ gradient và viền đen cứng), chỉ to hơn; đầu mục thẻ và mã phòng dùng vàng chuẩn của game; nút "Vào phòng" cùng kiểu nút chính với "Tạo phòng".
- ****
  - Host không còn từ chối người vào lại ("Phòng đã đầy hoặc bị đóng") khi kết nối cũ đã im > 3 nhịp ping mà chưa kịp báo đứt; nhường chỗ ngay.
  - Sự kiện đóng muộn của kết nối CŨ không còn làm rớt người mới vào lại.
  - Mã phòng sinh bằng `crypto.getRandomValues` (khó dò hơn `Math.random`).
- Service worker v16.

# v11 — Sửa mất nhạc khi quay lại từ app khác + rà soát online + giao diện Online mới
- **Mất nhạc khi thoát Safari rồi quay lại (đã sửa)**: iOS đặt AudioContext ở trạng thái dừng/ngắt, resume() lúc vừa quay lại bị từ chối, thẻ <audio> im lặng giữ phiên phát bị dừng, nguồn nhạc lặp có thể chết ngầm. Nay khi trang hiện lại (visibilitychange / pageshow / focus): resume + bật lại phiên âm thanh + dựng lại nguồn nhạc nền từ đầu; nếu iOS đòi cú chạm thì tự phát ngay ở cú chạm đầu tiên (kèm thử lại vài lần).
- **Online — lỗi đã sửa**
  - Host: sau khi nối lại máy chủ ghép phòng mà gặp `unavailable-id`, code cũ TẠO MÃ MỚI ngầm (màn hình vẫn hiện mã cũ → bạn nhập mã cũ báo "không tìm thấy phòng"). Nay giữ nguyên mã và nối lại.
  - Quay lại tab: host chờ đối thủ nay kiểm tra/nối lại socket ghép phòng bị iOS giết ngầm.
  - `pagehide` chỉ gửi "thoát" khi trang thật sự đóng (không phải vào bộ nhớ đệm trang) → tránh xử thua oan.
  - Lưu ý: TURN công cộng `openrelayproject` hay hết hạn → nên điền METERED_APP/METERED_KEY trong js/net/net-config.js để 4G ↔ Wi-Fi ổn định.
- **Giao diện Online**: tiêu đề to hơn (gradient vàng + viền tối), đầu mục thẻ 1.55rem, nội dung 0.95rem, chú thích ≥0.82rem; ô nhập mã và nút cùng độ rộng; thanh trạng thái gọn một dòng; mẹo chuyển thành danh sách. File mới: css/screens/online-v2.css.
- Service worker v15.

# v10 — Sửa hướng dẫn ở chế độ Tiết kiệm + chống gian lận online
- **Lỗi**: ở chế độ Tiết kiệm (lite) hình động trong phần hướng dẫn chỉ chạy 1 lần rồi đứng yên (do `lite.css` ép mọi animation lặp = 1). Đã thêm ngoại lệ cho phần hướng dẫn (chỉ thẻ đang xem mới chạy; vẫn tôn trọng "giảm chuyển động" của hệ điều hành).
- **Online**: host chỉ nhận 1 tin cộng bù `bb` cho mỗi tiếng sủa đã duyệt (trong 250ms) → guest không thể spam `bb` để tự đẩy thanh lực.
- **Sủa nhanh chó không theo kịp (đã sửa)**: bộ phát hiện sủa dồn chỉ nhận tiếng mới khi âm lượng tụt xuống dưới 0,75×ngưỡng tuyệt đối; sủa to/gần mic thì giữa hai tiếng âm lượng chỉ tụt ~50% đỉnh nên nhiều tiếng bị gộp thành 1 (mô phỏng: chỉ nhận 11–33% số tiếng). Nay dùng thêm "đáy tương đối" (≤60% đỉnh tiếng trước, rồi vọt lại ≥80% đỉnh) → nhận 100% ở 3–12 tiếng/giây.
- Chữ sủa luôn hiện ít nhất 1 chữ chính cho mỗi tiếng (trước đây khi đã đủ chữ trên màn hình thì tiếng sủa đó không có chữ).
- ** lỗi vào phòng / mic / bị đá ra (đã sửa)**
  - Xin mic không còn chặn vào trận: trước đây hộp thoại quyền mic treo thì màn trận đứng im, host chờ, rớt mạng không ai hay, đối thủ thoát cũng không biết. Nay chờ tối đa 4 giây rồi vào trận, mic bật xong sau vẫn tự gắn vào.
  - Thoát trận trong lúc đang xin mic: trước đây mic cứ bật mãi + dựng trận "ma" chạy nền (cả nhạc). Nay huỷ sạch.
  - Đối thủ rời sảnh: trước đây host bị đá ra menu, thông báo ghi vào màn đã ẩn (không thấy), phòng mất. Nay host GIỮ PHÒNG (mã cũ dùng lại được); guest được đưa về màn vào phòng kèm thông báo rõ.
  - Ngưỡng mất kết nối ở sảnh 25 giây (trong trận vẫn 7 giây) → chuyển app copy mã / đổi quyền mic không còn bị coi là thoát. Kết nối chết được đóng hẳn để bên kia biết.
  - Dán cả liên kết mời vào ô mã: trước đây thành "HTTPS" (ô giới hạn 5 ký tự). Nay tự lấy đúng mã.
  - Màn kết quả online: nút "Đấu lại" không còn bấm không phản ứng khi đối thủ đã rời — hiện "Đối thủ đã rời".
  - Mở bằng liên kết mời không còn chạy thêm một kết nối dò máy chủ song song; lỗi trong trình duyệt Zalo/Messenger/Facebook luôn kèm gợi ý mở bằng Safari/Chrome.
- Service worker v14.

# v9 — Cảm giác "làm một với chó", cân bằng, online ổn định

**Cảm giác & cân bằng**
- Bộ phát hiện sủa chạy ở timer riêng 8ms (không còn phụ thuộc fps → bớt trễ ~16–33ms).
- Cộng bù đỉnh thật: bắn tiếng sủa ngay lúc bắt đầu, nếu 70ms sau đỉnh to hơn ≥20% thì cộng thêm phần lực chênh (không tăng combo).
- `MicNormalizer`: quy âm lượng mic về cùng thang theo mức "sủa to" của chính người chơi (lưu qua các trận) → mic nhạy không còn mạnh hơn.
- Chỉ số chỉ còn là hỗ trợ: power ±5%/bậc (trước ±15%), speed tối đa +8% lực (trước +20%), combo chỉ đổi thời gian giữ combo; hệ số mỗi bậc cố định 0.20, trần combo ×2 (trước ×3). Special Pug +8%, Chow +5%, Corgi cửa sổ ×1.25. Chênh lệch giữa các chó ≤ ~8% (trước tới 20%).
- Thưởng combo tỉ lệ theo âm lượng (trước cộng phẳng). `PUSH_BASE` 22 → 9: sủa vừa liên tục ~1,5s mới KO; hai người ngang tài giằng co cả hiệp.

**Lần đầu vào game** (giao diện mới, nhẹ máy)
- Chỉ BƯỚC 1 (chuẩn hoá mic) mới bật mic, và mic TẮT NGAY khi đo xong / bỏ qua / sang bước khác / ẩn tab. Bước 2 (4 thẻ vuốt ngang có hình động) và bước 3 chỉ là hướng dẫn, không mic, không vòng lặp JS.
- Bước 1: vòng mic sáng theo âm lượng, 3 dấu chân sáng dần sau mỗi tiếng sủa, thanh tiến trình 3 bước phía trên. Có "Bỏ qua bước này" và "Bỏ qua ›". Người đã từng đánh trận hoặc mở bằng liên kết `?room=` bỏ qua màn này. Chạy lại: Cài đặt → "Chuẩn hoá mic & xem hướng dẫn".
- Màn hình đang ẩn không còn được vẽ và không còn chạy hoạt ảnh lặp (`visibility:hidden` + `animation-play-state:paused`) → bớt nóng máy toàn game.

**Online**
- Host chấp nhận tiếng sủa của guest theo xô token (16 tiếng/s, dồn tối đa 4) thay vì khoảng cách tối thiểu 90ms (trước mất 28–45% tiếng khi mạng giật).
- Thanh lực của guest ghép số host với phần dự đoán chưa được xác nhận → hết giật lùi.
- Guest vào trận trễ (xin mic lâu >30s) không còn kẹt ở màn đếm ngược.
- Bù trễ của host tối đa 80ms (trước 150ms). Guest gửi thêm tin `bb` (cộng bù). Trần âm lượng từ mạng 0.8.

**Hiệu năng**
- Particle có trần 220 + nén mảng tại chỗ; chữ sủa giảm số lượng khi sủa dồn, trần 80; tối đa 10 tiếng sủa phát cùng lúc; phát tiếng sủa không chờ khi AudioContext đang chạy; bỏ sự kiện `battle:update` không ai nghe.
- Service worker v11.

# Bản v3: rà soát toàn bộ (an toàn, tốc độ, SEO, máy yếu)

**An toàn**
- `_headers`: thêm Content-Security-Policy, HSTS, COOP, Referrer-Policy chặt hơn (đã thử trên máy chủ giả lập Netlify: 0 vi phạm CSP).
- Bỏ `onload` nội tuyến của font (không tương thích CSP) → `js/font-loader.js`.
- Dữ liệu thiếu/sai từ đối thủ online không còn làm thanh lực thành `NaN`; file lưu bị sửa/hỏng không làm game lỗi; bảng xếp hạng ép số trước khi hiển thị.

**Tốc độ**
- Ảnh nền không còn chặn menu (tải nền, danh sách bối cảnh tự cập nhật khi xong). Âm thanh cũng tải nền, nhạc menu giải mã trước nhạc trận.
- Đọc `files.json` thẳng trên máy chủ thật (bỏ 8 lượt dò thư mục 404). Bỏ `@import` font chặn hiển thị. Tải song song toàn bộ JS bằng `modulepreload`.
- Service worker: vào lại gần như tức thì, chơi offline (trừ online).
- Menu hiện sau ~6 giây trên 3G giả lập lúc chưa có bộ nhớ đệm (trước đó ~11 giây).

**SEO & chia sẻ**
- Title/description chuẩn, canonical, Open Graph + Twitter Card (ảnh 1200×630), JSON-LD VideoGame, favicon, icon cài ứng dụng (PWA), `robots.txt`, `sitemap.xml`, `<noscript>`.
- Cho phép phóng to màn hình (trước đây chặn zoom — kém truy cập).

**Sửa lỗi**
- Mất nền và ảnh chó trên menu: CSS/HTML còn trỏ `.png` trong khi ảnh đã là `.webp`.

**Hiệu ứng (tối giản, nhẹ GPU)**
- Thẻ menu hiện lần lượt từ dưới lên; nhích nhẹ khi rê chuột (chỉ trên máy có chuột); viền focus vàng khi dùng bàn phím; tự giảm chuyển động nếu hệ điều hành bật "giảm chuyển động". Chế độ Tiết kiệm vẫn tắt hoạt ảnh lặp như cũ.

**Ghi công**
- Cài đặt → Ghi công, `CREDITS.md`.

# Cập nhật: âm thanh thật + sửa mất nền/ảnh khi đưa lên Netlify

- **Sửa lỗi mất nền và ảnh chó trên menu**: `css/cartoon.css` và `index.html` vẫn trỏ tới ảnh `.png` (và tên cũ "Café") trong khi ảnh đã đổi sang `.webp` nên trình duyệt báo lỗi 404. Đã sửa đường dẫn.
- **Tiếng sủa thật**: cắt tự động từ bản thu 4 phút (loại tiếng trùng/bị đè), 5 tiếng cho ta (sáng) + 5 tiếng cho địch (hạ cao độ, trầm hơn).
- **Nhạc nền**: dùng bản "Pirate Adventures" — menu lặp 53 giây, trận là đoạn dồn dập nhất tăng tốc 15%; đã cắt điểm lặp khớp nhịp, hạ âm lượng và nén xuống ~0.8 MB tổng.

# Thay đổi trước đó (Âm thanh: tiếng sủa, bíp đếm ngược, nhạc nền)

- **Tiếng sủa**: 4 tiếng của ta (cao, sáng) + 4 tiếng của địch (trầm, gằn) để phân biệt ngay khi nghe; ta nghe lệch trái, địch lệch phải (pan stereo). Mỗi lần sủa chọn ngẫu nhiên 1 file và đổi cao độ nhẹ nên không bị lặp máy móc.
- **Bíp đếm ngược**: "bíp" 3 – 2 – 1 và "bííííp" cao, dài ở tiếng GO. Trong lúc đếm ngược không có nhạc nền để nghe rõ tiếng bíp.
- **Nhạc nền**: `music-menu.mp3` (menu, chọn chó, sảnh online, xếp hạng, cài đặt) và `music-battle.mp3` (vào ngay sau tiếng GO). Tự chuyển bài mượt (cross-fade), tắt khi trận kết thúc để nghe KO / nhạc thắng / thua, tự quay lại nhạc menu.
- **Cài đặt**: thêm thanh "Âm lượng nhạc nền" (lưu cùng cài đặt). Nút "Tắt tiếng" tắt luôn nhạc. Đang "Kiểm tra mic" thì nhạc tạm tắt để phép đo chuẩn.
- Nhạc trong trận được hạ nhỏ hơn nhạc menu (×0.6) để mic ít nghe lẫn nhạc. Ẩn tab / khoá màn hình thì tạm dừng âm thanh.
- Code: `SoundManager` thêm `playMusic / stopMusic / setMusicVolume / setMusicDuck`, `ScreenManager` thêm hook `onChange`, `AssetLoader` nhận diện file `menu` / `battle`. Bộ tạo âm thanh: `tools/tao-am-thanh.py`.

# Thay đổi (Tối ưu toàn diện giao diện Mobile — Sunset Glass Arena)

- **Menu chính**: Thu gọn tỉ lệ canvas chó hoạt hình và chữ logo "BOW WOW BATTLE" vừa vặn màn hình dọc; các thẻ chiến dịch giới hạn vùng chữ (60%) không còn bị chó che khuất; tối ưu avatar chó và bộ 3 chó gọn gàng bên phải.
- **Màn chọn nhân vật**:
  - Nút "Quay lại" cố định góc trên bên trái (`position: fixed`) với kính mờ và vùng an toàn tai thỏ (safe area), dễ dàng bấm ở bất kỳ vị trí cuộn nào.
  - Khung xem trước (preview) dạng ngang nhỏ gọn: canvas chó 90×90px, thông số sức mạnh/tốc độ/combo thu gọn, thẻ chỉ số suy ra (thưởng nhịp nhanh) dạng pill tinh gọn.
  - Lưới 2 cột thẻ chó cân đối, badge 🔒 và ✓ Chọn không đè mép thẻ.
  - Thanh nút đáy "Bắt đầu chiến!" cố định đáy có kính mờ đậm (`backdrop-filter`) và đệm an toàn `env(safe-area-inset-bottom)`, không che thẻ bối cảnh.
- **Đấu trường (Battle)**:
  - Thanh kéo co (gauge) đỉnh màn hình né nút ✕ thoát trận, nhãn tên tự động rút gọn `...` khi tên dài.
  - Đồng hồ đếm ngược và dòng hướng dẫn thu gọn 1 dòng súc tích, nhường không gian sân đấu tối đa cho 2 chú chó.
  - HUD dưới (thanh mic, combo, tổng số lần sủa) được co giãn theo bề ngang màn hình, không bị tràn trên màn hình hẹp (≤360px).
  - Nút "SỦA!" lớn đặt chính giữa đáy màn hình, cảm ứng êm ái, độ sáng 0.92 rõ nét ngay cả khi mic đang bật.
- **Màn kết quả, Cài đặt, Bảng xếp hạng, Online**:
  - Màn kết quả: chữ K.O. đỏ và bảng kết quả cân đối trên màn hình dọc, 2 nút hành động (Trận tiếp / Menu chính) vừa vặn ngón cái.
  - Bảng xếp hạng: 3 thẻ tóm tắt Thắng / Thua / Tổng WP dàn hàng ngang đều đẹp.
  - Cài đặt & Online: thanh trượt cảm ứng rộng, mã phòng 5 ký tự to rõ dễ sao chép.
  - Khắc phục triệt để hiện tượng dính hiệu ứng `:hover` trên màn hình cảm ứng, bổ sung hiệu ứng `:active` co giãn tức thì khi chạm.
  - Hỗ trợ đầy đủ màn hình xoay ngang (landscape) và màn hình gập siêu nhỏ (≤360px).

---

# Thay đổi (v9 — sủa thật = chó sủa ngay)

**Vấn đề:** người sủa 1 tiếng nhưng chó trong game sủa trễ hoặc không sủa (nhất là Pug, Labrador, Chow speed thấp).

- **Mic không còn bị chỉ số speed chặn.** Trước đây mỗi chó có thời gian nghỉ 250–450ms, trong lúc nghỉ mọi tiếng sủa thật bị bỏ. Nay mic dùng chung 1 khoảng nghỉ chống nhiễu rất ngắn
  (`CONFIG.MIC.COOLDOWN_MS` = 60ms). 1 tiếng sủa thật = đúng 1 tiếng sủa trong game, chó nào cũng vậy.
- **Tính bark ngay lúc vượt ngưỡng**, không chờ sủa xong (`BarkDetector.js`). Chờ thêm `CONFIG.MIC.ONSET_PEAK_MS` = 45ms để đo đỉnh âm lượng rồi bắn.
  Tiếng sủa kéo dài vẫn chỉ tính 1 lần; sủa rất ngắn vẫn được tính.
- **Đọc mic không còn bỏ sót.** Trước đây mỗi frame (~16ms) chỉ đọc 6ms âm thanh. Nay quét cả đoạn mới bằng cửa sổ trượt rồi lấy đỉnh (`MicrophoneManager.getRMS(dt)`); thang đo cũ nên ngưỡng nhạy giữ nguyên.
- **Speed có tác dụng mới: thưởng nhịp nhanh.** Hai tiếng sủa cách nhau ≤0,3s → lực nhân thêm tới `TEMPO_MAX × (speed-1)/4` (speed 1: +0%, 3: +10%, 5: +20%), giảm dần về 0 tại 0,6s.
  Áp cho mọi chế độ (mic, nút chạm, AI, online — host tính cho cả guest). Chỉnh ở `CONFIG.STATS.TEMPO_*`.
- Speed vẫn quyết định thời gian nghỉ của **nút chạm** và nhịp sủa của **AI** (không đổi).
- Màn chọn nhân vật hiện thưởng nhịp nhanh thay cho dòng "nghỉ giữa 2 tiếng".
- Âm lượng mỗi bark giờ là đỉnh trong 45ms đầu nên có thể thấp hơn đôi chút so với đỉnh cả tiếng; nếu thấy yếu, tăng `PUSH_BASE` hoặc hạ ngưỡng mic ở Cài đặt.

- **Nút chạm bấm nhanh chó sủa theo kịp.** Trước đây mỗi lần bấm bị chặn `cooldown chó + 250ms` = 500–700ms (tối đa ~2 lần/giây). Nay mỗi lần bấm là 1 tiếng sủa ngay (chỉ chống nhận đôi trong 70ms).
  Để không áp đảo mic, bấm dồn hơn 280ms/lần thì mỗi lần nhẹ dần (tối thiểu ×0,35) — chỉnh ở `CONFIG.TAP` (`MIN_GAP_MS`, `FULL_MS`, `MIN_FACTOR`).
- Chó giữ tư thế sủa 140ms (trước 220ms) và nảy lên một nhịp mỗi tiếng, nên sủa/bấm dồn vẫn thấy từng nhịp.

---

# Thay đổi (v8 — hoạt hình mạnh mẽ)

- Quay lại phong cách hoạt hình của v6 nhưng bỏ vẻ trẻ con: hoàng hôn rực lửa (tím → đỏ cam), núi đen viền mực, tia sáng bùng nổ xoay chậm,
  nút/bảng vát chéo viền mực dày + bóng cứng, chữ Oswald đậm, logo "FIGHTER" gradient vàng–cam. Đổi màu: các biến đầu `css/cartoon.css`.
- Hai chú chó ở menu gầm gừ rồi phình to + rung + vạch xung kích khi sủa.
- Lớp phủ cam đỏ khi thắng thế đậm hơn v6 (`TINT_WARM_MAX` = 0.65 trong `config.js`).

# (v6 — hoạt hình + assets tự nhận + 9 chú chó mới)

- **Giao diện hoạt hình**: `css/cartoon.css` — trời xanh + đồi cỏ, mây trôi, nét viền mực, nút kẹo dẻo nảy/co khi bấm, thẻ dán hơi nghiêng,
  chữ logo rơi vào từng chữ, hai chú chó ở menu nhún nhảy co dãn. Bỏ kiểu thẻ kính mờ/xanh rừng cũ. Đổi màu: các biến đầu `cartoon.css`.
- **assets tự cập nhật**: quét thư mục, nhận ảnh tên bất kỳ; ảnh lạ tự thành nhân vật/bối cảnh mới; quay lại cửa sổ game là tự nạp ảnh mới. Xem `assets/README.md`.
- **9 nhân vật chó** cắt từ bảng skin (Shiba, Golden, Husky, Corgi, Pug, Poodle, Beagle, Labrador đen, Malamute): có ảnh đứng yên + sủa + icon.
  Chow Chow chưa có ảnh nên bị ẩn cho tới khi bạn thả ảnh vào `assets/characters/chow/`.
- Lớp phủ màu cam/xanh khi thắng/thua thế đã giảm nhẹ để thấy rõ chó và nền (`TINT_*` trong `config.js`).

---

# Thay đổi (v5 — giống video gốc + chơi online + giao diện mới)

## Giao diện hiện đại & ngôn ngữ
- Toàn bộ chữ trong game chỉ còn **tiếng Việt và tiếng Anh** (đã bỏ hết chữ Nhật; từ sủa là GÂU!, WOOF!, BARK!...).
- Giao diện mới tông **xanh rừng Lâm Đồng (#123C35) + vàng hổ phách**: thẻ kính mờ bo tròn, nút dạng viên thuốc, bóng đổ mềm,
  menu có hai chú chó đối mặt (`js/effects/MenuHero.js`), phông chữ Be Vietnam Pro + Baloo 2 (hỗ trợ đủ dấu tiếng Việt).
- Muốn đổi màu/phông: sửa các biến ở đầu `css/main.css`; chi tiết từng thành phần nằm trong `css/theme.css`.


## Giống video hơn
- **Kích thước chó theo gauge**: bên thắng thế phình to (tối đa +75%), mặt dữ tợn (lông mày cau, nhe nanh, gân giận);
  bên thua teo nhỏ (còn 50%), mắt hoảng, đổ mồ hôi. **K.O. → con thua bị hất bay** khỏi màn hình. Chỉnh ở `CONFIG.EFFECTS.DOM_GROW / DOM_SHRINK`.
- **Màn hình ngả đỏ/cam đậm dần** khi bạn thắng thế (xanh xám khi bị lép vế) — `#tint-overlay`, `CONFIG.EFFECTS.TINT_*`.
- **Chữ sủa dày đặc**: 7–23 chữ mỗi tiếng, 7 kiểu chữ (Nhật + Latin), cỡ/góc xoay khác nhau, có chữ dọc, kèm vệt gạch vàng — `js/effects/BarkTextEffect.js`.
- **Gauge 2 màu** (hồng-cam của bạn / xanh dương), con trượt có chữ **"50%"**, tên hai bên.
- **Đếm ngược**: số vàng nhỏ giữa hai chú chó → chữ đỏ **SỦA ĐI!**.
- **Dòng hướng dẫn** trong trận: tiếng Việt kèm phụ đề tiếng Anh.
- **Màn kết quả**: bảng nâu mờ viền vàng phủ lên chính cảnh trận (ảnh chụp canvas), chữ K.O. đỏ phía sau, hai nút nhỏ.
- **Hình ảnh**: bãi biển (biển hiệu QUÁN BIỂN) vẽ bằng code (quán biển, ô, cột đèn, xe đạp, cát hạt, màu xỉn) làm bối cảnh mặc định;
  chó vẽ lại kiểu nét mực vẽ tay, mặt nhìn thẳng. Vẫn thả ảnh vào `assets/` được như cũ (ảnh ưu tiên hơn hình vẽ code).

## Online 2 người (WebRTC qua PeerJS)
- Menu → **ONLINE 2 NGƯỜI** → Tạo phòng (nhận mã 5 ký tự / liên kết mời `?room=MÃ`) hoặc Vào phòng.
- Hai bên chọn chiến binh, bấm SẴN SÀNG → vào trận. Sau trận có **Đấu lại**.
- Host là "trọng tài" (tính lực, gauge, đồng hồ); guest gửi tiếng sủa và nhận số liệu về. Có hiển thị ping.
- Thoát/đứt mạng giữa trận → đối thủ thắng (WP như thắng hết giờ). Trận online không đổi độ khó AI.
- Mã nguồn: `js/net/NetSession.js`, `js/screens/OnlineLobbyScreen.js`, `js/game/BattleManager.js` (mode 'host'/'guest').
- **Công bằng online**: hết giờ mà gauge ở vùng hoà thì ai nhích hơn thắng (bằng nhau → ai sủa nhiều hơn → tung đồng xu), không còn mặc định host thắng. Host tự làm chậm lực đẩy gauge của mình bằng ½ ping (tối đa 150ms) để cân với độ trễ của guest (`MAX_HOST_DELAY` trong `BattleManager.js`).
- **Ân hạn cuối trận**: hết giờ host chờ thêm ~1 ping (tối đa 200ms) rồi mới chốt, để tiếng sủa cuối của guest kịp tới (`MAX_GRACE`).
- Màn Online có ô **trạng thái máy chủ ghép phòng** (xanh/vàng/đỏ + ms) và nút Kiểm tra lại; trong phòng có hiển thị ping.
- Thư viện PeerJS đã gói sẵn ở `js/vendor/`. Cần mạng để ghép phòng (máy chủ công cộng của PeerJS); sau đó dữ liệu đi thẳng máy–máy.
  Một số mạng khắt khe (NAT đối xứng, mạng công ty) cần máy chủ TURN — thêm vào `ICE` trong `NetSession.js` nếu cần.
- Mic cần https hoặc localhost. Để chơi qua Internet bạn cần đưa game lên một hosting https (GitHub Pages, Netlify...).

---

# Thay đổi

## Chỉ số nhân vật có tác dụng thật (bản này)
- **speed (tốc độ)** → thời gian nghỉ giữa 2 tiếng sủa: 450ms (speed 1) … 250ms (speed 5). Áp cho mic, nút chạm (cooldown + 250ms) và AI.
- **combo** → cửa sổ giữ combo 1,7–2,7 giây và hệ số mỗi bậc +0,19–0,31.
- **power (sức mạnh)** → ±15% mỗi bậc (trước đây chia cho 3 nên chênh lệch quá lớn: Pug mạnh gấp 2,5 lần Corgi).
- Màn chọn nhân vật hiện thông số thật (ms nghỉ, thời gian giữ combo).
- Chow Chow: volume ×1.15 (trước ×1.4, quá mạnh).
- Tất cả chỉnh ở `CONFIG.STATS` trong `js/data/config.js`; logic ở `js/game/CharStats.js`. Chỉ số 3 = giá trị cũ nên Shiba chơi y như trước.

## Bản giao diện + assets
1. **Thanh kéo co (gauge)**: con trượt và phần màu cam trước đây chạy NGƯỢC nhau; nay khớp nhau và giống video
   (bạn sủa → con trượt chạy sang phải, về phía đối thủ). Bỏ trễ kép (CSS + JS), làm mượt theo thời gian thật.
2. **Thanh mic**: vạch ngưỡng giờ đúng ngưỡng thật; nếu mic lỗi sẽ hiện thông báo lý do + chạm ô Vol để thử lại.
3. **Điện thoại**: viewport an toàn (tai thỏ), canvas nét theo màn retina, nhân vật/nền co theo màn hình dọc,
   HUD không còn bị nút ✕ đè, màn Chọn nhân vật có nút BẮT ĐẦU dính đáy, menu/kết quả cuộn được, chế độ xoay ngang.
   Toàn bộ chỉnh sửa mobile nằm trong `css/responsive.css`.
4. **assets/**: thay nhân vật, nền, logo, menu, âm thanh bằng file (xem `assets/README.md`). Thiếu file → tự vẽ bằng code.
5. **Chọn bối cảnh** trong màn Chọn nhân vật (trước đây không có cách mở khoá bối cảnh).
6. Sửa lỗi: listener màn Cài đặt bị gắn chồng mỗi lần mở.

## Phiên bản trước
Cân bằng combo, chống spam nút chạm, chặn trận "ma" khi thoát lúc đếm ngược.

Chạy bằng Live Server / localhost (ES modules + mic cần secure context).

## v18 — Vá lỗi online
- **Mất kết nối không còn tính "thắng bỏ cuộc" cho cả hai bên.** Chỉ khi đối thủ chủ động thoát (tin `quit`) bạn mới thắng; còn `__close` → trận kết thúc "Mất kết nối": không thắng/thua, không cộng WP, không ghi lịch sử.
- **Kiểm tra phiên bản giao thức** (`PROTOCOL_VERSION` trong net-config.js) trong tin `pick`: hai máy lệch bản sẽ báo lỗi và ngắt thay vì chơi lệch số liệu. Nhớ tăng số này khi đổi định dạng tin nhắn.
- sw.js VERSION → v22.

## v19 — Ổn định online 2 người (vòng 2)
- **Host kẹt ở màn kết quả khi có khách mới vào**: nay tự đưa về sảnh phòng; trạng thái khách cũ (chọn chó, sẵn sàng, cờ đấu lại) được xoá sạch khi họ rời.
- **Thanh lực guest bị giật lùi**: host nay vẫn gửi xác nhận khi bỏ một tiếng sủa (chống spam), guest gỡ lực dự đoán ngay thay vì giữ ảo 1,5 giây.
- **Vào phòng thử lại thật sự**: `peer-unavailable` thoáng qua (host đang nối lại máy chủ ghép phòng) được thử lại tối đa 3 lần, cách 1,5s, rồi mới báo "không tìm thấy phòng".
- **Cache ICE**: khi đã cấu hình Metered mà lần gọi lỗi thoáng qua, chỉ dùng TURN công cộng 30 giây rồi thử lại Metered (trước đây kẹt 10 phút).
- Nhãn màn kết quả hiện đúng "đối thủ muốn đấu lại" dù họ bấm từ lúc bạn còn ở màn trận.
- Không dò lại máy chủ mỗi lần vào sảnh nếu vừa dò ổn trong 60 giây.
- PROTOCOL_VERSION → 3, sw.js VERSION → v23.
