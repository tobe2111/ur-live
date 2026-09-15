/**
 * 🧺 이용권 장바구니 — 줄(line) 검증·가격 계산 (2026-09-15)
 *
 * 대표: *"장바구니쪽도 진행해줘. 끝까지 모두 다. 이용권 결제 플로우에 문제 없도록"*
 *
 * ## 왜 새 파일인가 — 발급을 소비자 orders 레일로 옮기지 않는다
 * 인계가 적어 둔 실측: **`INSERT INTO vouchers` 는 `group-buy.routes.ts` 와
 * `experience-campaign.routes.ts` 에만 있고, 소비자 `orders` 레일(`payment.routes /confirm` ·
 * `webhook.routes`)엔 0건이다.** 장바구니를 그 레일에 태우면 **결제는 되고 이용권은 안 나온다.**
 *
 * 그렇다고 발급을 그쪽으로 옮기면 Toss 감사-잠금 파일을 열어야 하고, 그 자리엔 한 상품당
 * 열 가지가 넘는 규칙(1인당 한도 · 리뷰 레벨 · 선착순 · 티어가 · 영입자 도장 · 재고 · 정산 · 알림)이
 * 이미 공구 레일에 살고 있다. ⇒ **반대로 간다** — 장바구니도 공구 레일에서 결제하고,
 * 그 규칙들을 **줄마다 그대로** 돌린다. 결과적으로 잠긴 파일은 한 글자도 안 건드린다.
 *
 * ## 이 파일이 지는 책임: **과금 전에 모든 게이트를 통과시키는 것**
 * 단일 구매는 게이트가 두 번 돈다(`/join` 사전검증 → `/confirm-toss` 과금 직전 재검증).
 * 장바구니도 같다. 다만 **한 줄이라도 막히면 전체가 막혀야 한다** — 일부만 사고 나머지는 실패하면
 * 사용자는 무엇을 샀는지 모르고, 우리는 부분 환불을 해야 한다.
 *
 * ⚠️ **fail-open 을 단일 경로에서 그대로 승계한다.** 한도·레벨 조회가 실패했다고 구매를 막지 않는다
 * (소프트 룰). 선착순만 fail-closed 다 — 그건 "당첨자만" 이라는 하드 룰이라 조회 실패 시 막는 게 맞다.
 */
import { maxTierDiscount } from './helpers'
import { isSelfOwnedGroupBuy } from './gb-purchase-guards'
import { isVoucherCategory } from '@/shared/constants/voucher-categories'

/** 한 번에 담을 수 있는 서로 다른 상품 수. 넘으면 서브리퀘스트 예산(무료 50)을 먹는다. */
export const MAX_CART_LINES = 10

export interface CartLineInput { productId: number; qty: number }

export interface PricedLine {
  productId: number
  qty: number
  /** 티어 할인 적용 단가 — 단일 구매(`/join`·`/confirm-toss`)와 **같은 계산**이다. */
  unitPrice: number
  subtotal: number
  discountPct: number
  name: string
  sellerId: number
  voucherExpiry: string | null
  category: string | null
}

export type CartLinesResult =
  | { ok: true; lines: PricedLine[]; totalAmount: number }
  | { ok: false; error: string; code: string; productId?: number }

interface ProductRow {
  id: number
  name: string
  price: number
  group_buy_status: string
  seller_id: number
  voucher_expiry: string | null
  group_buy_tiers: string | null
  category: string | null
  deal_only: number | null
  stock: number | null
}

/**
 * 클라가 보낸 줄을 정규화한다. 같은 상품이 두 줄로 오면 **합친다** — 안 합치면 1인당 한도 검사가
 * 줄마다 따로 돌아 한도를 우회한다(각 줄은 통과하는데 합계는 초과).
 */
export function normalizeCartLines(raw: unknown): CartLineInput[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const merged = new Map<number, number>()
  for (const r of raw) {
    const pid = Math.floor(Number((r as CartLineInput)?.productId))
    const qty = Math.floor(Number((r as CartLineInput)?.qty))
    if (!Number.isFinite(pid) || pid < 1 || pid > 1e10) return null
    if (!Number.isFinite(qty) || qty < 1 || qty > 100) return null
    merged.set(pid, (merged.get(pid) ?? 0) + qty)
  }
  if (merged.size > MAX_CART_LINES) return null
  const out: CartLineInput[] = []
  for (const [productId, qty] of merged) {
    if (qty > 100) return null   // 합치고 나서 한 상품이 100장을 넘으면 거절(단일 경로와 같은 상한)
    out.push({ productId, qty })
  }
  return out
}

/**
 * 줄마다 상품을 재검증하고 값을 매긴다. **돈이 오가기 전**에만 부른다(init 과 과금 직전 두 번).
 */
export async function priceCartLines(
  DB: D1Database, userId: string, input: CartLineInput[],
): Promise<CartLinesResult> {
  if (input.length === 0) return { ok: false, error: '장바구니가 비어 있습니다', code: 'EMPTY_CART' }
  if (input.length > MAX_CART_LINES) {
    return { ok: false, error: `한 번에 최대 ${MAX_CART_LINES}종까지 결제할 수 있습니다`, code: 'TOO_MANY_LINES' }
  }

  const ids = input.map(l => l.productId)
  const ph = ids.map(() => '?').join(',')
  // 🧱 서비스 분리: 도매 원본(`is_supply_product=1 AND supply_source_id IS NULL`)은 소비자 카탈로그에
  //    없어야 한다 — 목록 API 가 이미 거르지만 장바구니는 id 를 직접 받으므로 여기서도 막는다.
  const rows = await DB.prepare(
    `SELECT id, name, price, group_buy_status, seller_id, voucher_expiry, group_buy_tiers, category,
            deal_only, stock
       FROM products
      WHERE id IN (${ph}) AND is_active = 1
        AND NOT (COALESCE(is_supply_product,0) = 1 AND supply_source_id IS NULL)`,
  ).bind(...ids).all<ProductRow>().catch(() => null)
  const byId = new Map<number, ProductRow>((rows?.results ?? []).map(r => [Number(r.id), r]))

  // 메타(1인당 한도·리뷰 레벨)는 **한 번에** 읽는다 — 줄마다 조회하면 10줄에 10왕복이다.
  let meta: Map<number, Record<string, string>> | null = null
  try {
    const { getSupplyMeta } = await import('../../../worker/utils/product-supply-meta')
    meta = await getSupplyMeta(DB, ids)
  } catch { /* fail-open — 한도 조회 실패가 구매를 막지 않는다(단일 경로와 동일) */ }

  const { checkPerPersonLimit } = await import('../../../worker/utils/purchase-cap')
  const { checkFcfsPurchasable } = await import('../../../worker/utils/fcfs-gate')

  const lines: PricedLine[] = []
  let totalAmount = 0

  for (const { productId, qty } of input) {
    const p = byId.get(productId)
    if (!p) return { ok: false, error: '판매 중이 아닌 상품이 있습니다', code: 'PRODUCT_UNAVAILABLE', productId }

    // 🎟️ 이용권/교환권만 — 배송 상품은 이 레일이 아니다(발급이 아니라 배송이 필요하다).
    const isVoucher = Number(p.deal_only) === 1 || isVoucherCategory(p.category)
    if (!isVoucher) return { ok: false, error: '이용권이 아닌 상품이 있습니다', code: 'NOT_VOUCHER', productId }

    if (p.group_buy_status === 'expired' || p.group_buy_status === 'cancelled') {
      return { ok: false, error: `종료된 공동구매가 있습니다 (${p.name})`, code: 'GB_CLOSED', productId }
    }
    if (await isSelfOwnedGroupBuy(DB, p.seller_id, userId)) {
      return { ok: false, error: '본인 상품은 구매할 수 없습니다', code: 'SELF_PARTICIPATION_BLOCKED', productId }
    }

    // 🧾 1인당 한도 — 단일 경로와 **같은 함수**(두 벌이면 한쪽만 고쳐져 그 틈으로 초과가 통과한다).
    try {
      const lim = await checkPerPersonLimit(DB, productId, userId, qty, meta?.get(productId)?.max_per_person)
      if (!lim.ok) return { ok: false, error: `${p.name}: ${lim.error}`, code: 'PER_PERSON_LIMIT', productId }
    } catch { /* fail-open */ }

    // 🗺️ 동네 리뷰어 레벨 게이트
    try {
      const mrlRaw = meta?.get(productId)?.min_review_level
      const need = mrlRaw != null && Number.isFinite(Number(mrlRaw)) && Number(mrlRaw) > 1 ? Math.floor(Number(mrlRaw)) : 0
      if (need > 0) {
        const { getUserReviewLevelValue } = await import('../../../worker/utils/review-level')
        const myLevel = await getUserReviewLevelValue(DB, String(userId))
        if (myLevel < need) {
          return { ok: false, error: `${p.name}: 동네 리뷰어 Lv.${need} 전용입니다 (현재 Lv.${myLevel})`, code: 'REVIEW_LEVEL_REQUIRED', productId }
        }
      }
    } catch { /* fail-open */ }

    // 🎯 선착순 — 여기만 fail-closed 다("당첨자만" 은 하드 룰이라 조회 실패 시 통과시키면 안 된다).
    const fcfs = await checkFcfsPurchasable(DB, productId, userId)
    if (!fcfs.ok) return { ok: false, error: `${p.name}: ${fcfs.error}`, code: fcfs.code || 'FCFS_BLOCKED', productId }

    const discountPct = maxTierDiscount(p.group_buy_tiers)
    const unitPrice = Math.round(p.price * (1 - discountPct / 100))
    const subtotal = unitPrice * qty
    totalAmount += subtotal
    lines.push({
      productId, qty, unitPrice, subtotal, discountPct,
      name: p.name, sellerId: Number(p.seller_id), voucherExpiry: p.voucher_expiry, category: p.category,
    })
  }

  if (totalAmount <= 0) return { ok: false, error: '결제 금액이 올바르지 않습니다', code: 'BAD_AMOUNT' }
  return { ok: true, lines, totalAmount }
}

/**
 * 결제창에 뜨는 이름. 100자 상한은 Toss 계약이라 여기서 지킨다.
 *
 * 🩸 **자를 것은 상품명이지 꼬리표가 아니다.** 처음엔 완성된 문장을 통째로 잘랐는데, 상품명이 길면
 *    `외 N건` 이 잘려 나가 **결제창이 나머지 품목을 감췄다**(자기 시험이 잡았다). 무엇을 사는지
 *    가리는 결제창은 금액이 맞아도 틀린 화면이다.
 */
export function cartOrderName(lines: PricedLine[]): string {
  const rest = lines.length - 1
  const suffix = rest > 0 ? ` 외 ${rest}건` : ` × ${lines[0]?.qty ?? 1}`
  const room = 100 - suffix.length
  const first = lines[0]?.name ?? '이용권'
  const head = first.length > room ? `${first.slice(0, Math.max(1, room - 1))}…` : first
  return `${head}${suffix}`
}
