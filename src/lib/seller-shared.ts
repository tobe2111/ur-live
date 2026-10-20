/**
 * 🛡️ 2026-04-28: Seller 공통 helper — 분할된 라우터 (registration, profile, settlements,
 *   account, kakao-link, alimtalk-mgmt) 에서 자체 정의했던 getSellerIdFromToken 통합.
 *
 * Bearer 토큰 → seller_id 추출. JWT_SECRET 으로 verify, payload.seller_id 반환.
 */
import { verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'

export interface SellerJWTPayload extends Record<string, unknown> {
  seller_id?: number
}

export async function getSellerIdFromToken(
  authorization: string | undefined,
  jwtSecret: string,
): Promise<number | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) return null
  try {
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as JWTPayload & { seller_id?: number; type?: string }
    // 🔐 2026-06-11 (보안 감사 — 방어심화): type 검증 추가 (seller-pin.routes.ts:37 정답 패턴 일치).
    //   seller_id 는 seller-type JWT 에만 서명되나, 향후 다른 토큰에 seller_id claim 이 생겨도 안전.
    if (payload.type !== 'seller') return null
    return payload.seller_id || null
  } catch {
    return null
  }
}
