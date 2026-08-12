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
 * 연결이 아직 백필 안 된 계정을 위해 **같은 이메일 폴백**도 본다 — 링크샵/셀러 페이로드
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
