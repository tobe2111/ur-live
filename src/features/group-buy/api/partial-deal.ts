/**
 * 🪙 이용권 부분결제 — **딜로 일부, 카드로 나머지** (2026-09-01 대표 지시).
 *
 * > "이용권에 딜로도 결제되게끔 해줘. 예를들어 10000원짜리 이용권이면 3000 딜이 있으면
 * >  포인트 차감처럼 쓰는거지."
 *
 * ## 오늘까지 왜 안 됐나
 * 이용권 레일은 **전부-딜**(`/join` payment_method='deal', `balance >= totalAmount`) 아니면
 * **전부-카드**(`/confirm-toss`) 둘 중 하나였다. 3,000딜을 가진 사람이 10,000원 이용권을 사려면
 * 그 딜은 **쓸 데가 없다**. (혼합결제 자리는 쇼핑 레일 `orders.deal_used` 에만 있었다.)
 *
 * ## 설계 — 금액이 곧 계약이다
 * 딜 사용액을 클라이언트가 따로 보내지 않는다. **실제 청구액에서 역산**한다:
 *
 *     딜 사용액 = 상품 총액 − 카드 청구액
 *
 * 그래서 "카드로 낸 돈 + 딜로 낸 돈 = 상품값" 이 **구조적으로** 성립한다 — 클라가 보낸 숫자를
 * 믿고 더하는 게 아니라, 서버가 아는 총액에서 빼는 것이라 조작할 자리가 없다.
 * 청구액이 총액과 같으면 딜 사용 0 = **오늘과 완전히 동일한 경로**다.
 *
 * ## 정산은 안 바뀐다
 * 매장에는 **상품 총액 기준**으로 정산한다(`orders.total_amount` = 총액, `deal_used` = 딜 분).
 * 딜은 유저가 이미 현금으로 충전한 돈이라, 대표 말대로 *"원래 정산을 해줬어야 하는 돈"* 이다.
 *
 * ## 게이트 — 그리고 그 앞에 오는 것
 * `platform_settings.voucher_partial_deal_enabled` (기본 OFF). 꺼져 있으면 딜 사용액은 항상 0 이고,
 * 총액과 다른 청구액은 종전처럼 `AMOUNT_MISMATCH` 로 막힌다.
 *
 * 🔴 **켜기 전에 `influencer_deal_bonus_pct` 가 0 이어야 한다.** 그 값의 시드 기본이 **20** 이라
 * (인플루언서가 딜로 정산받으면 20% 더 붙는다) **딜 1,000원은 유어딜에게 1,200원짜리 부채**다.
 * 그 딜이 마진 5~10%인 이용권으로 흘러가면 **팔릴수록 적자**다 — 교환권은 소비자 마크업 20%가
 * 그 보너스를 상쇄해 왔지만 이용권엔 그 상쇄가 없다. 절차: `docs/STAGING_CHECKLIST.md` §S12 선행.
 */
import type { D1Database } from '@cloudflare/workers-types'

/** 부분결제 스위치 (platform_settings, 기본 OFF). */
export const PARTIAL_DEAL_SETTING = 'voucher_partial_deal_enabled'

/**
 * 카드로 최소한 얼마는 나가야 하는가.
 * 0원 결제는 PG 가 거절한다 — 딜이 총액을 다 덮으면 그건 부분결제가 아니라 **전부-딜**이고,
 * 그 흐름은 이미 `/join` payment_method='deal' 이 처리한다.
 */
export const MIN_CARD_AMOUNT = 100

export interface PartialDealPlan {
  /** 상품 총액 (정산·커미션의 기준 — 딜을 써도 안 줄어든다) */
  totalAmount: number
  /** 이 결제에서 딜로 내는 금액 */
  dealUsed: number
  /** 카드로 청구할 금액 */
  cardAmount: number
}

/**
 * 얼마를 딜로 낼 수 있는지 계산한다 — **순수함수**(DB 무접촉, 테스트 대상).
 *
 * `requested` 를 안 주면 **가진 딜을 최대한** 쓴다(포인트 차감의 통상 동작).
 * 무상/유상 어느 버킷에서 빠지는지는 여기서 안 정한다 — 차감은 `adjustUserPoints` SSOT 가
 * 항상 **무상 우선**으로 처리한다(약관 강제, point-buckets.ts).
 */
export function planPartialDeal(input: {
  enabled: boolean
  totalAmount: number
  balance: number
  requested?: number | null
}): PartialDealPlan {
  const total = Math.max(0, Math.round(Number(input.totalAmount) || 0))
  const none: PartialDealPlan = { totalAmount: total, dealUsed: 0, cardAmount: total }
  if (!input.enabled) return none

  const balance = Math.max(0, Math.floor(Number(input.balance) || 0))
  // 카드 최소액을 남겨 둔다 — 전부-딜은 별도 흐름이다.
  const cap = Math.max(0, total - MIN_CARD_AMOUNT)
  const wanted = input.requested == null ? balance : Math.max(0, Math.floor(Number(input.requested) || 0))
  const dealUsed = Math.min(wanted, balance, cap)
  if (dealUsed <= 0) return none
  return { totalAmount: total, dealUsed, cardAmount: total - dealUsed }
}

/** 게이트 조회 — 키 부재/조회 실패는 전부 OFF(모르면 안 바꾼다). */
export async function isPartialDealEnabled(DB: D1Database): Promise<boolean> {
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(PARTIAL_DEAL_SETTING).first<{ value: string | null }>()
    return String(row?.value ?? 'false') === 'true'
  } catch {
    return false
  }
}

/** 현재 딜 잔액 (행 없음/조회 실패 → 0). */
export async function getDealBalance(DB: D1Database, userId: string | number): Promise<number> {
  try {
    const row = await DB.prepare('SELECT COALESCE(balance, 0) AS b FROM user_points WHERE user_id = ?')
      .bind(String(userId)).first<{ b: number }>()
    const b = Math.floor(Number(row?.b ?? 0))
    return Number.isFinite(b) && b > 0 ? b : 0
  } catch {
    return 0
  }
}

/** 게이트·잔액을 읽어 계획을 세운다 (결제 시작 화면용). */
export async function resolvePartialDealPlan(
  DB: D1Database,
  params: { userId: string | number; totalAmount: number; requested?: number | null },
): Promise<PartialDealPlan> {
  const enabled = await isPartialDealEnabled(DB)
  if (!enabled) return planPartialDeal({ enabled: false, totalAmount: params.totalAmount, balance: 0 })
  const balance = await getDealBalance(DB, params.userId)
  return planPartialDeal({ enabled: true, totalAmount: params.totalAmount, balance, requested: params.requested })
}

// ──────────────────────────────────────────────────────────────────────────────
// 결제 확정 경로 — 역산과 차감
// ──────────────────────────────────────────────────────────────────────────────

export type DerivedPartialDeal =
  | { ok: true; dealUsed: number }
  | { ok: false; error: string; code: 'AMOUNT_MISMATCH' | 'INSUFFICIENT_DEAL' }

/**
 * 실제 청구액에서 딜 사용액을 역산하고 검증한다 — **과금 전에** 부른다.
 *
 * 청구액 == 총액이면 딜 0 이고 게이트를 보지도 않는다(종전 경로 그대로).
 * 게이트가 꺼져 있는데 청구액이 총액과 다르면 종전처럼 `AMOUNT_MISMATCH`.
 *
 * 잔액 조회는 **안내용**이다 — 여기서 막으면 카드가 아예 안 긁힌다(승인 안 된 결제는
 * Toss 측에서 만료되므로 환불이 필요 없다). 진짜 판정은 승인 뒤 `spendPartialDeal` 의 원자 CAS 다.
 */
export async function derivePartialDeal(
  DB: D1Database,
  params: { userId: string | number; expectedAmount: number; chargedAmount: number },
): Promise<DerivedPartialDeal> {
  const dealUsed = Math.round(params.expectedAmount) - Math.round(params.chargedAmount)
  if (dealUsed === 0) return { ok: true, dealUsed: 0 }

  const mismatch = { ok: false as const, error: '결제 금액이 일치하지 않습니다', code: 'AMOUNT_MISMATCH' as const }
  if (!(await isPartialDealEnabled(DB))) return mismatch
  if (dealUsed < 0 || params.chargedAmount < MIN_CARD_AMOUNT) return mismatch
  if (await getDealBalance(DB, params.userId) < dealUsed) {
    return { ok: false, error: '딜 잔액이 부족합니다. 다시 시도해주세요', code: 'INSUFFICIENT_DEAL' }
  }
  return { ok: true, dealUsed }
}

/**
 * 딜을 실제로 뺀다 — **원자 CAS**(`guardBalance`). 여기가 진실이다.
 *
 * 실패하면 **결제를 통째로 취소**한다: 재고를 되돌리고 카드를 환불한다.
 * 카드만 긁히고 딜은 안 빠진 채 이용권이 나가면 그 차액은 그대로 미수다.
 * (재고 부족 때와 같은 처리 — 이 레일이 이미 쓰는 패턴.)
 *
 * 차감은 항상 **무상 딜 우선**이다(adjustUserPoints SSOT, 약관 강제).
 * 환불 역전은 `orders.deal_used` 를 읽는 `refundOrderFully` 가 대칭으로 처리한다.
 *
 * ❓ **웹훅이 또 빼지 않나?** — 안 뺀다. Toss 웹훅 `handlePaymentConfirmed` 는 맨 앞에서
 * `isAlreadyProcessed(orderNumber, 'PAID')` 로 즉시 return 하는데, 이 레일의 주문은 **처음부터
 * PAID 로** 들어간다. 설령 그 관문을 지나도 웹훅의 금액 검증이 `SUM(total_amount)`(=총액) vs
 * 웹훅 청구액(=카드분)을 비교해 불일치로 거부한다 — 관문이 두 겹.
 * ⚠️ **주문을 PENDING 으로 넣도록 바꾸면 이중차감이 생긴다**(웹훅이 `orders.deal_used` 를 읽어
 * 같은 금액을 또 뺀다). 그 INSERT 의 `'PAID'` 는 관례가 아니라 여기에 물려 있다.
 */
export async function spendPartialDeal(
  DB: D1Database,
  env: { TOSS_SECRET_KEY?: string },
  params: {
    userId: string | number
    dealUsed: number
    orderNumber: string
    paymentKey: string
    productId: number
    qty: number
    productName: string
  },
): Promise<{ ok: boolean }> {
  const { adjustUserPoints } = await import('../../../worker/utils/point-ledger')
  const spent = await adjustUserPoints(DB, {
    userId: String(params.userId),
    delta: -params.dealUsed,
    type: 'usage',
    guardBalance: true,
    orderId: params.orderNumber,
    description: `이용권 부분결제 딜 사용 (${params.productName})`,
  }).catch(() => ({ ok: false as const }))
  if (spent.ok) return { ok: true }

  await DB.prepare('UPDATE products SET stock = stock + ? WHERE id = ?')
    .bind(params.qty, params.productId).run().catch(() => null)
  try {
    const { cancelTossPayment } = await import('../../../worker/utils/toss-gateway')
    await cancelTossPayment({
      env, paymentKey: params.paymentKey,
      cancelReason: '딜 잔액 부족 자동 환불',
      idempotencyKey: `gb-card-deal-short-${params.paymentKey}`,
    })
  } catch { /* 취소 실패는 아래 false 로 알린다 — 호출부가 400 을 준다 */ }
  return { ok: false }
}

/**
 * 주문에 딜 사용분을 남긴다 — `refundOrderFully` 가 이 값을 읽어 복원하고 0 으로 소진한다(머니 룰 #2).
 * ⚠️ `orders.total_amount` 는 **총액 그대로** 둔다 — 딜을 써도 매장 정산은 안 줄어든다(딜도 유저가 낸 현금).
 */
export async function recordOrderDealUsed(DB: D1Database, orderId: number, dealUsed: number): Promise<void> {
  try {
    const { ensureOrdersDealUsed } = await import('../../../worker/utils/ensure-order-columns')
    await ensureOrdersDealUsed(DB).catch(() => {})
    await DB.prepare('UPDATE orders SET deal_used = ? WHERE id = ?').bind(dealUsed, orderId).run()
  } catch (e) {
    console.error('[partial-deal] deal_used 기록 실패 — 환불 시 딜 복원 안 됨', e)
  }
}

/**
 * 이미 뺀 딜을 되돌린다 — **주문 INSERT 가 실패한 구간 전용**.
 * 그 구간엔 `orders.deal_used` 가 없어 환불 헬퍼가 못 찾는다. 여기서만 복원할 수 있다.
 */
export async function restorePartialDeal(
  DB: D1Database,
  params: { userId: string | number; dealUsed: number; orderNumber: string },
): Promise<void> {
  try {
    const { refundDealPoints } = await import('../../../worker/utils/point-buckets')
    await refundDealPoints(DB, {
      userId: String(params.userId), amount: params.dealUsed, type: 'refund',
      ref: [params.orderNumber],
      description: `[환불] 발급 실패 딜 복원 (order:${params.orderNumber})`,
    })
  } catch (e) {
    console.error('[partial-deal] 딜 복원 실패 — 수동 개입 필요', e)
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// 환불 — 돌려줄 금액을 카드 몫과 딜 몫으로 나눈다
// ──────────────────────────────────────────────────────────────────────────────

/** 환불 분배. `card + deal` 은 **언제나** 요청한 환불액과 같다. */
export interface RefundSplit {
  /** 카드(Toss)에 취소 요청할 금액. 0 이면 아예 호출하지 않는다(0원 취소는 거절된다). */
  card: number
  /** 유저 지갑으로 되돌릴 딜. */
  deal: number
}

/**
 * 💸 **카드로 취소할 수 있는 건 카드로 긁은 만큼뿐이다.**
 *
 * 2026-09-04 실측 결함: `orders.total_amount` 에는 **총액**이 들어가고 카드 승인액은 그보다
 * `deal_used` 만큼 적은데, 환불이 총액을 취소 요청했다 → `EXCEED_CANCEL_AMOUNT` → 그 자리에서
 * 중단 → 상태 전이도 딜 복원도 도달 못 함. **딜을 섞어 산 고객은 환불을 아예 못 받았다.**
 *
 * ⚠️ 두 경로의 계산은 **일부러 다르다. 하나로 합치면 틀린다.**
 *   반품 경로가 복원할 때마다 `orders.deal_used` 를 **차감**하므로, `remainingDeal` 은 이미
 *   "아직 안 돌려준 딜" 이다. 전액 환불은 그 남은 걸 **다** 돌려줘야 하고(비례를 또 곱하면 과소),
 *   부분 환불은 **이번 환불분에 해당하는 만큼만** 돌려줘야 한다(다 주면 과다).
 */

/** 전액 환불 — 남아 있는 딜을 전부. 잔여 환불액을 넘지 않게만 클램프한다. */
export function splitFullRefund(input: { remainingDeal: number; refundAmount: number }): RefundSplit {
  const refund = Math.max(0, Math.round(Number(input.refundAmount) || 0))
  const remaining = Math.max(0, Math.round(Number(input.remainingDeal) || 0))
  const deal = Math.min(remaining, refund)
  return { card: Math.max(0, refund - deal), deal }
}

/**
 * 부분(반품) 환불 — 이번에 돌려주는 비율만큼의 딜.
 * 여러 번 반품해도 원래 `deal_used` 를 넘지 않는다(호출부가 매번 차감하고, 여기서도 클램프한다).
 */
export function splitPartialRefund(input: {
  remainingDeal: number; refundAmount: number; orderTotal: number
}): RefundSplit {
  const refund = Math.max(0, Math.round(Number(input.refundAmount) || 0))
  const remaining = Math.max(0, Math.round(Number(input.remainingDeal) || 0))
  const total = Math.max(1, Number(input.orderTotal) || 1)
  const deal = remaining > 0
    ? Math.min(remaining, refund, Math.round(remaining * Math.min(1, refund / total)))
    : 0
  return { card: Math.max(0, refund - deal), deal }
}

