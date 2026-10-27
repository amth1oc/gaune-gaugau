#!/usr/bin/env python3
"""
tao-am-thanh.py — Tự tạo âm thanh TỔNG HỢP (không dùng mẫu có bản quyền).

Mặc định chỉ tạo 2 tiếng bíp đếm ngược (countdown-tick.mp3, countdown-go.mp3).
Thêm cờ  --tong-hop  để tạo lại luôn bản tổng hợp của: tiếng sủa (bark-*, aibark-*) và nhạc (music-menu, music-battle).
CẢNH BÁO: --tong-hop sẽ GHI ĐÈ tiếng sủa và nhạc thật hiện đang dùng trong assets/audio/.

Chạy:  python3 tools/tao-am-thanh.py            (cần numpy, scipy và ffmpeg)
Muốn đổi nhạc/tiếng: cứ thả file mp3/ogg/wav của bạn vào assets/audio/ (tên có chữ bark / aibark / menu / battle ...)
rồi bấm cap-nhat-assets.bat là game tự nhận.
"""
import os, subprocess, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
OUT = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'audio'))
os.makedirs(OUT, exist_ok=True)

# ───────────────────────── tiện ích ─────────────────────────
_NOTE = {'C': 0, 'D': 2, 'E': 4, 'F': 5, 'G': 7, 'A': 9, 'B': 11}


def nm(s):
    """'A5' -> số MIDI (A4 = 69). Hỗ trợ # và b."""
    v = _NOTE[s[0]]; i = 1
    if s[i] in '#b':
        v += 1 if s[i] == '#' else -1; i += 1
    return 12 * (int(s[i:]) + 1) + v


def hz(m): return 440.0 * 2 ** ((m - 69) / 12)


def tt(dur): return np.arange(int(dur * SR)) / SR


def lowpass(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'low', fs=SR, output='sos'), x)
def highpass(x, fc, order=2): return signal.sosfilt(signal.butter(order, fc, 'high', fs=SR, output='sos'), x)
def bandpass(x, lo, hi, order=2): return signal.sosfilt(signal.butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


def norm(x, peak):
    m = np.max(np.abs(x))
    return x * (peak / m) if m > 0 else x


def rms_db(x): return 20 * np.log10(np.sqrt(np.mean(np.square(x))) + 1e-12)


def to_mp3(name, data, bitrate='96k', stereo=False):
    """Ghi wav tạm rồi mã hoá mp3 bằng ffmpeg (mp3 có header gapless để nhạc lặp liền mạch)."""
    pcm = np.int16(np.clip(data, -1, 1) * 32767)
    with tempfile.TemporaryDirectory() as d:
        w = os.path.join(d, 'x.wav'); wavfile.write(w, SR, pcm)
        dst = os.path.join(OUT, name)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', w, '-codec:a', 'libmp3lame',
                        '-b:a', bitrate, '-ac', '2' if stereo else '1', dst], check=True)
    print(f'  {name:<20} {os.path.getsize(dst) / 1024:6.1f} KB   {len(data) / SR:5.2f}s')


# ───────────────────────── TIẾNG SỦA ─────────────────────────
def bark(f_start, f_end, dur, rough=0.2, noise=0.35, bright=1.0, f1_peak=800, seed=0, grit=1.8):
    """
    Mô hình giọng: dây thanh (chuỗi hài) × cộng hưởng miệng (formant F1/F2/F3 trượt theo
    "g-â-u") + tiếng "khịt" ồn ở đầu + rung thô (rough) tạo cảm giác gằn.
    """
    r = np.random.default_rng(seed)
    n = int(dur * SR); t = np.arange(n) / SR; u = t / dur
    f0 = f_end + (f_start - f_end) * np.exp(-t / (dur * 0.4))
    f0 = f0 * np.minimum(1.0, 0.82 + t / 0.025 * 0.18)                    # nhấc giọng nhanh lúc đầu
    jit = signal.sosfilt(signal.butter(2, 30, fs=SR, output='sos'), r.standard_normal(n))
    f0 = f0 * (1 + jit / (np.std(jit) + 1e-9) * 0.015)                     # run nhẹ cao độ
    phase = np.cumsum(2 * np.pi * f0 / SR)

    open_ = np.sin(np.pi * np.clip(u * 1.1, 0, 1))                         # miệng há ra rồi khép
    F1 = 430 + (f1_peak - 430) * open_
    F2 = 1250 + 450 * open_ - 250 * u
    F3 = 2700 + 0 * u
    sig = np.zeros(n)
    for k in range(1, int(9000 / f0.min()) + 1):
        fk = k * f0
        form = (1 / (1 + ((fk - F1) / 160) ** 2) + 0.7 / (1 + ((fk - F2) / 280) ** 2)
                + 0.35 / (1 + ((fk - F3) / 400) ** 2) + 0.04)
        sig += (1 / k ** 0.85) * form * (fk < 9000 * bright) * np.sin(k * phase + r.uniform(0, 2 * np.pi))
    sig /= np.max(np.abs(sig)) + 1e-9

    att = 1 - np.exp(-t / 0.005)
    dec = np.exp(-t / (dur * 0.42))
    fade = np.clip((dur - t) / 0.02, 0, 1)
    env = att * dec * fade
    growl = 1 - rough * (0.5 + 0.5 * np.sin(2 * np.pi * (68 + r.uniform(0, 14)) * t))
    body = sig * env * growl

    nz = bandpass(r.standard_normal(n), 900, 5500 * bright)
    nz = nz / (np.max(np.abs(nz)) + 1e-9) * (0.9 * np.exp(-t / 0.018) + 0.18 * dec) * att * fade * noise
    x = lowpass(body + nz, 8000)
    x = np.tanh(grit * x) / np.tanh(grit)                                  # hơi "rè" cho giống thật
    return x


def make_barks():
    print('Tiếng sủa:')
    # TA: cao, sáng, gọn → nghe "gâu!" vui, thân thiện
    ally = [(520, 380, 0.22, 0.12, 0.30, 1.0, 820), (470, 335, 0.26, 0.15, 0.32, 1.0, 780),
            (580, 410, 0.17, 0.10, 0.28, 1.1, 860), (440, 305, 0.30, 0.16, 0.34, 0.9, 760)]
    # ĐỊCH: trầm, gằn, nhiều tiếng ồn hơn → nghe "GRÂU!" dữ hơn, tách biệt rõ với tiếng của ta
    enemy = [(330, 215, 0.28, 0.42, 0.45, 0.8, 640), (290, 190, 0.34, 0.48, 0.48, 0.75, 600),
             (360, 240, 0.24, 0.38, 0.42, 0.85, 680), (255, 165, 0.40, 0.52, 0.50, 0.7, 560)]
    for i, (a, b, d, ro, no, br, f1) in enumerate(ally, 1):
        to_mp3(f'bark-{i}.mp3', norm(bark(a, b, d, ro, no, br, f1, seed=10 + i), 0.63), '64k')
    for i, (a, b, d, ro, no, br, f1) in enumerate(enemy, 1):
        to_mp3(f'aibark-{i}.mp3', norm(bark(a, b, d, ro, no, br, f1, seed=40 + i, grit=2.4), 0.63), '64k')


# ───────────────────────── BÍP ĐẾM NGƯỢC ─────────────────────────
def beep(freq, dur, tau, harm=(1, 0.30, 0.12)):
    t = tt(dur)
    x = sum(a * np.sin(2 * np.pi * freq * (i + 1) * t) for i, a in enumerate(harm))
    env = (1 - np.exp(-t / 0.003)) * np.exp(-t / tau) * np.clip((dur - t) / 0.03, 0, 1)
    return x * env


def make_beeps():
    print('Bíp đếm ngược:')
    tick = beep(740, 0.16, 0.09)                                           # "bíp" ngắn, vừa
    go = beep(1480, 0.62, 0.40) + 0.5 * beep(740, 0.62, 0.40, (1, 0.2, 0.0))   # "BÍÍÍP" dài, cao, rõ
    to_mp3('countdown-tick.mp3', norm(tick, 0.70), '64k')
    to_mp3('countdown-go.mp3', norm(go, 0.78), '64k')


# ───────────────────────── NHẠC CỤ & TRỐNG ─────────────────────────
def marimba(f, dur=1.1):
    t = tt(dur)
    x = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.33) + 0.45 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t / 0.08)
         + 0.15 * np.sin(2 * np.pi * 10 * f * t) * np.exp(-t / 0.03))
    return x * (1 - np.exp(-t / 0.002))


def pluck(f, dur=1.0):
    t = tt(dur)
    x = sum((1 / n ** 1.1) * np.sin(2 * np.pi * f * n * t) * np.exp(-t * (4 + 3 * n)) for n in range(1, 11) if f * n < 12000)
    return x * (1 - np.exp(-t / 0.002))


def soft_bass(f, dur):
    t = tt(dur + 0.12)
    x = np.sin(2 * np.pi * f * t) + 0.40 * np.sin(2 * np.pi * 2 * f * t) + 0.16 * np.sin(2 * np.pi * 3 * f * t)
    env = (1 - np.exp(-t / 0.006)) * np.exp(-t / 0.45) * np.clip((dur + 0.12 - t) / 0.1, 0, 1)
    return x * env


def saw(ph, kmax=14, f=100):
    return sum(np.sin(k * ph) / k for k in range(1, kmax + 1) if f * k < 12000)


def saw_bass(f, dur):
    n = int((dur + 0.04) * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * f * t
    x = lowpass(saw(ph, 16, f), 1100) * 0.8 + np.sin(ph) * 0.7
    return x * (1 - np.exp(-t / 0.004)) * np.clip((dur + 0.04 - t) / 0.04, 0, 1)


def lead(f, dur, vib=5.6, vdepth=0.004):
    n = int((dur + 0.12) * SR); t = np.arange(n) / SR
    vr = 1 + vdepth * np.sin(2 * np.pi * vib * t) * np.clip((t - 0.08) / 0.15, 0, 1)
    ph = np.cumsum(2 * np.pi * f * vr / SR)
    sq = lambda p: sum(np.sin(k * p) / k for k in range(1, 40, 2) if f * k < 9000)
    x = sq(ph) + 0.6 * sq(ph * 1.005)                                       # 2 lớp lệch nhẹ = dày hơn
    env = np.minimum(1, t / 0.008) * (0.82 + 0.18 * np.exp(-t / 0.15)) * np.clip((dur + 0.12 - t) / 0.12, 0, 1)
    return lowpass(x, 5200) * env


def arp_note(f, dur=0.2):
    t = tt(dur)
    ph = 2 * np.pi * f * t
    return lowpass(saw(ph, 10, f), 3600) * np.exp(-t / 0.07) * (1 - np.exp(-t / 0.002))


def pad(f, dur):
    n = int((dur + 0.4) * SR); t = np.arange(n) / SR
    x = sum(saw(2 * np.pi * f * d * t, 8, f) for d in (0.997, 1.003))
    env = np.minimum(1, t / 0.18) * np.clip((dur + 0.4 - t) / 0.4, 0, 1)
    return lowpass(x, 1500) * env


def kick(dur=0.32):
    t = tt(dur)
    ph = np.cumsum(2 * np.pi * (46 + 120 * np.exp(-t / 0.032)) / SR)
    click = np.random.default_rng(1).standard_normal(len(t)) * np.exp(-t / 0.004) * 0.25
    return (np.sin(ph) * np.exp(-t / 0.12) + click) * np.clip((dur - t) / 0.02, 0, 1)


def snare(dur=0.26, seed=2):
    t = tt(dur); r = np.random.default_rng(seed)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05) * 0.5
    nz = bandpass(r.standard_normal(len(t)), 1400, 7500) * np.exp(-t / 0.07)
    return (tone + nz * 0.9) * np.clip((dur - t) / 0.03, 0, 1)


def clap(seed=3):
    r = np.random.default_rng(seed); out = np.zeros(int(0.25 * SR))
    for d in (0, 0.011, 0.023):
        b = bandpass(r.standard_normal(int(0.2 * SR)), 1100, 5000) * np.exp(-tt(0.2) / 0.035)
        i = int(d * SR); out[i:i + len(b)] += b
    return out * 0.7


def hat(open_=False, seed=4):
    dur = 0.22 if open_ else 0.05; t = tt(dur)
    return highpass(np.random.default_rng(seed).standard_normal(len(t)), 7000) * np.exp(-t / (0.09 if open_ else 0.014))


def shaker(seed=5):
    t = tt(0.07)
    return bandpass(np.random.default_rng(seed).standard_normal(len(t)), 4500, 9500) * np.minimum(1, t / 0.008) * np.exp(-t / 0.03)


def rim():
    t = tt(0.05)
    return (np.sin(2 * np.pi * 1750 * t) * 0.6 + bandpass(np.random.default_rng(6).standard_normal(len(t)), 1500, 6000) * 0.5) * np.exp(-t / 0.012)


def crash(seed=7):
    t = tt(1.4)
    return highpass(np.random.default_rng(seed).standard_normal(len(t)), 4500) * np.exp(-t / 0.5) * (1 - np.exp(-t / 0.004))


class Bus:
    """Bộ trộn stereo; add() đặt 1 âm vào thời điểm (giây) với pan -1..1 (công suất không đổi)."""
    def __init__(self, n): self.l = np.zeros(n); self.r = np.zeros(n)

    def add(self, x, at, gain=1.0, pan=0.0):
        i = int(round(at * SR))
        if i >= len(self.l) or i < 0: return
        x = x[:len(self.l) - i]
        a = (pan + 1) * np.pi / 4
        self.l[i:i + len(x)] += x * gain * np.cos(a)
        self.r[i:i + len(x)] += x * gain * np.sin(a)


def reverb(bus, wet, rt=0.9, seed=11):
    r = np.random.default_rng(seed); n = int(rt * SR); t = np.arange(n) / SR
    out = []
    for ch in (bus.l, bus.r):
        ir = lowpass(r.standard_normal(n), 5000) * np.exp(-t / (rt / 4.5))
        ir[:int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        ir /= np.sqrt(np.sum(ir ** 2))
        out.append(signal.fftconvolve(ch, ir)[:len(ch)] * wet)
    return out


def duck_curve(n, kick_times, depth=0.6, tau=0.11):
    g = np.ones(n)
    for k in kick_times:
        i = int(k * SR)
        if i >= n: continue
        m = min(n - i, int(0.5 * SR))
        g[i:i + m] = np.minimum(g[i:i + m], 1 - depth * np.exp(-np.arange(m) / SR / tau))
    return g


def finish(l, r, peak=0.78, target_db=-16.0):
    """Hạ về mức nghe êm (RMS ≈ target_db), chặn đỉnh mềm để không rè."""
    st = np.stack([l, r], 1)
    st *= 10 ** (target_db / 20) / (np.sqrt(np.mean(st ** 2)) + 1e-12)
    st = np.tanh(st * 1.15) / np.tanh(1.15)
    st = norm(st, peak)
    return st


# ───────────────────────── NHẠC MENU ─────────────────────────
def make_menu():
    print('Nhạc menu:')
    BPM, BARS = 108, 16
    STEPS = BARS * 16
    L = int(round(STEPS * 60 / BPM / 4 * SR)); LD = L / SR; S = LD / STEPS
    wet, dry = Bus(3 * L + SR), Bus(3 * L + SR)

    voic = {'C': ['C4', 'E4', 'G4', 'C5'], 'Am': ['A3', 'C4', 'E4', 'A4'], 'F': ['F3', 'A3', 'C4', 'F4'],
            'G': ['G3', 'B3', 'D4', 'G4'], 'Em': ['E3', 'G3', 'B3', 'E4']}
    root = {'C': 'C3', 'Am': 'A2', 'F': 'F2', 'G': 'G2', 'Em': 'E2'}
    prog = ['C', 'Am', 'F', 'G'] * 2 + ['F', 'G', 'Em', 'Am'] + ['F', 'G', 'C', 'G']

    mel = [  # (bước 16, nốt, độ dài bước) cho từng ô nhịp
        [(0, 'E5', 2), (2, 'G5', 2), (4, 'A5', 3), (8, 'G5', 4)],
        [(0, 'E5', 2), (2, 'A5', 2), (4, 'G5', 2), (6, 'E5', 2), (8, 'D5', 4), (12, 'C5', 4)],
        [(0, 'F5', 2), (2, 'A5', 2), (4, 'C6', 4), (8, 'A5', 2), (10, 'G5', 2), (12, 'F5', 4)],
        [(0, 'D5', 2), (2, 'G5', 2), (4, 'B5', 4), (8, 'A5', 2), (10, 'G5', 2), (12, 'D5', 4)],
        [(0, 'G5', 3), (3, 'E5', 1), (4, 'G5', 2), (6, 'C6', 2), (8, 'B5', 2), (10, 'G5', 2), (12, 'E5', 4)],
        [(0, 'A5', 3), (3, 'G5', 1), (4, 'E5', 2), (6, 'C5', 2), (8, 'E5', 4), (12, 'D5', 2), (14, 'C5', 2)],
        [(0, 'A5', 2), (2, 'C6', 2), (4, 'F6', 2), (6, 'E6', 2), (8, 'C6', 4), (12, 'A5', 4)],
        [(0, 'B5', 2), (2, 'D6', 2), (4, 'G5', 4), (8, 'B5', 2), (10, 'A5', 2), (12, 'G5', 4)],
        [(0, 'C6', 4), (4, 'A5', 2), (6, 'C6', 2), (8, 'A5', 4), (12, 'F5', 4)],
        [(0, 'B5', 4), (4, 'G5', 2), (6, 'B5', 2), (8, 'D6', 4), (12, 'B5', 4)],
        [(0, 'G5', 2), (2, 'B5', 2), (4, 'E6', 4), (8, 'D6', 2), (10, 'B5', 2), (12, 'G5', 4)],
        [(0, 'A5', 4), (4, 'C6', 2), (6, 'E6', 2), (8, 'D6', 2), (10, 'C6', 2), (12, 'A5', 4)],
        [(0, 'F5', 2), (2, 'A5', 2), (4, 'C6', 2), (6, 'A5', 2), (8, 'F5', 2), (10, 'A5', 2), (12, 'C6', 4)],
        [(0, 'D5', 2), (2, 'G5', 2), (4, 'B5', 2), (6, 'G5', 2), (8, 'D6', 4), (12, 'B5', 4)],
        [(0, 'E6', 4), (4, 'D6', 2), (6, 'C6', 2), (8, 'G5', 4), (12, 'E5', 4)],
        [(0, 'D5', 2), (2, 'F5', 2), (4, 'G5', 2), (6, 'B5', 2), (8, 'D6', 6)],
    ]
    cache = {}
    def cm(f):
        if f not in cache: cache[f] = marimba(f)
        return cache[f]
    def cp(f):
        if f not in cache: cache[('p', f)] = pluck(f)
        return cache[('p', f)]

    for rep in range(3):
        base = rep * LD
        for b in range(BARS):
            ch = prog[b]; bt = base + b * 16 * S
            rt = nm(root[ch])
            # bass: gốc – quãng 5 nhún nhảy
            for st, m, d in ((0, rt, 5), (6, rt + 7, 2), (8, rt, 5), (12, rt + 7, 3)):
                dry.add(soft_bass(hz(m), d * S), bt + st * S, 0.55, 0.0)
            # đàn gảy (ukulele) đánh bật: mạnh ở phách 2 & 4, nhẹ ở nốt đệm
            for st, g, down in ((2, 0.28, False), (4, 0.62, True), (6, 0.22, False), (10, 0.28, False), (12, 0.62, True), (14, 0.22, False)):
                notes = voic[ch] if down else voic[ch][::-1]
                for j, s in enumerate(notes):
                    wet.add(cp(hz(nm(s))), bt + st * S + j * 0.009, g * 0.5, -0.30)
            # giai điệu marimba
            for st, n_, d in mel[b]:
                wet.add(cm(hz(nm(n_))), bt + st * S, 0.46, 0.15)
            # nhịp: trống nhẹ + shaker + rim
            for st in (0, 8): dry.add(kick() , bt + st * S, 0.30)
            for st in (4, 12): dry.add(rim(), bt + st * S, 0.20, 0.1)
            for st in range(0, 16, 2): dry.add(shaker(5 + st % 3), bt + st * S, 0.20 if st % 4 else 0.12, 0.35)

    wl, wr = reverb(wet, 0.30, 1.0)
    l = (wet.l + wl + dry.l)[L:2 * L]; r = (wet.r + wr + dry.r)[L:2 * L]    # cắt đoạn giữa = lặp liền mạch (đuôi vang nối vào đầu)
    st = finish(l, r, target_db=-16.5)
    print(f'  (RMS {rms_db(st):.1f} dBFS, đỉnh {np.max(np.abs(st)):.2f})')
    to_mp3('music-menu.mp3', st, '96k', stereo=True)
    return st


# ───────────────────────── NHẠC TRẬN ─────────────────────────
def make_battle():
    print('Nhạc trận:')
    BPM, BARS = 144, 16
    STEPS = BARS * 16
    L = int(round(STEPS * 60 / BPM / 4 * SR)); LD = L / SR; S = LD / STEPS
    N = 3 * L + SR
    drums, bass, mid, wetb = Bus(N), Bus(N), Bus(N), Bus(N)

    prog = ['Am', 'F', 'C', 'G'] * 2 + ['F', 'G', 'Am', 'E'] + ['Am', 'F', 'C', 'E']
    root = {'Am': 'A2', 'F': 'F2', 'C': 'C3', 'G': 'G2', 'E': 'E2'}
    tones = {'Am': ['A3', 'C4', 'E4', 'A4'], 'F': ['F3', 'A3', 'C4', 'F4'], 'C': ['C4', 'E4', 'G4', 'C5'],
             'G': ['G3', 'B3', 'D4', 'G4'], 'E': ['E3', 'G#3', 'B3', 'E4']}

    riff = {  # giai điệu chính (lặp ở ô 1-4 và 5-8, 13-15)
        'Am': [(0, 'E5', 2), (2, 'A5', 2), (4, 'C6', 4), (8, 'B5', 2), (10, 'A5', 2), (12, 'E5', 4)],
        'F':  [(0, 'F5', 2), (2, 'A5', 2), (4, 'C6', 4), (8, 'A5', 2), (10, 'G5', 2), (12, 'F5', 4)],
        'C':  [(0, 'G5', 2), (2, 'C6', 2), (4, 'E6', 4), (8, 'D6', 2), (10, 'C6', 2), (12, 'G5', 4)],
        'G':  [(0, 'D6', 2), (2, 'B5', 2), (4, 'G5', 4), (8, 'A5', 2), (10, 'B5', 2), (12, 'D6', 4)],
    }
    bridge = [  # ô 9-12: nốt dài, căng dần
        [(0, 'C6', 6), (6, 'A5', 2), (8, 'C6', 4), (12, 'D6', 4)],
        [(0, 'D6', 6), (6, 'B5', 2), (8, 'D6', 4), (12, 'E6', 4)],
        [(0, 'E6', 6), (6, 'C6', 2), (8, 'E6', 4), (12, 'A6', 4)],
        [(0, 'B5', 4), (4, 'G#5', 4), (8, 'B5', 4), (12, 'E6', 4)],
    ]
    last = [(0, 'B5', 4), (4, 'G#5', 2), (6, 'B5', 2), (8, 'E6', 2), (10, 'D6', 2), (12, 'B5', 2), (14, 'G#5', 2)]

    kick_t = []
    K, SN, CL = kick(), snare(), clap()
    for rep in range(3):
        base = rep * LD
        for b in range(BARS):
            ch = prog[b]; bt = base + b * 16 * S
            rt = nm(root[ch])
            thick = (4 <= b < 8) or b >= 12                       # nửa sau mỗi đoạn: dày hơn

            # trống
            kst = [0, 4, 8, 12] + ([10] if b % 2 else [])
            for st in kst:
                drums.add(K, bt + st * S, 0.95); kick_t.append(bt + st * S)
            for st in (4, 12):
                drums.add(SN, bt + st * S, 0.55); drums.add(CL, bt + st * S, 0.35, 0.1)
            for st in range(16):
                if st == 14: drums.add(hat(True), bt + st * S, 0.20, 0.2)
                else: drums.add(hat(False, 4 + st % 4), bt + st * S, 0.17 if st % 2 == 0 else 0.08, 0.2)
            if b % 8 == 7:                                         # dồn trống cuối đoạn
                for j in range(8):
                    drums.add(snare(0.14, 20 + j), bt + (8 + j) * S, 0.18 + 0.07 * j)
            if b in (0, 8): drums.add(crash(), bt, 0.30, 0.0)

            # bass cưa nhấp nhô (quãng tám nhảy ở nốt 6 và 14)
            for st in range(0, 16, 2):
                m = rt + (12 if st in (6, 14) else 0)
                bass.add(saw_bass(hz(m), 1.6 * S), bt + st * S, 0.50)

            # pad nền
            for s in tones[ch][:3]:
                mid.add(pad(hz(nm(s)), 16 * S), bt, 0.05, -0.4 if s == tones[ch][0] else 0.4)

            # arpeggio 16
            pat = [0, 1, 2, 1]
            for st in range(16):
                f = hz(nm(tones[ch][pat[st % 4]]) + (12 if b >= 8 and b < 12 else 0))
                mid.add(arp_note(f), bt + st * S, 0.085 if not thick else 0.11, 0.3 if st % 2 else -0.3)

            # giai điệu
            if b < 8 or b >= 12:
                notes = last if b == 15 else riff.get(ch, riff['Am'] if ch == 'E' else None)
            else:
                notes = bridge[b - 8]
            if notes:
                for st, n_, d in notes:
                    m = nm(n_)
                    wetb.add(lead(hz(m), d * S * 0.95), bt + st * S, 0.17, 0.05)
                    if thick: wetb.add(lead(hz(m - 12), d * S * 0.95, vdepth=0.003), bt + st * S, 0.11, -0.05)

    n = N
    duck = duck_curve(n, kick_t, 0.58, 0.10)
    for bus in (bass, mid): bus.l *= duck; bus.r *= duck
    wl, wr = reverb(wetb, 0.18, 0.7)
    l = drums.l + bass.l + mid.l + wetb.l + wl; r = drums.r + bass.r + mid.r + wetb.r + wr
    st = finish(l[L:2 * L], r[L:2 * L], target_db=-15.0)
    print(f'  (RMS {rms_db(st):.1f} dBFS, đỉnh {np.max(np.abs(st)):.2f})')
    to_mp3('music-battle.mp3', st, '96k', stereo=True)
    return st


if __name__ == '__main__':
    import sys
    make_beeps()
    if '--tong-hop' not in sys.argv:
        raise SystemExit
    make_barks()
    menu = make_menu()
    battle = make_battle()
    # kiểm tra mối nối vòng lặp: bước nhảy giữa mẫu cuối và mẫu đầu so với bước nhảy bình thường
    for nme, a in (('menu', menu), ('battle', battle)):
        seam = np.abs(a[0] - a[-1]).max(); typ = np.abs(np.diff(a, axis=0)).max(axis=1).mean()
        print(f'  mối nối {nme}: {seam:.4f}  (bước nhảy trung bình giữa 2 mẫu liền kề {typ:.4f})')
