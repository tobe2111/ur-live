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
import { normalizeFundingSource } from '../district-shared'

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
  const budgetUrteam = intParam(String(b.budget_urteam ?? ''), 0)
  const autoIssue = b.auto_issue_enabled === true || b.auto_issue_enabled === 1 || b.auto_issue_enabled === '1' ? 1 : 0
  const autoFunding = normalizeFundingSource(typeof b.auto_issue_funding_source === 'string' ? b.auto_issue_funding_source : undefined)
  const tiers = sanitizeTiers(b.reward_tiers)
  const expiresDays = Math.min(365, Math.max(1, intParam(String(b.coupon_expires_days ?? ''), 30)))
  if (!slug || !name) return c.json({ success: false, error: 'slug·이름은 필수입니다' }, 400)
  if (!tiers.length) return c.json({ success: false, error: '보상 구간(reward_tiers)을 1개 이상 지정하세요 (예: 3만↑→3천)' }, 400)
  const r = await c.env.DB.prepare(
    `INSERT INTO district_campaigns (slug, name, description, status, budget_total, budget_urteam, reward_tiers, coupon_expires_days, auto_issue_enabled, auto_issue_funding_source, starts_at, ends_at, created_by)
     VALUES (?, ?, ?, 'open', ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`,
  ).bind(
    slug, name, typeof b.description === 'string' ? b.description.slice(0, 2000) : null,
    budget, budgetUrteam, JSON.stringify(tiers), expiresDays, autoIssue, autoFunding,
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

// 🧾 경로 B 설정 — 기존 캠페인의 자동발급 게이트·재원·유어팀 예산풀 조정(auto_issue_enabled / auto_issue_funding_source / budget_urteam / budget_total).
adminApp.post('/campaigns/:id/auto-issue', async (c) => {
  await ensureDistrictTables(c.env.DB)
  const id = intParam(c.req.param('id'), 0)
  const b = await c.req.json<Record<string, unknown>>().catch(() => ({} as Record<string, unknown>))
  const autoIssue = b.auto_issue_enabled === true || b.auto_issue_enabled === 1 || b.auto_issue_enabled === '1' ? 1 : 0
  const autoFunding = normalizeFundingSource(typeof b.auto_issue_funding_source === 'string' ? b.auto_issue_funding_source : undefined)
  const budgetUrteam = Math.max(0, intParam(String(b.budget_urteam ?? ''), 0))
  const budgetTotal = Math.max(0, intParam(String(b.budget_total ?? ''), 0))
  const r = await c.env.DB.prepare(
    'UPDATE district_campaigns SET auto_issue_enabled = ?, auto_issue_funding_source = ?, budget_urteam = ?, budget_total = ? WHERE id = ?',
  ).bind(autoIssue, autoFunding, budgetUrteam, budgetTotal, id).run().catch(() => null)
  if (!r || r.meta.changes === 0) return c.json({ success: false, error: 'not found' }, 404)
  return c.json({ success: true, auto_issue_enabled: autoIssue, auto_issue_funding_source: autoFunding, budget_urteam: budgetUrteam, budget_total: budgetTotal })
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
    // 🔗 7번째 필드(선택) = 유어딜 seller_id — 전환 다리(딜 병기/추천)용 연결. 비워도 됨.
    const [name, address, phone, bank, account, holder, sellerIdRaw] = line.split('|').map((s) => (s || '').trim())
    if (!name) continue
    const linkSellerId = intParam(sellerIdRaw || '', 0) || null
    // PIN 충돌(캠페인 내 UNIQUE) 시 재시도 3회
    for (let i = 0; i < 3; i++) {
      const pin = storePin()
      const r = await c.env.DB.prepare(
        `INSERT OR IGNORE INTO district_stores (campaign_id, name, store_code, address, phone, bank_name, bank_account, account_holder, seller_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).bind(id, name.slice(0, 100), pin, address || null, phone || null, bank || null, account || null, holder || null, linkSellerId)
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
    `SELECT s.id, s.name, s.store_code, s.address, s.phone, s.bank_name, s.bank_account, s.account_holder, s.is_active, s.seller_id,
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

  // 예산 소진 가드(발급합 + 이번 액면 ≤ budget_total; budget_total=0 이면 무제한).
  //   ⚠️ 알려진 한계: 검사→발급이 비원자라 '동시' 승인 2건이 둘 다 통과하면 최대 액면 1장만큼
  //   초과 가능(어드민 전용·검수 큐 순차 처리 전제 — 초과분은 리포트에서 즉시 가시). 원장 PR 에서
  //   원자화 검토.
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
  if (!coupon) {
    // 🛡️ 전수조사 MED fix: 발급 실패 시 CAS 롤백(approved→submitted) — 아니면 영수증이
    //   '지급 완료' 표시로 영구 고착 + 재승인 불가(CAS 가 submitted 만 받음). UNIQUE(receipt_id)
    //   멱등 덕에, 쿠폰이 실제 삽입됐는데 조회만 실패한 극단 케이스도 재승인 시 기존 쿠폰
    //   반환 → 이중발급 구조적 0. 롤백 실패 시에만 수동 개입 안내.
    const rb = await c.env.DB.prepare(
      `UPDATE district_receipts SET status = 'submitted', reviewed_by = NULL, reviewed_at = NULL
       WHERE id = ? AND status = 'approved'`,
    ).bind(id).run().catch(() => null)
    const rolled = !!rb && rb.meta.changes > 0
    return c.json({ success: false, error: rolled ? '쿠폰 발급 실패 — 잠시 후 다시 승인해주세요 (대기 상태로 복원됨)' : '쿠폰 발급 실패 — 관리자 확인 필요 (복원 실패)' }, 500)
  }
  await notifyDistrictUser(c.env.DB, receipt.user_id, '🎉 상권 쿠폰 지급!', `영수증 승인 완료 — ${face.toLocaleString()}원 쿠폰이 지급되었어요. 참여 점포 어디서든 쓸 수 있어요.`, { env: c.env, kind: 'issued' })
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
  if (row?.user_id) await notifyDistrictUser(c.env.DB, row.user_id, '영수증 반려 안내', `등록하신 영수증이 반려되었어요 — 사유: ${reason}`, { env: c.env, kind: 'rejected' })
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
  // 🧾 경로 A/B(source) × 재원(funding_source) 구분 집계 — 온라인/오프라인 유입 효과 + 재단/유어팀 재원 분리.
  const bySource = await DB.prepare(
    `SELECT COALESCE(source,'receipt') AS source, COALESCE(funding_source,'foundation') AS funding_source,
            COUNT(*) AS issued_count,
            COALESCE(SUM(face_value),0) AS issued_amount,
            COALESCE(SUM(CASE WHEN status='used' THEN face_value ELSE 0 END),0) AS used_amount
     FROM district_coupons WHERE campaign_id = ?
     GROUP BY COALESCE(source,'receipt'), COALESCE(funding_source,'foundation')`,
  ).bind(campaignId).all<Record<string, unknown>>().catch(() => ({ results: [] as Record<string, unknown>[] }))
  return { totals, by_store: byStore.results || [], by_source: bySource.results || [] }
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
  const { totals, by_store, by_source } = await buildReport(c.env.DB, id)
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    const g = /^[=+\-@\t\r]/.test(s) ? "'" + s : s
    return /[",\n]/.test(g) ? `"${g.replace(/"/g, '""')}"` : g
  }
  const head = ['점포ID', '점포명', '사용건수', '정산액(수수료0)', '은행', '계좌', '예금주']
  const rows: unknown[][] = (by_store as Array<Record<string, unknown>>).map((r) => [
    r.store_id, r.name, r.used_count, r.payable_amount, r.bank_name, r.bank_account, r.account_holder,
  ])
  const srcLabel = (s: unknown) => (String(s) === 'online' ? '경로B(온라인결제)' : '경로A(영수증)')
  const fundLabel = (f: unknown) => (String(f) === 'urteam' ? '유어팀' : '재단')
  const sourceHeader: unknown[][] = [[], ['— 경로/재원 구분 —'], ['구분', '재원', '발급건수', '발급액', '사용액']]
  const sourceRows: unknown[][] = sourceHeader.concat(
    (by_source as Array<Record<string, unknown>>).map((r) => [srcLabel(r.source), fundLabel(r.funding_source), r.issued_count, r.issued_amount, r.used_amount] as unknown[]),
  )
  const summary: unknown[][] = [
    [], ['— 요약 —'],
    ['발급 총액', totals?.issued_amount ?? 0], ['사용 총액(정산 대상)', totals?.used_amount ?? 0],
    ['미사용(유효)', totals?.outstanding_amount ?? 0], ['소멸(만료 — 미집행액)', totals?.lapsed_amount ?? 0],
    ...sourceRows,
  ]
  const csv = '﻿' + [head, ...rows, ...summary].map((r) => r.map(esc).join(',')).join('\r\n')
  return new Response(csv, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="district-${id}-settlement.csv"` },
  })
})

export const districtAdminRoutes = adminApp
