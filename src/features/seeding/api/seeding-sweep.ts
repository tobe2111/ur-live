/**
 * ⏰ 무상 체험 — 매일 18:40 KST 점검 (2026-10-31)
 *
 *  ① 게시 기한 하루 전 · 아직 링크를 안 낸 신청 → 리마인드 알림(신청당 한 번 — reminded_at)
 *  ② 게시 기한이 지난 신청 → `post_missed` + 패널티(신청당 한 번 — UNIQUE)
 *
 * 기한은 KST 날짜(YYYY-MM-DD, 그날 끝까지)다. 노쇼는 자동으로 판정하지 않는다 — 매장이 스캔을
 * 깜빡했을 수 있어서, 사장님 신고나 운영자 판단으로만 붙인다.
 */
import type { D1Database } from '@cloudflare/workers-types'
import { SEEDING_TPL, msgPostReminder } from '../../../shared/seeding'
import { ensureSeedingTables } from './seeding-db'
import { APP_SELECT, markPostMissed, type AppRow } from './seeding-actions'
import { toInfluencer } from './seeding-notify'

export function kstToday(now = new Date()): string {
  return new Date(now.getTime() + 9 * 3600_000).toISOString().slice(0, 10)
}

export async function runSeedingSweep(env: { DB: D1Database }, now = new Date()): Promise<string> {
  const DB = env.DB
  await ensureSeedingTables(DB)
  const today = kstToday(now)
  const rows = await DB.prepare(`${APP_SELECT} WHERE a.status = 'scheduled' AND a.post_deadline IS NOT NULL ORDER BY a.id LIMIT 300`)
    .all<AppRow & { reminded_at?: string | null }>().catch(() => ({ results: [] as AppRow[] }))
  let missed = 0, reminded = 0
  for (const a of rows.results ?? []) {
    const deadline = String(a.post_deadline)
    if (deadline < today) {
      if ((await markPostMissed(env, DB, a)).ok) missed++
      continue
    }
    const tomorrow = new Date(`${today}T00:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    if (deadline <= tomorrow.toISOString().slice(0, 10)) {
      const claim = await DB.prepare(`UPDATE seeding_applications SET reminded_at = datetime('now') WHERE id = ? AND reminded_at IS NULL`).bind(a.id).run()
      if (claim.meta?.changes) {
        await toInfluencer(env, DB, { userId: a.user_id, appId: a.id }, SEEDING_TPL.postReminder,
          msgPostReminder({ store: a.store_name || '매장', deadline }), '체험 게시물 등록 기한이 다가와요')
        reminded++
      }
    }
  }
  return `missed=${missed} reminded=${reminded} checked=${rows.results?.length ?? 0}`
}
