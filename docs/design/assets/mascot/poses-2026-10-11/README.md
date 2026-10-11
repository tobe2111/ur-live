# 유달이 새 포즈 6종 (2026-10-11)

대표: *"유달이 이미지 시안들 더 다양하게 만들어둬야겠는데? 이전에 만들어둔 것만 계속 활용하고 있네?"*
Figma `generate_image`(gemini-3.1-flash-image), 프롬프트는 `../../../urdeal-mascot-otter-2026-10.md` 의 실측 스펙.

이 폴더의 `*.thumb.jpg` 는 **256px 미리보기**다. 이 환경은 figma.com 다운로드가 막혀(CONNECT 403)
원본(1024px PNG)을 못 받았다. 원본 URL 은 **2026-10-18 만료** — 그 전에 받아서 같은 이름의 `.png` 로 둘 것.

| 파일 | 포즈 | 쓸 곳 | 원본 |
|---|---|---|---|
| ticket-hold | 서서 두 손으로 이용권을 가슴 앞에 | 앱 아이콘 후보 · 구매 완료 | https://www.figma.com/api/mcp/asset/ea83c683-4a58-4450-8a46-ded1b59f22c1.png |
| qr-phone | 폰 QR 을 보여 주며 윙크 | 이용 안내 · 사용 방법 | https://www.figma.com/api/mcp/asset/e419b649-c0e2-4786-9bcd-47392bfa1846.png |
| celebrate | 이용권 들고 점프, 색종이 | 결제 완료 · 첫 구매 | https://www.figma.com/api/mcp/asset/edac6f8b-0bbe-49bd-91d1-98f387e9322e.png |
| float-hug | 등으로 떠서 이용권을 배에 안음 | 빈 지갑 · 대기 상태 | https://www.figma.com/api/mcp/asset/61c7f4a5-a10a-494d-93cc-3c55beebe199.png |
| peek-card | 흰 카드 위로 고개·앞발 | 앱 아이콘 6-B 교체 후보 · 공유 카드 | https://www.figma.com/api/mcp/asset/9ea8dbc2-0c13-465e-bbd8-c052db372046.png |
| shopping-walk | 쇼핑백(이용권) 들고 걷기 | 홈 · 마케팅 | https://www.figma.com/api/mcp/asset/b6d249b4-c876-4b7c-9795-fbc22fe5955d.png |

⚠️ 스펙 편차: peek-card·float-hug 는 머리가 기준보다 둥글고 크다. qr-phone 은 손 모양이 단순하다.

## ❌ 폐기 (2026-10-11 대표 *"이전에 만든거랑 완전 달라, 느낌이 완전 달라"*)

위 6장은 확정 유달이(`../otter-pose-stand.png`)와 **다른 캐릭터**다 — 털이 주황빛, 흰 수염·크림 눈썹 무늬 없음, 얼굴형 다름.
원인: 글 설명만으로 생성(text-to-image). 글을 더 자세히 써서 2장 재시도했지만(`364b6c43…`, `0fb9f10b…`) 털이 회보라·펠트 질감으로 갔다.
⇒ **같은 캐릭터를 다른 포즈로 그리려면 원본 그림을 참고 이미지로 넣는 모델이 필요하다**(Figma Weave Nano Banana 등).
이 팀의 Weave 는 무료 2회를 이미 써서 막혀 있다(유료 플랜 필요). 그 전까지 새 포즈는 만들지 말 것 — 쓰면 캐릭터가 갈린다.

## v2 — 처음과 같은 방식으로 재시도 (2026-10-11 대표 *"한번 다시 해서 포즈 여러개 만들어봐"*)
gpt-image-2.5 + 캐릭터 설정서 문구 그대로 + 6포즈를 **한 장 시트로 한 번에**. `sheet-v2-gpt.thumb.jpg`(256px 미리보기) · 비교 `compare-v2.jpg`.
원본(1536×1024, 2026-10-18 만료): https://www.figma.com/api/mcp/asset/8f888b84-734c-4168-9711-5b58d1074a34.png
포즈: ① 이용권 두 손 ② 티켓 위로 빼꼼 ③ QR 폰 + 윙크 ④ 축하 점프 ⑤ 누워서 이용권 안기 ⑥ 쇼핑백 들고 걷기. 대표 판정 대기.
