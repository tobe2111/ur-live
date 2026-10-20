/**
 * 🔘 장바구니 주문 버튼이 **무엇을 말하고 무엇을 결제할지** 정한다 (2026-09-15).
 *
 * 대표: *"따로 골라서 결제할 필요도 또 없지 않나?"* — 맞는 지적이다.
 *
 * ## 무엇이 잘못이었나
 * 교환권(딜)과 이용권(카드)이 섞이면 버튼을 **잠그고** "따로 골라서 결제해주세요" 라고 했다.
 * 그건 사용자한테 **우리 내부 레일 사정을 떠넘긴 것**이다 — 화면은 이미 어느 줄이 딜이고 어느 줄이
 * 카드인지 알고 있는데, 정작 체크박스를 푸는 노동은 사람이 했다.
 *
 * ## 그래서 화면이 고른다
 * 섞였으면 버튼이 `이용권 3개 먼저 결제 · 74,500원` 으로 바뀌고, 누르면 **그 종류만 자동 선택**해
 * 결제로 간다. 나머지는 장바구니에 그대로 남고, 돌아오면 버튼이 `교환권 1개 먼저 결제 · 13,500딜`
 * 이 된다. 사용자가 체크박스를 만질 일이 **한 번도 없다**.
 *
 * ⚠️ **한 번에 묶어서 결제하는 것과는 다르다.** 교환권은 딜에서 빠지고 이용권은 카드로 청구되며,
 *    끝나는 방식도 다르다(문자 발송 ↔ 매장 QR). 한 주문으로 합치려면 두 발급 후처리를 한 결제에
 *    얹어야 하고 그건 머니 경로 대공사다 — 지금은 **노동만 없앤다**(위험 0).
 *
 * 🔒 **금액은 표시 전용.** 실제 청구액은 서버가 정하고 결제 경로가 다시 검증한다.
 */
import type { CartItem } from '@/types/cart'
import { getCartItemPrice } from '@/types/cart'
import { classifyCart, type CartKind } from './voucher-checkout'

/** 사람이 읽는 이름. `CartKind` 중 실제로 물건이 담기는 셋만. */
const GROUP_LABEL: Record<'voucher' | 'deal' | 'shipping', string> = {
  voucher: '이용권',
  deal: '교환권',
  shipping: '배송 상품',
}

/** 섞였을 때 **먼저 결제할** 순서. 앞에 있을수록 우선 — 같은 개수면 이용권이 이긴다(본업). */
const PRIORITY: Array<'voucher' | 'deal' | 'shipping'> = ['voucher', 'deal', 'shipping']

export interface CartCta {
  label: string
  disabled: boolean
  /** 이 버튼을 누르면 결제할 항목. 비어 있으면 결제로 보내지 않는다. */
  payItems: CartItem[]
  /** 왜 나뉘는지 + 무엇이 남는지. 안 섞였으면 `null`(늘 떠 있으면 아무도 안 읽는다). */
  hint: string | null
}

/** 한 줄이 어느 종류인가 — 목록 판정과 **같은 함수**를 쓴다(두 벌이면 갈린다). */
export function itemKind(item: CartItem): 'voucher' | 'deal' | 'shipping' {
  const k = classifyCart([item]) as CartKind
  return k === 'deal' || k === 'shipping' ? k : 'voucher'
}

const sum = (items: CartItem[]) => items.reduce((n, i) => n + getCartItemPrice(i) * Number(i.quantity || 0), 0)
const qty = (items: CartItem[]) => items.reduce((n, i) => n + Number(i.quantity || 0), 0)

export interface CartCtaInput {
  /** 지금 고른 것들. */
  selected: CartItem[]
  /** 카드 청구 예정액(상품금액 + 배송비). 섞이지 않았을 때만 쓴다. */
  cardTotal: number
  /** 딜로 낼 금액. */
  dealAmount: number
  updating?: boolean
  fmt: (n: number) => string
  /** i18n — 안 섞였을 때의 기존 문구를 그대로 쓴다. */
  t: (k: string, o?: Record<string, unknown>) => string
}

export function cartCta({ selected, cardTotal, dealAmount, updating, fmt, t }: CartCtaInput): CartCta {
  if (selected.length === 0) {
    return { label: t('cart.selectProductsFirst'), disabled: true, payItems: [], hint: null }
  }

  const groups = new Map<'voucher' | 'deal' | 'shipping', CartItem[]>()
  for (const i of selected) {
    const k = itemKind(i)
    groups.set(k, [...(groups.get(k) ?? []), i])
  }

  // 한 종류뿐이면 종전 그대로 — 안내도 분할도 없다.
  if (groups.size === 1) {
    const only = [...groups.keys()][0]
    const label = only === 'deal'
      ? `${fmt(dealAmount)}딜로 주문하기`
      : t('cart.placeOrder', { amount: fmt(cardTotal) })
    return { label, disabled: !!updating, payItems: selected, hint: null }
  }

  // 섞였다 → 우선순위로 한 덩어리를 골라 준다. 나머지는 장바구니에 남는다.
  const present = PRIORITY.filter(k => groups.has(k))
  const first = present.reduce((a, b) => (qty(groups.get(b)!) > qty(groups.get(a)!) ? b : a))
  const payItems = groups.get(first)!
  const money = first === 'deal' ? `${fmt(sum(payItems))}딜` : `${fmt(sum(payItems))}원`
  const restNames = present.filter(k => k !== first).map(k => `${GROUP_LABEL[k]} ${qty(groups.get(k)!)}개`).join(' · ')

  return {
    label: `${GROUP_LABEL[first]} ${qty(payItems)}개 먼저 결제 · ${money}`,
    disabled: !!updating,
    payItems,
    // 왜 나뉘는지(결제 수단) + 무엇이 남는지(장바구니에 그대로) 둘 다 말한다.
    // 조사는 항상 `는` — 앞이 "…개"(받침 없음)로 끝난다. `은(는)` 같은 회피 표기는 사람이 쓴 글이 아니다.
    hint: `교환권은 딜로, 이용권은 카드로 결제돼요. ${restNames}는 장바구니에 남겨 둘게요.`,
  }
}
