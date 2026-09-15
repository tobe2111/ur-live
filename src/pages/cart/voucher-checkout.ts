/**
 * 🧺 장바구니 → 이용권 결제로 태우기 (2026-09-15)
 *
 * 대표: *"장바구니쪽도 진행해줘. 끝까지 모두 다. 이용권 결제 플로우에 문제 없도록"*
 *
 * ## 왜 `/checkout` 이 아닌가
 * 이 앱에는 결제 레일이 둘이고 **발급이 한쪽에만 있다.** 소비자 `orders` 레일
 * (`/checkout` → `payment.routes /confirm`)에는 `INSERT INTO vouchers` 가 **0건**이다(실측).
 * 장바구니를 그리로 태우면 **결제는 되고 이용권은 안 나온다.** 그래서 이용권만 담긴 장바구니는
 * 발급이 사는 공구 레일(`/api/group-buy/cart/*`)로 보낸다.
 *
 * ## 섞여 있으면 태우지 않는다
 * 이용권(매장에서 쓰는 것)과 배송 상품은 **끝나는 방식이 다르다** — 하나는 발급, 하나는 배송이다.
 * 한 결제로 묶으면 둘 중 한쪽 레일의 후처리가 반드시 빠진다. 그래서 섞이면 진행하지 않고
 * "따로 결제해 주세요" 라고 말한다(조용히 한쪽을 버리는 것보다 낫다).
 */
import type { CartItem } from '@/types/cart'
import { getCartItemPrice } from '@/types/cart'
import { isNoShippingProduct } from '@/shared/product-flow'
import { appendPaySummary } from '@/shared/pay-summary'
import { resolveTossFlow } from '@/lib/toss-key-type'
import api from '@/lib/api'

/** 이 줄이 이용권/교환권인가 — 배송비 판정과 **같은 SSOT**(두 벌이면 언젠가 갈린다). */
export function isVoucherCartItem(item: CartItem): boolean {
  return isNoShippingProduct({ deal_only: item.deal_only, category: item.category })
}

export type CartKind = 'voucher' | 'shipping' | 'mixed' | 'empty'

/** 고른 것들이 어느 레일인지. `mixed` 면 결제하지 않는다. */
export function classifyCart(items: CartItem[]): CartKind {
  if (items.length === 0) return 'empty'
  const v = items.filter(isVoucherCartItem).length
  if (v === items.length) return 'voucher'
  if (v === 0) return 'shipping'
  return 'mixed'
}

export type VoucherCheckoutResult =
  | { ok: true; payUrl: string }
  | { ok: false; error: string }

/**
 * 이용권 장바구니 결제를 시작한다. 성공하면 결제 위젯으로 갈 주소를 준다.
 *
 * ⚠️ **금액은 서버가 정한다.** 여기서 계산한 값은 결제 화면의 *표시용*으로만 쓴다 —
 *    화면이 추정한 금액을 청구에 쓰면 티어 할인이 바뀐 순간 그 안내가 거짓말이 된다.
 */
export async function startVoucherCartCheckout(
  items: CartItem[], opts?: { dealUse?: number | null; ref?: string },
): Promise<VoucherCheckoutResult> {
  const lines = items.map(i => ({ productId: Number(i.product_id), qty: Number(i.quantity) }))
  if (lines.some(l => !Number.isFinite(l.productId) || !Number.isFinite(l.qty) || l.qty < 1)) {
    return { ok: false, error: '장바구니 정보가 올바르지 않습니다' }
  }

  let res
  try {
    res = await api.post('/api/group-buy/cart/init', {
      items: lines,
      ...(opts?.ref ? { ref: opts.ref } : {}),
      ...(opts?.dealUse == null ? {} : { deal_use: opts.dealUse }),
    })
  } catch (err: unknown) {
    const e = err as { response?: { data?: { error?: string } } }
    return { ok: false, error: e?.response?.data?.error || '결제를 시작하지 못했습니다' }
  }
  if (!res.data?.success) return { ok: false, error: res.data?.error || '결제를 시작하지 못했습니다' }

  const d = res.data.data as {
    orderId: string; amount: number; orderName: string; clientKey?: string; flow?: 'widget' | 'redirect' | 'invalid'; dealUsed?: number
  }
  if (!d.clientKey) return { ok: false, error: '결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.' }
  // 키 형식을 클라에서도 한 번 더 본다 — 서버 flow 가 캐시로 어긋나도 위젯이 안 깨지게(단일 경로와 동일).
  if (resolveTossFlow(d.flow, d.clientKey) === 'invalid') {
    return { ok: false, error: '결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.' }
  }

  // 🔑 복귀 URL 은 `paymentKey·orderId·amount` 만 나른다. **품목은 안 싣는다** — 서버가
  //    `gb_cart_intents` 에 적어 뒀고, 여기 실으면 총액이 같은 다른 상품으로 바꿔치기가 통과한다.
  const params = new URLSearchParams({
    orderId: d.orderId,
    amount: String(d.amount),
    orderName: d.orderName,
    clientKey: d.clientKey,
    successUrl: '/group-buy/confirm-payment?cart=1',
    failUrl: '/cart?fail=1',
  })
  const totalQty = items.reduce((s, i) => s + Number(i.quantity || 0), 0)
  appendPaySummary(params, {
    image: items[0]?.product_image || undefined,
    merchant: items.length > 1 ? `${items.length}종` : (items[0]?.seller_name || undefined),
    origAmount: items.reduce((s, i) => s + getCartItemPrice(i) * Number(i.quantity || 0), 0) || undefined,
    qty: totalQty,
    dealUsed: Number(d.dealUsed) || undefined,
  })
  return { ok: true, payUrl: `/pay/widget?${params.toString()}` }
}

/**
 * 고른 것들을 **맞는 레일로 보낸다.** 장바구니 화면은 이 함수만 부르면 된다 —
 * "어디로 가야 하나" 를 두 곳에서 판단하면 한쪽만 고쳐지는 날이 온다.
 *
 * @returns 진행할 수 없으면 사용자에게 보일 문구, 보냈으면 `null`.
 */
export async function routeCartCheckout(
  picked: CartItem[], go: (to: string, opts?: { state?: unknown }) => void,
): Promise<string | null> {
  const kind = classifyCart(picked)
  // ⚡ 토스 SDK 워밍 — 어느 레일이든 다음 화면이 결제창이다(모듈 평가 시 loadTossPayments 까지 실행).
  import('@/lib/toss-preload').catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })

  if (kind === 'mixed') return '이용권과 배송 상품은 함께 결제할 수 없어요. 따로 골라서 결제해주세요.'
  if (kind === 'voucher') {
    const r = await startVoucherCartCheckout(picked)
    if (!r.ok) return r.error
    go(r.payUrl)
    return null
  }
  go('/checkout', { state: { cartItems: picked, fromCart: true } })
  return null
}
