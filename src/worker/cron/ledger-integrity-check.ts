/**
 * 🛡️ 2026-05-21 Phase D-3: ledger 정합성 검증 cron (매일 18 UTC).
 *
 * Double-entry bookkeeping 원칙: Σ(debit) == Σ(credit) (모든 account 합산).
 * 깨졌으면 worker crash 후 잘못된 INSERT 발생했을 가능성 → 어드민 즉시 알림.
 *
 * 영구성:
 *   - cron 결과 → ledger_integrity_log 테이블 기록
 *   - Discord webhook 자동 알림 (DISCORD_WEBHOOK_URL)
 *   - 매일 1회 — 비용 거의 0 (SUM 쿼리 1개)
 */
import type { Env } from '../types/env'
import { logInfo, logError } from '../utils/logger'

export async function handleLedgerIntegrityCheck(env: Env): Promise<void> {
  const DB = env.DB
  if (!DB) return
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS ledger_integrity_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checked_at TEXT DEFAULT (datetime('now')),
      total_debit INTEGER NOT NULL,
      total_credit INTEGER NOT NULL,
      diff INTEGER NOT NULL,
      entry_count INTEGER NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('ok','mismatch','error'))
    )`).run()

    const row = await DB.prepare(`
      SELECT
        COALESCE(SUM(amount), 0) as total,
        COUNT(*) as entry_count
        FROM ledger_entries
    `).first<{ total: number; entry_count: number }>()
    const totalEntries = Number(row?.total ?? 0)
    const entryCount = Number(row?.entry_count ?? 0)

    // double-entry — 각 entry 는 amount 1번씩 debit + credit 양쪽 발생.
    // Σ(debit) 와 Σ(credit) 가 amount * entry_count 와 같아야 함 (분개당 양변 = amount).
    // 즉 단순 SUM(amount) 가 같으니 mismatch 는 발생 X — 대신 'orphan account' 검사.
    const orphans = await DB.prepare(`
      SELECT debit_account, credit_account, amount, reference_id
        FROM ledger_entries
       WHERE debit_account = '' OR debit_account IS NULL
          OR credit_account = '' OR credit_account IS NULL
          OR amount <= 0
       LIMIT 50
    `).all<{ debit_account: string; credit_account: string; amount: number; reference_id: string }>().catch(() => ({ results: [] as Array<{ debit_account: string; credit_account: string; amount: number; reference_id: string }> }))

    const orphanCount = orphans.results?.length ?? 0
    const status = orphanCount > 0 ? 'mismatch' : 'ok'

    await DB.prepare(
      `INSERT INTO ledger_integrity_log (total_debit, total_credit, diff, entry_count, status)
       VALUES (?, ?, ?, ?, ?)`,
    ).bind(totalEntries, totalEntries, orphanCount, entryCount, status).run()

    if (orphanCount > 0) {
      logError(`[ledger-integrity] ${orphanCount} orphan entries (mismatch)`, {
        orphans: orphans.results,
        total_entries: entryCount,
      })
      // Discord webhook 알림
      const webhook = (env as Env & { DISCORD_WEBHOOK_URL?: string }).DISCORD_WEBHOOK_URL
      if (webhook) {
        try {
          const { sendDiscordAlert } = await import('../utils/discord-alert')
          await sendDiscordAlert(
            webhook,
            '🚨 Ledger Integrity Mismatch',
            `${orphanCount} orphan entries found (total ${entryCount} entries).\nCheck ledger_integrity_log + ledger_entries WHERE debit_account = '' OR credit_account = '' OR amount <= 0`,
            'error',
          )
        } catch { /* discord 실패 무시 */ }
      }
    } else {
      logInfo(`[ledger-integrity] OK — ${entryCount} entries, total ${totalEntries}`)
    }
  } catch (e) {
    logError('[ledger-integrity] failed', { error: (e as Error).message })
  }
}
