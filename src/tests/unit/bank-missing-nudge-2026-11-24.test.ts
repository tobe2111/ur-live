/**
 * 🏦 정산 계좌가 없는 매장 알림 (2026-11-24 대표 *"지금 할 수 있는거 진행해줘 알리는 기능"*) — `worker/utils/bank-missing.ts`
 * 실제 함수 + 진짜 SQLite: 누구에게 알리나 · 7일에 한 번 · 계좌가 있으면 안 알린다 · 대표 요약 줄.
 * ⚠️ 못 막는 것: 사장님이 그 알림을 실제로 보는지(벨을 여는지) · 계좌 정보가 맞는지(송금 직전 검증 몫).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { bankMissingDigestLines, bankNudgeMessage, loadBankMissingStores, sendBankMissingNudges, shouldNudge } from '@/worker/utils/bank-missing'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>
function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => { const r = db.prepare(sql).run(...(binds as never[])); return { meta: { changes: Number(r.changes) } } },
    }
    return self
  }
  return { prepare: stmt } as unknown as D1Database
}
function fresh() {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE sellers (id INTEGER PRIMARY KEY, name TEXT, business_name TEXT, status TEXT, seller_type TEXT, bank_name TEXT, bank_account TEXT)')
  db.exec('CREATE TABLE products (id INTEGER PRIMARY KEY, seller_id INTEGER, is_active INTEGER)')
  db.exec('CREATE TABLE payouts (id INTEGER PRIMARY KEY AUTOINCREMENT, payee_type TEXT, payee_id TEXT, amount INTEGER, status TEXT)')
  db.exec("CREATE TABLE dashboard_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_type TEXT, recipient_id TEXT, type TEXT, title TEXT, message TEXT, link TEXT, is_read INTEGER DEFAULT 0, created_at TEXT DEFAULT (datetime('now')))")
  db.exec(`INSERT INTO sellers VALUES
    (14, '홍대', '홍대 돈가스', 'approved', 'store_owner', NULL, NULL),      -- 받을 돈 있음
    (26, '달빛', '달빛한스푼', 'approved', 'store_owner', '', ''),            -- 판매 중
    (18, '빈',   '빈 매장',    'approved', 'store_owner', NULL, NULL),        -- 팔지도 받지도 않음
    (29, '김밥', '김밥집',     'approved', 'store_owner', '국민', '123-45'),  -- 계좌 있음
    (30, '대기', '대기 매장',  'pending',  'store_owner', NULL, NULL),        -- 승인 전
    (31, '반쪽', '반쪽 매장',  'active',   'store_owner', '신한', '')`)       /* 은행만 있고 번호 없음 = 미등록 */
  db.exec("INSERT INTO products VALUES (1, 26, 1), (2, 29, 1), (3, 31, 1), (4, 18, 0)")
  db.exec("INSERT INTO payouts (payee_type, payee_id, amount, status) VALUES ('store_owner', '14', 15200, 'pending'), ('store_owner', '14', 9000, 'sent'), ('seller', '29', 5000, 'pending'), ('seller', '31', 700, 'pending'), ('agency', '14', 99999, 'pending')") // 라이브의 매장 정산 행은 store_owner 다 · 에이전시 14 는 다른 사람이다
  return { db, DB: d1(db) }
}

describe('누가 대상인가', () => {
  it('승인 매장 중 은행·계좌번호가 둘 다 있지 않은 곳만 — 계좌 있는 매장·승인 전 매장은 빠진다', async () => {
    const { DB } = fresh()
    const rows = await loadBankMissingStores(DB)
    expect(rows.map((r) => r.sellerId).sort()).toEqual([14, 18, 26, 31])
    expect(rows.find((r) => r.sellerId === 14)).toMatchObject({ waiting: 15200, name: '홍대 돈가스' }) // 보낸 정산(sent)·에이전시 행은 안 센다
    expect(rows.find((r) => r.sellerId === 31)?.waiting).toBe(700) // 옛 'seller' 표기 행도 센다
  })
  it('팔고 있거나 받을 돈이 있을 때만 알린다', () => {
    expect(shouldNudge({ sellerId: 1, name: 'a', waiting: 1, liveProducts: 0 })).toBe(true)
    expect(shouldNudge({ sellerId: 1, name: 'a', waiting: 0, liveProducts: 1 })).toBe(true)
    expect(shouldNudge({ sellerId: 1, name: 'a', waiting: 0, liveProducts: 0 })).toBe(false)
  })
})

describe('사장님 알림 — 7일에 한 번', () => {
  it('대상 3곳에 1건씩, 같은 날 다시 돌려도 더 안 쌓인다', async () => {
    const { db, DB } = fresh()
    expect(await sendBankMissingNudges(DB)).toEqual({ sent: 3, skipped: 0 })
    expect(await sendBankMissingNudges(DB)).toEqual({ sent: 0, skipped: 3 })
    const n = db.prepare("SELECT recipient_id, type, title, link FROM dashboard_notifications ORDER BY recipient_id").all() as Array<{ recipient_id: string; type: string; title: string; link: string }>
    expect(n.map((x) => x.recipient_id)).toEqual(['14', '26', '31'])
    expect(n[0].title).toContain('15,200원')
    expect(n.every((x) => x.type === 'bank_missing' && x.link === '/seller/settlements')).toBe(true)
  })
  it('7일이 지나면 다시 알린다 · 6일째엔 아직', async () => {
    const { db, DB } = fresh()
    await sendBankMissingNudges(DB)
    db.exec("UPDATE dashboard_notifications SET created_at = datetime('now', '-6 days')")
    expect((await sendBankMissingNudges(DB)).sent).toBe(0)
    db.exec("UPDATE dashboard_notifications SET created_at = datetime('now', '-8 days')")
    expect((await sendBankMissingNudges(DB)).sent).toBe(3)
  })
  it('계좌를 등록하면 그 매장엔 더 안 간다', async () => {
    const { db, DB } = fresh()
    db.exec("UPDATE sellers SET bank_name = '카카오', bank_account = '3333' WHERE id = 14")
    await sendBankMissingNudges(DB)
    expect(db.prepare("SELECT COUNT(*) n FROM dashboard_notifications WHERE recipient_id = '14'").get()).toEqual({ n: 0 })
  })
  it('문구: 받을 돈이 있으면 금액, 없으면 등록 안내', () => {
    expect(bankNudgeMessage({ sellerId: 1, name: 'a', waiting: 15200, liveProducts: 0 }).title).toContain('15,200원')
    expect(bankNudgeMessage({ sellerId: 1, name: 'a', waiting: 0, liveProducts: 2 }).title).toBe('🏦 정산받을 계좌를 등록해 주세요')
  })
})

describe('대표 아침 요약', () => {
  it('매장 수 · 받을 돈 있는 매장 · 합계', async () => {
    const { DB } = fresh()
    const lines = bankMissingDigestLines(await loadBankMissingStores(DB))
    expect(lines[0]).toContain('정산 계좌 없는 매장 4곳')
    expect(lines[0]).toContain('받을 돈 있는 매장 2곳(합계 15,900원)')
    expect(lines[1]).toContain('#14 홍대 돈가스: 15,200원')
  })
  it('없으면 아무 줄도 안 붙는다', () => {
    expect(bankMissingDigestLines([])).toEqual([])
  })
})

describe('배선', () => {
  it('아침 요약과 매일 일정이 부른다', () => {
    expect(readFileSync('src/worker/cron/ops-daily-digest.ts', 'utf8')).toMatch(/bankMissingDigestLines\(await loadBankMissingStores\(DB\)\)/)
    expect(readFileSync('src/worker/scheduled.ts', 'utf8')).toMatch(/slotCron\('40 9 \* \* \*'\)\('bank-missing-nudge'/)
  })
})
