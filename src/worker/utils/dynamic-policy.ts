/**
 * 🛡️ 2026-05-25: 동적 정책 SSOT — `platform_settings` 테이블 reader.
 *
 * 사용:
 *   const rate = await getPolicy(DB, 'curator_affiliate_pct', 1.0)
 *
 * 동작:
 *   1. in-memory 캐시 (60s TTL) — 같은 요청 안 다회 조회 방지
 *   2. DB `platform_settings.key` 조회 → numeric 변환 시도
 *   3. 실패/누락 시 fallback 반환 (policy.ts 정적 상수)
 *
 * 영구 룰:
 *   - 클라이언트에서는 호출 X (worker only — DB 접근 필요)
 *   - 새 dynamic key 도입 시: 본 helper 호출 + SETTINGS_FIELDS 에 UI 추가
 *   - cache TTL 짧음 — 어드민 변경 후 최대 60초 내 반영
 */

interface CacheEntry {
  value: number
  fetchedAt: number
}

const cache = new Map<string, CacheEntry>()
const TTL_MS = 60_000

/**
 * platform_settings 의 numeric 값 조회.
 * @param fallback DB 미설정 / 누락 / 파싱 실패 시 반환할 default
 */
export async function getPolicy(
  DB: D1Database | undefined,
  key: string,
  fallback: number,
): Promise<number> {
  if (!DB) return fallback
  const cached = cache.get(key)
  if (cached && Date.now() - cached.fetchedAt < TTL_MS) return cached.value

  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ? LIMIT 1')
      .bind(key)
      .first<{ value: string | null }>()
    const raw = row?.value
    if (raw == null) {
      cache.set(key, { value: fallback, fetchedAt: Date.now() })
      return fallback
    }
    const n = Number(raw)
    if (!Number.isFinite(n)) {
      cache.set(key, { value: fallback, fetchedAt: Date.now() })
      return fallback
    }
    cache.set(key, { value: n, fetchedAt: Date.now() })
    return n
  } catch {
    return fallback
  }
}

/**
 * 캐시 무효화 — 어드민이 정책 변경 후 즉시 반영 필요 시 호출.
 * (현재는 60s TTL 으로 자연 만료. 필요 시 admin-tools.routes 의 PUT 후 호출 가능)
 */
export function invalidatePolicyCache(key?: string): void {
  if (key) cache.delete(key)
  else cache.clear()
}
