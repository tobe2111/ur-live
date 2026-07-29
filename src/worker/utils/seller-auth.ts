/**
 * 🔐 셀러(판매사) 토큰 인증 — 서비스 중립 공용 유틸 (SSOT).
 *
 *   2026-06-28 (대표 "큰 리팩터"): 기존엔 `sellerIdFrom` 이 도매몰 폴더(`features/supply/api/wholesale-helpers.ts`)
 *   에 있어서 유어애즈(marketing)·도매몰·소비자 셀러 표면이 전부 *도매몰 폴더*를 import 해야 했다(서비스 분리 누수
 *   + 도매 라우트마다 동일 함수가 복붙됨). 셀러 토큰 파싱은 어느 서비스에도 속하지 않는 범용 인증이므로 여기로 이동.
 *   도매/유어애즈/소비자 셀러가 동등하게 이 중립 모듈을 import → 누구도 남의 폴더에 의존하지 않음.
 *
 *   동작은 byte-동일(이동만) — 토큰 검증/클레임 추출 로직 불변.
 */

/** 셀러(판매사) JWT(Bearer) → seller_id. 서명만 검증(status 박제 토큰 — 요청시점 status 재검사는 isSellerBlocked). */
export async function sellerIdFrom(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization?.startsWith('Bearer ')) return null
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { seller_id?: number }
    return payload.seller_id ?? null
  } catch {
    return null
  }
}

/**
 * 🔐 2026-06-11 SSR Phase 2-F (docs/SSR_PHASE2_AUTH.md §3.3): beta(SSR) loader 가 forward 한
 *   httpOnly ud_seller_token 쿠키 fallback. requireAuth 미들웨어를 안 거치는 라우트의 자체 보강.
 *   **GET/HEAD 에서만** 동작(CSRF 표면 0) — 쓰기(POST/PATCH/DELETE)는 계속 Bearer 전용.
 *   토큰 값/검증 경로는 sellerIdFrom 재사용(단일 유지).
 */
export async function sellerIdFromCookieGet(
  c: { req: { method: string; header: (name: string) => string | undefined } },
  jwtSecret: string,
): Promise<number | null> {
  const method = c.req.method.toUpperCase()
  if (method !== 'GET' && method !== 'HEAD') return null
  const m = (c.req.header('Cookie') || '').match(/(?:^|;\s*)ud_seller_token=([^;]+)/)
  if (!m) return null
  return sellerIdFrom('Bearer ' + decodeURIComponent(m[1]), jwtSecret)
}
