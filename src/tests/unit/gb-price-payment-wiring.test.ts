import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { resolveGbPricing, type GbSession } from '@/shared/gb-session'

/**
 * 🎟️ 공구 특가 → 소비자 결제 배선 불변식 (2026-07-29 세션 ①)
 *
 * 배경: `resolveGbPricing` 은 그간 `gb-marketplace.routes.ts`(표시)에만 쓰였다.
 *   소비자 구매 경로에 없어서 **공구가로 결제되지 않았다** — 화면엔 특가, 결제는 상시가.
 *   배선 지점은 `order.routes.ts` 의 서버 권위 단가(`unitPrice`).
 *
 * 🔴 배선하면서 드러난 것 — **이 레포엔 공구 할인이 두 가지다.**
 *   ① `group_buy_tiers` + `maxTierDiscount` — 구 모델. **이미 결제에 배선돼 있다**
 *      (`order.routes.ts` 의 `groupBuyCap` 서버 cap 재계산).
 *   ② `gb_price`(product_supply_meta) — 신 공구 엔진. 표시 전용이었다.
 *   둘 다 가진 상품에 ②를 단가에 얹으면, ①의 `perUnit` 이 **이미 낮아진 unit_price** 에서
 *   다시 계산돼 cap 이 부풀고 **이중 할인(과소청구)** 이 된다.
 *   ⇒ 공구가가 적용된 상품은 `groupBuyCap` 누적에서 제외한다(`gbAppliedIds`).
 *
 * ⚠️ 이 테스트가 못 막는 것: 실제 결제 왕복(Toss 승인·confirm 금액검증)은 검증하지 않는다.
 *   그 축은 **staging 실결제**가 담당하며, 통과 전에는 다음 세션으로 넘어가지 않는다.
 */

// 배선은 order.routes(호출부) + gb-order-pricing(로직) 두 파일에 걸쳐 있다.
//   file-size 래칫에 걸려 로직을 헬퍼로 분리했으므로, 검사도 양쪽을 본다.
const src = readFileSync(resolve(process.cwd(), 'src/worker/routes/order.routes.ts'), 'utf8')
const helper = readFileSync(resolve(process.cwd(), 'src/worker/utils/gb-order-pricing.ts'), 'utf8')

describe('gb 특가 결제 배선 — 순수 모델 불변식', () => {
  const live = (price: number, opts: Partial<GbSession> = {}): GbSession => ({
    mode: 'live',
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    price,
    ...opts,
  })

  it('공구 live → 결제 기준가가 공구 특가다', () => {
    const p = resolveGbPricing(live(7000), 10000, null, Date.now())
    expect(p.gbActive).toBe(true)
    expect(p.effectivePrice).toBe(7000)
  })

  it('공구가는 상시가를 넘을 수 없다 — 배선이 가격을 올리는 방향으로는 절대 작동하지 않는다', () => {
    // 특가가 상시가보다 높게 저장돼도(잘못된 데이터) 상시가로 떨어진다.
    const p = resolveGbPricing(live(15000), 10000, null, Date.now())
    expect(p.effectivePrice).toBe(10000)
  })

  it('공구 종료/미시작이면 상시가', () => {
    const ended = resolveGbPricing({ mode: 'ended', price: 7000 }, 10000, null, Date.now())
    expect(ended.effectivePrice).toBe(10000)
    const off = resolveGbPricing({ mode: 'off' }, 10000, null, Date.now())
    expect(off.effectivePrice).toBe(10000)
  })

  it('linkOnly 세션은 ref 경유일 때만 공구가', () => {
    const s = live(7000, { linkOnly: true })
    expect(resolveGbPricing(s, 10000, null, Date.now(), false).effectivePrice).toBe(10000)
    expect(resolveGbPricing(s, 10000, null, Date.now(), true).effectivePrice).toBe(7000)
  })
})

describe('유어딜 순수취 == 정확히 5% (공구가여도 불변)', () => {
  // 원장 계산식(ledger.ts recordVoucherUsedLedger)과 동일:
  //   platformAmount = floor(order_amount × platformRate), merchantRate = 1 − platform − seller
  const split = (amount: number, platformRate = 0.05, sellerRate = 0) => {
    const platform = Math.floor(amount * platformRate)
    const seller = Math.floor(amount * sellerRate)
    return { platform, seller, merchant: amount - platform - seller }
  }

  it('플랫폼 분은 **실제 결제액**의 5% — 상시가가 아니라 공구가 기준', () => {
    const listPrice = 10000
    const gb = resolveGbPricing({ mode: 'live', deadline: new Date(Date.now() + 8.64e7).toISOString(), price: 7000 }, listPrice, null, Date.now())
    const paid = gb.effectivePrice
    const { platform, merchant } = split(paid)
    expect(paid).toBe(7000)
    expect(platform).toBe(350)          // 7000 × 5%  (10000 × 5% = 500 이 아니다)
    expect(platform + merchant).toBe(paid) // 합이 결제액과 정확히 일치(원 단위 누수 0)
  })

  it('인플루언서(seller) 몫이 커져도 플랫폼 분은 불변 — 5% 는 먼저 떼고 나머지를 나눈다', () => {
    const amount = 7000
    const a = split(amount, 0.05, 0)
    const b = split(amount, 0.05, 0.10)
    expect(a.platform).toBe(b.platform)             // 플랫폼 분 불변
    expect(b.merchant).toBeLessThan(a.merchant)     // 인플루언서 몫은 merchant 에서 나온다
    expect(b.platform + b.seller + b.merchant).toBe(amount)
  })

  it('배선이 새 요율 로직을 들이지 않았다 — order.routes 에 플랫폼 요율 리터럴 없음', () => {
    // 5%/0.05/platform_fee_pct 를 주문 경로에서 직접 계산하기 시작하면 SSOT 가 갈라진다.
    expect(/platform_fee_pct|0\.05\b|\*\s*5\s*\/\s*100/.test(src)).toBe(false)
    expect(/platform_fee_pct|0\.05\b/.test(helper)).toBe(false)
  })
})

describe('이중 할인 차단 (구 tier 모델 ↔ 신 gb 모델)', () => {
  it('공구가 적용 상품은 groupBuyCap 누적에서 제외된다', () => {
    // 배선의 핵심 안전장치. 빠지면 cap 이 부풀어 과소청구된다.
    expect(/gbApplied\.has\(Number\(it\.product_id\)\)\)\s*continue/.test(helper)).toBe(true)
    // 호출부가 applied 집합을 cap 계산에 실제로 넘기는지(안 넘기면 제외가 무효)
    expect(/computeGroupBuyCap\([^)]*gbPricing\.applied\)/.test(src)).toBe(true)
  })

  it('gb 적용 판정은 "상시가보다 낮을 때"만 — 동일가면 tier 할인을 계속 허용', () => {
    expect(/if \(eff < list\) applied\.add/.test(helper)).toBe(true)
  })

  it('세션 조회 실패가 주문을 막지 않는다 (fail-soft → 상시가)', () => {
    expect(/getGbSessions\([\s\S]{0,200}?\.catch\(\(\) => new Map/.test(helper)).toBe(true)
  })
})
