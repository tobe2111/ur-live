// ============================================================
// Live Stream Real-time Routes
// GET  /api/live/:liveId/chat/sse  - SSE chat stream (fallback when DO unavailable)
// GET  /api/live/:liveId/sse       - SSE stream status (fallback)
// GET  /api/live/:liveId/ws        - WebSocket → Durable Object proxy
// POST /api/live/:liveId/broadcast - Broadcast event to all viewers via DO
// GET  /api/live/:liveId/chat/messages - Fetch recent chat messages (initial load)
// POST /api/chat/:liveId/messages  - Send chat message (save to D1 + broadcast via DO)
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { handleChatSSE, handleLiveStreamSSE } from '../../lib/sse-realtime'
import { optionalAuth, getCurrentUser, requireSellerOrAdmin } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import {
  MAX_CHAT_MESSAGE_LENGTH,
  MAX_NAME_LENGTH,
  sanitizeString,
} from '../utils/validation'

export const liveSseRoutes = new Hono<{ Bindings: Env }>()
export const chatRoutes = new Hono<{ Bindings: Env }>()

// HIGH-4: Simple per-isolate cache for duplicate-message detection. Keys are
// `${liveId}:${userId|userName}` and entries expire after 60s. This runs in a
// Worker isolate so it is best-effort across cold starts — good enough for
// blocking trivial spam loops on a single connection.
const RECENT_CHAT_CACHE = new Map<string, { message: string; at: number }>()

// ── SSE fallback: GET /api/live/:liveId/chat/sse ────────────────────────────
liveSseRoutes.get('/:liveId/chat/sse', (c) => {
  const { liveId } = c.req.param()
  return handleChatSSE(liveId, c.env as any)
})

// ── SSE fallback: GET /api/live/:liveId/sse ─────────────────────────────────
liveSseRoutes.get('/:liveId/sse', (c) => {
  const { liveId } = c.req.param()
  return handleLiveStreamSSE(liveId, c.env as any)
})

// ── Initial chat messages: GET /api/live/:liveId/chat/messages ───────────────
// ?replay=true 파라미터: 다시보기 시 전체 채팅 로드 (타임라인 동기화용)
liveSseRoutes.get('/:liveId/chat/messages', async (c) => {
  const { liveId } = c.req.param()
  const isReplay = c.req.query('replay') === 'true'

  try {
    const query = isReplay
      ? `SELECT id, user_id, user_name, user_avatar, message, is_seller, is_admin, created_at
         FROM chat_messages
         WHERE live_stream_id = ? AND is_deleted = 0
         ORDER BY id ASC`
      : `SELECT id, user_id, user_name, user_avatar, message, is_seller, is_admin, created_at
         FROM chat_messages
         WHERE live_stream_id = ? AND is_deleted = 0
         ORDER BY id DESC
         LIMIT 50`

    const messages = await c.env.DB.prepare(query).bind(liveId).all()

    return c.json({
      success: true,
      data: isReplay ? messages.results : messages.results.reverse(),
    })
  } catch (err) {
    console.error('[Chat] Failed to fetch messages:', err)
    return c.json({ success: true, data: [] })
  }
})

// ── WebSocket origin allowlist ──────────────────────────────────────────────
// Only these origins may establish a WebSocket to the live-stream DO. Without
// this, any origin could open a socket and spam chat / trigger broadcasts.
const ALLOWED_WS_ORIGINS = new Set<string>([
  'https://live.ur-team.com',
  'https://ur-live.pages.dev',
  // Local dev (vite / wrangler dev)
  'http://localhost:5173',
  'http://localhost:8787',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:8787',
])

function isAllowedWsOrigin(origin: string | undefined): boolean {
  if (!origin) {
    // Some non-browser clients omit Origin. Permit so native mobile / tests work.
    // Browser clients always send Origin on WS upgrades.
    return true
  }
  if (ALLOWED_WS_ORIGINS.has(origin)) return true
  // Allow any `*.pages.dev` preview deployment
  try {
    const u = new URL(origin)
    if (u.protocol === 'https:' && u.hostname.endsWith('.pages.dev')) return true
    if (u.protocol === 'https:' && u.hostname.endsWith('.ur-team.com')) return true
  } catch {
    return false
  }
  return false
}

// ── WebSocket → Durable Object proxy ────────────────────────────────────────
liveSseRoutes.get('/:liveId/ws', async (c) => {
  const { liveId } = c.req.param()

  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426)
  }

  // Origin check — reject cross-origin upgrade attempts.
  const origin = c.req.header('origin') || c.req.header('Origin')
  if (!isAllowedWsOrigin(origin)) {
    return c.json({ error: 'Origin not allowed' }, 403)
  }

  // v28 FIX: WebSocket 인증. 이전에는 origin check만 있어서 익명 접속 가능했음.
  // token 쿼리파람을 검증하고 user_id를 DO에 전달. 검증 실패 시에도 읽기 전용(view-only)
  // 으로 허용하되, 채팅/브로드캐스트는 DO에서 user_id 유무로 차단.
  const tokenFromQuery = c.req.query('token')
  let authenticatedUserId: string | null = null
  if (tokenFromQuery && c.env.JWT_SECRET) {
    try {
      const { verify } = await import('hono/jwt')
      const payload = await verify(tokenFromQuery, c.env.JWT_SECRET, 'HS256') as any
      if (payload && (payload.sub || payload.user_id || payload.id)) {
        authenticatedUserId = String(payload.sub || payload.user_id || payload.id)
      }
    } catch {
      // 토큰 무효 — 익명으로 처리 (view-only)
    }
  }

  if (!c.env.LIVE_STREAM) {
    return c.json({ error: 'Real-time service unavailable', fallback: 'sse' }, 503)
  }

  try {
    const doId = c.env.LIVE_STREAM.idFromName(liveId)
    const stub = c.env.LIVE_STREAM.get(doId)
    // Forward authenticated user_id via custom header (DO가 신뢰할 수 있음)
    const headers = new Headers(c.req.raw.headers)
    if (authenticatedUserId) {
      headers.set('x-auth-user-id', authenticatedUserId)
    } else {
      headers.delete('x-auth-user-id') // 클라이언트가 직접 보낸 값 제거
    }
    const forwardedReq = new Request(c.req.raw.url, {
      method: c.req.raw.method,
      headers,
      body: c.req.raw.body,
    })
    return stub.fetch(forwardedReq as any) as any
  } catch (err) {
    console.error('[WS] Durable Object proxy failed:', err)
    return c.json({ error: 'WebSocket connection failed', fallback: 'sse' }, 503)
  }
})

// ── Broadcast event to all WebSocket viewers (seller/admin only) ─────────────
liveSseRoutes.post('/:liveId/broadcast', requireSellerOrAdmin(), async (c) => {
  const { liveId } = c.req.param()

  if (!c.env.LIVE_STREAM) {
    return c.json({ success: false, error: 'DO not available' }, 503)
  }

  const user = getCurrentUser(c)
  const body = await c.req.json()
  const doId = c.env.LIVE_STREAM.idFromName(liveId)
  const stub = c.env.LIVE_STREAM.get(doId)

  // 🛡️ 2026-04-22: DO 에 인증 증빙 전달 — DO 자체 인증 체크용
  await stub.fetch(new Request('https://internal/broadcast', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Internal-Auth': '1',
      'X-Auth-User-Type': user?.type ?? '',
      'X-Auth-User-Id': String(user?.id ?? ''),
    },
    body: JSON.stringify(body),
  }) as any)

  return c.json({ success: true })
})

// ── Track view: POST /api/live/:liveId/view ─────────────────────────────────
liveSseRoutes.post('/:liveId/view', optionalAuth(), async (c) => {
  const { liveId } = c.req.param()
  const authUser = getCurrentUser(c)
  const userId = authUser ? String(authUser.id) : null

  let body: any = {}
  try { body = await c.req.json() } catch { /* optional */ }

  const sessionId = body.sessionId || `anon-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const action = body.action || 'join' // 'join' | 'leave' | 'heartbeat'

  try {
    if (action === 'join') {
      const result = await c.env.DB.prepare(`
        INSERT INTO live_stream_views (live_stream_id, user_id, session_id, device_type)
        VALUES (?, ?, ?, ?)
      `).bind(liveId, userId, sessionId, body.deviceType || 'web').run()
      return c.json({ success: true, viewId: result.meta.last_row_id, sessionId })
    } else if (action === 'leave' || action === 'heartbeat') {
      const watchDuration = body.watchDuration || 0
      await c.env.DB.prepare(`
        UPDATE live_stream_views
        SET watch_duration = ?, left_at = CASE WHEN ? = 'leave' THEN datetime('now') ELSE left_at END
        WHERE session_id = ? AND live_stream_id = ?
      `).bind(watchDuration, action, sessionId, liveId).run()
      return c.json({ success: true })
    }
    return c.json({ success: true })
  } catch (err) {
    console.error('[View] Tracking failed:', err)
    return c.json({ success: true }) // Non-fatal
  }
})

// ── Send chat message: POST /api/chat/:liveId/messages ──────────────────────
// optionalAuth: 비로그인 시청자도 채팅 가능하나 isSeller/isAdmin은 서버에서만 결정
// 🛡️ 2026-04-22: 채팅 POST rate limit (spam 방어)
// 이전: 1초당 수백 메시지 flood 가능 (중복 메시지만 차단)
// 수정: 30 msg/60s per IP
chatRoutes.post('/:liveId/messages', rateLimit({ action: 'chat_post', max: 30, windowSec: 60 }), optionalAuth(), async (c) => {
  const { liveId } = c.req.param()

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { userId: bodyUserId, userName, message } = body

  if (!message?.trim() || !userName) {
    return c.json({ error: 'message and userName are required' }, 400)
  }

  // Defensive: type checks + length caps + control-char sanitization
  if (typeof message !== 'string' || typeof userName !== 'string') {
    return c.json({ error: 'message and userName must be strings' }, 400)
  }
  if (message.length > MAX_CHAT_MESSAGE_LENGTH) {
    return c.json({ error: `메시지는 ${MAX_CHAT_MESSAGE_LENGTH}자 이하여야 합니다.` }, 400)
  }
  if (userName.length > MAX_NAME_LENGTH) {
    return c.json({ error: `사용자명은 ${MAX_NAME_LENGTH}자 이하여야 합니다.` }, 400)
  }
  const cleanMessage = sanitizeString(message).trim()
  const cleanUserName = sanitizeString(userName).trim()
  if (!cleanMessage || !cleanUserName) {
    return c.json({ error: 'message and userName are required' }, 400)
  }

  // isSeller/isAdmin은 인증 토큰에서만 결정 — 클라이언트 입력 무시
  const authUser = getCurrentUser(c)
  const isSeller = authUser?.type === 'seller'
  const isAdmin = authUser?.type === 'admin'
  const userId = authUser ? String(authUser.id) : (bodyUserId ?? null)

  // ── HIGH-4: Chat moderation ─────────────────────────────────────────────
  // 1) URL 포함 메시지 차단 (셀러/어드민은 공지/링크 공유 가능하므로 예외)
  if (!isSeller && !isAdmin) {
    const hasUrl = /https?:\/\/|www\./i.test(cleanMessage)
    if (hasUrl) {
      return c.json({ error: '채팅에 링크를 포함할 수 없습니다.' }, 400)
    }
  }

  // 2) 10초 이내 동일 유저의 중복 메시지 차단
  const dupKey = `${liveId}:${userId ?? cleanUserName}`
  const nowMs = Date.now()
  const prevEntry = RECENT_CHAT_CACHE.get(dupKey)
  if (prevEntry && prevEntry.message === cleanMessage && nowMs - prevEntry.at < 10_000) {
    return c.json({ error: '동일한 메시지를 반복할 수 없습니다.' }, 429)
  }
  RECENT_CHAT_CACHE.set(dupKey, { message: cleanMessage, at: nowMs })
  // Bound memory in long-lived isolates
  if (RECENT_CHAT_CACHE.size > 500) {
    for (const [k, v] of RECENT_CHAT_CACHE) {
      if (nowMs - v.at > 60_000) RECENT_CHAT_CACHE.delete(k)
    }
  }

  let insertedId: number | null = null

  // Save to D1
  try {
    const result = await c.env.DB.prepare(`
      INSERT INTO chat_messages (live_stream_id, user_id, user_name, message, is_seller, is_admin)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
      liveId,
      userId ?? null,
      cleanUserName,
      cleanMessage,
      isSeller ? 1 : 0,
      isAdmin ? 1 : 0,
    ).run()

    insertedId = result.meta.last_row_id
  } catch (err) {
    console.error('[Chat] D1 insert failed:', err)
    return c.json({ error: 'Failed to save message', detail: (err as Error).message }, 500)
  }

  // Broadcast to DO WebSocket clients (non-fatal if DO unavailable)
  if (c.env.LIVE_STREAM) {
    try {
      const doId = c.env.LIVE_STREAM.idFromName(liveId)
      const stub = c.env.LIVE_STREAM.get(doId)
      await stub.fetch(new Request('https://internal/broadcast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'chat',
          data: {
            id: insertedId,
            user_id: userId ?? null,
            user_name: cleanUserName,
            message: cleanMessage,
            is_seller: isSeller || false,
            is_admin: isAdmin || false,
            created_at: new Date().toISOString(),
          },
          timestamp: Date.now(),
        }),
      }) as any)
    } catch (err) {
      // Non-fatal: message already saved to D1
      console.error('[Chat] DO broadcast failed:', err)
    }
  }

  return c.json({ success: true, id: insertedId })
})
