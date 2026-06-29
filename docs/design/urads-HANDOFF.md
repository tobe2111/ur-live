# 유어애즈(UR Ads) — 인수인계 (SSOT)

> 새 세션이 유어애즈 작업을 이어갈 때 **이 문서를 먼저 읽으면** 전체 상태 파악 가능.
> 디자인 시안 원본은 `docs/design/urads/`(Claude Design export), 레퍼런스는 `urads-boraware-reference.md`.

## 0. 한 줄 요약
유어애즈 = 도매몰·유어딜에 이은 **3번째 분리 서비스**(보라웨어식 검색광고 마케팅 툴).
**기능 + 디자인(랜딩 라이트/다크 · 대시보드 코스믹 · 로고/OG) 사실상 완성.** 남은 건
① 대표 키 설정+라이브 검증 ② 외부제약 2건(발주수집·부정클릭 자동차단).

## 1. 서비스 경계 (⚠️ 분리 룰 — CLAUDE.md 최우선)
- 표면: `/ads`(공개 랜딩) · `/ads/dashboard`(입점 대시보드) · API: `/api/ads/*`
- 레이아웃: 랜딩=자체(`MarketingLandingPage`) · 대시보드=`MarketingDashboardShell`(코스믹 사이드바) · 코드: `src/features/marketing/**`, `src/pages/marketing/**`
- **유어딜(소비자)·도매몰 파일 건드리지 말 것.** 공유 파일은 **추가(additive)만**: `worker/index.ts`(라우트·needsRootBlank·isMarketingSurface), `App.tsx`(라우트·hideBottomNav), `utils/domain.ts`(isMarketingSurface), `MobileAppLayout`(HIDE_SIDEBAR_PREFIXES += /ads), `scheduled.ts`(cron 3개).

## 2. 로그인/인증
- **새 로그인 없음.** 기존 **사업자 유저(셀러) 로그인**(`seller_token` / `sellerIdFrom`) 재사용. 한 계정으로 유어딜 판매 + 셀러 대시보드 + 유어애즈 광고 전부.

## 3. 디자인 (2026-06-27~28 구현)
- **브랜드 정체성**: 코스믹 네이비 — 단색 `#3B6EF5` + 그라데이션 `#3B6EF5→#8B5CF6→#EC4899`. 유어딜(모노크롬)·도매몰과 시각 구분. 폰트 Pretendard + 라벨 IBM Plex Mono. 토큰 SSOT: `docs/design/urads/UR Ads Handoff Spec.dc.html`.
- **로고**: `src/components/brand/UrAdsLogo.tsx`(4점 스파크 + 워드마크, useId 그라데이션 충돌방지).
- **랜딩** `MarketingLandingPage.tsx`(`/ads`): 시안 `UR Ads Landing Light.dc.html` 충실 포팅. **라이트/다크 양모드** — CSS 변수(`.ua-landing` 기본 / `[data-theme="dark"]` 코스믹=v2) + 네비 🌙 토글. 모바일 반응형(minmax+min()/clamp, 네비 ≤720 숨김).
- **대시보드 chrome** `MarketingDashboardShell.tsx`(`/ads/dashboard`): 236px 코스믹 사이드바(라인 아이콘 + Mono MENU + 스크롤스파이) + 토픽바. 루트 `dark` 스코프 강제 → 기능 패널이 다크 variant 로 렌더(마크업 불변 = 기능 안전). 사이드바 nav = 섹션 앵커.
- **에셋**: `public/urads-icon.svg`(앱아이콘) · `public/og-urads.png`(OG 1200×630) · `useUrAdsFavicon()`(표면별 파비콘 스왑).
- **이모지 전부 제거**(AI 티 대응, 대표 피드백) → 텍스트/라인 아이콘 헤더.
- ⚠️ 랜딩 수치(CPC 15%↓·ROAS 412.8%·₩8.4억)·고객로고·후기 = **의도된 더미**(Handoff Spec 명시, 실데이터 연동 시 교체).

## 4. 구현된 기능 + 파일 맵
| 기능 | 핵심 파일 | API |
|---|---|---|
| 연관키워드(RelKwdStat) | `searchad-client.ts` | GET `/keywords/related` |
| 검색추세·쇼핑경쟁·자동완성·평판 | `keyword-tools.ts` | `/keywords/trend`·`shopping`·`autocomplete`·`/reputation` |
| 검색광고 계정연동(멀티테넌트) | `searchad-connection.ts` | `/searchad/connect`·`status` |
| 광고구조·예상입찰가·통합실적·페이싱 | `searchad-client.ts` | `/searchad/campaigns`·`adgroups`·`keywords`·`estimate`·`stats`·`pacing` |
| 입찰가 변경 / 키워드 등록(write) | `searchad-client.ts` | PATCH `/searchad/keywords/bid` · POST `/searchad/keywords/add` |
| **자동입찰 자율엔진** | `autobid.ts`(planBid 하드캡) | `/searchad/autobid/rule(s)`·`preview`·`run` + cron |
| **시간대·요일 입찰 전략** 🆕 | `autobid.ts`(scheduleWeight 프리셋) | rule 의 `schedule` 필드 |
| **CSV 대량 입찰 등록** 🆕 | `autobid.ts`(parseCsvRules/bulkUpsertRules) | POST `/searchad/autobid/rules/bulk` |
| AI마케터 | `ai-marketer.ts` | POST `/ai-marketer` |
| **AI 주간 리포트 자동** 🆕 | `weekly-report.ts`(월요일 cron+저장+Resend) | GET `/reports` · POST `/reports/generate` |
| 부정클릭 탐지·리포트·차단(반자동) | `clickguard.ts` | `/clickguard/pixel.js`·`hit`·`site`·`report`·`block`·`blocklist` |
| 가격 모니터링 / 소싱 | `price-monitor.ts` · `keyword-tools.ts` | `/price/*` · `/sourcing/trends` |
| 발주수집(**보류**) | `order-collection.ts` | `/orders/sync`·`/orders` |

UI 패널: `MarketingDashboardPage`(허브) + `SearchAdPanel`·`AutobidPanel`·`WeeklyReportPanel`·`PricePanel`·`SourcingPanel`·`ClickGuardPanel`.

## 5. 환경변수(Cloudflare Secrets) — 대표가 설정
| 키 | 용도 | 없으면 |
|---|---|---|
| `NAVER_SEARCHAD_CUSTOMER_ID`/`_ACCESS_LICENSE`/`_SECRET_KEY` | 검색광고(연관키워드·자동입찰·실적·예상가) | 해당 503·자동숨김 |
| `NAVER_SEARCH_CLIENT_ID`/`_SECRET` | 오픈API(추세·쇼핑·평판·소싱·가격) | 비활성 |
| `ANTHROPIC_API_KEY` | AI마케터 + 주간리포트 | AI만 숨김 |
| `RESEND_API_KEY`/`RESEND_FROM` | 주간리포트 이메일(선택) | 이메일만 skip(저장은 됨) |
| `ADS_AUTOBID_ENABLED='true'` | 자율 자동입찰 cron 킬스위치 | **기본 OFF**(수동 '지금 적용'만) |
| `DATA_ENCRYPTION_KEY` | 연결 자격증명 암호화 | (이미 보유) |

## 6. ⚠️ 안전장치 (건드릴 때 주의)
- **자동입찰**: `ADS_AUTOBID_ENABLED` 기본 OFF. `planBid`+`scheduleWeight` — 스케줄 가중치는 *추정가에만* 곱하고 **max_bid·10만 하드캡**이 그대로 상한 강제 → 초과입찰 구조적 불가(`autobid-planbid.test.ts`·`autobid-schedule.test.ts` 잠금). 규칙 기본 enabled=0.
- **입찰/키워드 write**: 서버 범위검증(70~100,000)·confirm·연결필수.
- **부정클릭**: IP 해시+90일 자동삭제·국가수준만·도메인검증. 차단은 반자동(검색광고센터 복붙 — 네이버 공식 API 에 노출제한IP write 없음).
- **주간리포트**: 읽기전용·주1회 멱등(period_key UNIQUE)·cap 30 tenant/run.

## 6.5 멀티테넌트(고객사 전환) — 2026-06-28 구현 ✅
- `ad_searchad_tenants`(seller+customer_id UNIQUE, tenant_label, is_active) 다중 연결 + 활성 전환. 레거시 `ad_searchad_connections` 1회 이관.
- **자동입찰 격리(돈 안전)**: `ad_autobid_rules.tenant`(customer_id) 컬럼. UI 규칙은 활성 고객사로 태깅(`getActiveTenantId`). cron `runAutobidAll` 은 **(seller, tenant)별로 그 고객사 자격증명으로 strict 실행** → 규칙이 엉뚱한 계정에 적용 불가. 삭제된 고객사 규칙은 creds 없음 → skip(안전). planBid 하드캡 불변.
- API: `/searchad/tenants` · `/tenant/activate` · `/connect`(label) · `DELETE ?customer_id=`. UI: 사이드바 셀렉터 + SearchAdPanel '다른 고객사 연결' + 모바일 토픽바 칩.

## 7. 남은 일 (우선순위)
1. **[대표 — 1순위]** 위 키 설정 + **배포 후 라이브 검증**(이 작업환경은 네이버 egress 차단 → 실호출 미검증). 순서: 읽기(연관키워드·트렌드) → 광고계정 연동 → 예상가/실적/자동입찰 미리보기 → 픽셀. 통과 후 `ADS_AUTOBID_ENABLED=true`.
2. **[외부제약 — 코드 불가]** ① 발주수집 완성 = 네이버 커머스 '상품주문/배송' 권한 + 고정 egress IP(레포 `wrangler-proxy.toml`) ② 부정클릭 자동차단 = 네이버가 노출제한IP API 개방 시 자동전환(코드 준비됨).
3. **[완료]** ~~멀티테넌트 고객사 전환~~ ✅ · ~~모바일 정밀(하단 탭바)~~ ✅ · 대시보드 라이트/다크 토글 ✅. 남은 디자인: 랜딩 더미요소(후기/로고) 실데이터 교체(의도된 자리표시자).

## 8. 검증/배포
- 브랜치 push → 훅이 main 자동머지·배포(Cloudflare Pages). PR 불필요(자동머지로 diff 0).
- 검증: `npx tsc --noEmit --skipLibCheck` · `npm run build`(client+ssr+prerender+worker) · `npx vitest run` · 가드(theme/mobile/sql-bind/money/crossrole).
- 관련 문서: `urads-boraware-reference.md`(5종 레퍼런스+현황표) · `urads-service-page-brief.md` · `docs/design/urads/README.md`(시안 인덱스).
