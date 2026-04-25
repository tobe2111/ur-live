/**
 * Seller Kakao Link Routes
 *
 * Endpoints:
 * - POST /link-kakao        - 카카오 계정 연동
 * - POST /unlink-kakao      - 카카오 계정 연동 해제
 * - GET  /kakao-link-status - 연동 상태 확인
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { verify } from 'hono/jwt';
import type { JWTPayload } from 'hono/utils/jwt/types';
import { ALLOWED_ORIGINS } from '@/shared/constants';
import { verifyPassword } from '../../../lib/password';
import { KakaoAuthService } from '../../auth/services/KakaoAuthService';
import { parseSessionCookie } from '../../../worker/utils/session';
import { logError } from '@/worker/utils/logger';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
  KAKAO_REST_API_KEY?: string;
};

export const sellerKakaoLinkRoutes = new Hono<{ Bindings: Bindings }>();

// CORS 설정
sellerKakaoLinkRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}));

/**
 * JWT 토큰에서 셀러 ID 추출
 */
async function getSellerIdFromToken(authorization: string | undefined, jwtSecret: string): Promise<number | null> {
  if (!authorization || !authorization.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authorization.substring(7);
    const payload = await verify(token, jwtSecret, 'HS256') as JWTPayload & { seller_id?: number };
    return payload.seller_id || null;
  } catch {
    return null;
  }
}

/**
 * POST /api/seller/link-kakao
 * 🛡️ 이메일/비번으로 로그인한 셀러가 자신의 계정을 카카오에 연동.
 * 완료 후엔 카카오 로그인만으로도 같은 셀러 계정 접근 가능.
 */
sellerKakaoLinkRoutes.post('/link-kakao', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

    const DB = c.env.DB;

    const seller = await DB.prepare(
      'SELECT id, linked_user_id FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ id: number; linked_user_id: number | null }>();
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);
    if (seller.linked_user_id) {
      return c.json({ success: false, error: '이미 카카오 계정이 연동되어 있습니다.' }, 409);
    }

    // 두 가지 연동 모드 지원:
    //  1) 세션 기반 (권장, 팝업 플로우): body 비움 → /auth/kakao/sync/callback 이 이미
    //     세션 쿠키를 세팅했으니 그 userId 를 그대로 linked_user_id 로 사용.
    //  2) code 기반 (구 플로우 호환): code + redirect_uri 전달 → 서버에서 exchange.
    const body = await c.req.json<{ code?: string; redirect_uri?: string }>().catch(() => ({} as { code?: string; redirect_uri?: string }));

    let kakaoUserId: number | null = null;
    let kakaoUserInfo: { name?: string; email?: string } = {};

    if (body.code) {
      const kakaoKey = c.env.KAKAO_REST_API_KEY;
      if (!kakaoKey) return c.json({ success: false, error: '카카오 API 설정 누락' }, 500);
      const kakao = new KakaoAuthService(DB, kakaoKey);
      const tokenData = await kakao.exchangeCodeFull(body.code, body.redirect_uri || '');
      const kakaoUser = await kakao.getUserInfo(tokenData.access_token);
      const user = await kakao.upsertUser(kakaoUser);
      kakaoUserId = user.id;
      kakaoUserInfo = { name: user.name, email: user.email };
    } else {
      // 세션 쿠키에서 kakao user 추출
      const sessionUser = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']);
      if (!sessionUser) {
        return c.json({ success: false, error: '카카오 로그인이 필요합니다. 팝업에서 카카오 인증을 완료해주세요.' }, 400);
      }
      const userId = Number(sessionUser.userId);
      if (!Number.isFinite(userId)) {
        return c.json({ success: false, error: '세션이 유효하지 않습니다.' }, 400);
      }
      kakaoUserId = userId;
      kakaoUserInfo = { name: sessionUser.name, email: sessionUser.email };
    }

    // 🛡️ Atomic UPDATE: SELECT→UPDATE 사이 race 방지.
    // 조건: 현재 셀러의 linked_user_id 가 여전히 NULL 이고, 다른 셀러가 아직 이 카카오 계정을 가져가지 않았을 때만 성공.
    const upd = await DB.prepare(
      `UPDATE sellers
       SET linked_user_id = ?, updated_at = datetime('now')
       WHERE id = ?
         AND linked_user_id IS NULL
         AND NOT EXISTS (SELECT 1 FROM sellers s2 WHERE s2.linked_user_id = ? AND s2.id != ?)`
    ).bind(kakaoUserId, sellerId, kakaoUserId, sellerId).run();

    // D1 .meta.changes 로 실제 업데이트 수 확인. 0 이면 경쟁 상황 (다른 곳에서 먼저 연동 or 이 계정이 이미 연동됨)
    if (!upd.meta?.changes || upd.meta.changes === 0) {
      const conflict = await DB.prepare(
        'SELECT id FROM sellers WHERE linked_user_id = ? AND id != ?'
      ).bind(kakaoUserId, sellerId).first<{ id: number }>();
      if (conflict) {
        return c.json({ success: false, error: '이 카카오 계정은 이미 다른 셀러 계정에 연동되어 있습니다.' }, 409);
      }
      return c.json({ success: false, error: '이미 카카오 계정이 연동되어 있습니다.' }, 409);
    }

    return c.json({
      success: true,
      message: '카카오 계정 연동 완료',
      data: { user_id: kakaoUserId, user_name: kakaoUserInfo.name, user_email: kakaoUserInfo.email },
    });
  } catch (err) {
    logError('seller.kakaoLink.linkError', { error: (err as Error)?.message });
    return c.json({ success: false, error: (err as Error).message || '카카오 연동 실패' }, 500);
  }
});

/**
 * POST /api/seller/unlink-kakao — 연동 해제
 */
sellerKakaoLinkRoutes.post('/unlink-kakao', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);

    // 🛡️ 카카오 전용 생성된 셀러(/register-from-user 경로)는 임시 비번(랜덤 hex)이 저장돼 있어
    //   unlink 시 이메일 로그인 불가 → 영구 lockout. current_password 검증으로 방어.
    const body = await c.req.json<{ current_password?: string }>().catch(() => ({} as { current_password?: string }));
    if (!body.current_password) {
      return c.json({
        success: false,
        error: '현재 비밀번호 확인이 필요합니다. 비밀번호가 없다면 먼저 "비밀번호 찾기" 로 설정해주세요.',
        code: 'PASSWORD_REQUIRED'
      }, 400);
    }

    const seller = await c.env.DB.prepare(
      'SELECT password_hash FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ password_hash: string }>();
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404);

    const ok = await verifyPassword(body.current_password, seller.password_hash);
    if (!ok) return c.json({ success: false, error: '비밀번호가 틀렸습니다' }, 401);

    await c.env.DB.prepare(
      "UPDATE sellers SET linked_user_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).bind(sellerId).run();
    return c.json({ success: true, message: '카카오 연동이 해제되었습니다.' });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});

/**
 * GET /api/seller/kakao-link-status
 */
sellerKakaoLinkRoutes.get('/kakao-link-status', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET);
    if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
    const row = await c.env.DB.prepare(`
      SELECT s.linked_user_id, u.name as user_name, u.email as user_email, u.profile_image
      FROM sellers s LEFT JOIN users u ON u.id = s.linked_user_id WHERE s.id = ?
    `).bind(sellerId).first<{ linked_user_id: number | null; user_name?: string; user_email?: string; profile_image?: string }>();
    return c.json({
      success: true,
      data: row?.linked_user_id
        ? { linked: true, user: { id: row.linked_user_id, name: row.user_name, email: row.user_email, profile_image: row.profile_image } }
        : { linked: false }
    });
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500);
  }
});
