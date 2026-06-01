/**
 * 🛡️ 2026-05-31 도매몰 INC-3: 외부 도매상(공급자) 인증.
 *   - POST /api/supplier/register — 도매상 가입 (status='pending', 어드민 승인 대기)
 *   - POST /api/supplier/login    — 도매상 로그인 (JWT type='supplier')
 *
 * 셀러 인증 패턴(seller.routes.ts) 재사용 — hashPassword/verifyPassword/sign/rateLimit.
 * 마운트: app.route('/api/supplier', supplierAuthRoutes)
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { sign } from 'hono/jwt';
import { hashPassword, verifyPassword, validatePasswordComplexity } from '@/lib/password';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { safeError } from '@/worker/utils/safe-error';
import { maskEmail } from '@/lib/mask';

type Bindings = { DB: D1Database; JWT_SECRET: string; ENVIRONMENT?: string };

export const supplierAuthRoutes = new Hono<{ Bindings: Bindings }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── POST /register — 도매상 가입 ──────────────────────────────────────────────
supplierAuthRoutes.post('/register', cors(), rateLimit({ action: 'supplier_register', max: 5, windowSec: 600 }), async (c) => {
  const { DB } = c.env;
  try {
    type RegBody = {
      business_name?: string; business_number?: string; representative?: string;
      email?: string; phone?: string; password?: string;
      bank_name?: string; bank_account?: string; account_holder?: string;
    };
    const body = await c.req.json<RegBody>().catch(() => ({} as RegBody));

    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const businessName = (body.business_name || '').trim();

    if (!EMAIL_RE.test(email)) return c.json({ success: false, error: '올바른 이메일을 입력해주세요' }, 400);
    if (!businessName) return c.json({ success: false, error: '상호(사업자명)는 필수입니다' }, 400);
    const pw = validatePasswordComplexity(password);
    if (!pw.ok) return c.json({ success: false, error: pw.error || '비밀번호가 복잡성 요건을 충족하지 않습니다' }, 400);

    // 중복 이메일 차단 (idx_suppliers_email UNIQUE 와 정합).
    const dupe = await DB.prepare('SELECT id FROM suppliers WHERE email = ? LIMIT 1').bind(email).first<{ id: number }>().catch(() => null);
    if (dupe) return c.json({ success: false, error: '이미 가입된 이메일입니다' }, 409);

    const passwordHash = await hashPassword(password);
    const result = await DB.prepare(`
      INSERT INTO suppliers (business_name, business_number, representative, email, phone, password_hash,
        bank_name, bank_account, account_holder, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `).bind(
      businessName, body.business_number || null, body.representative || null, email, body.phone || null, passwordHash,
      body.bank_name || null, body.bank_account || null, body.account_holder || null,
    ).run();

    return c.json({
      success: true,
      message: '가입 신청이 완료되었습니다. 관리자 승인 후 로그인할 수 있습니다.',
      data: { id: result.meta.last_row_id, status: 'pending' },
    }, 201);
  } catch (err) {
    return safeError(c, err, '가입 처리 중 오류가 발생했습니다', '[supplier-auth]');
  }
});

// ── POST /login — 도매상 로그인 ───────────────────────────────────────────────
supplierAuthRoutes.post('/login', cors(), rateLimit({ action: 'supplier_login', max: 10, windowSec: 300 }), async (c) => {
  const { DB } = c.env;
  try {
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({} as { email?: string; password?: string }));
    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    if (!email || !password) return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요' }, 400);

    const supplier = await DB.prepare(
      'SELECT id, business_name, email, password_hash, status FROM suppliers WHERE email = ? LIMIT 1'
    ).bind(email).first<{ id: number; business_name: string; email: string; password_hash: string | null; status: string }>().catch(() => null);

    // 타이밍 공격 방어 — 계정 없어도 더미 검증 1회.
    if (!supplier || !supplier.password_hash) {
      await verifyPassword(password, '$2b$10$CwTycUXWue0Thq9StjUM0uJ8mS8bL7JmJg0jVRjyZj3X5kQKqRHqO').catch(() => null);
      return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401);
    }

    const { valid } = await verifyPassword(password, supplier.password_hash);
    if (!valid) {
      if (import.meta.env.DEV) console.warn('[Supplier Login] invalid password:', maskEmail(email));
      return c.json({ success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다' }, 401);
    }

    if (supplier.status !== 'approved') {
      const msg = supplier.status === 'pending' ? '관리자 승인 대기 중입니다'
        : supplier.status === 'suspended' ? '정지된 계정입니다. 관리자에게 문의하세요'
        : '로그인할 수 없는 계정 상태입니다';
      return c.json({ success: false, error: msg, code: 'SUPPLIER_NOT_APPROVED' }, 403);
    }

    const nowSec = Math.floor(Date.now() / 1000);
    const token = await sign({
      sub: supplier.id.toString(),
      supplier_id: supplier.id,
      email: supplier.email,
      name: supplier.business_name,
      type: 'supplier',
      iat: nowSec,
      exp: nowSec + 30 * 24 * 60 * 60,
    }, c.env.JWT_SECRET);

    return c.json({
      success: true,
      data: { token, supplier: { id: supplier.id, business_name: supplier.business_name, email: supplier.email } },
    });
  } catch (err) {
    return safeError(c, err, '로그인 처리 중 오류가 발생했습니다', '[supplier-auth]');
  }
});
