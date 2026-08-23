/**
 * 📣 인플루언서 제안 수락 다리 — 유어애즈 리드(비회원) → 유어딜 딜(seller_influencer_deals)
 *   설계 SSOT: docs/design/seller-dashboard-v2.md §4 (2026-08-22 대표 확정 플로우 3~5단계)
 *
 * 흐름: 셀러 제안(influencer_outreach_requests) → 타깃 리드별 수락 토큰(influencer_offer_invites)
 *   → 유어딜이 대행 발송(어드민 큐에서 수락 URL 복사) → 인플루언서가 /i/offer/{token} 열고
 *   카카오 로그인 → 수락 → **seller_influencer_deals(status='active', 제안서의 커미션 %)** 생성
 *   → 전용 링크(`/group-buy/{productId}?ref={userId}`) 발급. 이후 판매·적립·환불회수·지급은
 *   기존 레일(applyGroupBuyReferral → influencer_attributions → payout)이 그대로 처리한다.
 *
 * 🔑 심플 모델(2026-08-22 대표 "어필리에이트 전략은 빼려고 해"): 인플루언서 수익은 이 딜 % 하나.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAuth } from '@/worker/middleware/auth'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { safeError } from '@/worker/utils/safe-error'
import { adsLeadsDb } from '@/shared/ads/leads-db'

type OfferVars = { user?: { id: string | number; email?: string } }
const app = new Hono<{ Bindings: Env; Variables: OfferVars }>()

// ── 테이블 (repair-schema column-repairs 에도 동일 등록) ─────────────────────────────
let _ensured = false
export async function ensureOfferInvitesTable(DB: D1Database) {
  if (_ensured) return
  _ensured = true
  try {
    await DB.prepare(`CREATE TABLE IF NOT EXISTS influencer_offer_invites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      outreach_id INTEGER NOT NULL,
      lead_id INTEGER,
      token TEXT NOT NULL UNIQUE,
      seller_id INTEGER NOT NULL,
      product_id INTEGER,
      commission_pct REAL NOT NULL DEFAULT 0,
      product_support TEXT NOT NULL DEFAULT 'free',
      channels TEXT NOT NULL DEFAULT '[]',
      message TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      accepted_user_id TEXT,
      accepted_at DATETIME,
      created_at DATETIME DEFAULT (datetime('now'))
    )`).run()
    await DB.prepare(`CREATE INDEX IF NOT EXISTS idx_offer_invites_outreach ON influencer_offer_invites(outreach_id)`).run()
  } catch { /* fail-soft */ }
}

export function generateOfferToken(): string {
  const bytes = new Uint8Array(18)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

const TOKEN_RX = /^[0-9a-f]{36}$/

// ── 수신거부 (원클릭 — RFC 8058: Gmail/야후는 POST, 사람은 링크로 GET) ──────────────
// 인증 없음: 메일 수신자가 로그인 없이 즉시 끊을 수 있어야 한다. 토큰만으로 리드 특정.
async function handleUnsubscribe(c: { env: Env; req: { param: (k: string) => string | undefined } }) {
  const token = c.req.param('token') || ''
  if (!TOKEN_RX.test(token)) return null
  const db = adsLeadsDb(c.env)
  const inv = await db.prepare('SELECT lead_id FROM influencer_offer_invites WHERE token = ? LIMIT 1')
    .bind(token).first<{ lead_id: number | null }>().catch(() => null)
  if (!inv) return null
  let email: string | null = null
  if (inv.lead_id) {
    const lead = await db.prepare('SELECT email FROM ad_influencer_leads WHERE id = ? LIMIT 1')
      .bind(inv.lead_id).first<{ email: string | null }>().catch(() => null)
    email = (lead?.email || '').trim().toLowerCase() || null
    // 3중 서프레션 등록 — 리드 플래그 + 유어애즈 억제 + 메인 억제(발송기 최종 필터)
    await db.prepare('UPDATE ad_influencer_leads SET opted_out = 1 WHERE id = ?').bind(inv.lead_id).run().catch(() => null)
    if (email) {
      await db.prepare("INSERT OR IGNORE INTO ad_email_suppress (email, reason) VALUES (?, 'unsubscribe')").bind(email).run().catch(() => null)
      await db.prepare("INSERT OR IGNORE INTO email_suppressions (email, reason) VALUES (?, 'unsubscribe')").bind(email).run().catch(() => null)
    }
  }
  return true
}
const UNSUB_HTML = `<!doctype html><html lang="ko"><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:90vh;margin:0"><div style="text-align:center"><h1 style="font-size:20px">수신거부가 완료되었습니다</h1><p style="color:#666;font-size:14px">더 이상 유어딜의 제안 메일이 발송되지 않습니다.</p></div></body></html>`
app.get('/unsubscribe/:token', async (c) => {
  const ok = await handleUnsubscribe(c as never).catch(() => null)
  return c.html(ok ? UNSUB_HTML : UNSUB_HTML) // 토큰 불명이어도 같은 화면 — 열람으로 존재 추측 못 하게
})
app.post('/unsubscribe/:token', async (c) => {
  await handleUnsubscribe(c as never).catch(() => null)
  return c.text('ok') // RFC 8058 원클릭 — 메일 클라이언트가 POST
})

// ── GET /:token — 제안 미리보기 (공개 — 발송받은 사람이 로그인 전에 본다) ──────────────
app.get('/:token', async (c) => {
  try {
    const token = c.req.param('token') || ''
    if (!TOKEN_RX.test(token)) return c.json({ success: false, error: '유효하지 않은 제안 링크입니다' }, 404)
    const db = adsLeadsDb(c.env)
    await ensureOfferInvitesTable(db)
    const inv = await db.prepare(
      `SELECT i.id, i.seller_id, i.product_id, i.commission_pct, i.product_support, i.channels, i.message, i.status,
              s.business_name AS seller_name,
              p.name AS product_name, p.price AS product_price, p.image_url AS product_image
         FROM influencer_offer_invites i
         JOIN sellers s ON s.id = i.seller_id
         LEFT JOIN products p ON p.id = i.product_id
        WHERE i.token = ? LIMIT 1`
    ).bind(token).first<Record<string, unknown>>().catch(() => null)
    if (!inv) return c.json({ success: false, error: '제안을 찾을 수 없습니다' }, 404)
    return c.json({ success: true, data: inv })
  } catch (err) {
    return safeError(c, err, '제안을 불러오지 못했습니다', '[offer-invite]')
  }
})

// ── POST /:token/accept — 수락 → 딜 발효 + 전용 링크 (소비자 로그인 필요) ─────────────
app.post('/:token/accept', requireAuth(), rateLimit({ action: 'offer_accept', max: 10, windowSec: 3600 }), async (c) => {
  try {
    const token = c.req.param('token') || ''
    if (!TOKEN_RX.test(token)) return c.json({ success: false, error: '유효하지 않은 제안 링크입니다' }, 404)
    const userId = String((c.get('user') as { id: string | number }).id)
    const db = adsLeadsDb(c.env)
    await ensureOfferInvitesTable(db)

    const inv = await db.prepare(
      `SELECT id, seller_id, product_id, commission_pct, message, status, accepted_user_id
         FROM influencer_offer_invites WHERE token = ? LIMIT 1`
    ).bind(token).first<{ id: number; seller_id: number; product_id: number | null; commission_pct: number; message: string | null; status: string; accepted_user_id: string | null }>()
    if (!inv) return c.json({ success: false, error: '제안을 찾을 수 없습니다' }, 404)

    // 이미 내가 수락한 토큰 재방문 → 멱등 성공(링크 다시 보여준다)
    if (inv.status === 'accepted' && inv.accepted_user_id === userId) {
      return c.json({ success: true, data: acceptPayload(inv.product_id, userId) })
    }
    if (inv.status !== 'pending') return c.json({ success: false, error: '이미 사용된 제안 링크입니다' }, 409)

    // 💸 머니 룰 #1 CAS: pending → accepted 선점 후에만 딜 생성 (동시 수락/재사용 차단)
    const cas = await db.prepare(
      `UPDATE influencer_offer_invites SET status = 'accepted', accepted_user_id = ?, accepted_at = datetime('now')
        WHERE id = ? AND status = 'pending'`
    ).bind(userId, inv.id).run()
    if (!cas.meta?.changes) return c.json({ success: false, error: '이미 사용된 제안 링크입니다' }, 409)

    // 딜 발효 — marketing.routes 의 propose 와 동일 upsert 형태. 제안서 % 그대로(당사자 합의값).
    const pct = Math.max(0, Math.min(90, Number(inv.commission_pct) || 0))
    await db.prepare(
      `INSERT INTO seller_influencer_deals (seller_id, influencer_id, commission_pct, status, proposed_by, message)
       VALUES (?, ?, ?, 'active', 'outreach', ?)
       ON CONFLICT(seller_id, influencer_id) DO UPDATE SET
         commission_pct = excluded.commission_pct,
         status = 'active',
         proposed_by = 'outreach',
         message = excluded.message,
         responded_at = datetime('now')`
    ).bind(inv.seller_id, userId, pct, inv.message || null).run()

    return c.json({ success: true, data: acceptPayload(inv.product_id, userId) })
  } catch (err) {
    return safeError(c, err, '제안 수락 중 오류가 발생했습니다', '[offer-invite]')
  }
})

function acceptPayload(productId: number | null, userId: string) {
  return {
    accepted: true,
    // 전용 홍보 링크 — 기존 ?ref 귀속 레일이 그대로 소비(주문 귀속 → 딜 % 적립 → 환불 회수 → 지급)
    tracking_url: productId ? `https://urdeal.kr/group-buy/${productId}?ref=${userId}` : `https://urdeal.kr/?ref=${userId}`,
    linkshop_hint: '가입하며 만들어진 내 링크샵(/u/내핸들)에도 이 이용권을 핀해서 함께 홍보할 수 있어요.',
  }
}

export { app as influencerOfferInvitesRoutes }
