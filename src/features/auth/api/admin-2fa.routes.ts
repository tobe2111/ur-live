/**
 * 🔐 어드민 2FA(TOTP) 라우트 (admin.routes.ts 에서 추출 — 2026-08-22)
 *
 * setup(시크릿 발급 + QR URI) / verify(최초 등록 확인) / validate(로그인 2단계).
 * ⚠️ 세 라우트는 **한 세트**다 — verify 없이 setup 만 남기면 시크릿은 생겼는데 활성화가 안 되고,
 *    validate 가 빠지면 2FA 를 켠 관리자가 로그인 자체를 못 한다(단독 관리자면 lock-out).
 * ⚠️ `must_set_2fa` 는 유도 플래그일 뿐 잠금이 아니다 — 잠그면 lock-out 위험(원 주석 유지).
 */

import { cors } from 'hono/cors';
import type { Hono } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { requireAdmin } from '@/worker/middleware/auth';

/**
 * ⚠️ 제네릭을 `Hono<any>` 로 받는다 — 호출부의 Bindings 는 그 파일 지역 타입이고 Hono 제네릭이
 * 불변(invariant)이라, 구조가 같아도 재선언하면 안 맞는다. 런타임 계약은 호출부가 보장한다.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerAdmin2faRoutes(adminRoutes: Hono<any>): void {
  // Setup: TOTP secret 생성 → QR 코드용 URI 반환
  adminRoutes.post('/2fa/setup', cors(), rateLimit({ action: 'admin_2fa_setup', max: 10, windowSec: 600 }), requireAdmin() as any, async (c) => {
    const { DB } = c.env as { DB: D1Database };
    const user = (c as any).get('user') as { id: string | number; email: string } | undefined;
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

    try {
      const { generateTOTPSecret, buildTOTPUri } = await import('../../../worker/utils/totp');

      // 이미 활성화된 경우 재설정 불가 (기��� secret 유지)
      try {
        await DB.prepare(`
          CREATE TABLE IF NOT EXISTS admin_2fa (
            admin_id INTEGER PRIMARY KEY,
            totp_secret TEXT NOT NULL,
            is_active INTEGER NOT NULL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now')),
            activated_at TEXT
          )
        `).run();
      } catch {}

      const existing = await DB.prepare(
        'SELECT is_active FROM admin_2fa WHERE admin_id = ? AND is_active = 1'
      ).bind(user.id).first();
      if (existing) {
        return c.json({ success: false, error: '2FA 가 이미 활성화되어 있습니다. 비활성화 후 다시 설정하세요.' }, 400);
      }

      const secret = generateTOTPSecret();
      const uri = buildTOTPUri(secret, user.email);

      // secret 저장 (아직 비활성)
      await DB.prepare(`
        INSERT INTO admin_2fa (admin_id, totp_secret, is_active) VALUES (?, ?, 0)
        ON CONFLICT(admin_id) DO UPDATE SET totp_secret = ?, is_active = 0, activated_at = NULL
      `).bind(user.id, secret, secret).run();

      return c.json({ success: true, data: { secret, uri } });
    } catch (err) {
      console.error('[Admin 2FA] Setup error:', err);
      return c.json({ success: false, error: '2FA 설정 실패' }, 500);
    }
  });

  // Verify: 최초 활성화 시 OTP 확인
  adminRoutes.post('/2fa/verify', cors(), rateLimit({ action: 'admin_2fa_verify', max: 10, windowSec: 600 }), requireAdmin() as any, async (c) => {
    const { DB } = c.env as { DB: D1Database };
    const user = (c as any).get('user') as { id: string | number; email: string } | undefined;
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const { code } = await c.req.json<{ code: string }>();
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return c.json({ success: false, error: '6자리 인증 코드를 입력하세요' }, 400);
    }

    try {
      const { verifyTOTP } = await import('../../../worker/utils/totp');

      const row = await DB.prepare(
        'SELECT totp_secret, is_active FROM admin_2fa WHERE admin_id = ?'
      ).bind(user.id).first<{ totp_secret: string; is_active: number }>();
      if (!row) return c.json({ success: false, error: '2FA 를 먼저 설정하세요 (POST /2fa/setup)' }, 400);
      if (row.is_active) return c.json({ success: false, error: '2FA 가 이미 활성화되어 있습니다' }, 400);

      const valid = await verifyTOTP(row.totp_secret, code);
      if (!valid) return c.json({ success: false, error: '인증 코드가 유효하지 않습니다' }, 401);

      await DB.prepare(
        "UPDATE admin_2fa SET is_active = 1, activated_at = datetime('now') WHERE admin_id = ?"
      ).bind(user.id).run();

      return c.json({ success: true, message: '2FA 가 활성���되었습니다' });
    } catch (err) {
      console.error('[Admin 2FA] Verify error:', err);
      return c.json({ success: false, error: '2FA 검증 실패' }, 500);
    }
  });

  // Validate: 로그인 후 2FA 검증 (클라이언트가 로그인 성공 후 호출)
  adminRoutes.post('/2fa/validate', cors(), rateLimit({ action: 'admin_2fa_validate', max: 10, windowSec: 600 }), requireAdmin() as any, async (c) => {
    const { DB } = c.env as { DB: D1Database };
    const user = (c as any).get('user') as { id: string | number; email: string } | undefined;
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401);

    const { code } = await c.req.json<{ code: string }>();
    if (!code || typeof code !== 'string' || code.length !== 6) {
      return c.json({ success: false, error: '6자리 인증 코드를 입력하세요' }, 400);
    }

    try {
      const { verifyTOTP } = await import('../../../worker/utils/totp');

      const row = await DB.prepare(
        'SELECT totp_secret, is_active FROM admin_2fa WHERE admin_id = ? AND is_active = 1'
      ).bind(user.id).first<{ totp_secret: string; is_active: number }>();
      if (!row) return c.json({ success: true, twofa_required: false, message: '2FA 미설정 — 통과' });

      const valid = await verifyTOTP(row.totp_secret, code);
      if (!valid) return c.json({ success: false, error: '인증 코드가 유효하지 않습니다' }, 401);

      return c.json({ success: true, twofa_validated: true, message: '2FA 인증 완료' });
    } catch (err) {
      console.error('[Admin 2FA] Validate error:', err);
      return c.json({ success: false, error: '2FA 검증 실패' }, 500);
    }
  });
}
