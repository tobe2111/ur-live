/**
 * 🧾 2026-07-13 상권 쿠폰 — 어드민 API (district-coupon.routes.ts 짝, 마운트: /api/admin/district).
 *
 * 캠페인 CRUD · 매장 일괄 등록(PIN 자동발급 — 셀러 계정 불필요, 데이터 행만) · 영수증 승인 큐
 * (승인 CAS → 쿠폰 자동발급 → 알림) · 리포트(발급/사용/미사용 + 점포별) · 정산/재단 CSV.
 *
 * 💸 승인 = 머니 유사 경로(무상 발급이지만 예산 소진): CAS(submitted→approved 승자만) +
 *   UNIQUE(receipt_id) 쿠폰 멱등 + 예산 가드(발급합 ≤ budget_total) + 월 한도 재검증.
 *   정산 리포트는 district_coupons 집계(원장 무접촉 — 원장/payout 합류는 별도 격리 PR).
 */
import { Hono } from 'hono'
import type { D1Database } from '@cloudflare/workers-types'
import { requireAdmin, getCurrentUser } from '@/worker/middleware/auth'
import { intParam } from '@/shared/pagination'
import {
  ensureDistrictTables, parseRewardTiers, matchTier, insertCouponForReceipt, notifyDistrictUser,
  type DistrictEnv, type RewardTier,
} from './district-coupon.routes'

const adminApp = new Hono<{ Bindings: DistrictEnv }>()
adminApp.use('*', requireAdmin())

function storePin(): string {
  // 6자리 PIN (R1 보안 — 4자리 금지 선례). 캠페인 내 UNIQUE 인덱스가 충돌 방어.
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(100000 + (buf[0] % 900000))
}

function sanitizeTiers(raw: unknown): RewardTier[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((t) => ({ min_amount: intParam(String((t as Record<string, unknown>)?.min_amount ?? ''), 0), face_value: intParam(String((t as Record<string, unknown>)?.face_value ?? ''), 0) }))
    .filter((t) => t.min_amount > 0 && t.face_value > 0 && t.face_value <= 1_000_000)
    .slice(0, 10)
}

// ── 캠페인 ───────────────────────────────────────────────────────────────────
adminApp.post('/campaigns', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const admin = getCurrentUser(c)
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
  const slug = String(b.slug || '').trim().toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 64)
  const name = String(b.name || '').trim().slice(0, 100)
  const budget = intParam(String(b.budget_total ?? ''), 0)
  const tiers = sanitizeTiers(b.reward_tiers)
  const expiresDays = Math.min(365, Math.max(1, intParam(String(b.coupon_expires_days ?? ''), 30)))
  if (!slug || !name) return c.json({ success: false, error: 'slug·이름은 필수입니다' }, 400)
  if (!tiers.length) return c.json({ success: false, error: '보상 구간(reward_tiers)을 1개 이상 지정하세요 (예: 3만↑→3천)' }, 400)
  const r = await c.env.DB.prepare(
    `INSERT INTO district_campaigns (slug, name, description, status, budget_total, reward_tiers, coupon_expires_days, starts_at, ends_at, created_by)
     VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(
    slug, name, typeof b.description === 'string' ? b.description.slice(0, 2000) : null,
    budget, JSON.stringify(tiers), expiresDays,
    typeof b.starts_at === 'string' ? b.starts_at : null,
    typeof b.ends_at === 'string' ? b.ends_at : null,
    admin ? String(admin.id) : null,
  ).first<{ id: number }>().catch(() => null)
  if (!r?.id) return c.json({ success: false, error: '생성 실패 (slug 중복?)' }, 409)
  return c.json({ success: true, id: r.id })
})

adminApp.get('/campaigns', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const rows = await c.env.DB.prepare(
    `SELECT dc.*,
       (SELECT COUNT(*) FROM district_stores s WHERE s.campaign_id = dc.id AND s.is_active = 1) AS store_count,
       (SELECT COUNT(*) FROM district_receipts r WHERE r.campaign_id = dc.id AND r.status = 'submitted') AS pending_receipts,
       (SELECT COALESCE(SUM(face_value), 0) FROM district_coupons cp WHERE cp.campaign_id = dc.id) AS issued_total
     FROM district_campaigns dc ORDER BY dc.created_at DESC LIMIT 100`,
  ).all().catch(() => ({ results: [] }))
  return c.json({ success: true, campaigns: rows.results || [] })
})

adminApp.post('/campaigns/:id/status', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  const b = await c.req.json<{ status?: unknown }>().catch(() => ({} as { status?: unknown }))
  const status = String(b.status || '')
  if (!['open', 'closed'].includes(status)) return c.json({ success: false, error: 'status 는 open/closed' }, 400)
  const r = await c.env.DB.prepare('UPDATE district_campaigns SET status = ? WHERE id = ?').bind(status, id).run().catch(() => null)
  if (!r || r.meta.changes === 0) return c.json({ success: false, error: 'not found' }, 404)
  return c.json({ success: true })
})

// ── 매장 일괄 등록(줄바꿈 텍스트: 이름 | 주소? | 전화? | 은행? | 계좌? | 예금주?) — PIN 자동 ──
adminApp.post('/campaigns/:id/stores/bulk', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  const camp = await c.env.DB.prepare('SELECT id FROM district_campaigns WHERE id = ?').bind(id).first().catch(() => null)
  if (!camp) return c.json({ success: false, error: 'not found' }, 404)
  const b = await c.req.json<{ lines?: unknown }>().catch(() => ({} as { lines?: unknown }))
  const lines = String(b.lines || '').split('\n').map((l) => l.trim()).filter(Boolean).slice(0, 500)
  if (!lines.length) return c.json({ success: false, error: '한 줄에 한 매장씩 입력하세요' }, 400)
  let inserted = 0
  const created: Array<{ name: string; store_code: string }> = []
  for (const line of lines) {
    const [name, address, phone, bank, account, holder] = line.split('|').map((s) => (s || '').trim())
    if (!name) continue
    // PIN 충돌(캠페인 내 UNIQUE) 시 재시도 3회
    for (let i = 0; i < 3; i++) {
      const pin = storePin()
      const r = await c.env.DB.prepare(
        `INSERT OR IGNORE INTO district_stores (campaign_id, name, store_code, address, phone, bank_name, bank_account, account_holder)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, name.slice(0, 100), pin, address || null, phone || null, bank || null, account || null, holder || null)
        .run().catch(() => null)
      if (r && r.meta.changes > 0) { inserted++; created.push({ name, store_code: pin }); break }
    }
  }
  return c.json({ success: true, inserted, stores: created })
})

adminApp.get('/campaigns/:id/stores', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  const rows = await c.env.DB.prepare(
    `SELECT s.id, s.name, s.store_code, s.address, s.phone, s.bank_name, s.bank_account, s.account_holder, s.is_active,
       (SELECT COUNT(*) FROM district_coupons cp WHERE cp.redeemed_store_id = s.id) AS used_count,
       (SELECT COALESCE(SUM(cp.face_value), 0) FROM district_coupons cp WHERE cp.redeemed_store_id = s.id) AS used_amount
     FROM district_stores s WHERE s.campaign_id = ? ORDER BY s.name LIMIT 500`,
  ).bind(id).all().catch(() => ({ results: [] }))
  return c.json({ success: true, stores: rows.results || [] })
})

adminApp.post('/stores/:storeId/toggle', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const storeId = intParam(c.req.param('storeId'), 0)
  const r = await c.env.DB.prepare('UPDATE district_stores SET is_active = 1 - is_active WHERE id = ?').bind(storeId).run().catch(() => null)
  if (!r || r.meta.changes === 0) return c.json({ success: false, error: 'not found' }, 404)
  return c.json({ success: true })
})

// ── 영수증 승인 큐 ───────────────────────────────────────────────────────────
adminApp.get('/campaigns/:id/receipts', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  const status = String(c.req.query('status') || 'submitted')
  const allowed = ['submitted', 'approved', 'rejected', 'all']
  const st = allowed.includes(status) ? status : 'submitted'
  const page = Math.max(1, intParam(c.req.query('page'), 1))
  const limit = 50
  const where = st === 'all' ? '' : `AND r.status = '${st}'` // 화이트리스트 값만 (bind 불가 자리)
  const rows = await c.env.DB.prepare(
    `SELECT r.id, r.user_id, u.name AS user_name, r.store_id, s.name AS store_name, r.amount,
            r.card_approval_no, r.image_key, r.status, r.reject_reason, r.created_at,
            (SELECT COUNT(*) FROM district_receipts r2 WHERE r2.campaign_id = r.campaign_id AND r2.user_id = r.user_id AND r2.status = 'approved') AS user_approved_count
     FROM district_receipts r
     LEFT JOIN users u ON u.id = r.user_id
     LEFT JOIN district_stores s ON s.id = r.store_id
     WHERE r.campaign_id = ? ${where}
     ORDER BY r.created_at ASC LIMIT ? OFFSET ?`,
  ).bind(id, limit, (page - 1) * limit).all().catch(() => ({ results: [] }))
  return c.json({ success: true, receipts: rows.results || [] })
})

adminApp.post('/receipts/:id/approve', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const admin = getCurrentUser(c)
  const id = intParam(c.req.param('id'), 0)
  const receipt = await c.env.DB.prepare(
    `SELECT r.id, r.campaign_id, r.user_id, r.amount, dc.reward_tiers, dc.budget_total, dc.coupon_expires_days
     FROM district_receipts r JOIN district_campaigns dc ON dc.id = r.campaign_id WHERE r.id = ?`,
  ).bind(id).first<{ id: number; campaign_id: number; user_id: string; amount: number; reward_tiers: string; budget_total: number; coupon_expires_days: number }>().catch(() => null)
  if (!receipt) return c.json({ success: false, error: 'not found' }, 404)

  const face = matchTier(parseRewardTiers(receipt.reward_tiers), receipt.amount)
  if (face == null) return c.json({ success: false, error: '보상 기준액 미달 영수증입니다 — 반려하세요' }, 400)

  // 예산 소진 가드(발급합 + 이번 액면 ≤ budget_total; budget_total=0 이면 무제한)
  if (receipt.budget_total > 0) {
    const issued = await c.env.DB.prepare(
      'SELECT COALESCE(SUM(face_value), 0) AS total FROM district_coupons WHERE campaign_id = ?',
    ).bind(receipt.campaign_id).first<{ total: number }>().catch(() => null)
    if ((Number(issued?.total) || 0) + face > receipt.budget_total) {
      return c.json({ success: false, error: '캠페인 예산이 소진되었습니다 (예산 상향 또는 캠페인 종료)' }, 409)
    }
  }

  // CAS: submitted→approved 승자만 발급(동시 승인 이중발급 차단 — UNIQUE(receipt_id) 이중방어)
  const cas = await c.env.DB.prepare(
    `UPDATE district_receipts SET status = 'approved', reviewed_by = ?, reviewed_at = datetime('now')
     WHERE id = ? AND status = 'submitted'`,
  ).bind(admin ? String(admin.id) : null, id).run().catch(() => null)
  if (!cas || cas.meta.changes === 0) return c.json({ success: false, error: '이미 처리된 영수증입니다' }, 409)

  const coupon = await insertCouponForReceipt(c.env.DB, receipt, face, receipt.coupon_expires_days)
  if (!coupon) return c.json({ success: false, error: '쿠폰 발급 실패 — 재시도하세요 (영수증은 승인됨)' }, 500)
  await notifyDistrictUser(c.env.DB, receipt.user_id, '🎉 상권 쿠폰 지급!', `영수증 승인 완료 — ${face.toLocaleString()}원 쿠폰이 지급되었어요. 참여 점포 어디서든 쓸 수 있어요.`)
  return c.json({ success: true, coupon_code: coupon.code, face_value: face })
})

adminApp.post('/receipts/:id/reject', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const admin = getCurrentUser(c)
  const id = intParam(c.req.param('id'), 0)
  const b = await c.req.json<{ reason?: unknown }>().catch(() => ({} as { reason?: unknown }))
  const reason = String(b.reason || '').trim().slice(0, 300)
  if (!reason) return c.json({ success: false, error: '반려 사유는 필수입니다' }, 400)
  const row = await c.env.DB.prepare('SELECT user_id FROM district_receipts WHERE id = ?').bind(id).first<{ user_id: string }>().catch(() => null)
  const cas = await c.env.DB.prepare(
    `UPDATE district_receipts SET status = 'rejected', reject_reason = ?, reviewed_by = ?, reviewed_at = datetime('now')
     WHERE id = ? AND status = 'submitted'`,
  ).bind(reason, admin ? String(admin.id) : null, id).run().catch(() => null)
  if (!cas || cas.meta.changes === 0) return c.json({ success: false, error: '이미 처리된 영수증입니다' }, 409)
  if (row?.user_id) await notifyDistrictUser(c.env.DB, row.user_id, '영수증 반려 안내', `등록하신 영수증이 반려되었어요 — 사유: ${reason}`)
  return c.json({ success: true })
})

// ── 리포트 + CSV ─────────────────────────────────────────────────────────────
async function buildReport(DB: D1Database, campaignId: number) {
  const totals = await DB.prepare(
    `SELECT
       (SELECT COUNT(*) FROM district_receipts WHERE campaign_id = ?) AS receipts_total,
       (SELECT COUNT(*) FROM district_receipts WHERE campaign_id = ? AND status = 'submitted') AS receipts_pending,
       (SELECT COUNT(*) FROM district_coupons WHERE campaign_id = ?) AS coupons_issued,
       (SELECT COALESCE(SUM(face_value), 0) FROM district_coupons WHERE campaign_id = ?) AS issued_amount,
       (SELECT COUNT(*) FROM district_coupons WHERE campaign_id = ? AND status = 'used') AS coupons_used,
       (SELECT COALESCE(SUM(face_value), 0) FROM district_coupons WHERE campaign_id = ? AND status = 'used') AS used_amount,
       (SELECT COALESCE(SUM(face_value), 0) FROM district_coupons WHERE campaign_id = ? AND status = 'unused' AND expires_at > datetime('now')) AS outstanding_amount,
       (SELECT COALESCE(SUM(face_value), 0) FROM district_coupons WHERE campaign_id = ? AND (status = 'expired' OR (status = 'unused' AND expires_at <= datetime('now')))) AS lapsed_amount`,
  ).bind(campaignId, campaignId, campaignId, campaignId, campaignId, campaignId, campaignId, campaignId).first<Record<string, number>>().catch(() => null)
  // 점포별 사용(=정산 대상): 사용 시점 귀속(redeemed_store_id) 기준 — 수수료 0, 액면 전액
  const byStore = await DB.prepare(
    `SELECT s.id AS store_id, s.name, s.bank_name, s.bank_account, s.account_holder,
            COUNT(cp.id) AS used_count, COALESCE(SUM(cp.face_value), 0) AS payable_amount
     FROM district_stores s
     LEFT JOIN district_coupons cp ON cp.redeemed_store_id = s.id AND cp.status = 'used'
     WHERE s.campaign_id = ?
     GROUP BY s.id ORDER BY payable_amount DESC, s.name LIMIT 500`,
  ).bind(campaignId).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
  return { totals, by_store: byStore.results || [] }
}

adminApp.get('/campaigns/:id/report', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  return c.json({ success: true, ...(await buildReport(c.env.DB, id)) })
})

// 재단 제출/정산 이체용 CSV — 점포별 사용액(계좌 포함). 수식 인젝션 가드(csv-injection 룰).
adminApp.get('/campaigns/:id/report.csv', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  const { totals, by_store } = await buildReport(c.env.DB, id)
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    const g = /^[=+\-@\t\r]/.test(s) ? "'" + s : s
    return /[",\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g
  }
  const head = ['점포ID', '점포명', '사용건수', '정산액(수수료0)', '은행', '계좌', '예금주']
  const rows: unknown[][] = (by_store as Array<Record<string, unknown>>).map((r) => [
    r.store_id, r.name, r.used_count, r.payable_amount, r.bank_name, r.bank_account, r.account_holder,
  ])
  const summary = [
    [], ['— 요약 —'],
    ['발급 총액', totals?.issued_amount ?? 0], ['사용 총액(정산 대상)', totals?.used_amount ?? 0],
    ['미사용(유효)', totals?.outstanding_amount ?? 0], ['소멸(만료 — 미집행액)', totals?.lapsed_amount ?? 0],
  ]
  const csv = '﻿' + [head, ...rows, ...summary].map((r) => r.map(esc).join(',')).join('\r\n')
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="district-${id}-settlement.csv"` },
  })
})

export const districtAdminRoutes = adminApp
