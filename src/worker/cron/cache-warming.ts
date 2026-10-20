/**
 * 🛡️ 2026-05-25 (loading P0): 메인 페이지 KV cache warming.
 *
 * 문제: publicCache + KV second-layer 는 첫 사용자만 cold-start (KV write).
 *       이후 사용자만 KV hit. 그러나 KV TTL 만료 + 트래픽 낮을 때 → 다시 cold-start.
 *       HTMLRewriter SSR inject 도 KV cache 필요 → KV miss 시 inject 안 됨 → skeleton 표시.
 *
 * 해결: 5분마다 cron 이 self-fetch 로 KV warming.
 *       /api/group-buy/products?status=active&category=all 미리 채워둠.
 *       publicCache middleware 가 자동 KV write.
 *
 * 영향:
 *   - 첫 사용자도 SSR inject 즉시 동작 (skeleton 0)
 *   - KV write 1회/5분 — 무료 한도 안전 (100K/day << 일 288회)
 */

interface CacheWarmingEnv {
  DB?: D1Database
  CACHE_KV?: KVNamespace
  [key: string]: unknown
}

/**
 * 메인 페이지 KV cache warming — publicCache middleware 가 자동 채움.
 * worker fetch self-call 패턴.
 */
export async function warmMainPageCache(env: CacheWarmingEnv, baseUrl: string): Promise<{ ok: boolean; warmed: string[]; errors: string[] }> {
  const warmed: string[] = []
  const errors: string[] = []

  // KV binding 없으면 skip
  if (!env.CACHE_KV) {
    return { ok: false, warmed, errors: ['CACHE_KV binding 미설정'] }
  }

  // 메인 페이지 critical endpoint 목록
  const endpoints = [
    '/api/group-buy/products?status=active&category=all',
    '/api/streams?status=live&limit=10',
  ]

  for (const path of endpoints) {
    try {
      const url = new URL(path, baseUrl).toString()
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'cf-worker-cache-warmer',
          'Accept': 'application/json',
        },
      })
      if (res.ok) {
        warmed.push(path)
      } else {
        errors.push(`${path}: HTTP ${res.status}`)
      }
    } catch (e) {
      errors.push(`${path}: ${(e as Error).message?.slice(0, 100) || 'fetch failed'}`)
    }
  }

  return { ok: errors.length === 0, warmed, errors }
}
