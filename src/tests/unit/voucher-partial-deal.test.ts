/**
 * 🪙 이용권 부분결제 (딜 일부 + 카드 나머지) — 계산과 배선.
 *
 * 이 테스트가 지키는 것:
 *   ① 얼마를 딜로 낼 수 있는지 계산 (순수함수)
 *   ② 결제 경로 배선 — **어느 금액을 어디에 쓰는가**. 이게 틀리면 돈이 틀린다:
 *      · 카드에 청구하는 건 `chargedAmount`(딜 뺀 값)
 *      · 매장 정산 기준으로 주문에 남기는 건 `expectedAmount`(총액 — 딜을 써도 안 줄어든다)
 *
 * 못 막는 것: 실제 Toss 승인·D1 트랜잭션. 그건 staging 실결제(S10)가 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { planPartialDeal, MIN_CARD_AMOUNT } from '@/features/group-buy/api/partial-deal'

const ROUTES = readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf8')
/** 역산·차감·복원의 실제 몸통 — 라우트는 이걸 부르기만 한다. */
const MODULE = readFileSync('src/features/group-buy/api/partial-deal.ts', 'utf8')

/**
 * ⚠️ 이 파일에는 orders INSERT 가 **둘**이다(전부-딜 /join · 카드 /confirm-toss).
 * 앞의 것을 집으면 어떤 검사든 조용히 헛돈다 — 실제로 처음 짤 때 그렇게 됐다.
 * `payment_key` 컬럼을 가진 쪽이 카드 경로다(유일).
 */
const CONFIRM_ORDER_INSERT = (() => {
  const i = ROUTES.indexOf('payment_method, payment_key, idempotency_key)')
  if (i < 0) throw new Error('confirm-toss orders INSERT 앵커를 못 찾음 — 테스트가 헛돌지 않게 실패시킨다')
  return ROUTES.lastIndexOf('INSERT INTO orders', i)
})()

describe('planPartialDeal — 얼마를 딜로 낼 수 있나', () => {
  it('게이트가 꺼져 있으면 딜을 한 푼도 안 쓴다 (잔액이 넉넉해도)', () => {
    const p = planPartialDeal({ enabled: false, totalAmount: 10000, balance: 9000 })
    expect(p.dealUsed).toBe(0)
    expect(p.cardAmount).toBe(10000)
  })

  it('대표 예시 — 10,000원 이용권 + 3,000딜 → 카드 7,000', () => {
    const p = planPartialDeal({ enabled: true, totalAmount: 10000, balance: 3000 })
    expect(p.dealUsed).toBe(3000)
    expect(p.cardAmount).toBe(7000)
  })

  it('딜이 총액을 덮어도 카드 최소액은 남긴다 — 전부-딜은 별도 흐름', () => {
    const p = planPartialDeal({ enabled: true, totalAmount: 10000, balance: 999999 })
    expect(p.cardAmount).toBe(MIN_CARD_AMOUNT)
    expect(p.dealUsed).toBe(10000 - MIN_CARD_AMOUNT)
  })

  it('총액이 카드 최소액 이하면 딜을 아예 안 쓴다', () => {
    const p = planPartialDeal({ enabled: true, totalAmount: MIN_CARD_AMOUNT, balance: 50000 })
    expect(p.dealUsed).toBe(0)
    expect(p.cardAmount).toBe(MIN_CARD_AMOUNT)
  })

  it('잔액이 0이면 종전과 동일', () => {
    expect(planPartialDeal({ enabled: true, totalAmount: 10000, balance: 0 }).cardAmount).toBe(10000)
  })

  it('요청액이 잔액보다 크면 잔액으로 잘린다 (음수·소수 입력 방어)', () => {
    expect(planPartialDeal({ enabled: true, totalAmount: 10000, balance: 2000, requested: 8000 }).dealUsed).toBe(2000)
    expect(planPartialDeal({ enabled: true, totalAmount: 10000, balance: 2000, requested: -5 }).dealUsed).toBe(0)
    expect(planPartialDeal({ enabled: true, totalAmount: 10000, balance: 2000, requested: 1500.9 }).dealUsed).toBe(1500)
  })

  it('언제나 카드 + 딜 = 총액', () => {
    for (const total of [100, 101, 999, 10000, 33333]) {
      for (const bal of [0, 1, 99, 5000, 1000000]) {
        const p = planPartialDeal({ enabled: true, totalAmount: total, balance: bal })
        expect(p.dealUsed + p.cardAmount).toBe(total)
        expect(p.dealUsed).toBeGreaterThanOrEqual(0)
        expect(p.cardAmount).toBeGreaterThanOrEqual(Math.min(total, MIN_CARD_AMOUNT))
      }
    }
  })
})

describe('결제 경로 배선 — 어느 금액이 어디로 가나', () => {
  it('딜 사용액은 클라가 보내는 게 아니라 청구액에서 역산한다', () => {
    // 클라가 보낸 숫자를 더하면 조작할 자리가 생긴다. 총액에서 빼면 그 자리가 없다.
    expect(MODULE).toMatch(/const dealUsed = Math\.round\(params\.expectedAmount\) - Math\.round\(params\.chargedAmount\)/)
    // 라우트는 그 결과를 그대로 받아 쓴다 — 자기가 다시 계산하지 않는다.
    expect(ROUTES).toMatch(/const dealUsed = derived\.dealUsed/)
  })

  it('Toss 승인은 카드 청구액으로 한다 (총액이 아니라)', () => {
    const confirmCall = ROUTES.slice(ROUTES.indexOf('const tossResult = await confirmTossPayment('))
    const head = confirmCall.slice(0, confirmCall.indexOf('})'))
    expect(head).toContain('amount: chargedAmount')
    expect(head).not.toContain('amount: expectedAmount')
  })

  it('주문에는 총액이 남는다 — 딜을 써도 매장 정산은 안 줄어든다', () => {
    // 대표: "유어딜이 부담해야지, 어차피 원래 정산을 해줬어야 하는 돈이지 않아? 딜이라는게"
    const insert = ROUTES.slice(CONFIRM_ORDER_INSERT)
    const bindLine = insert.slice(0, insert.indexOf('.first<{ id: number }>()'))
    expect(bindLine).toContain('product.seller_id, expectedAmount, expectedAmount')
    expect(bindLine).not.toContain('chargedAmount')
  })

  it('게이트가 꺼져 있으면 총액과 다른 청구액은 종전처럼 막힌다', () => {
    const fn = MODULE.slice(MODULE.indexOf('export async function derivePartialDeal'))
    const body = fn.slice(0, fn.indexOf('\n}'))
    expect(body).toMatch(/if \(!\(await isPartialDealEnabled\(DB\)\)\) return mismatch/)
    expect(body).toMatch(/AMOUNT_MISMATCH/)
    // 게이트를 보기 전에 "청구액 == 총액" 이면 즉시 통과 — 종전 경로는 게이트와 무관해야 한다.
    expect(body.indexOf('if (dealUsed === 0) return')).toBeLessThan(body.indexOf('isPartialDealEnabled'))
  })

  it('차감은 원자 CAS 로 한다 (잔액 확인 후 차감이 아니라)', () => {
    const spend = MODULE.slice(MODULE.indexOf('const spent = await adjustUserPoints('))
    const head = spend.slice(0, spend.indexOf('})'))
    expect(head).toContain('guardBalance: true')
    expect(head).toMatch(/delta: -params\.dealUsed/)
  })

  it('차감이 실패하면 재고를 되돌리고 결제를 취소한다 — 딜 안 빠진 채 이용권이 나가면 미수다', () => {
    const fn = MODULE.slice(MODULE.indexOf('export async function spendPartialDeal'))
    const fail = fn.slice(fn.indexOf('if (spent.ok) return'))
    expect(fail).toMatch(/UPDATE products SET stock = stock \+ \?/)
    expect(fail).toMatch(/cancelTossPayment/)
    // 호출부는 그 실패를 400 으로 돌려 주문을 안 만든다.
    expect(ROUTES).toMatch(/if \(!spent\.ok\)[\s\S]{0,160}INSUFFICIENT_DEAL/)
  })

  it('차감은 재고 확보 뒤 · 주문 INSERT 앞이다', () => {
    const stock = ROUTES.indexOf("'UPDATE products SET stock = stock - ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND stock >= ?'")
    const spend = ROUTES.indexOf('const spent = await spendPartialDeal(')
    const insert = CONFIRM_ORDER_INSERT
    expect(stock).toBeGreaterThan(0)
    expect(spend).toBeGreaterThan(stock)
    expect(insert).toBeGreaterThan(spend)
  })

  it('발급이 실패하면 이미 뺀 딜을 되돌린다 (주문이 없어 환불 헬퍼가 못 찾는 구간)', () => {
    const failPath = ROUTES.slice(ROUTES.indexOf('post-payment INSERT failed'))
    const scoped = failPath.slice(0, failPath.indexOf('let autoRefunded'))
    expect(scoped).toMatch(/restorePartialDeal/)
    expect(MODULE).toMatch(/export async function restorePartialDeal[\s\S]{0,600}refundDealPoints/)
  })

  it('주문에 deal_used 를 남긴다 — 환불 역전이 이 값 하나에 걸려 있다', () => {
    expect(ROUTES).toMatch(/if \(dealUsed > 0\) await recordOrderDealUsed\(DB, newOrderId, dealUsed\)/)
    expect(MODULE).toMatch(/UPDATE orders SET deal_used = \? WHERE id = \?/)
  })

  it('주문은 PAID 로 넣는다 — 웹훅 이중차감을 막는 관문이라 바꾸면 안 된다', () => {
    // handlePaymentConfirmed 는 isAlreadyProcessed(orderNumber,'PAID') 로 즉시 return 한다.
    // PENDING 으로 넣으면 웹훅이 orders.deal_used 를 읽어 같은 금액을 또 뺀다.
    const insert = ROUTES.slice(CONFIRM_ORDER_INSERT)
    expect(insert.slice(0, 400)).toContain("'PAID', 'toss'")
  })

  it('결제 시작 응답의 amount 는 카드 청구액이다 (화면이 딜 표시를 못 해도 금액은 맞는다)', () => {
    const init = ROUTES.slice(ROUTES.indexOf("const orderId = generateTossOrderId('GB', userId)"))
    const head = init.slice(0, init.indexOf('orderName:'))
    expect(head).toContain('amount: dealPlan.cardAmount')
  })
})

describe('점등 선행 조건 — 켜는 사람이 알 수 있어야 한다', () => {
  // 🩸 이 절은 뒤늦게 생겼다. 부분결제를 배선하면서 "딜 보너스 20% 가 먼저 0 이어야 한다"를
  //    빠뜨렸고, 같은 레일의 PR #1272 를 읽다가 발견했다. 게이트를 만든 사람이 안 적으면
  //    켜는 사람(대표)은 알 방법이 없고, 그러면 팔릴수록 적자인 상태로 켜진다.
  const CHECKLIST = readFileSync('docs/STAGING_CHECKLIST.md', 'utf8')
  const OPS = readFileSync('src/features/admin/api/admin-system-monitoring.routes.ts', 'utf8')
  const SETTINGS = readFileSync('src/pages/AdminPlatformSettingsPage.tsx', 'utf8')

  /** 그 게이트의 OPS_GATES 한 줄만 잘라낸다 (파일 전체에서 찾으면 옆 게이트 문구에 걸린다). */
  const gateLine = (() => {
    const line = OPS.split('\n').find(l => l.includes("key: 'voucher_partial_deal_enabled'"))
    if (!line) throw new Error('OPS_GATES 에 부분결제 게이트가 없다 — 등재부터 빠졌다')
    return line
  })()

  it('게이트 점등 조건이 딜 보너스 선행을 말한다', () => {
    expect(gateLine).toMatch(/influencer_deal_bonus_pct/)
    expect(gateLine).toMatch(/0/)
  })

  it('어드민 토글 설명에도 같은 선행이 적혀 있다 (거기서 실제로 켜므로)', () => {
    const idx = SETTINGS.indexOf("key: 'voucher_partial_deal_enabled'")
    expect(idx).toBeGreaterThan(0)
    expect(SETTINGS.slice(idx, idx + 900)).toMatch(/influencer_deal_bonus_pct/)
  })

  it('체크리스트에 선행 절이 있고 S 번호가 형제 PR 과 안 겹친다', () => {
    expect(CHECKLIST).toMatch(/S12 선행/)
    // #1272 가 S9·S10 을 먼저 잡았다. 같은 번호를 쓰면 절차서에 같은 ID 가 둘이 된다.
    expect(CHECKLIST).toMatch(/\*\*S12\*\* \| `voucher_partial_deal_enabled/)
    expect(CHECKLIST).not.toMatch(/\*\*S10\*\* \| `voucher_partial_deal_enabled/)
  })
})
