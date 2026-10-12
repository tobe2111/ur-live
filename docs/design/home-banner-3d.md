# 홈 배너 — 3D 카드 캐러셀 (2026-10-12 시안 접수)

대표: *"메인 페이지에 있는 배너 디자인을 이 세션에서 계속 맡을거야. 퀄리티가 상당해야해."*
→ 레퍼런스(NOL/야놀자 홈) 2장 + *"이렇게 3d 디자인이 좋겠어."*

레퍼런스: `assets/home-banner-3d-ref-nol-a.jpg` · `assets/home-banner-3d-ref-nol-b.jpg`

## 레퍼런스 분해

| 요소 | NOL |
|---|---|
| 틀 | 화면 폭 ~92% 큰 카드, 비율 약 3:2, 모서리 ~24px, 좌우 이웃 카드가 살짝 보임 |
| 그림 | 3D 클레이/글로시 오브젝트 하나가 주인공(알람시계·VIP 뱃지), 배경은 장면(하늘·우주) |
| 글자 | 좌하단 흰 굵은 2줄 제목 + 1줄 보조. 그림 안에 글자 없음(코드가 얹음) |
| 조작 | 우하단 반투명 알약 둘: 일시정지 · `10 / 17 +`(전체 보기) |
| 동작 | 자동으로 넘어감(일시정지 버튼이 있다는 것은 자동 재생이라는 뜻) |

## 현재 우리 코드와의 차이

| | 지금 (`HomeBannerStrip` strip, 2026-09-05 안 3) | 시안 |
|---|---|---|
| 높이 | 96px 띠 | 카드 약 240px(390폭 기준) |
| 그림 | 어드민 사진 + 검은 그라디언트 | 3D 일러스트, 아래쪽만 옅은 스크림 |
| 자동 재생 | 없음(의도적) | 있음 + 일시정지 |
| 카운터 | 점 | `n / N +` 알약 |
| 라이브 배너 | **0건**(자리 지정된 배너 없음 → 지금 홈엔 배너가 안 뜬다) | — |

## 3D 일러스트 1차 (2026-10-12, Figma `gpt-image-2.5-sunburst`, 1536×1024)

같은 프롬프트 골격(글로시 클레이 · 오브젝트 우상단 · 좌하단 비움 · 글자 없음)으로 4장.
미리보기 썸네일만 레포에 있다(`assets/home-banner-3d-art-{a..d}-thumb.jpg`) — 이 환경은
figma.com 다운로드가 막혀 원본을 못 넣는다. **원본 URL 은 2026-10-19 경 만료.**

| 안 | 장면 | 원본 |
|---|---|---|
| A 이용권 | QR 티켓 + 라멘 + 커피, 코발트 배경 | https://www.figma.com/api/mcp/asset/7e1bb63d-32b6-47ef-82b5-7db05631d693.png |
| B 교환권 | 열린 선물상자 + 아이스커피 + 코인, 밤하늘 | https://www.figma.com/api/mcp/asset/0444216f-165f-40a7-a908-067d618e6dc7.png |
| C 유어샵 | 파란 차양 미니 가게 + 폰, 하늘·구름 | https://www.figma.com/api/mcp/asset/a6f963e9-1d38-4856-bd57-7f28563dc4ed.png |
| D 숙소·미용 | 객실 키 + 베개 + 가위·거울, 인디고 | https://www.figma.com/api/mcp/asset/805c35d6-0230-447a-b55c-af87905bd64d.png |

카드에 얹어 본 모의: `assets/home-banner-3d-mock-v1.jpg` (390px 폰, 카피는 가안).
발견: A 의 보조 문구가 우하단 조작 알약 밑으로 들어간다 → 구현 때 카피 칸 최대 폭을 조작부만큼 비울 것.

## v2 — 2:1 · 색 다양화 · 유달이 (2026-10-12 같은 날)

대표: *"색상을 너무 파란색만 할 필요는 없어."* · *"유달이 캐릭터 넣은 시안도 있으면 좋겠다"* · ***"2:1(362×181) 배너 크기야"***

- **틀 확정: 2:1, 폰 362×181** (390폭 − 좌우 14). 높이가 낮아 카피는 **왼쪽 절반**, 그림은 **오른쪽 절반**.
- **색**: 장마다 다른 색 세계 — 코럴(이용권) · 민트(교환권) · 옐로(유어샵) · 라일락(숙소·미용) · 블루/피치(유달이). 블루는 하나의 선택지로만.
- 생성기는 16:9(1536×864)까지라 2:1 은 위아래 약 11% 크롭 — 오브젝트를 오른쪽 절반 세로 중앙에 두게 지시해 잘림 없음.
- 🩸 **처음엔 유달이를 잘못 골랐다** — `docs/design/assets/mascot/otter-qr.png`·`otter-wallet.png` 는 **옛 얼굴**이다
  (대표 *"유달이 디자인 저거 아니야"*). 서비스에 나가 있는 현행 유달이는 **`src/assets/mascot/udal-*.webp`** 다.
  모의는 `udal-pose-qr.webp`·`udal-pose-wallet.webp` 로 다시 그렸다. ⚠️ 그 둘은 높이 238px 뿐이라
  카드에서 150px 로 그리면 2배 화면에서 약간, 3배 화면에서 눈에 띄게 흐리다 → 실제 배너엔 더 큰 원본이 필요하다.
- **유달이는 새로 그리지 않았다.** 유달이 생성 철칙(2026-10-11, 예외 없음) ④가 원본 해상도 검수를 요구하는데
  이 환경은 원본을 못 받는다 ⇒ **확정 포즈 그림**(`assets/mascot/otter-qr.png` 703×878 · `otter-wallet.png` 800×892)을
  유달이 없는 배경판(받침대만 생성) 위에 **합성**했다. 앱 아이콘 6-B 와 같은 '확정 그림 재사용' 경로.
  181px × 3배 = 543px 이라 확정 포즈 해상도로 충분하다. 새 포즈가 필요하면 그때는 철칙대로(원본 첨부 → 검수).

모의: `assets/home-banner-3d-mock-v2.jpg` · 썸네일 `assets/home-banner-3d-v2-*-thumb.jpg`

| 안 | 원본(2026-10-19 경 만료) |
|---|---|
| A 이용권 · 코럴 | https://www.figma.com/api/mcp/asset/9e7e45a2-8cea-4261-970a-877cf8f35442.png |
| B 교환권 · 민트 | https://www.figma.com/api/mcp/asset/d2339aeb-f538-4fe5-a210-70f98d0d30c1.png |
| C 유어샵 · 옐로 | https://www.figma.com/api/mcp/asset/6a9de1e0-d85d-4bf4-acdb-8c29f5119402.png |
| D 숙소·미용 · 라일락 | https://www.figma.com/api/mcp/asset/c0ca135c-6238-465c-82ea-598c048e6b6f.png |
| E 유달이 배경 · 블루(+ otter-qr) | https://www.figma.com/api/mcp/asset/76f6e1c0-f187-46cd-9fcd-218b37093154.png |
| F 유달이 배경 · 피치(+ otter-wallet) | https://www.figma.com/api/mcp/asset/e3ca24b3-378d-41e3-a187-945f0401298e.png |

## 글꼴 (2026-10-12)

앱 글꼴 **Pretendard** 그대로(이미 로드됨 — 배너 전용 폰트를 더하지 않는다). 글자는 **그림에 굽지 않고 코드로 얹는다**
(선명함 · 어드민에서 문구 수정 · 스크린리더). 정본 타입 스케일 안에서 고른다(20px 같은 스케일 밖 값 금지):

| 요소 | 크기 · 굵기 |
|---|---|
| 제목 2줄 | **24px · 700** · 행간 1.25 · 자간 −2% (권장 — 17px 은 작고, 800 은 두껍게 뭉친다) |
| 보조 1줄 | 13px · 500 · 흰색 85% |
| 카운터 | 12px · 600 |

비교: `assets/home-banner-3d-font-compare.jpg`

## v3 — 유달이 확정 · 자동 넘김 · 지역 주제 (2026-10-12)

- 대표 *"유달이 디자인 저거 아니야"* → *"유달이 사진 줄게"*(v6 색 보정 비교판). ⇒ **v6 를 원본 해상도로 검수**해
  칸 1·2·3·6 통과, 4(입 벌림)·5(판정 불가) 불합격. 근거: `assets/mascot/poses-2026-10-11/README.md` 맨 아래.
  누끼 `v6-cut-{1,2,3,6}.png`. 512px 칸이라 배너(카드 높이 179 × 3배 ≈ 540px)에 충분하다.
- 대표 ***"자동으로 넘어가게 해줘"*** → 구현(4.5초). 안전장치: 멈춤 버튼 · 손가락 닿으면 8초 멈춤 · 화면 밖/숨긴 탭 정지 ·
  동작 줄이기면 아예 안 넘김. 브라우저 실측: 기본 `1→2→3` · 동작 줄이기 `1→1` · 멈춤 `1→1` · 터치 후 `1→1→3`.
- 폰 카드는 **좌우 16px**(헤더 로고·탭과 같은 선): 390 폰 358 × 179 · 394 폰 362 × 181 — 비율은 늘 2:1.
- PC 는 2:1 카드 **세 장 나란히**(한 장이 가로 전체면 700px 가 넘는다). 렌더: `assets/home-banner-3d-render-{mobile,pc}.jpg`.
- 대표 ***"이벤트는 따로 없는 상황이니, 배너 내용은 부산, 서울 같이 지역별 주제로"*** → 지역 다섯.
  라이브 지역별 딜 수(`/api/regions`, 2026-10-12): 서울 171 · 경기 49 · 부산 31 · 강원 26 · 전남 24 · 충남 16 · 경북(경주) 9 · 제주 8.
  **많고 + 3D 랜드마크로 바로 알아보는** 곳: 서울 · 부산 · 강원(강릉) · 제주 · 경주. 링크 = `/region/<시도>`(기존 지역 랜딩).

| 지역 | 장면 · 색 | 카피(가안) | 링크 | 그림 |
|---|---|---|---|---|
| 서울 | 롯데월드타워·남산타워·한강 다리 · 보라→주황 노을 | 서울에서 바로 쓰는 / 동네 이용권 | `/region/서울` | ❌ 1차 폐기(지어낸 장면) — 레퍼런스 기준 재생성 대기 |
| 부산 | 광안대교(실제 모양)·마린시티 · 분홍 노을 | 바다 보고 한 끼, / 부산 동네딜 | `/region/부산` | ⏳ Figma AI 크레딧 소진 |
| 강원 | 소나무 산·등대·강릉 커피 · 숲 초록 | 강릉 커피 한 잔도 / 이용권으로 | `/region/강원` | ⏳ |
| 제주 | 돌하르방·한라산·돌담·귤 · 귤빛 | 제주 여행, / 동네 가격으로 | `/region/제주` | ⏳ |
| 경주 | 첨성대·고분·정자·단풍 · 가을 금빛 | 천년 고도 경주의 / 오늘 혜택 | `/region/경북` | ⏳ |


### 🔁 지역 그림 기준 — "지어내지 말 것" (2026-10-12 대표)

대표: ***"지역적으로 현실적으로 비슷해야해. 이상하게 지어내면 안돼. 첫번째 사진은 서울, 두번째 사진은 부산."***
(레퍼런스 사진 2장 — 세션에 파일로 안 남아 설명으로 기록한다)

- **서울 레퍼런스**: 노을(보라→주황) 속 야경. 화면 중앙에 **롯데월드타워**(가늘게 솟은 첨탑형 초고층, 꼭대기 격자 조명),
  그 뒤 **남산 위 N서울타워**, 사이로 **한강과 다리들**(조명 띠), 앞은 빽빽한 아파트·빌딩 불빛, 뒤로 산 능선.
- **부산 레퍼런스**: 분홍 노을 바다. **광안대교** — 주탑 두 개(문 모양 사각 아치)·**복층 트러스 상판**·현수 케이블,
  오른쪽에 **마린시티/해운대 초고층 타워들**, 바다 위 작은 유람선.

⇒ 규칙: **실제 랜드마크의 실제 모양·실제 배치**를 그린다. 떠 있는 섬·한옥+타워 조합 같은 **상징 짜깁기 금지.**
3D 질감(클레이/미니어처)은 유지하되 *모양과 위치 관계*는 사진처럼. 도시마다 사진을 받아 그 구도를 따른다.
❌ 1차 서울 그림(`home-banner-region-seoul-thumb.jpg` — 떠 있는 섬에 타워·한옥·벚꽃)은 **폐기** — 지어낸 장면이다.

프롬프트 v2(크레딧 회복 후 생성):
- 서울: *3D clay-render miniature of the real Seoul skyline at dusk, faithful to reality: Lotte World Tower (slender tapering
  supertall with lattice crown) on the right half, Namsan hill with N Seoul Tower behind it, the Han River with lit bridges
  crossing, dense apartment blocks with warm window lights, mountain ridge silhouette; violet-to-orange sunset sky; left half calm sky.*
- 부산: *3D clay-render miniature of the real Gwangan Bridge, Busan, faithful to reality: two rectangular arch-shaped main towers,
  double-deck steel truss roadway, suspension cables, Marine City supertall towers on the right shore, calm sea with a small tour
  boat; pink sunset sky; bridge spans the right half, left half calm sky and sea.*
- 강원·제주·경주: 대표에게 레퍼런스 사진을 받아 같은 방식으로.

프롬프트 골격(1차 — 폐기, 기록용)(같은 세계관 유지 — 다섯 다 이 틀): *Wide 2:1 premium 3D render … Soft glossy clay-plastic miniature diorama …
a cute miniature <지역> diorama on a small round floating island: <랜드마크들> … and a tiny 3D coupon ticket floating with a sparkle.
Color world: <색> … the diorama sits in the RIGHT HALF … ENTIRE LEFT HALF is empty … No text, no letters, no signs, no logos.*
(모델 `gpt-image-2.5-sunburst`, 1536×768 요청 → 1536×864 수신 → 2:1 로 위아래 크롭.)

## 구현 todo (대표 결정 후)

- [x] 틀 크기: **2:1 · 362×181** (대표 확정)
- [x] 자동 넘김 (대표 확정) — 구현 완료(이 브랜치)
- [x] `HomeBannerStrip` strip 렌더를 2:1 3D 카드로 (12/16 라운드, 왼쪽 스크림, 멈춤 + `n / N`)
- [x] 자동 넘김 안전장치 넷 (가드 테스트 + 주입 3건)
- [x] 어드민 규격 안내 갱신 — 1600×800(2:1), 왼쪽 비우기, 글자 굽지 않기
- [ ] 지역 4장(부산·강원·제주·경주) 생성 — Figma AI 크레딧 회복 후
- [ ] 대표가 원본 저장 → `/admin/banners` 에 자리 '상단 배너' 로 등록(발행은 대표)
- [x] 첫 장 eager + fetchPriority high, 나머지 lazy
- [ ] 홈 SSR 첫 화면(`home-first-screen.ts`)이 배너 높이를 모른다 → 배너 켜는 날 카드가 밀린다(2026-10-08 기록) — 같이 해결
