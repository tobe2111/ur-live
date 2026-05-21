/**
 * 🛡️ 2026-05-21 Phase C: 주 1회 정산 일괄 생성 cron.
 *
 * 매주 월요일 새벽 (KST 09 = UTC 00) 실행:
 *   - 지난주 ledger credit 집계
 *   - 이미 payouts 처리된 amount 차감
 *   - 잔액 10,000원 이상 payee 별 pending payouts row INSERT
 *
 * admin 이 /admin/payouts 페이지에서 검토 후 송금 처리.
 *
 * 멱등: 같은 period_start/end + payee 조합 중복 INSERT 가능하므로
 *   주의 — cron 이 두 번 도는 경우 admin 이 중복 확인 후 한 쪽만 approve.
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

export async function handlePayoutsGenerate(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    const now = new Date()
    const lastMonday = new Date(now)
    lastMonday.setUTCDate(now.getUTCDate() - 7 - ((now.getUTCDay() + 6) % 7))
    const lastSunday = new Date(lastMonday)
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6)
    const periodStart = lastMonday.toISOString().slice(0, 10)
    const periodEnd = lastSunday.toISOString().slice(0, 10)
    const MIN_AMOUNT = 10000

    // 지난주 발생한 credit (외상) 집계
    const credits = await DB.prepare(`
      SELECT credit_account, SUM(amount) as total
        FROM ledger_entries
       WHERE (credit_account LIKE 'merchant:%' OR credit_account LIKE 'seller:%' OR credit_account LIKE 'agency:%')
         AND created_at BETWEEN ? AND ?
       GROUP BY credit_account
    `).bind(periodStart + ' 00:00:00', periodEnd + ' 23:59:59').all<{ credit_account: string; total: number }>().catch(() => ({ results: [] as Array<{ credit_account: string; total: number }> }))

    // 이미 payout 처리된 amount
    const paid = await DB.prepare(`
      SELECT (payee_type || ':' || payee_id) as account, SUM(amount) as total
        FROM payouts
       WHERE status IN ('approved','sent')
       GROUP BY payee_type, payee_id
    `).all<{ account: string; total: number }>().catch(() => ({ results: [] as Array<{ account: string; total: number }> }))
    const paidMap = new Map((paid.results || []).map(r => [r.account, r.total]))

    let created = 0
    for (const c of credits.results || []) {
      const pending = c.total - (paidMap.get(c.credit_account) || 0)
      if (pending < MIN_AMOUNT) continue
      const [type, id] = c.credit_account.split(':')
      if (!type || !id) continue
      const payeeType = type === 'merchant' ? 'store_owner' : type
      if (!['store_owner', 'seller', 'agency'].includes(payeeType)) continue

      // 계좌 정보 조회
      let accountNumber: string | null = null, accountHolder: string | null = null
      try {
        if (payeeType === 'store_owner' || payeeType === 'seller') {
          const row = await DB.prepare('SELECT bank_account, business_name FROM sellers WHERE id = ?').bind(id).first<{ bank_account: string | null; business_name: string | null }>()
          accountNumber = row?.bank_account || null
          accountHolder = row?.business_name || null
        } else {
          const row = await DB.prepare('SELECT name FROM agencies WHERE id = ?').bind(id).first<{ name: string | null }>()
          accountHolder = row?.name || null
        }
      } catch { /* graceful */ }

      try {
        await DB.prepare(
          `INSERT INTO payouts (payee_type, payee_id, amount, period_start, period_end, status, account_number, account_holder)
           VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`,
        ).bind(payeeType, id, pending, periodStart, periodEnd, accountNumber, accountHolder).run()
        created++
      } catch (e) {
        logError('[payouts-cron] insert failed', { account: c.credit_account, error: (e as Error).message })
      }
    }
    if (created > 0) logInfo(`[payouts-cron] created ${created} pending payouts for ${periodStart} ~ ${periodEnd}`)
  } catch (e) {
    logError('[payouts-cron] failed', { error: (e as Error).message })
  }
}
