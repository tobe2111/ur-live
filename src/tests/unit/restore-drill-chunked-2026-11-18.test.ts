/**
 * 🧯 2026-11-18 분할 백업 복구 연습 — 결재 2026-11-18-log-retention-and-ads-backup-drill 3번(대표 "1,2 모두 이상적으로 해줘").
 *
 * **진짜 백업 모듈이 만든 파일**(`backupChunked` → 가짜 R2 에 쌓인 것)을 복구 연습 본체에 그대로 먹인다 —
 * 두 쪽 이름 규칙·형식이 어긋나면 여기서 빨개진다(그 어긋남이 '되살릴 수 없는 백업' 이다).
 *
 * 지키는 것:
 *  1. 완료된 백업은 빈 SQLite 에 되살아나고 표별 행 수가 manifest 와 같다.
 *  2. 조각 하나가 없거나, 표 구조 파일이 없거나, 너무 오래된 백업이면 **실패**로 보고한다.
 *  3. 주간 워크플로가 이 본체를 두 라벨(ads·company)로 부른다.
 *
 * 못 막는 것: 실제 R2 권한(첫 실행이 알려 준다) · 수백 MB 실제 크기에서의 시간.
 */
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { backupChunked } from '@/worker/cron/d1-backup-chunked'
// @ts-expect-error — .mjs 스크립트(타입 없음)
import { runDrill } from '../../../scripts/restore-drill-chunked.mjs'

function fakeSrcDb(rows: Record<string, number>) {
  return {
    prepare(sql: string) {
      const args: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { args.push(...a); return self },
        async all<T>() {
          if (/VIRTUAL TABLE/.test(sql)) return { results: [] as T[] }
          if (/WHERE sql IS NOT NULL AND type IN \('table','index'\)/.test(sql)) {
            return { results: Object.keys(rows).sort().map((n) => ({ type: 'table', name: n, tbl_name: n, sql: `CREATE TABLE "${n}" (id INTEGER PRIMARY KEY, body TEXT)` })) as T[] }
          }
          if (/FROM sqlite_master WHERE type='table' ORDER BY name/.test(sql)) return { results: Object.keys(rows).sort().map((name) => ({ name })) as T[] }
          if (/pragma_table_info/.test(sql)) return { results: [{ name: 'id' }, { name: 'body' }] as T[] }
          const m = /FROM "([^"]+)" WHERE rowid > \? ORDER BY rowid LIMIT (\d+)/.exec(sql)
          if (m) {
            const after = Number(args[0] ?? 0), lim = Number(m[2]), total = rows[m[1]] ?? 0
            const out = []
            for (let r = after + 1; r <= Math.min(total, after + lim); r++) out.push({ __rid: r, id: r, body: `b${r}` })
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
function fakeState() {
  const m = new Map<string, string>()
  return {
    prepare(sql: string) {
      const args: unknown[] = []
      const self = {
        bind: (...a: unknown[]) => { args.push(...a); return self },
        async first<T>() { const k = String(args[0]); return (m.has(k) ? { value: m.get(k) } : null) as T | null },
        async run() { if (/INSERT OR REPLACE/.test(sql)) m.set(String(args[0]), String(args[1])); if (/DELETE/.test(sql)) m.delete(String(args[0])); return { meta: { changes: 1 } } },
        async all<T>() { return { results: [] as T[] } },
      }
      return self
    },
  } as unknown as D1Database
}

async function makeBackup(rows: Record<string, number>) {
  const store = new Map<string, string>()
  const bucket = { async put(key: string, body: string) { store.set(key, body) }, async head() { return null } }
  const r = await backupChunked({ BACKUP_BUCKET: bucket } as never, { db: fakeSrcDb(rows), label: 'ads', stateDb: fakeState() })
  expect(r.done, '백업이 완료되지 않았다 — 시험 전제가 깨졌다').toBe(true)
  return { store, date: r.date }
}
const tmp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'drill-')), 'd.db')

describe('분할 백업 복구 연습', () => {
  it('진짜 백업 모듈이 만든 파일이 빈 DB 에 되살아나고 행 수가 맞는다', async () => {
    const { store, date } = await makeBackup({ ad_influencer_leads: 1200, ad_discovery_keywords: 7 })
    const res = await runDrill({ label: 'ads', doneDate: date, getObject: async (k: string) => store.get(k) ?? null, dbPath: tmp(), now: Date.parse(`${date}T12:00:00Z`) })
    expect(res.problems).toEqual([])
    expect(res.ok).toBe(true)
    expect(res.rows).toBe(1207)
  })

  it('조각 하나가 없으면 실패', async () => {
    const { store, date } = await makeBackup({ t: 1200 })
    const firstPart = [...store.keys()].find((k) => /\/t\.0000\.sql$/.test(k))!
    store.delete(firstPart)
    const res = await runDrill({ label: 'ads', doneDate: date, getObject: async (k: string) => store.get(k) ?? null, dbPath: tmp(), now: Date.parse(`${date}T12:00:00Z`) })
    expect(res.ok).toBe(false)
    expect(res.problems.join(' ')).toMatch(/조각이 없다/)
  })

  it('조각은 다 있는데 안쪽이 잘렸으면(행 수 ≠ 기록) 실패', async () => {
    const { store, date } = await makeBackup({ t: 1200 })
    const part = [...store.keys()].find((k) => /\/t\.0000\.sql$/.test(k))!
    const lines = store.get(part)!.split('\n')
    store.set(part, lines.slice(0, lines.length - 5).join('\n')) // 끝 몇 줄이 잘린 조각
    const res = await runDrill({ label: 'ads', doneDate: date, getObject: async (k: string) => store.get(k) ?? null, dbPath: tmp(), now: Date.parse(`${date}T12:00:00Z`) })
    expect(res.ok).toBe(false)
    expect(res.problems.join(' ')).toMatch(/행 수 \d+ ≠ 백업 기록 \d+/)
  })

  it('표 구조 파일이 없으면 실패(구조 없는 백업은 되살릴 수 없다)', async () => {
    const { store, date } = await makeBackup({ t: 3 })
    for (const k of [...store.keys()]) if (k.endsWith('/schema.sql')) store.delete(k)
    const res = await runDrill({ label: 'ads', doneDate: date, getObject: async (k: string) => store.get(k) ?? null, dbPath: tmp(), now: Date.parse(`${date}T12:00:00Z`) })
    expect(res.ok).toBe(false)
    expect(res.problems.join(' ')).toMatch(/schema\.sql/)
  })

  it('14일보다 오래된 백업이면 실패', async () => {
    const { store, date } = await makeBackup({ t: 3 })
    const res = await runDrill({ label: 'ads', doneDate: date, getObject: async (k: string) => store.get(k) ?? null, dbPath: tmp(), now: Date.parse(`${date}T00:00:00Z`) + 20 * 86400000 })
    expect(res.ok).toBe(false)
    expect(res.problems.join(' ')).toMatch(/한도 14일/)
  })

  it('주간 워크플로가 두 라벨로 부른다', () => {
    const wf = fs.readFileSync('.github/workflows/d1-restore-drill-ads.yml', 'utf8')
    expect(wf).toMatch(/node scripts\/restore-drill-chunked\.mjs ads company/)
    expect(wf).toMatch(/schedule:/)
  })
})
