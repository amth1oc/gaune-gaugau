// Đặt ngôn ngữ + giao diện sáng/tối NGAY khi trang bắt đầu (trước khi vẽ) để không bị chớp sai màu / sai chữ.
// File riêng (không dùng <script> nội tuyến) để tương thích Content-Security-Policy `script-src 'self'`.
(function () {
  try {
    var d = document.documentElement, ls = window.localStorage;
    var th = ls.getItem('chosua_theme');
    if (th !== 'night' && th !== 'day') th = 'day';
    d.dataset.theme = th;
    var cs = document.querySelector('meta[name="color-scheme"]'); if (cs) cs.setAttribute('content', th === 'night' ? 'dark' : 'light');
    var lg = ls.getItem('chosua_lang');
    if (lg !== 'vi' && lg !== 'en') lg = ((navigator.language || 'vi').toLowerCase().indexOf('vi') === 0) ? 'vi' : 'en';
    d.lang = lg; d.dataset.lang = lg;
    if (th === 'night') {
      d.dataset.nightLoaded = '1';
      var m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', '#0a1030');
      // nạp trước ảnh đêm (bản nhỏ cho điện thoại) để nền không hiện muộn
      var l = document.createElement('link'); l.rel = 'preload'; l.as = 'image';
      l.href = (window.matchMedia && window.matchMedia('(max-width: 700px)').matches)
        ? 'assets/theme/night-backyard-sm.webp' : 'assets/theme/night-backyard.webp';
      document.head.appendChild(l);
    }
  } catch (e) { /* localStorage bị chặn: dùng mặc định */ }
})();
