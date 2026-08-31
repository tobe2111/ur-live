/**
 * 🛑 2026-08-31 대표 *"1%짜리는 아예 없애줘"* — 에이전시 매장영입 1%·24개월 폐지.
 *
 * ## 왜 없앴나
 * 같은 행위(매장을 데려온다)에 신분별로 다른 보상이 붙어 있었다 —
 * 사람이면 2%·1년, 에이전시면 1%·24개월. 그래서 "영입자와 대행사의 경계"가 모호했다(대표 지적).
 * 대행사는 **채널 요율 차액**(직접 10% − 대행 5%)으로 이미 보상받으므로 별도 % 를 얹지 않는다.
 *
 * ## 이 테스트가 못 막는 것
 * 정산·원장·cron 이 `agency_store_intro_commissions` 를 **읽는** 것은 그대로 둔다(과거 행 보호).
 * 그 읽기 경로가 살아 있는지는 각자의 테스트가 본다. 여기서 보는 것은 **새 적립이 0** 이라는 것뿐이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

const ORDERS = codeOnly(readFileSync('src/worker/utils/order-commissions.ts', 'utf-8'))
const GB = codeOnly(readFileSync('src/features/group-buy/api/group-buy.routes.ts', 'utf-8'))
const SETTINGS = codeOnly(readFileSync('src/worker/utils/platform-settings-validation.ts', 'utf-8'))

describe('에이전시 매장영입 1% — 새 적립 경로가 없다', () => {
  it('오케스트레이터가 더 이상 적립을 호출하지 않는다', () => {
    expect(ORDERS).not.toContain('creditAgencyStoreIntroCommission')
  })

  it('예산 요청에도 안 올린다', () => {
    // 요청만 올리고 적립을 안 하면 예산을 잡아만 두고 다른 축 몫이 사라진다(가장 조용한 손실).
    expect(ORDERS).not.toContain('computeAgencyStoreIntroRequest')
    expect(ORDERS).not.toContain("key: 'agency_intro'")
  })

  it("축 타입에서 'agency_intro' 가 빠져 호출부가 컴파일로 막힌다", () => {
    const m = ORDERS.match(/export type CommissionAxis = ([^\n]+)/)
    expect(m, 'CommissionAxis 선언을 찾지 못했다').toBeTruthy()
    expect(m![1]).not.toContain('agency_intro')
  })

  it('공구 결제 두 경로(딜·카드)가 그 축을 부르지 않는다', () => {
    expect(GB).not.toContain("only: ['agency_intro']")
  })

  it('어드민 설정으로도 되살릴 수 없다', () => {
    expect(SETTINGS).not.toContain("'agency_intro'")
  })
})

describe('환불 역전은 남는다 (비대칭 금지)', () => {
  it('환불 경로 둘 다 역전을 계속 부른다', () => {
    // 적립만 없애고 역전까지 지우면, 과거·수동 행이 환불돼도 안 돌아온다.
    // ⚠️ `toContain('reverseAgencyStoreIntroOnRefund')` 로 쓰면 이름을 `..._REMOVED` 로 바꿔도
    //   앞부분이 일치해 통과한다(실제로 되돌려-검증에서 이 가드가 헛돌았다). **호출 형태**로 본다.
    for (const f of ['src/worker/utils/order-refund.ts', 'src/features/returns/api/returns.routes.ts']) {
      const src = codeOnly(readFileSync(f, 'utf-8'))
      expect(src, `${f}: import`).toMatch(/reverseAgencyStoreIntroOnRefund\s*[},]/)
      expect(src, `${f}: 호출`).toMatch(/reverseAgencyStoreIntroOnRefund\s*\(/)
    }
  })
})

describe('사람 영입 2% 는 그대로 산다', () => {
  it('influencer_intro 축은 건드리지 않았다', () => {
    expect(ORDERS).toContain('creditInfluencerStoreIntroCommission')
    expect(ORDERS).toContain('computeInfluencerStoreIntroRequest')
  })
})
