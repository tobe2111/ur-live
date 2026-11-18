/**
 * 🧮 2026-11-18 공구 피드 캐시 행의 나이 — 대표 승인 "응 두개 다 해줘" [UNLOCK_LOADING].
 *   cron 이 "목록이 그대로" 라고 확인만 한 회차는 행(`computed_at`)을 안 고치고 `platform_settings.gb_feed_cache_checked_at`
 *   한 줄만 적는다(`cron/group-buy-feed-cache.ts` FEED_CHECKED_KEY). 그래서 나이 = 둘 중 더 최근 것.
 *   `computed_at` 이 이미 신선하면 그 한 줄도 안 읽는다(추가 읽기 0).
 */
export const FEED_CACHE_FRESH_MS = 10 * 60_000

export async function feedCacheAgeMs(DB: D1Database, computedAt: string, now = Date.now()): Promise<number> {
  const age = now - new Date(computedAt + 'Z').getTime()
  if (age < FEED_CACHE_FRESH_MS) return age
  const chk = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'gb_feed_cache_checked_at'")
    .first<{ value: string }>().catch(() => null)
  const chkAge = chk?.value ? now - new Date(chk.value + 'Z').getTime() : Infinity
  return chkAge < age ? chkAge : age
}
