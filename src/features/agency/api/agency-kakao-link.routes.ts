/**
 * 🛡️ 2026-04-28 TD-006 (split): Agency ↔ Kakao 계정 연동 API
 *
 * 원본 위치: agency.routes.ts (1867-1982).
 *
 * - POST /api/agency/link-kakao        — 에이전시 계정에 카카오 연동
 * - POST /api/agency/unlink-kakao      — 연동 해제 (현재 비번 검증)
 * - GET  /api/agency/kakao-link-status — 연동 상태
 *
 * 인증: requireAgency — lib/agency-shared.ts 의 통합 helper 사용 (2026-04-28 정리).
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { verifyPassword } from '@/lib/password'
import type { Env } from '@/worker/types/env'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import { requireAgency, type AgencyVars, type AgencyCtx } from '@/lib/agency-shared'

const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>()
// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
app.use('*', requireAgency)

app.post('/link-kakao', async (c: AgencyCtx) => {
  try {
    const agencyId = c.get('agency').id
    const DB = c.env.DB

    const agency = await DB.prepare(
      'SELECT id, linked_user_id FROM agencies WHERE id = ?'
    ).bind(agencyId).first<{ id: number; linked_user_id: number | null }>()
    if (!agency) return c.json({ success: false, error: '에이전시를 찾을 수 없습니다' }, 404)
    if (agency.linked_user_id) {
      return c.json({ success: false, error: '이미 카카오 계정이 연동되어 있습니다.' }, 409)
    }

    // 두 가지 연동 모드:
    //  1) 세션 기반 (권장, 팝업 플로우): body 비움 → 세션 쿠키의 userId 사용.
    //  2) code 기반 (구 플로우 호환): code + redirect_uri 전달.
    const body = await c.req.json<{ code?: string; redirect_uri?: string }>().catch(() => ({} as { code?: string; redirect_uri?: string }))

    let kakaoUserId: number | null = null
    let kakaoUserInfo: { name?: string; email?: string } = {}

    if (body.code) {
      const kakaoKey = (c.env as { KAKAO_REST_API_KEY?: string }).KAKAO_REST_API_KEY
      if (!kakaoKey) return c.json({ success: false, error: '카카오 API 설정 누락' }, 500)
      const { KakaoAuthService } = await import('../../auth/services/KakaoAuthService')
      const kakao = new KakaoAuthService(DB, kakaoKey)
      const tokenData = await kakao.exchangeCodeFull(body.code, body.redirect_uri || '')
      const kakaoUser = await kakao.getUserInfo(tokenData.access_token)
      const user = await kakao.upsertUser(kakaoUser)
      kakaoUserId = user.id
      kakaoUserInfo = { name: user.name, email: user.email }
    } else {
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
      'SELECT id FROM agencies WHERE linked_user_id = ? AND id != ?'
    ).bind(kakaoUserId, agencyId).first<{ id: number }>()
    if (otherLink) {
      return c.json({ success: false, error: '이 카카오 계정은 이미 다른 에이전시에 연동되어 있습니다.' }, 409)
    }

    await DB.prepare(
      "UPDATE agencies SET linked_user_id = ?, updated_at = datetime('now') WHERE id = ?"
    ).bind(kakaoUserId, agencyId).run()

    return c.json({
      success: true,
      message: '카카오 계정 연동 완료',
      data: { user_id: kakaoUserId, user_name: kakaoUserInfo.name, user_email: kakaoUserInfo.email },
    })
  } catch (err) {
    console.error('[agency link-kakao] error:', err)
    return c.json({ success: false, error: (err as Error).message || '카카오 연동 실패' }, 500)
  }
})

app.post('/unlink-kakao', async (c: AgencyCtx) => {
  try {
    const agencyId = c.get('agency').id

    // 🛡️ 카카오 전용 에이전시(/register-from-user)는 임시 비번만 있어 unlink 시 lockout.
    const body = await c.req.json<{ current_password?: string }>().catch(() => ({} as { current_password?: string }))
    if (!body.current_password) {
      return c.json({
        success: false,
        error: '현재 비밀번호 확인이 필요합니다. 비밀번호가 없다면 먼저 "비밀번호 찾기" 로 설정해주세요.',
        code: 'PASSWORD_REQUIRED'
      }, 400)
    }

    const agency = await c.env.DB.prepare(
      'SELECT password_hash FROM agencies WHERE id = ?'
    ).bind(agencyId).first<{ password_hash: string }>()
    if (!agency) return c.json({ success: false, error: '에이전시를 찾을 수 없습니다' }, 404)

    const ok = await verifyPassword(body.current_password, agency.password_hash)
    if (!ok) return c.json({ success: false, error: '비밀번호가 틀렸습니다' }, 401)

    await c.env.DB.prepare(
      "UPDATE agencies SET linked_user_id = NULL, updated_at = datetime('now') WHERE id = ?"
    ).bind(agencyId).run()
    return c.json({ success: true, message: '카카오 연동이 해제되었습니다.' })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

app.get('/kakao-link-status', async (c: AgencyCtx) => {
  try {
    const agencyId = c.get('agency').id
    const row = await c.env.DB.prepare(`
      SELECT a.linked_user_id, u.name as user_name, u.email as user_email, u.profile_image
      FROM agencies a LEFT JOIN users u ON u.id = a.linked_user_id WHERE a.id = ?
    `).bind(agencyId).first<{ linked_user_id: number | null; user_name?: string; user_email?: string; profile_image?: string }>()
    return c.json({
      success: true,
      data: row?.linked_user_id
        ? { linked: true, user: { id: row.linked_user_id, name: row.user_name, email: row.user_email, profile_image: row.profile_image } }
        : { linked: false }
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

export { app as agencyKakaoLinkRoutes }
