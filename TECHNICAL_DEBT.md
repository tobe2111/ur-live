# 기술 부채 추적 문서 (Technical Debt Registry)

2026-04-22 대장애 복구 이후 남은 기술 부채를 추적하는 문서.

분류:
- 🔴 **Critical**: 운영 위험 / 사고 재발 가능
- 🟡 **High**: 비효율 / 신규 개발 제약
- 🟢 **Medium**: 관리 부담 / 코드 품질
- ⚪ **Low**: cosmetic / 장기 개선

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

### TD-002: `.dev.vars` 가 Git History 에 노출
**문제:**
- Commit `96f502d` 에 secrets 포함된 `.dev.vars` 최초 commit
- Commit `1665681` 에서 untrack 했지만 history 에는 그대로 남음
- 노출된 secrets:
  - `JWT_SECRET`
  - `REFRESH_TOKEN_SECRET`
  - `KAKAO_REST_API_KEY`
  - `FIREBASE_PRIVATE_KEY` (production service account!)
  - `FIREBASE_CLIENT_EMAIL`
  - `TOSS_SECRET_KEY` (test key, lower risk)

**영향:** Git repo 열람 가능한 누구나 production secrets 조회 가능.

**해결법 (순서):**
1. **우선순위 1: Firebase Private Key** — Firebase Console 에서 재발급 + 기존 취소
2. **우선순위 2: JWT/Refresh Secret** — 아래 값으로 Pages Dashboard 에서 교체
   ```
   JWT_SECRET = YiXorQ7veam3W4/Y9woD/yNuQPoJG1/87fOd9Tpzcq8=
   REFRESH_TOKEN_SECRET = +VJyeeTA1imGHwh0xuqV/7Em27Rnz3BQTa+eiOwDq68=
   ```
3. **우선순위 3: Kakao REST API Key** — Kakao Developers 에서 재발급
4. **우선순위 4: Toss Secret Key** — production 키일 경우만 재발급
5. **선택: Git history 정리** — BFG 로 `.dev.vars` 커밋 제거
   ```bash
   bfg --delete-files .dev.vars
   git reflog expire --expire=now --all && git gc --prune=now
   git push --force --all
   ```

**예상 작업 시간:** 1시간
**소유자:** 보안 담당

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

### TD-004: 이중 라우팅 구조
**문제:**
```
/api/orders ← ordersRouter (worker/routes/order.routes.ts)
              + featureOrdersRoutes (features/orders/api/orders.routes.ts)

/api/payments ← paymentsRouter + featurePaymentRoutes

/api/seller ← sellerAuthRoutes + sellerManagementRoutes +
              sellerOrdersRoutes + sellerAnalyticsRoutes + ...
```

**영향:** 같은 경로에 여러 핸들러. 매칭 순서 헷갈림. 새 기능 추가 시 어디에 넣어야 하는지 판단 어려움.

**해결법 (장기):**
- worker/routes/order.routes.ts → features/orders/api/orders.routes.ts 로 통합
- 비슷하게 다른 중복 라우트도 한 파일에 모으기
- `app.route('/api/orders', ordersRouter)` 한 줄만 남기기

**예상 작업 시간:** 3일
**소유자:** Backend 리드

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
~~**문제:** `src/worker/repositories/webhook.repository.ts:69` — FAILED webhook events 모니터링 안 됨.~~

**✅ 해결 완료 (2026-04-25):** `markFailed()` 에 Sentry captureException + DB FAILED 저장 구현됨. `getFailedStats()` 어드민 대시보드 조회 API 추가.

---

### TD-010: i18n 완전성
~~**문제:** 셀러 대시보드에 하드코딩 한국어 다수. 6개 언어 키 추가 필요.~~

**✅ 해결 완료 (2026-04-24):** 셀러 방송 서브컴포넌트 4개 파일 전체 `t()` 함수 적용, 6개 언어 translation.json 키 추가 완료.

---

### TD-011: 의존성 Low CVE 8건
**문제:** `npm audit` 에서 low severity 8건 (firebase-admin 내부 transitive).

**영향:** 미미. firebase-admin v13+ 가 나오면 자연 해결 예상.

**해결법:** 분기별 `npm audit` 리뷰.

---

## ⚪ Low

### TD-012: Node.js 20 Deprecation
~~**문제:** GitHub Actions 가 2026-09 부터 Node 20 deprecation 경고 발생.~~

**✅ 해결 완료 (2026-04-22):** `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` 이미 `.github/workflows/main.yml` line 17 에 설정됨.

---

### TD-013: 중복 라우트 prefix
`worker/index.ts` 에 `app.route('/api/seller', ...)` 가 5번 이상 호출됨. 각 라우터가 non-overlapping sub-path를 가진다고 주석되어 있지만 검증 어려움.

**해결법:** 각 라우터의 실제 path 를 도표화해 CLAUDE.md 에 기록.

---

### TD-014: as any 남용 (79건)
~~**문제:** `stripe.routes.ts`, `live-sse.routes.ts`, `admin-review-generator.routes.ts` 등에서 `as any` 캐스팅 다수.~~

**✅ 해결 완료 (2026-04-25):** D1 쿼리 인터페이스 추가 (OrderRow, SettlementDetailRow 등), ZodIssue path 타입, `(caches as unknown as {default: Cache})`, `err.statusCode as Parameters<typeof c.json>[1]` 등 주요 as any 제거 완료. 브라우저 globals(`window as any`, `import.meta as any`) 등 third-party 통합용 패턴은 의도적 유지.

---

### TD-015: 거대 파일 3종 추가 분할 필요
~~**문제:**~~
- ~~`src/features/seller/api/seller-management.routes.ts`: **2099줄**~~
- ~~`src/features/agency/api/agency.routes.ts`: **1639줄**~~
- ~~`src/worker/routes/order.routes.ts`: **794줄**~~

**✅ 해결 완료 (2026-04-25):** 3개 파일 모두 분할 완료. seller-management → 38줄 aggregator, agency.routes → 50줄, order.routes → 27줄. worker/index.ts도 1873줄 → 911줄로 축소 (TD-006).

---

### TD-016: 수수료율 하드코딩 분산
~~**문제:** `admin-tools.routes.ts:202`, `agency.routes.ts:1361-1362` 등에 0.05, 0.02 하드코딩 존재 (platform_settings 미사용).~~

**✅ 해결 완료 (2026-04-25):** `DEFAULT_COMMISSION_RATE` 상수 (`@/shared/constants`) 도입. `admin-tools.routes.ts` 하드코딩 `10` → 상수 사용. agency CSV 수수료도 DB값 사용.

---

## 📊 요약

| 심각도 | 건수 | 예상 총 작업 시간 |
|--------|------|------------------|
| 🔴 Critical | 3 | 2.5시간 (사용자) |
| 🟡 High | 4 | 3주 |
| 🟢 Medium | 7 | 2주 |
| ⚪ Low | 2 | 수시간 |

**Critical 3건만 해결하면 운영 위험은 제거됨.**
High/Medium 은 코드 품질 & 유지보수성 이슈 — 단계적으로.

---

## 진행 기록

- **2026-04-22**: 이 문서 작성. 대장애 복구 완료 후 baseline 부채 정리.
- **2026-04-24**: 전수조사 2차. 보안(CORS, rate-limit, 입력검증) + 성능(싱글턴, batch, 병렬화) 다수 수정. TD-014~016 추가.
- **2026-04-25**: 코드 처리 가능한 TD 항목 일괄 정리. TD-006(index.ts 분리), TD-009(webhook), TD-010(i18n), TD-012(Node 20), TD-014(as any), TD-015(파일 분할), TD-016(수수료 상수) 완료. SELECT * → 명시적 컬럼 33개 파일 변환.
