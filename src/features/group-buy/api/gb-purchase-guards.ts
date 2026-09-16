/**
 * 🎟️ 유어딜 **소비자 공구** 구매 경로 가드 (순수/소단위) — 2026-08-12
 *
 * 🧱 서비스 축: **🎟️ 유어딜 공구(소비자)** 전용. 🏪 공구 서비스(운영자 몰)·🏭 도매몰 무접촉.
 *   (`group_buy_*` 라는 이름을 두 서비스가 공유하므로 축을 파일 머리에 박아 둔다 — CLAUDE.md §서비스 분리.)
 *
 * `group-buy.routes.ts` 는 이미 1,400줄 god 파일이라 **여기로 뺀다**(파일크기 룰).
 * 세 함수 전부 결제 확정 경로에서 불리므로, 각 함수의 실패 방향(fail-open/closed)을 주석에 명시한다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'

// ──────────────────────────────────────────────────────────────────────────────
// ⓪ 발급 알림 문구 — **교환권 ≠ 이용권**
// ──────────────────────────────────────────────────────────────────────────────
/**
 * 🏷️ 2026-08-12 수리: 카드 확정 경로의 구매자 알림이 `'🎟️ 교환권이 발급됐어요'` **고정 문구**였다.
 *   그런데 명칭 SSOT(`shared/product-flow.ts` §명칭 주의)는 둘을 명확히 가른다:
 *     교환권 = 기프티콘·KT(`deal_only=1`) → **딜 결제**
 *     이용권 = 식당·뷰티·숙박 매장권(`meal_voucher` 등) → **카드 결제**
 *   이 경로는 카드 결제라 나가는 것은 대부분 **이용권**인데 손님은 "교환권"을 받았다.
 *   같은 결제 한 건에서 **셀러 알림은 '이용권 판매(카드)'** 였으니, 양쪽이 서로 다른 이름으로 불렀다.
 *
 * ⇒ 상품이 실제로 무엇인지로 부른다. 카테고리가 있으면 "식사 이용권"처럼 종류까지 붙는다
 *   (`getVoucherShortLabel` — 2026-06-29 대표 확정 "{카테고리} 이용권" 형태).
 */
export function issuedVoucherLabel(p: { deal_only?: number | null; category?: string | null } | null | undefined): string {
  if (Number(p?.deal_only) === 1) return '교환권'
  return getVoucherShortLabel(p?.category)
}

// ──────────────────────────────────────────────────────────────────────────────
// ① 본인 공구 자기 참여 차단 — **네임스페이스 교정**
// ──────────────────────────────────────────────────────────────────────────────
/**
 * 🔴 2026-08-12 수리: 기존 판정은 `Number(product.seller_id) === Number(userId)` 였다.
 *   `seller_id` 는 **sellers.id**, `userId` 는 **users.id** — **다른 테이블의 일련번호**다.
 *   그래서 두 가지가 동시에 틀렸다:
 *     ⓐ 막아야 할 사람을 못 막는다 — 셀러 본인의 users.id 는 sellers.id 와 다르므로 그냥 통과.
 *        (이 가드의 목적인 "목표 조작"이 전혀 차단되지 않았다.)
 *     ⓑ 엉뚱한 사람을 막는다 — users.id 가 우연히 그 sellers.id 와 같은 숫자면 **무고한 구매자가 403**.
 *   두 방향 다 조용하다(에러가 안 난다). 실제 연결고리는 `sellers.linked_user_id` 뿐이다.
 *
 * 연결이 아직 백필 안 된 계정을 위해 **같은 이메일 폴백**도 본다 — 유어샵/셀러 페이로드
 * (`seller-public-payload.ts`)가 이미 쓰는 것과 같은 폴백이라 판정이 갈리지 않는다.
 *
 * @returns 이 유저가 그 상품의 **판매자 본인**이면 true.
 *
 * ⚠️ **fail-open** (조회 실패 → false). 이 가드가 막는 것은 목표 조작이고,
 *   fail-closed 로 두면 DB 순단이 **모든 구매를 막는다** — 손해의 크기가 비교가 안 된다.
 */
export async function isSelfOwnedGroupBuy(
  DB: D1Database,
  sellerId: number | string | null | undefined,
  userId: string | number | null | undefined,
): Promise<boolean> {
  const sid = Number(sellerId)
  const uid = String(userId ?? '').trim()
  if (!Number.isFinite(sid) || sid <= 0 || !uid) return false
  try {
    const row = await DB.prepare(
      `SELECT 1 AS hit FROM sellers s
        WHERE s.id = ?
          AND ( CAST(s.linked_user_id AS TEXT) = CAST(? AS TEXT)
             OR ( s.linked_user_id IS NULL AND s.email IS NOT NULL AND s.email != ''
                  AND EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND LOWER(u.email) = LOWER(s.email)) ) )
        LIMIT 1`,
    ).bind(sid, uid, uid).first<{ hit: number }>()
    return !!row
  } catch {
    return false
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ①-b 자기 링크로 자기가 사면 보상 없음 — **user id 와 seller id 양쪽 네임스페이스**
// ──────────────────────────────────────────────────────────────────────────────
/**
 * 💸 2026-09-02 대표: *"자신의 고유링크로 이용권 구매했을 때 보상이 되면 안돼."*
 *
 *   `/join` 의 `?ref=` 는 **sellers.id 와 users.id 둘 다** 허용한다(존재 검증이 두 테이블 UNION).
 *   기존 자기-귀속 차단은 `ref === userId` 문자열 비교 하나였다 — 유어샵 핀 링크(`?ref={users.id}`)는
 *   막히지만, **사업자 유저가 자기 sellers.id 를 ref 로 쓰고 소비자 계정으로 사면** 두 id 가 다른
 *   숫자라 통과했다. 그러면 인플 커미션(자기에게)과 사용자 보너스(자기에게)가 **둘 다** 나간다.
 *   ①의 네임스페이스 사고와 같은 뿌리다(`sellers.linked_user_id` 만이 연결고리).
 *
 * @returns ref 가 이 구매자 **본인**(같은 users.id, 또는 본인에게 연결된 sellers.id)이면 true.
 *
 * ⚠️ **fail-closed** (조회 실패 → true = 귀속을 버린다). ①과 반대 방향인 이유: ①은 fail-closed 면
 *   **구매 자체**가 막히지만, 여기서 버려지는 것은 **보상 귀속**뿐이다(구매는 그대로 진행).
 *   돈이 새는 쪽(모르는데 지급)보다 안 주는 쪽이 싸다. 호출부의 존재 검증도 같은 방향이다.
 */
export async function isSelfReferral(
  DB: D1Database,
  ref: string | number | null | undefined,
  userId: string | number | null | undefined,
): Promise<boolean> {
  const r = String(ref ?? '').trim()
  const uid = String(userId ?? '').trim()
  if (!r || !uid) return false
  if (r === uid) return true
  const sid = Number(r)
  if (!Number.isFinite(sid) || sid <= 0) return false
  try {
    const row = await DB.prepare(
      `SELECT 1 AS hit FROM sellers s
        WHERE s.id = ?
          AND ( CAST(s.linked_user_id AS TEXT) = CAST(? AS TEXT)
             OR ( s.linked_user_id IS NULL AND s.email IS NOT NULL AND s.email != ''
                  AND EXISTS (SELECT 1 FROM users u WHERE u.id = ? AND LOWER(u.email) = LOWER(s.email)) ) )
        LIMIT 1`,
    ).bind(sid, uid, uid).first<{ hit: number }>()
    return !!row
  } catch {
    return true
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ② 주문번호 = **토스가 아는 그 주문번호**
// ──────────────────────────────────────────────────────────────────────────────
/**
 * 🔴 2026-08-12 수리: `/join` 이 `generateTossOrderId('GB', …)` 로 만들어 토스에 넘긴 orderId 와,
 *   `/confirm-toss` 가 주문 행에 저장하던 `GB-{user}-{Date.now()}` 는 **서로 다른 값**이었다
 *   (같은 *모양*이라 눈으로는 구분이 안 된다 — 타임스탬프만 다르다).
 *
 *   그런데 토스 웹훅은 `data.orderId` 로 `orders.order_number` 를 찾는다
 *   (`webhook.routes.ts` — *"This is our order_number"*). 값이 다르니 **웹훅이 이 주문을 영영 못 찾는다**:
 *   결제 취소·상태 변경·정산 알림이 전부 이 주문을 비켜 간다. 실패가 아니라 **부재**라 아무도 몰랐다.
 *
 * ⇒ 토스가 승인 응답에 되돌려준 `orderId` 를 그대로 주문번호로 쓴다(= 토스가 권위).
 *   모양이 토스 규격(영숫자/-/_ 6~64자) 밖이면 폴백 — **잘못된 값을 저장하느니 연결이 없는 편이 낫다**
 *   (지금까지가 그 상태였으므로 폴백은 현행과 동일하고, 더 나빠지지 않는다).
 */
export function resolveGbOrderNumber(
  tossOrderId: string | null | undefined,
  requestOrderId: string | null | undefined,
  userId: string | number,
): string {
  for (const cand of [tossOrderId, requestOrderId]) {
    const s = String(cand ?? '').trim()
    if (/^[A-Za-z0-9_-]{6,64}$/.test(s)) return s
  }
  return `GB-${String(userId).replace(/[^A-Za-z0-9]/g, '').slice(0, 24)}-${Date.now()}`
}

// ──────────────────────────────────────────────────────────────────────────────
// ③ 가상계좌(무통장입금) — **입금 전에 발급하지 않는다**
// ──────────────────────────────────────────────────────────────────────────────
export interface AwaitingDepositBlock { error: string; code: string }

interface AwaitingDepositCtx {
  paymentKey: string
  orderNumber: string
  userId: string
  productId: number
  sellerId: number | null
  amount: number
}

/**
 * 🔴 2026-08-12 신설. 토스 승인 응답의 `status` 가 `WAITING_FOR_DEPOSIT` 이면 **아직 돈이 안 들어왔다.**
 *   그런데 `/confirm-toss` 는 status 를 보지 않고 곧장 교환권을 발급했다 — 가상계좌를 켜는 순간
 *   **입금 없이 이용권이 나간다**(소비자 결제 `/confirm` 은 2026-07-01 에 같은 구멍을 막았고, 공구만 남아 있었다).
 *
 * ## 왜 "웹훅에 맡기고 대기"가 아니라 **취소**인가
 * 소비자 주문은 입금 웹훅(`handlePaymentConfirmed`)이 확정을 완결하지만,
 * **웹훅에는 공구 교환권 발급 코드가 한 줄도 없다**(`INSERT INTO vouchers` 0건 — 실측).
 * 즉 입금을 기다리게 두면 **입금은 됐는데 교환권은 영원히 안 나오는** 주문이 생긴다.
 * 그래서 지금 할 수 있는 정직한 처리는 **가상계좌를 취소하고 카드로 안내**하는 것뿐이다.
 *
 * > 📌 가상계좌를 정식 지원하려면 **웹훅에 공구 교환권 발급을 배선**하는 별도 작업이 선행돼야 한다.
 * >   그 전까지 이 함수가 문이다.
 *
 * 부수: 취소 성공 여부와 무관하게 **흔적 주문 행**을 남긴다(`AWAITING_PAYMENT`).
 *   남기지 않으면 취소가 실패했을 때 그 결제는 어드민에서 **아무 데도 안 보이는 고아**가 된다.
 *
 * @returns 막아야 하면 사용자 메시지, 가상계좌가 아니면 `null`(정상 카드 흐름 그대로 — byte-불변).
 */
export async function guardAwaitingDeposit(
  env: { DB: D1Database; TOSS_SECRET_KEY?: string },
  toss: { status?: string } | null | undefined,
  ctx: AwaitingDepositCtx,
): Promise<AwaitingDepositBlock | null> {
  if (String(toss?.status ?? '') !== 'WAITING_FOR_DEPOSIT') return null
  const DB = env.DB

  // 흔적 주문 — idempotency_key(=paymentKey) UNIQUE 라 새로고침 재시도에도 1행.
  await DB.prepare(
    `INSERT OR IGNORE INTO orders
       (order_number, user_id, seller_id, subtotal, shipping_fee, discount_amount, total_amount,
        currency, status, payment_method, payment_key, idempotency_key)
     VALUES (?, ?, ?, ?, 0, 0, ?, 'KRW', 'AWAITING_PAYMENT', 'toss', ?, ?)`,
  ).bind(ctx.orderNumber, ctx.userId, ctx.sellerId, ctx.amount, ctx.amount, ctx.paymentKey, ctx.paymentKey)
    .run().catch(() => null)

  let cancelled = false
  try {
    const { cancelTossPayment } = await import('../../../worker/utils/toss-gateway')
    await cancelTossPayment({
      env,
      paymentKey: ctx.paymentKey,
      cancelReason: '가상계좌 미지원(공동구매) 자동 취소',
      idempotencyKey: `gb-va-unsupported-${ctx.paymentKey}`,
    })
    cancelled = true
    await DB.prepare("UPDATE orders SET status = 'CANCELLED' WHERE payment_key = ? AND status = 'AWAITING_PAYMENT'")
      .bind(ctx.paymentKey).run().catch(() => null)
  } catch (e) {
    console.error('[group-buy:confirm-toss] 가상계좌 자동 취소 실패', e)
  }

  if (!cancelled) {
    // 취소 실패 = **사람이 봐야 하는 상태**(계좌가 살아 있어 입금이 들어올 수 있다). 성공이면 조용히 지나간다.
    try {
      const { createDashboardNotification } = await import('../../notifications/api/dashboard-notifications.routes')
      await createDashboardNotification(
        DB, 'admin', null, 'payment_orphan',
        '🚨 공구 가상계좌 — 자동 취소 실패(입금 가능 상태)',
        `paymentKey=${ctx.paymentKey} / 주문 ${ctx.orderNumber} / 상품 ${ctx.productId} / 금액 ${ctx.amount}`,
        '/admin/orders',
      )
    } catch { /* best-effort */ }
  }

  return {
    code: 'VIRTUAL_ACCOUNT_UNSUPPORTED',
    error: cancelled
      ? '무통장입금(가상계좌)은 이용권 결제에 사용할 수 없습니다. 카드나 간편결제로 다시 시도해주세요.'
      : '무통장입금(가상계좌)은 이용권 결제에 사용할 수 없습니다. 발급된 계좌로 입금하지 마시고 고객센터로 문의해주세요.',
  }
}

/**
 * 💰 **이용권 딜 결제 게이트** (2026-08-31 대표 방향 · 기본 OFF).
 *
 *   join 의 상품 조회가 `voucher 카테고리 OR deal_only=1` 을 함께 매칭하기 때문에, 딜 경로는
 *   **원래부터 이용권도 받고 있었다** — 화면이 안 내놨을 뿐 직접 POST 하면 통했다.
 *   그래서 이 가드는 기능을 여는 스위치인 동시에 **그 열린 문을 닫는다.**
 *
 * 🔴 켜기 전 선행: `influencer_deal_bonus_pct` 를 0 으로. 보너스 20% 가 살아 있으면
 *   이용권 마진(5~10%)보다 보너스가 커서 **팔릴수록 유어딜이 건당 8~14원 적자**다.
 *   교환권(`deal_only=1`)은 소비자 마크업 20% 가 보너스를 상쇄해 괜찮았고, 이용권엔 그 상쇄가 없다.
 *   클라 `VOUCHER_DEAL_PAYMENT_ENABLED` 와 이중 게이트(`GB_ENGINE_ENABLED` 선례).
 *
 * @returns 허용이면 `true`. 교환권은 이 게이트와 무관하게 항상 `true`.
 */
export async function isVoucherDealPaymentAllowed(
  DB: D1Database,
  product: { deal_only?: number | null },
): Promise<boolean> {
  if (product.deal_only === 1) return true
  const gate = await DB.prepare(
    "SELECT value FROM platform_settings WHERE key = 'voucher_deal_payment_enabled'"
  ).first<{ value: string }>().catch(() => null)
  return gate?.value === 'true'
}

/**
 * 🛡️ 참여 자격 3가지 — 마감 / 종료·취소 / 바우처 만료. 전부 400 + 문구 하나라 한 함수로 모은다.
 *
 * 조건은 `group-buy.routes.ts` 에 있던 것을 **그대로** 옮겼다(2026-09-01, 파일 크기 래칫).
 * 판정 순서도 그대로다 — 마감을 참여보다 먼저 보는 것이 원래 의도였고(주석 명시), 만료일 가드는
 * 공구 마감 전에 바우처가 먼저 죽는 상품을 막는다.
 *
 * @returns 막아야 하면 안내 문구, 통과면 `null`.
 */
export function groupBuyJoinBlockReason(product: {
  group_buy_deadline?: string | null
  group_buy_status?: string | null
  voucher_expiry?: string | null
}): string | null {
  // 🗓️ 2026-09-04 (대표 "마감 개념은 없어"): 마감으로 구매를 막지 않는다.
  //   이용권은 모여야 열리는 공동구매가 아니라 즉시 구매다. 마감이 구매를 막으면 셀러가 옛날에
  //   넣어 둔 날짜 하나로 상품이 **안내도 없이 조용히 안 팔린다** — 라이브에서 실제로 그럴 뻔했다
  //   (유일한 실제 상품 2888 이 2026-09-10 부터 400 을 받을 예정이었다).
  //   `voucher_expiry ≤ deadline` 가드도 함께 없앤다: 마감이 아무것도 안 막는데 그 둘의 선후로
  //   발급을 막으면 근거가 사라진 규칙이 된다. 구매 후 사용 기간은 `voucher_expiry` 가 단독으로 맡는다.
  //   ⚠️ 남기는 것: 상태(expired/cancelled) 차단 — 그건 마감이 아니라 **사람이 내린 종료**다.
  if (product.group_buy_status === 'expired' || product.group_buy_status === 'cancelled') {
    return '종료된 공동구매입니다'
  }
  return null
}
