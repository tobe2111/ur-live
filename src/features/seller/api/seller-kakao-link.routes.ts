/**
 * 🛡️ 2026-04-28 TD-006 (split): Seller ↔ Kakao 계정 연동 API
 *
 * 원본 위치: seller-management.routes.ts (1970-2103). 자체 helper 사용 + DB/JWT 만 의존.
 *
 * - POST /api/seller/link-kakao    — 이메일 셀러가 카카오 계정 연동
 * - POST /api/seller/unlink-kakao  — 연동 해제 (현재 비번 검증)
 * - GET  /api/seller/kakao-link-status — 연동 상태 + 연동된 유저 정보
 */
import { Hono } from 'hono'
import { verify } from 'hono/jwt'
import type { JWTPayload } from 'hono/utils/jwt/types'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  KAKAO_REST_API_KEY?: string
}

export const sellerKakaoLinkRoutes = new Hono<{ Bindings: Bindings }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
//   서브라우터 wildcard 미들웨어가 같은 prefix 의 다른 라우터 경로 가로채는 버그 (Hono v4) 방지.

/**
 * POST /api/seller/link-kakao
 * 🛡️ 이메일/비번으로 로그인한 셀러가 자신의 계정을 카카오에 연동.
 * 완료 후엔 카카오 로그인만으로도 같은 셀러 계정 접근 가능.
 */
sellerKakaoLinkRoutes.post('/link-kakao', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

    const DB = c.env.DB

    const seller = await DB.prepare(
      'SELECT id, linked_user_id FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ id: number; linked_user_id: number | null }>()
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404)
    if (seller.linked_user_id) {
      return c.json({ success: false, error: '이미 카카오 계정이 연동되어 있습니다.' }, 409)
    }

    // 두 가지 연동 모드 지원:
    //  1) 세션 기반 (권장, 팝업 플로우): body 비움 → /auth/kakao/sync/callback 이 이미
    //     세션 쿠키를 세팅했으니 그 userId 를 그대로 linked_user_id 로 사용.
    //  2) code 기반 (구 플로우 호환): code + redirect_uri 전달 → 서버에서 exchange.
    const body = await c.req.json<{ code?: string; redirect_uri?: string }>().catch(() => ({} as { code?: string; redirect_uri?: string }))

    let kakaoUserId: number | null = null
    let kakaoUserInfo: { name?: string; email?: string } = {}

    if (body.code) {
      const kakaoKey = c.env.KAKAO_REST_API_KEY
      if (!kakaoKey) return c.json({ success: false, error: '카카오 API 설정 누락' }, 500)
      const { KakaoAuthService } = await import('../../auth/services/KakaoAuthService')
      const kakao = new KakaoAuthService(DB, kakaoKey)
      const tokenData = await kakao.exchangeCodeFull(body.code, body.redirect_uri || '')
      const kakaoUser = await kakao.getUserInfo(tokenData.access_token)
      const user = await kakao.upsertUser(kakaoUser)
      kakaoUserId = user.id
      kakaoUserInfo = { name: user.name, email: user.email }
    } else {
      // 세션 쿠키에서 kakao user 추출
      const { parseSessionCookie } = await import('../../../worker/utils/session')
      const sessionUser = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user'])
      if (!sessionUser) {
        return c.json({ success: false, error: '카카오 로그인이 필요합니다. 팝업에서 카카오 인증을 완료해주세요.' }, 400)
      }
      const userId = Number(sessionUser.userId)
      if (!Number.isFinite(userId)) {
        return c.json({ success: false, error: '세션이 유효하지 않습니다.' }, 400)
      }
      kakaoUserId = userId
      kakaoUserInfo = { name: sessionUser.name, email: sessionUser.email }
    }

    const otherLink = await DB.prepare(
      'SELECT id FROM sellers WHERE linked_user_id = ? AND id != ?'
    ).bind(kakaoUserId, sellerId).first<{ id: number }>()
    if (otherLink) {
      return c.json({ success: false, error: '이 카카오 계정은 이미 다른 셀러 계정에 연동되어 있습니다.' }, 409)
    }

    await DB.prepare(
      "UPDATE sellers SET linked_user_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(kakaoUserId, sellerId).run()

    return c.json({
      success: true,
      message: '카카오 계정 연동 완료',
      data: { user_id: kakaoUserId, user_name: kakaoUserInfo.name, user_email: kakaoUserInfo.email },
    })
  } catch (err) {
    return safeError(c, err, '카카오 연동 중 오류가 발생했습니다', '[seller link-kakao]')
  }
})

/**
 * POST /api/seller/relink-kakao — 🔁 2026-07-20 (대표 "가장 이상적으로") 카카오 계정 교체 원스텝 재연결.
 *
 * 시나리오: 사장님이 폰/카카오 계정이 바뀌어 옛 카카오로 로그인 불가 → 기존엔
 *   [이메일 로그인 → unlink(비번) → link] 3단계 + 발견 불가. 이걸 한 번에:
 *   새 카카오로 소비자 로그인(세션 쿠키) 상태에서 기존 셀러 이메일+비밀번호만 넣으면
 *   셀러 연결을 새 카카오 계정으로 이전 + 셀러 토큰 즉시 발급.
 *
 * 보안: ① 새 카카오 세션 필수(쿠키 — same-origin, iOS-safe) ② 비밀번호 검증(소유 증명)
 *   ③ 이메일/비번 오류 메시지 통일(계정 열거 방지) ④ rate limit 5/15분
 *   ⑤ 이전 연결 유저에게 보안 통지(탈취 감지) ⑥ 새 유저가 이미 다른 셀러 보유면 409(1:1 유지)
 * 카카오로만 만들어 비밀번호가 없는 계정은 이 경로 불가 → 카카오채널 문의(어드민 수동 — UI 안내).
 */
sellerKakaoLinkRoutes.post('/relink-kakao', rateLimit({ action: 'seller_relink', max: 5, windowSec: 900 }), async (c) => {
  try {
    // ① 새 카카오 소비자 세션
    const { parseSessionCookie } = await import('../../../worker/utils/session')
    const sessionUser = await parseSessionCookie(c.req.header('Cookie'), c.env.JWT_SECRET, ['user'])
    const newUserId = sessionUser ? Number(sessionUser.userId) : NaN
    if (!Number.isFinite(newUserId)) {
      return c.json({ success: false, code: 'KAKAO_LOGIN_REQUIRED', error: '새 카카오 계정으로 먼저 로그인해주세요.' }, 401)
    }
    const body = await c.req.json<{ email?: string; password?: string }>().catch(() => ({} as { email?: string; password?: string }))
    const email = String(body.email || '').trim()
    const password = String(body.password || '')
    if (!email || !password) return c.json({ success: false, error: '이메일과 비밀번호를 입력해주세요.' }, 400)

    // ②③ 비밀번호 검증 — 실패 사유 불문 동일 메시지(열거 방지)
    const FAIL = { success: false, error: '이메일 또는 비밀번호가 올바르지 않습니다.' }
    const seller = await c.env.DB.prepare(
      'SELECT id, username, business_name, is_distributor, linked_user_id, password_hash FROM sellers WHERE LOWER(email) = LOWER(?)'
    ).bind(email).first<{ id: number; username: string | null; business_name: string | null; is_distributor: number; linked_user_id: number | null; password_hash: string | null }>()
    if (!seller?.password_hash) return c.json(FAIL, 401)
    const { verifyPassword } = await import('../../../lib/password')
    const { valid } = await verifyPassword(password, seller.password_hash)
    if (!valid) return c.json(FAIL, 401)

    // ⑥ 새 카카오 유저가 이미 다른 셀러와 연결(1:1 UNIQUE)
    const otherLink = await c.env.DB.prepare(
      'SELECT id FROM sellers WHERE linked_user_id = ? AND id != ?'
    ).bind(newUserId, seller.id).first<{ id: number }>()
    if (otherLink) {
      return c.json({ success: false, error: '이 카카오 계정은 이미 다른 셀러 계정에 연결되어 있습니다. 카카오채널로 문의해주세요.' }, 409)
    }

    const prevUserId = seller.linked_user_id
    if (prevUserId !== newUserId) {
      await c.env.DB.prepare(
        "UPDATE sellers SET linked_user_id = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(newUserId, seller.id).run()
      // ⑤ 이전 계정 보안 통지 — fail-soft(통지 실패가 재연결을 막지 않음)
      if (prevUserId) {
        c.executionCtx?.waitUntil((async () => {
          try {
            const { notifyUser } = await import('../../../lib/notifications')
            await notifyUser(c.env.DB, String(prevUserId), 'security',
              '셀러 계정 연결이 변경되었습니다',
              `${seller.business_name || '내 매장'} 셀러 계정이 다른 카카오 계정으로 재연결되었습니다. 본인이 아니라면 즉시 카카오채널로 문의해주세요.`,
              '/seller/login')
          } catch { /* fail-soft */ }
        })())
      }
    }

    // 셀러 토큰 즉시 발급 — 카카오 로그인과 동일 함수(발급 게이트/형식 재사용)
    const { issueLinkedRoleTokens } = await import('../../auth/api/kakao.routes')
    const tokens = await issueLinkedRoleTokens(c.env.DB, c.env.JWT_SECRET, newUserId)
    return c.json({ success: true, message: '재연결 완료 — 새 카카오 계정으로 셀러 대시보드를 쓸 수 있어요.', data: tokens })
  } catch (err) {
    return safeError(c, err, '재연결 처리 중 오류가 발생했습니다', '[seller relink-kakao]')
  }
})

/**
 * POST /api/seller/unlink-kakao — 연동 해제
 */
sellerKakaoLinkRoutes.post('/unlink-kakao', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)

    // 🛡️ 카카오 전용 생성된 셀러(/register-from-user 경로)는 임시 비번(랜덤 hex)이 저장돼 있어
    //   unlink 시 이메일 로그인 불가 → 영구 lockout. current_password 검증으로 방어.
    const body = await c.req.json<{ current_password?: string }>().catch(() => ({} as { current_password?: string }))
    if (!body.current_password) {
      return c.json({
        success: false,
        error: '현재 비밀번호 확인이 필요합니다. 비밀번호가 없다면 먼저 "비밀번호 찾기" 로 설정해주세요.',
        code: 'PASSWORD_REQUIRED'
      }, 400)
    }

    const seller = await c.env.DB.prepare(
      'SELECT password_hash FROM sellers WHERE id = ?'
    ).bind(sellerId).first<{ password_hash: string }>()
    if (!seller) return c.json({ success: false, error: '셀러를 찾을 수 없습니다' }, 404)

    const { verifyPassword } = await import('../../../lib/password')
    const ok = await verifyPassword(body.current_password, seller.password_hash)
    if (!ok) return c.json({ success: false, error: '비밀번호가 틀렸습니다' }, 401)

    await c.env.DB.prepare(
      "UPDATE sellers SET linked_user_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).bind(sellerId).run()
    return c.json({ success: true, message: '카카오 연동이 해제되었습니다.' })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-kakao-link]')
  }
})

/**
 * GET /api/seller/kakao-link-status
 */
sellerKakaoLinkRoutes.get('/kakao-link-status', async (c) => {
  try {
    const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
    if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
    const row = await c.env.DB.prepare(`
      SELECT s.linked_user_id, u.name as user_name, u.email as user_email, u.profile_image
      FROM sellers s LEFT JOIN users u ON u.id = s.linked_user_id WHERE s.id = ?
    `).bind(sellerId).first<{ linked_user_id: number | null; user_name?: string; user_email?: string; profile_image?: string }>()
    return c.json({
      success: true,
      data: row?.linked_user_id
        ? { linked: true, user: { id: row.linked_user_id, name: row.user_name, email: row.user_email, profile_image: row.profile_image } }
        : { linked: false }
    })
  } catch (err) {
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-kakao-link]')
  }
})
