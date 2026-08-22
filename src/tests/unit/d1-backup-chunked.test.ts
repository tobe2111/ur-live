import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import { backupChunked } from '../../worker/cron/d1-backup-chunked'

/**
 * 🗄️ 분할 백업 — **"한 회차에 다 못 한다"를 전제로 만든 것**이 지켜지는지 본다.
 *
 * 기존 백업은 DB 를 문자열 하나로 만들다 워커 메모리를 넘겨 **08-02 이후 조용히 멈췄다**
 * (예외가 아니라 워커 사망이라 실패 기록도 하트비트도 안 남았다). 그래서 이 모듈의 계약은
 * "완료"가 아니라 **"이어서 할 수 있다"** 다.
 *
 * ⚠️ 이 테스트가 못 잡는 것: 실제 R2 업로드·D1 페이징 성능. 그건 라이브에서만 판정된다.
 */

/** 최소 가짜 D1 — 테이블 목록과 rowid 페이징만 흉내 낸다. */
function fakeDb(rowsPerTable: Record<string, number>) {
  return {
    prepare(sql: string) {
      const bindArgs: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { bindArgs.push(...a); return self },
        async all<T>() {
          if (/VIRTUAL TABLE/.test(sql)) return { results: [] as T[] }
          if (/FROM sqlite_master WHERE type='table' ORDER BY name/.test(sql)) {
            return { results: Object.keys(rowsPerTable).sort().map((name) => ({ name })) as T[] }
          }
          const pt = /pragma_table_info\('([^']+)'\)/.exec(sql)
          if (pt) return { results: [{ name: 'id' }, { name: 'body' }] as T[] }
          const m = /FROM "([^"]+)" WHERE rowid > \? ORDER BY rowid LIMIT (\d+)/.exec(sql)
          if (m) {
            const total = rowsPerTable[m[1]] ?? 0
            const after = Number(bindArgs[0] ?? 0)
            const lim = Number(m[2])
            const out: unknown[] = []
            for (let r = after + 1; r <= Math.min(total, after + lim); r++) {
              out.push({ __rid: r, id: r, body: 'x'.repeat(200) })
            }
            return { results: out as T[] }
          }
          return { results: [] as T[] }
        },
        async first<T>() { return null as T | null },
        async run() { return { meta: { changes: 1 } } },
      }
      return self
    },
  } as unknown as D1Database
}

/** 커서를 실제로 저장/복원하는 가짜 상태 DB. */
function fakeStateDb(store: Map<string, string>) {
  return {
    prepare(sql: string) {
      const args: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { args.push(...a); return self },
        async first<T>() {
          const v = store.get(String(args[0]))
          return (v ? { value: v } : null) as T | null
        },
        async run() {
          if (/DELETE FROM platform_settings/.test(sql)) store.delete(String(args[0]))
          else store.set(String(args[0]), String(args[1]))
          return { meta: { changes: 1 } }
        },
        async all<T>() { return { results: [] as T[] } },
      }
      return self
    },
  } as unknown as D1Database
}

function fakeBucket() {
  const puts: Array<{ key: string; size: number }> = []
  return { puts, put: async (key: string, body: string) => { puts.push({ key, size: body.length }) } }
}

describe('분할 백업', () => {
  it('바인딩이 없으면 조용히 no-op 한다 (백업 실패가 cron 을 죽이면 안 된다)', async () => {
    const r = await backupChunked({} as never, { db: fakeDb({ a: 1 }), label: 'x', stateDb: fakeStateDb(new Map()) })
    expect(r.reason).toBe('no-binding')
    expect(r.done).toBe(false)
  })

  it('작은 DB 는 한 회차에 끝나고 manifest 를 쓴다', async () => {
    const bucket = fakeBucket()
    // 🩸 **여기에 커서를 미리 심는다.** 처음엔 빈 store 로 "끝나면 커서가 없다"를 검사했는데,
    //   애초에 커서가 쓰인 적이 없어 **항상 0** 이었다 — 커서 삭제를 통째로 없애도 초록이었다.
    //   "없어야 한다"를 검사하려면 **있는 상태에서 시작**해야 한다.
    const store = new Map<string, string>([
      ['backup_chunk:main', JSON.stringify({ date: '2026-01-01', ti: 0, rowid: 0, part: 0 })],
    ])
    const r = await backupChunked({ BACKUP_BUCKET: bucket } as never,
      { db: fakeDb({ orders: 3, users: 2 }), label: 'main', stateDb: fakeStateDb(store) })
    expect(r.done).toBe(true)
    expect(r.reason).toBe('complete')
    expect(bucket.puts.some((p) => p.key.endsWith('manifest.json'))).toBe(true)
    expect(bucket.puts.filter((p) => p.key.endsWith('.sql')).length).toBeGreaterThanOrEqual(2)
    // 끝났으면 커서를 지운다 — 안 지우면 다음 스냅샷이 **옛 날짜로 영원히** 이어진다.
    expect(store.has('backup_chunk:main'), '완료 후에도 커서가 남았다').toBe(false)
  })

  it('🔑 커서에서 이어서 한다 (중간에 끊긴 스냅샷을 처음부터 다시 하지 않는다)', async () => {
    const bucket = fakeBucket()
    // 두 번째 테이블(users)부터 시작하도록 커서를 심는다 — orders 는 건너뛰어야 한다.
    const store = new Map<string, string>([
      ['backup_chunk:ads', JSON.stringify({ date: '2026-02-02', ti: 1, rowid: 0, part: 0 })],
    ])
    const r = await backupChunked({ BACKUP_BUCKET: bucket } as never,
      { db: fakeDb({ orders: 5, users: 4 }), label: 'ads', stateDb: fakeStateDb(store) })
    expect(r.done).toBe(true)
    const keys = bucket.puts.map((p) => p.key)
    expect(keys.some((k) => k.includes('/users.')), 'users 를 안 썼다').toBe(true)
    expect(keys.some((k) => k.includes('/orders.')), 'orders 를 다시 썼다 — 커서를 무시한 것').toBe(false)
    expect(keys.every((k) => k.includes('2026-02-02')), '날짜도 커서에서 이어야 한다').toBe(true)
  })

  it('🔑 큰 테이블은 파트로 쪼개진다 (한 파일에 다 담지 않는다)', async () => {
    const bucket = fakeBucket()
    // 행당 약 200자 → 6 MB 파트면 대략 3만 행에서 갈린다. 넉넉히 넘겨 본다.
    await backupChunked({ BACKUP_BUCKET: bucket } as never,
      { db: fakeDb({ leads: 60_000 }), label: 'ads', stateDb: fakeStateDb(new Map()) })
    const parts = bucket.puts.filter((p) => p.key.includes('leads.'))
    expect(parts.length, '한 파트로 다 나왔다면 메모리 상한이 안 걸린 것').toBeGreaterThan(1)
    for (const p of parts) expect(p.size).toBeLessThanOrEqual(7 * 1024 * 1024)
  })

  it('파트 파일명이 정렬 가능하다 (복구 때 순서가 곧 정확성이다)', async () => {
    const bucket = fakeBucket()
    await backupChunked({ BACKUP_BUCKET: bucket } as never,
      { db: fakeDb({ leads: 60_000 }), label: 'ads', stateDb: fakeStateDb(new Map()) })
    const keys = bucket.puts.filter((p) => p.key.endsWith('.sql')).map((p) => p.key)
    expect([...keys].sort()).toEqual(keys)          // 생성 순서 == 사전순
    expect(keys[0]).toMatch(/leads\.0000\.sql$/)     // 0 패딩이 없으면 10번이 2번 앞에 온다
  })

  it('FTS 그림자 테이블은 건너뛴다 (BLOB 이라 실어 나르면 조용히 깨진다)', async () => {
    const bucket = fakeBucket()
    const db = fakeDb({ products: 2, products_fts_data: 5 })
    // 가짜 DB 는 virtual 목록이 비어 있어 스킵이 안 걸린다 — 규칙 자체는 소스로 고정한다.
    await backupChunked({ BACKUP_BUCKET: bucket } as never, { db, label: 'main', stateDb: fakeStateDb(new Map()) })
    const src = readFileSync('src/worker/cron/d1-backup-chunked.ts', 'utf8')
    expect(src).toMatch(/data\|idx\|docsize\|config\|content/)
    expect(src).toMatch(/_cf_KV/)
  })

  it('BLOB 을 문자열로 뭉개지 않는다 (조용한 데이터 손상 방지)', () => {
    const src = readFileSync('src/worker/cron/d1-backup-chunked.ts', 'utf8')
    expect(src).toMatch(/X'\$\{hex\}'/)
    expect(src).toMatch(/ArrayBuffer\.isView/)
  })
})
