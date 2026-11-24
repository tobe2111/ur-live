import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

/**
 * 🩸 2026-11-24 — 동네공구 만료 보증금 자동 환불(시간별 cron)이 한 번도 돌지 않았다.
 *
 * cron 이 `NOT EXISTS (SELECT 1 FROM community_group_buy_refunds …)` 로 읽는데 그 표는 라우트만 만들었다.
 * 라이브에 표가 없어 쿼리가 터졌고 `.catch(() => ({ results: [] }))` 가 삼켜 환불 대상이 늘 0건이었다
 * (실측: 실패 그룹의 deposited 보증금 5,000딜이 묶여 있었다).
 *
 * 고정하는 것: ① cron 이 그 NOT EXISTS 쿼리보다 **먼저** 표를 만든다 ② 라우트와 cron 이 **같은** 생성 함수를 쓴다.
 * 못 막는 것: 생성 자체가 실패하는 경우(그때는 블록 전체가 catch 로 건너뛰고 다음 정각에 재시도한다).
 */
const CRON = readFileSync('src/worker/cron/scheduled-cleanup.ts', 'utf8')
const ROUTE = readFileSync('src/features/community-group-buy/api/community-group-buy.routes.ts', 'utf8')

describe('동네공구 환불 멱등 표 — cron 이 읽기 전에 만든다', () => {
  it('① cron: ensureCommunityRefundTable 호출이 NOT EXISTS 읽기보다 앞', () => {
    const ensure = CRON.indexOf('ensureCommunityRefundTable(DB)')
    const read = CRON.indexOf('SELECT 1 FROM community_group_buy_refunds')
    expect(ensure).toBeGreaterThan(0)
    expect(read).toBeGreaterThan(0)
    expect(ensure).toBeLessThan(read)
  })
  it('② 라우트도 같은 함수로 만든다(표 정의는 한 곳)', () => {
    expect(ROUTE).toContain("from './refund-table'")
    expect(ROUTE).not.toMatch(/CREATE TABLE IF NOT EXISTS community_group_buy_refunds/)
  })
})
