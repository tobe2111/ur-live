# 2026-09-02 — 리뷰 자격: 이용권은 "사용한 사람만" (별도 브랜치)

**레일**: 🎟️ 유어딜(소비자) · **머니 경로**: 없음(결제·정산·원장 무접촉 — 단, 리뷰 **리워드 딜 지급 조건**이 바뀐다) · **롤백**: `reviews.routes.ts` 의 `flow === 'group_buy_toss'` 분기 제거(+import)

대표 *"리뷰는 이용권 사용한 사람만 쓸 수 있게끔 되어있지?"* → **아니었다**. 게이트는 '구매'(orders.status)만 봤고, 이용권은 결제
즉시 DONE 이라 매장에 가기 전에도 리뷰·리워드가 났다. 사용 기록(`vouchers.status='used'`)은 있었는데 리뷰가 안 봤다.

**수정** (`src/features/reviews/api/reviews.routes.ts`):
- 종류 판정 = 결제수단 SSOT `getProductFlow` (카테고리 이름으로 안 가른다 — CLAUDE.md 🚦 절의 함정).
- 이용권(`group_buy_toss`): `vouchers WHERE product_id·user_id·status='used'` 1장 이상. 없으면 403 `VOUCHER_NOT_USED`
  "이용권을 사용한 뒤에 리뷰를 쓸 수 있어요". 리워드 주문 = 사용한 그 장의 `order_id`.
- 교환권(`voucher_deal`)·쇼핑: 종전 구매 게이트 그대로. 어드민 예외·셀러 self-review 차단 불변.
- 클라(`ProductReviews.tsx`): `VOUCHER_NOT_USED` 도 서버 문구 그대로 토스트(기존 403 분기에 code 추가만).

**가드**: `review-requires-voucher-use.test.ts` 4건 + 주입 1건(되돌려-검증 빨간불 확인).
**staging**: `docs/STAGING_CHECKLIST.md` **P9** — 사용 전 403 + 리워드 0 / 사용 후 등록 + 리워드 1회.

**다음 세션 첫 액션**: 배포 후 이용권을 사서 **사용 전** 리뷰 → 403 문구, 매장 사용 후 → 등록·리워드 1회. 교환권 리뷰가 여전히 구매만으로 되는지 1회.
**Notion**: 미기록.
