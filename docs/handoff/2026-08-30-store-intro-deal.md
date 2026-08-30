# 2026-08-30 — 매장 영입 보상을 딜로 (게이트 OFF 배선)

## 대표 지시
> "매장 영입도 딜로 쌓아줘."

소개자가 버는 길이 셋인데 **둘은 딜, 하나만 현금**이라 화면에서 말이 갈렸다.
매장 영입(2%·1년)도 딜로 쌓이게 배선했다. **기본 OFF** — 켜는 것은 대표 판단.

## 무엇을 했나
- `src/worker/cron/influencer-payout.ts` — 성숙(T+7) 시점에 `store_intro_payout_in_deal` 게이트가
  `'true'` 면 현금 잔고 대신 **딜 적립**(`adjustUserPoints`, type `store_intro_commission`).
  **claim-before-credit**: `status='pending' → 'paid'` CAS 를 먼저 잡고(`changes===1` 만 통과),
  딜 적립이 실패하면 `pending` 으로 되돌린다(이중적립·유실 둘 다 0).
  적립 성공 시 인앱 알림 1건(`/u/me/earnings`).
- `platform-settings-validation.ts` — `store_intro_payout_in_deal: boolStr` 등록.
- `influencer-store-intro-commission.ts` — **거짓 주석 정정**: "payout cron 이 딜 분기 처리" 라고
  적혀 있었는데 그런 분기는 없었다(이번에 실제로 만들었다).
- `src/tests/unit/store-intro-deal-payout.test.ts` 6건 + `check-guard-mutations` 주입 3건.

## 다음 세션 첫 액션
1. **게이트를 켜기 전에 세금 처리를 확정할 것.** 현금 경로는 `withholdAndLog` 로 3.3%/8.8%
   원천징수를 하는데 **딜 경로는 원천징수가 없다.** 딜을 "적립금"으로 볼지 "소득 지급"으로 볼지에 따라
   달라진다 — 이건 코드가 아니라 대표/세무 판단이다. `docs/STAGING_CHECKLIST.md` S8 에 경고로 박아 뒀다.
2. 켜는 법: `platform_settings.store_intro_payout_in_deal = 'true'`(어드민 정책 대시보드).
   끄면 즉시 현금 경로로 복귀 — 이미 딜로 나간 건은 되돌아가지 않는다(단방향).
3. 판정: 성숙된 `influencer_attributions(source='store_intro')` 행이 `paid` 로 바뀌고
   `user_points` 가 같은 금액만큼 늘었는지.

## 이번에 틀렸던 판단
- 소스 주석을 믿고 "딜 분기는 이미 있다"고 생각했다. **없었다.** 주석이 약속만 하고
  구현이 안 따라온 케이스(이 레포에서 이번 주에만 세 번째). 주석을 근거로 쓰지 말 것.

## 남은 결정(대표)
- `max_influencer_commission_pct = 2` — 딜 계약 제안 자체가 이 상한에 막힌다
  (`marketing.routes.ts:336`·`:451` 양방향 400). 얼마로 올릴지는 대표 판단.
- `influencer_payout_min = 100,000` — 현금 경로 전용. 딜로 전환하면 이 문턱이 무의미해진다.
