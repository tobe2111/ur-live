/**
 * 🙋 **내 가게 찾기** — 사장님이 직접 소유권을 신청하는 경로 (설계 §5(a), 3단계)
 *
 * `seller-stores.routes.ts` 에 `registerStoreClaimRoutes(app)` 로 얹는다(파일 크기 룰 —
 * 형제 `seller-store-channel.routes.ts` 와 같은 방식).
 *
 * ## 흐름
 *   ① `GET /stores/lookup-by-business?business_number=` — 내 사업자번호로 이미 올라온 매장 찾기
 *   ② `POST /store-claims` — 사업자등록증 사본 첨부해 신청 (항상 심사 대기)
 *   ③ `GET /store-claims/mine` — 내 신청 상태
 *
 * 승인은 어드민이 한다(`POST /api/admin/store-claims/:id/decide`) — 자동 승인은 없다.
 * 사업자번호는 인터넷에 공개돼 있어서 **번호 일치는 증명이 아니다.** 2026-08-26 에 번호만으로
 * 자동 승인되던 매장 등록 경로를 이미 한 번 막았다(그때 통과한 매장이 라이브에 남아 있다).
 *
 * ## 🔒 조회가 남의 정보를 흘리지 않게
 * ①은 **매장 공개 정보만** 돌려준다(이름·주소·주인 있음/없음). 지금 주인이 누구인지는 안 알려준다 —
 * 사업자번호 하나로 남의 계정 존재를 확인할 수 있으면 그건 조회가 아니라 열람이다.
 *
 * ## 🛣️ 경로를 `/stores/:id/...` 밑에 두지 않은 이유
 * `/stores/claims` 는 기존 `/stores/:id/...` 패턴에 **id='claims'** 로 먹혀 조용히 가려진다.
 * 그래서 별도 네임스페이스(`/store-claims`)로 뺐다.
 */
import type { Context, Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import {
  submitStoreClaim, ensureStoreOwnershipClaims, BIZ_CERT_PATH,
} from '@/worker/utils/store-ownership-claims'
import { resolveStoreOwnerUserId } from '@/worker/utils/seller-operators'

type Ctx = Context<{ Bindings: Env }>

export function registerStoreClaimRoutes(
  app: Hono<{ Bindings: Env }>,
  /** 요청자의 **소비자 정체성**. 호출부(`seller-stores.routes.ts`)의 것을 그대로 받는다 —
   *  같은 판정을 두 벌로 만들면 언젠가 갈린다. */
  resolveActorUserId: (c: Ctx) => Promise<number | null>,
) {
  // ── GET /stores/lookup-by-business — 사업자번호로 이미 등록된 매장 찾기 ─────────────
  app.get('/stores/lookup-by-business',
    rateLimit({ action: 'store_claim_lookup', max: 20, windowSec: 600 }),
    async (c) => {
      try {
        const userId = await resolveActorUserId(c)
        if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
        const bno = String(c.req.query('business_number') || '').replace(/-/g, '')
        if (!/^\d{10}$/.test(bno)) return c.json({ success: false, error: '사업자번호는 숫자 10자리입니다' }, 400)

        const rows = await c.env.DB.prepare(
          `SELECT id, business_name, name, address, status FROM sellers
            WHERE REPLACE(COALESCE(business_number,''), '-', '') = ? AND status != 'suspended' LIMIT 10`,
        ).bind(bno).all<{ id: number; business_name: string | null; name: string | null; address: string | null; status: string | null }>()
          .catch(() => ({ results: [] as never[] }))

        const stores = []
        for (const r of rows.results || []) {
          const owner = await resolveStoreOwnerUserId(c.env.DB, r.id)
          stores.push({
            seller_id: r.id,
            business_name: r.business_name,
            name: r.name,
            address: r.address,
            status: r.status,
            // 누가 주인인지는 알려주지 않는다 — 있는지 없는지, 그리고 그게 나인지만.
            has_owner: owner !== undefined && owner !== null,
            is_mine: owner !== undefined && owner !== null && Number(owner) === Number(userId),
          })
        }
        return c.json({ success: true, data: { stores } })
      } catch (err) {
        return safeError(c, err, '매장 조회 중 오류가 발생했습니다', '[store-claims]')
      }
    })

  // ── POST /store-claims — 소유권 신청 ─────────────────────────────────────────────
  app.post('/store-claims',
    rateLimit({ action: 'store_claim_submit', max: 5, windowSec: 3600 }),
    async (c) => {
      try {
        const userId = await resolveActorUserId(c)
        if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
        const b = await c.req.json<{
          seller_id?: unknown; business_number?: unknown; business_cert_url?: unknown
          contact_phone?: unknown; note?: unknown
        }>().catch(() => ({} as Record<string, unknown>))

        const certUrl = String(b.business_cert_url || '').trim()
        if (!BIZ_CERT_PATH.test(certUrl)) {
          return c.json({ success: false, error: '사업자등록증 사본을 첨부해주세요' }, 400)
        }
        const r = await submitStoreClaim(c.env.DB, {
          sellerId: Number(b.seller_id),
          userId,
          businessNumber: b.business_number == null ? undefined : String(b.business_number),
          certUrl,
          contactPhone: b.contact_phone == null ? undefined : String(b.contact_phone),
          note: b.note == null ? undefined : String(b.note),
        })
        if (!r.ok) {
          return c.json({ success: false, code: r.code, error: r.error },
            r.code === 'STORE_NOT_FOUND' ? 404 : r.code === 'DUPLICATE' || r.code === 'ALREADY_OWNER' ? 409 : 400)
        }
        return c.json({
          success: true,
          data: {
            claim_id: r.claimId ?? null,
            bno_match: r.bnoMatch,
            note: '신청이 접수됐습니다. 유어딜이 사업자등록증을 확인한 뒤 소유자로 등록해 드립니다.',
          },
        })
      } catch (err) {
        return safeError(c, err, '신청 중 오류가 발생했습니다', '[store-claims]')
      }
    })

  // ── GET /store-claims/mine — 내 신청 상태 ────────────────────────────────────────
  app.get('/store-claims/mine', async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      await ensureStoreOwnershipClaims(c.env.DB)
      const rows = await c.env.DB.prepare(
        `SELECT c.id, c.seller_id, c.status, c.decision_reason, c.decided_at, c.created_at,
                s.business_name, s.name AS store_name
           FROM store_ownership_claims c LEFT JOIN sellers s ON s.id = c.seller_id
          WHERE c.user_id = ? ORDER BY c.created_at DESC LIMIT 20`,
      ).bind(userId).all().catch(() => ({ results: [] as unknown[] }))
      return c.json({ success: true, data: { claims: rows.results || [] } })
    } catch (err) {
      return safeError(c, err, '신청 내역을 불러오지 못했습니다', '[store-claims]')
    }
  })
}
