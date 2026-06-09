/**
 * 💬 2026-06-09 Wave 4a: 유통사(distributor) ↔ 제조사(supplier) 채팅 — D1 polling.
 *
 *   websocket / Durable Object 없음 (zero extra server cost). 클라가 polling:
 *   - GET /unread       — 안 읽음 합계 1개 인덱스 쿼리(자주 폴링, CHEAP)
 *   - GET /threads      — 내 스레드 목록(상대 이름 포함)
 *   - POST /threads     — 상대로 스레드 get-or-create
 *   - GET /threads/:id/messages?after=<lastId>  — id>after 메시지(폴링) + 읽음처리
 *   - POST /threads/:id/messages  — 메시지 전송 + 상대 unread++ + (throttle)알림
 *
 * 인증: chatIdentityFrom(c) — supplier 토큰 우선, 없으면 distributor JWT.
 *   모든 op 는 호출자 본인 스레드로 제한(IDOR-safe). counterpart_id 검증(존재+승인).
 *
 * 테이블: wholesale_chat_threads / wholesale_chat_messages (repair-schema 에 정의됨,
 *   여기서도 ensure-on-use — D1 마이그레이션 CI 미작동 대비, 멱등).
 *
 * 마운트(worker/index.ts): app.route('/api/wholesale/chat', wholesaleChatRoutes)
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { swallow } from '@/worker/utils/swallow'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'

// ── 신원 해석: supplier 토큰 우선 → distributor JWT ─────────────────────────────
//   supplier: JWT payload { type:'supplier', supplier_id } (supplier-auth.routes/login).
//   distributor: 셀러 JWT { seller_id, is_distributor } (wholesale-deposit.routes distributorFrom).
type ChatIdentity = { role: 'distributor' | 'supplier'; id: number }

async function chatIdentityFrom(c: { req: { header: (k: string) => string | undefined }; env: Env }): Promise<ChatIdentity | null> {
  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) return null
  const token = authorization.substring(7)
  const { verify } = await import('hono/jwt')
  // 1) supplier 토큰 시도.
  try {
    const payload = await verify(token, c.env.JWT_SECRET, 'HS256') as { type?: string; supplier_id?: number; seller_id?: number; is_distributor?: number | boolean }
    if (payload.type === 'supplier' && Number(payload.supplier_id) > 0) {
      return { role: 'supplier', id: Number(payload.supplier_id) }
    }
    // 2) distributor (셀러 JWT + is_distributor).
    if (payload.seller_id && payload.is_distributor && Number(payload.seller_id) > 0) {
      return { role: 'distributor', id: Number(payload.seller_id) }
    }
    return null
  } catch {
    return null
  }
}

// ── 스키마 ensure-on-use (멱등, repair-schema 와 동일 shape) ──────────────────────
const _chatSchemaEnsured = new WeakSet<object>()
async function ensureChatSchema(DB: D1Database): Promise<void> {
  if (_chatSchemaEnsured.has(DB)) return
  _chatSchemaEnsured.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_chat_threads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    distributor_seller_id INTEGER NOT NULL,
    supplier_id INTEGER NOT NULL,
    last_message_id INTEGER DEFAULT 0,
    last_message_at TEXT,
    last_preview TEXT,
    distributor_unread INTEGER DEFAULT 0,
    supplier_unread INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(distributor_seller_id, supplier_id)
  )`).run().catch(swallow('wholesale-chat:ensure:threads'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS wholesale_chat_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    thread_id INTEGER NOT NULL,
    sender_role TEXT NOT NULL,
    sender_id INTEGER NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`).run().catch(swallow('wholesale-chat:ensure:messages'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_chat_threads_dist ON wholesale_chat_threads(distributor_seller_id, last_message_at DESC)').run().catch(swallow('wholesale-chat:ensure:idx-dist'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_chat_threads_sup ON wholesale_chat_threads(supplier_id, last_message_at DESC)').run().catch(swallow('wholesale-chat:ensure:idx-sup'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_wholesale_chat_messages_thread ON wholesale_chat_messages(thread_id, id)').run().catch(swallow('wholesale-chat:ensure:idx-msg'))
}

// 역할별 컬럼 매핑 — 내 unread 컬럼 / 상대 unread 컬럼.
function myUnreadCol(role: ChatIdentity['role']): 'distributor_unread' | 'supplier_unread' {
  return role === 'distributor' ? 'distributor_unread' : 'supplier_unread'
}
function counterUnreadCol(role: ChatIdentity['role']): 'distributor_unread' | 'supplier_unread' {
  return role === 'distributor' ? 'supplier_unread' : 'distributor_unread'
}
// 내 스레드 필터 컬럼.
function myThreadCol(role: ChatIdentity['role']): 'distributor_seller_id' | 'supplier_id' {
  return role === 'distributor' ? 'distributor_seller_id' : 'supplier_id'
}

const app = new Hono<{ Bindings: Env }>()

// ════════════════════════════════════════════════════════════════════════════
// GET /unread — 안 읽음 합계 (자주 폴링, 단일 인덱스 쿼리, JOIN 없음)
// ════════════════════════════════════════════════════════════════════════════
app.get('/unread', async (c) => {
  const me = await chatIdentityFrom(c)
  if (!me) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureChatSchema(DB)
    const col = myUnreadCol(me.role)
    const filter = myThreadCol(me.role)
    // 단일 인덱스 쿼리(idx_..._dist / _sup 활용) — 합계 + 가장 최근 unread 스레드 id.
    const row = await DB.prepare(
      `SELECT COALESCE(SUM(${col}), 0) AS unread,
              (SELECT id FROM wholesale_chat_threads WHERE ${filter} = ?1 AND ${col} > 0 ORDER BY last_message_at DESC LIMIT 1) AS latest_thread_id
         FROM wholesale_chat_threads WHERE ${filter} = ?1`
    ).bind(me.id).first<{ unread: number; latest_thread_id: number | null }>()
    return c.json({ success: true, unread: Number(row?.unread || 0), latest_thread_id: row?.latest_thread_id ?? null })
  } catch (err) {
    return safeError(c, err, '안 읽은 메시지 조회 중 오류가 발생했습니다', '[wholesale-chat]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// GET /threads — 내 스레드 목록 (상대 이름 join)
// ════════════════════════════════════════════════════════════════════════════
app.get('/threads', async (c) => {
  const me = await chatIdentityFrom(c)
  if (!me) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureChatSchema(DB)
    const col = myUnreadCol(me.role)
    const filter = myThreadCol(me.role)
    // 상대 이름: 내가 distributor 면 상대=supplier(suppliers.business_name),
    //            내가 supplier 면 상대=distributor 셀러(sellers.business_name/name).
    const counterIdCol = me.role === 'distributor' ? 't.supplier_id' : 't.distributor_seller_id'
    const nameSelect = me.role === 'distributor'
      ? '(SELECT business_name FROM suppliers WHERE id = t.supplier_id)'
      : '(SELECT COALESCE(business_name, name) FROM sellers WHERE id = t.distributor_seller_id)'
    const { results } = await DB.prepare(
      `SELECT t.id AS id,
              ${counterIdCol} AS counterpart_id,
              ${nameSelect} AS counterpart_name,
              t.last_preview AS last_preview,
              t.last_message_at AS last_message_at,
              t.${col} AS unread
         FROM wholesale_chat_threads t
        WHERE t.${filter} = ?
        ORDER BY t.last_message_at DESC`
    ).bind(me.id).all<{ id: number; counterpart_id: number; counterpart_name: string | null; last_preview: string | null; last_message_at: string | null; unread: number }>()
    const threads = (results ?? []).map((r) => ({
      id: r.id,
      counterpart_id: r.counterpart_id,
      counterpart_name: r.counterpart_name || (me.role === 'distributor' ? `제조사 #${r.counterpart_id}` : `유통사 #${r.counterpart_id}`),
      last_preview: r.last_preview || '',
      last_message_at: r.last_message_at,
      unread: Number(r.unread || 0),
    }))
    return c.json({ success: true, role: me.role, threads })
  } catch (err) {
    return safeError(c, err, '대화 목록 조회 중 오류가 발생했습니다', '[wholesale-chat]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// POST /threads — 상대로 스레드 get-or-create
//   body { counterpart_id } — 내가 distributor 면 counterpart=supplier_id (반대도 동일).
// ════════════════════════════════════════════════════════════════════════════
app.post('/threads', rateLimit({ action: 'wholesale-chat-thread', max: 30, windowSec: 60 }), async (c) => {
  const me = await chatIdentityFrom(c)
  if (!me) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  try {
    await ensureChatSchema(DB)
    const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const counterpartId = Math.floor(Number(body.counterpart_id))
    if (!Number.isFinite(counterpartId) || counterpartId <= 0) {
      return c.json({ success: false, error: '상대방 ID가 올바르지 않습니다' }, 400)
    }

    // distributor/supplier 쌍 결정 — 호출자 역할에 따라 누가 distributor 인지 결정.
    const distributorId = me.role === 'distributor' ? me.id : counterpartId
    const supplierId = me.role === 'supplier' ? me.id : counterpartId

    // 상대 존재 + 승인 검증 (counterpart 가 실제 활성 계정인지).
    if (me.role === 'distributor') {
      const sup = await DB.prepare("SELECT id FROM suppliers WHERE id = ? AND status = 'approved' LIMIT 1").bind(supplierId).first<{ id: number }>().catch(() => null)
      if (!sup) return c.json({ success: false, error: '승인된 제조사를 찾을 수 없습니다' }, 404)
    } else {
      // 상대가 유통사(셀러 + is_distributor=1).
      const sel = await DB.prepare('SELECT id FROM sellers WHERE id = ? AND is_distributor = 1 LIMIT 1').bind(distributorId).first<{ id: number }>().catch(() => null)
      if (!sel) return c.json({ success: false, error: '유통사를 찾을 수 없습니다' }, 404)
    }

    // get-or-create (UNIQUE(distributor_seller_id, supplier_id)).
    await DB.prepare(
      'INSERT OR IGNORE INTO wholesale_chat_threads (distributor_seller_id, supplier_id) VALUES (?, ?)'
    ).bind(distributorId, supplierId).run()
    const thread = await DB.prepare(
      'SELECT id FROM wholesale_chat_threads WHERE distributor_seller_id = ? AND supplier_id = ? LIMIT 1'
    ).bind(distributorId, supplierId).first<{ id: number }>()
    if (!thread?.id) return c.json({ success: false, error: '대화방 생성 중 오류가 발생했습니다' }, 500)

    return c.json({ success: true, thread_id: thread.id })
  } catch (err) {
    return safeError(c, err, '대화방 생성 중 오류가 발생했습니다', '[wholesale-chat]')
  }
})

// 내 스레드 로드 (소유권 검증 — IDOR-safe). 없으면 null.
async function loadOwnThread(DB: D1Database, me: ChatIdentity, threadId: number) {
  const filter = myThreadCol(me.role)
  return DB.prepare(
    `SELECT id, distributor_seller_id, supplier_id FROM wholesale_chat_threads WHERE id = ? AND ${filter} = ? LIMIT 1`
  ).bind(threadId, me.id).first<{ id: number; distributor_seller_id: number; supplier_id: number }>()
}

// 상대 이름 helper.
async function counterpartName(DB: D1Database, me: ChatIdentity, thread: { distributor_seller_id: number; supplier_id: number }): Promise<string> {
  if (me.role === 'distributor') {
    const r = await DB.prepare('SELECT business_name FROM suppliers WHERE id = ?').bind(thread.supplier_id).first<{ business_name: string | null }>().catch(() => null)
    return r?.business_name || `제조사 #${thread.supplier_id}`
  }
  const r = await DB.prepare('SELECT COALESCE(business_name, name) AS nm FROM sellers WHERE id = ?').bind(thread.distributor_seller_id).first<{ nm: string | null }>().catch(() => null)
  return r?.nm || `유통사 #${thread.distributor_seller_id}`
}

// ════════════════════════════════════════════════════════════════════════════
// GET /threads/:id/messages?after=<lastId> — 폴링 + 읽음처리
//   after=0 → 최근 50개. after>0 → id>after ASC (증분 폴링, 단일 인덱스).
//   side-effect: 내 unread 0 으로 리셋.
// ════════════════════════════════════════════════════════════════════════════
app.get('/threads/:id/messages', async (c) => {
  const me = await chatIdentityFrom(c)
  if (!me) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const threadId = Math.floor(Number(c.req.param('id')))
  if (!Number.isFinite(threadId) || threadId <= 0) return c.json({ success: false, error: '잘못된 대화방 ID' }, 400)
  try {
    await ensureChatSchema(DB)
    const thread = await loadOwnThread(DB, me, threadId)
    if (!thread) return c.json({ success: false, error: '대화방을 찾을 수 없습니다' }, 404)

    const after = Math.max(0, Math.floor(Number(c.req.query('after')) || 0))
    let messages: Array<{ id: number; sender_role: string; body: string; created_at: string }>
    if (after > 0) {
      // 증분 폴링 — WHERE thread_id=? AND id>? (idx_wholesale_chat_messages_thread).
      const { results } = await DB.prepare(
        'SELECT id, sender_role, body, created_at FROM wholesale_chat_messages WHERE thread_id = ? AND id > ? ORDER BY id ASC LIMIT 200'
      ).bind(threadId, after).all<{ id: number; sender_role: string; body: string; created_at: string }>()
      messages = results ?? []
    } else {
      // 초기 로드 — 최근 50개 (id DESC LIMIT 50 후 ASC 재정렬).
      const { results } = await DB.prepare(
        'SELECT id, sender_role, body, created_at FROM wholesale_chat_messages WHERE thread_id = ? ORDER BY id DESC LIMIT 50'
      ).bind(threadId).all<{ id: number; sender_role: string; body: string; created_at: string }>()
      messages = (results ?? []).reverse()
    }

    // side-effect: 내 unread 리셋(0). 멱등.
    const col = myUnreadCol(me.role)
    await DB.prepare(`UPDATE wholesale_chat_threads SET ${col} = 0 WHERE id = ?`).bind(threadId).run().catch(swallow('wholesale-chat:mark-read'))

    const name = await counterpartName(DB, me, thread)
    return c.json({ success: true, messages, thread: { counterpart_name: name } })
  } catch (err) {
    return safeError(c, err, '메시지 조회 중 오류가 발생했습니다', '[wholesale-chat]')
  }
})

// ════════════════════════════════════════════════════════════════════════════
// POST /threads/:id/messages — 전송 + 상대 unread++ + (throttle)알림
// ════════════════════════════════════════════════════════════════════════════
app.post('/threads/:id/messages', rateLimit({ action: 'wholesale-chat-send', max: 60, windowSec: 60 }), async (c) => {
  const me = await chatIdentityFrom(c)
  if (!me) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const { DB } = c.env
  const threadId = Math.floor(Number(c.req.param('id')))
  if (!Number.isFinite(threadId) || threadId <= 0) return c.json({ success: false, error: '잘못된 대화방 ID' }, 400)
  try {
    await ensureChatSchema(DB)
    const reqBody = await c.req.json().catch(() => ({} as Record<string, unknown>))
    const text = String(reqBody.body ?? '').trim()
    if (!text) return c.json({ success: false, error: '메시지를 입력해주세요' }, 400)
    if (text.length > 2000) return c.json({ success: false, error: '메시지는 2000자 이하여야 합니다' }, 400)

    const thread = await loadOwnThread(DB, me, threadId)
    if (!thread) return c.json({ success: false, error: '대화방을 찾을 수 없습니다' }, 404)

    // insert.
    const ins = await DB.prepare(
      "INSERT INTO wholesale_chat_messages (thread_id, sender_role, sender_id, body) VALUES (?, ?, ?, ?)"
    ).bind(threadId, me.role, me.id, text).run()
    const messageId = Number(ins.meta?.last_row_id)
    if (!messageId) return c.json({ success: false, error: '메시지 전송 중 오류가 발생했습니다' }, 500)

    // 상대 unread 가 0 이었는지 확인(알림 throttle 판단용) — 증가 전 값.
    const counterCol = counterUnreadCol(me.role)
    const before = await DB.prepare(`SELECT ${counterCol} AS u FROM wholesale_chat_threads WHERE id = ?`).bind(threadId).first<{ u: number }>().catch(() => null)
    const counterWasZero = Number(before?.u || 0) === 0

    // 스레드 갱신: last_message_id/at/preview + 상대 unread++.
    const preview = text.slice(0, 80)
    await DB.prepare(
      `UPDATE wholesale_chat_threads
          SET last_message_id = ?, last_message_at = datetime('now'), last_preview = ?, ${counterCol} = ${counterCol} + 1
        WHERE id = ?`
    ).bind(messageId, preview, threadId).run().catch(swallow('wholesale-chat:thread-update'))

    // 상대 알림 — throttle: 상대 unread 가 0 이었을 때만(연속 메시지 알림 폭주 방지).
    if (counterWasZero) {
      const counterRole: 'seller' | 'supplier' = me.role === 'distributor' ? 'supplier' : 'seller'
      const counterId = me.role === 'distributor' ? thread.supplier_id : thread.distributor_seller_id
      const link = counterRole === 'supplier' ? '/supplier/chat' : '/wholesale/chat'
      createDashboardNotification(
        DB, counterRole, String(counterId), 'wholesale_chat_message', '새 메시지',
        preview, link,
      ).catch(swallow('wholesale-chat:notify'))
    }

    // created_at 읽어 응답(서버 시각 일관성).
    const saved = await DB.prepare('SELECT created_at FROM wholesale_chat_messages WHERE id = ?').bind(messageId).first<{ created_at: string }>().catch(() => null)
    return c.json({
      success: true,
      message: { id: messageId, sender_role: me.role, body: text, created_at: saved?.created_at || new Date().toISOString() },
    })
  } catch (err) {
    return safeError(c, err, '메시지 전송 중 오류가 발생했습니다', '[wholesale-chat]')
  }
})

export { app as wholesaleChatRoutes }
