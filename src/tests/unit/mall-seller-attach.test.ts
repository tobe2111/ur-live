/**
 * 🏪 **매장 ↔ 몰 연결** 〔2026-08-03 — 파일럿 개설의 빠진 조각〕
 *
 * 몰을 만들어도 **매장을 붙일 방법이 없었다.** 상품의 몰 귀속은 서버가 `sellers.mall_id` 를 읽어
 * 찍는데(`sellerMallIdOf`), 그 값은 가입 시 호스트로만 정해지고 기본이 1(본진)이다.
 * 레포 전체에 `UPDATE sellers SET mall_id` 가 **한 줄도 없었다**(실측) ⇒ 몰을 만들고 공구를 등록해도
 * 본진에 붙어 `urdeal.kr/{슬러그}` 는 계속 빈 화면이었다.
 *
 * ## 이 테스트가 실제로 막는 것
 * - R1 연결/해제 라우트가 **존재**하고 **슈퍼 전용**이다 (몰 관리는 super-only — 서버가 최종 방어)
 * - R2 🔴 **상품이 같이 따라간다** — 매장만 옮기면 그 매장 상품은 본진 `mall_id` 로 남아
 *   "매장은 옮겼는데 몰 홈은 비어 있는" 절반 상태가 된다. 가장 헷갈릴 실패 모드라 배선을 고정한다.
 * - R3 **해제 = 본진으로 이동**(삭제 아님) + 본진 자기 자신은 해제 대상이 아니다
 * - R4 비활성 몰로는 못 옮긴다 — 옮겨 봐야 그 상품이 어디에도 안 뜬다
 * - R5 어드민 화면이 이 API 를 실제로 부른다(배선 — 화면만 있고 호출이 없으면 무의미)
 *
 * ⚠️ **못 막는 것**: 실제 D1 동작·권한 미들웨어의 런타임 판정. 여기서 고정하는 것은 **배선과 가드의 존재**다.
 *   실물 판정은 배포 후 어드민에서 매장 하나를 붙여 `urdeal.kr/{슬러그}` 가 채워지는지로 한다.
 */
import { describe, it, expect } from 'vitest'
import { readCode, sliceFrom } from '../helpers/source-text'

const ROUTES = 'src/features/supply/api/wholesale-malls-admin.routes.ts'
const PANEL = 'src/pages/admin/wholesale-malls/MallSellersPanel.tsx'
const PAGE = 'src/pages/admin/AdminWholesaleMallsPage.tsx'

describe('🔴 R1 — 연결/해제 라우트가 있고 슈퍼 전용이다', () => {
  const code = readCode(ROUTES)

  for (const [verb, path] of [
    ["app.get('/:id/sellers'", '목록'],
    ["app.post('/:id/sellers'", '연결'],
    ["app.delete('/:id/sellers/:sellerId'", '해제'],
  ] as const) {
    it(`${path} 라우트 존재 + requireSuperAdmin`, () => {
      expect(code).toContain(verb)
      // 라우트 선언 줄 안에서 super 가드를 찾는다 — 파일 어딘가에 있는 것으로는 부족하다.
      const line = code.split('\n').find((l) => l.includes(verb))!
      expect(line).toContain('requireSuperAdmin()')
    })
  }

  it('쓰기 라우트엔 rateLimit 이 붙어 있다', () => {
    for (const v of ["app.post('/:id/sellers'", "app.delete('/:id/sellers/:sellerId'"]) {
      expect(code.split('\n').find((l) => l.includes(v))!).toContain('rateLimit(')
    }
  })
})

describe('🔴 R2 — 매장을 옮기면 상품도 같이 간다', () => {
  const code = readCode(ROUTES)

  it('연결(POST)이 sellers 와 products 를 **둘 다** 옮긴다', () => {
    const body = sliceFrom(code, "app.post('/:id/sellers'", 'app.delete(', 6000)
    expect(body).toMatch(/UPDATE sellers SET mall_id = \?/)
    expect(body).toMatch(/UPDATE products SET mall_id = \?/)
    // 상품 이동은 **원래 몰에 있던 것만** — 다른 몰에 흩어진 것까지 쓸어오면 남의 몰이 빈다.
    expect(body).toMatch(/seller_id = \?[\s\S]{0,80}COALESCE\(mall_id,1\) = \?/)
  })

  it('해제(DELETE)도 상품을 함께 되돌린다', () => {
    const body = sliceFrom(code, "app.delete('/:id/sellers/:sellerId'", 'export {', 4000)
    expect(body).toMatch(/UPDATE sellers SET mall_id = \?/)
    expect(body).toMatch(/UPDATE products SET mall_id = \?/)
  })
})

describe('🔴 R3 — 해제는 삭제가 아니라 본진 이동', () => {
  const code = readCode(ROUTES)
  const body = sliceFrom(code, "app.delete('/:id/sellers/:sellerId'", 'export {', 4000)

  it('DELETE 문(행 삭제)이 없다', () => {
    expect(body).not.toMatch(/DELETE\s+FROM\s+sellers/i)
  })

  it('본진으로 되돌린다(DEFAULT_MALL_ID)', () => {
    expect(body).toContain('DEFAULT_MALL_ID')
  })

  it('본진 자신에서는 해제할 수 없다', () => {
    expect(body).toMatch(/id === DEFAULT_MALL_ID/)
  })
})

describe('🔴 R4 — 비활성 몰로는 못 옮긴다', () => {
  it('active !== 1 이면 거부', () => {
    const body = sliceFrom(readCode(ROUTES), "app.post('/:id/sellers'", 'app.delete(', 6000)
    expect(body).toMatch(/MALL_INACTIVE/)
  })
})

describe('🔴 R5 — 어드민 화면이 실제로 부른다', () => {
  it('패널이 세 엔드포인트를 모두 호출한다', () => {
    const code = readCode(PANEL)
    expect(code).toContain('/api/admin/wholesale-malls/${mallId}/sellers')
    expect(code).toContain('api.post(')
    expect(code).toContain('api.delete(')
  })

  it('몰 목록 페이지가 패널을 렌더한다', () => {
    const code = readCode(PAGE)
    expect(code).toContain('MallSellersPanel')
    expect(code).toMatch(/<MallSellersPanel[\s\S]{0,120}mallId=/)
  })

  it('패널이 로드 실패를 "매장 0개"로 위장하지 않는다', () => {
    // 도매 감사 룰(check-query-iserror)과 같은 취지 — 빈 목록과 에러는 다른 사실이다.
    expect(readCode(PANEL)).toContain('isError')
  })
})
