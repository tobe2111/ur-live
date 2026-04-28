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
    const payload = await verify(authorization.substring(7), jwtSecret, 'HS256') as JWTPayload & { seller_id?: number }
    return payload.seller_id || null
  } catch {
    return null
  }
}
