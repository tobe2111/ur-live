# 유어딜 마스코트: 수달 (2026-10-06)

> 상태: **캐릭터 완전 확정 (2026-10-07 대표 "이거 너무 좋다 … 이거로 완전 픽스")** — 기준 원본은
> `docs/design/assets/mascot/otter-turnaround-master.png`(정면·3/4·측면·3/4 뒤·뒤). 이 그림이 SSOT 다.
> 앞서 만든 접점 포즈 4종(점토 질감)은 이 기준과 질감·비율이 달라 **재생성 대상**. 상표용 3D 원본·이름·KIPRIS 미정.

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

## 디테일 요청 (2026-10-06 대표)

*"흰 콧수염이 난 형태도 궁금하고, 눈 살짝 위까지? 눈썹부분?까지 무늬가 하얗네."*
→ 흰 수염 강조 + 크림 마스크가 눈 위 눈썹 무늬까지 올라간 버전. Figma AI 크레딧 한도로 미생성.

## 접점 포즈 4종 (2026-10-07 생성 — 외부 피드백 반영)

피드백: *"QR 내미는 수달(매장 스티커), 지갑에 쌓아둔 수달(내 이용권), 도장 찍힌 수달(사용 완료),
하이파이브(정산 완료). 접점이 많은 서비스라 이게 실무적으로 중요해요"*

흰 눈썹 무늬·흰 수염·블루 스카프 반영. URL 은 2026-10-14 경 만료 → 대표 로컬 저장 필요.

| 포즈 | 쓰는 자리 | 보는 사람 | 생성 이미지 |
|---|---|---|---|
| QR 내미는 수달 | 매장 계산대 스티커·포스터, 사장님 "이용권 사용 처리" | 손님·직원 | https://www.figma.com/api/mcp/asset/ab0aafaa-7779-412f-ad88-652a564d099f.png |
| 지갑에 쌓아둔 수달 | 내 이용권(지갑), 결제 완료 "지갑에 담겼어요" | 손님 | https://www.figma.com/api/mcp/asset/c605557e-0b9c-473f-a4c6-4b13a9272896.png |
| 도장 찍힌 수달 | 이용권 사용 완료 화면·알림 | 손님 | https://www.figma.com/api/mcp/asset/35de6adb-920f-40bf-b078-7d0c7207515c.png |
| 하이파이브 수달 | 정산 완료 알림(카톡·푸시)·정산 완료 화면 | 사장님 | https://www.figma.com/api/mcp/asset/b4057ce9-1cbd-4a8e-8507-7bc7e3a3f329.png |

⚠️ 하이파이브는 셀러 쪽 장면이라 "셀러 화면엔 마스코트 없음" 원칙의 예외 — 정산 완료 한 곳만 허용 제안(대표 결정 대기).

화면 시안(캔버스 "확정 캐릭터: 접점 4곳 화면 시안"): 매장 스티커 · 내 이용권 요약 카드 · 사용 완료 · 정산 완료 알림.

## ⭐ 기준 원본 (SSOT) — 2026-10-07 확정

대표: *"이거 너무 좋다. 전이랑 다르긴 한데 이거로 완전 픽스할 수 있어?"*

| 파일 | 용도 |
|---|---|
| `assets/mascot/otter-turnaround-master.png` | 원본(회색 배경) — 모든 생성·의뢰의 기준 |
| `assets/mascot/otter-turnaround-transparent.png` | 같은 그림 투명 배경 |
| `assets/mascot/otter-view-front.png` · `-three-quarter-front` · `-side` · `-three-quarter-back` · `-back` | 방향별 투명 PNG (영상 도구 참조 이미지로 바로 넣는다) |

방향별 분리는 직선 자르기 대신 알파 연결 성분 단위(수염·꼬리가 옆 칸과 겹쳐 직선은 조각이 섞였다).

**확정 디자인의 특징 (이전 점토 버전과 다른 점)**
- 질감: 점토가 아니라 **보송한 봉제인형 같은 짧은 털**
- 비율: 머리가 몸 전체의 약 45%, 짧고 통통한 몸, 짧은 팔다리
- 얼굴: 아주 큰 동그란 갈색 눈(하이라이트 2개) · 연한 크림색 눈썹 두 개 · 작은 분홍 코 · 작은 미소 · 볼 터치
- 크림색: 볼·주둥이·턱에서 가슴을 지나 배 전체의 큰 타원까지
- 귀: 머리 옆 눈 높이에 작고 둥글게, 안쪽이 조금 어둡다
- 꼬리: 굵고 긴 수달 꼬리 · 발바닥 무늬 없이 둥근 발
- 스카프: 브랜드 블루(#1C69EF) 반다나, 앞에서 매듭 · 뒤에서는 삼각형만

## 접점 포즈 4종 v2 — 확정 디자인 기준 재생성 (2026-10-07)

대표: *"털 색상 다른 것 같은데? 얼굴도 가로로 길어진 것 같기도 하고? 신중하게 만들어줘."*
기준 원본에서 **측정한 값**을 문구에 넣었다: 털 #AA7A5A(밝은 카라멜) · 크림 #DDC9B7 · 머리 = 전체 키의 약 절반 ·
머리 가로:세로 ≈ 1.1:1(넓은 타원 금지). 아래 "캐릭터 설정서" 문구에 이 수치를 함께 쓴다.

측정 결과(갈색 화소 평균): 기준 **#9F7559** · v1 #8A6148~#91654D(어두움) · **v2 #9B6F52~#A47759**(기준과 일치).
v2 생성본 URL(2026-10-14 경 만료): qr `7fabbfb4-…` · wallet `1825fe77-…` · stamp `19978e8a-…` · highfive `2e66b4f5-…`
(전체 URL 은 https://www.figma.com/api/mcp/asset/<id>.png). 원본을 받으면 누끼 후 `assets/mascot/` 의 v1 파일을 교체한다.

페이지 적용 시안(캔버스 "확정 수달: 유어딜 페이지 적용 시안 10곳"): 로딩 · 이용권 사용(QR) · 사용 완료 · 결제 완료 ·
내 이용권 · 빈 화면 · 404 · 첫 가입 환영 · 사장님 정산 알림 · 매장 스티커.
⚠️ 구현 시 잠금: 결제 완료(`PaymentSuccessPage` Toss 잠금) · 로딩(`BrandLoader` 로더 연속성 가드) → 각각 별도 승인.

## 장면용 포즈 3종 · 모션 · 표정 시트 (2026-10-07)

대표: *"빈 화면, 연결 오류, 로딩에서는 다른 이미지가 필요하겠는데? 그리고 움직이는 모션도 만들 수 있어?"*

| 장면 | 포즈 | 생성본(2026-10-14 경 만료) |
|---|---|---|
| 빈 화면 | 빈 파란 지갑 들여다보며 갸웃 | `c8ac4751-6c16-4460-a749-fdccf3dab94c` |
| 연결 오류 | 빠진 케이블 양 끝 들고 땀 한 방울 | `6ee48765-64c3-4d7f-ae9f-5e6a7e9e756a` |
| 로딩 | 이용권 들고 오른쪽으로 달리기 | `b0f0f7db-bac3-4d82-a103-8df941540df4` |
| 표정 시트 8종 | 기본·웃음·신남·놀람·갸웃·졸림·미안·윙크 | `5f640b8f-0610-4dd6-ab1f-52b990a85161` |

(전체 URL: https://www.figma.com/api/mcp/asset/<id>.png) 표정 시트 1차(gemini)는 얼굴이 길어 폐기, 이번은 측정값 문구로 재생성.

**모션 (시안에 적용 — 캔버스 "페이지 적용 시안 10곳" ①⑥⑦)**: 이미지 한 장을 CSS 로 움직이는 방식.
로딩 = 통통 튀기 + 그림자 0.7초 반복 · 빈 화면 = 3초마다 갸웃 · 연결 오류 = 좌우 흔들흔들.
`prefers-reduced-motion` 이면 정지. 팔다리가 실제로 움직이는 애니메이션은 AI 영상 또는 3D 리깅본이 필요.

**AI 영상(Figma Weave)**: 대표가 Weave 에 Figma 계정 연결 완료(10-07). 그러나 Listing 팀이 **무료 Starter 플랜이라
영상 모델이 막혀 있다**("Video models are only available on paid plans"). 사용 가능 모델(유료 시): Kling Video ~35 ·
Kling 3 ~82 · Veo 3.1 이미지→영상 ~90 · Kling Motion Control ~164(실사 동작 영상을 수달이 따라 함 — 릴스 전략과 직결).
대표: *"일단 영상 말고"* → 보류.

## 이름 후보 (대표 결정 대기)

| 이름 | 뜻 | 메모 |
|---|---|---|
| **유달이** (추천) | 유어딜 + 수달 | 서비스와 동물이 한 이름에. 목포 "유달산"과 소리가 같음 |
| **딜달이** | 딜 + 수달 | 서비스 성격이 드러남. 발음이 약간 꼬임 |
| 달이 | 수달의 "달" | 가장 짧지만 흔해서 상표로 지키기 어려움 |
| 오딜 | Otter + Deal | 영문·해외용 |
| 딜리 | Deal + 애칭 | 배달 서비스처럼 들릴 수 있음 |
| 모아 | 이용권을 "모아" | 수달과 연결이 약함 |

확정 전 KIPRIS 동일 상품류 검색 필요.

## 화면 배치 계획 (우선순위)

- **1순위(핵심 순간)**: 결제 완료 · 이용권 사용 화면(QR) · 사용 완료 · 매장 스티커
- **2순위(빈 화면)**: 이용권 0장 · 검색 결과 없음 · 찜 0개 · 404 · 연결 오류
- **3순위(관계)**: 첫 가입 환영 · 리뷰 작성 완료 · 친구 초대·공유 카드(OG) · 사장님 정산 완료 알림 · 입점 승인 알림
- **안 씀**: 결제 위젯 안 · 가격·할인율 옆 · 목록 카드마다 · 환불·사용 불가 안내 · 셀러 대시보드·어드민·도매몰(정산 알림만 예외 결정 대기)
- 구현 잠금: 결제 완료(`PaymentSuccessPage`, Toss 잠금) · 로딩(`BrandLoader`, 로더 연속성 가드) → 각각 별도 승인

## 3D 제작 의뢰서

`docs/design/urdeal-mascot-3d-commission-brief.md` (초안 — 예산·일정·애니메이션 형식·이름 결정 후 발송).

## 누끼(투명 PNG) — 2026-10-07

대표가 원본 1024px 4장을 전달 → BiRefNet(`rembg birefnet-general`)으로 배경 제거, 여백 24px 로 크롭.
`docs/design/assets/mascot/otter-{qr,wallet,stamp,highfive}.png` (투명 배경).
- 1차 isnet 모델은 도장 수달의 오른쪽 눈썹을 지우고 종이·티켓을 반투명하게 만들어 **폐기**.
- 남은 흠: 하이파이브의 금화·반짝이는 배경으로 판정돼 빠졌다(오히려 깔끔). 도장 종이 오른쪽 위 가장자리가 조금 뜯겨 보인다.
- 원본이 AI 생성물이라 최종 상표·인쇄용은 3D 아티스트 재제작본으로 교체한다.

## 캐릭터 설정서 (AI 영상·추가 생성용 고정 문구)

대표: *"측면 정면 뒷모습 다 필요하거든? AI로 얘 영상도 만들거야. 최대한 정확하게."*
영상 도구(Kling·Runway·Veo 등)에는 **아래 문구 + 기준 이미지(누끼 PNG·턴어라운드)를 함께** 넣는다.
문구를 바꾸면 캐릭터가 바뀐다 — 수정은 이 문서에서만.

```
Cute chibi baby otter mascot, 3D animated character, soft plush short fur texture (like a high-end stuffed toy).
VERY BIG ROUND HEAD (about 45% of total height), short chubby body, short stubby arms and legs, rounded feet.
Light caramel-brown fur (#AA7A5A, not dark chocolate). Head is about half of total height and almost round (width:height ≈ 1.1:1, not a wide oval). Small rounded ears on the sides of the head at eye level, slightly darker inside.
Cream-white fur on cheeks, muzzle and chin continuing down the chest into a large cream oval belly.
Two soft cream-white eyebrow marks. Very large round glossy brown eyes with two white highlights.
Small rounded pink nose, small gentle smile, soft pink cheek blush, thin white whiskers.
Long thick tapering otter tail. Bright cobalt-blue (#1C69EF) bandana neckerchief knotted at the front;
from behind only the triangle of the bandana shows.
```

턴어라운드 생성 이력 (원본은 위 ⭐ 기준 원본으로 레포에 저장 완료):
- **확정**(gpt-image-2.5): https://www.figma.com/api/mcp/asset/380c367b-a43a-4ac6-acd7-e2f4818fbc74.png
- 폐기(gemini, 머리가 작아 다른 캐릭터처럼 보임): https://www.figma.com/api/mcp/asset/7d988555-9ad7-4cf9-9d45-07aed7f08157.png
- 표정 시트 1차(gemini) — 얼굴이 길고 나이 들어 보여 **재생성 필요**: https://www.figma.com/api/mcp/asset/f845b4fd-359f-420a-a0c1-f9258055a056.png

⚠️ AI 생성 턴어라운드는 시점마다 미세하게 달라진다. 영상 일관성의 상한은 결국 **리깅된 3D 모델**이다(아래 릴스 전략).

## 활용 전략: 실사 영상 + 캐릭터 릴스 (대표 구상)

*"트레이드마크 정하면 릴스도 만들텐데 실제 식당, 숙소 영상에다가 저 트레이드마크 캐릭터가
움직이는 그런 전략으로 생각 중이야"*

- 그림 한 장이 아니라 **리깅된 3D 모델**이 필요하다(편마다 같은 캐릭터가 움직여야 한다).
  AI 영상 도구는 파일럿 릴스로 반응 확인까지, 최종은 3D 아티스트 의뢰(저작권 확보).
- 15초 구성 예: 입구에서 빼꼼 등장 → 음식/객실 옆에서 이용권 들고 신남 → 가격 자막 → 손 흔들기 + 로고.
- 선결 조건: 매장 촬영·게재 동의(입점 약관에 포함 검토) · 음식/객실/가격은 실물과 동일(표시광고법) ·
  의뢰 전 동작 목록 확정(걷기, 손 흔들기, 신남, 놀람, 앉기, 눕기).

## 남은 결정 / 할 일

- [ ] 3D 피규어형으로 포즈·표정 추가 생성 (Figma AI 크레딧 한도 소진 — 충전/리셋 후)
- [ ] 작은 자리(24px 아이콘·지도 핀)용 짝 스타일 확정 — 3D 는 작게 줄이면 뭉개진다
- [ ] 상표용 최종 원본: 일러스트레이터/3D 아티스트 의뢰 (AI 생성물은 저작권 보호가 어렵다)
- [ ] KIPRIS 선행 상표 검색 (수달 도형, 해당 상품류)
- [ ] 이름

시안 캔버스: https://claude.ai/artifact/H55erf8rdnSpKFfUUZAKuu (비공개 — 공유 메뉴에서 공유 필요)
