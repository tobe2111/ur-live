/**
 * ↩️ 펴면 '안 보냄' — 업체·매장 시트만 (2026-11-18 대표 *"다시 펴면 보내지 않은걸로 변경되게 하면 안돼?"* → (A) 선택).
 *
 * 지키는 것
 *   ① 우리가 쓴 날짜가 있고 지금 펴진 줄만 되돌린다 — "o" 를 적은 줄 · 날짜 없는 줄 · 숨긴 줄은 아니다
 *   ② 진짜 SQLite: 날짜 지움 · 시트 표시가 올린 '연락함'(연락일 = 표시일)만 '새 리드'로 · 원래 연락함이던 업체는 그대로
 *   ③ 안전장치: 한 구간 50줄 초과면 아무것도 안 함(기록 남김) · 우리 숨기기가 7일 안에 실패했으면 쉼
 *   ④ 인플루언서 시트는 되돌리지 않는다(실제 발송 원장과 같은 칸) · 안내 탭이 시트별로 다르게 알린다
 * ⚠️ 못 보는 것: 구글 시트 응답 모양(라이브에서 줄 하나를 숨겼다 펴서 `unmarked` 로 확인).
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { hiddenAndUnhidden, unmarkSql, harvestHiddenTwoWay, UNHIDE_MAX_PER_RANGE, hideFailKey, unhideSkippedKey } from '@/features/marketing/api/pool-sheets-hidden'
import { markSql } from '@/features/marketing/api/pool-sheets-marks'
import { guideLines } from '@/features/marketing/api/pool-sheets-guide'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const block = (rows: Array<{ hidden?: boolean; id?: number; mark?: string }>) => ({
  ids: { rowMetadata: rows.map(r => (r.hidden ? { hiddenByUser: true } : {})), rowData: rows.map(r => ({ values: [{ effectiveValue: r.id ? { numberValue: r.id } : undefined }] })) },
  marks: { rowData: rows.map(r => ({ values: r.mark ? [{ effectiveValue: { stringValue: r.mark } }] : [] })) },
})

describe('① 되돌릴 줄 고르기', () => {
  it('숨긴 줄 → 보냄 · 폈고 날짜 있는 줄 → 안 보냄 · "o"·빈칸·ID 없음은 무시', () => {
    const b = block([{ id: 1, hidden: true }, { id: 2, mark: '2026-11-18' }, { id: 3, mark: 'o' }, { id: 4 }, { mark: '2026-11-18' }, { id: 6, hidden: true, mark: '2026-11-18' }])
    expect(hiddenAndUnhidden(b.ids, b.marks)).toEqual({ hidden: [1, 6], unhiddenDated: [2] })
  })
})

function db() {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE ad_company_leads (id INTEGER PRIMARY KEY, email TEXT, status TEXT, contacted_at TEXT, email_sent_at TEXT)`)
  d.exec('CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)')
  return d
}
const wrap = (d: InstanceType<typeof DatabaseSync>) => ({
  prepare: (sql: string) => ({ bind: (...a: unknown[]) => ({
    first: async <T,>() => (d.prepare(sql).get(...(a as never[])) ?? null) as T,
    run: async () => { const r = d.prepare(sql).run(...(a as never[])); return { meta: { changes: Number(r.changes) } } },
  }) }),
})

describe('② 진짜 SQLite — 되돌리기', () => {
  it('날짜를 지우고, 시트가 올린 연락함만 새 리드로 되돌린다', () => {
    const d = db()
    d.prepare("INSERT INTO ad_company_leads (id, status) VALUES (1, 'new'), (2, 'interested')").run()
    d.prepare("UPDATE ad_company_leads SET contacted_at = '2026-10-01 00:00:00' WHERE id = 2").run()
    d.prepare(markSql('ad_company_leads', 'id')).run(JSON.stringify([1, 2]))
    d.prepare(unmarkSql('ad_company_leads')).run(JSON.stringify([1, 2]))
    expect(d.prepare('SELECT id, status, contacted_at, email_sent_at FROM ad_company_leads ORDER BY id').all()).toEqual([
      { id: 1, status: 'new', contacted_at: null, email_sent_at: null },
      { id: 2, status: 'interested', contacted_at: '2026-10-01 00:00:00', email_sent_at: null },
    ])
  })
})

describe('③ 안전장치', () => {
  afterEach(() => vi.unstubAllGlobals())
  const grid = (rows: Parameters<typeof block>[0]) => { const b = block(rows); return new Response(JSON.stringify({ sheets: [{ data: [b.ids, b.marks] }] })) }
  it('한 구간에서 50줄 넘게 펴졌으면 아무것도 안 하고 기록을 남긴다', async () => {
    const d = db()
    const rows = Array.from({ length: UNHIDE_MAX_PER_RANGE + 1 }, (_, i) => ({ id: i + 1, mark: '2026-11-18' }))
    for (const r of rows) d.prepare("INSERT INTO ad_company_leads (id, status, email_sent_at) VALUES (?, 'contacted', '2026-11-18 01:00:00')").run(r.id)
    vi.stubGlobal('fetch', vi.fn(async () => grid(rows)))
    const out = await harvestHiddenTwoWay(wrap(d), 't', 'S1', 'ad_company_leads', 'pool', 'S', 2, rows.length, { subreq: 0 }, 1_800_000_000_000)
    expect(out).toEqual({ marked: 0, unmarked: 0, skipped: true })
    expect(d.prepare('SELECT COUNT(*) n FROM ad_company_leads WHERE email_sent_at IS NULL').get()).toEqual({ n: 0 })
    expect(d.prepare('SELECT COUNT(*) n FROM platform_settings WHERE key = ?').get(unhideSkippedKey('S1'))).toEqual({ n: 1 })
  })
  it('우리 숨기기가 7일 안에 실패했으면 되돌리지 않는다 · 지나면 되돌린다', async () => {
    const d = db()
    d.prepare("INSERT INTO ad_company_leads (id, status, email_sent_at) VALUES (1, 'contacted', '2026-11-18 01:00:00')").run()
    const NOW = 1_800_000_000_000
    d.prepare('INSERT INTO platform_settings VALUES (?, ?)').run(hideFailKey('S1'), String(NOW - 86_400_000))
    vi.stubGlobal('fetch', vi.fn(async () => grid([{ id: 1, mark: '2026-11-18' }])))
    expect((await harvestHiddenTwoWay(wrap(d), 't', 'S1', 'ad_company_leads', 'pool', 'S', 2, 1, { subreq: 0 }, NOW)).skipped).toBe(true)
    expect((await harvestHiddenTwoWay(wrap(d), 't', 'S1', 'ad_company_leads', 'pool', 'S', 2, 1, { subreq: 0 }, NOW + 7 * 86_400_000)).unmarked).toBe(1)
  })
})

describe('④ 인플루언서는 되돌리지 않는다', () => {
  it('인플루언서 시트는 한 방향 함수만 · 업체·매장 시트는 두 방향 · 안내가 시트별로 다르다', () => {
    const inf = readFileSync('src/features/marketing/api/sheets-sync.ts', 'utf8')
    expect(inf).not.toMatch(/harvestHiddenTwoWay|unmarkSql/)
    expect(inf).toMatch(/harvestHidden\(DB, token, sheetId, 'ad_influencer_leads'/)
    expect(readFileSync('src/features/marketing/api/pool-sheets-sync.ts', 'utf8')).toMatch(/harvestHiddenTwoWay\(/)
    expect(guideLines('influencer').join('\n')).toMatch(/다시 펴도 기록은 지워지지 않고/)
    expect(guideLines('company').join('\n')).toMatch(/다시 펴세요 — 다음 갱신 때 "안 보냄"으로 되돌아갑니다/)
  })
})
