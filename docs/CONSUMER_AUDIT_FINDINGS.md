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
| 가. KT-Alpha per-order 멱등 가드 부재 | `kt-alpha-auto-send.ts` | confirm+webhook 둘 다 배선되면 교환권 2배 발송 | ✅ **완료**(`faa9f73`) — `external_order_id LIKE 'u{oid}-%'` per-order 가드 |
| 나. 혼합결제 취소/환불 딜 미복원 | `order.routes.ts` | 카드+딜 주문 취소 시 카드만 환불, 딜 영구 미복원 | ✅ **완료** — `/:id/cancel`·`/refund` 양쪽에 `deal_used` 비례 환급(현금 취소비율만큼). reserve-CAS/Toss 단일실행. ⚠️ staging 검증 권장 |
| 라. 딜결제 주문 취소 422 차단 | `order.routes.ts` | 딜로 산 주문(toss_payment_key NULL)이 PAYMENT_KEY_MISSING 422 → 셀프취소 불가 | ✅ **완료** — `/:id/cancel` 에 `deal_points` 전용 분기(Toss 미경유 딜환급+재고+커미션회수+CANCELLED, refunded_amount CAS). ⚠️ staging 검증 권장 |
| 다. 소비자 취소/환불이 `refundOrderFully` 우회 | `order.routes.ts`, `returns.routes.ts` | 쿠폰 un-use·공구권·공급/에이전시/영입자 커미션 역전 누락 | ✅ **완료** — 공유 헬퍼 `reverseOrderAncillaryOnRefund(order-refund.ts)` 추출(affiliate·공급자/영입자/에이전시 매장영입·referral_bonus·쿠폰 un-use·공구권 clawback·디지털 revoke, order_id 멱등). `refundOrderFully` 가 인라인 6~9b 단계를 이 헬퍼로 대체 + `order.routes.ts` `/refund`·`/:id/cancel`(딜·Toss 양쪽)이 **전액** 취소/환불일 때만 호출(부분취소는 전체역전이 틀려 제외). referral_commissions 회수는 기존 인라인 유지(중복 없음). `returns.routes.ts`(부분반품)는 이미 공급/영입자/에이전시/referral_bonus 역전 보유 → 부분 반품 의미 보존 위해 무수정(쿠폰/공구권 전체역전은 full-vs-partial 판별 필요 — 별도 deferral). ⚠️ staging 검증 권장. |
| 마. confirm-toss 동시요청 공구권 이중발급 | `group-buy.routes.ts`, `repair-schema` | UNIQUE index 부재 + read-then-write | ⏳ **미적용(위험)** — `toss_payment_key` 가 **멀티셀러 주문에서 여러 order 행에 공유**됨(grep 확인) → 그 컬럼 UNIQUE index 는 멀티셀러 결제를 깨뜨림. group-buy 는 `idempotency_key` 로 1차 dedup 중이나 그 컬럼의 멀티행 공유 여부 확인 후 partial UNIQUE 적용 필요. |

## ✅ 잔여 사파리 Invalid Date sweep — 완료 (비-money, 표시/정렬만)
`MyVouchersPage`(used_at 표시·만료임박 정렬·nearestExpiry·카드 expiresAt/usedAt), `MyStaysPage`(voucher_used_at·voucher_expires_at + null 폴백), `ProductDetailPage`(voucher_expiry), `GroupBuyDetailPage`(deadline jitter·voucher_expiry chip 2곳), `GroupBuyListPage`(deadline/expires_at/created_at 정렬 5곳) — DB 공백형식 타임스탬프 직접 `new Date()` → 사파리 `Invalid Date`/`NaN`. **표시는 `safeDate()?.`, 정렬/계산은 `safeTime()`(0 폴백)로 교체.** 각 폴백(Infinity/MAX_SAFE_INTEGER/0) 보존. 현재시각(`new Date(now)`, now=`Date.now()`)·인자없는 `new Date()`는 사파리-safe라 무수정. **부가효과**: GroupBuyDetailPage deadline jitter 가 사파리에서 NaN→항상 5s 폴링이던 것도 정상화(D1 부하↓). tsc 0·build 0·theme 0.

## ⚠️ boot/auth — staging 검증 필요 (단독, blind 수정 금지)

**증상**: iOS 사파리/카톡 신규 로그인이 일시 실패 시 **재로그인밖에 답 없음**.

**코드로 확인한 정확한 버그 2개** (`main.tsx:291-310` `bootApp`):
1. **line 299-305**: `fetch('/api/auth/session/establish')` 가 `response.ok` 를 **검사 안 함** → 서버가 5xx/4xx 반환해도 "성공"으로 간주.
2. **line 308**: `delete w.__urEstablishTicket` 가 fetch 성공/실패/타임아웃 **무관하게 항상 실행** → 타임아웃(4s)·네트워크 블립·5xx 한 번이면 단명(120s) 티켓이 영구 소진 → 그 페이지 세션에서 재시도 불가.

**왜 blind 수정 금지(최고 blast-radius)**: 이 블록은 렌더 전에 `await` 로 막힘 → ① 동기 재시도를 넣으면 흰 화면 시간↑ ② 4s 타임아웃 예산을 쪼개 재시도하면 "느리지만 성공(3s)" 케이스를 거꾸로 실패로 바꿈. 카카오가 주 로그인 경로라 happy-path 가 깨지면 **전 유저 로그인 장애**.

**권장 수정 설계 (staging 검증 후 적용)**:
- happy-path 불변: establish 가 `response.ok` 면 기존대로 티켓 삭제 + 렌더.
- **실패 분기만 보강**: ① `response.ok` 검사 추가 ② 실패 시 티켓을 **삭제하지 말고** 렌더 진행 후 **non-blocking 백그라운드 재시도 1회**(예: 1.5s 후), 성공하면 `sessionStorage` 가드(`ur_establish_retried`)로 1회만 `window.location.reload()` → 늦게 도착한 세션 쿠키 픽업. 재시도도 실패면 조용히 포기(기존과 동일하게 재로그인).
- **staging 필수 검증**: iOS 사파리에서 ⓐ 백그라운드 재시도 응답의 `ur_session` 쿠키가 실제 영속되는지 ⓑ reload 후 로그인 상태로 복귀하는지 ⓒ reload 루프 안 도는지(가드 동작). 관리자 `/api/_internal/kakao-login-diag` 로 브라우저별 성공/실패 카운트 확인.

---
## 변경 이력
- 2026-06-26 초안 — 소비자 3축 감사(결제·수령 / 페이지 crash·뷰포트 / 로그인·세션·딜) 후 미결정 항목 정리.
