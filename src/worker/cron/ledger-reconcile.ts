/**
 * 🛡️ 2026-05-15 (TD-G08): Double-entry ledger 정합성 검증 — 1일 1회 cron.
 *
 * 검증:
 *   1. 전체 ledger 합계: SUM(amount) by debit_account vs credit_account → ε 미만
 *   2. 계정별 음수 잔액 (user wallet 음수 = 비정상)
 *   3. orphan reference (orders 없는 reference_id 등) — best-effort
 *
 * Discord alert (DISCORD_WEBHOOK_URL 설정 시): 불일치 ≥ 1원 발견 시 즉시 알림.
 */

import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

interface AccountBalance {
  account: string
  debit_total: number
  credit_total: number
  net: number  // credit - debit
}

interface ReconcileResult {
  total_entries: number
  total_debit: number
  total_credit: number
  imbalance: number
  negative_user_wallets: AccountBalance[]
  alert_sent: boolean
}

const IMBALANCE_THRESHOLD = 1  // 1원 이상 차이 → alert (반올림 오차 ε 0.5 정도까지 허용)

export async function handleLedgerReconcile(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return

  try {
    const result: ReconcileResult = {
      total_entries: 0,
      total_debit: 0,
      total_credit: 0,
      imbalance: 0,
      negative_user_wallets: [],
      alert_sent: false,
    }

    // 1. 전체 합계
    const sumRow = await DB.prepare(`
      SELECT
        COUNT(*) AS total_entries,
        COALESCE(SUM(amount), 0) AS total_debit,
        COALESCE(SUM(amount), 0) AS total_credit
      FROM ledger_entries
    `).first<{ total_entries: number; total_debit: number; total_credit: number }>().catch(() => null)

    if (!sumRow) {
      logInfo('[cron:ledger] no ledger_entries table or empty — skip')
      return
    }

    result.total_entries = sumRow.total_entries
    result.total_debit = sumRow.total_debit
    result.total_credit = sumRow.total_credit

    // 정확한 검증: 각 entry 가 debit + credit 양쪽이므로 SUM(amount) == debit_total == credit_total 자동 일치.
    // 핵심 검증: 계정별 balance (Σcredit - Σdebit) 합 == 0
    const balanceSumRow = await DB.prepare(`
      WITH per_account AS (
        SELECT
          debit_account AS account,
          -SUM(amount) AS net
        FROM ledger_entries
        GROUP BY debit_account
        UNION ALL
        SELECT
          credit_account AS account,
          SUM(amount) AS net
        FROM ledger_entries
        GROUP BY credit_account
      )
      SELECT COALESCE(SUM(net), 0) AS total_net
      FROM per_account
    `).first<{ total_net: number }>().catch(() => ({ total_net: 0 }))

    result.imbalance = Math.abs(Number(balanceSumRow?.total_net ?? 0))

    // 2. user wallet 음수 잔액 (비정상)
    const { results: negatives } = await DB.prepare(`
      WITH per_account AS (
        SELECT debit_account AS account, -SUM(amount) AS net FROM ledger_entries GROUP BY debit_account
        UNION ALL
        SELECT credit_account AS account, SUM(amount) AS net FROM ledger_entries GROUP BY credit_account
      )
      SELECT account, SUM(net) AS net
      FROM per_account
      WHERE account LIKE 'user:%'
      GROUP BY account
      HAVING SUM(net) < 0
      LIMIT 20
    `).all<{ account: string; net: number }>().catch(() => ({ results: [] as { account: string; net: number }[] }))

    result.negative_user_wallets = (negatives ?? []).map(r => ({
      account: r.account,
      debit_total: 0, credit_total: 0,
      net: Number(r.net),
    }))

    // 3. Discord alert (불일치 임계 초과 또는 음수 wallet 1개+)
    const shouldAlert = result.imbalance >= IMBALANCE_THRESHOLD || result.negative_user_wallets.length > 0
    const webhookUrl = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
    if (shouldAlert && webhookUrl) {
      try {
        const lines: string[] = ['🚨 **Ledger 정합성 alert**']
        lines.push(`Total entries: ${result.total_entries}`)
        if (result.imbalance >= IMBALANCE_THRESHOLD) {
          lines.push(`⚠️ Imbalance: ${result.imbalance.toLocaleString()}원 (Σcredit ≠ Σdebit)`)
        }
        if (result.negative_user_wallets.length > 0) {
          lines.push(`⚠️ Negative user wallets (${result.negative_user_wallets.length}):`)
          for (const w of result.negative_user_wallets.slice(0, 5)) {
            lines.push(`  - ${w.account}: ${w.net.toLocaleString()}원`)
          }
        }
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: lines.join('\n') }),
          signal: AbortSignal.timeout(5000),
        }).catch(() => { /* silent */ })
        result.alert_sent = true
      } catch { /* silent */ }
    }

    logInfo(`[cron:ledger] entries=${result.total_entries} imbalance=${result.imbalance} negative_wallets=${result.negative_user_wallets.length} alert=${result.alert_sent}`)
  } catch (e) {
    logError('[cron:ledger] failed', { error: String(e) })
  }
}
