/**
 * ✅ 수기 발송 뒤 "보냄" 처리 (유어애즈 인플루언서 풀)
 *
 * 2026-11-25 두 가지를 고쳤다:
 *  ① **같은 주소의 형제 행도 같이 닫는다.** 한 사람이 유튜브와 블로그를 같이 하면 행이 둘이다. 종전엔 붙여 넣은 ID 의 행만
 *     닫아서, 형제 행이 다음 내보내기에 다시 올라왔다(같은 사람에게 두 번).
 *  ② **묶어서 보낸다.** 종전엔 ID 500개를 한 문장에 바인드했다 — D1 은 한 문장에 100개까지라, ID 를 98개 넘게 붙여 넣으면
 *     문장이 통째로 실패했고 오류는 삼켜져 "0건 처리" 로만 보였다.
 * 멱등: 이미 `contacted_at` 이 있으면 덮지 않는다(최초 발송일 보존).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { chunkForBinds, D1_MAX_BINDS } from '../../../shared/db/d1-binds'

export const CONTACT_CHANNELS = ['email', 'dm', 'note', 'kakao', 'call', 'other'] as const
/** 한 문장의 ID 수 — 바인드는 `채널 + 풀 + ID×2 + 풀` = 3 + 2×40 = 83개(D1 한도 100). ID 가 두 번 들어가므로 한도의 절반보다 작게. */
export const MARK_CONTACTED_CHUNK = 40

export function normalizeContactChannel(raw: unknown): string {
  const v = String(raw || '')
  return (CONTACT_CHANNELS as readonly string[]).includes(v) ? v : 'email'
}

export async function markLeadsContacted(DB: D1Database, poolId: number, ids: number[], channel: string): Promise<number> {
  let updated = 0
  // 묶음은 한도 SSOT(`chunkForBinds`)로 — "나머지 바인드" 자리에 (한도 − 40)을 넘겨 한 묶음을 40개로 만든다.
  for (const chunk of chunkForBinds(ids, D1_MAX_BINDS - MARK_CONTACTED_CHUNK)) {
    const ph = chunk.map(() => '?').join(',')
    const r = await DB.prepare(`UPDATE ad_influencer_leads
        SET contacted_at = COALESCE(contacted_at, datetime('now')), contact_channel = COALESCE(contact_channel, ?),
            status = CASE WHEN status = 'new' THEN 'contacted' ELSE status END
      WHERE account_id = ? AND (id IN (${ph})
         OR (COALESCE(email, '') <> '' AND LOWER(TRIM(email)) IN (
              SELECT LOWER(TRIM(email)) FROM ad_influencer_leads WHERE account_id = ? AND id IN (${ph}) AND COALESCE(email, '') <> '')))`)
      .bind(channel, poolId, ...chunk, poolId, ...chunk).run() // d1-bind-ok: 83개(MARK_CONTACTED_CHUNK)
    updated += Number(r?.meta?.changes ?? 0)
  }
  return updated
}
