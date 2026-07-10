/**
 * 🤝 에이전시 — 매장 위임(delegation) + promo 투명성 조회 (read-only + 요청만)
 *   설계 SSOT: docs/design/vendor-commission-passthrough.md §4.3 (3단 위임 권한 모델)
 *
 * 마운트: /api/agency/delegation
 *   GET  /                                — 내 매장 목록 + 위임 모드 + promo 설정 요약
 *   GET  /stores/:sellerId/promo-summary  — 매장 promo 실측(90일) + 그림자 기록 + 재원 스위치
 *   POST /stores/:sellerId/request-mode   — 위임 모드 **요청**(변경 아님 — grant 는 매장만, 유어딜은 관여 X)
 *
 * ⚠️ 돈 이동 0 · 커미션 적립 로직 무변경 — 관계/투명성만. 분배 엔진은 8월 flip 과 함께.
 * 🔐 IDOR: introduced_by_agency_id = 본인 OR store_agency_delegation 행 존재 매장만 접근.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { requireAgency, type AgencyVars } from '@/lib/agency-shared'
import { safeError } from '@/worker/utils/safe-error'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import {
  ensureStoreAgencyDelegation,
  isDelegationMode,
} from '../../../worker/utils/store-agency-delegation'

const app = new Hono<{ Bindings: Env; Variables: AgencyVars }>()
app.use('*', requireAgency)

/** 이 에이전시가 해당 매장에 접근 가능한가 — 영입(introduced) OR 위임 행 존재. */
async function canAccessStore(DB: D1Database, agencyId: number, sellerId: number): Promise<boolean> {
  await ensureStoreAgencyDelegation(DB)
  const row = await DB.prepare(
    `SELECT s.id
       FROM sellers s
       LEFT JOIN store_agency_delegation d ON d.seller_id = s.id AND d.agency_id = ?
      WHERE s.id = ? AND (s.introduced_by_agency_id = ? OR d.id IS NOT NULL)
      LIMIT 1`
  ).bind(agencyId, sellerId, agencyId).first().catch(() => null)
  return !!row
}

// ─── GET / — 매장 목록 + 위임 상태 + promo 설정 요약 ───────────────────────
app.get('/', async (c) => {
  const agencyId = c.get('agency')?.id
  if (!agencyId) return c.json({ success: false, error: 'Unauthorized' }, 401)
  try {
    await ensureStoreAgencyDelegation(c.env.DB)
    const rows = await c.env.DB.prepare(
      `SELECT s.id AS seller_id, s.business_name, s.name, s.status,
              d.mode AS delegation_mode, d.granted_at, d.revoked_at,
              COALESCE((SELECT COUNT(*) FROM products p
                         WHERE p.seller_id = s.id AND p.is_active = 1
                           AND COALESCE(p.referral_commission_rate, 0) > 0), 0) AS promo_products,
              (SELECT MAX(p.referral_commission_rate) FROM products p
                WHERE p.seller_id = s.id AND p.is_active = 1) AS max_promo_pct
         FROM sellers s
         LEFT JOIN store_agency_delegation d ON d.seller_id = s.id AND d.agency_id = ?
        WHERE s.introduced_by_agency_id = ? OR d.id IS NOT NULL
        ORDER BY s.created_at DESC
        LIMIT 200`
    ).bind(agencyId, agencyId).all<{
      seller_id: number; business_name: string | null; name: string | null; status: string | null
      delegation_mode: string | null; granted_at: string | null; revoked_at: string | null
      promo_products: number; max_promo_pct: number | null
    }>().catch(() => ({ results: [] as never[] }))

    const data = (rows.results || []).map((r) => ({
      ...r,
      // null = 위임 행 없음 → UI 라벨 '미위임(셀프)' (§4.3 — 관계 없으면 매장 셀프 운영)
      delegation_label: r.delegation_mode
        ? r.delegation_mode
        : '미위임(셀프)',
    }))
    // 재원 스위치 — 목록에서 바로 프레이밍 게이트 판별 (promo-summary 선로드 불필요)
    const fund = await c.env.DB.prepare(
      `SELECT value FROM platform_settings WHERE key = 'promo_funding_source'`
    ).first<{ value: string }>().catch(() => null)
    return c.json({ success: true, data, funding_source: fund?.value || 'platform' })
  } catch (err) {
    return safeError(c, err, '위임 매장 목록 조회 중 오류가 발생했습니다', '[agency-delegation]')
  }
})

// ─── GET /stores/:sellerId/promo-summary — 매장 promo 실측/그림자/재원 ──────
app.get('/stores/:sellerId/promo-summary', async (c) => {
  const agencyId = c.get('agency')?.id
  if (!agencyId) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const sellerId = parseInt(c.req.param('sellerId'), 10)
  if (!Number.isFinite(sellerId) || sellerId <= 0) {
    return c.json({ success: false, error: '잘못된 매장 ID 입니다' }, 400)
  }
  try {
    const DB = c.env.DB
    if (!(await canAccessStore(DB, agencyId, sellerId))) {
      return c.json({ success: false, error: '해당 매장에 대한 권한이 없습니다' }, 403)
    }

    // (a) 실측: 최근 90일 affiliate promo(소개비) — 라이브 적립 경로(affiliate-credit.ts)가 쓰는
    //     status='holding'(유예) → 'granted'(확정) 유효분만 (refunded/clawback 제외).
    const measured = await DB.prepare(
      `SELECT COALESCE(SUM(ae.commission), 0) AS total, COUNT(*) AS cnt
         FROM affiliate_earnings ae
         JOIN products p ON p.id = ae.product_id AND p.seller_id = ?
        WHERE COALESCE(ae.status, '') IN ('holding', 'granted')
          AND ae.created_at >= datetime('now', '-90 days')`
    ).bind(sellerId).first<{ total: number; cnt: number }>().catch(() => null)

    // (b) 그림자: order_fee_breakdown(fee-resolver 기록 전용, 실정산 아님)의 promo 합 — 같은 90일.
    const shadow = await DB.prepare(
      `SELECT COALESCE(SUM(ofb.promo), 0) AS total, COUNT(*) AS cnt
         FROM order_fee_breakdown ofb
         JOIN orders o ON o.id = ofb.order_id AND o.seller_id = ?
        WHERE ofb.created_at >= datetime('now', '-90 days')`
    ).bind(sellerId).first<{ total: number; cnt: number }>().catch(() => null)

    // 재원 스위치 (기본 'platform' = 현행 플랫폼 부담, 'owner' = 매장 promo 부담 — 8월 flip 대상)
    const fund = await DB.prepare(
      `SELECT value FROM platform_settings WHERE key = 'promo_funding_source'`
    ).first<{ value: string }>().catch(() => null)

    return c.json({
      success: true,
      data: {
        seller_id: sellerId,
        window_days: 90,
        measured_promo_sum: Number(measured?.total) || 0,
        measured_promo_count: Number(measured?.cnt) || 0,
        shadow_promo_sum: Number(shadow?.total) || 0,
        shadow_promo_count: Number(shadow?.cnt) || 0,
        funding_source: fund?.value || 'platform',
      },
    })
  } catch (err) {
    return safeError(c, err, 'promo 요약 조회 중 오류가 발생했습니다', '[agency-delegation]')
  }
})

// ─── POST /stores/:sellerId/request-mode — 위임 모드 요청 (변경 아님) ────────
// §4.3 불변 원칙 #3: 유어딜은 값·승인에 관여 안 함 — grant 는 매장만. 에이전시는 요청(알림)만.
app.post('/stores/:sellerId/request-mode', async (c) => {
  const agencyId = c.get('agency')?.id
  if (!agencyId) return c.json({ success: false, error: 'Unauthorized' }, 401)
  const sellerId = parseInt(c.req.param('sellerId'), 10)
  if (!Number.isFinite(sellerId) || sellerId <= 0) {
    return c.json({ success: false, error: '잘못된 매장 ID 입니다' }, 400)
  }
  try {
    const DB = c.env.DB
    const body = await c.req.json<{ mode?: string }>().catch(() => ({} as { mode?: string }))
    const mode = body.mode
    // 요청 가능한 모드는 위임 2종만 ('self' 는 회수 — 매장 권한이라 요청 대상 아님)
    if (!isDelegationMode(mode) || (mode !== 'approval' && mode !== 'full')) {
      return c.json({ success: false, error: "mode 는 'approval' 또는 'full' 이어야 합니다" }, 400)
    }
    if (!(await canAccessStore(DB, agencyId, sellerId))) {
      return c.json({ success: false, error: '해당 매장에 대한 권한이 없습니다' }, 403)
    }

    const agencyName = await DB.prepare('SELECT name FROM agencies WHERE id = ?')
      .bind(agencyId).first<{ name: string | null }>().catch(() => null)

    // ⚠️ delegation 행 변경 없음 — 매장(셀러) 대시보드 알림으로 grant 요청만 (fail-soft)
    const modeLabel = mode === 'full' ? '완전위임형(즉시 발효)' : '승인형(매장 승인 시 발효)'
    try {
      await createDashboardNotification(
        DB,
        'seller',
        String(sellerId),
        'delegation_request',
        '🤝 에이전시 위임 요청',
        `${agencyName?.name || '에이전시'}가 promo 관리 위임(${modeLabel})을 요청했습니다. 위임은 매장만 부여/회수할 수 있습니다.`,
        '/seller/settings',
      )
    } catch { /* fail-soft — 알림 실패가 요청 자체를 막지 않음 */ }

    return c.json({ success: true, message: '위임 요청 알림을 매장에 보냈습니다. 발효는 매장 승인(grant) 시에만 됩니다.' })
  } catch (err) {
    return safeError(c, err, '위임 요청 처리 중 오류가 발생했습니다', '[agency-delegation]')
  }
})

export const agencyDelegationRoutes = app
