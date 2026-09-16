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

describe('🚦 게이트별 판정 — S8 (소개자 몫)', () => {
  // 🔴 이 게이트만 **게이트가 없다** — 2026-08-30 머지 즉시 라이브이고 아직 미검증이다.
  //   나머지 게이트는 꺼져 있어 안 도는 코드지만, 이건 지금 돈이 그 규칙으로 흐른다.
  it('딜 %를 설정에서 다시 계산하지 않는다 — 결제가 쓴 SSOT 를 그대로 묻는다', () => {
    expect(HANDLER).toMatch(/findActiveDealPct\(DB, p2\.sellerId, p2\.influencerId\)/)
    // 조건을 여기 베껴 쓰면 화면은 "N% 받는다"인데 정산은 0 이 되는 드리프트가 난다.
    expect(HANDLER).not.toMatch(/seller_influencer_deals/)
  })

  it('🔴 기대액은 딜 %로만 만든다 — 옛 자동분(영입 1%)이 섞이면 안 된다', () => {
    expect(HANDLER).toMatch(/Math\.floor\(\(amountKrw \* pct\) \/ 100\)/)
    expect(HANDLER).not.toMatch(/seller_referral_bonus_pct|influencer_pct/)
  })

  it('🔴 딜이 없으면 기대액은 0 이다 (자동 1% 부활 감지)', () => {
    expect(HANDLER).toMatch(/pct === null \? 0 :/)
  })

  it('🔴 **조회 실패는 통과가 아니라 판정 불가**다', () => {
    // 실패를 "적립 0" 으로 읽으면 판정이 조용히 true 가 된다 — 이 레포가 반복해 당한 자리다.
    expect(HANDLER).toMatch(/attrs === null/)
    expect(HANDLER).toMatch(/matches_deal_pct: null/)
    // 그리고 실패 경로가 `every()`(빈 배열 → true)로 떨어지면 안 된다.
    const failBranch = HANDLER.slice(HANDLER.indexOf('attrs === null'), HANDLER.indexOf('introducer_total_krw: introducerTotal'))
    expect(failBranch).not.toMatch(/\.every\(/)
  })

  it('컬럼이 없어도 한 번 더 묻는다 — source 는 repair-schema 가 붙이는 컬럼이다', () => {
    expect(HANDLER).toMatch(/for \(const withSource of \[true, false\]\)/)
  })

  it('판정에 s8 이 실린다', () => {
    // 🩸 처음엔 `gates: { s8 }` 를 글자 그대로 봤는데, 같은 날 게이트가 늘자 깨졌다.
    //   **모양이 아니라 뜻**을 본다 — s8 이 gates 안에 실리는가.
    expect(HANDLER).toMatch(/gates: \{[^}]*\bs8\b[^}]*\}/)
  })
})

describe('🚦 게이트별 판정 — S2·S3·S4·S5·S6', () => {
  it('여섯 게이트가 모두 실린다 — 결제 한 번에 주문번호 하나로 답이 나오게', () => {
    expect(HANDLER).toMatch(/gates: \{ s2, s3, s4, s5, s6, s8 \}/)
  })

  it('🔴 조회 실패는 전부 **판정 불가**로 떨어진다 (통과 아님)', () => {
    // 실패를 0 으로 읽으면 "이중적립 없음"·"몰수 없음" 이 조용히 참이 된다.
    for (const v of ['s4Row === null', 's5Row === null', 's6Row === null']) {
      expect(HANDLER, `${v} 분기가 없다`).toContain(v)
    }
    expect(HANDLER).toMatch(/readable: false as const/)
    // 실패 분기에 통과 필드가 섞이면 안 된다.
    expect(HANDLER).not.toMatch(/readable: false as const[^}]*exactly_once: true/)
  })

  it('🔴 게이트 상태를 함께 내린다 — 0건이 OFF 때문인지 결함인지 구분돼야 한다', () => {
    // 🩸 처음엔 `const s2 =` 부터 900자를 잘라 봤는데, 그 창이 **다음 게이트까지 넘어가서**
    //   s2 의 gate_on 을 지워도 s3 의 것에 걸려 초록이 떴다(되돌려-검증이 잡았다).
    //   ⇒ 각 게이트를 **다음 게이트 선언 전까지**로 잘라 본다.
    const order = ['s2', 's3', 's4', 's5', 's6']
    for (let i = 0; i < order.length; i++) {
      const start = HANDLER.indexOf(`const ${order[i]} =`)
      expect(start, `${order[i]} 선언이 없다`).toBeGreaterThan(-1)
      const nextName = order[i + 1]
      const end = nextName ? HANDLER.indexOf(`const ${nextName} =`, start) : HANDLER.indexOf('const s8 =', start)
      const blk = HANDLER.slice(start, end > start ? end : undefined)
      expect(blk, `${order[i]} 에 gate_on 이 없다`).toMatch(/gate_on/)
    }
  })

  it('🔴 S2·S3 는 "정확히 1회" 를 본다 — 두 번 찍히면 이중적립이다', () => {
    expect(HANDLER).toMatch(/exactly_once: credits === 1/)
    expect(HANDLER).toMatch(/reversal_symmetric/)
  })

  it('🔴 S5 의 원장 키는 주문이 아니라 교환권이다', () => {
    // 주문으로 찾으면 0건이 나오고, 그 0 을 통과로 읽으면 몰수 검증이 통째로 헛돈다.
    // 🩸 처음엔 그 문자열이 **어디든** 있으면 통과였는데, 같은 서브쿼리가 금액 합계 줄에도 있어
    //   건수 줄만 주문 키로 바꿔도 초록이 떴다(되돌려-검증이 잡았다).
    //   ⇒ **건수·금액 두 줄 모두** 교환권 키로 찾는지 본다.
    const voucherKeyed = HANDLER.match(/'voucher:' \|\| id FROM vouchers WHERE order_id/g) || []
    expect(voucherKeyed.length, '교환권 키 서브쿼리가 두 줄 모두에 없다').toBe(2)
    expect(HANDLER).toMatch(/AS forfeits/)
    expect(HANDLER).toMatch(/no_double_forfeit/)
  })

  it('🔴 S6 는 환불액이 결제액을 넘지 않는지 본다', () => {
    expect(HANDLER).toMatch(/within_paid: \(Number\(s6Row\.set_krw\) \|\| 0\) <= amountKrw/)
  })
})
