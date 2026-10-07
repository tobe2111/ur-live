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
2. 대표가 잠금 화면을 허가하면: `MyVouchersPage` 이용권 0장(`empty`) · `PaymentSuccessPage` 결제 완료(`done`) · `BrandLoader`(로더 연속성 가드와 함께).

## 틀렸던 판단
- 없음(이번 범위). 다만 `ErrorBoundary` 는 앱 셸이라 부품이 셸 폐쇄에 들어간다 — 이미지는 URL 문자열뿐이라 렌더 전엔 내려받지 않는다(번들 영향은 부품 코드 ~1KB).

## 남은 결정
- 잠금 화면 3곳 허가 여부(위 2) · 정산 완료 알림(사장님 쪽) 예외 여부.

## 추가 (같은 세션)
- 🩸 `ErrorBoundary`(셸)가 `Udal` 을 정적 import 하자 `critical-chunks` 가 **첫 페인트에 청크 9개 진입**으로 빨간불 —
  `vite.config.ts` app-shell 목록에 `/src/components/mascot/` 한 줄 추가로 해소(CLAUDE.md 로딩 audit log 기록).
  ⇒ **셸 부품에 새 부품을 붙일 땐 그 부품 폴더도 app-shell 에 넣어야 한다**(규칙 주석에 이미 적혀 있다).
- 전체 유닛 867파일 11,067건 pass.
