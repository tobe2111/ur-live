/**
 * 🗑️ 2026-11-18 기록 표 보관 기간 — 결재 2026-11-18-log-retention-and-ads-backup-drill 1번(대표 "1,2 모두 이상적으로 해줘").
 *
 * 지키는 것:
 *  1. 기간이 지난 행만 지운다 · 기간 안의 행은 그대로(진짜 SQLite).
 *  2. 한 번에 RETENTION_BATCH 개까지만 지운다(쓰기 폭주 방지).
 *  3. 지우면 안 되는 표(로그아웃 경계·감사·증빙)는 규칙에 **절대** 없다.
 *  4. 기간은 그 표를 다시 읽는 코드가 보는 범위보다 길다(인기 검색어 7일 < 90 · 클릭 통계 90일 < 120).
 *  5. 매일 청소가 이 함수를 부른다.
 *
 * 못 막는 것: 새로 그 표를 더 먼 과거까지 읽는 기능이 생기는 것(그때 이 파일의 기간을 같이 올릴 것).
 */
import { describe, it, expect } from 'vitest'
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { purgeOldLogs, RETENTION_RULES, RETENTION_EXCLUDED, RETENTION_BATCH } from '@/worker/utils/log-retention'

const { DatabaseSync } = createRequire(import.meta.url)('node:sqlite') as typeof import('node:sqlite')
function d1(db: InstanceType<typeof DatabaseSync>) {
  return { prepare: (sql: string) => ({ run: async () => ({ meta: { changes: Number(db.prepare(sql).run().changes) } }) }) } as unknown as D1Database
}

describe('기록 표 보관 기간', () => {
  it('기간 지난 행만 지운다(datetime · date 두 종류)', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec(`CREATE TABLE search_logs (id INTEGER PRIMARY KEY, created_at TEXT);
             CREATE TABLE ad_rank_snapshots (id INTEGER PRIMARY KEY, snap_date TEXT);`)
    db.exec(`INSERT INTO search_logs (created_at) VALUES (datetime('now','-91 days')), (datetime('now','-89 days')), (datetime('now'));
             INSERT INTO ad_rank_snapshots (snap_date) VALUES (date('now','-181 days')), (date('now','-10 days'));`)
    const res: Record<string, number> = {}
    await purgeOldLogs(d1(db), res)
    expect(Number((db.prepare('SELECT COUNT(*) n FROM search_logs').get() as { n: number }).n)).toBe(2)
    expect(Number((db.prepare('SELECT COUNT(*) n FROM ad_rank_snapshots').get() as { n: number }).n)).toBe(1)
    expect(res.retention_search_logs).toBe(1)
  })

  it('한 번에 RETENTION_BATCH 개까지만', async () => {
    const db = new DatabaseSync(':memory:')
    db.exec('CREATE TABLE search_logs (id INTEGER PRIMARY KEY, created_at TEXT)')
    const ins = db.prepare("INSERT INTO search_logs (created_at) VALUES (datetime('now','-200 days'))")
    db.exec('BEGIN'); for (let i = 0; i < RETENTION_BATCH + 300; i++) ins.run(); db.exec('COMMIT')
    await purgeOldLogs(d1(db), {})
    expect(Number((db.prepare('SELECT COUNT(*) n FROM search_logs').get() as { n: number }).n)).toBe(300)
  })

  it('지우면 안 되는 표는 규칙에 없다', () => {
    const tables = RETENTION_RULES.map((r) => r.table)
    for (const t of ['dashboard_sessions', 'audit_logs', 'admin_audit_logs', 'ledger_integrity_log', 'digital_download_logs']) {
      expect(RETENTION_EXCLUDED).toContain(t)
      expect(tables).not.toContain(t)
    }
  })

  it('기간이 그 표를 읽는 범위보다 길다', () => {
    const days = (t: string) => RETENTION_RULES.find((r) => r.table === t)!.days
    expect(days('search_logs')).toBeGreaterThan(7)
    expect(days('referral_clicks')).toBeGreaterThan(90)
    expect(days('ad_daily_metrics')).toBeGreaterThan(120)
    expect(fs.readFileSync('src/features/ledger/api/ledger.routes.ts', 'utf8')).toMatch(/Math\.min\(90,/)
  })

  it('매일 청소가 부른다', () => {
    expect(fs.readFileSync('src/worker/cron/scheduled-cleanup-daily.ts', 'utf8')).toMatch(/await purgeOldLogs\(DB as never, results\)/)
  })
})
