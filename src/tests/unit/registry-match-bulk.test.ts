/**
 * 🔗 원부 이메일 이식 — **쿼리 수가 대상 수에 비례하면 안 된다** (2026-07-28 실사고).
 *
 *   라이브가 몇 달간 `scanned:400 · matched:0 · no_registry_row:395` 를 냈다. "원부에 그 회사가 없다"로
 *   읽히지만 사실은 **조회를 못 한 것**이었다 — 대상 1건마다 SELECT 를 1~2회 날려 한 패스가 최대 800 쿼리였고,
 *   D1 쿼리도 서브리퀘스트라 40여 번째부터 전부 throw 했으며, 그 throw 를 `.catch(() => null)` 가 삼켜
 *   빈 후보 → `no_registry_row` 로 **오분류**됐다. 통계가 원인을 가리키지 못하니 몇 달이 갔다.
 *
 *   ⇒ 여기서 못박는 것: 원부 조회는 **묶음(IN)** 이어야 하고, 그 개수는 대상 수가 아니라 `ceil(고유상호/90)`
 *   에 비례해야 한다. 90 인 이유는 D1 의 문장당 바인딩 100개 제한.
 */
import { describe, it, expect } from 'vitest'
import { matchRegistryEmails, normalizeCompanyName } from '@/features/marketing/api/registry-email-match'
import type { Env } from '@/worker/types/env'

type Row = Record<string, unknown>

/** D1 최소 스텁 — SQL 모양으로 응답을 고르고, 원부 조회 횟수/최대 바인딩 수를 기록한다. */
function fakeEnv(targets: Row[], registry: Row[]) {
  const counters = { registryQueries: 0, maxBinds: 0, batches: 0, updateSql: [] as string[] }
  const DB = {
    prepare(sql: string) {
      const st = { sql, binds: [] as unknown[] }
      const api = {
        sql,
        bind(...b: unknown[]) { st.binds = b; counters.maxBinds = Math.max(counters.maxBinds, b.length); return api },
        async run() { return { meta: { changes: 1 } } },
        async first() { return null }, // stats/cursor 없음 → 첫 실행
        async all() {
          if (/name_norm IS NULL/.test(sql)) return { results: [] }        // 백필 완료 상태
          // 묶음 조회 식별은 `name_norm IN (` 하나로 — 다른 조건(merged_into 등)이 붙어도 안 깨지게.
          if (/name_norm IN \(/.test(sql)) {
            counters.registryQueries++
            const want = new Set(st.binds as string[])
            return { results: registry.filter(r => want.has(String(r.name_norm))) }
          }
          if (/COALESCE\(source,''\) != 'commerce'/.test(sql)) return { results: targets }
          return { results: [] }
        },
      }
      return api as unknown as ReturnType<D1Database['prepare']>
    },
    async batch(stmts: unknown[]) {
      counters.batches++
      for (const st of stmts as Array<{ sql?: string }>) if (st?.sql) counters.updateSql.push(st.sql)
      return stmts.map(() => ({ meta: { changes: 1 } }))
    },
  }
  return { env: { DB } as unknown as Env, counters }
}

const target = (id: number, name: string, address: string | null = null): Row =>
  ({ id, company_name: name, address, region: null, website: null })
const reg = (name: string, email: string, address: string | null = null): Row =>
  ({ company_name: name, address, email, website: null, name_norm: normalizeCompanyName(name) })

describe('matchRegistryEmails — 묶음 조회 불변식', () => {
  it('🔒 대상 200건이어도 원부 조회는 몇 번뿐 (건당 쿼리 회귀 차단)', async () => {
    const targets = Array.from({ length: 200 }, (_, i) => target(i + 1, `가나다라업체${i}`))
    const { env, counters } = fakeEnv(targets, [])
    await matchRegistryEmails(env, 400)
    // 고유 상호 200개 → 90개씩 3묶음. 건당 조회였다면 200(혹은 400)회였을 것.
    expect(counters.registryQueries).toBe(3)
    expect(counters.registryQueries).toBeLessThan(10)
  })

  it('🔒 한 문장의 바인딩이 100개를 넘지 않는다 (D1 한도)', async () => {
    const targets = Array.from({ length: 250 }, (_, i) => target(i + 1, `마바사아업체${i}`))
    const { env, counters } = fakeEnv(targets, [])
    await matchRegistryEmails(env, 400)
    expect(counters.maxBinds).toBeLessThanOrEqual(100)
  })

  it('원부에 있으면 실제로 이식 대상이 된다(묶음 조회로도 매칭이 성립)', async () => {
    const { env } = fakeEnv(
      [target(1, '한울커넥티드'), target(2, '어디에도없는업체')],
      [reg('주식회사 한울커넥티드', 'hanul@example.com')],
    )
    const r = await matchRegistryEmails(env, 400)
    expect(r.matched).toBe(1)
    expect(r.skip_reason.no_registry_row).toBe(1)
  })

  it('🔒 동명 원부가 둘이면 이식하지 않는다(오귀속 방지)', async () => {
    const { env } = fakeEnv(
      [target(1, '가나기획사')],
      [reg('가나기획사', 'a@x.com'), reg('(주)가나기획사', 'b@y.com')],
    )
    const r = await matchRegistryEmails(env, 400)
    expect(r.matched).toBe(0)
    expect(r.skip_reason.ambiguous).toBe(1)
  })

  it('🔒 UPDATE 는 "줄 값이 있고 그 칸이 빈" 행만 건드린다 — 카운터 부풀리기 방지', async () => {
    // 실사고: 예전 WHERE 가 "이메일 또는 홈페이지가 비었으면" 이라 원부에 줄 값이 없어도 changes=1 이
    //   찍혔다. 커서 재순회 중 total_matched 26 → 63 인데 with_email 은 한 자리도 안 움직였다(라이브 대조).
    const { env, counters } = fakeEnv([target(1, '한울커넥티드')], [reg('한울커넥티드', 'h@x.com')])
    await matchRegistryEmails(env, 400)
    const sql = counters.updateSql.join(' ')
    expect(sql).toMatch(/\? IS NOT NULL AND \(email IS NULL/)     // 이메일은 줄 값이 있을 때만
    expect(sql).toMatch(/\? IS NOT NULL AND \(website IS NULL/)   // 홈페이지도 마찬가지
  })

  it('🔒 예산을 다 쓰면 조용히 0건이 아니라 사유를 남긴다', async () => {
    const targets = Array.from({ length: 200 }, (_, i) => target(i + 1, `자차카타업체${i}`))
    const { env, counters } = fakeEnv(targets, [])
    const r = await matchRegistryEmails(env, 400, { left: 4 }) // stats/cursor/targets 로 거의 소진
    expect(counters.registryQueries).toBeLessThan(3) // 3묶음을 다 돌지 않고 예산에서 멈춘다
    expect(r.skip_reason.budget_exhausted).toBeGreaterThan(0) // '원부에 없음' 으로 위장하지 않는다
    expect(r.budget_exhausted).toBe(true)
  })
})
