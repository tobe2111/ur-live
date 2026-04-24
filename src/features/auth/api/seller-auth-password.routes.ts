/**
 * Seller Auth — POST /forgot-password, POST /reset-password
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { hashPassword, validatePasswordComplexity } from '@/lib/password';
import { sendEmail } from '@/services/email';
import type { AuthResponse } from '../types';
import { maskEmail } from '@/lib/mask';
import type { Bindings } from './seller-auth-helpers';
import {
  ensurePasswordResetTable,
  generateResetToken,
  getPasswordResetEmailHTML,
} from './seller-auth-helpers';

export const sellerAuthPasswordRoutes = new Hono<{ Bindings: Bindings }>();

/**
 * POST /forgot-password
 * 비밀번호 재설정 이메일 발송 요청
 *
 * Request body:
 * - email: 이메일
 *
 * Response:
 * - 항상 success: true (이메일 존재 여부 노출 방지)
 */
sellerAuthPasswordRoutes.post('/forgot-password', cors(), rateLimit({ action: 'seller_forgot_password', max: 2, windowSec: 3600 }), async (c) => {
  const { DB, RESEND_API_KEY, RESEND_FROM, FRONTEND_URL } = c.env;

  try {
    const body = await c.req.json<{ email: string }>();
    const email = (body?.email || '').trim();

    if (!email) {
      return c.json<AuthResponse>({
        success: false,
        error: '이메일을 입력해주세요.'
      }, 400);
    }

    await ensurePasswordResetTable(DB);

    // 이메일로 셀러 조회 (존재 여부는 응답에서 숨김)
    const seller = await DB.prepare('SELECT id, email, name FROM sellers WHERE email = ?')
      .bind(email).first<{ id: number; email: string; name: string }>();

    if (seller) {
      // 토큰 생성 및 저장 (1시간 유효)
      const token = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

      await DB.prepare(`
        INSERT INTO password_reset_tokens (user_type, user_id, token, expires_at)
        VALUES ('seller', ?, ?, ?)
      `).bind(seller.id, token, expiresAt).run();

      const baseUrl = FRONTEND_URL || 'https://live.ur-team.com';
      // 🛡️ token URL-encode (URL 특수문자 방어) + baseUrl 검증
      const resetUrl = `${baseUrl.replace(/\/+$/, '')}/seller/reset-password?token=${encodeURIComponent(token)}`;

      if (RESEND_API_KEY) {
        await sendEmail(
          {
            to: seller.email,
            subject: '[유어딜] 셀러 비밀번호 재설정 안내',
            html: getPasswordResetEmailHTML(resetUrl),
          },
          RESEND_API_KEY,
          RESEND_FROM
        ).catch((e) => console.error('[Seller ForgotPassword] Email send failed:', e));
      } else {
        if (import.meta.env.DEV) console.warn('[Seller ForgotPassword] RESEND_API_KEY not configured; skipping email. resetUrl=', resetUrl);
      }
    } else {
      if (import.meta.env.DEV) console.info('[Seller ForgotPassword] Unknown email (silent):', maskEmail(email));
    }

    // 이메일 존재 여부와 무관하게 동일 응답
    return c.json({
      success: true,
      message: '입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다. 이메일을 확인해주세요.'
    });
  } catch (error) {
    console.error('[Seller ForgotPassword] Error:', error);
    // 에러도 동일 메시지로 반환하여 이메일 노출 방지
    return c.json({
      success: true,
      message: '입력하신 이메일로 비밀번호 재설정 링크를 발송했습니다. 이메일을 확인해주세요.'
    });
  }
});

/**
 * POST /reset-password
 * 토큰 기반 비밀번호 재설정
 *
 * Request body:
 * - token: 재설정 토큰
 * - newPassword: 새 비밀번호
 */
sellerAuthPasswordRoutes.post('/reset-password', cors(), rateLimit({ action: 'seller_reset_password', max: 10, windowSec: 600 }), async (c) => {
  const { DB } = c.env;

  try {
    const body = await c.req.json<{ token: string; newPassword: string }>();
    const token = (body?.token || '').trim();
    const newPassword = body?.newPassword || '';

    if (!token || !newPassword) {
      return c.json<AuthResponse>({
        success: false,
        error: '토큰과 새 비밀번호를 입력해주세요.'
      }, 400);
    }

    const pwCheck = validatePasswordComplexity(newPassword);
    if (!pwCheck.ok) {
      return c.json<AuthResponse>({
        success: false,
        error: pwCheck.error
      }, 400);
    }

    await ensurePasswordResetTable(DB);

    // 토큰 조회
    const row = await DB.prepare(`
      SELECT id, user_id, expires_at
      FROM password_reset_tokens
      WHERE token = ? AND user_type = 'seller'
    `).bind(token).first<{ id: number; user_id: number; expires_at: string }>();

    if (!row) {
      return c.json<AuthResponse>({
        success: false,
        error: '유효하지 않은 토큰입니다. 비밀번호 재설정을 다시 요청해주세요.',
        code: 'INVALID_RESET_TOKEN'
      }, 400);
    }

    // 만료 체크
    const expiresAt = new Date(row.expires_at).getTime();
    if (isNaN(expiresAt) || Date.now() > expiresAt) {
      await DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(row.id).run().catch(() => {});
      return c.json<AuthResponse>({
        success: false,
        error: '토큰이 만료되었습니다. 비밀번호 재설정을 다시 요청해주세요.',
        code: 'EXPIRED_RESET_TOKEN'
      }, 400);
    }

    // 비밀번호 해싱 및 업데이트
    const hash = await hashPassword(newPassword);
    await DB.prepare(`
      UPDATE sellers SET password_hash = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(hash, row.user_id).run();

    // 토큰 삭제 (단일 사용)
    await DB.prepare('DELETE FROM password_reset_tokens WHERE id = ?').bind(row.id).run().catch(() => {});

    // 🛡️ 2026-04-22: 비번 변경 시 기존 refresh token 전부 revoke.
    // 탈취된 토큰 유지 문제 방지 — 비번을 바꿨는데도 공격자가 기존 토큰으로 접근 가능하던 버그.
    await DB.prepare(
      "DELETE FROM auth_refresh_tokens WHERE user_type = 'seller' AND user_id = ?"
    ).bind(row.user_id).run().catch(() => {});

    return c.json({
      success: true,
      message: '비밀번호가 성공적으로 변경되었습니다. 새 비밀번호로 로그인해주세요.'
    });
  } catch (error) {
    console.error('[Seller ResetPassword] Error:', error);
    return c.json<AuthResponse>({
      success: false,
      error: '비밀번호 재설정 중 오류가 발생했습니다.',
      code: 'SELLER_RESET_PASSWORD_FAILED'
    }, 500);
  }
});
