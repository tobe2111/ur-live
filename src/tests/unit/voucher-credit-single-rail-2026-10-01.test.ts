/**
 * 💸 **이용권 한 장에 매장 적립이 두 번** 이던 것 (2026-10-01)
 *
 * 결재: `docs/decisions/2026-09-30-voucher-credit-double-rail.md`
 * (대표 2026-10-01 *"최대한 이상적으로 다 해줘"*).
 *
 * ## 무엇이 깨져 있었나 — 결함이 **둘**이고 성질이 다르다
 *
 * ① **적립이 두 번 일어났다**: 구매 시점에 `seller:N`(순 950), 사용 시점에 `merchant:N`(900).
 * ② **그 둘이 서로 다른 payee 로 집계됐다**: `payouts-generate` 가 계정 **문자열**로 GROUP BY 해서
 *    `seller:14` 와 `merchant:14` 가 payout 행을 **따로** 만들었다 ⇒ 1,000원 판매에 1,850원(185%).
 *
 * ②는 금액만의 문제가 아니다 — `seller:N` 에 걸린 **차감**(인플루언서 커미션 · 중개사 몫 · 부분환불)이
 * `merchant:N` 의 적립에서 빠지지 않는다. 그래서 ①만 고치면 `seller:N` 에 차감만 남아 음수가 되고,
 * 음수는 최소출금액 미달로 스킵돼 **매장이 부담해야 할 커미션을 아무도 안 내게 된다**(플랫폼 손실).
 * ⇒ 둘은 **함께** 고쳐야 하고, 그래서 이 파일이 둘을 **따로** 고정한다.
 *
 * ## 고친 방향 — 이름을 바꾸지 않고 집계에서 접는다
 *
 * 결재문의 안 1 은 `merchant:N` → `seller:N` **리네임**이었는데, 그 이름을 읽는 곳이 결재문이 센
 * 5곳보다 많았다(셀러 대시보드 매출 카드 · 주간 이중레일 경보 · owner-promo · payout-use-gate).
 * 리네임하면 그 넷이 **조용히 0을 세기 시작한다.** ⇒ 이름은 그대로 두고 **지급 집계에서만** 접는다.
 *
 * ## 이 시험이 지키는 것 — **실제 sqlite 에 돌려서** 판정한다
 *
 * 문자열 비교로는 SQL 의미를 못 본다(이번에 깨진 것이 정확히 의미였다). 그래서 `node:sqlite` 에
 * 표 두 개를 만들고 **cron 이 실제로 쓰는 문장**(`payoutCreditsSql`/`payoutPaidSql`)을 돌려
 * **행 수와 금액으로** 판정한다.
 *
 * ⚠️ 이 시험이 **못 보는 것**: D1 과 sqlite 의 미세한 차이 · cron 루프의 계좌 조회/승인 게이트 ·
 *   실제 송금. 그건 배포 후 라이브 판정(결재문 E4)이 맡는다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import {
  purchaseCreditAccount,
  canonicalPayee,
  canonicalPaidPayee,
  payeeKey,
  payoutCreditsSql,
  payoutPaidSql,
  payoutPayeeType,
} from '@/worker/utils/payout-account'
import { readCode, stripComments, stripImports } from '../helpers/source-text'

// 🩹 `import { DatabaseSync } from 'node:sqlite'` 는 jsdom 환경의 번들러가 거부한다
//   ("Cannot bundle Node.js built-in"). `expired-voucher-refund-2026-09-30` 과 같은 방식으로 우회한다.
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

type Entry = {
  event_type: string
  amount: number
  debit_account: string
  credit_account: string
  fee_amount?: number
}

function db(entries: Entry[], payouts: Array<{ payee_type: string; payee_id: string; amount: number; status?: string }> = []) {
  const d = new DatabaseSync(':memory:')
  d.exec(`CREATE TABLE ledger_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT, event_type TEXT, reference_id TEXT,
    amount INTEGER, debit_account TEXT, credit_account TEXT,
    fee_amount INTEGER DEFAULT 0, fee_account TEXT, metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')))`)
  d.exec(`CREATE TABLE payouts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, payee_type TEXT, payee_id TEXT,
    amount INTEGER, period_start TEXT, period_end TEXT, status TEXT)`)
  const ins = d.prepare(
    `INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount)
     VALUES (?, ?, ?, ?, ?, ?)`)
  for (const e of entries) ins.run(e.event_type, 'ref', e.amount, e.debit_account, e.credit_account, e.fee_amount ?? 0)
  const insP = d.prepare(`INSERT INTO payouts (payee_type, payee_id, amount, status) VALUES (?, ?, ?, ?)`)
  for (const p of payouts) insP.run(p.payee_type, p.payee_id, p.amount, p.status ?? 'pending')
  return d
}

/** cron 과 **같은 순서**로 집계한다(credits − 이미 payout). */
function pending(d: InstanceType<typeof DatabaseSync>): Map<string, number> {
  const credits = d.prepare(payoutCreditsSql('')).all() as Array<{ account: string; total: number }>
  const paid = d.prepare(payoutPaidSql()).all() as Array<{ account: string; total: number }>
  const paidMap = new Map(paid.map(r => [r.account, Number(r.total)]))
  const out = new Map<string, number>()
  for (const c of credits) out.set(c.account, Number(c.total) - (paidMap.get(c.account) ?? 0))
  return out
}

/**
 * 💡 **"받을 사람" 만 고른다.** 집계 SQL 은 `debit_account LIKE 'user:%'` 때문에 **구매자 지갑
 *   (`user:3`)도 음수로 등장한다** — 라이브에서도 그렇고, cron 은 `pending < 최소출금액` 에서
 *   건너뛴다. 이 시험이 처음엔 그걸 결함으로 잡아 빨간불을 냈다(픽스처가 아니라 **내 단언**이
 *   틀렸다). ⇒ 지급 여부를 말할 때는 **양수만** 본다.
 */
function payable(p: Map<string, number>): string[] {
  return [...p.entries()].filter(([, v]) => v > 0).map(([k]) => k).sort()
}

// 1,000원 이용권 1장을 매장 14 가 판 뒤 손님이 **사용**한 경우의 사용 시점 세 분개.
const USE_ENTRIES: Entry[] = [
  { event_type: 'voucher_used', amount: 900, debit_account: 'platform:escrow', credit_account: 'merchant:14' },
  { event_type: 'voucher_used', amount: 100, debit_account: 'platform:escrow', credit_account: 'platform:revenue' },
]

describe('이용권 적립 단일 레일 — 실제 sqlite 로 금액·행 수 판정', () => {
  it('① 구매 적립이 escrow 로 가므로 매장 지급액은 사용 시점 몫(900)뿐이다', () => {
    const d = db([
      // 구매: 매장 상품이므로 escrow (수정 후)
      { event_type: 'group_buy_join', amount: 1000, debit_account: 'user:3', credit_account: 'platform:escrow', fee_amount: 0 },
      ...USE_ENTRIES,
    ])
    const p = pending(d)
    expect(p.get('seller:14'), '매장 지급액이 사용 시점 몫과 달라졌다').toBe(900)
    // escrow·revenue 는 지급 대상이 아니다 — LIKE 목록에 없으니 집계에 **등장조차 하면 안 된다**.
    expect([...p.keys()].filter(k => k.startsWith('platform:'))).toEqual([])
    expect(payable(p), '받을 사람은 매장 하나뿐이어야 한다').toEqual(['seller:14'])
  })

  it('🔴 되돌려-검증: 구매 적립을 매장 계정으로 보내면 1,850(185%)이 된다', () => {
    const d = db([
      // 종전(결함) 구조 — 구매 시점에 `seller:14` 로 950 순적립
      { event_type: 'group_buy_join', amount: 1000, debit_account: 'user:3', credit_account: 'seller:14', fee_amount: 50 },
      ...USE_ENTRIES,
    ])
    const p = pending(d)
    expect(p.get('seller:14'), '종전 구조가 재현되지 않으면 이 시험은 아무것도 안 지킨다').toBe(1850)
  })

  it('② 같은 가게에 payee 행이 하나다 (merchant:N 과 seller:N 을 접는다)', () => {
    const d = db([
      { event_type: 'group_buy_join', amount: 1000, debit_account: 'user:3', credit_account: 'seller:14', fee_amount: 50 },
      ...USE_ENTRIES,
    ])
    const keys = [...pending(d).keys()].filter(k => k.endsWith(':14'))
    expect(keys, `한 가게에 payee 가 둘이면 송금이 두 번 간다: ${keys.join(', ')}`).toEqual(['seller:14'])
  })

  it('② 차감이 제자리를 찾는다 — seller:N 의 커미션 차감이 merchant:N 적립에서 빠진다', () => {
    const d = db([
      { event_type: 'group_buy_join', amount: 1000, debit_account: 'user:3', credit_account: 'platform:escrow', fee_amount: 0 },
      ...USE_ENTRIES,
      // 매장이 부담하는 인플루언서 커미션(실제 코드가 `seller:N` 으로 debit 한다)
      { event_type: 'affiliate_commission', amount: 100, debit_account: 'seller:14', credit_account: 'userdeal:9' },
    ])
    expect(pending(d).get('seller:14'), '차감이 접히지 않으면 매장이 커미션을 안 내게 된다').toBe(800)
  })

  it('② 이미 생성된 payout 이 맞춰 빠진다 (store_owner ↔ seller 라벨이 달라도)', () => {
    const d = db(
      [
        { event_type: 'group_buy_join', amount: 1000, debit_account: 'user:3', credit_account: 'platform:escrow', fee_amount: 0 },
        ...USE_ENTRIES,
      ],
      [{ payee_type: 'store_owner', payee_id: '14', amount: 300 }],
    )
    expect(pending(d).get('seller:14'), 'payee_type 라벨이 달라 차감이 안 맞으면 이중지급이다').toBe(600)
  })

  it('플랫폼 상품(판매자 없음)은 escrow 에 담기지 않는다 — 담으면 영원히 안 빠진다', () => {
    const d = db([
      // 교환권·KT 등: 사용 시점 분개가 없으므로 구매 시점에 수익 인식
      { event_type: 'group_buy_join', amount: 1800, debit_account: 'user:3', credit_account: 'platform:revenue', fee_amount: 90 },
    ])
    const p = pending(d)
    expect(payable(p), '플랫폼 상품이 받을 사람 목록에 뜨면 아무에게도 갈 수 없는 payout 후보가 된다').toEqual([])
  })

  it("오염 계정 'seller:null' 은 지급 대상이 되지 않는다", () => {
    const d = db([{ event_type: 'group_buy_join', amount: 50000, debit_account: 'user:3', credit_account: 'seller:null' }])
    // SQL 은 LIKE 로 잡지만 JS 판정이 떨어뜨린다(두 겹 방어).
    expect(canonicalPayee('seller:null')).toBeNull()
    const rows = d.prepare(payoutCreditsSql('')).all() as Array<{ account: string; total: number }>
    const owed = rows.filter(r => Number(r.total) > 0).map(r => canonicalPayee(r.account))
    expect(owed, "'seller:null' 이 받을 사람으로 집계되면 계좌 없는 유령 payout 이 된다").toEqual([null])
  })
})

describe('순수 규칙', () => {
  it('구매 적립 목적지 — 매장이면 escrow(수수료 미인식), 없으면 수익(수수료 인식)', () => {
    expect(purchaseCreditAccount(14)).toEqual({ account: 'platform:escrow', carriesFee: false })
    expect(purchaseCreditAccount('14')).toEqual({ account: 'platform:escrow', carriesFee: false })
    for (const v of [null, undefined, 0, '', 'abc', NaN, -1]) {
      expect(purchaseCreditAccount(v as never), `${String(v)} 이 escrow 로 갔다`).toEqual({
        account: 'platform:revenue', carriesFee: true,
      })
    }
  })

  it('merchant 와 seller 는 같은 payee, 그 외 접두어는 각자', () => {
    expect(payeeKey(canonicalPayee('merchant:14')!)).toBe('seller:14')
    expect(payeeKey(canonicalPayee('seller:14')!)).toBe('seller:14')
    expect(payeeKey(canonicalPayee('agency:2')!)).toBe('agency:2')
    expect(payeeKey(canonicalPayee('user:7')!)).toBe('user:7')
    // 지급 대상이 아닌 것들
    for (const a of ['platform:escrow', 'platform:revenue', 'userdeal:9', 'seller:', ':14', 'seller', '', null]) {
      expect(canonicalPayee(a as never), `${String(a)} 가 지급 대상으로 샜다`).toBeNull()
    }
  })

  it('payee_type 은 셀러 역할에서 나온다 — 매장 라벨이 살아야 주간 경보가 돈다', () => {
    expect(payoutPayeeType('seller', 'store_owner')).toBe('store_owner')
    expect(payoutPayeeType('seller', 'both'), '겸업도 매장이다').toBe('store_owner')
    expect(payoutPayeeType('seller', 'influencer')).toBe('seller')
    // 모르면 매장이라고 하지 않는다 — 라벨이 틀리면 이중레일 경보가 오보를 낸다.
    for (const v of [null, undefined, '', 'nonsense']) {
      expect(payoutPayeeType('seller', v as never), `${String(v)} 를 매장으로 읽었다`).toBe('seller')
    }
    // 셀러가 아닌 payee 는 역할과 무관하다.
    expect(payoutPayeeType('agency', 'store_owner')).toBe('agency')
    expect(payoutPayeeType('user', 'store_owner')).toBe('user')
  })

  it('payouts 쪽도 같은 규칙으로 접힌다', () => {
    expect(payeeKey(canonicalPaidPayee('store_owner', '14')!)).toBe('seller:14')
    expect(payeeKey(canonicalPaidPayee('seller', 14)!)).toBe('seller:14')
    expect(canonicalPaidPayee('store_owner', 'null')).toBeNull()
    expect(canonicalPaidPayee('something', '14')).toBeNull()
  })
})

describe('배선 — 세 구매 자리와 집계 셋이 같은 SSOT 를 쓴다', () => {
  const GB = stripComments(readCode('src/features/group-buy/api/group-buy.routes.ts'))
  const CART = stripComments(readCode('src/features/group-buy/api/cart-checkout.routes.ts'))
  const CRON = stripComments(readCode('src/worker/cron/payouts-generate.ts'))
  const ADMIN = stripComments(readCode('src/features/admin/api/admin-payouts.routes.ts'))

  it('구매 적립 세 자리가 purchaseCreditAccount 의 결과를 credit 한다', () => {
    // 🩸 `toContain('purchaseCreditAccount')` 로는 **import 줄 때문에** 본문을 되돌려도 통과한다.
    //    그래서 `credit_account:` 에 무엇이 들어가는지를 본다.
    expect((GB.match(/credit_account: purchaseCredit\.account/g) ?? []).length,
      'group-buy 의 구매 적립 두 자리(딜·카드)가 escrow 로 안 간다').toBe(2)
    expect((CART.match(/credit_account: purchaseCredit\.account/g) ?? []).length,
      '장바구니 구매 적립이 escrow 로 안 간다').toBe(1)
    // 구매 적립이 매장 계정으로 돌아가면 이중지급이 되살아난다.
    expect(stripImports(GB)).not.toMatch(/credit_account: sellerLedgerAccount\(/)
    expect(stripImports(CART)).not.toMatch(/credit_account: sellerLedgerAccount\(/)
  })

  it('수수료는 매장 상품 구매 시점에 인식하지 않는다 (사용 시점 세 번째 분개가 인식한다)', () => {
    for (const [name, src] of [['group-buy', GB], ['cart', CART]] as const) {
      expect(src, `${name}: fee_amount 가 구매 시점에 무조건 실린다 — escrow 가 총액이 아니게 된다`)
        .toMatch(/fee_amount: purchaseCredit\.carriesFee \? commissionAmount : 0/)
    }
  })

  it('차감(인플 커미션·중개사 몫)은 여전히 seller:N 으로 간다 — 접기가 그걸 전제한다', () => {
    expect((GB.match(/debit_account: (influencerActive \? )?sellerLedgerAccount\(/g) ?? []).length)
      .toBeGreaterThanOrEqual(2)
  })

  it('cron 이 SSOT 집계 문장을 쓴다 (인라인 SQL 로 돌아가면 가드가 의미를 못 본다)', () => {
    expect(CRON).toMatch(/DB\.prepare\(payoutCreditsSql\(hold\.sql\)\)/)
    expect(CRON).toMatch(/DB\.prepare\(payoutPaidSql\(\)\)/)
    expect(CRON, '계정 문자열로 다시 GROUP BY 하면 한 가게에 payout 이 둘 생긴다')
      .not.toMatch(/GROUP BY credit_account/)
  })

  it('payee_type 결정을 두 곳이 같은 함수에 위임한다 (각자 하드코딩하면 갈린다)', () => {
    // 🩸 처음엔 "접두어 삼항이 없는가" 만 봤는데, **다른 모양의 하드코딩**
    //    (`payee.kind === 'seller' ? 'store_owner' : …`)을 주입해도 통과했다 — 주입 러너가 잡았다.
    //    ⇒ 판정을 순수 함수로 빼고 **그 함수의 동작**을 아래 '순수 규칙' 에서 직접 잰다.
    for (const [name, src] of [['cron', CRON], ['admin', ADMIN]] as const) {
      expect((src.match(/payoutPayeeType\(/g) ?? []).length,
        `${name}: payee_type 을 스스로 정하고 있다 — SSOT 에 위임해야 두 경로가 안 갈린다`).toBeGreaterThanOrEqual(2)
      expect(src, `${name}: 접두어로 payee_type 을 정하면 같은 가게가 두 payee 가 된다`)
        .not.toMatch(/'store_owner' : /)
    }
  })

  it('어드민 집계 둘도 같은 조각을 쓴다 (화면과 생성분이 갈리면 없는 돈을 승인한다)', () => {
    expect((ADMIN.match(/canonicalPayeeSql\(/g) ?? []).length,
      '표시용·수동생성 두 집계 모두 정규화해야 한다(credit·debit 각 2 = 4)').toBe(4)
    expect((ADMIN.match(/canonicalPaidPayeeSql\(/g) ?? []).length).toBe(2)
    expect(ADMIN).not.toMatch(/GROUP BY payee_type, payee_id/)
  })

  it('어드민 수동 생성이 cron 과 같은 net 공식을 쓴다 (credit-only 면 과다지급)', () => {
    expect(ADMIN, '수수료를 안 빼면 gross 를 지급한다').toMatch(/SUM\(amount - COALESCE\(fee_amount, 0\)\) as total/)
    expect(ADMIN, '차감(debits)을 안 빼면 환불 역전·커미션이 사라진다').toMatch(/debits AS \(/)
  })
})
