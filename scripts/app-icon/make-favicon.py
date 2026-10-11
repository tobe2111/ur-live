"""파비콘(구글 검색 결과·브라우저 탭) — 남색 바탕 + 유달이 얼굴. 대표 2026-10-11 "남색 바탕에 유달이로도 해주고".

  python3 scripts/app-icon/make-favicon.py

새로 그린 유달이가 아니다 — 확정 얼굴 otter-face-happy.png 를 남색(#1B2340, 앱 아이콘·시작화면과 같은 값)
위에 얹는다(유달이 생성 철칙 ①~⑥ 대상 아님). 구글은 이 아이콘을 원형으로 잘라 16~48px 로 보여 주므로
얼굴만 크게(반다나 위쪽까지) 가운데에 둔다.
"""
import base64, io
from PIL import Image

S, NAVY = 1024, (27, 35, 64, 255)
face = Image.open('docs/design/assets/mascot/otter-face-happy.png').convert('RGBA')
face = face.crop(face.getbbox())
face = face.crop((0, 0, face.width, int(face.height * 0.86)))
W = 840
face = face.resize((W, round(face.height * W / face.width)), Image.LANCZOS)
master = Image.new('RGBA', (S, S), NAVY)
master.alpha_composite(face, ((S - W) // 2, (S - face.height) // 2 + 24))
master = master.convert('RGB')

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
    '  <!-- 유어딜 파비콘 — 남색 + 유달이 얼굴(2026-10-11 대표). 생성: scripts/app-icon/make-favicon.py -->\n'
    f'  <image width="32" height="32" href="data:image/png;base64,{b64}"/>\n'
    '</svg>\n')
