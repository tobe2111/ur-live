/**
 * 🛡️ 2026-06-09 감사 🟡#5 — 판매사 직원 서브계정 'viewer'(조회 전용) 토큰의 쓰기/요청 차단 게이트.
 *   viewer 토큰은 seller_id=부모 + sub_role='viewer'. 주문은 /orders 에서 이미 차단되지만
 *   충전신청·클레임·견적 등 다른 mutation 도 같은 read-only 계약을 지켜야 함.
 *   owner(sub_role 클레임 없음)·admin·staff 는 통과(viewer 만 차단).
 */
export async function isViewerToken(authorization: string | undefined, jwtSecret: string): Promise<boolean> {
  if (!authorization?.startsWith('Bearer ')) return false
  try {
    const { verify } = await import('hono/jwt')
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as { sub_role?: string }
    return payload.sub_role === 'viewer'
  } catch {
    return false
  }
}
