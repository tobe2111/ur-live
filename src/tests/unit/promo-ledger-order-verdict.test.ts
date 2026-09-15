/**
 * 🔍 주문 1건 커미션 판정 패널 — S1(예산 아비터 `commission_budget_enabled`) 점등 절차의 도구.
 *
 * 이 게이트는 2026-07-04 에 배선되고 **두 달 넘게 미검증으로 남아 있었다.** 통과 기준이
 * *"Σ적립 ≤ 주문당 예산"* 인데 그걸 보려면 원장·적립 테이블 대여섯 개를 손으로 더해야 했다.
 * **손으로 더해야 하는 검증은 아무도 안 한다** — 그래서 판정을 서버가 내놓게 했다.
 * 2026-09-07 결재 Q4-2 로 대표가 "아비터를 켠다"를 확정했고, S1 통과가 그 선행이다.
 *
 * 여기서 지키는 것: ① 판정이 실제로 그 두 값을 비교하는가 ② 예산을 요율로 다시 계산하지 않는가
 * ③ 4축을 다 세는가 ④ 이 표면이 **읽기 전용**인가 ⑤ 폐기된 원칙을 판정으로 되살리지 않는가.
 *
 * ⚠️ **못 막는 것**: 각 축의 적립 테이블이 정말 그 주문의 전부인지는 이 텍스트 검사로 모른다
 * (근거는 `docs/design/commission-funding-restructure.md`). 실제 D1 동작은 S1 실결제가 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode } from '../helpers/source-text'

const SRC = readCode('src/features/admin/api/admin-promo-ledger.routes.ts')
const HANDLER = (() => {
  const i = SRC.indexOf("adminPromoLedgerRoutes.get('/order/:orderNumber'")
  if (i < 0) throw new Error('판정 패널 핸들러를 못 찾음 — 테스트가 헛돌지 않게 실패시킨다')
  return SRC.slice(i)
})()

describe('주문 판정 패널 (S1)', () => {
  it('판정은 적립 합과 예산을 비교한다 (다른 두 값이 아니라)', () => {
    expect(HANDLER).toMatch(/within_budget: grantedTotal <= budgetKrw/)
    expect(HANDLER).toMatch(/over_by_krw: Math\.max\(0, grantedTotal - budgetKrw\)/)
  })

  it('예산은 이 주문의 실제 원장 fee 로 계산한다 — 요율을 다시 계산하지 않는다', () => {
    // 요율을 여기서 다시 계산하면 실제 청구와 갈린다. 갈리는 것이 이 레포의 단골 사고다.
    expect(HANDLER).toMatch(/SUM\(fee_amount\)/)
    expect(HANDLER).toMatch(/computeCommissionBudget\(\{/)
    // 요율 테이블을 끌어와 곱하기 시작하면 그 순간 실제 청구와 갈릴 수 있다.
    expect(HANDLER).not.toMatch(/channelPlatformRate|commission_rate_default/)
  })

  it('성장 커미션 4축을 모두 센다 — 하나라도 빠지면 판정이 후하게 나온다', () => {
    for (const axis of ['affiliate', 'multi_tier', 'influencer_store_intro', 'agency_store_intro']) {
      expect(HANDLER).toContain(`collect('${axis}'`)
    }
    // 합계는 센 것 전부의 합이어야 한다 — 일부만 더하면 판정이 통과 쪽으로 기운다.
    expect(HANDLER).toMatch(/grants\.reduce\(\(s, g\) => s \+ g\.amount, 0\)/)
  })

  it('읽기 전용이다 — 판정 화면이 돈을 움직이면 안 된다', () => {
    expect(HANDLER).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM)\b/)
  })

  it('finance 권한을 요구한다 (같은 파일의 다른 조회와 동일)', () => {
    expect(HANDLER.slice(0, 200)).toContain("requireAdminRole('finance')")
  })

  it('폐기된 07-08 원칙을 판정으로 되살리지 않는다 (09-07 결재 Q4-2)', () => {
    // `platform:revenue` debit 0 은 2026-09-07 에 폐기된 기준이다. 그걸 합격/불합격으로
    // 되돌리면 화면이 "정상인 주문"을 빨간불로 보고하게 된다 — S1 의 합격선은 within_budget 뿐.
    const verdict = HANDLER.slice(HANDLER.indexOf('verdict: {'))
    expect(verdict).not.toMatch(/platform_revenue_untouched/)
    expect(verdict).not.toMatch(/debitTotal/)
  })
})
