/**
 * 💸 **"이 가게 아직 받을 돈 있나" 를 묻는 헬퍼가 매장 돈을 못 보고 있었다** (2026-10-01)
 *
 * ■ 무엇이 깨져 있었나
 *   #1591(`aed1694ca`)이 이용권 이중적립을 고치면서 **구매 적립을 `platform:escrow` 로** 보냈다.
 *   그 뒤로 매장 돈은 **사용 시점에 `merchant:N` 으로만** 쌓인다(`recordVoucherUsedLedger` 분개 ①).
 *
 *   접기(`canonicalPayeeSql`)는 **집계 SQL 셋**에만 들어갔고, **계정 하나를 묻는 헬퍼** 셋
 *   (`getLedgerReceivable`·`getUnsettledBalance`·`getPayablePending`)은 못 배웠다 —
 *   그 헬퍼들은 `WHERE credit_account = ?` 로 **정확히 일치**를 본다.
 *   ⇒ `seller:N` 만 묻는 **여섯 자리가 0 을 읽는다.** 그중 셋이 가드다:
 *
 *   | 자리 | 샌 것 |
 *   |---|---|
 *   | `store-handover-guard` | 못 받은 돈을 남긴 채 **매장이 넘어간다** |
 *   | `seller-withdraw.routes` | 못 받은 돈을 남긴 채 **매장이 탈퇴한다** |
 *   | `admin-payouts` 승인 가드 | 승인 상한이 0 |
 *   | 셀러 정산·출금 화면 | 사장님에게 **₩0** |
 *
 *   fail-closed 로 **설계된** 가드가 fail-open 이 된다 — 돈이 *안 보여서* 0 이기 때문이다.
 *   에러도 로그도 없다.
 *
 * ■ 같은 함수 안의 두 번째 결함 (방향이 반대라 서로 가렸다)
 *   `getUnsettledBalance` 의 배정분 뺄셈이 `(payee_type||':'||payee_id) = 'seller:N'` 인데
 *   `payoutPayeeType` 은 매장 사장님 payout 에 **`store_owner`** 를 박는다 ⇒ 그 행이 **안 빠져**
 *   미배정 잔액이 **과대**로 읽힌다(마감해도 손바뀜이 계속 막히는 막다른 길).
 *
 * ■ 어떻게 재나 — **실제 함수**를 실제 sqlite 에 돌린다
 *   SQL 을 여기 베끼면 두 벌이 갈려 시험이 의미를 잃는다(2026-10-01 `promo-ledger-fee-real-rows`
 *   가 같은 이유로 생겼다). D1 모양만 얇게 흉내 내고 **`ledger.ts` 의 그 함수**를 부른다.
 *
 * ■ 못 보는 것
 *   - 라이브 payout 생성 경로 전체(그건 S-VC3 실결제의 몫) · 동시성 · 환불 역전 타이밍.
 *   - `agency:`·`user:` payee 는 접을 짝이 없어 "변하지 않는다" 만 고정한다.
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import { getLedgerReceivable, getUnsettledBalance, getPayablePending } from '@/worker/utils/ledger'
import { ledgerAccountAliases, paidPayeeAliases, payoutPayeeType } from '@/worker/utils/payout-account'

// 기본 환경이 jsdom 이라 `node:sqlite` 정적 import 는 번들러가 막는다(기존 SQLite 시험과 같은 방식).
const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')

type Entry = { amount: number; debit: string; credit: string; fee?: number }
type Payout = { payee_type: string; payee_id: string; amount: number; status: string }

/** 라이브 `sqlite_master` 모양. 컬럼이 바뀌면 여기서 먼저 깨진다. */
const DDL = `
CREATE TABLE ledger_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL, reference_id TEXT NOT NULL, amount INTEGER NOT NULL,
  debit_account TEXT NOT NULL, credit_account TEXT NOT NULL,
  fee_amount INTEGER DEFAULT 0, fee_account TEXT, metadata TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payee_type TEXT NOT NULL, payee_id TEXT NOT NULL,
  amount INTEGER NOT NULL, status TEXT NOT NULL
);`

/** `D1Database` 중 이 세 헬퍼가 실제로 쓰는 표면만. 더 흉내 내면 흉내가 진실이 된다. */
function fakeD1(entries: Entry[], payouts: Payout[] = []) {
  const db = new DatabaseSync(':memory:')
  db.exec(DDL)
  const ins = db.prepare(
    `INSERT INTO ledger_entries (event_type, reference_id, amount, debit_account, credit_account, fee_amount)
     VALUES ('voucher_used', 'ref', ?, ?, ?, ?)`)
  for (const e of entries) ins.run(e.amount, e.debit, e.credit, e.fee ?? 0)
  const insP = db.prepare(`INSERT INTO payouts (payee_type, payee_id, amount, status) VALUES (?, ?, ?, ?)`)
  for (const p of payouts) insP.run(p.payee_type, p.payee_id, p.amount, p.status)

  const run = (sql: string, binds: unknown[]) => {
    // `ensureLedgerTable` 의 DDL 은 이미 위에서 만들었으므로 조용히 넘긴다.
    if (/^\s*CREATE\s/i.test(sql)) return { results: [] }
    return { results: db.prepare(sql).all(...(binds as never[])) }
  }
  return {
    prepare(sql: string) {
      const self = { _b: [] as unknown[],
        bind(...b: unknown[]) { self._b = b; return self },
        async first<T>() { return (run(sql, self._b).results[0] ?? null) as T },
        async all<T>() { return { results: run(sql, self._b).results as T[] } },
        async run() { run(sql, self._b); return { meta: { changes: 0 } } },
      }
      return self
    },
  } as unknown as D1Database
}

/**
 * 🏪 **#1591 이후의 실제 모양** — 매장 상품 이용권 1,000원을 팔고 손님이 썼다.
 * 구매는 escrow 로 들어가고(매장 계정에 **안 찍힌다**), 사용 시점 3분개가 꺼낸다.
 */
const STORE_SOLD_AND_USED: Entry[] = [
  { amount: 1000, debit: 'user:3', credit: 'platform:escrow' },   // 구매(#1591: escrow, fee 0)
  { amount: 900, debit: 'platform:escrow', credit: 'merchant:14' }, // 사용 ① 매장 몫
  { amount: 100, debit: 'platform:escrow', credit: 'platform:revenue' }, // 사용 ③ 플랫폼 수수료
]

describe('① 접기 규칙 (SSOT)', () => {
  it('`seller:N` 은 원장에서 `merchant:N` 과 한 payee 다', () => {
    expect(ledgerAccountAliases('seller:14')).toEqual(['seller:14', 'merchant:14'])
  })
  it('`seller:N` 은 payouts 에서 `store_owner:N` 과 한 payee 다', () => {
    expect(paidPayeeAliases('seller:14')).toEqual(['seller:14', 'store_owner:14'])
  })
  it('접을 짝이 없는 계정은 그대로 — agency·user·platform', () => {
    for (const a of ['agency:7', 'user:3', 'platform:revenue', 'platform:escrow']) {
      expect(ledgerAccountAliases(a)).toEqual([a])
      expect(paidPayeeAliases(a)).toEqual([a])
    }
  })
  it('id 가 숫자가 아니면 접지 않는다 — `seller:null` 오염을 넓히지 않는다', () => {
    expect(ledgerAccountAliases('seller:null')).toEqual(['seller:null'])
    expect(ledgerAccountAliases('seller:')).toEqual(['seller:'])
  })
  it('🔗 payouts 별칭이 `payoutPayeeType` 이 낼 수 있는 **모든** 라벨을 덮는다', () => {
    // 라벨과 별칭은 **짝**이다 — 한쪽에만 라벨이 늘거나 철자가 틀리면 그 payout 이 안 빠진다.
    // ⚠️ 하나만 보면 안 된다: `payoutPayeeType` 이 셀러 종류에 따라 두 라벨을 낸다.
    //    (라벨 규칙 자체의 회귀는 `voucher-credit-single-rail` 이 소유한다 — 여기서는 *덮는가* 만 본다.)
    const aliases = paidPayeeAliases('seller:14')
    const labels = new Set(
      (['store_owner', 'influencer', 'both', null, undefined, ''] as const)
        .map((t) => payoutPayeeType('seller', t as never)),
    )
    expect(labels.size, '셀러 라벨이 하나로 줄었다면 이 시험의 전제가 바뀐 것이다').toBeGreaterThan(1)
    for (const l of labels) expect(aliases, `라벨 ${l} 를 덮지 않는다`).toContain(`${l}:14`)
  })
})

describe('② 매장이 받을 돈이 보인다 (fail-open 수리)', () => {
  it('🔴 사용 적립이 `merchant:N` 에만 있어도 `seller:N` 질의가 그 돈을 센다', async () => {
    const DB = fakeD1(STORE_SOLD_AND_USED)
    expect(await getLedgerReceivable(DB, 'seller:14')).toBe(900)
  })

  it('가드가 보는 미배정 잔액도 같다 — 0 이 아니다(= 손바뀜·탈퇴가 막힌다)', async () => {
    const DB = fakeD1(STORE_SOLD_AND_USED)
    expect(await getUnsettledBalance(DB, 'seller:14')).toBe(900)
  })

  it('`seller:N` 차감(인플루언서 커미션)이 `merchant:N` 적립에서 빠진다 — 불변식 ①', async () => {
    const DB = fakeD1([...STORE_SOLD_AND_USED,
      { amount: 20, debit: 'seller:14', credit: 'influencer:37' }])
    expect(await getLedgerReceivable(DB, 'seller:14')).toBe(880)
  })

  it('수수료(`fee_amount`)는 payee 몫에서 빠진다 — 순액 공식 불변', async () => {
    const DB = fakeD1([{ amount: 1000, debit: 'user:3', credit: 'merchant:14', fee: 50 }])
    expect(await getLedgerReceivable(DB, 'seller:14')).toBe(950)
  })
})

describe('③ 배정분 뺄셈이 `store_owner` payout 을 본다 (과대보고 수리)', () => {
  it('🔴 `store_owner:14` 로 생성된 payout 이 미배정 잔액에서 빠진다', async () => {
    const DB = fakeD1(STORE_SOLD_AND_USED,
      [{ payee_type: 'store_owner', payee_id: '14', amount: 900, status: 'pending' }])
    // 900 적립 − 900 배정 = 0 ⇒ "새 주인에게 흘러갈 돈 없음" ⇒ 손바뀜 통과
    expect(await getUnsettledBalance(DB, 'seller:14')).toBe(0)
  })

  it('`seller:14` 로 적힌 payout 도 그대로 빠진다(라벨 둘 다 수용)', async () => {
    const DB = fakeD1(STORE_SOLD_AND_USED,
      [{ payee_type: 'seller', payee_id: '14', amount: 400, status: 'approved' }])
    expect(await getUnsettledBalance(DB, 'seller:14')).toBe(500)
  })

  it('`getPayablePending` 은 `pending` 을 빼지 않는다 — 두 함수의 차이는 유지된다', async () => {
    const payouts: Payout[] = [
      { payee_type: 'store_owner', payee_id: '14', amount: 300, status: 'pending' },
      { payee_type: 'store_owner', payee_id: '14', amount: 200, status: 'sent' },
    ]
    const DB = fakeD1(STORE_SOLD_AND_USED, payouts)
    expect(await getPayablePending(DB, 'seller:14')).toBe(700)   // 900 − 200(sent)
    expect(await getUnsettledBalance(DB, 'seller:14')).toBe(400) // 900 − 500(pending+sent)
  })

  it('다른 가게의 payout 은 안 빠진다(id 가 섞이지 않는다)', async () => {
    const DB = fakeD1(STORE_SOLD_AND_USED,
      [{ payee_type: 'store_owner', payee_id: '15', amount: 900, status: 'pending' }])
    expect(await getUnsettledBalance(DB, 'seller:14')).toBe(900)
  })
})

describe('④ 접지 않는 payee 는 동작이 변하지 않는다', () => {
  it('`agency:N` 은 종전 그대로', async () => {
    const DB = fakeD1([{ amount: 500, debit: 'platform:revenue', credit: 'agency:7' }],
      [{ payee_type: 'agency', payee_id: '7', amount: 200, status: 'sent' }])
    expect(await getLedgerReceivable(DB, 'agency:7')).toBe(500)
    expect(await getUnsettledBalance(DB, 'agency:7')).toBe(300)
  })

  it('`merchant:N` 을 직접 물으면 그 계정만 — 접기는 canonical 쪽에서만 일어난다', async () => {
    const DB = fakeD1(STORE_SOLD_AND_USED)
    expect(await getLedgerReceivable(DB, 'merchant:14')).toBe(900)
  })

  it('가게에 아무 적립이 없으면 0 (거짓 양성 없음)', async () => {
    const DB = fakeD1([{ amount: 1000, debit: 'user:3', credit: 'platform:escrow' }])
    expect(await getLedgerReceivable(DB, 'seller:14')).toBe(0)
    expect(await getUnsettledBalance(DB, 'seller:14')).toBe(0)
  })
})

describe('⑤ 시험이 헛돌지 않는다', () => {
  it('접기를 끄면 이 픽스처가 실제로 0 을 낸다 — 즉 ②가 뭔가를 지키고 있다', async () => {
    // 종전 동작을 그대로 재현(정확히 일치 1개)해서, 수리 전이라면 0 이었음을 고정한다.
    const DB = fakeD1(STORE_SOLD_AND_USED)
    const before = await getLedgerReceivable(DB, 'seller:99') // 적립 없는 계정 = 수리 전 `seller:14` 와 같은 상황
    expect(before).toBe(0)
    expect(await getLedgerReceivable(DB, 'seller:14')).not.toBe(before)
  })
})
