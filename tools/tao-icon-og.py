#!/usr/bin/env python3
"""Tạo icon ứng dụng (PWA/favicon) và ảnh xem trước khi chia sẻ link (og-image) từ ảnh nhân vật + nền có sẵn.
Chạy: python3 tools/tao-icon-og.py   (cần Pillow)"""
import os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
R = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
ICONS = os.path.join(R, 'icons'); os.makedirs(ICONS, exist_ok=True)
BG = (36, 21, 16)

def sprite(name, h):
    im = Image.open(os.path.join(R, 'assets/characters', name, 'idle.webp')).convert('RGBA')
    return im.resize((int(im.width * h / im.height), h), Image.LANCZOS)

def icon(size, maskable=False):
    # nền nâu + quầng sáng ấm; chó nằm trong vùng an toàn (maskable: 60% giữa)
    base = Image.new('RGBA', (size, size), BG + (255,))
    glow = Image.new('RGBA', (size, size), (0, 0, 0, 0)); d = ImageDraw.Draw(glow)
    d.ellipse((size * .12, size * .12, size * .88, size * .88), fill=(248, 160, 70, 90))
    base.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size * .08)))
    dog = sprite('pug', int(size * (.52 if maskable else .70)))
    base.alpha_composite(dog, ((size - dog.width) // 2, (size - dog.height) // 2 + int(size * .02)))
    if maskable: return base                           # hệ điều hành tự cắt hình
    m = Image.new('L', (size, size), 0); ImageDraw.Draw(m).rounded_rectangle((0, 0, size - 1, size - 1), int(size * .22), fill=255)
    res = Image.new('RGBA', (size, size), (0, 0, 0, 0)); res.paste(base, (0, 0), m); return res

icon(512).save(f'{ICONS}/icon-512.png', optimize=True)
icon(192).save(f'{ICONS}/icon-192.png', optimize=True)
icon(512, True).save(f'{ICONS}/icon-maskable-512.png', optimize=True)
a = Image.new('RGBA', (180, 180), BG + (255,)); a.alpha_composite(icon(180, True)); a.convert('RGB').save(f'{ICONS}/apple-touch-icon.png', optimize=True)
icon(48).save(f'{ICONS}/favicon-48.png', optimize=True)
icon(32).save(f'{ICONS}/favicon-32.png', optimize=True)

# ── og-image 1200x630 ──
W, H = 1200, 630
bg = Image.open(os.path.join(R, 'assets/backgrounds/Sunset Cafe Plaza in a Storybook Town.webp')).convert('RGB')
s = max(W / bg.width, H / bg.height); bg = bg.resize((int(bg.width * s) + 1, int(bg.height * s) + 1), Image.LANCZOS)
og = bg.crop(((bg.width - W) // 2, (bg.height - H) // 2, (bg.width - W) // 2 + W, (bg.height - H) // 2 + H)).convert('RGBA')
sh = Image.new('RGBA', (W, H), (0, 0, 0, 0)); px = sh.load()
for y in range(H):
    for x in range(W):
        a_ = int(185 * (1 - x / W * .75) + 35 * (y / H))
        px[x, y] = (30, 16, 10, min(235, a_))
og.alpha_composite(sh)
for name, x in (('husky', 700), ('pug', 850)):
    dg = sprite(name, 330); og.alpha_composite(dg, (x, H - dg.height - 40))
dr = ImageDraw.Draw(og)
B = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'
def text(xy, t, size, fill, stroke=(60, 28, 12)):
    f = ImageFont.truetype(B, size); dr.text(xy, t, font=f, fill=fill, stroke_width=max(2, size // 22), stroke_fill=stroke)
def paw(cx, cy, r, fill=(255, 214, 102)):
    """Vẽ dấu chân (4 ngón + đệm) tâm (cx, cy), bán kính r"""
    for dx, dy, k in ((-1.15, -0.35, .30), (-0.42, -1.0, .32), (0.42, -1.0, .32), (1.15, -0.35, .30)):
        x, y, rr = cx + dx * r * .62, cy + dy * r * .62, r * k
        dr.ellipse((x - rr, y - rr * 1.25, x + rr, y + rr * 1.25), fill=fill)
    dr.ellipse((cx - r * .62, cy - r * .12, cx + r * .62, cy + r * .78), fill=fill)
paw(112, 96, 52)
text((190, 66), 'GÂU GÂU', 118, (255, 214, 102))
text((70, 200), 'BATTLE', 150, (240, 122, 58))
text((74, 392), 'Buồn bực? Sủa lên cho đỡ stress!', 40, (255, 240, 220))
text((74, 452), 'Đấu với bot hoặc online 2 người', 30, (240, 210, 170), stroke=(40, 20, 10))
# Ảnh chia sẻ link nay làm từ tranh minh hoạ: python3 tools/tao-og-tu-anh.py <anh-goc>  → icons/og-gaune-v3.jpg
# (dòng cũ tạo og-gau-gau-battle.jpg đã bỏ để không ghi đè nhầm)
for f in sorted(os.listdir(ICONS)): print(f, os.path.getsize(os.path.join(ICONS, f)) // 1024, 'KB')
