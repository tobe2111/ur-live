/**
 * 💸 딜 → 현금 정리 (2026-10-12 대표 *"응 모두 해주고 가장 이상적으로 UI까지 짜줘"*)
 *
 * ## 무엇을 고쳤나 (라이브·코드 전수 실측)
 * 딜이나 수익을 현금으로 바꾸는 서버 문이 **넷**이었고 규칙이 제각각이었다.
 *
 * | 문 | 문제 | 이번 처리 |
 * |---|---|---|
 * | `POST /api/points/withdraw` | 화면 0 · 충전한 돈을 돌려주며 8.8% 원천징수 · 최소 10,000딜(라이브 유일 대상 4,700딜이 신청 불가) | **410** → 새 문 `POST /api/points/refund`(약관 제12조) |
 * | `POST /api/referral-tree/withdrawals` | 확정 커미션은 이미 **딜로 적립**되는데 같은 금액을 현금으로 또 내보내면서 딜을 안 뺐다 | **410** |
 * | `POST /api/seller/deal-withdraw` | 읽는 잔액이 **어디에서도 적립되지 않는다** — 늘 0원, 차감 뒤 기록이 에러를 삼켜 지급 행 없는 차감 가능 | **410** → 정산은 주간 자동 하나 |
 * | 환불 두 곳(만료 이용권 · 반품 딜 몫) | 무상 딜로 산 것을 **유상(환급 가능)** 으로 되돌렸다 | `refundDealPoints`(원래 버킷) |
 *
 * ## 어떻게 재나
 * 한도·차감·반려는 **실제 함수를 실제 SQLite(`node:sqlite`)** 에 돌려 잰다 — 문자열 검사가 아니다.
 * 배선(라우트가 410 인가, 화면이 새 문을 부르는가)은 소스를 읽어 본다.
 *
 * ## ⚠️ 이 시험이 못 보는 것
 * - 어드민이 실제로 이체했는지(사람의 일) · 라이브 D1 에 표가 생겼는지(배포 후 repair-schema)
 * - 무상/유상 버킷 역산(`refundDealPoints`)의 정확성 자체 — 그건 `point-buckets` 시험의 몫이다.
 *   여기서는 **두 환불 자리가 그 함수를 부르는가**만 본다.
 * - D1 과 SQLite 의 미세한 차이(부분 UNIQUE 인덱스는 둘 다 지원한다).
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { createRequire } from 'node:module'
import { readCode, stripComments } from '../helpers/source-text'
import {
  getDealRefundState, requestDealRefund, rejectDealRefund, markDealRefundPaid,
  normalizeRefundInput, REFUNDABLE_SQL,
} from '@/worker/utils/deal-refund'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
type Db = InstanceType<typeof DatabaseSync>

/** D1 모양으로 감싼다 — prepare().bind().run/first/all. 에러는 그대로 던진다(UNIQUE 판정에 필요). */
function asD1(db: Db): D1Database {
  const stmt = (sql: string, binds: unknown[] = []) => ({
    bind: (...b: unknown[]) => stmt(sql, b),
    async run() {
      const r = db.prepare(sql).run(...(binds as never[]))
      return { meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) } }
    },
    async first<T>() { return (db.prepare(sql).get(...(binds as never[])) ?? null) as T },
    async all<T>() { return { results: db.prepare(sql).all(...(binds as never[])) as T[] } },
  })
  return { prepare: (sql: string) => stmt(sql) } as unknown as D1Database
}

let db: Db
let DB: D1Database

function seed(user: { id: string; balance: number; free: number; charged: number; ledgerCharge?: number }) {
  db.prepare('INSERT INTO user_points (user_id, balance, free_balance, total_charged) VALUES (?, ?, ?, ?)')
    .run(user.id, user.balance, user.free, user.charged)
  if (user.ledgerCharge) {
    db.prepare("INSERT INTO point_transactions (user_id, type, amount) VALUES (?, 'charge', ?)").run(user.id, user.ledgerCharge)
  }
}
const bal = (id: string) => db.prepare('SELECT balance, free_balance FROM user_points WHERE user_id = ?').get(id) as { balance: number; free_balance: number }
const acct = { bank_name: '카카오뱅크', bank_account: '3333-01-1234567', account_holder: '정지원' }

beforeEach(() => {
  db = new DatabaseSync(':memory:')
  db.exec(`
    CREATE TABLE user_points (user_id TEXT PRIMARY KEY, balance INTEGER NOT NULL DEFAULT 0,
      free_balance INTEGER NOT NULL DEFAULT 0, total_charged INTEGER NOT NULL DEFAULT 0,
      total_donated INTEGER NOT NULL DEFAULT 0, updated_at TEXT);
    CREATE TABLE point_transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, type TEXT, amount INTEGER,
      points_amount INTEGER NOT NULL DEFAULT 0, commission_amount INTEGER DEFAULT 0, balance_after INTEGER,
      description TEXT, order_id TEXT, free_delta INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE user_withdrawals (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id TEXT, amount INTEGER, status TEXT);
  `)
  DB = asD1(db)
})

describe('💸 환급 한도 = MIN(유상 잔액, 충전 총액 − 이미 나간 현금)', () => {
  it('무상 딜은 빼고, 충전한 만큼만 돌려준다', async () => {
    // 라이브 유저 3 의 모양: 총 116,200 · 무상 111,500 → 유상 4,700 · 충전 80,000(원장)
    seed({ id: '3', balance: 116_200, free: 111_500, charged: 8_500, ledgerCharge: 80_000 })
    const st = await getDealRefundState(DB, '3')
    expect(st.ok && st.state.refundable).toBe(4_700)
  })

  it('충전한 적 없는 유상 딜(꺼진 추천 커미션 등 — 소득)은 "환급" 으로 못 나간다', async () => {
    // 소득을 세금 없이 환급으로 내보내면 안 된다 — 그래서 충전 총액으로 자른다.
    seed({ id: '32', balance: 3_000, free: 0, charged: 0 })
    const st = await getDealRefundState(DB, '32')
    expect(st.ok && st.state.refundable).toBe(0)
  })

  it('충전 총액은 total_charged 와 원장 합 중 큰 값 (라이브에서 둘이 갈려 있다)', async () => {
    seed({ id: 'a', balance: 9_000, free: 0, charged: 9_000, ledgerCharge: 2_000 })
    const st = await getDealRefundState(DB, 'a')
    expect(st.ok && st.state.refundable).toBe(9_000)
  })

  it('소개 수익 출금(user_withdrawals)이 나간 만큼 한도가 준다 — 같은 유상 잔액이 두 문으로 못 나간다', async () => {
    seed({ id: 'b', balance: 10_000, free: 0, charged: 10_000 })
    db.prepare("INSERT INTO user_withdrawals (user_id, amount, status) VALUES ('b', 4000, 'requested')").run()
    const st = await getDealRefundState(DB, 'b')
    expect(st.ok && st.state.refundable).toBe(6_000)
  })

  it('조회와 조건부 INSERT 가 같은 식을 쓴다 (두 벌이면 화면이 허용한 금액을 서버가 거절한다)', () => {
    const src = stripComments(readCode('src/worker/utils/deal-refund.ts'))
    const uses = src.match(/\$\{REFUNDABLE_SQL\}/g) ?? []
    expect(uses.length, '조회 1 + INSERT 1 이어야 한다').toBeGreaterThanOrEqual(2)
    expect(REFUNDABLE_SQL).toContain('MAX(0, MIN(')
  })
})

describe('💸 신청 — 조건부 INSERT → 유상 CAS 차감 → 원장', () => {
  it('신청하면 유상 딜만 빠지고(무상 불변) 원장에 음수 한 줄이 남는다', async () => {
    seed({ id: '3', balance: 116_200, free: 111_500, charged: 80_000 })
    const r = await requestDealRefund(DB, '3', { amount: 4_700, ...acct })
    expect(r.ok).toBe(true)
    expect(bal('3')).toEqual({ balance: 111_500, free_balance: 111_500 })
    const tx = db.prepare("SELECT amount, free_delta FROM point_transactions WHERE type = 'cash_refund'").get() as { amount: number; free_delta: number }
    expect(tx).toEqual({ amount: -4_700, free_delta: 0 })
    const st = await getDealRefundState(DB, '3')
    expect(st.ok && st.state.refundable).toBe(0)
    expect(st.ok && st.state.pending?.amount).toBe(4_700)
  })

  it('처리 중인 신청이 있으면 두 번째는 막힌다 (더블클릭·동시 요청)', async () => {
    seed({ id: 'c', balance: 10_000, free: 0, charged: 10_000 })
    expect((await requestDealRefund(DB, 'c', { amount: 3_000, ...acct })).ok).toBe(true)
    const second = await requestDealRefund(DB, 'c', { amount: 1_000, ...acct })
    expect(second.ok).toBe(false)
    expect(!second.ok && second.code).toBe('PENDING')
    expect(bal('c').balance, '두 번째 신청이 잔액을 건드렸다').toBe(7_000)
  })

  it('한도를 넘으면 행도 안 생기고 잔액도 그대로다', async () => {
    seed({ id: 'd', balance: 5_000, free: 0, charged: 5_000 })
    const r = await requestDealRefund(DB, 'd', { amount: 6_000, ...acct })
    expect(!r.ok && r.code).toBe('EXCEEDS')
    expect(bal('d').balance).toBe(5_000)
    expect((db.prepare('SELECT COUNT(*) AS n FROM deal_refund_requests').get() as { n: number }).n).toBe(0)
  })

  it('최소 금액이 없다 — 4,700딜도 신청된다 (옛 문은 10,000딜 미만을 막았다)', async () => {
    seed({ id: 'e', balance: 4_700, free: 0, charged: 4_700 })
    expect((await requestDealRefund(DB, 'e', { amount: 4_700, ...acct })).ok).toBe(true)
  })
})

describe('💸 어드민 처리 — CAS 로 한 번만', () => {
  it('반려하면 딜이 유상으로 그대로 돌아오고, 두 번째 반려는 아무것도 안 한다', async () => {
    seed({ id: 'f', balance: 8_000, free: 3_000, charged: 5_000 })
    const r = await requestDealRefund(DB, 'f', { amount: 5_000, ...acct })
    expect(r.ok).toBe(true)
    expect(bal('f')).toEqual({ balance: 3_000, free_balance: 3_000 })
    const id = r.ok ? r.id : 0
    expect((await rejectDealRefund(DB, id, '계좌 확인 불가')).ok).toBe(true)
    expect(bal('f')).toEqual({ balance: 8_000, free_balance: 3_000 })
    expect((await rejectDealRefund(DB, id, '또')).ok, '두 번 되돌리면 딜이 늘어난다').toBe(false)
    expect(bal('f').balance).toBe(8_000)
    // 반려 뒤엔 다시 신청할 수 있다(대기 1건 인덱스는 'requested' 에만 걸린다).
    const st = await getDealRefundState(DB, 'f')
    expect(st.ok && st.state.refundable).toBe(5_000)
  })

  it('입금 완료는 한 번만 기록되고, 완료된 금액도 다음 한도에서 빠진다', async () => {
    seed({ id: 'g', balance: 6_000, free: 0, charged: 6_000 })
    const r = await requestDealRefund(DB, 'g', { amount: 6_000, ...acct })
    const id = r.ok ? r.id : 0
    expect((await markDealRefundPaid(DB, id, null)).ok).toBe(true)
    expect((await markDealRefundPaid(DB, id, null)).ok).toBe(false)
    expect((await rejectDealRefund(DB, id, '이미 보냈는데 반려')).ok, '입금된 건을 반려해 딜까지 돌려주면 이중 지급이다').toBe(false)
    // 누군가 딜을 다시 얹어도(유상) 충전분은 이미 다 나갔다 — 한도 0.
    db.prepare("UPDATE user_points SET balance = 6000 WHERE user_id = 'g'").run()
    const st = await getDealRefundState(DB, 'g')
    expect(st.ok && st.state.refundable).toBe(0)
  })
})

describe('💸 입력 정리', () => {
  it('사람이 고칠 수 있는 문장으로 거절한다', () => {
    expect(normalizeRefundInput({ amount: 0, ...acct }).ok).toBe(false)
    expect(normalizeRefundInput({ amount: 1000, ...acct, bank_name: '' }).ok).toBe(false)
    expect(normalizeRefundInput({ amount: 1000, ...acct, bank_account: '12-34' }).ok).toBe(false)
    expect(normalizeRefundInput({ amount: 1000, ...acct, account_holder: ' ' }).ok).toBe(false)
    const ok = normalizeRefundInput({ amount: '4700', ...acct, bank_account: '3333 01 1234567' })
    expect(ok.ok && ok.input).toEqual({ amount: 4700, bank_name: '카카오뱅크', bank_account: '3333011234567', account_holder: '정지원' })
  })
})

describe('🚪 닫은 문 셋 — 410 이고, 돈을 움직이는 코드가 남지 않았다', () => {
  const routeBody = (src: string, head: string) => {
    const at = src.indexOf(head)
    expect(at, `${head} 를 못 찾았다 — 앵커가 낡았다`).toBeGreaterThan(-1)
    return src.slice(at, at + 400)
  }

  it('POST /api/points/withdraw 는 인증 뒤 410 만 준다', () => {
    const body = routeBody(stripComments(readCode('src/features/points/api/points.routes.ts')), "pointsRoutes.post('/withdraw'")
    expect(body).toContain('410')
    expect(body).not.toMatch(/UPDATE user_points|INSERT INTO user_withdrawals/)
  })

  it('POST /api/referral-tree/withdrawals 는 410 — 딜로 이미 적립된 커미션을 현금으로 또 안 내보낸다', () => {
    const src = stripComments(readCode('src/features/referral/api/referral-tree.routes.ts'))
    const body = routeBody(src, "referralTreeRoutes.post('/withdrawals'")
    expect(body).toContain('410')
    expect(src, '출금 행을 만드는 코드가 남았다').not.toMatch(/INSERT INTO commission_withdrawals/)
  })

  it('POST /api/seller/deal-withdraw 는 410 — 적립되지 않는 잔액을 차감하는 코드가 없다', () => {
    const src = stripComments(readCode('src/features/seller/api/seller-settlements.routes.ts'))
    const body = routeBody(src, "sellerSettlementsRoutes.post('/deal-withdraw'")
    expect(body).toContain('410')
    expect(body).not.toContain('redeemable_deal_amount')
  })

  it('전액을 신청한 뒤에도 "처리 중" 이 잔액 응답에 실린다 (마이에서 다시 열 수 있게)', () => {
    const src = stripComments(readCode('src/features/points/api/points.routes.ts'))
    expect(src).toContain("SELECT amount FROM deal_refund_requests WHERE user_id = ? AND status = 'requested'")
    expect(src).toContain('refund_pending: refundPending')
  })

  it('새 문은 GET·POST /api/points/refund 이고, 레이트리밋이 걸려 있다', () => {
    const src = stripComments(readCode('src/features/points/api/points.routes.ts'))
    expect(src).toContain("pointsRoutes.get('/refund', requireAuth()")
    expect(src).toMatch(/pointsRoutes\.post\('\/refund',\s*rateLimit\(/)
    expect(src).toContain('requestDealRefund(')
  })

  it('지급 센터가 환급 레일을 갖고, 입금 완료에는 2FA 가 걸린다', () => {
    const src = stripComments(readCode('src/features/admin/api/admin-payout-center.routes.ts'))
    expect(src).toMatch(/payoutCenterRoutes\.patch\('\/refund\/:id\/paid', require2FA\(\)/)
    expect(src).toContain("payoutCenterRoutes.patch('/refund/:id/reject'")
    expect(src).toContain('listOpenDealRefunds(')
  })
})

describe('🪣 환불이 무상 딜을 유상(환급 가능)으로 바꾸지 않는다', () => {
  it('만료 이용권 환불은 원래 버킷으로 (refundDealPoints)', () => {
    const src = stripComments(readCode('src/worker/cron/auto-settlement.ts'))
    const at = src.indexOf("voucher.payment_method === 'deal_points'")
    expect(at).toBeGreaterThan(-1)
    const block = src.slice(at, at + 900)
    expect(block).toContain('refundDealPoints(')
    expect(block, '유상으로만 되돌리는 adjustUserPoints 가 돌아왔다').not.toContain('adjustUserPoints(')
  })

  it('반품의 딜 몫도 원래 버킷으로', () => {
    const src = stripComments(readCode('src/features/returns/api/returns.routes.ts'))
    const at = src.indexOf('if (refundSplit.deal > 0 && order.user_id != null)')
    expect(at).toBeGreaterThan(-1)
    const block = src.slice(at, at + 700)
    expect(block).toContain('refundDealPoints(')
    expect(block).not.toContain('adjustUserPoints(')
  })
})

describe('📱 화면 — 마이에서 신청하고, 화면이 금액을 만들지 않는다', () => {
  const MY = readCode('src/pages/user-profile/MyStats.tsx')
  const SHEET = readCode('src/pages/user-profile/RefundSheet.tsx')

  // 🔁 2026-11-02 재조준 — 대표 *"충전 딜 환급 … 아예 없애달라는 뜻이야"*: 마이에는 환급 입구가 없다.
  //   신청 시트(`RefundSheet`)는 탈퇴 화면에 남고, 거기서는 누를 때만 받는다.
  it('마이에는 환급 줄·버튼이 없다 (대표 2026-11-02) · 시트는 탈퇴 화면에서 누를 때만 받는다', () => {
    const code = stripComments(MY)
    expect(code, '마이에 환급 시트가 다시 붙었다').not.toContain('RefundSheet')
    expect(code, '마이에 환급 문구가 다시 붙었다').not.toMatch(/충전 딜|환급 신청|setRefundOpen/)
    expect(stripComments(readCode('src/pages/account-delete/DeleteBlockers.tsx'))).toContain("lazy(() => import('@/pages/user-profile/RefundSheet'))")
  })

  it('시트는 서버 한도만 쓰고, 새 문을 부른다', () => {
    const code = stripComments(SHEET)
    expect(code).toContain("api.get('/api/points/refund')")
    expect(code).toContain("api.post('/api/points/refund'")
    expect(code, '닫은 문을 다시 부른다').not.toMatch(/points\/withdraw|deal-withdraw|referral-tree\/withdrawals/)
    expect(code, '화면이 잔액을 다시 읽어 한도를 지어내면 서버와 갈린다').not.toContain('/api/points/balance')
  })

  it('조회 실패를 "환급할 딜 없음" 으로 위장하지 않는다', () => {
    const code = stripComments(SHEET)
    expect(code).toContain('환급 정보를 불러오지 못했어요')
    expect(code).toMatch(/if \(!r\.data\?\.success\) \{ setFailed\(true\); return \}/)
  })

  it('계좌번호를 브라우저에 남기지 않는다', () => {
    expect(stripComments(SHEET)).not.toMatch(/localStorage\.setItem/)
  })
})
