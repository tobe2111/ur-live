/**
 * 💎 2026-08-31 대표 *"정산 최소 10만원은 딜 사용은 상관없이 쓰게 해줘"*
 *
 * 최소 금액(`influencer_payout_min`, 라이브 100,000)의 근거는 **은행 송금 비용**이다.
 * 딜은 우리 안에서 숫자를 더하는 일이라 그 비용이 0 이므로 문턱을 씌울 이유가 없다.
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 D1 이 그 SQL 로 옳은 행을 돌려주는지,
 *   어드민 [처리]가 실제로 딜을 적립하는지. 그건 staging 에서만 판정된다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as codeOnly } from '../helpers/source-text'

const CRON = codeOnly(readFileSync('src/worker/cron/influencer-payout.ts', 'utf-8'))
const ADMIN = codeOnly(readFileSync('src/features/group-buy/api/marketing.routes.ts', 'utf-8'))

/** 조건절만 뽑는다 — 공백/줄바꿈에 흔들리지 않게 정규화. */
const norm = (s: string) => s.replace(/\s+/g, ' ')

describe('딜 수령자는 최소 금액에 걸리지 않는다', () => {
  it('cron 의 지급대상 쿼리가 딜을 최소액에서 면제한다', () => {
    expect(norm(CRON)).toContain("payout_method = 'deal' OR available_amount >= ?")
  })

  it('어드민 목록 쿼리도 같은 조건을 쓴다', () => {
    // 갈리면 "cron 알림엔 떴는데 어드민 목록엔 없다"가 난다 — 어드민이 지급을 못 한다.
    expect(norm(ADMIN)).toContain("payout_method = 'deal' OR available_amount >= ?")
  })

  it('두 곳 모두 0원은 여전히 제외한다', () => {
    // 면제가 "조건 제거"로 퇴화하면 잔액 0 인 행까지 목록에 뜬다.
    expect(norm(CRON)).toContain('available_amount > 0')
    expect(norm(ADMIN)).toContain('available_amount > 0')
  })

  it('현금 경로의 최소액은 살아 있다', () => {
    // 송금 비용이 실재하므로 현금 문턱까지 없애면 안 된다.
    expect(CRON).toContain("'influencer_payout_min'")
    expect(ADMIN).toContain("'influencer_payout_min'")
  })
})

describe('고르는 화면이 그 차이를 말해 준다', () => {
  const PAGE = readFileSync('src/pages/InfluencerSettlementPage.tsx', 'utf-8')
  const ADMIN_PAGE = readFileSync('src/pages/AdminInfluencerPayoutsPage.tsx', 'utf-8')

  it('소개자 화면: 현금엔 문턱, 딜엔 제한 없음이 적혀 있다', () => {
    // 안 적히면 딜을 골라 바로 받을 수 있는 사람도 10만원을 기다리는 줄 안다.
    expect(PAGE).toContain('10만원 이상부터')
    expect(PAGE).toContain('금액 제한 없음')
  })

  it('어드민 화면 부제가 "최소 N원 이상"으로 뭉뚱그리지 않는다', () => {
    expect(ADMIN_PAGE).toContain('딜은 금액 제한 없음')
  })
})
