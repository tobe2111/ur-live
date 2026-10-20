/**
 * 🛡️ 2026-04-28 TD-006 (split): 셀러 알림톡 (Alimtalk) 발송/충전 API
 *
 * 원본 위치: seller-management.routes.ts (1602-1968).
 * `/api/seller/alimtalk/credits*`, `/logs` 는 별도 alimtalk.routes.ts 가 처리 (path 비충돌).
 *
 * - GET   /api/seller/alimtalk          — 알림톡 계정 + 템플릿 조회
 * - POST  /api/seller/alimtalk          — 알림톡 계정 등록/수정 (관리자 승인 대기)
 * - GET   /api/seller/alimtalk/balance  — 잔액 조회
 * - POST  /api/seller/alimtalk/test     — 410 (2026-10-12 셀러 자체 채널 발송 중단 — 알리고 제거)
 * - POST  /api/seller/alimtalk/send     — 410 (같은 이유)
 * - GET   /api/seller/alimtalk/messages — 발송 내역
 * - POST  /api/seller/alimtalk/charge   — 충전 요청
 */
import { Hono } from 'hono'
import { requireSeller, getCurrentUser } from '@/worker/middleware/auth'
import { safeError } from '@/worker/utils/safe-error';
import { intParam } from '@/shared/pagination'
type Bindings = {
  DB: D1Database
  JWT_SECRET: string
}

export const sellerAlimtalkMgmtRoutes = new Hono<{ Bindings: Bindings }>()

// 🛡️ 2026-05-13: redundant cors() 제거 — worker/index.ts:243 글로벌 cors 가 처리.
//   서브라우터 wildcard 미들웨어가 같은 prefix 의 다른 라우터 경로 가로채는 버그 (Hono v4) 방지.

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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-alimtalk-mgmt]')
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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-alimtalk-mgmt]')
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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-alimtalk-mgmt]')
  }
})

// 📨 2026-10-12 — 셀러 **자체 채널** 발송(테스트·일괄)은 알리고 전용이었다(셀러마다 알리고 발신프로필).
//   발송처를 네이버 클라우드 SENS 하나로 바꾸며 알리고를 걷어냈고, SENS 는 유어딜 채널만 등록돼 있어
//   셀러 채널로는 보낼 수 없다. 라이브 실측 `alimtalk_accounts` = 0곳(한 번도 쓰인 적 없음) ⇒ 410 으로 닫는다.
//   손님 알림(주문·배송·취소)은 유어딜 채널로 계속 나간다(`features/alimtalk/send.ts`).
const OWN_CHANNEL_GONE = {
  success: false,
  code: 'OWN_CHANNEL_SEND_DISCONTINUED',
  error: '셀러 자체 채널 발송은 중단되었습니다. 손님 알림은 유어딜 채널로 자동 발송됩니다.',
} as const

sellerAlimtalkMgmtRoutes.post('/alimtalk/test', requireSeller(), (c) => c.json(OWN_CHANNEL_GONE, 410))

sellerAlimtalkMgmtRoutes.post('/alimtalk/send', requireSeller(), (c) => c.json(OWN_CHANNEL_GONE, 410))

sellerAlimtalkMgmtRoutes.get('/alimtalk/messages', requireSeller(), async (c) => {
  const { DB } = c.env
  try {
    const authUser = getCurrentUser(c)
    const sellerId = authUser?.id
    if (!sellerId) return c.json({ success: false, error: 'Unauthorized' }, 401)

    const page = intParam(c.req.query('page'), 1)
    const limit = Math.min(intParam(c.req.query('limit'), 20), 100)
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
    return safeError(c, err, '요청 처리 중 오류가 발생했습니다', '[seller-alimtalk-mgmt]')
  }
})

/**
 * 🔴 2026-08-10 폐쇄 — **무결제 충전 구멍**(대표 지시 "마진" 작업 중 발견, 코드로 확인).
 *
 * 이 엔드포인트는 **결제 검증을 단 한 줄도 하지 않고** `alimtalk_accounts.balance` 를 올린 뒤
 * `payment_status='completed'` 로 마킹했다. 셀러 JWT + 계정 행(스스로 등록 가능)만 있으면
 * 임의 건수를 **무료로** 충전할 수 있었다.
 *
 * 지금까지 실제 피해가 없던 이유는 **우연**이다 — 이 잔액을 쓰는 레거시 발송이 `status='active'`
 * 를 요구하는데 그 상태로 바꾸는 코드가 없었다. 즉 "계정 승인" 기능이 추가되는 순간 열리는 지뢰였다.
 *
 * 정상 충전 경로는 **토스 결제 연동이 붙은 현행 크레딧 시스템**이다:
 *   `POST /api/seller/alimtalk/credits/charge` → `/credits/confirm` (features/alimtalk/api/alimtalk.routes.ts)
 * 410 으로 남겨 옛 클라이언트가 조용히 성공했다고 믿지 않게 한다(프론트 호출부는 이미 0건).
 */
sellerAlimtalkMgmtRoutes.post('/alimtalk/charge', requireSeller(), (c) =>
  c.json({
    success: false,
    error: '이 충전 경로는 종료되었습니다. 알림톡 크레딧 충전을 이용해주세요.',
    code: 'ENDPOINT_RETIRED',
  }, 410))
