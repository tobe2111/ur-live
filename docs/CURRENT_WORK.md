# 🚧 진행 중 작업

## ✅ 2026-06-17 — 대시보드 단일 세션 강제 (대표 결정: "단일 세션 강제로 하자", 범위 AskUserQuestion=대시보드 전체)
**목적**: 한 대시보드 계정 = 한 곳(기기/브라우저)만 로그인. 새 기기 로그인 시 기존 세션 자동 로그아웃. 외부 도매 동업자/어드민 **계정 공유·도용 방지**(최근 PIN/2FA 와 같은 맥락).
- **설계(iat 에포크 — payload 무변경)**: 모든 대시보드 토큰에 이미 있는 `iat` 활용. 신규 `dashboard_sessions(account_type, account_id, min_valid_iat)`. 로그인 시 `min_valid_iat=로그인 iat` 갱신 → 미들웨어/리프레시가 `토큰 iat < min_valid_iat` 면 401. **더 늦은 로그인이 이전 세션 무효화**. sid 를 전 payload 에 심는 방식 대비 변경면 최소.
- **신규 헬퍼** `worker/utils/dashboard-session.ts`: `startDashboardSession`(로그인 갱신)·`isDashboardSessionCurrent`(검증, 1초 skew). **전 함수 fail-open/soft** — D1 장애·레거시(iat 없음)·추적행 없음(롤아웃 전)·비대상역할·서브계정은 모두 통과(인증/로그인 안 깨짐).
- **범위(v1)**: admin / seller(=도매 사장, `/api/seller/login` 경유) / supplier. **제외**: agency(멀티 멤버)·wholesale 서브계정(`sub_account_id`) — 토큰 sub 가 부모ID라 시트별 키 필요(정상 동시 직원 오로그아웃 방지). 카카오 발급 셀러/에이전시 토큰도 v1 grandfather(잠금 kakao.routes 미변경). → **후속**: 멀티시트 per-seat 키 + 카카오 토큰.
- **미들웨어**(`auth.ts requireAuth`): Bearer/세션쿠키/SSR-forward 3경로 모두 검증(`SESSION_SUPERSEDED` 401). `optionalAuth` 는 제외(선택 인증에 401 부적절). **리프레시 차단**: admin/seller `/refresh` 가 옛 토큰 iat 검사 → 옛 기기가 refresh 로 우회 못 함(서브계정 제외). 로그인 6지점 `startDashboardSession` 1줄씩(admin/seller/supplier login+become/seller-registration). 쿠키 경로 위해 `session.ts SessionUser.iat` 추가.
- **클라 무변경**: 옛 기기 401→기존 refresh 실패→강제 로그아웃→`/{role}/login?error=session_expired`(기존 흐름이 그대로 처리). 메시지는 일반 "세션 만료"(향후 "다른 기기 로그인" 문구로 개선 가능).
- 검증: tsc 0 · `npm run build` 0 · 단위 87 통과(dashboard-session 9 신규) · schema-refs/sql-bind 0. ⚠️ 배포 후 실 staging 1회 권장(A 로그인→B 로그인→A 자동 로그아웃 확인).

## ✅ 2026-06-17 — 어드민 대시보드 라이브 스트림 관리: 체크박스 일괄 삭제 (사용자 요청)
**요청**: 어드민 대시보드 '라이브 스트림 관리' 테이블을 체크박스로 다중 선택 삭제.
- **구조적 발견**: 테이블이 public `/api/streams`(소프트삭제 `deleted_at` 미필터)에서 로드 → soft-delete(status='ended'+deleted_at)해도 행이 안 사라지던 구조(단건 삭제조차). 근본수정으로 **테이블 데이터 소스를 admin 전용 `/api/admin/streams` 로 전환 + 거기서 `deleted_at IS NULL` 필터**(저트래픽 admin 경로라 hot public 피드 무변경 — 회귀 0).
- **백엔드** (`admin-streams.routes.ts`): ① GET `/streams` 에 `deleted_at IS NULL` 필터 + `ensureStreamDeletedAt`(per-worker defensive ALTER) ② 신규 `DELETE /streams/bulk`(`/streams/:id` 보다 **먼저** 등록 — :id 캡처 방지) — ids 검증(>0, ≤100), 이미 삭제분 skip, live-monitor/bulk 와 동일 soft-delete 패턴(status='ended'+deleted_at, 매출/이력 보존). adminApp 의 requireAdmin+IP화이트리스트+audit 체인 상속.
- **프론트** (`StreamsTable.tsx`): 체크박스 열 + 전체선택(indeterminate) + 일괄삭제 액션 바(라이브 모니터 history 와 동일 UX). 선택은 컴포넌트 내부 상태, refetch 후 사라진 항목 자동 정리(useEffect prune). dark: variant 추가 0(대시보드 화이트 고정). (`AdminPage.tsx`): `bulkDeleteStreams` 핸들러(confirm→`DELETE /api/admin/streams/bulk`→성공 시 true 반환·refetch).
- 검증: tsc 0 · `npm run build`(client+SSR+prerender+worker+prepare) 0 · 대시보드 테마검사(내 파일 위반 0) · 스키마 참조 0.

## ✅ 2026-06-17 — 로그인 "계속 풀림" = 메인↔대시보드 듀얼 로그인 충돌 (사용자 신고 → 전수조사 후 근본수정)
**신고**: "로그인이 계속 풀린다 / 대시보드에 로그인하면 기존 메인 유저 로그인이 로그아웃되는 느낌." 전수조사 결과 **단일 키 `user_type` 의존 잔존 코드**가 근본원인 — RouteGuards/isLoggedInSync/UserProfilePage 는 이미 토큰 기반으로 고쳤으나 **401 인터셉터 + 소비자 페이지 10곳이 누락**(부분 수정).
- **메커니즘**: 한 브라우저에서 대시보드(셀러/어드민/에이전시)+소비자 동시 로그인 시 단일 키 `user_type` 이 'admin'/'seller' 로 덮임(`KakaoCallbackPage:69` admin/agency 토큰 있으면 'user' 미설정 + 대시보드 로그인이 직접 set). 그런데 `user_type === 'user'` 로 로그인을 판단하던 코드들이 멀쩡한 소비자 세션(user_id+쿠키)을 "로그아웃"으로 오인 → ① 즉시 체감(로그인 버튼/빈 화면) ② **실제 삭제**: `api.ts:597` 401 핸들러가 `isSessionCookieUser`(user_type==='user') false 면 **세션 헬스체크 보호를 건너뛰고** `clearAuthData('user')` 실행 → user_id+session_login 삭제.
- **수정(근본)**: 신규 SSOT `auth.ts hasConsumerSession()`(user_id || session_login || firebase_token — **user_type 비의존**, seller/admin 토큰 단독은 비포함=구매자 식별용). 적용: 🔴 `api.ts:597` 401 게이트(이거 하나로 실제 풀림 차단) + 🟠 소비자 페이지 10곳(Cart/Checkout/ProductDetail/CouponClaim/Register/Login/MyGroupBuys/UserGroupBuyCreate/InfluencerDashboard/Referral). 헬스 엔드포인트가 쿠키로 최종 판정하므로 비-소비자엔 무해(session:false→정상 정리).
- **의도적 제외**: `getLoginType`(호출자 0) · `App.tsx:344`(글로벌 Firebase init, 삭제 아님) · `auth-callback-bootstrap:169`(session:false 일 때만 삭제 — 무해, 401 경로가 reactively 처리).
- **회귀 테스트**: `auth-utils.test.ts` 에 hasConsumerSession 8케이스(듀얼 로그인 user_type=admin/seller 에도 true, seller/admin 토큰 단독은 false). 검증: tsc 0 · 단위 55/55 · `npm run build`(client+ssr+prerender+worker+prepare) exit 0.
- **후속(완전 이상적化 — 같은 클래스 2곳 추가 마감, 사용자 "이어서 진행")**: ① `auth.ts getUserId()`(async) 의 `user_type==='user'` 게이트 제거 — user_id 는 항상 소비자 id 라 user_type 무관하게 우선 반환(듀얼유저가 Firebase 로 빠져 소비자 id 를 못 받던 버그; getUserIdSync 와 일관). ② `ReelCard` 셀러 본인 방송 소유권 판정을 `user_type==='seller'` → `seller_token` 존재로(듀얼 셀러가 소비자로 마지막 로그인 시 본인 방송 컨트롤 상실 해소; id 비교 의미 보존 → non-셀러 false-positive 0). **의도적 유지**: `getUserNameSync`/`getUserEmail` role-dispatch(seller_name/admin_name)는 대시보드 표시에 필요 — 미변경(소비자 표시 nuance만, 세션 무관). BottomNav 는 이미 토큰/active_role 기반(무변경). 검증: tsc 0 · 인증 단위 90/90 · build exit 0.

## ✅ 2026-06-17 — A) 동네딜 상품 일괄 등록 도구 + B) 도매몰 머니로직 검증 (대표 "모두 진행, 순서대로")
**A. 동네딜 채우기 도구** (`admin-products.routes.ts` + `AdminDongnedealImportPage`): "총 0개"를 채울 수단. `/api/admin/dongnedeal/{stats,seed-demo(POST/DELETE),bulk-import}` — 동네딜 피드 형태(category meal/beauty/etc/general + is_active=1 + group_buy_status='active')로 products INSERT → 즉시 노출. CSV 한글 헤더(상품명/카테고리/판매가/정가/매장명/주소/이미지URL/설명) 행단위 검증·리포트, 카테고리 별칭 매핑, **숙소는 거부**(product_stay_info 필요 — 숙소 전용 등록). 데모 10종(slug `demo-deal-`, 멱등) + 정리. UI = 어드민 '🏪 오프라인 공구 › 동네딜 상품 등록'(/admin/dongnedeal-import), 현황카드(전체/노출/데모/카테고리별)+CSV. adminApp 글로벌 requireAdmin+RBAC. ⚠️ **실상품 데이터는 대표 준비 필요**(도구는 빠른 입력 수단).
**B. 도매몰 머니 검증**(병렬 에이전트 read-only 감사): **수식·테스트 전부 정상** — `splitWholesaleUnit`(제조사=max(원가,round(공급가×(1−수수료%))), 플랫폼=공급가−제조사, 합보존)·`distributorPriceFromRetail` 확인, **unit 130 tests pass**, **표시가=청구가=정산액 동일 보장**(단일 SSOT 동기계산), **환불 역전 멱등**(admin full + supplier line, productIds-scoped, margin_total 비례역전). 기본 수수료 10%(=제조사 90%). `WHOLESALE_SETTLEMENT_E2E.md` §4 보강(예치금 환원 명시·margin_total 감소 체크·부분환불 행). ⚠️ **남은 건 2가지 — (1) "플랫폼=공급가 10%" 모델이 대표 의도인지 1줄 확인, (2) staging 실결제 1회**(코드는 검증 완료, 외부망 차단이라 실결제는 권한자 실행).
- 검증: tsc 0 · client+worker build 0 · 테마·sql-bind·not-null·api-auth(경고는 기존 집계) 통과.

## ✅ 2026-06-17 — 숙소 인라인 회귀 자체수정 (사용자 "다른 문제 없을까?" → 감사로 발견)
**발견**: 직전에 숙소를 동네딜 그리드에 인라인 필터로 옮겼는데, **숙소 상품은 `products.price=0`(실가격은 객실 테이블 별도) + 위치·평점이 `product_stay_info` 별도 테이블**이라 그리드 카드론 **₩0·정보누락으로 깨짐**(seller-stays INSERT 확인). group_buy_status 기본값 'active'라 stays 가 피드에 들어와 '전체' 탭에도 ₩0 카드로 샐 수 있었음(잠재 선재버그 포함).
- **수정(올바른 방향)**: 숙소는 전용 `/stays`(=`/api/group-buy/stays/search`, product_stay_info join)에서만 표시. ① 숙소 탭/사이드바 → `/stays` 환원 ② `GroupBuyListPage` 클라 필터에 `stay_voucher` **그리드 전역 제외**(전체 포함 — ₩0 카드 누수 차단) ③ 인라인용 stay 카드 라우팅/뱃지/CTA·Calendar import 정리(clean revert) ④ **`/stays` 헤더에 동네딜 카테고리 칩 추가**(전체/맛집식사권/미용/숙소(active)/기타/일반상품) — 숙소가 "다른 카테고리처럼" 보이길 원한 최초 요구를 예약 흐름 깨지 않고 충족(내비 일관성).
- 일반 상품 피드 수정([UNLOCK_LOADING])·i18n·PC 바탕 다크는 그대로 유효. 검증: tsc 0 · build 0 · 테마·머니패턴 통과 · i18n 키 타 사용처 0(이모지 부작용 없음).

## ✅ 2026-06-17 — 동네딜 카테고리 마감재 4종 (사용자 "모두 다 이상적으로")
**배경**: 숙소 인라인화·일반상품 추가 후 "더 이상적으로?" → 4건 전부 진행.
- **#1 일반 상품 구조적 빈 카테고리 근본수정** (`group-buy-public.routes.ts`, [UNLOCK_LOADING]): general 이 `VOUCHER_CATEGORIES` 에 없어 항상 voucher 폴백 → 클라 필터에서 0개로 사라지던 버그. `category=general` 요청 시에만 `categories=['general']`. **기본 피드/캐시/SSR/Cache-Control 전부 불변**(general 전용 캐시키 신규). ※ "총 0개"의 나머지(맛집/미용/숙소)는 **실데이터 없음**(코드 정상) — 활성 group_buy 상품 등록 필요.
- **#2 숙소 카드 표식** (`GroupBuyListPage` GroupBuyGridCard): stay_voucher 카드에 '🏨 숙박' 뱃지(그룹 '달성' 대신). 카드 클릭은 이미 `/stays/:id`(예약).
- **#3 숙박 날짜검색 강조**: 숙소 필터 시 '날짜·인원 검색'(→/stays) CTA 를 outline→indigo 채움으로 부각(숙박은 날짜 검색이 핵심).
- **#4 i18n 정식 현지화**: 인페이지 카테고리 탭(`groupBuy.category*` flat, 이모지 포함)·사이드바(`category.general`)·`groupBuy.stayBadge` 6개 언어 — 기존 ja/zh 영어 placeholder('Restaurant Vouchers') + beauty/stay/etc 키 부재(전 언어 한글 폴백) 해소.
- 검증: tsc 0 · `npm run build` 0 · 테마검사 통과.

## ✅ 2026-06-17 — 숙소 카테고리 인라인화 + 일반 상품 카테고리 추가 (사용자 신고)
**신고**: ① `/stays` 숙소는 다른 동네딜 카테고리처럼 같은 그리드/탭으로 안 보이고 별도 페이지로 튐 ② PC 사이드바 CATEGORY 에 '일반 상품' 누락.
- **숙소 인라인화** (`GroupBuyListPage`): 숙소 탭의 `navigate('/stays')` 리다이렉트 제거 → 다른 카테고리처럼 `?category=stay_voucher` 로 동네딜 그리드 안에서 필터. 숙소는 products 테이블에 `category='stay_voucher'` 로 저장되므로 피드에 포함됨(확인). **예약 보존**: `GroupBuyGridCard` 가 stay_voucher 카드만 클릭 시 전용 `/stays/:id`(객실·날짜 예약)로 라우팅(나머지는 `/group-buy/:id`), prefetch 도 stay 제외. 날짜·인원 전용 검색은 숙소 필터 시 `/stays` 링크로 보존(가역).
- **사이드바** (`DesktopLiveSidebar`): 숙소 → `?category=stay_voucher`(인라인), **'일반 상품'(general) 카테고리 추가**(Package 아이콘). MENU '오프라인 공동구매' 활성 정규식에 general 포함(이중강조 방지).
- **i18n**: `category.general`(nested) + `groupBuy.stayDateSearch`(flat) 6개 언어. (i18next ignoreJSONStructure 로 nested/flat 모두 resolve 확인.)
- 검증: tsc 0 · `npm run build` 0 · 테마검사 통과.
## ✅ 2026-06-17 계정 보안 — 로그인 보안 PIN 강제 + 로그인 이력(IP) (대표 요청 "서로 계정 로그인 방지")
> ⚠️ 정정: 대표 결정으로 **앱 TOTP → 6자리 보안 PIN** 전환. 서버 PIN(`login_pin_hash`/`pin_required`/
> `must_set_pin`/`POST /api/admin/set-login-pin`, 단순PIN 차단). 프론트 PIN 정합(AdminLoginPage PIN 입력 ·
> AdminLayout `must_set_pin`→`/admin/set-pin` 게이트 · 신규 `AdminPinSetupPage`). 강제=super_admin+wholesale.
> 잠금복구 `GET /api/_internal/reset-pin`(슈퍼). 또: 새 관리자 추가 비번 규칙 완화(8자+/2종+, 대문자 강제 X —
> `validatePasswordComplexity({relaxed:true})`). 아래 원문(TOTP)은 히스토리.
**배경**: 도매 동업자 다수 → 계정 공유/도용 방지. 2FA(인증앱 TOTP)가 가장 강력 — 인프라(/api/2fa/* generic store=admins.totp_secret/totp_enabled, Admin2FASetupPage /admin/2fa)는 있었으나 **로그인 강제 미배선**.
- **2FA 강제 (도매 파트너 + 슈퍼)** — `admin.routes /login`: 비밀번호 OK 후 `admins.totp_enabled=1`이면 OTP 필수(미입력→`twofa_required` 토큰 미발급, 불일치→401). 강제 대상 역할인데 미등록이면 토큰 발급+`must_enroll_2fa`. **컬럼 미존재 catch→fail-safe(로그인 안 깨짐)**. 검증=utils/totp verifyTOTP(generic store와 RFC6238 호환 확인).
- **프론트**: AdminLoginPage OTP 입력 단계(`needOtp`/`twofa_required`) + `must_enroll_2fa`→`/admin/2fa` 강제 + AdminLayout 등록 게이트(미등록 시 다른 경로 진입→2FA 페이지 가둠, verify 성공 시 해제). Admin2FASetupPage verify 성공 시 게이트 해제+랜딩.
- **로그인 이력(IP)** — `/login` 성공 시 `admin_login_history`(admin_id/email/ip/UA) fail-soft INSERT(ensure WeakSet). 뷰어 `GET /api/admin/login-history`(슈퍼 전용 isSuperOnlyAdminPath) + `AdminLoginHistoryPage`(/admin/login-history, 시스템 nav). repair-schema 테이블 등록.
- **잠금 복구**: `GET /api/_internal/reset-2fa?email=`(슈퍼만) — 기기 분실 시 2FA 해제→재등록. + must_enroll 게이트라 첫 등록은 잠금 없음(토큰 발급+유도).
- ⚠️ **롤아웃**: 배포 후 대표님(super)부터 다음 로그인 시 2FA 등록 강제됨 — QR 스캔(Google Authenticator) + **secret 백업 권장**. 검증: tsc 0 · theme · client+worker build. ⚠️ 실 TOTP 라운드트립 staging 1회 권장.

## ✅ 2026-06-17 도매 전용 어드민 역할 `wholesale` (외부 동업자용 — 권한 분리, 앱 분리 X)
**배경**: 도매몰 동업자(외부 파트너)가 어드민 접근 필요 → 완전 분리 대신 **RBAC 도메인-한정 역할**(대표 "추천대로", 범위 "도매 전체 정산·머니 포함"). 별도 앱 복제 X(유지보수·보안 2배 회피) — 같은 코드, 역할로 격리.
- **SSOT `admin-roles.ts`**: `wholesale` 역할 신설(도메인-한정). 일반역할(ops/cs/finance=읽기 개방)과 달리 **읽기·쓰기 모두 도매 도메인만** — 유어딜 소비자 어드민 데이터 격리. `SCOPED_ROLE_DOMAINS`(prefixes: wholesale/partnership/distributor/supplier, exact: suppliers) + `isScopedAdminRole`/`scopedRoleCanAccess`. `canAdminRoleMutate` 가 scoped 위임.
- **미들웨어 `admin-rbac.ts`**: scoped 역할이면 super-only 차단 후 `scopedRoleCanAccess` 로 읽기·쓰기 동시 게이트(그 외 /api/admin/* 읽기도 403). `/api/admin-payouts/*`(payouts)·users·settlements·group-buy 등 전부 차단.
- **계정 발급**: `admin-accounts.routes` VALID_ROLES + `AdminAccountsPage` ROLE_OPTIONS 에 '도매 파트너' 추가(슈퍼가 발급). admins.role CHECK 없음(repair-schema) → 안전.
- **프론트**: AdminLayout 가 wholesale 역할에 **도매 3그룹(domain:'wholesale')만 노출** + 비-도매 경로 진입 시 `/admin/wholesale-overview` 리다이렉트(깨진 화면 방지). 로그인 랜딩도 도매 현황.
- 검증: tsc 0 · admin-roles 단위 12(scoped 4 신규) · client+worker build. 기존 super/admin 계정 무영향(신규 역할 계정 0). **다음(Phase 2): 처리자(누가 처리했는지) 표시 — 대표 요청.**

## ✅ 2026-06-17 — PC 좌측 사이드바 IA: '오프라인 공동구매(동네딜)' 정합 (사용자 신고, AskUserQuestion 확정)
**신고**: PC 사이드바 MENU 가 홈/공구/식사권인데 '공구'·'식사권' 둘 다 /group-buy 계열이라 혼란 + CATEGORY 가 '식사권' 하나뿐. 대표 확정(AskUserQuestion): **MENU 통합** + CATEGORY = 동네딜 정의.
- **MENU 통합** (`DesktopLiveSidebar.tsx`): '공구'(nav.groupBuy)+'식사권'(/meal-vouchers) → 단일 **'오프라인 공동구매'**(nav.offlineGroupBuy, MapPin, /group-buy). /live·/browse 항목은 플래그 숨김이나 가역 위해 보존.
- **CATEGORY = 동네딜 4종** (`GroupBuyListPage` 정의와 1:1): 맛집 식사권(/group-buy?category=meal_voucher)·미용(beauty_voucher)·숙소(/stays 전용)·기타(etc_voucher). CATEGORY 렌더를 NavBtn 재사용으로 단순화.
- **URL 단일 소스** (`GroupBuyListPage`): `?category=` → category 상태 동기화 useEffect 추가 + 인페이지 탭도 setSearchParams 갱신 → PC 사이드바(상주)에서 이미 /group-buy 에 머문 상태에서도 카테고리 전환 반영(+공유·뒤로가기). 인페이지 탭/지역필터와 무충돌(category param 있을 때만 적용·탭이 URL 기록).
- **i18n**: nav.offlineGroupBuy + category.{mealVoucher,beauty,stay,etc} 6개 언어 추가(기존 category.* 비어있던 것 정식화).
- 검증: tsc 0 · `npm run build` 0 · 테마검사 통과.

## ✅ 2026-06-17 — PC 프레임 바탕(gutter)이 다크 테마에서 흰색으로 남던 문제 (사용자 신고)
**신고**: PC(`/user/profile` 등)에서 다크 테마인데 프레임 양옆 바탕이 흰색. **원인**: PC 컨슈머 프레임(`.app-framed`, 430/720px 가운데 액자)의 양옆 바탕을 `body:has(.mobile-app-container.app-framed)` CSS 만으로 칠했음 → `:has()` 미지원 브라우저/스테일 캐시/캐스케이드 엣지에서 라이트 바탕(`#e9ebef`)이 남을 수 있음.
- **fix(결정적)**: `MobileAppLayout` 이 테마 store 의 `applied`('light'|'dark') 로 `<body>` 에 `app-frame-host`(+다크면 `app-frame-dark`) 클래스를 직접 토글 → `index.css` `body.app-frame-host[.app-frame-dark]` 규칙으로 바탕색 확정(다크=`#000`). 기존 `:has()` 규칙은 첫 페인트용으로 존치(2차).
- ⚠️ `:has()` 규칙과 body-class 규칙은 **반드시 분리**(comma 목록 금지) — `:has()` 미지원 브라우저가 목록 전체를 무효화하기 때문. PC(`min-width:1024px`)에서만 적용, 모바일/대시보드/도매몰/비디오 무영향.
- 검증: tsc 0 · `npm run build`(client+worker+prepare) 0 · 테마검사 통과 · 컴파일된 CSS 에 두 규칙 모두 존재 확인. **잠금 파일 무변경**(SSR inject/edge-cache 등).

## ✅ 2026-06-17 도매몰 채우기(일괄 등록) + 출시 준비 3트랙 + UTONG START 로고 벡터화
**배경**: 도매몰이 사실상 비어있음(공급상품 1개) → "채울 수단" 신설 + 출시 전 블로커 정리. 대표 "모두 다 진행".
- **(채우기) 어드민 CSV 일괄 등록** — `POST /api/admin/distributor/supply-bulk-import`(finance/admin/super, RBAC distributor 세그먼트). 제조사 self-serve bulk 와 동일 한글 CSV 포맷이되 **즉시 노출**(is_active=1, approved). supplier_id 없으면 직매입 제조사 find-or-create. 판매가 미입력 시 공급가×1.6 자동. 청크 batch + 행별 리포트 + audit log. UI `AdminWholesaleImportPage`(/admin/wholesale-import, nav '상품 일괄 등록') — 제조사 선택/직매입 자동 + CSV 붙여넣기·업로드·템플릿 + 결과표.
- **(Track 2 카탈로그) 데모 정리** — `GET /supply-stats`(전체/실/데모/노출/제조사 카운트) + 임포트 페이지에 현황 카드 + 데모(slug `demo-wholesale-%`) 정리/채우기 버튼(기존 seed/delete 엔드포인트 재사용). 실상품 등록 전 데모 분리.
- **(Track 1 머니 검증) staging E2E** — `docs/WHOLESALE_SETTLEMENT_E2E.md`(가격표시·정산분배·원가하한·환불역전·플러스구독·배송비 체크리스트 + 워크드 표) + `wholesale-settlement-scenarios.test.ts`(문서 숫자를 실코드로 잠금 — 드리프트 0). ⚠️ **line-14 플랫폼 모델(공급가의 10%) 대표 1줄 확인 + staging 결제 1회 필요**(머니 4건 미검증 잔존).
- **(Track 3 RBAC) 확인** — admin-rbac.ts 전역 미들웨어 이미 마운트(`/api/admin/*`)+테스트 존재. 신규 bulk-import 가 distributor(finance) 영역임을 admin-roles.test 에 잠금(ops/viewer 차단 검증).
- **(로고) UTONG START 벡터화** — `WholesaleLogo.tsx`: PNG `<img>` → **inline SVG/HTML 벡터**(네이비 U + 오렌지 상승 화살표 마크 + TONG 네이비/START 오렌지 italic). WholesaleWordmark 15곳 동시 반영, dark=네이비→흰색. 모든 height 선명. PNG 되돌림 경로(WHOLESALE_LOGO_SRC) 보존.
- 검증: tsc 0 · 단위 16(roles+commission+scenarios) · client+worker build · theme. **머니 로직 무변경**(가격/정산 SSOT 호출만, 신규 적립/차감 0).

## ✅ 2026-06-17 — 교환권 상세 페이지 리디자인 (Claude Design `Voucher - Final (A)`)
시안 = A·Refined Classic(6안 중 사용자 확정). 다크 네이비 CTA + 브랜드 옐로우(#FFCE00) 포인트, 미니멀 톤 유지. 대상 `VoucherDetailPage` (`/vouchers/:id`).
- **상품 카드 = 그라데이션 유지**(사용자 지시): 풀블리드 사진 → `radius:28px` 그라데이션 카드(`#F7F8FA→#EFF1F4`, 다크 변형) 위 상품 `object-contain`+drop-shadow. 이미지 없으면 그라데이션만.
- **정보 재구성**: 옐로우 카테고리 칩 + 상품명(23px) + 딜 가격(32px) + 구분선 + 정보행(유효기간/사용처/환불 불가) + "매장에서 바코드 제시 후 사용 가능" 사용 안내. 기존 "교환권 안내" 3행 카드 제거.
- **상품 상세(`description`)는 "매장에서 바코드 제시 후 사용 가능" 아래 배치**(사용자 지시).
- **보유 딜 + 교환 후 잔액 박스**(chat 요청): `useBalance()`(localStorage 0ms) — 로그인 시 노출, 부족 시 "딜 부족"(빨강). 다크 네이비 그라데이션 CTA + 수량 스테퍼(−는 1일 때 비활성).
- **미도입(실데이터 원칙)**: 시안의 `정가 ₩4,500` 취소선/`52% 할인`·`~2026.09.15` 만료일·옵션 서브타이틀 — 데이터 모델에 필드 없어 가짜 수치 금지. `voucher_expiry` 있으면 그대로 표시.
- **잠금/중요 로직 무변경**: `useInvalidateMyVouchers()`(발급 후), `__SSR_INITIAL_DETAIL__` SSR consume, idempotency_key, `INSUFFICIENT_POINTS`→충전, `PHONE_REQUIRED` 모달, 어필리에이트 track. 모든 토큰 `dark:` variant(토글 지원).
- 시안 archive: `docs/design/voucher-detail.md` + `voucher-detail-final-A.dc.html`. 검증: tsc 0 · `npm run build` 0 · 테마검사 통과.
- **`(KT Alpha B2B 정책)` 표기 근본 제거 (사용자 "근본적으로 진행")**: 과거 sync 가 `products.description` 에 박아둔 공급사 정책 괄호가 prod DB 행에 잔존(commit addbc2b 는 sync 코드만 수정 → 신규만 적용) → 같은 상품 재조회 시 계속 노출. ① 렌더 strip(`stripSupplierPolicy`, 방어선) ② **DB 정정**: 공용 helper `worker/utils/kt-alpha-cleanup.ts`(단일 REPLACE/TRIM UPDATE, 멱등, node:sqlite 로 검증) — admin-kt-alpha `POST /kt-alpha/cleanup-descriptions` + `run-all-backfills`(`descriptions_cleaned`) + AdminKtAlphaPage "🧹 설명 정책표기 정리" 버튼. ③ **자동 1회**: `kt-alpha-catalog-sync` cron(매일 03:00 UTC)에 one-time 플래그(`platform_settings.kt_alpha_desc_policy_cleanup_v1`) 가드로 헬퍼 1회 자동 실행 → 운영자 클릭 불필요(다음 sync tick 에 정정 후 플래그 set, 이후 skip). **운영자 액션 0.**
- **교환권 목록(`/vouchers`) 카드 = 상세와 같은 톤 (사용자 "같은 톤으로 진행")**: `VouchersPage` `VoucherCard` 를 dominant-color 풀틴트 카드 → **클린 화이트 카드(다크 토글 대응) + 은은한 그라데이션 이미지 영역 + 브랜드 옐로우(#FFCE00) 할인 배지 + 잉크 가격**. 홈(embedded)·`/vouchers` 가 모두 `dark:` variant 기반(MainHomePage 동일)이라 테마 안전 — 검증함. **잠금 전부 보존**(SSR consume·default sort price_low·img width/height/srcSet/lazy/fetchPriority·`dominant_color` 플레이스홀더+`reportDominantColor` 파이프라인·React.memo). dominant_color 는 풀카드 틴트 → 이미지 로딩 플레이스홀더로 역할만 축소(데이터/리포트 불변). skeleton 도 카드 모양 정합. 미사용 `cardGradient` import 제거. tsc 0 · build 0 · 테마검사 통과.

## ✅ 2026-06-16 어드민 활동로그(A) + 역할권한 강제(B)
- **(A)**: 뷰어/엔드포인트/자동기록 미들웨어/nav 전부 이미 존재 — 유일 결함 `admin_audit_logs` 테이블이 repair-schema 누락(prod 로그 유실) → 추가.
- **(B) RBAC**: SSOT `src/shared/admin-roles.ts` + 전역 `worker/middleware/admin-rbac.ts`(`/api/admin/*`,`/api/admin-payouts/*` Bearer role 디코드). super=전권/admin=운영전권/viewer=읽기전용/ops·cs·finance=도메인 변경만, 읽기 전역 허용. `/admins`·`/audit-logs`=슈퍼전용(2FA 제외). 프론트 admin_role 저장+nav 게이트+배지. 테스트 8. 신규역할 기존계정 0 → 무영향. ⚠️ prod admins CHECK 제약이 옛값이면 제한역할 생성 막힐 수 있음(에러 시 안전 재빌드).

## 🔴 2026-06-16 — 플랫폼 수수료율 어드민 조정 (정산 분배, 머니 크리티컬) — ⚠️ staging E2E 필수
대표 확정: "공급가에 플랫폼 마진 N%가 포함" (공급가 8,500 → 플랫폼 850 / 제조사 7,650).
- **신설 설정** `platform_settings.wholesale_platform_commission_pct`(기본 10, 0~90) — `/admin/distributor-grades` 에서 조정.
- **정산 분배 변경**(`wholesale-settlement.ts`): 제조사 정산 = `max(원가, round(공급가×(1−수수료%)))`(원가 이상 보장), 플랫폼 = 공급가 − 제조사. `splitWholesaleUnit()` SSOT + `loadPlatformCommissionPct()`. **기존엔 제조사=원가·플랫폼=스프레드 전체 → 이제 플랫폼=공급가의 N%(제조사가 90% 수령)**. ⚠️ 신규 주문 제조사 지급액 상승/플랫폼 마진 하락(의도).
- **주문 생성**(`wholesale.routes.ts`): supply_total = Σ제조사정산, margin_total = subtotal−supply_total(=Σ수수료). 정산 호출이 같은 요청 동기 실행 → comm% drift 없음. 환불 역전은 저장된 settlement supply/retail 사용 → 자동 정합.
- **어드민 UI**: AdminDistributorGradesPage 수수료율 입력(%) + 예시 안내. distributor-admin GET/PATCH `/auto-grade/settings` 에 platform_commission_pct 추가.
- 검증: tsc 0 · split 단위테스트 8 통과 · build · money/theme. **⚠️ staging 결제→정산 E2E 필수**(제조사 지급=공급가×90%·원가하한, 플랫폼=10%).
- ⚠️ 미해결 질문: 이 모델은 플랫폼 마진이 '스프레드 전체'→'공급가 10%'로 **하락**. 대표 의도 재확인 필요(공급가에 10% 포함 = 맞으면 그대로).

### 후속 대기 (사용자 요청 — 추천 후 승인 대기)
- **어드민 하위계정 권한 제한**: requireAdminRole() 인프라는 있으나 일부 엔드포인트(payouts/settlement)에만 적용 → 대부분 엔드포인트는 requireAdmin(아무 어드민이나 전권). 제한 역할(ops/cs/finance/viewer)을 실제 강제하려면 어드민 라우트 전반에 role 게이트 적용 필요(큰 작업).
- **어드민 활동 로그 뷰어**: writeAuditLog+audit_logs 인프라 존재(55개 호출). 뷰어 페이지(`/admin/audit-log`) + 커버리지 보강 제안.

## 🔴 2026-06-16 — 등급/마진 모델 전면 전환 (대표 확정, 머니 크리티컬) — ⚠️ staging E2E 필수
**모델 변경**: 등급 = 일반/프로/프리미엄(가칭). 마진 = **판매가(권장소비자가) 대비 보장마진** (일반 15% / 프로 30% / 프리미엄 38%).
- **공식 전환**(`distributor-pricing.ts`): (구) `공급가 = 원가 × (1+마크업)` → (신) **`공급가 = max(제조사원가, 판매가 × (1−보장마진%))`** (원가 하한=플랫폼 손실 차단). 신규 `distributorPriceFromRetail()`. `resolveDistributorPrice` 에 `retailPrice` 인자 추가. `DEFAULT_GRADE_MARGINS` A38/B30/C15/D8/OEM40/SPECIAL45.
- **전 호출부 retailPrice 배선**(wholesale.routes 12곳: 카탈로그 리스트/상세/홈/재주문/**주문청구**/미리보기/엑셀·CSV 내보내기/제안 + wholesale-board 찜 + distributor-admin 전등급 미리보기). 누락 시 일부 화면만 옛값=가격 불일치 → 전수 배선. SELECT 에 `p.price AS retail_price` 추가.
- **prod 데이터 마이그레이션**: `distributor_grades` 값 의미가 마크업→보장마진으로 flip → `ensureGrades` 에 1회 마이그레이션(flag `wholesale_grade_model_v2_20260616`): A38/B30/C15 + 라벨(프리미엄/프로/일반). 시드 기본값도 신모델.
- **명칭/구독료**: 플러스→**프로**, 프로 연 구독료 기본 **100만원**(was 99,000). GRADE_NAME/GradeSheet(마진 15/30/38)/PlusMembershipCard/cron 알림/어드민 라벨 전부 정합.
- **표시 마진**: `marginVsRetail()` 신설(판매가 대비) — 카드/상세 '마진 +N%(원가대비)' → '마진 N%(판매가대비)'.
- **정산 불변**: 제조사 = 원가(supply_price) 정산, 플랫폼 = 공급가−원가 스프레드(자연 ~10%). 정산 로직 무수정.
- 검증: tsc 0 · 전체 unit 2104 통과(pricing 14 재작성) · client+worker build · money/sql/theme 통과. **⚠️⚠️ 실 staging 결제 E2E 필수**(전 등급 표시가=청구가 일치, 원가 하한, 주문 차감) — 외부 검증 불가 환경이라 prod 반영 전 1회 필수.

### 후속 (2026-06-16, ①②③ 동시 진행)
- **① 판매가 필수화** — 제조사 상품 등록/수정 시 권장소비자가(판매가) 필수 + **공급가보다 높게**(폴백/동일가 차단). 서버 authoritative(POST `/products` + PATCH + price-change-request 전부 `<=supply` 400 `RETAIL_TOO_LOW`) + 클라(AddProductModal/PriceChangeModal required·검증). 신모델 마진 0 상품 생성 원천 차단.
- **② 운영 가이드 3종** — guide-seed-wholesale(공식 max(원가,판매가×(1−보장마진))+기본 38/30/15+프로 100만원), guide-seed-seller(등급 일반/프로/프리미엄+보장마진). auto-reference 재생성.
- **③ 문구 전수 정합** — 플러스→프로(wholesale-theme/Support/Dashboard/worker route/repair/distributor-admin), repair-schema `distributor_grades` 시드 신값/라벨(38/30/15·프리미엄/프로/일반), AdminDistributorGradesPage 공식 설명, 구독료 99,000→100만원 코멘트. (홈플러스=매장명 무관 유지)


## ✅ 2026-06-16 — 등급 Phase 2: 플러스 연 구독(예치금 결제) + 프리미엄 자동승급(기존) (②/4)
**모델**: 일반(C, 승인) / 플러스(B, 연 구독) / 프리미엄(A, 매출 자동). ⚠️ 도매몰 PG 미사용 — 구독료는 **예치금(계좌이체 충전 잔액)에서 차감**(Toss 아님).
- **프리미엄 자동승급은 이미 구현됨**(`handleWholesaleGradeEval`, BIZ-7 — GMV promote-only, 설정 가능, 주1회 cron + 어드민 트리거). Phase 2 신규 = 플러스 구독만.
- **신규 `wholesale-plus.routes.ts`** (`/api/wholesale/plus`): `GET /info`(구독료·잔액·등급·만료) + `POST /subscribe`(claim-before-charge: 행 CAS 선점 → `deductDeposit` 차감 → 실패 시 등급/만료 롤백 → 차감 원장 + 알림). 멱등(만료30일내만 1회 선점, 더블클릭/동시요청 이중차감 차단). 구독료 = `platform_settings.wholesale_plus_annual_fee`(기본 99,000).
- **만료 강등 cron** `lapseExpiredPlus`(wholesale-grade-eval 주간배치): `distributor_grade='B' AND plus_until < now` → 'C'. 구독만 plus_until 을 쓰므로 관리자/볼륨 B(plus_until=null)는 비대상. 가격 산식 불변(등급 컬럼만).
- **스키마**: `sellers.plus_until TEXT`(repair-schema + ensure). **UI**: `PlusMembershipCard`(대시보드) — 일반→구독 CTA / 플러스→만료·연장 / 프리미엄→안내. 예치금 부족 시 충전 유도.
- **운영 완성도 추가(같은 세션)**: ① 어드민 구독료 설정 UI(`distributor-admin /auto-grade/settings` 에 `plus_annual_fee` + `AdminDistributorGradesPage` 입력·등급모델 안내). ② 어드민 등급 라벨 매핑(A·프리미엄/B·플러스/C·일반 — 배정/임계/마진 테이블, `gradeLabel`+GRADE_NAME SSOT). ③ 만료 임박 알림 cron(`notifyExpiringPlus` — 14일내 1회, 20일 dedup). ④ GradeSheet 자가 구독 CTA(관리자 문의 → '플러스 구독하기'→대시보드).
- 검증: tsc 0 · client+worker build · money-pattern 통과. ⚠️ 실 staging E2E 1회 권장(차감·등급 반영·잔액부족 롤백). 남은 후속(사용자 입력 필요): 시드상품 정리(게이트 시 게스트 카탈로그 빔 — 결정 필요), 어드민 도매 nav IA 정리, ③ 드랍쉬핑(보류).

## ✅ 2026-06-16 — 상품별 배송비 표시 마감 (①/4)
- `/catalog/:id` 응답에 `product_shipping_fee`(상품별 배송비 meta) 추가 + `WholesaleProductPage` 정보리스트 '배송비' 행(상품별>정책>무료 + 무료배송 기준 안내). `PATCH /products/:id` 가 shipping_fee 수용(setSupplyMeta, meta-only 변경 허용). 체크아웃 computeSupplierShipping 과 동일 SSOT.

## ✅ 2026-06-16 — 도매몰 카탈로그 '상품 왔다갔다'(간헐적 빈 그리드) 영구 수정 (사용자 신고, prod-diag 실측)
**근본원인**(GitHub Actions prod-diag 측정 — 컨테이너 egress 차단이라 ground truth 수집): guest `/api/wholesale/catalog` 가 빈 결과(콜드 isolate/일시 pragma·D1 오류)를 만들면 ① 공유 캐시(CDN-Cache-Control max-age=300)에 빈 응답 저장 → 5분간 모두 빈 그리드 ② worker SSR 가 빈 배열을 initialData 주입 → guest 가 staleTime(60s) 동안 refetch 안 함 → 고착 ③ 클라 `.catch(()=>[])` 가 일시 오류를 '성공한 빈 결과'로 삼켜 재시도 없이 빈 그리드. isolate/캐시 상태별로 빈 결과가 들쭉날쭉 → '왔다갔다'.
- **서버**(`wholesale.routes.ts /catalog`): 빈 카탈로그(items=0)는 절대 공유 캐시 금지(`no-store`) — guest/등급/콜드 pragma 분기 전부. 비어있지 않은 기본 guest 응답만 SSR/prewarm 캐논 키(`/api/wholesale/catalog[?]`)에 명시적 `caches.default.put` → SSR 의 edge-read 가 매번 miss(self-fetch 261ms)하던 것 edge-hit(~4ms)로.
- **SSR 리더**(`wholesale-catalog/ssr.ts`): 빈 배열 페이로드는 '없음' 취급(length>0 일 때만 consume) → 빈 SSR 이면 클라가 정상 fetch 복구.
- **클라**(`WholesaleCatalogPage.tsx`): `.catch(()=>[])` 제거 + `retry:2` → 일시 오류 자동 재시도.
- **prod 검증**(배포 후 재측정): `x-ssr-status WHOLESALE:self-fetch-hit(261ms)` → `edge-hit(4ms)`, `/wholesale` TTFB 0.333s→**0.081s**, 카탈로그 API 2회 모두 non-empty. **Toss/금액/등급가 계산 무변경 · worker SSR inject 블록 무수정(잠금 보존)** — 캐시 정책·복구 경로만.

## ✅ 2026-06-16 — 도매몰 서브페이지·대시보드 시안 리디자인 (Claude Design `유통스타트 서브페이지/판매자·계정.dc.html`, opus)
**배경**: 네이비 #0C2454 + 오렌지 #FC5424 리브랜드 + UTONG START 로고(WholesaleWordmark) 통일 위에서, 서브페이지를 **장바구니부터 순차 리디자인**(사용자 "가장 이상적으로"). AskUserQuestion 확정: 비로그인 가격=가림 유지, 다크용 흰 로고 제작.
- **유통사 대시보드 마이페이지** (`WholesaleDashboardPage`): 다크 등급 hero → 라이트 인사+등급칩 + KPI 카드 4(보더·색상값·부제) + 주문내역 상태탭(전체/결제완료/배송중/구매확정) 테이블. 미사용 useWholesaleMall 제거.
- **관심상품** (`WholesaleWishlistPage`): 로고 브레드크럼 + 필터칩(전체/판매중/품절·중지) + 카드(권장가·등급 공급가·마진칩·장바구니). 백엔드 `/api/wholesale/wishlist` 가 `distributor_price` enrich(resolveDistributorPrice SSOT 재사용 — 원가/제조사 신원 비노출). `wholesale.routes` `loadGradeTable/loadSellerGrade` export.
- **견적함** (`WholesaleQuotesPage`): 제목/CTA + 상태칩(전체/진행중/완료) + 표(요청수량/희망단가/제시단가/상태) + 확장 상세행(수락/반려) + 요청 모달.
- **예치금 충전** (`WholesaleDepositPage`): navy 잔액카드(이번달 충전/사용) + 2단(좌 충전금액·계좌이체 전용안내 / 우 충전요약 sticky). 셸(사이드바) 유지·충전 로직 무변경.
- **고객센터** (`WholesaleSupportPage` 신규, `/wholesale/support`): navy 히어로(검색·키워드) + FAQ(카테고리/검색/아코디언 9문항) + 1:1 문의(→ 신고·제안 게시판) + 연락처(BUSINESS_INFO SSOT). CatalogHeader 고객센터 mailto→페이지.
- **공지·자료실** (`WholesaleBoardPage`): 헤더 로고 브레드크럼 정렬(탭/콘텐츠 불변).
- 검증: tsc 0 · client+worker build OK · 테마검사 통과. 남음: 위탁·무재고 채널연동(시안03)·제조사 입점관리(시안04=SupplierDashboard 셸 적용 완료) 점검, 우체국 계좌번호(푸터 bankNo) 수령 대기.

## ✅ 2026-06-15 — 회원 등급명(일반/플러스/프리미엄) + 상품별 배송비 (대표 요청, AskUserQuestion 확정)
**대표 모델**: 등급 = 일반(승인 가입)/플러스(연 구독)/프리미엄(일정 매출 달성). 배송비 = 상품 등록 시 입력. 확정(AskUserQuestion): ① 등급별 공급가 차등 ② 라벨+가격 매핑 먼저(구독결제·자동승급은 다음) ③ 상품별 배송비(체크아웃 상품별 우선·제조사 폴백).
- **등급 라벨 매핑(머니 엔진 무변경)** — `distributor-pricing` 코드 A/B/C 유지, 표시명만 `GRADE_NAME`(A=프리미엄 10%/B=플러스 15%/C=일반 20% 기본) 신설(`wholesale-theme.ts`). 소비자 표면 전부 치환: `GradeSheet`(3등급 사다리 + 가입형태별 안내 — 일반=승인/플러스=연구독/프리미엄=매출), `Dashboard`(배지 원→펠릿·"○○ 회원"), `CatalogHeader` 다크 유틸바("○○ 회원"). 마진율/엔진/`distributor_grades` DB/cron 전부 불변 → 머니 0 리스크. 구독 결제·매출 자동승급은 다음 단계.
- **상품별 배송비** — `AddProductModal` 에 배송비 입력(0=무료, 비우면 제조사 정책 폴백). 저장은 **products 컬럼 미증식**(`product_supply_meta` K-V, key `wholesale_shipping_fee`) — 예산제 룰 준수. `supplier-dashboard.routes` POST /products 가 `setSupplyMeta` 로 기록.
- **체크아웃 배선(하위호환)** — `wholesale.routes computeSupplierShipping` 에 라인별 `product_shipping_fee` 추가: 그룹(묶음배송) 배송비 = 라인별 유효배송비(상품별 우선·정책 폴백) **최댓값** 1회 청구. 주문(`/orders`)·미리보기 양쪽이 `getSupplyMeta` 로딩 후 라인에 첨부. **상품별 배송비가 하나도 없으면 max=정책배송비 → 현행 완전 동일**(역마진/무료배송 임계/min-order 게이트 불변). Toss 금액검증·CAS·예치금 차감 무변경.
- 검증: tsc 0 · client+worker build OK · 테마검사 통과. ⚠️ 실결제 staging E2E 1회 권장(배송비 합산 표시·청구 정합). 후속: 상품 상세에 배송비 표시, 상품 수정(PATCH) 폼에도 배송비, 어드민 등급 드롭다운 라벨(현 코드 A/B/C 표시 — 매핑 안내).

## ✅ 2026-06-15 — 도매몰 홈 시안 리디자인 (Claude Design 핸드오프 `유통스타트 도매몰.dc.html`)
**배경**: 사용자가 Claude Design 핸드오프 번들(tar→README+`.dc.html`+스크린샷+chat)을 전달, "참고해서 디자인 전면 수정 / 기존과 다른 부분 확인하며 이상적으로". chat 인텔: "AI 티" 원인 = ① 회색 상품박스 ② 의미없는 통계 슬롭 ③ 과한 라운드/회색 패널. 확정 = 셰브론 런치마크 + 신뢰 신호 전면 + #FF0033은 가격/CTA에만. 시안 범위 = 홈+로고.
- **디자인 토큰 시안 정렬** (`wholesale-theme.ts`): ink `#17181C→#15171C`, `inkPink #FF5C7A`(다크 위 액센트)·`trustBg #FAFBFC`·`line2 #E7E9ED`·`shHover` 추가. (WT는 도매 전 surface SSOT — 전역 정렬.)
- **셰브론 로고** (`WholesaleLogo.tsx` 신규): A1 솔리드 셰브론(배경 없음, path `M20 5 L33 30 L20 23 L7 30 Z`) + 유통스타트 Pretendard ExtraBold 자간 -5% + UTONGSTART 캡션. 헤더·푸터 적용(라운드 "유" 박스 폐기).
- **헤더 전면 재구성** (`CatalogHeader.tsx`): ① **다크 유틸바**(`#15171C` — 회원·등급·예치금·충전 / 게스트 로그인·가입) ② 잉크 2px 보더 검색 + 다크 버튼 ③ 우측 아이콘 **견적함/관심상품/장바구니**(처음이세요/제안신고/예치금 → 교체) ④ 카테고리 네비 라벨 정렬(브랜드관/월간베스트/신상품/**고마진특가(red)**/프리미엄전용관/위탁·드랍쉽), 공지·자료실은 유틸바로. **라우팅·검색 와이어링·megamenu·멀티몰 로직 보존.**
- **신뢰 신호 바** (`HomeSections.tsx TrustBar` 신규): 사업자 인증제/KCP 에스크로/전자세금계산서/무재고 위탁배송 4셀 — chat의 "통계 슬롭 → 검증가능 신뢰신호" 직접 반영. 홈 양 상태 노출.
- **2단 게스트 히어로** (`HeroSection.tsx`): 좌 다크 트러스트 히어로(2 CTA) + 우 추천 상품(공급가 비노출 도메인규칙 준수 → "가입하면 공개"). 로그인 사입자는 슬림 대시보드 유지.
- **제조사 입점 CTA** (`HomeSections.tsx SupplierCTA` 신규): 다크 그라데이션 배너(게스트 홈).
- **상품 카드 흰 카드化** (`cards.tsx`): dominant-color 그라데이션 카드 → **흰 카드 + 권장가 취소선/공급가 강조(19px)/마진%·MOQ 칩/add-circle**. **perf 전부 보존**(viewport prefetch IO·React.memo·dominant 백필·lazy/fetchPriority). 깨질 stock 이미지 0(실데이터/다크 그라데이션만).
- **기존과 다른 부분(사용자 요청 확인)**: 시안은 Unsplash 샘플·하드코딩 통계(1,240/38만)·"마감임박 04:12:39" 카운트다운 사용 → **실데이터 원칙**으로 통계/카운트다운 미도입, 공급가 게스트 비노출 규칙 적용(시안은 게스트에 ₩19,800 노출 — 도메인 위반이라 미반영). 카테고리 타일 8종·5열 큐레이션 그리드는 후속(현 기능 그리드+필터 유지).
- **잠금 보존**: SSR consume(`__SSR_INITIAL_WHOLESALE__`)·placeholderData·prefetch·lazy·memo·기본 catalog 요청 byte-identity 무변경. tsc 0 · client build OK(71.84KB) · 테마검사 통과.
- **후속 조정(사용자 요청 2건)**: ① 중복 기본 배너 placeholder 제거 — `WholesaleBannerCarousel` 0건 시 `null`(다크 히어로 2개 중복 해소, 트러스트 히어로가 메인 배너). 어드민 등록 배너 있으면 캐러셀 표시(기능 보존). ② 히어로·제조사 CTA 배경에 **시안 창고 사진 복원**(`WHOLESALE_HERO_IMG`, Unsplash, `onError`→다크 `#15171C` 폴백·CSP img-src https: 허용) — 앞서 '실데이터 원칙'으로 뺐던 '사진 미도입'을 사용자 "내가 준 파일대로" 요청으로 번복.
- **시안 큐레이션 추가(사용자 "똑같이" 요청)**: ① 카테고리 타일 8종(`CuratedSections.tsx CategoryTiles` — 클릭 시 cat 필터) ② "실시간 베스트" 탭+순위(1~5) 5열 그리드(`BestGrid`, `ProductCard` 에 `rank` 배지 prop 추가) ③ 메인 그리드 5열化 + 비로그인 기본 랜딩(`cleanHome`)에선 필터 사이드바/컨트롤 숨겨 풀폭(시안처럼) — 카테고리/검색 선택 시 노출. 베스트/신규 레일 → BestGrid 로 대체(HomeRails 는 재주문/전용공급만), BrandHero 제거(시안 미포함), 기본 라벨 "오늘의 도매 특가".
- **후속 백로그**: 상품상세/장바구니/결제/가입/마이/제조사입점 화면을 같은 시안 톤으로(chat "다음 단계"). 히어로 사진은 추후 자체 호스팅(R2) 검토(현재 Unsplash 핫링크).

## ✅ 2026-06-15 — sellers 컬럼 예산제 확장 (배포 로그 `sellers 100컬럼 = D1 한도 도달` 발견)
**배경**: REPAIR_SCHEMA_TOKEN 확인차 배포 로그 점검 중 자동복구 응답에 `sellers 컬럼 100개 — D1 결과셋 한도(100) 임박` 경고 발견 — 2026-06-10 교환권 상세 전사 500(products 컬럼 100 초과 → `SELECT p.*` 한도 초과)과 **동일 사고 클래스**. 조사 결과 즉시-500은 없음(sellers 100컬럼을 통째 반환하는 `SELECT s.*`/`SELECT * FROM sellers` 쿼리 부재 — seller 도메인 star-select 는 전부 타 테이블). **진짜 갭 = 예산제 CI(`check-products-column-budget.mjs`)가 products 만 감시, sellers 는 무감시** → 101번째 컬럼 추가 시 그때 터짐.
- **fix**: 예산 체크를 products+sellers **멀티테이블**로 일반화(파일 1회 스캔 캐시 + 테이블별 baseline). `scripts/sellers-column-baseline.json`(현 96 ALTER 컬럼) 신설 — 기존 컬럼 통과 + 신규 `ALTER TABLE sellers ADD COLUMN` 차단. verify.yml 호출 지점 무변경(같은 스크립트). CLAUDE.md 방어선 표 갱신.
- **검증**: 양 테이블 통과(exit 0) + 음성 테스트(임시 sellers 컬럼 → exit 1, 정확한 위치/대안 메시지) + cleanup 후 통과 확인.
- **남은 권고**: 향후 sellers 부가속성은 K-V 사이드테이블로(예산 escape hatch). 컬럼 DROP(트리밍)은 D1 위험 → 미실시(증식 차단이 우선).

## ✅ 2026-06-15 — 링크샵 적립 마감재 2종 (남은 비이상 — 멱등 UNIQUE + 핀별 순클릭/로그정리)
**배경**: 위 4종 후 "더 이상적으로?" 재질문 → 남은 비이상 4가지 제시, 대표가 전부 선택. 조사 결과 ②hold 전체 스트림은 **대부분 이미 성숙(hold) 보유**(influencer_attributions T+7 payout·supplier matureSettlements·agency 월정산) → 즉시-잔액 적립 + MAX(0) clawback 누수가 남은 건 `referral_commissions`(추천 트리, 별도 출금 서브시스템)뿐. stays 인플 적립은 `payment.routes`(잠금) 직접 INSERT 라 잔액 미적립(누수 아님). 따라서 이번 turn 은 안전·명확한 ①③ 구현, ② referral_commissions hold·④ 유저 현금화 정책은 대표 결정 후 별도 진행.
- **① 멱등 UNIQUE** (`affiliate-credit.ts`/`affiliate.routes.ts`/`repair-schema`): SELECT-후-INSERT(race) → `affiliate_earnings(referrer_id, order_id)` partial UNIQUE + `INSERT OR IGNORE`(changes===0=멱등 DUPLICATE, 잔액/알림 없음). 머니룰 #3 정합. 기존 중복 행 있으면 인덱스 생성 실패→repair 리포트(타 _pair 인덱스 컨벤션).
- **③ 핀별 순클릭 + 로그 retention** (`curator.routes`/`scheduled-cleanup`): `/me/pins/stats` 에 핀별 unique_clicks(ip+ua+일자 dedup) + purchases/earnings 환불 제외. `pin_click_logs` 180일 경과 삭제(chunk 5000, 집계 click_count 무영향).
- **② referral_commissions T+7 hold 확장** (대표 "확장 진행") — 추천 트리(친구추천) 적립도 즉시 'granted'+잔액 → **'pending'(보류, 잔액 미반영)**. ⚠️ status CHECK 가 'holding' 신규값 금지 → 'pending' 재사용(=UI '대기', affiliate hold 와 동의어). 신규 cron `matureReferralCommissions`(`referral-tree.routes`, scheduled.ts `referral-mature`)이 T+7(`affiliate_hold_days` 공유)+미환불 주문분을 pending→granted CAS 후 `adjustUserPoints` 적립(claim-before-credit). 환불 4경로(order-refund/returns/order.routes×2) pending→withdrawn 플립(잔액 회수 X). webhook.routes(잠금)는 미수정 — cron 주문-status 가드가 머니 누수 차단. grant 의 `pointCreditUpsertStatement`/`recordPointTransaction` 즉시기록 제거 → maturity 로 이연. 모든 소비처(seller-analytics/ledger/withdrawal)는 pending=대기로 정합(출금 granted만).
- **④ 유저 현금화 정책** = 대표 **A) 현행 유지(딜만)** 선택 → 코드 변경 없음.
- 검증: tsc 0 · status-constraint 0 · 전체 build.

## ✅ 2026-06-15 — 링크샵 추천 적립 "이상적 구조" 4종 (대표 승인 — 진단/라인별/T+7/순클릭 전부)
**배경**: 대표 질문 "링크샵 담기 시 각 유저 성과로 잘 찍히나? 쿠팡파트너스처럼?" → 감사 결과 기여모델(라스트클릭+24h쿠키)·적립무결성(멱등·환불역전·자기추천/IP차단)은 이미 이상적이나, **3가지가 비이상적**: (a) 멀티상품 주문 첫상품 기준 적립 (b) 확정 유예 없어 buy→사용/출금→환불 시 `MAX(0,…)` clamp 누수 (c) raw 클릭(새로고침/봇 포함). 대표가 `AskUserQuestion` 에서 4개 전부 선택(진단부터).
- **① 진단 엔드포인트** (read-only, requireAdmin) `GET /api/curator/admin/affiliate-diagnostic` — status분포/멀티상품 적립규모/환불-후-사용 프록시(환불적립+잔액0)/30일 클릭 부풀림/top큐레이터. 코드변경 전 ground truth.
- **② 라인별 귀속** `affiliate-credit.ts computeOrderCommission()` — order_items 의 referral_enabled 라인만 각 상품비율로 합산(배송비/비대상 제외). 기존 첫상품비율×주문총액 → 과/미적립 해소. order_items 부재 시 기존 fallback. 멱등(referrer+order) 불변.
- **③ T+7 확정 유예(hold)** — 신규 적립 `status='holding'` 로만 기록(잔액 미반영). `matureAffiliateEarnings` cron(daily 18:00)이 T+7(dynamic `affiliate_hold_days`)+미환불 주문분을 holding→granted CAS 후 잔액 적립(claim-before-credit + order status 가드=안전망). holding 은 출금 가용액 SUM 제외. **레거시 pending/NULL/granted 무영향(migration-safe)**. 환불 사이트 6곳 holding→refunded 플립(무회수): order-refund/returns/voucher-clawback(helpers)/stays×2/admin-stays. 대시보드 month_earnings(확정) vs pending_earnings(예정) 분리 + recent_earnings 에 status.
- **④ 순클릭/전환율** 대시보드 unique_clicks_30d(ip+ua+일자 dedup)+conversion_rate_30d. `CuratorEarningsPage` 30일적립(확정/+예정)·순클릭(전체 sub)·전환율(구매 sub)·내역 '적립예정' 배지.
- **잠금 영향 없음**: `payment.routes.ts`(잠금)는 기존 helper 호출만 — `creditAffiliateFromIntent` 시그니처 불변. `affiliate-credit.ts` 는 비잠금. **Toss confirm/금액검증/CAS 전부 무변경.**
- 검증: tsc 0 · 전체 build (client+worker+prepare) — push 전 확인. ⚠️ hold 는 행동변경(적립 7일 보류) — prod 반영 후 진단 엔드포인트로 holding/granted 추이 1회 확인 권장.

## ✅ 2026-06-15 — 도매몰 `/wholesale` 홈 정리 (사용자 신고 "난잡" — 전수조사 1차)
**배경**: 사용자가 `/wholesale` 카탈로그 홈이 난잡하다고 신고. 코드 해부 결과 로그인 사입자 기준 헤더 3단 + 본문 12~15블록(배너·대시보드·OEM·레일4·BulkOrder패널·그리드·BrandHero)이 적층. 근본원인 = *비로그인 마케팅 페이지*와 *로그인 빠른 카탈로그*를 한 화면에 전부 노출. 사용자 승인(4개 정리 전부 + 지금 구현).
- **로그인/비로그인 홈 분기 + 레일 4→2** (`HomeRails.tsx`): 베스트셀러·신규입고 레일을 `!loggedIn` 게이트 → 비로그인 방문자 발견용에만. 로그인 사입자는 개인화 레일(빠른 재주문·전용 공급)만 + 상단 네비 전용 페이지(/wholesale/best·/new)로 위임(중복 제거).
- **BrandHero 로그인 시 숨김** (`WholesaleCatalogPage.tsx`): 서비스 정체성 마케팅 카피는 `!loggedIn` 전환용에만(반복 노출 제거).
- **대량주문 엑셀 패널 접기**: 그리드 한가운데 상시 펼침 → 토글 버튼(`bulkOpen`, 기본 접힘). 파워유저 기능이 기본 둘러보기를 점령하던 혼잡 제거.
- **헤더 3단→2단(데스크톱)** (`CatalogHeader.tsx`): 유틸 링크(마이/장바구니/제조사/로그인/로그아웃)를 `UtilLinks` 컴포넌트로 추출, 데스크톱은 별도 유틸바 줄 제거하고 카테고리 네비 우측 빈 공간으로(`justify-between`), 모바일은 기존 유틸바 유지(`lg:hidden ↔ hidden lg:flex` — 중복 0).
- **'BEST PRODUCT'(영문) → '전체 상품'**: 그리드 기본 제목 정리(베스트는 네비/전용페이지로 일원화).
- **잠금 보존**: SSR consume(`__SSR_INITIAL_WHOLESALE__`)·placeholderData·prefetch·lazy·memo·기본 catalog 요청 byte-identity 전부 무변경. tsc 0 · client build OK · 테마검사 통과.
- **전수조사 잔여(후속 배치 백로그)**: 어드민 도매 nav 16항목 IA 비대(통합 허브 있음에도 이중 진입점)·패턴 이원화(table vs card, window.prompt vs modal, 컨테이너 폭 3종) / 제조사 주문화면 2개 중복(OrdersTab vs SupplierWholesaleOrdersPage)·정산 탭 5섹션 과밀·CatalogTab 버튼 6개+초록 이질색 / BulkPriceModal↔PriceChangeModal 중복·AddProductModal 필드17 과밀. (감사 보고서 확보 — 우선순위 청취 후 진행.)

## ✅ 2026-06-15 — 옵션1 1단계: 크리에이터=유저 분리 (대표 승인 "가장 이상적으로") — `88f39b77`
**결정**: 업주(공급) vs 인플루언서(홍보) 충돌 근본 해소. 인플루언서는 더 이상 "셀러"가 아니라 **로그인한 유저=크리에이터**. 셀러 대시보드 = 업주(매장) 전용. 크리에이터 = 메인 앱 내 콘솔(별도 로그인 X). 모델 = "크리에이터=순수 홍보자"(자기 상품 없음, 남 공구만 홍보; 자기 상품 팔면 업주 가입).
- **가입 분리** `JoinChoicePage`: 2갈래 — 🏪 매장 운영자(→/seller/register/supplier 가입) / 🎤 크리에이터·이용자(→/login, 별도 가입 X). 분홍 액센트 제거.
- **influencer 셀러등록 은퇴** `SellerRegisterBusinessPage`: 신규 가입 폼 대신 "크리에이터는 가입 불필요 — 로그인만" 안내 화면(기존 pending/active 셀러는 위에서 분기되어 무영향, 레거시 폼은 unreachable 보존).
- **크리에이터 콘솔** `CuratorEarningsPage`→ 헤더 '🎤 크리에이터 콘솔' + 상단 빠른진입(내 링크샵 `/u/:handle`·공구 호스팅 `/host`). 기존 수익/클릭·구매 분석/인기핀/일별차트/영입 매장/출금 전부 유지. **신규 URL `/creator`**(App.tsx, 메인 앱 내·requireUser), `/u/me/earnings` 하위호환 alias.
- **진입점**: 링크샵 owner 배너 "수익 보기"→"크리에이터 콘솔"(/creator), 마이 `CuratorEarningsCard`→/creator+분홍제거.
- 검증: tsc 0 · vitest 2081 green · 전체 build OK.
- **남은 단계(Phase 2)**: 팔로워(`/seller/followers`)·브랜드 메시지(`/seller/alimtalk`)는 셀러 스코프 백엔드라 user 스코프로 이전 필요 → 콘솔에 흡수. 기존 seller_type='influencer' 계정 옵트인 이전. 쿠폰/프로모코드는 크리에이터 미부여(결정). **사용자 직접**: Cloudflare Scrape Shield "Email Address Obfuscation" OFF.

## ✅ 2026-06-14 — 도매몰 컬렉션 페이지 분리 (사용자 요청)
- 카탈로그 단일 페이지의 5개 뷰(브랜드 전시관·월간 베스트·신상품·판매마진·프리미엄 전용관)를 **전용 라우트로 분리** — `WholesaleCatalogPage` 에 `mode` prop 추가, 같은 데이터/카드 로직 100% 재사용(중복 0).
- 라우트: `/wholesale/best|new|margin|premium|brands` (App.tsx, `key` 로 컬렉션 전환 시 강제 리마운트해 초기 정렬/필터 재적용). 매핑: best→sort=popular, new→newest, margin→discount, premium→premium=1, brands→브랜드 그리드.
- `collectionMode` 시 홈 전용 섹션(배너 캐러셀/HeroSection/HomeRails/하단 BrandHero) 숨기고 전용 타이틀+홈 버튼 + 해당 컬렉션 그리드만. **홈 `/wholesale` 은 기존 그대로(기본 경로 불변)**.
- CatalogHeader 네비가 setState → `navigate('/wholesale/...')` 로 변경, 활성 강조는 현재 경로 기준. margin/premium 은 회원 전용 게이트 유지(비로그인 로그인 유도).
- SEO: 컬렉션별 title/url 분기(`/wholesale/best` 등). utongstart 도매 path 게이팅은 `/wholesale/` prefix 라 자동 허용.
- tsc 0 · unit 2103 · build OK.

## ✅ 2026-06-14 — 대표 신고 대량 배치 (사용자 "바로 가장 이상적으로 모두 진행")
**크로스커팅 근본수정 (앞 세션 turn):**
- 🔴 **모든 대시보드 자동 로그아웃 근본수정** (`a0519ed0`): agency 만 refresh token/`/refresh` endpoint 부재 → access(30일) 만료 시 복구불가 강제로그아웃(Sentry "Agency 401: Token expired"). `POST /api/agency/refresh` 신설 + 이메일/카카오 로그인 refresh 발급·저장(login page/KakaoCallback/transfer cookie) + api.ts 의 agency→/admin/refresh 오라우팅 버그 수정.
- 🔴 **대시보드 좌측 카테고리 스크롤 최상단 복귀** (`809f4b18`): `usePersistScroll` 공용훅 — Admin/Agency nav 스크롤 sessionStorage 영속(SellerLayout 검증패턴 추출).
- 🔴 **대시보드 로딩 시 홈 깜빡임** (`3c0d239f` [LOADING_ADDITIVE]): #root 라이트 placeholder 를 seller/admin/agency surface 로 일반화.
- 🔴 **링크샵 프로필/배너 새로고침 시 사라짐** (`eded4998`): 소유자 본인조회는 edge 900s 캐시 우회(optionalAuth) — 익명은 캐시 불변.
- 🟢 콘텐츠 (`a628ef2e`): 개인정보 책임자 메일 jiwon·전화삭제 / 교환권 KT B2B 라벨 제거 / 마이 하단 중복 버전줄 삭제 / 빌드번호 YYYYMMDD.HHmm 정형화. cafe24 500→400 (`37b997dd`).
- 쇼핑 풀루프 (`2f06aff5`): G2 딜결제 성공화면 / G3 /points/pay 쿠폰·배송비 서버재계산 / G5 리뷰리워드 / G9 선택카트정리 / 반품 신청 UI.

**대량 백로그 (병렬 3배치):**
- **소비자 UI 분홍→검정 + 공구 상세 정돈 + 원가/판매가** (`9a54b776`): GroupBuyDetail 가격부(정가 취소선→판매가+할인%)·CTA·전 소비자 페이지 핑크 액센트 뉴트럴 치환. 잠금 심볼(SSR consume/memo/lazy/prefetch) 전부 보존.
- **어드민 페이지 재설계 6종** (`f86277f9`): orders 고객/상품 상세화 · products 교환권/쇼핑 세그먼트 분리 · voucher-orders 의미·범례 · blog `/blog/:slug` 링크 · accounts 6역할(super/admin/ops/cs/finance/viewer, requireAdminRole 정합) · 대시보드 "처리 대기" KPI 6종.
- **링크샵 첫진입 닉네임 + 마이 i18n + 어드민 좌측 신규이슈 배지** (`6c28a891`): @user{id} 기본핸들이면 1회 설정 모달(LinkshopOnboardModal) · 쿠폰/바우처 라벨 6언어 · 미읽음 알림 link→nav path 매칭 배지(60s 폴링).
- 검증: tsc 0 · vitest 2081 green · 전체 build(client+worker+prepare) OK.

**대시보드 공구 중심 재편 (사용자 승인 "가장 이상적인 방향" — 제안 ① 채택)** (`914a26a6`):
- **결정**: 인플루언서=셀러 대시보드 메인 / 에이전시 대시보드=여러 크리에이터·매장 관리 조직 전용(개인 인플루언서를 에이전시로 몰지 않음 — 에이전시 메뉴는 담당셀러/랭킹/팀멤버/계약 등 "남 관리"용이라 1인은 빈 화면).
- **셀러 SellerLayout**: 라이브 영구중단 후 live/store 모드토글 무의미 → `seller_type` 기반 분기로 전환. 크리에이터는 매장 POS(스캔/식사권 발행/proxy-products/숙소) nav 숨김(라우트는 보존), 매장은 큐레이터 그룹 숨김(기존 hideFor). 공구 핵심을 홈 다음 상단으로 정렬(크리에이터=큐레이터/호스팅, 매장=공구/숙소). **바운스 수정**: `/host`·`/u/me/earnings`(user 세션 의존)는 `user_id` 있을 때만 노출 — 카카오 셀러 정상, 이메일 셀러는 숨겨 /login 바운스 차단.
- **에이전시 AgencyLayout**: 이미 `LIVE_COMMERCE_SUSPENDED` 로 라이브 항목(라이브현황/방송캘린더/PK/매칭/부스팅) 자동 숨김 → 공동구매/숙소/주문/반품·담당셀러·영입 중심으로 이미 정리됨(추가 변경 불필요). 카카오 로그인 연동 동작 확인.
- 검증: tsc 0 · vitest 2081 green · 전체 build OK.

**사용자 직접 (코드 불가):** Cloudflare Scrape Shield "Email Address Obfuscation" OFF (CSP email-decode 차단 해소).

## ✅ 2026-06-13 — 도매몰 UX 6종 (사용자 신고 묶음, opus)
- **① 베스트/신규 분류 = 정상**(코드 확인): 베스트 `ORDER BY sold_count DESC, created_at DESC` · 신규 `ORDER BY created_at DESC`(wholesale.routes /home). 판매 데이터 0인 초기엔 둘이 같아 보이는 건 정상(베스트가 created_at 로 폴백) — 주문 쌓이면 분리됨. 코드 변경 없음.
- **② 상세이미지 멀티 업로더** `supplier-dashboard/MultiImageUpload.tsx`: 세로 긴 사진·**GIF 다수 원본 무압축** 업로드(클라 압축 X — GIF 애니/세로 디테일 보존), 10MB×10장, 순서 조정/삭제. AddProductModal 의 detail_images textarea 대체. supplier_token Bearer + multipart(supplierApi 는 JSON 전용이라 raw fetch). GIF/webp/png/jpg 는 서버(/api/upload/image)가 이미 허용.
- **③ BrandHero(서비스 정체성 카피) → 회사정보(푸터) 바로 위로 이동** (HeroSection 상단 제거 → 카탈로그 푸터 위). 상단은 대시보드/가입유도만.
- **④ 제안/신고 → 게시판 페이지화**: 카탈로그 헤더 제안/신고 아이콘이 모달 대신 `/wholesale/board?tab=report` 로 이동. (report 작성=유통회원 전용 폼 기존재.)
- **⑤ 게시판 권한/배송안내/이미지깨짐**: 글쓰기 권한 = 공지/자료실/**배송안내**는 운영자만(서버 VALID_BOARD_TYPE 에 'shipping' 추가 + admin 보드 페이지 타입 옵션 + create 게이트), 신고·제안만 유통회원. 배송안내 = 운영자 게시물 있으면 렌더(본문 이미지 URL 자동 세로 렌더 + onError 숨김), 없으면 기본 4단계 가이드(이미지 0 → 깨짐 0). archive 썸네일·다운로드 onError 방어.
- **⑥ 제조사 문의 채팅 버그 fix**: `openThreadByProduct` 가 실패를 삼키고 빈 목록만 떠서 채팅 불가처럼 보이던 것 → API 가 에러 사유 반환 + 위젯이 '연결 중'/'문의 불가 안내' 상태 표시. **근본**: 연결 제조사 없는 상품(데모/관리자 등록, supplier_id NULL — product 6 추정)은 `inquirable:false` 응답 → '제조사에 문의' 버튼 자체 숨김(신원 비공개 위해 boolean 만).
- 검증: tsc 0 · unit 2103 · build OK · i18n 5키×6언어.

## 🛒 2026-06-12 — 쿠팡 연동 + 역방향 임포트 (사용자 승인 "모두 이상적으로, 쿠팡도")
- **쿠팡 코어 `coupang-core.ts`** (dep 0): HMAC-SHA256 전자서명(Web Crypto, signed-date yyMMdd'T'HHmmss'Z' — node:crypto 참조구현 대조 테스트) + `coupang_connections`(owner_type 복합 UNIQUE, secret encryptAtRest) + 출고지/반품지(주소 포함) + **카테고리 자동 추천**(predict) + 카테고리 고시정보 메타 + 상품 등록 payload 빌더(필수 고시 '상세페이지 참조' 관행) + 내 상품 목록/상세. 경로는 `COUPANG_PATHS` 상수 집중 — ⚠️ **실계정(Wing 키) E2E 1회 필요**.
- **유통사 쿠팡 내보내기**: `/api/wholesale/coupang/*`(connect — 출고지 조회로 즉시 검증/status/disconnect/shipping-places/export — 역마진 차단·반품지 주소 서버 재조회로 변조 차단) + `CoupangExportModal`(연결 폼 내장 — 별도 페이지 없음, 카테고리 입력 불필요) + 상품 상세 버튼 2열(스마트스토어/쿠팡).
- **제조사 역방향 임포트 "내 스토어 상품 가져오기"**: naver_commerce_connections **owner_type 재구축**(supplier 지원 — 신생 테이블 self-heal, (owner_type,id) 복합 UNIQUE) + `/api/supplier/store/*`(naver·coupang connect/status/products/import) + `StoreImportModal`(채널 탭·전체선택·**공급률 % 일괄 적용**(공급가=판매가×율)·R2 이미지 미러 `mirrorImageToR2`(SSRF 가드 — pstatic/coupangcdn 허용 호스트만, 실패 시 원본 폴백)) + CatalogTab "내 스토어에서 가져오기" 버튼. 본인 계정 데이터만(공식 범위) — 입력 노가다 0, 상품 30개 목표 직격.
- i18n 9키×6언어 · 단위테스트 7(HMAC 대조·payload·고시정보) — 전체 2093 · tsc 0 · build OK.
- **운영**: 쿠팡 E2E = 사장님 Wing 키(Wing→판매자정보→추가판매정보→OPEN API)로 연결→내보내기 1회 (출고지/반품지 Wing 등록 선행). 드랍쉬핑(주문수집→자동발주→송장)은 양 채널 E2E 후 통합 허브로 한 번에.

## ✅ 2026-06-12 — 숙소·예약 결제 관문 B배치 6종 마감 (4차 감사, 사용자 승인 '모두 이상적') — commit `f525587a`
- **B-1 숙소 결제 단절(🔴M)**: CheckoutPage stay 분기(`/checkout?order_id=N&stay=1` → 신규 `StayCheckout` — `GET /api/group-buy/stays/orders/:id` 서버 주문요약, 클라 재계산 금지) → `/pay/widget`(잠금 TossWidgetPayPage **호출만**, Toss orderId=`STAY-{orders.id}` — 6자 최소 요건) → 신규 경량 `/stays/checkout-return` 페이지가 `/api/group-buy/stays/bookings/confirm` 호출(성공/오버부킹 409/실패 3분기). 서버 confirm 도 동일 `STAY-N` 으로 Toss 승인(기존 `String(id)` 는 6자 미달 — 프론트 호출자 0이라 안전 변경).
- **B-2 다객실 confirm 단일화(🟡M)**: stays-public confirm — 첫 booking 만 확정(나머지 30분 후 expired)→ `WHERE order_id=?` 전체 루프(booking 별 CAS pending→confirmed + date모드 달력 차감). 오버부킹 시 확보분 전체 롤백 + 자동환불 + 주문 전 booking 취소. 단건 루프=1 이라 기존 동작 불변.
- **B-3 voucher 숙소권 셀프취소 0원(🔴S)**: cancel 핸들러 — `sale_mode='voucher'` && 미사용 && 미만료 = 100% 환불(기존 check_in NULL→NaN→무조건 0원+영구무효). 사용/만료 후 0원 유지.
- **B-4 pending-bookings 키 불일치(🔴S)**: appointments.routes `/orders/:orderId/pending-bookings` — `WHERE id=? OR order_number=?` + 후속 쿼리 숫자 order.id (PaymentSuccess CTA 가 order_number 전달 → 항상 빈 배열이던 버그).
- **B-5 매장 예약 생성 UI(🔴M)**: MyAppointmentsPage — 신규 `GET /api/appointments/bookable`(본인 결제완료 booking_required 미예약 목록) → 예약 잡기 모달(날짜 → `/api/products/:id/available-slots` → 슬롯 → `POST /api/appointments/book`). `?from_payment=<id|order_number>` 자동 선택. i18n `myAppointments.*` 17키×6언어.
- **B-6 🟢**: 신규 cron `stay-checkout-transition.ts`(check_out+1일 경과 confirmed→checked_out, per-row CAS — 리뷰 게이트 해제) `0 9 * * *` 등록. `stay-reminder.ts` 에 `reminder_d1/dday_sent_at` dedup(WeakSet ensure + repair-schema 등록) — '0 9'+'0 0' 이중 트리거 하루 2회 중복 발송 차단.
- 검증: tsc 0 · vitest 2081 green · build OK. ⚠️ 숙소 실결제 E2E 1회 미실시(기존 백로그 #7 그대로 — staging 소액 결제→취소 권장).

## 📋 [최종 전수조사 4차 — 2026-06-12] 확정 갭 백로그 (쇼핑/숙소·예약·동네공구/어드민/인프라)
**전 영역 1회 이상 증거기반 검수 완료.** 인프라 S 5건은 즉시 수술됨(5ce2b6b4 — rate limit 3종/webhook_events 90일 정리/백업 silent skip→알림). 잔여 확정 갭(전부 파일:라인 근거 보고서 확보, 도매=타 세션 제외):

### A. 어드민 "버튼이 거짓말" 4종 (운영 직결)
| 심각도 | 갭 | 규모 |
|---|---|---|
| 🔴 | 반품 검수 4버튼 전부 403 — returns.routes approve/reject/inspect/refund 가 seller-only(:337,374,412,464), 어드민 토큰 거부 + reject body 키 불일치(reason↔rejection_reason) | M |
| 🔴 | 매장 검수(/admin/pending-sellers) 승인/거부 POST↔PATCH mismatch → 항상 실패 | S |
| 🔴 | 어드민 2FA 가 users 테이블에 저장/검증(twofa.routes:96, require-2fa:75) — admins 미반영·동일 id 유저 row 오염 + X-2FA-Code 클라 주입 0(활성 시 분쟁/강제환불 영구 403) | M |
| 🔴 | 카드 분쟁 승인 = 0원 환불 resolved(disputes:254 딜만 분기) + 금액 정가(p.price) 사용 | M |
| 🟡 | 전역검색 q 미소비(Users/Orders) · 감사로그 3중 분산(뷰어 1테이블만) · 유저 제재 죽은코드(users.status 컬럼 부재) · 에이전시 거절 무알림 · force-refund Toss 실패 무가시 외 🟢 다수 | S~M |

### B. 숙소·예약·동네공구 (결제 관문 단절)
| 심각도 | 갭 | 규모 |
|---|---|---|
| 🔴 | **숙소 결제 단절**: StayDetail→/checkout?order_id&stay=1 인데 CheckoutPage 가 stay 쿼리 미처리(빈카트 에러/타상품 결제), /stays/bookings/confirm 프론트 호출자 0 | M |
| 🔴 | **매장 예약(appointments) 생성 UI 부재** — /book·available-slots 호출자 0(백엔드 완비) + PaymentSuccess CTA 키 불일치(order_number↔id) | M+S |
| 🔴 | voucher 숙소권 셀프취소 = check_in NULL → 무조건 0원 + 영구 무효 | S |
| ~~🔴~~ ✅ | ~~커뮤니티공구 알림 딥링크 /:id/messages 404(라우트 없음+id↔invite_code) + 참여자 메시지 read 403~~ → **2026-06-12 수술 완료**: 신규 라우트 `/community-group-buy/:code/messages` + 경량 페이지(`CommunityGroupBuyMessagesPage`), 알림 링크 전부 invite_code 기반으로, `canAccessGroupMessages` 에 그룹 멤버 read+write 추가(단순 채팅 — 멤버는 보증금 당사자) | 완료 |
| ~~🟡~~ ✅(커뮤니티만) | 다객실 confirm 첫 booking 만 확정(나머지 30분 후 expired) · appointment 취소 전액환불+REFUNDED 플립만 — **잔존(타 항목)**. ~~커뮤니티 join UNIQUE 없음(이중차감 race) · 보증금 point_transactions 무장부 · admin status 'refunded' 플립 실환불 0~~ → **2026-06-12 수술 완료**: members UNIQUE(group_buy_id,user_id)+INSERT OR IGNORE claim→차감→실패 롤백(머니룰 #1·#3), 생성/참여 차감·라우트/cron 환불 4지점 point_transactions 원장(차감=community_deposit/환불=refund, balance_after 서브쿼리), total_donated 오용 제거, 생성 INSERT 실패 시 보증금 복원, status 'refunded' 플립 400 차단(/refund 가 SSOT), 환불 멱등을 claim-first 로(라우트×cron 동시 이중환불 차단), join→제안자 알림 | S~M |
| 🟢 | 숙소 노쇼/checked_out 자동전이 없음(리뷰 게이트 영구잠김) · stay-reminder dedup/시각 · base_price_holiday 미사용 · **confirmed 그룹 보증금 동결 — 정책 미정으로 보류(2026-06-12, 코드 주석 참조: community-group-buy.routes.ts /:id/refund. 현재 어드민은 confirmed 도 전액환불 가능 — 노쇼 패널티/부분동결 여부 사용자 결정 필요)** | S~M |

### C. 쇼핑 풀루프 (쇼핑탭 재공개 전 선결 — G1~G6)
| 심각도 | 갭 | 규모 |
|---|---|---|
| 🔴 | G1 주문 zod 가 할인 필드 strip → 쿠폰/공구할인/딜혼합/옵션가산/지역배송비 Toss 결제 전부 confirm 400(과금은 0 — fail-safe). 자동 쿠폰적용 탓에 쿠폰 보유자 일반결제도 실패 | M-L |
| 🔴 | G2 딜 전액결제 성공 → PaymentSuccess 가 에러 표시(paymentKey 없음) + 카트 미정리(재시도 이중차감 위험) | S |
| 🔴 | G3 /points/pay 차감액≠표시액(쿠폰 미반영·배송비 하드코딩·deal_only 에도 3000딜) | M |
| 🔴 | G4 반품 환불 시 deal_points 주문 딜 미환급 | S |
| 🔴 | G5 리뷰 리워드 약속 미지급(order_id 미전송→게이트 false) + 금액 문구 불일치 | S |
| 🔴 | G6 반품 신청 유저 입구 0(서버 루프 완성) | S-M |
| 🟡 | 카트 옵션변경 400 · 셀러 리뷰답글 비노출 · 선택구매 후 전체 카트삭제 · 쿠폰 결제전 소진 · /api/orders/refund DELIVERED 자가환불 열림 · 지역배송비 클라 미반영 | S~M |

### D. 인프라 잔여
| 심각도 | 갭 | 규모 |
|---|---|---|
| 🔴(사용자) | cron Workers 수동배포 드리프트 — Dashboard 에서 트리거 9개·최근 배포일 확인 + BACKUP_BUCKET 바인딩 실재 확인 | 확인 |
| 🟡 | ~~포인트 장부 누락(비충돌 7지점)~~ ✅ · 웹훅 멱등키 V2 status 미포함(잠금 — 승인要) · ~~FAILED 웹훅 cron~~ ✅(1단계 감시) · ~~safeError 5xx Sentry~~ ✅ · ~~agency 배치 내부실패 Discord~~ ✅ · ~~고아 라우트 4~~ ✅ — 2026-06-12 D배치 수술 (아래 ✅ 섹션) | S~M |
| 🟢 | ~~cache-warming.ts~~ ❌오탐(scheduled-cleanup 이 활성 import — 삭제 보류) · ~~debug 페이지 prod 노출~~ ✅ · ~~error-telemetry intake rate limit~~ ✅ | S |

### ✅ D배치 인프라 잔여 수술 완료 (2026-06-12, 사용자 승인 '모두 이상적')
- **D1 포인트 장부 수렴**: `worker/utils/point-ledger.ts` 신설 — `adjustUserPoints`(UPSERT+`balance>=?` CAS 가드 옵션+point_transactions balance_after 서브쿼리), `pointCreditUpsertStatement`(기존 DB.batch 원자성 합류용), `recordPointTransaction`(fail-soft — 레거시 type CHECK 잔존 환경에서 장부 실패가 돈 흐름을 절대 못 막음), `zeroOutUserPoints`. 비충돌 7지점 치환(금액/동작 불변, 장부만 추가): auto-settlement(만료 환불 — 기존 장부 0건 직접 확인), invite-reward, affiliate-credit, referral-tree(batch 원자성 보존+장부 후기록), seller-onboarding(+기존 total_used 컬럼 silent fail 제거), agency-self-events-tick(동일), delete-account(`account_deleted` 기록). order/returns/webhook/community 지점은 타 작업자 몫 — 미접촉. 단위테스트 10.
- **D2 safeError→Sentry**: 5xx 만 dynamic import `captureException` fire-and-forget (DSN 미설정 시 console 폴백 기존 동작).
- **D3 agency 배치 내부실패**: `scheduled.ts` 공용 `notifyCronFailure(env,name,err)`(safeCron Discord 패턴 재사용) — agency-cron-batch/weekly-batch 내부 `.catch(logError)` 18곳 치환.
- **D4 FAILED 웹훅 (1단계)**: `cron/webhook-failed-drain.ts` — `status='FAILED' AND retry_count<3` 매시간 감시 → Discord 요약(dedup 6h)+log. **한계(의도)**: 실제 재처리는 webhook.routes 잠금(비-export 핸들러) — 2단계는 잠금 해제 승인 후.
- **D5 고아 라우트 진입점 4**: /interest-list→ShoppingGroup 행, /user/affiliate→EarningsGroup 카드, /seller/proxy-products→SellerLayout nav(store), /agency/prospects→AgencyLayout nav. i18n 6키×6언어.
- **D6 🟢**: /toss-debug prod=requireAdmin 게이트(DEV 는 그대로 — 진단 도구 보존; /kakao-debug·/payment/demo 는 기게이트 확인), error-telemetry intake rateLimit 60/60s/IP(fail-open). **cache-warming.ts 삭제는 보류** — 재확인 결과 `scheduled-cleanup.ts:401` 이 활성 import(죽은 파일 아님, 오탐).


## ⚠️ 세션 분담 (2026-06-12 사용자 지시)
- **도매몰(wholesale/supplier/supply) 전 영역 = 별도 세션 전담** (= `claude/keen-cerf-ch0jm5` 세션 — 아래 06-12 도매 로그 전부 이 세션). 타 세션(claude/service-analysis-optimization-whpu0f 계열)은 **도매몰 외 구현만** — 도매 파일 수정 금지.
- 도매 관련 잔여 백로그(NTS 어드민 승인화면 표시 강화, 클레임 환불 딥링크, 장바구니 계정키 등)는 도매 세션 몫.

## ✅ 2026-06-12 — 도매 재점검 후속 개선 5종 (사용자 승인 "모두 가장 이상적으로")
**재점검 결론**: 배선 9영역 전부 정상, 검증 에이전트 결함 주장 6건 직접 재확인으로 기각(CHECK 마이그레이션=repair-schema 처리·/home 몰스코프=타 세션 수정·카탈로그 캐시 존재·상품 승인/가격변경/셀러 승인 통지 기존재·restock cron 배선됨). **알림 통찰**: 계정/상품/가격변경의 supplier 알림은 원래 있었으나 CHECK 버그로 증발 중이었음 — `/admin/health` 1회가 전부 살림.
**구현 5종**:
- 💰 **라인 단위 환불**: 제조사 환불 버튼이 라인에 있는데 동작은 내 전체 라인이던 것 → 서버 `item_ids` 부분집합(소유권은 supplier_id 쿼리가 보장) + `reverseSupplierOnWholesaleRefund` 에 **productIds 스코프**(일부 환불 시 과다 클로백 방지) + **Toss 멱등키에 라인 집합**(키 고정이면 2번째 부분취소가 dedupe 로 무시되는 미환불 사고 방지) + 예치금 원장 ref 라인 구분. 회귀 테스트 4(쿼리/바인드 순서).
- 🔔 **제조사 승인/거부 알림톡**: admin-suppliers PATCH 에 `sendSystemAlimtalk`(담당자>대표자>가입 phone, env 미설정 silent skip — 셀러 승인 패턴). ⚠️ Aligo 템플릿 `supplier_approved`/`supplier_rejected` 등록 필요(운영).
- 🗂️ **어드민 통합 승인 큐**: `/api/admin/wholesale-overview` 응답에 `queue`(유통/제조/상품/가격변경/입금/견적 6종 대기 수) + AdminWholesaleOverviewPage 상단 "오늘 처리할 것" 카드(딥링크 — 상품/가격은 `/admin/products` 검증 후 연결).
- 📊 **시장 신호 유통사 노출**: `GET /api/wholesale/market-signal`(로그인 유통사, 최저가+수요+시즌 — 기존 util 재사용) + 상품 상세 `MarketSignalCard`(lazy) — "시중 최저가 vs 내 공급가 → 마진 여력" 사입 확신 보조. 키 미설정 시 숨김.
- 🧭 **제조사 온보딩 마일스톤**: `/me`에 `milestones`(orders/settlements COUNT, additive) + OverviewTab "첫 정산까지" 5단계 체크(전부 달성 시 미표시). i18n 11키×6언어.
- 검증: tsc 0 · unit 2085(+4) · build OK. **Phase B 드랍쉬핑은 사용자 스마트스토어 E2E 통과 후 착수**(자동 발주=돈 — 연결 검증 선행).

## ✅ 2026-06-12 — 대량등록 엑셀 완전판 (사용자 요청 "엑셀로, 이상적으로")
- **실사용 사고 2개 근본 해결** (`lib/read-table-file.ts`, dep 0): ① Excel 기본 CSV 저장(CP949) 한글 깨짐 — `file.text()`(UTF-8 고정) → UTF-8(fatal) 실패 시 EUC-KR 자동 디코드 ② **.xlsx 직접 업로드** — zip(EOCD→central dir) 직접 파싱(STORED+DEFLATE/DecompressionStream) + sharedStrings/inlineStr → CSV 변환해 기존 서버 경로(parseCsv) **무변경** 통과. 적용 4곳: 제조사 대량등록·재고 가져오기·송장 일괄·유통사 대량주문(BulkOrderPanel). accept 에 .xlsx, 라벨 "엑셀/CSV".
- **양식**: `GET /products/bulk-template.xlsx`(buildXlsx 재사용 — 진짜 엑셀) 신설, CSV endpoint 존치. 템플릿 parity — 박스입수/주문배수/이미지URL 컬럼 + bulk 파서/INSERT 반영(단건 폼과 일치).
- **등록 진입점에 대량 옵션** (사용자 요청): AddProductModal 상단 배너 "여러 상품이면 엑셀로 한 번에" — 양식받기+업로드(공용 `bulk-upload.ts`, CatalogTab 과 동일 흐름·실패행 상세 토스트, 성공 시 모달 닫고 갱신). 사용자에게 양식 파일 전달 완료.
- 단위테스트 8(EUC-KR 디코드·colIndex·xlsx round-trip(buildXlsx fixture)·rowsToCsv·진입점). 전체 2079 통과 · tsc 0 · build OK. ⚠️ 실제 Excel 저장 .xlsx 1회 운영 확인 권장(fixture 는 STORED — 실파일은 DEFLATE 경로).
- 사용자 보고: NAVER_SEARCH_CLIENT_ID/SECRET Cloudflare 등록 완료 — **이 커밋 배포부터 최저가·수요신호 활성**.

## ✅ 2026-06-12 — 네이버 데이터랩 수요 신호 ②④ (사용자 승인 "2, 4 진행")
- **`worker/utils/naver-datalab.ts`** + `GET /api/supplier/demand-signal?q=&category=` + `supplier-dashboard/DemandSignal.tsx`(등록 폼 — 최저가 박스 아래): ② 쇼핑인사이트 카테고리 내 키워드 클릭 추이 6개월 → 상승🔺/하락🔻/보합─(±10% 임계) ④ 검색어트렌드 24개월 → 성수기 월 추출(월평균이 전체평균 125%+ 인 1~3개월) + "지금 성수기 🔥 / N개월 뒤 — 준비 적기" 라벨.
- **도매 카테고리 → 네이버쇼핑 1depth 매핑** 상수(food→50000006 식품 등 6종 — 외부 택소노미라 상수 OK).
- **쿼터 소진(일 1,000회) 자연 처리 (사용자 질문)**: 429/한도 에러 감지 → KST 자정까지 데이터랩 신규 호출 차단 + 신호 null → **UI 는 박스 자체를 안 그림**(에러 노출 0 — 보너스 정보 원칙). (키워드,카테고리) 12h 캐시 + 둘 다 실패 시 미캐시(복구 후 재충전). 키 미설정도 동일하게 숨김.
- i18n 5키×6언어 · 단위테스트 13(추이/시즌성/라벨/가드/매핑) · 전체 2071 통과 · tsc 0 · build OK.
- ⚠️ 실키 검증 필요: NAVER_SEARCH_CLIENT_ID/SECRET 등록 후 등록 폼에서 상품명 입력 1회 확인.

## ✅ 2026-06-12 — 가입 역할 선택 관문 + 네이버쇼핑 최저가 대조 (사용자 요청)
- **가입 역할 관문 `/wholesale/start`**: "판매사(유통회원) vs 제조사(공급회원)" 2카드 선택 화면(겸업 안내+로그인 링크). 카탈로그 헤더 '회원가입'이 유통 폼 직행하던 것 → 관문 경유(제조사 오진입 차단 — 수동 승인 체제라 역할 오류=검수 비용). 제조 가입 폼에 역방향 링크("판매하실 건가요? → 유통 가입") — 유통→제조 링크와 대칭화. 인트로 듀얼 CTA·역할 명시된 배너("유통회원 신청" 등)는 직행 유지(이미 역할 선택됨).
- **네이버쇼핑 최저가 대조** (`worker/utils/naver-shopping-price.ts` + `GET /api/supplier/naver-price-check` + `supplier-dashboard/NaverPriceCheck.tsx`): 제조사 등록/가격수정 폼에서 상품명 800ms 디바운스 → 시중 최저가 top3 + 비교 신호(공급가≥최저가 빨강 "유통사 마진 불가" / 미만 초록 "마진 여력 ₩X" / 권장가>최저가 주의). 검색 API(developers.naver.com — 커머스API 와 별개, 일 25,000회 무료), 동일 검색어 10분 캐시, rate limit 30/분. **키(NAVER_SEARCH_CLIENT_ID/SECRET) 미설정 시 UI 자동 숨김(fail-soft)** — ⬜ 사용자: developers.naver.com 앱 등록(검색 API) → Cloudflare Variables 2개 등록. i18n 7키×6언어, 단위테스트 6.

## 🛒 2026-06-12 — 네이버 커머스API Phase A: 유통사 스마트스토어 연동 (사용자 요청)
**모델**: 유통사가 커머스API센터에서 **자기 스토어 앱**(스토어당 1개, 무료) 발급 → ID/시크릿을 `/wholesale/naver` 에서 연결(서버가 **토큰 발급으로 즉시 검증** 후에만 저장 — `encryptAtRest` AES-GCM, DATA_ENCRYPTION_KEY). 솔루션(개발업체) 계정 모델은 네이버 심사 필요 — Phase B 검토.
- **코어 `naver-commerce-core.ts`**: bcrypt 전자서명(`${client_id}_${ts}` bcrypt(salt=secret)→base64, bcryptjs 기존 dep) + 토큰 캐시(3h, 만료 5분전 갱신) + 카테고리 전체목록 모듈캐시 1h(리프 검색) + 이미지 업로드(네이버는 자체 업로드 URL 만 허용) + 상품 payload 빌더(순수 — 단위테스트 7).
- **라우트 `/api/wholesale/naver/*`** (worker mount): connect(검증 후 저장)/status(마스킹 id)/disconnect/categories?q=/export. 유통회원(approved+is_distributor) 전용, viewer 403, rate limit. export: 공급상품 검증 + **역마진 차단**(판매가<공급원가 400) + 이미지 네이버 업로드 → `/v2/products` 등록 → `naver_product_exports` 이력(UNIQUE seller+product, 재내보내기 갱신).
- **UI**: `/wholesale/naver` 연동 페이지(발급 3단계 가이드+연결 폼+상태/해제) + 대시보드 빠른메뉴 '스마트스토어 연동' + 상품 상세 "스마트스토어로 내보내기"(lazy 모달 — 판매가/재고/배송비/AS연락처/카테고리 디바운스 검색, **예상 마진 실시간 표시**, 미연결 시 연동 페이지 유도).
- **⚠️ 미검증**: 실계정 E2E — 이 환경은 외부 egress 차단. 운영에서 스토어 앱 1개로 연결→내보내기 1회 검증 필요(에러는 네이버 invalidInputs 메시지 그대로 표면화되게 함). 원산지는 '04 상세설명 참조' 기본 — 식품 등 일부 카테고리는 네이버가 추가 필드를 요구할 수 있음(에러 메시지로 안내됨).
- **Phase B(다음)**: 주문 자동 수집 → 도매 자동 발주 → 송장 푸시(드랍쉬핑 완성), 재고 동기화, 솔루션 계정 전환.

## ✅ 2026-06-12 — 가입 자동승인 전면 폐지 → 수동 승인 (사용자 결정 "제조사든 유통사든 수동")
- **사실 확인**: 유통사(wholesale register/become-distributor)·제조사(supplier register/become)는 **원래부터 항상 pending(수동)** — NTS 자동승인 배선 없음. 실제 자동승인은 ① 일반 셀러 가입(background NTS 일치 → approved) ② 어드민 recheck-nts 버튼(검증+승인 동시) 2곳뿐이었음.
- **fix**: ① `seller-registration.routes.ts` — NTS 일치여도 status 전환 제거, `nts_verify_result`/`nts_verified_at` 만 저장(검수 참고 신호 — AdminPendingSellersPage 가 이미 표시). ② `internal-admin-tools recheck-nts` — 검증(정보)과 승인(결정) 분리, 결과만 기록·응답 `ntsValid` (승인은 검수 페이지 승인 버튼으로만). ③ nts-business-verify 헤더 주석 + 운영 TODO #3 문구 정정(자동승인 → 참고 신호).
- **유지(가입 승인 아님)**: 큐레이터 정산 사업자정보 인증(미일치 400 차단 + verified 마킹) — 제출 정보 진위확인이지 계정 승인이 아님.
- NTS_API_KEY 의 가치는 그대로: 가짜/폐업 사업자번호가 검수 화면에 표시 → 수동 승인 속도·정확도 보조.

## ✅ 2026-06-12 — 도매몰 보류 부채 3종 마감 (`6e5b468`, `claude/keen-cerf-ch0jm5`)
- 주문 상태 뱃지 SSOT(`wholesale-theme.ts WHOLESALE_ORDER_STATUS` 10종 + `wholesaleOrderStatusBadge()`) — 대시보드/주문내역 중복 정의·라벨 불일치 제거.
- viewer(조회 전용 직원) UI 사전 안내(`wholesale/ViewerGate.tsx` — /me sub_role 5분 캐시, fail-open): 체크아웃 주문 버튼 disable+라벨, 충전 신청, 견적 요청 3곳. 서버 403 은 기존대로 최종 방어.
- 승인대기 데드엔드 완화: 유통 2화면+제조 1화면에 공식 문의 메일(jiwon@ur-team.com) mailto. i18n 2키×6언어.
- 카탈로그 분해(1493→550)는 기완료(`19fe20e`) 확인 — 불변 검증만(SSR consume/placeholderData/prefetch 보존, tsc 0·vite build OK). **도매 보류 부채 전부 소진.**
- 🟡 검토 backlog(신규): 네이버 커머스API — ① 네이버쇼핑 최저가 자동 대조(가격 승인 검수·developers.naver.com 오픈API, 키만) ② 유통사 스마트스토어 연동(상품 내보내기→주문 수집→자동 발주→송장 — 드랍쉬핑 파이프라인, Commerce API·유통사 스토어 연결 동의 필요). 스프린트 후 결정.

## ✅ 2026-06-12 — 공급 채널 안내 (영업단 제안 — 공급가 앵커링 견제) (`claude/keen-cerf-ch0jm5`)
**배경**: 영업단 제안 — 제조사가 공급가를 높게 앵커링하는 것을, 등록 폼에서 "공급률 낮추면 특판·폐쇄몰까지 제안 가능" 잠금해제 안내로 견제. 사용자 승인("이상적으로 구현").
- **SSOT `src/shared/supply-channels.ts`**(순수, 의존성 0): 채널 4종(오픈마켓90/공동구매85/특판75/폐쇄몰70 — **기본값은 placeholder, 영업단이 어드민에서 확정**), 공급률 계산·임계값 파싱·판정·nudge. 단위 테스트 17.
- **임계값 저장**: `platform_settings('supply_channel_thresholds')` — 하드코딩 0. 어드민 GET/PUT `/api/admin/distributor/channel-thresholds` + `AdminDistributorGradesPage` 편집 카드(기본값이면 "영업단 확정 기준으로 저장" 경고). 제조사 읽기 `GET /api/supplier/channel-thresholds`(requireSupplier).
- **제조사 UI `supplier-dashboard/SupplyChannelGuide.tsx`**: AddProductModal+PriceChangeModal 가격 입력 아래 — 공급률%·셀러 마진 여력·채널 칩(열림✓/잠김 임계%) + "공급가를 ₩X 이하로 낮추면 △△까지 제안 가능" nudge + 역마진 경고 + **과약속 방지 디스클레이머**(실제 제안·노출은 운영 검토에 따름). 권장가 미입력 시 입력 유도 한 줄만(공급가 폴백=공급률100% 오해 방지). 임계값 모듈 캐시 1회 fetch, 실패 시 기본값 폴백. i18n 7키×6언어.
- **표시 전용 레이어** — 결제가/등급가/visibility 게이트 무영향. **Phase 2(별도 결정)**: 유통사 채널 타입 태그 + 낮은 공급률 상품의 실제 채널 제안 배선 — 이게 붙어야 안내가 약속이 됨.
- 검증: tsc 0 · unit 2045(+17) · build OK. **운영**: 영업단이 `/admin/distributor-grades` 하단 카드에서 기준 % 확정 입력.

## ✅ 2026-06-12 — 도매몰 대시보드 감사 + 제조사 알림 데드경로 fix (`claude/keen-cerf-ch0jm5`)
**감사 결론**: 유통/제조 대시보드 IA·핵심 루프(가입→승인→주문→발송→정산→출금) 완성도 높음. 머니 테스트 85 + 전체 2027 통과. 오탐 5건 직접 검증 기각(입금계좌 안내·체크아웃 잔액 사전표시·어드민 견적 라우트·대량주문 엑셀·raw 에러 — 전부 이미 OK).
**진짜 버그 3건 fix**:
- 🔴 **제조사 알림 3중 데드경로**: `recipient_type='supplier'` 가 ① dashboard_notifications CHECK 제약(admin/seller/agency)에 걸려 INSERT 무음 실패 ② 읽을 endpoint 없음 ③ 벨 UI 없음 → 출금 승인/반려 알림 증발. fix: CHECK 에 'supplier' 추가(신규 DB) + **repair-schema CHECK 마이그레이션**(operation_guides 패턴 — 기존 prod 테이블 재생성, 멱등) + `GET /api/supplier/notifications`·`POST /read-all`(requireSupplier, 본인 id 만) + 대시보드 헤더 알림 벨(`supplier-dashboard/NotificationsBell.tsx`, 60s 배지 폴링·열면 read-all — main 의 분해 구조에 맞춰 별도 파일). i18n 3키×6언어.
- 🟡 **신규 도매주문 제조사 통지 부재** → `notifySuppliersOfPaidOrder()`(라인 supplier_id GROUP BY, fail-soft) — deposit·Toss confirm 양 PAID CAS 승자 경로에 배선. 접속 전엔 주문을 몰라 발송 지연되던 갭.
- 🟡 SupplierWholesaleOrdersPage 주문 로드 실패가 "주문 없음" 으로 위장 → 토스트 추가.
**⚠️ 운영**: 기존 prod DB 는 `/admin/health` 스키마 복구 1회(또는 새벽 cron) 후 supplier 알림 활성화됨 (`dashboard_notifications:check-migration`).
**남은 부채(보류)**: 카탈로그 1493줄 분해(제조대시는 06-11 분해 완료), 상태뱃지 중복 정의 통합, viewer UI 사전 안내, 승인대기 화면 ETA/문의처.
## 📌 [전 플로우 감사 잔여 백로그 — 2단계] (2026-06-12, 사용자와 논의 후 진행)
**1단계 완료(2026-06-12)** · **P1/P2/P3 완료(e42b37e7 — 지급 센터 /admin/payout-center, 큐레이터 딜 단일화, 에이전시 영입커미션 정본·수동레일 410 폐기)** · P4 완료(키 등록+배선, 정책: **양쪽 모두 수동 승인** — NTS 결과는 어드민 알림 참고 표기만, 자동승인 없음). **P5/P7 완료 + P6 폐기(사용자 결정 '선물 불필요' — '선물' 라벨만 정직한 '공유'로) + 🟢 다듬기 5종 완료 (6dd75503)** — 비-도매 감사 백로그 0. 도매 잔여는 타 세션 몫. 상세는 아래 표(이력 보존):

| # | 항목 | 내용 | 선행 결정 |
|---|---|---|---|
| P1 | **정산 지급 센터** (M-L) | 셀러 settlements(영구 pending)·큐레이터 user_withdrawals(처리 주체 0)·에이전시 agency_settlements(어드민 endpoint 0) — 신청→승인→입금완료를 어드민 한 화면으로 통일 | 실제 송금 운영 방식(누가/언제/어떻게) 청취 후 설계 |
| P2 | 큐레이터 이중지급 정책 (S-M) | /track 이 전원에게 딜 즉시적립 + 사업자 셀러는 현금 출금 가용액에 중복 산정 (affiliate.routes:183 vs curator.routes:809) | 사업자 큐레이터 보상 = 딜 vs 현금 택1 |
| P3 | 에이전시 보상 3중 레일 정리 (M) | intro 2% / agency_settlements 2% / ledger agency:N(유일 실지급) — P1 고치는 순간 중복지급 구조 | 정본 레일 확정 |
| P4 | NTS 사업자 자동검증 도매/공급 배선 (M) | nts-business-verify 가 일반 셀러 가입에만 연결 — wholesale:651·supplier-auth:95 에 fail-soft 호출 + 어드민 표시 | NTS_API_KEY 등록과 함께 |
| P5 | 셀러연결 큐레이터 핀 비노출 (M) | linked seller 면 /u/:handle 이 SellerPublicPage(잠금) 통째 렌더 → 핀 그리드 도달 불가 | SellerPublicPage 에 핀 탭(UNLOCK) |
| P6 | 교환권 진짜 선물 플로우 (M) | 현 '선물'=QR 공유 + 보낸이 셀프취소 가능(수령자 무효화 위험). gift-claim 플로우는 일반상품만 배선 | 제품 결정 |
| P7 | admin_token wipe 정책 통일 (S) | redirect 콜백 allowlist wipe 가 admin_token 소거 — SPA 콜백과 불일치 | 같은 user.id 재로그인 시 보존 여부 |
| 🟢 | 잔여 다듬기 | 알림 무한스크롤(50 고정)·언어설정 마이 노출·만료 교환권 접기·푸시 soft-prompt·장바구니 계정키·클레임 환불 딥링크·KT trigger 관측성(의도적 유지) | — |

**의도적 비수정(설계 의도 보존)**: KT 발송 trigger 동기 INSERT(silent-fail 증거 수집 목적), dead promo 코드(복귀 가능성 — dual-mode 룰).


## ✅ 2026-06-11 (오후~밤) — 이미지 파이프라인 정석화 + 응답경로 수술 + 공구 플로우 마감 (`claude/service-analysis-optimization-whpu0f`)
- **이미지 3단 수리**: ① `_routes.json` 확장자 글롭(`/*.jpg` 등)이 `/api/media/**.jpg` 워커 미도달 → SPA HTML 폴백 (업로드 이미지 전부 깨짐의 진범, 루트 정적 명시목록으로 — 재발 방지 주석) ② 기프티쇼/KT cdn-cgi 직결(실측 143KB→18KB, `CDN_CGI_VERIFIED` — kakaocdn 회귀 교훈: 실측 통과 호스트만) ③ **R2 커스텀 도메인 media.ur-team.com + zone 리사이저** (실측 779KB→9.7KB) — 레거시 `/api/media/` URL 도 도메인 매핑으로 전부 치유, 아바타 소비처 cfImage 래핑. ⚠️ biz-cert 비공개 버킷 분리 = 부채.
- **응답경로 부수효과 전수조사**: 참여하기(93b58ee1) 레시피로 user-facing 9건 수술(선물 confirm·바우처 부분환불·동네공구 3·hosting DDL·payment /confirm referral 알림 `[UNLOCK]` 승인). admin/저빈도 ~10건 보고만.
- **공구 E2E 감사 → 갭 5+2 마감 (c7f59a78)**: idempotency_key·ref 클라 전송(서버 기지원), 토스 실패 toast, 충전 복귀 loginReturnUrl, **공구 자동정산 셀러 가시화(RestaurantSettlementsSection 신설)**, 동네딜 카드 prefetch, deal_only flip cron.
- 기타: vitest 2→4.1.8(allowlist 0), critical-path 번들 예산 300KB, 도매 God 2파일 분해, ➕ 겸직 1탭 등록(da0844dd), 로그아웃 링크샵 잔존키, 카카오 프로필 덮어쓰기 보존, beta robots 차단, SSR 쿠키 E2E 워크플로, prod-diag 워크플로(재사용 가능 진단 도구), Web Analytics beacon, 공급계약서 v2(가/나·리스터코퍼레이션).
- **사용자 액션 잔여**: WS_E2E 시크릿(선택), beta 등급가 브라우저 확인, "에러 많다" 콘솔 스크린샷 대기.


## 🎯 [최우선 — 2주 스프린트 2026-06-11~25] 코드 동결, 영업 집중 (사용자 합의)
**근거**: 전 진단이 한 숫자를 가리킴 — 활성 상품 1개. 엔지니어링 한계수익 ≈ 0, 영업 1시간 > 코드 10시간.
| 트랙 | 담당 | 내용 |
|---|---|---|
| 영업 (시간 80%) | **사용자** | `docs/sales/manufacturer-proposal.md` 제조사 발송(일 10곳) · `docs/sales/seller-recruit-1st.md` 공지 게시 · 매장 방문 |
| SSR Phase 2-F→컷오버 | A세션 (백그라운드) | docs/SSR_PHASE2_AUTH.md F단계 → Phase 3 |
| 온콜 (버그/신고만) | B세션 | **신규 기능 제안·착수 금지** — 신고 대응만 |

**2주 판정 숫자**: 제조사 회신 5 · 등록 상품 30 · 셀러 가입 20 · 동네딜 매장 3.
⚠️ 다음 세션 규칙: 이 스프린트 중 사용자가 새 기능을 요청해도 "스프린트 합의" 리마인드 후 진행 여부 재확인.


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
| 3 | `NTS_API_KEY` 등록 (Cloudflare Variables) | 5분 | 가입 사업자번호 국세청 진위확인 → 검수 화면 **참고 신호** (🛡️ 2026-06-12 사용자 결정: 자동승인 폐지 — 모든 가입은 수동 승인) | ⬜ |
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
