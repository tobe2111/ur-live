/**
 * 🧾 셀러 상품 목록 SQL — `GET /api/seller/products` 가 쓰는 **순수 빌더**.
 *
 * 🧱 왜 따로 있나 (2026-09-15): `seller-orders.routes.ts` 가 파일크기 래칫에 **1420줄로 동결**돼 있어
 *   그 안에서는 한 줄도 못 늘린다(`scripts/file-size-baseline.json`). 그리고 여기로 나온 덕에
 *   가드가 소스를 grep 하는 대신 **함수를 불러 나온 SQL 을 직접 본다** — 문자열이 아니라 동작을 잰다.
 *
 * 두 가지를 한 곳에서 정한다. 갈리면 조용히 깨지는 것들이다:
 *   ① 목록과 **count 가 같은 필터**를 쓴다. 2026-07-02 에 정확히 이 불일치를 고친 기록이 있다
 *      (도매상품 보유 셀러 total 과대). 갈리면 `has_more` 가 틀리고 마지막 페이지가 빈다.
 *   ② 삭제분은 **기본으로 숨기고** `include_deleted` 를 명시한 호출만 받는다.
 *      🗑️ 2026-09-15: 이 opt-in 이 생기기 전에는 삭제한 이용권을 **어느 화면에서도 볼 수 없어**
 *      되돌릴 방법이 0 이었다(어드민 PATCH 는 `status` 를 아예 안 받는다).
 */

/** 화면이 실제로 읽는 이용권 메타. 여기 없으면 에러가 아니라 `undefined` 가 되어 조용히 틀린다. */
const VOUCHER_META_COLS = `
        p.original_price,
        p.restaurant_name,
        p.restaurant_phone,
        p.store_owner_token,
        COALESCE(p.group_buy_current, 0)                          AS group_buy_current,
        p.group_buy_status,`

export interface SellerProductsQueryInput {
  sellerId: number | string
  limit: number
  offset: number
  /** 'ASC' | 'DESC' — 호출부가 화이트리스트로 정한 값만 넘긴다(문자열 보간 자리). */
  sort: 'ASC' | 'DESC'
  search?: string
  /** 삭제분까지 받을지. 기본 false — 켜는 것은 '삭제됨' 세그먼트 하나뿐이다. */
  includeDeleted?: boolean
}

export interface SellerProductsQuery {
  query: string
  params: unknown[]
  countQuery: string
  countParams: unknown[]
}

export function buildSellerProductsQuery(input: SellerProductsQueryInput): SellerProductsQuery {
  const { sellerId, limit, offset, sort, includeDeleted = false } = input
  const search = input.search || ''

  // ① 같은 규칙을 목록·count 가 나눠 쓴다(별칭만 다르다).
  const notDeleted = includeDeleted ? '' : `AND COALESCE(p.status, 'ACTIVE') != 'DELETED'`
  const notDeletedBare = includeDeleted ? '' : `AND COALESCE(status, 'ACTIVE') != 'DELETED'`

  // COALESCE로 신/구 컬럼 모두 대응 (image_url, thumbnail_url, image 순으로 fallback)
  let query = `
      SELECT
        p.id,
        p.name,
        p.description,
        p.price,
        COALESCE(p.stock, p.stock_quantity, 0)                    AS stock,
        COALESCE(p.thumbnail_url, p.image_url)                    AS image_url,
        COALESCE(p.status, 'ACTIVE')                              AS status,
        COALESCE(p.is_active, 1)                                  AS is_active,
        p.category,
        p.created_at,
        p.updated_at,${VOUCHER_META_COLS}
        COUNT(DISTINCT oi.id)                                      AS order_count,
        COALESCE(SUM(
          CASE WHEN o.status NOT IN ('CANCELLED', 'FAILED', 'REFUNDED')
               THEN oi.quantity ELSE 0 END
        ), 0)                                                      AS total_sold
      FROM products p
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
      WHERE p.seller_id = ?
        ${notDeleted}
        AND COALESCE(p.is_supply_product, 0) = 0
    `
  // 🛡️ 2026-07-02 (쇼핑 전수조사): 재고 COALESCE 순서 stock 우선(canonical) + is_active 반환(배지/토글 정상화)
  //   + 필터를 is_active=1 → status != DELETED 로 변경(비활성/일시중지 상품도 목록에 보여 재활성화 가능,
  //   삭제만 숨김). 이전엔 비활성화 즉시 목록에서 사라져 재활성화 경로가 0이었음.
  const params: unknown[] = [sellerId]
  if (search) {
    query += ` AND (p.name LIKE ? OR p.description LIKE ?)`
    params.push(`%${search}%`, `%${search}%`)
  }
  query += ` GROUP BY p.id ORDER BY p.created_at ${sort} LIMIT ? OFFSET ?`
  params.push(limit, offset)

  let countQuery = `SELECT COUNT(*) as total FROM products WHERE seller_id = ? ${notDeletedBare} AND COALESCE(is_supply_product, 0) = 0`
  const countParams: unknown[] = [sellerId]
  if (search) {
    countQuery += ` AND (name LIKE ? OR description LIKE ?)`
    countParams.push(`%${search}%`, `%${search}%`)
  }

  return { query, params, countQuery, countParams }
}
