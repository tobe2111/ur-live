#!/usr/bin/env python3
"""
유달이 새 그림 검수 도구 (2026-10-11 대표 *"앞으로는 만들 때 이것을 철칙으로 여겨서 문제가 없도록 해줘"*).

새로 생성한 포즈 시트(격자 한 장)를 **확정 턴어라운드 정면**과 수치로 대조하고, 얼굴을 나란히 놓은 대조판을 만든다.
눈으로만 보면 "비슷하다"에서 멈춘다 — 2026-10-11 에 v2 가 얼굴 폭 1.3배·수염 개수·젤리 발바닥으로 어긋났는데
256px 미리보기로는 안 보였다. 그래서 숫자로 재고, 숫자가 못 재는 것(수염 개수·눈썹 모양)은 대조판으로 본다.

사용:
  python3 scripts/mascot/udal-qa.py <시트 이미지> [--grid 3x2] [--front 1] [--out 대조판.jpg]
    --front  정면으로 선 칸 번호(1부터, 왼쪽 위→오른쪽). 얼굴 폭 비율은 정면 칸에서만 잰다.

판정 기준(확정본 실측):
  털색(갈색 화소 평균)  확정 #9D7256 — 채널별 ±14 안
  입 높이 볼 폭 ÷ (머리 꼭대기~입)  확정값은 실행 때 다시 잰다 — ±8% 밖이면 넓적/좁음
나머지(한쪽 수염 3가닥 · 콩 모양 아치 눈썹 · 흰자 고리 · 다문 w 입 · 젤리 없는 발)는 대조판에서 사람이 센다.
⚠️ 못 재는 것: 옆·뒤 시점의 비율, 표정의 '느낌'. 그건 대표 판정이다.
"""
import argparse, colorsys, os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REF = os.path.join(ROOT, 'docs/design/assets/mascot/otter-turnaround-master.png')
REF_FUR = (0x9D, 0x72, 0x56)
# 색(톤) 기준 = 서비스에 나가 있는 유달이(2026-10-11 대표 "이거 기준으로 해야해"). 얼굴 폭 기준은 위 REF(정면).
TONE_REF = os.path.join(ROOT, 'src/assets/mascot/udal-curious.webp')
FUR_TOL = 14


def fur(img):
    sel = []
    for p in (img.get_flattened_data() if hasattr(img, 'get_flattened_data') else img.getdata()):
        h, s, v = colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)
        if 0.04 < h < 0.12 and 0.3 < s < 0.65 and 0.35 < v < 0.75:
            sel.append(p)
    if not sel:
        return None
    return tuple(sum(c[i] for c in sel) // len(sel) for i in range(3))


def tone(img):
    """털의 색상·채도 중앙값과 크림 중앙값. 평균 RGB(fur)만으로는 v6 의 채도 +0.05 · 주황 쪽 색상 · 복숭아빛 크림을
    못 잡았다(대표 *"원래랑 색상도 똑같은 거 맞아?"* — 평균은 ±14 안이라 통과였다). 사람 눈은 채도·온도를 먼저 본다."""
    fh, fs, cr = [], [], []
    for p in (img.get_flattened_data() if hasattr(img, 'get_flattened_data') else img.getdata()):
        h, s, v = colorsys.rgb_to_hsv(p[0] / 255, p[1] / 255, p[2] / 255)
        if 0.04 < h < 0.12 and 0.3 < s < 0.65 and 0.35 < v < 0.75:
            fh.append(h); fs.append(s)
        elif 0.05 < h < 0.14 and 0.1 < s < 0.3 and v > 0.8:
            cr.append(p[:3])
    if not fh or not cr:
        return None
    med = lambda a: sorted(a)[len(a) // 2]
    return med(fh), med(fs), tuple(med([c[i] for c in cr]) for i in range(3))


def head_box(img):
    """머리 꼭대기 · 코 · 입 높이의 볼 폭. 반다나 대신 **코**를 기준점으로 쓴다 —
    반다나는 이용권(파란 띠)·팔에 가려 오탐한다(v2 를 0.73 '좁음'으로 잘못 잰 사고).
    반환 (top, mouth_y, cheek_w, nose_y) / 못 찾으면 None."""
    w, h = img.size
    px = img.load()
    def fg(x, y):
        r, g, b = px[x, y][:3]
        return colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)[1] > 0.12
    top = next((y for y in range(h) if any(fg(x, y) for x in range(0, w, 2))), None)
    if top is None:
        return None
    pts = []
    for y in range(top, h):
        for x in range(int(w * 0.2), int(w * 0.8)):
            r, g, b = px[x, y][:3]
            hh, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
            if (hh < 0.04 or hh > 0.95) and 0.3 < s < 0.7 and 0.55 < v < 0.95 and r - g > 50:
                pts.append((x, y))
    if len(pts) < 20:
        return None
    # 가장 위에 있는 분홍 덩어리 = 코 (볼 홍조는 채도가 낮아 대부분 빠지고, 남아도 코보다 아래·옆이다)
    pts.sort(key=lambda p: p[1])
    y0 = pts[0][1]
    nose = [p for p in pts if p[1] < y0 + (h - top) * 0.06]
    nose_y = sum(p[1] for p in nose) / len(nose)
    mouth_y = int(nose_y + (nose_y - top) * 0.15)
    xs = [x for x in range(w) if fg(x, mouth_y)]
    return top, mouth_y, (xs[-1] - xs[0]) if xs else 0, nose_y


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('sheet')
    ap.add_argument('--grid', default='3x2')
    ap.add_argument('--front', type=int, default=1)
    ap.add_argument('--out', default=None)
    a = ap.parse_args()
    cols, rows = map(int, a.grid.lower().split('x'))
    im = Image.open(a.sheet).convert('RGB')
    W, H = im.size
    cw, ch = W // cols, H // rows
    cells = [im.crop(((k % cols) * cw, (k // cols) * ch, (k % cols + 1) * cw, (k // cols + 1) * ch)) for k in range(cols * rows)]

    ref = Image.open(REF).convert('RGB').crop((5, 100, 345, 700))
    rb = head_box(ref)
    ref_ratio = rb[2] / (rb[1] - rb[0])
    print(f'확정본  털 #{"%02X%02X%02X" % fur(ref)}  볼폭/머리높이 {ref_ratio:.2f}')

    tr = Image.open(TONE_REF).convert('RGBA'); tb = Image.new('RGBA', tr.size, (230, 230, 230, 255)); tb.alpha_composite(tr)
    rt = tone(tb.convert('RGB'))
    print(f'색 기준(udal-curious)  털 색상 {rt[0]:.3f} 채도 {rt[1]:.2f} · 크림 #{"%02X%02X%02X" % rt[2]}')
    ok = True
    faces = [ref.crop((0, rb[0], ref.width, int(rb[1] + (rb[1] - rb[0]) * 0.35)))]
    for i, c in enumerate(cells, 1):
        f = fur(c)
        fur_ok = f is not None and all(abs(f[j] - REF_FUR[j]) <= FUR_TOL for j in range(3))
        line = f'칸 {i}  털 #{"%02X%02X%02X" % f if f else "??????"} {"✅" if fur_ok else "❌"}'
        ok &= fur_ok
        t = tone(c)
        if t:
            # 허용폭: 색상 ±0.004(약 1.4°) · 채도 ±0.03 · 크림 채널 ±10 — v6 원본(0.071·0.49·R+9/B−7)이 걸리고 보정본이 통과하는 값
            t_ok = abs(t[0] - rt[0]) <= 0.004 and abs(t[1] - rt[1]) <= 0.03 and all(abs(t[2][j] - rt[2][j]) <= 10 for j in range(3))
            line += f'  톤 {t[0]:.3f}/{t[1]:.2f} 크림 #{"%02X%02X%02X" % t[2]} {"✅" if t_ok else "❌ (색 다름 → udal-color-match.py)"}'
            ok &= t_ok
        hb = head_box(c)
        if hb:
            faces.append(c.crop((0, hb[0], c.width, min(c.height, int(hb[1] + (hb[1] - hb[0]) * 0.35)))))
            if i == a.front:
                r = hb[2] / (hb[1] - hb[0])
                r_ok = ref_ratio * 0.92 <= r <= ref_ratio * 1.08
                ok &= r_ok
                line += f'  볼폭/머리높이 {r:.2f} {"✅" if r_ok else "❌ (넓적)" if r > ref_ratio else "❌ (좁음)"}'
        else:
            faces.append(c)
            if i == a.front:
                print(f'칸 {i}: 코를 못 찾아 얼굴 비율을 못 쟀다 — 통과가 아니라 측정 실패')
                ok = False
        print(line)

    out = a.out or os.path.splitext(a.sheet)[0] + '-qa.jpg'
    T = 360
    tiles = [f.resize((T, max(1, int(T * f.height / f.width)))) for f in faces]
    th = max(t.height for t in tiles)
    per = 4
    board = Image.new('RGB', (per * (T + 10) + 10, ((len(tiles) + per - 1) // per) * (th + 30) + 10), 'white')
    d = ImageDraw.Draw(board)
    for k, t in enumerate(tiles):
        x, y = 10 + (k % per) * (T + 10), 10 + (k // per) * (th + 30)
        board.paste(t, (x, y + 20))
        d.text((x, y + 2), '확정본' if k == 0 else f'칸 {k}', fill='black')
    board.save(out, quality=88)
    print(f'대조판: {out}  ← 수염(한쪽 3)·눈썹(콩 모양 아치)·흰자 고리·다문 w 입·젤리 없는 발은 여기서 센다')
    print('수치 판정:', '통과' if ok else '불통과')
    sys.exit(0 if ok else 1)


if __name__ == '__main__':
    main()
