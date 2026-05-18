/**
 * 🛡️ 2026-05-15: 분쟁 자동 분류 — Workers AI 텍스트 분류.
 *
 * - POST /api/disputes/submit (auth) — 유저가 분쟁 사유 입력
 *     body: { voucher_code, reason_text, evidence_url? }
 *   → AI 분류 → 자동 처리 (소액 환불) 또는 어드민 escalation
 *
 * 분류:
 *   - voucher_refused (사장님이 거부)       → 자동 환불
 *   - merchant_closed (매장 폐업/임시 휴업)  → 자동 환불
 *   - quality_issue (품질 불만)             → 어드민 검토
 *   - already_used (이미 사용)              → 자동 거절
 *   - other                                → 어드민 검토
 *
 * AI binding 미설정 시: 모든 dispute 어드민 escalation (graceful).
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import { auditLog } from '../middleware/audit-log'
import { require2FA } from '../middleware/require-2fa'

interface AIEnv {
  AI?: {
    run: (model: string, input: { messages: Array<{ role: string; content: string }>; max_tokens?: number }) => Promise<{ response?: string }>
  }
}

const disputesRoutes = new Hono<{ Bindings: Env }>()

const SYSTEM_PROMPT = `당신은 한국 공동구매 플랫폼의 분쟁 분류 도우미입니다.
유저의 분쟁 사유를 읽고 다음 카테고리 중 하나로 분류하세요:

- voucher_refused: 사장님이 voucher 사용을 거부함
- merchant_closed: 매장 폐업, 임시 휴업, 운영 중단
- quality_issue: 음식/서비스 품질 불만
- already_used: 이미 사용한 voucher 라고 잘못 표시
- other: 위 카테고리에 해당하지 않음

응답은 JSON 만:
{"category":"voucher_refused","confidence":0.92,"reasoning":"사장님이 거부했다고 명시"}

confidence 는 0.0-1.0. reasoning 은 한 문장.`

const AUTO_REFUND_CATEGORIES = new Set(['voucher_refused', 'merchant_closed'])

async function ensureDisputesTable(DB: D1Database): Promise<void> {
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS disputes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        voucher_code TEXT NOT NULL,
        user_id TEXT NOT NULL,
        reason_text TEXT NOT NULL,
        evidence_url TEXT,
        ai_category TEXT,
        ai_confidence REAL,
        ai_reasoning TEXT,
        action TEXT DEFAULT 'pending',  -- pending / auto_refunded / escalated / resolved / rejected
        admin_notes TEXT,
        admin_user_id TEXT,
        resolved_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_disputes_status ON disputes(action, created_at DESC)`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_disputes_voucher ON disputes(voucher_code)`).run()
  } catch { /* exists */ }
}

disputesRoutes.post(
  '/submit',
  rateLimit({ action: 'dispute_submit', max: 5, windowSec: 3600 }),
  requireAuth(),
  auditLog('dispute.submit'),
  async (c) => {
    const user = getCurrentUser(c)
    if (!user) return c.json({ success: false, error: 'Unauthorized' }, 401)
    const userId = String(user.id)

    let body: { voucher_code?: string; reason_text?: string; evidence_url?: string }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ success: false, error: 'JSON 형식 오류' }, 400)
    }

    const { voucher_code, reason_text, evidence_url } = body
    if (!voucher_code || typeof voucher_code !== 'string' || !/^[A-Za-z0-9-]{4,64}$/.test(voucher_code)) {
      return c.json({ success: false, error: '잘못된 voucher 코드' }, 400)
    }
    if (!reason_text || typeof reason_text !== 'string' || reason_text.length < 10 || reason_text.length > 2000) {
      return c.json({ success: false, error: '사유는 10-2000자 사이로 입력해주세요' }, 400)
    }
    if (evidence_url && (typeof evidence_url !== 'string' || !/^https?:\/\//.test(evidence_url) || evidence_url.length > 500)) {
      return c.json({ success: false, error: '잘못된 evidence URL' }, 400)
    }

    const { DB } = c.env
    await ensureDisputesTable(DB)

    // voucher 존재 + 본인 소유 확인
    const voucher = await DB.prepare(
      'SELECT id, user_id, status, product_id FROM vouchers WHERE code = ?'
    ).bind(voucher_code).first<{ id: number; user_id: string; status: string; product_id: number }>()
    if (!voucher) return c.json({ success: false, error: 'voucher 를 찾을 수 없습니다' }, 404)
    if (voucher.user_id !== userId) {
      return c.json({ success: false, error: '본인 voucher 만 분쟁 신청 가능합니다' }, 403)
    }
    if (voucher.status !== 'unused') {
      return c.json({ success: false, error: `이미 ${voucher.status} 상태인 voucher 는 분쟁 신청 불가` }, 400)
    }

    // 중복 분쟁 차단 (같은 voucher 에 pending dispute)
    const existing = await DB.prepare(
      "SELECT id FROM disputes WHERE voucher_code = ? AND action = 'pending'"
    ).bind(voucher_code).first()
    if (existing) {
      return c.json({ success: false, error: '이미 진행 중인 분쟁이 있습니다' }, 409)
    }

    // AI 분류 (binding 없으면 fallback)
    const ai = (c.env as Env & AIEnv).AI
    let category = 'other'
    let confidence = 0
    let reasoning = ''
    let action: 'pending' | 'auto_refunded' | 'escalated' = 'escalated'

    if (ai) {
      try {
        const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: reason_text },
          ],
          max_tokens: 200,
        })
        const text = (result.response || '').trim()
        const jsonMatch = text.match(/\{[\s\S]*?\}/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          category = String(parsed.category || 'other').slice(0, 50)
          confidence = Number(parsed.confidence) || 0
          reasoning = String(parsed.reasoning || '').slice(0, 500)
          // 자동 환불 조건: 분류 OK + confidence > 0.75
          if (AUTO_REFUND_CATEGORIES.has(category) && confidence > 0.75) {
            action = 'auto_refunded'
          }
        }
      } catch (err) {
        if (import.meta.env?.DEV) console.warn('[disputes/submit] AI failed, escalating', err)
      }
    }

    const insertResult = await DB.prepare(`
      INSERT INTO disputes (voucher_code, user_id, reason_text, evidence_url, ai_category, ai_confidence, ai_reasoning, action)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(voucher_code, userId, reason_text, evidence_url || null, category, confidence, reasoning, action).run()

    // 자동 환불 처리
    if (action === 'auto_refunded') {
      try {
        // voucher status 변경 + 딜 환불 (deal 결제만)
        await DB.prepare("UPDATE vouchers SET status = 'refunded' WHERE id = ? AND status = 'unused'").bind(voucher.id).run()
        const order = await DB.prepare(
          "SELECT o.payment_method, o.total_amount, o.user_id, p.price FROM vouchers v LEFT JOIN orders o ON o.id = v.order_id LEFT JOIN products p ON p.id = v.product_id WHERE v.id = ?"
        ).bind(voucher.id).first<{ payment_method: string; total_amount: number; user_id: string; price: number }>()
        if (order && order.payment_method === 'deal_points' && order.user_id) {
          const refundAmount = order.price
          await DB.prepare("UPDATE user_points SET balance = balance + ? WHERE user_id = ?").bind(refundAmount, order.user_id).run()
          await DB.prepare(
            "INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description) VALUES (?, 'refund', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)"
          ).bind(order.user_id, refundAmount, refundAmount, order.user_id, `[AI 자동 환불] 분쟁 #${insertResult.meta?.last_row_id}: ${category}`).run()
        }
        await DB.prepare("UPDATE disputes SET resolved_at = CURRENT_TIMESTAMP WHERE id = ?").bind(insertResult.meta?.last_row_id).run()
      } catch (err) {
        console.error('[disputes/auto-refund]', err)
        // 자동 환불 실패 시 escalated 로 다운그레이드
        await DB.prepare("UPDATE disputes SET action = 'escalated' WHERE id = ?").bind(insertResult.meta?.last_row_id).run().catch(() => {})
      }
    }

    return c.json({
      success: true,
      data: {
        dispute_id: insertResult.meta?.last_row_id,
        action,
        category,
        confidence: Math.round(confidence * 100) / 100,
        message: action === 'auto_refunded'
          ? '✅ AI 가 자동 환불 처리했어요. 5분 내 딜이 복구됩니다.'
          : '🕐 어드민 검토 중입니다. 24시간 내 답변드릴게요.',
      },
    })
  }
)

// 어드민 분쟁 처리 — 환불 승인
// 🛡️ 2026-05-15: voucher refunded + 딜 환불 + dispute resolved 표시 + 유저 푸시
disputesRoutes.post('/admin/:id/approve', requireAuth(), require2FA(), auditLog('dispute.admin.approve'), async (c) => {
  const user = getCurrentUser(c)
  const userAsAny = user as unknown as { type?: string; id?: string | number }
  if (!user || userAsAny.type !== 'admin') return c.json({ success: false, error: 'forbidden' }, 403)
  const idStr = c.req.param('id')
  const id = Number(idStr)
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 dispute id' }, 400)

  let body: { admin_notes?: string }
  try { body = await c.req.json() } catch { body = {} }
  const notes = (body.admin_notes || '').toString().slice(0, 500)

  const { DB } = c.env
  await ensureDisputesTable(DB)

  const dispute = await DB.prepare("SELECT * FROM disputes WHERE id = ? AND action IN ('escalated', 'pending')").bind(id).first<{ id: number; voucher_code: string; user_id: string; ai_category: string }>()
  if (!dispute) return c.json({ success: false, error: '처리 가능한 분쟁 없음' }, 404)

  // voucher 환불 처리
  const voucher = await DB.prepare(
    "SELECT v.id, v.user_id, v.product_id, v.status, p.price, o.payment_method FROM vouchers v LEFT JOIN orders o ON o.id = v.order_id LEFT JOIN products p ON p.id = v.product_id WHERE v.code = ?"
  ).bind(dispute.voucher_code).first<{ id: number; user_id: string; product_id: number; status: string; price: number; payment_method: string }>()
  if (!voucher) return c.json({ success: false, error: 'voucher 없음' }, 404)
  if (voucher.status !== 'unused') return c.json({ success: false, error: `이미 ${voucher.status} 상태` }, 400)

  // CAS
  const casRes = await DB.prepare("UPDATE vouchers SET status = 'refunded' WHERE id = ? AND status = 'unused'").bind(voucher.id).run()
  if (!casRes.meta?.changes) return c.json({ success: false, error: '동시성 충돌' }, 409)

  // 딜 환불
  if (voucher.payment_method === 'deal_points' && voucher.user_id) {
    await DB.prepare("UPDATE user_points SET balance = balance + ? WHERE user_id = ?").bind(voucher.price, voucher.user_id).run().catch(() => {})
    await DB.prepare(
      "INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description) VALUES (?, 'refund', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)"
    ).bind(voucher.user_id, voucher.price, voucher.price, voucher.user_id, `[분쟁 ${id} 환불 승인] ${dispute.ai_category}`).run().catch(() => {})
  }

  // dispute 상태 업데이트
  await DB.prepare(`UPDATE disputes SET action = 'resolved', admin_notes = ?, admin_user_id = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(notes || null, String(userAsAny.id ?? ''), id).run()

  // 유저 푸시
  try {
    const { sendSystemPush } = await import('../../lib/system-push')
    await sendSystemPush(c.env, 'user', voucher.user_id, {
      title: '✅ 분쟁 환불 승인',
      body: `voucher 환불이 완료됐습니다 (${voucher.price.toLocaleString()}딜)`,
      url: '/user/profile', tag: `dispute-${id}`,
    })
  } catch { /* ignore */ }

  return c.json({ success: true, message: `분쟁 #${id} 환불 처리 완료` })
})

// 어드민 분쟁 거절
disputesRoutes.post('/admin/:id/reject', requireAuth(), require2FA(), auditLog('dispute.admin.reject'), async (c) => {
  const user = getCurrentUser(c)
  const userAsAny = user as unknown as { type?: string; id?: string | number }
  if (!user || userAsAny.type !== 'admin') return c.json({ success: false, error: 'forbidden' }, 403)
  const id = Number(c.req.param('id'))
  if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 id' }, 400)
  let body: { admin_notes?: string }
  try { body = await c.req.json() } catch { body = {} }
  const notes = (body.admin_notes || '').toString().slice(0, 500)
  if (!notes || notes.length < 5) return c.json({ success: false, error: '거절 사유 5자+ 필수' }, 400)

  const { DB } = c.env
  await ensureDisputesTable(DB)

  const result = await DB.prepare(`UPDATE disputes SET action = 'rejected', admin_notes = ?, admin_user_id = ?, resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND action IN ('escalated', 'pending')`)
    .bind(notes, String(userAsAny.id ?? ''), id).run()
  if (!result.meta?.changes) return c.json({ success: false, error: '처리 가능한 분쟁 없음' }, 404)

  // 유저에게 거절 통보
  try {
    const dispute = await DB.prepare("SELECT user_id FROM disputes WHERE id = ?").bind(id).first<{ user_id: string }>()
    if (dispute?.user_id) {
      const { sendSystemPush } = await import('../../lib/system-push')
      await sendSystemPush(c.env, 'user', dispute.user_id, {
        title: '분쟁 결과 안내',
        body: `분쟁이 검토 후 거절되었습니다. 사유: ${notes.slice(0, 100)}`,
        url: '/user/profile', tag: `dispute-rejected-${id}`,
      })
    }
  } catch { /* ignore */ }

  return c.json({ success: true, message: `분쟁 #${id} 거절 처리` })
})

// ── GET /api/disputes/seller/pending — 본인 매장의 진행 중 분쟁 ──
// 🛡️ 2026-05-15: 셀러 대시보드에서 "내 매장 분쟁 N건" 카드 노출용.
disputesRoutes.get('/seller/pending', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  if (!user || userAsAny.type !== 'seller') return c.json({ success: false, error: 'forbidden' }, 403)

  const { DB } = c.env
  await ensureDisputesTable(DB)

  try {
    const { results } = await DB.prepare(`
      SELECT d.id, d.voucher_code, d.ai_category, d.action, d.created_at, p.name AS product_name
      FROM disputes d
      LEFT JOIN vouchers v ON v.code = d.voucher_code
      LEFT JOIN products p ON p.id = v.product_id
      WHERE p.seller_id = ?
        AND d.action IN ('escalated', 'pending', 'auto_refunded')
        AND d.created_at >= datetime('now', '-30 days')
      ORDER BY d.created_at DESC
      LIMIT 20
    `).bind(userAsAny.id).all().catch(() => ({ results: [] }))

    const list = (results ?? []) as Array<{ action: string }>
    const summary = {
      total: list.length,
      escalated: list.filter(d => d.action === 'escalated' || d.action === 'pending').length,
      auto_refunded: list.filter(d => d.action === 'auto_refunded').length,
    }
    return c.json({ success: true, data: { list, summary } })
  } catch (err) {
    console.error('[disputes/seller/pending]', err)
    return c.json({ success: true, data: { list: [], summary: { total: 0, escalated: 0, auto_refunded: 0 } } })
  }
})

// ── GET /api/disputes/agency/pending — 에이전시 본인 셀러망 분쟁 ──
disputesRoutes.get('/agency/pending', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  if (!user || userAsAny.type !== 'agency') return c.json({ success: false, error: 'forbidden' }, 403)

  const { DB } = c.env
  await ensureDisputesTable(DB)

  try {
    const { results } = await DB.prepare(`
      SELECT d.id, d.voucher_code, d.ai_category, d.action, d.created_at,
             p.name AS product_name, s.name AS seller_name
      FROM disputes d
      LEFT JOIN vouchers v ON v.code = d.voucher_code
      LEFT JOIN products p ON p.id = v.product_id
      LEFT JOIN sellers s ON s.id = p.seller_id
      WHERE s.agency_id = ?
        AND d.action IN ('escalated', 'pending')
        AND d.created_at >= datetime('now', '-30 days')
      ORDER BY d.created_at DESC
      LIMIT 50
    `).bind(userAsAny.id).all().catch(() => ({ results: [] }))

    return c.json({ success: true, data: { count: (results ?? []).length, list: results ?? [] } })
  } catch (err) {
    console.error('[disputes/agency/pending]', err)
    return c.json({ success: true, data: { count: 0, list: [] } })
  }
})

// ── GET /api/agency/group-buy/overview — 에이전시 본인 셀러망 공구 요약 ──
disputesRoutes.get('/agency-overview', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  const userAsAny = user as unknown as { id?: number | string; type?: string }
  if (!user || userAsAny.type !== 'agency') return c.json({ success: false, error: 'forbidden' }, 403)

  const { DB } = c.env
  try {
    const now = Date.now()
    const cutoff24h = new Date(now + 24 * 3600 * 1000).toISOString()
    const cutoff14d = new Date(now - 14 * 24 * 3600 * 1000).toISOString()

    const [groupsRow, churnRow] = await Promise.all([
      DB.prepare(`
        SELECT
          COUNT(*) AS active_count,
          SUM(CASE
            WHEN p.group_buy_deadline < ?
              AND (p.group_buy_current * 1.0 / NULLIF(p.group_buy_target, 0)) < 0.5
            THEN 1 ELSE 0
          END) AS at_risk_count
        FROM products p
        JOIN sellers s ON s.id = p.seller_id
        WHERE s.agency_id = ?
          AND p.group_buy_status = 'active'
          AND p.category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
      `).bind(cutoff24h, userAsAny.id).first<{ active_count: number; at_risk_count: number }>().catch(() => null),
      DB.prepare(`
        SELECT COUNT(*) AS churn_count
        FROM sellers s
        WHERE s.agency_id = ?
          AND s.status = 'approved'
          AND NOT EXISTS (
            SELECT 1 FROM products p WHERE p.seller_id = s.id AND p.created_at >= ?
          )
      `).bind(userAsAny.id, cutoff14d).first<{ churn_count: number }>().catch(() => null),
    ])

    return c.json({
      success: true,
      data: {
        active_groups: Number(groupsRow?.active_count ?? 0),
        at_risk_groups: Number(groupsRow?.at_risk_count ?? 0),
        churn_sellers: Number(churnRow?.churn_count ?? 0),
      },
    })
  } catch (err) {
    console.error('[agency-overview]', err)
    return c.json({ success: true, data: { active_groups: 0, at_risk_groups: 0, churn_sellers: 0 } })
  }
})

// 어드민용 분쟁 리스트
disputesRoutes.get('/admin/list', requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  const userAsAny = user as unknown as { type?: string }
  if (!user || userAsAny.type !== 'admin') return c.json({ success: false, error: 'forbidden' }, 403)
  const status = c.req.query('status') || 'pending'
  const validStatuses = ['pending', 'auto_refunded', 'escalated', 'resolved', 'rejected', 'all']
  if (!validStatuses.includes(status)) return c.json({ success: false, error: '잘못된 status' }, 400)

  const { DB } = c.env
  await ensureDisputesTable(DB)
  try {
    const sql = status === 'all'
      ? `SELECT * FROM disputes ORDER BY created_at DESC LIMIT 200`
      : `SELECT * FROM disputes WHERE action = ? ORDER BY created_at DESC LIMIT 200`
    const stmt = status === 'all' ? DB.prepare(sql) : DB.prepare(sql).bind(status)
    const { results } = await stmt.all()
    return c.json({ success: true, data: results ?? [] })
  } catch (err) {
    console.error('[disputes/admin/list]', err)
    return c.json({ success: false, error: '조회 실패' }, 500)
  }
})

export { disputesRoutes }
