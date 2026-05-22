/**
 * 🛡️ 2026-05-22: youtube-live.routes.ts (3417줄) 분할 — server-side cache layer.
 *
 * YouTube API quota 절감 — status / yt-stats 폴링 캐시.
 * 셀러 10명 방송 시: 5s polling → 최대 2 API calls/5s (캐시 미스 시) vs 기존 10 calls/5s.
 *
 * 메모리 누수 방지: 100개 초과 시 오래된 항목 정리.
 */

const statusCache = new Map<string, { data: unknown; ts: number }>()

const CACHE_TTL: Record<string, number> = {
  status: 25_000,        // /status 폴링: 25s (라이브 감지 지연 허용)
  'yt-stats': 60_000,    // youtube-stats: 60s (ConnectionQualityGauge 8s → 실제 API 1/8)
}

export function getCachedStatus(key: string): unknown | null {
  const entry = statusCache.get(key)
  const prefix = key.split(':')[0]
  const ttl = CACHE_TTL[prefix] ?? 25_000
  if (entry && Date.now() - entry.ts < ttl) return entry.data
  return null
}

export function setCachedStatus(key: string, data: unknown): void {
  statusCache.set(key, { data, ts: Date.now() })
  if (statusCache.size > 100) {
    const oldest = [...statusCache.entries()].sort((a, b) => a[1].ts - b[1].ts)[0]
    if (oldest) statusCache.delete(oldest[0])
  }
}
