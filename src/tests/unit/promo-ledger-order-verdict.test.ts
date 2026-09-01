/**
 * 🔍 주문 1건 커미션 판정 패널 — S1(예산 아비터) 점등 절차의 도구.
 *
 * 이 게이트는 2026-07-04 에 배선되고 **미검증으로 남아 있었다.** 통과 기준이
 * *"Σ적립 ≤ 주문당 예산"* 인데 그걸 보려면 원장·적립 테이블 대여섯 개를 손으로 더해야 했다.
 * 손으로 더해야 하는 검증은 아무도 안 한다 — 그래서 판정을 서버가 내놓게 했다.
 *
 * 여기서 지키는 것: ① 판정이 실제로 그 두 값을 비교하는가 ② 이 표면이 **읽기 전용**인가.
 * 못 막는 것: 각 축의 적립 테이블이 정말 그 주문의 전부인가(설계 문서 §flip 구현 스펙이 근거).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const SRC = readFileSync('src/features/admin/api/admin-promo-ledger.routes.ts', 'utf8')
const HANDLER = (() => {
  const i = SRC.indexOf("adminPromoLedgerRoutes.get('/order/:orderNumber'")
  if (i < 0) throw new Error('판정 패널 핸들러를 못 찾음 — 테스트가 헛돌지 않게 실패시킨다')
  return SRC.slice(i)
})()

describe('주문 판정 패널', () => {
  it('판정은 적립 합과 예산을 비교한다 (다른 두 값이 아니라)', () => {
    expect(HANDLER).toMatch(/within_budget: grantedTotal <= budgetKrw/)
    expect(HANDLER).toMatch(/over_by_krw: Math\.max\(0, grantedTotal - budgetKrw\)/)
  })

  it('[INV-#44] platform:revenue 를 건드렸는지도 같이 판정한다', () => {
    expect(HANDLER).toMatch(/platform_revenue_untouched: debitTotal === 0/)
  })

  it('예산은 이 주문의 실제 원장 fee 로 계산한다 — 요율을 다시 계산하지 않는다', () => {
    // 요율을 여기서 다시 계산하면 실제 청구와 갈린다. 갈리는 것이 이 레포의 단골 사고다.
    expect(HANDLER).toMatch(/SUM\(fee_amount\)/)
    expect(HANDLER).toMatch(/computeCommissionBudget\(\{/)
  })

  it('성장 커미션 4축을 모두 센다 — 하나라도 빠지면 판정이 후하게 나온다', () => {
    for (const axis of ['affiliate', 'multi_tier', 'influencer_store_intro', 'agency_store_intro']) {
      expect(HANDLER).toContain(`'${axis}'`)
    }
  })

  it('읽기 전용이다 — 판정 화면이 돈을 움직이면 안 된다', () => {
    expect(HANDLER).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM)\b/)
  })

  it('finance 권한을 요구한다 (같은 파일의 다른 조회와 동일)', () => {
    expect(HANDLER.slice(0, 200)).toContain("requireAdminRole('finance')")
  })
})
