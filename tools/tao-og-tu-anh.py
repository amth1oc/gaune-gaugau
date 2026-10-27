#!/usr/bin/env python3
"""Tạo ảnh xem trước khi chia sẻ link (Zalo / Messenger / Facebook) từ ảnh minh hoạ gốc.
Dùng:  python3 tools/tao-og-tu-anh.py duong-dan-anh-goc.jpg
- Kích thước chuẩn 1200x630 (tỉ lệ 1.91:1 mà Zalo/Facebook hiển thị).
- Ảnh gốc KHÔNG bị cắt: đặt vừa chiều cao, hai bên lấp bằng chính ảnh đó phóng to + làm mờ (nhìn liền mạch, không viền đen).
- Xuất icons/og-gaune-v3.jpg — đổi tên mỗi lần sửa ảnh để Zalo/Facebook không dùng ảnh cũ trong bộ nhớ đệm.
"""
import sys, os
from PIL import Image, ImageFilter
src = sys.argv[1] if len(sys.argv) > 1 else None
if not src: sys.exit(__doc__)
W, H = 1200, 630
art = Image.open(src).convert('RGB')
bg = art.copy()
s = max(W / bg.width, H / bg.height)
bg = bg.resize((round(bg.width * s), round(bg.height * s)), Image.LANCZOS)
bg = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H))
bg = bg.filter(ImageFilter.GaussianBlur(28))
bg = Image.eval(bg, lambda v: int(v * 0.82))          # tối nhẹ để tranh chính nổi bật
fg_w = round(art.width * H / art.height)
fg = art.resize((fg_w, H), Image.LANCZOS)
x = (W - fg_w) // 2
# viền mờ nhẹ hai mép tranh chính cho liền với nền
mask = Image.new('L', (fg_w, H), 255)
edge = 18
for i in range(edge):
    v = int(255 * i / edge)
    for xx in (i, fg_w - 1 - i):
        for yy in range(H): mask.putpixel((xx, yy), v)
bg.paste(fg, (x, 0), mask)
out = os.path.join(os.path.dirname(__file__), '..', 'icons', 'og-gaune-v3.jpg')
bg.save(out, quality=86, optimize=True, progressive=True)
print('Đã tạo', os.path.normpath(out), os.path.getsize(out) // 1024, 'KB')
