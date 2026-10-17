/**
 * 🏬 이용권을 **다른 지점에 복사** (2026-10-17 대표 — 프랜차이즈 지점 여럿, "응응 다 해줘")
 *
 * ## 왜 필요한가
 * 지점이 여럿인 본사·점주는 같은 이용권을 지점마다 다시 만들어야 했다. 30곳이면 30번이다.
 *
 * ## 규칙 (대표 확정 — "모든 건 지점 단위이고, 그 지점 주인이 정한다")
 * - 복사는 **내가 운영할 수 있는 지점끼리만** 된다. 원본 지점과 대상 지점 둘 다 `canOperateStore` 를
 *   통과해야 한다(좌석 토큰 발급과 같은 근거 — 남의 지점에 이용권을 꽂을 수 없다).
 * - 대상 지점의 **가게 정보(상호·주소·전화·좌표)는 원본에서 가져오지 않는다.** 등록 경로가
 *   그 지점의 매장 프로필로 채운다(`resolveStoreFieldsForProduct`). 원본 주소를 그대로 쓰면
 *   손님이 B지점 이용권을 들고 A지점에 간다.
 * - 매장 확인코드·카카오 플레이스 링크도 지점마다 다르므로 복사하지 않는다.
 *
 * ## 한 번에 한 지점 (`POST /products/:id/copy-to/:sellerId`)
 * 등록 한 건이 D1 왕복을 여러 번 쓴다. 한 요청에서 지점 30곳을 돌면 요청당 서브리퀘스트 한도에
 * 걸린다(무료 플랜). 그래서 화면이 지점마다 한 번씩 부르고 진행 상황을 보여 준다.
 *
 * ## 같은 등록 경로를 탄다
 * 새 INSERT 를 쓰지 않고 `createSellerProduct` 를 그대로 부른다 — 가격 검증·최소가·매장 확정·
 * 지오코딩·피드 캐시 무효화가 손으로 쓴 등록과 **한 벌**이다(두 벌이면 복사본만 검증을 건너뛴다).
 *
 * 💰 돈 안 움직임 — 상품 행을 만들 뿐이다. 판매·정산은 그 지점의 기존 경로 그대로.
 */
import type { Hono, Context } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { canOperateStore } from '../../../worker/utils/seller-operators'
import { isSeatableStoreStatus } from '@/shared/seller-status'
import { productDetailColsHealed, withColumnPruning } from '@/shared/db/product-columns'
import { createSellerProduct, type SellerProductCreateBody } from './seller-orders.routes'

type Ctx = Context<{ Bindings: Env }>
type SourceRow = Record<string, unknown>

/** 지점마다 달라서 **복사하지 않는** 필드. 등록 경로가 대상 지점 프로필로 채운다. */
export const BRANCH_SPECIFIC_FIELDS = [
  'restaurant_name', 'restaurant_address', 'restaurant_phone', 'restaurant_lat', 'restaurant_lng',
  'store_verify_pin', 'kakao_place_url', 'region_si', 'region_gu',
] as const

const str = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined)
const num = (v: unknown): number | undefined => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) ? n : undefined
}

/**
 * 원본 상품 행 → 등록 본문. 지점 고유 필드는 **넣지 않는다**(위 목록). 순수 함수 — 시험이 직접 돌린다.
 */
export function buildCopyBody(src: SourceRow, meta: Record<string, string> = {}): SellerProductCreateBody {
  const body: SellerProductCreateBody = {
    name: String(src.name ?? ''),
    price: num(src.price) ?? NaN,
    description: str(src.description),
    long_description: str(src.long_description),
    detail_images: str(src.detail_images),
    images: str(src.images) ?? null,
    original_price: num(src.original_price),
    stock: num(src.stock) ?? num(src.stock_quantity),
    image_url: str(src.image_url) ?? str(src.thumbnail),
    category: str(src.category),
    voucher_terms: str(src.voucher_terms),
    voucher_expiry: str(src.voucher_expiry),
    group_buy_target: num(src.group_buy_target),
    group_buy_deadline: str(src.group_buy_deadline),
    group_buy_tiers: str(src.group_buy_tiers) ?? null,
  }
  const rate = num(src.referral_commission_rate)
  if (rate != null && rate > 0) { body.referral_enabled = true; body.referral_commission_rate = rate }
  if (meta.menu) {
    try {
      const menu = JSON.parse(meta.menu)
      if (Array.isArray(menu)) body.menu = menu
    } catch { /* 깨진 메뉴는 복사하지 않는다 — 이용권 자체는 복사된다 */ }
  }
  const mpp = num(meta.max_per_person)
  if (mpp != null && mpp >= 1) (body as SellerProductCreateBody & { max_per_person?: number }).max_per_person = mpp
  return body
}

export function registerProductCopyRoutes(
  app: Hono<{ Bindings: Env }>,
  resolveActorUserId: (c: Ctx) => Promise<number | null>,
) {
  app.post('/products/:id/copy-to/:sellerId', rateLimit({ action: 'product_copy_branch', max: 200, windowSec: 3600 }), async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const productId = Number(c.req.param('id'))
      const targetId = Number(c.req.param('sellerId'))
      if (!Number.isFinite(productId) || productId <= 0 || !Number.isFinite(targetId) || targetId <= 0) {
        return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
      }
      const db = c.env.DB

      const src = await withColumnPruning(() => db.prepare(
        `SELECT ${productDetailColsHealed('p')} FROM products p WHERE p.id = ? LIMIT 1`,
      ).bind(productId).first<SourceRow>())
      if (!src) return c.json({ success: false, error: '이용권을 찾을 수 없습니다' }, 404)
      // 교환권(플랫폼 상품)은 지점 것이 아니다 — 복사 대상이 아니다.
      if (Number(src.deal_only) === 1 || src.seller_id == null) {
        return c.json({ success: false, error: '이 상품은 지점에 복사할 수 없습니다' }, 400)
      }
      const sourceSellerId = Number(src.seller_id)
      if (sourceSellerId === targetId) return c.json({ success: false, error: '같은 지점입니다' }, 400)

      // 🔐 원본·대상 둘 다 내가 운영할 수 있어야 한다. 하나라도 아니면 무엇이 있는지도 말하지 않는다.
      const [canSrc, canDst] = await Promise.all([
        canOperateStore(db, userId, sourceSellerId),
        canOperateStore(db, userId, targetId),
      ])
      if (!canSrc.ok || !canDst.ok) return c.json({ success: false, error: '운영 권한이 있는 지점끼리만 복사할 수 있어요' }, 403)

      const target = await db.prepare('SELECT status FROM sellers WHERE id = ? LIMIT 1')
        .bind(targetId).first<{ status: string | null }>()
      if (!target || !isSeatableStoreStatus(target.status)) {
        return c.json({ success: false, error: '정지된 지점에는 복사할 수 없습니다' }, 409)
      }

      const { getSupplyMeta } = await import('../../../worker/utils/product-supply-meta')
      const meta = await getSupplyMeta(db, [productId]).then((m) => m.get(productId) || {}).catch(() => ({}))
      const body = buildCopyBody(src, meta as Record<string, string>)

      const res = await createSellerProduct(c as unknown as Parameters<typeof createSellerProduct>[0], { sellerId: targetId, body })
      const data = await res.json().catch(() => null) as { success?: boolean; data?: { id?: number }; error?: string } | null
      if (!data?.success) {
        const status = (res.status >= 400 && res.status < 600 ? res.status : 500) as 400 | 401 | 403 | 404 | 500
        return c.json({ success: false, error: data?.error || '복사에 실패했습니다' }, status)
      }
      return c.json({ success: true, data: { product_id: data.data?.id ?? null, seller_id: targetId } }, 201)
    } catch (err) {
      return safeError(c, err, '이용권 복사 중 오류가 발생했습니다', '[product-copy]')
    }
  })
}
