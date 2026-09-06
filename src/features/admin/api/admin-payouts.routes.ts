/**
 * 🛡️ 2026-05-21 Phase C: 어드민 payouts 관리 — 정산 검토 + 송금 처리.
 *
 * Endpoints:
 *   GET    /api/admin/payouts/pending — 정산 대기 중 그룹 (payee 별 합산)
 *   POST   /api/admin/payouts/generate — 주기간 ledger 집계 → payouts row 생성
 *   PATCH  /api/admin/payouts/:id/approve — 송금 승인 (status='approved')
 *   PATCH  /api/admin/payouts/:id/sent — 실제 송금 완료 마킹 (transaction_id 기록)
 *   PATCH  /api/admin/payouts/:id/cancel — 취소
 *   GET    /api/admin/payouts — 목록 조회 (status 필터)
 */
import { Hono } from 'hono'
import { safeError } from '@/worker/utils/safe-error'
import { requireAdmin, requireAdminRole } from '../../../worker/middleware/auth'
// 🔐 2026-07-11 (사전점검 보안감사 R3 ③): 돈 액션 require2FA — 옵트인(2FA 미등록 관리자는 no-op 통과,
//   등록 시 X-2FA-Code 헤더 필수 — disputes.routes.ts 와 동일 패턴). 클라 인터셉터(api.ts:425)가
//   403+2FA_REQUIRED 에 자동 프롬프트 + 1회 재시도. 핸들러 본문 불변 — 미들웨어 체인만 추가.
import { require2FA } from '../../../worker/middleware/require-2fa'
// 🛡️ 2026-05-21 정합성: 모든 sensitive action 에 audit log 강제.
import { auditLog } from '../../../worker/middleware/audit-log'
import type { Env } from '../../../worker/types/env'
import { markPayoutSent, isTransferable, type PayoutRow } from '../../../worker/utils/payout-sent'
import { csvEscape } from '../../../worker/utils/csv-safe'

export const adminPayoutsRoutes = new Hono<{ Bindings: Env }>()

interface PendingGroup {
  payee_type: string
  payee_id: string
  total: number
  entry_count: number
}

// 정산 대기 잔액 (ledger credit - 이미 payout 처리된 amount).
adminPayoutsRoutes.get('/admin/payouts/pending', requireAdmin(), async (c) => {
  const { DB } = c.env
  try {
    // 💸 2026-07-01 (정산 정합): 순 외상 = Σ(credit − fee_amount) − Σ(debit) − 이미 payout(pending/approved/sent).
    //   이전엔 credit-only(gross, debit 무시)라 부풀려진 pending 을 표시했음. getLedgerReceivable/payouts-generate
    //   와 동일 net 공식. paid 는 pending 포함(이미 payout row 생성분 제외 → 미생성 순액만 표시, generate 와 정합).
    const rows = await DB.prepare(`
      WITH cred AS (
        SELECT credit_account AS account, SUM(amount - COALESCE(fee_amount, 0)) AS c
          FROM ledger_entries
         WHERE credit_account LIKE 'merchant:%' OR credit_account LIKE 'seller:%'
            OR credit_account LIKE 'agency:%' OR credit_account LIKE 'user:%'
         GROUP BY credit_account
      ),
      deb AS (
        SELECT debit_account AS account, SUM(amount) AS d
          FROM ledger_entries
         WHERE debit_account LIKE 'merchant:%' OR debit_account LIKE 'seller:%'
            OR debit_account LIKE 'agency:%' OR debit_account LIKE 'user:%'
         GROUP BY debit_account
      ),
      paid AS (
        SELECT (payee_type || ':' || payee_id) AS account, SUM(amount) AS p
          FROM payouts
         WHERE status IN ('pending','approved','sent')
         GROUP BY payee_type, payee_id
      ),
      accts AS (SELECT account FROM cred UNION SELECT account FROM deb)
      SELECT
        a.account AS account,
        (COALESCE(cred.c, 0) - COALESCE(deb.d, 0) - COALESCE(paid.p, 0)) AS pending_amount,
        (COALESCE(cred.c, 0) - COALESCE(deb.d, 0)) AS total_credited,
        COALESCE(paid.p, 0) AS total_paid
      FROM accts a
      LEFT JOIN cred ON cred.account = a.account
      LEFT JOIN deb ON deb.account = a.account
      LEFT JOIN paid ON paid.account = a.account
      WHERE (COALESCE(cred.c, 0) - COALESCE(deb.d, 0) - COALESCE(paid.p, 0)) > 0
      ORDER BY pending_amount DESC
      LIMIT 200
    `).all<{ account: string; pending_amount: number; total_credited: number; total_paid: number }>().catch(() => ({ results: [] as Array<{ account: string; pending_amount: number; total_credited: number; total_paid: number }> }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[admin]')
  }
})

// 주기간 정산 일괄 생성 — pending 잔액을 payouts row 로 변환.
adminPayoutsRoutes.post('/admin/payouts/generate', requireAdmin(), require2FA(), auditLog('payouts.generate'), async (c) => {
  const body = await c.req.json<{ period_start?: string; period_end?: string; min_amount?: number }>().catch(() => ({} as { period_start?: string; period_end?: string; min_amount?: number }))
  const periodStart = body.period_start || new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10)
  const periodEnd = body.period_end || new Date().toISOString().slice(0, 10)
  const minAmount = Math.max(1000, Number(body.min_amount) || 10000)
  const { DB } = c.env

  // pending 조회
  const pendingRes = await fetch(new URL('/api/admin/payouts/pending', c.req.url).toString(), {
    headers: { Authorization: c.req.header('Authorization') || '' },
  }).catch(() => null)
  if (!pendingRes || !pendingRes.ok) {
    // fallback — 직접 쿼리
  }

  // 직접 SQL 로 pending 계산
  const pendingRows = await DB.prepare(`
    WITH credits AS (
      SELECT credit_account, SUM(amount) as total
        FROM ledger_entries
       WHERE (credit_account LIKE 'merchant:%' OR credit_account LIKE 'seller:%' OR credit_account LIKE 'agency:%' OR credit_account LIKE 'user:%')
         AND created_at BETWEEN ? AND ?
       GROUP BY credit_account
    ),
    paid AS (
      SELECT (payee_type || ':' || payee_id) as account, SUM(amount) as total
        FROM payouts
       WHERE status IN ('approved','sent')
       GROUP BY payee_type, payee_id
    )
    SELECT c.credit_account as account, c.total - COALESCE(p.total, 0) as pending_amount
      FROM credits c
      LEFT JOIN paid p ON p.account = c.credit_account
     WHERE c.total - COALESCE(p.total, 0) >= ?
  `).bind(periodStart + ' 00:00:00', periodEnd + ' 23:59:59', minAmount).all<{ account: string; pending_amount: number }>().catch(() => ({ results: [] as Array<{ account: string; pending_amount: number }> }))

  let created = 0
  for (const r of pendingRows.results || []) {
    const [type, id] = r.account.split(':')
    if (!type || !id) continue
    if (!['merchant', 'seller', 'agency', 'store_owner', 'user'].includes(type)) continue
    const payeeType = type === 'merchant' ? 'store_owner' : type
    // 계좌 정보 조회 (sellers / agencies)
    let bankName: string | null = null, accountNumber: string | null = null, accountHolder: string | null = null
    try {
      if (payeeType === 'store_owner' || payeeType === 'seller') {
        const row = await DB.prepare('SELECT bank_account, business_name FROM sellers WHERE id = ?').bind(id).first<{ bank_account: string | null; business_name: string | null }>()
        accountNumber = row?.bank_account || null
        accountHolder = row?.business_name || null
      } else if (payeeType === 'agency') {
        const row = await DB.prepare('SELECT name FROM agencies WHERE id = ?').bind(id).first<{ name: string | null }>()
        accountHolder = row?.name || null
      }
    } catch { /* graceful */ }

    try {
      await DB.prepare(
        `INSERT INTO payouts (payee_type, payee_id, amount, period_start, period_end, status, bank_name, account_number, account_holder)
         VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
      ).bind(payeeType, id, r.pending_amount, periodStart, periodEnd, bankName, accountNumber, accountHolder).run()
      created++
    } catch (e) {
      console.error('[payouts generate] insert failed', e)
    }
  }

  return c.json({ success: true, data: { created, period_start: periodStart, period_end: periodEnd } })
})

adminPayoutsRoutes.get('/admin/payouts', requireAdmin(), async (c) => {
  const status = c.req.query('status') || 'pending'
  const { DB } = c.env
  const valid = ['pending', 'approved', 'sent', 'failed', 'cancelled', 'all']
  if (!valid.includes(status)) return c.json({ success: false, error: 'Invalid status' }, 400)
  const where = status === 'all' ? '' : 'WHERE status = ?'
  const params: unknown[] = status === 'all' ? [] : [status]
  const rows = await DB.prepare(
    `SELECT * FROM payouts ${where} ORDER BY created_at DESC LIMIT 200`,
  ).bind(...params).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
  const list = rows.results || []

  // 💸 2026-07-01 (정산 정합): pending payout 이 정정(net) 이전에 생성된 gross 금액이면 표시.
  //   각 pending 건에 available(순 receivable − 다른 approved/sent) + stale(amount 초과) 부착 → 어드민이
  //   승인 전 식별/취소. approve 가드와 동일 기준. (getLedgerReceivable per-account, 캐시.)
  try {
    const pendingRows = list.filter(r => String(r.status) === 'pending')
    if (pendingRows.length > 0) {
      const { getLedgerReceivable } = await import('../../../worker/utils/ledger')
      const recvCache = new Map<string, number>()
      for (const r of pendingRows) {
        const ledgerType = r.payee_type === 'store_owner' ? 'merchant' : String(r.payee_type)
        const account = `${ledgerType}:${r.payee_id}`
        let recv = recvCache.get(account)
        if (recv === undefined) { recv = await getLedgerReceivable(DB, account); recvCache.set(account, recv) }
        const otherPaid = await DB.prepare(
          `SELECT COALESCE(SUM(amount), 0) AS t FROM payouts
            WHERE payee_type = ? AND payee_id = ? AND status IN ('approved','sent') AND id != ?`
        ).bind(r.payee_type, r.payee_id, r.id).first<{ t: number }>().catch(() => ({ t: 0 }))
        const available = recv - Number(otherPaid?.t ?? 0)
        r._available = Math.max(0, available)
        r._stale = Number(r.amount) > available + 1
      }
    }
  } catch { /* best-effort — 부착 실패해도 목록은 반환 */ }

  return c.json({ success: true, data: list })
})

adminPayoutsRoutes.patch('/admin/payouts/:id/approve', requireAdminRole('finance'), require2FA(), auditLog('payouts.approve'), async (c) => {
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const { DB } = c.env
  const row = await DB.prepare('SELECT status, payee_type, payee_id, amount FROM payouts WHERE id = ?')
    .bind(id).first<{ status: string; payee_type: string; payee_id: string; amount: number }>()
  if (!row) return c.json({ success: false, error: 'Not found' }, 404)
  if (row.status !== 'pending') return c.json({ success: false, error: 'Not pending' }, 409)

  // 💸 2026-07-01 (정산 정합 — 대표 승인): 과다지급 방지 가드.
  //   payout.amount 는 *생성 시점* 값이라, net 집계 수정(2026-07-01) 이전에 생성된 pending 은
  //   gross(수수료 미차감) 금액일 수 있음. 승인 순간 현재 순 receivable 로 재검증 → 초과 시 차단.
  //   available = getLedgerReceivable(원장 net) − 이미 approved/sent 된 다른 payout 합.
  try {
    const { getLedgerReceivable } = await import('../../../worker/utils/ledger')
    const ledgerType = row.payee_type === 'store_owner' ? 'merchant' : row.payee_type
    const account = `${ledgerType}:${row.payee_id}`
    const receivable = await getLedgerReceivable(DB, account)
    const otherPaid = await DB.prepare(
      `SELECT COALESCE(SUM(amount), 0) AS total FROM payouts
        WHERE payee_type = ? AND payee_id = ? AND status IN ('approved','sent') AND id != ?`
    ).bind(row.payee_type, row.payee_id, id).first<{ total: number }>().catch(() => ({ total: 0 }))
    const available = receivable - Number(otherPaid?.total ?? 0)
    if (Number(row.amount) > available + 1) {
      return c.json({
        success: false,
        error: '지급 금액이 현재 정산 가능 잔액을 초과합니다. 정산식 정정 이전 생성된 오래된 건일 수 있어 취소 후 재생성이 필요합니다.',
        code: 'PAYOUT_EXCEEDS_RECEIVABLE',
        data: { requested: Number(row.amount), available: Math.max(0, available) },
      }, 409)
    }
  } catch { /* getLedgerReceivable 실패 시 가드 skip (기존 동작 보존) */ }

  // 💸 2026-07-08 (머니 감사 ③): CAS 선점 — 동시 승인 이중 실행 방지(머니 룰 #1). status='pending' 조건.
  const approveRes = await DB.prepare(
    `UPDATE payouts SET status = 'approved', approved_at = datetime('now') WHERE id = ? AND status = 'pending'`,
  ).bind(id).run()
  if ((approveRes.meta?.changes ?? 0) === 0) return c.json({ success: false, error: 'Not pending' }, 409)
  return c.json({ success: true })
})

// 🔐 2026-07-11 (사전점검 보안감사 R3): /sent 를 /approve(:185) 와 동일한 finance 게이트로 승격.
//   기존엔 requireAdmin() 만이라 송금완료 마킹이 승인보다 약한 게이트였음(비-finance 어드민도
//   sent 마킹 + 알림톡 발송 가능). 게이트만 변경 — 핸들러/정산 로직 byte-불변.
adminPayoutsRoutes.patch('/admin/payouts/:id/sent', requireAdminRole('finance'), require2FA(), auditLog('payouts.sent'), async (c) => {
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const body = await c.req.json<{ transaction_id?: string; admin_memo?: string }>().catch(() => ({} as { transaction_id?: string; admin_memo?: string }))
  const txId = (body.transaction_id || '').trim()
  if (!txId) return c.json({ success: false, error: 'transaction_id 필수 (은행/토스 송금 ID)' }, 400)
  const { DB } = c.env
  // 💸 2026-08-27: 가드(계좌 누락 / 기간 중복 / CAS)를 `markPayoutSent` SSOT 로 위임.
  //   일괄 송금완료(`/bulk-sent`)가 같은 함수를 부른다 — 따로 구현하면 가드가 갈리고,
  //   갈린 쪽이 조용히 이중지급을 만든다. 판정 내용·순서·에러코드는 이전과 동일.
  const sent = await markPayoutSent(DB, id, txId, body.admin_memo || null)
  if (!sent.ok) {
    const status = sent.code === 'NOT_FOUND' ? 404 : 409
    return c.json({ success: false, error: sent.error, code: sent.code }, status)
  }
  const row = sent.row!

  // 🛡️ 2026-05-21 Phase D-3: 송금 완료 자동 알림톡 (waitUntil 비동기).
  //   수령자 type 별 phone 조회 → template 'payout_completed' 발송.
  //   env 미설정 시 silent skip.
  c.executionCtx?.waitUntil((async () => {
    try {
      let phone: string | null = null
      let name: string | null = null
      if (row.payee_type === 'agency') {
        const r = await DB.prepare("SELECT phone, name FROM agencies WHERE id = ?").bind(row.payee_id).first<{ phone: string | null; name: string | null }>().catch(() => null)
        phone = r?.phone || null; name = r?.name || null
      } else if (row.payee_type === 'seller' || row.payee_type === 'store_owner') {
        const r = await DB.prepare("SELECT phone, business_name FROM sellers WHERE id = ?").bind(row.payee_id).first<{ phone: string | null; business_name: string | null }>().catch(() => null)
        phone = r?.phone || null; name = r?.business_name || null
      } else if (row.payee_type === 'user') {
        const r = await DB.prepare("SELECT phone, name FROM users WHERE id = ?").bind(row.payee_id).first<{ phone: string | null; name: string | null }>().catch(() => null)
        phone = r?.phone || null; name = r?.name || null
      }
      if (!phone) return
      const masked = row.account_number && row.account_number.length >= 4 ? `****${row.account_number.slice(-4)}` : (row.account_number || '')
      const message = `[유어딜] 정산 송금 완료\n${name || ''} 님 ${row.amount.toLocaleString('ko-KR')}원이 ${row.bank_name || ''} ${masked} 계좌로 입금되었습니다.\nTX: ${txId}`
      const { sendSystemAlimtalk } = await import('../../../lib/system-alimtalk')
      await sendSystemAlimtalk(c.env as unknown as Record<string, unknown>, phone, 'payout_completed', message)
    } catch (e) { if (import.meta.env?.DEV) console.warn('[payout sent alimtalk]', e) }
  })())

  return c.json({ success: true })
})

/**
 * 🏦 2026-08-27 (대표 "어드민에서 정산을 최대한 간편하게") — **은행 일괄이체 파일**.
 *
 * 지금까지 정산은 [건별 승인 → 은행에서 **건별 이체** → 돌아와 건별 송금완료 마킹] 이었다.
 * 수취인이 30명이면 매주 이체 30번이다. 은행 인터넷뱅킹에는 대량이체(파일 업로드) 기능이 있으니
 * **그 형식으로 뽑아 주면 이체가 1번**이 된다.
 *
 * ⚠️ 어드민 가이드는 예전부터 "CSV 다운로드 → 은행 일괄이체 → 완료 후 업로드" 를 안내하고 있었는데,
 *   실제 CSV(`/settlement/export-csv`)는 **주문 단위 회계 내역서**라 은행·계좌·예금주가 아예 없었다.
 *   문서가 없는 기능을 안내하고 있었던 것 — 이 라우트가 그 문서를 사실로 만든다.
 *
 * ⚠️ 계좌 3종(은행·번호·예금주)이 다 있는 건만 싣는다. 하나라도 비면 은행이 그 행을 거부하고,
 *   **파일 전체를 반려하는 은행도 있다.** 빠진 건수는 헤더(`X-Skipped-Count`)로 알려 준다.
 */
adminPayoutsRoutes.get('/admin/payouts/transfer-csv', requireAdminRole('finance'), async (c) => {
  const { DB } = c.env
  const status = c.req.query('status') === 'pending' ? 'pending' : 'approved'
  const { results } = await DB.prepare(
    `SELECT id, payee_type, payee_id, amount, bank_name, account_number, account_holder,
            period_start, period_end
       FROM payouts WHERE status = ? ORDER BY id ASC LIMIT 1000`,
  ).bind(status).all<PayoutRow>().catch(() => ({ results: [] as PayoutRow[] }))

  const all = results || []
  const rows = all.filter(isTransferable)
  const skipped = all.length - rows.length

  // 은행 대량이체 서식 — 은행마다 열 순서가 다르므로 **사람이 읽고 매핑**할 수 있게 한글 헤더로.
  // `적요` 에 payout id 를 넣어 두면 이체 결과와 우리 장부를 나중에 맞춰 볼 수 있다.
  const headers = ['정산ID', '은행', '계좌번호', '예금주', '금액', '적요']
  const body = rows.map((r) => [
    r.id, r.bank_name, r.account_number, r.account_holder, r.amount,
    `유어딜정산-${r.id}`,
  ])
  const csv = [headers, ...body].map((line) => line.map(csvEscape).join(',')).join('\r\n')

  return new Response('\uFEFF' + csv, {   // BOM — 엑셀에서 한글이 깨지지 않게
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="urdeal_transfer_${status}.csv"`,
      'X-Total-Count': String(all.length),
      'X-Skipped-Count': String(skipped),
      'Cache-Control': 'no-store',
    },
  })
})

/**
 * 🏦 일괄 송금 완료 — 은행에서 대량이체를 끝낸 뒤 한 번에 적는다.
 *
 * ⚠️ **가드는 단건과 같은 함수(`markPayoutSent`)를 건별로 부른다.** 일괄이라고 검사를 건너뛰면
 *   계좌 없는 건이 '송금됨'이 되거나 같은 기간이 두 번 나간다.
 * ⚠️ 실패해도 **전체를 되돌리지 않는다** — 이미 은행에서 나간 돈을 장부에서 지우면 더 위험하다.
 *   대신 건별 결과를 돌려주고 화면이 실패분만 다시 처리하게 한다.
 */
adminPayoutsRoutes.patch('/admin/payouts/bulk-sent', requireAdminRole('finance'), require2FA(), auditLog('payouts.bulk_sent'), async (c) => {
  type BulkSentBody = { ids?: unknown; transaction_id?: string; admin_memo?: string }
  const body: BulkSentBody = await c.req.json<BulkSentBody>().catch(() => ({} as BulkSentBody))
  const txId = (body.transaction_id || '').trim()
  if (!txId) return c.json({ success: false, error: 'transaction_id 필수 (은행 이체 파일/거래 번호)' }, 400)

  const ids = Array.isArray(body.ids)
    ? [...new Set((body.ids as unknown[]).map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))]
    : []
  if (ids.length === 0) return c.json({ success: false, error: '처리할 정산 건을 선택하세요' }, 400)
  // 한 번에 너무 많으면 워커 시간 안에 못 끝낸다 — 화면이 나눠 보내게 한다.
  if (ids.length > 200) return c.json({ success: false, error: '한 번에 200건까지 처리할 수 있습니다' }, 400)

  const { DB } = c.env
  const results = []
  for (const id of ids) results.push(await markPayoutSent(DB, id, txId, body.admin_memo || null))

  const ok = results.filter((r) => r.ok)
  const failed = results.filter((r) => !r.ok).map(({ id, code, error }) => ({ id, code, error }))
  return c.json({
    success: true,
    data: {
      sent: ok.length,
      failed_count: failed.length,
      total_amount: ok.reduce((sum, r) => sum + Number(r.row?.amount ?? 0), 0),
      failed,
    },
  })
})

/** 🏦 일괄 승인 — pending → approved. 돈이 나가지 않는 전이라 검사는 상태 CAS 하나로 충분하다. */
adminPayoutsRoutes.patch('/admin/payouts/bulk-approve', requireAdminRole('finance'), require2FA(), auditLog('payouts.bulk_approve'), async (c) => {
  type BulkIdsBody = { ids?: unknown }
  const body: BulkIdsBody = await c.req.json<BulkIdsBody>().catch(() => ({} as BulkIdsBody))
  const ids = Array.isArray(body.ids)
    ? [...new Set((body.ids as unknown[]).map((v) => Number(v)).filter((n) => Number.isInteger(n) && n > 0))]
    : []
  if (ids.length === 0) return c.json({ success: false, error: '승인할 정산 건을 선택하세요' }, 400)
  if (ids.length > 200) return c.json({ success: false, error: '한 번에 200건까지 처리할 수 있습니다' }, 400)

  const { DB } = c.env
  let approved = 0
  for (const id of ids) {
    const r = await DB.prepare(
      `UPDATE payouts SET status = 'approved', approved_at = datetime('now')
        WHERE id = ? AND status = 'pending'`,
    ).bind(id).run().catch(() => null)
    if ((r?.meta?.changes ?? 0) > 0) approved += 1
  }
  return c.json({ success: true, data: { approved, skipped: ids.length - approved } })
})

// 💸 2026-07-08 (머니 감사 ③): 지급후 환불 미회수 clawback 목록 — 운영자 회수/상계 액션용.
//   정산 지급이 이미 나간 뒤 환불이 들어오면 자동 회수가 안 되고 의무만 기록됨(settlement_clawbacks
//   'pending' / settlement_adjustments reason='refund'). 이 목록으로 운영자가 회수 대상을 확인한다.
//   read-only — 테이블 lazy-create 라 미존재 시 빈 배열(fail-soft).
adminPayoutsRoutes.get('/admin/payouts/clawbacks', requireAdminRole('finance'), async (c) => {
  const { DB } = c.env
  const clawbacks = await DB.prepare(
    `SELECT id, voucher_id, order_id, seller_id, settlement_id, amount, reason, status, created_at
       FROM settlement_clawbacks WHERE status = 'pending' ORDER BY created_at DESC LIMIT 500`,
  ).all<{ id: number; amount: number }>().catch(() => ({ results: [] as Array<{ id: number; amount: number }> }))
  const adjustments = await DB.prepare(
    `SELECT id, settlement_id, order_id, amount, reason, created_at
       FROM settlement_adjustments WHERE reason = 'refund' AND created_at > datetime('now','-90 days') ORDER BY created_at DESC LIMIT 500`,
  ).all().catch(() => ({ results: [] as unknown[] }))
  const clist = clawbacks.results || []
  const pendingAmount = clist.reduce((s, r) => s + (Number(r.amount) || 0), 0)
  return c.json({
    success: true,
    data: { clawbacks: clist, adjustments: adjustments.results || [], pending_count: clist.length, pending_amount: pendingAmount },
  })
})

// 💸 2026-07-08 (머니 감사 Guard 2 — 두 정산 레일 이중지급 대사): 같은 이용권 매출이
//   Rail A(restaurant_settlements, auto-settlement 크론)와 Rail B(ledger→payouts) 양쪽에
//   같은 매장(seller_id)으로 중복 적재되나 레일 간 대사가 없음 → 두 화면에서 각각 지급하면 이중지급.
//   이 endpoint 는 양 레일에 동시 미지급 노출된 매장을 나열해 운영자가 "한 레일에서만" 지급하게 한다.
//   read-only. 근본수정(레일 통일 — restaurant_settlements 를 원장 단일 레일로 수렴)은 머니 경로 →
//   별도 세션. 설계: docs/design/settlement-reconciliation.md.
adminPayoutsRoutes.get('/admin/payouts/rail-reconciliation', requireAdminRole('finance'), async (c) => {
  const { DB } = c.env
  // Rail A: restaurant_settlements 미지급(pending) seller별 집계.
  const railA = await DB.prepare(
    `SELECT seller_id, COUNT(*) AS a_count, COALESCE(SUM(settlement_amount),0) AS a_pending
       FROM restaurant_settlements WHERE status = 'pending' GROUP BY seller_id`,
  ).all<{ seller_id: number; a_count: number; a_pending: number }>()
    .catch(() => ({ results: [] as Array<{ seller_id: number; a_count: number; a_pending: number }> }))
  // Rail B: payouts(store_owner) 미완료(pending/approved/sent) payee별 집계.
  const railB = await DB.prepare(
    `SELECT payee_id, COUNT(*) AS b_count, COALESCE(SUM(amount),0) AS b_amount
       FROM payouts WHERE payee_type = 'store_owner' AND status IN ('pending','approved','sent') GROUP BY payee_id`,
  ).all<{ payee_id: string; b_count: number; b_amount: number }>()
    .catch(() => ({ results: [] as Array<{ payee_id: string; b_count: number; b_amount: number }> }))
  const bMap = new Map((railB.results || []).map(r => [String(r.payee_id), r]))
  const sellers: Array<Record<string, unknown>> = []
  let totalOverlap = 0
  for (const a of (railA.results || [])) {
    const b = bMap.get(String(a.seller_id))
    if (!b) continue // 한 레일에만 있으면 이중 노출 아님
    const overlap = Math.min(Number(a.a_pending) || 0, Number(b.b_amount) || 0)
    totalOverlap += overlap
    sellers.push({ seller_id: a.seller_id, rail_a_pending: a.a_pending, rail_a_count: a.a_count, rail_b_amount: b.b_amount, rail_b_count: b.b_count, overlap_estimate: overlap })
  }
  sellers.sort((x, y) => (Number(y.overlap_estimate) || 0) - (Number(x.overlap_estimate) || 0))
  return c.json({ success: true, data: { double_exposed_sellers: sellers.length, total_overlap_estimate: totalOverlap, sellers } })
})

// 🛡️ 2026-05-21 Phase D: commission rate 어드민 조정 — platform_settings 기반.
//   - platform_fee_pct: 플랫폼 fee 비율 (default 5)
//   - seller_commission_pct: 위탁 판매 셀러 commission (default 10)
//   🌇 2026-09-04 에이전시 일몰 — `agency_share_pct` 제거(읽는 코드가 사라졌다).
adminPayoutsRoutes.get('/admin/payouts/commission-rates', requireAdmin(), async (c) => {
  const { DB } = c.env
  const rows = await DB.prepare(
    "SELECT key, value FROM platform_settings WHERE key IN ('platform_fee_pct','seller_commission_pct','influencer_intro_share_pct')",
  ).all<{ key: string; value: string }>().catch(() => ({ results: [] as Array<{ key: string; value: string }> }))
  const defaults = { platform_fee_pct: '5', seller_commission_pct: '10', influencer_intro_share_pct: '20' }
  const result: Record<string, string> = { ...defaults }
  for (const r of rows.results || []) result[r.key] = r.value
  return c.json({ success: true, data: result })
})

adminPayoutsRoutes.patch('/admin/payouts/commission-rates', requireAdminRole('finance'), require2FA(), auditLog('payouts.commission_rates'), async (c) => {
  const body = await c.req.json<{ platform_fee_pct?: number; seller_commission_pct?: number; influencer_intro_share_pct?: number }>().catch(() => ({} as { platform_fee_pct?: number; seller_commission_pct?: number; influencer_intro_share_pct?: number }))
  const { DB } = c.env

  const inputs: Array<[string, number | undefined, number, number]> = [
    ['platform_fee_pct', body.platform_fee_pct, 0, 30],
    ['seller_commission_pct', body.seller_commission_pct, 0, 50],
    ['influencer_intro_share_pct', body.influencer_intro_share_pct, 0, 100],
  ]
  // platform_settings 테이블 보장
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS platform_settings (key TEXT PRIMARY KEY, value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`).run()
  } catch { /* exists */ }

  // 🛡️ 2026-05-21 Phase D-4: 변경 전 기존 값 조회 (audit log 용).
  const before: Record<string, string> = {}
  try {
    const rows = await DB.prepare(
      "SELECT key, value FROM platform_settings WHERE key IN ('platform_fee_pct','seller_commission_pct','influencer_intro_share_pct')",
    ).all<{ key: string; value: string }>()
    for (const r of rows.results || []) before[r.key] = r.value
  } catch { /* graceful */ }

  const changes: Record<string, { old: string | null; new: string }> = {}
  for (const [key, val, min, max] of inputs) {
    if (val === undefined || val === null) continue
    const n = Number(val)
    if (!Number.isFinite(n) || n < min || n > max) {
      return c.json({ success: false, error: `${key} 는 ${min}-${max} 범위여야 합니다.` }, 400)
    }
    const newVal = String(n)
    const oldVal = before[key] ?? null
    if (oldVal !== newVal) changes[key] = { old: oldVal, new: newVal }
    await DB.prepare(
      `INSERT INTO platform_settings (key, value, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
    ).bind(key, newVal).run()
  }

  // 🛡️ 변경 audit log — 누가 언제 어떤 비율 변경했는지 영구 기록.
  if (Object.keys(changes).length > 0) {
    const actor = (c as unknown as { get: (k: string) => { id?: string | number; email?: string } | undefined }).get('user')
    try {
      await DB.prepare(
        `INSERT INTO admin_audit_log (actor_id, actor_email, action, resource_type, resource_id, old_value, new_value, ip, created_at)
         VALUES (?, ?, 'commission_rate_change', 'platform_settings', 'rates', ?, ?, ?, datetime('now'))`,
      ).bind(
        String(actor?.id || 'unknown'),
        actor?.email || null,
        JSON.stringify(Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.old]))),
        JSON.stringify(Object.fromEntries(Object.entries(changes).map(([k, v]) => [k, v.new]))),
        c.req.header('CF-Connecting-IP') || null,
      ).run()
    } catch { /* audit log 테이블 없으면 silent */ }
  }

  return c.json({ success: true, data: { changes } })
})

adminPayoutsRoutes.patch('/admin/payouts/:id/cancel', requireAdmin(), require2FA(), auditLog('payouts.cancel'), async (c) => {
  const id = parseInt(c.req.param('id') || '', 10)
  if (!Number.isFinite(id)) return c.json({ success: false, error: 'Invalid id' }, 400)
  const body = await c.req.json<{ reason?: string }>().catch(() => ({} as { reason?: string }))
  const { DB } = c.env
  const row = await DB.prepare('SELECT status FROM payouts WHERE id = ?').bind(id).first<{ status: string }>()
  if (!row) return c.json({ success: false, error: 'Not found' }, 404)
  if (row.status === 'sent') return c.json({ success: false, error: '이미 송금됨 — reverse 는 별도 처리' }, 409)
  await DB.prepare(
    `UPDATE payouts SET status = 'cancelled', error_message = ? WHERE id = ?`,
  ).bind(body.reason || '관리자 취소', id).run()
  return c.json({ success: true })
})
