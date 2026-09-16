/**
 * 🔁 **셀러 세션 — 상태 조회 · 컨텍스트 전환** (2026-09-16 분해)
 *
 * `seller-registration.routes.ts` 가 764줄이 되어 CLAUDE.md 의 god 파일 룰(600줄)을 넘겼다.
 * 가입(`/register`, `/register-from-user`)과 **세션 전환**은 같은 파일에 있을 이유가 없다 —
 * 가입은 행을 만들고, 이쪽은 이미 있는 행으로 **누구로서 들어갈지**를 정한다.
 *
 * ## ⚠️ 이동뿐이다 — 로직은 한 줄도 안 바뀌었다
 * 경로 문자열·핸들러 본문·미들웨어·마운트 순서 전부 그대로다. 호출부는 `mountSellerSessionRoutes`
 * 한 줄로 같은 Hono 인스턴스에 등록하므로 **라우트 표가 종전과 동일**하다.
 *
 * ## ⚠️ `ensureSellerColumns` 는 주입받는다
 * 원본이 모듈 스코프 플래그 + `WeakSet` 으로 **DB 당 1회**를 보장한다. 여기서 다시 만들면
 * 그 메모가 두 벌이 되어 요청마다 `ALTER TABLE` 이 도는 날이 온다(CLAUDE.md 머니 룰의 per-request DDL).
 */
import type { Hono } from 'hono'
import { sign } from 'hono/jwt'
import { startDashboardSession } from '@/worker/utils/dashboard-session'
import { getSellerIdFromToken } from '@/lib/seller-shared'

type Bindings = { DB: D1Database; JWT_SECRET: string }

export function mountSellerSessionRoutes(
  app: Hono<{ Bindings: Bindings }>,
  ensureSellerColumns: (db: D1Database) => Promise<void>,
) {
  /**
   * GET /api/seller/my-seller-status
   * 현재 유저의 셀러 전환 상태 확인
   */
  app.get('/my-seller-status', async (c) => {
    try {
      const db = c.env.DB;
      const jwtSecret = c.env.JWT_SECRET;

      // 🛡️ 카카오 user 세션에서만 조회 (seller/agency 세션으로 잘못 조회 방지).
      const { parseSessionCookie } = await import('../../../../worker/utils/session');
      const cookieHeader = c.req.header('Cookie');
      const sessionUser = await parseSessionCookie(cookieHeader, jwtSecret, ['user']);
      if (!sessionUser) {
        return c.json({ success: false, error: '로그인이 필요합니다' }, 401);
      }

      await ensureSellerColumns(db);

      let seller = await db.prepare(
        'SELECT id, status, seller_type, business_name, reject_reason, business_registration_image_url FROM sellers WHERE linked_user_id = ?'
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
              `SELECT id, status, seller_type, business_name, reject_reason, linked_user_id
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

      // 🛡️ 2026-05-19: is_kakao_user flag — Kakao 로그인 유저의 경우 "셀러로 활동하기" 버튼 숨김 용도.
      let isKakaoUser = false
      try {
        const userRow = await db.prepare('SELECT kakao_id FROM users WHERE id = ?')
          .bind(sessionUser.userId).first<{ kakao_id: string | null }>()
        isKakaoUser = Boolean(userRow?.kakao_id)
      } catch { /* noop */ }

      if (!seller) {
        // 백워드 호환: `has_seller`(구) + `linked`(신) 둘 다 제공
        return c.json({ success: true, data: { has_seller: false, linked: false, is_kakao_user: isKakaoUser } });
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
            // 🛡️ 2026-06-12: 거절 사유 — SellerWaitingPage rejected 분기 표시.
            reject_reason: seller.reject_reason ?? null,
            // 🪪 2026-09-16: 등록증 사본이 도착했는가 — 없으면 대기 화면이 계속 알린다(당근 모델).
            //   URL 자체는 안 내려보낸다(필요 없고, 내보내면 남의 등록증 주소가 응답에 실린다).
            has_business_cert: !!seller.business_registration_image_url,
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
  app.post('/switch-to-seller', async (c) => {
    try {
      const db = c.env.DB;
      const jwtSecret = c.env.JWT_SECRET;

      const { parseSessionCookie } = await import('../../../../worker/utils/session');
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

      // 🥕 2026-09-16 (대표 — *"반려는 되더라도 쓸 수는 있게"*): 대기·반려도 대시보드에 들여보낸다.
      //   종전엔 `pending` 과 `rejected` 를 여기서 403 으로 막아, 사장님이 서류를 고쳐 내려고 해도
      //   **그 화면에 들어갈 수가 없었다**(대기 페이지만 보였다). 당근비즈니스는 반려돼도 들여보내고
      //   빨간 배너로 "다시 확인해주세요" 를 띄운다 — 고칠 사람이 고칠 자리에 있어야 한다.
      //
      //   ⚠️ **정지(`suspended`)는 계속 막는다.** 반려는 "서류가 아직"이고 정지는 "내보냈다" —
      //      둘을 같이 취급하면 징계가 무의미해진다.
      //   ⚠️ 승인 전 계정이 대시보드 안에서 **할 수 있는 일의 범위**는 여기가 아니라 각 기능이 정한다:
      //      유어애즈 DB = `ads-db-access.ts`(승인 필요) · 메인 노출 = `approvedSellerProductSql`.
      if (seller.status === 'suspended') {
        return c.json({ success: false, error: '정지된 셀러 계정입니다', code: 'SUSPENDED' }, 403);
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

      // 🔐 단일 세션 강제 — 가입 직후 자동 로그인도 세션 시작.
      await startDashboardSession(c.env.DB, 'seller', seller.id, payload.iat, { userAgent: c.req.header('User-Agent'), ip: c.req.header('CF-Connecting-IP') });

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
  app.post('/switch-to-user', async (c) => {
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

      const { createSessionCookie } = await import('../../../../worker/utils/session');
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
}
