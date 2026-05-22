/**
 * 🛡️ 2026-05-22: localStorage cache 유틸 — query 의 initialData 용.
 *   페이지 진입 즉시 last-known value 표시 (0ms) → background 에서 real fetch + 갱신.
 *
 * 룰:
 *   - 모든 키는 'urq:' prefix (ur Query) — 다른 앱 localStorage 와 충돌 방지
 *   - JSON 직렬화. parse 실패 시 fallback 반환
 *   - localStorage 미지원 (Safari private mode 등) graceful → 항상 fallback
 */

const PREFIX = 'urq:'
const TS_SUFFIX = '__ts'

/** 30일 이상 안 read 된 entry 자동 삭제 (TTL). */
const AUTO_EXPIRE_MS = 30 * 24 * 60 * 60 * 1000

export function readCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return fallback
    // read 시점 timestamp 갱신 (LRU — 자주 사용된 entry 영구 유지).
    try { localStorage.setItem(PREFIX + key + TS_SUFFIX, String(Date.now())) } catch { /* */ }
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
    localStorage.setItem(PREFIX + key + TS_SUFFIX, String(Date.now()))
  } catch {
    // quota 초과 시: 오래된 entry 청소 후 1회 재시도.
    try {
      cleanupExpiredCache()
      localStorage.setItem(PREFIX + key, JSON.stringify(value))
      localStorage.setItem(PREFIX + key + TS_SUFFIX, String(Date.now()))
    } catch { /* 진짜 안 됨 — silent */ }
  }
}

/**
 * 🛡️ 30일 이상 안 read 된 cache entry 삭제.
 *   - quota 초과 시 자동 호출 (writeCache 안)
 *   - 앱 진입 시 1회 호출 (main.tsx — best-effort)
 *   - LRU: read 시점 timestamp 가 갱신되어 자주 본 entry 는 영구 유지.
 */
export function cleanupExpiredCache(): { removed: number; total: number } {
  let removed = 0
  let total = 0
  try {
    const now = Date.now()
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith(PREFIX) || k.endsWith(TS_SUFFIX)) continue
      total++
      const ts = Number(localStorage.getItem(PREFIX + k.slice(PREFIX.length) + TS_SUFFIX) || 0)
      if (!ts || now - ts > AUTO_EXPIRE_MS) {
        keysToRemove.push(k)
        keysToRemove.push(k + TS_SUFFIX)
      }
    }
    keysToRemove.forEach(k => { try { localStorage.removeItem(k) } catch { /* */ } })
    removed = keysToRemove.length / 2
  } catch { /* */ }
  return { removed, total }
}

export function clearCache(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch { /* */ }
}

/** 사용자 로그아웃 시 모든 개인화 cache 삭제. */
export function clearAllUserCache(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k?.startsWith(PREFIX)) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch { /* */ }
}
