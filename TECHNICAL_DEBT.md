# 기술 부채 추적 문서 (Technical Debt Registry)

2026-04-22 대장애 복구 이후 남은 기술 부채를 추적하는 문서.

분류:
- 🔴 **Critical**: 운영 위험 / 사고 재발 가능
- 🟡 **High**: 비효율 / 신규 개발 제약
- 🟢 **Medium**: 관리 부담 / 코드 품질
- ⚪ **Low**: cosmetic / 장기 개선

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

### TD-007: Auction 결제 capacity reservation 부재
**문제:**
- `/api/auction/:id/bid` 는 입찰만 받고 결제 금액 예약 안 함
- 낙찰자가 결제 거부 시 차순위 자동 승격 없음
- 실제 escrow 시스템 없음

**코드 위치:** `src/features/auction/api/auction.routes.ts:99` — TODO 주석 있음

**영향:** 경매 사용 시 낙찰자가 지불 안 하면 deal 무효.

**해결법:**
- Deal balance 를 입찰 시 예약 (hold)
- 상회 입찰 시 기존 예약 해제 + 새 예약
- 경매 종료 시 낙찰자만 확정 결제

**예상 작업 시간:** 1주
**소유자:** 결제 팀

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
