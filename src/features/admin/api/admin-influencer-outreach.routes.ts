/**
 * 📣 어드민 — 인플루언서 제안 발송 큐 (유어딜 대행 발송의 운영 화면 뒤 API)
 *   설계 SSOT: docs/design/seller-dashboard-v2.md §4.2 (2026-08-22 대표 확정 플로우 3단계)
 *
 * 셀러가 접수한 제안(influencer_outreach_requests)을 유어딜 운영이 검토·발송한다.
 * 🔒 연락처(이메일 등)는 **어드민에게만** 노출 — 셀러 API(seller-influencers.routes)는 SELECT 에서
 *   연락처를 제외하는 것이 대표 확정 정책이고, 발송은 유어딜(대표)이 직접 한다.
 * 발송 자동화는 하지 않는다 — 이 API 는 수신자·수락 URL·본문 재료를 모아 주는 것까지.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAdmin } from '@/worker/middleware/auth'
import { safeError } from '@/worker/utils/safe-error'
import { adsLeadsDb } from '@/shared/ads/leads-db'
import { ensureOfferInvitesTable, generateOfferToken } from '@/features/marketing/api/influencer-offer-invites.routes'
import { enqueueOutreachEmails } from '@/features/marketing/api/outreach-email'

const app = new Hono<{ Bindings: Env }>()
app.use('*', requireAdmin())

const STATUSES = ['submitted', 'approved', 'sent', 'rejected'] as const
type OutreachStatus = (typeof STATUSES)[number]

// ── GET / — 접수 목록 ────────────────────────────────────────────────────────────────
app.get('/', async (c) => {
  try {
    const rows = await adsLeadsDb(c.env).prepare(
      `SELECT o.id, o.seller_id, s.business_name AS seller_name, o.product_id, p.name AS product_name,
              o.target_count, o.commission_pct, o.product_support, o.channels, o.period_days,
              o.message, o.status, o.quoted_fee_krw, o.admin_note, o.created_at
         FROM influencer_outreach_requests o
         LEFT JOIN sellers s ON s.id = o.seller_id
         LEFT JOIN products p ON p.id = o.product_id
        ORDER BY CASE o.status WHEN 'submitted' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, o.created_at DESC
        LIMIT 200`
    ).all().catch(() => ({ results: [] as never[] }))
    return c.json({ success: true, data: rows.results || [] })
  } catch (err) {
    return safeError(c, err, '제안 목록을 불러오지 못했습니다', '[admin-outreach]')
  }
})

// ── GET /:id — 상세: 타깃 리드 + 연락처 + 수락 URL (발송 재료) ────────────────────────
app.get('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청' }, 400)
    const db = adsLeadsDb(c.env)

    const req = await db.prepare(
      `SELECT o.*, s.business_name AS seller_name, p.name AS product_name
         FROM influencer_outreach_requests o
         LEFT JOIN sellers s ON s.id = o.seller_id
         LEFT JOIN products p ON p.id = o.product_id
        WHERE o.id = ? LIMIT 1`
    ).bind(id).first<Record<string, unknown>>()
    if (!req) return c.json({ success: false, error: '제안을 찾을 수 없습니다' }, 404)

    await ensureOfferInvitesTable(db)
    // 접수 시 토큰 생성이 실패했던 건 여기서 보충 생성(멱등 — 없는 리드만).
    const leadIds: number[] = (() => { try { return JSON.parse(String(req.target_lead_ids || '[]')) } catch { return [] } })()
    const invRows = await db.prepare(
      `SELECT lead_id, token, status, accepted_user_id FROM influencer_offer_invites WHERE outreach_id = ?`
    ).bind(id).all<{ lead_id: number; token: string; status: string; accepted_user_id: string | null }>().catch(() => ({ results: [] as never[] }))
    const haveInvite = new Set((invRows.results || []).map((r) => Number(r.lead_id)))
    const missing = leadIds.filter((l) => !haveInvite.has(l)).slice(0, 50)
    if (missing.length) {
      const stmts = missing.map((leadId) => db.prepare(
        `INSERT INTO influencer_offer_invites (outreach_id, lead_id, token, seller_id, product_id, commission_pct, product_support, channels, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(id, leadId, generateOfferToken(), Number(req.seller_id), req.product_id ?? null,
        Number(req.commission_pct) || 0, String(req.product_support || 'free'), String(req.channels || '[]'), String(req.message || '')))
      await db.batch(stmts).catch(() => null)
    }
    const invites = await db.prepare(
      `SELECT lead_id, token, status, accepted_user_id, accepted_at FROM influencer_offer_invites WHERE outreach_id = ?`
    ).bind(id).all<{ lead_id: number; token: string; status: string; accepted_user_id: string | null; accepted_at: string | null }>().catch(() => ({ results: [] as never[] }))

    // 리드 정보 + 연락처 (ADS_DB — 어드민 전용 노출)
    let leads: Record<string, unknown>[] = []
    if (leadIds.length) {
      const ph = leadIds.slice(0, 50).map(() => '?').join(',')
      const lr = await db.prepare(
        `SELECT id, platform, handle, name, category, email, subscriber_count, url
           FROM ad_influencer_leads WHERE id IN (${ph})`
      ).bind(...leadIds.slice(0, 50)).all<Record<string, unknown>>().catch(() => ({ results: [] as never[] }))
      leads = (lr.results || []) as Record<string, unknown>[]
    }
    const tokenByLead = new Map((invites.results || []).map((r) => [Number(r.lead_id), r]))
    const targets = leads.map((l) => {
      const inv = tokenByLead.get(Number(l.id))
      return {
        ...l,
        accept_url: inv ? `https://urdeal.kr/i/offer/${inv.token}` : null,
        invite_status: inv?.status || 'missing',
        accepted_user_id: inv?.accepted_user_id || null,
      }
    })
    return c.json({ success: true, data: { request: req, targets } })
  } catch (err) {
    return safeError(c, err, '제안 상세를 불러오지 못했습니다', '[admin-outreach]')
  }
})

// ── POST /:id/send — 시스템 발송 시작 (드립 큐 적재 — 스팸 방어는 outreach-email.ts 7겹) ──
app.post('/:id/send', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    if (!Number.isFinite(id) || id <= 0) return c.json({ success: false, error: '잘못된 요청' }, 400)
    // 🔴 조용한 부재 차단 (2026-08-23 실측: 라이브에 RESEND_API_KEY 미등록 → 모든 메일이 무음 스킵되던 상태)
    //   — 키 없이 큐에 쌓으면 '발송했다'고 믿게 된다. 적재 전에 명시적으로 막는다.
    if (!c.env.RESEND_API_KEY) {
      return c.json({ success: false, error: 'RESEND_API_KEY 가 등록되지 않아 이메일을 보낼 수 없습니다. Cloudflare Pages(ur-live) 환경변수에 Resend API 키를 등록해주세요.' }, 503)
    }
    const r = await enqueueOutreachEmails(c.env, id)
    await adsLeadsDb(c.env).prepare(
      `UPDATE influencer_outreach_requests SET status = 'sent', admin_note = ?, updated_at = datetime('now') WHERE id = ?`
    ).bind(`큐 적재 ${r.queued}건 · 제외 ${Object.entries(r.skipped).filter(([, n]) => n > 0).map(([k, n]) => `${k}:${n}`).join(' ') || '0'}`, id).run().catch(() => null)
    return c.json({ success: true, data: r, message: `${r.queued}건이 발송 큐에 올라갔어요. 일일 한도 안에서 5분마다 조금씩 발송됩니다.` })
  } catch (err) {
    return safeError(c, err, '발송 큐 적재 중 오류가 발생했습니다', '[admin-outreach]')
  }
})

// ── POST /:id/status — 검토 상태 변경 (submitted→approved/sent/rejected) ─────────────
app.post('/:id/status', async (c) => {
  try {
    const id = Number(c.req.param('id'))
    const b = await c.req.json<{ status?: string; admin_note?: string }>().catch(() => ({} as { status?: string; admin_note?: string }))
    const status = String(b.status || '') as OutreachStatus
    if (!STATUSES.includes(status) || status === 'submitted') {
      return c.json({ success: false, error: 'status 는 approved/sent/rejected 중 하나' }, 400)
    }
    const note = typeof b.admin_note === 'string' ? b.admin_note.slice(0, 500) : null
    const r = await adsLeadsDb(c.env).prepare(
      `UPDATE influencer_outreach_requests SET status = ?, admin_note = COALESCE(?, admin_note), updated_at = datetime('now') WHERE id = ?`
    ).bind(status, note, id).run()
    if (!r.meta?.changes) return c.json({ success: false, error: '제안을 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '상태 변경 중 오류가 발생했습니다', '[admin-outreach]')
  }
})

export { app as adminInfluencerOutreachRoutes }
