# 2026-10-07 — 유달이(마스코트) 화면 구현 1차

서비스: **유어딜(소비자)**. 머니 경로 접촉 없음.

## 대표 지시
- *"유달이 서비스 화면에 넣는 개발 시작해줘. 그리고 표정 사진 보냈어. 의뢰는 따로 안할거야. 너한테 계속 요청할거야"*
- 보낸 표정 시트는 이미 저장된 `docs/design/assets/mascot/otter-expressions-master.png` 와 **픽셀 동일**(차이 0) — 재저장 불필요.

## 한 것
- 부품 `src/components/mascot/Udal.tsx` — 화면은 상황(`mood`)을 고르고 표정은 부품의 표가 정한다.
- 이미지 `src/assets/mascot/udal-*.webp` 8장(같은 캔버스 359×394, 장당 ~25KB, Vite 해시 → `/assets/`).
- 붙인 화면: 404 · 기본 오류(ErrorBoundary) · 목록 못 불러옴(ListLoadError) · 검색 오류/0건/입력 전 · 찜 0개 · 이용권 사용 완료(VoucherRedeemModal).
- 둥실 움직임 `.ur-udal-bob`(움직임 줄이기 시 정지) + 아래 14% 페이드 마스크.
- 가드 `udal-mascot-2026-10-07.test.ts` 14건 + 주입 5건(전부 빨간불 확인).
- 404 의 거대한 '404' 글자를 지우면서 그 글자에 걸려 있던 주입 앵커(`consumer-type-scale`)를 소개 페이지 100px 워터마크로 재조준(불변식 동일).
- 문서: 마스코트 문서에 "✅ 구현 1차" 표 + 3D 의뢰 **보류** 기록.

## 검증
- tsc 0 · 관련 유닛 50파일 782건 + 신규 14건 pass · `npm run build` 0 · stale-mutation-anchors 0.
- `visual-preview` 로 404(라이트·다크)·검색 0건 렌더 눈 확인.

## 다음 세션 첫 액션
1. 포즈 원본 7종(QR·지갑·도장·하이파이브·빈 지갑·케이블·달리기)이 올라오면 rembg `birefnet-general`(한 장씩 프로세스 분리)로 누끼 → `src/assets/mascot/` 에 추가하고 `Udal` 에 포즈용 prop(또는 별도 부품) 추가.
2. ~~잠금 화면 허가~~ → 같은 세션에서 승인·구현(아래).

## 틀렸던 판단
- 없음(이번 범위). 다만 `ErrorBoundary` 는 앱 셸이라 부품이 셸 폐쇄에 들어간다 — 이미지는 URL 문자열뿐이라 렌더 전엔 내려받지 않는다(번들 영향은 부품 코드 ~1KB).

## 남은 결정
- 정산 완료 알림(사장님 쪽) 예외 여부.

## 추가 (같은 세션)
- 🩸 `ErrorBoundary`(셸)가 `Udal` 을 정적 import 하자 `critical-chunks` 가 **첫 페인트에 청크 9개 진입**으로 빨간불 —
  `vite.config.ts` app-shell 목록에 `/src/components/mascot/` 한 줄 추가로 해소(CLAUDE.md 로딩 audit log 기록).
  ⇒ **셸 부품에 새 부품을 붙일 땐 그 부품 폴더도 app-shell 에 넣어야 한다**(규칙 주석에 이미 적혀 있다).
- 전체 유닛 867파일 11,067건 pass.

## 잠금 화면 3곳 (대표 AskUserQuestion 승인: 이용권 0장 · 결제 완료 · 로딩 화면)
- 이용권 0장: `my-vouchers/WalletEmpty.tsx` 의 티켓 SVG → 유달이(empty). 잠금 파일 `MyVouchersPage.tsx` 자체는 무접촉.
- 결제 완료: `PaymentSuccessPage.tsx` 성공 아이콘만 교체 — 잠금 지문 11종 전후 동일. CLAUDE.md Toss audit log 기록.
- 로딩: 정적 로더(워커) + `BrandLoader` 로고 위 유달이. 고정 경로 `public/assets/mascot/udal-loader-v1.webp` + `index.html` preload.
  SSOT `src/shared/udal-loader.ts`. 대시보드(forceLight)엔 없음. loader-continuity 불변식 +5.
- ⚠️ 그림을 바꾸면 **파일명 버전(-v2)을 올릴 것** — `/assets/*` 는 1년 immutable 캐시.
- 🩸 틀릴 뻔한 것: 워커 import 를 기존 한 줄 끝에 붙였더니 그 줄 끝 `// 한 줄: …` 주석 **뒤**라 import 가 주석이 됐다(tsc 가 잡음).
- 배포 후 확인할 것(E4): 하드로드 시 정적 로더 → 앱 로더 교체 순간 유달이가 안 튀는지 · 결제 완료 화면 정상 렌더(staging 실결제 1회 권장).

## 홈(메인) 두 자리 (대표 *"메인 페이지에는 넣을 곳이 있나?"* → *"1번 2번 둘 다 진행해줘"*)
- ① 지도 목록 0건(`restaurant-map/RestaurantList`): 핀 아이콘 → 유달이(notFound, 104px).
- ② 내 주변 5km 밖 안내 띠(`NearbyEmptyBanner`): 글자 왼쪽에 유달이(notFound, 44px). 띠는 목록이 **비어 있지 않을 때만** 떠서 ①과 한 화면에 안 겹친다.
- 44px 에서 표정이 뭉개지는지 실제 크기(2x)로 렌더해 확인 — 눈·볼·스카프 판독됨.
- 홈 첫 화면(카드 피드)에는 일부러 안 넣었다(문서: 목록 카드마다 금지 · 가격 옆 금지).

## 2차 — 확정 시안 10곳 포즈 적용 (대표 *"남은 것들 모두 해줘"*)
- 포즈 원본은 대표 시안 아티팩트 Pages 보드의 누끼 8장(`Artifact read` + 자산 id 로 내려받음). 새로 생성 안 함.
- 표정 흉상 6장 삭제, 포즈 7장 + 로더 v2 추가. `Udal` 표가 그림마다 비율을 갖는다(흉상만 아래 페이드).
- 새 자리: QR 사용 화면 모서리 · 지갑 맨 위 금액 옆 · 가입 환영 시트. 로더는 달리는 수달 + 0.7초 통통.
- 안 한 것: ⑨ 정산 알림(알림톡 이미지 템플릿 심사 필요) · ⑩ 계산대 스티커(인쇄물).
- 🩸 잊지 말 것: 원본이 ~200px 라 128px 넘게 키우면 흐려진다(404 152→128, 빈 지갑 136→120 으로 줄였다).
- 배포 후 확인: 하드로드 로더가 v2 로 바뀌는지(`/assets/mascot/udal-loader-v2.webp` 200) · 지갑 상단 수달.

## 3차 (대표 "1번 넣고 모두 머지해줘")
- 홈 피드 빈 화면(`main-home/GroupBuyFeed.tsx` `EmptyStateWithFallback`) — 회색 원+돋보기 → `Udal mood="empty" size={96}`. PC·모바일 홈 공통.
- 동반: lucide 뜻 아이콘 래칫 171→170(환영 시트 Sparkles)→169(SearchX). 안 내려서 CI 주입이 통과→Verify 실패했던 것(`9d64a72`).
- `home-chunk-diet` OK_PARTS 거울에 `/src/components/mascot/`(이미 app-shell 규칙) 추가.
- 대표가 고르지 않은 2번(피드 오류 화면)·3번(PC QR 띠)은 하지 않았다.
