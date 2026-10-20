"""파비콘(구글 검색 결과·브라우저 탭) — 남색 바탕 + urdeal. 로고.
대표 2026-10-17 "유달이 말고, urdeal 로고로 해줘" (2026-10-11 유달이 얼굴을 대체).

  node scripts/app-icon/render-favicon-logo.mjs   # 1024px 원본(Poppins 800, UrDealLogo 와 같은 자간·점)
  python3 scripts/app-icon/make-favicon.py        # 크기별 파일

바탕 남색(#1B2340)은 앱 아이콘·시작화면과 같은 값. 구글은 원형으로 잘라 16~48px 로 보여 주므로
글자 폭을 원 안에 들어오게 잡았다(favicon-logo.html 의 --s).
"""
import base64, io
from PIL import Image

master = Image.open('docs/design/assets/favicon-logo-1024.png').convert('RGB')

def at(n): return master.resize((n, n), Image.LANCZOS)

for n in (16, 32, 48, 96, 144):
    at(n).save(f'public/favicon-{n}.png', optimize=True)
for n in (192, 512):
    at(n).save(f'public/icon-{n}.png', optimize=True)
master.save('public/favicon.ico', sizes=[(16, 16), (32, 32), (48, 48)])

buf = io.BytesIO(); at(64).save(buf, 'PNG', optimize=True)
b64 = base64.b64encode(buf.getvalue()).decode()
open('public/favicon.svg', 'w').write(
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">\n'
    '  <!-- 유어딜 파비콘 — 남색 + urdeal. 로고(2026-10-17 대표). 생성: scripts/app-icon/make-favicon.py -->\n'
    f'  <image width="32" height="32" href="data:image/png;base64,{b64}"/>\n'
    '</svg>\n')
