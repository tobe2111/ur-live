/**
 * 💰 **이용권 매출은 한 번만, 한 계정에** — 실제 SQLite 로 돌려서 판정 (2026-10-01)
 *
 * ## 무엇이 문제였나 (2026-09-30 실측)
 *
 * 같은 이용권 한 장에 매장 적립이 **두 번** 일어났다:
 *   - 구매 시 `seller:N`  (`group-buy.routes` 딜·카드 · `cart-checkout.routes`)
 *   - 사용 시 `merchant:N`(`ledger.ts recordVoucherUsedLedger`)
 *
 * `payouts-generate` 는 계정 **문자열**로 GROUP BY 하므로 그 둘은 **서로 상쇄되지 않는다.**
 * 1,000원 판매 1건으로 집계 SQL 을 돌리면 `merchant:14 → 900` · `seller:14 → 950`
 * = **1,850원**(185%). 게다가 매장이 부담해야 할 차감(인플루언서 커미션·친구 추천·중개사 몫·
 * 부분 환불)은 전부 `seller:N` 에만 걸려, 적립을 escrow 로 옮기기만 하면 `seller:N` 이
 * **음수**가 되어 최소출금액 미달로 영영 정산되지 않는다 ⇒ 그 부담을 아무도 안 내게 된다.
 *
 * ⇒ 2026-10-01 대표 승인("다 해줘", 기본안 1번): **사용 시점 단일화 + 계정 이름 통일.**
 *
 * ## 왜 문자열 검사가 아니라 SQL 을 돌리나
 *
 * 이 결함의 실패 모드는 **조용하다** — 집계가 1,850 을 내도 에러가 없고 화면도 안 깨진다.
 * 계정 이름이 하나로 모였는지는 소스를 읽어선 알 수 없고(네 자리에 흩어져 있다),
 * **같은 가게의 적립과 차감이 실제로 상쇄되는지**는 GROUP BY 를 돌려야만 보인다.
 *
 * ## ⚠️ 이 시험이 못 막는 것
 *   - D1 과 node:sqlite 의 차이 · cron 의 나머지(계좌 조회·승인 게이트·송금).
 *   - **escrow 잔액의 정합성**: 환불(`recordRefundLedger`)은 `platform:revenue → platform:escrow`
 *     라 새 모델에선 방향이 맞지 않는다. 다만 그 둘은 **payout 대상 계정이 아니라서**
 *     나가는 돈에는 영향이 없다(아무도 escrow 잔액을 읽지 않는다 — 실측). 별건으로 남긴다.
 *   - 라이브에서 실제로 돈이 맞게 나가는지 — 그건 staging 실결제가 판정한다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { stripComments } from '../helpers/source-text'
import { sellerLedgerAccount, voucherPurchaseCredit } from '@/worker/utils/ledger'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

const ROOT = process.cwd()
const read = (p: string) => readFileSync(path.join(ROOT, p), 'utf-8')
const code = (p: string) => stripComments(read(p))

const LEDGER = 'src/worker/utils/ledger.ts'
const GB = 'src/features/group-buy/api/group-buy.routes.ts'
const CART = 'src/features/group-buy/api/cart-checkout.routes.ts'
const VOUCHER = 'src/features/group-buy/api/group-buy-voucher.routes.ts'
const PAYOUTS = 'src/worker/cron/payouts-generate.ts'

/**
 * 🔑 집계 SQL 을 **소스에서 꺼내** 돌린다 — 베껴 쓰면 두 벌이 갈리고, 갈리는 순간
 *   이 시험은 "내가 적은 SQL" 을 검증하게 된다(결함을 놓치는 가장 흔한 길).
 */
function payoutAggregateSql(): string {
  const src = read(PAYOUTS)
  const m = src.match(/const credits = await DB\.prepare\(`([\s\S]*?)`\)/)
  if (!m) throw new Error('payouts 집계 SQL 을 못 찾았다 — 이 시험이 헛돌고 있다')
  return m[1]!.replace('${hold.sql}', '')   // 유보 조건은 이 시험의 관심사가 아니다
}

function fresh(): Db {
  const db = new DatabaseSync(':memory:')
  db.exec(`CREATE TABLE ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, reference_id TEXT,
    amount INTEGER, debit_account TEXT, credit_account TEXT,
    fee_amount INTEGER DEFAULT 0, fee_account TEXT, metadata TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP)`)
  return db
}

function add(db: Db, e: { ev: string; amt: number; debit: string; credit: string; fee?: number }) {
  db.prepare(`INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount)
              VALUES (?, 'ref', ?, ?, ?, ?)`).run(e.ev, e.amt, e.debit, e.credit, e.fee ?? 0)
}

/** payouts-generate 가 보는 계정별 순액. */
function totals(db: Db): Record<string, number> {
  const rows = db.prepare(payoutAggregateSql()).all() as Array<{ account: string; total: number }>
  return Object.fromEntries(rows.map((r) => [r.account, Number(r.total)]))
}

/** 매장 14 의 이용권 1장(1,000원 · 플랫폼 10%)을 새 모델대로 기록한다. */
function sellVoucher(db: Db, opts: { used: boolean }) {
  const { credit_account, fee_amount } = voucherPurchaseCredit(14, 50)
  add(db, { ev: 'group_buy_join', amt: 1000, debit: 'user:3', credit: credit_account, fee: fee_amount })
  if (opts.used) {
    // recordVoucherUsedLedger 의 3분개 (플랫폼 10%, 위탁 없음)
    add(db, { ev: 'voucher_used', amt: 900, debit: 'platform:escrow', credit: sellerLedgerAccount(14) })
    add(db, { ev: 'voucher_used', amt: 100, debit: 'platform:escrow', credit: 'platform:revenue' })
  }
}

describe('① 한 장에 한 번만 적립된다 (실제 집계 SQL)', () => {
  it('사용된 이용권: 가게 14 에 900 — 1,850 이 아니다', () => {
    const db = fresh()
    sellVoucher(db, { used: true })
    const t = totals(db)
    expect(t['seller:14'], '사용 시점 net 하나여야 한다').toBe(900)
    expect(t['merchant:14'], '이제 이 계정은 생기지 않는다').toBeUndefined()
    // 가게 14 로 나갈 수 있는 총액
    const toStore = Object.entries(t).filter(([a]) => a.endsWith(':14')).reduce((s, [, v]) => s + v, 0)
    expect(toStore, '한 가게에 두 계정이 남으면 또 185% 가 된다').toBe(900)
  })

  it('안 쓴 이용권: 가게에 **아무것도** 안 잡힌다 (지금은 1,000원 중 950 이 잡혔다)', () => {
    const db = fresh()
    sellVoucher(db, { used: false })
    const t = totals(db)
    expect(t['seller:14'], '사용 전엔 매장 몫이 없다 — escrow 에 있다').toBeUndefined()
    expect(t['merchant:14']).toBeUndefined()
  })

  it('매장이 부담할 차감이 적립과 같은 계정에서 빠진다', () => {
    const db = fresh()
    sellVoucher(db, { used: true })
    // 인플루언서 커미션 50 · 중개사 몫 30 — 둘 다 seller:14 에서 debit
    add(db, { ev: 'influencer_commission', amt: 50, debit: 'seller:14', credit: 'influencer:9' })
    add(db, { ev: 'broker_share', amt: 30, debit: 'seller:14', credit: 'agency:2' })
    const t = totals(db)
    expect(t['seller:14'], '900 − 50 − 30').toBe(820)
    expect(t['seller:14']!, '차감이 다른 계정에 걸리면 음수가 되어 영영 정산 안 된다').toBeGreaterThan(0)
  })
})

describe('② 매장 없는 플랫폼 상품은 종전 그대로', () => {
  it('seller_id 가 없으면 escrow 에 담지 않는다 — 담으면 영원히 안 빠진다', () => {
    // 사용 시점 적립이 아예 없는 경로(교환권·KT)라 escrow 는 영구 체류가 된다.
    for (const v of [null, undefined, 0, -1, 'abc']) {
      const r = voucherPurchaseCredit(v as never, 90)
      expect(r.credit_account, `${String(v)} → 플랫폼 수익`).toBe('platform:revenue')
      expect(r.fee_amount, '수수료는 종전대로 그 자리에서 인식한다').toBe(90)
    }
  })

  it('매장이 있으면 escrow + 수수료 0 (두 번 떼지 않는다)', () => {
    for (const v of [14, '14']) {
      const r = voucherPurchaseCredit(v as never, 50)
      expect(r.credit_account).toBe('platform:escrow')
      // 수수료는 사용 시점 3번째 분개가 인식한다 — 여기서 또 떼면 매장 몫이 줄어든다.
      expect(r.fee_amount).toBe(0)
    }
  })

  it('플랫폼 상품 매출은 payout 집계에 안 잡힌다', () => {
    const db = fresh()
    const { credit_account, fee_amount } = voucherPurchaseCredit(null, 90)
    add(db, { ev: 'group_buy_join', amt: 1800, debit: 'user:3', credit: credit_account, fee: fee_amount })
    const t = totals(db)
    // 🩸 첫 판에서 "계정이 0개" 라고 단언했다가 틀렸다 — 집계는 **구매자 지갑 차감**(`user:3`)도
    //   집는다(그게 원래 쿼리의 정상 동작이고, 음수라 최소출금액 미달로 걸러진다).
    //   볼 것은 "매장 계정이 생겼는가" 다.
    expect(Object.keys(t).filter((a) => !a.startsWith('user:')), 'platform:% 는 지급 대상이 아니다').toHaveLength(0)
    expect(t['user:3'], '구매자 차감은 음수로 잡힌다').toBeLessThan(0)
  })
})

describe('③ 배선 — 세 구매 자리가 같은 판정을 쓴다', () => {
  for (const [label, file] of [['딜·카드', GB], ['장바구니', CART]] as const) {
    it(`${label}: 구매 적립이 SSOT 를 경유한다`, () => {
      const s = code(file)
      expect(s).toContain('voucherPurchaseCredit(')
      // 손으로 적은 매장 credit 이 남아 있으면 그 자리만 옛 모델로 돈다.
      expect(s, '구매 적립에 매장 계정을 직접 적으면 안 된다')
        .not.toMatch(/credit_account:\s*sellerLedgerAccount\(/)
    })
  }

  it('딜·카드 두 자리 모두 (한쪽만 고치면 결제수단에 따라 갈린다)', () => {
    const hits = code(GB).match(/voucherPurchaseCredit\(/g) || []
    expect(hits.length, '딜 결제와 카드 결제 둘 다').toBe(2)
  })
})

describe('④ 계정 이름이 하나다', () => {
  it('사용 시점 적립이 merchant: 를 손으로 만들지 않는다', () => {
    const s = code(LEDGER)
    expect(s, 'merchant: 템플릿이 남으면 한 가게에 계정이 둘이 된다')
      .not.toMatch(/`merchant:\$\{/)
    expect(s).toContain('credit_account: sellerLedgerAccount(params.merchant_id)')
  })

  it('owner-promo 차감도 같은 이름으로 간다 (안 그러면 상쇄가 안 된다)', () => {
    expect(code(LEDGER)).toContain('ownerAccount: sellerLedgerAccount(params.merchant_id)')
    const v = code(VOUCHER)
    expect(v).not.toMatch(/`merchant:\$\{/)
    expect((v.match(/ownerAccount: sellerLedgerAccount\(merchantId\)/g) || []).length).toBe(2)
  })

  it('위탁 판매자 계정도 SSOT 경유 — `seller:null` 유령이 다시 안 생긴다', () => {
    expect(code(LEDGER)).toContain('credit_account: sellerLedgerAccount(params.seller_id)')
    expect(sellerLedgerAccount(null)).toBe('platform:revenue')
    expect(sellerLedgerAccount('null' as never)).toBe('platform:revenue')
  })

  it('매출 조회는 과거 merchant: 행도 계속 센다 (통일 전후로 0 이 되면 안 된다)', () => {
    const s = code('src/features/seller/api/seller-analytics.routes.ts')
    expect(s).toContain('credit_account IN (?, ?)')
    expect(s).toContain('`merchant:${sellerId}`, `seller:${sellerId}`')
  })
})

describe('🧪 이 시험이 헛돌지 않는가', () => {
  it('집계 SQL 을 실제로 소스에서 꺼냈다', () => {
    const sql = payoutAggregateSql()
    expect(sql).toContain('GROUP BY account')
    expect(sql).toContain("credit_account LIKE 'seller:%'")
    expect(sql.length).toBeGreaterThan(200)
  })

  it('검사 대상 파일이 실제로 읽혔다', () => {
    for (const f of [LEDGER, GB, CART, VOUCHER, PAYOUTS]) {
      expect(read(f).length).toBeGreaterThan(1000)
    }
  })
})
