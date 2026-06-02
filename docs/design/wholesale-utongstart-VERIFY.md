# 유통스타트 도매몰 — 스테이징 머니플로우 E2E 검증 런북

> 목적: **돈이 도는 경로**(주문→Toss 선결제→제조사 정산 적립→송장→반품 환불→정산 역전)를
> 실제 Toss 테스트키 + 시드 데이터로 한 번 끝까지 검증. 로컬 `wrangler dev` 로는 불가(Toss키·스키마),
> 스테이징(또는 Toss 테스트키 연결된 프로덕션 격리 환경)에서 수행.
>
> 자동화 가능 부분: `scripts/wholesale-smoke.sh`. 결제 승인(브라우저 위젯)만 수동.

## 0. 전제
- `live.ur-team.com`(또는 스테이징) 배포 완료 + **Toss 테스트 시크릿/클라이언트 키** 설정.
  - Cloudflare Pages `ur-live` → Variables: `TOSS_SECRET_KEY`(test_sk_…), `TOSS_CLIENT_KEY`(test_ck_…).
- 어드민 / 유통사(셀러) / 제조사(공급자) 각 계정 + JWT 확보.

## 1. 스키마 반영
```
POST /api/_internal/repair-schema   (또는 /admin/health "스키마 복구")
```
확인 대상: `distributor_grades`, `wholesale_orders`, `wholesale_order_items`,
`wholesale_proposals`, `sellers.distributor_grade/special_discount_until`,
`supplier_settlements.source`, `wholesale_orders.refunded_amount`.

## 2. 시드 데이터
1. **제조사**: `/supplier/register` 가입 → `/admin/suppliers` 에서 승인(status='approved').
2. **도매 상품**: 제조사가 공급상품 등록 — `is_supply_product=1`, `supply_price>0`(예: 10,000),
   `supplier_id=<제조사>`, `supply_source_id IS NULL`, `is_active=1`, `stock>0`.
3. **유통사 등급**: `/admin/distributor-grades` → 유통사 검색 → 등급 배정(예: B = 마진 15%).

## 3. 자동 스모크 (결제 직전까지)
```
BASE_URL=https://live.ur-team.com \
SELLER_TOKEN=<유통사 JWT> ADMIN_TOKEN=<admin JWT> \
bash scripts/wholesale-smoke.sh
```
기대: 등급 조회 / 카탈로그 / **주문금액 = 등급공급가×수량(서버 재계산 일치)** / 금액위조가드(400) /
목록·거래내역서·어드민 모니터 노출. (B등급·공급가1만·수량2 → 23,000원)

## 4. 실제 결제 (수동 — 브라우저)
1. 유통사로 로그인 → `/wholesale` → 상품 → 수량 선택 → **주문하기** → `/wholesale/checkout`.
2. Toss 위젯에서 **테스트 카드**로 결제 → `/wholesale/success` 로 redirect → "주문 완료".
3. 확인: `/wholesale/orders` 에서 해당 주문 **결제완료(PAID)**.

### 4-1. 정산 적립 검증 (SQL 또는 제조사 대시보드)
- 제조사 로그인 → 대시보드 **알림 "새 도매 주문"** 수신 확인 + 정산 탭에 도매 정산 노출.
- SQL:
  ```sql
  SELECT supplier_id, order_id, supply_amount, status, source
  FROM supplier_settlements WHERE order_id=<wholesale_order_id> AND source='wholesale';
  -- supply_amount == supply_price×qty (제조사 공급가), status='pending'
  SELECT pending_amount FROM supplier_balances WHERE supplier_id=<제조사>;  -- 증가 확인
  ```
- **마진 검증**: `wholesale_orders.margin_total == subtotal - supply_total` (= 플랫폼 수익).

## 5. 송장 (제조사)
1. 제조사 → `/supplier/wholesale-orders` → 해당 주문 라인 → 택배사+운송장 입력 → **송장등록**.
2. 확인: 유통사 `/wholesale/orders` 주문이 **발송완료(SHIPPED)** + 송장 표시.

## 6. 반품/환불 (제조사 부분환불)
1. 제조사 → `/supplier/wholesale-orders` → 발송된 라인 → **반품/환불**.
2. 확인:
   - Toss 대시보드(테스트)에서 **부분취소** 기록.
   - 주문 상태: 전 라인 환불 시 **REFUNDED**, 일부면 **PARTIAL_REFUNDED**.
   - 재고 복원: `products.stock` 원복.
   - 정산 역전:
     ```sql
     SELECT status FROM supplier_settlements WHERE order_id=<id> AND source='wholesale';
     -- 해당 제조사 라인 status='cancelled'
     SELECT pending_amount FROM supplier_balances WHERE supplier_id=<제조사>; -- 차감 확인
     ```

## 7. 어드민 강제환불 (분쟁 개입)
1. 어드민 → `/admin/wholesale-orders` → 주문 클릭 → **관리자 강제 전액환불**.
2. 확인: 남은 잔액 Toss 부분취소 + 전 라인 REFUNDED + 정산 전체 역전 + 재고 복원.

## 8. 동시성/멱등 (선택, 고급)
- **Oversell**: stock=1 상품에 수량 1 주문 2건 동시 결제 → 한 건 성공, 다른 건 **409 OVERSOLD + 자동환불**.
- **멱등**: 같은 confirm 2회 → 두 번째 `already:true`, 정산/재고 중복 없음.

---

## 체크리스트
- [ ] 1 스키마 반영
- [ ] 2 제조사/상품/등급 시드
- [ ] 3 스모크 스크립트 통과
- [ ] 4 실제 결제 → PAID + 정산 pending 적립 + 마진 일치
- [ ] 5 송장 → SHIPPED
- [ ] 6 부분환불 → 상태/재고/정산 역전
- [ ] 7 어드민 강제환불
- [ ] 8 (선택) oversell 자동환불 + 멱등

> 모두 통과 시 머니플로우 E2E 검증 완료. 결과를 `docs/CURRENT_WORK.md` 에 기록.
