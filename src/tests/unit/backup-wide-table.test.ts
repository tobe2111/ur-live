import { describe, it, expect } from 'vitest'
import { backupChunked } from '../../worker/cron/d1-backup-chunked'

/**
 * 🩸 2026-08-25: **D1 결과셋 컬럼 한도(100)** 때문에 메인 DB 백업이 `products` 에서 영구히 막혔다.
 *   (`too many columns in result set` — 같은 자리에서 무한 재시도, 전진 0.)
 *   재시도가 실패를 보이게는 해 줬지만 그 백업은 **영원히 못 끝난다** = 백업이 없는 것과 같다.
 *
 *   기존 테스트는 컬럼 2개짜리 가짜만 써서 이 경로를 **한 번도 지나가지 않았다.**
 *   그래서 여기서 넓은 테이블을 만들어 ① 쿼리가 한도를 안 넘고 ② 합쳐진 행이 **온전한지** 본다.
 */
const WIDE = 130   // > 100 (D1 한도) — 실제 products 가 이 근처다

function wideDb(seenSql: string[]) {
  const cols = Array.from({ length: WIDE }, (_, i) => `c${i}`)
  return {
    prepare(sql: string) {
      seenSql.push(sql)
      const args: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { args.push(...a); return self },
        async all<T>() {
          if (/VIRTUAL TABLE/.test(sql)) return { results: [] as T[] }
          if (/FROM sqlite_master WHERE type='table' ORDER BY name/.test(sql)) {
            return { results: [{ name: 'wide' }] as T[] }
          }
          if (/pragma_table_info/.test(sql)) return { results: cols.map((name) => ({ name })) as T[] }
          // 페이지 쿼리 — 어느 컬럼 묶음을 물었든 그 묶음만 돌려준다(실제 D1 처럼).
          const asked = [...sql.matchAll(/"(c\d+)"/g)].map((m) => m[1])
          const isWindow = /rowid >= \? AND rowid <= \?/.test(sql)
          const rowIds = isWindow ? [1, 2] : (Number(args[0]) === 0 ? [1, 2] : [])
          return {
            results: rowIds.map((rid) => {
              const o: Record<string, unknown> = { __rid: rid }
              for (const c of asked) o[c] = `${c}-v${rid}`
              return o
            }) as T[],
          }
        },
        async first<T>() { return null as T | null },
        async run() { return { meta: { changes: 1 } } },
      }
      return self
    },
  } as never
}

describe('넓은 테이블 백업 (D1 컬럼 한도)', () => {
  it('🔑 한 쿼리가 D1 컬럼 한도(100)를 넘지 않는다', async () => {
    const seen: string[] = []
    const puts: Array<{ key: string; body: string }> = []
    await backupChunked({ BACKUP_BUCKET: { put: async (key: string, body: string) => { puts.push({ key, body }) } } } as never, {
      db: wideDb(seen), label: 'x', stateDb: wideDb([]),
    })
    const pageSqls = seen.filter((s) => /FROM "wide"/.test(s))
    expect(pageSqls.length, '페이지 쿼리가 하나도 안 나갔다 — 측정 대상 0건은 통과가 아니다').toBeGreaterThan(0)
    for (const s of pageSqls) {
      const n = [...s.matchAll(/"c\d+"/g)].length + 1   // +1 = rowid
      expect(n, `쿼리 하나가 컬럼 ${n}개 — D1 한도(100) 초과`).toBeLessThanOrEqual(100)
    }
  })

  it('🔑 나눠 읽은 컬럼이 한 행으로 온전히 합쳐진다 (일부만 백업되면 복구가 안 된다)', async () => {
    const puts: Array<{ key: string; body: string }> = []
    await backupChunked({ BACKUP_BUCKET: { put: async (key: string, body: string) => { puts.push({ key, body }) } } } as never, {
      db: wideDb([]), label: 'x', stateDb: wideDb([]),
    })
    const dump = puts.map((p) => p.body).join('\n')
    const insert = dump.split('\n').find((l) => l.startsWith('INSERT OR IGNORE INTO "wide"'))
    expect(insert, 'INSERT 문이 없다').toBeTruthy()
    // 130개 컬럼 값이 전부 들어 있어야 한다 — 마지막 묶음이 빠지면 여기서 걸린다.
    for (const c of ['c0', 'c59', 'c60', 'c119', 'c129']) {
      expect(insert!, `${c} 값이 빠졌다 — 컬럼 묶음 병합 누락`).toContain(`${c}-v1`)
    }
  })
})
