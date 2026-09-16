/**
 * 🧺 이용권 장바구니 결제 (2026-09-15)
 *
 * 대표: *"장바구니쪽도 진행해줘. 끝까지 모두 다. 이용권 결제 플로우에 문제 없도록"*
 *
 * ## 이 시험이 지키는 것 — 전부 "돈이 어긋나는" 자리다
 * ① **발급이 있는 레일로만** 간다 — 소비자 `orders` 레일엔 `INSERT INTO vouchers` 가 0건이라
 *    그리로 태우면 결제는 되고 이용권은 안 나온다(인계 실측).
 * ② **품목은 서버가 기억한다** — 복귀 URL 로 돌려받으면 총액이 같은 다른 상품으로 바꿔치기가 통과한다.
 * ③ **게이트가 fail-closed** — 조회 실패를 "켜짐"으로 읽으면 안 된다.
 * ④ **전부 되거나 전부 안 되거나** — 한 줄이 막히면 결제 자체가 안 열리고, 재고를 하나라도 못 잡으면
 *    앞서 잡은 것을 되돌리고 전액 환불한다.
 * ⑤ **한 상품이 두 줄로 와도 합쳐서** 1인당 한도를 본다(안 합치면 줄마다 통과해 한도를 우회한다).
 * ⑥ **Toss 잠금 파일 무접촉** — SSOT helper 를 호출만 한다.
 *
 * ## 이 시험이 **못** 막는 것
 * - 실제 결제가 되는지(D1·Toss 가 필요하다 — staging 실결제 항목)
 * - 셀러가 섞인 주문의 정산이 원장에서 실제로 맞는지(라이브 데이터라 레포가 못 본다)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { normalizeCartLines, cartOrderName, MAX_CART_LINES } from '../../features/group-buy/api/cart-lines'
import { classifyCart, isDealOnlyCartItem, isVoucherCartItem } from '../../pages/cart/voucher-checkout'
import type { CartItem } from '../../types/cart'

const read = (p: string) => stripComments(readFileSync(p, 'utf-8'))
const ROUTES = read('src/features/group-buy/api/cart-checkout.routes.ts')
const LINES = read('src/features/group-buy/api/cart-lines.ts')
const INTENT = read('src/features/group-buy/api/cart-intent.ts')
const CLIENT = read('src/pages/cart/voucher-checkout.ts')
const CONFIRM = read('src/pages/GroupBuyConfirmPaymentPage.tsx')

describe('① 발급이 있는 레일로만 간다', () => {
  it('이용권만 담긴 장바구니는 `/checkout`(소비자 orders 레일)로 안 간다', () => {
    // 그 레일엔 발급이 없다 — 가면 결제는 되고 이용권은 안 나온다.
    expect(CLIENT).toMatch(/kind === 'voucher'[\s\S]{0,200}startVoucherCartCheckout/)
    // 배송 상품만일 때만 종전 경로
    expect(CLIENT).toMatch(/go\('\/checkout'/)
  })

  it('섞여 있으면 **보내지 않는다** — 한쪽 레일의 후처리가 반드시 빠진다', () => {
    expect(CLIENT).toMatch(/if \(kind === 'mixed'\) return/)
  })

  it('이용권 판정은 배송비 판정과 **같은 SSOT** 를 쓴다(두 벌이면 갈린다)', () => {
    expect(CLIENT).toContain("from '@/shared/product-flow'")
    expect(CLIENT).toMatch(/isNoShippingProduct\(\{ deal_only: item\.deal_only, category: item\.category \}\)/)
  })
})

describe('② 품목은 서버가 기억한다 (바꿔치기 차단)', () => {
  it('확정 요청 본문에 `items` 가 아예 없다', () => {
    expect(ROUTES).toMatch(/type ConfirmBody = \{ paymentKey\?: string; orderId\?: string; amount\?: number; ref\?: string \}/)
  })

  it('확정은 저장된 의사를 읽고, 없으면 진행하지 않는다', () => {
    expect(ROUTES).toMatch(/const intent = await loadCartIntent\(DB, orderId, userId\)/)
    expect(ROUTES).toMatch(/if \(!intent\) return c\.json\([\s\S]{0,120}INTENT_NOT_FOUND/)
    // 값을 매기는 입력이 **의사**여야 한다 — body 였으면 이 줄이 다르다.
    expect(ROUTES).toMatch(/priceCartLines\(DB, userId, intent\.items\)/)
  })

  it('의사는 주인만 읽는다 — 남의 주문번호로 확정 못 한다', () => {
    expect(INTENT).toMatch(/WHERE order_id = \? AND user_id = \?/)
  })

  it('시작 시 저장에 실패하면 결제를 열지 않는다(기억 못 하면 확정도 못 한다)', () => {
    expect(ROUTES).toMatch(/if \(!saved\) \{[\s\S]{0,200}INTENT_SAVE_FAILED/)
  })

  it('복귀 URL 에 품목을 싣지 않는다', () => {
    const successUrl = CLIENT.match(/successUrl: '([^']+)'/)?.[1] ?? ''
    expect(successUrl).toBe('/group-buy/confirm-payment?cart=1')
    expect(successUrl).not.toMatch(/productId|items/)
  })

  it('확정 화면도 장바구니면 품목을 안 보낸다', () => {
    expect(CONFIRM).toMatch(/api\.post\('\/api\/group-buy\/cart\/confirm-toss', \{ paymentKey, orderId, amount, ref \}\)/)
  })
})

describe('③ 게이트는 fail-closed', () => {
  it('조회가 실패하면 **꺼진 것으로** 본다', () => {
    expect(ROUTES).toMatch(/\} catch \{ return false \}/)
    expect(ROUTES).toContain("const GATE_KEY = 'voucher_cart_enabled'")
  })

  it('두 엔드포인트 **모두** 게이트를 본다 (한쪽만 막으면 다른 쪽으로 들어온다)', () => {
    const gated = ROUTES.match(/if \(!await cartEnabled\(DB\)\) return c\.json\(GATE_OFF, 403\)/g) || []
    expect(gated).toHaveLength(2)
  })
})

describe('④ 전부 되거나 전부 안 되거나', () => {
  it('재고를 하나라도 못 잡으면 앞서 잡은 것을 되돌리고 전액 환불한다', () => {
    expect(ROUTES).toMatch(/await rollbackStock\(\)[\s\S]{0,400}cancelTossPayment/)
    expect(ROUTES).toMatch(/OUT_OF_STOCK/)
  })

  it('딜 차감이 실패해도 재고를 되돌린다 (카드만 긁히고 이용권이 나가면 그 차액은 미수다)', () => {
    expect(ROUTES).toMatch(/if \(!spent\.ok\) \{\s*await rollbackStock\(\)/)
  })

  it('order_items + vouchers 가 **한 batch** 다 — 부분 발급이 구조적으로 불가능하다', () => {
    expect(ROUTES).toMatch(/await DB\.batch\(stmts\)/)
    // 줄마다 따로 batch 를 돌리면 중간에 끊겨 일부만 발급된다
    expect(ROUTES.match(/DB\.batch\(/g) || []).toHaveLength(1)
  })

  it('발급이 실패하면 딜을 복원하고 자동 환불한다', () => {
    expect(ROUTES).toMatch(/if \(dealUsed > 0\) await restorePartialDeal\(DB, \{ userId, dealUsed, orderNumber \}\)/)
    expect(ROUTES).toMatch(/ISSUE_FAILED_REFUNDED/)
  })

  it('한 줄이라도 게이트에 막히면 **값매김 자체가 실패**한다 (부분 구매를 안 만든다)', () => {
    // 🩸 처음엔 `/\n\s+continue\b/` 로 썼는데 **헛돌았다** — 주입이 넣은 `if (!p) continue` 는
    //    `continue` 앞이 줄바꿈+공백이 아니라 `) ` 라 매치가 안 됐다(자기 주입이 잡았다).
    //    ⇒ 이 파일엔 정당한 `continue` 가 없으므로 **단어 하나**로 본다.
    expect(LINES).not.toMatch(/\bcontinue\b/)
    // 그리고 거절이 실제로 **함수를 끝내는지** 본다 — 줄 루프의 모든 관문이 return 이어야 한다.
    // ⚠️ `[^}]*` 로 쓰면 템플릿 리터럴(`${p.name}`)의 닫는 중괄호에서 끊긴다 — 실제로 3건만 셌다.
    const rejects = LINES.match(/return \{ ok: false,[\s\S]{0,200}?productId \}/g) || []
    expect(rejects.length).toBeGreaterThanOrEqual(6)
  })
})

describe('⑤ 같은 상품 두 줄은 합친다 — 실제로 실행해서 잰다', () => {
  it('합쳐서 한 줄이 된다 (안 합치면 1인당 한도를 줄마다 우회한다)', () => {
    const out = normalizeCartLines([{ productId: 7, qty: 3 }, { productId: 7, qty: 4 }])
    expect(out).toEqual([{ productId: 7, qty: 7 }])
  })

  it('합친 뒤 100장을 넘으면 거절 (단일 경로의 상한과 같은 수)', () => {
    expect(normalizeCartLines([{ productId: 7, qty: 60 }, { productId: 7, qty: 60 }])).toBeNull()
  })

  it('종류 상한을 넘으면 거절', () => {
    const many = Array.from({ length: MAX_CART_LINES + 1 }, (_, i) => ({ productId: i + 1, qty: 1 }))
    expect(normalizeCartLines(many)).toBeNull()
  })

  it('빈 값·비숫자·0·음수는 전부 거절', () => {
    for (const bad of [[], null, undefined, [{ productId: 0, qty: 1 }], [{ productId: 1, qty: 0 }],
      [{ productId: 1, qty: -2 }], [{ productId: 'a', qty: 1 }], [{ productId: 1, qty: 'x' }]]) {
      expect(normalizeCartLines(bad)).toBeNull()
    }
  })

  it('결제창 이름은 100자를 안 넘는다 (Toss 계약)', () => {
    const long = { productId: 1, qty: 1, unitPrice: 1, subtotal: 1, discountPct: 0, sellerId: 1, voucherExpiry: null, category: null, name: '가'.repeat(300) }
    expect(cartOrderName([long]).length).toBeLessThanOrEqual(100)
    expect(cartOrderName([long, { ...long, productId: 2 }])).toContain('외 1건')
  })
})

describe('⑥ Toss 잠금 계약 무접촉', () => {
  it('SSOT helper 를 **호출만** 한다 (잠금표 예외 절이 허용하는 형태)', () => {
    expect(ROUTES).toMatch(/const \{ confirmTossPayment \} = await import\('\.\.\/\.\.\/\.\.\/worker\/utils\/toss-gateway'\)/)
    expect(ROUTES).toMatch(/const \{ cancelTossPayment \} = await import\('\.\.\/\.\.\/\.\.\/worker\/utils\/toss-gateway'\)/)
  })

  it('가상계좌는 발급 없이 막는다 — 웹훅에 공구 발급이 없어서 기다릴 수 없다', () => {
    expect(ROUTES).toMatch(/const vaBlock = await guardAwaitingDeposit\(/)
    expect(ROUTES).toMatch(/if \(vaBlock\) return c\.json/)
  })

  it('같은 paymentKey 재시도는 재발급하지 않는다', () => {
    expect(ROUTES).toMatch(/SELECT id, order_number FROM orders WHERE payment_key = \? LIMIT 1/)
    expect(ROUTES).toMatch(/idempotent: true/)
  })

  it('청구액과 총액이 어긋나면 **승인 전에** 막는다', () => {
    const iConfirm = ROUTES.indexOf('confirmTossPayment({')
    const iDerive = ROUTES.indexOf('derivePartialDeal(')
    expect(iDerive).toBeGreaterThan(0)
    expect(iDerive).toBeLessThan(iConfirm)   // 과금보다 먼저여야 환불이 필요 없다
  })
})

describe('게이트·값매김이 단일 구매와 같은 함수를 쓴다', () => {
  it('1인당 한도·선착순·티어가 전부 기존 SSOT', () => {
    expect(LINES).toMatch(/checkPerPersonLimit\(DB, productId, userId, qty, meta\?\.get\(productId\)\?\.max_per_person\)/)
    expect(LINES).toMatch(/checkFcfsPurchasable\(DB, productId, userId\)/)
    expect(LINES).toMatch(/const discountPct = maxTierDiscount\(p\.group_buy_tiers\)/)
  })

  it('선착순만 fail-closed 다 (당첨자만 = 하드 룰)', () => {
    // 한도·레벨은 try/catch 로 감싸 통과시키지만, 선착순은 감싸지 않는다.
    expect(LINES).toMatch(/const fcfs = await checkFcfsPurchasable/)
    expect(LINES).not.toMatch(/try \{[\s\S]{0,120}checkFcfsPurchasable/)
  })

  it('도매 원본은 장바구니에도 못 들어온다 (서비스 분리)', () => {
    expect(LINES).toMatch(/NOT \(COALESCE\(is_supply_product,0\) = 1 AND supply_source_id IS NULL\)/)
  })
})

/**
 * ⑦ 교환권(딜) 과 이용권(카드) 은 **다른 결제 수단**이다 (2026-09-15 — 게이트 켜기 직전 실측으로 발견)
 *
 * 🩸 첫 판이 둘을 한 덩어리로 봤다. 이유가 그럴듯해서 더 위험했다 — **둘 다 배송이 없다.**
 *    그래서 `isNoShippingProduct` 하나로 갈랐고, 교환권이 카드 레일(`/api/group-buy/cart/*`)로 갔다.
 *    라이브 번들을 실제로 렌더해 보니 장바구니 총액이 **88,000원 = 74,500원 + 13,500딜** —
 *    딜을 원화로 더하고 있었다. `/checkout` 은 이 경우 이미 '딜 모드'를 강제하는데(2026-05-21)
 *    새 레일이 그 처리를 안 물려받은 것이다.
 *
 * ⇒ **판정을 실행해서 잰다.** 소스 문자열로 재면 `deal_only` 라는 단어가 파일 어딘가에 있기만 해도
 *    통과한다(이 레포가 반복해 당한 헛도는 가드). 아래는 전부 `classifyCart` 를 진짜로 부른다.
 */
const item = (o: Partial<CartItem>): CartItem => ({
  id: 1, product_id: 1, product_name: 'x', quantity: 1, price: 1000, ...o,
} as CartItem)

const DEAL = item({ id: 'd', product_id: 11, deal_only: 1, category: 'etc' })          // 교환권(기프티콘)
const CARD = item({ id: 'v', product_id: 22, deal_only: 0, category: 'meal_voucher' }) // 이용권(식사)
const SHIP = item({ id: 's', product_id: 33, deal_only: 0, category: 'fashion' })      // 배송 상품

describe('⑦ 교환권은 딜, 이용권은 카드 — 섞으면 안 보낸다', () => {
  it('교환권만이면 `deal` — 카드 레일이 아니다', () => {
    expect(classifyCart([DEAL])).toBe('deal')
    expect(classifyCart([DEAL, { ...DEAL, id: 'd2', product_id: 12 }])).toBe('deal')
  })

  it('이용권만이면 `voucher`(카드 · 공구 레일)', () => {
    expect(classifyCart([CARD])).toBe('voucher')
  })

  it('🔴 교환권 + 이용권은 `mixed` — 결제 수단이 달라서 한 번에 못 받는다', () => {
    expect(classifyCart([DEAL, CARD])).toBe('mixed')
    expect(classifyCart([CARD, DEAL])).toBe('mixed')
  })

  it('배송 상품이 섞여도 `mixed`', () => {
    expect(classifyCart([CARD, SHIP])).toBe('mixed')
    expect(classifyCart([DEAL, SHIP])).toBe('mixed')
  })

  it('배송만이면 `shipping`, 비었으면 `empty`', () => {
    expect(classifyCart([SHIP])).toBe('shipping')
    expect(classifyCart([])).toBe('empty')
  })

  it('두 판정이 실제로 갈린다 — 교환권은 "배송 없음"이면서 "딜"이다', () => {
    expect(isVoucherCartItem(DEAL)).toBe(true)    // 배송은 없고
    expect(isDealOnlyCartItem(DEAL)).toBe(true)   // 딜로 산다
    expect(isVoucherCartItem(CARD)).toBe(true)
    expect(isDealOnlyCartItem(CARD)).toBe(false)  // 이용권은 카드
  })

  it('`deal_only` 가 문자열 "1" 로 와도 딜로 본다 (서버 응답이 숫자를 보장하지 않는다)', () => {
    expect(classifyCart([item({ deal_only: '1' as unknown as number, category: 'etc' })])).toBe('deal')
  })

  it('카드 레일로 보내는 것은 `voucher` 뿐 — 나머지는 종전 `/checkout`', () => {
    // 배선까지 확인: 'deal'/'shipping' 이 startVoucherCartCheckout 로 안 간다.
    expect(CLIENT).toMatch(/if \(kind === 'voucher'\) \{[\s\S]{0,200}startVoucherCartCheckout/)
    expect(CLIENT).not.toMatch(/kind === 'deal'[\s\S]{0,200}startVoucherCartCheckout/)
  })
})

describe('⑦-서버: 경계는 서버다 (화면은 편의일 뿐)', () => {
  it('교환권이 카드 레일에 오면 **거절**한다 — 화면을 우회해 id 를 직접 보내도 막힌다', () => {
    expect(LINES).toMatch(/if \(Number\(p\.deal_only\) === 1\) \{[\s\S]{0,240}DEAL_ONLY_NOT_SUPPORTED/)
  })

  it('그 거절이 **카테고리 검사보다 먼저** 온다 (교환권 카테고리가 이용권과 겹쳐도 딜로 잡힌다)', () => {
    const iDeal = LINES.indexOf('DEAL_ONLY_NOT_SUPPORTED')
    const iCat = LINES.indexOf('NOT_VOUCHER')
    expect(iDeal).toBeGreaterThan(0)
    expect(iCat).toBeGreaterThan(0)
    expect(iDeal).toBeLessThan(iCat)
  })

  it('거절은 `ok: false` 라 **값매김 전체가 실패**한다 (그 줄만 빼고 사지 않는다)', () => {
    expect(LINES).toMatch(/return \{ ok: false, error: `교환권은 딜로 결제합니다/)
  })
})
