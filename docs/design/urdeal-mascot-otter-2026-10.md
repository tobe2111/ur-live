# 유어딜 마스코트: 수달 (2026-10-06)

> 상태: **방향 탐색 중 (구현 전)**. 상표 등록·최종 원본은 아직 없다.

## 결정 흐름 (대표 발언 그대로)

1. *"우리 유어딜에 트레이드마크로 동물을 하나 넣을까 해. 어떤 동물이 좋을까?"* → 까치 / 수달 비교
2. *"수달이 좋긴 한데 수달 퀄리티 더 높게 하면 좋겠다. 지금은 곰 같기도 하고?"*
3. 손그림 SVG 시안 전부 → *"너무 별로다 모두.."* ⇒ AI 이미지 생성으로 방향 탐색 (선택지 1번)
4. 참고 사진(아기 수달, 유튜브 쇼츠 캡처) → *"되게 애기스러운 느낌으로"*
5. 현재: *"4. 3D 피규어형 이거 꽤 마음에 들어 일단"*

## 현재 기준안: 3D 피규어형

말랑한 점토/비닐 장난감 질감의 아기 수달. 큰 머리(아기 비율), 크림색 얼굴 마스크, 큰 광택 눈,
옆에 붙은 작은 귀, 볼 터치, **브랜드 블루(#1C69EF) 스카프**, 파란 줄이 들어간 흰 이용권.

생성 프롬프트(Figma AI · gemini-3.1-flash-image, 1536×1024):

```
3D rendered designer toy figure of a cute baby river otter mascot, soft matte clay / vinyl
material, chibi proportions with big head, brown fur, cream face mask, glossy big eyes,
small side ears, rosy cheeks, bright blue (#1C69EF) neckerchief, holding a small white
ticket with a blue band. Soft studio lighting, pastel off-white background, three poses:
standing and waving, sitting holding the ticket, floating on a small blue water ripple.
High quality, Pixar-like charm, no text.
```

⚠️ 생성 이미지 URL 은 2026-10-13 경 만료된다(Figma MCP 자산). 이 환경에서는 figma.com
다운로드가 막혀 레포에 원본을 못 넣었다 → **대표가 로컬에 저장해 `docs/design/assets/` 에 올릴 것.**

## 함께 정한 원칙 (어떤 스타일이든 공통)

- **곰처럼 안 보이게**: 귀는 정수리가 아니라 눈 높이 옆에 작게 · 머리는 납작하고 넓게 ·
  볼록한 수염 패드 두 개 · 크림색 턱받이.
- **브랜드 연결**: 파랑은 스카프·물결·이용권 밴드가 맡는다. 갈색은 캐릭터 안에서만.
- **해달 습성(배 위에 돌·손잡고 자기)은 쉬는 장면에만** — 정체성은 "동네 하천에 돌아온 수달".

## 사용 자리 (시안 캔버스 "어디에 쓰고 어디에 안 쓰나")

| 쓴다 | 안 쓴다 |
|---|---|
| 로딩 · 빈 화면 · 결제 완료 · 지도 내 위치 · 404/오류 · 카톡 공유 카드 · 앱 아이콘 | 토스 결제 위젯(잠금 파일) · 가격/할인율 옆 · 목록 카드마다 · 환불/경고 안내 · 셀러/어드민/도매몰 |

한 화면에 한 마리. 말풍선 대사 없이 자세·표정으로만.

## 남은 결정 / 할 일

- [ ] 3D 피규어형으로 포즈·표정 추가 생성 (Figma AI 크레딧 한도 소진 — 충전/리셋 후)
- [ ] 작은 자리(24px 아이콘·지도 핀)용 짝 스타일 확정 — 3D 는 작게 줄이면 뭉개진다
- [ ] 상표용 최종 원본: 일러스트레이터/3D 아티스트 의뢰 (AI 생성물은 저작권 보호가 어렵다)
- [ ] KIPRIS 선행 상표 검색 (수달 도형, 해당 상품류)
- [ ] 이름

시안 캔버스: https://claude.ai/artifact/H55erf8rdnSpKFfUUZAKuu (비공개 — 공유 메뉴에서 공유 필요)
