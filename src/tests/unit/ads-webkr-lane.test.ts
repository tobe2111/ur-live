import { describe, it, expect, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { runWebkrCollect, WEBKR_CONCURRENCY } from '@/features/marketing/api/webkr-collect'
import { ALARM_LANES } from '@/worker-ads/lane-alarm-runners'
import { LANE_DOMAIN } from '@/worker-ads/lane-domains'
import { ddlChecksum } from '@/features/marketing/api/ads-schema-guard'
import { COMPANY_DDL } from '@/features/marketing/api/company-discovery'

/**
 * 🏠 **홈페이지 출처 전용 발굴 레인**(`collect-webkr`) — 2026-08-22.
 *
 * ## 무엇을 지키나
 * 대표 질문 *"홈페이지 출처 DB를 최대한 많이 확보할 수도 있어?"* 의 답이 이 레인이다.
 * 라이브 실측이 병목을 특정했다 — **예산이 아니라 벽시계**:
 * ```
 *   ads_company_stats  keywords: 3 · spent: 12/50 · run_ms: 12,571 · deadline_hit: true
 *   출처별 이메일 수율  webkr 29.0%  ≫  commerce 13.2%  ≫  storeinfo 0.2%
 * ```
 * `collect-company` 는 키워드마다 [지역검색 → 카카오 → 웹문서]를 순차로 돌아 12초에 3개밖에 못 넣고,
 * 웹문서는 그 줄의 맨 끝이라 먼저 굶는다. 그래서 웹문서만 도는 별도 인스턴스를 준다.
 *
 * ## 이 테스트가 **못** 막는 것 (과신 금지)
 * - 실제 수집량이 늘어나는지 — 네이버 응답·중복률에 달렸다. 배포 후 `ads_webkr_stats.saved` 로만 안다.
 * - DO 알람이 실제로 이 인스턴스를 깨우는지 — 런타임 동작이라 레포에서 관측 불가(하트비트로 판정).
 * - 이메일이 실제로 붙는지 — 그건 `enrich-company` 크롤 담당(이 레인은 사이트 발굴까지만).
 */
const laneSrc = readFileSync('src/worker-ads/lane-alarm-runners.ts', 'utf8')
const runSrc = readFileSync('src/features/marketing/api/webkr-collect.ts', 'utf8')
/**
 * 🩸 **주석을 뺀 본문**으로만 판정한다. 이 레포가 반복해 당한 함정이다 — 설명 주석에 남은 이름
 * 때문에 조건을 통째로 지워도 초록이 뜬다(`check-lock-table-symbols` 헤더가 경고하는 바로 그것).
 */
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
const runCode = code(runSrc)

function fakeDb(opts: { total: number; fresh: number; rotation: number; prevCursor?: number }) {
  const writes: Array<{ sql: string; args: unknown[] }> = []
  let batches = 0
  const kw = (id: number, tier: number) => ({ id, keyword: `kw${id}`, category: '대행사', subcategory: null, region: '서울', tier })
  const prepare = (sql: string) => {
    const st = {
      args: [] as unknown[],
      bind(...v: unknown[]) { st.args = v; return st },
      async all<T>(): Promise<{ results: T[] }> {
        if (/FROM platform_settings/.test(sql)) {
          return { results: [{ key: 'ads_webkr_stats', value: JSON.stringify({ cursor: opts.prevCursor ?? 0, total_runs: 7, total_saved: 100 }) }] as unknown as T[] }
        }
        if (/FROM ad_company_keywords/.test(sql) && /last_run_at IS NULL/.test(sql)) {
          return { results: Array.from({ length: opts.fresh }, (_, i) => kw(1000 + i, 1)) as unknown as T[] }
        }
        if (/FROM ad_company_keywords/.test(sql)) {
          const limit = Number(st.args[0]) || 0
          const offset = Number(st.args[1]) || 0
          const n = Math.min(limit, opts.rotation)
          return { results: Array.from({ length: n }, (_, i) => kw(1 + offset + i, 2)) as unknown as T[] }
        }
        return { results: [] }
      },
      async first<T>(): Promise<T | null> {
        if (/COUNT\(\*\) AS n FROM ad_company_keywords/.test(sql)) return { n: opts.total } as unknown as T
        if (/COUNT\(\*\) AS n FROM ad_company_leads/.test(sql)) return { n: 0 } as unknown as T
        // 🧾 스키마가 **이미 최신**이라고 답한다. 안 그러면 매 테스트가 DDL 전량을 '돌린' 것으로 쳐서
        //   회차 예산이 스키마 비용으로 거의 다 깎이고, 그러면 이 테스트는 커서가 아니라
        //   **가짜 DB 의 스키마 비용**을 재게 된다(실서비스는 WeakSet + 체크섬으로 1회만 돈다).
        if (/key = \?/.test(sql) && String(st.args[0] || '') === 'ads_ddl_company') {
          return { value: ddlChecksum(COMPANY_DDL) } as unknown as T
        }
        if (/FROM platform_settings/.test(sql)) return { value: '1' } as unknown as T
        return null
      },
      async run() { writes.push({ sql, args: st.args }); return { meta: { changes: 1 } } },
    }
    return st
  }
  return {
    prepare, writes,
    batch: async (stmts: unknown[]) => { batches += 1; return stmts.map(() => ({})) },
    get batches() { return batches },
  }
}

function envOf(extra: Record<string, string> = {}) {
  return {
    DB: null as unknown, NAVER_SEARCH_CLIENT_ID: 'id', NAVER_SEARCH_CLIENT_SECRET: 'sec',
    ADS_COMPANY_COLLECT_ENABLED: 'true', ...extra,
  } as Record<string, unknown>
}

let fetches: string[] = []
beforeEach(() => {
  fetches = []
  vi.stubGlobal('fetch', async (url: string) => {
    fetches.push(String(url))
    const kwName = new URL(String(url)).searchParams.get('query') || 'x'
    return {
      ok: true,
      json: async () => ({ items: [{ title: `${kwName} 마케팅`, link: `https://${kwName}-example.co.kr/`, description: '광고 대행' }] }),
    } as unknown as Response
  })
})

describe('배선', () => {
  it('알람 등록부에 있고 도메인이 company 로 잡힌다 — 없으면 감시·부스트 대상 밖이다', () => {
    expect(ALARM_LANES['collect-webkr']).toBeTruthy()
    expect(LANE_DOMAIN['collect-webkr']).toBe('company')
  })

  it('🩸 홀짝 시각 게이트를 달지 않는다 — 그게 지금 웹문서를 굶기고 있는 원인이다', () => {
    const block = laneSrc.slice(laneSrc.indexOf("'collect-webkr': {"), laneSrc.indexOf("'sweep-kakao-chain': {"))
    expect(block).not.toMatch(/getUTCHours\(\)/)
    expect(block).toMatch(/^\s*runsPerHour: 1,$/m)
  })

  it('🔒 게이트 두 겹 — 업체수집 OFF 거나 이 레인만 끄면 no-op', async () => {
    const block = laneSrc.slice(laneSrc.indexOf("'collect-webkr': {"), laneSrc.indexOf("'sweep-kakao-chain': {"))
    expect(block).toMatch(/if \(env\.ADS_COMPANY_COLLECT_ENABLED !== 'true'\) return \{ skipped: 'gate_off' \}/)
    expect(block).toMatch(/if \(env\.ADS_WEBKR_LANE_DISABLED === 'true'\) return \{ skipped: 'gate_off' \}/)
    const run = ALARM_LANES['collect-webkr']!.run
    expect(await run(envOf({ ADS_COMPANY_COLLECT_ENABLED: 'false' }) as never)).toEqual({ skipped: 'gate_off' })
    expect(await run(envOf({ ADS_WEBKR_LANE_DISABLED: 'true' }) as never)).toEqual({ skipped: 'gate_off' })
  })
})

describe('회차', () => {
  it('키워드를 병렬로 돌린다 — 순차면 12초 마감에 3개밖에 못 넣는다', async () => {
    expect(WEBKR_CONCURRENCY).toBeGreaterThan(1)
    expect(WEBKR_CONCURRENCY).toBeLessThanOrEqual(6) // 폭만 키우면 예산이 먼저 마른다
    // 루프가 폭 단위로 끊어 돈다(무제한 Promise.all 이면 예산이 한 번에 전멸).
    expect(runCode).toMatch(/i \+= WEBKR_CONCURRENCY/)
    expect(runCode).toMatch(/kws\.slice\(i, i \+ WEBKR_CONCURRENCY\)/)
  })

  it('커서는 **실제로 돈 키워드 수**만큼만 전진한다 — 계획분으로 감으면 그 자리는 영영 안 돌아온다', async () => {
    const db = fakeDb({ total: 100, fresh: 4, rotation: 8 })
    const s = await runWebkrCollect(envOf({ DB: db } as never) as never)
    expect(s.keywords.length).toBe(12)
    expect(s.cursor).toBe(12)
    expect(runCode).toMatch(/const nextCursor = total > 0 \? \(cursor \+ used\.length\) % total : 0/)
  })

  it('예산이 마르면 남은 키워드를 안 돈다(폭만큼의 초과는 허용 — 같은 조가 이미 출발했다)', async () => {
    const db = fakeDb({ total: 100, fresh: 4, rotation: 8 })
    const s = await runWebkrCollect(envOf({ DB: db, ADS_WEBKR_SUBREQUEST_BUDGET: '4' } as never) as never)
    expect(fetches.length).toBeLessThanOrEqual(4 + WEBKR_CONCURRENCY)
    expect(s.keywords.length).toBeLessThan(12)
  })

  it('🧾 루프가 자기 기록 쓸 몫을 남긴다 — 다 태우면 "돌았는데 안 돈 것"이 된다', () => {
    // 루프 뒤에 저장·부기·스냅샷·네이버 flush 가 반드시 돈다. 예산을 0까지 태우면 그것들이 못 나가고,
    // 수집은 실제로 했는데 `ads_webkr_stats` 가 안 갱신돼 회차가 통째로 관측 밖이 된다.
    expect(runCode).toMatch(/budget\.left > BOOKKEEPING_RESERVE/)
    expect(runCode).not.toMatch(/budget\.left > 0 &&/)
  })

  it('💾 저장은 회차 끝 1회 + 키워드 부기는 batch 1회 — 건건이 쓰면 예산을 부기에 태운다', async () => {
    const db = fakeDb({ total: 100, fresh: 4, rotation: 8 })
    await runWebkrCollect(envOf({ DB: db } as never) as never)
    expect(db.batches).toBeGreaterThan(0)
    // 키워드 UPDATE 가 개별 run() 으로 나가면 안 된다(batch 로만).
    expect(db.writes.filter(w => /UPDATE ad_company_keywords/.test(w.sql)).length).toBe(0)
    expect(runCode).toMatch(/await DB\.batch\(stmts\)/)
  })

  it('📸 회차 **시작 시점**에 스냅샷을 남긴다 — 중간에 죽어도 그 회차가 보여야 한다', async () => {
    // 라이브에서 실제로 겪은 것: 행은 저장되는데 ads_webkr_stats 도 하트비트도 11시간 동안 0.
    // 끝에서만 쓰면 죽는 회차는 영원히 기록이 없다 → 관측면만 죽고 수집은 돌아 알아채기가 가장 어렵다.
    const db = fakeDb({ total: 100, fresh: 4, rotation: 8 })
    await runWebkrCollect(envOf({ DB: db } as never) as never)
    const stampWrites = db.writes.filter(w => /INSERT OR REPLACE INTO platform_settings/.test(w.sql) && w.args[0] === 'ads_webkr_stats')
    expect(stampWrites.length, '조기 1회 + 최종 1회').toBeGreaterThanOrEqual(2)
    expect(String(stampWrites[0]!.args[1])).toContain('partial')
  })

  it('🧾 D1 도 예산에서 센다 — fetch 만 세면 예약 몫이 헛돈다', () => {
    // BOOKKEEPING_RESERVE 가 8을 남겼다고 믿는 동안 플랫폼 한도(D1 포함 50)는 이미 말라 있었다.
    expect(runCode).toMatch(/const spendD1 = \(n = 1\) => \{ budget\.left -= n \}/)
    expect(runCode).toMatch(/spendD1\(UPFRONT_D1 - 1\)/)          // 루프 전 소급 계상
    expect(runCode).toMatch(/spendD1\(leads\.length \? 3 \+ Math\.ceil/) // 저장 실비
    // 하한이 [예약 + 선불 + 한 조] 를 못 덮으면 콜드 회차에서 한 키워드도 안 돈다.
    expect(runCode).toMatch(/const budgetFloor = BOOKKEEPING_RESERVE \+ UPFRONT_D1 \+ WEBKR_CONCURRENCY \* 2/)
  })

  it('🔑 커서·스냅샷 키가 collect-company 와 분리돼 있다 — 같이 쓰면 서로의 진행분을 건너뛴다', async () => {
    expect(runCode).toMatch(/const STATS_KEY = 'ads_webkr_stats'/)
    expect(runCode).not.toMatch(/ads_company_stats|ads_company_cursor/)
    const db = fakeDb({ total: 100, fresh: 4, rotation: 8, prevCursor: 40 })
    const s = await runWebkrCollect(envOf({ DB: db } as never) as never)
    expect(s.cursor).toBe(52)
    expect(db.writes.some(w => /INSERT OR REPLACE INTO platform_settings/.test(w.sql) && w.args[0] === 'ads_webkr_stats')).toBe(true)
  })

  it('키가 없으면 NOT_CONFIGURED 로 남기고 조용히 끝낸다(레인이 죽지 않는다)', async () => {
    const db = fakeDb({ total: 100, fresh: 4, rotation: 8 })
    const s = await runWebkrCollect({ DB: db, ADS_COMPANY_COLLECT_ENABLED: 'true' } as never)
    expect(s.diag.configured).toBe(false)
    expect(fetches.length).toBe(0)
  })

  it('키워드 창이 비면 커서를 되감지 않는다 — D1 일시 실패로 진행분을 잃으면 안 된다', async () => {
    const db = fakeDb({ total: 100, fresh: 0, rotation: 0, prevCursor: 40 })
    const s = await runWebkrCollect(envOf({ DB: db } as never) as never)
    expect(s.cursor).toBe(40)
    // 빈 창 반환이 0 이 아니라 **읽어 온 커서**를 그대로 돌려줘야 한다.
    const empty = runCode.slice(runCode.indexOf('if (!kws.length)'))
    expect(empty.slice(0, 200)).toMatch(/\.\.\.base, cursor,/)
  })
})
