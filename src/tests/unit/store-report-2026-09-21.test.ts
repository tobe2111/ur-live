/**
 * 🚨 매장 제보(신고) — 사장님이 "내 가게인데 내가 안 올렸다" 를 알릴 수 있는 유일한 창구.
 *
 * ## 이 시험이 **재는 것**
 * `submitStoreReport` / `decideStoreReport` 의 실제 동작을 **진짜 SQLite(node:sqlite)** 에 넣고 잰다
 * — 문자열 검사가 아니라 행을 세고 상태를 읽는다.
 *
 * ## 이 시험이 **못 재는 것**(가드를 과신하지 말 것)
 *  - 시트가 실제로 열리고 토스트가 뜨는지(브라우저 일).
 *  - 어드민이 제보를 보고 **옳게 판단하는지** — 그건 사람의 일이고 기계가 못 잰다.
 *  - 제보가 실제 사기를 막는지. 이건 **판매 중지도 환불도 하지 않는다**(설계상 의도).
 *    그 두 가지는 어드민이 기존 경로로 한다 ⇒ 라이브에서 한 건 처리해 봐야 판정된다(E4).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { submitStoreReport, decideStoreReport, listStoreReports, reporterKeyOf, STORE_REPORT_REASONS } from '@/worker/utils/store-reports'
import { stripComments } from '../helpers/source-text'

// vite 가 'node:sqlite' 를 번들하려 들어서 createRequire 로 우회한다(이 레포의 다른 SQLite 시험과 동일).
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

/** node:sqlite 를 D1 처럼 보이게 하는 얇은 껍데기(이 레포의 다른 시험과 같은 방식). */
function d1(db: Db) {
  return {
    prepare(sql: string) {
      let args: unknown[] = []
      const api = {
        bind(...a: unknown[]) { args = a; return api },
        async run() {
          const r = db.prepare(sql).run(...(args as never[]))
          return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
        },
        async first<T>() { return (db.prepare(sql).get(...(args as never[])) ?? null) as T | null },
        async all<T>() { return { results: db.prepare(sql).all(...(args as never[])) as T[] } },
      }
      return api
    },
  } as never
}

let db: Db
let DB: never

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE sellers (id INTEGER PRIMARY KEY, business_name TEXT)`)
  db.exec(`INSERT INTO sellers (id, business_name) VALUES (7, '광화문 김밥천국'), (8, '이웃 카페')`)
  DB = d1(db)
})

const ok = { sellerId: 7, contact: '010-1234-5678', reason: 'not_my_listing' }

describe('제보 접수', () => {
  it('정상 제보가 행으로 남는다', async () => {
    const r = await submitStoreReport(DB, ok)
    expect(r.ok).toBe(true)
    const n = db.prepare('SELECT COUNT(*) AS n FROM store_reports').get() as { n: number }
    expect(n.n).toBe(1)
  })

  it('🔴 로그인 없이도 받는다 — 사장님은 대개 계정이 없다', async () => {
    const r = await submitStoreReport(DB, { ...ok, userId: null })
    expect(r.ok).toBe(true)
    const row = db.prepare('SELECT reporter_user_id FROM store_reports').get() as { reporter_user_id: number | null }
    expect(row.reporter_user_id).toBeNull()
  })

  it('🔴 연락처가 없으면 거절한다 — 되물을 수 없는 제보는 처리가 불가능하다', async () => {
    const r = await submitStoreReport(DB, { ...ok, contact: '' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('BAD_INPUT')
  })

  it('정의 밖 사유는 거절한다', async () => {
    const r = await submitStoreReport(DB, { ...ok, reason: '아무거나' })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('BAD_REASON')
  })

  it('없는 매장에는 쌓이지 않는다 — 어드민 큐가 쓰레기로 차면 안 된다', async () => {
    const r = await submitStoreReport(DB, { ...ok, sellerId: 999 })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('STORE_NOT_FOUND')
  })

  it('🔴 같은 사람이 같은 매장에 여러 번 눌러도 열린 제보는 한 장', async () => {
    await submitStoreReport(DB, ok)
    await submitStoreReport(DB, ok)
    const r3 = await submitStoreReport(DB, { ...ok, contact: '010 1234 5678' }) // 같은 번호, 다른 표기
    const n = db.prepare("SELECT COUNT(*) AS n FROM store_reports WHERE status='open'").get() as { n: number }
    expect(n.n).toBe(1)
    // 사용자에겐 성공으로 보인다 — 중복이라고 막으면 "접수가 안 됐나" 하고 또 누른다.
    expect(r3.ok).toBe(true)
  })

  it('🔴 멱등의 근거는 부분 UNIQUE 인덱스다 — 그것이 실제로 만들어진다', async () => {
    await submitStoreReport(DB, ok)
    const idx = db.prepare(
      "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_store_reports_open'",
    ).get() as { sql: string } | undefined
    expect(idx?.sql).toBeTruthy()
    // 열린 것만 막아야 한다 — 전체 UNIQUE 면 닫은 뒤 재제보가 막힌다.
    expect(idx!.sql).toMatch(/WHERE\s+status\s*=\s*'open'/)
  })

  it('다른 매장 제보는 막지 않는다', async () => {
    await submitStoreReport(DB, ok)
    await submitStoreReport(DB, { ...ok, sellerId: 8 })
    const n = db.prepare('SELECT COUNT(*) AS n FROM store_reports').get() as { n: number }
    expect(n.n).toBe(2)
  })

  it('🔴 "내 가게인데 내가 안 올림" 은 되찾기 경로로 이어 준다', async () => {
    const r = await submitStoreReport(DB, ok)
    expect(r.claimPath).toBe('/store/find?seller_id=7')
  })

  it('다른 사유엔 되찾기 경로를 주지 않는다', async () => {
    const r = await submitStoreReport(DB, { ...ok, reason: 'wrong_info' })
    expect(r.claimPath).toBeUndefined()
  })

  it('연락처 표기가 달라도 같은 사람으로 본다', () => {
    expect(reporterKeyOf('010-1234-5678')).toBe(reporterKeyOf('010 1234 5678'))
    expect(reporterKeyOf('x', 42)).toBe('u:42')
  })
})

describe('어드민 처리', () => {
  it('열린 제보를 닫는다', async () => {
    await submitStoreReport(DB, ok)
    const id = (db.prepare('SELECT id FROM store_reports').get() as { id: number }).id
    const r = await decideStoreReport(DB, { reportId: id, adminId: 10, status: 'resolved', note: '확인함' })
    expect(r.ok).toBe(true)
    const row = db.prepare('SELECT status, decided_by FROM store_reports WHERE id=?').get(id) as { status: string; decided_by: number }
    expect(row.status).toBe('resolved')
    expect(row.decided_by).toBe(10)
  })

  it('🔴 이미 닫힌 제보를 다시 닫아 판단자를 덮어쓰지 않는다', async () => {
    await submitStoreReport(DB, ok)
    const id = (db.prepare('SELECT id FROM store_reports').get() as { id: number }).id
    await decideStoreReport(DB, { reportId: id, adminId: 10, status: 'resolved' })
    const again = await decideStoreReport(DB, { reportId: id, adminId: 99, status: 'dismissed' })
    expect(again.ok).toBe(false)
    const row = db.prepare('SELECT status, decided_by FROM store_reports WHERE id=?').get(id) as { status: string; decided_by: number }
    expect(row.status).toBe('resolved')
    expect(row.decided_by).toBe(10)
  })

  it('닫은 뒤에는 같은 사람이 다시 제보할 수 있다', async () => {
    await submitStoreReport(DB, ok)
    const id = (db.prepare('SELECT id FROM store_reports').get() as { id: number }).id
    await decideStoreReport(DB, { reportId: id, adminId: 10, status: 'dismissed' })
    await submitStoreReport(DB, ok)
    const n = db.prepare("SELECT COUNT(*) AS n FROM store_reports WHERE status='open'").get() as { n: number }
    expect(n.n).toBe(1)
  })

  it('🔴 큐는 열린 것만 보여준다 — 처리된 것이 섞이면 놓친다', async () => {
    // 픽스처에 **닫힌 제보**가 있어야 필터가 일을 한다(열린 것만 넣으면 이 시험은 헛돈다).
    await submitStoreReport(DB, { ...ok, sellerId: 8 })
    const closedId = (db.prepare('SELECT id FROM store_reports').get() as { id: number }).id
    await decideStoreReport(DB, { reportId: closedId, adminId: 10, status: 'resolved' })
    await submitStoreReport(DB, ok)

    const openQ = await listStoreReports(DB, { status: 'open' })
    expect(openQ.total).toBe(1)
    expect(openQ.rows).toHaveLength(1)
    expect(openQ.rows[0].seller_id).toBe(7)
    expect(openQ.rows[0].store_name).toBe('광화문 김밥천국')

    // 닫힌 것은 닫힌 큐에서만 보인다.
    const doneQ = await listStoreReports(DB, { status: 'resolved' })
    expect(doneQ.rows.map(r => r.seller_id)).toEqual([8])
  })
})

describe('배선 · 경계', () => {
  const src = (p: string) => stripComments(readFileSync(p, 'utf-8'))

  it('제보 엔드포인트가 마운트돼 있다(호출 형태로 앵커)', () => {
    expect(src('src/features/seller/api/seller-stores.routes.ts'))
      .toMatch(/registerStoreReportRoutes\(app,\s*resolveActorUserId\)/)
  })

  it('🔴 제보 라우트가 로그인을 강제하지 않는다', () => {
    const s = src('src/features/seller/api/seller-store-reports.routes.ts')
    // requireAuth 계열 미들웨어가 붙으면 사장님(계정 없음)이 못 쓴다.
    expect(s).not.toMatch(/requireAuth|requireUser|requireSeller/)
    expect(s).toMatch(/rateLimit\(/)  // 대신 레이트리밋으로 막는다
  })

  it('🔴 제보 경로에서 환불·판매중지를 하지 않는다 (머니 경로 무접촉)', () => {
    const util = src('src/worker/utils/store-reports.ts')
    const route = src('src/features/seller/api/seller-store-reports.routes.ts')
    for (const s of [util, route]) {
      expect(s).not.toMatch(/refund|Refund|환불/)
      expect(s).not.toMatch(/is_active\s*=\s*0|deactivate/)
      expect(s).not.toMatch(/ledger_entries|adjustUserPoints|payout/)
    }
  })

  it('화면 사유 목록이 서버 목록과 같다', () => {
    const sheet = src('src/components/store/StoreReportSheet.tsx')
    for (const r of STORE_REPORT_REASONS) expect(sheet).toContain(`'${r}'`)
  })

  it('입구가 매장 위치 블록에 달려 있다', () => {
    expect(src('src/pages/group-buy/StoreLocation.tsx')).toMatch(/<StoreReportLink\b/)
    expect(src('src/pages/GroupBuyDetailPage.tsx')).toMatch(/sellerId=\{detail\.seller_id\}/)
  })

  it('🔴 매장이 없는 상품(플랫폼 교환권)엔 입구를 안 그린다', () => {
    expect(src('src/pages/group-buy/StoreReportLink.tsx')).toMatch(/if\s*\(!sellerId\)\s*return null/)
  })
})
