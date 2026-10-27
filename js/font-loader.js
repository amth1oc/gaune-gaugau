// Bật stylesheet font (đang media="print" nên không chặn hiển thị) ngay khi tải xong.
// Có file riêng (không dùng onload nội tuyến) để tương thích Content-Security-Policy.
(function () {
  var l = document.getElementById('gfonts');
  if (!l) return;
  var on = function () { l.media = 'all'; };
  if (l.sheet) on(); else l.addEventListener('load', on);
  setTimeout(on, 4000);          // mạng chậm/lỗi: vẫn bật để trình duyệt tự dùng font hệ thống thay thế
})();
