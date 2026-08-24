import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

import { backupChunked, handleChunkedBackup } from '../../worker/cron/d1-backup-chunked'

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
function fakeDb(rowsPerTable: Record<string, number>, opts?: { failPageAfter?: number }) {
  let pageReads = 0
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
            pageReads++
            if (opts?.failPageAfter !== undefined && pageReads > opts.failPageAfter) {
              throw new Error('D1_ERROR: simulated read failure')
            }
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

function fakeBucket(opts?: { failOn?: RegExp }) {
  const puts: Array<{ key: string; size: number; body: string }> = []
  return {
    puts,
    put: async (key: string, body: string) => {
      if (opts?.failOn?.test(key)) throw new Error('R2 put failed')
      puts.push({ key, size: body.length, body })
    },
  }
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
      { db: fakeDb({ leads: 60_000 }), label: 'ads', stateDb: fakeStateDb(new Map()), maxReads: 1000 })
    const parts = bucket.puts.filter((p) => p.key.includes('leads.'))
    expect(parts.length, '한 파트로 다 나왔다면 메모리 상한이 안 걸린 것').toBeGreaterThan(1)
    for (const p of parts) expect(p.size).toBeLessThanOrEqual(7 * 1024 * 1024)
  })

  it('파트 파일명이 정렬 가능하다 (복구 때 순서가 곧 정확성이다)', async () => {
    const bucket = fakeBucket()
    await backupChunked({ BACKUP_BUCKET: bucket } as never,
      { db: fakeDb({ leads: 60_000 }), label: 'ads', stateDb: fakeStateDb(new Map()), maxReads: 1000 })
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

  // ─────────────────────────────────────────────────────────────────────────
  // 🩸 2026-08-22 — "성공했다는 빈 백업" 클래스. 아래 넷은 **실제로 났던 버그**를 고정한다.
  //    첫 판은 모든 D1 읽기에 `.catch(() => ({ results: [] }))` 가 달려 있어서, 읽기가 실패하면
  //    "할 게 없다"로 오인하고 manifest 를 쓰고 커서를 지우고 done:true 를 반환했다.
  //    백업에서 이건 없는 것보다 나쁘다 — 있다고 믿게 만든다.
  // ─────────────────────────────────────────────────────────────────────────

  it('🩸 테이블 목록이 비면 "완료"가 아니라 던진다 (빈 백업을 성공으로 기록하지 않는다)', async () => {
    const bucket = fakeBucket()
    await expect(backupChunked({ BACKUP_BUCKET: bucket } as never,
      { db: fakeDb({}), label: 'ads', stateDb: fakeStateDb(new Map()) })).rejects.toThrow()
    expect(bucket.puts.some((p) => p.key.endsWith('manifest.json')),
      '빈 목록으로 manifest 를 썼다 — 복구 때 "온전한 백업"으로 오인된다').toBe(false)
  })

  it('🩸 페이지 읽기가 실패하면 남은 행을 건너뛰지 않는다 (조용한 부분 유실 방지)', async () => {
    const bucket = fakeBucket()
    const store = new Map<string, string>()
    // 첫 페이지는 성공, 두 번째부터 실패 → 이 테이블은 아직 안 끝났다.
    const r = await backupChunked({ BACKUP_BUCKET: bucket } as never,
      { db: fakeDb({ leads: 5_000 }, { failPageAfter: 1 }), label: 'ads', stateDb: fakeStateDb(store) })
    expect(r.done, '실패했는데 완료로 보고했다').toBe(false)
    expect(r.reason).toBe('error')
    expect(r.error, '무엇이 실패했는지 남기지 않으면 다음 세션이 또 판다').toBeTruthy()
    expect(bucket.puts.some((p) => p.key.endsWith('manifest.json')),
      '실패한 회차가 manifest 를 썼다').toBe(false)
    const cur = JSON.parse(store.get('backup_chunk:ads') || '{}')
    expect(cur.ti, '실패했는데 다음 테이블로 넘어갔다 — 남은 행이 통째로 빠진다').toBe(0)
  })

  it('🩸 R2 업로드가 실패하면 커서를 전진시키지 않는다 (다음 회차가 그 파트를 재시도한다)', async () => {
    const bucket = fakeBucket({ failOn: /leads\.0000\.sql$/ })
    const store = new Map<string, string>()
    const r = await backupChunked({ BACKUP_BUCKET: bucket } as never,
      { db: fakeDb({ leads: 1_000 }), label: 'ads', stateDb: fakeStateDb(store) })
    expect(r.reason).toBe('error')
    const cur = JSON.parse(store.get('backup_chunk:ads') || '{}')
    expect(cur.part, '올리지도 못한 파트 번호를 전진시켰다 — 그 파트는 영영 비어 있게 된다').toBe(0)
  })

  it('🔑 읽기 예산을 넘기면 커서를 남기고 멈춘다 (같은 인보케이션의 남의 작업을 굶기지 않는다)', async () => {
    const bucket = fakeBucket()
    const store = new Map<string, string>()
    const r = await backupChunked({ BACKUP_BUCKET: bucket } as never,
      { db: fakeDb({ leads: 200_000 }), label: 'ads', stateDb: fakeStateDb(store), maxReads: 6 })
    expect(r.reason).toBe('reads')
    expect(r.done).toBe(false)
    expect((r.reads ?? 0), '예산을 넘겨 읽었다').toBeLessThanOrEqual(8)
    expect(store.has('backup_chunk:ads'), '멈췄는데 커서를 안 남겼다 — 다음 회차가 처음부터 다시 한다').toBe(true)
  })

  it('🔑 manifest 에 테이블별 파트·행 수가 들어간다 (잘린 백업과 온전한 백업을 구분한다)', async () => {
    const bucket = fakeBucket()
    const r = await backupChunked({ BACKUP_BUCKET: bucket } as never,
      { db: fakeDb({ orders: 3, users: 7 }), label: 'main', stateDb: fakeStateDb(new Map()) })
    expect(r.done).toBe(true)
    const man = bucket.puts.find((p) => p.key.endsWith('manifest.json'))
    expect(man, 'manifest 가 없다').toBeTruthy()
    const j = JSON.parse(man!.body) as { counts: Record<string, [number, number]>; total_rows: number }
    expect(j.counts.orders?.[1], 'orders 행 수가 안 적혔다').toBe(3)
    expect(j.counts.users?.[1], 'users 행 수가 안 적혔다').toBe(7)
    expect(j.total_rows).toBe(10)
  })
})

describe('라벨 회전 — 메인 DB 가 자기 차례를 받는가', () => {
  /**
   * 🩸 2026-08-24 실측: 분할 백업 도입 뒤 **메인 DB 는 한 번도 백업된 적이 없었다.**
   * 진행 중인 커서가 없으면 무조건 목록 첫 번째(ads)부터 시작했는데, ads 는 끝나자마자
   * 그날 것을 또 시작하므로 main 차례가 영영 오지 않았다. 상태 테이블에 `backup_chunk:main`
   * 커서가 아예 없었고, 마지막 메인 백업은 08-02 주간분(3주 전)이었다.
   * 그래서 회전은 커서가 아니라 **완료 마커**로 판단한다.
   */
  /**
   * 메인 DB 는 **상태 저장소이자 백업 대상**이다 — 두 역할을 다 하는 가짜가 필요하다.
   * (커서 read/write 는 상태 쪽, 테이블 목록·페이징은 대상 쪽으로 간다.)
   */
  const fakeMainDb = (store: Map<string, string>) => {
    const st = fakeStateDb(store) as unknown as { prepare: (s: string) => Record<string, unknown> }
    const tgt = fakeDb({ m: 1 }) as unknown as { prepare: (s: string) => Record<string, unknown> }
    return {
      prepare(sql: string) {
        return /platform_settings/.test(sql) ? st.prepare(sql) : tgt.prepare(sql)
      },
    } as unknown as D1Database
  }
  const envOf = (store: Map<string, string>, bucket: unknown) => ({
    DB: fakeMainDb(store), ADS_DB: fakeDb({ a: 1 }), ADS_COMPANY_DB: fakeDb({ c: 1 }),
    BACKUP_BUCKET: bucket,
  }) as never

  it('완료하면 backup_done:{label} 에 날짜를 남긴다', async () => {
    const store = new Map<string, string>()
    const bucket = fakeBucket()
    const r = await backupChunked({ BACKUP_BUCKET: bucket } as never, {
      db: fakeDb({ a: 1 }), label: 'ads', stateDb: fakeStateDb(store),
    })
    expect(r.done).toBe(true)
    expect(store.get('backup_done:ads'), '완료 마커가 없으면 회전이 불가능하다').toBe(r.date)
  })

  it('🔑 ads 가 오늘 끝났으면 다음 시작은 main 이다 (ads 를 또 잡으면 안 된다)', async () => {
    const store = new Map<string, string>()
    const today = new Date().toISOString().slice(0, 10)
    store.set('backup_done:ads', today)
    const r = await handleChunkedBackup(envOf(store, fakeBucket()), {}) as { label?: string }
    expect(r.label, 'ads 를 또 잡았다 — 메인은 영영 백업 안 된다').toBe('main')
  })

  it('전부 오늘 끝났으면 쉬고, 같은 날 다시 뜨지 않는다', async () => {
    const store = new Map<string, string>()
    const today = new Date().toISOString().slice(0, 10)
    for (const l of ['ads', 'main', 'company']) store.set(`backup_done:${l}`, today)
    const r = await handleChunkedBackup(envOf(store, fakeBucket()), {}) as { skipped?: string }
    expect(r.skipped).toBe('all-done-today')
  })

  it('🏢 분리된 업체 DB 도 백업 대상이다 (DB 를 나눴으면 백업도 늘려야 한다)', async () => {
    const store = new Map<string, string>()
    const today = new Date().toISOString().slice(0, 10)
    store.set('backup_done:ads', today)
    store.set('backup_done:main', today)
    const r = await handleChunkedBackup(envOf(store, fakeBucket()), {}) as { label?: string; skipped?: string }
    expect(r.label, '업체 DB 가 대상 목록에 없다 — 그 DB 는 백업 경로가 아예 없어진다').toBe('company')
  })

  it('label 을 주면 그 대상만 민다 (운영자가 "메인 지금 떠라"를 할 수 있어야 한다)', async () => {
    const store = new Map<string, string>()
    store.set('backup_done:main', new Date().toISOString().slice(0, 10))
    // 오늘 끝났다고 표시돼 있어도, 명시 지정이면 그 대상을 민다.
    const r = await handleChunkedBackup(envOf(store, fakeBucket()), { label: 'main' }) as { label?: string; skipped?: string }
    expect(r.label ?? r.skipped).not.toBe('ads')
  })
})
