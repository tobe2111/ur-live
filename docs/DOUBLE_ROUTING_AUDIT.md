# 이중 라우팅 감사 (TD-004 재평가)

> 작성일: 2026-04-26
> 결론: TECHNICAL_DEBT.md 의 TD-004 는 **실제 충돌 없음** — 🟡 High → 🟢 Medium 으로 downgrade 권장

## 1. 마운트 현황 (`src/worker/index.ts`)

```
1608: app.route('/api/seller',           sellerAuthRoutes)
1674: app.route('/api/seller',           sellerManagementRoutes)
1675: app.route('/api/seller',           sellerPinRoutes)
1676: app.route('/api/seller',           sellerOrdersRoutes)
1677: app.route('/api/seller/analytics', sellerAnalyticsRoutes)
1678: app.route('/api/seller/streams',   sellerStreamsRoutes)
1704: app.route('/api/orders',           ordersRouter)          ← worker
1705: app.route('/api/orders',           featureOrdersRoutes)   ← feature
1715: app.route('/api/payments',         paymentsRouter)        ← worker
1716: app.route('/api/payments',         featurePaymentRoutes)  ← feature
1817: app.route('/api/seller/alimtalk',  alimtalkRoutes)
```

## 2. Path 충돌 분석

### `/api/orders` — ✅ 충돌 0
| Path | worker | feature | 비고 |
|------|--------|---------|------|
| POST `/`, GET `/`, GET `/:id`, POST `/:id/cancel`, POST `/refund` | ✅ | ❌ | worker 단일 |
| GET `/:id/tracking`, POST `/:id/confirm`, internal CRON | ❌ | ✅ | feature 단일 |

**feature 의 GET `/`, GET `/:id`, POST `/`** 는 이미 dead code 로 주석 처리됨 (배치 112).

### `/api/payments` — ✅ 충돌 0
| Path | worker | feature | 비고 |
|------|--------|---------|------|
| POST `/confirm`, POST `/checkout-session`, POST `/webhook` | ✅ | ❌ | worker 단일 |
| POST `/rollback` | ❌ | ✅ | **dead code** (호출처 없음) |

`POST /api/payments/rollback` 은 `src/shared/api-routes.ts:159` 에 상수만 있고 실제 호출 0건.

### `/api/seller` (7 라우터) — ✅ 충돌 0
sub-path 기반 분리. CLAUDE.md 매핑표 참조.

## 3. 통합 가능 후보

| 후보 | 통합 난이도 | 권장 |
|------|-----------|------|
| `/api/payments/rollback` 제거 | LOW | ⚠️ 외부 연동 가능성 우려로 보류 권장 |
| `/api/orders/refund` 추가 검토 | LOW | 이미 worker 단일 — no-op |
| 결제 confirm/cancel/refund 통합 | HIGH | ❌ 비추천 (멱등성, 재고, 상태머신) |

## 4. 함부로 만지면 안 되는 경로 (HIGH RISK)

1. `POST /api/orders` — 멱등성 + 재고 차감 + Toss 결제 예약
2. `POST /api/orders/:id/cancel` — 환불 + 재고 복구 + 상태머신
3. `POST /api/orders/refund` — 부분 환불 + 금액 검증
4. `POST /api/payments/confirm` — 실제 카드 승인
5. `POST /api/orders/:id/confirm` — 구매확정 → 정산 트리거
6. `POST /api/orders/internal/auto-confirm` — 14일 자동 확정 CRON

## 5. 결론 & 권장

✅ **현재 라우팅 구조는 견고함**:
- `worker/routes/*` = 핵심 비즈니스 로직 (CRUD, 결제, 환불)
- `features/*/api/*` = 부가 기능 (배송 추적, 구매 확정, CRON, 환불 후속)
- 7개 seller 라우터는 sub-path 로 완벽 분리

⚠️ **TD-004 재평가 권장**:
- 실제 충돌 0건 — 🟡 High 에서 🟢 Medium 로 downgrade
- 단순히 prefix 가 같다는 이유로 부정적 평가 부적절
- "이중 라우팅" 표현은 오해 — 실제로는 **co-mounted, non-overlapping**

🔴 **통합 시도 금지**:
- 결제/주문 핵심 path 는 이미 단일 소스 (worker)
- 강제 통합 시 거대한 회귀 테스트 비용
- 현재 분리 구조의 이점: feature 추가 시 worker/index.ts 수정 불필요

📌 **Action Items**:
1. (선택) `POST /api/payments/rollback` 제거 — 외부 연동 확인 후
2. `src/shared/api-routes.ts:159` 의 `payments.rollback` 상수도 함께 제거
3. CLAUDE.md "이중 라우팅" 표현 → "Co-mounted routing" 으로 수정 권장
