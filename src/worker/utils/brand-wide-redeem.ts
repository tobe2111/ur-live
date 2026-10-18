/**
 * 🏷️ **브랜드 전 지점 사용** — 한 지점에서 산 이용권을 같은 브랜드의 다른 지점에서도 쓴다
 *   (2026-10-18 대표 *"다른 지점에서도 쓸 지는 선택하게 하는게 좋지 않아?"* → *"응 진행해줘"*).
 *
 * ## 규칙 (대표 확정 1·2단계)
 * 1. **이용권마다 고른다.** 기본은 꺼짐(그 지점에서만). 켜는 값은 `product_supply_meta.brand_wide_use = '1'`
 *    (products 에 컬럼을 더하지 않는다 — 컬럼 예산 룰).
 * 2. **주인이 같은 지점끼리만 받는다.** 받아 주는 지점의 주인이 **판 지점의 주인과 같은 사람**일 때만 —
 *    사실상 직영 체인. 그래서 **돈은 움직이지 않는다**: 정산은 지금처럼 판 지점(`products.seller_id`)에 남고,
 *    받아 준 지점과 판 지점이 같은 주인의 주머니라 남의 손님을 공짜로 받아 주는 일이 생기지 않는다.
 *    가맹점(주인이 다른 지점)이 섞이면 그 지점은 **받지 않는다** — 단, 3단계 게이트가 켜져 있으면 예외가 하나 있다:
 *    ③ 아래 `brand-cross-owner.ts`(결재 2026-10-18 — 받는 점주 동의 · 판매 비용 없는 이용권만 · 정산은 쓴 지점).
 *    게이트 OFF 면 이 규칙 2가 그대로다.
 *
 * ## 판정은 늘 **사용하는 그 순간**에 다시 한다
 * 설정할 때 한 번 보고 끝내지 않는다 — 그 사이 지점이 브랜드에서 빠지거나 주인이 바뀔 수 있다.
 * 사용 처리 경로(사장님 스캔·카운터 코드 입력·손님 셀프)가 전부 이 파일의 함수를 부른다.
 *
 * ## 주인 판정은 `resolveStoreOwnerUserId` 와 **같은 규칙**이다
 * `linked_user_id` 가 있으면 그 사람, 없으면 회수 안 된 `owner` 좌석(먼저 받은 것). 여러 지점을 한 번에 봐야 해서
 * SQL 로 옮겼고, 두 벌이 갈리지 않게 시험이 같은 데이터로 둘을 대조한다(`brand-wide-redeem-2026-10-18.test.ts`).
 * 주인을 모르면(둘 다 없음) **받지 않는다** — fail-closed.
 *
 * 💰 원장·결제·정산 코드는 건드리지 않는다. 바뀌는 것은 "어느 매장의 확인코드·스캔을 받아 주나" 하나다.
 */
import { ensureSupplyMetaTable } from './product-supply-meta'
import { ensureSellerOperators } from './seller-operators'
import { ensureStoreBrands } from './store-brands'
import { ensureRedemptionSettingsTable } from './redemption-settings'
import { CROSS_OWNER_ACCEPT_META, isCrossOwnerRedeemEnabled, voucherHasSunkCost } from './brand-cross-owner'
import { ensureSellerMetaTable } from './seller-meta'

export const BRAND_WIDE_META_KEY = 'brand_wide_use'

/** 받아 줄 수 있는 지점의 상태 — 정산 가능 상태와 같다(정지·심사 중 지점은 받지 않는다). */
const ACCEPTING_STATUS = `COALESCE(s.status, '') IN ('approved', 'active')`

/** 지점의 주인 user id — `resolveStoreOwnerUserId` 의 SQL 판. 별칭 `s` 는 sellers. */
export const STORE_OWNER_SQL = `COALESCE(NULLIF(s.linked_user_id, 0), (
  SELECT o.user_id FROM seller_operators o
   WHERE o.seller_id = s.id AND o.role = 'owner' AND o.revoked_at IS NULL
   ORDER BY o.granted_at LIMIT 1))`

/** 이 이용권이 "브랜드 전 지점 사용" 으로 켜져 있나. 조회 실패는 꺼짐(fail-closed). */
export async function isBrandWideEnabled(DB: D1Database, productId: number): Promise<boolean> {
  if (!Number.isFinite(productId) || productId <= 0) return false
  await ensureSupplyMetaTable(DB)
  const r = await DB.prepare('SELECT value FROM product_supply_meta WHERE product_id = ? AND key = ? LIMIT 1')
    .bind(productId, BRAND_WIDE_META_KEY).first<{ value: string | null }>().catch(() => null)
  return r?.value === '1'
}

export interface BrandSibling {
  seller_id: number; owner_id: number | null; accepting: boolean
  /**
   * 🏷️ 3단계 — 주인이 **다른** 지점인데 받을 수 있는 후보: 게이트 ON + 그 지점 주인이 "다른 점주 이용권 받기"를 켬
   * + 정산 가능 상태. 이용권마다 판매 비용(②)을 따로 봐야 하므로 이것만으로 받지 않는다 — `siblingAccepts` 가 마저 본다.
   */
  crossOwnerOk: boolean
}

/**
 * 같은 브랜드의 다른 지점과 그 주인. 브랜드가 없으면 빈 배열.
 * `accepting` = 판 지점과 주인이 같고 정산 가능 상태 → 이 지점은 이 매장의 이용권을 받아 줄 수 있다.
 */
export async function brandSiblingsOf(DB: D1Database, sellerId: number): Promise<{ ownerId: number | null; siblings: BrandSibling[] }> {
  if (!Number.isFinite(sellerId) || sellerId <= 0) return { ownerId: null, siblings: [] }
  await Promise.all([ensureStoreBrands(DB), ensureSellerOperators(DB), ensureSellerMetaTable(DB)])
  const crossGate = await isCrossOwnerRedeemEnabled(DB)
  const self = await DB.prepare(`SELECT ${STORE_OWNER_SQL} AS owner_id FROM sellers s WHERE s.id = ? LIMIT 1`)
    .bind(sellerId).first<{ owner_id: number | null }>().catch(() => null)
  const ownerId = self?.owner_id ? Number(self.owner_id) : null
  const { results } = await DB.prepare(
    `SELECT s.id AS seller_id, ${STORE_OWNER_SQL} AS owner_id, CASE WHEN ${ACCEPTING_STATUS} THEN 1 ELSE 0 END AS ok_status,
            (SELECT sm.value FROM seller_meta sm WHERE sm.seller_id = s.id AND sm.key = ?) AS cross_accept
       FROM store_brand_members m1
       JOIN store_brands b ON b.id = m1.brand_id AND b.deleted_at IS NULL
       JOIN store_brand_members m2 ON m2.brand_id = m1.brand_id AND m2.seller_id <> m1.seller_id
       JOIN sellers s ON s.id = m2.seller_id
      WHERE m1.seller_id = ?
      ORDER BY s.id LIMIT 500`,
  ).bind(CROSS_OWNER_ACCEPT_META, sellerId).all<{ seller_id: number; owner_id: number | null; ok_status: number; cross_accept: string | null }>()
    .catch(() => ({ results: [] as Array<{ seller_id: number; owner_id: number | null; ok_status: number; cross_accept: string | null }> }))
  const siblings = (results || []).map((r) => {
    const sibOwner = r.owner_id ? Number(r.owner_id) : null
    const okStatus = Number(r.ok_status) === 1
    return {
      seller_id: Number(r.seller_id),
      owner_id: sibOwner,
      accepting: ownerId != null && sibOwner === ownerId && okStatus,
      crossOwnerOk: crossGate && ownerId != null && sibOwner != null && sibOwner !== ownerId && okStatus && r.cross_accept === '1',
    }
  })
  return { ownerId, siblings }
}

/**
 * 형제 지점 하나가 이 이용권을 받나. 같은 주인이면 받는다(1·2단계). 주인이 다르면 3단계 조건 —
 * 후보(`crossOwnerOk`)이고 **이용권을 알고(voucherId)** 판매 비용이 없을 때만(②). 이용권을 모르면 받지 않는다(fail-closed).
 */
async function siblingAccepts(DB: D1Database, s: BrandSibling, voucherId: number | null | undefined): Promise<boolean> {
  if (s.accepting) return true
  if (!s.crossOwnerOk || voucherId == null) return false
  return !(await voucherHasSunkCost(DB, Number(voucherId)))
}

/**
 * 이 이용권을 `actorSellerId` 매장이 사용 처리해도 되나 — 사장님 스캔·카카오 챗봇·/v 화면 경로.
 * 판 지점 자신이면 늘 참(종전 그대로). 다른 지점이면 이용권이 켜져 있고 `siblingAccepts` 를 통과할 때만.
 * `voucherId` 를 안 넘기면 다른 점주 지점은 늘 거절된다(같은 주인 지점은 종전대로 받는다).
 */
export async function canStoreRedeemProduct(
  DB: D1Database, productId: number, productSellerId: number | null, actorSellerId: number, voucherId?: number | null,
): Promise<boolean> {
  if (productSellerId == null || !Number.isFinite(actorSellerId)) return false
  if (Number(productSellerId) === Number(actorSellerId)) return true
  if (!(await isBrandWideEnabled(DB, productId))) return false
  const { siblings } = await brandSiblingsOf(DB, Number(productSellerId))
  const sib = siblings.find((s) => s.seller_id === Number(actorSellerId))
  return sib ? siblingAccepts(DB, sib, voucherId) : false
}

/**
 * 손님(또는 직원)이 넣은 **매장 확인코드**가 받아 주는 형제 지점의 것인지 찾는다 — 카운터·셀프 경로.
 * 맞는 지점 id 를 돌려준다(없으면 null). 판 지점 자신의 코드는 여기서 다루지 않는다(종전 경로가 본다).
 * `scan_only` 지점은 셀프 사용을 막는 매장이라 `allowScanOnly=false` 면 제외한다.
 */
export async function findBrandBranchByStoreCode(
  DB: D1Database, productId: number, productSellerId: number | null, storeCode: string,
  opts: { allowScanOnly: boolean; voucherId?: number | null },
): Promise<number | null> {
  const input = String(storeCode || '').trim()
  if (productSellerId == null || !input) return null
  if (!(await isBrandWideEnabled(DB, productId))) return null
  const { siblings } = await brandSiblingsOf(DB, Number(productSellerId))
  const candidates = new Map(siblings.filter((s) => s.accepting || s.crossOwnerOk).map((s) => [s.seller_id, s]))
  if (candidates.size === 0) return null
  await ensureRedemptionSettingsTable(DB)
  // 코드로 먼저 좁힌다(대개 0~1행) — 형제 목록을 IN 에 넣지 않아 바인딩 한도와 무관하다.
  const { results } = await DB.prepare(
    `SELECT seller_id, mode FROM seller_redemption_settings
      WHERE store_code IS NOT NULL AND store_code <> '' AND store_code = ? LIMIT 20`,
  ).bind(input).all<{ seller_id: number; mode: string | null }>()
    .catch(() => ({ results: [] as Array<{ seller_id: number; mode: string | null }> }))
  for (const r of results || []) {
    const sib = candidates.get(Number(r.seller_id))
    if (!sib) continue
    if (!opts.allowScanOnly && r.mode === 'scan_only') continue
    if (!(await siblingAccepts(DB, sib, opts.voucherId))) continue
    return Number(r.seller_id)
  }
  return null
}

export type BrandWideSettable =
  | { ok: true; acceptingCount: number; sameOwnerCount: number; crossOwnerCount: number }
  | { ok: false; code: 'NO_BRAND' | 'NOT_OWNER' | 'NO_SAME_OWNER_BRANCH' }

/**
 * 켤 수 있나 — 설정 화면용(사용 순간에 다시 판정하므로 여기서 통과해도 보장은 아니다).
 * 판 지점의 주인만 켠다(그 지점의 돈이 걸린 결정 — 운영자는 못 켠다). 받아 줄 같은 주인 지점이 하나도 없으면
 * 켜 봐야 아무 일도 안 하므로 거절한다(화면이 지키지 못할 약속을 하지 않게).
 */
export async function checkBrandWideSettable(DB: D1Database, userId: number, productSellerId: number): Promise<BrandWideSettable> {
  const { ownerId, siblings } = await brandSiblingsOf(DB, productSellerId)
  if (ownerId == null || ownerId !== userId) return { ok: false, code: 'NOT_OWNER' }
  if (siblings.length === 0) return { ok: false, code: 'NO_BRAND' }
  // 3단계: 게이트 ON 이고 "다른 점주 이용권 받기"를 켠 가맹점도 받아 줄 지점으로 센다.
  const sameOwnerCount = siblings.filter((s) => s.accepting).length
  const crossOwnerCount = siblings.filter((s) => !s.accepting && s.crossOwnerOk).length
  const acceptingCount = sameOwnerCount + crossOwnerCount
  if (acceptingCount === 0) return { ok: false, code: 'NO_SAME_OWNER_BRANCH' }
  return { ok: true, acceptingCount, sameOwnerCount, crossOwnerCount }
}

/** 이용권 코드로 시작하는 판 — 카운터·셀프 경로가 쓴다. 이용권이 없으면 null. */
export async function findBrandBranchForVoucherCode(
  DB: D1Database, voucherCode: string, storeCode: string, opts: { allowScanOnly: boolean },
): Promise<number | null> {
  if (!voucherCode || !String(storeCode || '').trim()) return null
  const v = await DB.prepare(
    'SELECT v.id AS id, v.product_id AS product_id, p.seller_id AS seller_id FROM vouchers v JOIN products p ON p.id = v.product_id WHERE v.code = ? LIMIT 1',
  ).bind(voucherCode).first<{ id: number; product_id: number; seller_id: number | null }>().catch(() => null)
  if (!v) return null
  return findBrandBranchByStoreCode(DB, Number(v.product_id), v.seller_id, storeCode, { ...opts, voucherId: Number(v.id) })
}
