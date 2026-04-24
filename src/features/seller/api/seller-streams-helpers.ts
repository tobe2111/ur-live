/**
 * Seller Streams — Shared Helpers
 */

import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';

/**
 * JWT 토큰에서 셀러 ID 추출
 */
export async function getSellerIdFromToken(
  authorization: string | undefined,
  jwtSecret: string,
): Promise<number | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }

  try {
    const token = authorization.substring(7);
    const payload = await verify(token, jwtSecret, 'HS256') as JWTPayload & { seller_id?: number };
    return payload.seller_id || null;
  } catch (error) {
    console.error('Token verification error:', error);
    return null;
  }
}
