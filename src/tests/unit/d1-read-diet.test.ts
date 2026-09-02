/**
 * 📉 유어딜 D1 읽기 다이어트 — 2026-09-02 (9/1 계정 일일 읽기 한도 500만 행 초과 → 소비자 API 전체 500).
 *
 * 정적 감사(`docs/handoff/2026-09-02-d1-read-diet.md` §2-1)가 본진 읽기의 3대 원인으로 지목한
 * 5분 cron 셋(청소 33스캔 · 피드 캐시 20쿼리 · 예열)과 소품 4건의 수리를 고정한다.
 *
 *   ① 청소 티어 — GC 는 하루 1회, 시간 규칙은 매시, 분 단위 규칙만 매 틱. 호출부가 슬롯을 넘긴다
 *   ② 피드 캐시 지문 게이트 — 지문이 같으면 20개 쿼리 대신 computed_at 만 갱신, 다르면 전부 갱신 + 지문 저장
 *   ③ 피드 캐시 OR 분리 — `(status = ? OR ? = 'all')` 가 사라지고 등호/무술어로
 *   ④ 예열 — 동적 워밍 30분·정규화 하루 1회, HOT_PATHS 는 불변
 *   ⑤ 백업 `*​/5` 중복 배선 제거(전용 트리거만)
 *   ⑥ 하트비트 리더 PK 범위(LIKE 전수 스캔 제거) · 알림톡 존재 프로브(COUNT 제거) · 인덱스
 *
 * 못 막는 것: 실제 rows_read(런타임) — 배포 후 `cron_hb` 의 rr 로 판정한다(PR #1299 계량기).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { handleGroupBuyFeedCache, computeFeedFingerprint, FEED_FP_KEY, FEED_FORCE_REFRESH_MS } from '@/worker/cron/group-buy-feed-cache'
import { INDEX_REPAIRS } from '@/worker/routes/repair-schema/index-repairs'

const SCHEDULED = readFileSync('src/worker/scheduled.ts', 'utf8')
const CLEANUP = readFileSync('src/worker/cron/scheduled-cleanup.ts', 'utf8')
const PREWARM = readFileSync('src/worker/cron/cache-prewarm.ts', 'utf8')
const FEED = readFileSync('src/worker/cron/group-buy-feed-cache.ts', 'utf8')
const HB = readFileSync('src/worker/utils/cron-heartbeat.ts', 'utf8')
const ALIMTALK = readFileSync('src/worker/cron/retry-alimtalk.ts', 'utf8')

describe('① 청소 티어', () => {
  it('호출부가 슬롯으로 티어를 넘긴다 — 매시 :10 / 매일 19:20 UTC(04:20 KST)', () => {
    expect(SCHEDULED).toMatch(/handleScheduled\(env, \{ hourly: slotOpen\(\{ minute: 10 \}\), daily: slotOpen\(\{ minute: 20, hour: 19 \}\) \}\)/)
  })
  it('GC 섹션은 daily, 시간 규칙은 hourly, 분 단위(3·6·14)는 게이트 없음', () => {
    const headers = [...CLEANUP.matchAll(/^  \/\/ ── (\S+)/gm)].map((m) => m[1].replace(/\.$/, ''))
    expect(headers.length).toBe(35)
    const guardOf = (tok: string) => {
      const at = CLEANUP.indexOf(`  // ── ${tok}`)
      const before = CLEANUP.slice(Math.max(0, at - 120), at)
      const m = /if \(tiers\.(hourly|daily)\) \{[^\n]*\n$/.exec(before)
      return m ? m[1] : null
    }
    for (const t of ['8.', '9.', '15.', '17.', '18.', '19.', '23.', '🏁']) expect(guardOf(t), t).toBe('daily')
    for (const t of ['2.', '4.', '10.', '12.', '13.', '20.', '22c.', '22d.']) expect(guardOf(t), t).toBe('hourly')
    for (const t of ['3.', '6.', '14.']) expect(guardOf(t), t).toBeNull()
    expect((CLEANUP.match(/if \(tiers\.(hourly|daily)\) \{/g) || []).length).toBe(32)
  })
  it('인자 없이 부르면 전부 돈다(수동 트리거·테스트 하위호환)', () => {
    expect(CLEANUP).toMatch(/export const ALL_TIERS: CleanupTiers = \{ hourly: true, daily: true \}/)
    expect(CLEANUP).toMatch(/handleScheduled\(env: Env, tiers: CleanupTiers = ALL_TIERS\)/)
  })
  it('DISTINCT 가 PK 조회에서 사라졌다', () => {
    expect(CLEANUP).not.toContain('SELECT DISTINCT id FROM users')
  })
})

/** 지문 쿼리·게이트가 실제로 어느 SQL 을 돌리는지 기록하는 가짜 D1. */
function fakeFeedDb(opts: { prevFp?: string | null; prevAt?: string; fpRow?: Record<string, unknown> | null }) {
  const calls: string[] = []
  const mk = (sql: string) => {
    const compact = sql.replace(/\s+/g, ' ').trim()
    const stmt = {
      bind: () => stmt,
      first: async () => {
        calls.push(compact)
        if (compact.includes('sqlite_master')) return { name: 'group_buy_feed_cache' }
        if (compact.startsWith('SELECT COUNT(*) AS n, MAX(id)')) return opts.fpRow === undefined ? { n: 5, mx: 9, u: 'x', act: 3, sold: 1, cur: 2, pr: 10, opr: 20, ln: 99 } : opts.fpRow
        if (compact.includes('FROM platform_settings WHERE key = ?')) return opts.prevFp === undefined ? null : { value: JSON.stringify({ fp: opts.prevFp, at: opts.prevAt ?? new Date().toISOString() }) }
        return null
      },
      all: async () => { calls.push(compact); return { results: [] } },
      run: async () => { calls.push(compact); return { meta: { changes: 20 } } },
    }
    return stmt
  }
  return { db: { prepare: mk } as unknown as never, calls }
}

describe('② 피드 캐시 지문 게이트', () => {
  const FP = '5|9|x|3|1|2|10|20|99'
  it('지문이 같고 60분 안이면 computed_at 만 갱신하고 20개 쿼리를 안 돌린다', async () => {
    const { db, calls } = fakeFeedDb({ prevFp: FP })
    const out = await handleGroupBuyFeedCache({ DB: db } as never)
    expect(out).toMatchObject({ refreshed: 0, unchanged: true, touched: 20 })
    expect(calls.filter((c) => c.startsWith('SELECT p.id')).length).toBe(0)
    expect(calls.some((c) => c.startsWith("UPDATE group_buy_feed_cache SET computed_at = datetime('now')"))).toBe(true)
  })
  it('지문이 다르면 전부 갱신하고 지문을 저장한다', async () => {
    const { db, calls } = fakeFeedDb({ prevFp: 'old' })
    const out = await handleGroupBuyFeedCache({ DB: db } as never)
    expect(out.refreshed).toBe(20)
    expect(calls.filter((c) => c.startsWith('SELECT p.id')).length).toBe(20)
    expect(calls.some((c) => c.startsWith('INSERT OR REPLACE INTO platform_settings') )).toBe(true)
  })
  it('지문이 같아도 마지막 전체 갱신이 60분을 넘었으면 전부 갱신한다(안전망)', async () => {
    const { db } = fakeFeedDb({ prevFp: FP, prevAt: new Date(Date.now() - FEED_FORCE_REFRESH_MS - 1000).toISOString() })
    expect((await handleGroupBuyFeedCache({ DB: db } as never)).refreshed).toBe(20)
  })
  it('지문 쿼리가 실패하면 종전대로 전부 갱신한다(게이트가 기능을 막지 않는다)', async () => {
    const { db, calls } = fakeFeedDb({ prevFp: FP, fpRow: null })
    expect((await handleGroupBuyFeedCache({ DB: db } as never)).refreshed).toBe(20)
    expect(calls.some((c) => c.startsWith('INSERT OR REPLACE INTO platform_settings'))).toBe(false)
    expect(await computeFeedFingerprint({ prepare: () => ({ bind: () => ({ first: async () => { throw new Error('no such column') } }) }) })).toBeNull()
    expect(FEED_FP_KEY).toBe('gb_feed_cache_fp')
  })
  it('③ 상태 OR 가 사라지고 지문 쿼리는 활성 이용권 행만 본다', () => {
    expect(FEED).not.toContain("OR ? = 'all'")
    expect(FEED).toMatch(/\$\{status === 'all' \? '' : 'AND p\.group_buy_status = \?'\}/)
    expect(FEED).toMatch(/FROM products WHERE category IN \(\$\{cats\.map\(\(\) => '\?'\)\.join\(','\)\}\) AND is_active = 1/)
  })
})

describe('④ 예열', () => {
  it('동적 워밍은 :00/:30, 정규화는 19:35 UTC 하루 1회 — HOT_PATHS 는 매 틱 그대로', () => {
    expect(SCHEDULED).toMatch(/handleCachePrewarm\(env, \{ dynamic: slotOpen\(\{ minute: 0 \}\) \|\| slotOpen\(\{ minute: 30 \}\), normalize: slotOpen\(\{ minute: 35, hour: 19 \}\) \}\)/)
    expect(PREWARM).toMatch(/if \(env\.DB && doNormalize\) \{\s*await normalizeSupplyProductData/)
    expect(PREWARM).toMatch(/if \(env\.DB && doDynamic\) \{/)
    // HOT_PATHS 자체호출은 옵션과 무관하다(잠금표)
    expect(PREWARM).toMatch(/HOT_PATHS\.map\(async \(path\) => \{/)
    expect(PREWARM).toMatch(/const doDynamic = opts\.dynamic \?\? true/)
  })
  it('prospects-commission-activate 는 매시 :40 (루프 200쿼리를 5분마다 돌리지 않는다)', () => {
    expect(SCHEDULED).toMatch(/if \(slotOpen\(\{ minute: 40 \}\)\) ctx\.waitUntil\(slotCron\('40 \* \* \* \*'\)\('prospects-commission-activate'/)
  })
})

describe('⑤⑥ 소품', () => {
  it('백업은 전용 트리거 한 곳에서만 배선된다', () => {
    expect((SCHEDULED.match(/\('d1-backup-chunked'/g) || []).length).toBe(1)
  })
  it('하트비트 리더는 LIKE 가 아니라 PK 범위로 읽는다', () => {
    expect(HB).not.toContain("key LIKE 'cron_hb:%'")
    expect(HB).not.toContain("key LIKE 'cron_cpu_death:%'")
    expect(HB).toContain("key >= 'cron_hb:' AND key < 'cron_hb;'")
    // ':' 의 다음 문자가 ';' — 범위가 실제로 접두를 감싼다
    expect(String.fromCharCode(':'.charCodeAt(0) + 1)).toBe(';')
  })
  it('알림톡 재시도는 COUNT 가 아니라 존재 프로브 + 인덱스', () => {
    expect(ALIMTALK).not.toContain('SELECT COUNT(*) as c FROM alimtalk_failures')
    expect(ALIMTALK).toMatch(/SELECT 1 AS c FROM alimtalk_failures[\s\S]*LIMIT 1/)
    expect(INDEX_REPAIRS.some((i) => i.name === 'idx_alimtalk_failures_retry' && /\(resolved, next_retry_at\)/.test(i.sql))).toBe(true)
  })
})
