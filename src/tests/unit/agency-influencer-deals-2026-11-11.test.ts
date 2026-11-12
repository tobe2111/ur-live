/**
 * 🤝💰 에이전시 소개비 계약 — 총 마케팅 비용 상한 안에서 (2026-11-11 대표 *"응 그걸로 확정하고 진행해줘"* → *"계속 진행해"*)
 *   결재 `docs/decisions/2026-11-11-agency-share-auto-split.md` ⑤ · 진짜 SQLite(node:sqlite)로 잰다.
 *
 * 지키는 것:
 *  ① 스위치 OFF 면 만들기 403 · 정산 null(= 종전 동작)
 *  ② 수수료 + 소개비 ≤ 상한이면 바로 발효, 넘거나 상한 미정이면 사장님 승인 대기 · 같은 사람 열린 계약은 하나
 *  ③ 정산: 그 에이전시가 **맡은 이용권**에만 붙는다(사장님 이용권·맡김 끊김·다른 인플루언서 = null)
 *  ④ 정산 때 상한 재확인 — 사장님이 상한을 낮추면 남는 폭까지만 · 사장님이 승인한 계약은 그대로
 *  ⑤ 승인/거절은 대기일 때 한 번만(CAS) · 끝내면 다음 판매부터 안 붙는다
 *  ⑥ 두 결제 경로가 에이전시 계약을 먼저 보고, 옛 규칙 1(isOwnAgencyReferral)은 코드에서 사라졌다
 *
 * ⚠️ 못 보는 것: 실제 결제 적립 금액(staging S-AGENCYDEAL) · 알림톡 실제 발송(카카오 검수) · 화면.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { ensureAgencyConsoleTables } from '@/features/agency-console/api/agency-schema'
import {
  agencyDealPctForSale, capDealPct, decideAgencyDeal, endAgencyDeal, fitsBudget, proposeAgencyDeal,
} from '@/features/agency-console/api/agency-influencer-deals'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  const stmt = (sql: string) => {
    let binds: unknown[] = []
    const self = {
      bind: (...a: unknown[]) => { binds = a; return self },
      first: async () => db.prepare(sql).get(...(binds as never[])) ?? null,
      all: async () => ({ results: db.prepare(sql).all(...(binds as never[])) }),
      run: async () => {
        const r = db.prepare(sql).run(...(binds as never[]))
        return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
      },
    }
    return self
  }
  return {
    prepare: stmt,
    batch: async (list: Array<{ run: () => Promise<unknown> }>) => { const out = []; for (const s of list) out.push(await s.run()); return out },
  } as unknown as D1Database
}

/** 매장 7 · 에이전시 1 이 이용권 31 을 맡음(수수료 3% · 상한 15%) · 이용권 30 은 사장님 것 · 인플루언서 user 80, 81. */
async function fresh(opts: { gate?: boolean; budget?: number | null } = {}) {
  const db = new DatabaseSync(':memory:')
  db.exec('CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT)')
  db.exec('CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, handle TEXT)')
  db.exec("INSERT INTO users (id, name, handle) VALUES (80, '뽀야', 'boya'), (81, '다른사람', 'other')")
  if (opts.gate !== false) db.exec("INSERT INTO platform_settings VALUES ('agency_influencer_deals_enabled', 'true')")
  const DB = d1(db)
  await ensureAgencyConsoleTables(DB)
  db.exec("INSERT INTO agency_accounts (id, name, kind, status) VALUES (1, '리스터', 'business', 'active')")
  db.exec("INSERT INTO agency_store_links (agency_id, seller_id, status) VALUES (1, 7, 'active')")
  db.exec("INSERT INTO agency_product_periods (product_id, seller_id, agency_id, started_at) VALUES (31, 7, 1, datetime('now', '-1 day'))")
  db.exec("INSERT INTO agency_share_terms (seller_id, agency_id, pct, effective_from) VALUES (7, 1, 3, datetime('now', '-1 day'))")
  const budget = opts.budget === undefined ? 15 : opts.budget
  if (budget !== null) db.exec(`INSERT INTO agency_budget_terms (seller_id, agency_id, pct, effective_from) VALUES (7, 1, ${budget}, datetime('now', '-1 day'))`)
  return { db, DB }
}
const propose = (DB: D1Database, pct: number, user = 80) => proposeAgencyDeal(DB, { sellerId: 7, agencyId: 1, staffId: 6, influencerUserId: user, pct })

describe('순수 판정', () => {
  it('fitsBudget — 합이 상한 이하면 true · 상한 미정이면 false', () => {
    expect(fitsBudget(3, 15, 12)).toBe(true)
    expect(fitsBudget(3, 15, 12.1)).toBe(false)
    expect(fitsBudget(3, 0, 1)).toBe(false)
  })
  it('capDealPct — 승인 계약은 그대로, 아니면 상한 − 수수료까지', () => {
    expect(capDealPct(12, 3, 10, false)).toBe(7)
    expect(capDealPct(12, 3, 10, true)).toBe(12)
    expect(capDealPct(12, 3, 0, false)).toBe(0)
    expect(capDealPct(12, 12, 10, false)).toBe(0)
  })
})

describe('① 스위치 OFF', () => {
  it('만들기 403 · 정산 null', async () => {
    const { db, DB } = await fresh({ gate: false })
    const r = await propose(DB, 5)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.status).toBe(403)
    db.exec("INSERT INTO platform_settings VALUES ('agency_influencer_deals_enabled', 'true')")
    await propose(DB, 5)
    db.exec("UPDATE platform_settings SET value = 'false' WHERE key = 'agency_influencer_deals_enabled'")
    expect(await agencyDealPctForSale(DB, 7, 31, '80')).toBeNull()
  })
})

describe('② 상한 판정', () => {
  it('3% + 12% ≤ 15% = 바로 발효 · 3% + 13% = 사장님 승인 대기', async () => {
    const { DB } = await fresh()
    const a = await propose(DB, 12)
    expect(a.ok && a.status).toBe('active')
    const b = await propose(DB, 13, 81)
    expect(b.ok && b.status).toBe('pending_owner')
  })
  it('상한을 안 정한 매장은 언제나 사장님 승인', async () => {
    const { DB } = await fresh({ budget: null })
    const a = await propose(DB, 1)
    expect(a.ok && a.status).toBe('pending_owner')
  })
  it('같은 인플루언서에게 열린 계약은 하나', async () => {
    const { DB } = await fresh()
    await propose(DB, 5)
    const again = await propose(DB, 6)
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.code).toBe('ALREADY_OPEN')
  })
})

describe('③ 정산 — 맡은 이용권에만', () => {
  it('맡은 이용권 31 = 12% · 사장님 이용권 30 · 다른 인플루언서 · 맡김 끊김 = null', async () => {
    const { db, DB } = await fresh()
    await propose(DB, 12)
    expect(await agencyDealPctForSale(DB, 7, 31, '80')).toBe(12)
    expect(await agencyDealPctForSale(DB, 7, 31, 80)).toBe(12)
    expect(await agencyDealPctForSale(DB, 7, 30, '80')).toBeNull()
    expect(await agencyDealPctForSale(DB, 7, 31, '81')).toBeNull()
    db.exec("UPDATE agency_store_links SET status = 'ended'")
    expect(await agencyDealPctForSale(DB, 7, 31, '80')).toBeNull()
  })
  it('승인 대기 계약은 정산에 안 붙는다', async () => {
    const { DB } = await fresh()
    await propose(DB, 20)
    expect(await agencyDealPctForSale(DB, 7, 31, '80')).toBeNull()
  })
})

describe('④ 상한 재확인', () => {
  it('사장님이 상한을 10% 로 낮추면 12% 계약은 7% 까지만', async () => {
    const { db, DB } = await fresh()
    await propose(DB, 12)
    db.exec("INSERT INTO agency_budget_terms (seller_id, agency_id, pct, effective_from) VALUES (7, 1, 10, datetime('now'))")
    expect(await agencyDealPctForSale(DB, 7, 31, '80')).toBe(7)
  })
  it('사장님이 승인한 초과 계약은 상한을 낮춰도 그대로', async () => {
    const { db, DB } = await fresh()
    const r = await propose(DB, 20)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(await decideAgencyDeal(DB, { sellerId: 7, dealId: r.id, approve: true, userId: 3 })).toBe(true)
    db.exec("INSERT INTO agency_budget_terms (seller_id, agency_id, pct, effective_from) VALUES (7, 1, 5, datetime('now'))")
    expect(await agencyDealPctForSale(DB, 7, 31, '80')).toBe(20)
  })
})

describe('⑤ 승인 · 끝내기', () => {
  it('승인은 대기일 때 한 번만 · 남의 매장 번호로는 안 된다', async () => {
    const { DB } = await fresh()
    const r = await propose(DB, 20)
    if (!r.ok) throw new Error('propose')
    expect(await decideAgencyDeal(DB, { sellerId: 8, dealId: r.id, approve: true, userId: 3 })).toBe(false)
    expect(await decideAgencyDeal(DB, { sellerId: 7, dealId: r.id, approve: false, userId: 3 })).toBe(true)
    expect(await decideAgencyDeal(DB, { sellerId: 7, dealId: r.id, approve: true, userId: 3 })).toBe(false)
  })
  it('끝내면 다음 판매부터 안 붙고, 다시 걸 수 있다', async () => {
    const { DB } = await fresh()
    const r = await propose(DB, 12)
    if (!r.ok) throw new Error('propose')
    expect(await endAgencyDeal(DB, { dealId: r.id, sellerId: 7, agencyId: 1 })).toBe(true)
    expect(await agencyDealPctForSale(DB, 7, 31, '80')).toBeNull()
    expect((await propose(DB, 10)).ok).toBe(true)
  })
})

describe('⑥ 배선', () => {
  for (const f of ['src/features/group-buy/api/group-buy.routes.ts', 'src/features/group-buy/api/helpers.ts']) {
    it(`${f.split('/').pop()} — 에이전시 계약을 먼저, 없으면 가게 단위 계약 · 옛 규칙 1 없음`, () => {
      const src = stripComments(readFileSync(f, 'utf8'))
      expect(src).toMatch(/agencyDealPctForSale\(DB,[^\n]*\)\)\s*\?\?/)
      expect(src).not.toMatch(/isOwnAgencyReferral/)
    })
  }
  it('에이전시 라우트는 맡은 매장인지 먼저 보고, 사장님 라우트는 주인만', () => {
    const ag = stripComments(readFileSync('src/features/agency-console/api/agency-influencer-deals.routes.ts', 'utf8'))
    expect(ag.indexOf('ownsStore(DB, me, sellerId)')).toBeGreaterThan(0)
    expect(ag.indexOf('ownsStore(DB, me, sellerId)')).toBeLessThan(ag.indexOf('proposeAgencyDeal(DB'))
    const own = stripComments(readFileSync('src/features/seller/api/seller-agency-deals.routes.ts', 'utf8'))
    expect((own.match(/await requireOwner\(c\)/g) || []).length).toBe(3)
  })
})
