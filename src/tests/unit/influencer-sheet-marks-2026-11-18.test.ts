/**
 * ✉️ 인플루언서 시트 '이메일 보냄' 표시 (2026-11-18 대표 *"인플루언서 시트에도 이메일 보냄 표시 넣어줘"*).
 *
 * 지키는 것
 *   ① 시트 마지막 열이 '이메일 보냄' 이고, 이메일로 연락한 날만 그린다(DM·전화로 연락한 날은 안 그린다)
 *   ② 표시 저장은 **기존 '보냄' 기록 칸**(contacted_at · contact_channel='email')에 한다 — 새 칸을 만들지 않는다.
 *      처음 보낸 날 보존 · 새 리드는 '연락함' · 이미 이메일로 기록된 행은 그대로(멱등) · 공용 풀 밖은 안 건드린다
 *   ③ 붙여넣은 이메일 매칭은 대소문자 무관이고 `(account_id, LOWER(email))` 인덱스를 탄다(진짜 SQLite 플랜)
 *   ④ 배선: 덮어쓰기·DB 읽기 **전에** 표시를 저장 · 발송기록 탭 반영 · 꼬리 지우기가 새 끝 열까지 · 열 수가 바뀌면 새 사이클
 * 🔎 옛 꼬리 지우기는 `A:AE` 였는데 그땐 열이 30개(AD)라 한 칸 넓었다 — 이제 끝 열을 헤더에서 계산한다.
 * ⚠️ 못 보는 것: 구글 시트 API 의 실제 응답(라이브에서 표시 1건으로 확인 — `ads_sheets_last_sync.marked`).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import { SHEET_HEADER, MARK_LETTER, leadToRow, parseCursorCols, type SheetLead } from '@/features/marketing/api/sheets-sync'
import { influencerMarkSql, markSql } from '@/features/marketing/api/pool-sheets-marks'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
const SRC = readFileSync('src/features/marketing/api/sheets-sync.ts', 'utf8')
const lead = (o: Partial<SheetLead> = {}): SheetLead => ({
  id: 1, platform: 'youtube', name: 'n', handle: null, url: 'u', subscriber_count: 0, recent_avg_views: null, recent_avg_comments: null,
  recent_posts_30d: null, email: 'a@b.c', instagram: null, tiktok: null, links: null, category: null, source_keyword: null, status: 'new',
  contact_channel: null, contacted_at: null, follow_up_at: null, source: null, consented_at: null, memo: null, collected_at: '2026-11-01 00:00:00', ...o,
})

describe('① 시트 열', () => {
  it("마지막 열이 '이메일 보냄' 이고 열 글자가 AE 다(30 → 31열)", () => {
    expect(SHEET_HEADER[SHEET_HEADER.length - 1]).toBe('이메일 보냄')
    expect(SHEET_HEADER.length).toBe(31)
    expect(MARK_LETTER).toBe('AE')
    expect(leadToRow(lead()).length).toBe(SHEET_HEADER.length)
  })
  it('이메일로 연락한 날만 한국 날짜로 그린다', () => {
    const at = (o: Partial<SheetLead>) => leadToRow(lead(o))[SHEET_HEADER.length - 1]
    expect(at({ contact_channel: 'email', contacted_at: '2026-11-18 16:30:00' })).toBe('2026-11-19') // UTC 16:30 = KST 다음날 01:30
    expect(at({ contact_channel: 'dm', contacted_at: '2026-11-18 01:00:00' })).toBe('')
    expect(at({ contact_channel: null, contacted_at: null })).toBe('')
  })
})

describe('② 표시 저장 — 기존 보냄 기록 칸에', () => {
  const setup = () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE ad_influencer_leads (id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL, email TEXT, status TEXT NOT NULL DEFAULT 'new',
      contacted_at TEXT, contact_channel TEXT)`)
    db.exec('CREATE INDEX idx_ad_inf_leads_email_ci ON ad_influencer_leads(account_id, LOWER(email))')
    const ins = db.prepare('INSERT INTO ad_influencer_leads (id, account_id, email, status, contacted_at, contact_channel) VALUES (?, ?, ?, ?, ?, ?)')
    ins.run(1, 0, 'Kim@Gmail.com', 'new', null, null)                       // 새 리드
    ins.run(2, 0, 'lee@naver.com', 'interested', '2026-10-01 00:00:00', 'dm') // DM 으로 연락했던 사람
    ins.run(3, 0, 'park@daum.net', 'contacted', '2026-09-01 00:00:00', 'email') // 이미 이메일 기록
    ins.run(4, 7, 'kim@gmail.com', 'new', null, null)                       // 공용 풀 밖
    return db
  }
  const row = (db: InstanceType<typeof DatabaseSync>, id: number) => db.prepare('SELECT status, contacted_at, contact_channel FROM ad_influencer_leads WHERE id = ?').get(id) as Record<string, string | null>

  it('id 로 표시: 새 리드는 연락함 · DM 이었던 사람은 이메일로 · 첫 연락일 보존 · 이미 이메일이면 그대로 · 풀 밖은 안 건드림', () => {
    const db = setup()
    const r = db.prepare(influencerMarkSql('id')).run(JSON.stringify([1, 2, 3, 4]))
    expect(Number(r.changes)).toBe(2)
    expect(row(db, 1).status).toBe('contacted')
    expect(row(db, 1).contact_channel).toBe('email')
    expect(row(db, 1).contacted_at).toBeTruthy()
    expect(row(db, 2)).toEqual({ status: 'interested', contacted_at: '2026-10-01 00:00:00', contact_channel: 'email' })
    expect(row(db, 3)).toEqual({ status: 'contacted', contacted_at: '2026-09-01 00:00:00', contact_channel: 'email' })
    expect(row(db, 4).contact_channel).toBeNull()
    expect(Number(db.prepare(influencerMarkSql('id')).run(JSON.stringify([1, 2, 3])).changes)).toBe(0) // 두 번 해도 그대로
  })
  it('붙여넣은 이메일은 대소문자 무관으로 맞추고 인덱스를 탄다', () => {
    const db = setup()
    expect(Number(db.prepare(influencerMarkSql('email')).run(JSON.stringify(['kim@gmail.com'])).changes)).toBe(1)
    expect(row(db, 1).contact_channel).toBe('email')
    expect(row(db, 4).contact_channel).toBeNull()
    const plan = (db.prepare(`EXPLAIN QUERY PLAN ${influencerMarkSql('email')}`).all('[]') as Array<{ detail: string }>).map(x => x.detail).join(' | ')
    expect(plan).toMatch(/idx_ad_inf_leads_email_ci/)
  })
  it('공용 표시 함수가 인플루언서 표를 받으면 이 규칙으로 간다(업체용 email_sent_at 칸으로 가지 않는다)', () => {
    expect(markSql('ad_influencer_leads', 'id')).toBe(influencerMarkSql('id'))
    expect(markSql('ad_influencer_leads', 'email')).not.toMatch(/email_sent_at/)
  })
})

describe('④ 배선', () => {
  it('구간마다 덮어쓰기·DB 읽기 전에 표시를 저장한다', () => {
    const h = SRC.indexOf("harvestMarks(DB, token, sheetId, 'ad_influencer_leads', TAB, MARK_LETTER, off + 2, take, cost)")
    const read = SRC.indexOf('FROM ad_influencer_leads WHERE account_id = 0 ORDER BY id ASC LIMIT ? OFFSET ?')
    const write = SRC.indexOf("const w = await sheetsFetch(token, sheetId, `/values/${encodeURIComponent(range)}?valueInputOption=RAW`")
    expect(h).toBeGreaterThan(0)
    expect(h).toBeLessThan(read)
    expect(read).toBeLessThan(write)
  })
  it('발송기록 탭을 만들고 반영한다 · 꼬리 지우기가 새 끝 열까지 간다', () => {
    expect(SRC).toMatch(/await ensureListTab\(token, sheetId, titles, cost\)/)
    expect(SRC).toMatch(/applyEmailList\(DB, token, sheetId, 'ad_influencer_leads', cost\)/)
    expect(SRC).toMatch(/\$\{TAB\}!A\$\{off \+ 2\}:\$\{MARK_LETTER\}/)
  })
  it('열 수가 바뀌면 사이클을 처음부터 한다(그리드 밖 쓰기 → 커서 고착 방지)', () => {
    expect(SRC).toMatch(/cur0\.off > 0 && parseCursorCols\(cRaw\?\.value\) !== SHEET_HEADER\.length \? \{ off: 0, total: 0 \} : cur0/)
    expect(SRC).toMatch(/JSON\.stringify\(\{ off, total, cols: SHEET_HEADER\.length,/)
    expect(parseCursorCols('{"off":12000,"total":587569}')).toBe(0)
    expect(parseCursorCols('{"off":1,"total":2,"cols":31}')).toBe(31)
    expect(parseCursorCols('garbage')).toBe(0)
  })
})
