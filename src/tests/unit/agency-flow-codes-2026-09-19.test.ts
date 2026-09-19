/**
 * 🔑 대행사(중개사) 확정 플로우 — 매장 코드 · 협업 코드 · 중개사 몫 (2026-09-19)
 *
 * 대표 확정: 코드 하나가 두 매칭(사장님 승계 · 인플루언서 협업)을 맡고, 커미션 % 는 케이스마다 조정 가능하며,
 * 중개사 몫은 유어딜이 직접 송금한다(결재 2026-09-16 안 1, 게이트 OFF). 직접 운영 매장도 같은 코드 레일을 쓴다.
 *
 * 실제 함수를 node:sqlite 에 태운다 — 문자열이 아니라 **행이 생기는가**를 본다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 * - HTTP 층(인증·rateLimit). 라우트가 SSOT 를 **부르는지**만 아래 배선 단언이 본다.
 * - D1 과 node:sqlite 의 차이(부분 UNIQUE 인덱스는 sqlite 도 지원하지만 플래너가 다르다).
 * - 게이트를 실제로 켰을 때의 정산 총액(그건 STAGING S-BROKER 실결제 몫이다).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'fs'
import { stripComments } from '../helpers/source-text'
import {
  generateStoreCode, normalizeStoreCode, formatStoreCode, isStoreCodeShape, judgeStoreCode,
  issueStoreCode, findStoreCode, getOrIssueOwnerClaimCode, consumeStoreCode, revokeStoreCode, listStoreCodes,
  type StoreCodeRow,
} from '@/worker/utils/store-codes'
import { redeemInfluencerCode, resolveCodeCommissionPct } from '@/worker/utils/influencer-code-redeem'
import {
  validateBrokerTerms, calcBrokerShareAmount, creditBrokerShare, saveBrokerTerms, readBrokerTerms,
} from '@/worker/utils/broker-share'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

function d1(db: Db) {
  return {
    prepare(sql: string) {
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
    },
  } as unknown as D1Database
}

function fresh(): { db: Db; DB: D1Database } {
  const db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE sellers (id INTEGER PRIMARY KEY, name TEXT, business_name TEXT, status TEXT DEFAULT 'approved',
      linked_user_id INTEGER, introduced_by_influencer_id TEXT, introduced_at TEXT, referral_bonus_until TEXT,
      referred_by_influencer TEXT, marketing_enabled INTEGER DEFAULT 1);
    CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT, handle TEXT);
    CREATE TABLE seller_blocked_influencers (seller_id INTEGER, influencer_id TEXT, unblocked_at TEXT);
    CREATE TABLE seller_influencer_deals (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, influencer_id TEXT NOT NULL,
      commission_pct REAL NOT NULL, starts_at DATETIME DEFAULT (datetime('now')), ends_at DATETIME, status TEXT DEFAULT 'proposed',
      proposed_by TEXT NOT NULL, message TEXT, created_at DATETIME DEFAULT (datetime('now')), responded_at DATETIME,
      requires_content_proof INTEGER DEFAULT 0, proof_url TEXT, proof_status TEXT, UNIQUE(seller_id, influencer_id));
    CREATE TABLE platform_settings (key TEXT PRIMARY KEY, value TEXT, description TEXT, updated_at TEXT);
    CREATE TABLE influencer_attributions (id INTEGER PRIMARY KEY AUTOINCREMENT, influencer_id TEXT NOT NULL, order_id INTEGER,
      voucher_id INTEGER, product_id INTEGER, seller_id INTEGER, commission_amount INTEGER NOT NULL, status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now')), available_at DATETIME, paid_at DATETIME, clawback_reason TEXT, source TEXT);
    CREATE TABLE influencer_balances (influencer_id TEXT PRIMARY KEY, pending_amount INTEGER DEFAULT 0, available_amount INTEGER DEFAULT 0,
      total_paid_out INTEGER DEFAULT 0, updated_at TEXT);
    INSERT INTO sellers (id, name, business_name, status) VALUES (1, '홍대돈까스', '홍대돈까스', 'approved');
    INSERT INTO sellers (id, name, business_name, status) VALUES (2, '정지매장', '정지매장', 'suspended');
    INSERT INTO users (id, name, handle) VALUES (100, '대행사', 'agency'), (200, '인플', 'inf'), (300, '차단인플', 'blocked');
  `)
  return { db, DB: d1(db) }
}

// ─────────────────────────────────────────────────────────────────────────────
describe('① 매장 코드 SSOT — 모양·정규화·판정', () => {
  it('코드는 8자, 0/O/1/I 가 없는 글자만 (사람이 옮겨 적는 값이다)', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateStoreCode()
      expect(c).toHaveLength(8)
      expect(isStoreCodeShape(c)).toBe(true)
      expect(c).not.toMatch(/[01IO]/)
    }
  })
  it('입력은 관대하게(하이픈·공백·소문자), 표시는 XXXX-XXXX', () => {
    expect(normalizeStoreCode(' ab3k-9qxp ')).toBe('AB3K9QXP')
    expect(formatStoreCode('ab3k9qxp')).toBe('AB3K-9QXP')
    expect(normalizeStoreCode('x'.repeat(40))).toHaveLength(16)
  })
  it('판정 — 없음·종류 다름·회수·만료·소진 을 각각 다른 이유로 거절한다', () => {
    const base: StoreCodeRow = { code: 'ABCDEFGH', seller_id: 1, kind: 'influencer', commission_pct: 5, requires_approval: 0, label: null,
      created_by: 1, created_at: '2026-09-19T00:00:00Z', expires_at: null, revoked_at: null, use_count: 0, max_uses: null }
    expect(judgeStoreCode(null, 'influencer')).toEqual({ ok: false, reason: 'NOT_FOUND' })
    expect(judgeStoreCode(base, 'owner_claim')).toEqual({ ok: false, reason: 'WRONG_KIND' })
    expect(judgeStoreCode({ ...base, revoked_at: 'x' }, 'influencer')).toEqual({ ok: false, reason: 'REVOKED' })
    expect(judgeStoreCode({ ...base, expires_at: '2020-01-01T00:00:00Z' }, 'influencer', '2026-09-19T00:00:00Z')).toEqual({ ok: false, reason: 'EXPIRED' })
    expect(judgeStoreCode({ ...base, max_uses: 2, use_count: 2 }, 'influencer')).toEqual({ ok: false, reason: 'EXHAUSTED' })
    expect(judgeStoreCode(base, 'influencer').ok).toBe(true)
  })
})

describe('② 매장 코드 — DB 에 실제로 생기고, 승계 코드는 매장당 하나', () => {
  it('발급 → 조회 → 회수 (남의 매장 코드는 회수 changes=0)', async () => {
    const { DB } = fresh()
    const row = await issueStoreCode(DB, { sellerId: 1, kind: 'influencer', createdBy: 1, commissionPct: 7, label: '유튜버' })
    expect(row?.commission_pct).toBe(7)
    expect((await findStoreCode(DB, formatStoreCode(row!.code)))?.code).toBe(row!.code)
    expect(await revokeStoreCode(DB, 999, row!.code)).toBe(false)
    expect(await revokeStoreCode(DB, 1, row!.code)).toBe(true)
    expect((await findStoreCode(DB, row!.code))?.revoked_at).toBeTruthy()
  })
  it('사장님 승계 코드는 멱등 — 두 번 불러도 같은 코드', async () => {
    const { DB } = fresh()
    const a = await getOrIssueOwnerClaimCode(DB, 1, 100)
    const b = await getOrIssueOwnerClaimCode(DB, 1, 100)
    expect(a?.code).toBe(b?.code)
    expect((await listStoreCodes(DB, 1, 'owner_claim')).length).toBe(1)
  })
  it('사용 상한은 CAS — max_uses=1 이면 두 번째 consume 은 실패', async () => {
    const { DB } = fresh()
    const row = await issueStoreCode(DB, { sellerId: 1, kind: 'influencer', createdBy: 1, commissionPct: 5, maxUses: 1 })
    expect(await consumeStoreCode(DB, row!.code)).toBe(true)
    expect(await consumeStoreCode(DB, row!.code)).toBe(false)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('③ 협업 코드 입력 → 딜 활성 (인플루언서 쪽 매칭)', () => {
  let DB: D1Database; let db: Db
  beforeEach(() => { ({ DB, db } = fresh()) })

  it('즉시 활성 코드 → seller_influencer_deals 에 active 행, proposed_by=code, % 는 코드 값', async () => {
    const code = await issueStoreCode(DB, { sellerId: 1, kind: 'influencer', createdBy: 1, commissionPct: 8 })
    const r = await redeemInfluencerCode(DB, formatStoreCode(code!.code), '200')
    expect(r.ok).toBe(true); expect(r.status).toBe('active'); expect(r.commissionPct).toBe(8)
    const row = db.prepare('SELECT status, proposed_by, commission_pct, responded_at FROM seller_influencer_deals WHERE seller_id=1 AND influencer_id=?').get('200') as Record<string, unknown>
    expect(row.status).toBe('active'); expect(row.proposed_by).toBe('code'); expect(row.commission_pct).toBe(8); expect(row.responded_at).toBeTruthy()
    expect((db.prepare('SELECT use_count FROM store_codes WHERE code=?').get(code!.code) as { use_count: number }).use_count).toBe(1)
  })
  it('승인 필요 코드 → proposed (매장이 수락해야 발효)', async () => {
    const code = await issueStoreCode(DB, { sellerId: 1, kind: 'influencer', createdBy: 1, commissionPct: 8, requiresApproval: true })
    const r = await redeemInfluencerCode(DB, code!.code, '200')
    expect(r.ok).toBe(true); expect(r.status).toBe('proposed')
  })
  it('매장 상한(influencer_pct_cap)이 코드 % 보다 낮으면 상한으로 잘라 건다 — 화면과 정산이 같은 값', async () => {
    await saveBrokerTerms(DB, 1, { brokerUserId: 100, sharePct: 10, capPct: 5 })
    const code = await issueStoreCode(DB, { sellerId: 1, kind: 'influencer', createdBy: 1, commissionPct: 20 })
    const r = await redeemInfluencerCode(DB, code!.code, '200')
    expect(r.ok).toBe(true); expect(r.commissionPct).toBe(5)
    expect(resolveCodeCommissionPct(20, 5)).toBe(5); expect(resolveCodeCommissionPct(3, 5)).toBe(3); expect(resolveCodeCommissionPct(200, null)).toBe(90)
  })
  it('자기 매장(운영자·주인)은 거절 — 자가 커미션 루프', async () => {
    db.exec(`CREATE TABLE seller_operators (id INTEGER PRIMARY KEY AUTOINCREMENT, seller_id INTEGER NOT NULL, user_id INTEGER NOT NULL, role TEXT NOT NULL DEFAULT 'operator', granted_by_user_id INTEGER, granted_at TEXT, revoked_at TEXT, created_at TEXT);
             INSERT INTO seller_operators (seller_id, user_id, role) VALUES (1, 100, 'operator')`)
    const code = await issueStoreCode(DB, { sellerId: 1, kind: 'influencer', createdBy: 1, commissionPct: 8 })
    const r = await redeemInfluencerCode(DB, code!.code, '100')
    expect(r.ok).toBe(false); expect(r.code).toBe('SELF')
    expect(db.prepare('SELECT COUNT(*) n FROM seller_influencer_deals').get()).toEqual({ n: 0 })
  })
  it('차단된 인플루언서·정지 매장·잘못된 코드는 각각 거절', async () => {
    db.exec(`INSERT INTO seller_blocked_influencers (seller_id, influencer_id) VALUES (1, '300')`)
    const code = await issueStoreCode(DB, { sellerId: 1, kind: 'influencer', createdBy: 1, commissionPct: 8 })
    expect((await redeemInfluencerCode(DB, code!.code, '300')).code).toBe('BLOCKED')
    const dead = await issueStoreCode(DB, { sellerId: 2, kind: 'influencer', createdBy: 2, commissionPct: 8 })
    expect((await redeemInfluencerCode(DB, dead!.code, '200')).code).toBe('STORE_SUSPENDED')
    expect((await redeemInfluencerCode(DB, 'NOPE', '200')).code).toBe('NOT_FOUND')
    const owner = await getOrIssueOwnerClaimCode(DB, 1, 100)
    expect((await redeemInfluencerCode(DB, owner!.code, '200')).code).toBe('WRONG_KIND')
  })
  it('같은 코드를 두 번 넣어도 활성 딜을 되돌리지 않는다(existed) — 팔던 사람의 적립이 안 끊긴다', async () => {
    const code = await issueStoreCode(DB, { sellerId: 1, kind: 'influencer', createdBy: 1, commissionPct: 8 })
    await redeemInfluencerCode(DB, code!.code, '200')
    db.prepare(`UPDATE seller_influencer_deals SET commission_pct = 12 WHERE seller_id = 1 AND influencer_id = '200'`).run() // 매장이 케이스별 조정
    const again = await redeemInfluencerCode(DB, code!.code, '200')
    expect(again.existed).toBe(true)
    expect((db.prepare(`SELECT commission_pct, status FROM seller_influencer_deals WHERE seller_id=1 AND influencer_id='200'`).get() as { commission_pct: number; status: string })).toEqual({ commission_pct: 12, status: 'active' })
    expect((db.prepare('SELECT use_count FROM store_codes WHERE code=?').get(code!.code) as { use_count: number }).use_count).toBe(1)
  })
  it('거절됐던 딜은 코드로 다시 열린다 (매장이 코드를 살려 뒀다는 뜻)', async () => {
    db.prepare(`INSERT INTO seller_influencer_deals (seller_id, influencer_id, commission_pct, status, proposed_by) VALUES (1, '200', 3, 'rejected', 'seller')`).run()
    const code = await issueStoreCode(DB, { sellerId: 1, kind: 'influencer', createdBy: 1, commissionPct: 8 })
    const r = await redeemInfluencerCode(DB, code!.code, '200')
    expect(r.ok).toBe(true); expect(r.existed).toBe(false)
    expect((db.prepare(`SELECT status, commission_pct FROM seller_influencer_deals WHERE seller_id=1 AND influencer_id='200'`).get() as { status: string; commission_pct: number })).toEqual({ status: 'active', commission_pct: 8 })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('④ 중개사 몫 — 요율 검증·적립·멱등·게이트', () => {
  it('요율 검증 — 각 0~50, 합 ≤ 90, 빈 값은 0/상한없음', () => {
    expect(validateBrokerTerms({})).toEqual({ ok: true, sharePct: 0, capPct: null })
    expect(validateBrokerTerms({ broker_share_pct: '10', influencer_pct_cap: '5' })).toEqual({ ok: true, sharePct: 10, capPct: 5 })
    expect(validateBrokerTerms({ broker_share_pct: 51 }).ok).toBe(false)
    expect(validateBrokerTerms({ influencer_pct_cap: -1 }).ok).toBe(false)
    expect(validateBrokerTerms({ broker_share_pct: 50, influencer_pct_cap: 45 }).ok).toBe(false)
    expect(validateBrokerTerms({ broker_share_pct: 'abc' }).ok).toBe(false)
  })
  it('적립액은 내림 — 10,000원 × 12.5% = 1,250 / 999 × 10% = 99', () => {
    expect(calcBrokerShareAmount(10000, 12.5)).toBe(1250)
    expect(calcBrokerShareAmount(999, 10)).toBe(99)
    expect(calcBrokerShareAmount(10000, 0)).toBe(0)
  })
  it('게이트 OFF(행 부재) 면 아무것도 안 쓴다 — 종전과 byte-동일', async () => {
    const { DB, db } = fresh()
    await saveBrokerTerms(DB, 1, { brokerUserId: 100, sharePct: 10, capPct: null })
    const r = await creditBrokerShare(DB, { sellerId: 1, orderId: 501, orderNumber: 'GB-1', productId: 7, totalAmount: 10000, refundWindowDays: 7 })
    expect(r.credited).toBe(0)
    expect(db.prepare('SELECT COUNT(*) n FROM influencer_attributions').get()).toEqual({ n: 0 })
  })
  it('게이트 ON → 주문당 1행(source=broker_share) · 잔액 pending · 원장 debit=seller:N. 두 번째 호출은 0(멱등)', async () => {
    const { DB, db } = fresh()
    db.prepare(`INSERT INTO platform_settings (key, value) VALUES ('broker_share_enabled', 'true')`).run()
    await saveBrokerTerms(DB, 1, { brokerUserId: 100, sharePct: 10, capPct: 5 })
    expect(await readBrokerTerms(DB, 1)).toEqual({ brokerUserId: 100, sharePct: 10, influencerCapPct: 5 })
    const p = { sellerId: 1, orderId: 501, orderNumber: 'GB-1', productId: 7, totalAmount: 10000, refundWindowDays: 7 }
    const first = await creditBrokerShare(DB, p)
    expect(first).toEqual({ credited: 1000, brokerUserId: 100 })
    const again = await creditBrokerShare(DB, p) // 카드 confirm-toss 와 딜 /join 이 같은 주문을 두 번 부르는 상황
    expect(again.credited).toBe(0)
    const rows = db.prepare(`SELECT influencer_id, commission_amount, status, source, seller_id FROM influencer_attributions`).all()
    expect(rows).toEqual([{ influencer_id: '100', commission_amount: 1000, status: 'pending', source: 'broker_share', seller_id: 1 }])
    expect(db.prepare(`SELECT pending_amount FROM influencer_balances WHERE influencer_id='100'`).get()).toEqual({ pending_amount: 1000 })
    const ledger = db.prepare(`SELECT event_type, amount, debit_account, credit_account FROM ledger_entries`).all()
    expect(ledger).toEqual([{ event_type: 'broker_share', amount: 1000, debit_account: 'seller:1', credit_account: 'influencer:100' }])
  })
  it('중개사가 없거나 요율 0 이면 게이트가 켜져 있어도 0', async () => {
    const { DB, db } = fresh()
    db.prepare(`INSERT INTO platform_settings (key, value) VALUES ('broker_share_enabled', 'true')`).run()
    expect((await creditBrokerShare(DB, { sellerId: 1, orderId: 1, orderNumber: 'x', productId: 1, totalAmount: 10000, refundWindowDays: 7 })).credited).toBe(0)
    await saveBrokerTerms(DB, 1, { brokerUserId: 100, sharePct: 0, capPct: null })
    expect((await creditBrokerShare(DB, { sellerId: 1, orderId: 2, orderNumber: 'y', productId: 1, totalAmount: 10000, refundWindowDays: 7 })).credited).toBe(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe('⑤ 배선 — 라우트·화면·가드가 SSOT 를 실제로 부른다', () => {
  const src = (p: string) => stripComments(readFileSync(p, 'utf8'))
  it('결제 확정 두 경로(/join · confirm-toss) 모두 creditBrokerShare 를 부른다 — 한쪽만이면 결제수단에 따라 몫이 갈린다', () => {
    const s = src('src/features/group-buy/api/group-buy.routes.ts')
    expect((s.match(/await creditBrokerShare\(DB, \{/g) || []).length).toBe(2)
  })
  it('인플루언서가 매장·코드 제안을 수락하는 엔드포인트가 있다 (전엔 0 이었다)', () => {
    const s = src('src/features/group-buy/api/marketing/collab-codes.ts')
    expect(s).toMatch(/influencerApp\.post\('\/deals\/:id\/respond'/)
    expect(s).toMatch(/proposed_by IN \('seller','code'\)/)
    expect(s).toMatch(/influencerApp\.post\('\/codes\/redeem'/)
    expect(s).toMatch(/sellerApp\.patch\('\/deals\/:id'/)
    expect(src('src/features/group-buy/api/marketing.routes.ts')).toMatch(/registerCollabCodeRoutes\(sellerApp, influencerApp, discoverApp\)/)
  })
  it('매장 등록이 승계 코드와 요율을 심는다 · 사장님 찾기가 코드 조회를 갖는다', () => {
    const s = src('src/features/seller/api/seller-stores.routes.ts')
    expect(s).toMatch(/prepareBrokerTerms\(b\)/)
    expect(s).toMatch(/await finalizeBrokeredStore\(c\.env\.DB, newSellerId, userId, brokerTerms\)/)
    expect(s).toMatch(/registerBrokerTermsRoutes\(app, resolveActorUserId\)/)
    const t = src('src/features/seller/api/seller-broker-terms.routes.ts')
    expect(t).toMatch(/getOrIssueOwnerClaimCode\(DB, sellerId, brokerUserId\)/)
    expect(t).toMatch(/saveBrokerTerms\(DB, sellerId, \{ brokerUserId,/)
    expect(src('src/features/seller/api/seller-store-claims.routes.ts')).toMatch(/app\.get\('\/store-claims\/lookup-by-code'/)
    expect(src('src/features/seller/api/seller-operators.routes.ts')).toMatch(/owner_claim_code: code \? formatStoreCode\(code\.code\) : null/)
  })
  it('매장 링크(/s/:id?ref=)가 귀속을 심는다 · /i/join 라우트 · 게이트 명부·검증·가드 allowlist', () => {
    expect(src('src/pages/SellerPublicPage.tsx')).toMatch(/storeAffiliateRef\(publicSearch\.get\('aff'\) \|\| publicSearch\.get\('ref'\)\)/)
    expect(src('src/App.tsx')).toMatch(/path="\/i\/join\/:code"/)
    expect(src('src/features/admin/api/admin-system-monitoring.routes.ts')).toMatch(/key: 'broker_share_enabled'/)
    expect(src('src/worker/utils/platform-settings-validation.ts')).toMatch(/broker_share_enabled: boolStr/)
    expect(src('scripts/check-commission-budget.mjs')).toContain("'src/worker/utils/broker-share.ts'")
  })
  it('중개사 몫은 매장 부담 — 원장 debit 이 platform:* 가 아니다', () => {
    const s = src('src/worker/utils/broker-share.ts')
    expect(s).toMatch(/debit_account: sellerLedgerAccount\(p\.sellerId\)/)
    expect(s).not.toMatch(/debit_account:\s*['"]platform:/)
  })
})
