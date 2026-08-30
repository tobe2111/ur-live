/**
 * 📉 **파트너 풀 통계 캐시** — 화면 한 번에 331만 행, 버튼 한 번에 1.19억 행이던 것 (2026-08-31).
 *
 * ## 무엇을 지키나 (통제 실험으로 잰 값)
 * ```
 *   GET /api/admin/partner-pool/stats  1회  →  rows_read 3,317,537  (전수 집계 8번)
 *   레인 실행 버튼 → 5초마다 36번 폴링       →  약 1억 1,900만 행
 * ```
 * D1 무료 한도가 하루 500만 행이다. 업체 DB 하루 읽기가 ~1억이던 정체가 이 폴링이었다.
 *
 * ## 이 시험이 지키는 세 가지
 * 1. **집계만 캐시하고 상태는 신선하게** — 폴러의 완료 감지가 보는 것은 레인 상태 블롭이라,
 *    그쪽까지 캐시하면 "완료를 영영 못 알아채는" 더 나쁜 버그가 된다.
 * 2. **캐시가 늙는다** — 안 늙으면 화면 숫자가 굳고, 그건 조용한 오보다.
 * 3. **쓰기 뒤엔 버린다** — 추가·삭제 직후 화면이 안 바뀌면 관리자가 "저장이 안 됐나" 로 읽는다.
 *
 * ## ⚠️ 못 막는 것
 * 라이브에서 실제로 읽기가 줄었는지는 `meta.rows_read` 로만 판정된다. 여기선 계약만 본다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import {
  parseStatsCache, shouldRecomputeStats, getCompanyStatsCached, canServeStale,
  COMPANY_STATS_TTL_MS, COMPANY_STATS_CACHE_KEY, COMPANY_STATS_MAX_STALE_MS,
} from '@/features/marketing/api/company-stats-cache'

const ROUTE = readFileSync(resolve(process.cwd(), 'src/features/marketing/api/partner-pool.routes.ts'), 'utf8')
const NOW = 1_800_000_000_000

/** D1 흉내 — 마지막 SQL 과 바인딩을 기록해 "무엇을 몇 번 물었나"를 볼 수 있게 한다. */
function fakeDb(stored: string | null) {
  const calls: string[] = []
  const db = {
    prepare(sql: string) {
      calls.push(sql)
      return {
        bind(..._a: unknown[]) { return this },
        first: async () => (sql.includes('SELECT value') ? (stored === null ? null : { value: stored }) : null),
        run: async () => { if (sql.startsWith('INSERT')) stored = 'written'; return null },
      }
    },
  }
  return { db: db as unknown as D1Database, calls }
}

describe('캐시 판정 — 모양이 이상하면 그냥 다시 계산한다', () => {
  it('신선하면 재계산하지 않는다', () => {
    const c = parseStatsCache({ at: NOW - 1000, data: { total: 1 } } as never)
    expect(shouldRecomputeStats(parseStatsCache(JSON.stringify({ at: NOW - 1000, data: { total: 1 } })), NOW)).toBe(false)
    expect(c).toBeNull() // 문자열이 아닌 입력은 파싱 대상이 아니다(계약 확인)
  })

  it('🔒 TTL 을 넘기면 반드시 재계산 — 이게 숫자가 굳지 않게 하는 유일한 장치다', () => {
    const cached = parseStatsCache(JSON.stringify({ at: NOW - COMPANY_STATS_TTL_MS, data: { total: 1 } }))
    expect(shouldRecomputeStats(cached, NOW)).toBe(true)
  })

  it('🔒 TTL 이 0 도 하루도 아니다 — 0 이면 캐시가 없는 것이고 너무 길면 오보가 된다', () => {
    expect(COMPANY_STATS_TTL_MS).toBeGreaterThan(30_000)
    expect(COMPANY_STATS_TTL_MS).toBeLessThanOrEqual(60 * 60_000)
  })

  it.each([
    ['', '빈 값(첫 조회)'],
    ['not json', '깨진 JSON'],
    [JSON.stringify({ data: { total: 1 } }), '시각 없음 — 늙힐 수가 없다'],
    [JSON.stringify({ at: 'x', data: { total: 1 } }), '시각이 숫자가 아님'],
    [JSON.stringify({ at: NOW + 3_600_000, data: { total: 1 } }), '미래 시각 — 시계가 튀어도 안 굳는다'],
    [JSON.stringify({ at: NOW, data: null }), '내용이 없음'],
  ])('깨진 캐시(%#)는 재계산 — %s', (raw, _why) => {
    expect(shouldRecomputeStats(parseStatsCache(raw as string), NOW)).toBe(true)
  })
})

describe('getCompanyStatsCached — 값이 있으면 집계를 부르지 않는다', () => {
  it('🔒 캐시 적중 시 compute 를 **한 번도** 부르지 않는다(이게 331만 행을 아끼는 지점이다)', async () => {
    let calls = 0
    const { db } = fakeDb(JSON.stringify({ at: Date.now(), data: { total: 7 } }))
    const r = await getCompanyStatsCached<{ total: number }>(db, false, async () => { calls++; return { total: 999 } })
    expect(calls, 'compute 가 불렸다 = 캐시가 무의미하다').toBe(0)
    expect(r.stats.total).toBe(7)
  })

  it('캐시가 없으면 계산하고 저장한다', async () => {
    let calls = 0
    const { db, calls: sql } = fakeDb(null)
    const r = await getCompanyStatsCached<{ total: number }>(db, false, async () => { calls++; return { total: 5 } })
    expect(calls).toBe(1)
    expect(r.stats.total).toBe(5)
    expect(sql.some(s => s.startsWith('INSERT')), '계산만 하고 저장을 안 하면 다음 호출도 또 331만 행이다').toBe(true)
  })

  it('🔒 `fresh` 는 캐시를 읽지도 않는다 — 우회로가 캐시를 보면 우회가 아니다', async () => {
    let calls = 0
    const { db, calls: sql } = fakeDb(JSON.stringify({ at: Date.now(), data: { total: 7 } }))
    const r = await getCompanyStatsCached<{ total: number }>(db, true, async () => { calls++; return { total: 42 } })
    expect(calls).toBe(1)
    expect(r.stats.total).toBe(42)
    expect(sql.some(s => s.includes('SELECT value')), 'fresh 인데 캐시를 읽었다').toBe(false)
  })
})

describe('🔌 배선 — 순수함수만 만들고 라우트에 안 걸면 아무 일도 안 일어난다', () => {
  it('/stats 가 캐시 헬퍼를 경유한다(직접 companyStats 를 부르면 캐시가 무의미하다)', () => {
    // 인자 이름이 아니라 **계약**을 본다: 헬퍼 경유 + 우회 플래그 전달 + 계산은 클로저로 넘김.
    // ⚠️ 인자 **개수**에 묶지 않는다 — 2026-08-31 에 waitUntil 인자가 하나 붙자 이 검사가 깨졌다
    //   (기능은 멀쩡한데 시험만 빨강 = 낡은 지도). 지키는 것은 "헬퍼 경유 + 계산을 클로저로 넘김" 이다.
    expect(ROUTE).toMatch(/getCompanyStatsCached\(statsDb, fresh\w*, \(\) => companyStats\(statsDb\)/)
    expect(ROUTE, '우회 플래그가 요청에서 와야 한다').toMatch(/c\.req\.query\('fresh'\) === '1'/)
  })

  it('🔒 레인 상태 블롭은 **캐시 밖**에서 매번 읽는다 — 캐시하면 폴러가 완료를 영영 못 본다', () => {
    const i = ROUTE.indexOf("app.get('/stats'")
    const body = ROUTE.slice(i, i + 4000)
    // 완료 감지의 근거가 되는 상태 조회가 라우트 안에 살아 있어야 한다
    expect(body).toMatch(/SELECT value FROM platform_settings WHERE key = 'ads_company_stats'/)
    // 그리고 그것이 캐시 블롭에 섞이면 안 된다(캐시 키는 집계 전용)
    expect(COMPANY_STATS_CACHE_KEY).not.toBe('ads_company_stats')
  })

  it('🔒 쓰기 뒤 무효화가 **미들웨어**로 걸려 있다 — 라우트별이면 새 라우트에서 반드시 빠진다', () => {
    expect(ROUTE).toMatch(/app\.use\('\*', invalidateStatsOnWrite\(/)
    // requireAdmin 뒤여야 한다(앞이면 인증 없이 캐시를 지울 수 있다).
    // ⚠️ `indexOf('invalidateStatsOnWrite')` 로 쓰면 **import 줄**을 집어 늘 실패한다 —
    //   실제로 이 시험을 처음 그렇게 써서 정상 코드에 빨간불이 떴다. `app.use(` 로 앵커한다.
    expect(ROUTE.indexOf("app.use('*', requireAdmin())"))
      .toBeLessThan(ROUTE.indexOf("app.use('*', invalidateStatsOnWrite"))
  })

  it('응답이 기준 시각을 함께 준다 — 없으면 캐시된 값을 최신으로 오해한다', () => {
    expect(ROUTE).toMatch(/stats_at: statsAt/)
  })
})


/**
 * ⏳ **낡아도 먼저 준다** (2026-08-31 — 배포 후 실측이 시킨 후속).
 *
 * TTL 만 두면 만료된 **첫 방문자가 계산을 기다린다** — 라이브 실측 10.4초(캐시 적중은 0.5초).
 * 화면 카드가 10초 비어 있는 건 고친 게 아니다. ⇒ 낡은 값을 즉시 주고 갱신은 응답 뒤에.
 *
 * ## ⚠️ 이 설계가 만들 수 있는 사고는 둘뿐이고, 둘 다 시험한다
 * 1. **영원히 낡음** — 한계 없이 낡은 값을 주면 몇 시간 전 숫자를 최신인 줄 본다.
 * 2. **갱신이 안 걸림** — 낡은 값만 주고 백그라운드 갱신을 안 태우면 캐시가 영영 안 바뀐다.
 */
describe('⏳ stale-while-revalidate — 기다리게 하지 않는다', () => {
  const NOW = 1_800_000_000_000
  const at = (ageMs: number) => parseStatsCache(JSON.stringify({ at: NOW - ageMs, data: { total: 1 } }))

  it('신선하면 애초에 낡은 값 경로가 아니다', () => {
    expect(canServeStale(at(1000), NOW)).toBe(false)
  })

  it('TTL 은 넘겼지만 한계 안이면 먼저 준다', () => {
    expect(canServeStale(at(COMPANY_STATS_TTL_MS + 1000), NOW)).toBe(true)
  })

  it('🔒 한계를 넘으면 **기다리더라도 정확한 값** — 느린 것보다 틀린 게 나쁘다', () => {
    expect(canServeStale(at(COMPANY_STATS_MAX_STALE_MS), NOW)).toBe(false)
    expect(canServeStale(at(COMPANY_STATS_MAX_STALE_MS + 60_000), NOW)).toBe(false)
  })

  it('🔒 한계가 TTL 보다 크고 무한대가 아니다 — 아니면 둘 중 한 사고가 난다', () => {
    expect(COMPANY_STATS_MAX_STALE_MS).toBeGreaterThan(COMPANY_STATS_TTL_MS)
    expect(COMPANY_STATS_MAX_STALE_MS).toBeLessThanOrEqual(2 * 60 * 60_000)
  })

  it('캐시가 아예 없으면 낡은 값이란 게 없다(첫 방문은 기다린다)', () => {
    expect(canServeStale(null, NOW)).toBe(false)
  })

  it('🔒 낡은 값을 주면서 **갱신을 반드시 태운다** — 안 태우면 캐시가 영영 안 바뀐다', async () => {
    let computed = 0
    const bg: Promise<unknown>[] = []
    const { db } = fakeDb(JSON.stringify({ at: Date.now() - (COMPANY_STATS_TTL_MS + 1000), data: { total: 7 } }))
    const r = await getCompanyStatsCached<{ total: number }>(db, false, async () => { computed++; return { total: 99 } }, p => { bg.push(p) })
    expect(r.stats.total, '낡은 값을 즉시 줘야 한다').toBe(7)
    expect(bg.length, '백그라운드 갱신이 안 걸렸다').toBe(1)
    await Promise.all(bg)
    expect(computed, '갱신이 실제로 계산해야 다음 방문자가 새 값을 본다').toBe(1)
  })

  it('🔒 `bg` 가 없으면 동기 계산으로 떨어진다 — 느릴 뿐 틀리지 않는다(cron·테스트 자리)', async () => {
    let computed = 0
    const { db } = fakeDb(JSON.stringify({ at: Date.now() - (COMPANY_STATS_TTL_MS + 1000), data: { total: 7 } }))
    const r = await getCompanyStatsCached<{ total: number }>(db, false, async () => { computed++; return { total: 99 } })
    expect(r.stats.total).toBe(99)
    expect(computed).toBe(1)
  })

  it('🔒 `fresh` 는 낡은 값도 안 쓴다 — 우회로가 낡은 값을 주면 우회가 아니다', async () => {
    const bg: Promise<unknown>[] = []
    const { db } = fakeDb(JSON.stringify({ at: Date.now() - (COMPANY_STATS_TTL_MS + 1000), data: { total: 7 } }))
    const r = await getCompanyStatsCached<{ total: number }>(db, true, async () => ({ total: 42 }), p => { bg.push(p) })
    expect(r.stats.total).toBe(42)
    expect(bg.length, 'fresh 인데 백그라운드로 흘렸다').toBe(0)
  })

  it('🔌 배선 — 라우트가 waitUntil 을 넘긴다(안 넘기면 10초 대기가 그대로다)', () => {
    expect(ROUTE).toMatch(/getCompanyStatsCached\(statsDb, fresh\w*, \(\) => companyStats\(statsDb\), p => c\.executionCtx\?\.waitUntil\(p\)\)/)
  })
})
