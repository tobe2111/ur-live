# [LOADING_ADDITIVE] 2026-11-18 — 환불 `/refund` · 이용약관 `/terms` 서버 첫 화면

라이브 실측(폰 4G · CPU 4배): `/refund` 첫 그림 **1.5~3.0s** · `/terms` **2.1~4.0s** — 같은 조건 `/faq`(서버 첫 화면) 0.5~1.3s.
둘 다 데이터 요청이 없는 고정 문서라 **화면 전체**를 서버가 그린다(토스 PG 심사가 직접 여는 주소). 새 SSR 슬롯 추가 = 잠금 예외(추가).

## 잠금표 접촉
- `src/worker/index.ts`: `/faq` 분기 바로 뒤에 `legalPathOf(url.pathname)` 분기 한 토막(같은 줄 — 줄 수 2660 그대로). UA 는 빌더 인자(PC 면 `pcPath`). 크롤러 본문(`buildStaticSurfaceNoscript`)은 종전처럼 뒤에 붙인다.
- `utils/css-first-boot.ts`: `firstScreenApplies` 폰·PC 가지 + `criticalSurfaceOf` → `legal`. 생성기 ROOTS·SURFACE_ROOTS 에 `legal-first-screen.ts`(표면 CSS 28,906B · 상한 40,000 안).
- 청크 preload: `route-surface` `terms` + `PRELOAD_ONLY_ROUTES.terms` + `registerBootPage('terms')`(refund 는 ca93ecdd8 에서 이미). 예산 `surface-budgets.json` terms 192.1KB 등록.

## 본문과 SSOT (두 벌 금지)
- 환불: 문구·구조·클래스를 `shared/refund-policy-content.ts`(순수 데이터 트리 `REFUND_BODY`)로 옮겼다. 화면은 그 트리를 `createElement` 로, 워커는 같은 트리를 HTML 로. 옮기기 전후 React 렌더 HTML **바이트 동일**(스크래치 대조) · 시험이 화면 본문 innerHTML == 서버 본문 innerHTML 을 대조한다.
- 약관: 문구는 원래 데이터(`pages/terms/consumer-terms-content.ts`), 클래스는 `shared/terms-page.ts` 로 옮겨 `TermsDocument` 가 읽는다.
- 뒤로 화살표는 같은 24px 빈 칸 · 이메일 글자는 `emailOff`.
- PC: 두 경로는 `pc-fullbleed` A 묶음(액자 없음)이라 FAQ(액자)와 달리 [상단 네비 `pcTopNavBlockHtml` + 같은 본문](숙소 목록 선례).

## 가드
`legal-first-screen-2026-11-18.test.tsx` · 주입 `scripts/mutations/legal-first-screen-2026-11-18.mjs` 9건 되돌려 전부 빨간불 · 재조준: `refund-policy-truth`(시험·주입 7건) · `thin-surface-copy` 출처 · `voucher-validity-12m` · `critical-css` 표면 수 19→20 · `css-first-boot` ROOTS 대표 경로.

## 못 보는 것
실제 픽셀·밀림(배포 뒤 `node scripts/measure-live-vitals.mjs /refund /terms` 로 잰다 — 종전 FCP 1.5~3.0 · 2.1~4.0s) · 다국어 사용자.
