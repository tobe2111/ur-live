/**
 * 🛡️ 2026-04-28 TD-006 (split): Seller Registration & Switch (5 endpoints)
 *
 * 원본 위치: seller-management.routes.ts (178-617). cohesive auth/registration 블록.
 *
 * - POST /register             — 이메일·비번 셀러 가입
 * - POST /register-from-user   — 카카오 유저 → 셀러 변환 (임시 비번)
 * - GET  /my-seller-status     — 현재 사용자가 셀러인지 + 정보
 * - POST /switch-to-seller     — 동일 user 가 셀러 컨텍스트로 전환
 * - POST /switch-to-user       — 셀러 → 일반 유저로 전환
 *
 * 마운트: app.route('/api/seller', sellerRegistrationRoutes) — 다른 /api/seller
 *   라우터 (kakao-link, alimtalk-mgmt, management) 와 path 겹침 0.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { sign, verify } from 'hono/jwt'
import { hashPassword, validatePasswordComplexity } from '@/lib/password'
import type { JWTPayload } from 'hono/utils/jwt/types'
import { ALLOWED_ORIGINS, DEFAULT_COMMISSION_RATE } from '@/shared/constants'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { getSellerIdFromToken, type SellerJWTPayload } from '@/lib/seller-shared'

type Bindings = { DB: D1Database; JWT_SECRET: string }

interface SellerRegisterRequest {
  username: string
  email: string
  password: string
  name: string
  business_name: string
  business_number: string
  phone: string
  address?: string
  description?: string
  youtube_email: string
  seller_type?: 'influencer' | 'store_owner' | 'both'
  invite_code?: string
}

export const sellerRegistrationRoutes = new Hono<{ Bindings: Bindings }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
//   서브라우터 wildcard 미들웨어가 같은 prefix 의 다른 라우터 경로 가로채는 버그 (Hono v4) 방지.

let _sellerColumnsEnsured = false
async function ensureSellerColumns(db: D1Database) {
  if (_sellerColumnsEnsured) return
  try { await db.prepare(`ALTER TABLE sellers ADD COLUMN linked_user_id INTEGER`).run() } catch { /* exists */ }
  try { await db.prepare(`ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'`).run() } catch { /* exists */ }
  _sellerColumnsEnsured = true
}

sellerRegistrationRoutes.post('/register', rateLimit({ action: 'seller_register', max: 5, windowSec: 3600 }), async (c) => {
  try {
    const body = await c.req.json<SellerRegisterRequest>();
    const { username, email, password, name, business_name, business_number, phone, address, description, youtube_email, seller_type } = body;

    // 필수 필드 검증
    if (!username || !email || !password || !name || !business_name || !business_number || !phone || !youtube_email) {
      return c.json({
        success: false,
        error: 'Missing required fields'
      }, 400);
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return c.json({
        success: false,
        error: 'Invalid email format'
      }, 400);
    }

    // 유튜브 구글 계정 이메일 형식 검증
    if (!emailRegex.test(youtube_email)) {
      return c.json({
        success: false,
        error: '유튜브 라이브에 사용할 구글 계정 이메일 형식이 올바르지 않습니다'
      }, 400);
    }

    // 비밀번호 강도 검증 (신규 가입: 10자 이상 + 대/소/숫자)
    const pwCheck = validatePasswordComplexity(password);
    if (!pwCheck.ok) {
      return c.json({
        success: false,
        error: pwCheck.error
      }, 400);
    }

    // 사업자번호 형식 검증 (XXX-XX-XXXXX)
    const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/;
    if (!businessNumberRegex.test(business_number)) {
      return c.json({
        success: false,
        error: 'Invalid business number format (XXX-XX-XXXXX)'
      }, 400);
    }

    const db = c.env.DB;

    // seller_type 컬럼 존재 보장
    try { await db.prepare("ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'").run() } catch { /* already exists */ }

    // 이메일 중복 확인
    const existingEmail = await db.prepare('SELECT id FROM sellers WHERE email = ?').bind(email).first();
    if (existingEmail) {
      return c.json({
        success: false,
        error: 'Email already exists'
      }, 409);
    }

    // 사용자명 중복 확인
    const existingUsername = await db.prepare('SELECT id FROM sellers WHERE username = ?').bind(username).first();
    if (existingUsername) {
      return c.json({
        success: false,
        error: 'Username already exists'
      }, 409);
    }

    // 비밀번호 해시화
    const passwordHash = await hashPassword(password);

    // seller_type 검증
    const validSellerTypes = ['influencer', 'store_owner', 'both'] as const;
    const resolvedSellerType = seller_type && validSellerTypes.includes(seller_type) ? seller_type : 'influencer';

    // 셀러 등록 (pending 상태로)
    const result = await db.prepare(`
      INSERT INTO sellers (
        username, email, password_hash, name, business_name, business_number,
        phone, address, description, youtube_email, seller_type, status, commission_rate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ${DEFAULT_COMMISSION_RATE}, datetime('now'), datetime('now'))
    `).bind(
      username,
      email,
      passwordHash,
      name,
      business_name,
      business_number,
      phone,
      address || null,
      description || null,
      youtube_email,
      resolvedSellerType
    ).run();

    if (!result.success) {
      throw new Error('Failed to create seller account');
    }

    // 🛡️ 2026-04-27 Phase 1-3: 영입 코드 자동 매핑
    const inviteCode = body.invite_code;
    if (inviteCode && result.meta.last_row_id) {
      try {
        const { consumeInviteCode } = await import('../../agency/api/agency-invites.routes');
        const sellerId = Number(result.meta.last_row_id);
        await consumeInviteCode(db, inviteCode, sellerId);
      } catch (e) {
        console.warn('[seller-register] invite_code mapping failed (non-fatal):', e);
      }
    }

    // 7. 셀러 가입 신청 → 어드민 대시보드 알림 + 신청자 알림톡
    createDashboardNotification(db, 'admin', null, 'seller_registered', '새 셀러 가입', `${name}`, '/admin/sellers').catch(swallow('seller:api:seller-management'));

    // 🛡️ 2026-04-28: 신청자에게 카카오 알림톡 (Aligo 환경변수 + 템플릿 등록 시 자동 동작)
    if (phone) {
      try {
        const { sendSystemAlimtalk } = await import('../../../lib/system-alimtalk');
        sendSystemAlimtalk(c.env, phone, 'seller_registered',
          `[유어딜] 안녕하세요 ${name}님,\n셀러 가입 신청이 접수되었어요.\n1~3일 내 검토 후 결과를 안내드립니다.`
        ).catch(swallow('seller-registration:applicant-alimtalk'));
      } catch { /* ignore */ }
    }

    return c.json({
      success: true,
      message: 'Seller registration successful. Waiting for admin approval.',
      seller: {
        username,
        email,
        name,
        business_name,
        status: 'pending'
      }
    }, 201);

  } catch (error) {
    console.error('Seller registration error:', error);
    const message = error instanceof Error ? error.message : 'Seller registration failed';
    return c.json({
      success: false,
      error: message
    }, 500);
  }
});

/**
 * POST /api/seller/register-from-user
 * 카카오 유저가 셀러 전환 신청 (같은 계정으로)
 * - 세션 쿠키로 인증된 유저만 가능
 * - linked_user_id로 users 테이블과 연결
 */
sellerRegistrationRoutes.post('/register-from-user', rateLimit({ action: 'seller_register_from_user', max: 5, windowSec: 3600 }), async (c) => {
  try {
    const db = c.env.DB;
    const jwtSecret = c.env.JWT_SECRET;

    // 🛡️ 카카오 user 세션 전용 — seller/agency 세션으로 잘못 전환 방지
    const { parseSessionCookie } = await import('../../../worker/utils/session');
    const cookieHeader = c.req.header('Cookie');
    const sessionUser = await parseSessionCookie(cookieHeader, jwtSecret, ['user']);
    if (!sessionUser) {
      return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
    }

    const userId = sessionUser.userId;

    await ensureSellerColumns(db);

    // 이미 연결된 셀러 계정이 있는지 확인
    const existing = await db.prepare('SELECT id, status FROM sellers WHERE linked_user_id = ?').bind(userId).first<Record<string, any>>();
    if (existing) {
      return c.json({
        success: false,
        error: existing.status === 'pending' ? '이미 셀러 전환 신청 중입니다. 관리자 승인을 기다려주세요.' : '이미 셀러 계정이 존재합니다.',
        seller_id: existing.id,
        status: existing.status,
      }, 409);
    }

    const body = await c.req.json<{
      business_name: string;
      business_number: string;
      phone: string;
      seller_type: 'influencer' | 'store_owner' | 'both';
      youtube_email?: string;
      description?: string;
    }>();

    const { business_name, business_number, phone, seller_type, youtube_email, description } = body;

    if (!business_name || !business_number || !phone) {
      return c.json({ success: false, error: '사업자명, 사업자번호, 연락처는 필수입니다' }, 400);
    }

    const businessNumberRegex = /^\d{3}-\d{2}-\d{5}$/;
    if (!businessNumberRegex.test(business_number)) {
      return c.json({ success: false, error: '사업자번호 형식이 올바르지 않습니다 (XXX-XX-XXXXX)' }, 400);
    }

    const validSellerTypes = ['influencer', 'store_owner', 'both'] as const;
    const resolvedSellerType = seller_type && validSellerTypes.includes(seller_type) ? seller_type : 'influencer';

    // 유저 정보 가져오기
    const user = await db.prepare('SELECT name, email FROM users WHERE id = ?').bind(userId).first<Record<string, any>>();
    const userName = user?.name || sessionUser.name || '셀러';
    const userEmail = user?.email || sessionUser.email || '';

    // 유저명 기반 username 생성 (중복 방지)
    let username = `user_${userId}`;
    const existingUsername = await db.prepare('SELECT id FROM sellers WHERE username = ?').bind(username).first();
    if (existingUsername) {
      username = `user_${userId}_${Date.now()}`;
    }

    // 이메일 중복 확인 — 이미 다른 셀러가 같은 이메일이면 suffix 추가
    let sellerEmail = userEmail;
    const existingEmail = await db.prepare('SELECT id FROM sellers WHERE email = ?').bind(sellerEmail).first();
    if (existingEmail) {
      sellerEmail = `seller_${userId}@ur-team.com`;
    }

    // 임시 비밀번호 생성 (유저는 카카오 로그인으로 셀러 전환하므로 직접 사용하지 않음)
    const { hashPassword } = await import('../../../lib/password');
    const tempPassword = crypto.getRandomValues(new Uint8Array(16));
    const tempPasswordStr = Array.from(tempPassword).map(b => b.toString(16).padStart(2, '0')).join('');
    const passwordHash = await hashPassword(tempPasswordStr);

    let result;
    try {
      result = await db.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, business_name, business_number,
          phone, description, youtube_email, seller_type, linked_user_id,
          status, commission_rate, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ${DEFAULT_COMMISSION_RATE}, datetime('now'), datetime('now'))
      `).bind(
        username, sellerEmail, passwordHash, userName, business_name, business_number,
        phone, description || null, youtube_email || null, resolvedSellerType, userId
      ).run();
    } catch (insertErr: any) {
      if (insertErr?.message?.includes('UNIQUE') || insertErr?.message?.includes('unique')) {
        return c.json({ success: false, error: '이미 셀러 전환 신청 중입니다' }, 409);
      }
      throw insertErr;
    }

    if (!result.success) {
      throw new Error('Failed to create seller account');
    }

    const { createDashboardNotification: notify } = await import('../../notifications/api/dashboard-notifications.routes');
    notify(db, 'admin', null, 'seller_registered', '유저→셀러 전환 신청', `${userName} (유저 #${userId})`, '/admin/sellers').catch(swallow('seller:api:seller-management'));

    return c.json({
      success: true,
      message: '셀러 전환 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.',
    }, 201);
  } catch (error) {
    console.error('Seller register-from-user error:', error);
    return c.json({ success: false, error: '셀러 전환 신청 중 오류가 발생했습니다' }, 500);
  }
});

/**
 * GET /api/seller/my-seller-status
 * 현재 유저의 셀러 전환 상태 확인
 */
sellerRegistrationRoutes.get('/my-seller-status', async (c) => {
  try {
    const db = c.env.DB;
    const jwtSecret = c.env.JWT_SECRET;

    // 🛡️ 카카오 user 세션에서만 조회 (seller/agency 세션으로 잘못 조회 방지).
    const { parseSessionCookie } = await import('../../../worker/utils/session');
    const cookieHeader = c.req.header('Cookie');
    const sessionUser = await parseSessionCookie(cookieHeader, jwtSecret, ['user']);
    if (!sessionUser) {
      return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
    }

    await ensureSellerColumns(db);

    let seller = await db.prepare(
      'SELECT id, status, seller_type, business_name FROM sellers WHERE linked_user_id = ?'
    ).bind(sessionUser.userId).first<Record<string, any>>();

    // 🛡️ 2026-05-07 (영구 fix): linked_user_id 없을 때 이메일 매칭으로 기존 셀러 발견 시 자동 연결.
    //   원인: 이전에 이메일/비번으로 셀러 등록한 사용자가 카카오 로그인 시 linked_user_id 가 null
    //   → "셀러 없음" 으로 잘못 표시 → 사용자에게 \"새로 등록하세요\" 라는 잘못된 안내.
    //   해결: 카카오 검증된 user.email 과 sellers.email 매칭 시 자동 link (보안: 카카오는 email 검증 의무).
    if (!seller) {
      try {
        const userRow = await db.prepare('SELECT email FROM users WHERE id = ?')
          .bind(sessionUser.userId).first<{ email: string | null }>();
        const userEmail = userRow?.email?.trim().toLowerCase();
        if (userEmail) {
          // 같은 이메일을 가진 셀러 — 단, 다른 user 에 이미 연결된 경우는 제외
          const matched = await db.prepare(
            `SELECT id, status, seller_type, business_name, linked_user_id
             FROM sellers
             WHERE LOWER(email) = ? AND (linked_user_id IS NULL OR linked_user_id = ?)`
          ).bind(userEmail, sessionUser.userId).first<Record<string, any>>();
          if (matched) {
            // 자동 연결 — 다음 호출부터는 linked_user_id 매칭으로 빠르게 조회됨
            if (!matched.linked_user_id) {
              try {
                await db.prepare(
                  "UPDATE sellers SET linked_user_id = ?, updated_at = datetime('now') WHERE id = ?"
                ).bind(sessionUser.userId, matched.id).run();
              } catch { /* 동시성 race — 다음 호출에서 정상화 */ }
            }
            seller = matched;
          }
        }
      } catch { /* 이메일 매칭 실패 — 정상 has_seller:false 흐름 */ }
    }

    if (!seller) {
      // 백워드 호환: `has_seller`(구) + `linked`(신) 둘 다 제공
      return c.json({ success: true, data: { has_seller: false, linked: false } });
    }

    return c.json({
      success: true,
      data: {
        // 구 스키마 (UserProfilePage)
        has_seller: true,
        seller_id: seller.id,
        status: seller.status,
        seller_type: seller.seller_type,
        business_name: seller.business_name,
        // 신 스키마 (SellerWaitingPage, SellerRegisterBusinessPage) — 에이전시 /my-agency-status 와 동일
        linked: true,
        seller: {
          id: seller.id,
          status: seller.status,
          seller_type: seller.seller_type,
          business_name: seller.business_name,
        },
      },
    });
  } catch (error) {
    if (import.meta.env.DEV) console.error('my-seller-status error:', error);
    return c.json({ success: false, error: '상태 확인 실패' }, 500);
  }
});

/**
 * POST /api/seller/switch-to-seller
 * 유저 → 셀러 세션 전환 (승인된 셀러만)
 * 세션 쿠키 유저가 linked_user_id로 연결된 셀러 JWT를 발급받음
 */
sellerRegistrationRoutes.post('/switch-to-seller', async (c) => {
  try {
    const db = c.env.DB;
    const jwtSecret = c.env.JWT_SECRET;

    const { parseSessionCookie } = await import('../../../worker/utils/session');
    const cookieHeader = c.req.header('Cookie');
    const sessionUser = await parseSessionCookie(cookieHeader, jwtSecret);
    if (!sessionUser) {
      return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
    }

    await ensureSellerColumns(db);

    const seller = await db.prepare(`
      SELECT id, username, email, name, business_name, status, commission_rate, seller_type
      FROM sellers WHERE linked_user_id = ?
    `).bind(sessionUser.userId).first<Record<string, any>>();

    if (!seller) {
      return c.json({ success: false, error: '연결된 셀러 계정이 없습니다' }, 404);
    }

    if (seller.status === 'pending') {
      return c.json({ success: false, error: '아직 관리자 승인 대기 중입니다', code: 'PENDING' }, 403);
    }
    if (seller.status === 'suspended') {
      return c.json({ success: false, error: '정지된 셀러 계정입니다', code: 'SUSPENDED' }, 403);
    }
    if (seller.status !== 'approved' && seller.status !== 'active') {
      return c.json({ success: false, error: '활성화되지 않은 셀러 계정입니다' }, 403);
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      sub: seller.id.toString(),
      seller_id: seller.id as number,
      email: seller.email,
      name: seller.name,
      username: seller.username,
      type: 'seller',
      status: seller.status,
      seller_type: (seller.seller_type as string) || 'influencer',
      iat: now,
      exp: now + (7 * 24 * 60 * 60),
    };
    const accessToken = await sign(payload, jwtSecret);
    const refreshPayload = { ...payload, exp: now + (30 * 24 * 60 * 60) };
    const refreshToken = await sign(refreshPayload, jwtSecret);

    return c.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        seller: {
          id: seller.id,
          username: seller.username,
          email: seller.email,
          name: seller.name,
          business_name: seller.business_name,
          status: seller.status,
          commission_rate: seller.commission_rate,
          seller_type: (seller.seller_type as string) || 'influencer',
        },
      },
    });
  } catch (error) {
    console.error('switch-to-seller error:', error);
    return c.json({ success: false, error: '셀러 전환 실패' }, 500);
  }
});

/**
 * POST /api/seller/switch-to-user
 * 셀러 → 유저 세션 복귀
 * 셀러 JWT로 인증된 요청에서 linked_user_id로 유저 정보 조회 후 세션 쿠키 발급
 */
sellerRegistrationRoutes.post('/switch-to-user', async (c) => {
  try {
    const db = c.env.DB;
    const jwtSecret = c.env.JWT_SECRET;

    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), jwtSecret);
    if (!sellerId) {
      return c.json({ success: false, error: '셀러 로그인이 필요합니다' }, 401);
    }

    await ensureSellerColumns(db);

    const seller = await db.prepare(
      'SELECT linked_user_id FROM sellers WHERE id = ?'
    ).bind(sellerId).first<Record<string, any>>();

    if (!seller?.linked_user_id) {
      return c.json({ success: false, error: '연결된 유저 계정이 없습니다' }, 404);
    }

    const user = await db.prepare(
      'SELECT id, name, email, profile_image FROM users WHERE id = ?'
    ).bind(seller.linked_user_id).first<Record<string, any>>();

    if (!user) {
      return c.json({ success: false, error: '유저 계정을 찾을 수 없습니다' }, 404);
    }

    const { createSessionCookie } = await import('../../../worker/utils/session');
    const sessionCookie = await createSessionCookie(
      user.id, user.name || '', user.email || '', user.profile_image || undefined, jwtSecret,
    );
    c.header('Set-Cookie', sessionCookie);

    return c.json({
      success: true,
      data: {
        user_id: user.id,
        user_name: user.name,
        user_email: user.email,
        profile_image: user.profile_image,
      },
    });
  } catch (error) {
    console.error('switch-to-user error:', error);
    return c.json({ success: false, error: '유저 전환 실패' }, 500);
  }
});
