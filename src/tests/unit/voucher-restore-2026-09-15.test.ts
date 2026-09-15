/**
 * 🗑️➡️🎟️ **삭제한 이용권을 되돌릴 수 있어야 한다** (2026-09-15).
 *
 * ## 대표가 삭제를 눌러 보고 구멍이 드러났다
 * 2026-09-14 에 삭제 버튼을 붙였고(#1430) 대표가 바로 시험 삼아 눌렀다 — 잘 지워졌다.
 * 그런데 **되돌릴 방법이 아무 데도 없었다.** 라이브 실측(그 직후):
 *
 * ```
 * 셀러 소유 활성 이용권  0건      (2888 홍대돈까스: is_active=0, status='DELETED')
 * 어드민 PATCH          is_active·sold_count·stock·referral_* 만 — status 를 아예 안 받는다
 * 셀러 목록 API         AND COALESCE(p.status,'ACTIVE') != 'DELETED'  → 화면에 안 뜬다
 * 셀러 PUT              ALLOWED_STATUS 에 'ACTIVE' 가 있다 — 쓰기 경로는 있는데 **도달할 화면이 없었다**
 * ```
 * 어드민이 `is_active` 만 켜면 소비자 피드(`p.is_active = 1` 만 본다)엔 다시 뜨는데
 * 셀러 목록엔 여전히 안 보인다 — **어긋난 절반 복구**다. 그래서 화면을 붙였다.
 *
 * 같은 파일의 2026-07-02 주석이 *비활성화*에 대해 정확히 이 문제를 고쳐 놓고("비활성화 즉시 목록에서
 * 사라져 재활성화 경로가 0이었음") *삭제*는 그대로 뒀다. 그때는 삭제 버튼이 없었으니 도달할 수 없는
 * 상태였고, 버튼이 생기는 순간 살아난 구멍이다.
 *
 * ## 함께 고친 것 — 목록이 화면에 필요한 필드를 안 주고 있었다
 * 이용권 화면은 `group_buy_current`·`restaurant_phone`·`store_owner_token`·`original_price` 를 읽는데
 * `GET /api/seller/products` 의 SELECT 에 그 컬럼들이 **없었다**. 에러가 안 나고 `undefined` 가 되어
 * 판매 0건·매출 ₩0, 연락처가 등록돼 있어도 "연락처 미등록" 배너, 토큰 없는 사장님 링크였다.
 * ④ 가 그 드리프트를 **실제로 대조**한다(화면이 읽는 이름 ⊆ 서버가 주는 이름).
 *
 * ⚠️ 이 테스트가 **못 하는 것**: 실제 렌더·클릭·D1 응답. 여기서 고정하는 것은 배선과 SQL 문장이다.
 *   복구가 실제로 도는지는 staging(또는 라이브)에서 1회 눌러 봐야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as strip } from '../helpers/source-text'
import { buildSellerProductsQuery } from '@/features/seller/api/seller-products-query'

const SERVER = strip(readFileSync('src/features/seller/api/seller-orders.routes.ts', 'utf8'))
const HOOK = strip(readFileSync('src/pages/seller-page/useSellerHome.ts', 'utf8'))
const ROW = strip(readFileSync('src/pages/seller-group-buy/VoucherRow.tsx', 'utf8'))
const PAGE = strip(readFileSync('src/pages/SellerGroupBuyPage.tsx', 'utf8'))

/** `sellerOrdersRoutes.get('/products'` 핸들러 **본문만**. 창이 넘치면 옆 핸들러의 같은 문장에 걸린다. */
function handler(marker: string): string {
  const start = SERVER.indexOf(marker)
  if (start < 0) return ''
  const rest = SERVER.slice(start + marker.length)
  const end = rest.search(/\nsellerOrdersRoutes\./)
  return end > 0 ? rest.slice(0, end) : rest
}
const LIST = handler("sellerOrdersRoutes.get('/products'")
const PUT = handler("sellerOrdersRoutes.put('/products/:id'")

const BASE = { sellerId: 14, limit: 100, offset: 0, sort: 'DESC' as const }
const live = buildSellerProductsQuery(BASE)
const withDeleted = buildSellerProductsQuery({ ...BASE, includeDeleted: true })

describe('① 목록 — 기본은 그대로 숨기고, 명시한 호출만 삭제분을 받는다', () => {
  it('🔒 기본(플래그 없음)은 삭제분을 계속 숨긴다', () => {
    expect(live.query).toContain(`AND COALESCE(p.status, 'ACTIVE') != 'DELETED'`)
    expect(live.countQuery).toContain(`AND COALESCE(status, 'ACTIVE') != 'DELETED'`)
  })

  it('opt-in 을 켜면 삭제분까지 나온다', () => {
    expect(withDeleted.query).not.toContain('DELETED')
    expect(withDeleted.countQuery).not.toContain('DELETED')
  })

  it('🔒 목록과 count 가 **같은 규칙**을 쓴다 — 갈리면 페이지 수가 거짓말을 한다', () => {
    // 2026-07-02 에 정확히 이 불일치를 고친 기록이 있다(도매상품 보유 셀러 total 과대).
    for (const q of [live, withDeleted]) {
      expect(q.query.includes('DELETED'), 'query').toBe(q.countQuery.includes('DELETED'))
    }
    // 그리고 도매 원본 제외는 두 경우 모두 그대로다.
    expect(live.query).toContain('COALESCE(p.is_supply_product, 0) = 0')
    expect(live.countQuery).toContain('COALESCE(is_supply_product, 0) = 0')
    expect(withDeleted.query).toContain('COALESCE(p.is_supply_product, 0) = 0')
  })

  it('opt-in 은 **필터만** 바꾼다 — bind 값·정렬·페이징은 그대로', () => {
    expect(withDeleted.params).toEqual(live.params)
    expect(withDeleted.countParams).toEqual(live.countParams)
    expect(live.params).toEqual([14, 100, 0])
    expect(live.query).toContain('ORDER BY p.created_at DESC LIMIT ? OFFSET ?')
  })

  it('검색어는 목록·count 양쪽에 같은 수만큼 바인딩된다', () => {
    const q = buildSellerProductsQuery({ ...BASE, search: '돈까스' })
    expect(q.params).toEqual([14, '%돈까스%', '%돈까스%', 100, 0])
    expect(q.countParams).toEqual([14, '%돈까스%', '%돈까스%'])
  })

  it('🔒 라우트가 그 opt-in 을 실제로 배선한다 (빌더만 고치면 화면엔 안 닿는다)', () => {
    expect(LIST).toMatch(/const includeDeleted = c\.req\.query\('include_deleted'\) === '1'/)
    expect(LIST).toMatch(/buildSellerProductsQuery\(\{[\s\S]{0,200}?includeDeleted,/)
  })

  it('🔒 콜드 D1 가드 — 이용권 컬럼을 보장하고 나서 읽는다', () => {
    // 이 컬럼들은 마이그레이션이 아니라 ensureTables 의 ALTER 로 생긴다. 안 부르면 셀러 메인이 500 이다.
    expect(LIST).toMatch(/await ensureGroupBuyColumns\(db\)/)
    expect(SERVER).toMatch(/import \{ ensureTables as ensureGroupBuyColumns \}/)
  })

  it('🛡️ 본문 자르기가 실제로 그 핸들러에서 끝난다 (측정 0/과다는 통과가 아니다)', () => {
    expect(LIST.length).toBeGreaterThan(600)
    expect(LIST).not.toContain("put('/products/:id'")
    expect(PUT.length).toBeGreaterThan(800)
  })
})

describe('② 목록이 화면에 필요한 필드를 준다 (이번에 실제로 빠져 있던 것)', () => {
  const SELECT = live.query.slice(live.query.indexOf('SELECT'), live.query.indexOf('FROM products p'))

  it('🩸 화면이 읽는 이름이 전부 SELECT 에 있다 — 드리프트를 문자열이 아니라 **대조**로 잡는다', () => {
    // 훅이 응답 row 에서 실제로 꺼내 쓰는 이름(`p.<name>`)을 소스에서 뽑는다.
    const hookFn = HOOK.slice(HOOK.indexOf('function vouchersQuery'), HOOK.indexOf('export function useSellerVouchers'))
    const read = [...hookFn.matchAll(/\bp\.([a-z_]+)\b/g)].map((m) => m[1])
    expect(read.length, '훅에서 읽는 필드를 하나도 못 찾았다 — 이 검사가 헛돌고 있다').toBeGreaterThan(8)
    const missing = [...new Set(read)].filter((f) => !SELECT.includes(f))
    expect(missing, `서버 목록이 안 주는 필드를 화면이 읽고 있다: ${missing.join(', ')}`).toEqual([])
  })

  it('그중 이번에 빠져 있던 여섯을 이름으로도 못 박는다', () => {
    for (const col of ['original_price', 'restaurant_name', 'restaurant_phone', 'store_owner_token', 'group_buy_current', 'group_buy_status']) {
      expect(SELECT, `${col} 누락`).toContain(col)
    }
  })
})

describe('③ 복구 — 새 서버 경로를 만들지 않는다', () => {
  it('기존 PUT 을 `{ is_active: true, status: ACTIVE }` 로 부른다', () => {
    expect(ROW).toMatch(/api\.put\(`\/api\/seller\/products\/\$\{v\.id\}`, \{ is_active: next, status: next \? 'ACTIVE' : 'HIDDEN' \}/)
    // 🩸 처음엔 `toMatch(/setSale\(true,/)` 였는데, 호출을 `undefined && setSale(true, …)` 로 막아도
    //   문자열은 남아 초록이었다(주입 검증이 잡았다). ⇒ **onClick 이 곧바로 그 호출인지** 모양을 본다.
    expect(ROW, '복구 버튼의 onClick 과 setSale 사이에 무엇이 끼면 눌러도 아무 일이 안 일어난다')
      .toMatch(/onClick=\{\(\) => setSale\(true, t\('seller\.vouchers\.restored'/)
  })

  it('🔒 서버 PUT 이 그 전이를 받아 준다 (소유권 조회가 삭제분을 배제하지 않는다)', () => {
    expect(PUT).toMatch(/ALLOWED_STATUS = new Set\(\['ACTIVE'/)
    expect(PUT).toContain('SELECT id FROM products WHERE id = ? AND seller_id = ?')
    expect(PUT, '소유권 조회가 DELETED 를 빼면 복구가 404 가 된다').not.toMatch(/SELECT id FROM products WHERE id = \? AND seller_id = \?[^`]*DELETED/)
  })

  it('삭제된 행은 **복구만** 보여 준다 — 판매 스위치·삭제·편집은 의미가 없다', () => {
    const del = ROW.slice(ROW.indexOf("if (v.status === 'DELETED')"), ROW.indexOf('return (\n    <div className="border-b border-rule'))
    expect(del.length, '삭제 행 분기를 못 찾았다').toBeGreaterThan(300)
    expect(del).toMatch(/seller\.vouchers\.restore/)
    expect(del).not.toContain('deleteVoucher')
    expect(del).not.toContain("role=\"switch\"")
    expect(del).not.toContain('goEdit')
  })
})

describe('④ 두 목록이 한 요청을 나눠 쓴다 (홈 숫자가 삭제분에 오염되지 않는다)', () => {
  it('훅이 opt-in 을 보낸다', () => {
    expect(HOOK).toMatch(/params: \{ include_deleted: 1 \}/)
  })

  it('🔒 살아 있는 목록은 삭제분을 **거른다** — 안 거르면 홈 M2 의 이용권 수가 늘어난다', () => {
    expect(HOOK).toMatch(/useSellerVouchers\(\)[\s\S]{0,200}?select: \(l: HomeVoucher\[\]\) => l\.filter\(\(v\) => v\.status !== 'DELETED'\)/)
  })

  it('삭제 목록은 삭제분만 준다', () => {
    expect(HOOK).toMatch(/useSellerDeletedVouchers\(\)[\s\S]{0,200}?select: \(l: HomeVoucher\[\]\) => l\.filter\(\(v\) => v\.status === 'DELETED'\)/)
  })

  it('🔒 같은 queryKey 를 쓴다 — 갈리면 요청이 두 번 나간다', () => {
    const keys = [...HOOK.matchAll(/queryKey: \['seller', 'home', 'vouchers'\]/g)]
    expect(keys.length, "queryKey 가 한 군데(공용 vouchersQuery)에만 있어야 한다").toBe(1)
    expect(HOOK).toMatch(/\.\.\.vouchersQuery\(\)[\s\S]{0,400}\.\.\.vouchersQuery\(\)/)
  })

  it("'삭제됨' 세그먼트가 화면에 있다 (삭제분이 있을 때)", () => {
    expect(PAGE).toContain("useSellerDeletedVouchers")
    expect(PAGE).toMatch(/buckets\.deleted\.length > 0 \?/)
    expect(PAGE).toMatch(/type Seg = [^\n]*'deleted'/)
  })
})
