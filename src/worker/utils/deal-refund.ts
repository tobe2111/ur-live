/**
 * 💸 딜 충전 잔액 환급 — 약관 제12조 (2026-10-12 대표 *"응 모두 해주고 가장 이상적으로 UI까지 짜줘"*)
 *
 * ## 무엇인가
 * 손님이 **자기 돈으로 충전하고 아직 안 쓴 딜**을 현금으로 돌려받는 길이다. 약관 제12조가
 * *"유상 충전 딜포인트의 미사용 잔액에 대해 환급을 요청할 수 있다"* 고 약속하고, 마이가
 * *"환급 가능 N딜"* 이라고 보여 주는데 **누를 곳이 없었다**(2026-10-12 실측 — 화면 0, 서버만 열린
 * `POST /api/points/withdraw` 하나). 이 파일이 그 약속의 SSOT 다.
 *
 * ## 소개 수익 출금과 왜 따로인가
 * | | 이 파일(환급) | 소개 수익 출금(`curator.routes`) |
 * |---|---|---|
 * | 돈의 성격 | 손님이 낸 돈을 **돌려준다** | 번 돈을 **지급한다**(소득) |
 * | 원천징수 | **없음** — 소득이 아니다 | 3.3% |
 * | 자격 | 충전한 사람 누구나 | 승인된 매장 주인 |
 * | 한도 | 충전한 만큼 | 번 만큼 |
 *
 * 둘을 한 문으로 두면 반드시 한쪽 규칙이 다른 쪽에 샌다 — 실제로 옛 `/points/withdraw` 는
 * **충전한 돈을 돌려주면서 8.8% 를 떼고**(소득이 아닌데), 최소 10,000딜이라 라이브 유일한 환급
 * 대상(4,700딜)이 신청조차 못 했다. 그래서 테이블도 따로 둔다(`user_withdrawals` 는
 * `CHECK (amount >= 10000)` 이 걸려 있어 작은 환급을 담을 수 없다 — 2026-10-12 스키마 실측).
 *
 * ## 한도 = MIN(유상 잔액, 충전 총액 − 이미 나간 현금)
 * - **유상 잔액**: 무상(리워드) 딜은 환급 대상이 아니다(약관 제12조 ②). `PAID_BALANCE_SQL` SSOT.
 * - **충전 총액**: 유상 잔액에는 충전 말고도 들어오는 것이 있다(꺼져 있는 추천 커미션 등 — 소득).
 *   그걸 세금 없이 "환급" 으로 내보내면 안 되므로 **충전한 만큼**으로 자른다.
 *   `user_points.total_charged` 와 원장(`type='charge'`) 합 중 **큰 값**을 쓴다 — 라이브에서 둘이
 *   갈려 있다(2026-10-12 실측: 유저 3 = 8,500 vs 80,000. `total_charged` 컬럼이 나중에 생겼다).
 *   작은 값을 쓰면 정당한 환급을 막는다(약관 위반), 큰 값을 써도 유상 잔액이 한 번 더 자른다.
 * - **이미 나간 현금**: 이 표의 대기·완료분 + 소개 수익 출금(`user_withdrawals`)까지 뺀다.
 *   후자를 빼는 것은 보수적인 쪽이다(매장 주인이 충전도 했다면 환급 한도가 그만큼 준다) —
 *   반대로 두면 같은 유상 잔액이 두 문으로 두 번 나갈 수 있다.
 *
 * ## 머니 룰
 * ① 조건부 INSERT(한도를 **넣는 순간** 다시 계산) → ② 유상 잔액 CAS 차감 → 실패하면 신청 행 삭제.
 * 대기 중 신청은 한 사람당 **하나**(부분 UNIQUE 인덱스) — 더블클릭·동시 요청이 두 줄을 못 만든다.
 * 반려는 CAS 로 선점한 뒤에만 잔액을 되돌린다(이중 복원 차단).
 */
import { ensureDealBuckets, PAID_BALANCE_SQL } from './point-buckets'
import { recordPointTransaction } from './point-ledger'

/** 한 사람이 동시에 가질 수 있는 대기 신청 상태. */
export const DEAL_REFUND_OPEN = 'requested'

const _ensured = new WeakSet<D1Database>()

/** 테이블 + 대기 1건 인덱스(멱등 · isolate 당 1회 — 핸들러 안 inline DDL 금지 룰). repair-schema 에도 등록. */
export async function ensureDealRefundTable(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  await DB.prepare(`CREATE TABLE IF NOT EXISTS deal_refund_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    bank_name TEXT NOT NULL,
    bank_account TEXT NOT NULL,
    account_holder TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','paid','rejected')),
    rejection_reason TEXT,
    admin_memo TEXT,
    requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    processed_at DATETIME
  )`).run()
  await DB.prepare(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_deal_refund_one_open ON deal_refund_requests(user_id) WHERE status = 'requested'`,
  ).run()
  _ensured.add(DB)
}

/**
 * 환급 가능액 SQL — 바인드는 **user_id 다섯 번**(`refundableBinds`).
 * 조회와 조건부 INSERT 가 **같은 식**을 쓴다(두 벌이면 화면이 허용한 금액을 서버가 거절한다).
 */
export const REFUNDABLE_SQL = `MAX(0, MIN(
  COALESCE((SELECT ${PAID_BALANCE_SQL} FROM user_points WHERE user_id = ?), 0),
  MAX(
    COALESCE((SELECT total_charged FROM user_points WHERE user_id = ?), 0),
    COALESCE((SELECT SUM(amount) FROM point_transactions WHERE user_id = ? AND type = 'charge'), 0)
  )
  - COALESCE((SELECT SUM(amount) FROM deal_refund_requests WHERE user_id = ? AND status IN ('requested','paid')), 0)
  - COALESCE((SELECT SUM(amount) FROM user_withdrawals WHERE user_id = ? AND status IN ('requested','approved','paid')), 0)
))`

export function refundableBinds(uid: string): string[] {
  return [uid, uid, uid, uid, uid]
}

export interface DealRefundRow {
  id: number
  amount: number
  bank_name: string
  bank_account_masked: string
  account_holder: string
  status: 'requested' | 'paid' | 'rejected'
  rejection_reason: string | null
  requested_at: string
  processed_at: string | null
}

export interface DealRefundState {
  /** 지금 신청할 수 있는 금액(대기 중이면 그 몫은 이미 빠져 있다). */
  refundable: number
  /** 처리 중인 신청 — 있으면 새 신청을 받지 않는다. */
  pending: DealRefundRow | null
  /** 최근 신청 기록(대기 포함, 최신순 5건). */
  recent: DealRefundRow[]
}

const ROW_COLS = `id, amount, bank_name, '****' || SUBSTR(bank_account, -4) AS bank_account_masked,
  account_holder, status, rejection_reason, requested_at, processed_at`

/**
 * 손님 화면이 읽는 상태. 조회가 깨지면 **0 으로 막는다**(fail-closed) — 돈이 나가는 문은
 * "모르면 연다" 가 아니라 "모르면 닫는다" 다. 화면은 실패를 따로 알린다(`ok:false`).
 */
export async function getDealRefundState(
  DB: D1Database,
  userId: string | number,
): Promise<{ ok: true; state: DealRefundState } | { ok: false }> {
  const uid = String(userId)
  try {
    await ensureDealBuckets(DB)
    await ensureDealRefundTable(DB)
    const [cap, rows] = await Promise.all([
      DB.prepare(`SELECT ${REFUNDABLE_SQL} AS refundable`).bind(...refundableBinds(uid)).first<{ refundable: number }>(),
      DB.prepare(`SELECT ${ROW_COLS} FROM deal_refund_requests WHERE user_id = ? ORDER BY id DESC LIMIT 5`)
        .bind(uid).all<DealRefundRow>(),
    ])
    const recent = rows.results ?? []
    return {
      ok: true,
      state: {
        refundable: Math.max(0, Math.floor(Number(cap?.refundable ?? 0))),
        pending: recent.find((r) => r.status === DEAL_REFUND_OPEN) ?? null,
        recent,
      },
    }
  } catch {
    return { ok: false }
  }
}

export interface DealRefundInput {
  amount: number
  bank_name: string
  bank_account: string
  account_holder: string
}

export type DealRefundResult =
  | { ok: true; id: number; amount: number }
  | { ok: false; code: 'INVALID' | 'PENDING' | 'EXCEEDS' | 'ERROR'; error: string; refundable?: number }

/** 입력 정리 — 계좌번호는 숫자와 `-` 만 남긴다. 실패하면 사람이 고칠 수 있는 문장을 돌려준다. */
export function normalizeRefundInput(body: Partial<Record<keyof DealRefundInput, unknown>>):
  | { ok: true; input: DealRefundInput }
  | { ok: false; error: string } {
  const amount = Math.floor(Number(body.amount))
  const bankName = String(body.bank_name ?? '').trim()
  const bankAccount = String(body.bank_account ?? '').trim().replace(/[^0-9-]/g, '')
  const holder = String(body.account_holder ?? '').trim()
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: '환급할 금액을 확인해 주세요' }
  if (!bankName || bankName.length > 30) return { ok: false, error: '은행을 골라 주세요' }
  const digits = bankAccount.replace(/-/g, '')
  if (digits.length < 8 || digits.length > 20) return { ok: false, error: '계좌번호를 확인해 주세요' }
  if (!holder || holder.length > 30) return { ok: false, error: '예금주 이름을 적어 주세요' }
  return { ok: true, input: { amount, bank_name: bankName, bank_account: bankAccount, account_holder: holder } }
}

/**
 * 환급 신청 — ① 조건부 INSERT(한도 재평가) → ② 유상 잔액 CAS 차감 → ③ 원장 기록.
 * ②가 실패하면 ①의 행을 지운다(돈은 안 움직였다).
 */
export async function requestDealRefund(
  DB: D1Database,
  userId: string | number,
  input: DealRefundInput,
): Promise<DealRefundResult> {
  const uid = String(userId)
  try {
    await ensureDealBuckets(DB)
    await ensureDealRefundTable(DB)

    let insertedId = 0
    try {
      const ins = await DB.prepare(
        `INSERT INTO deal_refund_requests (user_id, amount, bank_name, bank_account, account_holder)
         SELECT ?, ?, ?, ?, ? WHERE ${REFUNDABLE_SQL} >= ?`,
      ).bind(uid, input.amount, input.bank_name, input.bank_account, input.account_holder,
        ...refundableBinds(uid), input.amount).run()
      if ((ins.meta?.changes ?? 0) === 1) insertedId = Number(ins.meta?.last_row_id ?? 0)
    } catch (e) {
      // 부분 UNIQUE 인덱스 — 이미 처리 중인 신청이 있다.
      if (/UNIQUE/i.test(String((e as Error)?.message ?? ''))) {
        return { ok: false, code: 'PENDING', error: '처리 중인 환급 신청이 있어요. 끝나면 다시 신청할 수 있어요' }
      }
      throw e
    }
    if (!insertedId) {
      const st = await getDealRefundState(DB, uid)
      const refundable = st.ok ? st.state.refundable : 0
      if (st.ok && st.state.pending) {
        return { ok: false, code: 'PENDING', error: '처리 중인 환급 신청이 있어요. 끝나면 다시 신청할 수 있어요', refundable }
      }
      return { ok: false, code: 'EXCEEDS', error: `환급할 수 있는 금액은 ${refundable.toLocaleString('ko-KR')}딜이에요`, refundable }
    }

    // 유상 잔액에서만 뺀다 — free_balance 는 건드리지 않는다(무상 딜은 환급 대상이 아니다).
    const dec = await DB.prepare(
      `UPDATE user_points SET balance = balance - ?, updated_at = datetime('now')
        WHERE user_id = ? AND ${PAID_BALANCE_SQL} >= ?`,
    ).bind(input.amount, uid, input.amount).run()
    if ((dec.meta?.changes ?? 0) === 0) {
      await DB.prepare('DELETE FROM deal_refund_requests WHERE id = ?').bind(insertedId).run().catch(() => {})
      const st = await getDealRefundState(DB, uid)
      const refundable = st.ok ? st.state.refundable : 0
      return { ok: false, code: 'EXCEEDS', error: `환급할 수 있는 금액은 ${refundable.toLocaleString('ko-KR')}딜이에요`, refundable }
    }

    // 원장 — 부호 있는 델타(모던 규약). 무상 몫 0. fail-soft(잔액은 이미 움직였다).
    await recordPointTransaction(DB, {
      userId: uid,
      delta: -input.amount,
      type: 'cash_refund',
      description: `충전 잔액 환급 신청 (#${insertedId})`,
      freeDelta: 0,
    })
    return { ok: true, id: insertedId, amount: input.amount }
  } catch {
    return { ok: false, code: 'ERROR', error: '환급 신청을 저장하지 못했어요. 잠시 후 다시 시도해 주세요' }
  }
}

/** 어드민: 입금 완료 기록(CAS). */
export async function markDealRefundPaid(
  DB: D1Database,
  id: number,
  memo: string | null,
): Promise<{ ok: true; userId: string; amount: number } | { ok: false }> {
  await ensureDealRefundTable(DB)
  const r = await DB.prepare(
    `UPDATE deal_refund_requests SET status = 'paid', processed_at = datetime('now'), admin_memo = ?
      WHERE id = ? AND status = 'requested'`,
  ).bind(memo, id).run()
  if ((r.meta?.changes ?? 0) !== 1) return { ok: false }
  const row = await DB.prepare('SELECT user_id, amount FROM deal_refund_requests WHERE id = ?')
    .bind(id).first<{ user_id: string; amount: number }>()
  return row ? { ok: true, userId: String(row.user_id), amount: Number(row.amount) } : { ok: false }
}

/**
 * 어드민: 반려 — CAS 로 선점한 뒤에만 유상 잔액을 되돌린다(신청 때 유상에서 뺐으므로 유상으로).
 * 되돌린 사실은 원장에 남긴다(잔액만 움직이고 원장 행이 없는 유저를 만들지 않는다).
 */
export async function rejectDealRefund(
  DB: D1Database,
  id: number,
  reason: string,
): Promise<{ ok: true; userId: string; amount: number } | { ok: false }> {
  await ensureDealRefundTable(DB)
  const r = await DB.prepare(
    `UPDATE deal_refund_requests SET status = 'rejected', processed_at = datetime('now'), rejection_reason = ?
      WHERE id = ? AND status = 'requested'`,
  ).bind(reason, id).run()
  if ((r.meta?.changes ?? 0) !== 1) return { ok: false }
  const row = await DB.prepare('SELECT user_id, amount FROM deal_refund_requests WHERE id = ?')
    .bind(id).first<{ user_id: string; amount: number }>()
  if (!row) return { ok: false }
  await DB.prepare(
    `UPDATE user_points SET balance = balance + ?, updated_at = datetime('now') WHERE user_id = ?`,
  ).bind(row.amount, row.user_id).run()
  await recordPointTransaction(DB, {
    userId: row.user_id,
    delta: Number(row.amount),
    type: 'refund',
    description: `환급 신청 반려 — 딜 되돌림 (#${id})`,
    freeDelta: 0,
  })
  return { ok: true, userId: String(row.user_id), amount: Number(row.amount) }
}

/** 어드민 대기 목록. */
export async function listOpenDealRefunds(DB: D1Database): Promise<Array<Record<string, unknown>>> {
  await ensureDealRefundTable(DB)
  const r = await DB.prepare(`
    SELECT d.id, d.user_id, u.name AS user_name, d.amount,
           d.bank_name, d.bank_account, d.account_holder, d.requested_at
      FROM deal_refund_requests d LEFT JOIN users u ON u.id = d.user_id
     WHERE d.status = 'requested'
     ORDER BY d.requested_at ASC LIMIT 200
  `).all()
  return (r.results ?? []) as Array<Record<string, unknown>>
}
