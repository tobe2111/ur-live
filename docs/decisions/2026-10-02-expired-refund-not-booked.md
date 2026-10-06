# 만료 이용권을 환불하고도 주문 장부에 안 적어서 **같은 돈을 또 환불할 수 있다** — 고칠까요?

상태: open
등급: C
역할: finance
올린 날: 2026-10-02
기한: 2026-10-05

## 질문

🔴 **환불 경로**(등급 C — 승인 전 코드 미변경).

만료 환불 cron 이 소비자에게 돈을 돌려줄 때 **`orders.refunded_amount` 도 같이 올리도록** 고칠까요? (예 / 아니오)

## 근거 (실측 2026-10-02 03:20 KST — 라이브 D1 + 소스)

어젯밤 만료 환불이 **처음으로 실제로 돌았다**(결재 `archive/2026-09-30-expired-voucher-refund-stolen.md`
E4 통과). 그 판정 중에 드러났다 — **돈은 나갔는데 주문 장부는 0 이다.**

| 무엇 | 값 |
|---|---|
| 이용권 1 (`UR-UR66-YDAZ`) → user 3 | **+1,800딜 입금됨** (`point_transactions` id=33, 10-02 03:00:30 KST) |
| 주문 85 (`deal_points`, 총액 1,800, `DELIVERED`) | `refunded_amount` = **0** |
| `grep refunded_amount src/worker/cron/auto-settlement.ts` | **0건** — 딜 환불이 `adjustUserPoints` 를 직접 부른다 |

**그 칸이 전액환불 경로의 상한이다.** `order-refund.ts:189` 가
`amount = total_amount − refunded_amount` 로 환불액을 정하므로, 지금 주문 85 를 환불하면
`1800 − 0 = 1800` 이 **또** 나간다(`isDeal` → `refundDealPoints`). ⇒ **1,800 받고 3,600 환불.**

누를 수 있는 자리가 셋이다 — 어드민 `admin-orders.routes.ts:334` · 셀러 `seller-orders.routes.ts:341`
· 주문 `order.routes.ts:1033`. 셋 다 `vouchers.refund_status` 를 **보지 않는다**
(`grep voucher src/worker/utils/order-refund.ts` = 1건, 무관한 import).

🔑 **다른 환불 경로는 전부 이 칸을 올린다** — `refund.ts:189` · `order-refund.ts:335` ·
`voucher-partial-refund.ts:90` · `order.routes.ts:838`(CAS 상한). **만료 환불만 빠져 있다.**
즉 규칙이 없는 게 아니라 **한 자리가 규칙 밖에 있다.**

**지금 손해는 0이다.** 해당 주문은 대표 테스트 계정(user 3)이고, 누군가 그 주문에 환불을 눌러야
발생한다. 하지만 상한 CAS 는 바로 그 사람 실수를 막으려고 있는 장치다.

## 선택지

1. **만료 환불 성공 시 `refunded_amount` 를 누적한다** — `outcome='refunded'` 직후
   `UPDATE orders SET refunded_amount = COALESCE(refunded_amount,0) + ? WHERE id = ? AND COALESCE(refunded_amount,0) + ? <= total_amount`(다른 경로와 같은 CAS 모양).
   장점: 상한이 즉시 선다 — 두 번째 환불이 `amount=0` 이 되어 구조적으로 못 나간다. 기존 네 경로와 같은 문법.
   단점: 이용권 **여러 장이 한 주문**인 경우 장당 누적이라 합이 총액을 넘을 수 있다 → CAS 의 `<= total_amount` 가 막지만
   그때 **환불은 이미 입금된 뒤**라 장부가 뒤처진다(기록 누락 쪽으로 안전하게 실패).
   머니 접촉: **있음**(환불 상한이 생긴다 = 의도한 변화. 입금 금액 계산은 불변).
2. **전액환불 경로가 `vouchers.refund_status` 를 보게 한다** — 이미 환불된 이용권 금액을 차감.
   장점: 장부와 무관하게 정확하다. 단점: 조건이 **세 자리**(어드민·셀러·주문)에 흩어져 다음 세션이 또 어긋낸다 —
   이 사고의 원래 원인이 정확히 "같은 판단이 자리 셋에 흩어진 것"이었다.
3. **아무것도 안 한다** — 첫 실손님 만료 환불 뒤 누가 그 주문에 환불을 누르면 두 배가 나간다. 알림·에러 없음.

## 기본안 (답이 없을 때 권하는 것 — 자동 실행되지 않는다)

**1번.** 이 레포의 다른 환불 네 곳이 이미 그 문법을 쓰고 있어 **규칙 밖에 있던 한 자리를 규칙 안으로**
넣는 일이다. 2번은 판단을 또 흩뜨린다.

⚠️ **가드는 수리와 같은 커밋에 박는다.** 지금 박으면 둘 중 하나가 된다 — 빨간불(아직 안 고쳤으니)이거나,
*"만료 환불은 이 칸을 안 쓴다"* 를 단언해 **결함을 정답으로 동결**한다(2026-09-30 에 실제로 겪은 클래스).
수리와 함께 갈 가드: 실제 sqlite 에 주문 1건 + 이용권 1장을 넣고 **cron SQL → 전액환불 계산**을 순서대로
돌려 **두 번째 환불액이 0** 인지 센다(`expired-voucher-refund-2026-09-30.test.ts` 와 같은 방식) + 주입 되돌려-검증.

## 롤백

1번: 추가한 UPDATE 1블록 제거. 2번: 세 자리의 차감 조건 제거. 둘 다 배포만으로 즉시(게이트 없음).

## 결정 (대표가 한 말 그대로)

## 반영 커밋
