/**
 * TikTok Login + Display API 통합 (T1)
 *
 * 마운트: /api/seller/tiktok
 * 마이그레이션: 0220_seller_platform_links.sql
 *
 * 흐름:
 *   1. GET  /auth-url           — OAuth state 생성 + TikTok login URL
 *   2. POST /callback           — code 수신 → access_token 교환 → user info → DB
 *   3. GET  /me                 — 현재 셀러의 연동 상태
 *   4. POST /sync-videos        — Display API 로 최근 비디오 동기화 (옵션)
 *   5. DELETE /unlink           — 연동 해제
 *
 * 환경변수 (선택, 없으면 graceful skip):
 *   TIKTOK_CLIENT_KEY     — TikTok for Developers 등록 후 받는 client key
 *   TIKTOK_CLIENT_SECRET  — client secret
 *
 * 정책:
 *   - 라이브 방송 데이터 / 정산 데이터는 Display API 로 못 가져옴 (TikTok 제한)
 *   - 비디오 (녹화) 만 가능
 *   - 셀러 인증 + username 표시 + 비디오 임베드가 핵심 가치
 *
 * 참조: docs/AGENCY_BACKSTAGE_LEARNING.md
 * 작성: 2026-04-26 (T1)
 */

import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'

const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize/'
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/'
const TIKTOK_USERINFO_URL = 'https://open.tiktokapis.com/v2/user/info/'
const TIKTOK_VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/'

const SCOPES = 'user.info.basic,user.info.profile,video.list'

interface TikTokEnv extends Env {
  TIKTOK_CLIENT_KEY?: string
  TIKTOK_CLIENT_SECRET?: string
  FRONTEND_URL?: string
}

const app = new Hono<{ Bindings: TikTokEnv }>()

function notConfigured(c: any) {
  return c.json({
    success: false,
    error: 'TikTok 통합이 활성화되지 않았습니다. TIKTOK_CLIENT_KEY/SECRET 등록 필요.',
    code: 'TIKTOK_NOT_CONFIGURED',
  }, 503)
}

// ── GET /auth-url ───────────────────────────────────
// 셀러가 클릭할 TikTok 로그인 URL + CSRF state 발급
app.get('/auth-url', requireAuth(), async (c) => {
  const env = c.env
  if (!env.TIKTOK_CLIENT_KEY) return notConfigured(c)

  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') {
    return c.json({ success: false, error: '셀러 인증 필요' }, 401)
  }

  // CSRF state — KV 또는 D1 에 5분 저장
  const state = crypto.randomUUID()
  if ((env as any).RATE_LIMIT_KV) {
    await (env as any).RATE_LIMIT_KV.put(`tiktok-state:${state}`, String(user.id), {
      expirationTtl: 300,
    })
  }

  const redirectUri = `${env.FRONTEND_URL || 'https://live.ur-team.com'}/seller/tiktok-callback`
  const url = new URL(TIKTOK_AUTH_URL)
  url.searchParams.set('client_key', env.TIKTOK_CLIENT_KEY)
  url.searchParams.set('scope', SCOPES)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('redirect_uri', redirectUri)
  url.searchParams.set('state', state)

  return c.json({ success: true, data: { auth_url: url.toString(), state } })
})

// ── POST /callback ──────────────────────────────────
// 프론트에서 ?code=xxx&state=xxx 받아서 백엔드로 전달
app.post('/callback', requireAuth(), async (c) => {
  const env = c.env
  if (!env.TIKTOK_CLIENT_KEY || !env.TIKTOK_CLIENT_SECRET) return notConfigured(c)

  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') {
    return c.json({ success: false, error: '셀러 인증 필요' }, 401)
  }

  const body = await c.req.json<{ code: string; state: string }>().catch(() => null)
  if (!body || !body.code || !body.state) {
    return c.json({ success: false, error: 'code, state 필수' }, 400)
  }

  // CSRF state 검증
  if ((env as any).RATE_LIMIT_KV) {
    const stored = await (env as any).RATE_LIMIT_KV.get(`tiktok-state:${body.state}`)
    if (!stored || stored !== String(user.id)) {
      return c.json({ success: false, error: '유효하지 않은 state' }, 400)
    }
    await (env as any).RATE_LIMIT_KV.delete(`tiktok-state:${body.state}`).catch(() => {})
  }

  const redirectUri = `${env.FRONTEND_URL || 'https://live.ur-team.com'}/seller/tiktok-callback`

  // 1. code → access_token 교환
  let tokenData: any
  try {
    const tokenRes = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_key: env.TIKTOK_CLIENT_KEY,
        client_secret: env.TIKTOK_CLIENT_SECRET,
        code: body.code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }),
    })
    tokenData = await tokenRes.json()
    if (!tokenRes.ok || !tokenData.access_token) {
      return c.json({ success: false, error: tokenData.error_description || 'TikTok 토큰 교환 실패' }, 502)
    }
  } catch (e) {
    return c.json({ success: false, error: '네트워크 오류' }, 502)
  }

  // 2. access_token → 사용자 정보
  let userInfo: any
  try {
    const infoRes = await fetch(`${TIKTOK_USERINFO_URL}?fields=open_id,union_id,avatar_url,display_name,username`, {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    })
    userInfo = await infoRes.json()
  } catch {
    return c.json({ success: false, error: 'TikTok 사용자 정보 조회 실패' }, 502)
  }

  const data = userInfo?.data?.user
  if (!data?.open_id) {
    return c.json({ success: false, error: 'TikTok 응답 형식 오류' }, 502)
  }

  // 3. DB 저장 (UPSERT)
  const expiresAt = new Date(Date.now() + (tokenData.expires_in || 86400) * 1000).toISOString()
  try {
    await c.env.DB.prepare(`
      INSERT INTO seller_platform_links
        (seller_id, platform, platform_user_id, username, display_name, avatar_url,
         access_token, refresh_token, token_expires_at, status, linked_at)
      VALUES (?, 'tiktok', ?, ?, ?, ?, ?, ?, ?, 'active', datetime('now'))
      ON CONFLICT (seller_id, platform) DO UPDATE SET
        platform_user_id = excluded.platform_user_id,
        username = excluded.username,
        display_name = excluded.display_name,
        avatar_url = excluded.avatar_url,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        token_expires_at = excluded.token_expires_at,
        status = 'active',
        sync_error = NULL,
        updated_at = datetime('now')
    `).bind(
      user.id, data.open_id, data.username, data.display_name, data.avatar_url,
      tokenData.access_token, tokenData.refresh_token || null, expiresAt,
    ).run()
  } catch (e) {
    return c.json({ success: false, error: 'seller_platform_links 미존재 — migration 0220 필요' }, 500)
  }

  return c.json({
    success: true,
    data: {
      platform: 'tiktok',
      username: data.username,
      display_name: data.display_name,
      avatar_url: data.avatar_url,
    },
  })
})

// ── GET /me ────────────────────────────────────────
// 현재 셀러의 TikTok 연동 상태
app.get('/me', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') {
    return c.json({ success: false, error: '셀러 인증 필요' }, 401)
  }

  try {
    const link = await c.env.DB.prepare(
      `SELECT platform_user_id, username, display_name, avatar_url, status,
              show_badge, last_synced_at, linked_at
         FROM seller_platform_links
        WHERE seller_id = ? AND platform = 'tiktok'`
    ).bind(user.id).first()
    return c.json({ success: true, data: link })
  } catch {
    return c.json({ success: true, data: null, _note: 'migration 0220 not applied' })
  }
})

// ── POST /sync-videos ──────────────────────────────
// Display API 로 최근 비디오 가져오기 (선택 — 셀러가 수동 트리거)
app.post('/sync-videos', requireAuth(), async (c) => {
  const env = c.env
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') {
    return c.json({ success: false, error: '셀러 인증 필요' }, 401)
  }
  if (!env.TIKTOK_CLIENT_KEY) return notConfigured(c)

  const link = await c.env.DB.prepare(
    "SELECT access_token, token_expires_at FROM seller_platform_links WHERE seller_id = ? AND platform = 'tiktok' AND status = 'active'"
  ).bind(user.id).first<{ access_token: string; token_expires_at: string }>()

  if (!link?.access_token) {
    return c.json({ success: false, error: 'TikTok 미연동' }, 400)
  }
  if (link.token_expires_at && new Date(link.token_expires_at) < new Date()) {
    await c.env.DB.prepare(
      "UPDATE seller_platform_links SET status = 'expired' WHERE seller_id = ? AND platform = 'tiktok'"
    ).bind(user.id).run().catch(() => {})
    return c.json({ success: false, error: '토큰 만료 — 재연동 필요', code: 'TOKEN_EXPIRED' }, 401)
  }

  try {
    const res = await fetch(`${TIKTOK_VIDEO_LIST_URL}?fields=id,title,cover_image_url,share_url,view_count,like_count,create_time`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${link.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ max_count: 20 }),
    })
    const json: any = await res.json()
    if (!res.ok) {
      return c.json({ success: false, error: json.error?.message || 'TikTok API 오류' }, 502)
    }

    await c.env.DB.prepare(
      "UPDATE seller_platform_links SET last_synced_at = datetime('now'), sync_error = NULL WHERE seller_id = ? AND platform = 'tiktok'"
    ).bind(user.id).run().catch(() => {})

    return c.json({
      success: true,
      data: {
        videos: json.data?.videos || [],
        cursor: json.data?.cursor,
        has_more: json.data?.has_more,
      },
    })
  } catch (e) {
    return c.json({ success: false, error: '비디오 조회 실패' }, 502)
  }
})

// ── GET /seller/:id/videos ─────────────────────────
// 공개 — 셀러 프로필에서 TikTok 비디오 위젯 표시용.
// 인증 불필요. show_badge=0 인 셀러는 빈 배열.
//
// ⚠️ 이 엔드포인트는 /api/seller/tiktok/seller/:id/videos 가 됨 (마운트 prefix 와 결합).
//    권한 검증 무관 — 모든 셀러의 공개 비디오 조회 가능.
app.get('/seller/:id/videos', async (c) => {
  const id = parseInt(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: 'invalid id' }, 400)

  try {
    // show_badge 검증
    const link = await c.env.DB.prepare(
      "SELECT show_badge, username, display_name, status FROM seller_platform_links WHERE seller_id = ? AND platform = 'tiktok' AND status = 'active'"
    ).bind(id).first<{ show_badge: number; username: string; display_name: string; status: string }>()

    if (!link || !link.show_badge) {
      return c.json({ success: true, data: { profile: null, videos: [] } })
    }

    const { results: videos } = await c.env.DB.prepare(`
      SELECT video_id, title, cover_image_url, share_url, view_count, like_count, comment_count, tiktok_create_time
        FROM tiktok_videos_cache
       WHERE seller_id = ? AND hidden_by_seller = 0
       ORDER BY tiktok_create_time DESC
       LIMIT 12
    `).bind(id).all().catch(() => ({ results: [] }))

    return c.json({
      success: true,
      data: {
        profile: { username: link.username, display_name: link.display_name },
        videos: videos || [],
      },
    })
  } catch {
    return c.json({ success: true, data: { profile: null, videos: [] } })
  }
})

// ── PATCH /badge — 셀러가 뱃지/위젯 표시 여부 변경 ──
app.patch('/badge', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') {
    return c.json({ success: false, error: '셀러 인증 필요' }, 401)
  }
  const body = await c.req.json<{ show_badge: boolean }>().catch(() => null)
  if (!body || typeof body.show_badge !== 'boolean') {
    return c.json({ success: false, error: 'show_badge 필수 (boolean)' }, 400)
  }
  await c.env.DB.prepare(
    "UPDATE seller_platform_links SET show_badge = ?, updated_at = datetime('now') WHERE seller_id = ? AND platform = 'tiktok'"
  ).bind(body.show_badge ? 1 : 0, user.id).run().catch(() => {})
  return c.json({ success: true })
})

// ── DELETE /unlink ─────────────────────────────────
app.delete('/unlink', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user || user.type !== 'seller') {
    return c.json({ success: false, error: '셀러 인증 필요' }, 401)
  }

  await c.env.DB.prepare(
    "UPDATE seller_platform_links SET status = 'revoked', access_token = NULL, refresh_token = NULL, updated_at = datetime('now') WHERE seller_id = ? AND platform = 'tiktok'"
  ).bind(user.id).run().catch(() => {})

  return c.json({ success: true })
})

export const tiktokRoutes = app
