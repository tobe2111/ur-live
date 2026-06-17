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
import { swallow } from '@/worker/utils/swallow';
import { startDashboardSession } from '@/worker/utils/dashboard-session';
import { maskEmail } from '@/lib/mask';
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes';
import { registrationMallId } from './wholesale-malls';

// fail-soft 알림 발송 (가입 흐름이 알림 실패로 깨지지 않도록).
const swallowNotify = (tag: string) => (err: unknown) => { if (import.meta.env.DEV) console.warn(`[supplier-auth] ${tag}`, err); };

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
    status TEXT NOT NULL DEFAULT 'pending', linked_user_id INTEGER, business_license_url TEXT,
    created_at DATETIME DEFAULT (datetime('now')), updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => { /* exists */ });
  // 기존 테이블에 누락 가능 컬럼 보강 (이미 있으면 throw → 무시).
  for (const col of [
    'business_number TEXT', 'representative TEXT', 'email TEXT', 'phone TEXT', 'password_hash TEXT',
    'bank_name TEXT', 'bank_account TEXT', 'account_holder TEXT', 'commission_rate REAL',
    "status TEXT NOT NULL DEFAULT 'pending'", 'created_at DATETIME', 'updated_at DATETIME',
    'linked_user_id INTEGER', // 🏭 2026-06-04 카카오 통합 — 카카오 유저 ↔ 제조회원 연결
    'business_license_url TEXT', // 🏭 2026-06-04 사업자등록증 이미지 (승인 심사용)
    'representative_phone TEXT', // 🏭 2026-06-09 대표자 연락처
    'manager_name TEXT', 'manager_phone TEXT', 'manager_email TEXT', // 🏭 2026-06-09 담당자(성명/연락처/이메일)
    'mall_id INTEGER DEFAULT 1', // 🏬 2026-06-09 멀티-몰 테넌시 — 가입 시 어느 몰에 가입했는지(기본 1)
  ]) {
    await DB.prepare(`ALTER TABLE suppliers ADD COLUMN ${col}`).run().catch(() => { /* 이미 존재 */ });
  }
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email) WHERE email IS NOT NULL').run().catch(swallow('supplier-auth:idx-email'));
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_linked_user ON suppliers(linked_user_id) WHERE linked_user_id IS NOT NULL').run().catch(swallow('supplier-auth:idx-linked-user'));
}

// ── POST /register — 도매상 가입 ──────────────────────────────────────────────
// 🏁 2026-06-12 (P4 — 공급사는 "표시만"): 국세청 상태조회 결과를 suppliers.nts_status 에 저장,
//   승인은 수동 유지(공급사 = 돈을 받는 쪽 + 상품 책임 — 최종 클릭은 어드민). fail-soft.
async function ntsStatusOf(env: unknown, DB: D1Database, businessNumber: string): Promise<string | null> {
  try {
    const { ntsCheckStatus } = await import('../../../worker/utils/nts-business-verify')
    const rows = await ntsCheckStatus((env as { NTS_API_KEY?: string }).NTS_API_KEY, [businessNumber])
    const stt = rows[0]?.b_stt || null
    await DB.prepare('ALTER TABLE suppliers ADD COLUMN nts_status TEXT').run().catch(() => { /* exists */ })
    return stt
  } catch { return null }
}

supplierAuthRoutes.post('/register', cors(), rateLimit({ action: 'supplier_register', max: 5, windowSec: 600 }), async (c) => {
  const { DB } = c.env;
  try {
    type RegBody = {
      business_name?: string; business_number?: string; representative?: string;
      email?: string; phone?: string; password?: string;
      bank_name?: string; bank_account?: string; account_holder?: string;
      business_license_url?: string;
      representative_phone?: string; manager_name?: string; manager_phone?: string; manager_email?: string;
    };
    const body = await c.req.json<RegBody>().catch(() => ({} as RegBody));
    const bizLicenseUrl = (body.business_license_url || '').trim().slice(0, 500);
    // 🏭 2026-06-09 대표자 연락처 + 담당자(성명/연락처/이메일) — additive 수집. 길이 cap.
    const representativePhone = (body.representative_phone || '').trim().slice(0, 40);
    const managerName = (body.manager_name || '').trim().slice(0, 80);
    const managerPhone = (body.manager_phone || '').trim().slice(0, 40);
    const managerEmail = (body.manager_email || '').trim().slice(0, 160);

    const email = (body.email || '').trim().toLowerCase();
    const password = body.password || '';
    const businessName = (body.business_name || '').trim();

    if (!EMAIL_RE.test(email)) return c.json({ success: false, error: '올바른 이메일을 입력해주세요' }, 400);
    if (!businessName) return c.json({ success: false, error: '상호(사업자명)는 필수입니다' }, 400);
    // 🏭 2026-06-04 (사용자 결정): 제조회원도 사업자등록번호 필수(승인 심사용).
    const bizNum = (body.business_number || '').trim();
    if (!/^\d{3}-\d{2}-\d{5}$/.test(bizNum)) return c.json({ success: false, error: '사업자등록번호를 정확히 입력해주세요 (000-00-00000)' }, 400);
    if (!bizLicenseUrl) return c.json({ success: false, error: '사업자등록증 이미지를 업로드해주세요' }, 400);
    const pw = validateSupplierPassword(password);
    if (!pw.ok) return c.json({ success: false, error: pw.error || '비밀번호 형식이 올바르지 않습니다' }, 400);

    // 🛡️ 스키마 보강 — 누락 컬럼으로 인한 INSERT 500 방지.
    await ensureSupplierSchema(DB);

    // 중복 이메일 차단 (idx_suppliers_email UNIQUE 와 정합).
    const dupe = await DB.prepare('SELECT id FROM suppliers WHERE email = ? LIMIT 1').bind(email).first<{ id: number }>().catch(() => null);
    if (dupe) return c.json({ success: false, error: '이미 가입된 이메일입니다' }, 409);

    const passwordHash = await hashPassword(password);
    // 🏬 멀티-몰: 가입 대상 몰 = host(또는 ?mall=slug). 기본(단일 호스트) 환경은 1 → 동작 불변.
    const mallId = await registrationMallId(c);
    const nts1 = await ntsStatusOf(c.env, DB, bizNum)
    const result = await DB.prepare(`
      INSERT INTO suppliers (business_name, business_number, representative, email, phone, password_hash,
        bank_name, bank_account, account_holder, business_license_url,
        representative_phone, manager_name, manager_phone, manager_email,
        mall_id, nts_status, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
    `).bind(
      businessName, bizNum, body.representative || null, email, body.phone || null, passwordHash,
      body.bank_name || null, body.bank_account || null, body.account_holder || null, bizLicenseUrl || null,
      representativePhone || null, managerName || null, managerPhone || null, managerEmail || null,
      mallId, nts1,
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
//   🏭 2026-06-08: 유통회원(/become-distributor)과 대칭으로 카카오 회원가입(create-from-kakao) 지원.
//     선택 body { business_name, business_number, representative, phone, business_license_url } 를 받아
//     신규 유저면 suppliers 행을 status='pending' 으로 생성(+어드민 알림). 빈 body probe → needs_registration(200).
supplierAuthRoutes.post('/become', requireAuth(), rateLimit({ action: 'supplier_become', max: 10, windowSec: 600 }), async (c) => {
  const { DB } = c.env;
  const authed = c.get('user' as never) as { id?: string | number; email?: string; name?: string; type?: string } | undefined;
  if (!authed || authed.type !== 'user') return c.json({ success: false, error: '카카오 로그인이 필요합니다' }, 401);
  const userId = Number(authed.id);
  if (!Number.isFinite(userId) || userId <= 0) return c.json({ success: false, error: '유효하지 않은 사용자입니다' }, 400);
  try {
    const body = await c.req.json<{
      business_name?: string; business_number?: string; representative?: string;
      phone?: string; business_license_url?: string;
      representative_phone?: string; manager_name?: string; manager_phone?: string; manager_email?: string;
    }>().catch(() => ({} as Record<string, never>));
    const business_name = String(body.business_name || '').trim();
    const business_number = String(body.business_number || '').trim();
    const representative = String(body.representative || '').trim();
    const phone = String(body.phone || '').trim();
    const business_license_url = String(body.business_license_url || '').trim().slice(0, 500);
    // 🏭 2026-06-09 대표자 연락처 + 담당자(성명/연락처/이메일) — additive 수집. 길이 cap.
    const representative_phone = String(body.representative_phone || '').trim().slice(0, 40);
    const manager_name = String(body.manager_name || '').trim().slice(0, 80);
    const manager_phone = String(body.manager_phone || '').trim().slice(0, 40);
    const manager_email = String(body.manager_email || '').trim().slice(0, 160);

    await ensureSupplierSchema(DB);
    // best-effort: email_verified 컬럼 ensure (become 첫 호출 환경 self-heal).
    await DB.prepare('ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0').run().catch(() => {});
    const u = await DB.prepare('SELECT id, email, name, email_verified FROM users WHERE id = ?').bind(userId)
      .first<{ id: number; email: string | null; name: string | null; email_verified: number | null }>().catch(() => null);
    const email = (authed.email || u?.email || '').trim().toLowerCase();
    const name = (authed.name || u?.name || '제조회원').trim();
    const emailVerified = u?.email_verified === 1;

    type SupRow = { id: number; business_name: string; email: string | null; status: string };
    // 1) 이미 연결된 제조회원?
    let sup = await DB.prepare('SELECT id, business_name, email, status FROM suppliers WHERE linked_user_id = ? LIMIT 1')
      .bind(userId).first<SupRow>().catch(() => null);
    // 2) 같은 이메일 미연결 제조회원 → 연결.
    //   🛡️ 2026-06-06 (보안, 사용자 승인): verified 카카오 email 일 때만 자동연결 — 미verified email 로
    //   사전등록된(관리자 시드) 승인 제조회원 행 takeover 차단. KakaoAuthService 동일 게이트와 대칭.
    if (!sup && email && emailVerified) {
      const byEmail = await DB.prepare('SELECT id, business_name, email, status FROM suppliers WHERE email = ? AND (linked_user_id IS NULL OR linked_user_id = 0) LIMIT 1')
        .bind(email).first<SupRow>().catch(() => null);
      if (byEmail) {
        // 연결 UPDATE 실패 시에도 sup 은 할당돼 토큰이 발급됨 — 실패가 무음이면 '연결 안 된 로그인' 원인 추적 불가.
        await DB.prepare("UPDATE suppliers SET linked_user_id = ?, updated_at = datetime('now') WHERE id = ?").bind(userId, byEmail.id).run().catch(swallow('supplier-auth:link-user'));
        sup = byEmail;
      }
    }
    // 3) 신규 유저 — 사업자 정보로 제조회원 행 생성(status='pending', 어드민 승인 대기).
    //   🏭 2026-06-08: 빈 body 자동 probe(로그인/카탈로그 후 '기존 제조회원 자동연결' 시도)는 에러가 아니라
    //   '가입 필요' 상태 — 신규 유저에게 400(콘솔 에러·오해) 대신 needs_registration(200) 반환.
    //   사업자 정보가 하나라도 들어온 실제 신청만 아래 필드 검증으로 400 처리. (유통회원 /become-distributor 와 대칭)
    if (!sup) {
      if (!business_name && !business_number && !business_license_url) {
        return c.json({ success: true, status: 'needs_registration', message: '제조회원 입점 신청(사업자 정보)이 필요합니다' });
      }
      if (!email) return c.json({ success: false, error: '이메일 정보가 필요합니다. 카카오 이메일 제공에 동의해주세요' }, 400);
      if (!business_name) return c.json({ success: false, error: '상호(사업자명)를 입력해주세요' }, 400);
      if (!/^\d{3}-\d{2}-\d{5}$/.test(business_number)) return c.json({ success: false, error: '사업자등록번호를 정확히 입력해주세요 (000-00-00000)' }, 400);
      if (!business_license_url) return c.json({ success: false, error: '사업자등록증 이미지를 업로드해주세요' }, 400);
      // 🛡️ 2026-06-10 (인적사항 게이트 보강): 대표자/담당자 서버 필수 — 유통 become-distributor 와 대칭.
      if (!representative || !representative_phone) return c.json({ success: false, error: '대표자 성명·연락처를 입력해주세요' }, 400);
      if (!manager_name || !manager_phone) return c.json({ success: false, error: '담당자 성명·연락처를 입력해주세요' }, 400);

      // 같은 이메일로 이미 가입된(연결 안 된) 제조회원이 있으나 미verified 라 위 자동연결을 못 탄 경우 → 중복 생성 방지.
      const dupe = await DB.prepare('SELECT id FROM suppliers WHERE email = ? LIMIT 1').bind(email).first<{ id: number }>().catch(() => null);
      if (dupe) return c.json({ success: false, error: '이미 가입된 이메일입니다. 로그인해주세요' }, 409);

      // 🏬 멀티-몰: 가입 대상 몰 = host(또는 ?mall=slug). 기본(단일 호스트) 환경은 1 → 동작 불변.
      const mallId = await registrationMallId(c);
      // password_hash='' — 카카오 인증(비밀번호 미사용). linked_user_id 로 세션 연결.
      const nts2 = await ntsStatusOf(c.env, DB, business_number)
      const ins = await DB.prepare(`
        INSERT INTO suppliers (business_name, business_number, representative, email, phone, password_hash,
          business_license_url, representative_phone, manager_name, manager_phone, manager_email,
          linked_user_id, mall_id, nts_status, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'), datetime('now'))
      `).bind(
        business_name, business_number, representative || null, email, phone || null,
        business_license_url || null, representative_phone || null, manager_name || null, manager_phone || null, manager_email || null,
        userId, mallId, nts2,
      ).run();
      const sid = Number(ins.meta?.last_row_id);
      if (!sid) return c.json({ success: false, error: '제조회원 신청 중 오류가 발생했습니다' }, 500);

      // 어드민 승인 큐 알림 (/admin/suppliers 에서 처리). fail-soft.
      createDashboardNotification(DB, 'admin', null, 'supplier_pending', '제조회원 승인 요청',
        `${business_name} (${business_number})${nts2 ? ` — 국세청: ${nts2}` : ' — 국세청: 조회 안 됨'}`, '/admin/suppliers').catch(swallowNotify('become:notify'));

      return c.json({ success: true, status: 'pending', message: '제조회원 가입 신청이 완료되었습니다. 사업자 정보 확인 후 관리자 승인되면 이용할 수 있습니다.' });
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
    // 🔐 단일 세션 강제 — 제조회원 전환(=첫 로그인) 시 세션 시작.
    await startDashboardSession(c.env.DB, 'supplier', sup.id, nowSec, { userAgent: c.req.header('User-Agent'), ip: c.req.header('CF-Connecting-IP') });
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

    // 🔐 단일 세션 강제 — 이 로그인 이전 발급된 supplier 토큰 전부 무효화.
    await startDashboardSession(c.env.DB, 'supplier', supplier.id, nowSec, { userAgent: c.req.header('User-Agent'), ip: c.req.header('CF-Connecting-IP') });

    return c.json({
      success: true,
      data: { token, supplier: { id: supplier.id, business_name: supplier.business_name, email: supplier.email } },
    });
  } catch (err) {
    return safeError(c, err, '로그인 처리 중 오류가 발생했습니다', '[supplier-auth]');
  }
});
