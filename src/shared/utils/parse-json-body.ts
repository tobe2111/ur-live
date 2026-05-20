/**
 * 🛡️ 2026-05-20: Hono `c.req.json<T>()` 가 fail 시 throw — 호출처는 보통 `.catch(() => ({}))`
 * 로 fallback 하지만, TS 가 union 을 `T | {}` 로 추론 → 모든 필드 접근 시 에러.
 *
 * 본 헬퍼는 항상 `T` 로 타입 단언하므로 호출처에서 그대로 destructure 가능.
 * 본문이 비거나 깨졌으면 빈 `T` (모든 필드 undefined) 반환 → optional 필드 가정과 일치.
 */
export async function parseJsonBody<T extends Record<string, unknown>>(
  c: { req: { json: <U>() => Promise<U> } },
): Promise<T> {
  try {
    return await c.req.json<T>()
  } catch {
    return {} as T
  }
}
