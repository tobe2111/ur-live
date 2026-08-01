/**
 * 📅 **수집 타임라인** — 두 풀의 컬럼이 다르다는 사실과 KST 규약을 고정한다.
 *
 * 여기서 막는 사고 두 가지:
 * 1. **컬럼 혼동** — `ad_influencer_leads.collected_at` ↔ `ad_company_leads.created_at`.
 *    한쪽 이름으로 둘 다 조회하면 `no such column` 500 이거나, 더 나쁘게 **조용히 0건**이 된다.
 * 2. **날짜가 하루 밀림** — D1 값은 `Z` 없는 UTC 문자열이라 그냥 `DATE()` 하면 한국 사용자에게
 *    전날/다음날을 보여준다. 이 레포가 이미 실사고 4건을 낸 클래스(CLAUDE.md UTC 표 참조).
 */
import { describe, it, expect } from 'vitest'
import {
  POOL_SOURCE, buildTimelineSql, resolveDays, getPoolTimeline,
  TIMELINE_MAX_DAYS, TIMELINE_DEFAULT_DAYS,
} from '@/features/marketing/api/pool-timeline'

describe('🔒 두 풀은 테이블·시각 컬럼이 다르다', () => {
  it('표가 실제 스키마와 일치한다', () => {
    expect(POOL_SOURCE.influencer).toEqual({ table: 'ad_influencer_leads', tsColumn: 'collected_at' })
    expect(POOL_SOURCE.company).toEqual({ table: 'ad_company_leads', tsColumn: 'created_at' })
  })

  it('각 풀의 SQL 이 자기 컬럼만 쓴다 — 남의 컬럼이 새어 들어가면 500 이거나 조용히 0건', () => {
    const inf = buildTimelineSql('influencer', 30)
    expect(inf).toContain('ad_influencer_leads')
    expect(inf).toContain('collected_at')
    expect(inf).not.toContain('created_at')

    const co = buildTimelineSql('company', 30)
    expect(co).toContain('ad_company_leads')
    expect(co).toContain('created_at')
    expect(co).not.toContain('collected_at')
  })
})

describe('🔒 날짜는 KST 달력일이다 (하루 밀림 방지)', () => {
  it('그룹 키와 범위 조건 **둘 다** +9 hours 로 보정한다', () => {
    for (const pool of ['influencer', 'company'] as const) {
      const sql = buildTimelineSql(pool, 30)
      const col = POOL_SOURCE[pool].tsColumn
      // 그룹 키
      expect(sql).toContain(`DATE(${col}, '+9 hours') AS d`)
      // 범위 조건도 같은 규약 — UTC 로 자르고 KST 로 묶으면 경계일이 부분치가 된다
      expect(sql).toContain(`DATE(${col}, '+9 hours') >= DATE('now', '+9 hours'`)
    }
  })

  it('보정 없는 DATE() 가 남아 있지 않다', () => {
    for (const pool of ['influencer', 'company'] as const) {
      const col = POOL_SOURCE[pool].tsColumn
      expect(buildTimelineSql(pool, 7)).not.toMatch(new RegExp(`DATE\\(${col}\\)`))
    }
  })
})

describe('resolveDays — 오타 하나로 500 이 나면 안 된다', () => {
  it('정상값', () => {
    expect(resolveDays('7')).toBe(7)
    expect(resolveDays(14)).toBe(14)
  })
  it('비숫자/0/음수/공백/undefined 는 기본값', () => {
    for (const bad of ['abc', '0', '-5', '', '   ', undefined, null, {}]) {
      expect(resolveDays(bad)).toBe(TIMELINE_DEFAULT_DAYS)
    }
  })
  it('과대값은 상한으로 클램프 — 무한 range 로 D1 을 훑지 않는다', () => {
    expect(resolveDays('99999')).toBe(TIMELINE_MAX_DAYS)
  })
  it('🔒 SQL 에 들어가는 일수는 항상 정수다(인젝션 표면 0)', () => {
    expect(buildTimelineSql('influencer', resolveDays('30.9'))).toContain("-30 days")
    expect(buildTimelineSql('influencer', resolveDays('abc'))).toContain(`-${TIMELINE_DEFAULT_DAYS} days`)
  })
})

describe('getPoolTimeline — 한쪽이 죽어도 다른 쪽은 보인다', () => {
  const fakeDB = (dayRows: unknown, meta: unknown) => ({
    prepare: (sql: string) => ({
      all: async () => {
        if (dayRows === 'throw') throw new Error('boom')
        return { results: dayRows as never[] }
      },
      first: async () => {
        if (meta === 'throw') throw new Error('boom')
        return meta as never
      },
      _sql: sql,
    }),
  })

  it('정상 집계 — 합계와 최신순', async () => {
    const t = await getPoolTimeline(
      fakeDB([{ d: '2026-08-02', n: 12 }, { d: '2026-08-01', n: 30 }], { n: 40793, since: '2026-07-10' }),
      'influencer', 30)
    expect(t.rows).toEqual([{ date: '2026-08-02', count: 12 }, { date: '2026-08-01', count: 30 }])
    expect(t.total).toBe(42)
    expect(t.allTime).toBe(40793)
    expect(t.since).toBe('2026-07-10')
  })

  it('일자 쿼리가 터져도 누적/시작일은 살아서 온다', async () => {
    const t = await getPoolTimeline(fakeDB('throw', { n: 100, since: '2026-07-01' }), 'company', 30)
    expect(t.rows).toEqual([])
    expect(t.total).toBe(0)
    expect(t.allTime).toBe(100)
  })

  it('빈 풀에서도 터지지 않는다', async () => {
    const t = await getPoolTimeline(fakeDB([], { n: 0, since: null }), 'company', 30)
    expect(t.allTime).toBe(0)
    expect(t.since).toBeNull()
  })

  it('수집이 없던 날은 0 을 만들어 넣지 않는다(없는 날 = 행 없음)', async () => {
    const t = await getPoolTimeline(fakeDB([{ d: '2026-08-02', n: 5 }], { n: 5, since: '2026-08-02' }), 'influencer', 30)
    expect(t.rows).toHaveLength(1)
  })
})

describe('🚧 배선 — 두 라우터가 실제로 이 SSOT 를 쓴다', () => {
  it('인플루언서/업체 라우터에 timeline 엔드포인트가 배선돼 있다', async () => {
    const fs = await import('node:fs')
    const inf = fs.readFileSync('src/features/marketing/api/admin-ads-influencers.routes.ts', 'utf8')
    expect(inf).toMatch(/app\.get\('\/influencer-pool\/timeline'/)
    expect(inf).toContain("getPoolTimeline(c.env.DB, 'influencer'")

    const co = fs.readFileSync('src/features/marketing/api/partner-pool.routes.ts', 'utf8')
    expect(co).toMatch(/app\.get\('\/timeline'/)
    expect(co).toContain("getPoolTimeline(c.env.DB, 'company'")
  })
})
