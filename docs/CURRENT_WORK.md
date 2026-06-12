# 🚧 진행 중 작업

## ✅ 2026-06-12 — 도매몰 대시보드 감사 + 제조사 알림 데드경로 fix (`claude/keen-cerf-ch0jm5`)
**감사 결론**: 유통/제조 대시보드 IA·핵심 루프(가입→승인→주문→발송→정산→출금) 완성도 높음. 머니 테스트 85 + 전체 2027 통과. 오탐 5건 직접 검증 기각(입금계좌 안내·체크아웃 잔액 사전표시·어드민 견적 라우트·대량주문 엑셀·raw 에러 — 전부 이미 OK).
**진짜 버그 3건 fix**:
- 🔴 **제조사 알림 3중 데드경로**: `recipient_type='supplier'` 가 ① dashboard_notifications CHECK 제약(admin/seller/agency)에 걸려 INSERT 무음 실패 ② 읽을 endpoint 없음 ③ 벨 UI 없음 → 출금 승인/반려 알림 증발. fix: CHECK 에 'supplier' 추가(신규 DB) + **repair-schema CHECK 마이그레이션**(operation_guides 패턴 — 기존 prod 테이블 재생성, 멱등) + `GET /api/supplier/notifications`·`POST /read-all`(requireSupplier, 본인 id 만) + 대시보드 헤더 알림 벨(60s 배지 폴링·열면 read-all). i18n 3키×6언어.
- 🟡 **신규 도매주문 제조사 통지 부재** → `notifySuppliersOfPaidOrder()`(라인 supplier_id GROUP BY, fail-soft) — deposit·Toss confirm 양 PAID CAS 승자 경로에 배선. 접속 전엔 주문을 몰라 발송 지연되던 갭.
- 🟡 SupplierWholesaleOrdersPage 주문 로드 실패가 "주문 없음" 으로 위장 → 토스트 추가.
**⚠️ 운영**: 기존 prod DB 는 `/admin/health` 스키마 복구 1회(또는 새벽 cron) 후 supplier 알림 활성화됨 (`dashboard_notifications:check-migration`).
**남은 부채(보류)**: 거대 파일 4(카탈로그 1493·제조대시 1582·wholesale.routes 2126·supplier-dashboard.routes 930) 분해, 상태뱃지 중복 정의 통합, viewer UI 사전 안내, 승인대기 화면 ETA/문의처.

## 🚀 [확정 프로그램] SSR 전면 전환 (옵션② — 사용자 결정 2026-06-10)
**SSOT: `docs/SSR_MIGRATION_PLAN.md`** — React Router v7(구 Remix) on CF Workers, 3 Phase.
**Phase 1 진행 상황** (파일럿: https://ur-ssr-pilot.jiwon-1a2.workers.dev — Workers 무료 티어, 비용 0):
- ✅ 2026-06-11 파일럿 확장 (`apps/ssr/` 만 수정, 본체 무수정): **동네딜 `/group-buy`**(카테고리 칩별 예열 키 `?status=active[&category=X]` byte-identical) + **링크샵 `/u/:handle`**(`/api/curator/:handle` — cron dynamic prewarm 키와 동일) 신설 + **본 사이트 실디자인 이식**(card-gradient 1:1 포팅, VoucherCard/GroupBuyGridCard/프로필 카드형 링크샵 헤더/핀 그리드/WT 도매 토큰, TopBar+BottomNav 셸). HTML 엣지캐시 60s(`workers/app.ts`) 무수정 — 신규 GET 라우트 자동 적용.
- ✅ Phase 1 게이트 통과 (사용자 검증 완료 2026-06-11).
- ✅ 2026-06-11 **Phase 2 (1/2)** (`apps/ssr/` 만): **상세 3종** `/group-buy/:id`(즉시판매 단일가 블록·절약 pill·trust 뱃지·sticky CTA, API `/api/group-buy/products/:id` 60s/900s 캐시 정합) + `/products/:id`(화이트 테마, deal_only→vouchers CTA 분기) + `/wholesale/product/:id`(guest 가격잠금·정보리스트·가입 CTA, 60s/300s) + **검색 `/search`**(GET form — JS 없이 동작, q 없으면 `/api/search/popular` 인기검색어, 결과는 `/api/products?search=`+오타보정 suggested_query, 정렬 칩). 리스트 카드 → 파일럿 내부 상세로 링크 전환. HTML 엣지캐시 60s 불변.
- 📋 **Phase 2 (2/2) 인증 쿠키**: 설계 문서 `docs/SSR_PHASE2_AUTH.md` 작성 완료 — httpOnly dual-write(`ud_*` 쿠키, Domain=.ur-team.com), 미들웨어 GET-only 쿠키 fallback, CSRF 표면 0 유지, kakao.routes 는 UNLOCK 절차. **구현은 본체(src/) 수정이라 B세션과 조율 후** (선행: beta.ur-team.com 연결 — workers.dev 는 쿠키 공유 불가).
- 스모크(ssr-pilot.yml)는 `/`·`/wholesale` 만 — `/group-buy`·`/search` 추가 권장(워크플로 1줄, 폴더 제한으로 미수정).
사용자 액션: 스테이징 서브도메인 1개 (Cloudflare). ⚠️ 기존 `/api/*`·Toss/카카오 잠금 무수정 원칙.


## 📌 운영 액션 TODO (사용자가 직접 — 코드 아님)

| # | 액션 | 소요 | 효과 | 상태 |
|---|---|---|---|---|
| 1 | **`REPAIR_SCHEMA_TOKEN` 등록** — ① 긴 랜덤 문자열 1개 생성(40자+) ② Cloudflare Dashboard → Workers & Pages → ur-live → Settings → Variables and Secrets 에 `REPAIR_SCHEMA_TOKEN`(Secret) ③ GitHub `tobe2111/ur-live` → Settings → Secrets and variables → Actions 에 **같은 값** 등록 | 5분 | 배포할 때마다 스키마 자동복구 → `/admin/health` 수동 클릭 영구 졸업 (미설정 시 매일 새벽 3시 cron 만) | ⬜ |
| 2 | (1번 전까지 1회) `/admin/health` 스키마 복구 실행 — 2026-06-10 등록한 products 컬럼 14개 수렴 | 10초 | 상품 상세 자가치유 prune 상태 → 완전 복귀 | ⬜ |
| 3 | `NTS_API_KEY` 등록 (Cloudflare Variables) | 5분 | 셀러/도매 가입 시 사업자번호 국세청 자동검증 → 자동승인 | ⬜ |
| 4 | `/admin/wholesale-deposit-account` 에서 도매 입금계좌 설정 | 2분 | 유통사 충전 입금 안내 표시 | ⬜ |
| 5 | `TAX_INVOICE_API_KEY` + `TAX_INVOICE_SENDER_BIZ_NO` (바로빌) | 10분 | 세금계산서 실발행 (미설정 시 draft 저장만) | ⬜ |
| 6 | `RESEND_API_KEY` | 5분 | 어드민 단체메일 발송 | ⬜ |
| 7 | **숙소 실결제 E2E 1회** (소액 결제→취소) | 10분 | reserve-before-charge 재구성(06-04) 실결제 미검증 ⚠️ | ⬜ |

## ✅ 2026-06-10 (오후) — 홈 v2 마감 + products 500 영구화 + 링크샵 구조개편 (`claude/service-analysis-optimization-whpu0f`)
- **products 'no such column' 500 영구 해결 (`356e8c2`,`07de4ee`)**: `/api/products/:id` findById 자가치유 누락분 적용 + **전수조사** — 소비자 SELECT 전부 healed+pruning, 에이전시 2곳 오적용 버그 수정(비-products 테이블에 products 컬럼 헬퍼), 명시목록에서 미존재 컬럼(shipping_fee/base_shipping_fee) 제거, repair-schema 에 14컬럼 등록, **신규 CI strict `check-product-detail-fields-repairable.mjs`**(명시목록 컬럼은 base∪repair 로 반드시 복구 가능해야 머지).
- **홈 v2 (`cc7112e`,`93fcf47`,`1ea848c`,`4ddb38f`)**: 상품 레일 = 쇼핑 카드(BrowseProductCard) 그대로 공유(할인%·별점·리뷰·구매수) + 알약형 카테고리 칩(전체/식품/패션/뷰티/리빙/디지털, 선택=검정) + '우리 동네딜' 섹션 제거(하단바 탭 전담, 컴포넌트 보존) + 교환권 '더보기/전체보기' → '교환권 더보기' 단일 버튼.
- **링크샵 구조개편 (`e1df59c`)**: 배경(사진/그라데이션/꾸미기 시트) **완전 제거** → 프로필 카드형(아바타+이름+소개+CTA 가운데 정렬). 인라인 편집·사진 업로드 3중 방어 유지. banner_url 은 레거시 무시(DB 불변 — 가역).
- **/my-deal-history (`5e6baa2`)**: 핑크→B&W(차콜 hero·검정 칩), '쇼핑'→'교환권 쓰기', 다크모드 구분선 fix.
- 멀티몰 어드민 예치금 몰 필터는 적용 확인됨(AdminMallSelect in AdminWholesaleDepositsPage) — 이전 '진행 중' 표기 해소.


### ✅ 2026-06-10 — 오프라인 공구 운영 루프 마감 3종 (현장 스캔·재발행·단골 알림) (`claude/service-analysis-optimization-whpu0f`)
**플로우 감사(8단계) 결과**: 6단계 이상적(발행 OCR 5분·결제·청약철회·자동정산·지역필터·NTS자동승인은 키만 대기) — 감사 에이전트 오탐 4건 직접 검증 기각. 진짜 갭 2개 구현:
- **현장 사용 1탭**: `/seller/scan` 계산대용 스캔 화면 신설(BarcodeDetector 네이티브, QR `/v/<code>` 파싱 → use-by-seller 1탭, 연속 스캔+세션 이력+진동 피드백+수동입력 폴백). 셀러 nav 공구그룹 최상단 + 대시보드 홈 안내카드에 직행 버튼(문구만 있고 누를 곳 없던 갭).
- **재발행 복사**: 공구 카드 "같은 내용으로 재발행" → `?copyFrom=` 프리필(`GET /api/seller/products/:id` 소유자 전용 신설 — 공개 상세는 active만 매칭이라 종료 공구 복사 불가했음). 날짜는 새 기본값 리셋.
- **단골 알림 문구**: 발행 시 팔로워 알림은 기존 구현 확인(notifyFollowers+카카오) — voucher 면 "단골 매장이 새 공구를 열었어요!"+`/group-buy/:id` 링크로 분기(전환율).
- i18n 18키×6언어. tsc 0 · unit 1528 · build OK. **운영 대기: NTS_API_KEY 등록(가입 즉시 자동승인 활성화).**

### 🔴→🟢 2026-06-10 — 교환권 상세 전사 500 인시던트 + 4중 방어선 + 구조적 후속 (`claude/service-analysis-optimization-whpu0f`)
**✅ 해결 확정 (7a7ff8c — CI 스모크가 prod 실상품 상세 호출 GREEN)**: 1차 명시목록 중 prod 미존재 컬럼이 잔여 500 → `withColumnPruning` 자가치유(누락컬럼 자동 prune+재시도)로 영구 마감. prune 된 컬럼명은 wrangler tail `[product-columns]` 로그 → repair-schema 등록 시 완전 복귀(선택).
**원인(_diag 실측 확정)**: products 컬럼 누적(94 ALTER+)이 **D1 결과셋 한도(100) 초과** → `SELECT p.*`+JOIN 전부 `too many columns in result set`. 어제 도매몰 컬럼 추가가 한도를 넘기며 '없던 500' 발생.
- **즉각 수정**: `productDetailCols()` 명시목록 SSOT(`shared/db/product-columns.ts`) — star-select 9곳 교체(교환권/공구 상세·join 구매경로·상품 리포지토리·FTS·에이전시). 부수: `store_verify_pin` 공개 누출 보안홀 동반 차단.
- **4중 방어선**: ① star-select CI 차단(`check-no-select-star-products.sh`, strict) ② repair-schema `column_counts/warnings`(85+ 경보) ③ 배포 smoke 에 실 상품ID 상세 검증 ④ KNOWN_ERRORS/CLAUDE.md 등재.
- **구조적 후속**: products **컬럼 예산제**(baseline 94 고정, 신규 ALTER CI 차단) + `product_supply_meta` K-V 사이드테이블(미래 도매/전시 메타) + **배포 후 스키마 자동복구**(`POST /api/_internal/repair-schema/auto`, X-Repair-Token — ⚠️ 활성화하려면 같은 값을 Cloudflare Variables + GitHub Secrets 양쪽 `REPAIR_SCHEMA_TOKEN` 등록).
- repair-schema 8건 오류 근본수정(실행순서/라이브 가드/백필 CPU 배치). 링크샵 banner_url 응답 누락+저장 후 캐시 purge. 로그인 페이지 라이브 잔재 제거+개편. 도매 become 대표자/담당자 서버 필수. 프리미엄 전용관 로그인 게이트. 위시리스트 그라데이션 카드. 동네딜 카드 메모리캐시+pointerdown 워밍.
- **사용자 확인 대기**: ① 교환권 상세 정상화 확인 ② `/admin/health` 스키마복구 재실행(오류 0 기대) ③ REPAIR_SCHEMA_TOKEN 등록(선택).

### ✅ 2026-06-10 — 하단바 ➕(공구 제안) + 쇼핑 잠정 숨김 + 라이브 잔재 정리 (`claude/service-analysis-optimization-whpu0f`)
**사용자 결정: 라이브커머스 영구 중단 / 쇼핑 잠정 보류(가역) / 동네딜 집중. CLAUDE.md `[UNLOCK_LOADING]` audit log 기록.**
- 하단바: 홈·동네딜·**➕(만들기)**·링크샵·마이 — `SHOPPING_TAB_HIDDEN` 플래그(false=쇼핑 탭 즉시 복원). ➕ 시트: 유저=동네 공구 제안(`/community-group-buy/new`), 셀러=공구권 등록/대시보드(기존 휴면 시트 재활용).
- **수요 신호 루프 마감**: 제안 생성 → 어드민 벨 알림(`/admin/restaurant-demand` 링크) · 공구 확정 → 참여자 전원 알림("공구가 확정됐어요"). ➕가 데드엔드가 아니게 하는 핵심.
- PC: DesktopTopNav 라이브 탭/LIVE 배지 숨김(LIVE_COMMERCE_SUSPENDED) + 쇼핑 탭 숨김 + 링크샵 탭 추가. DesktopLiveSidebar 둘러보기·쇼핑 카테고리 숨김(식사권 유지). index.html Speculation Rules `/live/*` 제거.
- 링크샵 재정향(동네딜 유통 채널화): 식사권 탭을 상품 앞으로 + 홈 탭 교환권/공구 핀 우선 정렬.
- i18n 4키×6언어(nav.create, bottomNav.sheetTitleCreate/proposeDeal/proposeDealDesc). tsc 0 · build OK.
- **30일 판정 지표**: ① ➕ 제안 수 ② 제안→공구 오픈 전환율(0이면 ➕를 동네딜 FAB로 강등) ③ 동네딜 전환.

### ✅ 2026-06-10 — 어드민·셀러 대시보드 IA/코드 개편 (`claude/service-analysis-optimization-whpu0f`)
**사용자 불만 "복잡한 상태" → IA(정보구조) 중심 개편. 라우트 전부 보존(북마크/딥링크 안전), 동작 변화 0 원칙.**
- **어드민**: ① nav 그룹 접기/펼치기(localStorage `admin_nav_collapsed_v1`, 활성 그룹 강제 펼침) ② 고아 라우트 18개 nav 등재(반품검수/원천징수/인플송금/교환권추적/에이전시셀러심사 등) + **🔧 개발자 도구 그룹 신설**(health/errors/env-check/kakao-test/youtube-quota — 기본 접힘) ③ 정산 4페이지(개별/일괄/Ledger/추천출금) `AdminFinanceTabs` 상단 탭 — nav '정산 센터' 1항목(`also` 활성매칭) ④ `AdminDataTable` 공통 테이블(데스크톱 table+모바일 카드 자동, 도매주문/무결성 2페이지 레퍼런스 적용) ⑤ 잔여 수동 fetch 9페이지 → `useApiQuery`(낙관 업데이트=setQueryData, 폴링=refetchInterval, 수동헤더 보존. 못 옮기는 페이지 사유는 commit 참조: env-check 503-body 시맨틱, live-monitor 사운드 사이드이펙트 등) ⑥ AdminBulkEmail native confirm→confirmDialog.
- **셀러**: ① `SellerPage` "라이브 시작" 버튼 `LIVE_COMMERCE_SUSPENDED` 게이트(중단 기능 노출 잔재 — 역할 게이트만 있었음) ② 상품/묶음/재고 `SellerProductTabs` 탭 통합(nav 3→1) ③ 신규 셀러(상품0·주문0) `NewSellerSteps` 3단계 시작 카드 + i18n 6언어(`seller.newSteps.*`) ④ `SellerSettlementsPage` 1,172→419줄(`seller-settlements/` 7파일 추출) ⑤ `SellerBusinessInfoPage` 797→514줄 3탭화(`?tab=`, `#bank-info-section` 해시 호환 유지).
- 검증: tsc 0 · unit 1528 · `npm run build` OK. commits `613c6d8`(IA) `3aa0740`(DataTable) `6d27cdb`(셀러 분해) + useApiQuery 마이그레이션.

### ✅ 2026-06-09 — 서비스 전체 분석 + 도매몰 perf/관측성 개선 (`claude/service-analysis-optimization-whpu0f`)
**분석 결론**: 잠금 최적화 회귀 0 · critical path 228→257KB gzip(+13%, 유기적 성장 — 모니터 권장) · 도매 페이지 chunk 분리/스켈레톤/캐시헤더는 기적용 확인(서브에이전트 오탐 다수 직접검증으로 기각).
**적용 fix (전부 비잠금·additive)**:
- `wholesale.routes.ts` GET /catalog/:id — 등급/테이블/최소마진/qty-tier 4쿼리 순차→`Promise.all`(3 RTT 절약, 리스트와 동일 패턴).
- 인덱스 2종: `idx_wholesale_orders_toss`(confirm 조회) + `idx_supplier_settlements_order_source`(정산 멱등) — ensureOrderTables + repair-schema 양쪽.
- silent catch `.catch(()=>{})` → `swallow(label)` 관측성 통일(~20곳): deposit-core(차감 CAS·환불 복원 — 환불 UPDATE 무음실패=유통사 손실이라 최우선), withdrawal-core, tax-invoices(issued 마킹 실패=이중발행 위험), quotes 알림, supplier-auth same-email 연결, ship-all, distributor-admin. 동작 불변 — 로그만 추가.
- `WholesaleCartPage` 썸네일 cfImage(width 128) 적용.
**보류(의도)**: 도매 14페이지 i18n 전면 전환 — 국내 사업자 전용 B2B(사업자등록 필수)라 실효 낮음, 기존 후속 backlog 유지.
검증: tsc 0 · unit 1528/1528 · `npm run build` 전체 체인 OK · schema-refs OK.

### ✅ 2026-06-09 — 도매몰 대개편 (예치금 결제·메인·운영기능·채팅) + 코드리뷰 fix
**대장정 1세션. 사용자 요구 11종 전부 구현 + 검증. 전부 `claude/service-tech-debt-analysis-d1KOx` 브랜치 커밋·푸시.**

- **예치금(선불) 결제 전환** (`e962f94`, `9e4a2f3`): 도매 결제 **토스 제거 → 예치금**. 유통사 입금 → 관리자 입금확인(`/admin/wholesale-deposits`, CAS pending→confirmed 이중적립 차단) → 충전 → 주문 시 원자 차감. 여신(외상) 제거. `wholesale-deposit-core.ts`(머니 CAS) + `wholesale-deposit.routes.ts`. 입금계좌 어드민 설정(`/admin/wholesale-deposit-account`, platform_settings). **코드리뷰 후 reserve-before-charge 재구성**: 주문 PENDING INSERT(UNIQUE idempotency_key 가 race 단독 중재) → 이긴 요청만 1회 차감 → 재고확보 후 PAID. (🔴 무음손실·이중차감 근본수정.) `/wholesale/deposits` 충전 UI, 카탈로그·대시보드 잔액 노출.
- **가입 대표자/담당자** (`df694ed`): 가입에 대표자(성명·연락처)+담당자(성명·연락처·이메일) 분리 + '동일' 원클릭 복사. sellers/suppliers 컬럼(representative_phone/manager_*). 승인→가격노출 게이트 검증.
- **메인 Sellpie형 개편** (`ccf3c85`): 배너 캐러셀(어드민 CRUD `/admin/wholesale-banners`) · 프리미엄 전용관(`products.is_premium`+토글 `/admin/wholesale-products`) · 제안/신고(`wholesale_proposal_tickets`, 경로 **/proposal-tickets** — /proposals 는 기존 추천) · 카테고리 네비 · BEST PRODUCT/상품코드. 시안: `docs/design/wholesale-main.md`.
- **운영 기능**: 대량주문 엑셀(`ad9cce3`, 즉시결제 버그→미리보기/검증/장바구니) · 어드민 단체메일(`9198d05`, Resend 재사용 — **큐화 진행 중**) · 세금계산서 자동(`93b4216`, 매출 플랫폼→유통사 / 매입역발행 제조사→플랫폼, `issueTaxInvoice` 재사용 env-gated, `wholesale_tax_invoices`).
- **채팅** (`f439592`, `060b77a`): 유통사↔제조사 **D1 폴링**(무비용, lazy chunk, adaptive). `/api/wholesale/chat` (cheap `/unread`, threads, messages?after, send+멱등알림). 제조사 신원 **마스킹**(유통사 뷰='제조사'). 유통사발 상품 문의(by-product, 서버가 supplier 해석).
- **대시보드/UX**: 제조사 4탭+액션홈(`dfd2ffe`) · 제조/유통 사이드바 셸 통일(`e61f21a`) · 어드민 알림 벨 fix(`8cb412e`, tokenKey 명시) · 제조 카카오가입(`5bc2d14`) · **perf 패스**(`93d106c`, 스켈레톤·cfImage·prefetch·memo·guest 캐싱) · 어드민 프리미엄토글+대표/담당자 표시(`78d49a1`).
- **머니-안전 강화** (`8e4cc52`, `5186c9e`): 예치금 reconcile cron(`0 * * * *`) — 차감 후 PAID 직전 크래시로 묶인 주문 자동 환불(미회수 0). `compensateDepositOrderOnce`(refunded_amount CAS=신뢰 마커, 이중환불 불가). **머니 코어 회귀 테스트 12개**(`src/tests/unit/wholesale-deposit-core.test.ts`·`wholesale-vat.test.ts`, vitest).
- **🏬 멀티몰 테넌시 Phase 1** (`927908d`, `0640d20`): 카테고리별 도매몰 복제(식품/패션…, **같은 사업자, model B=몰별 가입**). 핵심: 몰별 가입이라 seller_id/supplier_id 가 몰-유니크 → **예치금·정산·세금·채팅·주문 자동 격리(미변경)**. `wholesale_malls` 테이블(id=1=유통스타트 시드) + `mall_id`(DEFAULT 1) on sellers/suppliers/products/banners/proposals. `resolveMallId`(계정몰→`?mall`→host→1) / `registrationMallId`(host). 카탈로그·배너·제안 `COALESCE(mall_id,1)=?` 스코프. host 브랜딩(`GET /api/wholesale/mall` + `useWholesaleMall`, CSS변수 `--ud-brand`, fallback 유통스타트/#FF0033). 어드민 몰 관리(`/admin/wholesale-malls` CRUD) + `AdminMallSelect`(≤1몰 자동숨김) 필터(배너/제안/상품). **불변식: 기본몰+단일host = byte-identical**(검증: 머니테스트 회귀, /orders 불변).

**🏬 새 카테고리 몰 추가 런북 (멀티몰)**:
1. `/admin/wholesale-malls` 에서 몰 생성(slug·상호·**host**·브랜드색·로고·카테고리·입금계좌).
2. Cloudflare: 그 host(예: food.도메인)를 **같은 Pages 프로젝트(ur-live)** Custom Domain 으로 연결. (DNS 전엔 `?mall=slug` 로 테스트.)
3. 미들웨어가 host→mall 자동 판별 → 그 몰 카탈로그/브랜딩/가입. 가입자는 그 몰 전용(model B). 끝.
- **Phase 2 (선택)**: 어드민 예치금/세금 뷰 몰 필터(거의 완료) · 카테고리별 통합 회계 뷰. (개별 장부는 model B 로 이미 격리됨 — 뷰만.)
- **멀티몰 Phase 2 통합 관제**(`58bb3cc`): `/admin/wholesale-overview` 몰별+합산(GMV·예치금 부채·대기 입금/제안). 어드민 예치금/세금 몰 필터(`12e614a`). 상품 mall stamp(`91f330a`). **복제 매끄럽게**(`413d8df`): 새 몰 host 루트→/wholesale(소비자 host fast-path skip) + 몰별 입금계좌(/deposits/me 가 sellers.mall_id→wholesale_malls.deposit_account 우선).

- **B2B 운영 공백 4종 + 감사 (2026-06-09 후반)**:
  - **#1 제조사 정산 출금**(`1886ed7`): 출금 신청→어드민 송금확인. `reserved_amount`(recompute 불간섭) 원자 reserve CAS, 승인=음수 settlement+available 순감, 반려=복원. 머니 테스트 7(`38949c9`).
  - **#2 최소주문금액+배송비**(`a0fcbb3`): 제조사별 정책(suppliers.min_order_amount/shipping_fee/free_ship_threshold) + wholesale_orders.shipping_total. /orders 게이트=PENDING insert 전, chargeTotal=subtotal+shipping(deduct/보상환불 전액).
  - **#3 직원 서브계정**(`51d1b89`): wholesale_sub_accounts(role admin/staff/viewer). sub-login=부모 seller_id 토큰. viewer 주문 차단. 인증 불변.
  - **#4 브랜드 전시관**(`47c8892`) + **주문/정산 엑셀 export**(`4114d05`).
  - **🔍 전체 감사 → 수정**(`85233b1`,`0a7727a`): 🔴 배송비 환불 누락(reconcile+어드민환불) · 🟡 크로스몰 주문 차단(mall_id) · 채팅 supplier_id 누출 차단 · viewer 게이트 확대(충전신청/클레임/견적) · 배송비 세금계산서. **머니/테넌시/채팅 테스트 72**. **i18n 410키×6언어**(`53f1e78`).
  - **결정됨 🟡#6**: `suppliers.email` 글로벌 UNIQUE 유지(제조사=1몰 본성, (a)). 여러 몰 가입 원하면 `(email,mall_id)` 복합으로 전환.
  - **확인要 🟡#7**: 배송비를 과세 공급으로 처리(매출 세금계산서에 포함). 비과세면 되돌릴 것.

**⚠️ 운영 반영 전 (SSOT — 다음 세션/배포 담당 필독)**:
- env: `RESEND_API_KEY`(단체메일) · `TAX_INVOICE_API_KEY`(+`TAX_INVOICE_SENDER_BIZ_NO`, 세금계산서 실발행 — 미설정 시 draft) · `RATE_LIMIT_KV`.
- **`/api/_internal/repair-schema` 1회 트리거** (새 테이블·컬럼·인덱스 생성 — D1 migration CI 미작동).
- 어드민이 `/admin/wholesale-deposit-account` 에서 **입금 계좌** 설정해야 유통사 입금 안내 표시.
- E2E 권장: 충전→입금확인→주문→환불 / 세금계산서 / 채팅 / 대량주문 / 단체메일(테스트 먼저).

**진행 중 / 후속**:
- ✅ 단체메일 **cron 큐화**(`4d1a1ba`, claim-before-send CAS=at-most-once) · 운영가이드(`cef96e3`) — 완료.
- 🔄 멀티몰 어드민 예치금/세금 뷰 몰 필터 — 에이전트 작업 중.
- 후속: 멀티몰 Phase 2(통합 회계 뷰) · 세금 역발행 sender/receiver 매핑(실 provider 연동 시) · 도매몰 i18n 6개 언어(현 defaultValue fallback) · 단체메일 HTML 감지 휴리스틱(#6).
- **확인 요망**: 채팅 제조사 신원 — 현재 '비공개' 모델에 맞춰 **마스킹**. 노출 원하면 변경.

### ✅ 2026-06-06 — 도매몰 감사 후속 fix (대시보드·등급·로그인·보안)
세 감사(등급제/제조대시보드/유통대시보드) → 3차(에러처리·등급·대시보드) → 2차(로그인 B2) → 1차(보안) 순 완료.
- **대시보드·등급 4종** (`f9822d2`): ① 유통사 대시보드 부분 로그아웃(수동 키 삭제) → `clearAuthData('seller')`+full reload. ② 제조 대시보드 `/orders` shipped 필터에 `DONE`/`PARTIAL_REFUNDED` 추가(발송완료·부분환불 주문이 안 보이던 것) + 운송장 입력 시 `PARTIAL_REFUNDED→SHIPPING` 전환 허용. ③ 제조 대시보드 개요탭 `/me` 실패 시 blank null → 에러+재시도 버튼. ④ 유통 카탈로그 `/me` 실패 시 등급 silent C-fall → "등급 로드 실패·재시도" 배지+toast+refetch(B4).
- **B2 카카오 로그인 UX + 보안 L1/L2** (`781fa9a`): B2=카카오로 도매 로그인 시 기존 유통회원도 user_id 세션만 있어 "신청하기" 배너(=로그인 안 됨처럼) 보이던 것 → 카탈로그 mount 시 `become-distributor` 자동 시도(승인 회원만 토큰+reload, 신규는 배너 유지). L1=distributor-admin 세금계산서 raw `(err).message` 누출→safeError(503). L2=제조사가 `UTONGSTART_ONLY`(관리자 선정 전용) 가시성 self-assign 가능→`normalizeVisibility(v, selfServe=true)` 로 `APPROVED_CHANNEL` 강등(생성/CSV/PATCH 3경로, 관리자 경로 불변).
- **M1 보안 — 카카오 become verified 게이트** (`b61a660`, 사용자 승인): `become-distributor`/`become` 의 same-email 자동연결이 카카오 email verified 미검사 → 미verified email 로 사전등록(관리자 시드) 승인 계정 takeover 가능. `KakaoAuthService.upsertUser` 가 매 로그인 시 `users.email_verified` 저장(additive) + 두 become 경로가 `email_verified===1` 일 때만 자동연결. CLAUDE.md audit log 기록.

### ✅ 2026-06-05 (후속) — 정렬 근본수정 · 팝업 전면 인앱화 · 링크샵 영역 그라데이션
- **정렬/로딩 근본수정** (`3a5bc93`): `ProductRepository.findAll` 이 `dominant_color` 미적용 DB 에서 매 요청 `no such column` 실패→재시도(쿼리 2회+SELECT* 페이로드) → 느린 로딩 + 정렬 무시. 컬럼 존재여부 모듈캐시(`_dominantColorCol`, group-buy 패턴)로 최초 1요청만 재시도 → 이후 1차 성공(빠름+정렬보존+슬림). 옛 폴백의 ORDER BY 덮어쓰기 제거.
- **네이티브 confirm/alert 전면 인앱화** (`7d7067d`): `confirmDialog`/`alertDialog`(`ConfirmHost` 마운트, 네이티브 fallback) 로 어드민·에이전시·셀러·유저대면 ~95파일 교체(위험액션 danger 빨강). prompt()·로컬 confirm()함수·인프라 fallback 은 보존. 7 Opus 병렬.
- **링크샵 영역 그라데이션** (`eb0cdd1`, `b7a49d5`): 헤더를 하드엣지 배너박스 → 페이지로 페이드되는 영역 그라데이션 백드롭(아바타 히어로)으로 재설계 + 추천핀/누적클릭/30일적립 통계 3종 제거(수익은 대시보드 CTA 유지). 핀 카드도 쇼핑/동네딜과 동일 cardGradient(대표색 번짐+라이브 추출) 적용.

### ✅ 2026-06-05 — UI/버그 묶음 완료 (이번 세션)
- 마이(`/user/profile`) → `/` 무한튕김 **영구수정**: 내부 가드를 `ProtectedRoute`와 동일 기준(user_id/session_login)으로 통일(셀러+유저 이중로그인 시 user_type='seller'라 튕기던 것).
- 셀러 프로모코드 403 수정: `/api/promo/seller/list` 에 seller Bearer 헤더 명시(인터셉터 prefix 밖).
- 상품 카드 그라데이션(쇼핑+동네딜): 이미지 로드 시 대표색 즉시 추출→카드 단색 배경+같은색 번짐(경계 제거), 글자색 밝기 자동대비. 동네딜 카드 `GroupBuyGridCard` memo 추출.
- 카드 간격 통일(교환권/동네딜/쇼핑 `gap-x-2 gap-y-2.5`) + 이름↔가격 공백 제거(min-h 제거).
- 쇼핑(`/browse`): 식사권 카테고리 칩 제거 · '오늘의 핫딜' 배너+타이틀 제거 · '최근 본 상품' 섹션 제거.
- 상품상세(`/products/*`): 다크모드 흰 선 제거(인라인 흰색 띠/카드/divide → gray-50+dark variant, 라이트 불변) · 담기/선물 플로팅 버튼 통합(겹침 제거, 이모지→lucide 아이콘 라벨 pill).
- 도매몰: 모바일 기능줄(주문/거래/자료/OEM) 추가 · **유통사 대시보드 허브 신규**(`/wholesale/dashboard`) + 헤더 진입버튼.
- 홈 기본 커피/음료 · 동네딜/링크샵 로딩 전수조사 fix (아래 상세).

## 📋 도매몰·대시보드 TODO / 확인 체크리스트 (2026-06-04) — "남은 할 일" 물어보면 여기 참조

### ✅ 사용자 확인 필요 (배포 반영 후 체크)
- [ ] `/wholesale` 진입 시 헤더에 **제조회원 로그인 + 유통회원 로그인 + 가입** 버튼 표시
- [ ] 어드민 좌측 nav 가 **🏭 도매몰 / 🏪 오프라인 공구 / 🛒 온라인 쇼핑** + 공통으로 분류됨
- [ ] `/admin/distributor-grades` → **'데모 상품 10개 생성'** 클릭 → `/wholesale` 카탈로그에 10개 노출
- [ ] `/group-buy` · `/u/:handle`(링크샵) 카드 로딩 빨라짐 (SSR 엣지캐시 적용)
- [ ] 라이브 항목 숨김 확인: 셀러/어드민/에이전시 nav + 어드민 홈(`/admin`) 위젯
- [ ] 매장 계정 vs 크리에이터 계정 로그인 → 셀러 메뉴가 역할대로 갈림(숙소=매장, 링크샵=크리에이터)
- [ ] 유통사 가입(`/wholesale/join`) → 로그인 → `/wholesale` 완결(셀러 대시보드 안 거침)

### ✅ 카카오 통합 로그인 — 구현 완료 (2026-06-04)
- 유통회원(Phase A): `/wholesale/login`·`/wholesale/join` 카카오 버튼 → 로그인 후 `POST /api/wholesale/become-distributor`(유저세션) 로 유통회원 1탭 시작/전환. 이메일 연결 유통사는 자동 로그인.
- 제조회원(Phase B): `/supplier/login` 카카오 버튼 → `POST /api/supplier/become`. 신규=승인대기(어드민 검증 게이트 유지), 승인됨=supplier_token 자동 발급.
- 카카오 콜백 코어 미변경(안전) — 기존 유저세션 + 별도 become 엔드포인트 패턴.

### ✅ 가입 승인 + 사업자정보/등록증 — 구현 완료 (2026-06-04)
- 유통회원·제조회원 모두: 사업자번호 필수 + **사업자등록증 이미지 필수(강제)** + status='pending' → 관리자 승인 후 이용.
- 업로드: 공개 엔드포인트 `POST /api/upload/business-cert`(rate-limit+검증), `<BusinessCertUpload>` 컴포넌트.
- 관리자 검수: 유통회원=`/admin/seller-approval`(등록증 검증 섹션), 제조회원=`/admin/suppliers`(등록증 썸네일).

### ✅ 홈 기본 = 커피/음료 카테고리 — 구현 완료 (2026-06-04)
- 홈(`/`) embedded VouchersPage 기본 category = '커피/음료' (URL 무지정 시). MAIN SSR 슬롯 + cache-prewarm HOT_PATH 도 동일 커피 카테고리로 warm → 0-RTT 유지 (`[UNLOCK_LOADING]`, CLAUDE.md audit log).
- 브랜드를 클릭(필터)해도 브랜드 그리드 유지 + 선택 브랜드 강조(ring) + 재클릭 해제.
- 커피 브랜드 정렬: 스타벅스 → 메가 → 투썸 → 할리스 → 컴포즈 → 빽다방 → 나머지(원본순).

### ✅ 동네딜·링크샵 로딩 전수조사 — 추가 fix 완료 (2026-06-04)
서브에이전트(Opus) 전수조사 → 코드 대조 검증 후 실효 fix만 적용:
- **A1** 동네딜 '유저 공구'(community) `GET /list`: `await ensureTables`(DDL 6종) → `waitUntil` 비차단. (seller 탭과 동일 패턴, 누락분)
- **A2** 만료 sweep `UPDATE`(풀테이블 write)를 응답 경로에서 분리: `waitUntil` + isolate당 60초 throttle. + `community_group_buys` 인덱스 2종(`status,current_count` / `status,expires_at`) 추가(기존 인덱스 0).
- **A3** community `/list` HOT_PATH 추가(`?status=proposed&sort=popular&limit=20`) — 30s 엣지캐시 organic 만료 → cold D1 방지.
- **B1** 링크샵 `/api/curator/:handle`: `await ensureCuratorTables`(DDL 6종) → `waitUntil`.
- **B2** seller + pins 쿼리 순차 2RTT → `Promise.all` 1RTT.
- **B4** `users.banner_url` 컬럼 존재 모듈캐시(`_bannerUrlCol`) — 컬럼 없는 환경 매요청 2쿼리 방지.
- 검증으로 기각: **A6**(gift_catalog.gift_code 인덱스)는 `helpers.ts:107` 에 이미 존재(에이전트 오탐). A5/A7/A8·B3/B5/B7 은 LOW + 잠금민감 파일이라 보류.

### 🟡 결정/운영 필요 (코드로 불가 — 사용자·Cloudflare)
- [ ] **R2 스토리지 확인** — 등록증 업로드는 `MEDIA_BUCKET`(R2)+`PUBLIC_R2_URL` 바인딩 필요. 미설정 시 업로드 503 → 가입 불가(필수 강제됨). 다른 이미지 업로드와 동일 의존이라 이미 설정됐을 가능성 높음 — 확인 권장.
- [ ] `utongstart.com` 도메인 → Cloudflare Pages 커스텀 도메인 연결 (코드는 준비됨)
- [ ] barobill API 키 (전자세금계산서) — Cloudflare Variables (`BAROBILL_*`)
- [ ] Scrape Shield → **Email Address Obfuscation OFF** (CSP email-decode 콘솔 노이즈 제거)

### 🔵 코드로 가능 — 요청 시 진행
- [x] ~~카카오 통합 로그인~~ — 완료(위 ✅ 참조).
- [ ] 라이브커머스 재개 시 `src/shared/feature-flags.ts` `LIVE_COMMERCE_SUSPENDED=false` 한 줄 (모든 라이브 UI 코드 보존됨)
- [ ] 셀러/어드민 추가 간소화 (요청 시)


## 🟢 2026-06-04 — 도매몰 쇼핑몰 UI 시안 구현 (Claude Design 핸드오프)
시안: `docs/design/wholesale-shop-design/` (원본 HTML/jsx/대화 보존 + IMPLEMENTATION.md). TDS(Toss) 라이트 — 무채색+#FF0033 1포인트, 라이트 고정 B2B.
- **토큰 SSOT** `src/pages/wholesale/wholesale-theme.ts` (WT 토큰 + won/discountRate/marginRate + 카테고리).
- **홈/카탈로그 전면 재작성** `WholesaleCatalogPage`: 브랜드 히어로 + 사입 대시보드 + 등급 시트(4단계) + 전용공급/베스트/신규 레일 + 정제 카드(할인%/마진) + 정렬/사이드바 + 단가표 엑셀.
- **상품상세 전면 재작성** `WholesaleProductPage`: 공급가 앵커+할인%+권장가 + 마진 밴드 + 정보 리스트 + 탭 + 하단 고정 CTA(주문 API 유지).
- **API 보강**(비잠금): `/home`·`/catalog`·`/catalog/:id` 에 `retail_price`(권장가)+`sold_count` 추가 → 마진 산출. 원가/제조사 신원 계속 비노출.
- 테마 체커에 `wholesale` 제외 등록(라이트 고정). tsc 0 / build OK / verify:sql 8/8.
- **2차 증분(우리 구조 적합)**: 다품목 장바구니(`useWholesaleCart`+`WholesaleCartPage`, 주문 API items[] 활용, 서버 등급가 재계산=SSOT) · 빠른 재주문(`/recent-items`) · 마감임박 badge · 주문내역/거래내역서 TDS 정비. 도입 silent catch 1건 즉시 toast 전환(부채 예방).
- **3차 — MOQ(박스 단위)**: `products.min_order_qty`(기본1) + 공급자폼 + API 4종 + 카드/상세/카트 박스·개당 + 서버 `qty<moq` 차단.
- **4차 — 유통사 자료 뷰**: `/api/wholesale/documents`(본인 sales) + `/documents/:id/html`(IDOR 가드) + `WholesaleDocsPage`(거래명세서/세금계산서 탭·인쇄). 기존 tax_documents 재사용.
- **5차 — 수량 구간별 단가(volume tier)**: 등급가 × 수량구간 %할인(곱·additive). `qtyTierDiscount`/`tierUnitPrice` + `product_qty_tiers` + 관리자 `PUT /products/:id/qty-tiers` + 상세 단가표 + 주문 authoritative 재계산(SSOT).
- **6차 — 전 페이지 디자인 통일 + 마감**: Checkout/Success dark: 제거(WT 라이트, Toss 위젯 로직 보존) · Intro/Join/Oem Tailwind gray→정확한 WT hex(레이아웃 불변, gray- 0건) · 카탈로그 "수량할인" 배지(has_tiers) · 전자세금계산서 플랫폼 사업자정보 admin UI(`/company-info`, 바로빌 블록 절반 해소 — API키만 Cloudflare). **도매몰 전 11페이지 라이트 고정 일관 완료**.
- **인프라 블록 정직 상태**: 바로빌=사업자정보 UI완료/API키만 Cloudflare(TODO 문서화) · 새 스키마=lazy ensure self-heal(마이그레이션 불요) · youtube god-file 분해=**staging 실송출 검증 필수(CLAUDE.md 하드룰)라 미실행**.
- **7차 — 전수조사(서브에이전트 2종) + 심층 fix 6건**: 도매몰 자금경로(주문생성→confirm→정산→성숙→지급→환불×2) end-to-end. **실버그 6건 영구 차단**:
  ① 역마진 — 수량할인이 공급원가 이하로 내려가 플랫폼 손해 → `tierUnitPrice(floor=공급원가)`(표시=결제), `margin_total≥0` 불변식.
  ② 관리자 전액환불 재고 이중복원(제조사 부분환불 후) → 미환불 라인만 복원.
  ③ 제조사 부분환불 Toss실패 롤백이 PENDING→SHIPPED 둔갑 → 라인별 원상태 복구.
  ④ 정산 잔고 캐시 드리프트(SUM-then-claim 레이스) → settlements 권위 SUM 자가치유(영구).
  ⑤ confirm 만료-청구 race(Toss청구 후 EXPIRED면 고객 미회수) → 자동환불+ORDER_EXPIRED.
  ⑥ CSV 대량등록 MOQ 미지원 → 단건과 feature-parity.
  + 보강: `/company-info` 형식검증·0% tier 거부·refund/issue-nts rate limit·silent catch→swallow.
  **정합 확인(버그 아님)**: creditSupplier 배선/멱등/CAS · confirm 금액 서버재검증 · 정산 source 분리 · oversell NULL 대칭 · renderTaxDocHtml XSS escaping · bulk 승인게이트.
  라이브: 송출 로직 미변경, 안전 UX만(StepSetup 무한대기 30s 탈출 · Quick Start 최근상품). unit 13/13 · verify:sql 13/13 · tsc 0 · build OK.
- **8차 — 인접 도메인 자금경로 심층 + fix**: ① 숙소 오버부킹 **reserve-before-charge** 근본수정([UNLOCK] payment.routes, 사용자승인 — 달력차감을 Toss승인 전으로 + booking CAS + Toss실패시 release. ⚠️staging E2E 권장). ② 인플 수동지급 **이중지급 CAS**(marketing /payouts/process — 적립 전 잔고 claim). ③ referral 출금승인 CAS.
- **9차 — 출금/지급 동시성 전수 (플랫폼 전역)**: ④ curator 출금 **조건부 INSERT 원자화**(가용액 재평가 — 동시 신청 초과지급 차단, verify:sql 14/14). ⑤ referral 출금신청 **commission claim-first**(phantom 출금=초과지급 차단). **정합확인(이미 안전)**: 공급자 payout(CAS+권위SUM)·인플 payout cron(attributions SUM 자가치유)·seller settlement(C1 잔액상한+H3 원자 period dedup, 2026-05-31). → 6개 지급경로(supplier/influencer/curator/referral/seller/wholesale) 동시성 모두 잠금.
- **시안 전 요소 구현 완료**. unit 12/12 · verify:sql 11/11 · tsc 0 · build OK. 남은 polish: OEM 토큰 미세정렬·카드 수량할인 배지(선택).

## 🟢 2026-06-04 — 도매몰 게이팅·마진·합배송 + audit (이번 세션)
- **utongstart.com 도매몰 전용 게이팅** (`6000a2e`): worker 진입 302(주방어) + App.tsx SPA 가드. 도매 surface(`/wholesale`·`/supplier`·`/seller/login|register`·`/auth/`·`/login`·정적) 밖 경로 → `/wholesale/intro`. allowlist worker↔`utils/domain.ts` 동기화. 다른 호스트 no-op.
- **npm audit high/critical 0건** (`882dc54`): axios 1.15.2→1.17.0(프론트 high), protobufjs override ^7.5.8(firebase 경유 transitive high, firebase 다운그레이드 회피), vitest critical은 dev전용+UI서버 RCE(미사용)라 `.audit-allowlist.json` 등재. `check-npm-audit.sh` GHSA advisory 단위 + allowlist 게이트로 개선(blanket bypass 제거).
- **상품별 등급마진 override(특가)** (`1ec0873`): `resolveDistributorPrice({marginOverridePct})` — 설정 시 등급 무관 동일가, NULL=등급마진. `products.supply_margin_override_pct`(lazy ensure) + 서버 재계산 7곳 일괄(표시가=결제가) + `PATCH /api/admin/distributor/products/:id/margin-override` + AdminDistributorGradesPage UI. 단위10/10·verify:sql.
- **도매 합배송(주문내 제조사별 일괄발송)** (`6d3fe10`): `POST /api/supplier/wholesale/orders/:id/ship-all` — 내 미발송 라인 전체 송장1개 원자발송, 제조사별 격리, 전라인 발송시 주문 SHIPPED. SupplierWholesaleOrdersPage 주문단위 그룹 + 합배송 패널. verify:sql 8/8.
- **silent catch 5곳 → swallow()** (`e49c821`): best-effort 배경경로 관측성. 동작 불변.
- **코드 audit (서브에이전트)**: 지목 항목 대부분 false positive 확인 — 셀러양도 인증(TD-016 이미 차단), NaN 6곳(전부 가드), rate-limit 3곳(이미 적용), bulk 음수가격(이미 검증), 8.8%원천징수(이미 배선). 스퓨리어스 수정 회피. **남은 진짜 backlog는 인프라/결정 블록**: 스키마 이중화 DROP(TD-001 migration CI 선행), youtube-live god-file 분해(staging 필수), 세금계산서 국세청발행(바로빌 키=사용자).

---

## 🟢 2026-06-01 — 유통스타트 도매몰 (Phase 1~5 + 정산) 신규 구축
별도 도매몰(utongstart.com, 같은 코드/DB) — 3자(유통사=셀러 / 유통스타트=플랫폼 / 제조사=공급자) 등급제 B2B 선결제 모델. 스펙·결정: `docs/design/wholesale-utongstart.md`, 사용자 할일: `docs/design/wholesale-utongstart-TODO.md`.
- **P1** 등급 가격엔진 `lib/distributor-pricing.ts`(제조사가×(1+등급마진), 특별할인 기간 우선) + `distributor_grades` 테이블 + 유닛 8.
- **P1b** 어드민 `/admin/distributor-grades` — 등급 마진율 편집 + 유통사 등급배정 + 특별할인.
- **P2** 유통사 카탈로그+B2B 선결제 `/api/wholesale/*`(등급가·제조사 신원 비노출, Toss SSOT helper·서버금액검증·CAS·재고·멱등) + 페이지 5종(`/wholesale*`).
- **P3** 제조사 `/api/supplier/wholesale/*` 송장입력 + 반품(cancelTossPayment+재고복원) + `SupplierWholesaleOrdersPage`.
- **P4** 거래내역서(`/wholesale/statement`) + 상품제안(`wholesale_proposals`, 어드민→유통사) + 세금계산서 월집계(1차 수동).
- **P5** `utils/domain.ts isUtongstart()` — utongstart.com 루트 → `/wholesale` 분기.
- **정산** `wholesale-settlement.ts` — 결제완료 시 제조사 공급가(base×qty)를 `supplier_settlements(source='wholesale')` 적립→기존 mature→payout 파이프라인 자동지급, 환불 시 역전. consumer 정산과 `source` 컬럼으로 order_id 충돌 분리.
- **남은 운영작업(코드 아님)**: Cloudflare 커스텀도메인 등록 + 카카오 콜백 + repair-schema 1회 + 등급/제조사/유통사 데이터 입력 (TODO 파일).
- **견고화(검증 후)**: 부분환불(제조사 본인 라인만, Toss cancelAmount)·oversell 원자가드+자동환불·rate limit(`/orders`,`/orders/confirm`)·체크아웃 `?order=` 복구. 정산 7일창 유지(기존 공급자 파이프라인 일관).
- **검증**: `wrangler dev --local` + 실 seller JWT 로 라우트 마운트/등급가/주문생성/검증 런타임 확인. **돈 경로(Toss confirm→정산→환불)는 스테이징(Toss키+시드) E2E 필요** — 코드/읽기경로만 런타임 확인됨.
- 전 구간 잠금 SSOT(toss-gateway) 미수정·호출만. tsc 0 / build OK / unit 15 pass.

---

## 🟢 2026-05-31 — 전 도메인 보안 audit (payment/auth/IDOR) + 적용
3개 병렬 심층 audit(서브에이전트) → **전부 코드로 직접 재검증** 후 적용. IDOR/권한 계층은 홀 0건(견고).
**비잠금 적용**:
- C2 공구 카드 confirm-toss 멱등 race(voucher 2배) → idempotency_key(=paymentKey, 0118 unique) 원자화 (`1c14622`)
- C1 셀러 정산 임의금액 → 서버잔액(redeemable_deal_amount) 상한 (`729b9d5`)
- M1 카드 공구 재고 oversell → 원자 예약+자동환불+롤백 (`729b9d5`)
- 카카오/토큰 raw-error 누출→generic, OAuth /start·/sync rate-limit (`1c14622`)
- 카카오 프록시 rate-limit + 셀러 스트림 status enum (`05548b4`)
- H3 정산 동일기간 중복신청 → 원자 INSERT...WHERE NOT EXISTS
- H2 인플 payout 알림 당월 dedup (cron 재실행 중복알림→이중송금 오인 차단)
**잠금 해제(사용자 승인, CLAUDE.md audit log 기록)**:
- [UNLOCK] payment.routes `/confirm` 동시요청 CAS 가드 — 재고 2배차감·커미션 중복 차단
- [UNLOCK_LOADING] 카카오 same-email 셀러 자동연결 verified-only 게이트 — takeover 차단
**운영 설정(코드 아님)**: `TOSS_WEBHOOK_IP_ALLOWLIST` 미설정 시 위조 webhook 여지 → Cloudflare Variables 설정 권장.
tsc 0 / build:worker OK / 전체 1802 테스트 통과.

## 🔴→🟢 2026-05-31 — 자금루프 audit 3탄: affiliate/curator 출금 누수 (실현금)
**발견**: `affiliate_earnings`(물리상품 referral + 숙소 referral 적립, curator 출금 SSOT)는 default `status='pending'` 이고 **granted 전환이 없음**. 그런데 ① curator 출금 잔액(`curator.routes.ts:758` `SUM(commission)`)이 status 필터 없음 → **환불 커미션도 출금 가능(user_withdrawals=실제 은행송금)**, ② returns 환불 reverse 가 `WHERE status='granted'` 타겟 → 0건 매칭(무효), ③ 숙소 취소는 affiliate reverse 자체가 없음.
**fix**:
- curator 출금 잔액 + 잔액표시 + 30일 대시보드 SUM 에 `COALESCE(status,'pending') != 'refunded'` 추가 (`curator.routes.ts` 758/811/588).
- returns 환불 reverse: `status='granted'` → `COALESCE(status,'pending') IN ('granted','pending')` (실제 pending 행 처리).
- 숙소 취소(사용자/오버부킹/어드민 3경로) 환불 성공 시 `affiliate_earnings SET status='refunded' WHERE order_id`.
- tsc 0 / build:worker OK / sql 검증 통과.

## 🔴→🟢 2026-05-31 — 자금루프 audit: 인플 커미션 clawback 누수 fix (체계적 버그)
**발견(audit)**: `influencer_attributions` 는 insert 시 `voucher_id` 를 안 넣어 항상 NULL인데, clawback 3곳(셀프취소/셀러환불/만료)이 모두 `WHERE voucher_id=?` 로 조회 → **0건 매칭 → 인플 커미션이 환불/취소/만료 시 전혀 회수 안 됨(누수)**. `influencer-payout` cron 은 attribution `SUM(commission_amount)` 로 balance 재집계 후 송금하므로 → 회수 안 된 커미션이 그대로 지급됨.
**fix**:
- `helpers.clawbackVoucherCommission`: voucher→`order_id` 연결로 attribution 조회 + **바우처 비례 clawback**(분모=주문 내 미회수 바우처 수, 환불 flow 가 voucher.status='refunded'/'expired' 를 clawback 직전 설정해 정합). 권위 출처인 `commission_amount` 차감(전액→clawed_back, 부분→감액). qty=1 이면 전액.
- `helpers.applyGroupBuyReferral` + `/join` 인라인 insert: attribution `order_id` 실제 주문 id 저장(이전 `0` 하드코딩).
- `confirm-toss`: `applyGroupBuyReferral` 에 `orderId: newOrderId` 전달.
- `auto-settlement.ts` 만료 clawback: 깨진 인라인 `WHERE voucher_id=?` 블록 → 공유 헬퍼 호출로 통합.
- tsc 0 / build:worker OK / sql·bind 검증 통과. (레거시 `order_id=0` attribution 은 소급 연결 불가 — 신규부터 정상 회수.)

**audit 전체 결론 (4개 자금 흐름 환불 reversal 정합)**:
1. ✅ 인플 커미션 — 구매 적립·환불창 후 지급 → 환불 reversal 필수 → **누수였음, fix 완료**(위).
2. ✅ 에이전시 입점 2% sales_commission — 구매 시 order 단위 적립, 환불 reversal 없었음 → **clawbackVoucherCommission 에 비례 cancel 추가**(status='cancelled'+감액; payout 은 status별 SUM 이라 정합).
3. ✅ 셀러 정산 — `auto-settlement` 이 `WHERE v.status='used'`(+used_at 7일+ +settlement_id NULL)로만 집계 → 환불 바우처(status='refunded')는 **애초에 정산 안 됨, 구조적 안전**(누수 아님). `donations` 는 매출추적용, payout 아님.
4. 🟡 사용자 추천 보너스 — 구매 시 user_points 적립, 환불 reversal 없음. **소액·프로모션 + 이미 사용된 포인트 차감 음수 위험**이라 보류(known minor).

## 🟢 2026-05-31 — 테마 backlog 정리 (2차) + 공구 결제 런타임 버그 fix
- **공구 join 응답 ReferenceError fix** (`group-buy.routes.ts:854`): A2 단일가 전환 때 제거된 `currentTier` 를 응답이 계속 참조 → 런타임 `ReferenceError`. `next_tier: null` 로 교정 (A2 모델 정합). confirm-toss `body.ref` 타입 union 누락도 fix → **tsc 0** (이전 세션 node_modules 부재로 미검출된 잠복 타입에러 2건 해소).
- **테마 backlog 정리**: checker 정밀화(streaming/guide/dashboard 폴더 + ProductOptionForm/BulkUploadModal/LiveDonation 제외 — usage 추적으로 라이트 고정 확인) → 오탐 202→실제 58건. 유저 대면 26파일 dark: variant 정합(state-variant aware) + 이전 perl 잠복 orphan(`dark:hover:bg-[X] dark:bg-[X]`, `placeholder:text dark:text`, `hover:text dark:text`) 전수 제거. 남은 1건은 토글 thumb(의도된 흰색).
- npm 의존성 설치 후 tsc/build:worker 실검증 통과.

## 🟢 2026-05-31 — 다크/라이트 테마 전반 정합 + 미래 자동 강제
사용자 요구: "다크/라이트테마 가장 이상적으로 작업 전반 + 앞으로 생성/수정 페이지에도 정확히 적용".
- 유저 대면 화이트-토글 페이지 13종 dark: variant 정합 (GroupBuyDetail/ProductDetail/MyVouchers/MyReturns/MyAppointments/MyFollows/Affiliate/FAQ/Search/About/GroupBuyList/Address/CuratorEarnings/MapSearchHeader)
- perl 일괄치환이 만든 깨진 클래스 전수 교정: `dark:dark:`, 중복 `dark:bg-`/`dark:text-`, state 오매핑(`hover:bg-gray-100`→잘못된 `dark:bg-` 대신 `dark:hover:bg-`) → 0건 확인
- **미래 자동 강제**: `scripts/check-theme-consistency.mjs` (variant-aware, 대시보드·순수다크·콜백 제외) 를 pre-commit(staged) + `verify.yml` CI 에 등록 (warn-only, `STRICT_THEME=1` 차단, `[SKIP_THEME_CHECK]` 우회). CLAUDE.md 테마 섹션 + 영구 방어선 표 갱신.
- 기존 backlog ~200건(공유 컴포넌트 streaming/dashboard 다수) 은 warn 유지 — 점진 정리 후 strict 승격 예정.

## 🟢 2026-05-31 — 오프라인 공구 운영 플로우 audit + 자금 커버리지 갭 3종
역할별(매장/인플/에이전시) 운영 플로우 전수 audit. 서브에이전트 2종 결과를 **직접 검증해 오판 정정**:
- ❌→✅ "에이전시 정산 자동화 없음" 오판 — `agency-auto-settle.ts`(자동 집계+`agency_settlements` INSERT) + `agency-monthly-invoices` 실재
- ❌→✅ "매장 가입 pending 병목" 오판 — NTS 사업자 진위확인 자동승인 end-to-end 구현(폼이 rep_name+start_date 수집·전송). **`NTS_API_KEY` 환경변수만 설정하면 자동활성** (코드 변경 불필요·운영자 사안)
- ❌→✅ "3자 분배 0%" 오판 — 에이전시(intro 2%/매장별) + 인플(referral/?ref별) **병렬 공존**

**고친 실제 갭 (자금 누수)**:
- #2 카드 결제 인플 referral attribution 누락 → `applyGroupBuyReferral` 헬퍼로 닫음 (`fb5f809`)
- #1a 매장 정산 입금완료 알림톡 추가 (`daf9bee`)
- #3 에이전시 intro 커미션 공구 경로(딜+카드) 누락 → `creditAgencyStoreIntroCommission` 호출 추가 (`60586ae`)

**남은 것**: 인플/에이전시 최종 은행송금 자동화(PG 연동·KR 특성상 수동 일반), 정산서 PDF, Magic Link 영구저장. NTS_API_KEY 프로덕션 설정 확인(운영자).

## 📋 사용자 액션 TODO
- [x] ~~**SSR prerender 실제 동작 검증**~~ ✅ **2026-05-31 원격 환경에서 검증 완료** (npm 의존성 설치 후):
  - `npm run build` 전체 체인 통과: client → ssr → **prerender(`renderToString 완료 48ms, 40578 chars` → `dist/client/index.html 갱신 완료 ✅`)** → worker(2.6mb) → prepare
  - 렌더된 shell 에 raw i18n 키 누출 0 (실제 한글 "라이브/둘러보기/공동구매/식사권" 렌더). `NO_I18NEXT_INSTANCE` 경고는 nav 가 defaultValue/하드코딩이라 무해.
  - 아키텍처 확정: prerender=앱 shell(0-RTT first paint), worker HTMLRewriter 가 runtime 에 `__SSR_INITIAL_MAIN__` 데이터 inject + RQ fresh fetch. `_routes.json` 이 `/` 를 worker 로 라우팅.
  - **Phase 3-2/3-3/3-4 모두 완료** (아래 "진행 중" 섹션은 stale → 정정함). 남은 건 Phase 5 Lighthouse 실측(배포 후).
- [ ] 배포 반영 확인: `claude/service-tech-debt-analysis-d1KOx` → main 머지 + Actions 녹색
- [ ] 배포 후 1회: `POST https://live.ur-team.com/api/_internal/repair-schema` (숙소 migration 보장)
- [ ] 스모크: 공구 카드결제 / 숙소 예약·취소 각 1건 (이번 세션 가격·환불·재고 변경분)
- [ ] **`NTS_API_KEY` 프로덕션 설정 확인** — 매장 가입 자동승인(국세청 진위확인)이 이 키 없으면 전원 pending 으로 묶임 (Cloudflare Dashboard → ur-live → Variables)

## 🟢 2026-05-31 — SSR Phase 2 메인 트리 audit + fix
- 인프라(entry-server renderToString + prerender HTML inject) 이미 구현 + graceful skip 확인
- 메인 `/` 트리 정적 audit: 실제 throw 는 `isLoggedInSync()` 하나 → `typeof localStorage` 가드 추가
- useTheme/i18n/useAuthKR/localCache/App.tsx/GroupBuyFeed/BottomNav 전부 가드 확인(안전)
- **다음(로컬 필수)**: `npm run build:ssr && npm run prerender:main` → prerender 성공/추가 throw 확인. 가이드 `docs/SSR_MIGRATION.md`

## 🟢 2026-05-31 — 백엔드 보안·하드닝 + 후속 4종 + 문서 동기화
- 카카오 구독자 전체발송 무인증 스팸 벡터 차단 (`38298f4`) — rateLimit+requireAuth+소유권
- 셀러/에이전시 카카오 연동 에러 누출 → safeError (`38298f4`)
- #1 숙소 취소/환불 객실 재고 복원 버그 fix + status 정합 (`40a5668`)
- #2 미결제 pending 숙소 예약 자동 만료 cron (안전 옵션) (`33622d8`)
- #3 카드(toss) A2 단일가 정합 + confirm-toss 정산기록 보강 (`1632642`)
- #4 어드민 에러 누출 37곳 safeError 통일 (`a8e3819`)
- `TECHNICAL_DEBT.md` 2026-05-31 동기화 + 후속 완료 기록
- **남은 것**: stay hold 모델([UNLOCK]), confirm-toss 인플 attribution, 데이터페칭 통합/God파일/SSR(대규모)

## 🟢 2026-05-30 — 공동구매 = 즉시판매 단일가 모델 (A2 구현 완료, 가격 코어)
- 결정 확정: 경제=즉시판매, 이름=공동구매 유지, 가격=**A2 최대 tier 즉시 단일 적용** (사용자 승인)
- 설계안: `docs/design/groupbuy-instant-sale.md`
- 구현 (`[UNLOCK_LOADING]` 사용자 허가, CLAUDE.md audit log 기록):
  - `helpers.ts` `maxTierDiscount()` 추가 / `group-buy.routes.ts:223` join 가격 = maxTier
  - `group-buy-public.routes.ts` 상세 current_discount_pct 고정 + next_tier=null, 리스트 current_price enrich (캐시 헤더 불변)
  - `GroupBuyDetailPage.tsx` 단계별 tier 사다리 + "N명 더 모이면 할인 시작!" 제거 → 정직한 단일가 안내
- tsc 0 / schema·status·sql 검증 통과
- **후속 4종 완료(2026-05-30)**:
  - ① 셀러 폼 tier 입력 제거 → 단일 공구가 안내 + i18n 6개 언어 (`SellerMealVoucherNewPage`)
  - ② 기존 진행중 공구: 런타임 maxTierDiscount 흡수 → 백필 불필요 검증
  - ③ 사용자 셀프 취소/청약철회: `POST /api/group-buy/voucher/:code/cancel` (본인+미사용+7일) + MyVouchersPage UI
  - ④ breakage: `auto-settlement.ts:173` 이미 만료 시 고객환불 — 문서화만
- **잔여 후속 3종 완료(2026-05-30)**:
  - 셀러 가이드 `groupbuy-single-price` 섹션 신설 (guide-seed-seller.ts)
  - 인플 clawback 통합: `helpers.clawbackVoucherCommission()` → 셀프취소 + 셀러 /refund 연결 (누수 차단)
  - 환불 알림톡 통합: `helpers.sendRefundAlimtalk()` → 셀프취소 + 부분환불 연결

**최종 업데이트**: 2026-05-28 (서비스 모델/정산 통합 + SSR 마이그레이션)
**브랜치**: `claude/check-live-commerce-flow-jgNs8` (서비스모델/정산) · `claude/vibrant-feynman-m3X3m` (SSR)

## ✅ SSR 마이그레이션 — Phase 1-4 완료·검증 (2026-05-31, LCP 10.7s → 0.5-1.5s 목표)

**가이드**: `docs/SSR_MIGRATION.md`. **2026-05-31 원격 환경 빌드 검증으로 Phase 3-4 완료 확정.**

**완료 (검증됨)**:
- Phase 1 인프라 (`74a0625`): entry-server/client, vite build:ssr, prerender-main
- Phase 2 (`c113f1b`): BottomNav SSR-safe + `isLoggedInSync` `typeof localStorage` 가드
- Phase 3-1 (`e3a3a7e`): App.tsx Router prop (default BrowserRouter, SSR 시 StaticRouter)
- **Phase 3-2 entry-server.tsx 실구현 완료** — `renderToString(<App Router={StaticRouter} routerProps={{location:url}}/>)`
- **Phase 3-3 prerender-main.mjs 실구현 완료** — API fetch 제거(빌드 의존성 0, initialData=null), shell 만 정적 렌더. 데이터는 worker HTMLRewriter 가 runtime `__SSR_INITIAL_MAIN__` inject + RQ fresh fetch.
- **Phase 3-4 build script 체인 완료** — `build = client && ssr && (prerender||graceful skip) && worker && prepare`
- **Phase 4 `_routes.json` 완료** — `/*` worker 라우팅(static asset 제외), worker `index.ts:444 isMainPage` 가 `caches.default` edge read + HTMLRewriter 데이터 inject
- ✅ **검증**: `npm run build` 전체 통과, prerender `48ms / 40578 chars`, raw i18n 키 누출 0

**남은 것**:
- **Phase 5 Lighthouse 실측** (배포 후 — 사용자/운영). 목표 아래.
- (선택) SSR initialData 를 빌드 시점 fetch 로 확장하면 first paint 에 카드까지 — 현재는 shell+runtime inject 로도 0-RTT shell 확보. 비용/복잡도 대비 효과 작아 보류.

**위험 영역(유지)**: entry-server import 모듈 SSR-safe 필수(한 곳 throw→빌드 실패. 현재 전부 통과). 결제(Toss V2 잠금)/카카오 OAuth/라이브는 lazy 라 SSR 시 Suspense fallback(평가 안 됨).

**현재 Lighthouse 측정값** (SSR 배포 전):
- Performance 44-66 (측정 변동 큼)
- LCP 8-11s (메인 페이지)
- TBT 300-1000ms
- CLS 0-0.188

**SSR 적용 후 목표**:
- Performance 85-92
- LCP 0.5-1.5s
- TBT/CLS 유지

---


## ✅ 2026-05-27 — 로딩 최적화 2차 (critical path -31%, 14 commits)

### 사용자 보고 → 처리
1. "전반적 로딩 길다, 공구 느림" → 폴링 / countdown / SSR 카테고리 prewarm
2. "/user/profile 1개 → /my-vouchers 0개" → voucher cache invalidation 영구 fix
3. "트래픽 절감 + 속도 가장 이상적으로" → chunk Phase 1-5 + image proxy 확장
4. "비용 0 원칙" → 모든 변경 무료 (D1/cf-image/KV write 한도 안)

### Critical path 변화
| 단계 | path | gzip |
|---|---|---|
| 초기 | ~1100 KB | ~330 KB |
| 최종 (`74bb925`) | **759 KB** | **228 KB** |
| **절감** | **-341 KB (-31%)** | **-102 KB (-31%)** |

### 14 commits
| # | hash | 효과 |
|---|---|---|
| 1 | `c4925af` | 공구 detail 폴링 + countdown adaptive |
| 2 | `daeb2c8` | voucher cache invalidation (사용자 보고 #2) |
| 3 | `cb8d0a5` | 카테고리 prewarm + Cache-Control 분리 + cf-image cache |
| 4 | `9de2840` | useMyCounts 통합 + Card.memo + SSR/cache 확장 |
| 5 | `21ab0fb` | 공구 detail below-fold lazy + unused import |
| 6 | `b8bd41d` | cf-image host 확장 + lazy rootMargin + VoucherMap lazy |
| 7 | `5583eed` | img-utils critical path -51KB + admin limits + audio singleton |
| 8 | `cbb08c8` | env-validator dynamic + admin/agency limits + 4 모달 lazy |
| 9 | `5e556a4` | env-validator chunk 분리 → validation -52KB lazy |
| 10 | `dfb11df` | Phase 1+2 chunk 분할 |
| 11 | `374ea9c`→`336a988` | Phase 3 FrameWrapper 사고 + rollback |
| 12 | `c1a42d7` | Phase 4 live hooks |
| 13 | `74bb925` | Phase 5 useCart/useSearch/useTokenAutoRefresh hoisted |

### 다음 우선순위
1. 사용자 액션 — Lighthouse 실측 (cloud 환경 403 차단)
2. 자동 main 머지 + 배포 확인 (Actions 탭)
3. 사용자 증가 대비:
   - C: SellerOrdersPage React Query (작업 중)
   - A: AdminOrdersPage 서버 페이지네이션 (큰 작업)
   - B: AdminPage SSE 마이그레이션 (인프라)
   - D: AgencyPage bundle endpoint

## 🎯 전략 (2026-05-28): 공동구매가 주력, 라이브커머스는 보조
- 우선순위·신규 투자는 **공동구매 플로우** 1순위. 역할/커미션/정산 SSOT = `docs/SERVICE_MODEL.md`.
- 정산 통합(§9): `creditUserCommission()` SSOT 추가됨 (현금/딜 1결정점). 추천 rail 통합은 payment.routes.ts 잠금 해제 후.

---

## ✅ 2026-05-27 세션 — 로딩/큐레이터/리뷰/운영 영구 fix (~50 commits)

### 1. 로딩 최적화 ($0 한도 도달) — CLAUDE.md "🔒 로딩 최적화 잠금" 추가
- KV write 일 3,744 → **0** (월 $2-5 → $0)
- `publicCache useKv: false` + CDN-Cache-Control 분리
- SSR inject **5페이지** (메인 / 공구상세 / 셀러 / vouchers / browse / curator)
- cron prewarm 5분 + 인기 셀러/상품/큐레이터 top 10 dynamic warm
- D1 partial composite index (10만 상품 O(log N))
- 이미지 변환 27+ 호스트 (firebase / pstatic / daumcdn / giftishow / kt) + Save-Data
- prefetch 4단계 (hover/touch/focus + viewport + speculation prerender)
- MainHomePage eager + idle prefetch 5탭
- preload mode mismatch 영구 제거
- `X-SSR-Status` + `Server-Timing` 헤더 (production 측정)
- `RestaurantMiniMap` IntersectionObserver lazy
- 공구 카드 shimmer skeleton

### 2. 큐레이터 모델 — 핵심 흐름 완성
- 일반 user 도 공개 페이지 (`/u/{handle}` — handle 자동 생성)
- KakaoAuthService same-email seller auto-link + repair-schema backfill
- BottomNav 4중 안전망 (seller_username / linked_seller / handle / seller_token JWT decode) + App.tsx idle warming
- 큐레이터 페이지 셀러 수준 (banner 업로드 / 인라인 편집 / grid-3 통계 / grid-2 CTA / 탭 4개 (홈/상품/식사권/정보) / sticky owner 배너 / 라이트-다크)
- PATCH `/api/curator/me/profile` (name / bio / profile_image / banner_url)
- 추천 링크 복사 → 자동 핀 추가 (idempotent)
- 핀 삭제 본인 view (group-hover ✕)
- 우하단 📌 담기 FAB (선물 버튼 아래, 1판매당 적립액 표시)

### 3. 자동 로그아웃 영구 fix
- `RouteGuards.isAdminLoggedIn / isUserLoggedIn` 토큰 존재만 검사
- KakaoCallback `user_type` 보존 (admin/agency 토큰 있을 때)
- `isLoggedInSync` 토큰만 검사 → `/my-vouchers` 빈 화면 영구 fix

### 4. 리뷰 시스템 영구 fix
- D1 트리거 v2: INSERT 즉시 `review_count` + `avg_rating` + **`sold_count = MAX(현재, review × 3)`**
- `autoSeedFakeReviews` soldMultiplier 3-5 random
- repair-schema backfill: `sold_count < review × 3` 자동 정정
- cron `maxBatch 200 → 1000` (시드 처리량 5배)
- BrowsePage / VouchersPage 카드 review=0 시 "신규" 표시

### 5. KT Alpha 마진 재계산
- `POST /api/admin/kt-alpha/recalc-prices` (사용자 결정)
- AdminKtAlphaPage "📊 일괄 재계산" 버튼

### 6. UI / UX
- PWA 팝업 분홍 네모 제거 + "🎁 앱 설치하면 환영 쿠폰!" (6언어)
- 교환권 default sort = `price_low`
- 카드 image fade-in + 카테고리 dominant color
- 셀러 placeholder name fallback (username)
- 공구 상세 SNS 버튼 4개 (인스타/유튜브/틱톡/페북) — 채팅/매너온도 X
- 큐레이터 라이트 테마 토글 지원
- 장바구니 썸네일 fix

### 7. 운영 통합
- `/api/admin/ops-status` — schema-repair / 활성 상품 / 24h 주문 / errors / KT Alpha 24h
- `/api/admin/csp-violations` — CSP 위반 패턴 분석
- `docs/OPS_RUNBOOK.md` — D1 Migration CI / Secret 회전 (다음 2026-10-27) / KV 모니터링 / 카카오 OAuth 체크리스트

### 8. 사고 영구 fix
- 공구 detail 500 (sns_tiktok 누락) → 3단계 graceful fallback SQL
- 링크샵 → /host/new fall through → email fallback + handle 자동 생성 + idle warming
- 핀 redirect 404 → URL suffix 제거
- 셀러 ↔ 큐레이터 self-affiliate 차단 검증 (이미 적용)

### 새 세션 진입 시 액션
1. `CLAUDE.md` 의 "🔒 로딩 최적화 잠금" 27개 항목 절대 변경 X
2. `docs/OPS_RUNBOOK.md` 사용자 액션 안내 (CI / Secret)
3. production 즉시 적용 안내:
   - `POST /api/_internal/repair-schema` — D1 트리거 + backfill
   - `POST /api/admin/reviews/auto-seed-missing {max_batch:1000}` — 별점 즉시 시드
   - `curl -sI https://live.ur-team.com/ | grep x-ssr-status` — SSR 검증

---

## ✅ 2026-05-25 — Phase 3+4 (호스팅 + 정산 + 셀러 승급) 완료

migration 0280 — 누구나 voucher 공구 호스팅 + 큐레이터 출금 UI.

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB + 정책 SSOT (HOSTING/WITHDRAWAL) | `04ce0a3b` |
| 2/5 | Worker API (hosting + 출금) | `236e1673` |
| 3/5 | Frontend 호스팅 페이지 3개 | `(Commit 3)` |
| 4/5 | 출금 UI + 셀러 승급 안내 | `23ffa387` |
| 5/5 | 가이드 + docs | (이 commit) |

**Phase 3**: /host (목록) / /host/new (카탈로그) / /g/:invite_code (친구) — 1탭 호스팅
**Phase 4**: /u/me/earnings 출금 모달 + 원천징수 3.3% + 누적 50만원+ 셀러 승급 안내

## ✅ 2026-05-25 — Phase 2 (배송 재설계) 완료

migration 0279 + tracker.delivery 무료 API + 외부 URL fallback + cron sync + CSV 일괄.

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB + 정책 SSOT + V2 배송비 함수 | `9d913840` |
| 2/5 | tracker.delivery + courier-codes + 5 endpoints | `(commit 2)` |
| 3/5 | order.routes V2 + 셀러 송장 carrier_code | `bb45dae6` |
| 4/5 | 인앱 추적 모달 + MyOrders 통합 | `74d945ba` |
| 5/5 | 어드민 CSV UI + 가이드 + docs | (이 commit) |

**3중 안전망**: tracker.delivery (무료) → 외부 URL fallback → cron 7일 추정
**지역별 배송비**: 제주 +3000, 도서산간 +5000 (`regional_shipping_fees` SSOT)
**12개 택배사**: CJ/한진/롯데/우체국/로젠/CU/GS/대신/일양/경동/천일/CWAY

## ✅ 2026-05-25 — Phase 1 (링크샵 + 큐레이터 + 1탭 핀) 완료

migration 0278 + worker API 13개 + 큐레이터 페이지 2개 + 핀 1탭 UX + 가이드 동기화.

| Commit | 영역 | hash |
|---|---|---|
| 1/5 | DB schema + 정책 SSOT | `97cd54b2` |
| 2/5 | Worker API + push + OG image | `060e0249` |
| 3/5 | Frontend 1-A 인프라 | `82ddc4a9` |
| 4/5 | Phase 1-B 핀 1탭 UX | `0f4824cd` |
| 5/5 | Phase 1-C+D 공유 + 가이드 | (이 commit) |

### 새 라우트
- `/u/:handle` (public, 다크 테마)
- `/u/me/earnings` (requireUser)
- `/u/:handle/p/:productId` (redirect)
- 13 worker endpoints under `/api/curator/*`

### ✅ 전체 신모델 인프라 완료 (2026-05-25)
- Phase 1 ~ 5 모두 완료
- Phase 6 (합배송) 인프라만 (`ENABLE_BUNDLING=false`)
- 정책 동적화 — 어드민이 9개 정책 코드 변경 없이 조정 가능 (`/admin/platform-settings`)
- 반품 carrier 정규화 + audit 통합

### 후속 PR 가능
- 합배송 UI 활성화 (Phase 6)
- 인스타 스토리 canvas 합성 (마케팅 UX)
- ja/zh/es/fr i18n 번역 (현재 한국어 stub)
- 반품 회수 송장 추적 UI


## 🚀 2026-05-25 — 비즈니스 모델 Pivot 컨셉 단계 진입

**사용자 결정 (2026-05-25 채팅)**: 라이브커머스 → "어드민 SSOT 카탈로그 + 모든 유저 큐레이터(링크샵) + 공구 호스팅 + 어필리에이트" trinity 로 전환.

- **컨셉 docs**: `docs/design/linkshop-pivot.md`
- **배송 재설계 docs**: `docs/design/shipping-redesign.md`

### 진행 순서
```
Phase 0 — MD/sourcing 사업 준비 (코드 외)
Phase 1 — 링크샵 + 큐레이터 핀 (코드 시작점)
Phase 2 — 배송 재설계 (별도 docs, A/B 결정 후 진행)
Phase 3 — 공구 호스팅 (정의 A/B 결정 필요)
Phase 4 — 어필리에이트 정산 (현행 0.5% 양방향 확장)
Phase 5 — 셀러 흡수 (Migration)
Phase 6 — 마케팅/UX 강화
```

### 옛 작업 처리
- Quick Action FAB: 신모델에서 "공구 호스팅 / 큐레이터 시작" 으로 재정의 — 옛 시안 (`quick-action-fab.md`) 은 신모델 흡수 예정
- 카카오 FAB: 그대로 보류 (`featureFlags.kakaoFab=false`)

## ⏳ 사용자 결정 대기 (Phase 1 시작 전 확정 필요)

### ✅ 2026-05-25 결정: A 채택 — voucher 공구 only
- 누구나 voucher 공구 호스팅 가능 (Phase 3)
- 실물 배송은 일반 쇼핑 (1인 주문) only — shipping-redesign §6 deprecated
- **추가 강조 요구사항** (사용자 명시):
  - 유저가 공개 페이지 (링크샵) 에 **상품 핀이 매우 쉬워야** — 모든 상품 카드에 1탭 핀 버튼
  - **수익이 즉시 보여야** — 큐레이터 대시보드 + 핀별 stats + 구매 즉시 push + 공유 simulator
  - linkshop-pivot.md Phase 1-B / 1-C / 1-D 신설

### linkshop-pivot.md 정책 (요약)
| 항목 | 권장 default |
|---|---|
| 공구 호스팅 정의 (Phase 3) | A vs B (위) |
| 어필리에이트 비율 | 현행 0.5% 양방향 유지 (큐레이터 단독 비율 별도?) |
| 공구 호스트 인센티브 | 마감 성공 시 거래액 1% 추가 |
| 큐레이터 → 셀러 승급 threshold | 누적 정산 50만원 (사업자등록 안내) |
| 자기 ref 자기 구매 | 정산 제외 + 적립 회수 |
| 기존 셀러 retention | 라이브권 + 큐레이터 흡수 + 기존 commission 유지 |
| 카탈로그 노출 정책 | 메인=어드민 큐레이션 / 검색=인기순 |
| 상품 등록 권한 | 100% 어드민 |

### shipping-redesign.md 정책 (요약, A 채택 시 §6 자동 삭제)
| 항목 | 권장 default |
|---|---|
| 제주 추가비 | +3,000원 |
| 도서산간 추가비 | +5,000원 |
| 공구 모집 미달 배송비 부담 (B 가설) | 플랫폼 |
| 공구 결제 시점 (B 가설) | 참여 시 즉시 결제 (현행) |
| 공구 일괄 발송 SLA (B 가설) | 마감 후 3영업일 |
| 택배사 추적 API | Phase 2 외부링크만 / Phase 6 스마트택배 |
| 합배송 도입 시점 | Phase 2-E (옵션) vs Phase 6 |

## 옛 보류 항목 (신모델로 흡수)
| 항목 | 처리 |
|---|---|
| Quick Action FAB — 비셀러 클릭 처리 | 신모델에서 모든 유저가 호스팅 가능 → 자연 해소. 옛 (a)(b)(c)(d) 분기 무의미 |
| Quick Action FAB — 노출/숨김 페이지 | Phase 6 에서 재정의 |
| 카카오 FAB 복원 시점 | Phase 6 |

## ✅ 2026-05-24 세션 — 교환권 flow 영구 fix + KT Alpha 진단

### Universal 자동 허위리뷰 시드 (공구/쇼핑/교환권 — commit 0cbd50a7)
- `src/worker/utils/auto-seed-fake-reviews.ts` SSOT util
- `src/worker/cron/auto-seed-reviews.ts` daily 18 UTC (max 200건)
- `POST /api/admin/reviews/auto-seed-missing` 즉시 백필
- 정책 B: `is_active=1` 만. idempotent.

### Q1+Q3+Q4 (commit 8a56bc90)
- Q3 P0: /my-vouchers 빈 화면 — repair-schema 5컬럼 등록 + 3단 fallback SELECT
- Q1: `/admin/voucher-transactions` + AdminPage 카드 + `GET /api/admin/vouchers/transactions`
- Q4 perf 50-150ms: Promise.all rates + RETURNING id + 통합 batch + 병렬 code gen

### KT Alpha 진단 (commit fdd79d8d, 3588f7b2)
- `GET /api/admin/kt-alpha/diagnose-order/:id`
- 진단 UI on `/admin/voucher-transactions` (모달 + 상단 input + 각 행 버튼)

### 카카오 phone 자동 저장 + 결제 phone 게이트 (commit 71d31067)
- KakaoUser.phoneNumber 매핑, normalizeKakaoPhone helper
- upsertUser INSERT/UPDATE 에 phone (UPDATE 는 COALESCE 보존)
- /join 딜 흐름: kt_alpha 상품 + phone 없으면 PHONE_REQUIRED → 클라 모달 + 동의 + auto-retry

### /admin/users (commit 3cf61d32)
- 페이지네이션 버그 fix + 정렬 (created_at/order_count/total_spent/review_count/name)
- 검색: 이름/이메일/전화번호 (하이픈 무관)
- 통계 컬럼 표시 + phone 미등록 빨간 표시

### 마지막 round (이번 commit)
- `kt_alpha_admin_seller_id` 어드민 UI input 추가 (필수 표시 + 설명)
- VoucherDetailPage phone 모달 — 개인정보보호법 동의 체크박스 + 보유기간
- MyVouchersPage — phone 미등록 안내 배너 (7일 dismiss)
- guide-seed-admin.ts — voucher-transactions / admin-users 가이드 2 섹션 추가

## ✅ 2026-05-22 세션 — 정책 중앙화 + 성능 + 부채 정리

### 정책 SSOT 1페이지화 (`src/shared/constants/policy.ts`)
- REFUND_POLICY (9) / COMMISSION_DEFAULTS (10) / TAX_POLICY (3) / TIME_CONSTANTS (7)
- WITHHOLDING_RATES 재내보내기 — 한 파일에서 모든 정책 접근
- 8.8% / 0.05 / 0.10 / 0.07 / 0.005 / Math.min(20, …) hardcode 모두 import 전환
  - `affiliate.routes.ts`, `admin-tools.routes.ts`, `ledger.ts`, `agency.routes.ts`,
    `group-buy.routes.ts`, `stays-public.routes.ts`, `payouts-generate.ts`
- 새 상수: `AFFILIATE_COMMISSION_PCT`, `REFERRAL_BONUS_BOTHSIDES_PCT`, `STAYS_COMMISSION_CAP_PCT`

### 정합성 (atomic refund)
- `disputes.routes.ts` auto-refund + admin approve → CAS + D1 `batch()` 패턴
  → voucher refunded 인데 user balance 미환불되는 ghost refund 방지

### Audit log 미들웨어
- `admin-payouts.routes.ts` 5 endpoint (generate / approve / sent / cancel / commission-rates)

### Observability
- `alerts.ts sendAlert` 옵션 `dedupSeconds` (default 300s) — RATE_LIMIT_KV
- `discord-alert.ts sendDiscordAlertDedup` — 같은 (title, severity) 5분 내 중복 차단
- swallow() 래퍼 적용 (financial path): group-buy 추천 보너스, marketing 인플 정산,
  review-bonus, disputes escalate, influencer-payout cron

### 홈 공구 로딩 perf (live.ur-team.com)
- `group-buy-public.routes.ts`: `SELECT p.*` → 명시적 16 컬럼 (~56% payload ↓)
- `migrations/0276`: partial composite index
  `idx_products_groupbuy_feed (category, group_buy_status, created_at DESC) WHERE is_active=1`
- `GroupBuyFeed.tsx`: useEffect+state → useQuery (탭 복귀 시 ~200ms ↓)
- `EmptyStateWithFallback`: 같은 queryKey 로 메인 캐시 hit (중복 fetch 제거)
- `GroupBuyFeedCard.tsx`: `cfImage` + `cfSrcSet` (200/400/600px WebP/AVIF) — 이미지 50-80% ↓

### A11y
- aria-label 추가: navigate(-1) back, X close (모달/필터/사이드), ShoppingCart 아이콘
- 14개 파일

### 8.8% 마이그레이션 (Phase 2 — 사용자 미루기 → 재개)
- `WITHHOLDING_RATES.other_income` 호출 마이그 (`points.routes.ts withdraw`,
  `seller-settlements.routes.ts voucher-redeem`)



## 🎯 2026-05-21 세션 — 5 Phase 정산 인프라 + UX 통합

### Phase A: Commission 출금 + 기초 인프라
- commission_withdrawals + 사용자/어드민 UI + 알림톡 + 회귀 테스트 9개
- YouTube 썸네일 자동 cron / 셀러 분석 강화 / KT Alpha progressive
- 교환권 결제 흐름 정상화 (토스 우회)

### Phase B: 자체 예약 캘린더 (뷰티/액티비티/건강/펫)
- product_booking_slots + appointment_bookings (atomic + UNIQUE INDEX)
- 9 endpoints + 3 UI (셀러 슬롯 / 셀러 예약 / 유저 내 예약)
- D-1 reminder cron + 결제 직후 prompt + 취소 자동 환불
- 회귀 테스트 10개

### Phase C: 통합 정산 인프라 (ledger 중심)
- ledger_entries 헬퍼 3개 + payouts 테이블 + 4 INDEX
- 6 admin endpoints + /admin/payouts 페이지 (2 탭)
- 주 1회 cron (월요일 00 UTC) — pending payouts 자동 생성
- voucher used → atomic ledger 3 entries (merchant + seller + platform)

### Phase D: AI 통합 (3개 AI 권장 모두 반영)
- 셀러 트래킹 링크 위젯 + SellerProductsPage / SellerMiniShopPage 노출
- 에이전시 commission 자동 분배 + 어드민 commission 비율 조정 UI
- 사장님 매직링크 발송 트리거 (AdminBusinessVerificationPage 버튼)
- 세금계산서 stub + 연말 정산 CSV 리포트
- 모든 voucher 카테고리 결제 정상화 (meal_voucher hardcode 제거)
- AdminPayoutsPage 4 탭 (ledger / payouts / 수수료율 / 연말 리포트)

### Phase D-2: Attribution + 가이드 + Smoke test (이번 commit)
- 셀러 트래킹 attribution (src/lib/seller-tracking.ts) — sessionStorage 24h
- BrowsePage / GroupBuyDetailPage / ProductDetailPage capture + ref 전달
- GET /api/ledger/my — 셀러/에이전시 본인 ledger 조회
- docs/ALIMTALK_TEMPLATES.md — Aligo 9 템플릿 등록 가이드
- scripts/smoke-test.sh — 15 endpoint 검증 (확장)

## ⚠️ 운영자 액션 (production 적용 — 코드 X)
1. **`/api/_internal/repair-schema` GET 호출** — 모든 신규 컬럼/테이블/INDEX 적용
2. **Aligo 템플릿 9개 등록** — `docs/ALIMTALK_TEMPLATES.md` 참조
3. **`/admin/payouts` 수수료율 첫 저장** — default 5/10/30 명시 저장
4. **smoke test 실행** — `ADMIN_TOKEN=xxx ./scripts/smoke-test.sh prod`
5. **KT Alpha 카테고리 자동 분류** — `/admin/kt-alpha` ⚡ 메가 버튼
6. **end-to-end 테스트** — voucher 결제 → 매장 QR 스캔 → ledger entry 3개 자동 생성 확인

## 🎯 영구 인프라 (1만~10만 매장 대응)
- ledger_entries 단일 source of truth (정산 / 환불 / 분쟁 모두 entries 로 추적)
- payouts 테이블 송금 audit trail (transaction_id 추적)
- 모든 검색/필터 INDEX 명시 (풀스캔 0)
- atomic CAS — voucher used + appointment booking race condition 0
- 멱등 ledger — voucher_id + event_type 중복 entry 0
- 매장당 1 에이전시 lock-in (admin reassign + 감사 로그)
- commission 비율 어드민 UI 조정 (즉시 적용)

## 🚨 2026-05-21 사고 + 영구 fix
### Incident 1: CSP style-src nonce → 화면 깨짐
- `src/worker/index.ts` 에 `style-src 'nonce-XXX'` 추가 → CSP3 가 unsafe-inline 무력화 → Tailwind/React inline style 전부 차단.
- **영구 fix**: nonce 제거 + `scripts/check-csp-style-nonce.sh` pre-commit hook + CLAUDE.md 금지 룰 명시 + docs/INCIDENTS.md 기록.

### Incident 2: /api/<feature>/admin/* admin_token 미부착 → 403
- `src/lib/api.ts` 가 `/api/admin/*` 만 admin_token 분기. `/api/referral-tree/admin/withdrawals` 호출 시 헤더 누락.
- **영구 fix**: `/^\/api\/[a-z0-9-]+\/admin(\/|$)/` 패턴 추가 + `src/tests/unit/api-admin-token-attach.test.ts` 6 케이스 회귀 테스트.

## 🆕 2026-05-21 세션 — Commission 출금 + UX 단순화 + 알림톡

### Commission 출금 시스템 신규 (커밋 `66bfe245`, `aa44c269`)
- 새 테이블 `commission_withdrawals` (계좌 정보 + status pending/approved/rejected)
- `referral_commissions` ALTER: `withdrawn_at` / `withdrawal_request_id` / `paid_out_at` 컬럼 추가 (production schema fix)
- 새 status: `withdrawal_requested` / `paid_out` (기존 pending/granted/withdrawn 외 확장)
- 신규 endpoints (`src/features/referral/api/referral-tree.routes.ts`):
  - `POST /api/referral-tree/withdrawals` 사용자 출금 신청 (10,000원 이상)
  - `GET  /api/referral-tree/withdrawals` 내 이력
  - `GET  /api/referral-tree/admin/withdrawals?status=pending|approved|rejected|all`
  - `PATCH /api/referral-tree/admin/withdrawals/:id/approve` (admin_memo 선택)
  - `PATCH /api/referral-tree/admin/withdrawals/:id/reject` (rejection_reason 필수)
- 신규 페이지:
  - `/my-commissions` — 사용자/셀러/에이전시 공통 commission 조회 + 출금 신청
  - `/admin/commission-withdrawals` — 어드민 송금완료/거절 처리
- 승인/거절 시 자동 알림톡 (수령자 type 별 phone 조회 + 계좌번호 마스킹)
  - template code: `commission_withdrawal_approved` / `commission_withdrawal_rejected`

### 셀러 정산 완료 알림톡 신규 (방금 추가)
- `POST /api/admin/settlement/execute` 대량 정산 직후 sellers.phone 으로 알림톡 발송
- template code: `seller_settlement_completed`
- 기존 dashboard notification 과 별개로 추가 — silent skip 보존

### YouTube 라이브 썸네일 자동 갱신 (5분 cron)
- 새 cron `src/worker/cron/youtube-thumbnail-refresh.ts`
- live 상태 + custom_thumbnail_url 없는 stream 의 cache-bust URL 매 cron 갱신
- 셀러 수동 호출 불필요

### 셀러 분석 페이지 2개 탭 추가 (`SellerAnalyticsPage`)
- 추천 Commission 탭 (granted/pending/paid_out + 상위 추천 고객 + 출금 신청 링크)
- 월별 입점 추이 탭 (최근 12개월 신규 상품 + 공구권 카운트)
- 신규 endpoints: `monthly-trend`, `referral-commissions/summary`

### 교환권 페이지 (vouchers) 성능 + UX
- KV 캐시 5분 + stale-while-revalidate 2분 (chip 로딩 지연 해결)
- N+1 → 단일 GROUP BY 쿼리
- 브랜드 아이콘 하단 "N종" 수 표시 제거 (사용자 요청)
- v3 다크 그라데이션 잔액 카드 + 6개 정렬 옵션

### 홈/브라우즈
- 공구 카드: gift_catalog 브랜드 fallback (참외 스타일)
- /browse 카테고리 가로 스크롤 이모지 아이콘 (사용자 선택)
- /browse 최근 본 상품에서 교환권 제외
- /cart 뒤로가기 무한 루프 영구 fix

### 리뷰 시스템
- 구매자 전용 리뷰 작성 (NOT_PURCHASED 403 toast)
- 리뷰 사진 첨부 (최대 5장, 5MB)

### 공구 개최 페이지 UX 단순화 (`SellerMealVoucherNewPage`)
- 기본값 자동: 마감 7일 후 / 만료 90일 후
- "고급 설정" 토글로 약관 + 단계별 할인 접기

### 회귀 테스트 (`tests/integration/commission-withdrawal-flow.test.ts`)
- 9개 신규 테스트 (인증/검증/권한/거절 사유)
- 전체 1782 tests 통과 (기존 1773 + 신규 9)

### Sitemap.xml 보강
- /vouchers + 6개 카테고리 명시
- /restaurant-map 추가

### 운영 가이드 4개 섹션 신규 (`guide-seed.ts`)
- admin: commission-withdrawals-admin
- seller: consignment-seller / introduction-commission
- agency: store-introduction

### ⚠️ 운영자 액션 필요 (production 적용 전)
1. **schema repair 호출** (필수)
   ```bash
   curl -X POST https://live.ur-team.com/api/_internal/repair-schema \
     -H "Authorization: Bearer <ADMIN_TOKEN>"
   ```
   (commission_withdrawals 테이블 + ALTER 컬럼 적용)
2. **Aligo 템플릿 등록**
   - `commission_withdrawal_approved` / `commission_withdrawal_rejected` / `seller_settlement_completed`
   - 등록 전까지 silent skip (운영 영향 0)
3. **CF Pages 배포 녹색 확인** → `live.ur-team.com/my-commissions` 401 응답 확인

## 🆕 2026-05-20 세션 — 셀러/사용자 사이드 종합 정리

### 셀러 사이드 (사용자 보고 이슈 영구 fix)
- `/api/seller/bundles 401` — `bundle.routes.ts:44` 가 `payload.id` 봤지만 토큰은 `seller_id`. 호환 fallback 추가.
- `/api/seller/analytics/reviews 500` — `FROM reviews` (실제 `product_reviews`) + `r.image_urls` (실제 `images`). 테이블/컬럼 영구 fix.
- `/seller/alimtalk` Toss 400 — V1 widget API → V2 `payment().requestPayment` (PointsChargePage 와 동일 패턴).
- 사이드바 "설정" → 메인페이지로 튕김 — `SellerProfileEditPage` 의 `?tab=` 없으면 `/profile/{slug}` redirect 제거.
- 사이드바 하단 버튼 스크롤 점프 — `ScrollToTop` 에 `state.preserveScroll: true` 옵트아웃 추가.
- 사업자등록증 업로드 UI (셀러 `/seller/business-info`) + 어드민 검증/반려 (`/admin/sellers` 상세 펼침).
- 셀러 공개페이지 owner 모드 sticky 안내 배너 + 항상 보이는 Pencil 아이콘.
- 큰 CTA 카드 그리드 (`PrimaryActions`) — 라이브/주문/상품등록/정산 4개 prominent.

### 사용자 사이드
- 본문 바로가기 a11y 링크 제거 (사용자 요청).
- Cart 판매종료 일괄 삭제 버튼 (`product_is_active === 0` 만 batch delete).
- 추천 수익 카드 코멘트 정정 (이미 항상 노출 중 — 적립 0 도 "시작하기" CTA).

### 어드민
- KT Alpha 카테고리 자동 분류 endpoint (`/admin/kt-alpha/categories/auto-classify`).
- 리뷰 대량 생성 / 정리 endpoints.
- 사업자등록증 검증 + 정산 계좌 정보 어드민 패널.

### 영구 패턴 정착
- 74개 누적 TS 에러 → 0개.
  - Hono `c.req.json<T>().catch(() => ({}))` → `T | {}` union 회피: `({} as T)` 명시 + 헬퍼 `src/shared/utils/parse-json-body.ts`.
  - `c.get('user'/'seller')` ContextVariableMap: `Hono<{ Bindings; Variables }>` 명시.
  - `caches.default`, `crypto.subtle.importKey(Uint8Array)`, `LIVE_STREAM` cast 등 영구 fix.
- 업로드 500 진단성 강화 — `INVALID_CONTENT_TYPE` / `MULTIPART_PARSE_FAILED` / `NO_FILE_FIELD` 에러 코드.
- ToastStore 시그니처 — `success(msg, { duration })` 지원.

### 검색 정확도
- 신규 migration `0275_fts5_trigram_korean.sql` — 한국어 trigram tokenizer.
- `ProductRepository.searchByText` 의 `JOIN fts.product_id` 버그 → `JOIN fts.rowid` 로 영구 fix (LIKE fallback 으로만 떨어지던 문제).
- `ProductService.getProducts` 가 search 있으면 FTS5 + bm25 ranking 자동 사용.

### Schema repair
- `/api/_internal/repair-schema` 에 0271 (`products.referral_enabled/rate`), 0272 (`sellers.can_broadcast`), 0273 (`search_logs`), 0274 (`user_withdrawals`) 추가. 한 번 호출로 production D1 동기화.

## ⏭️ 다음 작업 후보 (우선순위)
| 우선 | 항목 | 메모 |
|---|---|---|
| 🔴 | production smoke test | `/api/referral-tree/admin/withdrawals` + `/api/vouchers/categories` curl |
| 🟡 | KT alpha 자동 분류 production 1회 실행 | `/admin/kt-alpha` 메가버튼 |
| 🟡 | `/vouchers` 카테고리/브랜드 재검증 | 자동분류 실행 후 확인 |
| 🟡 | 라이브 시작 시 셀러 본인에게 알림톡 | 단골에게는 web push 가나 셀러 본인 미발송 |
| 🟢 | 공구 개최 페이지 추가 단순화 | 디자인 시안 필요 (현재 고급 설정 토글만 추가됨) |
| 🟢 | PC 반응형 검증 (남은 페이지) | 4 viewport |
| 🟢 | CSP unsafe-inline 줄이기 | 우리 코드만 (외부 iframe 제외) |
| 🟢 | YouTube 썸네일 콘솔 404 노이즈 | onError 처리는 됨, 로그는 못 막음 |
| 🟢 | PPT 슬라이드 디자인 | 지난 세션 outline → Claude Design 의뢰 |

### ✅ 완료된 항목 (2026-05-21)
- ~~공급자 (가게 사장님) 자체 onboarding UI~~ → `SellerRegisterSupplierPage.tsx` 이미 존재 (2026-05-20 신규)
- ~~새 기능 통합 테스트 (commission withdrawal)~~ → 9개 테스트 신규



## 📦 2026-05-19 세션 — KT Alpha (기프티쇼) B2B API 통합

**비사업자 셀러** 정산 대안 완성 — 적립금으로 KT Alpha 기프티쇼 상품권 받기.

| PR | Commit | 범위 |
|---|---|---|
| 1 | `d9302be3` | foundation — giftishow-api.ts utility + 0101 listGoods + 0111 getGoodsDetail |
| 2 | `d3bfd177` | 0201 getCouponInfo + 0202 cancelCoupon + 에러 매핑 일부 |
| 3 | `7958c88a` | 0203 resendCoupon + 0204 sendCoupon + 0301 getBizMoneyBalance + 에러 코드 40+ 매핑 |
| 4 | `d9805d6` | 어드민 페이지 (\`/admin/kt-alpha\`) + 카탈로그 sync cron + 셀러 voucher 발송 endpoint |
| 5 | `e5f66093` | 셀러 voucher 발송 모달 + 발송 이력 페이지 + 잔액 부족 자동 알림 |

### 신규 파일
- \`src/worker/utils/giftishow-api.ts\` — 7개 API (0101/0111/0102/0112/0201/0202/0203/0204/0301) + 에러 매핑
- \`src/features/admin/api/admin-kt-alpha.routes.ts\` — 어드민 5 endpoints
- \`src/pages/AdminKtAlphaPage.tsx\` — 어드민 설정/잔액/카탈로그 페이지
- \`src/pages/SellerVoucherOrdersPage.tsx\` — 셀러 발송 이력
- \`src/worker/cron/kt-alpha-catalog-sync.ts\` — 매일 03:00 UTC sync
- \`migrations/0264_kt_alpha_gift_catalog.sql\` — gift_catalog 테이블
- \`migrations/0265_kt_alpha_markup.sql\` — markup_pct, user_id, callback_no 설정

### 셀러 통합
- \`SellerSettlementsPage\` 에 VoucherRedeemModal 추가 — '🎁 상품권으로 받기' 버튼
- \`/api/seller/voucher-catalog\` — 활성 상품 + 마진 포함 가격
- \`/api/seller/voucher-redeem\` — 발송 + 적립금 차감 + voucher_orders 기록
- \`/api/seller/voucher-orders\` — 발송 이력 조회

### 자동 모니터링
- cron 매일 KT Alpha 0301 잔액 호출 → \`platform_settings.kt_alpha_biz_money_balance\` 저장
- 10만 원 이하 시 \`admin_dashboard_notifications\` 자동 추가 (24h 중복 방지)
- 잔액 0 시 즉시 차단 경고

### 운영 가이드 업데이트 (본 PR)
- 어드민 가이드: \`kt-alpha-admin\` + \`stay-voucher-admin\` 섹션 추가
- 셀러 가이드: \`seller-voucher-kt-alpha\` 섹션 추가

### 🔴 운영 측 액션 필요 (별도 작업 — 코드로 처리 불가)
1. **KT Alpha 상용 Key 신청** — \`/admin/kt-alpha\` 페이지 스크린샷 4종 첨부
2. **wrangler secret put** — KT_ALPHA_AUTH_CODE, KT_ALPHA_TOKEN_KEY, KT_ALPHA_AUTH_TOKEN
3. **Cloudflare Dashboard** — R2 bucket 'ur-live-media' 생성 + MEDIA_BUCKET binding
4. **D1 production** — migration 0264 + 0265 적용 (\`wrangler d1 execute\`)
5. **카탈로그 초기 sync** — 어드민 페이지 'Sync 지금 실행' 버튼 (수동 1회)

## 📦 2026-05-18 세션 누적 (대량 작업)

### 🏨 숙소 공구 (stay_voucher) 완전 구현 — 6 PRs

야놀자/Booking.com 수준 완전 구현. 5000+ 줄, 8 페이지, 30+ endpoints, 1 cron.

| PR | Commit | 범위 |
|---|---|---|
| 1 | `fab38759` | DB schema (8 tables) + Backend CRUD (28 endpoints) |
| 2 | `386f9006` | 셀러 UI — 등록/객실/캘린더 (3 페이지) |
| 3 | `0bcb647c` | 사용자 검색/상세/예약 (2 페이지) |
| 4 | `ba8c1e32` | 셀러 KPI (OCC/ADR/RevPAR) + 예약 처리 |
| 5 | `ad8fd93d` | 어드민/에이전시 모니터링 + 분쟁 처리 |
| 6 | `1317c7d3` | 알림 cron + 환불 자동화 + 리뷰 작성 |

신규 테이블 8종:
- `product_stay_info`, `product_stay_rooms`, `product_stay_calendar`
- `stay_bookings`, `stay_booking_reviews`, `stay_booking_status_log`
- `stay_property_amenities` (30개 시드)
- `orders` 에 stay_booking_id 등 4 컬럼 추가

신규 페이지: `/seller/stays`, `/seller/stays/new`, `/seller/stays/:id`,
`/seller/stays/bookings`, `/stays`, `/stays/:id`, `/my-stays`,
`/admin/stays`, `/agency/stays`

### 💳 사업자등록 게이팅 정산 시스템 (Phase 1)

- migration `0257_business_reg_gated_settlement.sql` — sellers 컬럼 + 4 신규 테이블
  (`seller_deal_balances`, `seller_deal_transactions`, `voucher_orders`, `tax_withholding_log`)
- POST /api/seller/settlements/request — verified 셀러만 (412 BUSINESS_REGISTRATION_REQUIRED)
- GET /api/seller/settlement-options — 3 방식 (cash/voucher/deal) + 검증 상태
- POST /api/seller/business-registration/submit — 셀러 제출
- PATCH /api/admin/sellers/:id/business-registration/verify — 어드민 검증
- SellerSettlementsPage 에 검증 상태 배너 + 모달

### 🎨 UI 개선 (다수)

- `ad953313`: Hero 카테고리 monochrome 통일 (촌스러운 컬러 배경 제거)
- `6e5fc29e`: 어드민 배너 제목 optional (이미지만으로 등록 가능)
- `c7fbc88b`: 메인 페이지 오프라인/온라인 대분류 헤더
- `47f2f029`: Group buy 카테고리 탭 6→4 통합
- `c4882404`: 셀러 대시보드 Mode-based IA (라이브/매장)
- `6408723d`: 에이전시 대시보드 Mode-based IA
- `b8be80db`: 셀러 대시보드 홈 Mode-specific KPI

### 🛠️ 어드민 도구

- `d91aaea2`: 라이브 모니터링 — 다시보기 일괄 삭제 (체크박스)
- `a04ce05b`: 라이브 모니터링 삭제 fix (deleted_at 필터)
- `f9d1cb2a`: 상품 관리 — 체크박스 일괄 삭제/활성/비활성
- `1b393d26`: 상품 관리 — 재고 인라인 편집 (색상 시각화)

### 📄 문서

- `a17e2e33`: 공동구매 서비스 회사소개서 (`docs/company-intro-group-buy.md`)
- 본 PR: production-schema.ts 업데이트 (8 stay tables + 4 settlement tables)

## ⏭️ 다음 우선순위 (시장 검증 후 별도 PR)

### 🔴 즉시 적용 필요 (DB)
1. **production D1 에 migration 0257 + 0258 적용**
   - 현재는 코드만 있고 production 스키마 미적용 가능성
   - `/api/_internal/repair-schema` 또는 wrangler d1 execute 로 적용
   - defensive ALTER TABLE 들이 첫 호출 시 자동 처리하지만 인덱스/시드는 별도

### 🟡 후속 PR (필요 시)
1. **결제 PG 환불 자동 트리거** — 토스 API 연동 (현재는 status='cancelled' 마킹만)
2. **카카오 알림톡 실제 발송** — D-1/D-day cron (현재 notifications INSERT only)
3. **객실 이미지 R2 업로드** — 현재 URL 입력만 가능
4. **다객실 한 결제** — 2 객실 동시 예약
5. ~~**KT Alpha 기프티쇼 통합**~~ — ✅ 2026-05-19 완료 (5 PRs, 위 섹션 참조)
6. **8.8% 원천징수 자동 계산** + 지급조서 export (어드민 CSV)

### 🟢 i18n 6개 언어 sync (낮은 우선순위)
새로 추가된 defaultValue 한국어 키들 (~50개+) 6 언어 sync:
- 숙소 공구 관련 라벨 (식사권/미용/숙소/기타 등)
- 사업자등록 정산 안내 텍스트
- KPI 라벨 (OCC/ADR/RevPAR)

### 🐛 사전 이슈 (별도 작업)
- `SellerTermsPage.tsx` — dark: variant 1건 (대시보드 정책 위반)
- `GroupBuyListPage.tsx:246` — TypeScript 경고 (사전 이슈)
- `TECHNICAL_DEBT.md` 의 NOT NULL INSERT 5건 (warn-only)

---


**미배포 (PC 머지 대기)**: `bf3b75e` (GroupBuyList/Search/Embed i18n)

## 📦 2026-05-15 (Round 2) — 공동구매 이상적 구현 (10개 영역)

10개 영역 모두 구현 완료 — 전용 detail page, 티어 할인, 마일스톤 알림, 이메일 영수증,
동적 OG 이미지, JSON-LD SEO, voucher map, 어드민 analytics, 엣지 케이스 가드.

### 신규 추가
- **`GroupBuyDetailPage` (`/group-buy/:id`)**: 카운트다운 ring, 티어 시각화, 참여자 아바타,
  셀러 카드, KakaoLink share, sticky bottom 결제. 6개 voucher 카테고리 전체 지원.
- **`/api/group-buy/products/:id/participants`**: 마스킹된 최근 참여자 20명.
- **`/api/group-buy/admin/analytics`**: 카테고리별 funnel, GMV top 10, 일별 추이 30일.
- **`/api/og/group-buy/:id`**: 동적 SVG OG 이미지 (1200x630), 진행률/할인율 포함.
- **`og-image.routes.ts`**: 신규 worker route, 1시간 edge cache.
- **티어 할인 시스템**: `products.group_buy_tiers` JSON, `vouchers.applied_discount_pct/applied_price`,
  `calcTierDiscount()` 헬퍼, SellerMealVoucherNewPage 에 토글 + 단계 입력 UI.
- **마일스톤 알림**: 50%/80%/1명 남음 hot push, atomic CAS dedup 컬럼 3개.
- **이메일 영수증**: Resend 로 voucher 코드 + 매장 정보 + 티어 할인 내역 HTML 메일.
- **VoucherMap**: MyVouchersPage 에 미사용 식사권 카카오 멀티 마커 지도 (lat/lng 응답에 추가).
- **AdminGroupBuyPage**: 모니터링/분석 탭 분리, 카테고리별 통계 + Top 10 + 일별 표.

### SEO 풀 적용
- `<SEO>` JSON-LD: Product + Offer + GeoCoordinates + BreadcrumbList + ItemList (목록 페이지)
- 동적 OG image (위 endpoint)
- KakaoShareButton 통합

### 엣지 가드
- POST /join: voucher_expiry ≤ group_buy_deadline 차단 (불가능 voucher 발급 방지)
- POST /join: status=expired/cancelled 명시적 차단
- DELETE /seller/products/:id: active 공구 + 참여자 1명+ 이면 409 (참여자 보호)
- ProductDetailPage: voucher 카테고리 6종 → /group-buy/:id 자동 redirect (URL 보존)

### 커밋 흐름
- `881c3f4b`: Round 1 (티어/마일스톤/이메일/detail/edge cases)
- 다음 commit: Round 2 (SEO/OG/voucher map/admin analytics)

라이브 서비스와 완전 독립 — OAuth verification 검토 영향 없음.

---

## 📦 2026-05-15 — 공동구매 6대 영역 런칭 준비 완료

OAuth verification 검토 (4-6주) 동안 공동구매 서비스를 정식 운영 가능 상태로 마무리.

### 변경 (`claude/check-live-commerce-flow-jgNs8`)
- **`/api/group-buy/join/:id`**: rate limit 5/min 추가 (동시 클릭 / 봇 방어, voucher 중복 발급 차단)
- **`/api/group-buy/admin/list`** (NEW): 어드민 전체 공구 조회 + status/filter (unsuccessful) 지원
- **`/api/group-buy/admin/force-refund/:productId`** (NEW): 어드민 강제 환불 + audit_logs + 참여자/셀러 알림
- **`AdminGroupBuyPage.tsx`** (NEW): `/admin/group-buy` — 모니터링 + 필터 + 강제 환불 버튼 UI
- **AdminLayout 메뉴** 추가: `공동구매` (Ticket icon, 거래 그룹)
- **scheduled-cleanup cron**: 미달성 자동 환불 시 셀러에게 dashboard notification + Alimtalk 발송 (best-effort)
- **`ProductDetailPage.handleBuyNow`**: voucher 카테고리 6종 감지 시 `/api/group-buy/join` 호출 (기존엔 일반 checkout 으로 빠져 group_buy_current 미증가 + voucher 미발급 버그). 딜 부족 시 `/points/charge` 안내 confirm.
- **운영 가이드**: `/admin/operations-guide` 의 "공동구매/타임딜 승인" 섹션에 어드민 도구 사용법 추가

### 핵심 진단 결과
공동구매 시스템은 백엔드 80% 완성 (atomic CAS, 자동 환불 cron, voucher 발급) — 차단 이슈는 단 2개:
1. ✅ ProductDetailPage 가 voucher 를 일반 checkout 으로 보내던 버그 (해결)
2. ✅ 어드민이 분쟁 환불 시 DB 직접 수정해야 하던 문제 (해결)

라이브 서비스와 완전 독립 (DB / 라우트 / 외부 의존성 모두 분리) — OAuth 검토 영향 없음.

## 📦 2026-05-12 후반 세션 — 4차 배포 (배포 대기)

### Batch 1 (`59a8cf2`) ✅ 배포 완료
- LiveRecapPage: 상품 클릭 `[object Object]` 버그 수정
- ReelCard: 종료 라이브 "LIVE" 배지 → "다시보기" 배지
- TopNav: YouTube 아이콘 `?sub_confirmation=1` + "구독" 레이블
- TopNav: 셀러 pill → 셀러 프로필 클릭 링크

### Batch 2 (`9ac922d`) ✅ 배포 완료
- ReelActionRail: tap target 40 → 44px (WCAG 2.5.5)
- ReelChatSheet: 백드롭 키보드 접근성 + 변수 `t` shadowing 수정
- ReelProductCard: 재입고 알림 상태 분리 (idle/requesting/requested/error)
- ReelCard: 시청 트래킹 leave fetch `keepalive: true`

### Batch 3 (`cb48a60`) ✅ 배포 완료
- ShortsPage: 음소거/닫기 버튼 32 → 44px + silent error → DEV 로깅
- AccountSettings: handleCheck setTimeout 누수 + cleanup + isMounted guard
- BlogDetail: 하드코딩 한글 → t()

### Batch 4 (`bf3b75e`) ⏳ PC 머지 대기
- GroupBuyListPage: 헤더/배너/탭/empty state/CTA/뱃지 ~14건 i18n
- SearchPage: 관련 키워드 헤딩 + 기본 6개 키워드 i18n
- EmbedLivePage: 폴백 메시지 i18n

### Batch 5 (`ae21e1b`) ⏳ PC 머지 대기
- ProductDetailPage: 옵션 가격, 최대 적립딜, 추천 링크, 리뷰/전체보기 → t()
- useLiveStreamWebSocket: 재연결 에러, 인앱 fallback toast, 메시지 전송 실패 → t()
  → 훅에 useTranslation 도입

### TD-014 i18n 점검 결과
- ✅ MainHomePage: 잔여 한글 모두 주석 — 클린
- ✅ ShortsPage: JSX 텍스트 모두 t() 처리됨
- ✅ LivePageV2: JSX 텍스트 모두 t() 처리됨
- ⏭️ PaymentFailPage: Toss 한국 전용 의도 (line 25) — skip
- ⏭️ KakaoLinkCallbackPage: 팝업 300ms 자동 닫힘 — 무영향
- ⏭️ Seller/Admin/Agency: 별도 TD-014 PR

### TD-024 점검 결과
- ✅ WebSocket 503 fallback: polling + 인앱 toast 안내
- ✅ postMessage origin: `window.location.origin` 명시
- ✅ IntersectionObserver: best entry by intersectionRatio (line 91-103)
- ✅ YouTube fallback iframe: handleVideoClick 에서 player destroy 후 native iframe
- ⚠️ 영상 재생 실패 잔여 — **실 프로덕션 브라우저 콘솔 로그 필요**
  - 검증: `/live/<id>` 진입 → DevTools Console → 셀러 라이브 시작 후 시청자 입장 시 에러 메시지 캡처

## 🔥 2026-05-12 배포 사고 + 해결

**증상**: `wrangler pages deploy` 시 "Disallowed operation called within global scope. ... generating random values are not allowed within global scope" 오류로 모든 신규 배포 실패. 프로덕션은 이전 배포본으로 정상 작동 중이었음.

**원인**: `src/lib/rate-limit.ts` 21~31줄이 모듈 최상위에서 `setInterval(...)` 호출 → CF Pages 런타임이 module init time async I/O 거부.

**해결** (PR #315 / `41e3587`): `setInterval` → lazy `maybeCleanup()` 패턴. 매 요청 처음에 호출, 1분 경과한 경우에만 실제 정리. global scope I/O 없음.

**재발 방지 룰**: Worker 코드 (`src/worker/`, `src/lib/`, `src/features/*/api/`) 에서 모듈 최상위 (function/class 밖) 에 다음 호출 절대 금지:
- `setInterval` / `setTimeout`
- `fetch` / `connect`
- `Math.random` / `crypto.getRandomValues` / `crypto.randomUUID`

검증: `grep -n "^setInterval\|^setTimeout\|^fetch(\|^Math\.random" dist/_worker.js` 결과 empty 여야 함.

새 세션 진입 시 이 문서를 먼저 읽고 이어서 작업할 것.

---

## ✅ 완료 (20차 배치, 2026-05-12)

### 🔒 보안 (10~19차)
| 내용 |
|---|
| security: 전체 셀러/어드민/스트림/에이전시 numeric param 검증 |
| security: 셀러/에이전시 쿠키 SameSite=Strict + 어드민 감사 로그 |
| fix: 프로덕션 ErrorBoundary 스택트레이스 노출 차단 |
| fix: DEV guards on worker + frontend console.log |
| fix: fake avg_rating 4.5 fallback 제거 |
| reliability: Toss 결제 circuit breaker 6개 경로 전체 + 15s timeout |

### 📦 성능 (11~17차)
- KV 캐시: products/streams/popular-search/sections (D1 읽기 80%↓)
- N+1 쿼리 제거 (live-notify-followers 15,000→1 read)
- YouTube chat 배치 INSERT + quota isolate 캐시
- Dead-letter queue 크론 (이메일/푸시 재시도)
- 자동 환불 크론 (만료 공동구매)

### 🧪 테스트 (20차) — 1,727개 100% 통과
- circuit-breaker, rate-limiter, safe-internal-path, validation 유닛 테스트
- payment-validation (금액 변조 방지, 상태전이, 멱등성)
- auth-guards (IDOR, RBAC, JWT 파싱)

### 📦 인프라/CI
- `scripts/deploy-staging.sh` + `deploy-production.sh` (5단계 체크리스트)
- `docs/CANARY_DEPLOY.md` — CF Pages Gradual Deployments 절차
- `tests/load/critical-paths.js` — k6 로드 테스트 (5개 시나리오)
- `scripts/check-npm-audit.sh` + pre-commit hook (high/critical 차단)
- `docs/SLA.md` — 결제 99.9%, RTO 30분, RPO 1시간 정의
- PR #310 머지 → main 배포 완료

---

## ⚠️ 사용자 액션 필요

1. **CF Pages 배포 확인**
   - https://dash.cloudflare.com → Pages → ur-live → 최신 빌드 확인
   - 성공 시: `live.ur-team.com/about` 접속 테스트

2. **repair-new-tables 호출** (admin_audit_log 테이블 생성)
   ```bash
   curl -X POST https://live.ur-team.com/api/_internal/repair-new-tables \
     -H "Authorization: Bearer <ADMIN_TOKEN>"
   ```

3. **GitHub Actions 수동 배포** (CF Pages 자동 연동 없으면)
   - GitHub → Actions → "Deploy to Cloudflare Pages" → Run workflow

4. **스테이징 환경** (선택)
   - CF Dashboard에서 `ur-live-staging` Pages 프로젝트 생성
   - 생성 후: `npm run deploy:staging`

---

## 📋 기술 부채 (남은 항목)

| 항목 | 심각도 | 설명 |
|---|---|---|
| DB 마이그레이션 CI | 🔴 | D1 권한 없음 → repair-schema 응급처치 |
| ur-live-global Workers 빌드 실패 | 🟡 | 글로벌(world.ur-team.com) 버전 — 한국 서비스 무관 |
| E2E Playwright 테스트 | 🟡 | 브라우저 환경 필요, CI에서 실행 |
| GitHub Actions 분 초과 | 🟡 | 매월 1일 리셋, 그 전엔 수동 배포 |
| 스테이징 환경 | 🟡 | 스크립트는 준비됨, CF 프로젝트 생성 필요 |

---

## 📋 다음 세션 시작 시 체크리스트

1. 이 파일 읽기
2. `git log --oneline origin/main -5` 확인
3. CF Pages 최신 배포 상태 확인
4. repair-new-tables 호출됐는지 확인
