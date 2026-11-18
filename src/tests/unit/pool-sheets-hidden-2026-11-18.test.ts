/**
 * 🙈 행 숨기기 = '이메일 보냄' (2026-11-18 대표 *"이메일 보냄 버튼 하나하나 누르기가 쉽지 않아서 그냥 보낸 DB 행들은
 *    숨기기로 하려고 하는거야 표시 차원에서"*).
 *
 * 지키는 것
 *   ① 사람이 숨긴 줄(hiddenByUser)의 ID 만 거둔다 — 필터로 가려진 줄·ID 없는 줄은 안 센다
 *   ② 다시 숨기기 요청: 구간 전체를 편 뒤 '보냄' 연속 묶음마다 숨긴다(0-기반 · 끝 미포함)
 *   ③ 거둔 ID 가 진짜 SQLite 에서 '보냄'으로 저장된다(인플루언서 규칙)
 *   ④ 배선: 세 시트 모두 덮어쓰기·DB 읽기 **전에** 거두고, 쓴 **뒤에** DB 상태로 숨긴다
 * ⚠️ 못 보는 것: 구글 시트 API 의 실제 응답 모양(배포 후 숨긴 줄 1개로 `marked` 가 오르는지 라이브 확인).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { hiddenIds, hideRequests, harvestHidden } from '@/features/marketing/api/pool-sheets-hidden'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

const grid = (rows: Array<{ hidden?: boolean; id?: unknown }>) => ({ sheets: [{ data: [{ startRow: 9,
  rowMetadata: rows.map(r => (r.hidden ? { hiddenByUser: true } : {})),
  rowData: rows.map(r => ({ values: [{ effectiveValue: typeof r.id === 'number' ? { numberValue: r.id } : r.id == null ? undefined : { stringValue: String(r.id) } }] })),
}] }] })

describe('① 사람이 숨긴 줄의 ID 만', () => {
  it('숨긴 줄만 · 숫자/글자 ID 둘 다 · ID 없거나 이상하면 버린다', () => {
    expect(hiddenIds(grid([{ id: 1 }, { hidden: true, id: 2 }, { hidden: true, id: '3' }, { hidden: true }, { hidden: true, id: 'ID' }, { id: 6 }]))).toEqual([2, 3])
    expect(hiddenIds(null)).toEqual([])
  })
  it('필터로 가려진 줄(hiddenByFilter)은 보냄이 아니다', () => {
    const j = { sheets: [{ data: [{ rowMetadata: [{ hiddenByFilter: true } as { hiddenByUser?: boolean }], rowData: [{ values: [{ effectiveValue: { numberValue: 9 } }] }] }] }] }
    expect(hiddenIds(j)).toEqual([])
  })
})

describe('② 다시 숨기기 요청', () => {
  it('전체를 편 뒤 연속 묶음마다 숨긴다', () => {
    const reqs = hideRequests(77, 10, [false, true, true, false, true]) as Array<{ updateDimensionProperties: { range: { sheetId: number; startIndex: number; endIndex: number }; properties: { hiddenByUser: boolean } } }>
    const r = reqs.map(x => [x.updateDimensionProperties.range.startIndex, x.updateDimensionProperties.range.endIndex, x.updateDimensionProperties.properties.hiddenByUser])
    expect(r).toEqual([[9, 14, false], [10, 12, true], [13, 14, true]])
    expect(reqs.every(x => x.updateDimensionProperties.range.sheetId === 77)).toBe(true)
    expect(hideRequests(77, 10, [])).toEqual([])
  })
})

describe('③ 거둔 ID 가 보냄으로 저장된다', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('인플루언서: 숨긴 줄 → 이메일로 연락함', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE ad_influencer_leads (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL, email TEXT, status TEXT NOT NULL DEFAULT 'new', contacted_at TEXT, contact_channel TEXT)`)
    for (const id of [1, 2, 3]) db.prepare('INSERT INTO ad_influencer_leads (id, account_id) VALUES (?, 0)').run(id)
    const DB = { prepare: (sql: string) => ({ bind: (...a: unknown[]) => ({ run: async () => { const r = db.prepare(sql).run(...(a as never[])); return { meta: { changes: Number(r.changes) } } } }) }) } as unknown as D1Database
    let asked = ''
    vi.stubGlobal('fetch', vi.fn(async (url: string) => { asked = url; return new Response(JSON.stringify(grid([{ id: 1 }, { hidden: true, id: 2 }, { hidden: true, id: 3 }]))) }))
    expect(await harvestHidden(DB, 'tok', 'S', 'ad_influencer_leads', 'pool', 10, 3, { subreq: 0 })).toBe(2)
    expect(decodeURIComponent(asked)).toContain('pool!A10:A12')
    expect(decodeURIComponent(asked)).toContain('rowMetadata(hiddenByUser)')
    const rows = db.prepare('SELECT id, status, contact_channel FROM ad_influencer_leads ORDER BY id').all()
    expect(rows).toEqual([{ id: 1, status: 'new', contact_channel: null }, { id: 2, status: 'contacted', contact_channel: 'email' }, { id: 3, status: 'contacted', contact_channel: 'email' }])
  })
  it('읽기 실패는 0(이번 회차만 건너뛴다)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })))
    expect(await harvestHidden({} as D1Database, 'tok', 'S', 'ad_influencer_leads', 'pool', 10, 3, { subreq: 0 })).toBe(0)
  })
})

describe('④ 배선 — 거두기는 덮어쓰기·DB 읽기 전, 숨기기는 쓴 뒤', () => {
  const order = (src: string, a: string, b: string, c: string) => {
    const i = src.indexOf(a), j = src.indexOf(b), k = src.indexOf(c)
    expect(i, a).toBeGreaterThan(0); expect(j, b).toBeGreaterThan(0); expect(k, c).toBeGreaterThan(0)
    expect(i).toBeLessThan(j); expect(j).toBeLessThan(k)
  }
  it('파트너/매장 시트', () => {
    const s = readFileSync('src/features/marketing/api/pool-sheets-sync.ts', 'utf8')
    order(s, "const hv = await harvestHiddenTwoWay(DB, token, sheetId, def.table as 'ad_company_leads' | 'store_prospects', TAB, lastCol, off + 2, take, cost)",
      'const res = await DB.prepare(`SELECT ${def.cols} FROM ${def.table}',
      "if (!(await applyHidden(token, sheetId, gid, rowNo, page.map(r => r.email_sent_at != null && r.email_sent_at !== ''), cost))) {")
  })
  it('인플루언서 시트', () => {
    const s = readFileSync('src/features/marketing/api/sheets-sync.ts', 'utf8')
    order(s, "marked += await harvestHidden(DB, token, sheetId, 'ad_influencer_leads', TAB, off + 2, take, cost)",
      'FROM ad_influencer_leads WHERE account_id = 0 ORDER BY id ASC LIMIT ? OFFSET ?',
      "await applyHidden(token, sheetId, gid, off + 2, page.map(l => l.contact_channel === 'email' && !!l.contacted_at), cost)")
  })
  it('안내 탭이 숨기기 = 보냄 을 알린다(버전 2)', async () => {
    const { guideLines, GUIDE_VERSION } = await import('@/features/marketing/api/pool-sheets-guide')
    expect(GUIDE_VERSION).toBeGreaterThanOrEqual(3)
    const t = guideLines('company').join('\n')
    expect(t).toMatch(/\[행 숨기기\]/)
    expect(t).toMatch(/숨긴 줄은 전부 "보냄"으로 저장됩니다/)
  })
})
