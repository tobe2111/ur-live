/**
 * ⏱️ **인플루언서 풀 통계 캐시** (2026-11-17 — 대표 *"로딩이 너무 길어 · 매일 수집량 그래프가 사라졌어"*).
 *
 * 왜·무엇을: `influencer-pool-stats.ts` 의 `computeHeavy` 머리말(실측 3.5~9.1초 · 회당 약 240만 행).
 * 규칙은 파트너 풀 캐시(`company-stats-cache.ts`)와 같다 — 같은 판정 함수(`parseStatsCache`)를 쓰고,
 * 키·수명만 다르다(두 풀의 수집 주기가 다르다).
 *
 * - 수명 30분: 인플루언서 수집은 회차가 잦아 분포가 조금씩 움직인다. 오늘 유입은 캐시 밖에서 실시간이다.
 * - 수명을 넘겨도 2시간 안이면 **낡은 값을 먼저 주고** 갱신은 응답 뒤(`waitUntil`)로 — 첫 방문자가 9초를 기다리지 않게.
 * - `fresh` 면 캐시를 안 쓴다(화면이 데이터를 바꾼 직후에 넘긴다).
 */
import type { D1Database } from '@cloudflare/workers-types'
import { parseStatsCache } from './company-stats-cache'

export const INFLUENCER_STATS_CACHE_KEY = 'ads_influencer_stats_cache'
export const INFLUENCER_STATS_TTL_MS = 30 * 60_000
export const INFLUENCER_STATS_MAX_STALE_MS = 2 * 60 * 60_000

let refreshing = false

export async function getInfluencerStatsCached<T>(
  DB: D1Database, fresh: boolean, compute: () => Promise<T>, bg?: (p: Promise<unknown>) => void, nowMs = Date.now(),
  /** 저장해도 되는 결과인가 — 실패가 섞인 계산을 30분 동안 내보내지 않게(아니면 저장 안 하고, 낡은 캐시가 있으면 그걸 준다). */
  storable: (t: T) => boolean = () => true,
): Promise<{ stats: T; at: number }> {
  const row = fresh ? null : await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
    .bind(INFLUENCER_STATS_CACHE_KEY).first<{ value: string }>().catch(() => null)
  const cached = parseStatsCache<T>(row?.value)
  const age = cached ? nowMs - cached.at : -1
  if (!fresh && cached && age >= 0 && age < INFLUENCER_STATS_TTL_MS) return { stats: cached.data, at: cached.at }
  const store = async (stats: T, at: number) => {
    if (!storable(stats)) return
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(INFLUENCER_STATS_CACHE_KEY, JSON.stringify({ at, data: stats })).run().catch(() => null)
  }
  if (!fresh && bg && cached && age >= 0 && age < INFLUENCER_STATS_MAX_STALE_MS) {
    // 화면은 10초마다 부른다 — 갱신(약 9초)이 끝나기 전에 온 요청마다 또 돌리지 않게 한 isolate 안에선 하나만.
    if (!refreshing) {
      refreshing = true
      bg(compute().then(s => store(s, nowMs)).catch(() => null).finally(() => { refreshing = false }))
    }
    return { stats: cached.data, at: cached.at }
  }
  const stats = await compute()
  // 실패가 섞인 계산이면 저장하지 않고, 낡았어도 온전한 캐시가 있으면 그쪽을 준다(빈 그래프보다 낫다).
  if (!storable(stats) && cached && age >= 0 && age < INFLUENCER_STATS_MAX_STALE_MS) return { stats: cached.data, at: cached.at }
  const at = nowMs // 기준 시각은 요청 시각(시험이 시계를 주입할 수 있게 — 계산 몇 초 차이는 의미 없다)
  await store(stats, at)
  return { stats, at }
}
