# 기술 부채 추적 문서 (Technical Debt Registry)

2026-04-22 대장애 복구 이후 남은 기술 부채를 추적하는 문서.

분류:
- 🔴 **Critical**: 운영 위험 / 사고 재발 가능
- 🟡 **High**: 비효율 / 신규 개발 제약
- 🟢 **Medium**: 관리 부담 / 코드 품질
- ⚪ **Low**: cosmetic / 장기 개선

## 📊 최신 상태 요약 (2026-04-29 종료 시)

### 2026-04-29 카카오 모바일 무한 루프 사고 + 전수 강화

| 항목 | 상태 변경 |
|---|---|
| **사고** 카카오 인앱 로그인 무한 redirect | ✅ 즉시 hotfix (`d750fad` — index.html sessionStorage 가드) |
| 자기참조 검증 분산 (4곳 다른 규칙) | ✅ `src/utils/safe-internal-path.ts` 단일 헬퍼 도입 + 36 단위테스트 |
| `KakaoCallbackPage` / `KakaoConsentCallbackPage` returnUrl 자기참조 차단 | ✅ safeInternalPath 적용 |
| 백엔드 `kakao.routes.ts:safeRedirect()` `/auth/`, `/login` 차단 누락 | ✅ 차단 추가 (Worker 코드라 인라인 유지) |
| `lib/api.ts` Firebase user 401 force-refresh 디바운스 부재 | ✅ 30초 시간 디바운스 추가 |
| `lib/api.ts` 401 후 login 페이지 자기참조 가능 | ✅ auth path 면 returnUrl 저장·redirect skip |
| 셀러/어드민/에이전시 토큰 만료 alert (카톡 인앱 흰화면 위험) | ✅ `?error=session_expired` query → toast (3 페이지 적용) |
| `version-check.ts` MIME 에러 reload 가드 약함 | ✅ localStorage 1분 윈도우 가드 추가 |
| `_headers` Cross-Origin-Opener-Policy 누락 | ✅ `same-origin-allow-popups` 추가 |
| 죽은 코드: `errorHandler.checkAuthError`, `useVersionCheck` | ✅ 삭제 |
| `utils/auth.requireLogin` currentPath 검증 누락 | ✅ auth path 면 returnUrl 생략 |

**상세 사고 사례**: `CLAUDE.md` 의 "2026-04-29 사고 요약" 참조.

신규 파일:
- `src/utils/safe-internal-path.ts` — open-redirect/자기참조 검증 단일 헬퍼
- `src/tests/unit/safe-internal-path.test.ts` — 36 테스트

삭제:
- `src/hooks/useVersionCheck.ts` — caller 0 (lib/version-check.ts 와 중복)
- `src/lib/errorHandler.ts:checkAuthError` — caller 0 + returnUrl 화이트리스트 누락

## 📊 이전 상태 요약 (2026-04-28 종료 시)

### 2026-04-28 마라톤 세션 — TD 추가 정리

| TD | 제목 | 상태 변경 |
|---|---|---|
| TD-006 | seller-management split | 2103 → 1167줄 (44.5%↓, registration + alimtalk + kakao-link 분리) |
| TD-006 | agency.routes split | 1984 → 1389줄 (30.0%↓, kakao-link + stats + settlements 분리) |
| TD-007 | Auction 자동 confirm | ✅ 토스 webhook handlePaymentConfirmed 가 user_id + current_price 매칭으로 자동 consume |
| 비즈니스 #1 | 뷰티/헬스 공구권 | ✅ 카테고리 enum + API + UI 칩 + 셀러 등록 폼 셀렉터 |
| 비즈니스 #2 | MD 위탁 판매 | ✅ migration 0236 + 4 endpoints + 정산 통합 + 셀러 대시보드 UI |
| 비즈니스 #3 | 선물하기 | ✅ migration 0237 + 4 endpoints + 받기 페이지 + 보내기 모달 + 환불 cron |
| Cron | gift expire/refund + consignment cleanup | ✅ scheduled-cleanup.ts 20-22번 추가 |
| Mobile | 카톡 인앱 흰화면 | ✅ index.html inline script 가 모듈 로드 전 안내 페이지로 교체 |

신규 파일 (2026-04-28):
- `src/features/seller/api/seller-{registration,kakao-link,alimtalk-mgmt,consignment}.routes.ts`
- `src/features/agency/api/agency-{kakao-link,stats,settlements}.routes.ts`
- `src/features/gifts/api/gifts.routes.ts`
- `src/lib/{consignment-split,consignment-settlement,gift,in-app-browser}.ts`
- `src/components/{InAppBrowserBanner,gift/GiftSendModal}.tsx`
- `src/pages/{SellerConsignmentPage,GiftClaimPage}.tsx`
- `migrations/{0236_consignment_partnerships,0237_gifts}.sql`

신규 단위 테스트: 89건 (gift 35 + consignment-split 20 + consignment-settlement 6 + scheduled-cleanup-cron 14 + in-app-browser 24 + voucher-categories 10 - 중복 제외).

### 2026-04-27 종료 시점 (이전)

| TD | 제목 | 상태 |
|---|---|---|
| TD-001 | D1 Migration CI | 🔴 사용자 액션 필요 (Cloudflare API token D1 권한) |
| TD-002 | 시크릿 노출 | ✅ 해결 (4종 회전 + Toss 재발급) |
| TD-003 | 유령 CF 프로젝트 | 🔴 사용자 액션 (Dashboard 정리) |
| TD-004 | 이중 라우팅 | ✅ 해결 (dead /rollback 제거) |
| TD-005 | 스키마 이중화 | 🟡 prep 완료 (migration 0233 — TD-001 대기) |
| TD-006 | 거대 파일 worker/index.ts | ✅ 해결 (54.8% 감소, 6개 파일 분산) |
| TD-007 | Auction 결제 reservation | ✅ 해결 (auction_holds escrow + forfeit + promote-runner-up + winner-paid + 알림) |
| TD-008 | INTERNAL_CRON_TOKEN | 🟢 사용자 액션 (Pages Variables) |
| TD-009 | Webhook 실패 모니터링 | ✅ 해결 (Sentry + getFailedStats) |
| TD-010 | i18n 완성도 | ✅ 해결 (35건 fallback + 28건 keys) |
| TD-011 | npm CVE | ✅ 해결 (xmldom DoS fix) |
| TD-012 | Node.js 20 deprecation | ✅ 해결 (FORCE_NODE24) |
| TD-013 | /api/seller 라우터 도표 | ✅ 해결 (CLAUDE.md 갱신) |
| **🆕** | `/api/auth/id-token` IDOR | ✅ 즉시 해결 (commit 8cb3116) |

**합계**: 14건 중 9건 해결 + 1건 prep + 4건 사용자 액션 대기.

## 🎯 사용자 액션 우선순위

1. **🔴 즉시 권장** — JWT_SECRET 회전 검토 (IDOR 취약 기간 토큰 무효화)
2. **🔴 TD-001** — Cloudflare Dashboard → API Tokens → 기존 token 에 `Account > D1 > Edit` 권한 추가 → migrate.yml 수동 실행 (30분)
3. **🟡 TD-008** — `INTERNAL_CRON_TOKEN` Pages Variables 등록 (5분, `openssl rand -base64 32`)
4. **🟡 TD-003** — 유령 CF 프로젝트 (`ur-live` Worker, `ur-live-global`, `ur-live-cleanup-cron`) 정리 (1시간)
5. **🟢 ALIMTALK_API_KEY** — Magic Link 식사권 알림톡 발송 활성화 (5분)

TD-001 해결 시 자동 후속 가능:
- migration 0233 적용 → 스키마 이중 컬럼 (stock_quantity, base_shipping_fee) drop → TD-005 마무리
- 응급 ensure*Columns/Tables 패턴 10+ 곳 deprecate 가능

---

## 🎉 2026-04-27 (저녁 2차) TD-006 worker/index.ts 분할 완료

**Before**: 2787줄 단일 파일 (2026-04-22 사고의 직접 원인)
**After**: 1259줄 + 6개 라우트 파일 (54.8% 감소)

| 신규 파일 | 라인 | Phase |
|---|---|---|
| `routes/sitemap.routes.ts` | 75 | 1 |
| `routes/docs.routes.ts` | 15 | A |
| `routes/internal-diagnostics.routes.ts` | 250 | B |
| `routes/internal-admin-tools.routes.ts` | 640 | C |
| `routes/smoke-test.routes.ts` | 265 | D |
| `routes/repair-schema.routes.ts` | 325 | E |

**효과**:
- inline 핸들러 25개 → 약 7개 (catch-all `*`, health, csrf 등 잔존 — 분리 가치 적음)
- 파일 중간 import 사고 재발 위험 크게 감소 (각 라우트 독립 모듈)
- 모든 endpoint path/auth 동일 — 외부 API 호환성 유지

**잔여 코드 정리** (이번 세션):
- `as any` 249건 → 238건 (11건 정리, 나머지는 Hono/Cloudflare framework 한계)
- 위험한 body cast 제거 (seller-orders, broadcast-notify, seller-management)

## 🚨 2026-04-27 (저녁) Critical 보안 패치

### `/api/auth/id-token` IDOR — Account Takeover 가능
- **위치**: `src/worker/routes/auth-token.routes.ts:48`
- **유형**: Authentication Bypass (호출자 검증 누락)
- **노출**: 누구나 다른 사용자의 `firebase_uid` 또는 숫자 `id` 만 알면 그 사용자의 backend JWT 발급 가능
- **수정**: 두 가지 인증 방식 중 하나 통과 필수 — (A) `ur_session` 쿠키 OR (B) Firebase ID token verify
- **상태**: ✅ 수정 + 배포 완료 (commit `8cb3116`)

### Defense-in-depth audit 결과
- 다른 mutation/token-issue 엔드포인트 광범위 점검 → **추가 IDOR 0건**
- agency/admin 라우트는 모두 ownership 검증 (`WHERE agency_id = ? AND seller_id = ?`)
- `/api/streams/:id/current-product` (e1c3b99) 및 `viewer-count` 도 sound
- `chat-messages` 의 anonymous user_id 는 display 용 (authorization 미사용 → OK)

### 권장 후속 액션
- ⚠️ JWT_SECRET 회전 검토 (취약 기간 동안 유출 가능성 시)
- session cookie 재발급은 자동 (다음 로그인 시 갱신)

## 📅 2026-04-27 (오후) 정리 세션 — 변경사항

### ✅ 해결됨
- **TD-004 dead /api/payments/rollback**: 2026-04-26 에 이미 제거됨 확인. `src/shared/api-routes.ts` 의 `payments.rollback` 상수도 정리 완료.
- **TD-009 webhook 실패 모니터링**: 배치 119 (2026-04-22) 에서 Sentry alert + escalation tag (retry≥3 → fatal) + `getFailedStats(hours)` admin 통계 API 완성. 추가 작업 없음.
- **TD-010 fallback 패턴**: `t('X') || '한글'` 35건 → `t('X', { defaultValue: '한글' })` 일괄 변환 (21개 파일). i18next missing key 시 fallback 정상 동작.
- **TD-011 npm audit**: `npm audit fix` 로 xmldom DoS CVE (high 1건) 해결. mod 16 → 14, high 1 → 0.
- **TD-012 Node.js 20 deprecation**: `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` 적용 완료.
- **TD-013 /api/seller 도표화**: CLAUDE.md 에 sellerPinRoutes 추가 (5번째 라우터).
- **console.log unguarded (browser)**: `useSessionValidation`, `useCart`, `auth-token.ts` 5건 DEV gate 추가. (worker code 는 의도적 제외 — Cloudflare Workers 표준 logging)

### ⚠️ 사용자 액션 필요 (코드로 자동 해결 불가)
- **TD-001 D1 Migration CI**: Cloudflare Dashboard → API Tokens → 기존 token 에 `Account > D1 > Edit` 권한 추가 필요. 30분 작업이지만 사용자만 가능.
- **TD-003 유령 CF 프로젝트**: Dashboard 직접 확인/삭제 필요.
- **TD-008 INTERNAL_CRON_TOKEN**: `wrangler secret put INTERNAL_CRON_TOKEN` 또는 Pages Variables 에 등록 필요.

### 📋 잔여 코드 부채 (다음 세션 또는 별도 PR)
- **TD-005 스키마 이중화**: `stock_quantity`/`base_shipping_fee` drop migration. **TD-001 선행 필요** (CI migration 안 도는 한 drop 적용 안 됨).
- **TD-006 거대 파일 분할**: `worker/index.ts:2787줄`, `SellerLiveBroadcastPage.tsx:2516줄`. 회귀 리스크 큼 — 별도 PR 권장.
- **TD-007 Auction 결제 reservation**: 1주 spec 작업.
- **빈 catch swallow 299건**: 대부분 legacy. `swallow()` 유틸로 점진적 마이그레이션 (이미 7개 페이지 적용 됨).
- **as any 249건**: type safety. legacy 라우터 중심 점진 정리.

## 📅 2026-04-27 마라톤 세션 — 변경사항 요약

### ✅ 해결됨
- **TD-002 시크릿 노출**: 4종 회전 (JWT/Refresh/Cron/Toss-Webhook) + Toss 결제 키 재발급. 이전 노출 값 모두 무효 처리.
- **chat-moderation 한글 차단 버그** (Phase 3-3 출시 후 미발견): `normalizeForMatching` 정규식 수정.
- **PushNotificationSetup 메모리 누수**: SW unregister 후 ready 영원히 pending → `getRegistration()` null check.
- **PK shouldEndPK ISO 문자열 비교 버그**: Date.getTime() 비교로 변경.
- **Idempotency-Key 검사 가짜 양성 5건**: 스크립트 정밀화 (POST/PATCH + 실제 fetch만).

### 🆕 추가됨 (32개 신기능 + 49개 단위 테스트 + PWA + 11개 마이그레이션)
- Phase 1: 에이전시 등급 / 부진셀러 알림 / QR 영입 / KPI / 부트캠프 / 라이브가이드 / 공개페이지 (7개)
- Phase 2: 가이드 / PL / 충성도 / 라이브KPI / 부스터 / 월간리포트 / PK이벤트 (7개)
- Phase 3: 최적시간 / FAQ봇 / 모더레이션 / TikTok발굴 / Network / 캐스팅 (6개) + 클립 보류
- UI 통합 6개 + 후속 5개 = 11개
- PWA (vite-plugin-pwa) + Sentry release 통일 + 결제 reconciliation Discord 알림

### 🟢 신규 운영 도구
- `/api/_internal/migration-status` — 마이그레이션 적용 검증 (admin)
- `npm run check:i18n` — 6개 언어 동기 검사
- `bash scripts/check-api-auth.sh` — 인증/Idempotency 검증

---

## 🔴 Critical

### TD-001: DB Migration CI 파이프라인 부재
**문제:**
- 205개 migration 파일 중 실제 프로덕션 D1 에 적용된 건 약 2개
- CI의 `CLOUDFLARE_API_TOKEN` 에 D1 Edit 권한 없어 `migrate.yml` 실행 시 auth error
- 수동 repair-schema 엔드포인트로 응급 처치 중

**영향:** 새 migration 추가해도 자동 적용 안 됨. 스키마 drift 재발 가능.

**해결법:**
1. Cloudflare Dashboard → My Profile → API Tokens
2. 기존 `CLOUDFLARE_API_TOKEN` 편집 → **Account > D1 > Edit** 권한 추가
3. GitHub Actions `migrate.yml` 수동 실행으로 밀린 migration 일괄 적용

**예상 작업 시간:** 30분
**소유자:** DevOps / 인프라 담당

---

### TD-002: `.dev.vars` 가 Git History 에 노출 — ✅ **2026-04-27 해결**
**해결 내역:**
- JWT_SECRET / REFRESH_TOKEN_SECRET / INTERNAL_CRON_TOKEN / TOSS_WEBHOOK_SECRET → 4종 회전
- TOSS_SECRET_KEY / TOSS_CLIENT_KEY → 토스 라이브 모드 재발급
- 이전 노출 시크릿은 모두 무효 처리됨 (현재 사용되는 시크릿은 새 값)
- Git history 정리는 의식적 보류 (모든 값 무효라 실해 0 — 사용자 결정)

**현재 보안 상태:** 🟢 안정. 이전 노출 시크릿 활용 X.

**참조 문서:**
- `docs/IMMEDIATE_DEPLOY_GUIDE.md` — 회전 절차
- `docs/POST_ROTATION_USER_ACTIONS.md` — 회전 후 액션

---

### TD-003: 유령 Cloudflare 프로젝트
**문제:**
- `ur-live` Worker (Dashboard 첫 번째): GitHub 자동 배포 되지만 secret 없음
- `ur-live-global` Worker: 49일간 "Latest build failed" 방치
- `ur-live-cleanup-cron` Worker: 용도 불명

**영향:** Worker 중 하나라도 잘못 트래픽 받으면 500 재발.

**해결법:**
1. Workers & Pages → `ur-live` (Worker) → Settings → Build → Disconnect GitHub
2. 1주일 관찰 후 문제 없으면 프로젝트 삭제
3. `ur-live-global` 빌드 실패 원인 확인 후 삭제 or 수정
4. `ur-live-cleanup-cron` 은 실행 로그 확인 후 정상이면 유지, 아니면 삭제

**예상 작업 시간:** 1시간
**소유자:** 인프라 담당

---

## 🟡 High

### TD-004: 이중 라우팅 구조 — 🟢 **Downgrade (2026-04-26 감사 완료)**

**감사 결과:** [`docs/DOUBLE_ROUTING_AUDIT.md`](docs/DOUBLE_ROUTING_AUDIT.md)

```
/api/orders ← ordersRouter (worker/routes/order.routes.ts)        ← CRUD 핵심
              + featureOrdersRoutes (features/orders/api/orders.routes.ts) ← 배송/CRON

/api/payments ← paymentsRouter (worker)         ← confirm/checkout/webhook
              + featurePaymentRoutes (features) ← /rollback (dead code)

/api/seller ← 7 라우터 (sub-path 분리 — 충돌 0)
```

**실제 충돌:** 0건. worker 와 feature 가 path 레벨에서 완벽히 분리됨.

**남은 정리 (LOW):**
- `POST /api/payments/rollback` (features/payments/api/payment.routes.ts:154) 는 호출처 없음 (dead code)
- `src/shared/api-routes.ts:159` 의 `payments.rollback` 상수도 dead

**권장:**
- 외부 연동 확인 후 dead `/rollback` 제거
- worker/feature 강제 통합 시도 금지 (이득 미미, 회귀 비용 큼)
- CLAUDE.md "이중 라우팅" 표현은 "co-mounted routing" 으로 정정 권장

**소유자:** Backend (정리 단계만 — 통합 시도 X)

---

### TD-005: DB 스키마 이중화 컬럼
**문제:**
- `products.stock` vs `products.stock_quantity` (둘 다 존재)
- `sellers.shipping_fee` vs `sellers.base_shipping_fee`
- `orders.total_amount` (신) vs `total_price/amount` (구, 금지)

**현황:** 코드가 `COALESCE(stock, stock_quantity, 0)` 같은 방어적 패턴으로 처리 중.

**영향:** 새 개발자 혼란. 업데이트 시 한쪽만 갱신하는 버그 가능.

**해결법:**
1. CLAUDE.md 의 "canonical 컬럼 규칙" 따라 통일 (stock 정답)
2. 구 컬럼 (`stock_quantity` 등) 드롭 migration 작성
3. 코드에서 `COALESCE` 제거하고 canonical 만 사용

**예상 작업 시간:** 2일
**소유자:** Backend 리드

---

### TD-006: 거대 파일 분할 필요
**문제:**
- `src/features/admin/api/admin-management.routes.ts`: **3521 라인**
- `src/worker/index.ts`: **1873 라인** (라우터 등록 + inline 핸들러 혼재)
- `src/worker/routes/webhook.routes.ts`: 558 라인

**영향:** 파일 중간 import 사고 (2026-04-22) 의 직접 원인. 가독성, 머지 충돌 리스크.

**해결법:**
- admin-management.routes.ts 를 다음으로 분할:
  - admin-users.routes.ts
  - admin-orders.routes.ts
  - admin-sellers.routes.ts
  - admin-coupons.routes.ts
  - admin-settlements.routes.ts
- worker/index.ts 의 inline 핸들러 → 별도 파일로 분리

**예상 작업 시간:** 1주
**소유자:** Backend 리드

---

### TD-007: Auction 결제 capacity reservation — ✅ **2026-04-28 해결**

**해결 내역:**
- `auction_holds` 테이블 (active/released/consumed) — deal balance escrow
- `getAvailableBalance()` — balance - active holds 합계
- 입찰 시 hold 자동 생성 + outbid 시 자동 해제
- self-outbid 시 본인 이전 hold 해제
- `/forfeit-winner` — 결제 불이행 차순위 자동 승격 + winner_history 기록
- `/promote-runner-up` — 차순위 수동 승격
- `/winner-paid` — hold consume (수동 트리거)
- webhook handlePaymentConfirmed — user_id + current_price 매칭으로 자동 hold consume
- `/release-hold` — 낙찰자 구매 포기
- `/holds/me` — UI 표시 (활성 hold + 가용 balance)
- 알림 (2026-04-28 마무리): outbid push / 낙찰 push / 승격 push

**잔여 (Low priority):**
- 경매 자동 종료 cron 미구현 — 현재는 lazy (다음 GET/POST 시 status='ended')
  → 입찰 0건으로 끝나면 status='active' 채로 남음 (실해 X, cosmetic)

---

## 🟢 Medium

### TD-008: 내부 CRON_TOKEN 미프로비저닝
**문제:** `/api/orders/internal/auto-confirm` 등 cron 전용 엔드포인트가 INTERNAL_CRON_TOKEN 환경변수 기반 인증을 기대하지만 미세팅.

**코드 위치:** `src/features/orders/api/orders.routes.ts:25, 449, 477`

**해결법:**
```bash
wrangler secret put INTERNAL_CRON_TOKEN
# 값: openssl rand -base64 32
```
Pages Dashboard 에서도 동일 추가.

---

### TD-009: Webhook 실패 이벤트 수집 미비
**문제:** `src/worker/repositories/webhook.repository.ts:69` — FAILED webhook events 모니터링 안 됨.

**해결법:** webhook_events 테이블에 status='FAILED' 로 저장 + Sentry alert.

---

### TD-010: i18n 완전성
**문제:** 셀러 대시보드에 하드코딩 한국어 다수. 6개 언어 키 추가 필요.

**영향:** 영어/일본어 사용자가 셀러로 가입 시 인터페이스 깨짐.

**해결법:** `public/locales/{ko,en,ja,zh,es,fr}/translation.json` 6개 파일 동기화.

**예상 작업 시간:** 2일 (기능 추가가 아닌 문자열 이동 작업)

---

### TD-011: 의존성 Low CVE 8건
**문제:** `npm audit` 에서 low severity 8건 (firebase-admin 내부 transitive).

**영향:** 미미. firebase-admin v13+ 가 나오면 자연 해결 예상.

**해결법:** 분기별 `npm audit` 리뷰.

---

## ⚪ Low

### TD-012: Node.js 20 Deprecation
**문제:** GitHub Actions 가 2026-09 부터 Node 20 deprecation 경고 발생.

**해결법:** `.github/workflows/main.yml` 에 `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` 추가.

---

### TD-013: 중복 라우트 prefix
`worker/index.ts` 에 `app.route('/api/seller', ...)` 가 5번 이상 호출됨. 각 라우터가 non-overlapping sub-path를 가진다고 주석되어 있지만 검증 어려움.

**해결법:** 각 라우터의 실제 path 를 도표화해 CLAUDE.md 에 기록.

---

## 📊 요약

| 심각도 | 건수 | 예상 총 작업 시간 |
|--------|------|------------------|
| 🔴 Critical | 3 | 2.5시간 (사용자) |
| 🟡 High | 4 | 3주 |
| 🟢 Medium | 4 | 1주 |
| ⚪ Low | 2 | 수시간 |

**Critical 3건만 해결하면 운영 위험은 제거됨.**
High/Medium 은 코드 품질 & 유지보수성 이슈 — 단계적으로.

---

## 진행 기록

- **2026-04-22**: 이 문서 작성. 대장애 복구 완료 후 baseline 부채 정리.
