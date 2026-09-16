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
import {DEFAULT_COMMISSION_RATE } from '@/shared/constants'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { swallow } from '@/worker/utils/swallow'
import { startDashboardSession } from '@/worker/utils/dashboard-session'
import { getSellerIdFromToken, type SellerJWTPayload } from '@/lib/seller-shared'
import { copyCuratorProfileToSeller, stampSignupStoreChannel } from './seller-signup-meta'
import { BIZ_CERT_PATH } from '../../../worker/utils/store-ownership-claims'
// 🔁 2026-09-16 (파일 분해): 상태 조회·세션 전환 3개는 별 파일로. 경로·순서 불변.
import { mountSellerSessionRoutes } from './seller-registration/session-routes'

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
  youtube_email?: string  // 🏁 2026-07-01: 라이브커머스 중단으로 선택 필드(미입력 허용)
  seller_type?: 'influencer' | 'store_owner' | 'both'
  invite_code?: string
}

export const sellerRegistrationRoutes = new Hono<{ Bindings: Bindings }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
//   서브라우터 wildcard 미들웨어가 같은 prefix 의 다른 라우터 경로 가로채는 버그 (Hono v4) 방지.

let _sellerColumnsEnsured = false
async function ensureSellerColumns(db: D1Database) {
  if (_done_ensureSellerColumns.has(db)) return
  _done_ensureSellerColumns.add(db)
  if (_sellerColumnsEnsured) return
  try { await db.prepare(`ALTER TABLE sellers ADD COLUMN linked_user_id INTEGER`).run() } catch { /* exists */ }
  try { await db.prepare(`ALTER TABLE sellers ADD COLUMN seller_type TEXT DEFAULT 'influencer'`).run() } catch { /* exists */ }
  // 🛡️ 2026-06-12 (감사 1단계): 거절 사유 — admin-tools reject 가 저장, /my-seller-status 가 반환.
  try { await db.prepare(`ALTER TABLE sellers ADD COLUMN reject_reason TEXT`).run() } catch { /* exists */ }
  _sellerColumnsEnsured = true
}

sellerRegistrationRoutes.post('/register', rateLimit({ action: 'seller_register', max: 5, windowSec: 3600 }), async (c) => {
  try {
    const body = await c.req.json<SellerRegisterRequest & {
      representative_name?: string
      business_start_date?: string
    }>();
    const { username, email, password, name, business_name, business_number, phone, address, description, youtube_email, seller_type } = body;
    const representative_name = body.representative_name?.trim()
    const business_start_date = body.business_start_date?.trim()
    // 🪪 2026-09-16 앞문 등록증 사본 — 뒷문(`/store/find`)은 필수인데 새 가게를 만드는 여기는
    //   증거를 한 장도 안 받았다. 국세청 API 는 상호·주소를 주지 않으므로(b_no·start_dt·p_nm 만)
    //   **기계 대조가 불가능**하고 어드민이 사진과 눈으로 대조해야 한다. 배경: 2026-09-16 handoff.
    //   경로가 우리 업로드 자리일 때만 저장한다 — 임의 URL 이면 어드민 화면이 남의 서버를 띄운다.
    const certUrl = String((body as { business_cert_url?: unknown }).business_cert_url || '').trim()
    const certStored = BIZ_CERT_PATH.test(certUrl) ? certUrl : null

    // 필수 필드 검증 (youtube_email 은 라이브커머스 중단으로 선택 필드)
    if (!username || !email || !password || !name || !business_name || !business_number || !phone) {
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

    // youtube_email 은 입력됐을 때만 형식 검증 (선택 필드)
    if (youtube_email && !emailRegex.test(youtube_email)) {
      return c.json({
        success: false,
        error: '구글 계정 이메일 형식이 올바르지 않습니다'
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

    // 🛡️ 2026-05-27 v2 (UX 영구 fix): NTS API 호출 비동기 처리 — 가입 응답 즉시 (5초 차단 X).
    //   기존: 동기 호출 → 가입 응답 5초 대기 → 모바일 UX 나쁨
    //   변경: status='pending' 으로 INSERT → waitUntil 비동기 검증 → 진위 일치 시 status='approved' UPDATE.
    //   대표자/개업일 미제공 또는 NTS_API_KEY 없으면 비동기 호출 skip (기존 pending 유지).
    const autoStatus: 'pending' | 'approved' = 'pending'  // 초기 pending — 비동기 검증 후 update
    const ntsResultJson: string | null = null
    const ntsVerifiedAt: string | null = null

    // 셀러 등록 (자동 승인 또는 pending)
    const result = await db.prepare(`
      INSERT INTO sellers (
        username, email, password_hash, name, business_name, business_number,
        phone, address, description, youtube_email, seller_type,
        representative_name, business_start_date, nts_verified_at, nts_verify_result,
        business_registration_image_url, business_registration_status,
        status, commission_rate, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${DEFAULT_COMMISSION_RATE}, datetime('now'), datetime('now'))
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
      youtube_email || null,
      resolvedSellerType,
      representative_name || null,
      business_start_date || null,
      ntsVerifiedAt,
      ntsResultJson,
      certStored,
      certStored ? 'pending' : null,   // 사본이 있어야 어드민 화면에 승인/반려가 뜬다
      autoStatus
    ).run();

    if (!result.success) {
      throw new Error('Failed to create seller account');
    }

    // 🛡️ 2026-05-27 (영업 검증 Layer 2): prospects 사전 등록 매칭.
    //   영업자가 prospects 에 사전 등록한 사장님이면 자동 introduced_by_X_id 매핑.
    //   매장 코드 입력 안 했어도 phone/email 매칭으로 영업자 자동 추적.
    if (result.meta.last_row_id) {
      try {
        const { matchProspectOnSignup } = await import('../../seller-prospects/api/seller-prospects.routes')
        const matched = await matchProspectOnSignup(db, Number(result.meta.last_row_id), phone, email)
        // 🌇 2026-09-05 에이전시 일몰 — 귀속 대상은 **영입자(users.id)** 하나뿐이다.
        //   옛 코드는 prospect 의 introducer_type 이 'agency' 면 `introduced_by_agency_id` 에 썼는데,
        //   그 값을 읽어 돈을 주던 코드(agency-store-intro-commission)가 통째로 삭제됐다.
        //   지금 쓰면 **아무도 안 읽는 칸에 적고 영입자 귀속은 놓치는** 최악이 된다 → 건너뛴다.
        //   (라이브 실측: introduced_by_agency_id 0명 · agency 타입 prospect 는 발급 경로 자체가 없다.)
        if (matched && matched.introducerType !== 'agency') {
          // 🛡️ 2026-05-28: 영입 commission 기본 기간 (docs/SERVICE_MODEL.md §3) — 크리에이터 6개월.
          //   어드민이 매장별로 referral_bonus_until 재설정 가능 (commission-settings).
          await db.prepare(
            `UPDATE sellers SET introduced_by_influencer_id = ?, introduced_at = datetime('now'),
                    referral_bonus_until = datetime('now', '+6 months') WHERE id = ?`
          ).bind(matched.introducerId, Number(result.meta.last_row_id)).run().catch(() => null)
        }
      } catch { /* graceful */ }
    }

    // 🔗 2026-06-23 (대표 결정 — 1단계 이상화): 로그인한 유저가 셀러 가입하면 가입 시점에 linked_user_id
    //   즉시 연결. 기존엔 미연결로 태어나 "같은 이메일 사후 매칭"에 의존 → 이메일 다르면 영영 미연결
    //   (tobe2111 사건의 근본 원인). 이제 카카오 user 세션이 있으면 이메일 무관하게 가입 즉시 연결.
    //   비로그인(순수 이메일/비번) 가입은 기존대로 미연결(추후 same-email 자동/수동 연결).
    //   idx_sellers_linked_user_unique(한 유저=한 셀러) 충돌 시 skip. 전 과정 fail-soft.
    if (result.meta.last_row_id) {
      try {
        const { parseSessionCookie } = await import('../../../worker/utils/session')
        const sessionUser = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user']).catch(() => null)
        const uid = sessionUser?.userId
        if (uid) {
          const already = await db.prepare('SELECT id FROM sellers WHERE linked_user_id = ? LIMIT 1').bind(uid).first()
          if (!already) {
            await db.prepare(
              `UPDATE sellers SET linked_user_id = ?, updated_at = datetime('now') WHERE id = ? AND (linked_user_id IS NULL OR linked_user_id = 0)`
            ).bind(uid, Number(result.meta.last_row_id)).run().catch(() => null)
          }
        }
      } catch { /* 비로그인/세션 없음 — 미연결 유지 */ }
    }

    // 🛡️ 2026-05-27 v2 (UX 영구 fix): NTS 진위확인 비동기 — 가입 응답 즉시, 검증은 background.
    // 🛡️ 2026-06-12 (사용자 결정 — "자동승인 말고 수동 승인"): NTS 일치여도 status 자동
    //   'approved' 전환 제거 — 모든 사업자 가입은 어드민 수동 승인. 검증 결과(nts_verify_result/
    //   nts_verified_at)는 계속 저장해 승인 화면의 참고 신호로만 사용(가짜 사업자번호 검수 보조).
    if (representative_name && business_start_date && result.meta.last_row_id) {
      const sellerId = Number(result.meta.last_row_id)
      const verifyAsync = async () => {
        try {
          const { ntsValidateBusiness } = await import('../../../worker/utils/nts-business-verify')
          const ntsKey = (c.env as { NTS_API_KEY?: string }).NTS_API_KEY
          const r = await ntsValidateBusiness(ntsKey, {
            businessNumber: business_number,
            startDate: business_start_date,
            representative: representative_name,
          })
          const resultJson = JSON.stringify({ valid: r.valid, status: r.status, message: r.message })
          // 진위 일치 시 nts_verified_at 기록(참고 신호) — status 는 건드리지 않음(수동 승인).
          if (r.autoApprovable) {
            await db.prepare(
              `UPDATE sellers SET nts_verified_at = datetime('now'), nts_verify_result = ?, updated_at = datetime('now') WHERE id = ?`
            ).bind(resultJson, sellerId).run().catch(() => null)
          } else {
            await db.prepare(
              `UPDATE sellers SET nts_verify_result = ?, updated_at = datetime('now') WHERE id = ?`
            ).bind(resultJson, sellerId).run().catch(() => null)
          }
        } catch { /* graceful — pending 유지 */ }
      }
      try {
        c.executionCtx.waitUntil(verifyAsync())
      } catch {
        // executionCtx 미가용 — 동기 호출 fallback (최후 수단)
        verifyAsync().catch(() => null)
      }
    }

    // 🌇 2026-09-04 에이전시 일몰 — `invite_code` 자동 매핑(=에이전시 초대코드) 삭제.
    //    코드는 `agencies` 를 JOIN 하고 `agency_sellers` 에 썼는데, 라이브 사용 이력이 0행이다
    //    (agency_invite_usage 0 · agency_sellers 0). 셀러 가입은 이 값 없이 그대로 동작한다.
    //    docs/design/store-operator-model.md

    // 🛡️ 2026-05-16: 인플루언서 매장 영입 referral (body.referred_by_influencer)
    //   인플 ID 가 있으면 sellers.referred_by_influencer + referral_bonus_until 자동 설정.
    //   기간은 platform_settings.seller_referral_bonus_months (default 6) 에서 읽음.
    const referredByInfluencer = (body as { referred_by_influencer?: string }).referred_by_influencer
    if (referredByInfluencer && result.meta.last_row_id && /^[a-zA-Z0-9_\-:]{1,64}$/.test(referredByInfluencer)) {
      try {
        const sellerId = Number(result.meta.last_row_id);
        const monthsRow = await db.prepare("SELECT value FROM platform_settings WHERE key = 'seller_referral_bonus_months'").first<{ value: string }>().catch(() => null);
        const months = Number(monthsRow?.value ?? 6);
        const until = new Date(Date.now() + months * 30 * 86400_000).toISOString();
        // ALTER 가능성 — try/catch
        try { await db.prepare("ALTER TABLE sellers ADD COLUMN referred_by_influencer TEXT").run(); } catch {}
        try { await db.prepare("ALTER TABLE sellers ADD COLUMN referral_bonus_until DATETIME").run(); } catch {}
        await db.prepare(
          "UPDATE sellers SET referred_by_influencer = ?, referral_bonus_until = ? WHERE id = ?"
        ).bind(referredByInfluencer, until, sellerId).run();
      } catch (e) {
        console.warn('[seller-register] referred_by_influencer mapping failed (non-fatal):', e);
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
      // 🛡️ 2026-05-21 Phase D-6: 인플루언서 입점 유치 — 사장님 가입 시 인플루언서 추천코드 입력.
      //   🌇 2026-09-05 에이전시 일몰 — `agency_intro_code` 삭제(발급 주체·대시보드가 없어졌다).
      influencer_intro_code?: string;
      // 📜 2026-07-05: 판매자 이용약관 v1.0 동의 (가입 화면 필수 체크)
      terms_agreed_version?: string;
    }>();

    const { business_name, business_number, phone, seller_type, youtube_email, description, influencer_intro_code } = body;

    if (!business_name || !business_number || !phone) {
      return c.json({ success: false, error: '사업자명, 사업자번호, 연락처는 필수입니다' }, 400);
    }

    // 📜 2026-07-05 판매자 이용약관 v1.0: 동의 없이는 판매 신청 불가 (동의 기록은 INSERT 후).
    const { isValidTermsVersion, recordTermsConsent } = await import('../../../worker/utils/terms-consent');
    if (!isValidTermsVersion(body.terms_agreed_version)) {
      return c.json({ success: false, error: '판매자 이용약관 동의가 필요합니다. 화면을 새로고침한 뒤 다시 시도해주세요.' }, 400);
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
    // 🏁 2026-06-17 (#2 정체성 연속성): 유저가 사업자 유저가 돼도 /u/{handle} 유어샵 정체성(배너/소개/
    //   사진/SNS)이 유지되도록, 큐레이터 프로필을 신규 셀러로 1회 복사할 준비. 컬럼 없는 env 대비 별도 try.
    let curatorProfile: Record<string, any> | null = null;
    try {
      curatorProfile = await db.prepare(
        'SELECT profile_image, bio, banner_url, instagram_url, youtube_url FROM users WHERE id = ?'
      ).bind(userId).first<Record<string, any>>();
    } catch { /* 프로필 컬럼 없는 env — 복사 생략 */ }

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

    // 🌇 2026-09-05 에이전시 일몰 — 이 문의 추천코드는 **영입자 코드 하나뿐**이다.
    //   옛 코드는 `agency_intro_code` 로 `agencies` 를 조회해 `introduced_by_agency_id` 를 채우고
    //   "한 가게 = 1개 lock-in" 이라며 둘 중 하나만 고르게 했는데, 에이전시 쪽 발급 주체(대시보드·
    //   초대 링크)가 전부 삭제돼 **고를 수 있는 코드가 하나로 줄었다** → 상호배제 자체가 사라진다.
    const hasInfluencerCode = !!(influencer_intro_code && influencer_intro_code.trim())

    // 🛡️ Phase D-6: 인플루언서 입점 유치 코드 매칭 (영구 commission lock-in).
    let introducedInfluencerId: number | null = null;
    if (resolvedSellerType === 'store_owner' && hasInfluencerCode) {
      const code = influencer_intro_code!.trim().toUpperCase().slice(0, 12);
      // 🛡️ 2026-05-27 (신모델 audit): sellers.status SSOT 는 'approved' (대부분 코드).
      //   기존: 'active' 만 매칭 → 대부분 셀러 approved → 매칭 0 → 인플루언서 영입 보너스 누락.
      //   레거시 호환: 둘 다 검사 (lib/api.ts kakao refresh 패턴과 일관).
      const infRow = await db.prepare(
        `SELECT id FROM sellers WHERE UPPER(intro_code) = ? AND seller_type IN ('influencer','both') AND status IN ('active','approved') LIMIT 1`
      ).bind(code).first<{ id: number }>().catch(() => null);
      if (infRow?.id) introducedInfluencerId = infRow.id;
    }

    // 본인 추천 코드 자동 생성 (인플루언서/both 만)
    const ownIntroCode = (resolvedSellerType === 'influencer' || resolvedSellerType === 'both')
      ? `INF-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
      : null;

    let result;
    try {
      result = await db.prepare(`
        INSERT INTO sellers (
          username, email, password_hash, name, business_name, business_number,
          phone, description, youtube_email, seller_type, linked_user_id,
          introduced_by_influencer_id, introduced_at,
          influencer_intro_code, intro_code,
          status, commission_rate, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ${DEFAULT_COMMISSION_RATE}, datetime('now'), datetime('now'))
      `).bind(
        username, sellerEmail, passwordHash, userName, business_name, business_number,
        phone, description || null, youtube_email || null, resolvedSellerType, userId,
        introducedInfluencerId,
        introducedInfluencerId ? new Date().toISOString() : null,
        introducedInfluencerId ? (influencer_intro_code || '').trim().toUpperCase().slice(0, 12) : null,
        ownIntroCode
      ).run();
    } catch (insertErr: any) {
      if (insertErr?.message?.includes('UNIQUE') || insertErr?.message?.includes('unique')) {
        return c.json({ success: false, error: '이미 셀러 전환 신청 중입니다' }, 409);
      }
      throw insertErr;
    }

    // 🌇 2026-09-05 에이전시 일몰 — 입점 통보를 받던 `/agency/introduced-stores` 대시보드가 없어졌다.

    if (!result.success) {
      throw new Error('Failed to create seller account');
    }

    // 🏁 2026-06-17 (#2 정체성 연속성): 큐레이터 프로필 → 신규 셀러 1회 복사(빈 값 skip). best-effort —
    //   컬럼 없는 env / 실패해도 가입은 성공. 승인되면 /u/{handle} 가 빈 셀러프로필 대신 큐레이터 브랜딩 유지.
    const newSellerId = result?.meta?.last_row_id;

    // 📜 판매자 이용약관 동의 기록 (fail-soft — 검증은 상단에서 이미 통과)
    recordTermsConsent(db, {
      subjectType: 'seller',
      subjectId: newSellerId ?? null,
      userId,
      slug: 'seller',
      version: body.terms_agreed_version as string,
      ip: c.req.header('CF-Connecting-IP') || null,
    }).catch(() => null);
    await copyCuratorProfileToSeller(db, newSellerId, curatorProfile);

    // 🏪 2026-09-04 (대표 "가입할 때 선택을 하잖아 — 그때 정해지면 되는거 아니야?"):
    //   매장 채널을 **가입 시점에 확정**한다. 이 폼엔 `/store/new` 의 "누가 운영하나요?" 질문이
    //   없어 그동안 미지정으로 남았고, 미지정은 중개(5%)로 떨어져 **직접 입점 사장님이 영원히 5%**
    //   였다. 🌇 2026-09-05 에이전시 일몰 후 이 문은 **언제나 직접**이다 — 카카오 user 세션 전용이라
    //   로그인한 본인이 자기 가게를 올리는 자리다(중개 매장은 `/store/new` 에서 채널을 골라 만든다).
    await stampSignupStoreChannel(db, newSellerId);

    const { createDashboardNotification: notify } = await import('../../notifications/api/dashboard-notifications.routes');
    // 🛡️ 2026-06-12 (감사 1단계): deep-link 교정 — /admin/sellers 는 클라 라우트에 없음 → 승인 페이지로.
    notify(db, 'admin', null, 'seller_registered', '유저→셀러 전환 신청', `${userName} (유저 #${userId})`, '/admin/seller-approval').catch(swallow('seller:api:seller-management'));

    return c.json({
      success: true,
      message: '셀러 전환 신청이 완료되었습니다. 관리자 승인 후 이용 가능합니다.',
    }, 201);
  } catch (error) {
    console.error('Seller register-from-user error:', error);
    return c.json({ success: false, error: '셀러 전환 신청 중 오류가 발생했습니다' }, 500);
  }
});


// 🔁 GET /my-seller-status · POST /switch-to-seller · POST /switch-to-user — 같은 인스턴스에 등록한다.
mountSellerSessionRoutes(sellerRegistrationRoutes, ensureSellerColumns)

// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureSellerColumns = new WeakSet<object>()
