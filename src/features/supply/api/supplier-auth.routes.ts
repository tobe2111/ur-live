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
import { sign, verify } from 'hono/jwt';
import { hashPassword, verifyPassword } from '@/lib/password';
import { rateLimit } from '@/worker/middleware/rate-limit';
import { requireAuth } from '@/worker/middleware/auth';
import { safeError } from '@/worker/utils/safe-error';
import { swallow } from '@/worker/utils/swallow';
import { dispatchSignupContract } from '@/worker/utils/signup-contract';
import { startDashboardSession, isDashboardSessionCurrent, deriveDashboardSeat } from '@/worker/utils/dashboard-session';
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
    'nts_status TEXT', // 🛡️ 2026-06-23 가입 500 fix — INSERT 가 nts_status 쓰는데 ntsStatusOf 실패 시 컬럼 부재 throw. 무조건 보장.
  ]) {
    await DB.prepare(`ALTER TABLE suppliers ADD COLUMN ${col}`).run().catch(() => { /* 이미 존재 */ });
  }
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_email ON suppliers(email) WHERE email IS NOT NULL').run().catch(swallow('supplier-auth:idx-email'));
  await DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_linked_user ON suppliers(linked_user_id) WHERE linked_user_id IS NOT NULL').run().catch(swallow('supplier-auth:idx-linked-user'));
}

// 🛡️ 2026-06-17 (로그인 영역 감사 — 제조사 refresh): 셀러/어드민과 동일한 auth_refresh_tokens
//   보조 테이블 사용(공유 스키마). 기존엔 supplier 토큰이 refresh 없이 30일 후 강제 재로그인이었음.
const _supplierRefreshTableEnsured = new WeakSet<object>();
async function ensureSupplierAuthRefreshTable(DB: D1Database): Promise<void> {
  if (_supplierRefreshTableEnsured.has(DB)) return;
  _supplierRefreshTableEnsured.add(DB);
  await DB.prepare(`CREATE TABLE IF NOT EXISTS auth_refresh_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_type TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    token_hash TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`).run().catch(swallow('supplier-auth:refresh-table'));
  await DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_auth_refresh_tokens_user ON auth_refresh_tokens(user_type, user_id)'
  ).run().catch(swallow('supplier-auth:refresh-idx'));
}

/**
 * supplier access(30일) + refresh(90일) 토큰 발급 + refresh 해시 저장(rotation 기반).
 * 셀러 패턴(seller.routes.ts) 미러링 — login / become(승인) / refresh 가 공통 사용.
 */
async function issueSupplierTokens(
  DB: D1Database,
  jwtSecret: string,
  sup: { id: number; business_name: string; email: string | null },
): Promise<{ token: string; refreshToken: string; iat: number }> {
  const nowSec = Math.floor(Date.now() / 1000);
  const base = { sub: String(sup.id), supplier_id: sup.id, email: sup.email, name: sup.business_name, type: 'supplier' as const };
  const token = await sign({ ...base, iat: nowSec, exp: nowSec + 30 * 24 * 60 * 60 }, jwtSecret);
  const refreshToken = await sign({ ...base, token_use: 'refresh', iat: nowSec, exp: nowSec + 90 * 24 * 60 * 60 }, jwtSecret);
  try {
    await ensureSupplierAuthRefreshTable(DB);
    const refreshHash = await hashPassword(refreshToken);
    await DB.prepare(
      `INSERT INTO auth_refresh_tokens (user_type, user_id, token_hash, expires_at) VALUES ('supplier', ?, ?, ?)`
    ).bind(sup.id, refreshHash, new Date((nowSec + 90 * 24 * 3600) * 1000).toISOString()).run();
  } catch (e) {
    if (import.meta.env.DEV) console.error('[supplier-auth] refresh token persist failed:', e);
  }
  return { token, refreshToken, iat: nowSec };
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
    // 🔢 2026-06-23: 하이픈 유무 무관 수용 — 숫자만 추출해 10자리 검증 후 하이픈 정규화 저장.
    const bizDigits = String(body.business_number || '').replace(/[^0-9]/g, '');
    if (!/^\d{10}$/.test(bizDigits)) return c.json({ success: false, error: '사업자등록번호 10자리를 정확히 입력해주세요' }, 400);
    const bizNum = `${bizDigits.slice(0, 3)}-${bizDigits.slice(3, 5)}-${bizDigits.slice(5)}`;
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

    // 🖋️ 2026-06-22: 가입 시 전자계약서 자동발송(모두싸인 카카오). fail-soft — 미설정/실패가 가입 안 막음.
    const supplierId = Number(result.meta.last_row_id)
    if (supplierId) {
      dispatchSignupContract(c, { accountType: 'supplier', accountId: supplierId, signerName: body.representative || managerName, signerPhone: body.phone || managerPhone || representativePhone, businessName })
    }

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
    const name = (authed.name || u?.name || '제조사').trim();
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
        return c.json({ success: true, status: 'needs_registration', message: '제조사 입점 신청(사업자 정보)이 필요합니다' });
      }
      if (!email) return c.json({ success: false, error: '이메일 정보가 필요합니다. 카카오 이메일 제공에 동의해주세요' }, 400);
      if (!business_name) return c.json({ success: false, error: '상호(사업자명)를 입력해주세요' }, 400);
      if (!/^\d{10}$/.test(business_number.replace(/[^0-9]/g, ''))) return c.json({ success: false, error: '사업자등록번호 10자리를 정확히 입력해주세요' }, 400);
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
      if (!sid) return c.json({ success: false, error: '제조사 신청 중 오류가 발생했습니다' }, 500);

      // 어드민 승인 큐 알림 (/admin/suppliers 에서 처리). fail-soft.
      createDashboardNotification(DB, 'admin', null, 'supplier_pending', '제조사 승인 요청',
        `${business_name} (${business_number})${nts2 ? ` — 국세청: ${nts2}` : ' — 국세청: 조회 안 됨'}`, '/admin/suppliers').catch(swallowNotify('become:notify'));

      return c.json({ success: true, status: 'pending', message: '제조사 가입 신청이 완료되었습니다. 사업자 정보 확인 후 관리자 승인되면 이용할 수 있습니다.' });
    }
    // 승인 전이면 토큰 없이 대기 안내.
    if (sup.status !== 'approved') {
      return c.json({ success: true, status: sup.status, message: sup.status === 'pending' ? '관리자 승인 대기 중입니다' : '이용할 수 없는 계정 상태입니다' });
    }
    // 승인됨 → supplier_token + refresh 발급 (login 과 동일 경로).
    const { token, refreshToken, iat } = await issueSupplierTokens(DB, c.env.JWT_SECRET, sup);
    // 🔐 단일 세션 강제 — 제조회원 전환(=첫 로그인) 시 세션 시작. 토큰 iat 와 동일 값(자기 토큰 거부 방지).
    await startDashboardSession(c.env.DB, 'supplier', sup.id, iat, { userAgent: c.req.header('User-Agent'), ip: c.req.header('CF-Connecting-IP') });
    // 🔐 2026-06-17 쿠키 전환 Phase 1: ud_supplier_token dual-write (GET 전용 읽기 — Bearer 흐름 불변).
    try {
      const { authTokenSetCookie } = await import('../../../worker/utils/auth-cookies');
      c.header('Set-Cookie', authTokenSetCookie('ud_supplier_token', token, new URL(c.req.url).hostname), { append: true });
    } catch { /* dual-write 실패해도 로그인 정상 */ }
    return c.json({ success: true, status: 'approved', data: { token, refreshToken, supplier: { id: sup.id, business_name: sup.business_name, email: sup.email } } });
  } catch (err) {
    return safeError(c, err, '제조사 전환 중 오류가 발생했습니다', '[supplier-auth]');
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

    const { token, refreshToken, iat } = await issueSupplierTokens(DB, c.env.JWT_SECRET, supplier);

    // 🔐 단일 세션 강제 — 이 로그인 이전 발급된 supplier 토큰 전부 무효화. 토큰 iat 와 동일 값(자기 토큰 거부 방지).
    await startDashboardSession(c.env.DB, 'supplier', supplier.id, iat, { userAgent: c.req.header('User-Agent'), ip: c.req.header('CF-Connecting-IP') });

    // 🔐 2026-06-17 쿠키 전환 Phase 1: ud_supplier_token dual-write (GET 전용 읽기 — Bearer 흐름 불변).
    try {
      const { authTokenSetCookie } = await import('../../../worker/utils/auth-cookies');
      c.header('Set-Cookie', authTokenSetCookie('ud_supplier_token', token, new URL(c.req.url).hostname), { append: true });
    } catch { /* dual-write 실패해도 로그인 정상 */ }

    return c.json({
      success: true,
      data: { token, refreshToken, supplier: { id: supplier.id, business_name: supplier.business_name, email: supplier.email } },
    });
  } catch (err) {
    return safeError(c, err, '로그인 처리 중 오류가 발생했습니다', '[supplier-auth]');
  }
});

// ── POST /refresh — supplier access token 갱신 (rotation + reuse 감지) ─────────
// 🛡️ 2026-06-17 (로그인 영역 감사): 셀러/어드민과 동일하게 refresh 흐름 추가.
//   기존엔 supplier 토큰이 30일 후 만료되면 무조건 재로그인이었음(refresh 부재). 이제 access 만료 시
//   클라(supplier-api.ts)가 이 엔드포인트로 갱신 → 90일 refresh 동안 자동 유지.
//   레거시(이 배포 전 로그인) 사용자는 client 에 refresh 토큰이 없어 1회 재로그인 후부터 적용(자연 마이그레이션).
supplierAuthRoutes.post('/refresh', cors(), rateLimit({ action: 'supplier_refresh', max: 30, windowSec: 300 }), async (c) => {
  const { DB, JWT_SECRET } = c.env;
  try {
    const body = await c.req.json<{ refreshToken?: string }>().catch(() => ({} as { refreshToken?: string }));
    const refreshToken = body.refreshToken;
    if (!refreshToken) return c.json({ success: false, error: 'Refresh Token이 필요합니다', code: 'NO_REFRESH_TOKEN' }, 400);

    // 1) JWT 서명 + 만료 검증 (hono verify 는 만료 시 throw)
    let payload: Record<string, unknown>;
    try {
      payload = await verify(refreshToken, JWT_SECRET, 'HS256') as Record<string, unknown>;
    } catch {
      return c.json({ success: false, error: 'Refresh Token이 유효하지 않습니다', code: 'INVALID_REFRESH_TOKEN' }, 401);
    }
    if (payload.type !== 'supplier' || !payload.supplier_id) {
      return c.json({ success: false, error: 'Refresh Token이 유효하지 않습니다', code: 'INVALID_REFRESH_TOKEN' }, 401);
    }
    const supplierId = Number(payload.supplier_id);

    // 2) 계정 상태 확인 (정지/미승인 → 갱신 거부)
    const supplier = await DB.prepare(
      'SELECT id, business_name, email, status FROM suppliers WHERE id = ? LIMIT 1'
    ).bind(supplierId).first<{ id: number; business_name: string; email: string | null; status: string }>().catch(() => null);
    if (!supplier) return c.json({ success: false, error: '계정을 찾을 수 없습니다', code: 'NOT_FOUND' }, 401);
    if (supplier.status !== 'approved') {
      return c.json({ success: false, error: '이용할 수 없는 계정 상태입니다', code: 'SUPPLIER_NOT_APPROVED' }, 403);
    }

    // 2.5) 단일 세션 강제 (seller.routes.ts 패턴) — 더 늦게 로그인한 기기가 이 세션을 무효화했으면
    //   오래된 refresh 토큰(작은 iat)으로 되돌아오지 못하게 차단. 없으면 "쫓겨난 기기가 refresh 로 복귀"
    //   → 단일 세션 우회. (fail-open: 추적행 없음/레거시/D1 장애는 통과.)
    const seat = deriveDashboardSeat(payload);
    if (seat && !(await isDashboardSessionCurrent(DB, seat.role, seat.id, typeof payload.iat === 'number' ? payload.iat : undefined))) {
      return c.json({ success: false, error: '다른 기기에서 로그인되어 세션이 만료되었습니다', code: 'SESSION_SUPERSEDED' }, 401);
    }

    // 3) 저장된 refresh 해시 검증 + rotation (seller.routes.ts 패턴)
    try {
      await ensureSupplierAuthRefreshTable(DB);
      const rows = await DB.prepare(
        `SELECT id, token_hash FROM auth_refresh_tokens WHERE user_type = 'supplier' AND user_id = ?`
      ).bind(supplierId).all<{ id: number; token_hash: string }>();
      const candidates = rows.results || [];
      if (candidates.length > 0) {
        let matchedId: number | null = null;
        for (const row of candidates) {
          const { valid } = await verifyPassword(refreshToken, row.token_hash);
          if (valid) { matchedId = row.id; break; }
        }
        if (matchedId === null) {
          if (import.meta.env.DEV) console.warn('[Supplier Refresh] refresh token not recognized (revoked or reused)');
          return c.json({ success: false, error: 'Refresh Token이 유효하지 않습니다', code: 'INVALID_REFRESH_TOKEN' }, 401);
        }
        const del = await DB.prepare('DELETE FROM auth_refresh_tokens WHERE id = ?').bind(matchedId).run();
        if (!del.meta?.changes) {
          return c.json({ success: false, error: '토큰 갱신에 실패했습니다. 다시 로그인해주세요', code: 'TOKEN_ROTATION_FAILED' }, 401);
        }
      }
      // candidates.length === 0 → 레거시(저장된 해시 없음). JWT 서명/만료는 이미 검증됨 → 신규 발급 허용(자연 마이그레이션).
    } catch (e) {
      if (import.meta.env.DEV) console.error('[Supplier Refresh] token store verify failed:', e);
      return c.json({ success: false, error: '토큰 검증에 실패했습니다', code: 'TOKEN_VERIFY_FAILED' }, 500);
    }

    // 4) 새 access + refresh 발급 (issueSupplierTokens 가 새 refresh 해시 저장)
    const { token, refreshToken: newRefreshToken } = await issueSupplierTokens(DB, JWT_SECRET, supplier);
    return c.json({ success: true, data: { accessToken: token, refreshToken: newRefreshToken } });
  } catch (err) {
    return safeError(c, err, '토큰 갱신 중 오류가 발생했습니다', '[supplier-auth]');
  }
});
