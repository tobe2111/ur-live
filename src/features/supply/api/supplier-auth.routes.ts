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
import { hashPassword, verifyPassword } from '@/lib/password';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { requireAuth } from '@/worker/middleware/auth';
import { safeError } from '@/worker/utils/safe-error';
import { maskEmail } from '@/lib/mask';

type Bindings = { DB: D1Database; JWT_SECRET: string; ENVIRONMENT?: string };

export const supplierAuthRoutes = new Hono<{ Bindings: Bindings }>();

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 🛡️ 2026-06-04 (사용자 요청): 공급자 비밀번호 완화 — 영문+숫자 8자 이상(대소문자/특수문자 불필요).
//   어드민/셀러용 강한 validatePasswordComplexity(10자+특수문자)와 분리. 프론트(8자 체크)와 정합.
function validateSupplierPassword(pw: string): { ok: true } | { ok: false; error: string } {
  if (typeof pw !== 'string' || pw.length < 8) return { ok: false, error: '비밀번호는 8자 이상이어야 합니다' };
  if (pw.length > 128) return { ok: false, error: '비밀번호는 128자 이하여야 합니다' };
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return { ok: false, error: '비밀번호는 영문과 숫자를 포함해야 합니다' };
  return { ok: true };
}

// 🛡️ 2026-06-04 (가입 500 수정): production suppliers 테이블이 일부 컬럼 누락 시 INSERT 'no such column' → 500.
//   (CLAUDE.md D1 마이그레이션 CI 미작동) CREATE IF NOT EXISTS + 누락 컬럼 ALTER 보강(멱등).
const _supplierSchemaEnsured = new WeakSet<object>();
async function ensureSupplierSchema(DB: D1Database): Promise<void> {
  if (_supplierSchemaEnsured.has(DB)) return;
  _supplierSchemaEnsured.add(DB);
  await DB.prepare(`CREATE TABLE IF NOT EXISTS suppliers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    business_name TEXT NOT NULL,
    business_number TEXT, representative TEXT, email TEXT, phone TEXT, password_hash TEXT,
    bank_name TEXT, bank_account TEXT, account_holder TEXT, commission_rate REAL,
    status TEXT NOT NULL DEFAULT 'pending', linked_user_id INTEGER,
    created_at DATETIME DEFAULT (datetime('now')), updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => { /* exists */ });
  // 기존 테이블에 누락 가능 컬럼 보강 (이미 있으면 throw → 무시).
  for (const col of [
    'business_number TEXT', 'representative TEXT', 'email TEXT', 'phone TEXT', 'password_hash TEXT',
    'bank_name TEXT', 'bank_account TEXT', 'account_holder TEXT', 'commission_rate REAL',
    "status TEXT NOT NULL DEFAULT 'pending'", 'created_at DATETIME', 'updated_at DATETIME',
    'linked_user_id INTEGER', // 🏭 2026-06-04 카카오 통합 — 카카오 유저 ↔ 제조회원 연결
  ]) {
    await DB.prepare(`ALTER TABLE suppliers ADD COLUMN ${col}`).run().catch(() => { /* 이미 존재 */ });
  }
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email) WHERE email IS NOT NULL').run().catch(() => {});
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_linked_user ON suppliers(linked_user_id) WHERE linked_user_id IS NOT NULL').run().catch(() => {});
}

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
    const pw = validateSupplierPassword(password);
    if (!pw.ok) return c.json({ success: false, error: pw.error || '비밀번호 형식이 올바르지 않습니다' }, 400);

    // 🛡️ 스키마 보강 — 누락 컬럼으로 인한 INSERT 500 방지.
    await ensureSupplierSchema(DB);

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

// ── POST /become — 카카오(일반 유저) → 제조회원 입점/로그인 ──────────────────────────
//   카카오 통합: 유저 세션으로 제조회원 행을 생성/연결(linked_user_id). 제조회원은 어드민 승인 필요라
//   신규/미승인은 status='pending'(토큰 X), 승인됨이면 supplier_token 발급. 카카오 콜백 코어는 미변경.
supplierAuthRoutes.post('/become', requireAuth(), rateLimit({ action: 'supplier_become', max: 10, windowSec: 600 }), async (c) => {
  const { DB } = c.env;
  const authed = c.get('user' as never) as { id?: string | number; email?: string; name?: string; type?: string } | undefined;
  if (!authed || authed.type !== 'user') return c.json({ success: false, error: '카카오 로그인이 필요합니다' }, 401);
  const userId = Number(authed.id);
  if (!Number.isFinite(userId) || userId <= 0) return c.json({ success: false, error: '유효하지 않은 사용자입니다' }, 400);
  try {
    await ensureSupplierSchema(DB);
    const u = await DB.prepare('SELECT id, email, name FROM users WHERE id = ?').bind(userId)
      .first<{ id: number; email: string | null; name: string | null }>().catch(() => null);
    const email = (authed.email || u?.email || '').trim().toLowerCase();
    const name = (authed.name || u?.name || '제조회원').trim();

    type SupRow = { id: number; business_name: string; email: string | null; status: string };
    // 1) 이미 연결된 제조회원?
    let sup = await DB.prepare('SELECT id, business_name, email, status FROM suppliers WHERE linked_user_id = ? LIMIT 1')
      .bind(userId).first<SupRow>().catch(() => null);
    // 2) 같은 이메일 미연결 제조회원 → 연결.
    if (!sup && email) {
      const byEmail = await DB.prepare('SELECT id, business_name, email, status FROM suppliers WHERE email = ? AND (linked_user_id IS NULL OR linked_user_id = 0) LIMIT 1')
        .bind(email).first<SupRow>().catch(() => null);
      if (byEmail) {
        await DB.prepare("UPDATE suppliers SET linked_user_id = ?, updated_at = datetime('now') WHERE id = ?").bind(userId, byEmail.id).run().catch(() => {});
        sup = byEmail;
      }
    }
    // 3) 없으면 신규 제조회원 생성 (status='pending' — 어드민 승인 필요).
    if (!sup) {
      if (!email) return c.json({ success: false, error: '이메일 정보가 필요합니다. 카카오 이메일 제공에 동의해주세요' }, 400);
      const ins = await DB.prepare(`
        INSERT INTO suppliers (business_name, email, status, linked_user_id, created_at, updated_at)
        VALUES (?, ?, 'pending', ?, datetime('now'), datetime('now'))
      `).bind(name, email, userId).run().catch(() => null);
      const sid = Number(ins?.meta?.last_row_id);
      if (!sid) return c.json({ success: false, error: '제조회원 신청 중 오류가 발생했습니다' }, 500);
      return c.json({ success: true, status: 'pending', message: '제조회원 입점 신청 완료 — 관리자 승인 후 이용할 수 있습니다' });
    }
    // 승인 전이면 토큰 없이 대기 안내.
    if (sup.status !== 'approved') {
      return c.json({ success: true, status: sup.status, message: sup.status === 'pending' ? '관리자 승인 대기 중입니다' : '이용할 수 없는 계정 상태입니다' });
    }
    // 승인됨 → supplier_token 발급 (login 과 동일 payload).
    const nowSec = Math.floor(Date.now() / 1000);
    const token = await sign({
      sub: sup.id.toString(), supplier_id: sup.id, email: sup.email, name: sup.business_name,
      type: 'supplier', iat: nowSec, exp: nowSec + 30 * 24 * 60 * 60,
    }, c.env.JWT_SECRET);
    return c.json({ success: true, status: 'approved', data: { token, supplier: { id: sup.id, business_name: sup.business_name, email: sup.email } } });
  } catch (err) {
    return safeError(c, err, '제조회원 전환 중 오류가 발생했습니다', '[supplier-auth]');
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
