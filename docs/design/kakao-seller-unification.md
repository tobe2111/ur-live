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

## 🔜 2단계 (설계 필요 — 보류)
**목표**: 셀러도 카카오 단일 로그인. 별도 이메일/비번 셀러 로그인 폐지.
- 기존 이메일/비번 셀러 → 카카오 계정 마이그레이션 (이메일 매칭 + 본인확인 + linked_user_id 백필).
- 셀러 로그인 화면 → 카카오 로그인으로 통일 (대시보드는 역할토큰으로 진입).
- 잠금 영향: `KakaoAuthService`(same-email auto-link), `kakao.routes`(역할토큰/iOS fragment), 로그인 화면들 — 변경 시 AskUserQuestion + audit log 필수.
- 부가 하드닝(P1/P2): 이메일 비교 소문자 통일(대소문자 사고 방지), become-distributor COUNT≤1 게이트 추가, 에이전시-초대 셀러 승인 시 자동연결 probe.
