# 💳 결제가 마지막 화면에서 조용히 실패하던 것 — 콜백 주소의 쿼리 (2026-09-13)

대표 신고: *"토스페이먼츠 pg로 결제 중인데 안되고, 딜을 쓰고 결제할지, 딜 일부만 쓰고 결제할지 등
선택도 안돼."* 화면: `결제를 완료하지 못했어요 / 결제 정보가 올바르지 않습니다. / 결제 정보: GB-3-1788967989484`

## 원인 — 한 줄이고, 세 흐름을 같이 깨고 있었다

`TossWidgetPayPage` 가 결제 성공 주소를 `safeInternalPath()` 에 통과시킨다. **그 함수는 쿼리를
통째로 지운다.** 그 삭제는 2026-05-01 에 *카카오 로그인 returnUrl* 의 `?error=...?error=...` 누적을
막으려고 넣은 것이다 — **OAuth 복귀 주소의 규칙**이지 결제 콜백의 규칙이 아니었다.

결제 콜백에서 쿼리는 장식이 아니라 **데이터**다. 토스는 우리가 준 주소에 `paymentKey·orderId·amount`
만 붙여 돌려보내므로, 그 밖의 것은 **우리가 실어 보낸 쿼리로만** 돌아온다.

| 흐름 | successUrl | 잃은 것 | 증상 |
|---|---|---|---|
| 이용권 카드결제 | `/group-buy/confirm-payment?productId=&qty=` | productId·qty | `!productId` → "결제 정보가 올바르지 않습니다" |
| 숙소 예약 | `/stays/checkout-return?order_id=` | order_id | `STAY-{id}` 역산 폴백에 의존 |
| 알림톡 충전 | `/seller/alimtalk?charge=success&orderId=` | charge·orderId | 충전 결과 화면이 안 뜸 |
| 딜 충전 | `/points/charge/success` | 없음 | 무사(쿼리가 없었다) |

🔴 **에러 로그도 실패 알림도 없다 — 마지막 화면만 틀린다.** 그래서 아무도 신고하지 않았고,
라이브 `orders` 의 마지막 행이 **2026-06-26** 인 것이 그 방증이다(석 달째 카드 주문 0건).

## 재현 (추측 아님)

```
보낸 successUrl : /group-buy/confirm-payment?productId=2888&qty=1
토스에 넘긴 값  : https://urdeal.kr/group-buy/confirm-payment        ← 쿼리 증발
토스 리다이렉트 : .../confirm-payment?paymentKey=..&orderId=GB-3-..&amount=5300
confirm 의 productId : 0 → !productId → 에러 화면
```

## 수정

신규 SSOT `safePaymentReturnPath`(`src/utils/safe-internal-path.ts`) — 경로 판정은
`isSafeInternalPath` **같은 함수** 그대로 쓰고, 통과한 뒤 **쿼리를 붙여 돌려준다.**
`TossWidgetPayPage` 는 식별자 2개만 교체(`[UNLOCK]`, 대표 승인 · CLAUDE.md audit log 기재).

**오픈 리다이렉트 방어는 불변**이고, 쿼리도 그대로 믿지 않는다 — `#` 이하 폐기 ·
`URLSearchParams` 왕복 재인코딩 · 길이 상한 1024 · 역슬래시/제어문자는 **쪼개기 전에** 통째 차단.
🔒 금액의 진실은 여전히 `/confirm` 의 서버 재검증이라 **위조 자리는 안 생긴다.**

## 🩸 주입이 내 시험 둘을 "헛돈다" 고 잡았다

1. 오픈 리다이렉트 공격 목록이 전부 **경로**에 나쁜 문자를 넣어서, 쪼개기 전 사전 차단을 통째로
   지워도 초록이었다 — 그 방어가 실제로 일하는 자리는 **쿼리 쪽**이다. 쿼리 공격 3건 추가.
2. 조각 검사를 `not.toContain('#')` 로 썼는데 재인코딩이 `%23` 으로 바꿔 **늘 통과**했다.
   → 모양이 아니라 **값**(`q.get('productId') === '5'`)을 보도록 교체.

## 검증

tsc 0 · 신규 23건 + 기존 safe-internal-path 43건 = 66건 pass · 주입 5건 **되돌려-검증 빨간불 확인** ·
주입 지도 1,012건 성함 · build 0 · theme/sql-bind/anti-slop/file-size GREEN.

## ➡️ 다음 세션 — 첫 액션

1. **staging 실결제 1회** (머니 경로): 이용권 카드 1건 → 승인 후 `/group-buy/confirm-payment` 가
   `productId` 를 받아 `/confirm-toss` 까지 가는지. 그 뒤 `orders` 에 행이 생기는지 D1 확인.
2. 그다음 **딜 선택 UI** — 대표 확정 *"결제 수리 먼저, 선택 UI 는 이어서"*.
   부분결제 게이트(`voucher_partial_deal_enabled`)는 **이미 ON** 이고 서버는 `requested` 인자를
   이미 받는다(`resolvePartialDealPlan`). 없는 것은 **고르는 화면과 그 값을 보내는 배선**뿐이다.

## ⚠️ 이번에 안 건드린 것

- 숙소·알림톡 흐름은 이 수정으로 **함께** 고쳐진다(같은 원인). 다만 각자의 화면을 눈으로 확인한 적은
  없다 — staging 에서 숙소 1건도 같이 밟아 보는 게 좋다.
- `safeInternalPath`(OAuth 용)는 **무접촉**이다. 그 쿼리 삭제는 그 자리에선 여전히 옳다.
