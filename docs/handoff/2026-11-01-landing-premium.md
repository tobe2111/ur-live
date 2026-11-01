# 2026-11-01 — 세 랜딩 고급화 (시안 여섯 가지 전부 적용)

대표: *"아직 좀 아쉬움이 남는데 더 고급스럽게 하려면?"* → 시안(claude.ai 아티팩트 MkfmKhNgrXLLFBa1QXVtwM)
→ ***"전부 세 페이지에 모두 적용해줘."*** 대상: `/partners` · `/influencer` · `/about`.

## 무엇을 했나
공통 부품 `src/pages/landing/premium.tsx` + `premium.css` (라이브러리 0, 세 페이지 청크에만 실림):

| 시안 | 부품 | 적용 |
|---|---|---|
| ① 실사진 첫 화면 | `PhotoHero` (사진 SSOT `LANDING_PHOTOS`) | 세 페이지 히어로 |
| ② 문구 절반 | 각 페이지 문구 | 히어로 글 덩어리 4 → 3, 단계·장점 설명 축약 |
| ③ 실기기 폰 + 화면 영상 | `DeviceStage` · `StickyStory` 폰도 `ur-device` | 세 페이지. 손님 화면은 **라이브 앱 녹화**(`customer-home.mp4`, 212KB, 보일 때만 재생) |
| ④ 스크롤 따라 바뀌는 바탕 | `ToneScroll` + `data-tone` (`ink`/`paper`/`tint`) | partners: 90% → 폰 무대, 스토리 4단계 · influencer: 0원 → 폰 무대 · about: 스토리 → 19조 |
| ⑤ 거대한 숫자 | `GiantNumber` (aria-hidden + select-none, 스크롤만큼 파랗게) | 90% · 0원 · 19조 원 |
| ⑥ 제목 전용 글꼴 | `useLandingFont` (Noto Serif KR · Inter Tight, Google Fonts) | 세 페이지 h1·h2·`.ur-display` 만 |

가드: `landing-premium-2026-11-01.test.tsx`(P1~P6) + 주입 `scripts/mutations/landing-premium-2026-11-01.mjs` 8건 **전부 빨간불 확인**.
재조준(지우지 않음): `partners-landing` 테스트의 폰 판정에 `<DeviceStage` 포함 · 히어로 판정을 `<PhotoHero>` 로 ·
주입 4건(`consumer-type-scale` 2 · `landing-pc` 1 · `partners-landing` 1)을 새 제목/부품으로 — 4건 다 빨간불 확인.
로컬 렌더(라이트·다크, 390·1440)로 눈 확인 완료.

## 다음 세션 첫 액션
1. 배포 후 라이브 E4: `/partners` `/influencer` `/about` 를 폰(390)·PC(1440)로 열어 ① 첫 화면 사진 ② 폰 무대 영상 재생
   ③ 바탕 전환 ④ 숫자 채움 ⑤ 제목이 명조인지(`document.fonts` 에서 Noto Serif KR loaded) 확인.
2. **실제 매장 사진 교체** — 지금 세 페이지가 앱 상품 사진 한 장(`deal-photo.jpg`)을 위치만 바꿔 나눠 쓴다.
   대표가 사진을 주면 `public/static/partners/` 에 넣고 `LANDING_PHOTOS` 세 줄만 바꾼다.

## 틀렸던 판단 / 발견
- 히어로 사진에 `fetchPriority` 를 썼는데 React 18 이 모르는 속성이라 콘솔 경고 → 소문자 `fetchpriority` 스프레드.
- `pkill -f "vite --port 5199"` 가 **자기 셸 명령줄에도 그 문자열이 있어** 셸째 죽였다(커밋이 통째로 안 됨). 프로세스는 PID 로 죽일 것.
- 이용권 상세(`/pass/2919`) 라이브 녹화에서 **"이 이용권 팔아보기" 블록이 좌우 여백 없이 화면 끝에 붙는 것**을 발견(모든 프레임). 이번 범위 밖 — 별건.
- 유어샵(`/u/jiwon1228`) 녹화는 진열 1개라 움직임이 없어 쓰지 않았다(정적 캡처 사용).

## 남은 결정
- 실제 매장 사진(가로 3~5장) 제공 — 대표.

## CI 후속 (같은 날)
- Verify 1차 실패: 크롤러용 문구 SSOT(`surface-copy.ts`)에 줄이기 전 문장 4줄이 남아 클로킹 가드 빨간불 → 화면 문장으로 교체 + `/influencer` 길이 바닥 채움(`a18fa29`).
- Verify 2차 실패: 화면별 무게 예산 `home +1.5`. **이 PR 원인 아님** — main 도 `31da07d`·`ae50dac`·`ae23e02`·`a36f305` 연속 빨간불.
  공용 `app-utils` +1.0KB 는 `3123c2d` 무렵부터 허용 안에서 쌓여 있었고(CI 실측 home 196.4), #2056(홈 지역 사진 16칸)이 홈에 +0.3 을 더해 넘겼다.
  두 버전(1386224 · 이 브랜치)을 로컬 빌드하니 app-utils 는 **바이트 동일** — 증가는 그보다 이전이다. 사유와 함께 `--rebaseline`.
