# 유어애즈(UR Ads) — 인수인계 (SSOT, 2026-06-27)

> 새 세션이 유어애즈 작업을 이어갈 때 **이 문서를 먼저 읽으면** 전체 상태 파악 가능.
> (프로젝트 SSOT 는 `docs/CURRENT_WORK.md` 이지만 거기엔 비-유어애즈 작업도 섞여 있어, 유어애즈만 여기 모음.)

## 0. 한 줄 요약
유어애즈 = 도매몰·유어딜에 이은 **3번째 분리 서비스**(보라웨어식 검색광고 마케팅 툴). **기능은 사실상 완성**, 남은 건 ① 대표 키 설정+라이브 검증 ② 디자인 랜딩(다른 세션) ③ 보류 결정들(번들·수익화).

## 1. 서비스 경계 (⚠️ 분리 룰 — CLAUDE.md 최우선)
- 표면: `/ads` · API: `/api/ads/*` · 레이아웃: `MarketingLayout`(전체 PC폭) · 코드: `src/features/marketing/**`, `src/pages/marketing/**`
- **유어딜(소비자)·도매몰 파일 건드리지 말 것.** 지금까지 누수 0(크로스역할 가드·소비자↔도매 분리테스트 통과).
- 공유 파일은 **추가(additive)만** 했음: `worker/index.ts`(라우트 마운트·needsRootBlank), `App.tsx`(라우트·hideBottomNav), `utils/domain.ts`(isMarketingSurface), `MobileAppLayout`(HIDE_SIDEBAR_PREFIXES += /ads), `scheduled.ts`(cron 2개), `env.ts`(키), `supply/api/naver-commerce-core.ts`(ChannelOwner += 'marketing' — 도매 동작 불변).

## 2. 로그인/인증
- **새 로그인 없음.** 기존 **사업자 유저(셀러) 로그인**(`seller_token` / `sellerIdFrom`)을 그대로 재사용. 한 계정으로 유어딜 판매 + 셀러 대시보드 + 유어애즈 광고 전부.

## 3. 구현된 기능 + 파일 맵
| 기능 | 핵심 파일 | API |
|---|---|---|
| 연관키워드(RelKwdStat) | `searchad-client.ts` | GET `/keywords/related` |
| 검색추세·쇼핑경쟁 | `keyword-tools.ts` | GET `/keywords/trend`·`/keywords/shopping` |
| 자동완성·브랜드평판 | `keyword-tools.ts` | GET `/keywords/autocomplete`·`/reputation` |
| 검색광고 계정연동(멀티테넌트) | `searchad-connection.ts` | POST/GET/DELETE `/searchad/connect`·`status` |
| 광고구조(캠페인/그룹/키워드) | `searchad-client.ts` | GET `/searchad/campaigns`·`adgroups`·`keywords` |
| 예상입찰가(Estimate) | `searchad-client.ts` | GET `/searchad/estimate` |
| 입찰가 수동변경(write) | `searchad-client.ts` | PATCH `/searchad/keywords/bid` |
| 키워드 자동등록(write) | `searchad-client.ts` | POST `/searchad/keywords/add` |
| 통합실적(+평균순위) | `searchad-client.ts` accountStats | GET `/searchad/stats` |
| 예산 페이싱 | `searchad-client.ts` budgetPacing | GET `/searchad/pacing` |
| **자동입찰 자율엔진** | `autobid.ts` (planBid 안전로직) | `/searchad/autobid/rule(s)`·`preview`·`run` + cron |
| AI마케터 | `ai-marketer.ts` | POST `/ai-marketer` |
| 부정클릭 탐지·리포트 | `clickguard.ts` | `/clickguard/pixel.js`·`hit`·`site`·`report` |
| 부정클릭 차단(반자동) | `clickguard.ts` | `/clickguard/block`·`blocklist` |
| 가격 모니터링 | `price-monitor.ts` | `/price/watch(es)`·`refresh` + cron |
| 소싱 리포트(쇼핑인사이트) | `keyword-tools.ts` | GET `/sourcing/trends` |
| 발주수집(보류) | `order-collection.ts` | `/orders/sync`·`/orders` (커머스API·고정IP 필요로 보류) |

UI 패널: `MarketingDashboardPage`(허브) + `SearchAdPanel`·`AutobidPanel`·`ClickGuardPanel`·`PricePanel`·`SourcingPanel`.
라우트 정의: `marketing.routes.ts`(`app.route('/api/ads', …)` in `worker/index.ts`).

## 4. 환경변수(Cloudflare Secrets) — 대표가 설정
| 키 | 용도 | 없으면 |
|---|---|---|
| `NAVER_SEARCHAD_CUSTOMER_ID`/`_ACCESS_LICENSE`/`_SECRET_KEY` | 검색광고(연관키워드·자동입찰·실적·예상가) | 해당 기능 503·자동숨김 |
| `NAVER_SEARCH_CLIENT_ID`/`_SECRET` (또는 `NAVER_CLIENT_*`) | 오픈API(추세·쇼핑·평판·소싱·가격) | 해당 기능 비활성 |
| `ANTHROPIC_API_KEY` | AI마케터 | AI마케터만 숨김 |
| `ADS_AUTOBID_ENABLED='true'` | 자율 자동입찰 cron 킬스위치 | **기본 OFF**(수동 '지금 적용'만 동작) |
| `DATA_ENCRYPTION_KEY` | 연결 자격증명 암호화(이미 보유) | 연결 복호화 불가 |

## 5. ⚠️ 안전장치 (건드릴 때 주의)
- **자동입찰**: `ADS_AUTOBID_ENABLED` 기본 OFF. `planBid`(autobid.ts)가 사용자 max_bid+글로벌 10만 **하드캡** — 엔진은 절대 초과입찰 불가(단위테스트 `autobid-planbid.test.ts`로 잠금). 규칙 기본 enabled=0.
- **입찰/키워드 write**: 서버 범위검증(70~100,000)·confirm·연결필수. 클라값 불신.
- **부정클릭**: IP 해시+원문 90일 자동삭제·국가수준만·도메인검증. 차단은 반자동(검색광고센터 복붙 — 네이버 공식 API에 노출제한IP 없음).

## 6. 남은 일 (우선순위)
1. **[대표]** 위 키 설정 + **배포 후 라이브 검증**(이 작업환경은 네이버 egress 차단 → 실호출 미검증. 연관키워드·예상가·실적·픽셀 각 1회 확인). 검증되면 `ADS_AUTOBID_ENABLED=true`.
2. **[다른 세션 — 디자인]** `UR Ads Landing Light.dc.html` 랜딩 구현. ⚠️ Claude Design MCP(`/design-login`)는 **대화형 터미널 필요** → Web 세션 말고 **로컬 인터랙티브 세션**에서. 비로그인 `/ads` 진입화면으로 배치 추천.
3. **[보류 — 결정 대기]** 유어딜 판매채널 번들(`urads-yourdeal-channel-bundle.md`, 추천 A~D 박제됨) / 수익화 모델(`urads-services-monetization.md`, "수익화 보류 기능우선" 결정됨).
4. **[선택 폴리시]** 패널 isError 표시 · 부정클릭 일일 abuse cap · 별도 도메인(ads.ur-team.com, utongstart 패턴).

## 7. 기술부채
`TECHNICAL_DEBT.md` 의 "유어애즈 신규 코드 부채" 섹션 — 핵심: **네이버 실 API 응답 스키마 블라인드 구현**(배포 후 검증, 틀리면 파서 1줄). 돈/크래시 위험 0.

## 8. 검증/배포
- 브랜치 `claude/nifty-curie-ofnuxw` → push 시 훅이 main 자동머지·배포(Cloudflare Pages).
- 검증: `npx tsc --noEmit --skipLibCheck` · `npm run build` · `npx vitest run`(현 2340 pass) · 가드(theme/mobile/sql-bind/money/crossrole).
- 관련 문서: `urads-boraware-reference.md`(5종 레퍼런스+현황표)·`urads-clickfraud-design.md`·`urads-services-monetization.md`·`urads-yourdeal-channel-bundle.md`·`urads-service-page-brief.md`.
