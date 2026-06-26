# 소비자(유저) 서비스 전수조사 — 결과 + 미결정 항목 (2026-06-26)

> 도매몰/대시보드가 아닌 **일반 유저의 서비스 경로**(로그인 → 결제 → 수령 → 환불 → 딜) 전수조사.
> "본인(Chrome·따뜻한캐시·데이터있음)은 안 보이지만 다른 유저(사파리·콜드·빈데이터)가 겪는" 클래스 위주.

## ✅ 이미 수정·배포 완료 (비잠금)

| 항목 | 내용 | commit |
|---|---|---|
| error→"없음" 위장 | 홈 공구 피드 / 숙소 검색이 fetch 실패를 "공구 없음"·"검색결과 없음"(죽은 마켓)으로 위장 → isError 재시도 분기 | `bc7fc43` |
| 거짓 "딜 부족" | `useBalance` / VouchersPage 가 일시 오류를 잔액 0 으로 위장 → 결제 차단. catch 제거(서버가 결제 시 재검증) | `bc7fc43` |
| 사파리 Invalid Date/NaN | 교환권 환불버튼 실종(7일 게이트 NaN), 공구 카드 "NaN분" → safeDate. 알림 타임스탬프, 숙소 모달 dvh | `bc7fc43`, 후속 |
| 로그인 redirect 복원력 | `/u/me` 일시오류 시 /creator 추방 대신 1회 재시도, 같은유저 재로그인 시 핸들 캐시 보존 | `bc7fc43` |

## 🔒 미결정 — 잠긴 결제코어 (대표 승인 + staging 검증 필요)

**"돈 냈는데 못 받음 / 과소청구" — webhook↔/confirm side-effect 비대칭.** grep 으로 사실 확인됨:

### P0-A. 디지털 상품 access — `/confirm` 에 발급 없음 (webhook 만)
- 사실: `payment.routes.ts` `digital_product_access` INSERT = **0건**, `webhook.routes.ts` = 2건.
- 영향: 카드로 디지털 상품 결제 시 정상 경로(`/confirm`)는 보관함 row 를 안 만듦 → webhook 지연/실패면 **다운로드/시청 영구 불가**.
- 최소수정안: `/confirm` reduceStock 직후 side-effect 블록에 webhook 과 **동일한** `INSERT OR IGNORE INTO digital_product_access`. (멱등 — 둘 다 와도 안전.)
- 잠금: `payment.routes.ts`. (Toss confirm/금액검증/CAS 무수정, side-effect 배선만 — 2026-06-12 [UNLOCK] 선례와 동일 패턴.)

### P0-B. KT-Alpha 교환권(기프티콘) — webhook 에 발송 없음
- 사실: `payment.routes.ts` `autoSendKtAlpha` = 3건, `webhook.routes.ts` = **0건**.
- 영향: 브라우저가 confirm 못 보내고 webhook 만 도착하면 결제는 PAID 인데 **기프티콘 영구 미발송**.
- 최소수정안: webhook 확정(`result.confirmed>0`) 블록에 `autoSendKtAlphaVouchersForOrders` 호출 + **P1-가 멱등 가드 선행**(아래).
- 잠금: `webhook.routes.ts`.

### P0-C. 혼합결제 딜 차감 — webhook 에 없음
- 사실: `payment.routes.ts` `deal_used` = 3건, `webhook.routes.ts` = **0건**.
- 영향: webhook-only 확정 시 카드 금액만 청구, 딜 사용분 **미차감** → 유저가 딜 안 쓰고 할인(플랫폼 미수).
- 최소수정안: webhook 확정 블록에 `/confirm` 과 동일한 `adjustUserPoints(delta:-deal_used, guardBalance)` CAS 차감.
- 잠금: `webhook.routes.ts`.

> **권장**: 3건을 webhook↔/confirm **공용 멱등 side-effect 헬퍼 1개**로 배선(CLAUDE.md 머니룰 #2). Toss confirm/금액검증/CAS 는 byte-불변. **배포 전 staging 실결제(디지털·교환권·혼합) 각 1회 검증 필수.**

## 🔧 미결정 — 비잠금 환불/취소 P1 (money-mutation — 신중 수정, staging 권장)

| P1 | 위치(비잠금) | 증상 | 최소수정안 |
|---|---|---|---|
| 가. KT-Alpha per-order 멱등 가드 부재 | `kt-alpha-auto-send.ts` | confirm+webhook 둘 다 배선되면 교환권 2배 발송 | 발송 전 `voucher_orders` 존재 체크 또는 `(order_id,item)` UNIQUE+INSERT OR IGNORE |
| 나. 혼합결제 취소/환불 딜 미복원 | `order.routes.ts:942/760` | 카드+딜 주문 취소 시 카드만 환불, 딜 영구 미복원 | `payment_method` 조건 대신 `orders.deal_used>0` 읽어 비례 복원 |
| 다. 소비자 취소/환불이 `refundOrderFully` 우회 | `order.routes.ts`, `returns.routes.ts` | 쿠폰 un-use·공구권·공급/에이전시/영입자 커미션 역전 누락 | 인라인 경로를 `refundOrderFully` 로 통일 |
| 라. 딜결제 주문 취소 422 차단 | `order.routes.ts:858/664` | 딜로 산 주문(toss_payment_key NULL)이 PAYMENT_KEY_MISSING 422 → 셀프취소 불가 | paymentKey 검사 전 `payment_method==='deal_points'` 분기 → 딜환급 경로로 |
| 마. confirm-toss 동시요청 공구권 이중발급 | `group-buy.routes.ts:1052`, `repair-schema` | UNIQUE index 부재 + read-then-write → 더블클릭/재시도 시 교환권 2장·재고 2배 | `orders(payment_key)` partial UNIQUE + INSERT OR IGNORE. **단 payment_key 가 타 경로와 공유되는지 사전 확인 필수**(공유 시 다른 결제 깨짐) |

## 🟡 잔여 사파리 Invalid Date (비-money, 안전 — 후속 safeDate sweep)
`MyVouchersPage`(338/509-510/533/1044-1118 나머지), `MyStaysPage`(234-258), `ProductDetailPage:660`, `GroupBuyDetailPage`(255/710/799), `GroupBuyListPage`(529/588/612 정렬) — `new Date()` 직접 → 사파리 표시 깨짐/정렬 불안정. safeDate 로 일괄 교체(기능 영향 낮음, 표시/정렬만).

## ⚠️ boot/auth — staging 검증 필요 (단독)
`main.tsx:296-310` iOS establish 티켓: 4초 타임아웃/비-2xx 응답에도 티켓을 삭제 → 사파리/카톡 신규 로그인이 실패 시 **재로그인밖에 답 없음**. 부팅·인증 최고 blast-radius라 blind 수정 금지 — establish 응답 확인 + 실패 시 티켓 보존/재시도 설계를 staging 에서 검증 후 적용.

---
## 변경 이력
- 2026-06-26 초안 — 소비자 3축 감사(결제·수령 / 페이지 crash·뷰포트 / 로그인·세션·딜) 후 미결정 항목 정리.
