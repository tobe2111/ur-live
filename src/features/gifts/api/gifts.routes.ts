/**
 * 🛡️ 2026-04-28: 선물하기 API
 *
 * 흐름:
 *   1) sender (시청자) 가 POST /api/gifts → 결제 대기 gift 생성 (claim_token 발급)
 *   2) 클라이언트가 토스로 결제 → Toss webhook 또는 confirm 시 gift status='paid'
 *   3) 카카오톡 알림톡 자동 발송 (수신자에게 claim URL 포함 메시지)
 *   4) 수신자가 GET /api/gifts/claim/:token → 선물 정보 표시
 *   5) 수신자가 POST /api/gifts/claim/:token → 주소 입력 + status='claimed'
 *   6) 셀러가 발송 → status='shipped' → 'delivered'
 *
 * MVP 범위:
 *   - 1, 4, 5 만 구현 (2/3 은 결제·알림톡 인프라 연결 후속)
 *   - 6 도 후속 (기존 셀러 주문 관리 흐름 재활용)
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { requireAuth, getCurrentUser } from '@/worker/middleware/auth'
import { ALLOWED_ORIGINS } from '@/shared/constants'
import {
  normalizePhone,
  validateMessage,
  calcExpireAt,
  isExpired,
  canTransition,
  generateClaimToken,
  type GiftStatus,
} from '@/lib/gift'

type Bindings = { DB: D1Database; JWT_SECRET: string }

export const giftsRoutes = new Hono<{ Bindings: Bindings }>()

giftsRoutes.use('*', cors({ origin: [...ALLOWED_ORIGINS], credentials: true }))

interface GiftRow {
  id: number
  sender_user_id: number
  recipient_phone: string
  recipient_name: string | null
  product_id: number
  order_id: number | null
  message: string | null
  amount: number
  status: GiftStatus
  claim_address: string | null
  claim_token: string | null
  expires_at: string | null
  created_at: string
}

// ── POST /api/gifts — 선물 생성 (결제 대기) ────────────────────────────
giftsRoutes.post('/', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c)
    const userId = user?.id
    if (!userId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const body = await c.req.json<{
      recipient_phone: string
      recipient_name?: string
      product_id: number
      message?: string
      amount?: number  // 클라이언트 신뢰 X — 서버에서 product 가격 재조회
    }>()

    const phone = normalizePhone(body.recipient_phone)
    if (!phone) return c.json({ success: false, error: '올바른 전화번호 형식이 아닙니다' }, 400)

    const msgCheck = validateMessage(body.message)
    if (!msgCheck.ok) return c.json({ success: false, error: msgCheck.error }, 400)

    if (!body.product_id || !Number.isFinite(body.product_id)) {
      return c.json({ success: false, error: 'product_id 필수' }, 400)
    }

    // 🛡️ 서버 재계산 (CLAUDE.md: 클라이언트 금액 신뢰 금지)
    const product = await c.env.DB.prepare(
      'SELECT id, price, name, is_active FROM products WHERE id = ?'
    ).bind(body.product_id).first<{ id: number; price: number; name: string; is_active: number }>()
    if (!product || !product.is_active) {
      return c.json({ success: false, error: '상품을 찾을 수 없습니다' }, 404)
    }
    const amount = product.price

    const claimToken = generateClaimToken()
    const expiresAt = calcExpireAt().toISOString()

    const result = await c.env.DB.prepare(`
      INSERT INTO gifts (
        sender_user_id, recipient_phone, recipient_name, product_id,
        message, amount, status, claim_token, expires_at,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, datetime('now'), datetime('now'))
    `).bind(
      userId, phone, body.recipient_name || null, product.id,
      msgCheck.clean || null, amount, claimToken, expiresAt
    ).run()

    return c.json({
      success: true,
      data: {
        id: result.meta?.last_row_id,
        amount,
        claim_token: claimToken,
        // 결제는 별도 endpoint 에서 (클라이언트가 amount + gift_id 로 토스 호출)
      },
    })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── POST /api/gifts/:id/confirm — 토스 결제 confirm + gift status='paid' ──
//    클라이언트가 토스 결제 위젯에서 결제 완료 후 paymentKey 받으면 호출.
//    토스 confirm API 호출 → 성공 시 gift status 업데이트 + 알림톡 발송 트리거.
giftsRoutes.post('/:id/confirm', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c)
    const userId = user?.id
    if (!userId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const giftId = Number(c.req.param('id'))
    if (!Number.isFinite(giftId)) return c.json({ success: false, error: 'invalid id' }, 400)

    const body = await c.req.json<{
      paymentKey: string
      orderId: string  // 토스 orderId (gift_<id>_<random> 형식 권장)
      amount: number
    }>()

    if (!body.paymentKey || !body.orderId || !Number.isFinite(body.amount)) {
      return c.json({ success: false, error: 'paymentKey, orderId, amount 필수' }, 400)
    }

    // 1) gift 조회 + 소유 검증
    const gift = await c.env.DB.prepare(
      'SELECT id, sender_user_id, amount, status, claim_token, recipient_phone, product_id FROM gifts WHERE id = ?'
    ).bind(giftId).first<{
      id: number; sender_user_id: number; amount: number; status: GiftStatus;
      claim_token: string; recipient_phone: string; product_id: number;
    }>()

    if (!gift) return c.json({ success: false, error: '선물을 찾을 수 없습니다' }, 404)
    if (gift.sender_user_id !== userId) return c.json({ success: false, error: 'Forbidden' }, 403)
    if (gift.status !== 'pending') {
      return c.json({ success: false, error: `이미 처리된 선물입니다 (${gift.status})` }, 409)
    }

    // 2) 금액 검증 (서버 amount === client amount === DB gift.amount)
    if (body.amount !== gift.amount) {
      return c.json({ success: false, error: '금액이 일치하지 않습니다' }, 400)
    }

    // 3) 토스 결제 confirm 호출
    const tossSecretKey = (c.env as { TOSS_SECRET_KEY?: string }).TOSS_SECRET_KEY
    if (!tossSecretKey) {
      return c.json({ success: false, error: 'Payment configuration error' }, 500)
    }

    const tossRes = await fetch('https://api.tosspayments.com/v1/payments/confirm', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + btoa(tossSecretKey + ':'),
        'Content-Type': 'application/json',
        'Idempotency-Key': body.paymentKey,
      },
      body: JSON.stringify({
        paymentKey: body.paymentKey,
        orderId: body.orderId,
        // 🛡️ Defense-in-depth: send DB-verified gift.amount, not client body.amount
        // (these are equal due to the check above, but use the trusted source)
        amount: gift.amount,
      }),
    })

    if (!tossRes.ok) {
      const err = await tossRes.json().catch(() => ({})) as { message?: string }
      return c.json({ success: false, error: err.message || '결제 승인 실패' }, 400)
    }

    // 4) gift status 업데이트 + toss_payment_key 저장 (환불 cron 용)
    //    🛡️ 2026-04-28: ensure ADD COLUMN — 마이그레이션 미적용 환경 안전
    try {
      await c.env.DB.prepare("ALTER TABLE gifts ADD COLUMN toss_payment_key TEXT").run()
    } catch { /* exists */ }
    await c.env.DB.prepare(`
      UPDATE gifts SET status = 'paid', paid_at = datetime('now'),
        toss_payment_key = ?, updated_at = datetime('now') WHERE id = ?
    `).bind(body.paymentKey, giftId).run()

    // 5) 알림톡 발송 (best-effort, 실패해도 결제는 성공 처리)
    try {
      const baseUrl = new URL(c.req.url).origin
      const claimUrl = `${baseUrl}/gift/claim/${gift.claim_token}`
      // alimtalk 인프라 호출 (sendAlimtalk dynamic import — Worker bundle 분리 위해)
      const ALIGO_API_KEY = (c.env as { ALIGO_API_KEY?: string }).ALIGO_API_KEY
      const ALIGO_USER_ID = (c.env as { ALIGO_USER_ID?: string }).ALIGO_USER_ID
      // 🛡️ 2026-04-28: 플랫폼 공통 senderKey — 빈값이면 발송 실패. env 에 등록 필요.
      const ALIGO_SENDER_KEY = (c.env as { ALIGO_SENDER_KEY?: string }).ALIGO_SENDER_KEY
      if (ALIGO_API_KEY && ALIGO_USER_ID && ALIGO_SENDER_KEY) {
        const { sendAlimtalk } = await import('../../../lib/aligo')
        await sendAlimtalk(
          { ALIGO_API_KEY, ALIGO_USER_ID },
          {
            senderKey: ALIGO_SENDER_KEY,
            templateCode: 'gift_received',
            to: gift.recipient_phone,
            message: `[유어딜] 선물이 도착했어요! 받기 → ${claimUrl}`,
          }
        )
      }
    } catch (notifyErr) {
      if (typeof console !== 'undefined') console.error('[gift confirm] alimtalk 실패:', notifyErr)
    }

    return c.json({ success: true, data: { id: giftId, status: 'paid', claim_token: gift.claim_token } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── GET /api/gifts/sent — 내가 보낸 선물 목록 ──────────────────────────
giftsRoutes.get('/sent', requireAuth(), async (c) => {
  try {
    const user = getCurrentUser(c)
    const userId = user?.id
    if (!userId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const { results } = await c.env.DB.prepare(`
      SELECT g.id, g.recipient_phone, g.recipient_name, g.product_id, g.amount, g.message,
             g.status, g.expires_at, g.created_at,
             p.name as product_name, p.thumbnail as product_thumbnail
      FROM gifts g
      LEFT JOIN products p ON p.id = g.product_id
      WHERE g.sender_user_id = ?
      ORDER BY g.created_at DESC
      LIMIT 100
    `).bind(userId).all()

    return c.json({ success: true, data: results || [] })
  } catch (err) {
    if ((err as Error).message?.includes('no such table')) return c.json({ success: true, data: [] })
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── GET /api/gifts/claim/:token — 수신자: 선물 정보 조회 (인증 불필요) ───
//    URL 에 토큰만 알면 누구나 볼 수 있음 → 민감 정보(전화 마지막 4자리만 표시) 노출 금지
giftsRoutes.get('/claim/:token', async (c) => {
  try {
    const token = c.req.param('token')
    if (!token || token.length < 16) return c.json({ success: false, error: 'invalid token' }, 400)

    const gift = await c.env.DB.prepare(`
      SELECT g.id, g.sender_user_id, g.recipient_name, g.amount, g.message,
             g.status, g.expires_at, g.created_at,
             p.name as product_name, p.thumbnail as product_thumbnail, p.id as product_id,
             u.name as sender_name
      FROM gifts g
      LEFT JOIN products p ON p.id = g.product_id
      LEFT JOIN users u ON u.id = g.sender_user_id
      WHERE g.claim_token = ?
    `).bind(token).first<{
      id: number; sender_user_id: number; recipient_name: string | null; amount: number;
      message: string | null; status: GiftStatus; expires_at: string;
      product_name: string; product_thumbnail: string | null; product_id: number;
      sender_name: string;
    }>()

    if (!gift) return c.json({ success: false, error: '선물을 찾을 수 없습니다' }, 404)

    if (isExpired(gift.expires_at)) {
      return c.json({
        success: true,
        data: { ...gift, status: 'expired', message_to_recipient: '선물이 만료됐어요' },
      })
    }

    return c.json({ success: true, data: gift })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})

// ── POST /api/gifts/claim/:token — 수신자: 받기 + 주소 입력 ─────────────
giftsRoutes.post('/claim/:token', async (c) => {
  try {
    const token = c.req.param('token')
    if (!token || token.length < 16) return c.json({ success: false, error: 'invalid token' }, 400)

    const body = await c.req.json<{
      address: string
      address_detail?: string
      postal_code?: string
      phone?: string  // 수령자 본인 휴대폰 (recipient_phone 과 같거나 다를 수 있음)
    }>()

    if (!body.address || body.address.length < 5) {
      return c.json({ success: false, error: '주소를 입력해주세요' }, 400)
    }

    const claimPhone = body.phone ? normalizePhone(body.phone) : null

    const gift = await c.env.DB.prepare(
      'SELECT id, status, expires_at FROM gifts WHERE claim_token = ?'
    ).bind(token).first<{ id: number; status: GiftStatus; expires_at: string }>()

    if (!gift) return c.json({ success: false, error: '선물을 찾을 수 없습니다' }, 404)
    if (isExpired(gift.expires_at)) return c.json({ success: false, error: '만료된 선물입니다' }, 410)

    if (!canTransition(gift.status, 'claimed')) {
      return c.json({ success: false, error: `현재 상태(${gift.status})에서는 받을 수 없습니다` }, 400)
    }

    await c.env.DB.prepare(`
      UPDATE gifts
      SET claim_address = ?, claim_address_detail = ?, claim_postal_code = ?,
          claim_phone = ?, status = 'claimed', claimed_at = datetime('now'),
          updated_at = datetime('now')
      WHERE id = ?
    `).bind(
      body.address, body.address_detail || null, body.postal_code || null,
      claimPhone, gift.id
    ).run()

    return c.json({ success: true, data: { id: gift.id, status: 'claimed' } })
  } catch (err) {
    return c.json({ success: false, error: (err as Error).message }, 500)
  }
})
