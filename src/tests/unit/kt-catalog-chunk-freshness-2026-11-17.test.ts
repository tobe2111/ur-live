/**
 * 🧩🩺 2026-11-17 — KT 교환권 목록 조각 갱신 + 데이터 신선도 감시(대표 "모두 가장 이상적이고 영구적으로").
 * 배경: KT 목록이 2026-05-19 부터 반 년 동안 갱신 안 됐는데 경보가 0이었다(skip 을 성공으로 기록) ·
 *   위임 첫 회차는 한 요청이 100초를 넘겨 524.
 * 고정: 조각 계획(이어하기·하루 한 바퀴) · 바퀴 완료 판정 · 대량 내리기 방지(80%) · 비밀값 없으면 실패(throw) ·
 *   신선도 판정(30시간·잔액 기준) · scheduled 배선(매시 :45 조각 · 매일 신선도) · 옛 하루 1회 전체 갱신 부활 금지.
 * ⚠️ 못 보는 것: 실제 KT API 응답 모양(`listNum`·`goodsList`) — 라이브 하트비트 result 로 판정.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { planChunk, passDone, safeToDeactivate, runKtAlphaCatalogChunk, KT_PASS_INTERVAL_HOURS } from '@/worker/cron/kt-alpha-catalog-chunk'
import { freshnessProblems, KT_STALE_HOURS } from '@/worker/cron/data-freshness'

const NOW = Date.parse('2026-11-17T12:00:00Z')
const sql = (ms: number) => new Date(ms).toISOString().slice(0, 19).replace('T', ' ')
const cur = (o: Partial<{ next_page: number; total: number; received: number; empty_streak: number }> = {}) =>
  ({ pass_started_at: '2026-11-17 03:00:00', next_page: 3, total: 2200, received: 200, empty_streak: 0, ...o })

describe('KT 조각 갱신', () => {
  it('진행 중인 바퀴는 이어서 한다', () => {
    expect(planChunk(cur(), sql(NOW - 3600_000), '', NOW)).toBe('continue')
  })
  it('마지막 완료가 20시간 안이면 쉰다(KT 호출 0), 넘으면 새 바퀴', () => {
    expect(planChunk(null, sql(NOW - (KT_PASS_INTERVAL_HOURS - 1) * 3600_000), '', NOW)).toBe('idle')
    expect(planChunk(null, sql(NOW - (KT_PASS_INTERVAL_HOURS + 1) * 3600_000), '', NOW)).toBe('start')
    expect(planChunk(null, null, '', NOW)).toBe('start')
    expect(planChunk(null, '깨진값', '', NOW)).toBe('start')
  })
  it('바퀴 완료 = 전체를 다 받았거나 빈 페이지 연속 2번', () => {
    expect(passDone(cur({ received: 2200 }))).toBe(true)
    expect(passDone(cur({ empty_streak: 2 }))).toBe(true)
    expect(passDone(cur())).toBe(false)
  })
  it('80% 미만만 받았거나 전체를 모르면 내리지 않는다(대량 오판 방지)', () => {
    expect(safeToDeactivate(cur({ received: 1760 }))).toBe(true)
    expect(safeToDeactivate(cur({ received: 1700 }))).toBe(false)
    expect(safeToDeactivate(cur({ total: 0, received: 5000 }))).toBe(false)
  })
  it('비밀값이 없으면 조용히 skip 하지 않고 실패로 던진다', async () => {
    await expect(runKtAlphaCatalogChunk({ DB: {} as D1Database })).rejects.toThrow(/KT_ALPHA_AUTH_CODE/)
  })
})

describe('데이터 신선도', () => {
  const base = { ktEnabled: true, ktLastSyncAt: sql(NOW - 3600_000), ktBalance: 200_000, ktLowWon: 100_000 }
  it('최근이고 잔액 충분하면 이상 없음', () => { expect(freshnessProblems(base, NOW)).toEqual([]) })
  it(`${KT_STALE_HOURS}시간 넘게 갱신 안 되면 경보 — 반 년 침묵을 잡는다`, () => {
    const p = freshnessProblems({ ...base, ktLastSyncAt: '2026-05-19 12:57:23' }, NOW)
    expect(p[0]).toMatch(/일 .*시간째 갱신 안 됨/)
  })
  it('기록이 없어도 경보', () => { expect(freshnessProblems({ ...base, ktLastSyncAt: null }, NOW)).toHaveLength(1) })
  it('잔액이 기준 미만이면 경보', () => { expect(freshnessProblems({ ...base, ktBalance: 7_680 }, NOW)[0]).toMatch(/7,680원/) })
  it('KT 를 안 쓰면 판정하지 않는다', () => { expect(freshnessProblems({ ...base, ktEnabled: false, ktLastSyncAt: null }, NOW)).toEqual([]) })
})

describe('배선', () => {
  const s = readFileSync('src/worker/scheduled.ts', 'utf8')
  it('매시 :45 조각 갱신 · 매일 신선도 감시', () => {
    expect(s).toMatch(/slotOpen\(\{ minute: 45 \}\)\) ctx\.waitUntil\(slotCron\('45 \* \* \* \*'\)\('kt-alpha-catalog-sync'/)
    expect(s).toContain('runKtAlphaCatalogChunk(env')
    expect(s).toMatch(/slotCron\('20 0 \* \* \*'\)\('data-freshness'/)
  })
  it('옛 하루 1회 전체 갱신이 cron 에 돌아오지 않는다(100초 초과 524)', () => {
    expect(s).not.toMatch(/slotCron\('30 3 \* \* \*'\)\('kt-alpha-catalog-sync'/)
  })
  it('위임 받는 쪽도 조각 갱신을 돌린다', () => {
    expect(readFileSync('src/worker/routes/cron-delegate.routes.ts', 'utf8')).toContain('runKtAlphaCatalogChunk(c.env')
  })
})
