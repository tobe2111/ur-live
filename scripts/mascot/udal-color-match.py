#!/usr/bin/env python3
"""
유달이 생성 그림의 털·크림 색을 확정본에 맞춘다 (2026-10-11 대표 *"원래랑 색상도 똑같은 거 맞아? 뭔가 다른 것 같지?"*).

왜 필요한가: 같은 모델·같은 문구로 그려도 회차마다 색이 흔들린다. v6 실측 —
  털 채도 0.45 → 0.49~0.50 · 색상 약간 주황 쪽 · 그늘이 옅어 입체감 감소 · 크림이 복숭아빛(R+9, B−7).
평균 RGB 로는 ±14 안이라 검수 도구가 통과시켰다. 사람 눈은 채도·온도·명암 차이를 먼저 본다.

방법: 갈색 계열(색상 0.035~0.15) 화소만 골라 **채도·밝기를 확정본 분포에 분위수 매칭**하고 색상을 중앙값만큼 옮긴다.
반다나 파랑·코·볼 분홍·눈·배경은 손대지 않는다(색상 범위 밖이거나 채도·밝기로 걸러짐).
모양은 한 화소도 안 바뀐다 — 색만 바꾼다.

사용: python3 scripts/mascot/udal-color-match.py <입력> <출력>
"""
import os, sys
import numpy as np
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
# 색 기준 = 서비스에 실제로 나가 있는 유달이(2026-10-11 대표 "이거 기준으로 해야해" — udal-curious 를 지목).
# 모양 기준(얼굴 폭)은 여전히 턴어라운드 정면이다(udal-qa.py). 색과 모양의 기준 그림이 다르다.
REF = os.path.join(ROOT, 'src/assets/mascot/udal-curious.webp')
H_LO, H_HI, FEATHER = 0.035, 0.15, 0.015


def rgb_to_hsv(a):
    r, g, b = a[..., 0], a[..., 1], a[..., 2]
    mx = a.max(-1); mn = a.min(-1); d = mx - mn
    h = np.zeros_like(mx)
    m = d > 1e-6
    rr = m & (mx == r); gg = m & (mx == g) & ~rr; bb = m & ~rr & ~gg
    h[rr] = ((g - b)[rr] / d[rr]) % 6
    h[gg] = (b - r)[gg] / d[gg] + 2
    h[bb] = (r - g)[bb] / d[bb] + 4
    h = h / 6
    s = np.where(mx > 1e-6, d / np.maximum(mx, 1e-6), 0)
    return np.stack([h, s, mx], -1)


def hsv_to_rgb(x):
    h, s, v = x[..., 0] % 1, x[..., 1], x[..., 2]
    i = np.floor(h * 6); f = h * 6 - i; i = i.astype(int) % 6
    p = v * (1 - s); q = v * (1 - f * s); t = v * (1 - (1 - f) * s)
    out = np.zeros(h.shape + (3,))
    for k, (a, b, c) in enumerate([(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]):
        m = i == k
        out[m] = np.stack([a[m], b[m], c[m]], -1)
    return out


def warm_mask(hsv):
    h, s, v = hsv[..., 0], hsv[..., 1], hsv[..., 2]
    w = np.clip((h - (H_LO - FEATHER)) / FEATHER, 0, 1) * np.clip(((H_HI + FEATHER) - h) / FEATHER, 0, 1)
    # 회색 배경·검은 눈은 빼되 경계를 부드럽게 — 계단식 컷이면 배경에 얼룩이 생긴다(v6 1차 실측)
    return w * np.clip((s - 0.10) / 0.08, 0, 1) * np.clip((v - 0.25) / 0.1, 0, 1)


def quantile_map(src_vals, ref_vals, x):
    # 분위수 곡선을 그대로 쓰면 가파른 구간이 털 결을 증폭해 얼룩이 생긴다(v6 1차 실측) → 10~90 분위에 맞춘 직선 하나
    qs = np.linspace(0.1, 0.9, 17)
    a, b = np.polyfit(np.quantile(src_vals, qs), np.quantile(ref_vals, qs), 1)
    return a * x + b


def main(inp, out):
    ref_im = Image.open(REF).convert('RGBA'); bg = Image.new('RGBA', ref_im.size, (230, 230, 230, 255)); bg.alpha_composite(ref_im)
    ref = rgb_to_hsv(np.asarray(bg.convert('RGB'), float) / 255)
    rm = warm_mask(ref) > 0.99
    im = np.asarray(Image.open(inp).convert('RGB'), float) / 255
    hsv = rgb_to_hsv(im)
    w = warm_mask(hsv)
    # 반다나·소품 파랑 테두리의 섞인 화소가 '크림'으로 잡혀 하얗게 뜨던 것(v6 실측) — 파랑 바로 옆 화소만 부드럽게 덜 바꾼다
    from PIL import ImageFilter
    blue = ((hsv[..., 0] > 0.5) & (hsv[..., 0] < 0.75) & (hsv[..., 1] > 0.15)).astype(np.uint8) * 255
    near_blue = np.asarray(Image.fromarray(blue).filter(ImageFilter.MaxFilter(7)).filter(ImageFilter.GaussianBlur(2)), float) / 255  # 가장자리만, 부드럽게(경계선이 남지 않게)
    w = w * (1 - near_blue)
    sm = w > 0.99
    new = hsv.copy()
    # 털(채도 높음)과 크림(채도 낮음)은 따로 맞춘다 — 한 직선으로 같이 맞추면 크림이 어두워진다(v6 2차 실측 223→211)
    rf = rm & (ref[..., 1] > 0.3); sf = sm & (hsv[..., 1] > 0.3)
    rc = rm & (ref[..., 1] < 0.3) & (ref[..., 2] > 0.75); sc = sm & (hsv[..., 1] < 0.3) & (hsv[..., 2] > 0.75)
    t = np.clip((hsv[..., 1] - 0.22) / 0.12, 0, 1)[..., None]  # 0=크림, 1=털 — 사이는 섞는다
    def fit(rmask, smask):
        out = hsv.copy()
        out[..., 0] = hsv[..., 0] + (np.median(ref[rmask][:, 0]) - np.median(hsv[smask][:, 0]))
        out[..., 1] = quantile_map(hsv[smask][:, 1], ref[rmask][:, 1], hsv[..., 1])
        out[..., 2] = quantile_map(hsv[smask][:, 2], ref[rmask][:, 2], hsv[..., 2])
        return out
    new = fit(rc, sc) * (1 - t) + fit(rf, sf) * t
    new[..., 1:] = np.clip(new[..., 1:], 0, 1)
    rgb = hsv_to_rgb(new)
    res = im * (1 - w[..., None]) + rgb * w[..., None]
    Image.fromarray((np.clip(res, 0, 1) * 255).round().astype(np.uint8)).save(out, quality=92)
    print(f'보정 완료: {out}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__); sys.exit(2)
    main(sys.argv[1], sys.argv[2])
