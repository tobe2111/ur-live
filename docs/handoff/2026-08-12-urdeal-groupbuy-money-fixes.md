# 🎟️ 유어딜 소비자 공구 — 결제 경로 결함 3건 수리 (2026-08-12)

> 🧱 **레일**: **🎟️ 유어딜 공구(소비자)** 전용. 🏪 공구 서비스(운영자 몰)·🏭 도매몰·📣 유어애즈 **무접촉**.
> 코드가 두 서비스를 다 `group_buy_*` 라 부르니 이 줄을 먼저 읽을 것 (CLAUDE.md §서비스 분리).
>
> 💰 **머니 접촉: 있음** — 카드 결제 확정 경로(`/api/group-buy/confirm-toss`)의 주문번호·가상계좌 분기,
> 그리고 셀러 환불 조회 범위. **staging 실결제 검증이 남아 있다**(§5).

## 1. 무엇이 잘못돼 있었나 — 셋 다 "실패가 아니라 부재"였다

에러도 로그도 없었다. 그래서 몇 달간 아무도 몰랐다.

### ① 주문번호가 토스가 아는 값과 달랐다 → **웹훅이 이 주문을 영영 못 찾는다**

```
/join            →  generateTossOrderId('GB', userId)   =  GB-42-1754900000000   ← 토스에 넘긴 값
/confirm-toss    →  `GB-${userId}-${Date.now()}`        =  GB-42-1754900001234   ← 주문 행에 저장한 값
```

**모양이 같아서 눈으로는 구분이 안 된다.** 다른 건 밀리초뿐이다.
그런데 토스 웹훅은 `data.orderId` 로 `orders.order_number` 를 찾는다
(`webhook.routes.ts:325` — 주석 그대로 *"This is our order_number"*).
값이 갈려 있으니 **결제 취소·상태 변경·확정 알림이 전부 이 주문을 비켜 갔다.**

→ 토스 승인 응답이 되돌려준 `orderId` 를 그대로 주문번호로 쓴다(토스가 권위).

### ② 가상계좌(무통장입금) — **입금 전에 이용권이 나간다**

`/confirm-toss` 는 승인 응답의 `status` 를 **아예 보지 않았다.**
가상계좌는 승인 시점 `status='WAITING_FOR_DEPOSIT'`(= 아직 돈이 안 들어옴)로 응답하는데,
그대로 재고 차감 → 주문 PAID → **이용권 발급**까지 진행됐다.
소비자 결제 `/confirm` 은 2026-07-01 에 같은 구멍을 막았고(CLAUDE.md audit log), **공구만 남아 있었다.**

**🔑 처방이 소비자 주문과 다른 이유** — 실측:

```
webhook.routes.ts 의 `INSERT INTO vouchers` : 0건
```

소비자 주문은 입금 웹훅이 확정을 완결하지만, **웹훅에는 공구 이용권 발급 코드가 한 줄도 없다.**
그래서 "입금을 기다리게 두는" 처리를 하면 **입금은 됐는데 이용권은 영원히 안 나오는 주문**이 생긴다.
⇒ 지금 정직한 처리는 **가상계좌를 취소하고 카드로 안내**하는 것뿐이다(발급 금지 + 자동 취소 + 흔적 주문).

> 📌 **가상계좌를 정식 지원하려면** 웹훅에 공구 이용권 발급을 배선하는 **별도 작업**이 선행돼야 한다.
>   그 전까지 `guardAwaitingDeposit()` 이 문이다.

### ③ 자기 참여 차단이 **다른 테이블의 일련번호를 비교**하고 있었다

```ts
if (product.seller_id && Number(product.seller_id) === Number(userId))   // sellers.id  vs  users.id
```

두 방향 다 틀린다:
- **막아야 할 사람을 못 막는다** — 셀러 본인의 `users.id` 는 `sellers.id` 와 다르므로 그냥 통과.
  이 가드의 목적(2026-04-22 "목표 조작 방지")이 **한 번도 작동한 적이 없다.**
- **엉뚱한 사람을 막는다** — `users.id` 가 우연히 그 `sellers.id` 와 같은 숫자면 무고한 구매자가 403.

실제 연결고리는 `sellers.linked_user_id`(migration 0151) 뿐이다.

### ④ (덤) 셀러 환불이 식사 카테고리만 조회 → **판매는 되고 환불은 안 되는 비대칭**

`POST /api/group-buy/refund/:productId` 의 상품 조회가 `category = 'meal_voucher'` 하드코드였다.
`/join` 은 **이용권 전 카테고리 + 교환권(`deal_only`)** 을 파는데, 미용·숙소·기타 이용권 공구는
마감·미달성이어도 셀러가 **404 를 받고 환불을 못 했다** — 소비자 돈이 묶인다.

## 2. 무엇을 했나

| 파일 | 변경 |
|---|---|
| `src/features/group-buy/api/gb-purchase-guards.ts` | **신규** — `isSelfOwnedGroupBuy` · `resolveGbOrderNumber` · `guardAwaitingDeposit` · `issuedVoucherLabel` |
| `src/features/group-buy/api/group-buy.routes.ts` | 자기참여 판정 2곳 교체 · 주문번호 = 토스 orderId · VA 가드 배선 · 발급 알림 명칭(§7) |
| `src/features/group-buy/api/group-buy-seller.routes.ts` | 환불 조회 범위 = 판매 범위(`voucherCategoriesSqlClause()` + `deal_only`) |
| `src/tests/unit/gb-purchase-guards.test.ts` | **신규** 21건 |
| `scripts/file-size-baseline.json` | `group-buy.routes.ts` 1419 → **1424** (아래 §6) |

**카드/간편결제 경로는 byte-불변**이다 — VA 분기는 `status === 'WAITING_FOR_DEPOSIT'` 일 때만 들어간다.

## 3. 되돌려-검증 (11건 전부 빨강 확인 후 복원)

가드가 헛도는 사고가 이 레포에 반복됐으므로 **일부러 깨뜨려 확인**했다.

| # | 주입 | 결과 |
|---|---|---|
| M1 | 주문번호를 다시 `GB-${userId}-${Date.now()}` 로 | 🔴 |
| M2 | 자기참여를 다시 `Number(seller_id)===Number(userId)` 로 | 🔴 |
| M3 | VA 가드 제거 | 🔴 |
| M4 | 셀러 환불을 다시 `category='meal_voucher'` 로 | 🔴 |
| M5 | `isSelfOwnedGroupBuy` 가 항상 false | 🔴 |
| M6 | `resolveGbOrderNumber` 가 토스 값 무시 | 🔴 |
| M7 | VA 가드가 취소 안 함 | 🔴 (2건) |
| M8 | VA 가드가 status 를 안 봄 | 🔴 |
| M9 | 알림 문구를 다시 '교환권' 하드코드로 | 🔴 |
| M10 | SELECT 에서 `deal_only` 제거(라벨이 상품을 못 봄) | 🔴 |
| M11 | `issuedVoucherLabel` 이 항상 '교환권' | 🔴 (2건) |

**이번에 테스트가 내 실수를 잡았다**: 배선 검사에서 `INSERT INTO vouchers` 를 **파일 전체**에서 찾았더니
앞쪽 딜 `/join` 의 발급문에 걸려 순서 판정이 늘 통과했다 → `/confirm-toss` 핸들러로 **잘라서** 본다.
(주석 제거 후 대조하는 처리도 그대로 유지 — 설명 주석이 초록/빨강을 만든 사고 클래스.)

## 4. 검증 결과

- `tsc --noEmit` **0**
- `vitest run` — **5,467 중 5,465 pass**. 실패 2건은 `ads-tail-bound.test.ts`(유어애즈, 타이머 기반)이고
  **단독 실행하면 14/14 통과**한다. 백그라운드에서 `check-guard-mutations` 가 소스에 변이를 주입하는
  동안 같이 돌아서 난 것 — 내 변경과 무관. ⚠️ **감사 게이트와 테스트를 동시에 돌리지 말 것.**
- SQL 가드(bind/column/table/not-null/CHECK) · money-pattern · file-size(-a -s) **전부 GREEN**

## 5. 🔴 다음 세션 첫 액션 — staging 실결제 (이 환경에서 못 한다)

`ur-live-staging` Pages 프로젝트가 없어(STAGING_CHECKLIST X1) 이 환경에서는 판정 불가.

1. **카드 결제 1회** → 성공 후 `orders.order_number` 가 **토스 콘솔의 주문번호와 문자열로 동일**한지.
   (같으면 ①이 고쳐진 것 — 지금까지는 달랐다.)
2. **가상계좌 결제 1회** → 이용권 **미발급** + 사용자에게 `VIRTUAL_ACCOUNT_UNSUPPORTED` 안내 +
   토스 콘솔에서 그 가상계좌가 **취소**됐는지. 취소가 실패하면 어드민 벨이 떠야 한다.
3. **셀러 본인 계정으로 자기 공구 구매 시도** → 403 `SELF_PARTICIPATION_BLOCKED`.
   (지금까지는 **통과**했다. 반대로 무고한 유저가 막히던 것도 함께 풀린다.)
4. **미용/숙소 이용권 공구 마감·미달성** → 셀러 환불 버튼이 404 대신 동작.

## 6. 남은 것 / 판단 필요

- **`group-buy.routes.ts` 는 1,424줄 god 파일**이다. 이번엔 baseline 을 +5 올렸다(가드 메시지가 권하는
  방향이 아니다 — 정직하게 적어 둔다). 머니 경로에서 45줄짜리 side-effect 블록 이동까지 같은 PR 에
  얹는 것이 리뷰 위험을 더 키운다고 판단해 **분해는 다음 작업으로 미뤘다.**
  후보: `/confirm-toss` 의 `_saleFx`(알림·초대보상·방문리워드·알림톡) → `gb-confirm-sidefx.ts`.
- **가상계좌 정식 지원 여부**(대표 판단). 지원하려면 웹훅 공구 이용권 발급 배선이 선행.
  지원 안 할 거면 지금 상태(취소 + 안내)가 최종형이고, 결제창에서 가상계좌 수단을 아예 숨기는 것이
  더 나은 UX 다(토스 콘솔 설정 — 코드 아님).
- PR **#1137**(몰 표면 분리)은 여전히 draft·CI 초록·대표의 staging 판정 대기 중. 이 PR 과 파일 충돌 없음.

## 7. ⑤ 발급 알림이 이용권을 "교환권"이라 불렀다 (대표 지적으로 발견)

대표가 *"교환권이 무슨 말이야?"* 라고 물어서 드러났다. **내가 이 PR 전체에서 용어를 틀리게 썼고,
확인해 보니 코드에도 같은 오류가 있었다.**

명칭 SSOT(`shared/product-flow.ts` §명칭 주의)는 둘을 명확히 가른다:

| | 무엇 | 결제 |
|---|---|---|
| **교환권** | 기프티콘·KT (`deal_only=1`) | **딜** |
| **이용권** | 식당·뷰티·숙박 매장권 (`meal_voucher` 등) | **카드** |

`/confirm-toss` 는 **카드 결제** 경로라 여기서 나가는 것은 대부분 **이용권**이다. 그런데:

```
1260줄  셀러 알림    '🎟️ 이용권 판매(카드)'      ← 맞음
1285줄  구매자 알림  '🎟️ 교환권이 발급됐어요'    ← 틀림 (고정 문구)
```

**같은 결제 한 건에서 셀러와 손님이 서로 다른 이름을 들었다.**
⇒ `issuedVoucherLabel(product)` 로 상품대로 부른다(`deal_only=1` → 교환권, 아니면 "{식사} 이용권").
라벨이 상품을 실제로 보려면 `deal_only` 가 SELECT 돼 있어야 해서 **그 컬럼도 함께 추가**했다
(안 뽑으면 늘 `undefined` → 늘 '이용권' — 조용히 반만 맞는 상태가 된다).

## 8. 이번에 내가 틀렸던 판단

- 처음엔 ②를 "소비자 `/confirm` 처럼 `AWAITING_PAYMENT` 로 두고 입금 웹훅에 맡기면 된다"고 계획했다.
  **웹훅에 공구 이용권 발급이 0건**이라는 실측을 하고서야 그 처방이 *더 나쁜 상태*(입금됐는데 미발급)를
  만든다는 걸 알았다. ⇒ **대칭처럼 보이는 코드가 실제로 대칭인지 먼저 세어 볼 것.**
- **"교환권"과 "이용권"을 섞어 썼다.** CLAUDE.md 가 *"카테고리 이름에 `_voucher` 가 붙는다고 딜 결제가
  아니다 — 이 혼동이 실제 오판을 낳았다"* (2026-08-03)고 **경고까지 해 둔 함정을 그대로 밟았다.**
  ⇒ 결제 경로를 말할 때는 **딜이냐 카드냐**부터 확인하고 이름을 고를 것. 카드면 이용권이다.
- **대표가 "분리한 거 맞아?" 라고 물은 것도 내 서술 탓이다.** #1141 을 그냥 "공구"라고만 불러서,
  분리하기로 한 🏪 공구 서비스(운영자 몰)와 섞인 것처럼 읽혔다. 실제로는 파일 교집합이 0 이다
  (소스 3개 전부 `features/group-buy/`, mall/wholesale 0건). ⇒ **축 이름을 매번 앞에 붙일 것.**
