/**
 * 🍽️ **캐시 + 오늘만 실시간** — 화면에 내보내는 통계의 계약 (2026-08-31).
 *
 * ## 왜 이렇게 나눴나
 * 이 표의 숫자는 **수집 회차가 만든다**(시간당 1회). 그래서 분포(업종·tier·소스)는 1시간 캐시로
 * 충분하고, 5분마다 다시 세는 것은 같은 답을 12번 구하는 짓이었다(회당 93만 행).
 *
 * **딱 하나 예외가 오늘 유입**이다 — 대표가 "수집이 살아 있나"를 보는 숫자다. 이게 낡으면
 * **멀쩡히 도는데 멈춘 것처럼 보인다.** 그건 성능이 아니라 오보다. 그래서 그것만 매번 다시 센다.
 *
 * ## 🩸 이 시험은 한 번 "지키는 척"만 했다 (2026-08-31, 주입 검증이 잡았다)
 * 처음엔 **소스 문자열**만 봤다 — 덮어쓰기 줄이 있는가, `unshift` 가 있는가. 그런데
 * `const today = await todayInflow(DB)` 를 `const today = null` 로 바꿔도 **그 줄들은 그대로 남아**
 * 전부 통과했다. 즉 "오늘을 매번 다시 센다"는 핵심 계약을 아무도 안 지키고 있었다.
 * ⇒ 겹치는 부분은 **동작으로** 본다(모듈을 갈아 끼우고 실제로 부른다). SQL 모양처럼
 *   실행으로 확인할 수 없는 것만 문자열로 남긴다.
 *
 * ⚠️ 못 보는 것: 실제 읽는 행 수는 라이브 `meta.rows_read` 로만 판정된다(실측 7,234행).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { COMPANY_STATS_TTL_MS, COMPANY_STATS_MAX_STALE_MS } from '@/features/marketing/api/company-stats-cache'

vi.mock('@/features/marketing/api/company-discovery', () => ({ companyStats: vi.fn() }))
vi.mock('@/features/marketing/api/company-stats-cache', async (orig) => ({
  ...(await orig<Record<string, unknown>>()),
  getCompanyStatsCached: vi.fn(),
}))
vi.mock('@/features/marketing/api/company-breakdown', () => ({ todayInflow: vi.fn() }))

import { serveCompanyStats } from '@/features/marketing/api/company-stats-serve'
import { getCompanyStatsCached } from '@/features/marketing/api/company-stats-cache'
import { todayInflow } from '@/features/marketing/api/company-breakdown'

const cached = vi.mocked(getCompanyStatsCached as unknown as (...a: unknown[]) => unknown)
const today = vi.mocked(todayInflow as unknown as (...a: unknown[]) => unknown)
const DB = {} as never

/** 캐시가 돌려주는 표 — 오늘(08-31) 막대가 낡아 있고 어제(08-30)는 확정값이다. */
const cachedStats = (byDay: Array<{ d: string; n: number; reachable: number }>) => ({
  stats: { total: 400_000 }, byDay, byCategory: [], bySource: [],
})

beforeEach(() => {
  cached.mockReset(); today.mockReset()
})

const SRC = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')
const BREAKDOWN = SRC('src/features/marketing/api/company-breakdown.ts')
const ROUTE = SRC('src/features/marketing/api/partner-pool.routes.ts')

describe('⏱️ 수명이 수집 주기에 맞춰져 있다', () => {
  it('🔒 TTL 이 수집 회차(시간당 1회)와 같은 눈금 — 더 짧으면 같은 답을 여러 번 구한다', () => {
    expect(COMPANY_STATS_TTL_MS).toBeGreaterThanOrEqual(30 * 60_000)
    expect(COMPANY_STATS_TTL_MS, '너무 길면 분포가 하루씩 낡는다').toBeLessThanOrEqual(3 * 60 * 60_000)
  })

  it('🔒 낡은 값 한계가 TTL 보다 커야 stale-while-revalidate 가 성립한다', () => {
    // 한계 <= TTL 이면 낡은 값 구간이 **존재하지 않아** 항상 동기 계산이 된다(조용한 무력화).
    expect(COMPANY_STATS_MAX_STALE_MS).toBeGreaterThan(COMPANY_STATS_TTL_MS)
  })
})

describe('📅 오늘 유입 — 캐시에서 꺼내지 않고 매번 다시 센다', () => {
  it('🔒 **실제로 다시 센다** — 캐시가 있어도 오늘 조회를 한 번 부른다', async () => {
    // 이 한 줄이 "지키는 척" 을 막는다: 오늘을 상수/캐시로 대체하면 이 호출이 사라진다.
    cached.mockResolvedValue({ stats: cachedStats([{ d: '2026-08-31', n: 1, reachable: 0 }]), at: 1 })
    today.mockResolvedValue({ d: '2026-08-31', n: 7_234, reachable: 900 })
    await serveCompanyStats(DB, false)
    expect(today).toHaveBeenCalledTimes(1)
    expect(today).toHaveBeenCalledWith(DB)
  })

  it('🔒 오늘 막대를 **덮어쓴다**(더하지 않는다 — 병합·삭제가 반영 안 된다)', async () => {
    cached.mockResolvedValue({
      stats: cachedStats([
        { d: '2026-08-31', n: 1, reachable: 0 },   // 캐시에 남은 낡은 오늘
        { d: '2026-08-30', n: 5_429, reachable: 800 },
      ]),
      at: 1,
    })
    today.mockResolvedValue({ d: '2026-08-31', n: 7_234, reachable: 900 })
    const out = await serveCompanyStats(DB, false)
    expect(out.stats.byDay[0]).toEqual({ d: '2026-08-31', n: 7_234, reachable: 900 })
    expect(out.stats.byDay[1], '과거 막대는 안 변한다').toEqual({ d: '2026-08-30', n: 5_429, reachable: 800 })
    expect(out.stats.stats.total, '오늘치를 total 에 더하면 병합·삭제가 반영 안 돼 조용히 어긋난다').toBe(400_000)
  })

  it('🔒 캐시에 오늘 막대가 없으면 끼워 넣는다 — 자정 직후 0 으로 보이면 안 된다', async () => {
    cached.mockResolvedValue({ stats: cachedStats([{ d: '2026-08-30', n: 5_429, reachable: 800 }]), at: 1 })
    today.mockResolvedValue({ d: '2026-08-31', n: 12, reachable: 3 })
    const out = await serveCompanyStats(DB, false)
    expect(out.stats.byDay[0], '오늘이 맨 앞에 와야 최신순 추세가 유지된다').toEqual({ d: '2026-08-31', n: 12, reachable: 3 })
    expect(out.stats.byDay).toHaveLength(2)
  })

  it('🔒 실패하면 캐시 값을 그대로 쓴다 — 오늘 숫자가 잠깐 낡는 게 화면이 죽는 것보다 낫다', async () => {
    const byDay = [{ d: '2026-08-30', n: 5_429, reachable: 800 }]
    cached.mockResolvedValue({ stats: cachedStats(byDay), at: 77 })
    today.mockResolvedValue(null)
    const out = await serveCompanyStats(DB, false)
    expect(out.stats.byDay).toEqual(byDay)
    expect(out.at, '언제 기준인지는 그대로 알려 준다').toBe(77)
    expect(BREAKDOWN, '실패를 0 으로 적으면 "오늘 0건"이라는 거짓말이 된다').toMatch(/if \(!r \|\| !r\.d\) return null/)
  })

  it('🔒 오늘 경계는 **서버가** 정한다 — 클라 기준이면 브라우저 TZ 로 9시간 어긋난다', () => {
    expect(BREAKDOWN).toMatch(/DATE\('now','\+9 hours'\) AS d/)
    expect(BREAKDOWN, '날짜 비교도 KST 로').toMatch(/DATE\(collected_at,'\+9 hours'\) = DATE\('now','\+9 hours'\)/)
  })

  it('🔒 오늘치만 읽는다 — 범위 조건이 빠지면 다시 전수 스캔이다(실측 7,234 → 46만)', () => {
    expect(BREAKDOWN).toMatch(/collected_at >= datetime\('now','-1 days'\)/)
  })
})

describe('🔌 배선 — 라우트가 이 경로를 탄다', () => {
  it('/stats 가 serveCompanyStats 를 부른다(캐시만 부르면 오늘이 낡는다)', () => {
    expect(ROUTE).toMatch(/serveCompanyStats\(statsDb, fresh\w*, p => c\.executionCtx\?\.waitUntil\(p\)\)/)
    expect(ROUTE, '라우트가 집계를 직접 부르면 이 분리가 무의미하다').not.toMatch(/companyStats\(statsDb\)/)
  })

  it('🔒 갱신을 응답 뒤로 넘긴다 — 캐시 계층에 `bg` 를 그대로 전달한다', async () => {
    cached.mockResolvedValue({ stats: cachedStats([]), at: 1 })
    today.mockResolvedValue(null)
    const bg = vi.fn()
    await serveCompanyStats(DB, false, bg)
    expect(cached.mock.calls[0][3], 'bg 를 안 넘기면 만료 첫 방문자가 10초 기다린다').toBe(bg)
  })
})
