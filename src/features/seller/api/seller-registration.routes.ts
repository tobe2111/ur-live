/**
 * 🛡️ 2026-04-28 TD-006 (split): Seller Registration & Switch (4 endpoints)
 *
 * 원본 위치: seller-management.routes.ts (178-617). cohesive auth/registration 블록.
 *
 * - POST /register             — 이메일·비번 셀러 가입
 * - GET  /my-seller-status     — 현재 사용자가 셀러인지 + 정보
 * - POST /switch-to-seller     — 동일 user 가 셀러 컨텍스트로 전환
 * - POST /switch-to-user       — 셀러 → 일반 유저로 전환
 *
 * 🪦 2026-10-12: POST /register-from-user 삭제 — 그 문을 부르던 가입 화면(/seller/register/supplier)이
 *   같은 날 지워졌고 가입 문은 /store/new 하나다. 되살리려면 git revert.
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
    createDashboardNotification(db, 'admin', null, 'seller_registered', '새 셀러 가입', `${name}`, '/admin/seller-approval').catch(swallow('seller:api:seller-management'));

    // 🛡️ 2026-04-28: 신청자에게 카카오 알림톡 (SENS 환경변수 + 템플릿 승인 시 자동 동작)
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


// 🔁 GET /my-seller-status · POST /switch-to-seller · POST /switch-to-user — 같은 인스턴스에 등록한다.
mountSellerSessionRoutes(sellerRegistrationRoutes, ensureSellerColumns)

// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureSellerColumns = new WeakSet<object>()
