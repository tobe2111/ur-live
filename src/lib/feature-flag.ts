/**
 * 🛡️ 2026-05-15: 클라이언트 feature flag 평가 (KV 백엔드 + sessionStorage 캐시).
 *
 * 사용:
 *   const variant = await getFlag('gb_new_join_button', { userId: 'abc' })
 *   if (variant === 'B') ... else ...
 *
 * - 24h sessionStorage 캐싱 (KV 호출 한도 보호)
 * - userId hash % 100 으로 percentage 분배 (동일 user → 동일 variant 유지)
 * - allowlist 우선
 */

interface FlagConfig {
  enabled: boolean
  variant?: string
  percentage?: number
  allowlist?: string[]
}

const CACHE_PREFIX = 'flag_v1:'
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

async function fetchFlag(key: string): Promise<FlagConfig | null> {
  // 캐시 우선
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key)
    if (raw) {
      const { value, expires } = JSON.parse(raw) as { value: FlagConfig; expires: number }
      if (Date.now() < expires) return value
    }
  } catch { /* sessionStorage off */ }

  try {
    const res = await fetch(`/api/flags/${encodeURIComponent(key)}`)
    if (!res.ok) return null
    const json = await res.json() as { success?: boolean; data?: FlagConfig }
    if (!json.success || !json.data) return null
    try {
      sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({
        value: json.data, expires: Date.now() + CACHE_TTL_MS,
      }))
    } catch { /* silent */ }
    return json.data
  } catch { return null }
}

export async function getFlag(key: string, opts?: { userId?: string }): Promise<string | boolean> {
  const config = await fetchFlag(key)
  if (!config || !config.enabled) return false

  const userId = opts?.userId || localStorage.getItem('user_id') || localStorage.getItem('uid') || 'anon'

  // allowlist 우선
  if (config.allowlist && config.allowlist.includes(userId)) {
    return config.variant || true
  }

  // percentage 분배 (없으면 enabled 상태 그대로)
  if (typeof config.percentage === 'number' && config.percentage > 0 && config.percentage < 100) {
    const bucket = hashStr(`${key}:${userId}`) % 100
    if (bucket < config.percentage) {
      return config.variant || true
    }
    return false
  }

  return config.variant || true
}
