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

// 🔀 2026-08-19: 유어애즈 리드 DB 분리로 핸들이 `env.DB` → `adsLeadsDb(env)` 가 됐다.
//   여기서 보려는 것은 **'요청 스코프 DB 핸들을 넘기는가'** 이지 그 표현식의 철자가 아니다 —
//   철자로 고정하면 리팩토링이 배선 가드를 조용히 무력화한다(dashboard-session 에서 겪은 그 함정).
describe('🔒 시각 컬럼은 DDL 이 진실이다', () => {
  /**
   * 🔴 **2026-08-02 실사고 — 이 테스트의 첫 판은 실패할 수 없었다.**
   * `expect(POOL_SOURCE.company).toEqual({ …, tsColumn: 'created_at' })` 로 **내 상수를 내 상수와**
   * 비교했다. 그래서 값이 틀렸는데도 초록이었고, 라이브에서 `ad_company_leads` 조회가
   * `no such column` → `.catch(() => null)` → **에러 없이 allTime: 0** 으로 나왔다
   * (17만 건짜리 풀이 빈 것처럼 보였다). 오늘 네 번째 "실패할 수 없는 가드"다.
   * ⇒ 이제 **CREATE TABLE 원문을 읽어** 대조한다. 상수가 틀리면 여기서 빨간불이 뜬다.
   */
  const DDL: Record<string, string> = {
    ad_influencer_leads: 'src/features/marketing/api/influencer-schema.ts',
    ad_company_leads: 'src/features/marketing/api/company-discovery.ts',
  }

  it('표의 컬럼이 그 테이블 DDL 에 실제로 있다', async () => {
    const fs = await import('node:fs')
    for (const src of Object.values(POOL_SOURCE)) {
      const file = DDL[src.table]
      expect(file, `${src.table} 의 DDL 위치를 모른다 — 표에 새 풀을 넣었으면 여기도 넣을 것`).toBeTruthy()
      const text = fs.readFileSync(file, 'utf8')
      const at = text.indexOf(`CREATE TABLE IF NOT EXISTS ${src.table}`)
      expect(at, `${file} 에서 ${src.table} DDL 을 못 찾았다(코드 이동?)`).toBeGreaterThan(-1)
      const ddl = text.slice(at, at + 4000)
      expect(ddl, `${src.table} 에 ${src.tsColumn} 컬럼이 없다`).toMatch(new RegExp(`\\b${src.tsColumn}\\s+DATETIME`))
    }
  })

  it('두 풀 다 collected_at 이다 — 한쪽만 바꾸면 조용히 0건이 된다', () => {
    expect(POOL_SOURCE.influencer.tsColumn).toBe('collected_at')
    expect(POOL_SOURCE.company.tsColumn).toBe('collected_at')
  })

  it('각 풀의 SQL 이 자기 테이블만 쓴다', () => {
    const inf = buildTimelineSql('influencer', 30)
    expect(inf).toContain('ad_influencer_leads')
    expect(inf).not.toContain('ad_company_leads')

    const co = buildTimelineSql('company', 30)
    expect(co).toContain('ad_company_leads')
    expect(co).not.toContain('ad_influencer_leads')
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
    // ⚠️ 2026-08-02: 파일크기 캡으로 라우트가 pool-timeline.routes.ts 로 옮겨갔다.
    //   가드가 옛 파일만 보면 **불변식은 멀쩡한데 빨간불**이 난다(오늘 self-beat 에서 겪은 '낡은 지도').
    const inf = fs.readFileSync('src/features/marketing/api/pool-timeline.routes.ts', 'utf8')
    expect(inf).toMatch(/app\.get\('\/influencer-pool\/timeline'/)
    expect(inf).toMatch(/getPoolTimeline\((?:adsLeadsDb\((?:c\.)?env\)|(?:c\.)?env\.DB), 'influencer'/)

    const co = fs.readFileSync('src/features/marketing/api/partner-pool.routes.ts', 'utf8')
    expect(co).toMatch(/app\.get\('\/timeline'/)
    expect(co).toMatch(/getPoolTimeline\((?:adsLeadsDb\((?:c\.)?env\)|(?:c\.)?env\.DB), 'company'/)
  })
})
