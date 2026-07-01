# CLAUDE.md — 유어딜 프로젝트 개발 규칙

## 🧱 두 서비스 철저 분리 — 도매몰(유통스타트 B2B) ↔ 유어딜 공구(소비자) (2026-06-26 대표 명령, 어떤 세션에서도 준수)

**대표 지시**: "도매몰과 유어딜 공구 서비스를 철저히 분리해서 작업해야 해. 어떠한 세션에서도."

이 레포는 **별개의 두 서비스**를 한 코드베이스에 담고 있다. **한쪽 작업이 다른 쪽에 새지 않게** 하는 것이 최우선 룰. 작업 전 "이건 어느 서비스인가?"를 먼저 판별하고, **그 서비스 경계 안에서만** 변경한다.

| 축 | 🏭 **도매몰 (유통스타트, B2B)** | 🎟️ **유어딜 공구 (소비자)** |
|---|---|---|
| 정체성 | 제조사→판매사 B2B 도매 (도매가/예치금/정산) | 소비자 공동구매·교환권·쇼핑 (딜포인트/결제) |
| 행위자 | 제조사(supplier) · 판매사(distributor=`sellers.is_distributor=1`) · 도매 어드민(`admin role='wholesale'`) | 유저(소비자) · 사업자유저(셀러) · 일반 어드민 |
| 라우트(페이지) | `/wholesale/*` · `/supplier/*` · `/admin/wholesale-*` · `/admin/distributor*` · `/admin/suppliers` · `/admin/distributor-approval` | `/` · `/group-buy` · `/community-group-buy` · `/vouchers` · `/products` · `/browse` · `/u/*` · `/seller/*`(소비자 셀러) |
| API 네임스페이스 | `/api/wholesale/*` · `/api/supplier/*` · `/api/admin/wholesale-*` · `/api/admin/distributor*` · `/api/admin/suppliers` · `/api/admin/supplier-products` | `/api/group-buy/*` · `/api/community-group-buy/*` · `/api/products` · `/api/vouchers` · `/api/orders`(소비자) |
| 코드 | `src/features/supply/**` · `src/pages/wholesale*/**` · `src/pages/supplier-dashboard/**` · `src/components/wholesale/**` | `src/features/group-buy/**` · `src/features/community-group-buy/**` · `src/pages/main-home/**` · `src/pages/GroupBuy*.tsx` · `src/pages/Vouchers*.tsx` |
| 브랜드/도메인 | 유통스타트 · `utongstart.com` | 유어딜 · `live.ur-team.com` |

**룰**:
1. **한 서비스 작업 시 다른 서비스 파일/라우트/네임스페이스를 건드리지 말 것.** 예: 도매 정산 수정이 소비자 정산을, 도매 상품등록이 소비자 카탈로그를 바꾸면 안 됨.
2. **공유 테이블은 구분 플래그로 격리** — `products.is_supply_product`(도매=1) · `sellers.is_distributor`(판매사=1). 한쪽 쿼리/변경이 반대쪽 행을 건드리지 않게 WHERE 에 항상 플래그 포함. 새 공유 컬럼 추가 금지(예산제 — `product_supply_meta` 사이드테이블).
3. **"공구"는 둘 다 존재** — 도매에 B2B 발주가 있고 소비자엔 공동구매가 있음. 맥락(행위자/라우트/네임스페이스)으로 어느 쪽인지 먼저 확정. `community-group-buy`=소비자, `wholesale/orders`=도매.
4. **크로스-서비스 변경이 정말 필요하면** 먼저 `AskUserQuestion` 으로 의도 확인 + 분리 위반 여부 명시.
5. 자동 가드: `scripts/check-dashboard-api-crossrole.mjs`(역할별 API 네임스페이스 격리) — 이 분리의 일부를 결정론으로 강제.

> ⚠️ 이 룰 위반 시: 한 서비스 버그픽스가 다른 서비스를 망가뜨림 + 대표가 "왜 도매 고쳤는데 공구가 깨졌어?" 반복.

## 🔒 Toss V2 docs audit 잠금 (2026-05-24 — 사용자 명령)

**배경**: 2026-05-24 사용자가 토스페이먼츠 V2 공식 docs 9개를 직접 공유하여 SDK / 결제승인 응답 / 에러코드 (~100) / 결제위젯 어드민 / Webhook / 결제취소 / 간편결제 응답 / 세금처리 / 결제결과안내 / 지급대행 / Status Page / WebView 전 영역 audit + 정합 작업 완료.

**🚫 절대 룰**: 아래 파일/심볼은 **사용자 명시 허가 없이 직접 수정 금지**. 변경 필요할 때는 반드시 사용자에게 먼저 질문할 것 (`AskUserQuestion`).

| 파일 | 잠긴 이유 |
|---|---|
| `src/worker/utils/toss-gateway.ts` | confirmTossPayment / cancelTossPayment / detectTossKeyType / decideTossFlow / generateTossOrderId — V2 docs SSOT |
| `src/worker/utils/toss-error-messages.ts` | ~100개 에러코드 SSOT (docs `/reference/error-codes`) |
| `src/worker/utils/toss-refund.ts` | gateway wrapper. 직접 수정 X, 변경은 gateway 에서 |
| `src/worker/utils/toss-payments.ts` | gateway wrapper |
| `src/worker/utils/refund.ts` | gateway wrapper |
| `src/worker/routes/payment.routes.ts` | /confirm / amount 검증 / client-key endpoint — docs 준수 |
| `src/worker/routes/webhook.routes.ts` | V2 이벤트 (PAYMENT_STATUS_CHANGED 등) + graceful 시그니처 |
| `src/components/payments/TossPaymentWidget.tsx` | V2 SDK widgets() / customerEmail / customerName / orderName 100자 |
| `src/pages/TossWidgetPayPage.tsx` | 딜 충전용 widgets() flow |
| `src/pages/PaymentSuccessPage.tsx` | TossPaymentObject 필드 표시 (receipt.url / cashReceipt / easyPay / card) |
| `src/shared/types/index.ts` | TossEventType / TossWebhookPayload — V2 docs 사양 |

**예외 (수정 OK — 사용자 허가 불필요)**:
- 새로 추가되는 결제 시나리오에서 SSOT helper (`confirmTossPayment` / `cancelTossPayment`) 를 **호출**하는 코드 — 단, helper 자체는 변경 X
- 운영 가이드 / 주석 / 비-결제 UI 문자열만의 변경

**수정 절차 (예외 발생 시)**:
1. `AskUserQuestion` 으로 의도/근거 설명 + 확인 받기
2. 변경 사유 + docs URL 인용 + commit 메시지 명시
3. 본 CLAUDE.md 의 audit log 에 변경 commit 추가

### 변경 audit log
- 2026-07-01 `[UNLOCK]` `webhook.routes.ts` 결제 확정/취소 경로 **알림 비대칭 2건 보강** (대표 승인 "Tier 2 잠금 파일" — 알림 2차 전수조사). 배경: (1) 셀러 '💳 결제 확정' 대시보드 알림이 `/confirm`(payment.routes:463)에만 있어, confirmPaymentAtomic CAS 로 **webhook 이 이기면 셀러가 결제확정 벨을 못 받음**(2026-06-26 buyer 알림은 양경로 대칭화됐으나 셀러 반쪽 누락). (2) Toss webhook 주문취소는 `sendOrderNotification`(Discord 전용)만 호출 → **구매자 앱 알림함엔 취소 기록 0**(앱-발화 취소 order.routes 는 이미 notifyUser 하나 Toss측/비동기 취소는 webhook 만 도달). **수정(side-effect 배선만)**: ① `handlePaymentConfirmed` 의 `result.confirmed>0` 블록(buyer order_paid 알림 직후)에 `orders WHERE order_number` seller_id 조회 → 셀러별 `createDashboardNotification('seller','order_paid', …,'/seller/orders')`. ② `handlePaymentCancelled` 의 취소알림 직후 `notifyUser(userId,'order_cancelled', …,'/my-orders')`. **이중알림 0**: ①은 `result.confirmed>0`(confirmPaymentAtomic CAS 단일실행) 가드라 webhook↔confirm winner 만 도달. **⚠️ Toss 시그니처/금액검증/confirmPaymentAtomic/결제취소·환불·커미션역전·쿠폰복원 전부 byte-불변 — notifyUser/createDashboardNotification side-effect 2블록 추가만.** payment.routes.ts 무수정(이미 양쪽 알림 보유). 검증: tsc 0·build 0·sql bind/not-null/column/table 가드 0. ⚠️ staging: webhook-only 확정(브라우저 confirm 누락) 시 셀러 '결제 확정' 벨 + Toss측 취소 시 구매자 취소 알림 각 1회.
- 2026-06-27 `[UNLOCK]` `payment.routes.ts` `/confirm` **fee-resolver 그림자 배선(shadow)** (대표 "배선하는 길로" 승인 — 상품 소유 모델 새 수수료 규칙 연결). 배경: 새 규칙(플랫폼 5%/0%·에이전시 1%/24개월 per-agency)을 잠긴 결제경로에 *연결*하되, 라이브 정산을 블라인드로 바꾸면 위험(이 환경 실결제 검증 불가) → **2단 스위치**: 1단계=그림자(계산만 기록), 2단계=authoritative(별도, 검증 후). **수정(additive 1블록)**: `_confirmSideFx`(confirmClaim CAS 후 waitUntil) 끝에 `FEE_RESOLVER_ENABLED==='true'` 게이트로 `recordOrderFeeBreakdown` 호출 — 새 규칙 분배를 `order_fee_breakdown`(order_id UNIQUE, INSERT OR IGNORE)에 *기록만*. **실제 정산/적립/기존 커미션 4종(affiliate/agency/influencer/supplier) 전부 무변경.** per-agency 율·기간(어드민 설정) 반영. **⚠️ Toss confirm/금액검증/confirmClaim/confirmPaymentAtomic/재고·딜차감/기존 side-effect 전부 byte-불변 — 그림자 기록 1블록만.** 기본 OFF=현행 100% 동일. 검증: 단위 2356 pass·tsc 0·build 0·money/sql-bind/not-null 0. ⚠️ authoritative 전환(리졸버가 실제 정산 대체)은 스테이징에서 `order_fee_breakdown` vs 현행 비교검증 후 별도 작업.
- 2026-06-26 `[UNLOCK]` `payment.routes.ts` `/confirm` + `webhook.routes.ts` 결제완료 **buyer 인앱 알림** 배선 (대표 승인 "모두 해줘 이상적으로" — 소비자 감사 D). 배경: 결제 확정 시 셀러(`order_paid` 대시보드)·어드민은 통보되는데 **buyer 인앱 알림이 0** — PaymentSuccessPage 가 즉시 보여주긴 하나 알림함엔 주문완료 기록이 없음. **수정(side-effect 배선만)**: `/confirm` 의 `_confirmSideFx`(confirmClaim CAS 통과 후 waitUntil 블록)에 셀러 알림 직후 `notifyUser(userId,'order_paid', …,'/my-orders')` 1블록(orders 합산 1회); webhook `handlePaymentConfirmed` 의 `result.confirmed>0` 블록(KT 발송 다음)에 동일 `notifyUser`(Toss `data.totalAmount` 표시). **이중알림 0**: confirm↔webhook 은 status CAS(confirmClaim/confirmPaymentAtomic)가 단일실행 보장 → winner 만 도달. **⚠️ Toss confirm/금액검증/confirmClaim/confirmPaymentAtomic/재고·딜차감 전부 byte-불변 — notifyUser side-effect 1블록씩 추가만.** 검증: 단위 2327 pass·tsc 0·build 0·money-pattern/sql-bind/not-null/column 0·auth-cookie 0. (별개 비잠금 동반 변경: community-group-buy 환불·stays 확정/취소·group-buy 카드 교환권 buyer 알림 = A/B/C.)
- 2026-06-26 `[UNLOCK]` `TossPaymentWidget.tsx` 약관 게이트를 **대형 서비스 패턴(클릭-시점 검증)** 으로 전환 (대표 "대형 서비스처럼 — 지금은 비효율" 승인). **배경**: 같은날 seed fix(아래 항목)는 버튼 hard-disable 패러다임 안에서의 응급처치였음 — 약관 동의값을 React state(`agreedRequired`)로 미러링하고 버튼 `disabled` 에 묶으면 SDK 이벤트 타이밍/복원상태와 desync 시 버튼이 잠기는 **버그 클래스**가 상존. 쿠팡/11번가/배민/네이버 등은 이 미러링을 안 함. **수정**: ① `agreedRequired` state + `agreementStatusChange` 미러링 제거 → 약관 위젯 인스턴스만 `agreementRef` 에 저장. ② 버튼 `disabled` 에서 `!agreedRequired` 제거(=ready 면 항상 활성, 라벨 항상 '결제하기'). ③ `handlePayment` 진입 시 `agreementRef.getAgreementStatus()` 로 **클릭 시점 현재값 직접 읽어** 검증 — 미동의면 `#toss-agreement` 스크롤 + amber 안내(`showAgreeHint`), Toss 호출 안 함. ④ 최종 백스톱: requestPayment 의 `NEED_AGREEMENT` 에러 catch → 동일 스크롤+안내. 토스가 약관을 강제(에러코드 SSOT)하므로 미동의 결제 **구조적 불가** + 버튼은 **구조적으로 잠길 수 없음**. **requestPayment/orderName 100자/customerEmail·Name·Phone/setAmount/widgets() 키분기 전부 byte-불변.** 충전 페이지(`TossWidgetPayPage`)는 이미 동일 패턴(약관 미게이트)이라 무수정. 검증: tsc 0·`agreedRequired` 잔존 0(`agreedRequiredTerms` Toss 속성만). ⚠️ staging 실결제 1회 권장(미동의 클릭 → 안내+스크롤 / 동의 후 → 결제 진행). 본 항목이 아래 seed fix 를 대체.
- 2026-06-26 `[UNLOCK]` `TossPaymentWidget.tsx` 약관 체크 복원 시 결제버튼 비활성 고착 fix (대표 신고 — 체크돼 있는데 "필수 약관에 동의해주세요" 잠김, 해제/재체크하면 풀림). **원인**: 버튼 `disabled` 가 `agreedRequired` 에 묶였는데 이 값은 Toss SDK 의 `agreementStatusChange` 이벤트로만 set. 이 이벤트는 **'변경' 시에만 발생** → 같은 `customerKey` 가 이전에 동의해 체크가 **복원된 초기 상태**엔 이벤트 미발생 → `agreedRequired=false` 고착. **수정**: `renderAgreement` resolve 직후 **`agreementWidget.getAgreementStatus()`** 로 초기 동의값을 직접 읽어 `setAgreedRequired` seed(try-catch, 미지원/실패 시 기존 이벤트 방식 fallback). **requestPayment/orderName 100자/customerEmail·Name·Phone/setAmount/widgets() 키분기 전부 byte-불변 — 약관 초기 seed 1블록 추가만.** 충전 페이지(`TossWidgetPayPage`)는 버튼을 약관에 안 묶어(Toss 가 reject) 이 버그 없음 — 무수정. 검증: tsc 0. ⚠️ staging 실결제 1회 권장(이전 동의 사용자 재진입 → 버튼 즉시 활성 확인).
- 2026-06-26 `[UNLOCK]` `payment.routes.ts` `/confirm` 커미션 적립 3종 → waitUntil 이동 (대표 승인 "문제 4번 해결" — 결제완료 체감 단축) — 에이전시 매장영입(`creditAgencyStoreIntroCommission`)·영입자(`creditInfluencerStoreIntroCommission`)·도매 공급자(`creditSupplierOnOrder`) 적립이 confirm 응답을 동기로 막던 것을 기존 `_confirmSideFx` waitUntil 블록(추천적립·초대보상·셀러알림과 동일 응답후 실행)으로 이동. 셋 다 이미 **fail-soft + order_id 멱등**이라 응답 후 실행해도 정합성 영향 0(재시도/중복 confirm 이중적립 없음). **Toss confirm/금액검증/CAS/reduceStock/딜차감 전부 동기 유지 — 무변경. 실행 *시점*만 변경**(적립 로직·환불 역전 대칭·멱등 키 불변). ctx 없으면 동기 fallback. 검증: tsc 0. ⚠️ staging 실결제 1회 권장(에이전시/영입자/도매 상품 결제 → 적립 정상 + 응답 빨라짐 확인).
- 2026-06-26 `[UNLOCK]` `payment.routes.ts` `/confirm` + `webhook.routes.ts` 확정경로 **side-effect 비대칭 3종 보강** (대표 승인 "3건 다 고쳐" — 소비자 감사). 배경: 결제 확정 경로가 둘(`/confirm`·webhook)인데 side-effect 가 비대칭이라 한쪽으로만 확정되면 유저가 손해. grep 확인: ① **디지털 access** 발급이 webhook 에만(`/confirm` 0건) → 정상 경로(브라우저→/confirm)로 산 디지털 상품이 보관함 미발급 → webhook 지연/실패 시 영구 미수령. ② **KT-Alpha 교환권** 발송이 `/confirm`·딜결제에만(webhook 0건) → 브라우저 confirm 누락+webhook-only 확정 시 기프티콘 영구 미발송. ③ **혼합결제 딜 차감**이 `/confirm` 에만(webhook 0건) → webhook-only 확정 시 딜 미차감(플랫폼 미수). **수정(side-effect 배선만)**: `/confirm` 에 디지털 access INSERT(webhook 블록 복제, `INSERT OR IGNORE`); webhook 확정(`result.confirmed>0`) 블록에 딜 차감(adjustUserPoints CAS guardBalance, `/confirm` 과 동일) + KT-Alpha 발송 추가(`handlePaymentConfirmed` 에 `env` 파라미터 배선). **이중실행 0**: confirm↔webhook 은 status CAS(confirmClaim / confirmPaymentAtomic) 가 단일실행 보장(winner 만 side-effect 도달, loser 는 changes==0 → skip). 추가 멱등: 디지털 `digital_product_access(order_item_id)` UNIQUE index(repair-schema, best-effort) + KT `voucher_orders.external_order_id LIKE 'u{oid}-%'` per-order 가드(`kt-alpha-auto-send.ts`). **⚠️ Toss 시그니처/금액검증/confirmTossPayment/confirmClaim/confirmPaymentAtomic 전부 byte-불변 — side-effect 배선/멱등 보강만.** 검증: 단위 1787 pass · tsc 0 · build 0 · money-pattern/sql-bind 0. ⚠️ **배포 전 staging 실결제 검증 필수**: 디지털 상품(보관함 발급) · 교환권 상품(webhook-only 확정 시 KT 발송 + 이중발송 0) · 혼합결제(딜 차감 1회) 각 1회.
- 2026-06-17 `[UNLOCK]` `payment.routes.ts` `/confirm` 혼합결제(Toss+딜) **딜 잔액 차감** 배선 (대표 AskUserQuestion 승인 "결제 성공 시점") — G1 쇼핑 할인결제 완전수정의 일부. 배경: 주문 zod 가 할인필드(쿠폰/딜/공구할인)를 strip → total_amount 에서 할인 누락 → confirm 금액불일치 400(과금 0, fail-safe), 게다가 `deal_used` 는 **서버에서 한 번도 차감 안 됨**(클라가 보내기만). 수정: `order.routes` 가 서버 권위로 할인 재계산(validate-by-cap) + `orders.deal_used` 저장 → `/confirm` 의 **confirmClaim CAS 직후·reduceStock 다음**에 `adjustUserPoints(delta:-deal_used, guardBalance)` 1블록 추가. changes==0 동시요청은 라인 302 early-return 으로 이 코드 미도달 → 이중차감 0. 잔액부족 레이스는 가용분만 차감(음수 방지)+Sentry 경보. fail-soft(딜 차감 실패가 결제확정 불막음). **Toss confirm/금액검증(`totalAmount!==amount`)/confirmClaim/client-key/달력 전부 무수정 — side-effect 차감 1블록 추가만.** 역전: `order-refund.ts`(전액)·`returns.routes.ts`(부분 비례) 에 딜 복원 + 쿠폰 un-use 대칭 배선. ⚠️ 쇼핑탭 숨김 상태라 라이브 영향 0 — **재오픈 전 staging 실결제 1회 검증 필수**(쿠폰+딜 동시 결제 → confirm 통과 + 잔액 차감 + 환불 복원). 검증: 단위 2152 pass · build 0 · money-pattern/sql-bind 0.
- 2026-06-17 `[UNLOCK]` `PaymentSuccessPage.tsx` **시각만** 톤 통일 (사용자 AskUserQuestion 승인 "시각만 정리") — 애플식 파란 `#007aff`/`#0051d5` 액센트 + 보라 예약 CTA → 잉크/뉴트럴(gray-900·다크 대응) + amber 예약 안내. **TossPaymentObject 필드 표시(receipt.url/cashReceipt/easyPay/card/approvedAt)·amount 변조검증·`/api/payments/confirm` 승인 로직·pendingBookings 조회 전부 byte-identical** — className 색상만 변경(git diff 로 색상 외 변경 0 확인). 소비자 결제완료 화면을 교환권/충전완료와 동톤화.
- 2026-06-12 `[UNLOCK]` `payment.routes.ts` `/confirm` 확정 side-effect 3종 배선 (사용자 승인 "나머지 다 이상적으로 진행" — 전 플로우 감사) — reduceStock 직후 waitUntil 블록 추가: ① `creditAffiliateFromIntent`(주문 생성 시 저장된 추천 의도 소비 — 기존 내부 fetch dead-call 의 근본수정, 검증/멱등은 /track 과 동일 SSOT `affiliate-credit.ts`) ② `grantInviteRewardForFirstPurchase`(초대 1,000딜 — 호출자 0 이던 약속 미이행 마감, UNIQUE claim 멱등) ③ 셀러 '결제 확정' 벨 알림. 전부 fail-soft + 응답 후 실행. **Toss confirm/금액검증/CAS/달력 무변경.**
- 2026-06-11 `[UNLOCK]` `payment.routes.ts` `/confirm` referral 알림 waitUntil 분리 (사용자 승인 "진행하자" — 참여하기 felt-latency 전수조사 후속). 숙소 referral 적립 직후의 알림 묶음(notifications INSERT + phone/누적 SELECT + 알리고 알림톡 외부 HTTP)이 결제 confirm 응답을 동기로 막던 것을 내용/순서/에러처리 그대로 응답 후(waitUntil, ctx 없으면 동기 fallback)로 이동. **적립(affiliate_earnings INSERT)·Toss confirm/금액검증/CAS/달력 전부 무변경** — 알림 실행 시점만. unit 2028 green.
- 2026-06-11 `[UNLOCK]` `payment.routes.ts` `/confirm` 숙소 야간 캘린더 batch 화 (사용자 승인, 감사 백로그 마감) — 야간당 2왕복(INSERT OR IGNORE+UPDATE) 루프를 일괄 2 batch 로, `releaseStays()` 도 단일 batch. **가드 의미 동일**: UPDATE 의 `available_count > 0` + 결과별 `meta.changes` 로 야간별 성공 판정, 실패 야간 발견 시 성공분 전체 롤백(기존 '첫 실패 break 후 롤백'과 최종 상태 동일). reserve-before-charge 순서/CAS/Toss 금액검증/confirmTossPayment 전부 불변. 같은 commit 에서 `helpers.ts` `clawbackVoucherCommission` 도 행당 write 루프 → DB.batch (사전 조회값 기반, read-after-write 없음 — 원자성만 강화).
- 2026-06-11 `[UNLOCK]` `payment.routes.ts` + `webhook.routes.ts` 결제 확정 side-effect 누락 2건 (사용자 승인, 머니 감사). **Med-A** `payment.routes.ts /confirm`: `ALREADY_PROCESSED_PAYMENT` 분기의 early-return 제거 — 기존엔 updateStatus('DONE')만 하고 즉시 반환해 reduceStock·커미션·KT발송 영구 생략(Toss 승인 직후~CAS 직전 worker 크래시→재시도 케이스). 제거로 아래 confirmClaim CAS 에 위임(이미 DONE=멱등반환 / PENDING=claim 후 side-effect 복구). **Med-C** `webhook.routes.ts`: 결제 확정 경로가 둘인데 커미션 적립이 /confirm 에만 있어 webhook 만 도착 시 누락 → 공통 멱등 헬퍼 `creditOrderCommissions`(order-commissions.ts, 에이전시/영입자/공급자 3종 order_id 멱등) 를 webhook 확정 직후 호출. **Toss confirm/금액검증/client-key/confirmTossPayment helper 전부 무수정** — side-effect 배선만.
- 2026-06-04 `[UNLOCK]` `payment.routes.ts` `/confirm` 숙소 오버부킹 **reserve-before-charge** 근본수정 (사용자 승인, deep audit) — 기존: Toss 승인 *후* 달력 차감 → 오버부킹이면 자동환불. **자동환불 실패 시 '청구만 되고 방 반환' 잔여 리스크**. 수정: 달력 예약(차감)을 **Toss 승인 전**으로 이동 → 방 못 잡으면 청구 자체 안 함(STAY_OVERBOOKED 409, 미회수 0). 동시 confirm 이중차감은 `stay_bookings` status CAS(pending→confirmed)로 차단(이 thread 만 예약). Toss 실패 시 `releaseStays()`(달력+booking 되돌림). 기존 post-Toss 차감/오버부킹/confirm 블록은 affiliate 적립만 남김(멱등, status!=='confirmed' skip). **Toss 금액검증/confirmTossPayment helper/client-key 미변경** — 달력 side-effect 순서만 이동. ⚠️ 실결제 staging 미검증 — 운영 반영 전 숙소 결제 E2E 1회 권장.
- 2026-05-24 초기 잠금 — commit `02be3610`, `c47e7326`, 후속
- 2026-06-01 `[UNLOCK]` `payment.routes.ts` `/confirm` 영입자(크리에이터) 매장영입 commission 배선 (사용자 승인) — 에이전시 intro commission 블록 직후 `creditInfluencerStoreIntroCommission(DB, order)` 호출 추가(fail-soft, 멱등). 매장 `introduced_by_influencer_id` 있으면 매출의 `platform_settings.influencer_store_intro_pct`(default 1.5%)를 영입자 `influencer_attributions`(source='store_intro')에 적립 → 기존 influencer-payout cron 이 T+7 성숙 + 사업자 3.3%/비사업자 8.8% 원천징수 후 송금. **Toss confirm/amount 검증 미변경** — side-effect 적립만. 환불 역전은 `returns.routes.ts`(비잠금)에 `reverseInfluencerStoreIntroOnRefund` 추가.
- 2026-05-31 `[UNLOCK]` `payment.routes.ts` `/confirm` 공급(B2B) 정산 배선 (도매몰 INC-5b, 사용자 승인) — 에이전시 커미션 적립 블록 직후 `creditSupplierOnOrder(DB, order.id)` 호출 추가(fail-soft, order_id 멱등). 공급상품(supply_source_id) 라인의 공급가를 공급자에게 즉시 적립(D2). **Toss confirm/amount 검증 미변경** — side-effect 적립만. 환불 역전은 `returns.routes.ts`(비잠금) 에 `reverseSupplierOnRefund` 추가.
- 2026-05-31 `[UNLOCK]` `payment.routes.ts` `/confirm` 동시요청 CAS 가드 (사용자 승인, 보안 audit) — Toss confirm 후 `UPDATE orders SET status='DONE' WHERE order_number=? AND status NOT IN (DONE/PAID/CANCELLED/REFUNDED/FAILED)` 로 PENDING→DONE 원자 claim. `meta.changes==0`(다른 동시요청이 이미 처리)이면 reduceStock/agency·referral commission side-effect 재실행 없이 멱등 반환. **Toss confirm/amount 검증/client-key 로직 미변경** — 내부 정합(재고 2배차감·커미션 중복)만 차단. confirmTossPayment 는 호출만(수정 X).
- 2026-05-30 `[UNLOCK]` 숙소 오버부킹 원자적 가드 (사용자 허가) — `payment.routes.ts` `/confirm` 의 stay-calendar 차감 블록만 변경: `MAX(0, count-1)` clamp → `WHERE available_count > 0` 가드 + `meta.changes` 검사 + 부족 시 성공분 롤백 + `cancelTossPayment()` 자동 환불. **Toss confirm/amount 검증/client-key 로직은 미변경**, locked SSOT helper 는 호출만(수정 X). 동일 가드 `stays-public.routes.ts` `/stays/bookings/confirm` 에도 적용.

---

## 🔒 로딩 최적화 잠금 (2026-05-27 — 사용자 명령)

**배경**: 2026-05-27 사용자가 메인/공구/쇼핑/교환권/링크샵 페이지 로딩 속도 + KV 비용 + 상품 수 확장성 동시에 이상적으로 최적화 완료. 이 영역의 회귀는 즉시 사용자 체감 + Cloudflare 비용 발생.

**🚫 절대 룰**: 아래 파일/심볼은 **사용자 명시 허가 없이 변경/제거 금지**. 추가는 OK (예: 이미지 host 화이트리스트 확장), 제거/약화는 금지.

| 파일 | 잠긴 항목 | 회귀 시 발생 |
|---|---|---|
| `src/worker/middleware/edge-cache.ts` | `publicCache` 의 `useKv: false` 기본 | KV write 한도 초과 → 월 $2-5 비용 |
| `src/worker/middleware/edge-cache.ts` | `CDN-Cache-Control` 분리 헤더 | 브라우저/edge TTL trade-off 깨짐 |
| `src/worker/index.ts` | HTMLRewriter SSR inject 블록 (4페이지) + `caches.default.match` 직접 read | SSR 0 RTT 회귀 → 메인 페이지 200-500ms ↑ |
| `src/worker/cron/cache-prewarm.ts` | `HOT_PATHS` 의 SSR key 정확 매칭 | SSR cache miss → 첫 사용자 skeleton |
| `src/utils/cf-image.ts` | `SUPPORTED_HOSTS` / `EXTERNAL_PROXY_HOSTS` | 추가 OK, **제거 금지** (LCP 회귀, 트래픽 ↑) |
| `src/utils/cf-image.ts` | Save-Data 감지 quality 자동 조절 | 모바일 데이터 절약 사용자 트래픽 ↑ |
| `src/worker/index.ts` `/api/image/resize` | `ALLOWED_HOSTS` | 같음 |
| `src/components/RestaurantMiniMap.tsx` | IntersectionObserver lazy load (`shouldLoadSdk`) | 모든 공구 상세 페이지 SDK 즉시 로드 회귀 |
| `src/components/auth/RouteGuards.tsx` | `isAdminLoggedIn` / `isUserLoggedIn` / `isSellerLoggedIn` 토큰 존재 검사 | admin↔user 이중 로그인 자동 로그아웃 회귀 (`user_type` 추가 검사 X) |
| `src/components/main/BottomNav.tsx` | `linkshopPath` localStorage cache 우선 (seller_username → linked_seller_username → user_handle) | 매번 API 호출, `/host/new` fall through |
| `src/components/main/BottomNav.tsx` | `isActivePath` 가 `/profile/`, `/s/` 도 링크샵 활성 | 링크샵 탭 비활성 표시 |
| `src/pages/main-home/GroupBuyFeedCard.tsx` | hover/touch/focus prefetch + IntersectionObserver viewport prefetch | 카드 클릭 시 fetch waterfall |
| `src/pages/main-home/GroupBuyFeedCard.tsx` | image fade-in (`opacity` transition) + aboveFold eager | UX 깜빡임 |
| `src/pages/GroupBuyDetailPage.tsx` | `__SSR_INITIAL_DETAIL__` 즉시 사용 | 상세 페이지 fetch waterfall |
| `src/pages/SellerPublicPage.tsx` | `__SSR_INITIAL_SELLER__` 즉시 사용 | 셀러 페이지 fetch waterfall |
| `src/pages/VouchersPage.tsx` | `__SSR_INITIAL_VOUCHERS__` 즉시 사용 + default sort `price_low` | first paint 회귀 |
| `src/pages/BrowsePage.tsx` | `__SSR_INITIAL_BROWSE__` 즉시 사용 | first paint 회귀 |
| `src/features/auth/services/KakaoAuthService.ts` | `upsertUser` 의 same-email seller auto-link | `/host/new` fall through 사고 회귀 |
| `src/features/auth/api/kakao.routes.ts` | `linkUserExtraRoles` 응답에 `seller.username` 포함 | localStorage `seller_username` 누락 |
| `src/pages/KakaoCallbackPage.tsx` | `seller_username` localStorage 저장 + admin/agency 토큰 있을 때 user_type 보존 | 이중 로그인 race |
| `src/worker/routes/repair-schema.routes.ts` | `backfill: sellers.linked_user_id (same-email)` UPDATE | 시드 데이터 정정 못 함 |
| `index.html` | preload `crossOrigin` 속성 없음 (same-origin) | preload mismatch → 200-500ms 손해 |
| `index.html` | Speculation Rules prerender 대상 (`/group-buy/*`, `/products/*`, `/live/*`) | 카드 클릭 후 prerender 효과 X |
| `index.html` | preconnect (`firebasestorage.googleapis.com` 등) | DNS+TLS 100-200ms 손해 |
| `src/App.tsx` | `MainHomePage` eager `import` (lazy X) | chunk fetch waterfall 50-100ms |
| `src/App.tsx` | idle prefetch (BrowsePage / VouchersPage / UserProfilePage / MyVouchersPage / SellerPublicPage) | 탭 클릭 시 chunk fetch 대기 |
| Migration `0276_products_groupbuy_perf_index` | `idx_products_groupbuy_feed` partial composite index | 풀스캔 회귀 → 상품 늘면 선형 느려짐 |
| Migration `0080` FTS5 | `products_fts` virtual table | 검색 풀스캔 회귀 |

**예외 (수정 OK — 사용자 허가 불필요)**:
- 새 페이지 / 새 SSR slot 추가 (기존 4 페이지 inject 패턴 따라)
- `EXTERNAL_PROXY_HOSTS` / `ALLOWED_HOSTS` **추가** (제거 X)
- 새 BottomNav 탭 추가 (기존 5탭 active path 패턴 보존)
- 새 cron HOT_PATHS 추가 (제거 X)

**수정 절차 (예외 발생 시)**:
1. `AskUserQuestion` 으로 의도/근거 + 회귀 영향 설명
2. 변경 사유 + commit 메시지에 잠금 해제 명시 (`[UNLOCK_LOADING]`)
3. 본 CLAUDE.md 의 audit log 에 변경 commit 추가

### 변경 audit log
- 2026-07-01 `[UNLOCK_LOADING]` `MobileAppLayout.tsx` + `BlogListPage.tsx` 블로그(`/blog`·`/blog/:slug`) **PC 풀너비**(430 액자 제외) (대표 요청 — "블로그는 PC 전체 폭을 써야 함, 유어딜 프레임에 갇혀있음"). **원인**: App.tsx 는 이미 `/blog` 를 `fullScreenPrefixes` 로 처리(상/하단 네비·사이드배너 숨김)하지만 `MobileAppLayout` 이 `/blog` 를 `HIDE_SIDEBAR_PREFIXES`/`DESKTOP_RESPONSIVE_PATHS` 어디에도 안 둬 `framed=true` → 430px 액자(`app-framed`)가 씌워져 PC 에서 폰 폭에 갇힘. **수정**: `HIDE_SIDEBAR_PREFIXES` 에 `'/blog'` 추가 → `hideSidebar=true`→`framed=false`(액자/거터레일/사이드바 전부 제외) 풀너비. 콘텐츠는 각 페이지 내부 `max-w-*`(목록 6xl→7xl+`xl:grid-cols-4`, 상세 4xl 유지=가독성) 로 중앙 정렬. 도매/대시보드와 동일 메커니즘(프레임 제외). **모바일(<lg) 영향 0**(액자/거터는 lg+ 전용) · App.tsx nav 로직·SSR/SEO 주입 불변. 롤백: `HIDE_SIDEBAR_PREFIXES` 에서 `'/blog'` 제거.
- 2026-06-30 `[LOADING_ADDITIVE]` `CuratorPage.tsx` + `[UNLOCK_LOADING]` `worker/index.ts` 사업자 링크샵(`/u/:handle`) **불필요한 중간 로더 제거** (대표 신고 — "로딩 중 필요 없는 로딩 애니메이션, 철저히 확인"). **전수 추적**: 사업자 `/u/`(linked_seller) 콜드 하드로드가 [① PageLoader 스피너(CuratorPage 청크) → ② 전체화면 중앙 '로딩 중' 텍스트(SellerPublicPage 청크 Suspense fallback) → ③ 헤더+2카드 스켈레톤(SellerPublicPage 자체 loading) → ④ 본문] 으로 **세 로더를 점프**. ②가 redundant(곧 ③이 헤더+스켈레톤을 다시 그림) + 시각 불일치(스피너↔텍스트↔스켈레톤). **수정**: ① CuratorPage Suspense fallback(중앙 텍스트)을 SellerPublicPage 의 curator-있음 loading 상태와 **byte-동일** 헤더+스켈레톤(curator 즉시 사용, `min-h-[100dvh]`·`CuratorHeader`·`grid-cols-2 gap-3`·`aspect-[3/4]`)으로 교체 → 헤더 1회 렌더 후 유지·본문 스켈레톤만 채워짐(중간 텍스트 로더 제거, 점프 0). ② worker SSR self-fetch 타임아웃 `CURATOR` 1500→2000ms (SELLER 와 동일 — `/u/`·`/profile` 은 같은 SellerPublicPage·같은 콜드 D1 비용인데 CURATOR 만 짧아 cold timeout→스켈레톤 더 자주 노출). **SSR inject 블록·`caches.default` read·warm/edge-hit·타 슬롯·소비자 페이지 전부 불변(additive — fallback 비주얼 + 슬롯 1개 타임아웃)**. SellerPublicPage `__SSR_INITIAL_SELLER__` 즉시소비(잠금) 무수정. 검증: tsc 0·build 0·theme/mobile 0. 롤백: fallback 을 중앙 '로딩 중' 텍스트로 환원 + CURATOR 를 timeout ternary 에서 제거.
- 2026-06-29 `[UNLOCK_LOADING]` `kakao.routes.ts` POST `/callback`(SPA) 에 **계정전환 역할 세션쿠키 청소** 미러 (대표 "가장 이상적인 형태 — 전수조사" 승인 — 로그아웃/세션 lifecycle 전수조사 GAP1). **배경**: GET `/sync/callback`(서버-redirect 경로)은 2026-05-01부터 매 카카오 소비자 로그인에서 이전 계정의 `clearSessionCookie('seller'/'admin'/'agency')`(cross-user leak 방어) + linked role 만 재발급하는데, **POST(SPA) 경로엔 이 청소가 없어 경로별 비대칭** → 다른 카카오 계정으로 전환해도 이전 계정의 httpOnly 역할 세션쿠키(`ur_seller/admin/agency_session`)·`ud_admin/supplier_token` 이 남아 GET/SSR 재인증(="전환했는데 옛 계정"). **수정(additive Set-Cookie만)**: POST 의 ud_* 재발급 블록 직전에 `clearSessionCookie('seller'/'admin'/'agency')` 3줄 + `ud_admin_token`/`ud_supplier_token` 무조건 청소 + `ud_seller_token`/`ud_agency_token` 은 새 계정 linked 면 set(뒤 우선) 아니면 clear — **GET 경로와 동일 의미**로 통일. **OAuth state/safeRedirect/`createSessionCookie`(소비자 ur_session 발급)/rateLimit/linkUserExtraRoles 응답 전부 byte-불변** — 역할 쿠키 청소 Set-Cookie 만 추가. 잠긴 auth-cookie iOS 영속 패턴(fragment `#auth=`/`session/establish`)·SSR ud_* 발급 동작 불변. 검증: tsc 0·vitest 2356 pass·build(client+ssr+prerender+worker) 0·audit-gate 31 GREEN(auth-cookie 포함). 롤백: 추가한 clear/set 분기 제거 → 기존 무조건 set 2줄 환원.
- 2026-06-26 `[UNLOCK_LOADING]` `KakaoAuthService.ts` `upsertUser` same-email 셀러 자동연결 **대소문자 무시(LOWER) 매칭** (대표 "계속 하자" 승인 — 카카오 단일로그인 통일 P1). **배경**: 자동연결 UPDATE 가 `sellers.email = ?` exact match(+ `COUNT(*) WHERE email = ?` 모호성 게이트)라 `"Foo@x.com"`(셀러 시드) vs `"foo@x.com"`(카카오 유저)처럼 **대소문자만 달라도 silent 미연결** → 링크샵 `/u/{handle}` 에 셀러 storefront 안 뜨고 `/host/new` fall-through. **수정**: UPDATE WHERE + COUNT 서브쿼리 둘 다 `LOWER(email) = LOWER(?)` 로 (bind 값 불변 `user.id,user.email,user.email`). **`emailVerified===true` 게이트(takeover 방어)·COUNT≤1 모호성 보류·`linked_user_id IS NULL` 멱등 전부 byte-불변 — 매칭 범위만 exact→대소문자무시로 넓힘**. 대소문자무시 COUNT 는 잠재 소유자를 더 세므로 모호하면 더 잘 skip(=더 보수적, 오연결 위험 ↓). 회귀 위험 낮음(대소문자만 다른 같은 이메일=동일인). 비잠금 짝(이미 LOWER): 관리자 `/sellers/unlinked` 추정매칭·`repair-schema` 백필. 검증: tsc 0·kakao unit pass·build 0. 롤백: `LOWER(email)=LOWER(?)` 2곳 → `email=?` 환원.
- 2026-06-26 `[UNLOCK_LOADING]` `ProductRepository.ts`(findAll/count/FTS) + `products.routes.ts`(count 엔드포인트·검색 자동완성 ×2) **소비자 카탈로그에서 도매 원본상품 제외** (대표 승인 "응 고치자" — 서비스 분리 누수). **배경(분리 전수조사)**: 소비자 `findAll` WHERE 가 `is_active=1`+정지셀러제외뿐, `is_supply_product` 미필터 → 어드민이 **승인한 도매 원본상품**(`is_supply_product=1, supply_source_id IS NULL, seller_id=NULL, is_active=1, deal_only NULL`)이 `/browse`(쇼핑, `exclude_deal_only` 통과)·상품검색/자동완성에 누수(`/vouchers`는 `deal_only=1`이라 안 샘, 쇼핑탭 숨김이라 화면엔 안 보였으나 API·검색은 샘). **수정**: 5개 소비자 쿼리 전부에 `AND NOT (COALESCE(is_supply_product,0)=1 AND supply_source_id IS NULL)` **additive** — 도매 *원본*(supply_source_id IS NULL)만 제외, **판매사 재판매 복제본(supply_source_id SET)·플랫폼상품(KT교환권 등)·일반 소비자상품 전부 보존**(wholesale 카탈로그 자체 정의와 동일 기준). `group-buy-public`은 `category IN(VOUCHER_CATEGORIES)`로 이미 격리(도매 카테고리 불일치 — 무수정). **Cache-Control/CDN-Cache-Control 분리·LIST_COLUMNS SELECT·SSR 0-RTT 캐시키·deal_only 분리 전부 불변** — WHERE 필터 1개 추가만(캐시 페이로드에서 도매 원본만 빠짐). 컬럼은 repair-schema 보장(도매 동작 환경엔 항상 존재) + column-exists 가드 통과. 검증: tsc 0·sql-column/bind 0·build 0·단위 1805 pass. 롤백: 5개 WHERE 의 `AND NOT (...)` 제거.
- 2026-06-26 `[UNLOCK_LOADING]` `SellerPublicPage.tsx`+`CuratorPage.tsx` 사업자 `/u/` **상품 fetch 병렬화**(워터폴 제거) (대표 "남은 거 다 이상적으로"). 배경: `/u/` 사업자 링크샵은 SSR 이 셀러를 주입 안 해(`__SSR_INITIAL_SELLER__`는 `/profile`·`/s` 전용) `셀러 /public → 상품` 2연속 클라 RTT. 헤더는 curator 로 즉시 떠도 내 상품 그리드가 셀러 응답을 기다림. 수정: CuratorPage 가 `linked_seller.id`(숫자)를 `sellerNumericId` prop 으로 전달 → SSR-miss 분기에서 셀러 `/public` 응답 전에 `fetchSubData(sellerNumericId)` **병렬 시작**(중복방지 `subFetched` 가드 — 셀러 .then 은 prop 없을 때만 fetch). **`__SSR_INITIAL_SELLER__` 즉시소비 분기·SSR hit 경로·streams/shorts skip(LIVE_COMMERCE_SUSPENDED) 전부 불변(additive — SSR-miss 에 병렬 1줄 + 가드).** RTT 1개 절감. 검증: tsc 0·build 0. 롤백: `sellerNumericId` prop + 병렬 블록 제거. (같은 커밋 비잠금: z-index 전수 교정 — `fixed inset-0` 모달/시트 23개를 표준(`constants/z-index.ts`) 모달 10500/시트 10600 으로, 토스트 9999→20000, 시블링 패널 2개(ProductListSheet·sort-menu) 동반 상향 — 네비 z-9999 가 모달을 가리던 버그 근본해결. confirm-dialog 는 이미 100000 라 영향 없음.)
- 2026-06-26 `[UNLOCK_LOADING]` `App.tsx` 링크샵 **`?embed=1` 깨끗한 매장 링크**(상/하단 네비 숨김) (대표 AskUserQuestion 승인 — "공유 링크에 옵션(추천)"). 배경: 사업자가 자기 링크샵을 *standalone 매장*처럼 공유하고 싶음 — "특정 링크로 들어온 방문자는 네비 안 보이게". 인프라 절반 기존재(`MobileAppLayout`의 `linkshopVisitor` 판별·PC QR). 변경: `hideBottomNav` 계산에 **`embedHideNav` 1조건 additive** — `?embed=1` 보이면 `sessionStorage.ur_linkshop_embed='1'` 세팅(인앱 이동에도 세션 유지) + **링크샵 표면(`/u`·`/profile`·`/s`)에서만** 적용(방문자가 홈 등으로 나가면 네비 복귀 = 갇힘 방지). `{!hideBottomNav && <DesktopTopNav/>}`·`{!hideBottomNav && <BottomNav/>}`·`main` 하단 여백이 모두 같은 플래그 사용 → 상/하단 네비+여백 일괄 정리. **기존 `hideBottomNav` 조건(fullScreen/products/wholesale)·BottomNav 내부(linkshopPath·isActivePath, 잠금)·MobileAppLayout 전부 불변(additive only).** 검증: tsc 0·build 0·Playwright(`/u/biz` nav 표시 ↔ `/u/biz?embed=1` nav 0) 통과. 롤백: `embedFlag`/`embedHideNav` 블록 + `|| embedHideNav` 제거.
- 2026-06-25 `[UNLOCK_LOADING]` `KakaoCallbackPage.tsx` 계정 전환(다른 user.id 로그인) 시 **admin_* 토큰도 wipe** (대표 AskUserQuestion 승인 — "보안: 전환 시 삭제"). 배경(전수조사 R2): SPA 콜백은 admin 토큰을 보존(주석 "별도 컨텍스트")했는데 서버-redirect 경로(`auth-callback-bootstrap`)는 이미 wipe → **경로별 비대칭**. 공용/공유 기기에서 다음 사용자가 관리자 콘솔을 이어받는 누출 위험. 변경: 계정전환 wipe 블록(prevUserId !== user.id)의 제거 키 목록에 `admin_token`/`admin_refresh_token`/`admin_id`/`admin_name`/`admin_email` **추가만** → 양 경로 모두 '삭제'로 통일. **같은 user.id 재로그인은 이 블록 미진입 → 관리자 세션 유지(잠긴 이중로그인 보호 동작 불변)**. `seller_username` 저장·`hasOtherRoleToken` user_type 보존 로직은 그대로(admin 토큰 wipe 후엔 user_type='user' 가 의도된 동작). 검증: tsc 0·vitest 2301 pass. 롤백: admin_* 5키 제거. (비잠금 후속: `seller-prospects.routes.ts` B4 forward fix + `repair-schema.routes.ts` 데이터 복구 backfill 2종 additive — locked same-email backfill 무수정.)
- 2026-06-23 `[UNLOCK_LOADING]` `VouchersPage.tsx` 비embedded `/vouchers` 를 **연속 스크롤 + 중앙 스크롤스파이 탭**으로 (대표 AskUserQuestion 승인 — "연속 스크롤(추천)" + "교환권 20개씩 + 더보기 버튼, 그 아래 쇼핑"). 배경: 기존 `[교환권][쇼핑]` 탭이 **좌측 정렬 + 콘텐츠 교체**(쇼핑 누르면 교환권 사라지고 `ShoppingGrid` 로 swap)라 "스크롤 내리면 쇼핑이 자연스럽게 뜨는" 한 페이지 흐름이 아니었음. 변경: ① 탭바 **중앙 정렬**(`justify-center` + 검색 아이콘 `absolute right-3`) + `tab`(URL `?tab`)→`activeTab`(스크롤스파이 state); 클릭 시 `goToVouchers`(scrollTo 0)/`goToShopping`(`shoppingRef.scrollIntoView`)로 **점프**, 콘텐츠 교체/URL 전환 없음. ② 교환권 무한스크롤 제거(`embeddedCapped`→`true`, 무한관찰 effect 비활성) → 홈 12 / `/vouchers` **20개 cap + '교환권 더보기'**(+20, 기존 embedded 더보기 로직 공유). ③ 더보기 버튼 **아래로 항상** 쇼핑 `<section ref={shoppingRef}>`(🛍️ 헤더 + 기존 `ShoppingGrid` 무한스크롤, `scroll-mt-14`) 렌더 → 한 스크롤로 이어짐. ④ revealTop onScroll 에 `getBoundingClientRect().top<=100` 스크롤스파이 1블록 추가. **`__SSR_INITIAL_VOUCHERS__` 첫 페인트 소비·default sort `price_low`·`displayProducts` 정렬·VoucherRow/VoucherCard(이미지 width/height/srcSet/lazy/dominant_color)·카테고리/브랜드 chrome 전부 불변** — 레이아웃(탭 정렬·voucher cap·쇼핑 섹션 배치)만 변경. 홈(embedded)은 탭/쇼핑 섹션 모두 `!embedded` 게이트라 **byte-동일(불변)**. 검증: tsc 0·theme-consistency/mobile-viewport 0·vite build 통과. 롤백: `activeTab`→URL `?tab` 탭 + `embeddedCapped=embedded` + 쇼핑 섹션 `{showShopping && <ShoppingGrid/>}` 환원.
- 2026-06-22 `[UNLOCK_LOADING]` `GroupBuyDetailPage.tsx` + `worker/index.ts` 공구 상세 첫 도달 "쓸모없는 로딩 + 잠시 다른 페이지 갔다 오는 느낌" 근본수정 (대표 신고 + AskUserQuestion "전부 수정" 승인 — 전수조사 후). **전수조사로 근본원인 4개 특정**: (A) `__SSR_INITIAL_DETAIL__` 가 detail 을 즉시 채워도 `loading=true`(axios 끝나야 false)라 skeleton 항상 노출 → SSR P0 무효. (B) `/group-buy/:id`·`/vouchers/:id`(DETAIL slot)가 `#root` blank 대상(`needsRootBlank`/`isLinkshopSurface`)에서 누락 → hard-load 시 prerender 된 홈 shell 깜빡(=다른 페이지 느낌). (C·D) 홈 카드가 hover/viewport 로 RQ 캐시(`groupBuyProduct`)를 warm 하는데 상세는 RQ 안 쓰고 raw axios cold fetch → prefetch 낭비 + SPA 에서 PageLoader→skeleton 이중 로더. **수정**: ① 신규 pure helper `pages/group-buy/seed-detail.ts` `pickSeedDetail`(RQ in-memory > SSR inject > localCache, id 일치만) 로 **첫 render 시드** → `detail` 초기값/`loading=seed==null` 로 skeleton 생략(시드 없으면 기존 skeleton+fetch fallback). axios 결과를 `qc.setQueryData(groupBuyProduct)` write-back(메인+폴링). ② worker `isDetailSurface` 추가 → linkshop 과 동일하게 `#root` 비움(else-if 1분기). **Toss/결제·SSR inject 페이로드·`caches.default` read·polling jitter·otherDeals·SEO/JSON-LD·아래폴드 lazy 전부 불변(additive — 시드 소비 + #root 분기만).** 검증: 단위 +10(seed-detail) 전체 2219 pass·tsc 0·build(worker+prerender) 통과·groupbuy-classify/theme 가드 통과. 롤백: seed import/seedDetail 제거(`useState(null)`/`useState(true)` 환원) + worker `isDetailSurface` 분기 제거.
- 2026-06-21 `[LOADING_ADDITIVE]` `worker/index.ts` 링크샵(`/u`·`/profile`·`/s`) 첫 로드 시 옛 홈 shell 잔상 제거 (대표 신고 "예전 잔재 이미지가 잠깐 뜸"). 원인: prerender 된 `index.html` `#root` 에 소비자 홈 shell(다크·라이브 nav, `data-ssr="main"`)이 구워져 있는데 링크샵은 `needsRootBlank`(도매/대시보드만) 대상이 아니라 React 마운트 전 그 홈 shell 이 잠깐 보임. 수정: `isLinkshopSurface` 면 `#root` 를 **비움**(empty) — 도매/대시보드의 라이트 placeholder 와 달리 링크샵은 테마 가변(다크 기본+라이트 토글)이라 색 placeholder 대신 body 테마 bg(인라인 스크립트가 이미 설정)만 잠깐 노출 → 곧 CuratorPage/SellerPublicPage 가 SSR 주입데이터로 즉시 렌더. **SSR inject(`__SSR_INITIAL_CURATOR/SELLER__`)·`caches.default` read·소비자 4페이지 inject·needsRootBlank 라이트 placeholder 전부 불변(additive — else-if 분기 1개)**. createRoot(비-hydrate)라 #root 비움 안전. 롤백: isLinkshopSurface 분기 제거.
- 2026-06-25 `[UNLOCK_LOADING]` `worker/index.ts` SPA HTML 셸에 `Cache-Control: no-cache` (대표 승인 "가장 이상적으로 모두" — 청크-stale 흰화면 *서버측* 근본차단). **원인**: 새 배포 후 브라우저/bfcache 에 옛 index.html(옛 청크 해시) 잔존 → 그 청크 404 → 흰화면/"버튼 눌러도 안 넘어감". 기존 HTML 셸은 Cache-Control 무설정이라 브라우저가 stale 사용 가능. **수정**: text/html 청크포인트(line 680 rewrite 직후)에 **`c.res.headers.set('Cache-Control', 'no-cache')` 1줄 additive** → 매 하드로드마다 서버 재검증 → 항상 fresh HTML(fresh 청크 해시). 클라 캐시버스트 복구(`chunk-error.ts reloadWithCacheBust`)와 이중 방어 → 향후 "새로고침조차 불필요". **⚠️ SSR 0-RTT 무영향 검증**: 0-RTT 는 API 페이로드를 `caches.default` 에 캐시(line 553 `.match`)하는 것이고 **HTML 셸은 edge 캐시 안 함**(`caches.default.put`/`cacheEverything` grep 0 — 워커가 매요청 ASSETS 에서 생성). `no-cache`=저장+사용전재검증(no-store 아님 → bfcache 유지). **SSR inject 블록(349-577)·`caches.default.match`·`#root` blank·CDN-Cache-Control 분리(API 라우트) 전부 byte-불변 — 출력 응답에 헤더 1개 추가만**. 현재 막힌 사용자는 새 no-cache HTML 1회 수신(=강력새로고침 1회) 후 영구. 롤백: 그 1줄 제거. 검증: tsc 0·build 0.
- 2026-06-20 `[UNLOCK_LOADING]` `MobileAppLayout.tsx`+`BottomNav.tsx`+`index.css`+`App.tsx` PC 컨슈머 = **"중앙 모바일 액자 + 데코 거터 레일 + 하단 네비" 단일 정체성** (대표 시안 '에버랜드 PC' + AskUserQuestion "1,2 모두 진행" 승인). 배경: 그간 framed↔full-width↔sidebar 플립플롭 누적 → 정체성 확정. 변경: ① `DESKTOP_RESPONSIVE_PATHS` 비움 → 홈도 430 액자. ② `framed` 면 좌측 `DesktopLiveSidebar` 숨김(`showSidebar = !hideSidebar && !linkshopVisitor && !framed`) + 신규 `ConsumerFrameRails`(xl+ 거터 좌:브랜드+모바일QR / 우:바로가기5+CTA, 전부 B&W) 렌더(`framed && !linkshopVisitor`). ③ `index.css` `app-frame-host` 거터에 모노 도트 텍스처(라이트/다크). ④ **`BottomNav` `lg:hidden` 제거 + `app-frame-bar`** → PC 액자 안 하단 네비(430 중앙) — **linkshopPath localStorage 우선순위·isActivePath 패턴 전부 byte-동일(표시 위치/가시성만 변경)**. ⑤ `App.tsx` `main` 의 `lg:pb-0` 제거(PC 하단 네비 여백 예약). **대시보드/도매몰/결제(`HIDE_SIDEBAR_PREFIXES`)·live/shorts(mobileOnly)·SSR inject(`worker/index.ts` 무수정)·`__SSR_INITIAL_*` 소비 전부 불변.** 모바일(<lg) 영향 0(app-frame-bar/액자 CSS 는 lg+ media). 검증: tsc 0·테마 일관성·build 통과. 시안: docs/design/pc-app-frame-decorated-rails.md. 롤백: DESKTOP_RESPONSIVE_PATHS 에 '/' 복귀 + showSidebar 의 `!framed` 제거 + BottomNav `app-frame-bar`→`lg:hidden` + index.css background-image 제거.
- 2026-06-20 `[LOADING_ADDITIVE]` `GroupBuyListPage.tsx` + `restaurant-map/useKakaoMap.ts` 동네딜 지도 동선 승격 (대표 시안 '에버랜드 파크맵', "1,2 모두 진행"). `/group-buy` 상단에 "내 주변 동네딜 지도" 진입 카드 → 기존 `RestaurantMapPage`(`/restaurant-map`, 지도+드래그 바텀시트+카테고리 칩+내 주변 GPS+공구권 오버레이 — 이미 완성형이나 NotFoundPage 외 미링크)로. 지도 마커 `#ef4444`→`#111827`(B&W 핀). **SSR 동네딜 리스트(`__SSR_INITIAL_GROUPBUY__`)·캐시키·그리드 전부 불변(additive — 진입 카드 1개 + 마커색).** 후속: `/group-buy` 리스트↔지도 토글, 동네딜 상품 좌표 노출.
- 2026-06-19 `[UNLOCK_LOADING]` `worker/index.ts` SSR self-fetch 타임아웃 WHOLESALE 1500→3000ms (대표 신고 — 도매 카탈로그 PC 스켈레톤 고착 + HTML 증거: 서빙된 `/wholesale` 문서에 `__SSR_INITIAL_WHOLESALE__` 스크립트 미존재 = `ssrPayload` 빈값 = self-fetch 1.5s timeout). 원인: 저트래픽 도매몰은 colo `caches.default` 대부분 cold → SSR self-fetch 가 콜드 D1(isolate 콜드스타트+ensure 4종+조회)을 1.5s 안에 못 끝냄 → timeout → 빈 ssrPayload → `head` rewriter 의 `if(ssrPayload)` 주입 스킵 → `#root` blank placeholder 만 + 클라가 또 콜드 fetch → 스켈레톤 장기화. **WHOLESALE 슬롯만** 3000ms 로 상향(DETAIL/SELLER/PRODUCT 2000·그 외 1500 불변) → 콜드여도 데이터 주입 완료(첫 콜드 사용자만 문서 ~2-3s wait, 이후 colo 캐시 300s). **warm(edge-hit) 경로·`caches.default.match` 직접 read·타 슬롯·소비자 4페이지 inject 전부 불변(additive — 분기 1개 추가).** ⚠️ 근본 enabler 는 `CACHE_KV` 전역 워밍(바인딩 시 self-fetch=KV-HIT 로 콜드 D1 0 → timeout 무관) — 대시보드 바인딩 확인 권장. 별개 이슈: 카탈로그 `total:1`(상품 1개뿐) = 데이터/노출등급 큐레이션. 롤백: timeout ternary 1줄 환원.
- 2026-06-19 `[UNLOCK_LOADING]` `useLinkshopPath.ts` PC 네비 링크샵 경로 우선순위를 BottomNav 와 통일 (대표 신고 — PC '링크샵' 클릭 시 `/profile/{username}` 으로 열림). **원인**: BottomNav(모바일)은 2026-06-17 에 `user_handle → /u/{handle}` 우선으로 고쳤는데 DesktopTopNav 가 쓰는 이 훅은 옛 `seller_username → /profile` 우선이 남아 PC 만 `/profile` 로 — 링크샵 `/u/` 단일화 결정과 어긋남. **수정**: BottomNav 와 동일하게 `user_handle → /u/{handle}` 우선(셀러여도 CuratorPage 가 linked_seller 면 storefront inline → 콘텐츠 손실 0), `hasConsumer` 면 `/u/me`, 셀러-only(소비자 계정 없음)만 `/profile` 폴백. 비로그인 `/u/me`·badHandle 가드 불변. 롤백: 우선순위 블록 환원.
- 2026-06-19 `[UNLOCK_LOADING]` `BottomNav.tsx` + `DesktopLiveSidebar.tsx` 5탭 IA 확정 — 동네딜 탭 → 교환권 (대표 AskUserQuestion 승인 "홈·교환권·공구권·링크샵·마이"). **배경**: 홈(`/`)이 이미 동네딜 피드(GroupBuyFeed)라 별도 동네딜 탭(`/group-buy`)이 홈과 중복 + 교환권(기프티콘 카탈로그)은 어느 탭에도 안 보임. **수정**: 하단바 2번째 탭 `MapPin 동네딜 /group-buy` → `Gift 교환권 /vouchers`(`nav.vouchers` 기존 키 재사용, prefetch VouchersPage). `isActivePath`: 홈(`/`)을 `/group-buy`·`/stays`·`/meal-vouchers` 에서도 활성(동네딜 surface 활성표시를 홈 탭이 담당) + 고아가 된 `/group-buy` 전용 분기 제거. **linkshopPath localStorage 캐시 우선순위·링크샵 active-path(`/profile/`·`/s/`)·공구권/마이/링크샵 탭 전부 불변** — 동네딜↔교환권 1탭 교체 + 홈 active surface 확장만. 전체 동네딜(지역/검색) 페이지는 홈 `GroupBuyFeed` 하단 '전체 동네딜 보기 →' 링크(이번에 `/vouchers`→`/group-buy` 정정)로 상시 진입. 사이드바도 동일(MENU 동네딜→교환권, 홈 active 확장). 롤백: 탭 정의 1줄 + active 분기 환원.
- 2026-06-18 `[UNLOCK_LOADING]` `group-buy-public.routes.ts` GET /products 에 `region`(시군구5/행정동~10 코드) 필터 **additive** (대표 "모두 다" — 하이퍼로컬 3단계). 기본 요청(region 없음)은 캐시키·쿼리·materialized·LIMIT 50·SSR 0-RTT 전부 **byte-동일**; `?region=` 붙은 요청만 분기(새 캐시키 `...:r{code}` + `product_regions` INNER JOIN + `region_dong_code LIKE 'code%'`). 2026-06-05 sort/page/limit additive 패턴과 동일. Cache-Control/CDN-Cache-Control 분리 불변. 현재 클라(GroupBuyListPage)는 자체 주소-텍스트 region 필터를 쓰므로 이 서버 param 은 **휴면(미사용)** — 향후 GPS 자동 '내 동네' 업그레이드용 토대. 롤백: region 분기 3블록 제거.
- 2026-06-17 `[UNLOCK_LOADING]` `BottomNav.tsx` + `useLinkshopPath.ts` 로그아웃 '링크샵' 버튼 목적지 `/host/new` → `/u/me` (사용자 신고 "이미 링크샵 있는데 만들기 페이지로 떨궈짐" + "가장 이상적으로"). **원인**: 비로그인 시 linkshopPath 가 `/host/new`(만들기, ProtectedRoute) → 클릭 시 로그인 → 로그인 후에도 `/host/new?userName=` 에 머물러 기존 유저가 자기 링크샵(`/u/{handle}`)이 아닌 만들기 페이지에 떨궈짐. **수정**: 비로그인 분기 `/u/me` 로 — `/u/me` 도 로그인 요구하지만 `UMeRedirectPage` 가 로그인 후 본인 핸들 해석 → 기존 유저 `/u/{handle}`, 핸들 없는 신규만 `/host/new` 폴백(기존 만들기 흐름 보존). **로그인 사용자 분기(seller_username→linked_seller→user_handle 우선순위)·localStorage 캐시·active-path 전부 불변** — 비로그인 fallback 1줄 + 초기 useState 만 변경. DesktopTopNav 는 `useLinkshopPath` 공유라 자동 정합. 롤백: 비로그인 분기 환원.
- 2026-06-17 `[UNLOCK_LOADING]` `worker/index.ts` 큐레이터 링크샵 flip-flop(셀러↔핀 왔다갔다) 근본수정 (사용자 신고 + 승인 "모두 진행") — `/api/curator/:handle` 미들웨어 `publicCache(300), cacheControl(60, 900)` → `edgeCache(300)`. **원인**: `publicCache`(bypassIfAuthed:false)가 URL-key 캐시를 소유자 인증요청에도 서빙 + `cacheControl` 이 핸들러의 소유자 `no-store`(curator.routes:178, 2026-06-13 owner-fresh 픽스)를 무조건 덮어씀 → owner-fresh 분기가 dead → 레이아웃 결정 필드 `linked_seller`(셀러연결 시 SellerPublicPage inline vs 핀 그리드)가 stale캐시↔fresh 사이에서 매 새로고침 튐. **수정**: `edgeCache`(bypassIfAuthed:true) → 인증(소유자/세션쿠키) 요청은 캐시 완전 우회 → 핸들러의 owner-aware 헤더가 그대로 적용(owner=`private,no-store` 신선, 익명=`max-age=60`+`CDN-Cache-Control:900`). **익명 방문자 + SSR self-fetch(무인증, index.ts:570) + cron prewarm(line 175) 은 그대로 `caches.default` 캐싱 → SSR 0-RTT/CDN-Cache-Control 분리/useKv:false 전부 불변(익명 경로 byte-동일)**. 잔여 transition window(승인 직후 ≤900s 익명캐시 stale)는 cron 재워밍/TTL 만료로 self-heal — 소유자 client fetch 는 항상 fresh라 상호작용 일관. publicCache/cacheControl 정의 자체 무수정(타 라우트 불변), curator.routes 핸들러 무수정. 롤백: 미들웨어 1줄 환원.
- 2026-06-17 `[UNLOCK_LOADING]` `BottomNav.tsx` linkshopPath 우선순위 변경 + `UMeRedirectPage.tsx` (사용자 결정 — "링크샵을 /u/ 로 단일화, /profile 안 씀") — 하단바 '링크샵' 버튼/`/u/me` 해석을 **소비자(큐레이터) 계정이 있으면 항상 `/u/{handle}` 우선**으로. 기존 `seller_username → linked_seller → user_handle` 순서에서 셀러여도 `/u/{handle}` 가 CuratorPage 에서 linked_seller 면 셀러 storefront 를 inline 렌더하므로 **콘텐츠 손실 0, URL 만 /profile→/u 통일**(unification 북극성 step 3 의 라우팅 부분). **셀러-only(소비자 계정 없음)는 `/profile` 유지** — 그들의 유일한 링크샵이라 회귀 방지(hasConsumer 가드). active-path 의 `/profile`·`/s/` 매칭은 보존(직접 진입 시 탭 활성). `/profile/:username` 직접 URL·SSR slot 불변. 롤백: 우선순위 블록 환원.
- 2026-06-17 `[UNLOCK_LOADING]` `group-buy-public.routes.ts` GET /products 에 `category=general`(일반 상품) 명시 지원 (사용자 요청 — 일반 상품 카테고리 추가). 기존엔 general 이 `VOUCHER_CATEGORIES` 에 없어 항상 voucher 로 폴백 → 클라 필터에서 0개로 사라지는 **구조적 빈 카테고리**였음. `categoryParam==='general'` 일 때만 `categories=['general']` 로 쿼리(이 분기 추가만). **기본 'all' 요청의 categories(voucher 4종)·캐시키(`group_buy_products:active:meal,beauty,stay,etc`)·materialized·SSR 0-RTT·Cache-Control/CDN-Cache-Control 분리 전부 불변** — general 전용 캐시키(`...:active:general`)는 신규(충돌 0). 롤백: ternary 1줄 환원.
- 2026-06-13 `[LOADING_ADDITIVE]` 대시보드 hard-load 홈 shell 깜빡임 제거 (사용자 신고 "대부분 페이지 로딩 중 / 홈이 잠깐 등장") — `worker/index.ts` HTMLRewriter 의 도매 surface `#root` 라이트 placeholder 로직을 `needsRootBlank = isWholesaleSurface || isDashboardSurface(/seller|admin|agency/)` 로 일반화. prerender 된 index.html `#root` 의 소비자 홈 shell(다크·라이브 nav)이 대시보드 첫 paint 에 잠깐 보이던 것 차단. **소비자 페이지 SSR inject·0-RTT shell·wholesale OG/canonical rewrite 전부 불변(additive)** — createRoot(비-hydrate)라 #root 비움 안전. 롤백: `needsRootBlank` → `isWholesaleSurface` 환원.
- 2026-06-11 `[LOADING_ADDITIVE]` 업로드 이미지 = R2 커스텀 도메인 파이프라인 (사용자가 media.ur-team.com 연결 + PUBLIC_R2_URL 등록 — 이상적 구조 전환) — `cf-image.ts` `/api/media/<key>` 분기를 워커 프록시(리사이즈 불가) → `/cdn-cgi/image/<옵션>/https://media.ur-team.com/<key>` 로. **prod 실측: cf-resized OK, 779KB→9.7KB(128px), 1y immutable** — 레거시 저장 URL 도 도메인 매핑만으로 전부 치유(재업로드 불필요). `media.ur-team.com` 을 EXTERNAL_PROXY_HOSTS(추가)+`CDN_CGI_VERIFIED`(실측 통과)에 등재. `/api/upload/` 분기·호스트 목록·Save-Data 불변. 아바타 소비처(UserProfilePage/BottomNav raw `<img>`) cfImage 래핑(additive). 신규 업로드는 PUBLIC_R2_URL 로 절대 URL 반환(upload.routes 기존 env 분기 — 코드 무수정). 롤백: cf-image 분기 1곳 복원. ⚠️ 버킷 공개화로 biz-cert 도 URL 노출 — 16자 랜덤키(~95bit)라 추측 불가, 장기적으로 별도 비공개 버킷 분리 권장(TECHNICAL_DEBT).
- 2026-06-11 `[LOADING_ADDITIVE]` 카드 이미지 외부호스트 변환 경로 수리 (사용자 신고 "현저히 느림" — prod 실측 기반) — `cf-image.ts` EXTERNAL_PROXY 분기 중 **실측 검증된 호스트(giftishow.com/kt.com)만** `/api/image/resize` 프록시 → **zone 리사이저 직접 래핑**(`/cdn-cgi/image/<옵션>/<외부절대URL>`)으로. 근거(GitHub Actions 실측): 프록시는 워커 내부 cdn-cgi subrequest 에 리사이저 미적용 → 항상 원본 폴백(143KB 그대로, 기프티쇼 origin 1~4.5s) / 브라우저→cdn-cgi 직접은 cf-resized OK(143KB→18KB, zone 캐시). ⚠️ **당일 회귀 교훈**: 첫 배포에서 전체 외부호스트에 적용했다가 카카오 프로필(kakaocdn) 깨짐 — cdn-cgi 직결은 리사이저의 원본 fetch 가 성공하는 호스트만 안전, 신규 호스트는 `prod-diag.yml` 로 cf-resized 실측 후 `CDN_CGI_VERIFIED` 에 추가. **SUPPORTED_HOSTS/EXTERNAL_PROXY_HOSTS 목록·Save-Data·`/api/media` 프록시 분기(06-06 사고로 cdn-cgi 불가) 전부 불변.**
- 2026-06-11 `[UNLOCK_LOADING]` `kakao.routes.ts` SSR Phase 2 D단계 (사용자 승인 "모두 진행") — 카카오 콜백의 linked seller/agency 토큰 전달 2지점(redirect transfer cookie/JSON 응답)에 httpOnly `ud_seller_token`/`ud_agency_token` Set-Cookie **추가 발급만**. 기존 transfer cookie→localStorage 이전 흐름·state CSRF·safeRedirect·linkUserExtraRoles 응답(seller.username 포함) 전부 불변(additive). 목적: beta.ur-team.com(SSR) 로그인 개인화. 설계: docs/SSR_PHASE2_AUTH.md. 롤백: cookie_block 2곳 제거.
- 2026-06-10 `[UNLOCK_LOADING]` 하단바 ➕(만들기) + 쇼핑 잠정 숨김 + 라이브 잔재 정리 (사용자 결정 — "라이브는 영구 중단, 쇼핑은 잠정 보류") — (1) `feature-flags.ts` `SHOPPING_TAB_HIDDEN=true` 신설: `BottomNav` 쇼핑 탭 → 가운데 ➕(시트: 유저=동네 공구 제안 `/community-group-buy/new`, 셀러=공구권 등록 — 기존 휴면 시트 재활용). `DesktopTopNav`/`DesktopLiveSidebar` 쇼핑·둘러보기·카테고리(식사권 외) 동일 플래그 게이트. **플래그 false 면 전부 즉시 복원(가역). /browse·/cart 라우트·prefetch 코드 보존, linkshop 경로캐시·active-path 로직 불변**. (2) `index.html` Speculation Rules 에서 `/live/*` prerender 제거(라이브 영구 중단 — `/group-buy/*`·`/products/*` 불변). DesktopTopNav LIVE 배지/라이브 탭 LIVE_COMMERCE_SUSPENDED 게이트. (3) 수요 신호 루프: community-group-buy `/create` → 어드민 벨 알림, `/confirm` → 참여자 전원 "공구 확정" 알림(fail-soft). (4) 링크샵 재정향: CuratorTabs 식사권 탭을 상품 앞으로 + 홈 탭 교환권/공구 핀 우선 정렬.
- 2026-06-06 `[LOADING_ADDITIVE]` 링크샵 배경/프로필 업로드 404 근본수정 (사용자 신고) — `cf-image.ts cfImage` 에 **additive 분기**: 워커가 R2 에서 서빙하는 same-origin 업로드 이미지(`/api/media/*`·`/api/upload/*`)를 `/cdn-cgi/image/` 대신 검증된 `/api/image/resize` 워커 프록시로 경유. 원인: 업로드는 R2 저장 성공(`/api/media/<key>` 상대 URL 저장, PUBLIC_R2_URL 미설정)인데 cfImage 가 `/cdn-cgi/image/.../api/media/...` 로 감싸 → CF URL 리사이저가 워커 서브요청 소스를 못 풀어 404. 프록시(cf.image fetch)는 리사이즈 비활성 시 원본 200 반환 → 절대 404 안 남. **SUPPORTED_HOSTS/EXTERNAL_PROXY_HOSTS/Save-Data 불변(제거 X)** — 분기 추가만. SSR/비브라우저는 raw R2 URL fallback. 커레이터 배너+프로필 동일 chokepoint 동시 해결.
- 2026-06-06 `[UNLOCK]` 카카오 become(도매/제조) same-email 자동연결 verified 게이트 (사용자 승인, 보안 audit M1) — `KakaoAuthService.upsertUser` 에 **additive**: 매 로그인 시 카카오 `is_email_verified` 를 `users.email_verified`(0/1) 에 저장(best-effort, 컬럼 없으면 repair-schema 후 채워짐). **기존 same-email 셀러 자동연결 로직·COUNT=1 가드 불변** — email_verified 쓰기만 추가. 목적: `become-distributor`(wholesale.routes) + `become`(supplier-auth.routes) 의 미연결 same-email 셀러/공급자 자동연결을 `email_verified===1` 일 때만 허용 → 미verified 카카오 email 로 사전등록(관리자 시드) 승인 계정 takeover 차단. upsert 가 become 보다 먼저 실행되므로 플래그는 호출 시점에 실제 verified 반영. `repair-schema` 에 `users.email_verified` 컬럼 추가.
- 2026-06-05 `[LOADING_ADDITIVE]` 도매몰 진입 시 소비자 홈 shell 깜빡임 제거 (사용자 신고) — `worker/index.ts` HTMLRewriter 에 **`/wholesale`·`/supplier` surface 한정** `#root` placeholder(라이트 `#F4F5F7`) 주입 추가. prerender 된 index.html `#root` 의 소비자 홈 shell(다크·라이브/동네딜 nav)이 hard-load 첫 paint 에 잠깐 보이던 것 차단. **소비자 페이지(`isWholesaleSurface=false`)는 기존 4페이지 SSR inject·`caches.default` read·nonce 처리 전부 불변(byte-identical)** — additive. createRoot(비-hydrate)라 #root 비움 안전.
- 2026-06-05 `[UNLOCK_LOADING]` 동네딜 필터 50개 cap 근본수정 (사용자 승인) — `group-buy-public.routes.ts` GET /products 에 `sort`/`page`/`limit` 서버사이드(additive). **기본 요청(파라미터 없음)은 캐시키·materialized·ORDER BY created_at DESC·LIMIT 50 불변 → SSR 0-RTT 보존**; 파라미터 붙은 요청만 새 캐시키 + 라이브쿼리(화이트리스트 ORDER BY + LIMIT/OFFSET, materialized 스킵). 클라 `GroupBuyListPage` 셀러탭 fetch `limit=200` 상향 → 50개 초과 공구가 필터/정렬에 안 잡히던 잠재버그 해소. Cache-Control 불변.
- 2026-06-05 `[UNLOCK]` 카카오 계정 중첩 근본수정 (사용자 승인 — 마이=정지원/링크샵=디스크프리) — (1) `KakaoCallbackPage.tsx`: 다른 user.id 로 로그인(계정 전환) 시 이전 계정 `seller_*`/`linked_seller_username`/`user_handle`/`agency_*`/`is_distributor` 잔존 키 제거(추가만, seller_username 저장·admin/agency user_type 보존 불변). (2) `KakaoAuthService.upsertUser` same-email 셀러 자동연결: email 이 정확히 1명에게만 속할 때(`COUNT=1`)만 연결 — cross-account 오연결 차단(verified 게이트는 기존 유지). (3) `repair-schema`: same-email 백필을 `LIMIT 1`(비결정적)→`COUNT=1` 1:1 + `ORDER BY u.id` 결정적, `idx_users_email_unique` 부분 UNIQUE 추가(best-effort, 중복 email 있으면 생성 실패→정리 후 재실행). (4) `handle-generator`: 한글/비라틴 닉네임 빈 슬러그→bare `'user'`(generic @user) 대신 `user{id}`, `'user'` 예약어 추가. 각 repair 스텝 개별 try-catch(556) — 인덱스 실패가 타 스텝 안 깨뜨림.
- 2026-06-04 `[UNLOCK_LOADING]` 홈 기본 카테고리 = '커피/음료' (사용자 요청 "기본으로 먼저 나오게") — (1) `worker/index.ts` MAIN SSR 슬롯 path 에 `&category=커피/음료`(URLSearchParams 인코딩 `%EC%BB%A4%ED%94%BC%2F%EC%9D%8C%EB%A3%8C`) 추가. (2) `cache-prewarm.ts` HOT_PATHS 에 동일 인코딩 key **추가**(기존 `deal_only=1&sort=price_low` key 존치 — `/vouchers` VOUCHERS 슬롯용) → 홈 0-RTT 유지. (3) `VouchersPage` embedded 기본 category = `EMBEDDED_DEFAULT_CATEGORY`('커피/음료') + SSR consume 가드를 embedded 시 `category==='커피/음료'` 일 때 `__SSR_INITIAL_MAIN__` 읽도록 변경(비embedded `/vouchers` 는 기존 `!category` 동작 불변·default sort price_low 불변). (4) 브랜드 그리드: 브랜드 클릭(필터)해도 그대로 유지(`!brand &&` 제거) + 선택 브랜드 ring 강조 + 재클릭 해제. (5) 커피 브랜드 우선순위 정렬 `orderedBrands`(스타벅스/메가/투썸/할리스/컴포즈/빽다방, `name.includes`, 나머지 원본순). 쿼리 문자열은 클라/서버/cron 1:1 일치(슬래시 `%2F`)라야 cache key 정합 — 셋 모두 동일 리터럴.
- 2026-06-04 `[LOADING_ADDITIVE]` 동네딜·링크샵 로딩 최적화 (감사 기반, 사용자 "근본적 이상적" 승인) — 홈(교환권)은 빠른데 동네딜(`/group-buy` 리스트)·링크샵(SellerPublicPage) 느림 보고. **모두 additive(기존 슬롯/키/헤더 불변, 약화 X)**: (1) `worker/index.ts` SSR 매처에 **GROUPBUY 슬롯 신규**(`/group-buy`&!search → `/api/group-buy/products?status=active`) — 유일 누락 리스트 페이지(기존 4페이지 inject 패턴 그대로). (2) `cache-prewarm.ts` HOT_PATHS 에 동일 key `?status=active` 추가(기존 `&category=all` 와 별개 — 클라 요청 정확 일치). (3) `GroupBuyListPage` 가 `__SSR_INITIAL_GROUPBUY__` consume-once → 마운트 cold fetch 워터폴 제거. (4) 링크샵: dynamic prewarm 에 top10 셀러 `/api/products?seller_id=ID&limit=20`(기본탭 sub-data) 추가 + `/api/shorts/feed` edge cache 추가(정확매칭 `/api/shorts` 에서 서브경로 누락분). sub-request 44/50 안전.
- 2026-06-01 `[LOADING_ADDITIVE]` 피드 카드 React.memo 추출 (감사 기반, 사용자 승인 "이상적 진행") — `VouchersPage`(홈 블렌드) `BrowsePage`(쇼핑) 의 인라인 `.map()` 카드를 `React.memo` 컴포넌트(`VoucherCard`/`BrowseProductCard`)로 추출. 부모 재렌더(스크롤 reveal/필터/무한스크롤 append) 시 전체 카드 재조정되던 것 차단 — `GroupBuyFeedCard`/`ReelCard` 와 동일 패턴의 누락분. **순수 렌더 래퍼 — `__SSR_INITIAL_VOUCHERS__`/`__SSR_INITIAL_BROWSE__`·default sort `price_low`·이미지 속성(width/height/srcSet/lazy/dominant_color) 전부 불변**(약화 X, additive). BrowsePage `toggleInterest` 는 `currentlyInterested` 인자 + `useCallback([t])` 로 안정화(interestedIds per-card boolean 전달 → 토글 카드만 재렌더). `MyVouchersPage` qrcode.react lazy(QR 모달 열 때만, page chunk -10KB).
- 2026-06-01 `[UNLOCK_LOADING]` 유통스타트 도메인 진입 redirect (사용자 승인 "모두 진행") — `worker/index.ts` **export default fetch 진입부에 additive 가드만 추가**: host 가 `utongstart.com`/`www.` 이고 path 가 `/` 이면 `/wholesale` 로 302. **잠긴 SSR inject(349~577)·`caches.default` read 미수정** — 다른 호스트는 즉시 `app.fetch` 통과(no-op). live.ur-team.com 동작·성능 불변. 목적: 클라이언트 redirect 의 첫 깜빡임 제거.
- 2026-06-01 `[UNLOCK_LOADING]` 홈 = 교환권 + 딜모으는법 전환 (사용자 승인) — 홈 `/` 메인 콘텐츠를 공구 피드 → 교환권으로 변경. (1) `worker/index.ts` MAIN SSR 슬롯 path 를 `/api/products?...deal_only=1&sort=price_low`(이미 HOT_PATHS warm → 0-RTT 유지)로 변경. (2) `VouchersPage` 에 `embedded` prop 추가 — embedded 시 SEO/자체헤더 skip + SSR 를 `__SSR_INITIAL_MAIN__` 에서 읽음(기존 `/vouchers` 동작·default sort price_low 불변). (3) `MainHomePage` 가 `GroupBuyFeed` → `DealEarnStrip`(정적) + `<VouchersPage embedded/>` 렌더. entry chunk 58.9KB(회귀 없음). 오프라인 공구는 동네딜(`/group-buy`) 탭 전담. GroupBuyFeed prewarm paths 는 동네딜용으로 유지.
- 2026-06-01 `[UNLOCK_LOADING]` 하단바 재구성 (사용자 승인) — `BottomNav.tsx` 5탭 재배치: 교환권(`/vouchers`) 탭 제거 → 동네딜(`/group-buy`, MapPin) 추가. 순서 홈/동네딜/쇼핑/링크샵/마이. **linkshop localStorage 경로 로직·active-path 패턴 보존** + 동네딜 active-path(`/stays`,`/meal-vouchers`) 추가. `DesktopTopNav` 공구 라벨도 동네딜로 정합. nav.dongnedeal 6개 언어. 교환권 콘텐츠는 블렌드 홈 상단 + `/vouchers` 전체보기로 유지(라우트 불변). 다음: 홈을 기프티콘+딜모으는법으로 전환.
- 2026-05-27 초기 잠금 — commit `cf837926` 외 누적 (`0d6217fe` 이후 모든 perf commit)
- 2026-05-27 2차 확장 — commit `c4925af`~`74bb925` (이번 세션 총 14 commits, critical path -341 KB / -31%)
  - 폴링/Countdown adaptive (`c4925af`)
  - voucher cache invalidation (`daeb2c8`)
  - 카테고리 prewarm + Cache-Control 분리 (`cb8d0a5`)
  - useMyCounts 통합 + Card.memo + SSR 확장 (`9de2840`)
  - GroupBuyDetail below-fold lazy + unused import (`21ab0fb`)
  - cf-image host 확장 + VoucherMap lazy (`b8bd41d`)
  - img-utils critical path -51KB + admin limits + audio singleton (`5583eed`)
  - env-validator dynamic + admin/agency limits + 4 모달 lazy (`cbb08c8`)
  - env-validator chunk 분리 → validation -52KB lazy (`5e556a4`)
  - Phase 1+2 chunk 분할 (`dfb11df`)
  - Phase 3 FrameWrapper 사고 + rollback (`374ea9c`/`336a988`)
  - Phase 4 live hooks (`c1a42d7`)
  - Phase 5 single-page hooks (`74bb925`)
- 2026-05-31 `[UNLOCK_LOADING]` 카카오 same-email 셀러 자동연결 verified 게이트 (사용자 승인, 보안 audit) — `KakaoAuthService.upsertUser` 의 seller auto-link 에 `kakaoUser.emailVerified === true` 조건 추가 (카카오 `is_email_verified`). 미verified email 로 사전생성된 미연결 셀러 행 takeover 차단. **`/host/new` fall-through 방지 동작은 verified 사용자에게 그대로 유지** (대부분 카카오 email 은 verified). KakaoUser/KakaoUserInfoResponse type 에 emailVerified/is_email_verified 필드 추가.
- 2026-05-28 `[UNLOCK_LOADING]` 이미지별 dominant_color placeholder (사용자 허가) — 카드 이미지 깜빡임 0.
  - products.dominant_color 컬럼 (migration 0282 + repair-schema) + 클라이언트 canvas 1x1 lazy 백필 (`src/utils/dominant-color.ts`)
  - 잠금 라우트 SELECT 에 dominant_color 추가 (group-buy-public.routes / ProductRepository LIST_COLUMNS) — 추가만, Cache-Control 등 기존 잠금 동작 불변
  - GroupBuyFeedCard / VouchersPage / BrowsePage 카드: `p.dominant_color || 카테고리 색` fallback + onLoad 백필
  - 신규 public endpoint `POST /api/products/dominant-color` (hex 검증 + NULL 일 때만 UPDATE + rate limit)
- 2026-05-30 `[UNLOCK_LOADING]` 공동구매 = 즉시판매 단일가 모델 (A2, 사용자 허가) — 동적 tier 제거.
  - 배경/설계: `docs/design/groupbuy-instant-sale.md`. 경제=즉시판매, 이름=공동구매 유지, 가격=인원 무관 최대 tier 할인 즉시 단일 적용.
  - `group-buy-public.routes.ts`: 상세 `current_discount_pct = maxTierDiscount`(고정), `next_tier/next_tier_remaining = null`. 리스트 응답에 `current_price` enrich. **Cache-Control / CDN-Cache-Control / tiers array parse 불변** (body enrich + 할인율 의미만 변경).
  - `helpers.ts`: `maxTierDiscount()` 추가 (calcTierDiscount 는 존치 — 테스트/하위호환).
  - `group-buy.routes.ts:223`: join 가격 = `maxTierDiscount` (비잠금 파일).
  - `GroupBuyDetailPage.tsx`: 단계별 tier 사다리 UI + "N명 더 모이면 할인 시작!" 제거 → 정직한 단일가 안내. CountdownRing adaptive / below-fold lazy 등 perf 락 불변.

### 2차 확장 — 추가 잠금 항목 (회귀 시 critical path 30%+ 증가 위험)

| 파일 | 잠긴 항목 | 회귀 시 발생 |
|---|---|---|
| `src/hooks/queries/useMyData.ts` | `useMyVouchers / useMyOrders / useMyAppointments` 의 `refetchOnMount: 'always'` | voucher/주문 발급 후 페이지 진입 시 빈 화면 (2026-05-27 사고) |
| `src/pages/user-profile/useMyCounts.ts` | `useMyVouchers` 재사용 (별도 fetch 금지) | /user/profile 카운트 ↔ /my-vouchers 목록 불일치 재발 |
| voucher 발급 4곳 (`GroupBuyDetailPage`, `GroupBuyConfirmPaymentPage`, `VoucherDetailPage`, `ProductDetailPage`) | `useInvalidateMyVouchers()` 호출 — voucher 발급 후 navigate 직전 | RQ stale cache 영구 표시 |
| `src/main.tsx` | `validateEnvForRuntime` dynamic import — eager 금지 | zod 52KB chunk critical path 진입 |
| `vite.config.ts` `manualChunks` | env-validator/AdminLayout/AgencyLayout/SellerLayout 등 별도 chunk + seller-public/agency/dashboard/payments/cart/search/mypage/wallet/group-buy/product/guide/shipping/upload/glass/settings 폴더별 chunk + useLiveStream/product-template/useCart/useSearch/useTokenAutoRefresh hoisted | critical path -341 KB 회귀 |
| `src/utils/cf-image.ts` `SUPPORTED_HOSTS` / `EXTERNAL_PROXY_HOSTS` + worker `ALLOWED_HOSTS` | ImgBB (i.ibb.co), googleusercontent 추가 — 제거 금지 | 셀러 업로드 이미지 변환 회피 → 트래픽 폭증 |
| `src/worker/cron/cache-prewarm.ts` | 카테고리 칩 4종 prewarm (meal/stay/beauty/etc) — 제거 금지 | 칩 클릭 시 cold D1 (~200-500ms) |
| `src/features/group-buy/api/group-buy-public.routes.ts` | `Cache-Control: max-age=60` + `CDN-Cache-Control: max-age=900` 분리 + `group_buy_tiers` 서버 parse → array 반환 | 브라우저 5분 stale (신선도 회귀) + 클라이언트 JSON.parse 부담 |
| `src/features/products/api/products.routes.ts`, `src/worker/routes/public-utility.routes.ts` | 동일 Cache-Control / CDN-Cache-Control 분리 | 동일 |
| `src/worker/index.ts` SSR inject regex | `/(?:profile\|s)/:slug` 둘 다 매칭 — 제거 금지 | `/s/:id` SSR cache miss 회귀 |
| `src/pages/GroupBuyDetailPage.tsx` | CountdownRing adaptive interval + polling adaptive jitter + below-fold lazy (Confetti/RestaurantMiniMap/ProductReviewsSection) | 매초 리렌더 회귀 + 폴링 부하 ↑ + 초기 chunk 30-50KB ↑ |
| `src/pages/main-home/GroupBuyFeedCard.tsx` | `React.memo` + `rootMargin: '100px'` (200px 금지 — 트래픽 ↑) | 카드 reconcile + 익명 사용자 트래픽 ↑ |
| `src/pages/MyVouchersPage.tsx` | VoucherMap lazy chunk (Kakao Maps SDK) | 진입 시 ~150KB 즉시 로드 |
| `src/lib/image-compress.ts` | `browser-image-compression` 함수 내 dynamic import (module-level eager 금지) | critical path +51KB |
| 발급/주문/모달 lazy (`SellerOrdersPage`, `MyOrdersPage`, `AdminPage`) | OrderDetailModal / BizInfoModal / RejectionModal lazy + Suspense | 페이지 chunk 10-30KB ↑ |

---

## 🚨 개발 + 에러 대처 절대 룰 (모든 다른 룰보다 우선)

**개발/리팩토링 작업 시작 시**: `docs/DEV_IMPLEMENTATION_PLAYBOOK.md` 먼저 스캔.
**에러/버그 신고 받았을 때**: `docs/ERROR_DEBUGGING_PLAYBOOK.md` 먼저 스캔.
**처음 보는 에러 메시지**: `docs/KNOWN_ERRORS.md` 에서 grep — 매칭되면 5분 fix.

핵심 (Playbook 요약):
1. **추측 금지** — "캐시일거다", "env 일거다" 단정 후 코드 변경 X
2. **진단 페이지/명령 먼저** — 같은 에러 2번 보고 받으면 무조건 ground truth 수집 도구 작성 (10분 이내)
3. **에러 메시지 단어 그대로 grep** — 의역 X. `node_modules/<sdk>/types/*.d.ts` 에서 1:1 매칭
4. **dual-mode 제거 금지** — "통일/단순화" 명목으로 기존 분기 삭제 X
5. **1 commit = 1 원인** — 큰 리팩토링 X

> ⚠️ 이 룰 안 지키면: 2026-05-23 Toss 사건처럼 추측 fix 5번 반복 → 사용자 시간 1시간+ 낭비.

## 🔄 진행 중 작업 인계 (필수 — 새 세션 진입 시 첫 액션)

**새 세션 시작 시 반드시 `docs/CURRENT_WORK.md` 먼저 읽기.**

이 파일은 **진행 중 / 미완 작업의 단일 진실원천 (SSOT)**:
- 현재 작업 중인 기능 / 미완 todo 리스트
- 최근 커밋 + 핵심 아키텍처 결정
- 다음 작업 우선순위

**자동 업데이트 룰 (모든 세션이 지킬 것)**:
1. 새 기능/리팩토링 시작 시 → `docs/CURRENT_WORK.md` 의 "진행 중" 표에 추가
2. 기능 완료 + commit 시 → 해당 항목을 "완료" 섹션으로 이동 + commit hash 기록
3. 사용자가 새 요구 추가 시 → 즉시 표에 반영
4. 매 commit 의 변경 파일에 코어 기능 (송출/결제/인증) 포함 시 → 같은 commit 에 `docs/CURRENT_WORK.md` 갱신 함께 staged

> ⚠️ 이 룰 안 지키면: 다음 세션이 진행 상태 모름 → 중복 구현 / 누락 / 사용자 "왜 이거 안 됐어?" 반복.

## 🛡️ 감사 게이트 — 전수감사 전 필수 (2026-06-26 대표 지시 "이상적이면 이후 감사에선 안 보고 넘어가게 환경 설정")

**감사/전수조사 요청을 받으면 먼저 `bash scripts/audit-gate.sh` 를 돌려라.** 그리고:

1. **GREEN 도메인은 수동 재감사 금지** — 그 불변식은 결정론적 가드가 지키고 있다(`docs/AUDIT_INVARIANTS.md` 레지스트리). 가드가 GREEN 인 영역을 또 전수조사하는 건 시간 낭비 + 오탐 양산(이번 세션 교훈). 그 영역은 *새 코드가 가드를 통과하는지*만 보면 된다.
2. **RED·미보유 영역만 작업** — 게이트가 RED 면 그 가드가 가리키는 사이트만, `AUDIT_INVARIANTS.md` 의 "가드 미보유" 영역(결제 금액정확성·런타임 크래시·외부 PG 실응답)만 수동 감사.
3. **새 불변식을 발견·확인하면 가드부터 만들어라**(애초에 없도록) → `audit-gate.sh` + `AUDIT_INVARIANTS.md` 갱신. 수동 감사 결과를 반복하지 말고 기계가 지키게 한다.

> 현재 29개 불변식 GREEN (서비스분리·인증세션RBAC·머니패턴·DB스키마·상품종류·UI테마·배포). 상세: `docs/AUDIT_INVARIANTS.md`.

## 🎨 디자인 시안 archive 룰 (필수)

사용자가 디자인 시안 (이미지/스크린샷) 을 보낼 때:

1. **반드시 `docs/design/<page-name>.md` 에 저장** — 채팅 이미지는 세션 끝나면 사라져 다음 세션이 못 봄
2. 파일 구조: 시안 설명 + 현재 vs 시안 차이 표 + 구현 todo 체크리스트
3. **구현 전이라도** 시안 받은 즉시 commit + push (다음 세션 / 다른 에이전트가 추적 가능)
4. 구현 완료 시 같은 파일 하단에 `## ✅ 구현 완료` + commit hash 추가
5. 미구현 시안 목록은 `docs/design/README.md` 의 표에 등록

> ⚠️ 이 룰을 안 지키면: 시안이 채팅에서 잊혀지고 → 구현 안 됨 → 사용자가 "왜 이거 안 됐어?" 질문 반복.

## 📚 문서 분할 (CLAUDE.md 는 활성 룰만)

- **`docs/INCIDENTS.md`** — 사고 기록 / 재발 방지 룰의 출처
- **`docs/SCHEMA.md`** — DB 스키마 룰 (금지 컬럼, status 값 등)
- **`docs/ROUTES.md`** — `/api/seller` 등 라우트 매핑
- **`docs/design/`** — UI 시안 archive
- **`TECHNICAL_DEBT.md`** — 기술 부채 목록

CLAUDE.md 는 매 작업마다 읽는 활성 규칙만 유지. 사고 후일담 / 긴 표 / 시안 detail 은 위 파일로 분리.

## 📝 블로그 시드 자동 업데이트 (2026-07-01 대표 지시 — "코드 수정될 때마다 블로그도 자동 반영")

소비자 블로그(`/blog`, `/admin/blog`)는 `blog_posts` 테이블 + **버전 재시드** 구조.
- **SSOT 시드**: `src/features/blog/api/blog.routes.ts` 의 `blogSeedPosts()` 배열 + `BLOG_SEED_VERSION` 상수.
- **자동 반영 원리**: `BLOG_SEED_VERSION` > DB 저장 버전이면 배포 후 첫 접근 시 `maybeSyncBlogSeed()` 가 자동 동기화. 신규 글 삽입 / 시드 관리 글(`is_seed=1, manually_edited=0`) 최신화 / 새 시드에서 빠진 낡은 글은 **비공개**(삭제 아님). 관리자가 `/admin/blog` 에서 **직접 수정(`manually_edited=1`)하거나 생성(`is_seed=0`)한 글은 절대 덮어쓰지 않음**(수동 편집 보존).

> ⚠️ **필수 룰 (모든 세션 준수)**: **서비스 사실이 바뀌면 블로그 시드도 같은 커밋에서 고치고 `BLOG_SEED_VERSION` 을 +1 하라.** 안 올리면 라이브 블로그가 안 바뀜. 특히:
> - 명칭 SSOT 변경(이용권/유저/사업자 유저/링크샵/동네딜/교환권 등) → 관련 글 문구 갱신
> - 기능 신설/중단(예: 라이브커머스 영구중단, 쇼핑탭 숨김) → 해당 글 삭제/수정
> - 수수료율·딜포인트·결제·정산 규칙 변경 → 해당 가이드 글 갱신
> - ❌ 블로그 시드에 낡은 용어(식사권/공구권, "라이브 커머스"를 현재 기능으로) 재유입 금지 — `scripts/check-blog-seed-currency.mjs` 가 감지.
> - ❌ 도매몰(유통스타트/판매사/제조사) 내용 유입 금지 — 소비자 블로그 전용(서비스 분리).
> - 💰 **수치 사실(수수료 5%·원천징수 3.3%·딜포인트·최소후원 500딜)** 이 코드 SSOT(`fee-resolver.ts`/`tax-withholding.ts`/`points.routes.ts`)에서 바뀌면 블로그 시드도 같은 커밋에서 갱신 — `scripts/check-blog-fact-sync.sh` 가 감지(warn).

수동 강제 재동기화: 어드민 `POST /api/blog/seed` (버전 무관 강제 sync).

### 🤖 AI 홍보 초안 (2026-07-01 대표 지시 — "비즈니스(서비스 홍보) 차원만, 운영 정보 유출 금지")
- **목적**: 현재 서비스 사실 기반 **소비자 홍보/마케팅 초안**을 AI로 생성 → **항상 비공개 초안**(`is_published=0, ai_generated=1`) → 관리자 검토 후 발행.
- **SSOT**: `src/features/blog/api/blog-ai.ts` — `PROMO_BRIEF`(홍보용 사실만, 운영 수치 제외)·`PROMO_TOPICS`(홍보 주제 백로그)·`generateBlogDraft()`(Claude + 출력 검증).
- **🚫 운영 정보 차단**: brief 에 수수료율·정산·원천징수·커미션·매출·관리자·도매(B2B) 를 **아예 넣지 않고**, 출력에 그런 용어(+폐기어·도매몰 명칭)가 나타나면 **초안 폐기**(1회 재시도 후 실패). 소비자 홍보 콘텐츠만 통과.
- **트리거**: 관리자 수동 `POST /api/admin/blog/ai-draft`(AdminBlogPage "AI 홍보 초안" 버튼) + 주간 cron(`blog-ai-draft`, 월요일). cron 은 킬스위치 **`BLOG_AI_DRAFTS_ENABLED='true'`** 일 때만(기본 OFF — 토큰 낭비 0). `ANTHROPIC_API_KEY` 필요.
- **캡**: 미검토 AI 초안 5개 이상이면 생성 중단(검토 유도). 초안은 `is_seed=0` 이라 재시드가 안 건드림.
- 🔁 **되먹임 루프(닫힌 루프)**: 발행 글 조회수(`blog_posts.view_count`, 공개 `POST /api/blog/public/:slug/view` — 세션당 1회)를 태그별 평균으로 집계해, `pickPromoTopic()` 이 **성과 좋은 태그를 가진 미작성 주제를 우선** 생성. 성과 데이터 없으면 백로그 순 폴백. 관리자 목록에 조회수 노출. → AI 생성이 성과 기반 자기최적화.

### 🔎 블로그 SEO (구글 + 네이버) — 지속 최적화 규칙
- **비-JS 크롤러(네이버/카카오/소셜 스크래퍼) 대응**: `/blog`·`/blog/:slug` 는 `worker/index.ts` HTMLRewriter 가 **서버측에서 title/description/OG/twitter/canonical + `BlogPosting` JSON-LD** 를 주입(도매 surface 패턴과 동일). 상세는 `BLOGPOST` SSR 슬롯이 `/api/blog/public/:slug` 를 edge-read/self-fetch → 그 payload 로 메타 생성 + `__SSR_INITIAL_BLOGPOST__` 0-RTT. (Googlebot 은 JS 렌더로 `<SEO>`(react-helmet)도 봄.)
- **발견성**: `/blog` 는 `SiteFooter`(프리렌더된 홈에 포함 → 네이버도 발견) + `sitemap.xml`(`is_published=1` 글 포함) + **RSS `/blog/rss`**(`blog-seo.routes.ts`)에 노출. 상세엔 "함께 보면 좋은 글"(같은 태그) 내부 링크.
- **공유 배너**: 글별 동적 OG 이미지 `GET /blog/og/:slug`(SVG 1200×630, 제목+태그+브랜드 — `blog-seo.routes.ts`). 상세 head 에 og:image/twitter:image 로 주입(사이트 기본 OG 도 SVG 라 호환). ⚠️ 카카오/일부 소셜은 raster(PNG) 선호 — 필요 시 satori/resvg 로 PNG 업그레이드(별도 결정).
- **새 글 작성 시 SEO 필수**: 모든 시드/발행 글은 **`summary`(메타 description, ~50~160자)**, **`tags`(≥1)**, **고유 `slug`(영문 kebab)** 를 갖출 것 — 서버 메타/OG/related 가 이 값들을 사용. 제목은 핵심 키워드를 앞쪽에.
- ❌ 블로그 라우트(`/blog*`)를 `robots.txt` 에서 Disallow 하지 말 것(현재 Allow). 새 소비자 글 URL 은 sitemap 이 자동 포함.

## 📖 운영 가이드 3종 자동 업데이트

DB(`operation_guides` 테이블) 에 저장된 3개 가이드:
- `admin` → `/admin/operations-guide`
- `seller` → `/seller/guide`
- `agency` → `/agency/guide`

**시드**: `src/features/guides/api/guide-seed.ts` (DB 비었을 때 1회 시드, UI 편집 시 DB 가 시드 덮어씀).

### 코드 변경 시 함께 업데이트
- 새 API 엔드포인트 → 영향받는 역할의 가이드 섹션
- 새 관리자 페이지 → 어드민 가이드 "유용한 링크"
- 정산/주문 플로우 변경 → 어드민 + 셀러 동시
- 수수료율 변경 → 어드민 + 셀러 + 에이전시 동시
- 장애 발생/해결 → 어드민 "기술 장애 대응" 섹션
- FAQ 추가 → 해당 역할 "자주 묻는 문제"

### 업데이트 방법
- **권장**: `guide-seed.ts` 수정 + 프로덕션 DB 해당 섹션 DELETE → 재시드
- **대안**: 관리자가 `/admin/operations-guide` 에서 직접 편집

### 자동 강제 (`scripts/check-guide-sync.sh`)
Pre-commit hook 이 다음 파일 변경 시 `guide-seed.ts` 동시 수정 검사:

| 변경 파일 | 영향 가이드 |
|---|---|
| `src/pages/Seller*.tsx`, `src/features/(seller\|youtube)/api/*.ts` | 셀러 |
| `src/pages/Admin*.tsx`, `src/worker/routes/*.ts` | 어드민 |
| `src/pages/Agency*.tsx`, `src/features/agency/api/*.ts` | 에이전시 |
| `src/features/auth/api/*.ts` | 모두 |

기본 warn-only, 차단 모드: `STRICT_GUIDE_SYNC=1`.

### 자동 생성 참조 (`scripts/generate-guide-references.mjs`)
각 가이드 끝에 "코드 자동 참조" 섹션 자동 추가 (key=`auto-reference`, order=999):
- `src/App.tsx` 라우트 + `*.routes.ts` 의 endpoint 추출
- 출력: `src/features/guides/api/auto-reference.ts` (수동 편집 금지)
- Pre-commit hook 자동 재생성. 수동: `npm run generate:guide-refs`

후속 PR 로 미루면 커밋 메시지에 `guide-update-pending` 명시.

## 🚨 기술 부채 & 알려진 이슈

**전체 목록**: `TECHNICAL_DEBT.md`. 특히 주의:
- 🔴 DB Migration CI 미작동 (D1 권한 없음) → `/api/_internal/repair-schema` 응급 처치
- 🟡 스키마 이중화 컬럼 (`stock`/`stock_quantity`, `shipping_fee`/`base_shipping_fee`)
- 🟢 시크릿 회전 완료 (2026-04-27) — 자세한 내용은 `docs/INCIDENTS.md`

## 🚨 큰 파일 / PowerShell 수정 규칙 (2026-05-12 사고 후 추가)

**배경:** `youtube-live.routes.ts` (1978줄) 가 이전 에이전트의 PowerShell 전체 덮어쓰기 실패로 `// PLACEHOLDER` 2줄만 남고 모두 삭제됨 → YouTube 라이브 API 5개 전부 404 → 셀러 방송 시작 불가 → 메인에 라이브 노출 안 됨. commit `b09d9b4` (-1953줄) 으로 push 됐는데 빌드/diff 검증 누락. 자세한 경위는 `docs/INCIDENTS.md`.

### 절대 하지 말 것
- ❌ **500줄 이상 파일에 Write (전체 덮어쓰기) 사용 금지** — 반드시 Edit 으로 부분 수정
- ❌ **PowerShell `Set-Content` / `Out-File` / heredoc 으로 큰 코드 덮어쓰기 금지** — 한글 인코딩 + 버퍼 잘림 사고 빈발
- ❌ **`Get-Content -Raw` 로 한글 포함 파일 읽기 금지** — 기본 인코딩이 UTF-8 아님 → 한글 깨짐
  - 안전한 방법: `[System.IO.File]::ReadAllText($path, [System.Text.UTF8Encoding]::new($false))`
  - 안전한 쓰기: `[System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))`

### 반드시 할 것
- ✅ **commit 전 `git diff --stat` 으로 줄 수 변화 확인** — `-500` 이상 줄이 사라졌으면 의심하고 멈춤
- ✅ **push 전 `npx vite build` 또는 `npx tsc --noEmit --skipLibCheck` 통과 확인 필수**
- ✅ **PowerShell 로 파일 수정한 직후 Select-String 으로 한글 깨짐 검증** — 예: `Select-String -Path X -Pattern "시스템"` 매치 안 되면 인코딩 깨진 것
- ✅ **`export default` 같은 중복 가능 라인은 추가 전에 `Select-String` 으로 기존 존재 여부 확인** — 중복 export → 빌드 실패

> ⚠️ 이 룰 안 지키면: 오늘처럼 또 라이브 API 통째로 날아감 → 운영 중단.

## 📐 PC 반응형 디자인 시스템 (2026-05-02 도입)

### 핵심 원칙
1. **모바일 First** — 기존 모바일 디자인 그대로
2. **PC 활용** — `lg:` (1024px+) / `xl:` (1280px+) / `2xl:` (1536px+) variants
3. **콘텐츠 폭 토큰** (`src/index.css`):
   - `ur-content-narrow` (720px) — form / 결제 / 가입
   - `ur-content-medium` (1024px) — 가이드 / 약관
   - `ur-content-wide` (1280px) — 쇼핑 / 그리드 / 마이
   - `ur-content-full` (1536px) — 어드민/셀러 대시보드
4. **9:16 비디오 페이지** (`/live/*`, `/shorts`) — `MOBILE_ONLY_PREFIXES` 매칭, PC 에서도 430px 액자

### 페이지별 패턴

| 페이지 종류 | 폭 토큰 | 핵심 변환 |
|---|---|---|
| 쇼핑 그리드 | `ur-content-wide` | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5` |
| 상품 상세 | `ur-content-wide` | mobile 1열 → lg 좌이미지 / 우구매 |
| 결제/주문 | `ur-content-narrow` | PC 가운데 정렬 |
| 마이 | `ur-content-medium` | mobile 1열 → lg 2단 |
| 홈 | `ur-content-wide` | 라이브 카드 4-5열 |
| 라이브 | `data-mobile-only="true"` | 9:16 풀스크린 |
| 셀러/어드민/에이전시 | (변경 없음) | 풀 너비 |

### 새 페이지 작성 체크리스트
1. mobile 우선 (430px 가정)
2. PC: `<div className="ur-content-wide px-4 lg:px-8">` + 그리드/폰트/간격 lg variants
3. sticky header/footer 풀너비, 내부 콘텐츠는 `ur-content-*` centered
4. 9:16 비디오면 `MOBILE_ONLY_PREFIXES` 추가
5. 4가지 뷰포트 (≤640 / 768 / 1280 / 1920) 확인

### PC 사이드바 / TopNav
- `DesktopTopNav` (lg+) + `DesktopLiveSidebar` (xl+)
- BottomNav `lg:hidden` (PC 에서 숨김)
- MobileAppLayout 자동: `xl:pl-56` + `2xl:pr-72`
- HIDE_SIDEBAR_PREFIXES (셀러/어드민/에이전시/embed/checkout-return/introduce) 만 사이드바 제외

> 시안에 따른 사이드바 재설계 todo: `docs/design/home-sidebar.md`

## 🎨 테마 규칙 (필수)

페이지 생성/수정 시 **반드시** 해당 테마에 맞는 색상 사용.

### 다크 테마 — 유저 대면 메인
- **해당**: 홈 (`/`), 라이브 (`/live/*`), 쇼츠 (`/shorts`), 마이 (`/user/profile`), 알림 (`/notifications`), 셀러 공개 (`/profile/*`, `/s/*`)
- **배경**: `bg-[#020202]` (메인) / `bg-[#121212]` (카드) / `bg-[#1A1A1A]` (서브)
- **텍스트**: `text-white` (제목) / `text-gray-300` (본문) / `text-gray-400`~`500` (보조)
- **보더**: `border-[#1A1A1A]`, `border-[#2A2A2A]`
- ❌ 금지: `text-gray-900/800/700`, `bg-white`, `border-gray-200`
- 🛡️ `/user/profile` 은 화이트/다크 토글 **모두 지원** — 서브 컴포넌트 전부 `dark:` 매핑 완료 (2026-05-06)

### 화이트 테마 — 쇼핑/결제 (사용자 토글 지원)
- **해당**: `/browse`, `/cart`, `/checkout`, `/products/*`, `/my-orders`, `/search`, `/wishlist`, `/mypage/addresses`, `/account/*`, `/referral/*`, `/restaurant-map`, `/points/charge`
- **배경**: `bg-white` / `bg-gray-50`
- **텍스트**: `text-gray-900` / `text-gray-600` / `text-gray-500`
- **보더**: `border-gray-100`, `border-gray-200`
- ❌ 금지: `text-white` (컬러 버튼 위 제외), `bg-[#020202]`, `border-[#333]`

#### 사용자 다크 모드 토글 (2026-05-02)
- `/account/settings` "화면 테마" — 시스템 / 라이트 / 다크 선택
- 인프라: `useTheme` 스토어 + `<html class="dark">` + Tailwind `darkMode: 'class'`
- **새 페이지·컴포넌트 작성 시 `dark:` variant 동시 추가 필수**:

  | 라이트 (기본) | 다크 |
  |---|---|
  | `bg-white` | `dark:bg-[#0A0A0A]` |
  | `bg-gray-50` | `dark:bg-[#121212]` |
  | `bg-gray-100` | `dark:bg-[#1A1A1A]` |
  | `text-gray-900` | `dark:text-white` |
  | `text-gray-800` | `dark:text-gray-100` |
  | `text-gray-700` | `dark:text-gray-200` |
  | `text-gray-600` | `dark:text-gray-300` |
  | `text-gray-500` | `dark:text-gray-400` |
  | `text-gray-400` | `dark:text-gray-500` |
  | `border-gray-100` | `dark:border-[#1A1A1A]` |
  | `border-gray-200` | `dark:border-[#2A2A2A]` |

- 자동 마이그레이션: `perl /tmp/dark_migrate.pl <files...>` (사용 후 git diff 검토)
  - ⚠️ perl 일괄 치환은 **이미 `dark:` / `hover:` / `focus:` prefix 가 붙은 토큰까지 매칭**해
    `dark:dark:bg-` / 중복 `dark:bg-` / 잘못된 state(`hover:bg-gray-100` → `dark:bg-` 아닌
    `dark:hover:bg-`) 같은 깨진 클래스를 만들 수 있음. 치환 후 반드시
    `node scripts/check-theme-consistency.mjs` 로 검증하고 중복/오매핑 수동 교정.
- FOUC 방지: `index.html` inline script 가 `localStorage.ur_theme_mode_v1` 읽고 선반영
- 다크 페이지 / 셀러 / 어드민 대시보드는 토글 무영향 (페이지 단 명시 강제)
- 🛡️ **자동 강제 (2026-05-31)**: `scripts/check-theme-consistency.mjs` 가 pre-commit(staged 파일)
  + `verify.yml` CI 에서 라이트 토큰의 `dark:` variant 누락을 검사 (variant-aware — `hover:`/`focus:`/
  `placeholder:` 등 state 별 매칭). 대시보드(seller/admin/agency) + 순수 다크 페이지(`bg-[#020202]`/
  `data-mobile-only`) + 콜백/디버그/embed 는 자동 제외. 기본 warn-only, 차단: `STRICT_THEME=1`,
  우회: commit 메시지 `[SKIP_THEME_CHECK]`. → **앞으로 생성/수정되는 페이지에 테마 누락 자동 감지.**

> ⚠️ **글로벌 CSS invert 절대 금지** (2026-05-03 시도/롤백, `docs/INCIDENTS.md`)

> ⚠️ **CSP `style-src` 에 `'nonce-XXX'` 추가 절대 금지** (2026-05-21 사고)
> - React/Tailwind inline style 수천 곳이 nonce 없어 전부 차단 → 화면 전체 깨짐.
> - `'unsafe-inline'` 만 유지. script-src 의 nonce 는 OK (HTMLRewriter 자동 부여).
> - 향후 강화는 별도 PR (모든 inline style 외부화 후 nonce 부여 인프라).

> ⚠️ **셀러 role (seller_type) 직접 비교 절대 금지** (2026-05-21 Phase D-5)
> - `=== 'influencer'`, `=== 'store_owner'` 같은 직접 비교 금지.
> - 항상 `isInfluencer()` / `isStoreOwner()` / `canBroadcast()` 등 helper 사용.
> - UI 자동 분기는 `<RoleGate showFor="...">` 컴포넌트 사용.
> - 마스터: `src/shared/seller-roles.ts` (single source of truth).
> - 라벨 변경 / 새 role 추가 시 본 파일만 수정 → 전체 UI 자동 반영.
> - 한국어 명칭: **명칭 SSOT 는 아래 "🏷️ 명칭(용어) SSOT" 섹션 참조 (사용자 확정 2026-06-17 — 유저 / 사업자 유저).**
>   - "에이전시" = 매니징 조직 / "도매 공급자(제조사)" = B2B 공급 (개인 축과 별도)

## 🏷️ 명칭(용어) SSOT (2026-06-17 사용자 확정 — 무조건 이 명칭 사용)

**사용자-가시 라벨은 무조건 아래 명칭을 따른다. 새 UI 문구·번역·안내 작성 시 필수 참조.**

| 명칭 | 정의 | 코드 실체 |
|---|---|---|
| **유저** | 회원가입한 누구나. **링크샵(`/u/{handle}`) 자동 생성**, 추천(핀)·구매 가능 | `users` + handle |
| **사업자 유저** | 유저 + **사업자등록 → 판매 승인**. 자기 상품·이용권 판매 + 현금 정산 | `users` + 연결된 승인 `sellers` |
| **셀러 대시보드** | 사업자 유저가 쓰는 **판매 관리 도구**(`/seller/*`) — "셀러"는 *도구 이름*으로만 유지 | SellerLayout |
| **이용권** | 온라인에서 할인가로 **즉시 구매** → 매장에서 QR/PIN 으로 사용하는 권종(식당·뷰티·숙박·액티비티 등). **공동구매(모여서 사기) 아님** | `products.category='meal_voucher'` 등 |
| **에이전시** | 여러 사업자 유저/매장을 관리하는 B2B 조직 | `agencies` |
| **도매 공급자(제조사)** | 도매몰에 상품 공급하는 B2B 주체 | suppliers |

> 🏷️ **2026-06-27 대표 확정 — "공구권" → "이용권" 으로 통일** (이전: 식사권 → 공구권 → **이용권**). 이유: 경제는 즉시판매(모여서 공동구매 아님)인데 "공구권" 이 옛 멘탈모델을 끌고 다님 + "식사권" 은 식당 단정. 사용자-가시 "공구권"/"식사권" 156건(src+locales) 일괄 치환 완료. **"교환권"(기프티콘·KT, `deal_only=1`)·"동네딜"(로컬딜 리스트)·"공동구매/공구"(동사·일반어)는 불변** — 별개 개념. 코드 식별자(`meal_voucher`·`group-buy`·`curator`)도 불변(한글 라벨만). 아래 audit log 의 "공구권" 표기는 *작성 당시 historical record*(소급 변경 X).
>
> 🏷️ **2026-06-29 보강 — "식사권" 완전 제거** (대표 "응 통일해줘" → "이용권으로 일괄 정리해줘"). 06-27 치환 후 남아 있던 "식사권" 전부 정리: ① 일반 지칭(예 "내 식사권"·"식사권 등록/사용") → "이용권". ② **`meal_voucher` 카테고리 칩/필터 라벨 → "식사"**(형제: 미용/숙소/기타 — 우산말 "이용권"과 충돌 방지). ③ **알림 카테고리-종류 라벨(`getVoucherShortLabel`) → "{카테고리} 이용권"**(식사 이용권/미용 이용권/숙소 이용권/기타 이용권, fallback "이용권") — 옛 "식사권/미용권/…" 형태 폐기. 결과: 사용자-가시 "식사권" 0(코드 식별자 `meal_voucher`·설명 주석만 잔존). **규칙**: 신규 UI 일반 지칭=이용권 / 음식 카테고리 칩=식사 / 알림 카테고리 라벨="{카테고리} 이용권".

### 🏭 도매몰(유통스타트) 명칭 — **판매사 / 제조사** 로 무조건 통일 (2026-06-22 대표 확정 — 이전 '유통사' 역전)

> **2026-06-22 변경**: 구매자측 명칭을 **유통사 → 판매사**로 역전(대표 지시 "유통사가 아니라 판매사"). 공급자측 **제조사 유지**. 코드베이스 전체(src+locales) 사용자-가시 "유통사" 682건 일괄 치환 완료. 브랜드명 **"유통스타트"·일반어 "유통"은 불변**. 이전(2026-06-21) "유통사" 결정은 본 결정으로 폐기 — 아래 이력 audit log 의 "유통사" 표기는 *작성 당시 historical record*(소급 변경 X).

도매몰의 **모든 사용자-가시 라벨**은 아래 둘만 사용. 새 UI/문구/번역/약관/안내 작성 시 필수.

| 명칭 | 정의 | 비고 |
|---|---|---|
| **판매사** | 도매가로 사입해 재판매하는 B2B 회원(=구매자측) | `sellers`(is_distributor) |
| **제조사** | 도매몰에 상품을 공급하는 B2B 회원(=공급자측) | suppliers |

- ❌ **사용 금지(도매몰 사람/회원 지칭)**: "유통사", "공급사", "유통회원", "제조회원", "제조(브랜드)회원", "판매파트너", "사입 바이어", "셀러"(사람), "큐레이터". 괄호 병기("판매사(유통사)", "제조사(공급사)")도 금지 — **판매사 / 제조사 단독**.
- ✅ **유지 OK**: "공급가"/"공급가격"(가격 용어 — 회사 아님), "도매가", "공급하다/공급망"(동사·일반명사), "제조사 대시보드"·"판매사 대시보드"(도구 명칭), 오프라인 "매장"(가게 자체), 브랜드명 "유통스타트" + 일반어 "유통"(distribution).
- 법적 문서(이용약관/공급계약서)에서 법률상 당사자 정의가 필요하면 "판매사(이하 …)" 식으로 1회 정의 후 판매사/제조사로 통일.
- **코드 식별자는 무관**(suppliers/sellers/is_distributor/distributor_grade 등 내부 식별자 그대로 — 한글 라벨만 변경). 이 규칙은 사용자-가시 문자열에만 적용.


**규칙**:
- 사람을 가리킬 땐 **"유저" / "사업자 유저"** 만 사용. ❌ 사용 금지(사람 지칭): "큐레이터", "크리에이터", "인플루언서", "셀러"(사람 의미), "판매자", "매장 사장님"(신규 문구에서).
- **예외**: "셀러 대시보드"는 *도구 명칭*이라 유지 OK. 오프라인 가게 맥락의 "매장"은 문맥상 허용(가게 자체를 가리킬 때).
- **코드 식별자는 무관** — `CuratorPage`/`curator.routes`/`seller_type='influencer'`/`sellers` 테이블 등 내부 식별자는 그대로(전면 리네임 X). 이 규칙은 **사용자-가시 문자열**에만 적용.
- 능력 모델: 유저 → (사업자등록·판매승인) → 사업자 유저. 같은 `/u/{handle}` 링크에 기능이 *레이어로 추가*(신분 교체 아님). 라이브커머스는 영구중단(`LIVE_COMMERCE_SUSPENDED`).
- 🎯 **타겟 포지셔닝 (2026-06-18 대표)**: 사업자 유저의 메인 타겟 = **"자신의 쇼핑몰을 갖고 싶은 유저"**. 그들의 `/u/{handle}` 링크샵 = **본인 쇼핑몰**이고 **본인 상품이 주인공**. 이용권은 부가 채널(주인공 아님). → 사업자 유저 관련 신규 UI/문구/기본 강조는 "내 쇼핑몰" 언어·상품 우선으로(향후 구현 시 적용; 현재는 방향 메모만 — 코드 미변경).

> ⚠️ **원천징수율 hardcode 절대 금지** (2026-05-21 정정)
> - default 3.3% (사업소득 — 반복적 활동, 대부분 인플루언서)
> - 8.8% 는 기타소득만 (단발성 협업)
> - 마스터: `src/worker/utils/tax-withholding.ts` `WITHHOLDING_RATES`
> - sellers.tax_type 컬럼 ('business_income' default / 'other_income')
> - 새 코드는 `withholdAndLog()` 헬퍼만 호출 — 직접 0.088 / 0.033 곱셈 금지.

> ⚠️ **카카오 OAuth 룰** (2026-05-22 전수 점검)
> - 신규 카카오 endpoint 는 반드시 `safeRedirect()` (kakao.routes.ts) 사용 — open redirect 방어.
> - state CSRF: 모든 OAuth flow 는 `kakao_oauth_state` 쿠키 + URL state 검증.
> - 신규 사용자 생성 전 이메일 takeover 검사 — `KakaoAuthService.upsertUser` 의 `EMAIL_ALREADY_LINKED_TO_OTHER_METHOD` 패턴 따를 것.
> - access_token/refresh_token DB 저장 시 반드시 `encryptToken()` (DATA_ENCRYPTION_KEY).
> - 셀러-카카오 1:1 매핑: `idx_sellers_linked_user_unique` UNIQUE index 필수 (repair-schema 등록 완료).
> - kakao_id UNIQUE: `idx_users_kakao_id_unique` partial unique index (repair-schema 등록 완료).
> - `kakaotalk://` scheme redirect 는 sessionStorage 가드 (2026-04-29 사고).
> - 🍎 **iOS 쿠키 영속 룰 (2026-06-20 — 사파리/카톡 로그인 사고)**: iOS Safari/WebKit 은 **cross-site
>   OAuth 콜백 302 응답에서 set 한 쿠키를 미영속** 처리(Chrome 은 정상). 그래서:
>   - **소비자 세션**: `/sync/callback` 은 세션 쿠키를 302 에 의존하지 말고, 단명 서명 티켓을
>     fragment(`#st=`)로 넘겨 **same-origin `POST /api/auth/session/establish`** 로 httpOnly `ur_session`
>     을 200 응답에서 발급(first-party → iOS 영속). 토큰을 localStorage 에 두지 말 것.
>   - **역할 토큰(seller/agency/판매사/미래 역할)**: transfer 쿠키(`ur_pending_*`) **금지** — iOS 미영속.
>     반드시 **fragment(`#auth=`) + `worker/utils/pending-auth.ts` `encodePendingAuth()`** 로 전달.
>     새 역할은 `/sync/callback` 의 `pendingLs` 맵에 한 줄 추가(같은 `seller_`/`agency_`/`supplier_`
>     네임스페이스면 클라 허용목록 자동 통과). **XHR(JSON 응답) 로그인은 same-origin 200 이라 iOS-safe**
>     (공급자 `create-from-kakao`·유통 `become-distributor` 가 이미 이 방식).
>   - 진단: 관리자 `/api/_internal/kakao-login-diag` (브라우저별 success/error + 재시도).

> ⚠️ **Toss 결제 confirm 직접 fetch 절대 금지** (2026-05-22 옵션 B)
> - 5개 평행 흐름 (충전 / 주문 / 공구 / 숙소 / 교환권) 이 각자 fetch 호출 → 같은 버그 5번 재발.
> - 마스터: `src/worker/utils/toss-gateway.ts` `confirmTossPayment()`
> - 신규 토스 결제 endpoint 는 반드시 helper 호출. 직접 `fetch('https://api.tosspayments.com/...')` 금지.
> - circuit breaker / idempotency-key / amount validation / 에러 메시지 표준화 자동.
> - 키 type 검증도 helper (`decideTossFlow`, `detectTossKeyType`) 사용.

> ⚠️ **`(err as Error).message` 클라이언트 반환 절대 금지** (2026-05-22 보안)
> - DB 에러 메시지 (`UNIQUE constraint failed: users.email`) → 계정 enumeration 공격
> - 스택트레이스 누출 → 내부 구조 노출
> - 마스터: `src/worker/utils/safe-error.ts` `safeError(c, err, '한국어 generic 메시지', '[tag]')`
> - 패턴:
>   ```ts
>   } catch (err) {
>     return safeError(c, err, '주문 처리 중 오류가 발생했습니다', '[orders]')
>   }
>   ```
> - DEV 모드 (ENVIRONMENT=development) 에서만 `_debug` 필드에 detail 포함.

### 라이트 테마 — 셀러/어드민/에이전시 대시보드 (토글 무영향, 고정)
- **해당**: `/seller/*`, `/admin/*`, `/agency/*`
- **배경**: SellerLayout/AdminLayout/AgencyLayout 처리 (`#F4F5F7`)
- **🚨 절대 규칙** (사용자 명령, 위반 시 차단):
  - `dark:` variant 추가 절대 금지 — `scripts/check-dashboard-theme.sh` 자동 차단
  - 향후 다크 모드 활성 시에도 항상 화이트 유지
- ❌ 금지: `text-white` (컬러 버튼 위 제외), `dark:` variants

### 공통 규칙
- `text-white` 는 컬러 배경 버튼 위에서만 (bg-pink-500, bg-red-500 등)
- CSS 변수 (`text-foreground`, `bg-muted`) 대신 **명시적 색상 클래스**

## 💸 머니/정합성 코드 작성 룰 (2026-06-11 전 영역 감사에서 도출 — 새 코드는 처음부터 이대로)

> 감사에서 발견된 머니 버그 13건이 전부 아래 4가지 클래스였음. 새 결제/적립/취소/환불 코드는
> 작성 시점에 이 패턴을 따르면 후 감사가 필요 없음. warn 검사: `scripts/check-money-patterns.sh`.

1. **Claim-before-credit (CAS 선점 후 side-effect)** — 적립/차감/환급 같은 돈 side-effect 앞에는
   반드시 원자적 상태 선점: `UPDATE ... SET status='X' WHERE id=? AND status='이전상태'` 후
   `meta.changes === 0` 이면 side-effect 없이 멱등 반환. **사전 SELECT 체크만으로는 동시요청을 못 막음**
   (예: 숙소 confirm/취소, 예약 딜환급, 주문 confirm — 전부 이 패턴으로 수정됨).
2. **적립-역전 대칭** — 새 적립(커미션/보너스/포인트)을 만들면 **같은 commit 에서** 역전 함수를 만들고
   `refundOrderFully`(order-refund.ts) + `returns.routes.ts` 양쪽에 배선. 적립 경로가 둘(confirm/webhook)이면
   적립도 공용 멱등 헬퍼 1개로 (예: `creditOrderCommissions`).
3. **멱등 = UNIQUE index + INSERT OR IGNORE** — "이미 있는지 SELECT 후 INSERT" 금지(race).
   `INSERT OR IGNORE` + repair-schema 에 partial UNIQUE index 등록 + `meta.changes` 검사.
4. **status 플립 ≠ 취소** — 결제 캡처된(PAID/DONE/PREPARING/SHIPPING/DELIVERED) 주문을
   `status='CANCELLED'` 로만 바꾸면 고객 미환불 + 커미션 미역전. 반드시 `refundOrderFully` 경유
   또는 `REFUND_REQUIRED` 차단. bulk 엔드포인트도 동일.

**부수 룰**: 핸들러 안 inline `ALTER TABLE`/`CREATE INDEX` 금지 — `ensureXxx(DB)` + WeakSet 메모이즈
(per-request DDL). 신규 KV write 는 무료 1K/day 한도 고려(고볼륨이면 샘플링), SESSION_KV 에 분석용 write 금지.

## 🚨 DB 스키마 규칙 (요약 — 자세한 건 `docs/SCHEMA.md`)

- **SSOT**: `src/shared/db/production-schema.ts`
- 새 쿼리 작성 전 컬럼 확인 + INSERT 시 NOT NULL 포함 + try-catch
- 자주 틀리는 컬럼 alias: `stock` / `is_active` / `credit_amount`
- orders.status: 대문자 (`PAID`, `DONE`, …) / payment_status: 소문자 (`approved`, …)
- 🛡️ **products 컬럼 추가 금지(예산제, 2026-06-10)**: 새 도매/브랜드/전시 메타는 `product_supply_meta`(K-V 사이드테이블, `src/worker/utils/product-supply-meta.ts`) 사용. products ALTER 가 정말 필요하면 `scripts/products-column-baseline.json` 에 등록 + PR 사유 — CI 가 차단함
- 검증: `bash scripts/check-schema-refs.sh`

## 🔒 API 엔드포인트 보안 규칙 (필수)

### 새 엔드포인트 체크리스트
1. **인증**: `requireAuth()` / `requireSeller()` / `requireAdmin()` / `requireAgency()` 필수
2. **권한 검증** (IDOR 방지):
   - `resource.seller_id === authenticatedSellerId` 같은 소유권 체크
   - body/query 의 user_id/seller_id 를 인증 없이 신뢰 금지
   - 토큰 발급/세션 생성 endpoint 는 호출자 본인 검증 필수
3. **입력 검증**: `Number.isFinite()` + 범위 체크 + 문자열 길이 + enum 허용 값
4. **서버 재계산**: 결제 금액은 절대 클라이언트 값 신뢰 금지
5. **Rate limit** (민감 엔드포인트 — `/login`, `/pay`, `/donate` 등):
   - `RATE_LIMIT_KV` Dashboard Bindings 등록 필수 (미등록 시 fail-OPEN)
   - 검증: `curl -I .../api/products` → `X-RateLimit-Limit` 헤더 존재
6. **Bot challenge (Turnstile)**:
   - `verifyTurnstile(c.env.TURNSTILE_SECRET, body.turnstile_token, ip)`
   - 적용: `/api/donations/init` (2026-05-03)
   - `TURNSTILE_SECRET` 미설정 시 fail-open
7. **Idempotency**: 결제 관련 Toss API 호출 시 `Idempotency-Key` 필수
8. **에러 처리**: try-catch + DEV 모드 로깅 (조용히 삼키지 말 것)
9. **i18n fallback**: `t('X', { defaultValue: '한글' })` (NOT `t('X') || '...'`)

### 절대 하지 말 것
- ❌ `debug-*` 엔드포인트 프로덕션 배포
- ❌ 클라이언트 값으로 금액 계산
- ❌ `.catch(() => {})` 로 에러 완전 무시
- ❌ 권한 체크 없는 POST/PATCH/DELETE
- ❌ `SELECT *` with LIMIT/OFFSET but no ORDER BY
- ❌ 하드코딩된 내부 API 토큰
- ❌ `Function('p', 'return import(p)')(...)` 에 사용자 입력 전달 (RCE)

## 🌍 i18n (다국어) 필수 규칙

셀러 대시보드 (`src/pages/Seller*.tsx`, `src/components/Seller*.tsx`) 수정 시:

1. 모든 UI 텍스트는 `t()` 함수 — 하드코딩 한국어 금지
2. 새 텍스트 → `public/locales/{ko,en,ja,zh,es,fr}/translation.json` **6개 언어 모두**
3. 키 네이밍: `common.*` (공통) / `seller.*` (셀러)
4. fallback 패턴: `t('X', { defaultValue: '한글' })` — `||` 연산자 금지

## 🔐 인증

- Bearer 토큰 우선, 세션 쿠키 차선
- 셀러/어드민: localStorage JWT 즉시 체크 (Firebase 대기 안 함)
- 유저: Firebase Auth + optimistic rendering
- 한국 (live.ur-team.com): 카카오 세션 쿠키 전용, Firebase 호출 0
- ProtectedRoute: `localStorage(user_type + user_id)` 동기 체크
- `isKorea()` 분기로 Firebase 코드 건너뜀

### Redirect / returnUrl 안전 규칙
OAuth 콜백·로그인·401 핸들러 등에서 외부 입력은 **반드시 `safeInternalPath()` 통과**:

```ts
import { safeInternalPath } from '@/utils/safe-internal-path'
const returnUrl = safeInternalPath(searchParams.get('returnUrl'), '/')
navigate(returnUrl)
```

자동 차단: `/login`, `/seller/login`, `/admin/login`, `/agency/login`, `/auth/*`, `/oauth/*`, 외부 URL, protocol-relative `//`, backslash, 제어문자.

**Worker 코드** (`src/features/*/api/*.routes.ts`, `src/worker/`) 는 alias `@/` import 못 함 → `kakao.routes.ts:safeRedirect()` 가 인라인으로 동일 규칙 유지. **양쪽 같이 갱신**.

### 외부 스킴 redirect 가드 (2026-04-29 사고 후)
`kakaotalk://`, `intent://`, `line://` redirect 는 **반드시 sessionStorage 가드** (webview reload 무한 재시도 방지). inline script + module script 가 같은 가드 공유 시 키 이름 명시 + 두 곳 동시 수정. 자세한 사고 경위: `docs/INCIDENTS.md`.

## 💰 딜 포인트 시스템

- 충전: 1원 = 1딜 (수수료 없음)
- 후원/상품 결제: 딜 즉시 차감
- 셀러 정산: 기본 5% 플랫폼 수수료 (`platform_settings.commission_rate_default`). 어드민이 셀러별로 `sellers.commission_rate` 조정 가능. 후원 수수료 별도 15%.
- 최소 후원: 500딜

## 🆕 새 페이지 생성 체크리스트

1. **SEO**: `<SEO title="제목 - 유어딜" description="설명" url="/경로" />` 필수 (관리자/콜백 제외)
2. **테마**: 위 테마 규칙
3. **text-gray-900**: 화이트 테마 input/select/textarea 에 명시
   - 🛡️ **라이트 고정 standalone 페이지(로그인/가입/비번 — 레이아웃 밖)는 루트 div 에 `force-light-theme` 필수**: 전역 `.dark input` 규칙(특이도 0,5,1)이 다크모드에서 input 글자를 흰색으로 덮어써 `text-gray-900`(0,1,0)이 짐 → 안 보임. `force-light-theme`(또는 `admin/seller/agency-light-theme`)가 CSS `!important` 로 무력화. 어드민/셀러/에이전시 **대시보드 페이지는 레이아웃이 자동 적용**(직접 추가 불필요). `check-light-input-guard.mjs` 가 자동 감지.
4. **App.tsx**: lazy import + Route 추가
5. **console.log 금지**: `import.meta.env.DEV` 게이트 필수
6. **숫자 포매팅** (대시보드 ₩NaN 사고 — 2026-05-17): `value.toLocaleString()` 직접 호출 금지.
   DB row 값이 null/undefined 이거나 `a * b` 곱셈에 한쪽이 null 이면 `NaN` 노출.
   대신 `@/utils/format` 의 헬퍼 사용:
   ```ts
   import { formatNumber, formatWon, safeNum } from '@/utils/format'
   {formatWon(value)}                       // → ₩1,234 (null → ₩0)
   {formatNumber(value)}                    // → 1,234 (null → 0)
   formatNumber(safeNum(a) * safeNum(b))    // 산술 후 포매팅 — NaN 방지
   ```
7. **첫 페인트 표준**: 리스트/상세 등 데이터 페이지는 `docs/LOADING_ARCHITECTURE.md` 의 "첫 페인트 표준" 표 적용 (SSR 슬롯 or prewarm or placeholder — 스피너-온리 첫 화면 금지)
8. **📱 모바일 뷰포트 높이/스크롤 (2026-06-22 — 동네딜 지도 하단 잘림 사고)**: 풀스크린/고정바 페이지는 아래 룰 준수. 위반 시 모바일에서 **하단(네비/적용버튼/리스트 끝)이 화면 밖으로 잘림**. **권장: 함정 제거 프리미티브 사용 — 풀높이 컨테이너 `<Screen>`/`<Screen fixed>`(`@/components/ui/screen`), flex 스크롤 영역 `<ScrollArea>`(`@/components/ui/scroll-area`)**. 직접 클래스 작성 시:
   - ❌ **`h-screen`/`min-h-screen`(=100vh) 금지** → ✅ **`h-[100dvh]`/`min-h-[100dvh]`**(또는 `<Screen>`). 모바일 100vh 는 주소창 포함 = 실제 보이는 영역보다 큼 → `bottom-0` 콘텐츠가 화면 밖. `calc(100dvh - …)` 와 컨테이너 단위도 dvh끼리 일치.
   - ❌ **`flex-1 overflow-y-auto` 에 `min-h-0` 빠뜨리기 금지** → ✅ **`flex-1 min-h-0 overflow-y-auto`**(또는 `<ScrollArea>`). flex 자식 기본 `min-height:auto` 라 콘텐츠보다 안 줄어듦 → 스크롤 안 되고 형제(footer/적용버튼)가 밀려 안 보임. 바텀시트/모달 스크롤 영역 필수.
   - 🛡️ 신규 라인은 `check-mobile-viewport.mjs`(pre-commit 래칫)가 자동 경고.
9. **🧱 파일/컴포넌트 크기 (2026-06-29 — god 파일 재발 방지)**: 페이지/라우트가 600줄 넘어가면 **그 시점에** 카드·모달·섹션·핸들러群을 같은이름 폴더(`foo-list/`, `my-vouchers/` 선례)로 추출. "일단 여기에 한 블록 더"가 god 파일(1300줄+)의 원인 — 처음부터 컴포넌트로. 단일 컴포넌트도 ~300줄 넘으면 분리 고려. 🛡️ `check-file-size.mjs`(래칫: 신규 600줄 초과 / baseline 동결 파일 성장 차단, `verify.yml`+audit-gate strict)가 자동 강제. 대형 파일을 줄였으면 `node scripts/check-file-size.mjs --rebaseline` 로 동결값 갱신.
10. **검증**: `bash scripts/quality-check.sh`

## 🚀 배포 아키텍처

⚠️ **Cloudflare Pages 단일 배포** (Workers 아님):
- `live.ur-team.com` → Pages `ur-live` (Custom Domain)
- `ur-live.pages.dev` → 동일 프로젝트 기본 도메인
- 구조: Pages with `_worker.js`. `wrangler deploy` (Workers용) 사용 금지.

### 🚨 빌드 명령 절대 룰 (2026-05-12 사고 후)

**원인**: `npx vite build` 만 실행하면 **`_worker.js` 가 갱신 안 됨** → 모든 worker 코드 변경이 production 에 반영 안 됨.

```jsonc
// package.json
"build": "npm run build:client && npm run build:worker && npm run build:prepare"
"build:client": "vite build"           ← client 만
"build:worker": "node scripts/build-worker.js"  ← worker 별도
```

- ✅ **올바른 명령**: `npm run build` (또는 PowerShell `.\scripts\deploy.ps1`)
- ❌ **금지**: `npx vite build` 단독 사용 — `_worker.js` 갱신 안 됨
- 🛡️ **자동 방어**: `scripts/validate-build-output.cjs` 가 `_worker.js` mtime 을
  `src/worker/`, `src/features/*/api/` 의 최신 mtime 과 비교 → 오래되면 빌드 실패.

### 권장 배포 명령

```powershell
# PC PowerShell — 안전 스크립트 (권장)
.\scripts\deploy.ps1 -Message "feat-XYZ"

# 또는 직접 명령
npm run build                                                            # ← 핵심: vite build 아님!
npx wrangler@3 pages deploy dist/client --project-name=ur-live `
  --commit-dirty=true --commit-message="ascii-only-no-korean"
```

> ⚠️ `commit-message` 는 **ASCII only** — 한글/em-dash/이모지 포함 시 CF API 가 거부 (`Invalid commit message, it must be a valid UTF-8 string` 에러).

### Secret/환경변수
- Cloudflare Dashboard → Workers & Pages → ur-live → Settings → Variables and Secrets
- secret 은 한 번 저장하면 값 못 봄 — 외부 참조 시 별도 기록

### 자동 배포 규칙
- feature 브랜치 push → PostToolUse 훅이 자동 main 머지 + 푸시 (`scripts/auto-merge-main.sh`)
- 절대 feature 브랜치만 두지 말 것 — main 반영되어야 배포

### 변경 후 체크리스트
1. `bash scripts/check-schema-refs.sh`
2. `bash scripts/check-api-auth.sh`
3. `npx tsc --noEmit --skipLibCheck` (에러 0)
4. `npm run build`  ← **`vite build` 아님!** (위 빌드 룰 참조)
5. `git push origin <branch>` (훅이 main 자동 머지 + 배포)
6. Actions 탭 녹색 확인
7. 배포 후 `curl -X POST -i https://live.ur-team.com/api/version` 등 핵심 endpoint smoke test

### 절대 하지 말 것 (배포 관련)
- ❌ Service Worker / PWA 라이브러리 — 카카오 OAuth 차단 사고 (2026-04-27, `docs/INCIDENTS.md`)
- ❌ `_redirects` 에 `/* /index.html 200` — Workers 무한 루프
- ❌ `_headers` 에 2000자 초과 줄 — 배포 실패
- ❌ `wrangler.toml` 에서 `new_classes` (free plan 은 `new_sqlite_classes`)
- ❌ 파일 중간에 `import` 문 추가 — ES module 위반, 런타임 crash (2026-04-22 사고)
- ❌ Worker 코드에서 `await import('@/...')` — dynamic import + alias 조합 crash
  - 반드시 상대경로: `await import('../../features/foo')`
  - 예외: 순수 프론트엔드 (pages/components/shared/stores) 는 Vite 가 alias resolve → OK
  - 이중 방어: `esbuild.worker.config.js` alias + Pre-commit hook 차단

## 🛠️ 개발 환경 셋업 (새 컨트리뷰터)
1. `npm install`
2. `bash scripts/install-git-hooks.sh` — pre-commit 훅 설치
3. 이후 모든 커밋 전 자동 검증

## 🛡️ 영구 방어선 (사고 재발 방지)

과거 사고 패턴이 다시 commit / deploy 되는 것을 차단하는 자동 검사:

| 검사 항목 | Pre-commit Hook | CI Workflow | 사고 출처 |
|---|---|---|---|
| Hono v4 wildcard `cors()` | `check-router-patterns.sh` | `verify.yml` | 2026-05-12/13 405 |
| `vite build` 단독 사용 | `check-build-command.sh` | `verify.yml` | 2026-05-12 _worker.js 미갱신 |
| `_worker.js` 신선도 | `validate-build-output.cjs` (post-build) | - | 2026-05-12 |
| Hardcoded secret | `check-no-secrets.sh` | `verify.yml` | public repo 전환 후 영구 노출 위험 |
| Schema drift | `check-schema-refs.sh` | `verify.yml` | DB 컬럼 부정확 |
| API 인증 누락 | `check-api-auth.sh` | `verify.yml` | IDOR |
| 대시보드 dark variant | `check-dashboard-theme.sh` | `verify.yml` | 사용자 룰 |
| 다크/라이트 테마 일관성 | `check-theme-consistency.mjs` | `verify.yml` (strict) | 2026-05-31 다크모드 흰 박스 + 2026-06-11 역방향 2규칙(bare 다크 hex bg=라이트 검정박스 / dark:bg-white+bare text-white=흰배경 흰글자 — 당일 사고 2건 패턴. 의도적 양모드 다크는 `theme-dual` 주석 면제) |
| Service Worker 등록 | `check-no-sw-register.sh` | `verify.yml` | 2026-04-27 OAuth 차단 |
| 파일 중간 import | (install-git-hooks.sh) | - | 2026-04-22 worker crash |
| Silent error (warn) | `check-silent-errors.sh` | - | 디버깅 곤란 |
| 머니 패턴 (warn, 차단 `STRICT_MONEY=1`) | `check-money-patterns.sh` | - | 2026-06-11 감사 — per-request DDL / 무환불 CANCELLED. 작성 룰: 위 '💸 머니/정합성 코드 작성 룰' |
| 대시보드 NaN/undefined (warn) | `check-nan-dashboard.sh` | - | 2026-05-17 ₩NaN 노출 |
| CHECK 제약 위반 | `check-status-constraints.mjs` (warn) | `verify.yml` (strict) | 2026-05-17 admin live-monitor delete 500 |
| SQL bind param mismatch | `check-sql-bind-params.mjs` (warn) | `verify.yml` (strict) | 'wrong number of bindings' SqlError 방지 |
| NOT NULL INSERT 누락 | `check-sql-not-null-insert.mjs` (warn) | `verify.yml` (warn) | 2026-05-17 알림 silent fail 사고 (notifications.body 컬럼 없음) |
| 존재하지 않는 컬럼 참조 | `check-sql-column-exists.mjs` (warn) | `verify.yml` (warn) | 2026-05-17 'no such column' SqlError 방지 |
| 존재하지 않는 테이블 참조 | `check-sql-table-exists.mjs` (strict) | `verify.yml` (strict) | 2026-07-01 admin 리뷰관리가 없는 `reviews` 테이블(실제 `product_reviews`) 조회 → 항상 500(대표 "에러 너무 많아"). 컬럼 가드는 INSERT/UPDATE 컬럼만 봐 FROM/JOIN 테이블명 오타를 못 잡음. FROM/JOIN/INTO/UPDATE/DELETE 테이블이 CREATE TABLE(마이그레이션+repair-schema+inline src) 또는 `KNOWN_TABLES_EXTRA`(프로덕션 존재·레포 미기록 13개) 에 있는지 검증. 신규 실제 테이블은 CREATE TABLE 추가 시 자동 인식. 예외는 `KNOWN_TABLES_EXTRA` 등록 |
| products `SELECT *`/`p.*` | - | `verify.yml` (strict) | 2026-06-10 D1 컬럼 한도(100) 초과 — 교환권/공구 상세 전체 500. `productDetailCols()` 명시 목록 사용 |
| products/sellers 새 컬럼 (예산제) | - | `verify.yml` (strict) | 같은 사고 구조적 후속 — 새 메타는 K-V 사이드테이블(`product_supply_meta`), products/sellers ALTER 는 baseline 등록 필수. **sellers 는 이미 100컬럼(D1 한도 도달)** — `check-products-column-budget.mjs` 가 두 테이블 모두 감시 (`scripts/{products,sellers}-column-baseline.json`) |
| PRODUCT_DETAIL_FIELDS 복구 가능성 | - | `verify.yml` (strict) | 2026-06-10 상품 상세 500 전수조사 — 명시 목록 컬럼은 base CREATE ∪ repair-schema 로 반드시 복구 가능해야 함 (`check-product-detail-fields-repairable.mjs`). 소비자 products SELECT 는 `productDetailColsHealed`+`withColumnPruning` 자가치유 필수 |
| RQ initialData 신선도 | `check-query-initialdata.mjs` (warn) | `verify.yml` (strict) | 2026-06-17 잔액 '딜 부족' 오표시 — useQuery/useApiQuery 의 `initialData`(localStorage/SSR seed)가 `initialDataUpdatedAt`/`refetchOnMount:'always'` 없이 fresh 로 간주돼 cold mount refetch 누락 → 잘못된 0/null/옛값 노출. 둘 중 하나 필수(보통 `initialDataUpdatedAt: 0`). 의도적 예외는 옵션 객체에 `initialdata-check-ok` 주석 |
| group_buy_status 종류판별 | `check-groupbuy-status-classify.mjs` (warn) | `verify.yml` (strict) | 2026-06-18 쇼핑 상품이 교환권으로 오표시 — 핀 redirect 가 `group_buy_status==='active'` 로 종류 판별. `group_buy_status` 는 migration 0146 에서 **모든 상품 DEFAULT 'active'** → 쇼핑 상품까지 voucher 흐름 오분류 → `/group-buy`(교환권 chrome) 오라우팅. **종류 판별/라우팅은 `deal_only===1`(교환권) + `isVoucherCategory(category)`(오프라인 공구) SSOT 만**(`order-type.ts`/`voucher-categories.ts`); `group_buy_status` 는 공구 *수명주기*(joinable/deadline/count)에만. R1=voucher 이름 boolean←status, R2=status→`/group-buy`·`/vouchers` 라우팅 감지. 예외 `groupbuy-classify-ok` 주석 |
| 로그인 입력 글자 흰색(다크) | `check-light-input-guard.mjs` (warn) | `verify.yml` (strict) | 2026-06-20 `/admin/login` 등 타이핑 글자 흰색으로 안 보임 — 전역 `.dark input:not(...)`(특이도 0,5,1)가 다크모드에서 input 글자를 흰색으로 덮어씀(text-gray-900=0,1,0 짐). standalone 라이트 로그인/가입 페이지는 레이아웃 밖이라 `*-light-theme` 래퍼 없어 무방비. **신규 standalone 라이트 auth 페이지(로그인/가입/비번)는 루트 div 에 `force-light-theme` 클래스 추가**(CSS `!important` 가 다크 전역규칙 무력화). 의도적 예외는 `light-input-ok` 주석 |
| 배포-청크 자가복구(흰화면/무한로딩) | `check-chunk-recovery-guard.mjs` (warn) | `verify.yml` (strict) | 2026-06-30 `/admin`·`/agency` 무한로딩 — 새 배포마다 청크 해시 변경 → 캐시된 옛 index.html 이 삭제된 `/assets/*.js` 참조 → 404 → SPA HTML(text/html) 폴백 → "Expected JS module, got text/html" → 대시보드 안 켜짐(4번+ 재발). **자가복구 4불변식**: ① `index.html` 인라인 부트가드(엔트리 청크 실패까지) ② `chunk-error.ts` `isChunkLoadError`(MIME 변종 감지)+`reloadWithCacheBust`(`__cb`+`location.replace` — plain reload 회귀 금지) ③ `main.tsx` error/unhandledrejection 배선 ④ worker SPA 셸 HTML `no-cache`. 하나라도 빠지면 영구 흰화면. (참고: 실제 청크는 `_routes.json` 에서 worker exclude → Pages 직접 서빙, missing 시 HTML 404 → 클라 ②③ 가 근본복구. `not_found_handling`=none 설정 시 더 깔끔하나 대시보드 설정.) |
| 카카오 OAuth iOS 쿠키 미영속 | `check-auth-cookie-pattern.sh` (warn) | `verify.yml` (strict) | 2026-06-20 사파리/카톡(iOS WebKit) 로그인 안됨 — **cross-site OAuth 콜백 302 응답의 Set-Cookie 를 iOS 가 미영속**(Chrome 정상=개발자 테스트선 안 보이고 iOS 만 조용히 깨짐). 역할토큰을 transfer 쿠키(`ur_pending_*`)로 넘기면 셀러/에이전시/판매사 대시보드 로그인 실패, 세션을 콜백 302 쿠키에 의존하면 소비자 로그인 실패. **역할토큰=fragment(`#auth=`, `worker/utils/pending-auth.ts`), 세션=`POST /api/auth/session/establish`(same-origin httpOnly), XHR(JSON) 로그인은 iOS-safe.** 우회 `[SKIP_AUTH_COOKIE_CHECK]` |
| 모바일 하단 네비 사라짐 (keyboard-open) | `keyboard-viewport.test.ts` (unit, **불변식**) | `verify.yml` (unit 실행) | 2026-06-22 모바일에서 하단 BottomNav 통째로 실종 — `main.tsx` 키보드 감지가 `vv.height<innerHeight-100`(뷰포트 100px 축소)만으로 `body.keyboard-open` 토글 → `index.css` `body.keyboard-open .hide-on-keyboard{display:none}` 가 BottomNav 숨김. 주소창 토글/줌/데스크톱 창 변화에 오작동 + 키보드 닫힘 이벤트 누락 시 **stuck → 영구 실종**. 전역 버그라 페이지마다 고쳐도 안 잡힘. **수정: 판정을 `src/lib/keyboard-viewport.ts` 순수함수(`isKeyboardOpen`)로 분리 — 불변식 "편집요소(input/textarea/contenteditable) 미포커스 → 절대 열림 아님" + 120px 임계 + focusin/out·pageshow 재평가 + 열린 동안 1s 워치독(stuck 불가).** 키보드 감지 로직 수정 시 이 불변식 깨면 unit fail. |
| CSV/엑셀 수식 인젝션 | `check-csv-injection.mjs` (warn) | `verify.yml` (strict) | 2026-06-26 도매 CSV 내보내기 `csvEscape` 가 `= + - @` 탭/CR 선행 셀을 무력화 안 해, 셀러-제어 free-text(상품명/회사명/바코드)가 `=cmd\|'/c calc'!A1` / `=HYPERLINK(...)` 로 들어가면 판매사/어드민이 파일 열 때 실행. csvEscape 류 함수는 선행 작은따옴표 가드 필수. 예외 `csv-injection-ok` 주석 |
| 쿼리 fetch 에러가 빈화면/₩0 위장 | `check-query-iserror.mjs` (warn) | `verify.yml` (strict) | 2026-06-26 useWholesale* 훅이 에러를 빈배열로 안 삼키게 바뀐 뒤, 도매/제조사/도매-어드민 페이지가 `data` 만 읽고 `isError` 미사용 → 일시 5xx/네트워크 실패가 "데이터 0건"·"예치금 ₩0"·"승인 대기 없음"으로 오표시(판매사 재무 오인·승인큐 self-undo). 그 surface 의 data 소비 페이지는 `isError` 분기(+재시도) 필수. 예외 `iserror-check-ok` 주석 |
| 도매주문 상태 무결성(정의 밖 status) | `check-wholesale-order-status.mjs` (warn) | `verify.yml` (strict) | 2026-06-27 B2B 도매주문 상태머신 신설(`wholesale-order-status.ts` PENDING→PAID→ACCEPTED→SHIPPED→DONE + REJECTED/CANCELLED). `wholesale_orders.status` 는 free-form TEXT(CHECK 없음)라 오타/정의 밖 상태 write 가능 → 고아 상태(DONE/CANCELLED 처럼 UI엔 있는데 아무도 안 쓰던 것). canonical(`WHOLESALE_ORDER_STATUSES`) 밖 값을 `wholesale_orders SET status='X'`/`transitionWholesaleOrder(...,'X')` 로 쓰면 위반. 전이는 `transitionWholesaleOrder` CAS 경유. **동반 P0**: 도매 정산 성숙(`matureSupplierSettlements`)이 발송 여부 무관하게 시간만으로 지급되던 것 → 라인 `line_status='SHIPPED'` 게이트 추가. 예외 `wholesale-status-ok` 주석 |
| 가격으로 로그인 유도(로그인했는데 '로그인하세요') | `check-login-gate-by-price.mjs` (warn) | `verify.yml` (strict) | 2026-06-27 도매 상세/카탈로그가 `distributor_price == null`(가격 없음) 하나로 **로그인 여부**와 **가격 유무**를 동시 판단 → 로그인했는데 그 등급 공급가가 미설정/스테일이면 가격없음을 '로그아웃'으로 오판, 주문/담기 클릭 시 `goLogin()` 으로 쫓아냄. 표면별 패치(2026-06-19 표시만 고침)라 핸들러에서 재발. **로그인 유도는 `if (!token)` 로만**, 가격 null/0 은 '공급가 미설정 · 제조사 문의' 안내(redirect 금지). 도매 surface(`Wholesale*`/`Supplier*`/`supplier-dashboard`/`components/wholesale`)에서 가격-부재 조건이 `goLogin` 게이트하면 위반. 예외 `login-gate-ok` 주석. 같은 사건의 짝(모바일 하단 잘림)은 `StickyActionBar`(`components/ui/sticky-action-bar.tsx`) 자동 spacer 로 구조적 해소 |
| 모달/시트가 하단 네비 뒤로 가려짐 | `check-modal-zindex.mjs` (warn) | `verify.yml` (strict) | 2026-06-26 대표 "이 문제 계속 발생 — 근본적으로". 풀스크린 오버레이(`fixed inset-0 z-[N]`)를 `z-[100]`(FAB 대) 등 네비(`z-[9999]`) 아래로 달아 하단 네비가 모달/바텀시트(공구권 등록 시트 등) 위를 덮어 버튼이 안 보임. 새 모달 추가마다 재발 → 표준 스케일(`src/constants/z-index.ts`: 모달 10500 / 시트 10600 / 토스트 20000 / 확인창 100000) 강제. 23개 일괄 교정 후 strict. 예외(네비 숨김 화면 전용 등) `modal-zindex-ok` 주석 + `pointer-events-none` 자동 제외 |
| 대시보드 라우팅(다중역할/겸업 lock-out) | `check-seller-wholesale-redirect.mjs` (warn) | `verify.yml` (strict) | 2026-06-30 대표 신고 — `/seller` 들어가면 `/wholesale` 로 튕김. `SellerLayout` 이 `localStorage.is_distributor === '1'` 하나로 무조건 도매몰 redirect(마운트 effect + render 가드 2곳) → **소비자 셀러 + 판매사 겸업** 계정이 셀러 대시보드에서 영구 차단(기존 셀러가 `/become-distributor` 한 번만 해도 같은 셀러 행에 is_distributor=1 덧붙어 겸업이 됨). `is_distributor`=도매 *접근권*(capability)이지 도매 *전용*(exclusivity)이 아님(주석은 "겸업 영향 없음" 약속했으나 코드 미구현). **일반 룰(이 클래스 전체): 대시보드 레이아웃/페이지(`*Layout`·`*DashboardPage`·`Seller*`·`supplier-dashboard`)에서 가산 권한 플래그(`is_*`) 단독 게이트로 서비스간 redirect/`return null` 금지** — 셀러↔도매=서버 권위 `wholesale_only`(SSOT `computeWholesaleOnly`, 인증 `GET /api/seller/surface`), 또는 다중역할 보호 동반조건(`!loggedIn`/`!token`/단일역할 `role !==`). 게이트를 새 신호로 바꿔 기존 깨진 겸업 계정은 재로그인 없이 자동 치유. 예외 `seller-wholesale-redirect-ok`/`multi-role-redirect-ok` 주석 |
| god 파일 재발(페이지/라우트 비대화) | `check-file-size.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-06-29 대표 "리팩토링 반복 말고 애초에 막아라". 페이지/라우트가 "일단 여기에 한 블록 더" 누적으로 god 파일(MyVouchersPage 1296·GroupBuyListPage 1309…) → 사후 대규모 분해 필요. **래칫**: 신규 파일 600줄 초과 차단 + 기존 대형 파일은 `scripts/file-size-baseline.json`(현재 82개 동결)보다 **커지면 차단**(줄이는 건 OK). 줄인 뒤 `node scripts/check-file-size.mjs --rebaseline` 로 동결값 갱신. 분해법: 카드·모달·섹션·핸들러群을 같은이름 폴더(`foo-list/`)로 추출(GroupBuyListPage→`group-buy-list/` 9개, MyVouchersPage→`my-vouchers/` 7개 선례). 예외 `file-size-ok` 주석 / `[SKIP_SIZE]` |
| 블로그 시드 최신성(낡은 명칭/기능 재유입) | `check-blog-seed-currency.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-07-01 대표 신고 "블로그가 자동으로 안 고쳐짐". 소비자 블로그(`/blog`) 시드는 `blog.routes.ts` `blogSeedPosts()` + `BLOG_SEED_VERSION` 버전 재시드(관리자 수동편집=`manually_edited=1` 보존). 시드가 폐기 명칭(식사권/공구권/인플루언서/큐레이터)·영구중단 기능(라이브커머스/라이브방송/쇼츠)·도매몰(유통스타트/판매사/제조사) 내용으로 되돌아가면 라이브 블로그가 다시 낡아짐. **서비스 사실 바뀌면 시드 고치고 `BLOG_SEED_VERSION` +1**(안 올리면 라이브 미반영). 상세: 위 "📝 블로그 시드 자동 업데이트" 섹션. 예외 `blog-currency-ok` 주석 |

| pagination NaN 크래시(비숫자 page/limit) | `check-pagination-nan.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-07-01 도매몰 라이브 전수조사 — `GET /api/wholesale/catalog?page=abc&limit=xyz` → **HTTP 500**. `Math.max(1, parseInt(q('page')\|\|'1',10))` 가 비숫자 query 에 `parseInt('abc')=NaN → Math.max(1,NaN)=NaN → offset=(NaN-1)*limit=NaN → D1 .bind(NaN)` 크래시. 문자열 기본값('1')은 query *부재* 시에만 쓰여 NaN 을 못 막음(음수/거대값/빈값은 이미 200 정상 — **비숫자 문자열만** 500 → 봇/스크래퍼/오염 링크가 도매몰 메인 카탈로그·소비자 동네딜 등 목록을 크래시). 전 서비스 동일 클래스(도매·소비자·에이전시·어드민·셀러 43라인) 일괄 수정. **규칙**: request 의 page/limit/offset/days 등은 `parseInt(...) \|\| <기본값>` 또는 `Math.max/Math.min(... \|\| <기본값>)` 로 NaN 폴백 필수(닫는 괄호 뒤 `\|\| 숫자`). ID 해석용 parseInt(numId 등)는 `isNaN` 가드 보유라 무관. 예외 `pagination-nan-ok` 주석 |

**Bypass (정당 사유만):**
- commit message 에 `[SKIP_ROUTER_CHECK]` / `[SKIP_BUILD_CHECK]` / `[SKIP_SECRET_CHECK]` / `[STRICT_SILENT]` 등 명시
- 또는 `git commit -n` (모든 hook 우회) — CI 에서 reject 됨

**배포 흐름 (자동):**
```
git push origin main
   ↓
GitHub Actions (main.yml) auto-trigger
   ↓
[verify.yml steps] 안티패턴 / 빌드 / 타입 / secret 검증
   ↓
[main.yml steps] npm run build → wrangler pages deploy
   ↓
Pages 갱신 → live.ur-team.com 반영
```

**Worker / Cron 변경 시 추가 (드물게):**
```powershell
npx wrangler@3 deploy   # Workers 프로젝트 (cron 코드 동기화)
```
