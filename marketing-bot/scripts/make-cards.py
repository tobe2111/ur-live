# 인스타 카드 세트 생성기 (1080x1350, 4:5) — public/marketing/b2b/<set>/slide-N.jpg
# 기준: marketing/visual-reference.md §1 + '따뜻하게, 삭막하지 않게' (웜 코랄·살구·크림 그라데이션 + 종이결/빛망울 질감, 굵은 고딕 1종,
#       가장자리 80px 안 글자 금지, 유달이는 크게(35~45%) + 부산 사투리 말풍선, 레이아웃 3종 돌려쓰기)
# 사실 근거: src/shared/partners-facts.ts, marketing-bot/data/content-mix.json(creator topics),
#            src/shared/seo/detail-description.ts(2919 실측가), partners-facts.ts sample(2915 실측가).
# 사용: python3 marketing-bot/scripts/make-cards.py <Pretendard-Black.otf> [Pretendard-Bold.otf]
import os, sys
import random
from PIL import Image, ImageDraw, ImageFont, ImageFilter

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
OUT = os.path.join(ROOT, 'public', 'marketing', 'b2b')
MASCOT = os.path.join(ROOT, 'public', 'assets', 'mascot')
W, H, M = 1080, 1350, 80
# 웜 팔레트 — 이름은 호출부 호환용으로 유지(BLUE=강조 코랄). 브랜드 블루는 하단 urdeal.kr 칩에만.
BRAND = (28, 105, 239)
BLUE, WHITE, YEL, INK, PAPER = (238, 92, 58), (255, 255, 255), (255, 226, 110), (58, 38, 30), (255, 244, 226)

BLACK = sys.argv[1]
BOLD = sys.argv[2] if len(sys.argv) > 2 else BLACK
F = lambda size, heavy=True: ImageFont.truetype(BLACK if heavy else BOLD, size)
BIG, SMALL = 96, 44  # 글자 크기 단계 2개


def sticker(img, name, corner='br', scale=0.26, bubble=None):
    scale = min(0.42, scale * 1.5)  # 유달이 크게 — 구석 스티커가 아니라 같이 등장하는 주인공
    m = Image.open(os.path.join(MASCOT, f'udal-social-{name}.webp')).convert('RGBA')
    h = int(H * scale); w = int(m.width * h / m.height)
    m = m.resize((w, h), Image.LANCZOS).rotate(-6 if 'r' in corner else 6, expand=True, resample=Image.BICUBIC)
    w, h = m.size
    # 스티커 느낌: 흰 테두리
    pad = 10
    base = Image.new('RGBA', (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    alpha = m.split()[3].point(lambda a: 255 if a > 20 else 0)
    outline = Image.new('RGBA', base.size, (0, 0, 0, 0))
    for dx in range(0, pad * 2 + 1, 4):
        for dy in range(0, pad * 2 + 1, 4):
            outline.paste(Image.new('RGBA', (w, h), WHITE + (255,)), (dx, dy), alpha)
    base.alpha_composite(outline); base.alpha_composite(m, (pad, pad))
    x = W - M - base.width + 40 if 'r' in corner else M - 40
    y = H - base.height - 100 if 'b' in corner else M  # 하단 점·urdeal.kr 가리지 않게
    img.alpha_composite(base, (x, y))
    if bubble:
        d = ImageDraw.Draw(img); f = F(SMALL, False)
        tw = d.textlength(bubble, font=f)
        bx2 = x - 10 if 'r' in corner else x + base.width + 10 + tw + 60
        bx1 = bx2 - tw - 60; by1 = y + base.height // 2; by2 = by1 + 90  # 유달이 옆 가슴 높이 — 위쪽 본문과 안 겹치게
        d.rounded_rectangle((bx1, by1, bx2, by2), 40, fill=WHITE, outline=INK, width=4)
        tail = [(bx2 - 4, by1 + 40), (bx2 + 26, by1 + 60), (bx2 - 4, by1 + 66)] if 'r' in corner else [(bx1 + 4, by1 + 40), (bx1 - 26, by1 + 60), (bx1 + 4, by1 + 66)]
        d.polygon(tail, fill=WHITE)
        d.text((bx1 + 30, by1 + 18), bubble, font=f, fill=INK)


def lines(d, xy, rows, size, fill, accent=None, gap=1.3):
    """rows: 문자열 또는 [(조각, 강조여부)...]. 강조 조각만 강조색."""
    x, y = xy; f = F(size, size == BIG)
    for r in rows:
        cx = x
        for part, hot in ([(r, False)] if isinstance(r, str) else r):
            d.text((cx, y), part, font=f, fill=(accent if hot and accent else fill))
            cx += d.textlength(part, font=f)
        y += int(size * gap)
    return y


def footer(d, i, n, dark=True):
    f = F(30, False); c = WHITE if dark else INK
    tw = d.textlength('urdeal.kr', font=f)
    d.rounded_rectangle((M - 16, H - M - 38, M + tw + 16, H - M + 12), 25, fill=BRAND)
    d.text((M, H - M - 30), 'urdeal.kr', font=f, fill=WHITE)
    for k in range(n):
        d.rectangle((W - M - (n - k) * 44, H - M - 16, W - M - (n - k) * 44 + 32, H - M - 10), fill=YEL if k == i else c)


GRAD = {  # 사진 느낌 그라데이션(위→아래): 노을빛 / 아침 햇살 / 크림 종이
    'blue': ((255, 128, 84), (255, 184, 92)),
    'white': ((255, 250, 240), (255, 226, 200)),
    'paper': ((255, 246, 230), (250, 232, 205)),
}


def canvas(kind):
    """평면 단색 대신: 세로 그라데이션 + 흐린 빛망울(보케) + 종이결 노이즈 — 사진 배경 같은 온기"""
    top, bot = GRAD[kind]
    rnd = random.Random(kind)
    g = Image.new('RGB', (1, 256))
    for yy in range(256):
        t = yy / 255
        g.putpixel((0, yy), tuple(int(top[k] + (bot[k] - top[k]) * t) for k in range(3)))
    img = g.resize((W, H), Image.BICUBIC).convert('RGBA')
    glow = Image.new('RGBA', (W, H), (0, 0, 0, 0)); gd = ImageDraw.Draw(glow)
    for _ in range(7):
        r = rnd.randint(90, 260); x = rnd.randint(-80, W + 80); y = rnd.randint(-80, H + 80)
        gd.ellipse((x - r, y - r, x + r, y + r), fill=(255, 245, 215, rnd.randint(40, 90)))
    img.alpha_composite(glow.filter(ImageFilter.GaussianBlur(60)))
    noise = Image.effect_noise((W, H), 28).convert('L').point(lambda v: 128 + (v - 128) // 3)
    grain = Image.merge('RGBA', (noise, noise, noise, Image.new('L', (W, H), 18)))
    img.alpha_composite(grain)
    return img, ImageDraw.Draw(img)


def phone(d, box, title, rows):
    """캡처형: 휴대폰 화면 목업"""
    x1, y1, x2, y2 = box
    d.rounded_rectangle(box, 56, fill=INK)
    d.rounded_rectangle((x1 + 18, y1 + 18, x2 - 18, y2 - 18), 42, fill=WHITE)
    d.text((x1 + 60, y1 + 60), title, font=F(36, False), fill=BLUE)
    y = y1 + 130
    for r in rows:
        d.rounded_rectangle((x1 + 50, y, x2 - 50, y + 96), 20, fill=(240, 244, 252))
        d.text((x1 + 80, y + 26), r, font=F(36, False), fill=INK)
        y += 116


def memo(d, box):
    """메모형: 메모지 + 줄"""
    x1, y1, x2, y2 = box
    d.rectangle(box, fill=WHITE, outline=INK, width=3)
    for yy in range(y1 + 120, y2, 90):
        d.line((x1 + 30, yy, x2 - 30, yy), fill=(210, 220, 240), width=2)


def check(d, x, y, text, done=True):
    d.rectangle((x, y + 8, x + 44, y + 52), outline=INK, width=5)
    if done: d.line((x + 8, y + 28, x + 20, y + 44, x + 40, y + 10), fill=BLUE, width=8)
    d.text((x + 70, y), text, font=F(SMALL, False), fill=INK)


def save(name, slides):
    os.makedirs(os.path.join(OUT, name), exist_ok=True)
    for i, img in enumerate(slides, 1):
        img.convert('RGB').save(os.path.join(OUT, name, f'slide-{i}.jpg'), quality=86, optimize=True)


# ---------------- 인플루언서 1: 캡처형 "링크 1개" ----------------
def creator_link_one():
    n, s = 6, []
    img, d = canvas('blue')
    lines(d, (M, 260), [[('링크 ', False), ('1개', True), ('면', False)], '시작 끝이에요!'], BIG, WHITE, YEL)
    lines(d, (M, 560), ['가입비 0원, 카카오로 1분이면 돼요', '내 유어샵도 알아서 뚝딱 생겨요'], SMALL, WHITE)
    sticker(img, 'phone', 'br', 0.3, '찍고 올리믄 끝이데이'); footer(d, 0, n); s.append(img)

    img, d = canvas('white')
    lines(d, (M, 180), ['맛집 올려도', [('남는 건 ', False), ('하트', True), ('뿐?', False)]], BIG, INK, BLUE)
    lines(d, (M, 480), ['협찬은 한 번 쓰면 끝이지만', '소개 링크는 팔릴 때마다 쌓여요 :)'], SMALL, INK)
    sticker(img, 'wave', 'br', 0.24, '아이고 아깝다 아이가'); footer(d, 1, n, False); s.append(img)

    img, d = canvas('white')
    lines(d, (M, 150), [[('시작은 ', False), ('3단계', True)]], BIG, INK, BLUE)
    phone(d, (M + 60, 330, W - M - 60, 930), '내 유어샵', ['1  카카오로 가입', '2  동네 딜 담기', '3  링크 하나 공유'])
    lines(d, (M, 990), ['인스타·블로그·카톡, 편한 데 어디든요'], SMALL, INK); footer(d, 2, n, False); s.append(img)

    img, d = canvas('white')
    lines(d, (M, 150), [[('돈은 ', False), ('이렇게', True), (' 들어와요', False)]], BIG, INK, BLUE)
    for k, (t, sub) in enumerate([('매장', '소개비 % 설정'), ('내 링크', '딜이 팔림'), ('소개비', '적립')]):
        cx = M + 120 + k * 300
        d.ellipse((cx - 90, 420, cx + 90, 600), fill=BLUE if k < 2 else YEL)
        d.text((cx, 510), t, font=F(40, False), fill=WHITE if k < 2 else INK, anchor='mm')
        d.text((cx, 660), sub, font=F(34, False), fill=INK, anchor='mm')
        if k < 2: d.polygon([(cx + 120, 495), (cx + 170, 510), (cx + 120, 525)], fill=INK)
    lines(d, (M, 800), ['소개비율은 매장이 딜마다 정하고', '고르기 전에 미리 다 보여드려요'], SMALL, INK)
    footer(d, 3, n, False); s.append(img)

    img, d = canvas('white')
    lines(d, (M, 150), [[('규칙은 ', False), ('투명', True), ('하게', False)]], BIG, INK, BLUE)
    phone(d, (M + 60, 330, W - M - 60, 930), '정산 안내', ['환불되면 적립도 자동 회수', '최소 지급액 1만원', '원천징수 후 계좌로 출금'])
    footer(d, 4, n, False); s.append(img)

    img, d = canvas('blue')
    lines(d, (M, 380), ['소개 파트너 신청은', [('프로필 링크', True)]], BIG, WHITE, YEL)
    lines(d, (M, 680), ['urdeal.kr/creators'], SMALL, WHITE)
    sticker(img, 'wave', 'br', 0.28, '퍼뜩 신청해 보이소'); footer(d, 5, n); s.append(img)
    save('creator-link-one', s)


# ---------------- 인플루언서 2: 메모형 "소개 글 체크리스트" ----------------
def creator_checklist():
    n, s = 5, []
    img, d = canvas('paper')
    memo(d, (M, 140, W - M, 900))
    lines(d, (M + 50, 200), [[('체크 ', False), ('3개', True)], '올리기 전에'], BIG, INK, BLUE)
    lines(d, (M + 50, 520), ['소개 파트너용 메모'], SMALL, INK)
    sticker(img, 'phone', 'br', 0.26, '저장해 두이소'); footer(d, 0, n, False); s.append(img)

    for i, (t, sub) in enumerate([
        ('광고 표기 했나?', ['소개 링크인 걸 글에 밝히기.', '유어딜도 그렇게 안내해요.']),
        ('소개비율 봤나?', ['매장이 딜마다 정하고,', '담기 전에 미리 보여요.']),
        ('환불 규칙 알았나?', ['손님이 환불하면', '적립도 자동으로 회수돼요.']),
    ], 1):
        img, d = canvas('paper')
        memo(d, (M, 140, W - M, 1000))
        check(d, M + 50, 200, f'{i}/3', True)
        lines(d, (M + 50, 330), [t], BIG, INK)
        lines(d, (M + 50, 520), sub, SMALL, INK)
        if i == 2: sticker(img, 'gift', 'br', 0.22)
        footer(d, i, n, False); s.append(img)

    img, d = canvas('blue')
    lines(d, (M, 300), [[('출금은 ', False), ('1만원', True), ('부터', False)]], BIG, WHITE, YEL)
    lines(d, (M, 520), ['사업소득 원천징수 후 계좌로.', '파트너 신청은 프로필 링크'], SMALL, WHITE)
    sticker(img, 'wave', 'br', 0.28, '같이 해 보입시더'); footer(d, 4, n); s.append(img)
    save('creator-checklist', s)


# ---------------- 손님 딜: 유달이 만화형 / 가격 박스 ----------------
def deal(name, store, item, area, sale, lst, bubble, scene):
    n, s = 5, []
    pct = round((lst - sale) / lst * 100) if lst else 0
    img, d = canvas('blue')
    lines(d, (M, 230), [store, item], BIG, WHITE)
    d.rectangle((M, 520, M + 560, 660), fill=YEL)
    d.text((M + 30, 540), f'{sale:,}원', font=F(BIG), fill=INK)
    lines(d, (M, 700), [f'정가 {lst:,}원 · {pct}% 할인'], SMALL, WHITE)
    sticker(img, 'gift', 'br', 0.28, bubble); footer(d, 0, n); s.append(img)

    img, d = canvas('white')
    lines(d, (M, 200), scene, BIG, INK)
    lines(d, (M, 520), [f'{area} {store}'.strip()], SMALL, INK)
    sticker(img, 'wave', 'br', 0.24, '내가 골라 놨데이'); footer(d, 1, n, False); s.append(img)

    img, d = canvas('white')
    lines(d, (M, 150), [[('이용권은 ', False), ('이렇게', True)]], BIG, INK, BLUE)
    phone(d, (M + 60, 330, W - M - 60, 930), '유어딜 이용권', ['1  앱에서 미리 결제', '2  가게에서 QR 짠!', '3  맛있게 먹으면 끝'])
    footer(d, 2, n, False); s.append(img)

    img, d = canvas('paper')
    memo(d, (M, 140, W - M, 900))
    lines(d, (M + 50, 200), ['이것만 알면 돼요'], BIG, INK)
    for k, t in enumerate(['유효기간은 매장이 정해요', '안 쓰면 자동 환불', '가격은 바뀔 수 있어요']):
        check(d, M + 50, 380 + k * 110, t, True)
    footer(d, 3, n, False); s.append(img)

    img, d = canvas('blue')
    lines(d, (M, 380), [[('프로필 링크', True), ('에서', False)], '바로 구경해요'], BIG, WHITE, YEL)
    lines(d, (M, 680), ['가격은 2026-10 확인 기준'], SMALL, WHITE)
    sticker(img, 'phone', 'br', 0.28, '퍼뜩 온나'); footer(d, 4, n); s.append(img)
    save(name, s)


if __name__ == '__main__':
    creator_link_one()
    creator_checklist()
    # 2919 실측(src/shared/seo/detail-description.ts): 31,000원 (정가 35,000원), 서울 서초구
    deal('deal-dalbit', '달빛한스푼', '닭도리탕', '서울 서초구', 31000, 35000, '오늘 저녁 이거다', ['퇴근길 둘이서', '닭도리탕 한 냄비'])
    # 2915 실측(src/shared/partners-facts.ts sample): 7,500원 (정가 14,500원)
    deal('deal-hongdae-donkatsu', '홍대돈까스', '돈가스 1인 세트', '', 7500, 14500, '이 가격 실화가', ['점심 혼밥', '돈가스 한 판'])
    print('ok')
