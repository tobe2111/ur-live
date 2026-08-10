# CLAUDE.md — 유어딜 프로젝트 개발 규칙

## 🌐 유어딜 플랫폼 모델 SSOT — 전 세션 자동 최신화 (2026-07-02 대표 지시 "어떤 세션에서 작업하더라도 자동 업데이트")

**플랫폼 전체 그림(SSOT)** = `docs/design/urdeal-platform-model.md` (드릴다운: `linkshop-role-model.md`) + **대외 비즈니스 문서** `docs/business/urdeal-business-plan.md`(사업계획/회사소개/입점제안). 새 세션은 이 문서로 전체 구조(3서비스·행위자·상품종류·경제·성장·데이터)를 먼저 잡는다. **어드민 `/admin/platform-model` 에서 두 문서 모두 탭으로 열람**(`?raw` import → 배포 시 자동 동기화).

**🔄 필수 룰 (모든 세션 준수 — "자동 업데이트"의 실체는 이 규칙이다)**: 플랫폼 **구조**가 바뀌면 **같은 커밋에서** 이 문서를 갱신한다. 구조 = 행위자(부류)·상품/콘텐츠 종류·커미션/정산의 *종류*·서비스 경계·역할·성장 루프·주요 라우트. 예:
- 새 행위자·역할(`seller-roles.ts`)·상품종류(`voucher-categories`)·커미션종류(affiliate/영입/공급자 helper) 추가/변경 → §2~5 갱신
- 새 소비자 기능 도메인(`features/*`)·주요 라우트 신설 → §3~4 갱신
- 서비스 분리 경계·명칭 SSOT 변경 → §1·§3 갱신
- ❗ **수치(%·기간·금액)만의 변경은 문서 갱신 불필요** — 값은 어드민(`platform_settings`) 조정 대상이고 문서는 *구조*만 고정(문서에도 "어드민 조정 기본값"으로만 표기).

**자동 강제**: `scripts/check-platform-model-sync.mjs` (pre-commit + audit-gate, warn·`STRICT_PLATFORM_MODEL=1` block) — 구조 파일 staged 인데 문서 미갱신이면 경고. 우회: 수치만 변경이면 무관, 의도적이면 commit 메시지 `[SKIP_PLATFORM_MODEL]`. 문서 하단 "구현 로그"에 단계 완료 시 commit hash 기록.

> ⚠️ 이 룰 안 지키면: 문서가 낡아 다음 세션이 옛 구조로 오판 → 대표가 "왜 문서랑 코드가 달라?" 반복. (블로그 시드·운영 가이드 자동 sync 와 동일 철학.)

## 🧱 서비스 철저 분리 — 도매몰(B2B) ↔ 유어딜 공구(소비자) ↔ **공구 서비스(운영자 SaaS)** (2026-06-26 대표 명령 · 2026-08-03 3번째 축 추가)

> 🆕 **2026-08-03 — 축이 셋이 됐다.** 이 절은 오래 "두 서비스"였는데, 그 사이 **공구 서비스**
> (매장 업주가 자기 몰을 열고 픽업 공구를 파는 운영자 SaaS)가 **도매몰 코드를 용도 변경해**
> 구현되기 시작했다(2026-07-29 대표 사업설계 · `docs/design/operator-mall-saas-gap.md`).
>
> ⚠️ **이 문서가 낡아서 실제 사고가 났다**: 2026-08-03 세션이 **공구 서비스의 오픈 차단 항목**
> (미수령 고지 문구·브랜딩·실결제)을 **"유어딜 일"로 대표에게 보고**했다. 서로 다른 서비스의
> 할 일이 한 목록에 섞였고, 대표가 *"유어딜과 공동구매 분리를 잘 생각해라"* 고 바로잡아 줬다.
>
> 🔑 **작업·보고 전에 "이건 넷 중 어디인가"를 먼저 밝힌다**(유어애즈 포함). 특히 헷갈리는 짝 —
> **유어딜의 이용권**(소비자가 즉시 구매, `urdeal.kr/group-buy/:id`) ↔ **공구 서비스의 픽업 공구**
> (운영자가 자기 몰에서, `urdeal.kr/{몰슬러그}`). **코드가 둘 다 `group_buy_*` 라고 부르지만 서비스가 다르다.**
> 서비스 지도 SSOT: `docs/design/urdeal-platform-model.md` §1.

**대표 지시**: "도매몰과 유어딜 공구 서비스를 철저히 분리해서 작업해야 해. 어떠한 세션에서도."

이 레포는 **별개의 두 서비스**를 한 코드베이스에 담고 있다. **한쪽 작업이 다른 쪽에 새지 않게** 하는 것이 최우선 룰. 작업 전 "이건 어느 서비스인가?"를 먼저 판별하고, **그 서비스 경계 안에서만** 변경한다.

| 축 | 🏭 **도매몰 (유통스타트, B2B)** | 🎟️ **유어딜 공구 (소비자)** |
|---|---|---|
| 정체성 | 제조사→판매사 B2B 도매 (도매가/예치금/정산) | 소비자 공동구매·교환권·쇼핑 (딜포인트/결제) |
| 행위자 | 제조사(supplier) · 판매사(distributor=`sellers.is_distributor=1`) · 도매 어드민(`admin role='wholesale'`) | 유저(소비자) · 사업자유저(셀러) · 일반 어드민 |
| 라우트(페이지) | `/wholesale/*` · `/supplier/*` · `/admin/wholesale-*` · `/admin/distributor*` · `/admin/suppliers` · `/admin/distributor-approval` | `/` · `/group-buy` · `/community-group-buy` · `/vouchers` · `/products` · `/browse` · `/u/*` · `/seller/*`(소비자 셀러) |
| API 네임스페이스 | `/api/wholesale/*` · `/api/supplier/*` · `/api/admin/wholesale-*` · `/api/admin/distributor*` · `/api/admin/suppliers` · `/api/admin/supplier-products` | `/api/group-buy/*` · `/api/community-group-buy/*` · `/api/products` · `/api/vouchers` · `/api/orders`(소비자) |
| 코드 | `src/features/supply/**` · `src/pages/wholesale*/**` · `src/pages/supplier-dashboard/**` · `src/components/wholesale/**` | `src/features/group-buy/**` · `src/features/community-group-buy/**` · `src/pages/main-home/**` · `src/pages/GroupBuy*.tsx` · `src/pages/Vouchers*.tsx` |
| 브랜드/도메인 | 유통스타트 · `utongstart.com` | 유어딜 · `urdeal.kr` (2026-07-20 이전 — 구 `live.ur-team.com` 은 영구 301) |

**룰**:
1. **한 서비스 작업 시 다른 서비스 파일/라우트/네임스페이스를 건드리지 말 것.** 예: 도매 정산 수정이 소비자 정산을, 도매 상품등록이 소비자 카탈로그를 바꾸면 안 됨.
2. **공유 테이블은 구분 플래그로 격리** — `products.is_supply_product`(도매=1) · `sellers.is_distributor`(판매사=1). 한쪽 쿼리/변경이 반대쪽 행을 건드리지 않게 WHERE 에 항상 플래그 포함. 새 공유 컬럼 추가 금지(예산제 — `product_supply_meta` 사이드테이블).
3. **"공구"는 둘 다 존재** — 도매에 B2B 발주가 있고 소비자엔 공동구매가 있음. 맥락(행위자/라우트/네임스페이스)으로 어느 쪽인지 먼저 확정. `community-group-buy`=소비자, `wholesale/orders`=도매.
4. **크로스-서비스 변경이 정말 필요하면** — 착수 전 **세 줄만 보고하고 바로 진행**한다(2026-07-29 대표 확정 — 이전의 "`AskUserQuestion` 으로 승인 대기"를 **대체**. 매번 멈추지 말 것):
   **(a) 어느 레일을 만지는가**(도매 / 소비자(유어딜) / **공구 서비스(운영자 몰)** / 유어애즈 / 여럿 — 여럿이면 파일·네임스페이스) · **(b) 머니 경로 접촉 여부**(결제·정산·적립·환불·원장 중 무엇, 없으면 "없음") · **(c) 롤백 방법**(게이트 OFF / revert / 블록 제거).
   ⚠️ (b)가 "있음"이면 **단독 세션 + staging 실결제** 룰이 추가로 붙는다. 상세: `docs/design/pickup-groupbuy-wholesale-link.md` §7.2
> 💳 **결제 수단 오해 방지 (2026-07-29 실측 정정)**: 소스 주석 `wholesale-plus.routes.ts:4` 의
> *"도매몰은 PG(Toss) 미사용 — 예치금에서 차감"* 은 **그 파일(연 구독) 맥락이지 도매 전체가 아니다.**
> 도매에도 Toss 경로가 있다(`wholesale.routes.ts:1775 POST /orders/confirm` → `confirmTossPayment`).
> **소비자가 그 경로를 못 타는 진짜 이유는 PG 부재가 아니라** `seller_token` 필수 · `distributor_seller_id`
> 스코프 · 대상 테이블 `wholesale_orders`(B2B) 다. 몰 주문을 소비자에게 팔려면 **소비자 `orders` 레일**로
> 태워야 한다(`payment.routes` 무수정). 상세: `docs/design/operator-mall-saas-gap.md` §3.

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
- 2026-08-04 `[UNLOCK]` `PaymentSuccessPage.tsx` **GLOBAL 전용 Firebase 인증 대기 블록 제거** (대표 `AskUserQuestion` 승인 "허가 — 그 블록만 제거"). **배경**: Firebase 클라이언트 잔재를 전면 삭제(번들 −400KB · 유출됐던 서비스계정 키 계열 코드 제거)하는데, 이 파일의 `waitForFirebaseAndConfirm()` 이 `@/lib/firebase-auth` 를 import 해 삭제를 막고 있었다. 그 블록은 **`if (!isKorea())` 안에 있어 한국에서는 한 번도 실행된 적이 없고**, GLOBAL 은 미런칭·폐기(#804)라 도달 경로가 없다(서버 수용도 2026-07-28 #806 에 차단). **수정**: 함수 본문을 `confirmPayment()` 호출 한 줄로 축소(호출부 계약 유지를 위해 함수 이름은 보존 — `useEffect` 가 그 이름을 부른다). **⚠️ Toss confirm/금액검증(`serverTotal!==parsedAmount`)/`TossPaymentObject` 표시(receipt.url·cashReceipt·easyPay·card·approvedAt)/pendingBookings/autoReturn/셀러 전환 넛지 전부 byte-불변** — 제거한 것은 결제와 무관한 인증 대기뿐이다. 검증: tsc 0 · build 0 · vitest 5056 pass(382 파일) · audit-gate ALL GREEN 88. ⚠️ **staging 결제 성공 1회 권장**(리다이렉트 직후 승인이 정상 진행되는지 — KR 경로는 원래 이 블록을 건너뛰었으므로 회귀 가능성은 낮다). 롤백: 이 함수를 이전 형태로 되돌리려면 `firebase-auth` 도 함께 복원해야 한다.
- 2026-07-02 `[UNLOCK]` `webhook.routes.ts` `handlePaymentConfirmed` **쇼핑 원장 net 크레딧 — webhook 경로 대칭** (대표 AskUserQuestion 승인 "선행 수리까지" — 쇼핑 전수조사 정산 갭). **배경**: `creditSellerOrderToLedger` 가 `payment.routes /confirm` 에만 있어 `confirmPaymentAtomic` CAS 로 **webhook 이 이기면(브라우저 confirm 누락) 그 주문은 원장에 영구 미적립** → `SHOPPING_LEDGER_ENABLED` 활성 시 주간 payout 에서 그 매출 누락. **수정(게이트 블록 1개 추가)**: 기존 `result.confirmed>0` side-effect 블록(딜차감·KT발송 다음)에 `/confirm` 과 동일 게이트(`env.SHOPPING_LEDGER_ENABLED==='true'`, 기본 OFF)로 order_number 의 각 주문에 `creditSellerOrderToLedger` 호출. 동일 멱등(order:N dedup + 이용권/공구 skip) + `result.confirmed>0`(단일실행) 가드 → 이중적립 0. **⚠️ confirmPaymentAtomic/금액검증/기존 side-effect 전부 byte-불변 — 게이트 블록만.** 기본 OFF=현행 100% 동일. (동반 비잠금: `returns.routes.ts` 반품환불 인라인 역전 체인에 `reverseSellerOrderLedger` 추가 — 이 경로만 누락돼 활성 시 반품된 쇼핑 주문 receivable 잔존→과지급이던 것 대칭화, 게이트 무관 완전 멱등이라 OFF 시 no-op.) 검증: sql 가드 0(tsc/build 는 npm 403 미실행 — staging 필수). ⚠️ **staging(게이트 ON 시)**: webhook-only 확정 주문 원장 적립 + 반품 시 역전 → receivable 0.
- 2026-07-02 `[UNLOCK]` `webhook.routes.ts` `handlePaymentFailed` **재고 복원 무가드 → 전이 성공분 한정** (대표 AskUserQuestion 승인 "지금 수정" — 쇼핑 상품 전수조사 P1). **배경**: 결제 실패 webhook 이 `updateStatus(orderNumber,'FAILED')`(내부 CAS 로 PENDING/AWAITING_PAYMENT 만 FAILED 전이) 결과와 **무관하게 무조건** `restoreStock(order.id)` 를 루프 실행 → ① 지연 도착한 ABORTED/EXPIRED webhook 이 이미 `/confirm` 으로 확정(DONE)된 주문의 재고를 되살려 **초과판매** ② order_items 를 CANCELLED 로 오염(이후 환불 시 복원 skip → 원장 꼬임). `handlePaymentCancelled` 는 paid-guard+CAS 를 갖췄으나 실패 핸들러엔 부재(비대칭). **수정(restoreStock 호출 게이트 1개 추가만)**: `updateStatus` 후 `findByOrderNumber` 재조회 결과에서 **`status==='FAILED'` 인 주문(=이 webhook 이 실제 전이시킨 것)만** 재고 복원, DONE/CANCELLED/REFUNDED 등은 skip(로그). **⚠️ Toss 시그니처/금액검증/updateStatus(내부 CAS)/알림 전부 byte-불변 — restoreStock 게이트만.** 검증: sql-bind/column/table/money-pattern 가드 0(이 원격환경 npm 403 으로 tsc/build 미실행 — staging 검증 필수). ⚠️ **staging**: 카드 결제 확정(DONE) 후 지연 실패 webhook 도착 시 재고 불변(복원 skip) + 정상 PENDING 실패 시 재고 1회 복원. 롤백: 게이트 조건(`if status !== 'FAILED' continue`) 제거 → 무조건 루프 환원.
- 2026-07-03 `[UNLOCK]` `PaymentSuccessPage.tsx` **구매 직후 셀러 전환 넛지 배선** (대표 AskUserQuestion 승인 "잠금 해제하고 직접 수정 · 1~4번 전부 · 가장 이상적으로" — 티몬 초기모델 비교 후 "웨지 전환 깔때기" 구현). **배경**: 로컬딜/이용권 미끼 → 링크샵 D2C 전환이 웨지 전략인데, 기존 셀러 전환 CTA 가 마이/링크샵 소유자뷰(RoleCtaGrid·SellOwnProductsCTA)에만 있어 **이미 관심 있는 사람만 봄(self-selection)** — 방금 산 소비자에게 전환 제안이 한 번도 안 뜨는 "깔때기 중간 단절". **수정(additive 비-결제 UI 1블록)**: 결제 성공(non-demo) 화면 액션버튼 위에 `<SellerConversionNudge/>`(신규 `src/pages/payment-success/SellerConversionNudge.tsx` — file-size 룰 준수 추출) 렌더 — "내 쇼핑몰에서도 팔 수 있어요" + `user_handle` 있으면 `live.ur-team.com/u/{handle}` 개인화, CTA→`/seller/register/supplier?from=payment`(기존 `?from=curator` 패턴), '다음에' 닫으면 localStorage 재노출 억제. 셀러(`seller_token`)·데모·비로그인 미노출. **⚠️ Toss confirm/금액검증(client-side serverTotal!==parsedAmount)/TossPaymentObject 표시(receipt.url·cashReceipt·easyPay·card·approvedAt)/pendingBookings/autoReturn 전부 byte-불변 — 자기완결 넛지 컴포넌트 렌더 1줄 + import 만.** 검증: audit-gate 42 GREEN(sql-bind/column/table/theme/file-size/mobile-viewport 0)·⚠️ 이 원격환경 npm 403 으로 tsc/build 미실행(staging 회귀검증 필요). 롤백: 넛지 렌더 1줄 + import 제거(+ 파일 삭제).
- 2026-07-19 `[UNLOCK]` `TossPaymentWidget.tsx` **결제하기 버튼 색만 브랜드 로즈** (대표 브랜드 컬러 전면 적용 지시서 + AskUserQuestion "색만 [UNLOCK] 허용" 명시 승인). ready 상태 버튼 `bg-blue-600 hover:bg-blue-700 active:bg-blue-800` → `bg-brand hover:bg-brand-dark`(#E0526B/#C43D55) — **className 색상 1곳만**. requestPayment/약관 클릭시점 검증/orderName 100자/customerEmail·Name·Phone/setAmount/widgets() 키분기/Toss SDK 위젯 영역 전부 byte-불변(지시서 금지선: SDK 위젯 무접촉). disabled 상태(bg-gray-300)는 gray 리매핑(웜 스케일)만 승계. 매핑 SSOT: `docs/design/brand-color-rollout.md`. 롤백: 클래스 1곳 환원.
- 2026-07-18 `[UNLOCK]` `PaymentSuccessPage.tsx` **로딩 스피너 → 유어딜 BrandLoader 단일화** (대표 명시 승인 "통일해" — 소비자 로딩 전수 통일의 마지막 1건). **배경**: 대표 지시 "로딩 중엔 무조건 하나로 통일(도매몰 제외)" 전수조사에서 소비자 PAGE-level 커스텀 로더 11곳을 BrandLoader 로 교체했는데, 이 파일만 Toss V2 감사-잠금이라 보류 → 명시 승인 후 처리. **수정(로더 1블록만)**: `if (loading)` 의 border-spinner + `paymentSuccess.approving` 텍스트 블록 → `<BrandLoader fullScreen label={t('paymentSuccess.approving')} />`. **⚠️ 결제 확정/금액검증/TossPaymentObject 필드 표시(receipt.url/cashReceipt/easyPay/card/approvedAt)/pendingBookings 조회 전부 byte-불변** — 표시 로직은 `loading=false` 이후라 무접촉, `loading=true` 동안의 스피너 비주얼만 교체. 검증: tsc 0·theme·consumer-loader-unify 가드 GREEN(예외목록에서 해제). 롤백: 로더 블록 환원.
- 2026-07-13 `[UNLOCK]` `payment.routes.ts` `/confirm` **상권 쿠폰 경로 B(온라인 결제 자동발급) 게이트드 배선** (대표 승인 "(b) 전면 구현, 게이트 OFF·별도 draft PR·main 머지 금지·staging 실결제 후"). **배경**: 상권 페이백 쿠폰(병렬 엔티티 `district_coupons` — 딜/유어딜 5%/원장 무접촉)에 **경로 A(오프라인 영수증 등록→어드민 승인)** 에 더해 **경로 B(참여 매장에서 유어딜로 결제→기준액 이상이면 무승인 자동발급)** 추가. 발급 트리거 = 결제 완료 이벤트(경로 A 의 '어드민 승인' 자리를 '결제 감지'가 대체). **수정(additive 게이트드 1블록)**: `_confirmSideFx`(waitUntil) 끝의 `SHOPPING_LEDGER_ENABLED` 블록 다음에 `DISTRICT_AUTO_ISSUE_ENABLED==='true'`(env, 기본 OFF) 게이트로 `autoIssueDistrictCouponForOrder`(district-coupon.routes) 호출 — 참여 매장(`district_stores.seller_id` 연결) + `auto_issue_enabled` 캠페인 + **행사 기간 내**(상시 아님) + reward_tiers 기준액 이상이면 상권 쿠폰 자동발급. **④ 결제 성공 경로 영향 0**: waitUntil 후처리 + autoIssue 자체가 **완전 fail-soft(절대 throw 안 함)** → 쿠폰 발급 실패가 결제 확정/응답을 롤백 못 함. **③ 경로 B = source='online' 자동승인 영수증 행 모델** → 1인 월 한도가 경로 A 와 **자동 합산**(`district_receipts` 카운트, 한도 로직 byte-불변) + 결제건 1회 발급(`source_ref=order_number` UNIQUE 멱등, `card_approval_no` 유지 비파괴). **② 재원 분리** = `funding_source` 태그(캠페인 `auto_issue_funding_source`, 쿠폰 스탬프) + 예산 가드 2풀(`budget_total`=재단/`budget_urteam`=유어팀, 원장 무접촉 — 컬럼+집계). 리포트 A/B×재원 GROUP BY. **⚠️ Toss confirm/금액검증/confirmClaim CAS/재고·딜차감/기존 커미션·알림·KT발송·fee-resolver·쇼핑원장 게이트 전부 byte-불변 — 게이트드 side-effect 1블록 추가만. 기본 OFF(env 미설정)=`/confirm` byte-동일.** 신규 env `DISTRICT_AUTO_ISSUE_ENABLED`. 검증: sql bind/column/table/not-null·theme·modal·light-input·mobile·csv·pagination 0. **⚠️ 활성 전 staging 실결제 필수**(대표 조건 ①): `DISTRICT_AUTO_ISSUE_ENABLED=true` + 캠페인 `auto_issue_enabled` + 파일럿 매장 결제 → 쿠폰 1장 발급 + 1인 한도 A/B 합산 + 재원별 예산 가드 + 중복 결제 재발급 0 확인 후에만 머지. 설계: `docs/design/district-coupon-estimate-2026-07.md §경로 B`. 롤백: `/confirm` 게이트드 블록 1개 제거(게이트 OFF 라 유지도 무해).
- 2026-07-04 `[UNLOCK]` `payment.routes.ts` `/confirm` **커미션 예산 아비터 통합 [INV-CB]** (대표 승인 "구현 하자 가장 이상적이고 영구적으로" — 수수료율 동결·재원 구조 수정). **배경**: 플랫폼 부담 성장 커미션 4축(어필리에이트 2%·멀티티어 트리 10/3/1%·영입자 1.5%·에이전시 1~2%)이 서로 캡을 모른 채 GMV % 로 얹혀 **트리 경유 주문 최악 −14%**(수수료 5% − PG 2.5% − 커미션 스택) 구조 노출. **수정(호출부 통합만)**: `_confirmSideFx` 의 개별 4블록(affiliate intent/agency/influencer/supplier) + `_postConfirmBg` 의 multiTier 를 → **`creditOrderCommissions`(order-commissions.ts, webhook 과 동일 진입점) 1회 호출**로 통합. 오케스트레이터가 `commission_budget_enabled==='true'`(platform_settings, 기본 OFF) 게이트로 3P 주문당 예산(수수료−`pg_reserve_pct`) 안에서 비례 배분(`commission-budget.ts` 순수함수 + 유닛테스트) — **기본 OFF = 기존과 동일 순서/인자로 각 헬퍼 위임(행동 0 변화)**. 부수효과: C1(affiliate)↔C2(multiTier) 상호배타 dedup 이 별개 waitUntil 병주로 이론상 이중지급 가능하던 레이스가 순차 실행으로 구조적 제거. 동반(비잠금): 적립 헬퍼 4종 compute/override 리팩토링(멱등·역전 대칭 불변, override 는 min-clamp 축소만) · promo owner-펀딩 스위치(`promo_funding_source`, 이용권 사용시 원장 debit + 쇼핑 원장 fee 합산 + 환불 역전) · 정액 보상 월예산 캡(초대/에이전시 signup) · 영구 가드 `check-commission-budget.mjs`(audit-gate+verify strict — 아비터 우회 차단). **⚠️ Toss confirm/금액검증/confirmClaim CAS/재고·딜차감/알림/KT발송/fee-resolver 그림자/쇼핑원장 게이트 전부 byte-불변 — side-effect 커미션 호출부만 통합.** 설계 SSOT: `docs/design/commission-funding-restructure.md`. ⚠️ **활성 전 staging 실결제 필수**: `commission_budget_enabled=true` 로 영입+트리 겹친 주문 → Σ적립 ≤ 예산 + 환불 역전 / `promo_funding_source=owner` 로 이용권 구매→사용→매장 원장 promo debit 1회 + 환불 복원. 롤백: `/confirm` 통합 1블록 → 기존 개별 블록 환원(오케스트레이터는 게이트 OFF 라 유지 무해).
- 2026-07-01 `[UNLOCK]` `payment.routes.ts` `/confirm` **일반 쇼핑 주문 → 이중원장 net 크레딧 그림자 배선** (대표 승인 "진행해줘 가장 이상적으로" — 정산 자동화 완성). 배경: 소비자 셀러 매출 중 동네딜 공구·이용권은 원장(`ledger_entries` seller:N)에 적립돼 주간 자동 payout(`payouts-generate`)으로 정산되나, **일반 쇼핑 주문은 원장 미기록 → 자동 payout 누락**. **수정(그림자 게이트 1블록 additive)**: `_confirmSideFx`(confirmClaim CAS 후 waitUntil) 의 fee-resolver 그림자 블록 다음에 `SHOPPING_LEDGER_ENABLED==='true'` 게이트로 `creditSellerOrderToLedger(order.id)` 호출 — 셀러 매출을 원장에 net 크레딧(`amount=gross + fee_amount=플랫폼수수료`, 집계식이 net 산출). **기본 OFF**=현행 100% 동일(fee-resolver 그림자와 동일 2단 스위치). **이중적립 0**: 멱등(order:N/order_number dedup) + 이용권/deal_only 아이템 주문 skip(voucher 사용시 원장 기록됨) + 공구는 group-buy.routes 가 order_number 로 이미 크레딧→dedup skip. **환불 역전 대칭**: `order-refund.ts reverseOrderAncillaryOnRefund` 에 `reverseSellerOrderLedger`(seller:N net debit, 게이트 무관 멱등) 배선. **⚠️ Toss confirm/금액검증/confirmClaim/confirmPaymentAtomic/reduceStock/딜차감/기존 side-effect 전부 byte-불변 — 게이트 그림자 블록 1개 추가만.** 새 helper `order-ledger-credit.ts`, env `SHOPPING_LEDGER_ENABLED`. 동반(비잠금): payout 집계 net 정합(`ledger.ts getLedgerReceivable`=Σ(credit−fee)−Σ(debit), `payouts-generate` net 쿼리, 어드민 approve 과다지급 가드). 검증: 단위 2446 pass(신규 ledger-payable-net 12)·tsc 0·build 0·sql bind/table 0·money-pattern 0. ⚠️ **활성 전 staging 실결제 필수**: SHOPPING_LEDGER_ENABLED=true 로 쇼핑 결제 → 원장 net 크레딧 1회 + 환불 시 역전 → receivable 0 확인. (쇼핑탭 숨김이라 현재 라이브 영향 0 — 재오픈 전 검증.)
- 2026-07-02 `[UNLOCK]` `payment.routes.ts` `/confirm` + `TossWidgetPayPage.tsx` **결제 체감속도(felt-latency) 최적화** (대표 AskUserQuestion 승인 "전부 (1~4)" — 결제 속도 전수조사). **배경**: ① `/confirm` 이 KT-Alpha 교환권 발송(외부 HTTP, prod 실측 1~4.5s) + `calculateMultiTierCommission`(추천트리 DB 왕복 다수)을 **동기로 await** — 결제 응답을 막던 마지막 큰 두 블록(2026-06-26 커미션 3종 waitUntil 이동 시 잔존분). ② 딜충전 위젯 페이지는 variantKey 조회 fetch 가 렌더 시퀀스 **중간 직렬**(renderPaymentMethods 를 막음) + 약관 위젯까지 await(버튼 활성 지연) + timeout 8s(주문 위젯은 4s) — 주문 위젯(TossPaymentWidget)이 이미 해결한 패턴 미반영. **수정(실행 시점/순서만 — 로직 byte-불변)**: ① `/confirm` KT 발송+multiTier 커미션을 `_postConfirmBg`(waitUntil, ctx 없으면 동기 fallback)로 이동 — 내용/순서/에러처리 불변. 안전판: 둘 다 fail-soft + KT per-order 멱등 + **`kt-alpha-voucher-retry` cron 에 미발송 스위퍼 신설**(PAID/DONE 인데 발송기록(`external_order_id LIKE 'u{oid}-%'`) 0 인 주문 재킥 — waitUntil isolate 소멸 갭 + 기존 동기 경로의 결제커밋~발송 크래시 갭 모두 커버, 시도 이력 있으면 NOT EXISTS 제외라 이중발송 구조적 0) + 커미션은 confirmClaim CAS 단일실행. ② `TossWidgetPayPage`: variant fetch 를 SDK 로드와 **병렬 시작**(소비만 렌더 직전), `renderAgreement` **비대기**(주문 위젯 :170 과 동일 — 이 페이지 버튼은 원래 약관에 안 묶임, 미동의는 Toss `NEED_AGREEMENT` 강제가 백스톱), timeout 8000→4000ms 정합. **⚠️ Toss confirm/금액검증/CAS/재고·딜차감/디지털발급/requestPayment/orderName 100자/키분기 전부 byte-불변.** (동반 비잠금: `points.routes.ts /pay` KT 발송 동일 waitUntil 이동 — 교환권 메인 라이브 경로 1~4.5s 단축 · `CartPage` prefetch 를 bare npm import → `toss-preload`(loadTossPayments 실행) 승격 · `toss-preload.ts` 에 js.tosspayments.com **동적 preconnect**(index.html 주석의 예고 구현).) 검증: sql-bind/column/table/file-size 가드 0. ⚠️ staging: 교환권 딜결제 → 응답 즉시 + 교환권 수초 내 도착 + cron 스위퍼 무발동(정상 주문) 확인. 롤백: `_postConfirmBg`/`_ktBg` 래퍼 제거(동기 환원) + TossWidgetPayPage 3변경 환원 + cron C블록 제거.
- 2026-07-01 `[UNLOCK]` `payment.routes.ts` `/confirm` 혼합결제 딜 차감 **`.bind(orderNumber)` 누락 버그 fix** (대표 AskUserQuestion 승인 "수정 + 선물 CAS도" — 결제 전수조사 후속). **배경**: 2026-06-17 배선된 딜 차감 블록의 orders 조회가 `?` 플레이스홀더를 갖고도 `.bind()` 없이 `.all()` 호출 → D1 바인딩 오류 → 직후 `.catch(() => ({results:[]}))` 가 삼켜 **블록 전체가 무음 no-op** (혼합결제 딜 잔액이 /confirm 경로에서 한 번도 차감된 적 없음). webhook 쪽 동일 블록은 bind 정상이나 /confirm 이 CAS 승자면 webhook 도 skip → **양쪽 미차감 = 플랫폼 미수**(쇼핑탭 숨김이라 라이브 손실 ≈0 — 재오픈 시 지뢰). sql-bind 가드는 bind-보유 체인의 개수 불일치만 분석해 bind 통째 누락은 사각지대. **수정: `.bind(orderNumber)` 1줄 + 주석** — 차감 로직/CAS/금액검증 전부 불변. (동반 비잠금: `gifts.routes.ts` confirm 에 status CAS — 알림톡 중복 제거, Toss 멱등이라 머니 영향 원래 0.) ⚠️ 쇼핑 재오픈 staging 검증 항목에 혼합결제 딜 차감 포함할 것.
- 2026-07-01 `[UNLOCK]` `payment.routes.ts` `/confirm` + `webhook.routes.ts` **가상계좌(무통장입금) 조기확정 방어** (대표 AskUserQuestion 승인 "#1 방어 가드 적용" — 결제 토스 전수조사). **배경(가드 미보유 영역·외부 PG 실응답)**: `/confirm` 이 Toss 승인 응답의 `status` 를 안 보고 무조건 `DONE` 으로 flip → 가상계좌는 confirm 시점 `status='WAITING_FOR_DEPOSIT'`(입금 전)로 응답하는데 그대로 **주문확정·재고차감·딜차감·디지털발급·KT교환권 발송이 '입금 전'에 실행**되는 구조적 위험(현재 콘솔 VA 활성 여부 불명 — `/confirm` 에 WAITING 분기가 아예 없던 것으로 보아 비활성 추정이나, 코드 가드 부재라 콘솔에서 VA 켜는 순간 조용히 깨짐). 추가로 webhook `handleVirtualAccountDeposited` 가 `env` 미전달(구 line 961)이라 **실제 입금 시 env-gated KT-Alpha 교환권 자동발송이 스킵**되던 비대칭. **수정(방어 가드 + 배선만)**: ① `/confirm` 의 tossData 금액재검증 직후 `status==='WAITING_FOR_DEPOSIT'` 이면 확정하지 않고 `orders.status='AWAITING_PAYMENT'`(status CAS `NOT IN` 종결상태) 로만 표시 + payment_method/toss_payment_key/toss_order_id 저장 + `releaseStays()`(미결제 방 홀드 방지, 실패경로와 동일) 후 멱등 성공 반환 → 실제 입금 시 DEPOSIT_CALLBACK webhook(`handlePaymentConfirmed`)이 완결. **WAITING_FOR_DEPOSIT 한정 분기 — 카드/간편결제(status='DONE') 경로는 byte-불변.** ② `handleVirtualAccountDeposited` 에 `env?: Env` 파라미터 추가 + 2개 호출부(`DEPOSIT_CALLBACK`/legacy `virtual_account_deposited`)에서 `c.env` 전달 → `handlePaymentConfirmed(…, DB, env)` 로 forward(카드 /confirm 과 동일하게 입금 시 KT 발송). **⚠️ Toss 시그니처/금액검증(strict `totalAmount!==amount`)/confirmTossPayment/confirmClaim CAS/confirmPaymentAtomic/재고·딜차감·커미션 전부 byte-불변 — VA 방어 1분기 + env 배선만.** 검증: sql-bind/column(UPDATE 컬럼 전부 orders 존재 확인)/CHECK 제약 가드 0 (⚠️ 이 원격환경 npm 조직정책 403 으로 `npm run build`·전체 tsc 미실행 — 잠금파일 회귀검증은 staging 배포 후 필수). ⚠️ **staging 실결제 검증**: 가상계좌 결제 → 입금 전엔 주문 AWAITING_PAYMENT(재고/딜/교환권 미실행) + 입금완료 webhook 후 확정·KT발송 1회. 롤백: `/confirm` WAITING 분기 제거 + `handleVirtualAccountDeposited` env 파라미터/전달 3곳 환원.
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
| `src/features/auth/api/kakao.routes.ts` | `issueLinkedRoleTokens` 응답에 `seller.username` 포함 | localStorage `seller_username` 누락 |
| `src/pages/KakaoCallbackPage.tsx` | `seller_username` localStorage 저장 + admin/agency 토큰 있을 때 user_type 보존 | 이중 로그인 race |
| `src/worker/routes/repair-schema.routes.ts` | `backfill: sellers.linked_user_id (same-email)` UPDATE | 시드 데이터 정정 못 함 |
| `index.html` | preload `crossOrigin` 속성 없음 (same-origin) | preload mismatch → 200-500ms 손해 |
| `index.html` | Speculation Rules prerender 대상 (`/group-buy/*`, `/products/*`, `/live/*`) | 카드 클릭 후 prerender 효과 X |
| `index.html` | preconnect (`firebasestorage.googleapis.com` 등) | DNS+TLS 100-200ms 손해 |
| ~~`src/App.tsx`~~ | ~~`MainHomePage` eager `import` (lazy X)~~ → **2026-07-29 폐기**: 홈이 `HomeRoute`(PC=`PcHomePage` / 모바일=`RestaurantMapPage`, **둘 다 lazy**)로 바뀌면서 `MainHomePage` 는 참조 0인 죽은 파일이 됐다. 이 행을 그대로 따르면 **죽은 컴포넌트를 eager import 로 되살리게 된다.** 현재 홈 lazy 는 App.tsx:46 이 명시한 의도적 트레이드오프(카카오 SDK async 로드라 청크 페치가 가려짐) | (해당 없음) |
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
- 2026-08-09 `[UNLOCK_LOADING]` `worker/index.ts` **몰 상품 OG(buildMallMeta) 배선 + 몰별 네이버 확인 메타** (사용자 "A-4 다 하자" — 상인회 SaaS 과업① 갭 마감). 잠금표 예외 "새 SSR slot 추가(기존 패턴)"와 동일 클래스의 **메타 rewrite additive**. ① PRODUCT 슬롯 rewrite: payload `mall_id>1` 이면 `wholesale_malls`(`consumer_path=1` 잠금) 1회 조회 + `getGbSessions`→`resolveGbPricing`(몰 화면과 동일 가격) → **buildMallMeta**(세션 ③-a 가 만들고 미배선이던 dead code — 몰 상품 카톡 공유가 본진 일반 카드로 나가던 갭). 몰 미실재/비공개/조회실패는 전부 기존 `buildProductMeta` 폴백(fail-closed — `mall-ssr-meta.test.ts` 배선 3불변식 신설). ② MALL 슬롯 head 에 몰별 `naver-site-verification` 메타 **추가**(사이트 전역 메타 보존 — 값은 어드민에서 영숫자만 저장). **⚠️ SSR inject·0-RTT·`caches.default`·KV read·#root 로더·기존 슬롯 전부 byte-불변 — PRODUCT 블록 내 몰 분기 + MALL head append 만 additive.** 본진 상품(`mall_id`≤1)은 조회 자체가 없어 핫패스 불변. 롤백: PRODUCT 몰 분기 + naver append + import 3줄 제거.
- 2026-08-04 `[UNLOCK_LOADING]` `RouteGuards.tsx` **GLOBAL 전용 `GlobalUserProtectedRoute` 제거** (대표 "1번 하자" — Firebase 클라이언트 전면 삭제). **배경**: 이 컴포넌트는 `useAuthWorld`(Firebase 스토어)를 `require()` 로 끌어와 `lastLoginUid` 흔적이 있으면 최대 3초 대기하던 **글로벌 전용** 분기다. 주석 그대로 *"한국에서는 절대 실행 안 됨"* 이고, GLOBAL 은 미런칭·폐기(#804). **수정**: `isKorea()` 분기 아래 fall-through 를 `<Navigate to={makeLoginUrl(...)}/>` 로 대체하고 컴포넌트·`AuthWorldState` 타입·`firebase/auth` 타입 import 삭제(291→257줄). **⚠️ 잠금 항목인 `isAdminLoggedIn`/`isUserLoggedIn`/`isSellerLoggedIn` 토큰 존재 검사는 byte-불변** — 위 KR 분기가 그대로 그 함수들을 쓴다(admin↔user 이중 로그인 자동 로그아웃 회귀 방지 유지). 검증: tsc 0 · build 0 · vitest 5056 pass · audit-gate ALL GREEN 88 · critical-chunks 17 불변. 롤백: 컴포넌트 복원 + `useAuthWorld` 복원(현재 삭제됨).
- 2026-08-01 `[UNLOCK]` `webhook.routes.ts` `handlePaymentFailed` **결제 실패 → 구매자 인앱 알림 배선** (대표 `AskUserQuestion` 승인 "지금 수정" — 세션 ③-c, 릴리즈 체크리스트 C5). **배경**: 결제 **실패** 시 구매자 알림함이 **0건**이었다. 같은 핸들러의 `sendOrderNotification` 은 이름과 달리 **Discord 임베드 전용**(운영 채널)이고 어드민 벨은 대표만 본다 — **비동기 실패는 화면이 없어서**(브라우저를 닫았거나 앱을 벗어난 경우) 소비자가 자기 결제가 왜 실패했는지 **영영 모른다**. 2026-07-01 에 `handlePaymentCancelled` 에 넣은 buyer 알림과 **정확히 대칭인 누락**. **수정(side-effect 1블록 추가)**: `sendOrderNotification('failed')` 직후 `orders.user_id` 조회 → `notifyUser(env.DB, userId, 'payment_failed', '결제가 완료되지 않았습니다', '주문 N 결제가 실패했습니다.(사유) 장바구니에서 다시 시도할 수 있습니다', '/my-orders')`. 실패 사유(`data.failureMessage`)를 **그대로 옮긴다** — "실패했습니다"만 보내면 소비자가 할 수 있는 게 없다. **⚠️ Toss 시그니처/금액검증/`updateStatus`(내부 CAS)/2026-07-02 재고복원 게이트/어드민 벨 전부 byte-불변 — `notifyUser` side-effect 1블록만.** **fail-soft**: `.catch(() => {})` + 바깥 try — 알림 실패가 webhook 을 실패시키면 Toss 재시도 폭풍이 난다. 검증: 3655 pass·tsc 0·build 0·sql-bind/column/CHECK 제약 0. ⚠️ **되돌려-검증 교훈 2건**: ① *"실패 사유 전달"* 판정을 핸들러 전체에서 `failureMessage` 검색으로 했더니 **`cancel_reason` 이 이미 쓰고 있어** 늘 통과 ② fail-soft 판정 정규식 `notifyUser\([\s\S]*?\)\.catch\(` 이 **뒤쪽의 다른 `.catch(`** 에 걸려 늘 통과 → 둘 다 **알림 블록으로 앵커**해 red 확인. 롤백: 그 블록 제거.
- 2026-08-01 `[UNLOCK_LOADING]` `worker/index.ts` **운영자 몰 MALL SSR 슬롯 + OG 메타 rewrite 신설** (세션 ③-a, 대표 UX 기준 ② *"OG 메타가 곧 매대다"*). 잠금표 **예외 절 "새 페이지 / 새 SSR slot 추가(기존 4페이지 inject 패턴 따라)"** 에 해당 — DETAIL/PRODUCT/CURATOR 와 **동일 additive 패턴**. **배경**: `urdeal.kr/{슬러그}` 몰 링크가 카톡방에 붙을 때 미리보기가 **유어딜 제네릭 홈**으로 뜬다(CURATOR/BLOGPOST 만 메타 rewrite 보유). 잘못 나간 카드는 카카오 스크랩 캐시에 **박제**되고 회수 시점의 통제권이 우리에게 없다. **수정(additive 2블록)**: ① 슬롯 매처 **가장 마지막**에 `MALL` 추가 — 🔴 `isMallLookupCandidate`(예약어+문법 사전필터)를 통과한 1-세그먼트만. 기존 소비자 경로는 **전부 예약어라 이 분기에 도달조차 안 하고 self-fetch 도 안 생긴다**(핫패스 불변). ② 서빙경로 HTMLRewriter 에 `ssrSlot==='MALL' && ssrPayload` 메타 블록(title=`{몰 이름} - 공동구매`, og/twitter/canonical). **payload 없으면 기본 메타 그대로**(fail-soft — 추측해서 박제하지 않는다). **⚠️ SSR inject(`__SSR_INITIAL_*`)·0-RTT·`caches.default` read·#root 정적 로더·기존 슬롯 전부 byte-불변 — 매처 마지막 분기 + 메타 rewrite 만 additive.** 배선 불변식 3건을 테스트로 고정(`mall-ssr-meta.test.ts`: 후보 필터 존재 · 기존 슬롯보다 뒤 · payload 가드). ⚠️ **되돌려-검증 교훈**: 첫 판정이 텍스트 근접검사라 `if` 에서 필터를 빼도 **위 설명 주석에 남은 이름 때문에 초록**이 떴다(`check-lock-table-symbols` 가 경고한 *"주석에만 남아도 통과"* 와 동일 함정) → **주석 제거 후 조건문 자체를 검사**하도록 고쳐 red 확인. 검증: 3600 pass·tsc 0·build 0·loader-continuity 14 GREEN. 롤백: 매처 else 분기 + 메타 블록 + import 제거.
- 2026-07-03 `[UNLOCK_LOADING]` `KakaoAuthService.ts` `upsertUser` **가입 시 링크샵 핸들 즉시 발급** (대표 승인 "잠금 해제하고 직접 수정 · 1~4번 전부 · 가장 이상적으로" — 웨지 전환 깔때기 토대). **배경**: 신규 유저 링크샵(`/u/{handle}`)이 가입 시가 아니라 **첫 핀/큐레이터 접속 때 lazy 생성**(`curator.routes.ts:409·793`)이라 대다수 신규 유저가 handle-less → "당신은 이미 쇼핑몰이 있어요" 자산이 구매 넛지 시점에 준비 안 됨. **수정(additive, isNewUser 분기)**: INSERT 직후 email_verified 갱신 옆에 `generateUniqueHandle`(SSOT `handle-generator.ts` 재사용, worker util 상대경로 import) 호출 → `UPDATE users SET handle=? WHERE id=? AND (handle IS NULL OR handle='')`. 신규 유저는 handle 확정적 NULL 이라 조회 왕복 0(UPDATE 1회), best-effort(실패/컬럼부재 시 기존 lazy backfill 이 커버). **⚠️ same-email 셀러 auto-link(LOWER 매칭·verified 게이트·COUNT≤1 모호성 보류)·email takeover 방어·kakao_id UNIQUE·프로필 보존 UPDATE 전부 byte-불변 — 신규 유저 handle UPDATE 1블록만.** (동반 비잠금: ① `PointsChargeSuccessPage.tsx` 충전완료 → '지금 이용권 사러 가기'(`/vouchers`) primary CTA 추가 — 딜포인트 float→spend 소진 유인(락인 강화), 가짜 보너스 없음(2026-05-22 대표 방침 준수), '딜 부족→충전' 복귀루프면 미노출. ② `group-buy-voucher.routes.ts` `/:code/use` **부정사용 방어** — store_code 모드 + `store_verify_pin` 미설정 상품은 무인증+PIN-null CAS 로 코드만 알면 소각되던 갭을, 제출값이 매장 확인코드와 일치할 때만 허용(소비자 self-redeem 경로는 이미 모드 강제). ③ 신규 `src/pages/payment-success/SellerConversionNudge.tsx`.) 검증: audit-gate 42 GREEN·file-size 래칫 rebaseline(group-buy-voucher 690→711, +admin-products 1429→1494 는 선행 세션 미갱신 드리프트 sync)·⚠️ npm 403 으로 tsc/build 미실행(staging 필요). 롤백: isNewUser handle 블록 + import 제거.
- 2026-07-29 `[UNLOCK_LOADING]` `worker/index.ts` **별칭 경로 서버 301(7개)** + **소비자 정적 표면 메타 전면 확장(30개 라우트 전수 실측)** (대표 "쭉 순서대로 진행해봐"). **배경(실측 — 공개 소비자 라우트 30개 전수 curl)**: **30개 전부** 동일한 홈 메타 + `index, follow` + canonical 없음. 원인 2종. ① **`App.tsx` 에 `<Navigate>` 로만 존재하는 별칭 경로 7개**(`/group-buy`→`/` · `/restaurant-map`→`/map` · `/terms-of-service`→`/terms` · `/privacy-policy`→`/privacy` · `/refund-policy`→`/refund` · `/shipping-policy`→`/refund` · `/product/:id`→`/products/:id`)가 서버에서 200+색인가능 → **크롤러에겐 홈 복제본 7개**. 클라 리다이렉트는 JS 를 돌리는 방문자에게만 통한다. ② 콘텐츠 표면 다수가 클라 `<SEO>` 만 갖고 서버 메타가 없어 비-JS 크롤러엔 홈 메타(`/search`·`/gb-market` 은 클라가 **noindex 선언인데 서빙 HTML 은 `index, follow`** — 색인 제외가 무효였다). **수정**: ① 워커 진입부(블로그 슬러그 301 바로 뒤)에 `resolveConsumerAlias`(신규 SSOT `shared/seo/consumer-redirects.ts`) 301 — **SPA 내부 이동은 서버를 안 타므로 `App.tsx` 의 `<Navigate>` 는 그대로 둔다**(지우면 앱 안에서 갈 곳이 없어진다). ② `CONSUMER_SURFACE_SEO` 를 16개 표면으로 확장(`/stays`·`/meal-vouchers`·`/experience`·`/new-openings`·`/business`·`/influencer`·`/influencer/rankings`·`/introduce`·`/join`·`/terms`·`/privacy`·`/refund`·`/faq`·`/gdpr` + noindex `/search`·`/gb-market`) + `ConsumerSurfaceSeo.noindex` 신설. **문구는 각 페이지 `<SEO>` 가 쓰던 것을 그대로 옮겨 사용자 노출 변화 0**, 그리고 **그 페이지 17곳이 이제 같은 표를 읽는다**(i18n 페이지는 `t(key,{defaultValue: 표})` 형태라 다국어 유지). 짝수정: `RefundPolicyPage` 의 `url="/refund-policy"` → `/refund`(전자가 이제 301 별칭이라 canonical 이 리다이렉트를 가리키고 있었다). **⚠️ SSR inject·0-RTT·`caches.default`·#root 로더·구 도메인 301 블록 전부 불변 — 진입부 301 1블록 + head rewrite 확장만.** 검증: tsc 0 · build 0 · vitest 3350 pass(신규 `consumer-redirects` 10 — **App.tsx 를 읽어 별칭↔라우트 대조**, 표-배선 드리프트 가드 18) · audit-gate **ALL GREEN 75**. 🐛 **테스트가 내 버그를 잡았다**: `/faq` 를 페이지에 배선해 놓고 표 항목을 빠뜨려 런타임 크래시(`undefined.title`) 직전이었다 — 배선 가드가 없었으면 FAQ 페이지가 배포됐을 것. ⚠️ **HTMLRewriter 배선은 여전히 단위테스트 밖**이고 Pages 프리뷰(`*.pages.dev`)는 이 환경 이그레스 정책이 403 으로 막아 검증 못 했다 → 배포 후 curl 이 유일한 판정(handoff). 롤백: 진입부 alias 블록 + 표 확장분 제거(페이지 배선은 표가 남아 있으면 무해).
- 2026-07-29 `[UNLOCK_LOADING]` `worker/index.ts` **사라진 엔티티 = HTTP 404 + noindex** · **교환권 색인 우회 차단**(sitemap↔`buildProductMeta`) · **랜딩 4종 서버 메타** (대표 "가장 이상적으로 진행해줘. 모두 다"). **배경(실측)**: ① `/group-buy/99999999` 가 **200 + 제네릭 홈 메타 + `robots: index, follow`** — 워커 자신의 SSR self-fetch 는 그 순간 404 를 받고도(`X-SSR-Status: DETAIL:self-fetch-404`) 신호를 안 썼다. sitemap 이 상세 URL 을 제출하고 상품은 내려가므로 내려갈 때마다 "홈과 동일한 색인 가능 URL" 이 생기는 구조(soft-404 — 에러가 없어 안 보인다). ② **같은 교환권 상품이 두 URL 로 갈려 한쪽만 noindex** — id 2192 가 `/vouchers/2192` 에선 `noindex, follow`(2026-07-07 결정)인데 `/products/2192` 에선 `index, follow` 였고 **sitemap 이 후자를 500건 제출**(제출분 ~485건이 KT-Alpha 기프티콘 — `seller_id` 없음·`bizimg.giftishow.com`·카테고리 '피자/치킨/용역서비스' 라 기존 `category NOT IN (*_voucher)` 조건을 전부 통과. 소비자 쇼핑 카탈로그엔 15건뿐). 즉 교환권 색인 제외 결정이 **다른 URL 로 우회**되고 있었다. ③ 랜딩 4종(`/about`·`/creators`·`/creators/apply`·`/partners`)이 sitemap priority 0.6~0.85 로 제출되는데 서버 메타는 제네릭 홈(클라 `<SEO>` 는 JS 렌더 후라 Yeti 미도달). **수정**: ① `shouldNoindexMissingEntity(slot, ssrStatus)`(`utils/surface-ssr-meta`) — 엔티티 슬롯(DETAIL/PRODUCT/STAYDETAIL/SELLER/CURATOR/BLOGPOST)이 **`self-fetch-404` 일 때만** noindex + **HTTP 404 응답**(본문은 SPA 셸 그대로 → 클라가 "없는 상품" 화면 정상 렌더). ⚠️ **타임아웃(`self-fetch-timeout`)은 절대 제외** — "느리다"는 "없다"가 아니고 콜드 콜로에서 흔해, 포함하면 멀쩡한 상품이 색인에서 빠지는 더 큰 사고. 목록 슬롯(MAIN/VOUCHERS/BROWSE/BLOG)도 제외(API 404 여도 페이지는 유효). ② `sitemap.routes.ts` 상품 쿼리에 `COALESCE(deal_only,0)=0` + `detail-ssr-meta.buildProductMeta` 의 `noindex: false` → `noindex: isDeal` — **두 경로가 일치**. ③ 랜딩 4종을 `CONSUMER_SURFACE_SEO`(SSOT)에 편입하고 **그 페이지들의 `<SEO>` 도 같은 표를 읽게** 배선(문구가 두 벌이 되면 반드시 갈라진다 — 그게 이 파일의 존재 이유). **⚠️ SSR inject·0-RTT·`caches.default`·#root 로더·edgeCache·정적 자산 경로(청크 404 자가복구) 전부 불변 — 판정 근거는 우리 API 의 404 뿐.** 동반(비잠금): 유어애즈 `influencer-auto-collect.ts` 602줄(main 에서 이미 audit-gate RED)을 `influencer-keyword-store.ts` 분리로 528줄 — 이동만·로직 byte-불변·재수출로 호출부 무수정. 검증: tsc 0 · build 0 · vitest 3322 pass(신규 SEO 36) · **audit-gate ALL GREEN 75**. ⚠️ 배포 후 판정: `curl -o /dev/null -w '%{http_code}' /group-buy/99999999` → 404 · `/products/2192` robots → noindex · sitemap `/products` 건수 500→15 안팎. 롤백: `entityGone` 3블록 + sitemap `deal_only` 조건 + `noindex: isDeal` 제거.
- 2026-07-29 `[UNLOCK_LOADING]` `worker/index.ts` **정적 소비자 표면 + 셀러 링크샵 서버 메타/canonical 신설 + rewrite 체인 통일** (대표 "소비자 쪽 성능·SEO·UX 점검" → "모두 진행" — 라이브 실측). **배경(실측)**: 서버 메타 rewrite 가 **상세 슬롯에만** 있어(DETAIL·PRODUCT·BLOGPOST·CURATOR·WHOLESALE) ① `/`·`/vouchers`·`/browse` 가 **홈 메타를 그대로 서빙**(title/description 3개 동일 · `og:url` 전부 `https://urdeal.kr` · **canonical 없음**)인데 sitemap 은 뒤 둘을 priority 0.9 로 제출 → 비-JS 크롤러엔 홈의 중복 3장 ② `/s/:username` 도 같은 상태(`/u/:handle` 만 2026-07-01 에 개인화 — 같은 링크샵인데 URL 형태로 갈림). 클라 `<SEO>`(react-helmet)는 JS 렌더 후라 네이버 Yeti 가 못 본다(SEO.tsx 2026-07-28 주석의 실측과 동일 구조). **수정(additive)**: ① `!isWholesaleSurface && !needsRootBlank` 에서 `resolveConsumerSurfaceSeo(pathname, search, origin)`(신규 SSOT `shared/seo/consumer-surfaces.ts`) 결과가 있으면 head rewrite — ⚠️ **ssrSlot 이 아니라 pathname 으로 판정**(`/vouchers?category=…` 는 슬롯 조건 `!url.search` 에 안 걸려 ssrSlot 이 'MAIN' 이지만 메타는 교환권 것이어야 함, sitemap 이 실제로 제출) ② SELLER 슬롯에 `buildSellerSurfaceMeta`(신규 `utils/surface-ssr-meta.ts`) 배선. **동반 리팩토링(출력 불변)**: DETAIL/STAYDETAIL/PRODUCT/CURATOR 의 **동일한 `.on()` 체인 4벌**을 `applySurfaceMeta` 하나로 통일(셀렉터·순서·값 동일, canonical 만 속성 이스케이프 추가) → `worker/index.ts` 2620→2591줄(파일크기 래칫 준수). **⚠️ SSR inject(`__SSR_INITIAL_*`)·0-RTT·`caches.default` read·#root 정적 로더·edgeCache·HOT_PATHS 전부 byte-불변 — head rewrite 만 additive.** 검증: tsc 0 · 전체 build 0 · vitest 3305 pass(신규 `consumer-surface-seo` 17 + `surface-ssr-meta` 11, 되돌려-검증으로 빨강 확인) · audit-gate 74 GREEN(잔여 RED 1건은 main 선재 — 유어애즈 `influencer-auto-collect.ts` 602줄). ⚠️ **HTMLRewriter 는 Workers 런타임 전용이라 배선 회귀는 단위테스트로 못 막는다 — 배포 후 `curl https://urdeal.kr/vouchers | grep canonical` 이 유일한 판정**(handoff 에 명령 기재). 롤백: 두 rewrite 블록 제거(통일 리팩토링은 출력 불변이라 유지 무해).
- 2026-07-29 `[UNLOCK_LOADING]` `VouchersPage.tsx` **브랜드 칩 원본 이미지 → cfImage + CLS 자리예약** (같은 점검). **배경(실측)**: 브랜드 칩을 `w-8 h-8`(32×32)로 렌더하면서 `<img src={b.brand_icon_url}>` 를 **cfImage 없이** 직접 사용 — 1장 실측 **176,870B → 자체 cdn-cgi 경유 5,261B**(`cf-resized: internal=ok`, 33배), 칩 82개라 전량 스크롤 시 ~1.8MB↔~80KB. `cf-image.ts` 는 2026-07-13 에 giftishow 를 `CDN_CGI_VERIFIED` 로 되돌려 놨는데 **이 자리만 안 쓰고 있었다**(같은 파일의 상품 카드 `vouchers/shared.tsx` 는 정상 사용). 추가로 `/vouchers` **CLS 0.188** 실측 — 카테고리 칩 행(50px)+브랜드 스트립(113px)이 `/api/vouchers/categories` 응답 후 삽입되는데 상품 목록은 SSR 시드로 먼저 그려져 **목록을 아래로 밀어냄**(첫 방문 한정 — 재방문은 localStorage 캐시로 즉시). **수정**: PC/모바일에 **중복돼 있던 칩 마크업 2벌**을 `vouchers/shared.tsx` 의 `BrandChip`(memo)으로 추출하면서 `cfImage(width:96)` + `width/height` 명시 · `sectionsReady` 상태로 두 블록의 자리를 **실측 높이만큼** 예약. **⚠️ `__SSR_INITIAL_VOUCHERS__` 즉시소비·default sort `price_low`·VoucherCard/VoucherRow 이미지 속성(width/height/srcSet/lazy/dominant_color)·카테고리/브랜드 선택 동작 전부 불변.** 파일 1040→1028줄(래칫 통과). 롤백: BrandChip 인라인 환원 + sectionsReady 제거.
- 2026-07-21 `[UNLOCK_LOADING]` `cf-image.ts` **네이버 블로그 CDN 핫링크 403 우회 — 워커 프록시 라우팅** (대표 신고 "네이버 사진 안 뜸 403 · 이용권 많음" — 라이브 실측). **원인**: 데모/셀러 이미지의 네이버 블로그 CDN(`postfiles`/`mblogthumb-phinf`/`dthumb-phinf`/`blogfiles`/`blogpfthumb-phinf`.pstatic.net)이 **우리 도메인 referer 요청만 403** 핫링크 차단(실측: no-referer→200, `Referer: urdeal.kr`→403, `Referer: blog.naver.com`→200). `pstatic.net` apex 가 `CDN_CGI_VERIFIED` 라 이 블로그 호스트도 cdn-cgi 직결(`/cdn-cgi/image/…/onerror=redirect/<naver>`)로 갔는데, 리사이저가 페이지 referer(urdeal.kr)를 달고 네이버 fetch → 403 + `onerror=redirect` 폴백도 브라우저가 원본을 우리 도메인 referer 로 재요청 → 또 403 → **사진 영구 안 뜸**. **수정(additive 분기 1개)**: `HOTLINK_BLOCKED_HOSTS`(블로그 CDN 5개) 는 `CDN_CGI_VERIFIED` 체크 **전에** `/api/image/resize` 워커 프록시로 강제 — 워커가 **referer 없이 서버측 fetch → 200**(프록시 폴백 경로, 엣지+R2 썸네일 캐시로 반복비용 0). **네이버 플레이스 CDN(ldb/shop/naverbooking-phinf)·기타 pstatic·giftishow·kt·media.ur-team 전부 cdn-cgi 유지 불변 — 블로그 5호스트만 프록시 리라우팅.** SUPPORTED_HOSTS/EXTERNAL_PROXY_HOSTS/Save-Data 목록 무변경(제거 0). 재적용 불필요 — 렌더 시점 cfImage 가 경로 바꿔 다음 로드에 즉시 표시. 검증: theme/loader-continuity GREEN. 롤백: HOTLINK_BLOCKED_HOSTS 분기 제거.
- 2026-07-20 `[UNLOCK_LOADING]` `worker/index.ts` **쇼핑 상품(`/products/:id` · PRODUCT slot) 서버 메타/OG rewrite 신설** (대표 "카카오 공유 예쁘게 — 가장 이상적으로"). 그간 PRODUCT 슬롯은 `__SSR_INITIAL_PRODUCT__` 데이터만 주입하고 title/OG/JSON-LD 는 index.html 제네릭 홈을 서빙 → 카톡/소셜/네이버가 상품 링크를 "유어딜 홈" 카드로 봄(가장 약한 서버 OG). DETAIL(공구/이용권) 블록과 **동일 additive 패턴**으로 `buildProductMeta`(detail-ssr-meta.ts 순수함수) 결과를 서빙경로 HTMLRewriter 로 주입 — 가격·할인율 description + Product/Offer JSON-LD(딜=원화아님 상품은 offer 가격 생략). **SSR inject(`__SSR_INITIAL_PRODUCT__`)·0-RTT·`caches.default`·#root 정적 로더·edgeCache 전부 불변 — 메타 rewrite만 additive**(DETAIL rewrite 와 대칭). 동반(비잠금): `KakaoShareButton` 카카오 공유를 feed→**commerce 템플릿**(가격 있으면 정가취소선+할인가+할인율배지+버튼2개, 없으면 feed 폴백)으로 승격 + Product/GroupBuyDetail 가격 배선(딜 상품은 '원' 표기 부적합이라 feed 유지). 검증: tsc 0(로컬 tsconfig baseUrl deprecation 1건은 CI 무관 기존 경고)·loader-continuity 14·theme GREEN·file-size rebaseline(정당 additive). 롤백: worker PRODUCT 블록 + import 제거(KakaoShareButton 은 가격 props 미전달 시 기존 feed 동일).
- 2026-07-19 `[UNLOCK_LOADING]` `worker/index.ts` **정적 로더 워드마크 → 대표 확정 로고(urdeal.+로즈 점)** (대표 핸드오프 번들 "Ur Deal 로고 Final" 수령 — "적용할 수 있는 모든걸 적용해줘"). `urdealLoaderHtml` 워드마크 블록을 재작성된 `UrDealLogo`(SSOT — 소문자 `urdeal` + 로즈 원 마침표, Poppins 800·자간 −3.5%, 이전 "UR·DEAL" 이탤릭+▶ 폐기)와 픽셀 동일하게 미러(size34: 점 6.12px/좌 2.72px, `text-[#1A2C42] dark:text-[#FAF7F5]`). **로더 구조(min-h/gap/스윕바)·위상동기(음수 delay)·`ur-loader-breathe/sweep` 클래스·SSR inject·`caches.default` 전부 불변 — 워드마크 마크업 내용만.** Poppins 는 index.html 에서 `&text=urdeal` 6글자 서브셋(~2KB)만 로드(preconnect 2개 추가 — 잠금 예외 '추가 OK', CSP style/font-src 기허용). loader-continuity 14불변식 GREEN. 롤백: 워드마크 블록 환원 + 폰트 링크 3줄 제거.
- 2026-07-19 `[UNLOCK_LOADING]` `worker/index.ts` **(STEP B 추가) 정적 로더 워드마크 잉크 hex 색만 다크 팔레트 이행** — 지시서 §6 일괄 마이그레이션(`#0A0A0A`→`#0F151D` 등, 소비자+셀러 스코프 263파일)의 일부. 로더 마크업/위상동기/SSR inject 구조 불변, 색 리터럴만. loader-continuity 14불변식 GREEN. (동일 일괄분에 Toss 잠금 `PaymentSuccessPage`·`TossWidgetPayPage` 의 다크 hex 도 색만 이행 — 기승인 '색만 [UNLOCK]' 범위.)
- 2026-07-19 `[UNLOCK_LOADING]` `worker/index.ts` **정적 URDEAL 로더 스윕바 색만 브랜드 로즈** (대표 브랜드 컬러 지시서 "로딩 애니메이션까지"). `urdealLoaderHtml` 의 스윕바 클래스 `bg-gray-900 dark:bg-white` → `bg-brand dark:bg-brand`(#E0526B) — React `BrandLoader` 기본/forceDark 스윕과 동일 값으로 로더 연속성 유지(forceLight 대시보드 로더는 중립 유지 — 어드민 무접촉). **SSR inject·caches.default·#root 분기·로더 마크업 구조·위상동기 클래스(ur-loader-*) 전부 byte-불변 — 클래스 색상 1곳만.** loader-continuity 14불변식 GREEN. 롤백: 클래스 1곳 환원.
- 2026-07-13 `[UNLOCK_LOADING]` `ConsumerFrameRails.tsx` **QR 라이브러리 lazy화 — 홈 첫페인트에서 `codes`(18KB) 제거** (대표 "계속 해줘 가장 이상적으로" — 첫방문 JS 다이어트). **배경(진단)**: 홈 modulepreload에 `codes` 청크(qrcode/jsbarcode/html5-qrcode 18KB)가 딸려오는데, 홈(교환권 피드)엔 QR 불필요. 소스 추적: PC 소비자 액자 거터 레일 `ConsumerFrameRails`(홈에도 씌워짐)가 `qrcode.react`를 **static import** → route-chunk-map(생성기가 static `imports`만 폐쇄, `dynamicImports` 제외 — generate-route-chunk-map.mjs:67)이 홈 표면 폐쇄에 `codes` 포함 → PC/모바일 홈 preload에 18KB(모바일은 xl+ 레일 미렌더라 안 쓰는데도). **수정**: `import {QRCodeSVG} from 'qrcode.react'` → `lazy(() => import('qrcode.react'))` (형제 `LinkshopVisitorRails`가 이미 쓰는 검증된 패턴) + QR 사용부에 `<Suspense fallback={84×84 placeholder}>`(레일은 유지, QR만 지연). QR은 장식용 모바일-앱 다운로드 코드라 첫 페인트 비필수. **결과**: 홈 static 폐쇄에서 qrcode 제거 → CI 재빌드 시 route-chunk-map이 `codes`를 홈 preload에서 자동 제외(남은 static qrcode importer는 admin/seller 전용 lazy 라우트뿐 — 홈·엔트리 폐쇄 무관). 렌더 로직·레일 레이아웃·타 청크 불변. 검증: theme·loader-continuity 14불변식 GREEN. ⚠️ 이 환경 npm 403 → 실제 preload 축소는 CI 빌드 후 라이브 실측(`curl / | grep codes` 부재 확인). 롤백: static import 환원.
- 2026-07-13 `[UNLOCK_LOADING]` `cf-image.ts` **giftishow cdn-cgi 이미지 변환 복원 — 홈 첫방문 이미지 가속** (대표 신고 "홈 첫방문 느림" → 라이브 전수 실측 후 대표 승인 "가장 이상적이고 서버 부담 없이"). **배경(실측)**: 홈=교환권 피드라 **첫 화면 이미지 100% `bizimg.giftishow.com`**. 2026-06-17 에 giftishow 가 CF/데이터센터 IP 를 차단해 cdn-cgi 리사이저·워커 프록시 둘 다 524/403 → **raw 강제**(원본 20~86KB, origin TTFB 1~2.4s)로 두었는데, **현재 그 차단이 해제됨** — prod 재실측 5/5 이미지 `cf-resized: internal=ok`(원본→3~12KB, **4~6× 축소**, 2회 재시도 안정). **수정**: `cfImage()` 외부호스트 분기에서 giftishow **raw 조기반환(`if host==giftishow return src`) 제거** + `CDN_CGI_VERIFIED` 에 `giftishow.com` 추가 → `/cdn-cgi/image/…,onerror=redirect/…`(same-origin + 엣지캐시). **서버 부담 0**: Cloudflare 엣지 리사이저 오프로드(워커/D1/origin-반복 무접촉) + 6× 작아져 대역폭↓ + 변환본 엣지캐시(원본은 이미지당 1회만 fetch). **안전판 `onerror=redirect`**: 향후 재차단 시 리사이저 실패→원본 302 폴백(사용자 브라우저 IP 는 미차단이라 raw 로 표시) = 2026-06-17 raw 동작과 동일 → **최악의 경우 다운사이드 0**. `cfSrcSet` 는 `cfImage` 위임이라 자동 상속. **SUPPORTED_HOSTS/EXTERNAL_PROXY_HOSTS·Save-Data·`/api/media` 프록시 분기·타 CDN_CGI_VERIFIED 호스트 전부 불변 — giftishow raw 분기 제거 + 검증목록 1개 추가만.** same-origin cdn-cgi 라 canvas 대표색 추출(2026-06-05 프록시 사유)도 유지. 검증: loader-continuity 14불변식 GREEN·prod 다중샘플 실측(cf-resized internal=ok). ⚠️ 재차단 감지는 `prod-diag.yml` 지속 관측 권장(재발 시 raw 로 자동 폴백이라 안 깨지나 가속 무효화). 롤백: giftishow raw 조기반환 복원 + CDN_CGI_VERIFIED 에서 제거.
- 2026-07-12 `[UNLOCK_LOADING]` **SSR 페이로드 전역(KV) 워밍 — 콜드 콜로 TTFB 마감** (대표 "계속 진행. 이상적으로" — 로딩 전수 최적화의 마지막 레버). **배경(실측)**: `caches.default` 는 **콜로별**이라 cron prewarm 이 다른 지역 콜로엔 안 미침 → 콜드 콜로 하드로드는 워커가 self-fetch(콜드 D1, 0.5~1.5s)를 응답 전에 대기 → HTML TTFB 1.1~1.9s. 진단 중 발견: `CACHE_KV` 는 env 선언·대시보드 안내만 있고 **SSR 경로에서 아무도 KV 를 읽지도 쓰지도 않음**(`useKv:false` 잠금이라 publicCache 도 안 씀 — 바인딩만 해선 no-op). **수정(계층 1개 additive)**: ① `cache-prewarm.ts` — HOT_PATHS 성공 응답 중 **SSR 슬롯 6키만**(`SSR_KV_PATHS`: MAIN/VOUCHERS/BROWSE/LIVE/WHOLESALE/BLOG — worker `ssrTarget.path` 와 byte-일치) `ssr:{path}` 로 KV put(TTL 30분). **💰 KV 비용 잠금 준수: 쓰기는 cron 전용 + 15분 표본화**(`minutes%15<5` — 6키×96창/day=576 writes < 무료 1K) + JSON `"success":true` 검증 + 500KB 캡. ② `worker/index.ts` SSR 읽기에 [edge miss → **KV read** → self-fetch] 계층 — kv-hit 면 self-fetch 생략(콜드 콜로도 ~수십 ms), miss/미바인딩이면 기존 경로 100% 동일. `X-SSR-Status: *:kv-hit` + `Server-Timing: kv;dur=` 로 관측 가능. **잠긴 caches.default read·self-fetch 타임아웃·HTMLRewriter inject·HOT_PATHS 기존 key·`useKv:false` 전부 byte-불변.** 검증: per-file 구문 0·loader-continuity 14 GREEN·sql/머니 가드 무관(비머니). ⚠️ **효과 발생엔 대시보드 1스텝 필요**: Workers & Pages → ur-live → Settings → Bindings → KV `CACHE_KV` 바인딩(미바인딩=현행 동일, 코드 선배포 안전). 롤백: worker KV read 블록 + cron SSR_KV_PATHS put 블록 제거.
- 2026-07-12 `[UNLOCK_LOADING]` **상세/주요 라우트 하드로드 청크 병렬화 — 워커 modulepreload 주입** (대표 "/group-buy/2609 이용권 페이지 로딩 아쉬워" — 라이브 실측 진단). **배경(실측)**: 하드로드 타임라인 [HTML 1.6s → 로더 1.2s → 콘텐츠 2.8s]에서 데이터(SSR 시드)·히어로(preload 1.6s 완료)는 이미 이상적, 로더 구간의 대부분이 **lazy 페이지 청크 직렬 다운로드**(엔트리 실행 후에야 import 발견) 였음. **수정**: ① `vite.config.ts` `build.manifest: true`(additive — manualChunks 불변). ② 신규 `scripts/generate-route-chunk-map.mjs`(build:worker 체인 선두) — manifest 에서 7개 표면(home/gbDetail/voucherDetail/product/linkshop/vouchers/browse)의 페이지 청크 import 폐쇄 − 엔트리 폐쇄를 `src/worker/generated/route-chunk-map.ts`(산출물, 커밋본=빈 맵)로 출력(캡 js10/css4, 같은 빌드 해시와 항상 일치). ③ `worker/index.ts` head 주입: 표면 매칭 시 `<link rel="modulepreload" crossorigin>`(js)+`<link rel="preload" as="style">`(css) — 엔트리와 **병렬** 다운로드. 빈 맵/미등재 표면은 조용히 생략(graceful — 로컬 워커 단독 빌드 안전). **SSR inject/캐시/#root 로더/히어로 preload/모든 기존 잠금 항목 byte-불변 — head 링크 additive 만.** 검증: 생성기 합성 manifest 유닛 검증(엔트리 폐쇄 제외·전이 imports 포함 확인)·loader-continuity 13 GREEN·file-size rebaseline. ⚠️ 이 환경 npm 403 — 실제 manifest 생성/주입은 CI 빌드에서 첫 실행(배포 후 라이브 실측으로 로더 구간 단축 확인 필수). 롤백: package.json 체인에서 생성기 제거 + worker chunkSurface/주입 블록 제거 + vite manifest 플래그 제거(맵은 빈 파일로 무해).
- 2026-07-11 `[UNLOCK_LOADING]` **사업자 링크샵 1-RTT 화 — curator 응답에 linked_seller_public 동봉** (대표 "남은 개선 여지 진행, 가장 이상적으로" — 07-10 전수조사의 마지막 선택 항목). **배경**: `/u/:handle` 사업자는 [curator fetch → SellerPublicPage lazy 청크 → seller `/public` fetch] 구조라, 07-10 in-flight 겹침(seller-public-fetch)으로 완화해도 **왕복 2회가 구조적으로 남음**. **수정**: ① `seller.routes.ts` GET `/:id/public` 본문(자가치유 SELECT + KV 300s 캐시 + curator_handle/business_info enrich)을 `worker/utils/seller-public-payload.ts` `buildSellerPublicPayload` 로 **그대로 추출(SSOT, 로직 byte-동일)** — 라우트는 위임. ② `curator.routes.ts` GET `/:handle` 이 linkedSeller 존재 시 같은 함수로 **`linked_seller_public` additive 동봉**(fail-soft null — 클라 폴백 fetch). SSR CURATOR 슬롯/edge 캐시에 그대로 실려 **하드로드는 셀러 데이터까지 0-RTT**. ③ 클라: `CuratorPageResponse.linked_seller_public` 타입 + CuratorPage 가 `sellerSeed` prop 전달(동봉 있으면 warmSellerPublic 스킵 — 구캐시 응답(≤900s) 동안은 기존 warm 폴백 유지 = 점진 롤아웃 호환) + `SellerPublicPage` 가 `matchSellerSeedProp`(정체성 id/username 검증)으로 **동기 소비 → 셀러 fetch 생략**(SSR SELLER 시드와 동급, sub-data(상품) fetch 는 기존대로 병렬). **영구 가드**: loader-continuity 12·13번째 불변식(서버 동봉 + 클라 소비 쌍 — 한쪽만 빠져도 조용한 2-RTT 회귀라 가드 필수). **owner-fresh(no-store)/익명 edge 캐시/OG rewrite/소유권 신호(ownerOverride) 전부 불변.** 동반(하이진): CLAUDE.md 에 커밋돼 있던 머지 충돌 마커 3줄 제거(양쪽 07-10 항목 보존). 검증: loader-continuity 13 GREEN·linkshop-ownership GREEN·sql bind/column/table 0·file-size rebaseline(정당 성장). ⚠️ 이 환경 npm 403 — build/vitest 는 CI. 롤백: curator.routes 동봉 블록+응답 필드 제거(클라는 폴백 fetch 로 자동 복원) → 이후 클라 prop 제거.
- 2026-07-10 `[UNLOCK_LOADING]` **로딩 전수조사 — 불필요 로딩 화면 일괄 수리** (대표 "철저한 전수조사" + AskUserQuestion "전부 수정" 승인). 3축 병렬 감사(워커 첫페인트/소비자 페이지/가드·대시보드) 후 검증된 결함만 수리. **① prefetch 무효 2건(최대 체감)**: `usePrefetchProduct` 키를 `String(id)` 정규화 — 카드(숫자 id) prefetch `['product',123]` vs 상세(useParams 문자) `['product','123']` 불일치로 **항상 캐시 미스**(쇼핑 카드 탭마다 풀 로더+중복 왕복); `VouchersPage` 카드(VoucherCard/VoucherRow) prefetch 를 `usePrefetchProduct`(→`/api/products/:id`) → `usePrefetchGroupBuyProduct`(→`/api/group-buy/products/:id`, groupBuyProduct 키) — 목적지 `/vouchers/:id`(VoucherDetailPage fetchQuery)와 **엔드포인트·키 둘 다 달라 prefetch 100% 낭비**였음. **② 홈 SSR 소비**: `useMapProducts` 가 `__SSR_INITIAL_MAIN__`(서버 기본 status=active 라 클라 page1 과 동일 페이로드)을 category='all' 1회 동기 시드(50개면 page2 이어받아 성장) — App.tsx:46 의 "홈 SSR 미소비" 트레이드오프 해소(홈 첫 페인트 리스트 스켈레톤 제거). **③ 시드 동기 소비 3곳**: `BrowsePage`(readBrowseSeed)·`VoucherDetailPage`(pickSeedDetail 재사용)·`SellerPublicPage`(readSellerSeed) — useEffect(페인트 후) 소비라 시드 있어도 로더 1프레임 뜨던 것을 useState 초기값으로(형제 GroupBuyDetail/GroupBuyList/Vouchers 와 정렬). SellerPublicPage 는 **정체성(id/username) 일치 검증 신설**(SPA 로 다른 셀러 이동 시 이전 하드로드 시드 오소비 잠재버그 수리). **④ 사업자 링크샵 워터폴**: 신규 `seller-public/seller-public-fetch.ts`(in-flight 공유) — CuratorPage 가 linked_seller 확인 즉시 셀러 `/public` warm, SellerPublicPage 가 이어받아 [curator→청크→seller] 직렬을 [curator→max(청크,seller)]로. **⑤ 워커**: `/group-buy` GROUPBUY 슬롯 제거(라우트가 `/` 리다이렉트·유일 소비자 GroupBuyListPage 미라우팅 — 콜드 1.5s self-fetch 순수 낭비) + 데드 변수 `isLinkshopSurface`/`isDetailSurface` 제거(07-07 catch-all 로 대체된 잔재). **⑥ 대시보드 로더 색 정합**: `BrandLoader` 에 `forceLight`/`forceDark` prop 추가, App.tsx Suspense fallback 을 `/seller|/admin|/agency|/ads` 에서 라이트 `DashboardLoader`(#F4F5F7) — [라이트 placeholder→다크 로더→라이트 대시보드] 색 점프 제거(도매 WholesaleLoader 와 동일 정합). **⑦ 바운스 전 오화면 플래시**: `SellerLayout` 도매전용 판정(`/api/seller/surface`) 대기 중 라이트 로더(기존: 셀러 대시보드 풀렌더 후 /wholesale 튕김 — 조건/세션캐시/fail-open 불변); `AdminLayout` 도매 RBAC·PIN 게이트 조건을 렌더 시점 동기 계산(willBounce*) → 해당 프레임 라이트 로더(조건·ALWAYS_ALLOWED 면제 동일 — 06-17 무한루프 방지 로직 불변). **⑧ 로더 전면 통일(07-01 정책 잔존 위반 소탕)**: UMeRedirect("⏳ 텍스트")·Cart·PointsCharge·BlogDetail·Wishlist·Address·Referral·CGB메시지·Register·UserProfile(global)·StayDetail(맨 텍스트, forceDark) 풀스크린 + MyStays·GbMarketplace·MyGroupBuys·MyDealHistory·MyReviews·MyFollows 인라인 → BrandLoader; Supplier 대시보드 본문 텍스트 → WholesaleLoading; RouteGuards RoleTokenSelfHeal 빈 화면(null) → 라이트 BrandLoader(잠긴 토큰검사 불변). **⑨ (후속 — 대표 "로딩→새로고침→다시 로딩" 신고, 라이브 Playwright 재현으로 특정) 쿼리 내비 전체 리마운트 근본수리**: `App.tsx` 페이지 전환 페이드(06-10)의 `key={location.key}`(ErrorBoundary+enter div)가 **쿼리만 바뀌는 setSearchParams 에도 매번 새 key** → 페이지 전체 리마운트+페이드 재생+SSR 시드 미매칭 풀 로더 재등장(라이브 실측: /vouchers 하드로드 시 자동 카테고리 선택이 [콘텐츠 1.9s → 풀 로더 2.3s → 콘텐츠 3.0s] 이중 로딩 — 정렬/브랜드/카테고리 칩 전부 동일 클래스). `key={location.pathname}` 으로 — 실제 경로 이동만 리마운트/페이드, 쿼리 변경은 제자리 갱신(06-05 "화면 비우지 않고 백그라운드 교체" 설계 복원). pageEnterCls 도 pathname-변경 기준(첫 내비가 쿼리-전용일 때 페이드 1회 발화 아티팩트 제거). **오탐 기각**: `/supplier` 라우트 갭(존재함)·홈 "지도 로딩" 스피너(맵 모드 전용). 검증: 로더연속성/테마/initialData/링크샵소유권 가드 GREEN · 파일크기 rebaseline(정당 성장) · audit-gate 45 GREEN. ⚠️ 이 원격환경 npm 403 으로 vite build/vitest 미실행 — CI(verify.yml) 검증 + staging 에서 교환권 카드 탭 즉시표시·홈 첫페인트·겸업 /seller 진입 1회 확인 권장. 롤백: 각 항목 독립(①String 정규화+훅 스왑 ②seed 블록 ③initializer 환원 ④공유모듈+warm effect 제거 ⑤분기 환원 ⑥forceLight prop+fallback 분기 ⑦surfacePending/willBounce 제거 ⑧로더 마크업 환원).
- 2026-07-10 `[UNLOCK_LOADING]` `BottomNav.tsx` 탭2 라벨 **쇼핑→교환권(Gift)** + `VouchersPage.tsx` **일반상품(ShoppingGrid)·쇼핑 스크롤스파이 탭 `SHOPPING_TAB_HIDDEN` 게이트** (대표 지시 2026-07-10 — 콜드스타트 정체성: 일반상품은 기존 '쇼핑 잠정 숨김' 게이트로 숨기고 교환권은 유지, 인플 딜포인트→교환권 구매 경로가 /vouchers 카탈로그에 의존해 숨김 범위는 일반상품 한정). 숨김 시 `/vouchers`=순수 교환권 페이지(탭바 교환권 단일 탭), 플래그 false 로 즉시 복원(가역). 홈(`/`=RestaurantMapPage)은 일반상품 블렌드 없음 확인 — 무수정. **잠긴 `__SSR_INITIAL_VOUCHERS__` 즉시소비·default sort `price_low`·VoucherRow/VoucherCard 이미지 속성·linkshopPath localStorage 우선순위·isActivePath 전부 byte-불변** — 탭 라벨/아이콘 1개 + 게이트 조건 2곳 additive 만. 롤백: BottomNav 탭 정의 1줄(ShoppingBag/nav.shopping 환원) + VouchersPage 게이트 2곳(`!SHOPPING_TAB_HIDDEN` 제거) + feature-flags import 제거.
- 2026-07-07 `[UNLOCK_LOADING]` (후속 — 대표 "응 해야지") **홈 포함 전-라우트 로더 통일 + 재발가드 2종**. ① `worker/index.ts` #root 디폴트를 `else if (!isMainPage)` → **catch-all `else`** 로 확장 → 홈(`/`)도 구운 restaurant-map shell(스켈레톤/0곳) 대신 URDEAL 로더 → 홈의 [shell→로더→콘텐츠] 3단 점프를 [로더→콘텐츠] 2단으로. 홈 shell 은 App.tsx:46 이 명시하듯 `__SSR_INITIAL_MAIN__` 미소비(순수 낭비)라 손실 0. ② `check-loader-continuity.mjs` 불변식 강화/신설: worker catch-all else 로더(+게이트된 로더 mustNot), `useOnlineStatus` SSR-safe(`navigator.onLine === false` 만 offline), `i18n-critical.ts` 홈 above-the-fold 키(restaurantMap.nearMe/sort) 포함 → 오프라인배너·raw키·shell누수 3클래스 영구 회귀차단. 롤백: catch-all `else`→`else if(!isMainPage)` + 신규 가드 3 CHECK 제거.
- 2026-07-07 `[UNLOCK_LOADING]` `worker/index.ts` `#root` **디폴트 차단(홈 shell 누수 근본수정)** + `useOnlineStatus`/`OfflineBanner` SSR-safe + `i18n-critical.ts` restaurantMap 키 (대표 신고 "새로고침 시 잠시 이상한 페이지 / 로딩 중간에 이상한 페이지들 계속 떠" — 전수조사). **배경**: 홈 `/`=`RestaurantMapPage(list)` 라 prerender 된 `#root` 에 동네딜 지도 shell 이 구워지는데, 워커 `#root` 분기가 도매/대시보드/블로그/링크샵/상세만 특례 처리하고 **디폴트(ELSE)를 안 막아** `/vouchers`·`/browse`·`/products/:id`·`/live`·`/search` 등 대부분 소비자 라우트가 하드로드 첫 페인트에 **restaurant-map 홈 shell 을 잠깐 노출**(콘텐츠 점프 + raw i18n 키 + "0곳"). **수정**: ① 로더 마크업을 `urdealLoaderHtml` const 로 추출 + `else if (!isMainPage)` 디폴트 분기 신설 → 홈만 구운 shell 유지, 그 외 HTML 라우트는 링크샵/상세와 **동일 URDEAL 정적 로더**로 통일(`__SSR_INITIAL_*` 는 `<head>` 주입이라 #root 교체와 무관 — 0-RTT 불변). ② `OfflineBanner`: prerender(Node 22)엔 `navigator` 는 있으나 `navigator.onLine`=undefined→falsy 라 오프라인 배너("인터넷 연결이 끊겼습니다")가 정적 HTML 에 구워져 모든 첫 paint 노출 → `=== false` 일 때만 오프라인. ③ 홈 상단 라벨 `restaurantMap.nearMe`/`sort.*` 를 CRITICAL_I18N(6개 언어)에 추가 → full translation.json 도착 전 raw 키 노출 제거. **잠긴 SSR inject 블록·`caches.default` read·needsRootBlank·isBlogSurface·no-cache 헤더 전부 불변 — #root ELSE 분기 1개 + 로더 const 추출만.** 롤백: `!isMainPage` 분기 제거(+ 로더를 linkshop/detail 분기 인라인 환원).
- 2026-07-05 `[UNLOCK_LOADING]` `group-buy-public.routes.ts` 리스트/상세 **prelaunch(오픈 예정형 데모) enrich** (대표 "옵션으로 선택할 수 있게 개발") — fcfs enrich 와 동일 additive 클래스: 메타 쿼리에 `key='prelaunch'` 포함 + 상품/fcfs 객체에 플래그. 캐시키/헤더/기존 필드 불변. 소비자 배지·상세 CTA 분기용. 롤백: 쿼리 OR 1개 + 플래그 2곳 제거.
- 2026-07-04 `[UNLOCK_LOADING]` `group-buy-public.routes.ts` GET /products **데모 이용권 항상 후순위 정렬 + slug/fcfs.demo enrich** (대표 지시 "이용권 노출은 데모 이용권들이 항상 후순위"). ① 모든 정렬(기본/popular/newest/deadline/discount)의 **1차 키 = 데모-후순위**(`CASE WHEN slug LIKE 'demo-deal-%'`) — 실 사업자/플랫폼 상품 먼저, 데모는 뒤 채움. 캐시키/헤더/materialized 키 불변, 응답 행 순서만. ② buildCols 에 `p.slug` additive(+fcfs enrich 에 `demo` 플래그) — 클라 '선착순 상위노출' boost(RestaurantMapPage)가 데모를 안 끌어올리게. 짝 수정: `group-buy-feed-cache.ts` cron 동일 정렬+slug(materialized 파리티) · `fcfs.routes.ts` /active `is_demo`+데모-후순위 · `RestaurantMapPage` boost 를 non-demo 한정. 롤백: DEMO_LAST 프리픽스/slug 2곳/fcfs.demo/boost 분기 제거.
- 2026-07-02 `[UNLOCK_LOADING]` `group-buy-public.routes.ts` GET /products 의 **general(배송형) 카테고리 분기 제거** (대표 확정 "동네딜에는 안 섞는다 — 완전 분리 유지"). 06-17 에 추가된 명시 지원이 어떤 소비자 UI 에서도 미사용(휴면)인 채, 06-30 데모 확장이 배송형 샘플 2종을 시드하는 유입로가 됨(유령 상품 + 쇼핑 상세 혼동 — 대표 신고 2건). 기본 'all' 피드/캐시키/SSR/sort·page·region 분기 전부 불변 — general ternary 1분기만 제거. 동네딜 도구 측(비잠금)도 동시 차단: DEAL_CATEGORY_ALIAS general 계열 제거·수기 폼 '일반' 옵션 제거·기존 시드분 soft-retire heal. **영구 가드 신설**: `scripts/check-dongnedeal-separation.mjs` (audit-gate 42번째 불변식 + verify.yml strict — R1 리스트 API / R2 데모 시드 / R3 alias / R4 수기 폼). 롤백: ternary 환원 + 가드 제거.
- 2026-07-02 `[LOADING_ADDITIVE]` ① `cf-image.ts` 홈 동네딜 피드 이미지 **원본 1MB 다운로드 수리** (대표 신고 "홈 이미지 늦게 뜸" — 라이브 실측). **원인**: 피드 이미지 호스트 `ldb-phinf.pstatic.net`·`naverbooking-phinf.pstatic.net` 이 `-phinf` 형태라 기존 `phinf.pstatic.net` suffix 매칭(`'.'+host`)에 안 걸려 **cfImage 가 원본 그대로 반환** → 300px 카드에 1,055KB/1.6s(실측) 원본 로드(9카드≈9MB). `imgnews.naver.net`·`yt3.googleusercontent.com`·`picsum.photos` 도 미등재. **수정(추가만 — 잠금 예외)**: EXTERNAL_PROXY_HOSTS 에 apex `pstatic.net`(전 서브도메인 커버)+3개 호스트, CDN_CGI_VERIFIED 에 동일 추가(전부 라이브 실측 `cf-resized: internal=ok`, 1,055KB→14KB — 75×), 외부 cdn-cgi 직결 옵션에 **`onerror=redirect`** 부여(리사이저 원본 fetch 실패 시 원본 302 = 현행과 동일 → 06-11 kakaocdn 깨짐 클래스 구조적 차단, 정상경로 무영향 실측). 기존 프록시 경유 pstatic 서브도메인들도 apex 매칭으로 cdn-cgi 승격(프록시는 리사이즈 불가 — 06-11 실측). **목록 제거 0·Save-Data·`/api/media` 분기 불변.** ② `GroupBuyDetailPage.tsx`+`App.tsx` 공구 상세 **이중 로더 제거** (대표 신고 "로딩 애니메이션 2번 끊김" — 06-30 링크샵 수리와 동일 클래스 — 07-01 "로더 전면 통일"의 BrandLoader 를 상세 표면에선 스켈레톤 공유로 대체: 청크→페이지 로더가 별개 인스턴스라 애니메이션 리셋=끊김). PageLoader(로고+스윕바)→페이지 스켈레톤 **비주얼 점프**가 원인 → 스켈레톤을 `pages/group-buy/DetailSkeleton.tsx` 로 추출(byte-동일 JSX), 페이지 `if(loading)` 와 App.tsx `PageLoader` 의 `/group-buy/:id` 분기가 **같은 스켈레톤** 사용 → 청크~데이터 로딩이 한 장으로 이어짐. **CountdownRing/polling/below-fold lazy/`__SSR_INITIAL_DETAIL__` 시드·App.tsx eager import/idle prefetch 전부 불변.** ⚠️ ② 는 같은 날 `2f2f262`(로더 위상동기 — BrandLoader 음수 animation-delay 전역동기 + RQ fetchQuery dedupe + 하드로드 정적 로더 주입, 라이브 진단 기반)로 **대체·롤백됨** — 정적 로더→스켈레톤 점프 방지 위해 위상동기 체계 단일 채택(DetailSkeleton.tsx 삭제). ① cf-image 는 유효. 롤백: 호스트 4줄+CDN_CGI_VERIFIED 4항목+onerror 옵션 제거.
- 2026-07-02 `[UNLOCK_LOADING]` **상세 사진 즉시표시 — pstatic cdn-cgi 검증 추가 + 히어로 preload 주입** (대표 "사진도 빠르게 안 나타나네"). **원인 실측**: 동네딜 실사진(ldb-phinf/shop-phinf/naverbooking-phinf.pstatic.net)이 CDN_CGI_VERIFIED 미등재 → 워커 프록시(리사이즈 불가) 경유 **2.9s·원본 1,055KB**. + 상세 히어로가 CSS background-image 라 프리로드 스캐너 미적용 → [엔트리→청크→렌더] 뒤에야 다운로드 시작. **수정(둘 다 ADD only)**: ① `cf-image.ts` EXTERNAL_PROXY_HOSTS+CDN_CGI_VERIFIED 에 `pstatic.net` 루트 추가 — **prod 실측 3종 전부 `cf-resized: internal=ok`(1,055KB→106KB, 900px)** 룰 절차 준수. ② `worker/index.ts` DETAIL 슬롯 head 에 seed image_url 의 `<link rel=preload as=image fetchpriority=high>` 주입 — **클라와 동일 `cfImage()` 를 워커에서 import**(typeof 가드로 워커 안전)해 URL byte-일치(적중 보장, Save-Data 유저만 quality 차이 미적중 — 히어로 1장 허용). SSR inject/캐시/타 슬롯 불변. 롤백: pstatic 2줄 + preload 블록 + import 제거.
- 2026-07-01 `[UNLOCK_LOADING]` `vite.config.ts` manualChunks **toss-preload 를 'tosspayments' 청크로 분리** (링크샵 로딩 딥다이브 — 라이브 네트워크 실측). **발견**: `src/lib/toss-preload.ts` 는 모듈 평가 즉시 Toss SDK CDN(`js.tosspayments.com/v2/standard`) 다운로드 + 1s 후 `/api/payments/client-key` fetch 를 시작하는 사이드이펙트 모듈인데, `/src/lib/` catch-all 규칙으로 **app-utils(전 페이지 공유 청크)** 에 묶여 링크샵 포함 **모든 페이지**가 결제 SDK 를 로드했음(라이브 실측: `/u/jiwon1228` 방문에 client-key fetch + SDK 로드 발생). **수정(additive 규칙 1줄)**: kakao-sdk/seller-tracking 분리 선례와 동일하게 `id.includes('/src/lib/toss-preload')` → `'tosspayments'` 청크(SDK 와 동거) — import 하는 결제 표면(Checkout/PointsCharge/TossWidgetPay 등)만 로드. **검증**: CuratorPage/SellerPublicPage/app-utils/entry 청크에 tosspayments 참조 0 ✅ · 결제 페이지 청크는 참조 유지 ✅(preload 동작 불변). 기존 manualChunks 항목 제거/약화 0. 롤백: 규칙 1줄 제거.
- 2026-07-01 `[UNLOCK_LOADING]` **공구/교환권 상세 단일 URDEAL 로더 + 로더 위상 전역동기** (대표 신고 "로딩이 2번 나뉘어 + 느림"). ① `worker/index.ts` detail surface `#root` 비움 → 링크샵과 동일 정적 URDEAL 로더 주입(분기 통합 `isLinkshopSurface || isDetailSurface`; blog 는 비움 유지). ② `BrandLoader` 를 `performance.now()` 기반 **음수 animation-delay 전역 위상 동기** — 재마운트([정적 → Suspense 청크 → 페이지 데이터])돼도 호흡/스윕이 같은 위상에서 이어져 **하나의 로더처럼 연속**(이전: keyframe 0 재시작 = 로고 어두워짐+바 사라짐 블링크). 정적 로더의 200ms sweep 지연도 위상 정합 위해 제거. ③ `GroupBuyDetailPage` freshness fetch raw axios → RQ `fetchQuery`(staleTime 60s) — 홈 카드 touch prefetch 의 **in-flight 이어받기**(중복 네트워크 제거·탭 race 로더 노출 반감). SSR inject·`caches.default`·seed 즉시소비(잠금)·폴링 불변. 검증: tsc 0·단위 pass·build 0. 롤백: worker 분기 환원 + BrandLoader delay 2줄 + fetchQuery→axios.
- 2026-07-01 `[UNLOCK_LOADING]` **링크샵 콜드 로딩 단일 URDEAL 로더 통일** (대표 지시 — "콜드 로딩은 풀로, 로딩 중 2~3가지 로딩화면 절대 금지"). **배경**: `/u/` 하드로드가 [worker `#root` blank → CuratorPage 스켈레톤(동그라미 아바타+6칸, 실제 배너-히어로와 모양 불일치) → Suspense fallback 스켈레톤 → SellerPublicPage 헤더+스켈레톤 → 상품 워터폴로 빈 스켈레톤 장기 잔존]으로 **모양이 다른 로더가 2~3번 튐**(라이브 실측: 2.8s 에도 상품 그리드 스켈레톤 안 채워짐). **수정**: 첫 페인트부터 완성까지 **동일 URDEAL BrandLoader** 하나로 — ① `worker/index.ts` `isLinkshopSurface` `#root` 를 비우던 것 → URDEAL 워드마크+호흡+스윕바 static HTML 주입(테마 가변 `dark:` 대응, `ur-loader-breathe/sweep` 번들 CSS, createRoot 마운트 시 교체). detail/blog 는 기존대로 `#root` 비움(분리). ② `CuratorPage` `loading` + linked_seller `Suspense` fallback → `<BrandLoader fullScreen/>`. ③ `SellerPublicPage` `loading`(curator/standalone 공통) → `<BrandLoader fullScreen/>`(기존 헤더+스켈레톤/Loader2 스피너 폐기, Loader2 import 제거). **트레이드오프(대표 승인)**: SSR 즉시-헤더 노출 대신 상품 준비될 때까지 로더 유지 → "로더 → 완성 화면" 단일 흐름. SSR inject(`__SSR_INITIAL_CURATOR__`)·0-RTT·`caches.default`·OG 메타 rewrite·edgeCache 전부 불변(로딩 표면 UI만). 검증: tsc 0·전체 build 0·번들 CSS 클래스/색상 존재 확인·audit-gate 38 GREEN(file-size 는 승인 additive → `[SKIP_SIZE]`). ⚠️ staging: `/u/{handle}` 하드로드 시 로더 1종만 뜨는지 확인. 롤백: `#root` 주입/BrandLoader 3곳 환원. (동반 비잠금: InfoTab 사업자정보 섹션 카드+구분선+인증배지 재디자인 · `verifiedBusiness` 6개 언어.)
- 2026-07-01 `[UNLOCK_LOADING]` `worker/index.ts` **링크샵(`/u/:handle`) 서버측 OG/canonical 주입** (대표 승인 — 라이브 링크샵 전수조사 후 AskUserQuestion "모두 수정"). **배경**: 라이브 실측(`curl https://live.ur-team.com/u/jiwon1228`) — 서빙 HTML 의 `<title>`·og:title·og:description·og:image·og:url 가 전부 **소비자 기본값(제네릭 홈)**. CURATOR SSR 슬롯은 `__SSR_INITIAL_CURATOR__` 데이터만 주입하고 메타 rewrite 는 `WHOLESALE`·`BLOGPOST` 슬롯에만 존재 → 카톡/소셜 공유·비-JS 크롤러가 "정지원 링크샵" 대신 "유어딜 홈" 카드를 봄. 개인화 OG 코드는 실제 안 타는 `app.get('*')` fallback 에만 있어 무효. **수정(additive)**: BLOGPOST 패턴과 동일하게 서빙 경로(HTMLRewriter)에 `ssrSlot === 'CURATOR' && ssrPayload` 블록 추가 — `__SSR_INITIAL_CURATOR__` 페이로드의 `curator{name,bio,handle,profile_image}` 로 title(`{name} 링크샵 - 유어딜`)·description(bio, 폴백 "교환권·이용권 모음" — 폐기어 없음)·og/twitter·og:type=profile·canonical·og:image(profile_image, r2:// 정규화) rewrite. **SSR inject(`__SSR_INITIAL_CURATOR__`)·0-RTT·`caches.default` read·#root 비움·edgeCache(300)·타 슬롯 전부 byte-불변 — 메타 rewrite만 additive.** 검증: tsc 0·worker build 0·전체 build 0·audit-gate(file-size 제외 37 GREEN). ⚠️ staging: `/u/{handle}` 공유 시 카드가 큐레이터 이름·프로필로 뜨는지 1회 확인. 롤백: CURATOR 블록 제거. (동반 비잠금: `index.html` 기본 메타 폐기어(공구권/식사권/라이브커머스)→현행 용어 · `nav.shopping` 6개 언어 · `의 링크샵` 공백 · InfoTab effectiveBio 폴백.)
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

**새 세션 시작 시 반드시 `docs/CURRENT_WORK.md`(인계 목차) 먼저 읽고, 거기서 최근 1~3건을 열기.**

인계는 **세션별 파일**이다(2026-07-29 구조 변경 — 대표 승인):
- `docs/handoff/<날짜>-<슬러그>.md` — **세션마다 자기 파일 하나**. 이게 실제 인계 내용이다.
- `docs/CURRENT_WORK.md` — **자동 생성 목차 + 규칙**. ❌ **사람이 편집하지 마라**
  (`scripts/generate-handoff-index.mjs` 가 pre-commit 에서 재생성 + stage).
- `docs/handoff/archive/` — 2026-07-26 이전 기록(내용 무변경 보존). 필요할 때 grep.

> 🧱 **왜 나눴나**: 예전엔 모든 세션이 `CURRENT_WORK.md` **맨 위에** append 해서, 내용상 무관한 두
> 브랜치가 **같은 줄을 다퉈 거의 모든 PR 에서 충돌**했다(2026-07-29 하루 10번+ 수작업 병합).
> `.gitattributes` 의 `merge=union`(#836)은 **로컬에서만** 통하고 **GitHub 서버측 머지는 그 드라이버를
> 안 쓴다**(07-29 #835 머지에서 실측: 로컬 clean ↔ GitHub `dirty`). 그래서 다툴 줄 자체를 없앴다.

**자동 업데이트 룰 (모든 세션이 지킬 것)**:
1. 세션 작업을 시작·진행하면서 알게 된 것 → **자기 handoff 파일**에 적는다(공유 파일 편집 금지).
2. 기능 완료 + commit 시 → 그 파일에 commit/PR 해시 기록.
3. 사용자가 새 요구 추가 시 → 즉시 반영.
4. 매 commit 의 변경 파일에 코어 기능 (송출/결제/인증) 포함 시 → 같은 commit 에 handoff 갱신 함께 staged

**세션을 끝낼 때(또는 PR 을 머지할 때) 반드시 남길 4가지** — 다음 세션이 이것만 읽고 이어갈 수 있어야 한다:
1. **다음 세션의 첫 액션** — 명령/쿼리까지 구체적으로. "무엇을 보면 무엇이 판정되는가"까지.
2. **완료분 + commit/PR 해시** — 이미 된 것을 또 파지 않게.
3. **이번에 틀렸던 판단** — 같은 오진 반복 방지. **이게 제일 값지다**(문서의 오기를 믿고 오진한 사례가 실제로 있었다).
4. **남은 결정/대기 항목** — 대표 판단이 필요한 것.

🛡️ **자동 강제 (2026-07-28 신설)**: `scripts/check-current-work-sync.mjs` — 브랜치가 `src/` 를 바꿨는데
**인계(`docs/handoff/**` 또는 목차)** 를 **한 번도** 안 건드렸으면 경고(pre-commit + audit-gate). 문서/테스트만 바꾼 브랜치는
검사 대상 아님(소음 억제). 차단: `STRICT_HANDOFF=1` · 우회: 커밋 메시지 `[SKIP_HANDOFF]`.
> 이 가드는 **실제 사고 후** 만들어졌다 — 2026-07-28 세션이 보강 레인 수리 5건을 머지하는 동안 인계를 한 번도
> 갱신하지 않아, 문서가 이전 세션에 멈춰 있었다. 룰만 있고 강제가 없으면 결국 놓친다.

> ⚠️ 이 룰 안 지키면: 다음 세션이 진행 상태 모름 → 중복 구현 / 누락 / 사용자 "왜 이거 안 됐어?" 반복.

## 📣 유어애즈 방향 확정 (2026-07-29 대표 — "앞으로 이것만 계속 할거야")

**유어애즈 = 인플루언서 DB.** 앞으로 할 일은 **네 가지뿐**:
**① DB 수집 · ② 카테고리화 · ③ 필터링 · ④ 정보 최대 수집.**

### 🎯 이 DB 를 무엇에 쓰는가 (2026-08-03 대표 확정 — 이전 "아웃리치 없음"을 **대체**)

> 대표: *"DB로 유어딜에 활동할 인플루언서 및 대행사에게 **제휴 제안을 보낼거야**. 출구는 내가 알아서 해."*

⛔ **이전 판의 "🚫 이메일 아웃리치는 하지 않는다 / 발송 코드에 새 작업을 얹지 말 것"(2026-07-29)은
폐기됐다.** 그 문장을 믿고 **발송에 필요한 필드·필터·내보내기를 방치하거나 정리하지 말 것** —
`opted_out` · `email_status`(반송/스팸신고) · `contacted_at` · `status` · 엑셀 내보내기는
**제안 발송의 전제**다. (⚠️ 다만 **발송 자체는 대표가 한다** — 세션이 콜드 발송을 자동화하지 않는다.
그건 방향이 아니라 법·평판 문제이고, 대표가 직접 판단할 자리다.)

**⇒ 그래서 이 DB 의 유일한 성공 지표는 총 인원이 아니라 "제안 보낼 수 있는 리드 수"다.**
```
전체 43,995 → 이메일 6,107 → 거부제외 6,097 → 카테고리 있음 5,887 → 개인(브랜드 제외) 5,801
                                                     그중 도달력 1k+ 4,473 (20k+ 1,399)
```
⚠️ **44,012 같은 총계로 진척을 보고하지 말 것** — 87%는 이메일이 없어 지금은 쓸 수 없다.
네 축(수집·카테고리화·필터링·정보수집)의 우선순위도 이 지표로 매긴다: 발송 가능 리드 중
**96.5%가 이미 카테고리를 갖고 있으므로**(5,887/6,097) ②는 병목이 아니다. 병목은 ④(연락처)뿐이다.

> 🔑 **네 축의 병목은 하나다** (2026-07-29 실측, 2026-08-03 재확인): `enrichNaverActivity` 가 한 번 돌면
> ②(본문 기반 카테고리)와 ④(연락처)가 **같이** 채워진다. 측정 수율 실측:
> **네이버 블로그 측정됨 28.7%(3,372/11,730) vs 미측정 1.2%(263/21,491) · 유튜브 측정됨 45%.**
> 즉 연락처는 "소스가 없다"가 아니라 **"측정을 못 따라간다"** 이고, 측정이 곧 연락처다.
> ⇒ **처리량이 곧 품질이다.** 근거·다음 액션: `docs/handoff/2026-07-29-influencer-db-throughput.md`
>
> ✅ **2026-08-03 그 병목이 수렴으로 전환됐다** (DO 알람 — 부모 cron CPU 천장 제거):
> `유입 1,613/일 vs 측정 3,600/일 → 순감 1,987/일`. 07-29 에 *"시간당 133씩 벌어진다"* 던 것이 뒤집혔다.
> ⚠️ **그러니 처리량을 더 밀지 말 것** — 조각 4배로 13일→3~4일이 되지만 얻는 건 9일이고
> 지는 건 **네이버 차단**(차단되면 측정이 통째로 멎는다). 수렴 중인 걸 리스크 지고 밀 이유가 없다.

### 📮 발송 시점 = **한참 뒤** (2026-08-05 대표 확정) → 그래서 **발굴 우선, 측정은 최소 유지**

대표에게 *"제휴 제안을 언제 보내기 시작하느냐"* 를 물어 확정받았다: **"한참 뒤."**
이 한 줄이 배분·유료전환 판단을 전부 결정하므로 **다른 세션은 이 전제로 계획할 것.**

**⇒ 미측정 백로그를 쌓는 것이 지금은 손해가 아니다.** 백로그는 **썩지 않는다** — 6개월 뒤에
측정해도 그때의 현재 활동을 재는 것이라 결과가 같다(2026-08-05 에 "데이터 부패" 라고 적었던 것은
**오기였고 정정한다**). 실측이 그걸 뒷받침한다:
```
측정됨 28,086 → 이메일 수율 27.7%      미측정 25,947 → 1.6%     ← 측정이 이메일을 만든다(17배)
미측정 안에 잠든 이메일 ≈ 7,200        (현재 보유 8,187의 거의 두 배)
24h 유입 5,656  vs  측정 5,938         ← 순감 282/일. **균형점 바로 위**
```
⚠️ **다만 발굴을 늘리면 이 균형이 뒤집힌다**(유입 > 측정 → 백로그 영구 증가). 발송이 한참 뒤라
그 자체는 괜찮지만, **측정을 0으로 두면 안 된다** — 키워드 수율(`recomputeKeywordContactYield`)이
측정에서만 나오므로, 측정을 끊으면 **어떤 키워드가 좋은지 모른 채 발굴**하게 되어 모수만 늘고 질이 안 오른다.
⇒ `MEASURE_SHARE`(기본 0.5)를 **0 으로 만들지 말 것**. 발굴 우선으로 기울이더라도 피드백 루프는 남긴다.

### 🧱 발굴의 천장은 플랫폼마다 다르다 (2026-08-05 실측 — 대표 *"수집도 플랫폼마다 천장이 있을거야"*)

맞다. 그리고 **하나는 이미 초과**다. 발굴 확대를 계획할 때 이 표를 먼저 볼 것:

| 축 | 일 한도 | 2026-08-05 실측 | 성격 |
|---|---|---|---|
| **YouTube units** | 10,000 (구글) | search 66회×100 + perf 3,702 ≈ **10,302 → 초과** | 🔴 **하드**. 유료 전환 무관. 여기서 더 못 뽑는다 |
| **네이버 검색 API** | 25,000 (목표 22,500) | **163 (0.7%)** | 🟢 하드지만 **140배 여유** — 볼륨은 여기서 나온다 |
| **네이버 직접 크롤** | ~8,000 관측치 | ok 2,006 · blocked **0** | 🟡 **소프트**. 공식 한도가 아니라 **차단 위험** — 차단되면 측정이 통째로 멎는다 |
| 카카오 로컬 | **미확정** | 187 lookups | ❓ 코드에 선언 없음. 확대 전 확인 필요 |
| 공공데이터포털 | API별 상이 | — | ❓ 미조사 |

**24h 수집 기여**: `naver_blog 5,130` · `youtube 408` · `tistory 45` — **네이버가 92%** 다.

#### 📏 무료 발굴량은 **하루 700~12,500 사이에서 요동친다** — "천장"이라 부를 값이 아직 없다 (2026-08-05)

> ⚠️ **이 절은 같은 날 두 번 고쳐 썼다. 두 번째가 맞다.** 첫 판에 *"무료 천장 = 하루 5,400명,
> 이미 포화"* 라고 단정했는데, **30시간 창만 보고 내린 결론**이었다. 3주 일별로 보면 전혀 평평하지 않다:

```
07-20  9,226   07-25    732 ←최저   07-30      1 ←사실상 정지   08-04  5,429
07-21 12,533   07-26  1,014         07-31    884                08-05 ~5,000 페이스
07-22  4,977   07-27  3,200         08-01  1,832
07-23  2,201   07-28  1,895         08-02  1,911
07-24  1,212   07-29  1,711         08-03  4,266
```
**17배 진폭**이고 하루는 **1건**이었다. 30시간이 평평해 보인 건 우연히 안정적인 구간을 잘라 본 것이다.

🔑 **그리고 5,400 은 천장이 아니다** — 07-21 에 **12,533** 을 한 적이 있다. 지금 값은 천장이 아니라
*지금 설정에서 나오는 값*이다.

##### 🔬 진폭의 원인 = **키워드 소진이 아니라 "그날 레인이 살아 있었나"** (2026-08-05 실측)

첫 판에 *"키워드 풀 소진 곡선으로 보인다"* 고 적었는데 **재 보니 아니었다**:
```
활성 키워드 399개 중 고갈(barren_streak>0)   9개뿐        ← 마르지 않았다
키워드 나이별 신규율   3~10일 36.5%  vs  10~30일 46.9%   ← 오래된 게 오히려 높다
```
⇒ 키워드는 병목이 아니다. 진폭은 **시스템 가용성**과 맞아떨어진다:
```
07-30   1건    ← 유어애즈 자동 정비가 07-26부터 멎어 있던 구간(#793)
08-03~04  4,266 → 5,429   ← CPU 사망을 수리하던 날들(#1054·#1059·#1065·#1073·#1076)
```
**즉 무료 발굴량을 결정하는 것은 쿼터도 키워드도 아니라 "레인이 안 죽고 도는가" 다.**
안정적이면 5,000대, 레인이 죽으면 1,000대 이하로 떨어진다. ⇒ **안정화가 곧 발굴량이다.**

⚠️ 다만 **07-21 의 12,533 이 어떻게 나왔는지는 아직 설명 못 한다** — 그때가 안정적이었을 뿐인지,
설정이 달랐는지 미확정. 그 답이 나오기 전엔 **"하루 N건 영구"라고 대표에게 보고하지 말 것.**

💡 덤으로 관측된 것: **키워드 7,980개 중 활성은 399개(5%)** 이고 최근 추가분(08-02~05, 1,589개)은
활성 0 이다. 다만 회차당 6개가 그대로면 활성을 늘려도 **한 바퀴만 길어질 뿐**(4.2일 → 21일)이라
처리량이 늘지 않는다 — 활성화가 수확을 늘리는지는 **아직 아무도 안 쟀다.**

> 🧭 **교훈**: 같은 날 **두 번** 좁은 창으로 단정했다(경보 6건 → 원장 보니 3배 · 30시간 → 3주 보니 17배 진폭).
> **주기가 있는 계에서는 관측 창이 주기보다 길어야 한다.** 시간당 값으로 일별 결론을 내지 말 것.

🔴 **그리고 `lanesPerTick`(cap)은 발굴에 안 닿는다.** 같은 창에서 cap 이 6→2 로 무너졌는데
**수집량이 안 변했다**:
```
08-04 18~20시  cap 6    →  132 · 74        ← 오히려 낮다
08-05 01~04시  cap 2~3  →  279 · 161 · 423 · 115
```
이유: **인플루언서** 발굴 레인(`collect`)은 cron 레인 순환이 아니라 **DO 알람**으로 돈다
(하트비트에 `lane-alarm-boot:collect` 가 찍힌다). 2026-08-05 세션이 "cap 6 회복하면 공짜 2배"
라고 대표에게 보고했다가 이 실측으로 **정정**했다 — 같은 오판을 반복하지 말 것.

🔴 **단 B2B 는 정반대다.** 매장후보·업체 레인(`collect-storeinfo`·`collect-hira`·`collect-localdata`
·`collect-neis`·`collect-store-kakao`·`collect-commerce`)은 **cron 레인 순환**이라 `cap` 이 직접 먹는다.
```
매장후보  11,170/일        업체  3,493/일     →  B2B 14,663/일 (인플루언서 5,583 의 2.6배)
시간당이 아니라 회차당 덩어리로 들어온다: 08-04 23시 6,000 · 09시 2,000 · 17시 1,765
```
공공 API 라 한 번에 500건씩 벌크로 긁으므로 **평평하지 않고 레인이 뽑혀야 들어온다.**
⇒ **cap 회복은 인플루언서엔 무의미하지만 B2B 발굴은 실제로 늘린다.** 그리고 2026-08-04 에
CPU 로 죽은 레인 3개가 **전부 B2B** 였다 — cap 붕괴의 피해자도 B2B 다.
⚠️ "cap 은 발굴에 안 닿는다" 를 **B2B 에까지 일반화하지 말 것**(이 문단이 그 오독을 막으려고 있다).

무료 천장을 실제로 정하는 것(전부 요금제 인지 상수):
| 노브 | 무료 | 유료 |
|---|---|---|
| DO 알람 간격 | **5분** | 1분 (5×) |
| 알람 시간당 실행 | **12회** | 60회 (5×) |
| 회차당 서브리퀘스트 | **56 중 51 사용(91%)** | ~900 (15×) |

시간당 12회 × 회차당 6키워드 = **72키워드/시간**이 무료의 구조적 상한이다.
⚠️ **다만 이것은 "회차를 몇 번 도느냐"의 상한이지 "몇 명을 얻느냐"가 아니다** — 회차당 수확은
키워드가 얼마나 신선한지에 달렸고, 그래서 위 일별 표가 17배로 요동친다.

⇒ 무료에서 **회차 수**를 늘릴 방법은 없다(알람 빈도·회차당 예산이 막는다 — 네이버 쿼터는 0.7% 남아돈다).
그 축의 레버는 **유료 전환**뿐이다(대표 판단 대기).
⚠️ **다만 "그래서 무료 발굴량이 고정"은 아니다** — 위 일별 표가 17배로 요동치는 것이 그 반증이다.
회차 수가 같아도 **키워드가 신선하면 수확이 뛴다.** 즉 무료에서도 *키워드 쪽*으로는 여지가 있고,
그게 얼마인지는 아직 아무도 안 쟀다(§첫 액션).
**B2B 는 다르다** — cap 회복(2→6)만으로도 늘어나고, 연락처 보유율도 이미 훨씬 높다:

| | 전체 | 연락처 | 보유율 |
|---|---|---|---|
| 업체(대행사) | 23,832 | 이메일 18,833 | **79%** |
| 매장후보 | 79,072 | 전화 47,034 | **59%** |
| 인플루언서 | 54,033 | 이메일 8,187 | **15%** |

발송 대상이 *"인플루언서 및 대행사"*(대표) 인데 **대행사 쪽은 이미 준비돼 있고 인플루언서가 뒤처져 있다.**

🔑 **그래서 발굴 확대의 실질 상한은 네이버이고, 네이버는 아직 0.7% 밖에 안 썼다.**
막고 있는 것은 쿼터가 아니라 **우리 Cloudflare 서브리퀘스트 예산**이다(실측 `spent 51/56`, `계획 16 → 처리 6`).

> ⚠️ **그런데 발굴 폭은 이미 의도적으로 잠겨 있다.** `COLLECT_KEYWORDS_PER_ROUND = 6`
> (`influencer-keyword-rotation.ts`, cap 40). 그 주석이 **열쇠를 명시**한다 —
> *"🔓 언제 푸는가: **측정 처리량이 올라간 뒤.**"* 그리고 *"측정을 올리는 것 자체가 네이버 직접
> 조회 부하를 늘리는 일이라 **차단 위험 판단이 먼저**"* 라고 경고한다.
> ⇒ **발굴 우선으로 가더라도 이 상수를 그냥 올리지 말 것.** 올리려면 (a) 측정 처리량이 받쳐 주는지
> (b) `ads_naver_crawl_block.blocked` 가 0 을 유지하는지 **두 값을 먼저 보고** 근거와 함께 올린다.

## 🕐 대표 보고는 **한국시간(KST)** (2026-08-01 대표 지시 — "앞으로 한국 시간으로 알려줘")

**대표에게 시각을 말할 때는 KST 만 쓴다** (2026-08-02 대표 재지시 *"한국시간으로만 알려줘 앞으로"*).
> 예) `밤 11시 회차` · `배포 21:51 완료` · `마지막 실행 13:44`

⛔ **UTC 를 괄호로 덧붙이는 것도 하지 말 것** — 이전 규칙(병기 허용)은 폐기됐다. cron 표현식처럼
UTC 가 *값 자체*인 경우(`0 * * * *`)만 예외이고, 그때도 "매시 정각"처럼 KST 로 읽어 준다.

⚠️ **왜 틀리기 쉬운가**: 이 시스템의 시각은 거의 전부 UTC 다 —
cron 은 `0 * * * *`(UTC) · 워커 런타임 TZ=UTC · D1 `datetime('now')` 는 **`Z` 없는 UTC 문자열**
(`2026-08-01 04:00:39`) · GitHub Actions·CF 대시보드도 UTC. 그래서 **읽은 값을 그대로 옮기면
자동으로 UTC 보고**가 된다(실제로 이 세션이 하루 종일 그랬다).
⇒ 어드민 API·하트비트·워크플로 시각을 인용할 때는 **변환했는지 매번 확인**할 것.

📌 정각 회차는 KST 로도 정각이다(오프셋이 정확히 +9h) — "매시 정각" 은 두 표기에서 같다.
🔢 코드 안의 KST 처리는 별개 규칙이다 → `src/utils/date.ts` SSOT + `check-utc-date-parse.mjs`
   (아래 방어선 표). 이 절은 **사람에게 말할 때**의 규칙이다.

## 🔑 어드민 진단 접근 (2026-07-28 대표 지시 — "모든 세션에서 자동으로")

라이브 데이터를 **추측 대신 실측**으로 확인하기 위해 어드민 API 읽기 접근을 상시 사용한다.
대표가 전용 계정 `claude@ur-team.com`(super_admin)을 발급했다.

**🚫 절대 룰**: **비밀번호를 레포에 커밋하지 말 것**(공개 레포 — 영구 노출). 코드·문서·커밋 메시지·주석 어디에도 금지.
`check-no-secrets.sh` 가 일부 패턴만 잡으므로 최종 방어는 이 룰이다.

**자격증명 위치**: Claude Code **환경변수**(Cloudflare env 아님 — 세션 환경변수) — 대표가 2026-07-28 등록 완료.
`URDEAL_ADMIN_EMAIL` / `URDEAL_ADMIN_PASSWORD`. **모든 세션이 자동 사용**한다.
⚠️ 환경변수는 **컨테이너 시작 시점에 주입**되므로 등록 직후 실행 중이던 세션엔 안 보인다(다음 세션부터 적용).
미주입 세션이면 대표에게 값을 요청하지 말고 **다음 세션에서 수행**하거나 대표에게 상태줄을 요청한다.

**접속 절차(3가지 함정 주의)**:
1. **도메인**: `live.ur-team.com` 을 쓰면 확실하다 — 도메인 이전 시 `/api/*` 는 301 제외라 구 도메인 API 가 살아 있다.
   ⚠️ **2026-07-29 정정**: 여기 오래 적혀 있던 *"프록시가 `urdeal.kr` 을 차단(CONNECT 403)"* 은 **더 이상 사실이 아니다** —
   실측 `urdeal.kr/`(HTML) **200** · `urdeal.kr/api/version` **200** · `live.ur-team.com/api/version` **200**.
   이 오기를 믿으면 **할 수 있는 라이브 실측을 포기하고 대표에게 화면 복사를 요청하는 왕복**이 생긴다(실제로 그럴 뻔했다).
   이 환경에서 **실제로 막힌 것**은 `dash.cloudflare.com` · **`*.pages.dev`(PR 프리뷰 — CONNECT 403)** ·
   한국 공공 API 도메인(`apis.data.go.kr` 등)이다. 프록시 규칙은 바뀔 수 있으니 **막혔다고 단정하기 전에 한 번 찔러볼 것.**
2. **User-Agent**: `botProtection()`(`bot-detection.ts`)이 curl UA 를 차단하고 `{"success":false,"error":"Forbidden"}`
   (키 2개, `code` 없음)를 준다. **브라우저 UA 헤더 필수**. `code:'ADMIN_IP_BLOCKED'` 가 있으면 그건 IP 화이트리스트로 **다른 원인**.
3. **토큰**: `POST /api/admin/login` {email,password} → 응답 토큰 필드가 **한 가지가 아니다** — 실측상
   `data.accessToken` / `data.token` / 최상위 `token` 중 하나로 온다. **존재하는 것을 골라 쓸 것**
   (`data['token']` 만 꺼내면 KeyError). 이후 `Authorization: Bearer <token>`. 계정은 `admins.id=10`.

**🤝 동시 로그인(2026-07-28 대표 지시 "동시 로그인되게 하고")**: 대시보드는 시트별 **단일 세션**이라 같은
계정으로 다른 곳에서 로그인하면 기존 세션이 즉시 `SESSION_SUPERSEDED` 로 끊긴다. 자동화 계정은 **여러 세션이
동시에** 쓰므로(이 문서가 "모든 세션이 자동 사용"이라 규정) 서로를 계속 밀어냈고, 대표가 브라우저로 들어오면
자동화가 끊겼다. → `dashboard_sessions.multi_session=1` 인 시트는 **세션 경계를 올리지 않아 동시 접속 유지**.

```bash
# super_admin 토큰으로 1회만 켜면 영구 적용(계정별 opt-in, 기본 OFF)
curl -sS -X PATCH "https://live.ur-team.com/api/admin/admins/10/multi-session" \
  -H "Authorization: Bearer $TOK" -H "User-Agent: $UA" -H 'Content-Type: application/json' \
  --data '{"enabled":true}'
```
> ⚠️ **자동화 계정에만 켤 것.** 단일 세션은 계정 공유·도용의 *탐지 신호*이기도 하다(남이 쓰면 내가 튕겨서
> 알게 된다). 사람이 쓰는 운영 계정에 켜면 그 신호를 잃는다.
```bash
UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
BODY=$(python3 -c "import json,os;print(json.dumps({'email':os.environ['URDEAL_ADMIN_EMAIL'],'password':os.environ['URDEAL_ADMIN_PASSWORD']}))")
TOK=$(curl -sS -X POST https://live.ur-team.com/api/admin/login -H 'Content-Type: application/json' -H "User-Agent: $UA" \
  --data-binary "$BODY" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['token'])")
# ⚠️ 단일 세션 정책: 같은 계정으로 다른 곳(대표 브라우저 등)에서 로그인하면 이 토큰이 무효화된다
#    (SESSION_SUPERSEDED). 긴 작업 중 끊기면 재로그인 후 재시도.
curl -sS "https://live.ur-team.com/api/admin/partner-pool/stats" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA"
```

**⚠️ 유어애즈(`/api/ads/*`)는 별도 워커(ur-ads)** — env 가 메인 Pages(ur-live)와 **분리**돼 있다.
메인 `/api/version` 의 시크릿 목록에 없다고 ur-ads 에도 없는 것이 아니고, 그 반대도 아니다.
ur-ads 쪽 설정 확인은 기능 호출로 판정할 것(예: `/api/ads/keywords/related` → `NOT_CONFIGURED` = 키 없음).

**사용 원칙**: 기본 **읽기 전용**(stats·목록·진단). 쓰기(큐레이션·수집 트리거·설정 변경)는 대표가 명시로 지시할 때만.
토큰·응답 파일은 스크래치패드에만 두고 작업 후 삭제. 세션 종료 시 남기지 않는다.

> ⚠️ 이 접근이 없으면: 라이브 원인 규명이 "대표가 상태줄 복사 → 붙여넣기" 왕복에 묶여 한 사이클에 수십 분씩 소모된다
> (2026-07-28 크롤 전멸 규명이 실제로 그랬고, 직접 조회로 전환하자 예외 원문 확보에 1분 걸렸다).

## ☁️ Cloudflare API 접근 (2026-07-28 대표 지시 — "영구적으로, 다른 세션에서도")

라이브 인프라(환경변수·배포·빌드로그·D1·KV)를 **대시보드 왕복 없이 직접** 확인·조정한다.

**자격증명 — 2026-07-28 대표 지시로 D1 보관이 SSOT**: 토큰은 **`platform_settings` 의 `cf_api_token` /
`cf_account_id`** 에 저장돼 있다. 어드민 자격(위 섹션)만 있으면 **모든 세션이 자동으로** 꺼내 쓴다 —
대표가 세션마다 환경변수를 만질 필요가 없다(그게 이 방식을 택한 이유).

```bash
# 표준 취득 절차 — 어드민 토큰($TOK) 확보 후
CFJSON=$(curl -sS "https://live.ur-team.com/api/admin/tools/settings" -H "Authorization: Bearer $TOK" -H "User-Agent: $UA")
export CLOUDFLARE_API_TOKEN=$(echo "$CFJSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['data'].get('cf_api_token',''))")
export CLOUDFLARE_ACCOUNT_ID=$(echo "$CFJSON" | python3 -c "import sys,json;print(json.load(sys.stdin)['data'].get('cf_account_id',''))")
```

환경변수 `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 가 이미 주입돼 있으면 그걸 우선 쓰고, 없으면 위 절차로 D1 에서 취득한다.
**🚫 레포에 값 커밋 절대 금지**(공개 레포 — `visibility: public` 확인됨. 커밋하면 git 히스토리에 영구 잔존 + 스캐너가 수분 내 수집).
값이 아니라 **키 이름만** 문서에 남긴다.

**⚠️ 프록시**: `dash.cloudflare.com` 은 이 환경에서 차단(000). **`api.cloudflare.com` 은 통과** — API 만 쓴다.

```bash
CF=https://api.cloudflare.com/client/v4
AUTH="Authorization: Bearer $CLOUDFLARE_API_TOKEN"
curl -sS "$CF/user/tokens/verify" -H "$AUTH"                                    # 토큰 유효성
curl -sS "$CF/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts" -H "$AUTH"       # 워커 목록
# 워커 환경변수(시크릿 아님) 조회/설정은 settings 엔드포인트 — 값 교체 시 기존 바인딩 전체를 함께 보내야
# 덮어써지지 않는다(부분 PATCH 아님). 반드시 조회 → 병합 → 전송 순서.
curl -sS "$CF/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/ur-ads/settings" -H "$AUTH"
```

**🗄️ D1 원본 조회 (2026-08-02 신설 — 어드민이 노출한 통계 말고 테이블 자체를 본다)**

```bash
# ⚠️ 계정에 D1 이 6개 있다. **이름으로 고르지 말 것** — 라이브는 이 uuid 하나뿐이고
#    (wrangler.toml · wrangler-ads.toml 이 같은 값을 쓴다), 이름 매칭은 엉뚱한 DB 를 집어
#    `no such table` 을 낸다(실제로 그렇게 한 번 헛짚었다).
DB=d9530ba6-7a26-4c02-9295-3ce5aef112a3
python3 -c "import json,sys;json.dump({'sql':sys.argv[1]},open('/tmp/q.json','w'))" "SELECT COUNT(*) n FROM ad_influencer_leads"
curl -sS -X POST "$CF/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database/$DB/query" -H "$AUTH" \
  -H 'Content-Type: application/json' --data-binary @/tmp/q.json
```
🔒 **읽기 전용으로만 쓴다.** 데이터 수리는 일회성 SQL 이 아니라 **코드 경로**(정비 레인 · `repair-schema`)로
간다 — 그래야 재현되고 리뷰되고 다음에도 돈다. 프로덕션 D1 에 잘못 날린 UPDATE 는 되돌릴 방법이 없다.

**🚫 자율 규율 (대표가 넓은 권한을 줬어도 지킨다)**:
1. **코드 배포는 이 토큰으로 하지 않는다.** 반드시 PR → CI(46 불변식) → 대표 승인 → 머지 경유.
   토큰으로 직접 배포하면 오늘 실제로 실수를 잡아낸 게이트(파일크기 래칫·타입체크)를 통째로 우회하게 된다.
2. 토큰 용도는 **① 진단(빌드로그·배포상태·플랜/한도 확인) ~~② 게이트 env 토글~~ ③ D1/KV 읽기** 로 한정.
   > 🔒 **2026-07-29 대표 지시로 축소 — 토큰 용도는 "조회 한정"이다.** ②(게이트 env 토글)를 **철회**한다.
   > **플랫폼 쓰기(cron 트리거 추가·env 변경·바인딩 수정)는 세션이 하지 않는다** — 세션은 **판정 결과만
   > 보고**하고, 실제 변경은 **대표가 대시보드에서 직접** 한다. 스코프도 읽기 4종(Workers Scripts Read /
   > Pages Read / D1 Read / Account Settings Read)만 요청하며, **부족해도 Edit 를 추가로 요청하지 않는다**
   > (D1 Read 로 쿼리가 막히면 그 값은 대표가 어드민에서 직접 확인 — 예: 예치금 4숫자).
3. **삭제·purge·바인딩 제거는 대표 명시 지시가 있을 때만.** 되돌리기 어려운 작업은 먼저 확인.
4. 토큰 값을 파일·로그·커밋·PR 본문에 남기지 않는다. 응답 파일은 스크래치패드에만, 작업 후 삭제.

> ✅ **2026-08-02 복구 — 토큰은 살아 있다(실측).** 07-29 의 "죽음" 표기는 **해소됐다.** 대표가 새 토큰을
> 발급했고, `platform_settings.cf_api_token` 에 저장돼 **모든 세션이 그대로 쓸 수 있다.** 실측:
> `GET /user/tokens/verify` → `success:true, status:active` · **D1 6개 / Workers 8개 / Pages 7개 조회 OK**
> · `POST /accounts/{acc}/d1/database/{uuid}/query` 로 **원본 테이블 SELECT 가 된다.**
> ⇒ 그래도 절차는 그대로다: **`verify` 로 먼저 확인하고 쓴다**(만료·회전은 언제든 일어난다).
>
> 🩸 **07-29 세션이 "죽었다"고 판정한 것은 사실이었지만 원인은 토큰이 아니라 저장 UI 였다.**
> `/admin/platform-settings` 가 값을 **조용히 안 저장**했다 — 편집 중 RQ 리페치가 폼을 서버 값으로
> 덮어써서, 새 토큰을 붙여넣고 저장해도 **옛 토큰이 다시 저장**됐다. 화면엔 계속 "설정됨"이 떠서
> 성공처럼 보였다(길이가 같으면 구분할 표시가 아예 없었다). 2026-08-02 수리: 시드 1회 + 저장 후
> "…끝4자리" 표시 + 무엇이 교체됐는지 토스트. ⇒ **자격이 반영됐는지는 화면 문구가 아니라 `verify` 로 판정할 것.**

**확인된 사실(2026-07-28 실측 — 추측 대체)**:
- ⚠️ **정정(2026-07-28 후속)**: 아래 "유료 → 1,000" 은 **틀렸다. 믿지 말 것.** `usage_model: standard` 는
  Workers **과금 모델**(bundled/unbound 세대 구분)이지 free/paid 구분이 아니다 — 무료 계정도 `standard` 로 나온다.
  같은 날 `docs/CURRENT_WORK.md` 가 기록한 **"대표 확정 '일단 무료' → 인보케이션당 서브리퀘스트 50(D1 포함)"** 이 맞고,
  보강 레인의 학습 상한이 **29~55 에서 맴돈 것은 고장이 아니라 실제 천장(50)으로의 정상 수렴**이었다.
  ⇒ 이 줄을 믿고 "상한이 갇혔다"를 결함으로 오진한 사례가 실제로 있었다(PR #800 의 최초 서술). 계획을 세울 땐
  **50 을 전제**로 하라 — 크롤 1사이트가 4~8 서브리퀘스트라 라운드당 실효 5~8사이트다. 처방은 회계 수정이 아니라
  **건당 비용 절감**(부기 배치화·중복 레인 제거)이거나 **유료 전환**이다.
- ~~계정 `usage_model: standard` = **Workers 유료** → 서브리퀘스트 한도 **1,000**(50 아님).~~ ← 위 정정 참조
- `ur-ads` 바인딩 31개에 `NAVER_SEARCH_CLIENT_ID/SECRET`·`KAKAO_REST_API_KEY` **모두 존재** —
  "크롤이 0인 건 네이버 키 부재" 가설도 **기각**.
- `tail` 세션 생성은 되지만 **wss 업그레이드를 이 환경 프록시가 막는다**(non-101) → 실시간 로그는 불가.
  ⇒ 라이브 원인 규명은 **D1 스냅샷 계측**에 의존해야 한다(그래서 `ads_enrich_last` 에 phase/p2/crash 추가).
- Observability(telemetry) API 는 현재 토큰 권한 밖(`Authentication error`) — 필요해지면 권한 추가 요청.

> 이 접근이 없어서 오늘 막혔던 것들: `Workers Builds: ur-live-global` 이 매 PR 마다 실패하는데 **빌드 로그가
> 대시보드에만 있어** 원인을 못 밝히고 "선재 실패"로만 넘겼다 · `SUPPLY_MAKER_COLLECT_ENABLED` 게이트를
> 못 켜 제조사 풀이 수동 실행분(85건)에 머물렀다.
## 🧪 원격 세션 검증 능력 — **npm 은 세션마다 다르다. 먼저 확인할 것** (2026-08-02 정정)

⚠️ **이 섹션은 2026-07-28 에 "npm 정상화"로 단정돼 있었다. 그 단정이 틀렸다** — 정책은 세션마다 바뀐다.
2026-08-02 실측: `npm ci` **403** · `npm view <any>` **403** · `npm i ms@2.1.3` **403**
(특정 패키지가 아니라 **레지스트리 전면 차단**). 07-28 의 성공도 사실이었다 — 둘 다 사실이고, 그래서
**단정하지 말고 세션 시작 때 한 번 찔러봐야 한다**(`npm view ms version` 이면 3초).

> ⚠️ **"npm 되니까 CI 로 미루지 마라"는 지침 자체는 유효하다.** 다만 **되는 세션에서만** 유효하다.
> 잠금파일(Toss·로딩)을 건드렸는데 npm 이 막혔으면 아래 우회로 **할 수 있는 만큼은 반드시 하고**,
> 못 한 범위를 커밋/PR 에 명시할 것. (머니 경로의 staging 실결제는 그대로 별도 — 빌드가 대체 못 한다.)

**🛟 npm 이 막혔을 때의 우회 — 2026-08-02 에 실제로 쓴 방법**
`node_modules` 가 없어도 **전역 `tsc`(`/opt/node22/bin/tsc`, TS 6)** 는 있다. 의존성 없는 순수 모듈
(`worker-ads/dispatch-budget.ts` 같은 정책·계산 파일)은 **단독 타입체크 + 컴파일 + 실행**이 된다:
```bash
tsc --ignoreConfig --noEmit --strict --target es2022 --module esnext --moduleResolution bundler <file.ts>
tsc --ignoreConfig --outDir <scratch>/build --target es2022 --module esnext --moduleResolution bundler <file.ts>
node <scratch>/harness.mjs      # 컴파일된 JS 를 import 해 불변식을 실제로 돌린다
```
⚠️ `--ignoreConfig` 없으면 TS6 이 **TS5112(tsconfig 있는데 파일을 지정함)로 즉시 중단**한다 — 출력이
짧아 "에러 없음"과 구분이 안 된다(이 레포가 `baseUrl` 로 이미 당한 클래스).
**alias(`@/`)·vitest import 가 있는 테스트 파일도 타입체크된다** — 스크래치에 스텁 tsconfig 를 만든다:
```jsonc
// <scratch>/tc/tsconfig.json  (+ stubs/vitest.d.ts 에 describe/it/expect·node:fs 최소 선언)
{ "compilerOptions": { "strict": true, "target": "es2022", "module": "esnext",
    "moduleResolution": "bundler", "noEmit": true, "skipLibCheck": true, "types": [],
    "paths": { "@/*": ["<레포절대경로>/src/*"] } },
  "include": ["stubs/**/*.d.ts", "<레포절대경로>/src/tests/unit/<대상>.test.ts"] }
```
⚠️ **왜 이걸 꼭 하라는가**: 컴파일된 JS 를 돌리는 해네스는 **타입 에러를 절대 못 잡는다.** 2026-08-02 에
`let cursor = 0` 에 객체를 대입하는 TS2322 를 해네스가 통과시켜 CI 를 한 번 더 돌렸다. 스텁 타입체크로
바꾸자 **TS7022**(제어흐름 narrowing 이 `cursor → sel → cursor` 로 순환)까지 미리 잡혔다.
⚠️ 이 우회로도 **못 하는 것**: React/JSX, vitest 러너 실행(어서션이 실제로 통과하는지), `npm run build`,
번들·배선 가드. ⇒ **순수 로직은 실행 검증 + 타입은 스텁으로, 배선·빌드는 CI 에 남긴다**로 나눠라.

**빌드 산출물 주의**: `npm run build` 는 `src/worker/generated/route-chunk-map.ts` 를 **재생성**한다(로컬 청크 해시).
이건 커밋 대상이 아니다 — 검증 후 `git checkout -- src/worker/generated/route-chunk-map.ts` 로 되돌릴 것.

**여전히 막힌 것(프록시)**: `dash.cloudflare.com` · `urdeal.kr` · **한국 공공 API 도메인 전반**
(`apis.data.go.kr` · `open.neis.go.kr` 등 CONNECT 403). 공공 API 스펙 검증은 이 환경에서 직접 호출로 못 한다 →
**라이브 워커의 `diag.error` 원문**(어드민 stats)이 사실상 유일한 ground truth. `data.go.kr` 문서 페이지는
WebFetch 도 403(봇 차단)이라 스펙 확인은 대표 화면 확인이 필요하다.

## 🧪 규율은 문서가 아니라 테스트로 (2026-07-29 대표 지시 — "문서 기재로 끝내지 말 것")

**규율 항목(지켜야 하는 불변식)을 발견하면 문서에 적는 것으로 끝내지 말 것.**
**발견 즉시 "테스트로 환원 가능한가"를 먼저 판단하고, 가능하면 그 세션에 박는다.**

판단 순서:
1. **환원 가능한가?** — 레포 안에서 관측 가능한 사실로 표현되는가(파일 내용·발행 SQL·설정값·호출 그래프).
2. **가능하면 그 세션에 작성** — 다음 세션으로 미루지 않는다. 미루면 문서만 남고 가드는 안 생긴다(실제로 반복됨).
3. **부분만 가능하면 그 부분을 박고, 못 막는 범위를 테스트 주석에 명시** — "이 테스트가 못 막는 것"을 적어야
   다음 세션이 가드를 과신하지 않는다.
4. **반드시 깨뜨려서 확인** — 일부러 위반을 주입해 빨강이 뜨는지 본 뒤 복원. (가드가 헛도는 사고가 실제로 있었다.)

> 예: *"ur-wholesale 에 cron 금지(정산 이중성숙)"* 는 머니 룰인데 **문서에만** 있었다(가드 0). 2026-07-29 에
> `wholesale-invariants.test.ts` 로 환원 — 단, 실제 cron 은 **Cloudflare 대시보드**에 걸려 레포가 못 보므로
> "레포 안에서 같은 사고를 만드는 경로"만 고정하고 그 한계를 주석에 적었다.
## 🚦 "코드에 있다 ≠ 살아 있다" — 소비자 경로를 말하기 전에 볼 것 (2026-08-03 신설)

**소비자 구매 경로·테스트 시나리오·절차를 제안하기 전에 `docs/FEATURE_STATUS.md` 를 먼저 열어라.**
자동 생성표다(`scripts/generate-feature-status.mjs`, pre-commit 재생성). 지금 **9개 기능이 꺼져 있다.**

> ⚠️ **왜 이 룰이 생겼나**: 2026-08-03 세션이 대표에게 실결제 절차로 **"딜 충전 5,000원"** 을 제안했다.
> 그 기능은 **2026-07-18 에 종료**됐고 서버는 403 을 준다. 라우트(`/points/charge`)도 페이지도 위젯
> 코드도 **온전히 남아 있어서** 파일만 보면 살아 있는 것으로 읽힌다. 종료는 `TOPUP_DISABLED = true`
> 한 줄로만 표현된다. 같은 함정이 최소 4개 더 있다(라이브커머스·쇼핑탭·공구호스팅·동네공구제안).

**💳 결제수단은 카테고리로 판정하지 않는다** — SSOT `src/shared/product-flow.ts` `getProductFlow()`:

| 판정 | 결제 | 무엇 |
|---|---|---|
| `deal_only === 1` | **딜** | **교환권** (기프티콘·KT) |
| `group_buy_status === 'active'` | **카드** | **이용권**(식당·뷰티·숙박) · 공구 |
| 그 외 | 카드 | 일반 쇼핑 |

⚠️ **교환권 ≠ 이용권.** 카테고리에 `_voucher` 가 붙는다고 딜 결제가 아니다 —
`meal_voucher` 인 "김밥천국 할인권"은 **카드 결제**다(SSOT 주석이 이 예를 든다).
같은 날 세션이 이걸 뒤집어 *"이용권은 카드로 못 산다"* 고 보고했고, 원인은 소비자 화면의
낡은 주석(*"교환권(voucher 카테고리)은 딜 결제"*)이었다. 가드: `check-payment-flow-ssot.mjs`.

## 🛡️ 감사 게이트 — 전수감사 전 필수 (2026-06-26 대표 지시 "이상적이면 이후 감사에선 안 보고 넘어가게 환경 설정")

**감사/전수조사 요청을 받으면 먼저 `bash scripts/audit-gate.sh` 를 돌려라.** 그리고:

1. **GREEN 도메인은 수동 재감사 금지** — 그 불변식은 결정론적 가드가 지키고 있다(`docs/AUDIT_INVARIANTS.md` 레지스트리). 가드가 GREEN 인 영역을 또 전수조사하는 건 시간 낭비 + 오탐 양산(이번 세션 교훈). 그 영역은 *새 코드가 가드를 통과하는지*만 보면 된다.
2. **RED·미보유 영역만 작업** — 게이트가 RED 면 그 가드가 가리키는 사이트만, `AUDIT_INVARIANTS.md` 의 "가드 미보유" 영역(결제 금액정확성·런타임 크래시·외부 PG 실응답)만 수동 감사.
3. **새 불변식을 발견·확인하면 가드부터 만들어라**(애초에 없도록) → `audit-gate.sh` + `AUDIT_INVARIANTS.md` 갱신. 수동 감사 결과를 반복하지 말고 기계가 지키게 한다.

> 현재 **81개** 불변식 GREEN (서비스분리·인증세션RBAC·머니패턴·DB스키마·상품종류·UI테마·시각KST·배포·번들). 상세: `docs/AUDIT_INVARIANTS.md`.
> ⚠️ 이 숫자는 가드를 추가할 때마다 낡는다(2026-07-29 에 47 → 76 으로 정정 — 29개가 밀려 있었다).
> **정확한 값은 `bash scripts/audit-gate.sh` 의 마지막 줄**이고, `check-audit-registry-sync` 가
> `docs/AUDIT_INVARIANTS.md` 의 개수만 강제한다(이 줄은 강제 대상이 아니라 수동 관리다).

> 🧪 **staging 검증 백로그 SSOT = `docs/STAGING_CHECKLIST.md`** (2026-07-05 신설). audit log 에 "staging 실결제 검증 필수"를 남길 때는 **같은 커밋에서 이 체크리스트에 항목(S#/P#) 추가** + 게이트 플래그면 `admin-system-monitoring.routes.ts` `OPS_GATES` 등록. 어드민 열람: `/admin/system-monitoring` "게이트·하트비트" 탭. cron 침묵·백업 무결성 관측: `cron-heartbeat.ts` + `/api/_healthcheck/cron` + `docs/BACKUP_RESTORE.md`.

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
- **SSOT 시드**: `src/features/blog/api/blog-seed.ts` 의 `blogSeedPosts()` 배열(콘텐츠 데이터, blog.routes.ts 에서 분리) + `blog.routes.ts` 의 `BLOG_SEED_VERSION` 상수. 시드 문구는 blog-seed.ts, 버전 bump 는 blog.routes.ts. (본문 렌더러는 상세·관리자 미리보기 공용 `src/features/blog/BlogMarkdown.tsx`.)
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

**시드 SSOT**: `src/features/guides/api/guide-seed.ts`(집계) + `guide-seed-{admin,seller,agency,wholesale}.ts`(콘텐츠) + `guide.routes.ts` 의 `GUIDE_SEED_VERSION` 상수.

**자동 반영 원리 (2026-07-11 — 블로그 `BLOG_SEED_VERSION` 메커니즘 미러)**: `GUIDE_SEED_VERSION` > DB 저장 버전(`platform_settings.guide_seed_version`)이면 배포 후 첫 가이드 접근 시 `maybeSyncGuideSeed()` 가 자동 동기화 — 신규 섹션 삽입 / 시드 관리 섹션(`manually_edited=0`) 최신화. 관리자가 UI 에서 **직접 수정·생성한 섹션(`manually_edited=1`)은 절대 덮어쓰지 않음**(수동 편집 보존). 시드에서 빠진 섹션은 삭제 안 함(가이드는 큐레이션 문서 — 정리는 관리자 삭제/강제 리셋으로).

### 코드 변경 시 함께 업데이트
- 새 API 엔드포인트 → 영향받는 역할의 가이드 섹션
- 새 관리자 페이지 → 어드민 가이드 "유용한 링크"
- 정산/주문 플로우 변경 → 어드민 + 셀러 동시
- 수수료율 변경 → 어드민 + 셀러 + 에이전시 동시
- 장애 발생/해결 → 어드민 "기술 장애 대응" 섹션
- FAQ 추가 → 해당 역할 "자주 묻는 문제"

### 업데이트 방법
- **권장**: `guide-seed-*.ts` 수정 + **같은 커밋에서 `GUIDE_SEED_VERSION` +1**(guide.routes.ts) → 배포 후 자동 반영(수동 편집 보존). 버전 안 올리면 라이브 미반영.
- **대안**: 관리자가 `/admin/operations-guide` 에서 직접 편집(해당 섹션 `manually_edited=1` → 이후 재시드 불침범)
- **강제 리셋**: `POST /api/guides/:type/reseed {"confirm":true}` — 수동 편집까지 초기화하고 해당 type 전체를 시드로 교체(footgun 가드 있음)

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
- 🛡️ **sellers 컬럼 추가 금지(2026-07-05 — 한도 도달)**: sellers 는 **정확히 100컬럼 = D1 결과셋 한도**. 새 셀러 메타/설정/플래그는 `seller_meta`(K-V 사이드테이블, `src/worker/utils/seller-meta.ts` — product_supply_meta 미러) 사용. ALTER 는 `scripts/sellers-column-baseline.json` 등록 필요 — CI 차단
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

> ⭐ **커미션 재원 확정 원칙 (2026-07-08 대표 확정 — 8월 promo flip 방향, 현재 코드 미변경)**: **유어딜 5% 는 *어떤* 커미션에도 일절 안 쓴다(순수 인프라비, PG 포함).** 판매 커미션(인플/벤더/어필리에이트) **그리고 에이전시 수수료까지** 전부 **매장 promo(5% 밖, `promo_funding_source=owner`) 재원**. 에이전시는 유어딜이 커미션을 주는 게 아니라 **매장-인플 조율로 매장 promo 마진에서 스스로 가져가는 독립 사업자**(= 쇼핑 벤더 모델의 오프라인판; 유어딜 정의 = 쇼핑 공구 벤더 중개 모델을 오프라인 이용권으로 이식). 누가 얼마 받든 **유어딜 5% 는 불변(원장 `platform:revenue`=5% 전액, 성장 커미션 debit 0, 예외 없음 — 깨지면 버그)**. 오늘 owner 스위치는 어필리에이트만 커버 → 8월 flip 이 나머지 전 축(에이전시 포함) 확장 + 불변식 #44 신설. **머니 경로라 flip 은 단독 세션 + staging 실결제.** SSOT·flip 체크리스트: `docs/design/commission-funding-restructure.md` §확정 원칙.

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
7. **첫 페인트 표준 + 새 페이지 로딩 체크리스트(2026-07-12 대표 확정)**: `docs/LOADING_ARCHITECTURE.md` 의 "첫 페인트 표준" 표 + "✅ 새 페이지 로딩 체크리스트" **필수 준수** — ① 로더는 BrandLoader 만 ② 시드는 useState 동기 소비(+정체성 검증) ③ 목록→상세 prefetch 는 상세와 같은 엔드포인트/키(String 정규화) ④ 하드로드 진입점은 `generate-route-chunk-map.mjs` ROUTES + worker chunkSurface 동시 등재(청크 병렬화 — 가드 강제) ⑤ 쿼리 변경은 제자리 갱신 ⑥ 완성 후 `node scripts/probe-loading.mjs /path` 실측(풀 로더 1회·warm ≤1.5s)
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
7. 배포 후 `curl -i "https://urdeal.kr/api/version?cb=$RANDOM"` 등 핵심 endpoint smoke test
   > 🔴 **2026-08-04 정정**: 여기 오래 적혀 있던 `-X POST .../api/version` 은 **항상 404** 다
   > (그 라우트는 GET 전용). 캐시 우회가 목적이었으면 쿼리로 하면 되고, POST 로는 배포가 성공했는지
   > 실패했는지 **구분이 안 된다**. 같은 오류가 `uptime.yml` 의 생존 프로브에도 있었고
   > (4xx='정상' 규칙이라 조용히 통과), 이제 `check-live-contracts` 가 프로브 URL 의 실재를 검사한다.

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
| 타입 에러 라이브 유출 (배포 타입체크 게이트) | - | `main.yml` "Typecheck gate"(배포 차단) + `verify.yml` frontend tsc strict | 2026-07-12 BrandLoader import 누락(타입 에러)이 그대로 배포 → 블로그 상세 전면 크래시. vite build 는 타입검사 안 함 + verify tsc 가 warn-only + 배포는 Verify 와 독립이라 어디서도 못 막았음. **main.yml 의 Typecheck gate·verify 의 `continue-on-error: false` 제거/약화 금지**(제거하면 이 사고 재발). worker 전용 tsconfig 체크는 선재 에러 정리 후 strict 승격 예정(현재 warn) |
| `vite build` 단독 사용 | `check-build-command.sh` | `verify.yml` | 2026-05-12 _worker.js 미갱신 |
| `_worker.js` 신선도 | `validate-build-output.cjs` (post-build) | - | 2026-05-12 |
| Hardcoded secret | `check-no-secrets.sh` | `verify.yml` | public repo 전환 후 영구 노출 위험. 2026-07-28 보강: **dotenv/`.dev.vars` 파일 자체를 커밋 금지**(패턴 0) — `.env.deploy` 가 살아있는 CF 토큰을 담은 채 커밋돼 있었고(#737), 기존 값 패턴들이 전부 따옴표를 요구해 dotenv 형식(`KEY=value`)을 통째로 놓쳤다 |
| cron 무음 정지(실행기록 없음) | `check-cron-heartbeat.mjs` | `verify.yml` (strict) + audit-gate | 2026-07-28 — `safeCron` 이 **예외 발생 시에만** 기록해, 예외 없는 정지(cron 미발화·게이트 OFF 조기 return·내부 `.catch(() => null)` 로 삼킴)가 **성공으로 집계**됐다. 유어애즈 자동 정비가 그 경우로 07-26 부터 멈췄는데 아무도 몰랐고(#793), 당시 cron 70개 중 실행기록을 남기는 건 3개뿐이었다. safeCron 에 성공·실패 무관 하트비트(`platform_settings` 의 `cron_hb:{name}`) + 어드민 `GET /api/admin/cron-heartbeats`. **새 cron 은 반드시 `ctx.waitUntil(safeCron('이름', () => 작업(env)))` 형태로 등록** — 우회하면 그 작업만 관측 밖으로 나간다. 예외 `cron-heartbeat-ok` 주석 |
| 시드 버전 재사용(재시드 무음 스킵) | `check-seed-version-monotonic.mjs` (warn) | `verify.yml` (strict) + audit-gate + pre-commit | 2026-07-29 — 가이드/블로그 시드는 "코드 버전 > DB 저장 버전"일 때만 재시드된다. **이미 쓴 번호를 다시 쓰면 조건이 거짓이라 에러 없이 아무 일도 안 일어난다** — 배포는 초록불이고 라이브 문서만 옛날 것으로 남는다. 이 레포에서 이미 두 번 났다: `GUIDE_SEED_VERSION = 8` 이 2026-07-20 서로 다른 두 커밋에 쓰였고(v11 주석이 수습을 기록 — "병행 배포 양쪽(각자 v8)이 모두 재시드되도록 9 로 합침"), `= 4` 도 두 번. 07-29 에도 PR #451·#425 가 동시에 12 를 잡았다(머지 직전 수동 발견). **세션이 여러 개 동시에 도는 한 계속 난다** → main 히스토리 대비 단조증가 강제. 상수를 안 건드린 브랜치는 검사 생략(소음 0). ⚠️ 미머지 브랜치끼리의 동시 선점은 못 막는다 — 나중에 머지하는 쪽이 CI 에서 걸려 +1 하면 된다. 예외 `seed-version-ok` |
| 잠금표가 사라진 심볼을 지킴(낡은 지도) | `check-lock-table-symbols.mjs` (warn) | `verify.yml` (strict) + audit-gate | 2026-07-29 — 이 문서의 두 잠금표(Toss V2 / 로딩)는 "이 파일의 이 심볼을 건드리지 마라" 형태인데, **코드가 리네임·삭제돼도 표는 남는다.** 그러면 표가 *틀린 지도*가 되어 다음 세션을 반대 방향으로 이끈다. 실측 2건: ① `kakao.routes.ts | linkUserExtraRoles` → `issueLinkedRoleTokens` 로 리네임됨(지키려던 `seller.username` 동작 자체는 유지) ② `App.tsx | MainHomePage eager import` → 홈이 `HomeRoute`(PC=`PcHomePage`/모바일=`RestaurantMapPage`, **둘 다 lazy**)로 바뀌면서 `MainHomePage` 는 **참조 0인 죽은 파일**이 됐다 — 이 행을 따르면 죽은 컴포넌트를 eager import 로 되살리게 된다(현재 lazy 는 App.tsx:46 의 의도적 트레이드오프). ⚠️ **못 잡는 것**: 문자열 존재만 보므로 심볼이 **주석에만** 남아도 통과한다 — ②가 정확히 그 경우라 가드가 아니라 사람이 찾았다. 리네임·삭제는 잡지만 "언급은 있는데 더는 안 살아 있음"은 못 잡는다 |
| 비공개 라우트가 크롤에 열림 | `check-robots-private-routes.mjs` (warn) | `verify.yml` (strict) + audit-gate | 2026-07-29 — `ProtectedRoute` 로 보호되는 경로 **71개가 robots.txt 에 안 막혀 있었다**(셀러 대시보드만 ~40개). `/admin`·`/supplier` 는 전면 차단인데 셀러/에이전시는 `login`·`register` 두 개만 — 규칙이 ad hoc 으로 자라며 생긴 구멍이다. 크롤러는 로그인 벽/빈 SPA 를 받아 **soft-404** 로 집계하고 그만큼 크롤 예산이 실제 상품 페이지에서 빠진다(에러가 없어 안 보인다). ⚠️ **prefix 추가 시 공개 경로를 삼키는지 반드시 확인**: `/creator` 는 공개 모집 `/creators`·`/creators/apply`(사이트맵 등재)를 함께 막아 **제외**했고, `/u/me` 는 `$` 앵커가 없으면 `/u/melon` 같은 **실제 링크샵 핸들**을 통째로 막는다. prefix 안의 공개 페이지는 `Allow:` 예외로 살릴 것(`/seller/plus-friend-guide`·`/influencer/rankings` 가 그 사례). ⚠️ **못 보는 것**: "공개인데 막힘" 방향은 이 가드가 안 본다 — `<SEO>` 존재를 색인 의도로 읽었더니 원래 의도적으로 막아온 페이지 19건이 오탐으로 잡혔다. 색인 의도의 진짜 신호는 **사이트맵 등재**이고 그 모순은 `check-sitemap-routes` 가 본다 |
| sitemap 이 죽은 URL 제출(SEO 신뢰도) | `check-sitemap-routes.mjs` (warn) | `verify.yml` (strict) + audit-gate | 2026-07-29 — **네 번째 재발**이라 가드로 박았다. sitemap 은 "이 URL 을 색인해 달라"는 선언인데 라우트가 사라져도 표는 남고, 에러가 안 나 아무도 모른다(크롤 예산 낭비 + 서치콘솔/서치어드바이저 수집오류 → 사이트맵 신뢰도 하락). 실측: ① `/group-buy` — 실제로는 `<Navigate to="/">` 인데 **priority 0.95·hourly** 로 두 번째로 높게 제출 ② `/vouchers?category=cafe|convenience|restaurant|beauty|department|mobile` — 필터는 **한글 표시 카테고리**(`편의점`·`커피/음료`…)로 도는데 영문 슬러그를 제출 → 6개 전부 0건(soft-404). 라이브 실측으로 실재 카테고리 3개로 교체 ③ `/live/{id}` ×100 — 라이브커머스 영구중단으로 **라우트 자체가 없는데** hourly 로 발행. 같은 파일 정적 목록엔 "미노출"이라 적어 놓고 **동적 섹션만 정리에서 빠져 있었다**(주석과 코드가 어긋난 전형). ⚠️ **catch-all(`*`) 라우트는 매칭에서 제외** — 포함하면 모든 URL 이 "라우트 있음"으로 통과해 검사가 통째로 무의미해진다(첫 구현이 실제로 그래서 죽은 URL 주입에 초록불이 떴다) |
| tsconfig 가 타입체크를 통째로 중단 | `check-tsconfig-resolution.mjs` (warn) | `verify.yml` (strict, +검사대상 수 하한) + audit-gate | 2026-07-29 — `tsconfig.json` 의 **`baseUrl`** 이 TS 6 부터 경고가 아니라 **에러(TS5101)** 라, 최신 tsc 는 설정 로드 단계에서 **즉시 중단하고 파일을 하나도 검사하지 않는다**. 출력이 2줄뿐이라 "에러 없음"과 구분되지 않는다 — 실측으로 확인: `baseUrl` 있을 때 출력 2줄 / 없앤 뒤 전량 검사(이 컨테이너는 node_modules 부재라 64,773 모듈에러). 그래서 인계 문서에 *"로컬 tsc 는 죽어 있다. CI 가 유일한 타입 검증"* 이라고 적힌 채 여러 세션이 지나갔고, 원인은 이 한 줄이었다. **수리**: `baseUrl` 제거 + `paths` 를 tsconfig 기준 상대경로(`./src/*`)로 — TS 4.1+ 지원이라 5·6 양쪽 동작하고 TS 7 도 대비. `baseUrl` 의존 비상대 import 0건 확인, `@/` 4,094건은 그대로. 빌드도구(vite·vitest·esbuild)는 각자 alias 를 정의해 무관. ⚠️ **`ignoreDeprecations` 로 막지 말 것** — 고정 TS(5.5)가 그 값을 거부해 오히려 CI 가 깨진다(버전 결합). ⚠️ 이 가드가 못 보는 "설정은 멀쩡한데 대상 0개"(include 오타 등)는 verify.yml 의 **검사 대상 수 하한(500)** 스텝이 잡는다 — 둘은 짝이다 |
| **가드가 있는데 안 돎**(레지스트리) | `check-guard-registry.mjs` (warn) | `verify.yml` (strict) + audit-gate | 2026-07-29 — 이 레포에서 반복된 사고는 "검사가 실패한다"가 아니라 **"검사가 아예 안 돈다"**이다. 배포는 초록불이고 아무도 모른다. 같은 날 실측 3건에서 도출: ⓐ `check-bundle-size` 의 gzip 총량 예산이 `.gz` 사이드카를 읽는데 **vite 는 그 파일을 만들지 않는다** → 측정값 항상 0 → `0 > 1.5` 는 영원히 거짓 → 몇 달간 통과만 했다(상향 근거로 4번 인용된 "gzip 은 여유 있다"가 전부 이 죽은 값이었다) ⓑ `check-input-text-color` 는 `dark:text-white` 를 오탐해 **정상 코드에 빨간불**을 내는 바람에 audit-gate·verify·훅 **어디에도 등록되지 못한 채** 남았다 — 파일이 존재하니 보호받는 것처럼 보였다 ⓒ `check-linkshop-ownership` 은 대상 파일이 없으면 조용히 `continue` 해서, **이름만 바뀌어도 그 불변식이 소리 없이 사라지는** 구조였다. **강제 2가지**: R1 모든 `scripts/check-*.{mjs,sh}` 가 실제 실행 경로(audit-gate/워크플로/훅/러너가 호출하는 npm 스크립트)에 있을 것 — package.json 에 **정의만** 된 것은 등록으로 치지 않는다(`check:i18n` 이 실제로 그 상태였다) · R2 가드가 코드에서 지목한 고정 파일 경로가 존재할 것(주석 속 경로는 제외). ⚠️ **못 막는 것**: 등록은 됐는데 판정 로직이 틀려 늘 통과하는 경우(ⓐ) — 그건 각 가드가 **"측정 대상 0건이면 통과가 아니라 실패"**를 스스로 선언해야 잡힌다. 새 가드를 쓸 때 이 선언을 넣을 것. 예외 `guard-registry-ok` 주석 |
| 라우트 경로 중복(조용히 죽는 페이지) | `check-duplicate-routes.mjs` (warn) | `verify.yml` (strict) + audit-gate | 2026-07-29 — `src/App.tsx` 에 `<Route path="/influencer">` 가 **두 번** 있었다(`InfluencerDashboardPage` 739줄 / `InfluencerLandingPage` 742줄). 같은 `<Routes>` 안 동일 경로라 먼저 선언된 대시보드가 항상 이기고, **2026-05-15 에 만든 B2B 영입 랜딩은 두 달 넘게 한 번도 렌더된 적이 없었다** — 에러도 경고도 빌드실패도 없다. 페이지를 만들고 라우트를 달았으니 됐다고 믿게 되지만 실제로는 죽어 있는, 이 레포가 반복해 만난 "실패가 아니라 조용한 부재" 클래스. 대표 확정으로 **랜딩이 `/influencer`**(`/business`·`/agency-partner` 와 3종 세트), 대시보드는 `/influencer/dashboard` 로 이사하고 소비자 인바운드 3곳(마이 추천 적립 카드·홈 가이드 "내 추천 링크"·교환권 "친구 추천 5%")을 함께 옮겼다. ⚠️ **못 잡는 것**: 경로가 다른데 한쪽이 다른 쪽을 그림자처럼 가리는 경우(`/a/:id` 가 `/a/new` 를 선점) — 문자열 비교로는 판정 불가. 예외 `duplicate-route-ok` 주석 |
| 규칙 버전 미bump(소급 적용 무음 누락) | `check-rules-version-bump.mjs` (warn) | `verify.yml` (strict) + audit-gate | 2026-07-29 — 유어애즈 리드 파이프라인은 행마다 처리 시점의 규칙 버전을 스탬프하고(`classified_v`·`enrich_v`) 재처리 대상을 `COALESCE(v,0) < 상수` 로 고른다. **규칙만 고치고 상수를 안 올리면 에러 없이 옛 판정이 굳는다.** 특히 `CLASSIFY_RULES_VERSION` 은 재검사 쿼리에 **시간 폴백이 없어 영구**다 — 2026-07-27 에 "인천교통공사…특강" 류가 옛 규칙 스탬프로 영구 재검사 제외됐던 사고의 수습이 바로 이 `classified_v` 방식이라, **메커니즘 전체가 '상수 올리기'에 걸려 있다.** `CRAWL_RULES_VERSION`·`MAKER_CRAWL_VERSION` 은 7일 시간 폴백이 있어 경고만(strict 차단은 classify 만). 주석/공백만 바뀐 경우는 제외(소음 억제). 예외 `rules-version-ok` |
| Firebase 토큰 인증 수용 | `check-no-firebase-auth.mjs` | `verify.yml` (strict) + audit-gate | 2026-07-28 — Firebase 서비스계정 개인키가 `archive/` 문서에 3개월간 public 노출(#798). 그 키로 **커스텀 토큰 발급 → Firebase 공개 REST 로 ID 토큰 교환 → Bearer 제출** 하면 서명이 Google 공개키로 정상 검증돼 **임의 uid 로 로그인**이 됐다. **키 폐기만으로는 부족** — 수용 경로가 남으면 새 키가 또 유출될 때 재발한다. `requireAuth`/`optionalAuth`/`auth-token.routes` 의 Firebase 분기 제거 + `googleRoutes` 마운트 해제. KR=카카오 세션·셀러/어드민=JWT·GLOBAL 미런칭(#804)이라 실사용자 0(대표 확인). 되살리려면 `firebase-auth-ok` 주석 + 새 키 발급 |
| 시크릿 자재(키 본문) 유입 | `check-secret-material.mjs` | `verify.yml` (strict) + audit-gate | 2026-07-28 — `archive/` **19개 `.md`/`.txt`** 에 Google 서비스계정 개인키·Toss live·Stripe 시크릿이 **추적된 채** 3월부터 public 노출(#798). 기존 가드가 둘 다 통과시켰다: `verify.yml` 의 검사는 **`src/` 의 `.ts/.tsx` 만** 보고, `check-no-secrets.sh` 는 **키 이름 패턴** 위주라 문서 안의 *키 본문*이 사각지대였다. 폴더명이 `secrets-redacted/` 라 처리된 것처럼 보였으나 원문 그대로였다. **확장자·경로 무관 전수 스캔**(PEM 실본문·Toss live·Stripe·AWS·Slack·Anthropic·OpenAI·GitHub PAT), 자리표시자는 오탐 제외, 예외는 `secret-material-ok` 주석. ⚠️ **작업트리만 본다 — history 유출은 스캔이 아니라 *회전*으로만 해결된다** |
| **가드가 실패할 수 없음**(헛도는 검사) | - | `check-guard-mutations.mjs` (`verify.yml` strict) | 2026-08-02 — 이 레포의 반복 사고는 "검사가 실패한다"가 아니라 **"검사가 실패할 수 없다"** 이고, **하루에 세 번** 났다: ① `배열을 reverse 해도 같은가` — 15개 배열의 reverse 는 i→14−i 라 **홀짝이 보존**돼 2조 분할에 영향 0(정렬을 통째로 지워도 초록) ② `phase 이름이 조를 흔든다` — 이웃이 `?` 앞에서 이미 갈려 **실제로는 안 일어나는 일**이었다 ③ `한 회차가 예산을 넘지 않는다` — 픽스처에 **일 1회 레인이 하나도 없어** `always` 가 늘 빈 배열(라이브에선 예산 8 에 12개가 떠 3개가 CPU 한도로 잘리는데도 초록). **셋 다 손으로 주입해 보고서야** 알았다 — 손으로 하면 다음 세션은 안 한다. 주입 매니페스트(현재 9건)를 두고 CI 가 대신 깨뜨린다. 두 모드를 잡는다: **헛도는 가드**(결함을 심었는데 통과) · **낡은 지도**(`find` 가 소스에 없음 = 코드 이동). 🔑 **새 가드를 만들면 매니페스트에 한 줄 추가할 것.** ⚠️ 그리고 **주입이 실제로 적용됐는지부터 확인하라** — 같은 날 존재하지 않는 경로에 마커를 심어 "검증됐다"고 착각할 뻔했다(추적 안 되는 파일이라 스캔에서 빠져 초록불) |
| **머지 충돌 마커 커밋** | `check-conflict-markers.mjs` | `verify.yml` (strict) + audit-gate | 2026-08-02 — 레포 **두 번째**(07-11 `CLAUDE.md` · 08-02 `576525a`). **`git add -A` 는 충돌 파일도 '해결됨'으로 표시한다 — git 이 안 막아 준다.** 여러 세션이 같은 파일(특히 handoff)을 동시에 파는 구조라 충돌이 상시다. 🔑 **머지 뒤 커밋 전 반드시**: `grep -rn '^<<<<<<< \|^>>>>>>> ' src/ docs/`. handoff 충돌은 보통 **양쪽 보존**이 맞다(`--ours/--theirs` 로 한쪽을 버리면 다른 세션 작업이 사라진다) |
| **레인이 CPU 예산을 우회**(유어애즈 — 인플루언서·B2B 공통) | `check-ads-dispatch-bypass.mjs` (래칫 7건) | `verify.yml` (strict) + audit-gate | 2026-08-02 — 레인을 띄우는 길이 둘인데 **성격이 정반대**다: `kick`=`SELF.fetch`=**자식 인보케이션**(자기 CPU 예산·미룰 수 있음) ↔ 생 `ctx.waitUntil(await import(…))`=**부모가 직접 CPU 를 태움**(안 세고 못 미룬다). 예산을 아무리 나눠도 우회분이 새어 나간다. ⚠️ **B2B 가 더 큰 피해자다** — 레인 34개 중 **29개가 B2B**이고 01:00 KST 에 CPU 한도로 죽은 3개(`collect-commerce`·`collect-neis`·`collect-nps`)는 **전부 B2B** 였다. 두 도메인이 같은 부모 예산을 나눠 쓴다. 예외 `dispatch-bypass-ok` |
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
| SQL bind param mismatch **+ bind 통째 누락** | `check-sql-bind-params.mjs` (warn) | `verify.yml` (strict) | 'wrong number of bindings' SqlError 방지. 2026-07-02 확장: `?` 있는 SQL 이 같은 체인에서 `.bind()` 없이 `.run()/.all()/.first()/.raw()` 직행하면 차단 — D1 에러를 `.catch(() => …)` 가 삼키면 **무음 no-op**(2026-07-01 혼합결제 딜 미차감 실사고 — 2주간 가드·감사 통과한 클래스). TS 제네릭(`.all<T>()`) 체인 파싱 지원. 변수 후행 bind 패턴은 미해당(오탐 0) |
| NOT NULL INSERT 누락 | `check-sql-not-null-insert.mjs` (warn) | `verify.yml` (warn) | 2026-05-17 알림 silent fail 사고 (notifications.body 컬럼 없음) |
| 존재하지 않는 컬럼 참조 | `check-sql-column-exists.mjs` (warn) | `verify.yml` (warn) | 2026-05-17 'no such column' SqlError 방지 |
| 존재하지 않는 테이블 참조 | `check-sql-table-exists.mjs` (strict) | `verify.yml` (strict) | 2026-07-01 admin 리뷰관리가 없는 `reviews` 테이블(실제 `product_reviews`) 조회 → 항상 500(대표 "에러 너무 많아"). 컬럼 가드는 INSERT/UPDATE 컬럼만 봐 FROM/JOIN 테이블명 오타를 못 잡음. FROM/JOIN/INTO/UPDATE/DELETE 테이블이 CREATE TABLE(마이그레이션+repair-schema+inline src) 또는 `KNOWN_TABLES_EXTRA`(프로덕션 존재·레포 미기록 13개) 에 있는지 검증. 신규 실제 테이블은 CREATE TABLE 추가 시 자동 인식. 예외는 `KNOWN_TABLES_EXTRA` 등록 |
| products `SELECT *`/`p.*` | - | `verify.yml` (strict) | 2026-06-10 D1 컬럼 한도(100) 초과 — 교환권/공구 상세 전체 500. `productDetailCols()` 명시 목록 사용 |
| products/sellers 새 컬럼 (예산제) | - | `verify.yml` (strict) | 같은 사고 구조적 후속 — 새 메타는 K-V 사이드테이블(`product_supply_meta`), products/sellers ALTER 는 baseline 등록 필수. **sellers 는 이미 100컬럼(D1 한도 도달)** — `check-products-column-budget.mjs` 가 두 테이블 모두 감시 (`scripts/{products,sellers}-column-baseline.json`) |
| PRODUCT_DETAIL_FIELDS 복구 가능성 | - | `verify.yml` (strict) | 2026-06-10 상품 상세 500 전수조사 — 명시 목록 컬럼은 base CREATE ∪ repair-schema 로 반드시 복구 가능해야 함 (`check-product-detail-fields-repairable.mjs`). 소비자 products SELECT 는 `productDetailColsHealed`+`withColumnPruning` 자가치유 필수 |
| RQ initialData 신선도 | `check-query-initialdata.mjs` (warn) | `verify.yml` (strict) | 2026-06-17 잔액 '딜 부족' 오표시 — useQuery/useApiQuery 의 `initialData`(localStorage/SSR seed)가 `initialDataUpdatedAt`/`refetchOnMount:'always'` 없이 fresh 로 간주돼 cold mount refetch 누락 → 잘못된 0/null/옛값 노출. 둘 중 하나 필수(보통 `initialDataUpdatedAt: 0`). 의도적 예외는 옵션 객체에 `initialdata-check-ok` 주석 |
| group_buy_status 종류판별 | `check-groupbuy-status-classify.mjs` (warn) | `verify.yml` (strict) | 2026-06-18 쇼핑 상품이 교환권으로 오표시 — 핀 redirect 가 `group_buy_status==='active'` 로 종류 판별. `group_buy_status` 는 migration 0146 에서 **모든 상품 DEFAULT 'active'** → 쇼핑 상품까지 voucher 흐름 오분류 → `/group-buy`(교환권 chrome) 오라우팅. **종류 판별/라우팅은 `deal_only===1`(교환권) + `isVoucherCategory(category)`(오프라인 공구) SSOT 만**(`order-type.ts`/`voucher-categories.ts`); `group_buy_status` 는 공구 *수명주기*(joinable/deadline/count)에만. R1=voucher 이름 boolean←status, R2=status→`/group-buy`·`/vouchers` 라우팅 감지. 예외 `groupbuy-classify-ok` 주석 |
| 로그인 입력 글자 흰색(다크) | `check-light-input-guard.mjs` (warn) | `verify.yml` (strict) | 2026-06-20 `/admin/login` 등 타이핑 글자 흰색으로 안 보임 — 전역 `.dark input:not(...)`(특이도 0,5,1)가 다크모드에서 input 글자를 흰색으로 덮어씀(text-gray-900=0,1,0 짐). standalone 라이트 로그인/가입 페이지는 레이아웃 밖이라 `*-light-theme` 래퍼 없어 무방비. **신규 standalone 라이트 auth 페이지(로그인/가입/비번)는 루트 div 에 `force-light-theme` 클래스 추가**(CSS `!important` 가 다크 전역규칙 무력화). 의도적 예외는 `light-input-ok` 주석 |
| input 자기 className 흰 글자(라이트) | `check-input-text-color.mjs` (warn) | `verify.yml` (strict) + audit-gate | 2026-05-19 작성 → **2026-07-29 수리 후 최초 등록**. 위 가드의 짝이지만 층이 다르다 — 이쪽은 element **자기 className** 의 base 토큰에 `text-white` 와 `bg-white` 가 동시에 있는 경우(라이트에서 글자 안 보임). 원래 판정이 `\btext-white\b` 라 **`dark:text-white` 안에서도 매치**돼, CLAUDE.md 가 오히려 요구하는 정상 패턴(`bg-white … text-gray-900 dark:text-white`)을 위반으로 신고했다(실측 6건 전부 오탐). 켜면 정상 코드가 빨간불이 되니 아무도 못 켰고 2개월+ 미등록으로 방치됐다 → `check-theme-consistency` 와 같은 **variant-aware** 방식(`:` 포함 토큰 제외)으로 교정. 예외 `input-text-color-ok` 주석 |
| 배포-청크 자가복구(흰화면/무한로딩) | `check-chunk-recovery-guard.mjs` (warn) | `verify.yml` (strict) | 2026-06-30 `/admin`·`/agency` 무한로딩 — 새 배포마다 청크 해시 변경 → 캐시된 옛 index.html 이 삭제된 `/assets/*.js` 참조 → 404 → SPA HTML(text/html) 폴백 → "Expected JS module, got text/html" → 대시보드 안 켜짐(4번+ 재발). **자가복구 4불변식**: ① `index.html` 인라인 부트가드(엔트리 청크 실패까지) ② `chunk-error.ts` `isChunkLoadError`(MIME 변종 감지)+`reloadWithCacheBust`(`__cb`+`location.replace` — plain reload 회귀 금지) ③ `main.tsx` error/unhandledrejection 배선 ④ worker SPA 셸 HTML `no-cache`. 하나라도 빠지면 영구 흰화면. (참고: 실제 청크는 `_routes.json` 에서 worker exclude → Pages 직접 서빙, missing 시 HTML 404 → 클라 ②③ 가 근본복구. `not_found_handling`=none 설정 시 더 깔끔하나 대시보드 설정.) |
| 로더 연속성(로딩 2번 나뉨/블링크) | `check-loader-continuity.mjs` (warn) | `verify.yml` (strict) | 2026-07-02 대표 신고 "로딩 애니메이션 떴다 안떴다 다시" (세션 내 4회+ 반복 클래스). 콜드/SPA 진입 로더가 [정적→Suspense 청크→페이지 데이터] 여러 마운트인데, 재마운트가 CSS keyframe 0 재시작(breathe=로고 어두워짐, sweep=바 화면밖) 하면 같은 로더도 이중 로딩처럼 보임 + 상세가 카드 prefetch 무시하고 자체 fetch 하면 로더 노출 2배. **연속성 4불변식**: ① `BrandLoader` `performance.now()` 음수 delay 위상 전역동기(고정 200ms 금지) ② worker 상세 `#root` 정적 URDEAL 로더(blank 금지) ③ `GroupBuyDetailPage` `pickSeedDetail`+`qc.fetchQuery` dedupe(raw axios 회귀 금지) ④ 주기 상수 css(1.5s/1.15s)↔tsx(%1.5/%1.15) 동기. 주기 변경 시 양쪽+가드 함께 갱신 |
| 링크샵 소유권 단일화(내 가게인데 방문자로 보임) | `check-linkshop-ownership.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-07-07 대표 신고 "왜 계속 링크샵에서 이런 에러들이" — **반복 재발 클래스**. `/u/{handle}` 이 두 페이지 컴포넌트로 렌더(일반유저 `CuratorPage` / 사업자 인라인 `SellerPublicPage`)되는데 **소유자 판정 신호가 갈림**: CuratorPage=소비자 정체성(`user_id===curator.id`, 토큰 불필요) vs SellerPublicPage=별도 `seller_token` 요구. CuratorPage 가 소유권을 자식에 안 내려줘 카카오(소비자)로만 로그인한 주인이 **자기 가게를 방문자로** 봄(편집 전부 사라짐). **불변식: `/u/{handle}` 주인 = 로그인 소비자 유저(단일 신호). seller_token 은 셀러 대시보드(/seller/*) 전용 — 링크샵 뷰/편집 안 가름.** 편집은 소비자 API `/api/curator/me/*`. 3검사: ① CuratorPage→SellerPublicPage `ownerOverride` 전달 ② `isOwner = !!ownerOverride \|\| tokenOwner`(seller_token 단독 게이트 금지) ③ 순수 뷰 자식(CuratorHeader/InfoTab/Vouchers·VideosTab)은 prop 구동(seller_token 직접 read 금지). 설계 SSOT `docs/design/linkshop-role-model.md §5.5`. 예외 `linkshop-ownership-ok` |
| 카카오 OAuth iOS 쿠키 미영속 | `check-auth-cookie-pattern.sh` (warn) | `verify.yml` (strict) | 2026-06-20 사파리/카톡(iOS WebKit) 로그인 안됨 — **cross-site OAuth 콜백 302 응답의 Set-Cookie 를 iOS 가 미영속**(Chrome 정상=개발자 테스트선 안 보이고 iOS 만 조용히 깨짐). 역할토큰을 transfer 쿠키(`ur_pending_*`)로 넘기면 셀러/에이전시/판매사 대시보드 로그인 실패, 세션을 콜백 302 쿠키에 의존하면 소비자 로그인 실패. **역할토큰=fragment(`#auth=`, `worker/utils/pending-auth.ts`), 세션=`POST /api/auth/session/establish`(same-origin httpOnly), XHR(JSON) 로그인은 iOS-safe.** 우회 `[SKIP_AUTH_COOKIE_CHECK]` |
| 모바일 하단 네비 사라짐 (keyboard-open) | `keyboard-viewport.test.ts` (unit, **불변식**) | `verify.yml` (unit 실행) | 2026-06-22 모바일에서 하단 BottomNav 통째로 실종 — `main.tsx` 키보드 감지가 `vv.height<innerHeight-100`(뷰포트 100px 축소)만으로 `body.keyboard-open` 토글 → `index.css` `body.keyboard-open .hide-on-keyboard{display:none}` 가 BottomNav 숨김. 주소창 토글/줌/데스크톱 창 변화에 오작동 + 키보드 닫힘 이벤트 누락 시 **stuck → 영구 실종**. 전역 버그라 페이지마다 고쳐도 안 잡힘. **수정: 판정을 `src/lib/keyboard-viewport.ts` 순수함수(`isKeyboardOpen`)로 분리 — 불변식 "편집요소(input/textarea/contenteditable) 미포커스 → 절대 열림 아님" + 120px 임계 + focusin/out·pageshow 재평가 + 열린 동안 1s 워치독(stuck 불가).** 키보드 감지 로직 수정 시 이 불변식 깨면 unit fail. |
| CSV/엑셀 수식 인젝션 | `check-csv-injection.mjs` (warn) | `verify.yml` (strict) | 2026-06-26 도매 CSV 내보내기 `csvEscape` 가 `= + - @` 탭/CR 선행 셀을 무력화 안 해, 셀러-제어 free-text(상품명/회사명/바코드)가 `=cmd\|'/c calc'!A1` / `=HYPERLINK(...)` 로 들어가면 판매사/어드민이 파일 열 때 실행. csvEscape 류 함수는 선행 작은따옴표 가드 필수. 예외 `csv-injection-ok` 주석 |
| 쿼리 fetch 에러가 빈화면/₩0 위장 | `check-query-iserror.mjs` (warn) | `verify.yml` (strict) | 2026-06-26 useWholesale* 훅이 에러를 빈배열로 안 삼키게 바뀐 뒤, 도매/제조사/도매-어드민 페이지가 `data` 만 읽고 `isError` 미사용 → 일시 5xx/네트워크 실패가 "데이터 0건"·"예치금 ₩0"·"승인 대기 없음"으로 오표시(판매사 재무 오인·승인큐 self-undo). 그 surface 의 data 소비 페이지는 `isError` 분기(+재시도) 필수. 예외 `iserror-check-ok` 주석 |
| 도매주문 상태 무결성(정의 밖 status) | `check-wholesale-order-status.mjs` (warn) | `verify.yml` (strict) | 2026-06-27 B2B 도매주문 상태머신 신설(`wholesale-order-status.ts` PENDING→PAID→ACCEPTED→SHIPPED→DONE + REJECTED/CANCELLED). `wholesale_orders.status` 는 free-form TEXT(CHECK 없음)라 오타/정의 밖 상태 write 가능 → 고아 상태(DONE/CANCELLED 처럼 UI엔 있는데 아무도 안 쓰던 것). canonical(`WHOLESALE_ORDER_STATUSES`) 밖 값을 `wholesale_orders SET status='X'`/`transitionWholesaleOrder(...,'X')` 로 쓰면 위반. 전이는 `transitionWholesaleOrder` CAS 경유. **동반 P0**: 도매 정산 성숙(`matureSupplierSettlements`)이 발송 여부 무관하게 시간만으로 지급되던 것 → 라인 `line_status='SHIPPED'` 게이트 추가. 예외 `wholesale-status-ok` 주석 |
| 가격으로 로그인 유도(로그인했는데 '로그인하세요') | `check-login-gate-by-price.mjs` (warn) | `verify.yml` (strict) | 2026-06-27 도매 상세/카탈로그가 `distributor_price == null`(가격 없음) 하나로 **로그인 여부**와 **가격 유무**를 동시 판단 → 로그인했는데 그 등급 공급가가 미설정/스테일이면 가격없음을 '로그아웃'으로 오판, 주문/담기 클릭 시 `goLogin()` 으로 쫓아냄. 표면별 패치(2026-06-19 표시만 고침)라 핸들러에서 재발. **로그인 유도는 `if (!token)` 로만**, 가격 null/0 은 '공급가 미설정 · 제조사 문의' 안내(redirect 금지). 도매 surface(`Wholesale*`/`Supplier*`/`supplier-dashboard`/`components/wholesale`)에서 가격-부재 조건이 `goLogin` 게이트하면 위반. 예외 `login-gate-ok` 주석. 같은 사건의 짝(모바일 하단 잘림)은 `StickyActionBar`(`components/ui/sticky-action-bar.tsx`) 자동 spacer 로 구조적 해소 |
| 모달/시트가 하단 네비 뒤로 가려짐 | `check-modal-zindex.mjs` (warn) | `verify.yml` (strict) | 2026-06-26 대표 "이 문제 계속 발생 — 근본적으로". 풀스크린 오버레이(`fixed inset-0 z-[N]`)를 `z-[100]`(FAB 대) 등 네비(`z-[9999]`) 아래로 달아 하단 네비가 모달/바텀시트(공구권 등록 시트 등) 위를 덮어 버튼이 안 보임. 새 모달 추가마다 재발 → 표준 스케일(`src/constants/z-index.ts`: 모달 10500 / 시트 10600 / 토스트 20000 / 확인창 100000) 강제. 23개 일괄 교정 후 strict. 예외(네비 숨김 화면 전용 등) `modal-zindex-ok` 주석 + `pointer-events-none` 자동 제외 |
| 대시보드 라우팅(다중역할/겸업 lock-out) | `check-seller-wholesale-redirect.mjs` (warn) | `verify.yml` (strict) | 2026-06-30 대표 신고 — `/seller` 들어가면 `/wholesale` 로 튕김. `SellerLayout` 이 `localStorage.is_distributor === '1'` 하나로 무조건 도매몰 redirect(마운트 effect + render 가드 2곳) → **소비자 셀러 + 판매사 겸업** 계정이 셀러 대시보드에서 영구 차단(기존 셀러가 `/become-distributor` 한 번만 해도 같은 셀러 행에 is_distributor=1 덧붙어 겸업이 됨). `is_distributor`=도매 *접근권*(capability)이지 도매 *전용*(exclusivity)이 아님(주석은 "겸업 영향 없음" 약속했으나 코드 미구현). **일반 룰(이 클래스 전체): 대시보드 레이아웃/페이지(`*Layout`·`*DashboardPage`·`Seller*`·`supplier-dashboard`)에서 가산 권한 플래그(`is_*`) 단독 게이트로 서비스간 redirect/`return null` 금지** — 셀러↔도매=서버 권위 `wholesale_only`(SSOT `computeWholesaleOnly`, 인증 `GET /api/seller/surface`), 또는 다중역할 보호 동반조건(`!loggedIn`/`!token`/단일역할 `role !==`). 게이트를 새 신호로 바꿔 기존 깨진 겸업 계정은 재로그인 없이 자동 치유. 예외 `seller-wholesale-redirect-ok`/`multi-role-redirect-ok` 주석 |
| 동네딜에 쇼핑 카테고리 유입(서비스 분리) | `check-dongnedeal-category.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-07-02 대표 신고 `/admin/dongnedeal-import` — 동네딜(매장 이용권) 어드민이 `general`(일반 온라인 쇼핑, 별칭 `온라인`/`일반 상품`)을 통계/목록 `category IN(…,'general')`·별칭 매핑·데모 시드(`cat:'general'` 드립백/한라봉)·클라 옵션에 끌어들여 **쇼핑 상품이 동네딜에 노출·생성**. 동네딜=이용권 4종(`VOUCHER_CATEGORIES`) 전용이고 소비자 동네딜 피드(group-buy-public)도 general 제외 → 서비스 분리(쇼핑↔동네딜) 위반. **룰: 동네딜 카테고리 배열/별칭 값/데모 cat/`<option value>` 에 voucher 4종 외(특히 general) 금지.** 동반: `ProductRepository`(findAll/count/FTS)+자동완성에 `NOT (category='general' AND seller_id IS NULL)` — 셀러 없는 orphan general(옛 데모)이 소비자 쇼핑에 뜨던 것 배제. 예외 `dongnedeal-category-ok` 주석 |
| god 파일 재발(페이지/라우트 비대화) | `check-file-size.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-06-29 대표 "리팩토링 반복 말고 애초에 막아라". 페이지/라우트가 "일단 여기에 한 블록 더" 누적으로 god 파일(MyVouchersPage 1296·GroupBuyListPage 1309…) → 사후 대규모 분해 필요. **래칫**: 신규 파일 600줄 초과 차단 + 기존 대형 파일은 `scripts/file-size-baseline.json`(현재 82개 동결)보다 **커지면 차단**(줄이는 건 OK). 줄인 뒤 `node scripts/check-file-size.mjs --rebaseline` 로 동결값 갱신. 분해법: 카드·모달·섹션·핸들러群을 같은이름 폴더(`foo-list/`)로 추출(GroupBuyListPage→`group-buy-list/` 9개, MyVouchersPage→`my-vouchers/` 7개 선례). 예외 `file-size-ok` 주석 / `[SKIP_SIZE]` |
| DB 타임스탬프 KST 오표기(9시간 어긋남) | `check-utc-date-parse.mjs` (warn, 래칫) | `verify.yml` + audit-gate (strict) | 2026-07-27 어드민 '최근 활동' 전수조사 — D1 `CURRENT_TIMESTAMP`/`datetime('now')` 는 `'YYYY-MM-DD HH:MM:SS'`(UTC, **`Z` 없음**)라 브라우저 `new Date()` 는 **로컬(KST)로 오해석**하고, 워커(TZ=UTC)의 `.toLocaleString('ko-KR')` 은 **UTC 시각을 한국어로** 찍는다 → 어디서 보든 9시간 어긋남. 실사고 4건: 연속 주문 감지(`Math.abs(now-orderTime)<60000`)가 9h 차이로 **영구 미발동**(AdminPage) · 고객 **알림톡 주문일시** 9h 이름(alimtalk-auto) · 셀러 **주문 날짜필터** 경계 누락(SellerOrdersPage — date input 은 UTC 자정, created_at 은 로컬 오해석으로 규약 혼재) · **교환권 만료일 안내 메일**이 하루 이름(group-buy.routes). 같은 포맷터를 페이지마다 손으로 다시 짜는 중복(AdminInfluencerPoolPage 등)도 이 클래스. **SSOT = `src/utils/date.ts`** — `parseUTCDate`(UTC-naive/ISO-Z 양쪽 처리) · `formatKST`/`formatKSTDate`/`formatKSTTime`/`formatKSTShort` · 날짜 입력 경계는 `kstDayStartMs`/`kstDayEndMs`(서버 `DATE(created_at,'+9 hours')` 와 동일 규약). 옵션 객체를 유지해야 하면 `parseUTCDate(x).toLocaleString(loc, { timeZone: 'Asia/Seoul', ... })`. 규칙 A(어디서든 `new Date(x.created_at).toLocale*` 금지) + 규칙 B(pages/components/hooks 는 비교·정렬까지 금지 — 브라우저 TZ 에 따라 결과가 달라짐). 래칫 `scripts/utc-date-baseline.json`: 신규/증가만 차단(줄이는 건 OK, 정리 후 `--rebaseline`). **서버/워커측 잔여 0**, 클라 87건 동결 = 점진 정리 대상. 예외 `utc-date-ok` 주석 |
| 블로그 시드 최신성(낡은 명칭/기능 재유입) | `check-blog-seed-currency.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-07-01 대표 신고 "블로그가 자동으로 안 고쳐짐". 소비자 블로그(`/blog`) 시드는 `blog.routes.ts` `blogSeedPosts()` + `BLOG_SEED_VERSION` 버전 재시드(관리자 수동편집=`manually_edited=1` 보존). 시드가 폐기 명칭(식사권/공구권/인플루언서/큐레이터)·영구중단 기능(라이브커머스/라이브방송/쇼츠)·도매몰(유통스타트/판매사/제조사) 내용으로 되돌아가면 라이브 블로그가 다시 낡아짐. **서비스 사실 바뀌면 시드 고치고 `BLOG_SEED_VERSION` +1**(안 올리면 라이브 미반영). 상세: 위 "📝 블로그 시드 자동 업데이트" 섹션. 예외 `blog-currency-ok` 주석 |

| pagination NaN 크래시(비숫자 page/limit) | `check-pagination-nan.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-07-01 도매몰 라이브 전수조사 — `GET /api/wholesale/catalog?page=abc&limit=xyz` → **HTTP 500**. `Math.max(1, parseInt(q('page')\|\|'1',10))` 가 비숫자 query 에 `parseInt('abc')=NaN → Math.max(1,NaN)=NaN → offset=(NaN-1)*limit=NaN → D1 .bind(NaN)` 크래시. 문자열 기본값('1')은 query *부재* 시에만 쓰여 NaN 을 못 막음(음수/거대값/빈값은 이미 200 정상 — **비숫자 문자열만** 500 → 봇/스크래퍼/오염 링크가 도매몰 메인 카탈로그·소비자 동네딜 등 목록을 크래시). 전 서비스 동일 클래스(도매·소비자·에이전시·어드민·셀러 100+ 라인) 일괄 수정. **규칙(강)**: request 의 page/limit/offset/days 등 정수 파싱은 **반드시 `intParam(raw, 기본값)`(`@/shared/pagination`) 경유** — NaN/부재→기본값, 0/음수는 보존해 호출부 `Math.max/Math.min` 클램프에 위임. 순진한 `parseInt(...) \|\| N` / `Number(x \|\| N)` 은 **0 을 삼켜** min-클램프(limit=0→1)를 깨고 inner/outer 폴백 혼동을 유발하므로 금지. ID 해석용 parseInt(numId 등)는 `isNaN` 가드 보유라 무관. 예외 `pagination-nan-ok` 주석 |

| 도매 공급가 모델 드리프트(폐기 함수) | `check-deprecated-pricing.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-07-01 도매 3표면 감사 — 상품 엑셀 **내보내기**가 폐기 모델 `distributorPriceFromRetail`(판매가×(1−보장마진)·등급차등)을 써, 라이브 결제가(`resolveDistributorPrice` cost-plus·전등급동일, 2026-06-17 대표확정)와 **전혀 다른 A/B/C 등급가**를 제안문서로 냈음(상거래 분쟁 소지). 같은 "판매사 공급가"를 두 함수로 계산 → 모델 드리프트. **규칙**: 도매 공급가는 `resolveDistributorPrice`(SSOT) 하나로만. `@deprecated` `distributorPriceFromRetail`/`distributorPrice` 직접호출 금지(정의부 `distributor-pricing.ts`·테스트·`deprecated-pricing-ok` 주석 예외) |
| 잔액 컬럼 절대값 write(비원자) | `check-balance-absolute-write.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-07-01 도매 3표면 감사 — 미수금 상환이 `SELECT outstanding → JS 계산 → UPDATE SET outstanding_balance=?`(절대값)라 동시 상환 2건이 같은 prevOut 을 읽어 하나가 덮어써 **미수금 과대계상**(플랫폼 채권 부풀림·판매사 손해, 머니 룰 #1 위배). **규칙**: `*balance*` 컬럼은 원자 증감(`x=x±?`·MAX/MIN/COALESCE) 또는 CAS(`WHERE x=?`)로만 — 한 UPDATE 에서 balance 컬럼 2회+ 등장. 스냅샷 `*_after`·테스트·`balance-write-ok` 예외 |
| 커미션 예산 아비터 우회 [INV-CB] | `check-commission-budget.mjs` | `verify.yml` + audit-gate (strict) | 2026-07-04 재원 구조 개편 — 플랫폼 부담 성장 커미션(어필리에이트/멀티티어/영입자/에이전시)이 캡 없이 스택되어 트리 경유 최악 −14%. 적립은 `creditOrderCommissions`(오케스트레이터) 경유만 — 3P 주문당 예산(수수료−PG준비금) 비례 배분, 게이트 `commission_budget_enabled`(기본 OFF). 직접 호출/신규 적립 INSERT 차단(래칫 베이스라인). 설계 `commission-funding-restructure.md` |
| KV delete 무료한도 폭식 | `check-kv-delete-budget.mjs` (warn) | `verify.yml` + audit-gate (strict) | 2026-07-21 대표 신고 — Cloudflare "Daily Workers KV delete limit exceeded"(무료 1천 delete/일 초과). `cacheGet`(worker/utils/cache.ts) L2 KV 쓰기는 2026-06-04 에 무료한도 보호로 OFF(`L2_KV_ENABLED=false`, 엣지캐시+L1 대체)인데 삭제 경로 `cacheInvalidate` 만 살아 **KV 에 존재하지도 않는 키를 매 무효화마다 삭제** → `invalidateGroupBuyProductsCache` 1회 = 28 KV.delete(4 status × 7 category), 셀러/어드민 상품·주문 흐름마다 발생 → 한도 폭식. **불변식**: ① `cacheInvalidate` 의 KV.delete 는 반드시 `L2_KV_ENABLED` 게이트 뒤(쓰기 경로와 대칭 — L2 OFF 면 지울 키 없음) ② 그 외 fan-out KV.delete(`arr.map/forEach(...=> <kv>.delete)`) 무방비 추가 금지(1회 N delete = 폭식 근본 클래스). 단발 KV.delete(저빈도)·Cache API(`caches.default`, 무료·무제한)·`*_ENABLED` 게이트·`kv-delete-ok` 주석은 예외. 복원: `L2_KV_ENABLED=true` |
| 선언한 URL 이 라이브에서 죽음(예열/색인) | - | `live-contracts.yml` (**주기 실행 전용 — PR 게이트 아님**) | 2026-07-29 — 이 레포는 URL 목록을 **코드에 선언**한다: 예열 `HOT_PATHS` · SSR 워밍 `SSR_KV_PATHS` · 색인 `sitemap.xml`. 정적 가드(`check-sitemap-routes`)는 **라우트가 존재하는가**만 보는데, 번들 분리(`__INCLUDE_WHOLESALE__`)·기능 폐기·배포 상태 때문에 라우트가 있어도 실제로는 죽을 수 있다. 실측: `HOT_PATHS` 31개 중 **9개가 404**(도매 5·라이브 3·쇼츠 1) + sitemap 죽은 URL 3종. **예열은 실패해도 조용히 넘어가므로**(`if (res.ok)`) 몇 달간 신호가 0 이었고, 그 낭비가 서브리퀘스트 예산(무료 50/인보케이션, 실측 ≈49)을 갉아 **다른 경로의 예열 실패**로 이어지고 있었다. `check-live-contracts.mjs` 가 선언을 추출해 실제로 두드린다. **robots.txt 는 본문까지 대조**한다 — 2026-07-29 실측에서 `live.ur-team.com/robots.txt` 가 **Cloudflare Managed robots.txt** 로 통째 대체돼 레포 규칙 51줄 중 50줄과 `Sitemap:` 이 **서빙되지 않고 있었다**(그러면 `check-robots-private-routes` 는 초록인데 크롤러는 다른 파일을 본다 — 가드가 지키는 대상이 현실에 없는 경우). **판정**: 200 통과 · **같은 경로로의 3xx 통과**(live.ur-team.com→urdeal.kr 영구 301 은 정상 계약) · **경로가 바뀌는 3xx 는 실패**(`/group-buy → /` 를 이렇게 잡았다) · 오리진 전체가 동일 실패면 환경 조건으로 보고 스킵(프록시 CONNECT 차단은 status 0 이 아니라 **403 응답**으로 온다). ⚠️ **PR 게이트로 승격 금지** — 외부 네트워크 의존이라 간헐 실패가 머지를 막는다. ⚠️ 동시성을 올리면 중계 구간이 503 을 뿌려 **멀쩡한 URL 이 죽은 것처럼 보인다**(4-way 실측에서 가짜 503 12건) → 동시성 2 + 3회 재시도 고정 |
| 구 도메인이 사용자 표면에 남음 | `check-legacy-domain.mjs` (warn) | `verify.yml` (strict) + audit-gate | 2026-07-29 — 정본이 `urdeal.kr` 로 옮겨졌고(07-20) 구 `live.ur-team.com` 은 **전 경로 영구 301** 이다. 그런데 이전은 리다이렉트를 거는 것으로 끝나지 않는다 — 코드에 박힌 문자열은 그대로 남는다. 실측: **결제 완료 직후 넛지**가 소비자에게 *"이미 `live.ur-team.com/u/{handle}` 링크샵이 준비돼 있어요"* 를 보여주고 있었다(2026-07-03 배선 당시 문자열). 링크는 301 로 도착하니 **에러가 안 나고**, 그래서 아무도 몰랐다. 사용자에게 보이는 표면(`src/pages`·`src/components`·`src/features`·`src/shared`·`public/locales`)만 검사한다. ⚠️ **이전을 *구현하는* 코드는 건드리지 말 것** — 워커 호스트 집합(`CONSUMER_FAST_PATH`/`LEGACY_CONSUMER_HOSTS`)은 301 을 수행하고, `ALLOWED_ORIGINS` 의 구 오리진은 전환기 동안 구 SPA 세션·토스 웹훅이 들어오는 자리라 소스 주석이 "제거하지 말 것"이라고 명시한다(둘 다 면제). `media.ur-team.com`(R2)·`@ur-team.com`(이메일)은 사이트 도메인이 아니라 무관. ⚠️ 검사 대상 파일이 0개면 **통과가 아니라 실패**(경로가 낡아 조용히 비는 것 차단). 예외 `legacy-domain-ok` 주석 |

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
