# 카카오 로그인 ↔ 사업자 유저(셀러) 연결 이상화

- **대상**: `sellers.linked_user_id` (유저 계정 ↔ 셀러 계정 연결)
- **배경**: `tobe2111`(seller id 5) ↔ `jiwon1228`(user) 이 이메일이 달라 자동연결 실패 → 수동 연결 필요했던 사건.
- **대표 결정 (2026-06-23)**: 단계적 이상화. **1단계 = 가입 시점 자동연결**(완료), **2단계 = 카카오 단일 로그인 통일**(설계 후).
- **북극성**: 카카오 1계정 = 신분 / 셀러 대시보드 = 그 계정에 열리는 도구(레이어). 별도 셀러 로그인은 장기적으로 폐지.

---

## 진단 (감사 결과 요약)

**핵심 문제**: 셀러를 "별도 계정"으로 먼저 만들고 나중에 **같은 이메일 사후 매칭**으로 엮는 구조 → 깨지기 쉬움.

### 셀러 생성 경로 7개 중 가입 시 `linked_user_id` 설정 = 2개뿐
| 경로 | 파일 | 가입 시 연결? | 로그인 유저 있음? |
|---|---|---|---|
| 일반 셀러가입 `/register` | seller-registration.routes.ts:153 | ❌ → **1단계에서 수정** | 로그인이면 가능 |
| 유저→셀러 전환 `/register-from-user` | :448 | ✅ (linked_user_id 박음) | YES |
| 에이전시 초대 | agency.routes.ts:979 | ❌ | NO (제3자 생성) |
| 도매 become-distributor (신규) | wholesale.routes.ts:385 | ✅ | YES |
| 도매 become (기존, UPDATE) | wholesale.routes.ts:314 | (자동연결, COUNT≤1 게이트 없음 ⚠️) | YES |
| 관리자 매장 생성 | admin-sellers.routes.ts:851 | ❌ | NO |
| KT알파 시스템 계정 | admin-kt-alpha/system.ts:22 | ❌ | NO |

### 사후 자동연결 (이메일 매칭) 조건
- `KakaoAuthService.upsertUser` (~478): 카카오 로그인마다, **이메일 verified + COUNT≤1 + 이메일 정확일치(대소문자 구분 ⚠️)** + `linked_user_id IS NULL`. → 🔒 로딩 최적화 잠금 파일.
- `seller-registration /my-seller-status` (~537): 이메일 매칭(소문자) 백필.
- `wholesale become-distributor` (~319): verified 게이트만(COUNT≤1 없음 ⚠️).
- `repair-schema` (~718): same-email 1:1 백필(관리자/cron).
- 수동: `admin-sellers /sellers/:id/link-user` (운영자 직접, 이메일 무관) ← 2026-06-23 신설.

### 미연결로 남는 갭 시나리오 (중요)
1. 일반 가입 후 카카오 로그인 안 함 / 다른 이메일 → 영영 미연결 (← tobe2111)
2. 관리자/에이전시 생성 셀러 + 매칭 유저 없음/미verified → 미연결
3. 이메일 대소문자 불일치 → 사후매칭 silent 실패
4. 같은 이메일 유저 2명(COUNT>1) → 안전상 skip → 미연결

### 의존성
- `/u/{handle}` (CuratorPage `curator.routes:179`)는 **오직 `linked_user_id`** 로 셀러 storefront 조회 → 미연결이면 링크샵에 셀러 안 뜸.
- `/profile→/u` 301 (`worker/index.ts:~2090`), 셀러 public `curator_handle` (`seller.routes`) 도 `linked_user_id` 기반.
- 카카오 콜백 역할토큰 발급(`issueLinkedRoleTokens`)도 `linked_user_id` 기반 → 미연결이면 로그인해도 셀러 권한 토큰 누락.

---

## ✅ 1단계 (완료 — 2026-06-23)
- **`/register` 가입 시 연결**: 카카오 user 세션이 있으면 INSERT 직후 `linked_user_id` 즉시 설정(이메일 무관). 비로그인 가입은 기존대로 미연결. `idx_sellers_linked_user_unique` 충돌 시 skip, fail-soft. (`seller-registration.routes.ts` `/register`)
- **수동 연결 도구**(선행): `PATCH /api/admin/sellers/:id/link-user` + AdminPendingSellersPage 폼 — 이메일 다른 기존 셀러를 운영자가 핸들로 직접 연결.
- 기존 same-email 미연결분은 `repair-schema` 백필 + 로그인 시 자동연결이 처리.

## 🟡 2단계 (진행 중 — 대표 승인 "응 하자. 가장 이상적으로", 2026-06-26)
**목표**: 셀러도 카카오 단일 로그인. 별도 이메일/비번 셀러 로그인은 *기존 셀러용 fallback* 으로 강등 → 마이그레이션 완료 후 폐지.

**전제 (감사 확인)**: 카카오 → 셀러 대시보드 진입은 *이미 동작*(콜백 `issueLinkedRoleTokens` → 역할토큰 fragment → KakaoCallbackPage). 따라서 2단계는 **잠금파일 무수정 + additive UX/마이그레이션 유도**만으로 달성.

### ✅ 2a — 셀러 로그인 화면 카카오 우선 (완료, 2026-06-26)
- `SellerLoginPage.tsx`: 카카오 버튼을 **기본(상단 prominent CTA)** 으로 승격. 이메일/비번 `<form>` 은 "기존 이메일로 로그인" 토글 뒤로 강등(`showEmailLogin`, 기본 접힘). **저장된 `seller_remember_email` 있으면 자동 펼침 → 기존 이메일 셀러 회귀 0.** 이메일 로그인 로직(`handleSubmit`/Turnstile/remember)은 전부 byte-동일 보존(접근만 fallback 화).
- i18n: `seller.kakaoLoginPrimary` / `kakaoLoginPrimaryHint` / `emailLoginToggle` 6개 언어 추가.

### ✅ 2b — 대시보드 카카오 연동 권유 배너 (완료, 2026-06-26)
- 신규 `SellerKakaoLinkBanner.tsx` (SellerLayout `<main>` 상단). dismissible.
- 비용 최소화: dismiss 플래그(localStorage) 또는 `user_id`(카카오 세션) 있으면 **네트워크 0** 으로 미노출. 이메일 셀러 후보만 1회 `GET /api/seller/kakao-link-status` → 미연동일 때만 노출(연동돼 있으면 플래그 캐시).
- CTA → `/seller/profile` (기존 `KakaoLinkButton` 이 OAuth 팝업 + `POST /link-kakao` 처리 — 검증된 흐름 재사용, 중복 0).
- i18n: `seller.kakaoBannerTitle/Desc/Cta` 6개 언어 추가.

### ✅ 2b+ — 관리자 미연결 셀러 마이그레이션 뷰 (완료, 2026-06-26)
신규/기존 셀러를 카카오로 *유도*해도 **이미 어긋난 기존 셀러**(이메일 불일치 → 자동연결 실패, 예: tobe2111)는 자동으로 안 풀림. 운영자가 일괄 정리할 수 있게:
- **`GET /api/admin/sellers/unlinked`** (admin-sellers.routes, 비잠금): `linked_user_id IS NULL` + 비-distributor + status pending/approved 셀러 목록 + **추정 매칭**(이메일이 정확히 1명과 일치(COUNT=1) + 그 유저 미연결일 때만 — 오연결 방지). 매칭 우선 정렬.
- **AdminPendingSellersPage**: 기존 수동 연결 폼 아래 **미연결 목록 + 추정 매칭 원클릭 '연결'**(공유 `doLink` → 기존 `PATCH /sellers/:id/link-user`, conflict 가드/audit log 그대로). 매칭 없으면 "수동" 표시 → 위 폼으로.

### 🔜 2c — 완전 폐지 (보류, 마이그레이션 성숙 후)
- 이메일/비번 로그인 fully 제거. **선행조건**: 미연결 이메일 셀러 비율이 충분히 낮아질 때까지 fallback 유지(지금 제거하면 미연결 셀러 lockout).
- 잔여 자동 마이그레이션: 카카오 same-email auto-link(`KakaoAuthService.upsertUser`, 잠금) + `repair-schema` 백필이 이메일 셀러가 카카오로 로그인하는 순간 `linked_user_id` 채움 → 2a/2b 가 그 경로로 유도.
- 잠금파일(`KakaoAuthService`/`kakao.routes`/`KakaoCallbackPage`/`pending-auth`)은 2a/2b 에서 **무수정**. 2c 진입 시에만 AskUserQuestion + audit log.

### 부가 하드닝 (P1/P2, 별도)
- **P1 ✅ 이메일 비교 대소문자 무시** (완료, 2026-06-26 — 대표 "계속 하자"): `KakaoAuthService.upsertUser` same-email 자동연결의 UPDATE 매칭 + COUNT 모호성 게이트를 `LOWER(email) = LOWER(?)` 로. `"Foo@x.com"` vs `"foo@x.com"` silent 미연결 갭 해소. **verified 게이트·COUNT≤1·IS NULL 멱등 불변** — 매칭만 넓힘(대소문자무시 COUNT 는 더 보수적). 잠금파일이라 `[UNLOCK_LOADING]` + CLAUDE.md audit log. (비잠금 짝은 이미 LOWER: 관리자 `/sellers/unlinked`·repair-schema.)
- **P2 🔜 (별도)**: become-distributor COUNT≤1 게이트(도매몰 서비스 — 분리 룰상 별도 작업), 에이전시-초대 셀러 승인 시 자동연결 probe.
