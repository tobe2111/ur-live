import { describe, it, expect, beforeEach } from 'vitest'
// node:sqlite 는 vite 가 번들 못 하므로 계산된 specifier + @vite-ignore 로 런타임 동적 로드.
const { DatabaseSync } = await import(/* @vite-ignore */ ('node:' + 'sqlite')) as { DatabaseSync: new (p: string) => { prepare: (sql: string) => { run: (...a: never[]) => { changes: number | bigint; lastInsertRowid: number | bigint }; get: (...a: never[]) => unknown; all: (...a: never[]) => unknown[] } } }
import {
  ensureMetricsHistorySchema, getMetricsHistory, computeWoW, snapshotAccountRecent,
  type DailyMetric,
} from '@/features/marketing/api/metrics-history'
import { signAdsToken, ensureAdsAccountSchema } from '@/features/marketing/api/ads-account'
import { marketingRoutes } from '@/features/marketing/api/marketing.routes'

// 서버측 베타 게이트(access_unlocked) 통과용 — unlock·active 계정 시딩.
async function seedUnlocked(DB: D1Database, id: number): Promise<void> {
  await ensureAdsAccountSchema(DB)
  await DB.prepare("INSERT OR IGNORE INTO ad_accounts (id, email, password_hash, company_name, status, access_unlocked) VALUES (?, ?, 'x', 'co', 'active', 1)").bind(id, 'u' + id + '@x.com').run()
}

/**
 * 🆕 2026-06-30 유어애즈 일별 메트릭 히스토리 — 실제 SQLite 통합 테스트.
 *   computeWoW 수식 / getMetricsHistory 정렬(과거→현재) / 라우트 end-to-end / no-creds 가드.
 */

function makeD1(): D1Database {
  const db = new DatabaseSync(':memory:')
  const wrap = (sql: string) => {
    let args: unknown[] = []
    const api = {
      bind: (...a: unknown[]) => { args = a; return api },
      run: async () => { const r = db.prepare(sql).run(...(args as never[])); return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } } },
      first: async () => { const r = db.prepare(sql).get(...(args as never[])); return r === undefined ? null : r },
      all: async () => { const r = db.prepare(sql).all(...(args as never[])); return { results: r } },
    }
    return api
  }
  return { prepare: (sql: string) => wrap(sql) } as unknown as D1Database
}

const JWT = 'test-jwt-secret-0123456789'

/** ad_daily_metrics 직접 시드(과거→현재 N일, cost/conv_amt 지정). */
async function seed(DB: D1Database, accountId: number, days: Array<{ date: string; cost: number; conv: number }>) {
  await ensureMetricsHistorySchema(DB)
  for (const d of days) {
    const roas = d.cost > 0 ? Math.round((d.conv / d.cost) * 100) : null
    await DB.prepare('INSERT INTO ad_daily_metrics (account_id, snap_date, cost, conv_amt, clicks, conv, imp, roas, avg_rnk) VALUES (?,?,?,?,?,?,?,?,?)')
      .bind(accountId, d.date, d.cost, d.conv, 10, 1, 100, roas, 2.5).run()
  }
}

describe('UR Ads 메트릭 히스토리 — 실제 SQLite 통합', () => {
  let DB: D1Database
  beforeEach(() => { DB = makeD1() })

  it('computeWoW: 최근 7일 vs 직전 7일 합계·증감률', () => {
    const series: DailyMetric[] = Array.from({ length: 14 }, (_, i) => ({
      snap_date: `2026-06-${String(i + 1).padStart(2, '0')}`,
      // 직전 7일 각 cost=100(합 700) / 최근 7일 각 cost=150(합 1050)
      cost: i < 7 ? 100 : 150, conv_amt: i < 7 ? 200 : 300, clicks: 1, conv: 1, imp: 1, roas: 200, avg_rnk: 2,
    }))
    const w = computeWoW(series)
    expect(w.recent.cost).toBe(1050)
    expect(w.prev.cost).toBe(700)
    expect(w.costPct).toBe(50)   // (1050-700)/700 = +50%
    expect(w.recent.conv_amt).toBe(2100)
    expect(w.prev.conv_amt).toBe(1400)
    expect(w.recent.roas).toBe(200) // 2100/1050*100
  })

  it('computeWoW: 데이터 7일 이하면 직전 구간 0 → 증감률 null(0 나눗셈 가드)', () => {
    const series: DailyMetric[] = Array.from({ length: 5 }, (_, i) => ({
      snap_date: `2026-06-0${i + 1}`, cost: 100, conv_amt: 50, clicks: 1, conv: 1, imp: 1, roas: 50, avg_rnk: 3,
    }))
    const w = computeWoW(series)
    expect(w.recent.cost).toBe(500)
    expect(w.prev.cost).toBe(0)
    expect(w.costPct).toBeNull()   // 직전 0 → null (Infinity/NaN 방지)
    expect(w.recent.roas).toBe(50)
  })

  it('getMetricsHistory: DESC LIMIT 후 과거→현재 오름차순 반환', async () => {
    // 일부러 뒤섞어 삽입
    await seed(DB, 7, [
      { date: '2026-06-03', cost: 30, conv: 60 },
      { date: '2026-06-01', cost: 10, conv: 20 },
      { date: '2026-06-02', cost: 20, conv: 40 },
    ])
    const series = await getMetricsHistory(DB, 7, 30)
    expect(series.map(s => s.snap_date)).toEqual(['2026-06-01', '2026-06-02', '2026-06-03'])
    expect(series[0].roas).toBe(200) // 20/10*100
  })

  it('getMetricsHistory: 계정 격리(다른 account_id 행 안 섞임)', async () => {
    await seed(DB, 7, [{ date: '2026-06-01', cost: 10, conv: 20 }])
    await seed(DB, 99, [{ date: '2026-06-01', cost: 999, conv: 1 }])
    const a = await getMetricsHistory(DB, 7, 30)
    expect(a).toHaveLength(1)
    expect(a[0].cost).toBe(10)
  })

  it('멀티테넌트: 고객사(tenant)별 격리 — UPSERT 충돌 없음 + tenant 필터', async () => {
    await ensureMetricsHistorySchema(DB)
    // 같은 계정·같은 날짜지만 고객사(tenant) 다름 → 각각 1행(충돌 X)
    const put = (tenant: string, cost: number) => DB.prepare('INSERT INTO ad_daily_metrics (account_id, tenant, snap_date, cost, conv_amt, clicks, conv, imp, roas, avg_rnk) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .bind(7, tenant, '2026-06-01', cost, cost * 2, 1, 1, 1, 200, 2).run()
    await put('C1', 100)
    await put('C2', 500)
    const c1 = await getMetricsHistory(DB, 7, 30, 'C1')
    const c2 = await getMetricsHistory(DB, 7, 30, 'C2')
    expect(c1).toHaveLength(1); expect(c1[0].cost).toBe(100)
    expect(c2).toHaveLength(1); expect(c2[0].cost).toBe(500)
    // tenant 미지정 → 전체(두 고객사 모두)
    expect(await getMetricsHistory(DB, 7, 30)).toHaveLength(2)
  })

  it('라우트 GET /metrics/history — 인증 + series + wow 반환', async () => {
    const env = { DB, JWT_SECRET: JWT } as unknown as Parameters<typeof marketingRoutes.request>[2]
    await seedUnlocked(DB, 55)
    await seed(DB, 55, Array.from({ length: 14 }, (_, i) => ({
      date: `2026-06-${String(i + 1).padStart(2, '0')}`, cost: i < 7 ? 100 : 150, conv: 300,
    })))
    const token = await signAdsToken(55, JWT)
    const res = await marketingRoutes.request('/metrics/history?days=30', { headers: { Authorization: 'Bearer ' + token } }, env)
    expect(res.status).toBe(200)
    const j = await res.json() as { success: boolean; series: DailyMetric[]; wow: { recent: { cost: number }; costPct: number | null } }
    expect(j.success).toBe(true)
    expect(j.series).toHaveLength(14)
    expect(j.series[0].snap_date).toBe('2026-06-01') // 오름차순
    expect(j.wow.recent.cost).toBe(1050)
    expect(j.wow.costPct).toBe(50)
  })

  it('라우트 GET /metrics/history — 미인증 401', async () => {
    const env = { DB, JWT_SECRET: JWT } as unknown as Parameters<typeof marketingRoutes.request>[2]
    const res = await marketingRoutes.request('/metrics/history', {}, env)
    expect(res.status).toBe(401)
  })

  it('snapshotAccountRecent: 연결 없으면 no_creds(라이브 호출 안 함)', async () => {
    const env = { DB, DATA_ENCRYPTION_KEY: 'k'.repeat(32) } as unknown as Parameters<typeof snapshotAccountRecent>[0]
    const r = await snapshotAccountRecent(env, 7)
    expect(r.ok).toBe(false)
    expect(r.reason).toBe('no_creds')
  })

  it('라우트 POST /metrics/snapshot — 연결 전이면 400 NOT_CONNECTED', async () => {
    const env = { DB, JWT_SECRET: JWT, DATA_ENCRYPTION_KEY: 'k'.repeat(32) } as unknown as Parameters<typeof marketingRoutes.request>[2]
    await seedUnlocked(DB, 55)
    const token = await signAdsToken(55, JWT)
    const res = await marketingRoutes.request('/metrics/snapshot', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body: '{}' }, env)
    expect(res.status).toBe(400)
    const j = await res.json() as { code: string }
    expect(j.code).toBe('NOT_CONNECTED')
  })
})
