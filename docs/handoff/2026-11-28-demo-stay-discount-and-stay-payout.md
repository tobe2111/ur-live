# 2026-11-28 · 데모 숙소 할인율 다양화 + 숙소 정산 주기 조사

**서비스: 유어딜(소비자)** · 머니 경로: 할인율은 없음(데모 숙소 정가 표시만, 판매가 불변) · 롤백 revert.

## 배경
- 숙소 사장님(플레이가비): *"앱에 있는 숙소들이 다 23%라서 생긴 지 얼마 안 된 플랫폼이냐"* + *"매주 목요일 정산이면 체크인 후 길게는 일주일 뒤 입금 — 숙소는 보통 체크인 다음 날 정산"*.
- 대표: *"예시로 둘 수는 없을 것 같고 할인율이 좀 변경은 있어야 할 것 같아 다양하게."* · *"정산이 더 빨라질 수 있어? 토스페이먼츠 정산일이 있어서 어렵지 않나?"*

## 한 것 — 할인율
- 원인: 데모 숙소 시드가 정가 = 판매가 × 1.3 → 언제나 23%. 라이브 실측: 활성 데모 숙소 20개 중 18개가 23%(모두 `seller_id` 없음, `slug demo-stay-*`).
- `src/features/admin/api/admin-stays/demo-stay-discount.ts`: 숙소마다 정해진 할인율(12~35%, 23% 제외) · 옛 × 1.3 정가만 골라 고치는 `healDemoStayDiscounts`.
- `admin-stays.routes.ts` 세 곳의 × 1.3 → helper · `POST /api/admin/stays/seed-demo {"count":0}` = 새 숙소 없이 치유만.
- 가드 `demo-stay-discount-2026-11-28.test.ts`(6건, 되돌려-검증 확인).

## 이어받는 세션의 첫 액션(대표가 이 작업을 이어서 하라고 했을 때만)
- 배포 뒤 `POST /api/admin/stays/seed-demo {"count":0}` → 응답 `discountHealed` · D1 `SELECT ROUND(100.0*(original_price-price)/original_price) pct, COUNT(*) FROM products WHERE slug LIKE 'demo-stay-%' AND is_active=1 GROUP BY pct` 에 23 몰림이 없으면 E4.

## 조사 — 숙소 정산(코드 실측)
- 숙소 대금은 **체크인(이용권 사용) 순간** 장부에 매장 몫으로 적힌다(`stay-voucher-unify.ts` → `redeemVoucherForStore`).
- 그 뒤 **역일 14일 보류**(`payout-hold.ts`, 대표 확정 영업일 10일) → 월요일 09:45 지급 대기 건 생성 → 어드민 승인·이체.
  ⇒ 실제로는 체크인 후 **약 2~3주**(사장님이 생각한 "길게는 일주일" 보다 길다). 결재 `2026-11-25-store-payout-thursday-vs-hold.md`(open)와 같은 문제.
- 토스는 카드 대금을 **결제일 기준 약 5영업일 뒤** 우리에게 준다(레포 기록, 계약서로 재확인 필요). 숙소는 대개 체크인보다 훨씬 먼저 결제한다
  ⇒ 체크인 시점엔 대부분 이미 입금돼 있다. 보류 기준을 "적립일 + 14일" 에서 "결제일 + 5영업일 이후 & 체크인 다음 날" 로 바꾸면 숙소는 다음 날 정산이 가능하다.
- 결정은 결재 `docs/decisions/2026-11-28-stay-next-day-payout.md`.

## 2026-11-28 후속 — 이용권 결제일 기준 유보(1단계)
- `src/worker/utils/payout-hold.ts`: `voucher_used` 적립 = max(사용 다음 날, `vouchers.created_at`+7일) · 그 밖 적립은 14일 그대로 · 이용권 행 없으면 14일(fail-closed).
  설정 `payout_voucher_paid_hold_days`(검증 등록). 컬럼을 `ledger_entries.` 로 한정(서브쿼리 안 오독 방지).
- 가드 `payout-voucher-paid-hold-2026-11-28.test.ts`(8건, 실제 payoutCreditsSql·SQLite, 되돌려-검증 확인) · `payout-cycle-full` 시험의 시간 여행에 발급 시각도 함께 민다.
- 효과 예: 미리 결제한 숙소 → 체크인 다음 날 이후 첫 월요일 생성 → 목요일 이체(최대 약 1주) · 당일 구매 식당 → 결제 7일 후.
- 🩸 틀렸던 판단: 처음엔 "숙소만" 으로 설계했는데 규칙(토스 입금 후 + 사용 후)은 이용권 종류와 무관하다 — 대표 질문으로 일반화.
- 남은 것(2단계): 월·목 생성·이체 + 안내 문구(`partners-facts.storePayoutDay` · `PayoutSheet` · FAQ · 입금 예정 알림) — 대표 이체 요일 확정 필요.
