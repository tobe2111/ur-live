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

## 2. 로그인/인증 — **독립 계정** (2026-06-28 대표 결정 "유어딜·도매몰과 전혀 무관")
- **자체 이메일/비밀번호 계정** — 셀러/카카오/유어딜·도매몰과 완전 분리. 테넌트 = `ad_accounts.id`(독립 테이블).
- 토큰: `ads_token`(HS256 JWT, claim `{ads_id, typ:'ads'}`, 30일) → `adsAccountIdFrom`(셀러의 `sellerIdFrom` 대체). 클라 `localStorage.ads_token`.
- 라우트: `/ads/login`·`/ads/signup`(코스믹). API: `POST /api/ads/auth/signup`·`/auth/login`·`GET /auth/me`(same-origin JSON 200 = iOS-safe). 비번 해시는 중립 인프라 `@/lib/password`(PBKDF2) 재사용.
- 코드: `src/features/marketing/api/ads-account.ts`(스키마+해시+토큰+CRUD). `/api/ads/*` 142곳이 `sellerIdFrom`→`adsAccountIdFrom`.
- ⚠️ ad_* 테이블의 `seller_id` 컬럼은 이제 **ad_accounts.id**(테넌트)를 담음(프리런치 — 마이그레이션 불필요, 컬럼명만 레거시). `/api/ads/*` 가 배타 소유.
- (이전 "셀러 로그인 재사용" 설계는 폐기 — 로그인 시 유어딜 '크리에이터 가입'/도매몰로 튕기던 문제의 근본해결.)

## 3. 디자인 (2026-06-27~28 구현)
- **브랜드 정체성**: 코스믹 네이비 — 단색 `#3B6EF5` + 그라데이션 `#3B6EF5→#8B5CF6→#EC4899`. 유어딜(모노크롬)·도매몰과 시각 구분. 폰트 Pretendard + 라벨 IBM Plex Mono. 토큰 SSOT: `docs/design/urads/UR Ads Handoff Spec.dc.html`.
- **로고**: `src/components/brand/UrAdsLogo.tsx`(4점 스파크 + 워드마크, useId 그라데이션 충돌방지).
- **랜딩** `MarketingLandingPage.tsx`(`/ads`): 시안 `UR Ads Landing Light.dc.html` 충실 포팅. **라이트/다크 양모드** — CSS 변수(`.ua-landing` 기본 / `[data-theme="dark"]` 코스믹=v2) + 네비 🌙 토글. 모바일 반응형(minmax+min()/clamp, 네비 ≤720 숨김).
- **대시보드 chrome** `MarketingDashboardShell.tsx`(`/ads/dashboard`): 236px 사이드바(라인 아이콘 + Mono MENU + 스크롤스파이) + 토픽바. **기본 라이트 + 다크 토글**(2026-06-28 대표 "기본 화이트" — `urads_dash_theme==='dark'` 일 때만 다크). 루트 `.uad`(/`.uad.dark`) CSS 변수 스코프 → 패널이 라이트/다크 variant 렌더(마크업 불변 = 기능 안전). 사이드바 nav = 섹션 앵커. **헤더 계정 드롭다운**(회사명·계정설정·로그아웃, 전 화면) · 모바일 하단 탭바 제거(2026-06-28).
- **인증/계정 페이지**(라이트, `force-light-theme`): `/ads/login`·`/ads/signup`·`/ads/account`. 자체 이메일/비번(§2). UR Ads 스파크 로고 유지.
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
| **AI 주간 리포트 자동** 🆕 | `weekly-report.ts`(월요일 cron+저장+Resend→`ad_accounts.email`) | GET `/reports` · POST `/reports/generate` |
| **부정클릭 방어 Phase 1 완료**(탐지·리포트·**반자동** 차단) | `clickguard.ts`(픽셀+PIPA해시+90일+남용캡) | `/clickguard/pixel.js`·`hit`·`site`·`report`·`block`·`blocklist` |
| 가격 모니터링 / 소싱 | `price-monitor.ts` · `keyword-tools.ts` | `/price/*` · `/sourcing/trends` |
| **소싱 인구통계 세분화** 🆕 | `keyword-tools.ts`(`categoryDemographics` — 기기/성별/연령) | `/sourcing/demographics?cid=` |
| **ROAS·키워드 효율 분석** 🆕 | `searchad-client.ts`(convAmt·`keywordEfficiency` 낭비키워드) | `/searchad/keyword-efficiency` |
| **쇼핑 순위 추적** 🆕(오가닉, 광고와 별개) | `rank-tracker.ts`(쇼핑검색 상위300·일일 cron) | `/rank/targets`·`/rank/target`·`/rank/refresh` |
| **성과 추세(일별 메트릭 히스토리·멀티테넌트)** 🆕 | `metrics-history.ts`(일일 cron→`ad_daily_metrics` 고객사별 1행·`computeWoW`·`trendContextFrom`) + `TrendPanel.tsx`(인라인 SVG 차트) | GET `/metrics/history` · POST `/metrics/snapshot` |
| **경쟁사 분석**(쇼핑검색 상위 몰) 🆕 | `competitor-tracker.ts`(`aggregateCompetitors` 순수 — 나보다 위/아래·최저가·노출수) + RankPanel 확장 | GET `/rank/competitors?keyword=&mall=` |
| **제외(네거티브) 키워드 등록** 🆕(효율 루프 닫기·WRITE) | `searchad-client.ts`(`addNegativeKeywords`) + SearchAdPanel | POST `/searchad/negative` |
| **캠페인 긴급 제어**(정지/재개·일예산·WRITE 하드캡) 🆕 | `searchad-client.ts`(`updateCampaignStatus/Budget`) + SearchAdPanel | PATCH `/searchad/campaign` |
| **키워드 포트폴리오**(저장·태그) 🆕 | `keyword-portfolio.ts`(순수 DB) + `SavedKeywordsPanel.tsx` | `/keywords/saved`·`/keywords/save` |
| **카카오 알림톡 알림**(설정 시 이메일과 병행) 🆕 | `alerts.ts`(`sendAlertAlimtalk` — `ADS_ALERT_ALIMTALK_TPL` 게이트) | (기존 `ads-alerts` cron) |
| **AI 진단에 전주 대비 추세 반영** 🆕 | ai-marketer/weekly-report 컨텍스트에 `trend`(WoW) 주입 | (기존 `/ai-marketer`·`/reports` 강화) |
| **유어애즈 가입자 운영 어드민** 🆕 | `admin-ads.routes.ts` + `AdminAdsAccountsPage.tsx`(잠금해제·정지) | `/api/admin/ads/stats`·`accounts` |
| **임계값 알림** 🆕(예산 소진·최저가 역전→이메일) | `alerts.ts`(설정+일일 cron+Resend, 계정+날짜 멱등) | `/alerts/settings`·`/alerts/preview` |
| **독립 계정 + 계정관리** 🆕 | `ads-account.ts`(가입/로그인/프로필/비번, PBKDF2) | `/auth/signup`·`login`·`me`·`account`·`password` |
| **대시보드 KPI 요약 홈** 🆕 | `MarketingDashboardPage`(30일 실적 스트립) | (stats·autobid 재사용) |
| 발주수집(**보류**) | `order-collection.ts` | `/orders/sync`·`/orders` |

UI 패널: `MarketingDashboardPage`(허브+KPI) + `SearchAdPanel`·`AutobidPanel`·`WeeklyReportPanel`·`PricePanel`·`SourcingPanel`·`AlertsPanel`·`ClickGuardPanel`. 인증/계정: `MarketingLoginPage`·`MarketingSignupPage`·`MarketingAccountPage`(라이트, force-light-theme).

## 5. 환경변수(Cloudflare Secrets) — 대표가 설정
| 키 | 용도 | 없으면 |
|---|---|---|
| `NAVER_SEARCHAD_CUSTOMER_ID`/`_ACCESS_LICENSE`/`_SECRET_KEY` | 검색광고(연관키워드·자동입찰·실적·예상가) | 해당 503·자동숨김 |
| `NAVER_SEARCH_CLIENT_ID`/`_SECRET` | 오픈API(추세·쇼핑·평판·소싱·가격) | 비활성 |
| `ANTHROPIC_API_KEY` | AI마케터 + 주간리포트 | AI만 숨김 |
| `RESEND_API_KEY`/`RESEND_FROM` | 주간리포트 + **임계값 알림** 이메일(선택) | 이메일만 skip(저장/계산은 됨) |
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

## 6.6 라이브 전수감사 (2026-07-01) — 실접근 검증 + 수정

라이브(`live.ur-team.com/ads`)에 테스트 계정 실생성해 전 기능 프로빙 + 전 코드 4축(인증격리·머니안전·서비스분리·정합성) 감사. **결과: 서비스 분리 완전 클린 · 머니 하드캡 이중강제 · 확정 IDOR 0건.** 발견·수정:
- ✅ **[수정] 검색광고 API 키 유출** — `searchAdRequest`(searchad-client.ts)가 네이버 auth 에러 본문(`"Auth failed with api-key: 0100..., customer-id: 47982"`)을 클라에 그대로 반환 → 운영자 X-API-KEY/고객ID 노출. 자격증명 포함 시 친절 안내로 치환 + 방어적 마스킹.
- ✅ **[수정] 소싱 트렌드 400** — `shoppingCategoryTrends`가 카테고리 10개를 한 요청에 보내 쇼핑인사이트 400. 3개씩 분할 병렬 호출 후 병합.
- ✅ **[수정] `/ads` 크롤러 메타** — 서버 HTML `<title>`/OG 가 소비자(유어딜) 것 → 공유/SEO 시 오노출. `worker/index.ts` 에 도매 패턴 따라 유어애즈 OG/canonical 주입(og-urads.png).
- ✅ **[수정] 내부 에러 유출** — autobid `upsertRule` INSERT 미가드(D1 메시지 유출+bare 500), `ai-marketer` 업스트림 에러 전달 → 제네릭 메시지로.
- ⚠️ **[대표 확인 필요] 연관키워드 라이브 auth 실패** — 위 유출된 에러가 곧 **플랫폼 폴백 검색광고 키(customer 47982) 인증 실패**를 의미. 서명 코드는 네이버 스펙과 일치 → **`NAVER_SEARCHAD_ACCESS_LICENSE`/`_SECRET_KEY`/`_CUSTOMER_ID` 시크릿(키·고객ID 대응)을 재확인**해야 연관키워드·예상가·실적이 동작.
- 🟡 잔여 하드닝(미수정, 낮음): unlock 코드 전역상수/비상수시간 비교 · clickguard `domainMatches` null-Origin 허용 · rank 스냅샷/refresh `account_id` 방어스코프.
- 🧹 `marketing.routes.ts` 965줄(god파일 래칫 RED) — `routes/` 서브 Hono 분할 권장(별도 작업).

## 6.7 2차 전수감사 (2026-07-01) — 4축 병렬 심층감사 + 하드닝 2건

audit-gate(38 GREEN / file-size RED 1=선재 무관) 후 가드 미보유 4축(인증·IDOR / 머니 하드캡 / 런타임크래시 / 서비스분리)을 병렬 심층 재감사. **결과: 6.6 이후 신규 확정 결함 0 — unlock 은 이미 `timingSafeEqual`(상수시간)로 수정됨, IDOR·크래시·분리 전부 클린.** 예방적 하드닝 2건만 반영:
- ✅ **[하드닝] `refreshWatch` 자기-스코프화**(price-monitor.ts) — 헬퍼 UPDATE 가 `WHERE id=?` 뿐이라 테넌트 미포함(라우트 사전검사로 차폐된 *잠재* IDOR). `sellerId` 인자 추가 → `AND seller_id=?` (전 호출부 3곳 배선). 헬퍼가 스스로 안전(미래 호출자 회귀 방지). 머니룰 "side-effect WHERE 에 항상 tenant 포함" 정합.
- ✅ **[하드닝] 자동입찰 규칙 생성 시 활성 고객사 필수**(marketing.routes.ts `/searchad/autobid/rule`·`/rules/bulk`) — 활성 고객사 없이 만든 `tenant=NULL` 규칙이 cron 에서 '그때 활성인' 고객사 자격증명으로 실행 → **잘못된 계정 과금** 벡터. 생성 전 `getActiveTenantId` 필수(null 이면 400). planBid 하드캡은 유지되므로 초과입찰은 원래 불가 — 이건 *어느 계정에* 적용되냐의 격리 문제. (autobid 는 `ADS_AUTOBID_ENABLED` 기본 OFF 라 라이브 영향 현재 0, 켜기 전 예방.)
- ✅ **[하드닝, 대표 "응 원해" 후속] `access_unlocked` 서버측 강제** — 그간 게이트가 **클라 전용**(대시보드 redirect)이라 토큰만 있으면 데이터 API 직접호출로 우회 가능했음. `requireAdsUnlocked` 미들웨어(routes/helpers.ts) 신설 → `marketingRoutes.use('*')` 로 데이터 엔드포인트 전체 게이트. 면제=`/ping`·`/auth/*`(unlock 포함)·공개 픽셀(`/clickguard/pixel.js`·`hit`). 유효토큰 + `access_unlocked=1` + `status='active'` 필수(**정지 계정의 옛 토큰 재사용도 차단** — login 만 막던 것 보강). 베타 코드 `358533`(helpers.ts 폴백)은 여전히 공개값이라 결정된 우회는 가능하나, 이제 최소한 "가입만 하고 unlock 안 한" 토큰의 데이터 접근은 서버가 막음(라이브 대시보드 UX 와 동일 흐름).
- ✅ **[하드닝] clickguard `domainMatches` null-Origin 거부** — `if(!originOrReferer) return true`→`false`. 픽셀은 광고주 사이트→우리 도메인 cross-origin POST 라 브라우저가 Origin 을 항상 붙임 → 정상 hit 은 헤더 보유. 헤더 없는 요청(curl/봇 위조로 의심리포트 오염)은 기록 안 함(탐지 정확도 우선). (Origin 을 스푸핑하는 결정된 위조는 여전히 가능 — 공개픽셀+노출키의 구조적 한계라 자동차단 없는 반자동 설계로 완화.)
- 검증: tsc 0(config 경고 제외) · sql-bind/money/pagination/crossrole/api-auth 가드 0. 게이트로 HTTP 데이터 라우트를 타는 ads 단위테스트 5개(ads-write-routes/competitor/keyword-portfolio/metrics-history/account-flow)에 unlock·active 계정 시딩(`seedUnlocked`) 추가 + 게이트 자체 회귀테스트(잠금→403 locked / 해제→200) 신설 · clickguard null-Origin 테스트 기대값 갱신. ⚠️ 환경상 vitest/worker-build 미실행(네트워크·의존성 제약) — CI(verify.yml)가 실행 검증.
- 🧹 marketing.routes.ts 447줄(baseline 440 +7, `use()` 배선+머니가드) — HANDOFF 기존 권고대로 `routes/` 추가 분할 시 자연 해소(커밋 `[SKIP_SIZE]`).

## 7. 남은 일 (우선순위)

### A. 보류 — 외부 제약/실계정 검증 대기 (코드는 준비됨, 기능은 안 만들어도 됨)
1. **[대표 — 1순위] 라이브 검증** (이 작업환경 네이버/이메일 egress 차단 → 실호출 미검증). 순서: 읽기(연관키워드·트렌드) → 광고계정 연동 → 예상가/실적/미리보기 → 픽셀 → 가입/로그인(`ad_accounts` 자동생성) → 알림 이메일(Resend). 통과 후 `ADS_AUTOBID_ENABLED=true`. ⚠️ 2026-07-01 라이브: 오픈API(트렌드/쇼핑/평판/자동완성/인구통계) 실데이터 확인 · 검색광고 키는 auth 실패(위 6.6 참조).
2. **자율 자동입찰 cron** — 돈 영향이라 위 검증 전 **보류**. 킬스위치 기본 OFF(`autobid.ts:280`), 수동 '지금 적용'만 동작. planBid 하드캡 잠금.
3. **부정클릭 자동차단** — **Phase 1(탐지·리포트·반자동 차단)은 완료**(픽셀+PIPA해시+90일+의심IP리포트+검색광고센터 복붙 차단목록). 막힌 건 **완전 자동 차단 하나** = 네이버가 노출제한IP **쓰기 API** 를 안 열어서. 열리면 자동 전환(코드 준비됨). ⚠️ "미착수" 아님 — 재구현 금지.
4. **발주수집** — 커머스 '상품주문/배송' 권한 + **고정 egress IP**(`wrangler-proxy.toml`) 필요 → 보류. 코드 배선됨.

### B. 코드로 가능 — 남은 것(선택)
- **랜딩 더미요소** — 수치(ROAS 412%)·후기·로고 실데이터 교체(라이브 검증 후 자연스럽게).
- (그 외 아이디어) 키워드 그룹/태그, 경쟁사 추적 확장, 다계정 팀원 초대 등 — 필요 시.

### C. 완료 (재작업 금지)
~~독립 계정+계정관리(가입/로그인/프로필/비번/로그아웃)~~ ✅ · ~~비밀번호 재설정(이메일 토큰)~~ ✅ · ~~라이트 통일(인증·대시보드 기본 화이트)~~ ✅ · ~~유어애즈 전용 약관·개인정보 페이지~~ ✅(`/ads/terms`·`/ads/privacy`, ⚠️법무검토 권장) · ~~KPI 요약 홈~~ ✅ · ~~소싱 인구통계 세분화~~ ✅ · ~~임계값 알림(예산·가격·**순위하락**)~~ ✅ · ~~데이터 CSV 내보내기(실적·연관키워드)~~ ✅ · ~~멀티테넌트 고객사 전환~~ ✅ · ~~견고성(PanelError·ErrorBoundary)~~ ✅ · ~~헤더 계정 드롭다운/직접 로그아웃~~ ✅ · ~~하단 탭바 제거~~ ✅.

## 8. 검증/배포
- 브랜치 push → 훅이 main 자동머지·배포(Cloudflare Pages). PR 불필요(자동머지로 diff 0).
- 검증: `npx tsc --noEmit --skipLibCheck` · `npm run build`(client+ssr+prerender+worker) · `npx vitest run` · 가드(theme/mobile/sql-bind/money/crossrole).
- 관련 문서: `urads-boraware-reference.md`(5종 레퍼런스+현황표) · `urads-service-page-brief.md` · `docs/design/urads/README.md`(시안 인덱스).
