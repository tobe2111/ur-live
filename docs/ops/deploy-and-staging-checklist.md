# 도매(유통스타트) 배포 + 스테이징 E2E 체크리스트

> 대상: 2026-06-07/08 도매몰 개선 작업(PAY-1~6 / SCHEMA-1~2 / BIZ-1~8 / TAX-1 / DATA-1)의 안전 출고.
> 근거 파일: `src/features/supply/api/supply-settlement.ts`, `wholesale-settlement.ts`, `wholesale.routes.ts`,
> `distributor-admin.routes.ts`, `wholesale-tax.routes.ts`, `wholesale-claims.routes.ts`,
> `src/worker/cron/wholesale-{settle-tick,grade-eval,orphan-sweep}.ts`, `wholesale-notifications.routes.ts`,
> `src/worker/routes/repair-schema.routes.ts`.
>
> ⚠️ 머니패스(정산/여신/환불)는 **추측 금지**. 이 문서의 E2E 시나리오를 staging 에서 1회씩 실제 실행 후 운영 반영.
> ⚠️ 빌드는 반드시 `npm run build` (CLAUDE.md 빌드 룰 — `vite build` 단독 금지: `_worker.js` 미갱신).

---

## 0. Pre-deploy — 환경변수 (Cloudflare Pages → ur-live → Settings → Variables and Secrets)

도매 작업에서 새로/추가로 필요한 값. 미설정 시 동작은 대부분 fail-soft(해당 기능만 비활성)이나, 배포 전 확인.

| 변수 | 용도 | 미설정 시 | 필수도 |
|---|---|---|---|
| `NAVER_CLIENT_ID` / `NAVER_CLIENT_SECRET` | BIZ-5 최저가 참고값(네이버 쇼핑 검색 API, `wholesale-price-reference.routes.ts:99`) | 최저가 참고 엔드포인트가 503/skip — 어드민 수동 검수만 | 선택(BIZ-5 쓰면 필수) |
| `BAROBILL_TEST_API_KEY` / `BAROBILL_PROD_API_KEY` (+ 바로빌 계정 세트) | 전자세금계산서 발행(`distributor-admin.routes.ts:958 isBarobillConfigured`) | `/tax-documents/:id/issue-nts` 가 503 `needs_config` 반환(fail-soft) — 내부 HTML 문서는 동작 | 선택(매출 세금계산서 자동발행 쓰면 필수) |
| `RATE_LIMIT_KV` (Dashboard Bindings) | `/orders`,`/orders/confirm`,`/register`,`credit-repayment`,`auto-grade/run` 등 rate limit | **fail-OPEN**(무제한 통과) — 보안 약화 | 확인 필수 |
| `DATA_ENCRYPTION_KEY` | 토큰 암호화(`encryptToken`) — 카카오 become-distributor flow 가 user 토큰 경유 | 기존 동작 영향(도매 신규 아님) | 기존 유지 확인 |
| `JWT_SECRET` | 유통사 seller 토큰(`sellerIdFrom`) | 도매 API 전부 500/401 | 기존 유지 확인 |
| `DISCORD_WEBHOOK_URL` | cron 실패 알림(`wholesale-settle-tick` fail-soft 경보) | cron 실패가 조용히 묻힘(동작은 함) | 권장 |
| 플랫폼 사업자정보 (`platform_settings.company_*`, env 아님 — DB) | 세금계산서 발행자 정보 | issue-nts 503 | 어드민 `/admin` company-info 에서 입력 |

- [ ] 위 표의 변수 상태 확인 (특히 `RATE_LIMIT_KV` 바인딩 = fail-open 위험)
- [ ] `curl -I https://live.ur-team.com/api/products` → `X-RateLimit-Limit` 헤더 존재(= KV 바인딩 활성) 확인
- [ ] 빌드: `npm run build` (← `vite build` 아님). `git push origin <branch>` → Actions 녹색 확인

---

## 1. Deploy + 스키마 보강 (repair-schema)

새 작업이 추가한 테이블/컬럼/인덱스. 대부분 라우터/cron 가 `ensure*`(self-heal)로 cold isolate 에서 자가 생성하지만,
**머니패스 멱등의 데이터 본질인 `idx_supplier_settle_unique` 는 repair-schema 로 1회 명시 보강**해야 안전(PAY-1/PAY-idempotency 의 `ON CONFLICT` 가 이 인덱스에 의존).

### 배포 후 1회 호출 (admin 인증 필요)
```bash
# GET, requireAdmin — admin Bearer 토큰 필요 (repair-schema.routes.ts:1380)
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  https://live.ur-team.com/api/_internal/repair-schema | jq
```

### 이 작업이 추가하는 스키마 (repair-schema 또는 ensure* 로 보장)
| 항목 | 출처 | repair-schema 등록 |
|---|---|---|
| `idx_supplier_settle_unique` UNIQUE (`order_id, product_id, source`) | PAY-1 멱등 backstop | ✅ `repair-schema:1247` — **반드시 생성 확인** |
| `supplier_settlements.held_at` DATETIME | BIZ-1 클레임 HOLD | ensure (`supply-settlement.ts:270`, `wholesale-claims.routes.ts:89`) |
| `supplier_settlements.source` TEXT default 'consumer' | consumer/wholesale 분리 | ensure (`wholesale-settlement.ts:39`) |
| `products.pack_size` / `products.order_multiple` INTEGER default 1 | BIZ-8 MOQ/배수 | ✅ `repair-schema:115-116` + ensure |
| `sellers.distributor_credit_limit` / `outstanding_balance` / `credit_frozen` | BIZ-2 여신 | ✅ `repair-schema:260` + ensure |
| `wholesale_credit_ledger` 테이블 + idx | BIZ-2 미수금 원장 | ✅ `repair-schema:264,274` + ensure |
| `wholesale_claims` 테이블 + 4 idx | BIZ-1 클레임/RMA | ensure (`wholesale-claims.routes.ts:68`) |
| `wholesale_quotes` 테이블 + 3 idx | BIZ-3 견적 | ensure (`wholesale-quotes.routes.ts:63`) |
| `wholesale_restock_subscriptions` 테이블 + idx | BIZ-4 재입고 알림 | ensure (`wholesale-notifications.routes.ts:51`) |
| `wholesale_purchase_invoices` 테이블 + idx | TAX-1 매입 역발행 기록 | ✅ `repair-schema:1211,1224` + ensure |
| `wholesale_integrity_reports` 테이블 + idx | DATA-1 고아 리포트 | ✅ `repair-schema:1226,1232` + ensure (cron self-ensure) |
| `tax_documents` 테이블 (+ nts_confirm_num 등) | 세금계산서 | ensure (`tax-documents.ts:37`) |

- [ ] repair-schema 응답에서 `idx_supplier_settle_unique` 생성/존재 확인 (기존 중복행 있으면 생성 실패 → 정리 후 재실행, repair-schema best-effort 패턴)
- [ ] `pack_size` / `order_multiple` / 여신 3컬럼 / `wholesale_credit_ledger` 적용 확인

### 핵심 엔드포인트 smoke test (배포 직후)
```bash
# 도매 카탈로그(비로그인 OK — distributor_price=null, requires_login)
curl -s "https://live.ur-team.com/api/wholesale/catalog?limit=3" | jq '.success, .requires_login'
# 어드민 도매주문 모니터
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  "https://live.ur-team.com/api/admin/distributor/orders?limit=1" | jq '.success'
# 자동등급 설정(off 기본값 확인)
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  "https://live.ur-team.com/api/admin/distributor/auto-grade/settings" | jq '.enabled, .defaults'
# 세무 aging
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  "https://live.ur-team.com/api/admin/wholesale/tax/aging" | jq '.success'
```
- [ ] 위 4개 200 + `success:true`

---

## 🔴 2. 머니패스 staging E2E 시나리오 (가장 중요 — 실결제/실DB 로 1회씩)

> 함수 단위로 도출한 구체 절차. 각 시나리오 끝에 "관측해야 하는 DB 상태"를 명시.
> staging 토스 키 + 실제 D1(staging) 사용. 금액은 소액(MOQ 충족 최소).

### 시나리오 (1) — 지급 후 환불 클로백 net-out (PAY-1 / PAY-4)
대상: `creditSupplierOnOrder` → `matureSupplierSettlements` → `payoutSupplier` → `reverseSupplierOnRefund`
(소비자 드랍쉽 경로. 도매는 `creditSupplierOnWholesaleOrder` / `reverseSupplierOnWholesaleRefund` 로 동일 검증.)

1. 공급상품(supply_source_id 연결된 셀러 복제본) 1건 소비자 결제 → `/confirm` 성공.
   - 관측: `supplier_settlements` 에 status='pending', source='consumer' 1행. `supplier_balances.pending_amount` 증가.
2. 환불창 경과를 만들기 위해 staging 에서 해당 row `available_at` 을 과거로 수동 set → `matureSupplierSettlements` 호출(또는 cron `wholesale-settle-tick`).
   - 관측: status='available', `available_amount` 증가, `pending_amount` 감소.
3. `payoutSupplier(DB, supplierId)` 실행(어드민 지급).
   - 관측: status='paid' + `paid_at`. `supplier_payouts` 1행. `available_amount`→0, `paid_amount` 증가.
4. **지급 후** 그 주문 환불 → `reverseSupplierOnRefund(DB, orderId, reason)`.
   - 관측(핵심): paid row 는 그대로 보존(append-only), **음수 클로백 row**(product_id 음수, supply_amount 음수, status='available', note='clawback', `available_at`=과거) 1행 INSERT.
   - 관측: `available_amount` SUM 이 음수분만큼 순감(net-out). 다음 payout 이 그만큼 적게 지급.
5. (잔고가 음수로 떨어지는 케이스) 미래 정산이 없어 available SUM < 0 이 되면:
   - 관측: 어드민 dashboard_notification `supplier_clawback_shortfall` 발송(`/admin/suppliers`).
6. **멱등 검증**: 같은 환불을 2회 호출 → 클로백 row 가 `ON CONFLICT(order_id, product_id, source) DO NOTHING` 으로 2번째는 no-op.
   - 관측: 클로백 row 가 1개만, ledger reverse entry 1개만(over-reverse 없음).

- [ ] paid 후 환불이 음수 클로백 row 를 만들고 available SUM 이 순감
- [ ] 잔고 음수 시 `supplier_clawback_shortfall` 알림
- [ ] 환불 2회 호출 멱등(no-op)

### 시나리오 (2) — 일일 지급 캡(1억) 동시 통과 차단 (PAY-2)
대상: `payoutSupplier` 의 batch `[0]` 조건부 INSERT (`supplier_payouts ... WHERE (SELECT SUM today)+? <= cap`)

1. (staging) `platform_settings.supplier_daily_payout_cap` 을 작은 값(예: 100,000)으로 set.
2. 한 공급자 available 잔고를 캡의 60% 씩 2건 만든 뒤, **두 payout 을 거의 동시에** 호출(또는 today 합계를 캡 근처로 미리 채운 뒤 1건 호출).
   - 관측: 한쪽만 `payoutInserted=true`(supplier_payouts 1행 + settlement claim), 다른 쪽은 `daily_cap_exceeded`(0행, settlement 미claim — EXISTS 가드로 자동 no-op).
   - 관측: 합산 지급액이 캡을 **초과하지 않음**.
3. payout 행은 들어갔으나 claim=0(동시 만기가 available 먼저 가져감) → `already_paid` + 빈 payout 행 DELETE 정리 확인.

- [ ] 동시 2건 중 1건만 성공, 합계 ≤ 캡
- [ ] 캡 초과분은 `daily_cap_exceeded`, 보상/롤백 불필요(no-op)

### 시나리오 (3) — 여신(ON_CREDIT) 한도/동결/오버셀 (BIZ-2)
대상: `wholesale.routes.ts POST /orders` (payMethod='credit') + `loadSellerCredit` + 원자 청구 batch

1. 어드민 `PATCH /distributors/:id/credit` 로 한도 set(예: 1,000,000), 상태 approved.
2. 한도 내 외상 주문 → status='ON_CREDIT' 주문 생성.
   - 관측: `sellers.outstanding_balance` += subtotal. `wholesale_credit_ledger` type='charge' 1행(balance_after 정확). 재고 차감. `creditSupplierOnWholesaleOrder` 로 제조사 정산 pending 적립(플랫폼이 채권 보유).
3. 한도 초과 주문 → 게이트 `subtotal > credit.available` → 409 `CREDIT_LIMIT_EXCEEDED`(주문/청구 없음).
4. `credit_frozen=1` set 후 외상 주문 → 403 `CREDIT_FROZEN`.
5. 한도 부여 0(`distributor_credit_limit=0`) → 403 `CREDIT_NO_LIMIT`.
6. 체크아웃 사이 한도 변경 race: 청구 batch 의 가드 WHERE(`credit_frozen=0 AND limit-outstanding >= ?`) changes=0 → 재고 복원 + 원장 charge 롤백 + 주문 FAILED + 409(미회수 0).
7. 오버셀: 동시 주문이 마지막 재고 claim → `OVERSOLD` 409, 차감 성공분 복원 + 주문 FAILED + **청구 없음**.
8. 상환: 어드민 `POST /distributors/:id/credit-repayment` → `outstanding_balance` 감소(초과상환 clamp ≥0), ledger type='repayment' 1행, 감사로그.

- [ ] 한도 내 ON_CREDIT 주문 + outstanding 증가 + charge 원장
- [ ] 한도초과/동결/무한도 게이트 각각 차단
- [ ] race 청구 실패 시 재고 복원 + 미회수 0
- [ ] 오버셀 시 재고 복원 + 청구 없음(FAILED)
- [ ] 상환 시 outstanding 감소 + repayment 원장

### 시나리오 (4) — 환불 원장 정합 + 마진 비례 차감 + 이중환불 no-op (PAY-6)
대상: `reverseSupplierOnWholesaleRefund` (retail/supply 분리 + `wholesale_orders.margin_total` 차감)

1. 도매 주문(여러 라인) 결제 완료 → `margin_total = subtotal - supply_total` 기록.
2. **전액 환불**(`distributor-admin POST /orders/:id/refund`) 후:
   - 관측: settlements cancelled/clawback. ledger reverse entry(`supplier_wholesale_reversal`, account swap) 로 `getAccountBalance('supplier:N')` 순감 → settlements SUM 과 정합(Σ-invariant 회복).
3. **부분 환불**(supplier 지정) 후:
   - 관측: `wholesale_orders.margin_total` 이 역전 라인들의 `Σ(retail - supply)` 만큼만 감소(MAX(0,…) 클램프). 다른 라인 마진 보존.
4. **이중 환불**(같은 환불 2회):
   - 관측: cancelled/clawback row 가 재선택 안 됨 → `marginReversed=0` → margin 재차감 없음, ledger over-reverse 없음(멱등).

- [ ] 전액 환불 후 ledger ↔ settlements SUM 정합
- [ ] 부분 환불 시 margin_total 비례 차감(다른 라인 보존)
- [ ] 이중 환불 no-op

### 시나리오 (5) — 자동 등급 승급 dry check 후에만 enable (BIZ-7)
대상: `evaluateWholesaleGrades` (promote-only) + `distributor-admin POST /auto-grade/run` / `PATCH /auto-grade/settings`

1. `wholesale_auto_grade_enabled` 는 기본 '0'(off) — cron no-op 유지.
2. **먼저 수동 dry check**: `POST /auto-grade/run`(force=true) 1회 → 응답 `evaluated/promoted/window_days` 확인.
   - 관측: 의도치 않은 대량 승급이 없는지(임계값 적절성). 승급은 CAS(`distributor_grade != target`)라 멱등.
   - 관측: 승급 발생 시 `admin_audit_logs`(action='wholesale_grade_auto_promote', admin_id='system:cron') + 유통사 `dashboard_notifications`(wholesale_grade_up).
3. dry check 결과가 합당할 때만 `PATCH /auto-grade/settings { enabled: true }` (감사로그 기록).

- [ ] enable 전에 `/auto-grade/run` 으로 승급 규모 확인
- [ ] promote-only(자동 강등 없음) 확인 — 강등은 수동 `PATCH /distributors/:id` 만

---

## 3. Post-deploy 검증

- [ ] cron 등록 확인 (`scheduled.ts`): `wholesale-settle-tick`(시간별/일배치), `wholesale-orphan-sweep`(일 1회), `wholesale-grade-eval`(주 1회 월요일). settle-tick 1회 후 `matured` 카운트 로그/디스코드.
- [ ] `wholesale-orphan-sweep` 1회 수동 트리거 → `wholesale_integrity_reports` 에 리포트 1행(total_orphans, checks_json). **flag-only — 자동 삭제 없음** 재확인.
- [ ] 클레임 HOLD(BIZ-1): 유통사 `POST /api/wholesale/claims`(`wholesale-claims.routes.ts`, `/api/wholesale` 마운트) → `wholesale_claims` open + 해당 도매주문 `supplier_settlements.held_at` set(`holdSettlements`) → `matureSupplierSettlements` 가 그 row 성숙 제외. reject/resolve(무환불) 시 held_at NULL 복귀.
- [ ] 세금계산서: 내부 HTML(`/tax-documents/:id/html`) 동작 확인. 바로빌 미설정이면 issue-nts 가 503 `needs_config`(fail-soft) — 정상.
- [ ] 어드민 감사로그: 등급/마진/여신/auto-grade 변경이 `admin_audit_logs` 에 before/after 기록(OPS-1).

---

## 4. 롤백 노트

- **코드 롤백**: Cloudflare Pages → Deployments → 직전 성공 배포로 **Rollback** (즉시 트래픽 전환). worker 코드도 `_worker.js` 포함이라 함께 되돌아감.
- **스키마는 롤백하지 않음**: 추가된 컬럼/테이블/인덱스는 모두 additive(기존 동작 무영향) — 코드만 되돌리면 신규 컬럼은 미사용 상태로 남음. ALTER DROP 시도 금지(D1 위험 + 데이터 유실).
- **여신(BIZ-2) 비상 차단**: 코드 롤백 없이 외상만 막으려면 — 영향 유통사 `PATCH /distributors/:id/credit { distributor_credit_limit: 0 }` 또는 `{ credit_frozen: true }`. 신규 외상 즉시 차단(기존 미수금은 상환으로 정리).
- **auto-grade 비상 정지**: `PATCH /auto-grade/settings { enabled: false }` → cron 즉시 no-op.
- **머니패스 사고 시**: 추측 fix 금지(CLAUDE.md 룰). `supplier_settlements` / `supplier_balances` / `wholesale_credit_ledger` / `ledger_entries` 의 ground truth 를 먼저 덤프 후 1 commit = 1 원인.

> 작성: 2026-06-08. 본 체크리스트의 머니패스 E2E 가 staging 에서 통과되기 전 운영 전환 금지.
