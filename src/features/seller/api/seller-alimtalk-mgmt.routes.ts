/**
 * 🛡️ 2026-04-28 TD-006 (split): 셀러 알림톡 (Alimtalk) 발송/충전 API
 *
 * 원본 위치: seller-management.routes.ts (1602-1968).
 * `/api/seller/alimtalk/credits*`, `/logs` 는 별도 alimtalk.routes.ts 가 처리 (path 비충돌).
 *
 * - GET   /api/seller/alimtalk          — 알림톡 계정 + 템플릿 조회
 * - POST  /api/seller/alimtalk          — 알림톡 계정 등록/수정 (관리자 승인 대기)
 * - GET   /api/seller/alimtalk/balance  — 잔액 조회
 * - POST  /api/seller/alimtalk/test     — 테스트 발송
 * - POST  /api/seller/alimtalk/send     — 실제 발송 (잔액 선차감 + 실패분 환불)
 * - GET   /api/seller/alimtalk/messages — 발송 내역
 * - POST  /api/seller/alimtalk/charge   — 충전 요청
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireSeller, getCurrentUser } from '@/worker/middleware/auth'
import { ALLOWED_ORIGINS } from '@/shared/constants'
type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  ALIGO_API_KEY?: string
  ALIGO_USER_ID?: string
}

export const sellerAlimtalkMgmtRoutes = new Hono<{ Bindings: Bindings }>()

sellerAlimtalkMgmtRoutes.use('*', cors({
  origin: [...ALLOWED_ORIGINS],
  credentials: true,
}))

sellerAlimtalkMgmtRoutes.get('/alimtalk', requireSeller(), async (c) => {
  const { DB } = c.env
  try {
    const authUser = getCurrentUser(c)
    const sellerId = authUser?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const account = await DB.prepare(
      `SELECT id, kakao_channel_id, channel_name, phone_number, status, balance, total_sent, total_failed, created_at, updated_at
       FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first()

    const templates = account
      ? await DB.prepare(
          `SELECT id, template_code, template_name, template_type, status, created_at
           FROM alimtalk_templates WHERE account_id = ? ORDER BY created_at DESC`
        ).bind((account as { id: number }).id).all()
      : { results: [] }

    return c.json({ success: true, data: { account: account || null, templates: templates.results || [] } })
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) return c.json({ success: true, data: { account: null, templates: [] } })
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

sellerAlimtalkMgmtRoutes.post('/alimtalk', requireSeller(), async (c) => {
  const { DB } = c.env
  try {
    const authUser = getCurrentUser(c)
    const sellerId = authUser?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const body = await c.req.json<{
      kakao_channel_id: string
      channel_name: string
      sender_key?: string
      phone_number: string
    }>()

    const { kakao_channel_id, channel_name, sender_key, phone_number } = body
    if (!kakao_channel_id || !channel_name || !phone_number) {
      return c.json({ success: false, error: '카카오 채널 ID, 채널명, 전화번호는 필수입니다.' }, 400)
    }

    const existing = await DB.prepare(
      `SELECT id FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ id: number }>()

    if (existing) {
      await DB.prepare(
        `UPDATE alimtalk_accounts
         SET kakao_channel_id = ?, channel_name = ?, sender_key = ?, phone_number = ?, status = 'pending', updated_at = datetime('now')
         WHERE seller_id = ?`
      ).bind(kakao_channel_id, channel_name, sender_key || null, phone_number, sellerId).run()
    } else {
      await DB.prepare(
        `INSERT INTO alimtalk_accounts (seller_id, kakao_channel_id, channel_name, sender_key, phone_number, status, balance, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 'pending', 0, datetime('now'), datetime('now'))`
      ).bind(sellerId, kakao_channel_id, channel_name, sender_key || null, phone_number).run()
    }

    return c.json({ success: true, message: '브랜드메시지 계정이 등록되었습니다. 관리자 승인 후 활성화됩니다.' })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

sellerAlimtalkMgmtRoutes.get('/alimtalk/balance', requireSeller(), async (c) => {
  const { DB } = c.env
  try {
    const authUser = getCurrentUser(c)
    const sellerId = authUser?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const account = await DB.prepare(
      `SELECT balance, total_sent, total_failed FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ balance: number; total_sent: number; total_failed: number }>()

    if (!account) return c.json({ success: true, data: { balance: 0, total_sent: 0, total_failed: 0 } })
    return c.json({ success: true, data: account })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

sellerAlimtalkMgmtRoutes.post('/alimtalk/test', requireSeller(), async (c) => {
  const { DB } = c.env
  try {
    const authUser = getCurrentUser(c)
    const sellerId = authUser?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const { phone } = await c.req.json<{ phone: string }>()
    if (!phone) return c.json({ success: false, error: '전화번호를 입력해주세요.' }, 400)

    const account = await DB.prepare(
      `SELECT id, sender_key, status FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ id: number; sender_key: string; status: string }>()

    if (!account) return c.json({ success: false, error: '브랜드메시지 계정이 없습니다.' }, 400)
    if (account.status !== 'active') return c.json({ success: false, error: '계정이 활성 상태가 아닙니다. 관리자 승인을 기다려주세요.' }, 400)

    const ALIGO_API_KEY = c.env.ALIGO_API_KEY
    const ALIGO_USER_ID = c.env.ALIGO_USER_ID

    if (!ALIGO_API_KEY || !ALIGO_USER_ID) {
      return c.json({ success: false, error: 'Aligo API가 설정되지 않았습니다. 관리자에게 문의해주세요.' }, 500)
    }

    const { sendAlimtalk } = await import('../../../lib/aligo')
    const result = await sendAlimtalk(
      { ALIGO_API_KEY, ALIGO_USER_ID },
      {
        senderKey: account.sender_key || '',
        templateCode: 'test',
        to: phone,
        message: '[테스트] 브랜드메시지 발송 테스트입니다. ur-live에서 발송되었습니다.',
      }
    )

    return c.json({
      success: result.success,
      message: result.success ? '테스트 발송 성공' : `테스트 발송 실패: ${result.error}`,
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

sellerAlimtalkMgmtRoutes.post('/alimtalk/send', requireSeller(), async (c) => {
  const { DB } = c.env
  try {
    const authUser = getCurrentUser(c)
    const sellerId = authUser?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const body = await c.req.json<{
      template_id: number
      recipients: { phone: string; variables?: Record<string, string> }[]
      variables?: Record<string, string>
    }>()

    const { template_id, recipients, variables } = body
    if (!template_id || !recipients?.length) {
      return c.json({ success: false, error: '템플릿 ID와 수신자 목록은 필수입니다.' }, 400)
    }

    // 🛡️ 2026-04-22: 수신자 수 + 전화번호 형식 검증 (비용 공격 방어)
    if (recipients.length > 500) {
      return c.json({ success: false, error: '한 번에 최대 500명까지 발송 가능합니다.' }, 400)
    }
    const phoneRegex = /^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$|^\d{10,11}$/
    for (const r of recipients) {
      if (!r?.phone || typeof r.phone !== 'string') {
        return c.json({ success: false, error: '유효하지 않은 수신자가 있습니다.' }, 400)
      }
      const normalized = r.phone.replace(/[-\s]/g, '')
      if (!phoneRegex.test(normalized) || normalized.length < 10 || normalized.length > 11) {
        return c.json({ success: false, error: `유효하지 않은 전화번호: ${r.phone.slice(0, 4)}***` }, 400)
      }
    }

    const account = await DB.prepare(
      `SELECT id, sender_key, balance, status FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ id: number; sender_key: string; balance: number; status: string }>()

    if (!account) return c.json({ success: false, error: '알림톡 계정이 없습니다.' }, 400)
    if (account.status !== 'active') return c.json({ success: false, error: '계정이 활성 상태가 아닙니다.' }, 400)

    const cost = 15
    const totalCost = cost * recipients.length
    if (account.balance < totalCost) {
      return c.json({ success: false, error: `잔액이 부족합니다. 필요: ${totalCost}, 현재: ${account.balance}` }, 400)
    }

    const template = await DB.prepare(
      `SELECT template_code, template_content FROM alimtalk_templates WHERE id = ? AND account_id = ?`
    ).bind(template_id, account.id).first<{ template_code: string; template_content: string }>()

    if (!template) return c.json({ success: false, error: '템플릿을 찾을 수 없습니다.' }, 404)

    const ALIGO_API_KEY = c.env.ALIGO_API_KEY
    const ALIGO_USER_ID = c.env.ALIGO_USER_ID

    if (!ALIGO_API_KEY || !ALIGO_USER_ID) {
      return c.json({ success: false, error: 'Aligo API가 설정되지 않았습니다.' }, 500)
    }

    const { sendAlimtalk } = await import('../../../lib/aligo')
    let successCount = 0
    let failedCount = 0

    // 잔액 선차감 (CAS — balance >= totalCost 조건부 갱신)
    const deductResult = await DB.prepare(
      `UPDATE alimtalk_accounts SET balance = balance - ?, updated_at = datetime('now') WHERE id = ? AND balance >= ?`
    ).bind(totalCost, account.id, totalCost).run()

    if (!deductResult.meta?.changes) {
      return c.json({ success: false, error: '크레딧이 부족합니다.' }, 402)
    }

    for (const recipient of recipients) {
      try {
        // 변수 치환 (regex metachar 주입 방지 — literal replace 사용)
        const mergedVars = { ...variables, ...recipient.variables }
        let message = template.template_content
        for (const [key, value] of Object.entries(mergedVars)) {
          const literal = `#{${key}}`
          message = message.split(literal).join(String(value ?? ''))
        }

        const result = await sendAlimtalk(
          { ALIGO_API_KEY, ALIGO_USER_ID },
          { senderKey: account.sender_key, templateCode: template.template_code, to: recipient.phone, message }
        )

        const status = result.success ? 'sent' : 'failed'
        if (result.success) successCount++
        else failedCount++

        await DB.prepare(
          `INSERT INTO alimtalk_messages (account_id, template_id, recipient_phone, message_content, status, cost, aligo_message_id, failed_reason, sent_at, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        ).bind(account.id, template_id, recipient.phone, message, status, result.success ? cost : 0, result.messageId || null, result.error || null).run()
      } catch {
        failedCount++
      }
    }

    if (failedCount > 0) {
      await DB.prepare(
        `UPDATE alimtalk_accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(failedCount * cost, account.id).run()
    }

    await DB.prepare(
      `UPDATE alimtalk_accounts SET total_sent = total_sent + ?, total_failed = total_failed + ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(successCount, failedCount, account.id).run()

    return c.json({
      success: true,
      data: { total: recipients.length, success: successCount, failed: failedCount, refunded: failedCount * cost },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

sellerAlimtalkMgmtRoutes.get('/alimtalk/messages', requireSeller(), async (c) => {
  const { DB } = c.env
  try {
    const authUser = getCurrentUser(c)
    const sellerId = authUser?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const page = parseInt(c.req.query('page') || '1', 10)
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
    const offset = (page - 1) * limit

    const account = await DB.prepare(
      `SELECT id FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ id: number }>()

    if (!account) return c.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } })

    const countRow = await DB.prepare(
      `SELECT COUNT(*) as cnt FROM alimtalk_messages WHERE account_id = ?`
    ).bind(account.id).first<{ cnt: number }>()
    const total = countRow?.cnt ?? 0

    const { results } = await DB.prepare(
      `SELECT id, recipient_phone, message_content, status, cost, sent_at, failed_reason, created_at
       FROM alimtalk_messages WHERE account_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`
    ).bind(account.id, limit, offset).all()

    return c.json({
      success: true,
      data: results,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

sellerAlimtalkMgmtRoutes.post('/alimtalk/charge', requireSeller(), async (c) => {
  const { DB } = c.env
  try {
    const authUser = getCurrentUser(c)
    const sellerId = authUser?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const body = await c.req.json<{ amount: number; payment_method?: string }>()
    const { amount, payment_method } = body

    if (!amount || amount < 1000) {
      return c.json({ success: false, error: '최소 1,000건 이상 충전 가능합니다.' }, 400)
    }

    const account = await DB.prepare(
      `SELECT id FROM alimtalk_accounts WHERE seller_id = ? LIMIT 1`
    ).bind(sellerId).first<{ id: number }>()

    if (!account) return c.json({ success: false, error: '알림톡 계정이 없습니다. 먼저 계정을 등록해주세요.' }, 400)

    const pricing = await DB.prepare(
      `SELECT unit_price FROM alimtalk_pricing
       WHERE is_active = 1 AND min_quantity <= ? AND (max_quantity IS NULL OR max_quantity >= ?)
       ORDER BY unit_price ASC LIMIT 1`
    ).bind(amount, amount).first<{ unit_price: number }>()

    const unitPrice = pricing?.unit_price ?? 15
    const totalPrice = amount * unitPrice

    const orderId = `ALIM-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    await DB.prepare(
      `INSERT INTO alimtalk_charges (account_id, amount, price, unit_price, payment_method, payment_status, order_id, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', ?, datetime('now'))`
    ).bind(account.id, amount, totalPrice, unitPrice, payment_method || 'card', orderId).run()

    await DB.prepare(
      `UPDATE alimtalk_accounts SET balance = balance + ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(amount, account.id).run()

    await DB.prepare(
      `UPDATE alimtalk_charges SET payment_status = 'completed', completed_at = datetime('now') WHERE order_id = ?`
    ).bind(orderId).run()

    return c.json({
      success: true,
      message: `${Number(amount ?? 0).toLocaleString('ko-KR')}건 충전 완료 (${Number(totalPrice ?? 0).toLocaleString('ko-KR')}원)`,
      data: { amount, unit_price: unitPrice, total_price: totalPrice, order_id: orderId },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
