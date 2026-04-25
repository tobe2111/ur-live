/**
 * Seller Auth — POST /refresh
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign, verify } from 'hono/jwt';
import { verifyPassword, hashPassword } from '@/lib/password';
import type { AuthResponse } from '../types';
import type { Bindings } from './seller-auth-helpers';
import { ensureAuthRefreshTokensTable } from './seller-auth-helpers';
import { logError, logWarn } from '@/worker/utils/logger';

export const sellerAuthRefreshRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /refresh
 * Refresh Token으로 새 Access Token 발급
 *
 * Request body:
 * - refreshToken: Refresh Token (JWT)
 *
 * Response:
 * - accessToken: 새 Access Token (7일)
 * - refreshToken: 새 Refresh Token (30일)
 */
sellerAuthRefreshRoutes.post('/refresh', cors(), async (c) => {
  const { DB, JWT_SECRET } = c.env;

  try {
    // JWT_SECRET 확인
    if (!JWT_SECRET) {
      logError('seller.refresh.jwt_secret_missing');
      return c.json<AuthResponse>({
        success: false,
        error: 'Server configuration error',
        code: 'MISSING_JWT_SECRET'
      }, 500);
    }

    // Request body 파싱
    const body = await c.req.json<{ refreshToken: string }>();
    const { refreshToken } = body;

    if (!refreshToken) {
      return c.json<AuthResponse>({
        success: false,
        error: 'Refresh Token이 필요합니다.'
      }, 400);
    }

    // 1. Refresh Token 검증
    let payload: any;
    try {
      payload = await verify(refreshToken, JWT_SECRET, 'HS256');
    } catch (error) {
      logWarn('seller.refresh.invalid_token', { error: (error as Error)?.message });
      return c.json<AuthResponse>({
        success: false,
        error: 'Refresh Token이 유효하지 않거나 만료되었습니다.',
        code: 'INVALID_REFRESH_TOKEN'
      }, 401);
    }

    // 2. Refresh Token 타입 확인
    if (payload.type !== 'seller') {
      logWarn('seller.refresh.wrong_type', { type: payload.type });
      return c.json<AuthResponse>({
        success: false,
        error: 'Seller Refresh Token이 아닙니다.',
        code: 'INVALID_TOKEN_TYPE'
      }, 401);
    }

    // seller_type 컬럼 존재 보장
    try { await DB.prepare("ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'").run() } catch { /* already exists */ }

    // 3. DB에서 셀러 정보 조회 (계정 상태 확인)
    const sellerId = payload.seller_id || payload.sub;
    const seller = await DB.prepare(`
      SELECT id, email, name, username, status, business_name, commission_rate, seller_type
      FROM sellers
      WHERE id = ?
    `).bind(sellerId).first<Record<string, any>>();

    if (!seller) {
      logWarn('seller.refresh.not_found');
      return c.json<AuthResponse>({
        success: false,
        error: '계정을 찾을 수 없습니다.',
        code: 'SELLER_NOT_FOUND'
      }, 401);
    }

    // 4. 계정 상태 확인
    if (seller.status === 'suspended') {
      logWarn('seller.refresh.account_suspended');
      return c.json<AuthResponse>({
        success: false,
        error: '정지된 계정입니다.',
        code: 'ACCOUNT_SUSPENDED'
      }, 403);
    }

    if (seller.status !== 'approved' && seller.status !== 'active') {
      logWarn('seller.refresh.account_inactive', { status: seller.status });
      return c.json<AuthResponse>({
        success: false,
        error: '활성화되지 않은 계정입니다.',
        code: 'ACCOUNT_NOT_ACTIVE'
      }, 403);
    }

    // 4.5 저장된 refresh 해시 검증 + rotation
    try {
      await ensureAuthRefreshTokensTable(DB);
      const rows = await DB.prepare(
        `SELECT id, token_hash, expires_at
         FROM auth_refresh_tokens
         WHERE user_type = 'seller' AND user_id = ?`
      ).bind(Number(sellerId)).all<{ id: number; token_hash: string; expires_at: string }>();

      const candidates = rows.results || [];
      if (candidates.length > 0) {
        let matchedId: number | null = null;
        for (const row of candidates) {
          const { valid } = await verifyPassword(refreshToken, row.token_hash);
          if (valid) {
            matchedId = row.id;
            break;
          }
        }
        if (matchedId === null) {
          logWarn('seller.refresh.token_revoked');
          return c.json<AuthResponse>({
            success: false,
            error: 'Refresh Token이 유효하지 않습니다.',
            code: 'INVALID_REFRESH_TOKEN'
          }, 401);
        }
        // v27 FIX: 구 토큰 삭제가 실패하면 rotation 중단 (구+신 동시 유효 방지)
        const deleteResult = await DB.prepare(
          'DELETE FROM auth_refresh_tokens WHERE id = ?'
        ).bind(matchedId).run();
        if (!deleteResult.meta?.changes) {
          logWarn('seller.refresh.rotation_delete_failed');
          return c.json<AuthResponse>({
            success: false,
            error: '토큰 갱신에 실패했습니다. 다시 로그인해주세요.',
            code: 'TOKEN_ROTATION_FAILED'
          }, 401);
        }
      }
    } catch (e) {
      logError('seller.refresh.token_store_failed', { error: (e as Error)?.message });
      return c.json<AuthResponse>({
        success: false,
        error: '토큰 검증에 실패했습니다.',
        code: 'TOKEN_VERIFY_FAILED'
      }, 500);
    }

    // 5. 새 Access Token 생성
    const newPayload = {
      sub: seller.id.toString(),
      seller_id: seller.id as number,
      email: seller.email,
      name: seller.name,
      username: seller.username,
      type: 'seller',
      status: seller.status,
      seller_type: (seller.seller_type as string) || 'influencer',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + (7 * 24 * 60 * 60) // 7일
    };

    const newAccessToken = await sign(newPayload, JWT_SECRET);

    // 6. 새 Refresh Token 생성 (보안 강화)
    const nowSec2 = Math.floor(Date.now() / 1000);
    const newRefreshPayload = {
      ...newPayload,
      exp: nowSec2 + (30 * 24 * 60 * 60) // 30일
    };
    const newRefreshToken = await sign(newRefreshPayload, JWT_SECRET);

    // 새 refresh 해시 저장
    try {
      const newHash = await hashPassword(newRefreshToken);
      await DB.prepare(
        `INSERT INTO auth_refresh_tokens (user_type, user_id, token_hash, expires_at)
         VALUES (?, ?, ?, ?)`
      ).bind(
        'seller',
        seller.id,
        newHash,
        new Date((nowSec2 + 30 * 24 * 3600) * 1000).toISOString()
      ).run();
    } catch (e) {
      logError('seller.refresh.new_persist_failed', { error: (e as Error)?.message });
    }

    // 7. 응답 반환
    return c.json<AuthResponse>({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken, // 새 Refresh Token 제공
        seller: {
          id: seller.id as number,
          username: seller.username as string,
          email: seller.email as string,
          name: seller.name as string,
          business_name: seller.business_name as string,
          status: seller.status as string,
          commission_rate: seller.commission_rate as number,
          seller_type: (seller.seller_type as string) || 'influencer'
        }
      }
    });

  } catch (error) {
    logError('seller.refresh.error', { error: (error as Error)?.message });

    return c.json<AuthResponse>({
      success: false,
      error: '토큰 갱신 중 오류가 발생했습니다.',
      code: 'SELLER_REFRESH_FAILED'
    }, 500);
  }
});
