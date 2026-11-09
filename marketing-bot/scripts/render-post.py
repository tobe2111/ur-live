# 게시물 이미지 생성기 — 게시할 때마다 새로 그린다 (1080x1350, 인스타 4:5).
# 2026-11-09 대표 "별거 없잖아, 가시성도 재미도 없고" + 참고 계정(naver.plus.store · toss.place · nol.always).
#   표지: 사진을 꽉 채우고 아래를 어둡게 → 굵은 제목 두 줄 + 부제 한 줄 + 시리즈 이름표. 참고 계정의 공통 형식이다.
#   안쪽 장: 사진 띠 + 번호 + 제목 + 설명 한두 줄. 마지막 장: 브랜드 블루 면에 안내 한 줄.
#   사진이 없으면 브랜드 블루 면 위 큰 글자(같은 위계).
# 사용: python3 scripts/render-post.py spec.json
#   spec = { out_dir, fonts: {heavy, semi}, photo?: 경로, series, title: [줄...], sub?, slides?: [{title, body}],
#            cta?: 문자열, mascot?: 경로 }
# 출력: out_dir/slide-1.jpg ... (표준출력에 파일 목록 JSON)
import json, os, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageOps

W, H, M = 1080, 1350, 72
BLUE = (28, 105, 239)
INK = (22, 24, 28)
GRAY = (95, 100, 108)
BG = (248, 247, 252)
WHITE = (255, 255, 255)

spec = json.load(open(sys.argv[1], encoding='utf-8'))
HEAVY, SEMI = spec['fonts']['heavy'], spec['fonts']['semi']
F = lambda path, size: ImageFont.truetype(path, size)
os.makedirs(spec['out_dir'], exist_ok=True)


def wrap(d, text, font, width):
    """한국어 줄바꿈: 띄어쓰기 단위로 채우고, 한 단어가 넘치면 글자 단위로 자른다."""
    out = []
    for para in str(text).split('\n'):
        line = ''
        for word in para.split(' '):
            cand = (line + ' ' + word).strip()
            if d.textlength(cand, font=font) <= width:
                line = cand
                continue
            if line:
                out.append(line)
            line = ''
            for ch in word:
                if d.textlength(line + ch, font=font) <= width:
                    line += ch
                else:
                    out.append(line)
                    line = ch
        if line:
            out.append(line)
    return out


def fit(d, rows, path, size, width, max_lines, min_size=48):
    """제목이 max_lines 안에 들어갈 때까지 글자를 줄인다."""
    while True:
        f = F(path, size)
        lines = [l for r in rows for l in wrap(d, r, f, width)]
        if len(lines) <= max_lines or size <= min_size:
            return f, lines[:max_lines + 1]
        size -= 4


def cover_crop(img, w, h, cx=0.5, cy=0.45):
    return ImageOps.fit(img.convert('RGB'), (w, h), Image.LANCZOS, centering=(cx, cy))


def pill(img, xy, text, font, fill, color):
    """반투명 이름표 — ImageDraw 는 알파를 섞지 않고 덮어쓰므로 별도 층에 그려 합성한다."""
    x, y = xy
    layer = Image.new('RGBA', img.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(layer)
    tw = ld.textlength(text, font=font)
    ld.rounded_rectangle((x, y, x + tw + 44, y + font.size + 28), radius=(font.size + 28) // 2, fill=fill)
    img.alpha_composite(layer)
    ImageDraw.Draw(img).text((x + 22, y + 12), text, font=font, fill=color)


def photo_or_none():
    p = spec.get('photo')
    if p and os.path.exists(p):
        try:
            return Image.open(p)
        except Exception:
            return None
    return None


def cover(photo):
    if photo:
        img = cover_crop(photo, W, H).convert('RGBA')
        # 아래 62%를 검게 — 사진 위 흰 글자 대비 확보
        grad = Image.new('L', (1, H), 0)
        for y in range(H):
            t = max(0.0, (y - H * 0.38) / (H * 0.62))
            grad.putpixel((0, y), int(225 * min(1.0, t) ** 1.2))
        shade = Image.new('RGBA', (W, H), (8, 10, 14, 255))
        shade.putalpha(grad.resize((W, H)))
        img.alpha_composite(shade)
        top = Image.new('RGBA', (W, 220), (0, 0, 0, 0))
        tg = Image.new('L', (1, 220))
        for y in range(220):
            tg.putpixel((0, y), int(110 * (1 - y / 220)))
        top.putalpha(tg.resize((W, 220)))
        img.alpha_composite(top, (0, 0))
    else:
        img = Image.new('RGBA', (W, H), BLUE + (255,))
    pill(img, (M, M), f"유어딜 · {spec.get('series', '')}".strip(' ·'), F(SEMI, 30), (0, 0, 0, 90) if photo else (255, 255, 255, 46), WHITE)
    d = ImageDraw.Draw(img)

    mascot = spec.get('mascot')
    text_w = W - 2 * M
    if mascot and os.path.exists(mascot):
        m = Image.open(mascot).convert('RGBA')
        mh = int(H * (0.30 if photo else 0.42))
        m = m.resize((int(m.width * mh / m.height), mh), Image.LANCZOS)
        img.alpha_composite(m, (W - m.width - 24, H - m.height - 150))
        text_w = W - 2 * M - int(m.width * 0.55)

    # 사진이 없으면 글자가 주인공 — 더 크게, 위쪽에
    tf, tl = fit(d, spec.get('title') or [''], HEAVY, 92 if photo else 124, W - 2 * M if not photo else text_w, 3)
    sub = spec.get('sub') or ''
    sf = F(SEMI, 36)
    sl = wrap(d, sub, sf, text_w)[:2] if sub else []
    lh, sh = int(tf.size * 1.2), int(sf.size * 1.45)
    y = H - M - 70 - len(sl) * sh - (24 if sl else 0) - len(tl) * lh
    if not photo:
        y = int(H * 0.22)
    for l in tl:
        d.text((M, y), l, font=tf, fill=WHITE)
        y += lh
    y += 24 if sl else 0
    for l in sl:
        d.text((M, y), l, font=sf, fill=(232, 234, 238))
        y += sh
    d.text((M, H - M - 34), 'urdeal.kr', font=F(SEMI, 28), fill=(210, 213, 218))
    return img


def inner(photo, i, n, s):
    img = Image.new('RGBA', (W, H), BG + (255,))
    d = ImageDraw.Draw(img)
    band_h = 600
    if photo:
        # 장마다 다른 부분을 잘라 같은 사진이 반복돼 보이지 않게
        band = cover_crop(photo, W - 2 * M, band_h, cx=(0.2, 0.8, 0.5, 0.35)[i % 4], cy=(0.3, 0.7, 0.5, 0.6)[i % 4]).convert('RGBA')
        mask = Image.new('L', band.size, 0)
        ImageDraw.Draw(mask).rounded_rectangle((0, 0, band.width, band.height), radius=36, fill=255)
        img.paste(band, (M, M), mask)
        y = M + band_h + 80
    else:
        y = 300
    d.text((M, y), f'{i:02d}', font=F(HEAVY, 60), fill=BLUE)
    y += 92
    tf, tl = fit(d, [s.get('title', '')], HEAVY, 76, W - 2 * M, 2)
    for l in tl:
        d.text((M, y), l, font=tf, fill=INK)
        y += int(tf.size * 1.22)
    y += 20
    bf = F(SEMI, 42)
    for l in wrap(d, s.get('body', ''), bf, W - 2 * M)[:4]:
        d.text((M, y), l, font=bf, fill=GRAY)
        y += int(bf.size * 1.5)
    d.text((M, H - M - 34), 'urdeal.kr', font=F(SEMI, 28), fill=(150, 154, 160))
    # 진행 표시
    for k in range(n):
        x = W - M - (n - k) * 30
        d.rounded_rectangle((x, H - M - 22, x + (22 if k == i else 14), H - M - 14), radius=4, fill=BLUE if k == i else (210, 213, 220))
    return img


def last(text, i, n):
    img = Image.new('RGBA', (W, H), BLUE + (255,))
    d = ImageDraw.Draw(img)
    tf, tl = fit(d, [text], HEAVY, 84, W - 2 * M, 3)
    y = H // 2 - len(tl) * int(tf.size * 1.22) // 2
    d.text((M, y - 90), '유어딜', font=F(HEAVY, 44), fill=(200, 220, 255))
    for l in tl:
        d.text((M, y), l, font=tf, fill=WHITE)
        y += int(tf.size * 1.22)
    d.text((M, H - M - 34), 'urdeal.kr', font=F(SEMI, 30), fill=WHITE)
    return img


photo = photo_or_none()
slides = spec.get('slides') or []
cta = spec.get('cta')
n = 1 + len(slides) + (1 if cta and slides else 0)
pages = [cover(photo)] + [inner(photo, k + 1, n, s) for k, s in enumerate(slides)]
if cta and slides:
    pages.append(last(cta, n - 1, n))
files = []
for k, p in enumerate(pages, 1):
    f = os.path.join(spec['out_dir'], f'slide-{k}.jpg')
    p.convert('RGB').save(f, 'JPEG', quality=90, optimize=True, progressive=True)
    files.append(f)
print(json.dumps(files))
