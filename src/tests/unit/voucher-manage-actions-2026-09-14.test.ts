/**
 * 🎟️ **이용권을 만든 사람은 그것을 고치고 내릴 수도 있어야 한다** (2026-09-14 대표 "맡아서 해줘").
 *
 * ## 라이브에서 실제로 이랬다 (실측, 추측 아님)
 * 셀러가 소유한 활성 이용권은 **1건뿐**이다 — 2888 홍대돈까스(seller_id 14, 16,500 / 정가 25,000).
 * 나머지 336건은 `seller_id` 가 없는 플랫폼·데모 시드라 셀러 화면에 아예 안 뜬다.
 * 그 한 곳이 `/seller/group-buy` 에서 할 수 있던 일:
 *
 * | | 종전 |
 * |---|---|
 * | 재발행 · 링크 복사 · 알림톡 | ✅ |
 * | **수정** | ❌ 진입점이 `restaurant_phone` **없을 때만** 뜨는 배너 안에 있었다 — 홍대돈까스는 연락처가 있어 안 떴다 |
 * | **삭제** | ❌ 버튼 없음. 서버는 2026-05-15 부터 준비돼 있었다 |
 * | **정가 수정** | ❌ 서버는 `original_price` 를 검증·저장하는데 화면이 안 보냈다 |
 *
 * `/seller/products`(삭제·수정이 있는 목록)는 `SELLER_STORE_ONLY_MODE` 로 nav 에서 빠져 있어
 * 우회로도 없었다.
 *
 * ## 🔒 머니 경로가 아니다 — 그 근거를 여기에 고정한다
 * `original_price` 는 **표시 전용**이다. 실제 청구액은 판매가(`price`)와 공구 특가가 정하고,
 * 청구 경로는 정가를 아예 `null` 로 넘긴다(`worker/utils/gb-order-pricing.ts`).
 * 삭제도 soft delete 라 **이미 발급된 이용권은 그대로 살아 있다.**
 *
 * ⚠️ 이 테스트가 **못 하는 것**: 실제 렌더·클릭·서버 응답. 여기서 고정하는 것은
 *   **배선**(버튼이 조건 없이 있는가 · payload 에 필드가 실리는가 · 서버가 그 필드를 쓰는가)이다.
 *   실제 삭제 동작은 staging 에서 1회 확인해야 한다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments as strip } from '../helpers/source-text'

// 📱 2026-09-14 (M4 재설계와 같은 날 머지): 관리 화면의 행 하나가 `seller-group-buy/VoucherRow.tsx` 로 나갔다 —
//   수정·삭제 진입점은 그 행 안에 있다(페이지 파일엔 목록·세그먼트만 남았다).
const MANAGE = strip(readFileSync('src/pages/seller-group-buy/VoucherRow.tsx', 'utf8'))
const EDIT = strip(readFileSync('src/pages/SellerProductEditPage.tsx', 'utf8'))
const PRICE_FIELDS = strip(readFileSync('src/pages/seller-product-edit/PriceStockFields.tsx', 'utf8'))
const SERVER = strip(readFileSync('src/features/seller/api/seller-orders.routes.ts', 'utf8'))
const CHARGE = strip(readFileSync('src/worker/utils/gb-order-pricing.ts', 'utf8'))

/**
 * 함수 **본문만** 잘라낸다.
 *
 * 🩸 처음엔 `src.slice(idx, idx + 1400)` 로 대충 잘랐는데, 그 창이 **다음 함수까지 넘쳐**
 *   옆 함수(`resendStoreLink`)의 똑같은 `e?.response?.data?.error` 에 걸렸다 —
 *   삭제 핸들러에서 그 줄을 통째로 지워도 초록이었다. 주입 검증이 잡아 줬다.
 */
function fnBody(src: string, name: string): string {
  const start = src.indexOf(name)
  if (start < 0) return ''
  const rest = src.slice(start + name.length)
  const end = rest.search(/\n  (?:async )?function /)
  return end > 0 ? rest.slice(0, end) : rest
}
const DELETE_FN = fnBody(MANAGE, 'async function deleteVoucher')

describe('① 삭제 — 버튼이 있고, 서버가 지켜 준다', () => {
  it('관리 카드에 삭제 버튼이 있다', () => {
    expect(MANAGE).toMatch(/onClick=\{\(\) => deleteVoucher\(\)\}/)
  })

  it('삭제는 되돌릴 수 없으니 확인을 받는다 — 거절하면 **아무 일도 안 일어난다**', () => {
    // 🩸 처음엔 `toContain('confirmDialog')` 였는데, 호출을 `if (false && …)` 로 막아도
    //   문자열은 남아 초록이었다. 존재가 아니라 **거절 시 빠져나오는지**를 본다.
    expect(DELETE_FN).toMatch(/if \(!\(await confirmDialog\([\s\S]{0,300}?\)\)\) return/)
  })

  it('DELETE 를 그 상품 id 로 부른다', () => {
    expect(MANAGE).toContain('api.delete(`/api/seller/products/${v.id}`')
  })

  it('🔒 서버 거절 사유를 그대로 보여준다 — "삭제 실패" 만으로는 할 수 있는 게 없다', () => {
    // 진행 중 공구(참여자 1명 이상)는 409 + 사람이 읽을 이유를 준다. 삼키면 그 이유가 사라진다.
    expect(DELETE_FN).toContain('e?.response?.data?.error')
  })

  it('🔒 서버가 소유권과 진행 중 공구를 막는다 (화면 확인만 믿지 않는다)', () => {
    const route = SERVER.slice(SERVER.indexOf("sellerOrdersRoutes.delete('/products/:id'"))
    const body = route.slice(0, 2000)
    expect(body).toContain('AND seller_id = ?')
    expect(body).toContain('GROUP_BUY_ACTIVE_WITH_PARTICIPANTS')
    // soft delete — 이미 발급된 이용권은 살아 있어야 한다.
    expect(body).toContain("status = 'DELETED'")
  })

  it('삭제 뒤 목록을 다시 읽는다 — 안 하면 지운 행이 남아 있다', () => {
    // 행은 부모(목록)의 refetch 를 `onChanged` 로 받는다.
    expect(DELETE_FN).toContain('onChanged()')
  })

  it('🛡️ 본문 자르기가 실제로 함수에서 끝난다 (측정 0/과다는 통과가 아니다)', () => {
    // 이 검사가 없으면 위 셋이 조용히 파일 전체를 보게 되어 다시 헛돈다.
    expect(DELETE_FN.length).toBeGreaterThan(200)
    expect(DELETE_FN).not.toContain('resendStoreLink')
  })
})

describe('② 정가(original_price) — 서버는 받고 있었고 화면만 빠져 있었다', () => {
  it('수정 화면이 정가를 폼에 싣는다', () => {
    expect(EDIT).toContain('original_price:')
    expect(PRICE_FIELDS).toContain('name="original_price"')
  })

  it('🔒 서버가 보낸 값을 폼에 되돌려 넣는다 — 안 하면 저장할 때마다 빈 값으로 덮인다', () => {
    expect(EDIT).toContain('productData.original_price')
  })

  it('🔒 빈 칸은 null 로 보낸다 — 0 을 보내면 "정가 0원" 이 되어 할인율이 깨진다', () => {
    expect(EDIT).toMatch(/original_price:\s*formData\.original_price === ''\s*\?\s*null/)
  })

  it('🔒 서버가 그 필드를 검증하고 저장한다', () => {
    const put = SERVER.slice(SERVER.indexOf("sellerOrdersRoutes.put('/products/:id'"))
    const body = put.slice(0, 4000)
    expect(body).toContain('original_price = ?')
    expect(body).toMatch(/body\.original_price[\s\S]{0,200}100_000_000/)
  })

  it('🔒 할인율은 입력받지 않고 SSOT 로 계산한다 — 두 칸이 같은 것을 말하면 반드시 갈린다', () => {
    // 🩸 처음엔 `toContain('priceDisplay')` 였는데 **import 줄에 이름이 남아** 있어서
    //   호출을 손계산으로 통째로 바꿔도 초록이었다(주입 검증이 잡았다). ⇒ **호출**을 본다.
    expect(PRICE_FIELDS).toMatch(/=\s*priceDisplay\(/)
    // 그리고 이 파일 안에서 할인율을 직접 셈하지 않는다 — 변수 이름을 뭘로 짓든.
    expect(PRICE_FIELDS).not.toMatch(/Math\.round\(\(1\s*-/)
  })
})

describe('③ 정가는 표시 전용이다 — 이 전제가 깨지면 위 판단이 통째로 틀린다', () => {
  it('🔒 청구 경로가 정가를 넘기지 않는다 (null)', () => {
    // 이 한 줄이 "머니 경로 아님" 의 근거다. 여기에 정가가 들어가면 이 작업의 전제가 바뀐다.
    expect(CHARGE).toMatch(/resolveGbPricing\(\s*s\s*,\s*list\s*,\s*null\s*,/)
  })
})
