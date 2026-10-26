/**
 * 💬 고르기 전 질문 — 손님 쪽·사장님 쪽 핸들러 (2026-10-26). 규칙 SSOT `shared/home-service-chat.ts`.
 *
 *   GET/POST /api/home-service/requests/:id/quotes/:qid/messages   손님(그 요청의 주인)
 *   GET/POST /api/home-service/pro/quotes/:qid/messages            사장님(그 견적을 보낸 매장)
 *
 * 새 줄이 생기면 상대에게 **앱 알림**(손님 = 알림함, 사장님 = 대시보드 알림). 알림톡이 아니다(새 문구는 심사가 필요하다).
 */
import type { Context } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { getCurrentUser } from '@/worker/middleware/auth'
import { CHAT_MAX_PER_QUOTE, parseChatBody } from '@/shared/home-service-chat'
import { addQuoteMessage, ensureHomeServiceTables, listQuoteMessages } from './home-service-db'
import { notifySeller, notifyUser } from '../../../lib/notifications'

type C = Context<{ Bindings: Env }>

function pos(raw: string | undefined): number | null {
  const n = Number(raw)
  return Number.isInteger(n) && n > 0 ? n : null
}
function defer(c: C, p: Promise<unknown>) {
  try { c.executionCtx.waitUntil(p) } catch { void p }
}

/** 손님 — 이 견적이 내 요청의 것인가. */
async function customerQuote(c: C): Promise<{ quoteId: number; requestId: number; sellerId: number } | null> {
  const DB = c.env.DB
  await ensureHomeServiceTables(DB)
  const requestId = pos(c.req.param('id')), quoteId = pos(c.req.param('qid'))
  const userId = Number(getCurrentUser(c)?.id)
  if (!requestId || !quoteId || !userId) return null
  const row = await DB.prepare(
    `SELECT q.seller_id FROM home_service_quotes q JOIN home_service_requests r ON r.id = q.request_id
      WHERE q.id = ? AND q.request_id = ? AND r.user_id = ?`,
  ).bind(quoteId, requestId, userId).first<{ seller_id: number }>()
  return row ? { quoteId, requestId, sellerId: Number(row.seller_id) } : null
}

/** 사장님 — 이 견적을 내 매장이 보냈는가. */
async function proQuote(c: C): Promise<{ quoteId: number; requestId: number; userId: number } | null> {
  const DB = c.env.DB
  await ensureHomeServiceTables(DB)
  const quoteId = pos(c.req.param('qid'))
  const sid = Number(getCurrentUser(c)?.id)
  if (!quoteId || !sid) return null
  const row = await DB.prepare(
    `SELECT q.request_id, r.user_id FROM home_service_quotes q JOIN home_service_requests r ON r.id = q.request_id
      WHERE q.id = ? AND q.seller_id = ?`,
  ).bind(quoteId, sid).first<{ request_id: number; user_id: number }>()
  return row ? { quoteId, requestId: Number(row.request_id), userId: Number(row.user_id) } : null
}

export async function customerListMessages(c: C) {
  try {
    const q = await customerQuote(c)
    if (!q) return c.json({ success: false, error: '대화를 찾을 수 없습니다' }, 404)
    return c.json({ success: true, data: await listQuoteMessages(c.env.DB, q.quoteId) })
  } catch (err) { return safeError(c, err, '대화를 불러오지 못했습니다', '[home-service:chat-list]') }
}

export async function customerSendMessage(c: C) {
  try {
    const q = await customerQuote(c)
    if (!q) return c.json({ success: false, error: '대화를 찾을 수 없습니다' }, 404)
    const p = parseChatBody((await c.req.json<{ body?: unknown }>().catch(() => ({} as { body?: unknown }))).body)
    if (!p.ok) return c.json({ success: false, error: p.error }, 400)
    if (!(await addQuoteMessage(c.env.DB, q.quoteId, 'customer', p.text, CHAT_MAX_PER_QUOTE))) {
      return c.json({ success: false, error: '이 견적에는 더 물어볼 수 없어요' }, 409)
    }
    defer(c, notifySeller(c.env.DB, q.sellerId, 'home_service_message', '손님이 견적에 질문을 남겼어요', p.text.slice(0, 80), `/life/pro/requests/${q.requestId}`))
    return c.json({ success: true })
  } catch (err) { return safeError(c, err, '보내지 못했습니다', '[home-service:chat-send]') }
}

export async function proListMessages(c: C) {
  try {
    const q = await proQuote(c)
    if (!q) return c.json({ success: false, error: '대화를 찾을 수 없습니다' }, 404)
    return c.json({ success: true, data: await listQuoteMessages(c.env.DB, q.quoteId) })
  } catch (err) { return safeError(c, err, '대화를 불러오지 못했습니다', '[home-service:pro-chat-list]') }
}

export async function proSendMessage(c: C) {
  try {
    const q = await proQuote(c)
    if (!q) return c.json({ success: false, error: '대화를 찾을 수 없습니다' }, 404)
    const p = parseChatBody((await c.req.json<{ body?: unknown }>().catch(() => ({} as { body?: unknown }))).body)
    if (!p.ok) return c.json({ success: false, error: p.error }, 400)
    if (!(await addQuoteMessage(c.env.DB, q.quoteId, 'pro', p.text, CHAT_MAX_PER_QUOTE))) {
      return c.json({ success: false, error: '이 견적에는 더 답할 수 없어요' }, 409)
    }
    defer(c, notifyUser(c.env.DB, String(q.userId), 'home_service_message', '사장님이 답을 남겼어요', p.text.slice(0, 80), `/life/requests/${q.requestId}`))
    return c.json({ success: true })
  } catch (err) { return safeError(c, err, '보내지 못했습니다', '[home-service:pro-chat-send]') }
}
