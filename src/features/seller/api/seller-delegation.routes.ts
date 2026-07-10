/**
 * 🤝 매장(셀러) — 에이전시 위임(delegation) 관리
 *   설계 SSOT: docs/design/vendor-commission-passthrough.md §4.3 (3단 위임 권한 모델)
 *
 * 마운트: /api/seller/delegation
 *   GET  /                   — 내 위임 관계 목록 (+ 영입 에이전시 중 미위임 = 위임 가능)
 *   POST /:agencyId/grant    — 위임 부여/갱신 {mode: 'approval'|'full'} — grant 는 매장만 (§4.3)
 *   POST /:agencyId/revoke   — 위임 회수 (🔒 불변 원칙 #2 — 언제든, 조건 없이)
 *
 * ⚠️ 돈 이동 0 — 관계/모드만. 회수 시 진행 중 에이전시 설정의 'proposed' 강등(자동 발효 중단)은
 *   vendor_commission_splits 구현(8월 flip)과 함께 — 현재는 모드 전환 + 통지만 (§4.3 열린 결정 참조).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { safeError } from '@/worker/utils/safe-error'
import { createDashboardNotification } from '@/features/notifications/api/dashboard-notifications.routes'
import {
  ensureStoreAgencyDelegation,
  upsertDelegation,
  revokeDelegation,
  isDelegationMode,
} from '../../../worker/utils/store-agency-delegation'

type Vars = { sellerId: number }
const app = new Hono<{ Bindings: Env; Variables: Vars }>()

// ── requireSeller (sub-app 부모 미들웨어 미상속 — seller JWT 검증, seller-shared SSOT) ──
app.use('*', async (c, next) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '셀러 인증이 필요합니다' }, 401)
  c.set('sellerId', sellerId)
  await next()
})

// ─── GET / — 내 위임 관계 + 위임 가능 에이전시 ─────────────────────────────
app.get('/', async (c) => {
  const sellerId = c.get('sellerId')
  try {
    const DB = c.env.DB
    await ensureStoreAgencyDelegation(DB)
    const rows = await DB.prepare(
      `SELECT d.id, d.agency_id, a.name AS agency_name, d.mode,
              d.granted_at, d.revoked_at, d.created_at, d.updated_at
         FROM store_agency_delegation d
         LEFT JOIN agencies a ON a.id = d.agency_id
        WHERE d.seller_id = ?
        ORDER BY d.updated_at DESC
        LIMIT 50`
    ).bind(sellerId).all<{
      id: number; agency_id: number; agency_name: string | null; mode: string
      granted_at: string | null; revoked_at: string | null; created_at: string; updated_at: string
    }>().catch(() => ({ results: [] as never[] }))

    // 영입 에이전시인데 아직 위임 행이 없으면 '위임 가능' 으로 노출
    const intro = await DB.prepare(
      `SELECT s.introduced_by_agency_id AS agency_id, a.name AS agency_name
         FROM sellers s
         LEFT JOIN agencies a ON a.id = s.introduced_by_agency_id
        WHERE s.id = ? AND s.introduced_by_agency_id IS NOT NULL`
    ).bind(sellerId).first<{ agency_id: number; agency_name: string | null }>().catch(() => null)

    const delegations = rows.results || []
    const availableToDelegate =
      intro && !delegations.some((d) => d.agency_id === intro.agency_id)
        ? [{ agency_id: intro.agency_id, agency_name: intro.agency_name, reason: 'introduced_by_agency' }]
        : []

    return c.json({ success: true, data: { delegations, available_to_delegate: availableToDelegate } })
  } catch (err) {
    return safeError(c, err, '위임 관계 조회 중 오류가 발생했습니다', '[seller-delegation]')
  }
})

// ─── POST /:agencyId/grant — 위임 부여/갱신 (매장만 — §4.3) ─────────────────
app.post('/:agencyId/grant', async (c) => {
  const sellerId = c.get('sellerId')
  const agencyId = parseInt(c.req.param('agencyId'), 10)
  if (!Number.isFinite(agencyId) || agencyId <= 0) {
    return c.json({ success: false, error: '잘못된 에이전시 ID 입니다' }, 400)
  }
  try {
    const DB = c.env.DB
    const body = await c.req.json<{ mode?: string }>().catch(() => ({} as { mode?: string }))
    const mode = body.mode
    if (!isDelegationMode(mode) || mode === 'self') {
      // 'self' 는 grant 가 아니라 회수(revoke) — 별도 endpoint
      return c.json({ success: false, error: "mode 는 'approval' 또는 'full' 이어야 합니다" }, 400)
    }

    // 대상 에이전시 실존 확인
    const agency = await DB.prepare('SELECT id, name FROM agencies WHERE id = ?')
      .bind(agencyId).first<{ id: number; name: string | null }>().catch(() => null)
    if (!agency) return c.json({ success: false, error: '존재하지 않는 에이전시입니다' }, 404)

    // 관계 근거 확인: 나를 영입한 에이전시 OR 기존 위임 행 존재 (임의 에이전시에 위임 방지)
    await ensureStoreAgencyDelegation(DB)
    const related = await DB.prepare(
      `SELECT s.id
         FROM sellers s
         LEFT JOIN store_agency_delegation d ON d.seller_id = s.id AND d.agency_id = ?
        WHERE s.id = ? AND (s.introduced_by_agency_id = ? OR d.id IS NOT NULL)
        LIMIT 1`
    ).bind(agencyId, sellerId, agencyId).first().catch(() => null)
    if (!related) {
      return c.json({ success: false, error: '위임할 수 있는 관계(영입/기존 위임)가 없는 에이전시입니다' }, 403)
    }

    await upsertDelegation(DB, sellerId, agencyId, mode)

    // 에이전시 대시보드 알림 (fail-soft)
    const modeLabel = mode === 'full' ? '완전위임형(즉시 발효)' : '승인형(매장 승인 시 발효)'
    try {
      const store = await DB.prepare('SELECT business_name, name FROM sellers WHERE id = ?')
        .bind(sellerId).first<{ business_name: string | null; name: string | null }>().catch(() => null)
      await createDashboardNotification(
        DB,
        'agency',
        String(agencyId),
        'delegation_granted',
        '🤝 매장 위임 부여',
        `${store?.business_name || store?.name || '매장'}이 promo 관리 위임(${modeLabel})을 부여했습니다.`,
        '/agency/stores',
      )
    } catch { /* fail-soft */ }

    return c.json({ success: true, data: { seller_id: sellerId, agency_id: agencyId, mode } })
  } catch (err) {
    return safeError(c, err, '위임 부여 처리 중 오류가 발생했습니다', '[seller-delegation]')
  }
})

// ─── POST /:agencyId/revoke — 위임 회수 (🔒 언제든, 조건 없이) ───────────────
app.post('/:agencyId/revoke', async (c) => {
  const sellerId = c.get('sellerId')
  const agencyId = parseInt(c.req.param('agencyId'), 10)
  if (!Number.isFinite(agencyId) || agencyId <= 0) {
    return c.json({ success: false, error: '잘못된 에이전시 ID 입니다' }, 400)
  }
  try {
    const DB = c.env.DB
    // §4.3 불변 원칙 #2 (회수권): 조건/승인 없이 항상 허용. mode → 'self' + revoked_at.
    // 진행 중 에이전시 설정 강등(active → proposed)은 vendor_commission_splits 구현(8월)과 함께.
    const changes = await revokeDelegation(DB, sellerId, agencyId)
    if (changes === 0) {
      return c.json({ success: false, error: '회수할 위임 관계가 없습니다' }, 404)
    }

    // 에이전시 통지 (fail-soft)
    try {
      const store = await DB.prepare('SELECT business_name, name FROM sellers WHERE id = ?')
        .bind(sellerId).first<{ business_name: string | null; name: string | null }>().catch(() => null)
      await createDashboardNotification(
        DB,
        'agency',
        String(agencyId),
        'delegation_revoked',
        '↩️ 매장 위임 회수',
        `${store?.business_name || store?.name || '매장'}이 promo 관리 위임을 회수했습니다(셀프 전환).`,
        '/agency/stores',
      )
    } catch { /* fail-soft */ }

    return c.json({ success: true, data: { seller_id: sellerId, agency_id: agencyId, mode: 'self' } })
  } catch (err) {
    return safeError(c, err, '위임 회수 처리 중 오류가 발생했습니다', '[seller-delegation]')
  }
})

export const sellerDelegationRoutes = app
