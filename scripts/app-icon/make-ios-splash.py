"""아이폰 시작화면 생성 — 안 1(네이비 전면 + 6-B maskable), 안드로이드 splash 와 같은 비율.

  python3 scripts/app-icon/make-ios-splash.py

① 홈 화면 웹앱: public/ios-splash-{W}x{H}.png (기기별 정확한 픽셀 — iOS 는 크기가 1px 만
   달라도 그 이미지를 안 쓰고 흰 화면을 띄운다) + index.html 의 apple-touch-startup-image.
② 스토어 앱: ios/App/App/Assets.xcassets/Splash.imageset 2732² 3장 (LaunchScreen 이
   scaleAspectFill 로 가운데를 잘라 쓴다).
아이콘 크기 = 화면 짧은 변의 42% (안드로이드 drawable*/splash.png 와 같은 값).
"""
from PIL import Image

NAVY = (27, 35, 64)          # #1B2340 — manifest background_color 와 같아야 한다(가드)
SRC = 'docs/design/assets/app-icon-2026-10/kakao-channel-profile-640.png'  # 6-B maskable 원본(640)
RATIO = 0.42

# (CSS 폭, CSS 높이, DPR) — 세로 화면만(앱은 세로 고정)
DEVICES = [
    (440, 956, 3),  # 16 Pro Max
    (402, 874, 3),  # 16 Pro
    (430, 932, 3),  # 14 Pro Max · 15 Plus/Pro Max · 16 Plus
    (393, 852, 3),  # 14 Pro · 15 · 15 Pro · 16
    (428, 926, 3),  # 12/13 Pro Max · 14 Plus
    (390, 844, 3),  # 12 · 13 · 14 · 12/13 Pro
    (375, 812, 3),  # X · XS · 11 Pro · 12/13 mini
    (414, 896, 3),  # XS Max · 11 Pro Max
    (414, 896, 2),  # XR · 11
    (414, 736, 3),  # 6+ ~ 8 Plus
    (375, 667, 2),  # 6 ~ 8 · SE 2/3
    (320, 568, 2),  # SE 1
]

src = Image.open(SRC).convert('RGB')

def render(w, h, icon):
    im = Image.new('RGB', (w, h), NAVY)
    ic = src.resize((icon, icon), Image.LANCZOS)
    im.paste(ic, ((w - icon) // 2, (h - icon) // 2))
    return im

for cw, ch, d in DEVICES:
    w, h = cw * d, ch * d
    render(w, h, round(min(w, h) * RATIO)).save(f'public/ios-splash-{w}x{h}.png', optimize=True)

# 스토어 앱: 정사각 2732 를 세로 폰(약 9:19.5)에 aspectFill → 보이는 폭 ≈ 2732×0.46
native = render(2732, 2732, round(2732 * 0.46 * RATIO))
for n in ('splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png'):
    native.save(f'ios/App/App/Assets.xcassets/Splash.imageset/{n}', optimize=True)

for cw, ch, d in DEVICES:
    w, h = cw * d, ch * d
    print(f'    <link rel="apple-touch-startup-image" media="(device-width: {cw}px) and (device-height: {ch}px) and (-webkit-device-pixel-ratio: {d}) and (orientation: portrait)" href="/ios-splash-{w}x{h}.png" />')
