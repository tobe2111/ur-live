/**
 * 🪑 **매장 소유자 지정·이전 + 소유권 신청 심사** — 설계 SSOT: `docs/design/store-operator-model.md` §5
 *
 * 대표 확정 2026-09-09 (*"지금은 유저가 없어서 지금 하면 좋은 게 아닐까"*) → 3단계.
 *
 * ## 왜 이게 없으면 매장이 잠긴다
 * `/store/new` 로 만든 매장은 `sellers.linked_user_id` 가 **비어 있고**(설계상 그렇다) 주인은
 * `seller_operators.role='owner'` 로만 표현된다. 그런데 **그 행을 만들 수 있는 사람이 아무도
 * 없었다** — `POST /stores/:id/operators` 는 `requireOwnerOfCurrentStore` 를 요구하고 역할도
 * `'operator'` 로 못 박혀 있다. 즉 주인이 없는 매장은 **영원히 주인이 없다**(라이브 실측:
 * 매장 14 홍대돈까스가 정확히 그 상태다 — 정산 계좌를 넣을 사람도 없다).
 *
 * ## 두 입구, 한 개의 SSOT
 * ① 어드민이 직접 지정 (`POST /stores/:sellerId/owner`)
 * ② 사장님이 신청 → 어드민 승인 (`POST /store-claims/:id/decide`)
 * 둘 다 **`transferStoreOwnership` 하나만** 부른다 — 자물쇠·강등·영입 보상 보존이 전부 거기 있다.
 *
 * ## 🔒 돈이 먼저다
 * 이전 주인 몫이 남아 있으면 `STORE_HANDOVER_BLOCKED` 로 막고, 마감 창구
 * (`POST /api/admin/payouts/handover-closeout`)를 응답에 적어 준다. 이 라우트는 송금하지 않는다.
 *
 * ## 🔑 영입 보상은 건드리지 않는다 (설계 §5(c))
 * 운영권이 넘어가도 `introduced_by_*` 는 그대로다. 안 그러면 중개자가 사장님을 플랫폼에서 숨긴다.
 */
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { Env } from '@/worker/types/env'
import { requireAdminRole, type AuthUser } from '../../../worker/middleware/auth'
import { require2FA } from '../../../worker/middleware/require-2fa'
import { auditLog } from '../../../worker/middleware/audit-log'
import { safeError } from '@/worker/utils/safe-error'
import { transferStoreOwnership } from '@/worker/utils/store-ownership-transfer'
import { resolveStoreOwnerUserId, ensureSellerOperators } from '@/worker/utils/seller-operators'
import { checkStoreHandover } from '@/worker/utils/store-handover-guard'
import { ensureStoreOwnershipClaims, decideStoreClaim } from '@/worker/utils/store-ownership-claims'

const adminStoreOwnerRoutes = new Hono<{ Bindings: Env; Variables: { user: AuthUser } }>()

/** 마감 창구를 응답에 항상 같이 적는다 — 막혔을 때 "그럼 뭘 하지"가 화면에 있어야 한다. */
const CLOSEOUT_PATH = '/api/admin/payouts/handover-closeout'

/** 어드민이 지목한 대상 사용자 찾기 — id · 핸들 · 이메일 중 하나. */
async function findTargetUser(
  DB: D1Database, b: { user_id?: unknown; handle?: unknown; email?: unknown },
): Promise<{ id: number; name: string | null; email: string | null; handle: string | null } | null> {
  const byId = Number(b.user_id)
  if (Number.isInteger(byId) && byId > 0) {
    return await DB.prepare('SELECT id, name, email, handle FROM users WHERE id = ? LIMIT 1')
      .bind(byId).first<{ id: number; name: string | null; email: string | null; handle: string | null }>().catch(() => null)
  }
  const handle = String(b.handle || '').trim().replace(/^@/, '')
  if (handle) {
    return await DB.prepare('SELECT id, name, email, handle FROM users WHERE handle = ? LIMIT 1')
      .bind(handle).first<{ id: number; name: string | null; email: string | null; handle: string | null }>().catch(() => null)
  }
  const email = String(b.email || '').trim()
  if (email) {
    return await DB.prepare('SELECT id, name, email, handle FROM users WHERE LOWER(email) = LOWER(?) LIMIT 1')
      .bind(email).first<{ id: number; name: string | null; email: string | null; handle: string | null }>().catch(() => null)
  }
  return null
}

// ── GET /api/admin/stores/:sellerId/owner — 지금 상태 (읽기) ──────────────────────
adminStoreOwnerRoutes.get('/stores/:sellerId/owner', cors(), requireAdminRole('finance'), async (c) => {
  try {
    const DB = c.env.DB
    const sellerId = Number(c.req.param('sellerId'))
    if (!Number.isInteger(sellerId) || sellerId <= 0) {
      return c.json({ success: false, error: '매장이 올바르지 않습니다' }, 400)
    }
    const seller = await DB.prepare(
      'SELECT id, business_name, name, business_number, linked_user_id, bank_account, status FROM sellers WHERE id = ? LIMIT 1',
    ).bind(sellerId).first<{
      id: number; business_name: string | null; name: string | null; business_number: string | null
      linked_user_id: number | null; bank_account: string | null; status: string | null
    }>().catch(() => null)
    if (!seller) return c.json({ success: false, error: '매장을 찾을 수 없습니다' }, 404)

    await ensureSellerOperators(DB)
    await ensureStoreOwnershipClaims(DB)

    const ownerUserId = await resolveStoreOwnerUserId(DB, sellerId)
    const ops = await DB.prepare(
      `SELECT o.user_id, o.role, o.granted_at, o.revoked_at, u.name, u.email, u.handle
         FROM seller_operators o LEFT JOIN users u ON u.id = o.user_id
        WHERE o.seller_id = ? ORDER BY o.revoked_at IS NOT NULL, o.granted_at LIMIT 50`,
    ).bind(sellerId).all().catch(() => ({ results: [] as unknown[] }))

    // 잔액은 "지금 이전하면 막히나"를 미리 보여주려고 읽는다(같은 함수 — 화면과 실제가 갈리지 않게).
    const gate = await checkStoreHandover(DB, sellerId, -1)

    const claims = await DB.prepare(
      `SELECT c.id, c.user_id, c.business_number, c.cert_url, c.contact_phone, c.note, c.bno_match, c.created_at,
              u.name, u.email, u.handle
         FROM store_ownership_claims c LEFT JOIN users u ON u.id = c.user_id
        WHERE c.seller_id = ? AND c.status = 'pending' ORDER BY c.created_at LIMIT 20`,
    ).bind(sellerId).all().catch(() => ({ results: [] as unknown[] }))

    return c.json({
      success: true,
      data: {
        seller: {
          id: seller.id, business_name: seller.business_name, name: seller.name,
          business_number: seller.business_number, status: seller.status,
          has_bank_account: !!seller.bank_account,
          legacy_linked_user_id: seller.linked_user_id,
        },
        owner_user_id: ownerUserId ?? null,
        owner_unknown: ownerUserId === undefined,
        operators: ops.results || [],
        receivable: gate.receivable ?? 0,
        would_block: !!gate.blocked,
        closeout_path: CLOSEOUT_PATH,
        pending_claims: claims.results || [],
      },
    })
  } catch (err) {
    return safeError(c, err, '매장 소유자 정보를 불러오지 못했습니다', '[store-owner]')
  }
})

// ── POST /api/admin/stores/:sellerId/owner — 소유자 지정·이전 ─────────────────────
adminStoreOwnerRoutes.post('/stores/:sellerId/owner',
  cors(), requireAdminRole('finance'), require2FA(), auditLog('stores.transfer_owner'),
  async (c) => {
    try {
      const DB = c.env.DB
      const sellerId = Number(c.req.param('sellerId'))
      if (!Number.isInteger(sellerId) || sellerId <= 0) {
        return c.json({ success: false, error: '매장이 올바르지 않습니다' }, 400)
      }
      const b = await c.req.json<{ user_id?: unknown; handle?: unknown; email?: unknown; reason?: unknown }>()
        .catch(() => ({} as Record<string, unknown>))
      const reason = String(b.reason || '').trim()
      if (reason.length < 5) {
        return c.json({ success: false, error: '변경 사유를 최소 5자 이상 입력하세요.' }, 400)
      }
      const target = await findTargetUser(DB, b)
      if (!target) return c.json({ success: false, code: 'USER_NOT_FOUND', error: '대상 사용자를 찾을 수 없습니다' }, 404)

      // 어드민 id 를 사용자 id 칸에 적지 않는다 — 흔적은 감사로그(auditLog)가 남긴다.
      const r = await transferStoreOwnership(DB, { sellerId, nextUserId: target.id, actorUserId: null })
      if (!r.ok) {
        return c.json({
          success: false, code: r.code, error: r.error,
          previous_owner_id: r.previousOwnerId ?? null,
          receivable: r.receivable ?? 0,
          closeout_path: CLOSEOUT_PATH,
        }, r.code === 'STORE_NOT_FOUND' ? 404 : 409)
      }
      return c.json({
        success: true,
        data: {
          seller_id: sellerId,
          previous_owner_id: r.previousOwnerId ?? null,
          new_owner: { id: target.id, name: target.name, handle: target.handle, email: target.email },
          note: r.previousOwnerId
            ? '이전 소유자는 운영자(operator)로 남습니다. 필요하면 매장 소유자가 회수할 수 있습니다.'
            : '주인이 없던 매장에 소유자를 지정했습니다.',
        },
      })
    } catch (err) {
      return safeError(c, err, '소유자 변경 중 오류가 발생했습니다', '[store-owner]')
    }
  })

// ── GET /api/admin/store-claims — 심사 대기 목록 ──────────────────────────────────
adminStoreOwnerRoutes.get('/store-claims', cors(), requireAdminRole('finance'), async (c) => {
  try {
    const DB = c.env.DB
    await ensureStoreOwnershipClaims(DB)
    const status = String(c.req.query('status') || 'pending')
    const allowed = ['pending', 'approved', 'rejected', 'cancelled']
    const st = allowed.includes(status) ? status : 'pending'
    const rows = await DB.prepare(
      `SELECT c.id, c.seller_id, c.user_id, c.business_number, c.cert_url, c.contact_phone, c.note,
              c.status, c.bno_match, c.decided_at, c.decision_reason, c.created_at,
              s.business_name, s.name AS store_name, s.business_number AS store_business_number,
              u.name AS user_name, u.email AS user_email, u.handle AS user_handle
         FROM store_ownership_claims c
         LEFT JOIN sellers s ON s.id = c.seller_id
         LEFT JOIN users u ON u.id = c.user_id
        WHERE c.status = ? ORDER BY c.created_at DESC LIMIT 200`,
    ).bind(st).all().catch(() => ({ results: [] as unknown[] }))
    return c.json({ success: true, data: { status: st, claims: rows.results || [] } })
  } catch (err) {
    return safeError(c, err, '신청 목록을 불러오지 못했습니다', '[store-claims]')
  }
})

// ── POST /api/admin/store-claims/:id/decide — 승인 / 거절 ─────────────────────────
adminStoreOwnerRoutes.post('/store-claims/:id/decide',
  cors(), requireAdminRole('finance'), require2FA(), auditLog('stores.decide_claim'),
  async (c) => {
    try {
      const DB = c.env.DB
      const claimId = Number(c.req.param('id'))
      if (!Number.isInteger(claimId) || claimId <= 0) {
        return c.json({ success: false, error: '신청서가 올바르지 않습니다' }, 400)
      }
      const b = await c.req.json<{ approve?: unknown; reason?: unknown }>().catch(() => ({} as Record<string, unknown>))
      const approve = b.approve === true || b.approve === 'true'
      const reason = String(b.reason || '').trim()
      // 거절은 반드시 이유가 남아야 한다 — 신청자에게 무엇을 고쳐 오라고 할지가 그 안에 있다.
      if (!approve && reason.length < 5) {
        return c.json({ success: false, error: '거절 사유를 최소 5자 이상 입력하세요.' }, 400)
      }
      const admin = c.get('user')
      const adminId = Number(admin?.id)

      const r = await decideStoreClaim(DB, {
        claimId,
        // 어드민 id 는 `decided_by` 에만 적는다(사용자 id 칸과 섞지 않는다).
        adminUserId: Number.isFinite(adminId) ? adminId : 0,
        approve, reason,
      })
      if (!r.ok) {
        return c.json({
          success: false, code: r.code, error: r.error,
          receivable: r.transfer?.receivable ?? 0,
          previous_owner_id: r.transfer?.previousOwnerId ?? null,
          transfer_code: r.transfer?.code,
          closeout_path: CLOSEOUT_PATH,
          note: r.code === 'TRANSFER_BLOCKED'
            ? '신청서는 심사 대기 상태로 남아 있습니다. 마감 정산 후 다시 승인하세요.'
            : undefined,
        }, r.code === 'CLAIM_NOT_FOUND' ? 404 : 409)
      }
      return c.json({ success: true, data: { claim_id: claimId, approved: approve, previous_owner_id: r.transfer?.previousOwnerId ?? null } })
    } catch (err) {
      return safeError(c, err, '신청 처리 중 오류가 발생했습니다', '[store-claims]')
    }
  })

export { adminStoreOwnerRoutes }
