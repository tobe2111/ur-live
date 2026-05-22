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

export function readCache<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeCache<T>(key: string, value: T): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    /* quota / unsupported */
  }
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
