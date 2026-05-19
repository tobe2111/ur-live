/**
 * 🛡️ 2026-05-16: 카카오맵 후기 작성 보너스 API.
 *
 * 사용자 측:
 *   POST /api/review-bonus/submit — voucher 사용 완료 후 카카오맵 후기 URL 제출
 *   GET  /api/review-bonus/my       — 내 제출 내역
 *
 * 어드민 측:
 *   GET  /api/admin-review-bonus/list           — status='submitted' 검증 대기 목록
 *   POST /api/admin-review-bonus/:id/approve    — 승인 + 보너스 즉시 지급
 *   POST /api/admin-review-bonus/:id/reject     — 거절 (이유 입력)
 */

import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth } from '@/worker/middleware/auth'
import type { AuthUser } from '@/worker/middleware/auth'

const userApp = new Hono<{ Bindings: Env }>()
const adminApp = new Hono<{ Bindings: Env }>()

userApp.use('*', requireAuth())

async function ensureTable(DB: D1Database) {
  if (_done_ensureTable.has(DB)) return
  _done_ensureTable.add(DB)
  try {
    await DB.prepare(
      "CREATE TABLE IF NOT EXISTS kakao_review_submissions (id INTEGER PRIMARY KEY AUTOINCREMENT, voucher_id INTEGER NOT NULL, user_id TEXT NOT NULL, product_id INTEGER, seller_id INTEGER, review_url TEXT NOT NULL, bonus_amount INTEGER DEFAULT 0, status TEXT DEFAULT 'submitted', admin_notes TEXT, created_at DATETIME DEFAULT (datetime('now')), reviewed_at DATETIME, paid_at DATETIME, UNIQUE(voucher_id))"
    ).run()
  } catch { /* ignore */ }
}

async function payBonus(DB: D1Database, userId: string, amount: number, voucherId: number): Promise<boolean> {
  try {
    await DB.prepare("CREATE TABLE IF NOT EXISTS user_points (user_id TEXT PRIMARY KEY, balance INTEGER DEFAULT 0, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)").run()
    await DB.prepare(
      `INSERT INTO user_points (user_id, balance, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(user_id) DO UPDATE SET balance = balance + ?, updated_at = datetime('now')`
    ).bind(userId, amount, amount).run()
    await DB.prepare(
      `INSERT INTO point_transactions (user_id, type, amount, points_amount, balance_after, description)
       VALUES (?, 'kakao_review_bonus', ?, ?, (SELECT balance FROM user_points WHERE user_id = ?), ?)`
    ).bind(userId, amount, amount, userId, `카카오맵 후기 작성 보너스 (voucher ${voucherId})`).run().catch(() => {})
    return true
  } catch {
    return false
  }
}

userApp.post('/submit', async (c) => {
  const userId = String((c.get('user') as AuthUser).id)
  const body = await c.req.json<{ voucher_code: string; review_url?: string; screenshot_url?: string }>().catch(() => ({} as any))
  const voucherCode = String(body.voucher_code || '').trim().toUpperCase()
  const url = String(body.review_url || '').trim()
  const screenshotUrl = String(body.screenshot_url || '').trim()
  if (!voucherCode) return c.json({ success: false, error: 'voucher 코드 필요' }, 400)
  if (!url && !screenshotUrl) return c.json({ success: false, error: 'URL 또는 스크린샷 중 하나 필요' }, 400)
  // URL 검증 — 카카오맵 / 카카오 place 도메인만 (URL 제출 시)
  if (url && !/^https?:\/\/(map\.kakao\.com|place\.map\.kakao\.com|map\.naver\.com|naver\.me|kko\.to)/i.test(url)) {
    return c.json({ success: false, error: '카카오맵 또는 네이버맵 후기 URL 만 허용' }, 400)
  }
  if (url.length > 500 || screenshotUrl.length > 500) return c.json({ success: false, error: 'URL 너무 김' }, 400)
  // 스크린샷 URL 도 https 검증
  if (screenshotUrl && !/^https?:\/\//i.test(screenshotUrl)) {
    return c.json({ success: false, error: '스크린샷 URL 형식 오류' }, 400)
  }
  const DB = c.env.DB
  await ensureTable(DB)

  // voucher 검증 — 본인 + used 상태만
  const voucher = await DB.prepare(
    "SELECT id, user_id, status, product_id FROM vouchers WHERE code = ?"
  ).bind(voucherCode).first<{ id: number; user_id: string; status: string; product_id: number }>()
  if (!voucher) return c.json({ success: false, error: 'voucher 없음' }, 404)
  if (String(voucher.user_id) !== userId) return c.json({ success: false, error: '본인 voucher 만 가능' }, 403)
  if (voucher.status !== 'used') return c.json({ success: false, error: 'voucher 사용 후 제출 가능' }, 400)

  // seller_id 조회
  const product = await DB.prepare("SELECT seller_id FROM products WHERE id = ?").bind(voucher.product_id).first<{ seller_id: number }>().catch(() => null)

  // 보너스 정책 조회
  const bonusRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'kakao_review_bonus_amount'").first<{ value: string }>().catch(() => null)
  const bonusAmount = Number(bonusRow?.value ?? 1000)
  const autoRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'kakao_review_auto_approve'").first<{ value: string }>().catch(() => null)
  const autoApprove = String(autoRow?.value ?? '0') === '1'

  // 🛡️ 2026-05-16: 스크린샷 제출 시 Workers AI llava OCR 자동 검증 시도
  //   매칭 성공 → status='paid' 즉시 지급. 실패 → status='submitted' 어드민 검증으로.
  let ocrPassed = false
  let ocrNotes = ''
  if (screenshotUrl) {
    try {
      const restaurant = await DB.prepare("SELECT restaurant_name, name FROM products WHERE id = ?").bind(voucher.product_id).first<{ restaurant_name: string | null; name: string }>().catch(() => null)
      const expectedStore = (restaurant?.restaurant_name || restaurant?.name || '').trim()
      const ai = (c.env as { AI?: { run: (model: string, input: unknown) => Promise<unknown> } }).AI
      if (ai && expectedStore) {
        // llava 호출 — 이미지 분석
        const imgResp = await fetch(screenshotUrl, { signal: AbortSignal.timeout(10_000) }).catch(() => null)
        if (imgResp && imgResp.ok) {
          const buf = await imgResp.arrayBuffer()
          const aiResp = await ai.run('@cf/llava-1.5-7b-hf', {
            image: [...new Uint8Array(buf)],
            prompt: `이 이미지가 카카오맵 또는 네이버맵의 음식점 후기 스크린샷인지 확인. 후기에 매장 이름과 본문(5자 이상)이 보이는지 답해줘. JSON 형식: {"is_review": true/false, "store_name": "추정 매장명", "content_preview": "후기 본문 첫 30자"}`,
            max_tokens: 200,
          }).catch(() => null) as { description?: string; response?: string } | null
          const aiText = aiResp?.description || aiResp?.response || ''
          ocrNotes = aiText.slice(0, 300)
          // 매장명 매칭 (대소문자 무시, 공백/특수문자 제거 후 부분일치)
          const normalize = (s: string) => s.toLowerCase().replace(/[\s\W]/g, '')
          const expectedNorm = normalize(expectedStore)
          const aiNorm = normalize(aiText)
          if (aiText.toLowerCase().includes('is_review": true') || /후기|리뷰/i.test(aiText)) {
            if (expectedNorm && aiNorm.includes(expectedNorm.slice(0, 4))) {
              ocrPassed = true
            }
          }
        }
      }
    } catch (e) {
      if (import.meta.env?.DEV) console.warn('[ocr]', e)
    }
  }

  const status = (autoApprove || ocrPassed) ? 'paid' : 'submitted'
  const willPay = autoApprove || ocrPassed
  try {
    await DB.prepare(
      `INSERT INTO kakao_review_submissions (voucher_id, user_id, product_id, seller_id, review_url, bonus_amount, status, admin_notes, reviewed_at, paid_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ${willPay ? "datetime('now')" : 'NULL'}, ${willPay ? "datetime('now')" : 'NULL'})`
    ).bind(voucher.id, userId, voucher.product_id, product?.seller_id ?? null, url || screenshotUrl, willPay ? bonusAmount : 0, status, ocrPassed ? `OCR auto-approved: ${ocrNotes}` : (ocrNotes ? `OCR review: ${ocrNotes}` : null)).run()
  } catch (e) {
    return c.json({ success: false, error: '이미 제출된 voucher 입니다' }, 409)
  }

  if (willPay) {
    await payBonus(DB, userId, bonusAmount, voucher.id)
    return c.json({ success: true, message: `${bonusAmount.toLocaleString()}딜 즉시 지급되었습니다 ${ocrPassed ? '(OCR 자동 승인)' : ''}`, bonus: bonusAmount, auto_approved: true })
  }
  return c.json({ success: true, message: '제출됨 — 어드민 검증 후 보너스 지급 (보통 1~3일)', bonus: bonusAmount, auto_approved: false })
})

userApp.get('/my', async (c) => {
  const userId = String((c.get('user') as AuthUser).id)
  await ensureTable(c.env.DB)
  const { results } = await c.env.DB.prepare(
    `SELECT id, voucher_id, review_url, bonus_amount, status, created_at, reviewed_at, paid_at, admin_notes
     FROM kakao_review_submissions WHERE user_id = ?
     ORDER BY created_at DESC LIMIT 50`
  ).bind(userId).all().catch(() => ({ results: [] as any[] }))
  return c.json({ success: true, data: results || [] })
})

// 어드민
adminApp.get('/list', async (c) => {
  const status = c.req.query('status') || 'submitted'
  const { results } = await c.env.DB.prepare(
    `SELECT r.id, r.voucher_id, r.user_id, r.product_id, r.seller_id,
            r.review_url, r.bonus_amount, r.status, r.admin_notes, r.created_at, r.reviewed_at,
            p.name AS product_name, p.restaurant_name, s.name AS seller_name
     FROM kakao_review_submissions r
     LEFT JOIN products p ON p.id = r.product_id
     LEFT JOIN sellers s ON s.id = r.seller_id
     WHERE r.status = ?
     ORDER BY r.created_at ASC LIMIT 200`
  ).bind(status).all().catch(() => ({ results: [] as any[] }))
  return c.json({ success: true, data: results || [] })
})

adminApp.post('/:id/approve', async (c) => {
  const id = Number(c.req.param('id'))
  const DB = c.env.DB
  const submission = await DB.prepare("SELECT user_id, voucher_id, status FROM kakao_review_submissions WHERE id = ?").bind(id).first<{ user_id: string; voucher_id: number; status: string }>()
  if (!submission) return c.json({ success: false, error: 'not found' }, 404)
  if (submission.status !== 'submitted') return c.json({ success: false, error: '이미 처리됨' }, 400)

  const bonusRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'kakao_review_bonus_amount'").first<{ value: string }>().catch(() => null)
  const bonusAmount = Number(bonusRow?.value ?? 1000)

  const paid = await payBonus(DB, submission.user_id, bonusAmount, submission.voucher_id)
  if (!paid) return c.json({ success: false, error: '지급 실패' }, 500)

  await DB.prepare(
    "UPDATE kakao_review_submissions SET status = 'paid', bonus_amount = ?, reviewed_at = datetime('now'), paid_at = datetime('now') WHERE id = ?"
  ).bind(bonusAmount, id).run()

  // user notification
  try {
    await DB.prepare(
      `INSERT INTO user_notifications (user_id, type, title, message, link)
       VALUES (?, 'review_bonus_paid', '✨ 후기 보너스 지급', ?, '/user/profile')`
    ).bind(submission.user_id, `카카오맵 후기 작성 감사합니다! ${bonusAmount.toLocaleString()}딜 적립`).run()
  } catch { /* silent */ }

  return c.json({ success: true, bonus: bonusAmount })
})

adminApp.post('/:id/reject', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{ reason: string }>().catch(() => ({ reason: '' }))
  const reason = String(body.reason || '').trim().slice(0, 500)
  if (!reason) return c.json({ success: false, error: '거절 사유 필수' }, 400)
  const result = await c.env.DB.prepare(
    "UPDATE kakao_review_submissions SET status = 'rejected', admin_notes = ?, reviewed_at = datetime('now') WHERE id = ? AND status = 'submitted'"
  ).bind(reason, id).run()
  if (!result.meta?.changes) return c.json({ success: false, error: 'not found or already processed' }, 404)
  // notify user
  try {
    const sub = await c.env.DB.prepare("SELECT user_id FROM kakao_review_submissions WHERE id = ?").bind(id).first<{ user_id: string }>()
    if (sub) {
      await c.env.DB.prepare(
        `INSERT INTO user_notifications (user_id, type, title, message, link)
         VALUES (?, 'review_bonus_rejected', '후기 보너스 거절됨', ?, '/user/profile')`
      ).bind(sub.user_id, `사유: ${reason}`).run()
    }
  } catch { /* silent */ }
  return c.json({ success: true })
})

export { userApp as reviewBonusUserRoutes, adminApp as reviewBonusAdminRoutes }


// 🛡️ 2026-05-19: ensure* per-worker 메모이제이션 (파일 끝).
const _done_ensureTable = new WeakSet<object>()
