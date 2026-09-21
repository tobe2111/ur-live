# 셀러 주문 상세 — 사진·주문번호·이용권 (2026-09-21)

대표 신고(`/seller/orders` 주문 상세 모달 스크린샷):
> *"주문 상세 부분 뭐야. 이미지도 안나오고. 주문번호 너무 복잡해. 그리고 어떤 이용권인지도 나와야지"*

## 다음 세션의 첫 액션

**① 배포 후 라이브 판정(E4)** — `urdeal.kr/seller/orders` 에서 주문 `GB-3-1789611467065` 상세를 연다. 셋을 본다:
- 상품 사진이 뜨는가(종전 `No Image`) — 그 상품(id 2915)은 `products.image_url` 에 사진이 있고
  `order_items.product_image` 는 NULL 이다. **폴백이 실제로 도는지가 판정 대상.**
- 주문번호가 `#467065` + 아래 작은 전체번호로 보이는가(표에서 줄바꿈이 사라졌는가).
- 이용권 `UR-LUBA-RCP5` 와 `미사용` 배지가 뜨는가.

**② 아래 "대표 판단 대기" 의 `payment_status` 건을 올릴 것.** 이번 PR 은 화면만 고쳤고
데이터는 그대로다.

## 이번에 한 것 (PR — 머니 무접촉)

| 증상 | 진짜 원인 | 수리 |
|---|---|---|
| 사진이 `No Image` | 서버는 `product_image`, 화면은 `image_url` — **이름이 갈렸다**. 게다가 이용권 주문의 스냅샷은 라이브에서 전부 NULL | `order-list-enrich` 가 `image_url` 로 싣고, 비면 `products.image_url` 로 채운다. 모달은 `cfImage` + `cfImageOnError`(죽은 `via.placeholder.com` 제거) |
| `GB-3-1789611467065` | 그 값은 **토스가 아는 orderId**(`generateTossOrderId`)라 못 바꾼다 | 표시 SSOT `shared/order-number-display.shortOrderNo` → `#467065`. **전체 번호는 계속 보인다**(감추면 셀러↔어드민↔토스 번역 문제). 꼬리를 따므로 목록 검색에 그대로 걸린다 |
| 어떤 이용권인지 안 보임 | `vouchers` 를 아예 안 실었다 | 서버가 `o.vouchers` 를 붙이고 모달이 코드·사용여부·기한을 그린다. **없으면 필드를 안 붙인다** — 빈 배열은 "0장"이라는 단언이라 조회 실패와 구분해야 한다 |
| `결제상태: pending`(영문) | 아래 별건 참조 | 그 칸을 **결제수단**(카드/딜)으로 교체. 표·모달·CSV 가 같은 SSOT(`usePaymentMethodText`) |

덤: CSV 에 **이용권 코드** 열 추가(이용권 셀러에게 가장 쓸모 있는 열인데 없었다).

가드: `src/tests/unit/seller-order-detail-2026-09-21.test.tsx` 20건 +
주입 `scripts/mutations/seller-order-detail.mjs` 8건 — **되돌려-검증 8/8 빨간불 확인**.

### 이번에 틀렸던 판단
- 주입 러너가 내 시험 하나를 **헛돈다고 잡았다**: "이용권 없는 주문엔 필드를 안 붙인다" 의 픽스처가
  `vouchers: []` 였는데, 그러면 함수가 `results.length === 0` 에서 **일찍 반환**해 그 분기를 안 탄다.
  다른 주문에는 권이 있게 픽스처를 고친 뒤에야 빨간불이 떴다.
- 주문번호의 `3` 을 처음에 **상품 id 로 오독**했다(실제 상품은 2915). `{접두}-{유저id}-{타임스탬프}` 다.

## 🔴 대표 판단 대기 — `orders.payment_status` 가 공구 결제에서 안 찍힌다

**증상보다 결과가 크다.** `group-buy.routes` 의 주문 INSERT 는 `status='PAID'` 만 쓰고
`payment_status` 를 안 써서 기본값 `'pending'` 에 머문다. 라이브 실측:

```
PAID/DONE/DELIVERED  +  payment_status='pending'   →  4건
CANCELLED            +  payment_status='pending'   →  57건
```

그 값을 `'approved'` 로 읽는 곳들이 이 주문을 **통째로 비켜 간다**:
- 🔴 **소비자 환불 요청이 막힌다** — `order.routes.ts:801` 이 `payment_status !== 'approved'` 면
  *"결제가 완료되지 않은 주문입니다"* 로 400. 손님은 돈을 냈는데 앱에서 환불을 못 건다.
  (셀러가 대신 하는 `refundOrderFully` 경로는 이 검사가 없어 **된다**.)
- 매출 집계에서 누락 — `ops-daily-digest`(어제 매출) · `seller-daily-report` · `seller-tier-eval` ·
  `anomaly-detect` · `daily-self-diagnostic`.
- 셀러 온보딩 `first_payment` 가 영영 안 켜진다.

**수리 방향은 이미 레포 안에 선례가 있다** — `order.repository.ts:604` 주석
*"2026-04-22 payment_status='approved' 동기화 — 이전엔 status=DONE 이어도 pending 인 채 남아서
환불/정산 로직 오작동"*. 쇼핑 경로는 그때 고쳤고 **공구 경로만 안 고쳐졌다.**

⚠️ 그래도 이번 PR 에 섞지 않았다. 환불 게이트를 여는 변경이라 **머니 경로**이고,
CLAUDE.md 가 요구하는 **단독 세션 + staging 실결제**가 붙는다. 기존 4건의 backfill 도 별도
(코드 경로 경유 — `repair-schema`, 일회성 SQL 금지).

## 남은 것
- 🔴 위 `payment_status` 건(단독 세션).
- 🟡 소비자 `/my-orders` 주문번호는 그대로 전체 번호다. 셀러 쪽이 전체를 계속 보여 주므로 불일치는
  없지만, 같은 짧은 번호를 양쪽에 쓰면 더 낫다.
- 🟡 라이브 테스트 셀러 5건(id 15~19, `[테스트] …`)은 다른 세션의 staging 실결제 준비물이다.
  소비자 화면엔 안 뜬다(붙은 상품 `is_active=0`).
