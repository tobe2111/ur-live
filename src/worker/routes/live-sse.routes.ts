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

export const liveSseRoutes = new Hono<{ Bindings: Env }>()
export const chatRoutes = new Hono<{ Bindings: Env }>()

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
liveSseRoutes.get('/:liveId/chat/messages', async (c) => {
  const { liveId } = c.req.param()

  try {
    const messages = await c.env.DB.prepare(`
      SELECT id, user_id, user_name, user_avatar, message, is_seller, is_admin, created_at
      FROM chat_messages
      WHERE live_stream_id = ? AND is_deleted = 0
      ORDER BY id DESC
      LIMIT 50
    `).bind(liveId).all()

    return c.json({ success: true, data: messages.results.reverse() })
  } catch (err) {
    console.error('[Chat] Failed to fetch messages:', err)
    return c.json({ success: true, data: [] })
  }
})

// ── WebSocket → Durable Object proxy ────────────────────────────────────────
liveSseRoutes.get('/:liveId/ws', async (c) => {
  const { liveId } = c.req.param()

  if (c.req.header('Upgrade') !== 'websocket') {
    return c.json({ error: 'Expected WebSocket upgrade' }, 426)
  }

  if (!c.env.LIVE_STREAM) {
    return c.json({ error: 'Real-time service unavailable', fallback: 'sse' }, 503)
  }

  try {
    const doId = c.env.LIVE_STREAM.idFromName(liveId)
    const stub = c.env.LIVE_STREAM.get(doId)
    // Cast to any to avoid Cloudflare types header mismatch between hono and workers-types
    return stub.fetch(c.req.raw as any) as any
  } catch (err) {
    console.error('[WS] Durable Object proxy failed:', err)
    return c.json({ error: 'WebSocket connection failed', fallback: 'sse' }, 503)
  }
})

// ── Broadcast event to all WebSocket viewers ─────────────────────────────────
liveSseRoutes.post('/:liveId/broadcast', async (c) => {
  const { liveId } = c.req.param()

  if (!c.env.LIVE_STREAM) {
    return c.json({ success: false, error: 'DO not available' }, 503)
  }

  const body = await c.req.json()
  const doId = c.env.LIVE_STREAM.idFromName(liveId)
  const stub = c.env.LIVE_STREAM.get(doId)

  await stub.fetch(new Request('https://internal/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as any)

  return c.json({ success: true })
})

// ── Send chat message: POST /api/chat/:liveId/messages ──────────────────────
chatRoutes.post('/:liveId/messages', async (c) => {
  const { liveId } = c.req.param()

  let body: any
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON' }, 400)
  }

  const { userId, userName, message, isSeller, isAdmin } = body

  if (!message?.trim() || !userName) {
    return c.json({ error: 'message and userName are required' }, 400)
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
      userName,
      message.trim(),
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
            user_name: userName,
            message: message.trim(),
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
