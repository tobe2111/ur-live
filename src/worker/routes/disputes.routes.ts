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
        console.warn('[disputes/submit] AI failed, escalating', err)
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
