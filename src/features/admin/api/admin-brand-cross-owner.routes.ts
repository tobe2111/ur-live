/**
 * 🏷️ 어드민 — **다른 점주 가맹점끼리 사용한 이용권** 내역 (2026-10-18 브랜드 3단계 후속, 대표 "응").
 *
 *   GET /api/admin/brand-cross-owner/redemptions?limit=  — 최근 다른 점주 사용 + 합계 + 게이트 상태
 *
 * 왜: 게이트(`brand_cross_owner_redeem_enabled`)를 켠 뒤 **몇 건이 어느 지점으로 정산이 넘어갔는지** 볼 곳이 없었다.
 * 기록은 사용 순간 `voucher_redeem_stores`(cross_owner=1) 에 남고 두 정산 레일이 그걸 읽는다 — 여기는 그 기록을 그대로 읽는다.
 *
 * 💰 읽기 전용 — 돈·상태 어디도 안 건드린다. 테이블이 없으면(한 번도 쓰인 적 없음) 빈 목록.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { intParam } from '@/shared/pagination'
import { ensureRedeemStoreTable, isCrossOwnerRedeemEnabled } from '@/worker/utils/brand-cross-owner'

export const adminBrandCrossOwnerRoutes = new Hono<{ Bindings: Env }>()

export interface CrossOwnerRedemptionRow {
  voucher_id: number
  used_at: string | null
  amount: number
  product_name: string | null
  sold_seller_id: number
  sold_store_name: string | null
  store_seller_id: number
  store_name: string | null
}

adminBrandCrossOwnerRoutes.get('/brand-cross-owner/redemptions', async (c) => {
  try {
    const DB = c.env.DB
    const limit = Math.min(200, Math.max(1, intParam(c.req.query('limit'), 50)))
    const enabled = await isCrossOwnerRedeemEnabled(DB)
    await ensureRedeemStoreTable(DB)
    const totals = await DB.prepare(
      `SELECT COUNT(*) AS n, COALESCE(SUM(v.applied_price), 0) AS amount
         FROM voucher_redeem_stores r JOIN vouchers v ON v.id = r.voucher_id
        WHERE r.cross_owner = 1 AND v.status = 'used'`,
    ).first<{ n: number; amount: number }>().catch(() => null)
    const { results } = await DB.prepare(
      `SELECT r.voucher_id, v.used_at, COALESCE(v.applied_price, 0) AS amount, p.name AS product_name,
              r.sold_seller_id, COALESCE(ss.business_name, ss.name) AS sold_store_name,
              r.store_seller_id, COALESCE(rs.business_name, rs.name) AS store_name
         FROM voucher_redeem_stores r
         JOIN vouchers v ON v.id = r.voucher_id
         LEFT JOIN products p ON p.id = v.product_id
         LEFT JOIN sellers ss ON ss.id = r.sold_seller_id
         LEFT JOIN sellers rs ON rs.id = r.store_seller_id
        WHERE r.cross_owner = 1 AND v.status = 'used'
        ORDER BY r.created_at DESC, r.voucher_id DESC
        LIMIT ?`,
    ).bind(limit).all<CrossOwnerRedemptionRow>().catch(() => ({ results: [] as CrossOwnerRedemptionRow[] }))
    return c.json({
      success: true,
      data: {
        enabled,
        total_count: Number(totals?.n) || 0,
        total_amount: Number(totals?.amount) || 0,
        rows: results ?? [],
      },
    })
  } catch (err) {
    return safeError(c, err, '다른 점주 사용 내역을 불러오지 못했습니다', '[admin-brand-cross-owner]')
  }
})
