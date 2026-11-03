# [UNLOCK] 2026-11-03 — 숙소 결제 확정에 '이용권 장부 소개 적립' 분기 (게이트 OFF)

- 파일: `src/worker/routes/payment.routes.ts` (잠금표 — /confirm)
- 허가: 대표 2026-11-03 *"잠금 파일도 다 허가해줄테니 순서대로 다 해줘"* → *"계속 진행해"*. 결재 `docs/decisions/2026-11-03-stay-referral-unify.md` 1안.
- 바꾼 것: 숙소 예약 확정 루프에 3줄 — `booking.referrer_id` 가 있고 옛 금액(`influencer_commission_amount`)이 0 이며 `stay_referral_unify_enabled === 'true'` 일 때만 `creditStayReferral`(= `applyGroupBuyReferral`, 이용권과 같은 함수). 동적 import.
- 안 바꾼 것: Toss 승인 호출 · 금액 검증 · 옛 `affiliate_earnings` 적립 블록(그대로 돈다 — 옛 모드 예약은 그대로 옛 장부).
- 이중 적립 방지: 새 분기는 옛 금액이 0 일 때만, 그리고 같은 주문·소개자 attribution 이 있으면 건너뛴다(멱등).
- 역전: `stays-public.routes.ts` 오버부킹 환불·손님 취소, `admin-stays.routes.ts` 어드민 환불에 `clawbackStayReferral` — 같은 커밋.
- 켜기 전: `docs/STAGING_CHECKLIST.md` S-STAYREF 5건.
