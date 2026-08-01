/**
 * 🔴 **운영자가 자기 공구만 연다** 〔세션 ③-b, O5〕
 *
 * `gb-cockpit` 은 어드민 전용이라 운영자가 자기 상품의 공구가·마감을 못 정했다.
 * 셀러 경로를 새로 뚫으면 **두 가지가 동시에 위험해진다**:
 *
 * ① **IDOR** — 남의 상품 공구를 건드릴 수 있게 되는 것. 소유권을 **쿼리에서** 걸러야 한다.
 * ② **검증 분기** — 셀러 경로만 검증이 약하면 *"셀러로 저장하면 통과하는 값"* 이 생긴다.
 *    특히 `validateGbSession` 이 강제하는 **공구가 < 상시가** — 이게 빠지면 가격을 **올리는** 공구가 열린다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 런타임 인증(JWT 위조·만료) — 그건 `verify()` 와 미들웨어의 몫
 *   - `validateGbSession` **자체**의 규칙(그건 gb-session 테스트가 본다)
 *   - 마운트 경로가 다른 라우터에 가려지는 경우(Hono 미들웨어 순서)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

/** `//` 주석 제거 — 주석에만 남은 심볼을 코드로 착각하지 않기 위해(오늘만 세 번 겪은 함정). */
const code = readFileSync(resolve(process.cwd(), 'src/features/seller/api/seller-gb.routes.ts'), 'utf8')
  .replace(/\/\/[^\n]*/g, '')
const worker = readFileSync(resolve(process.cwd(), 'src/worker/index.ts'), 'utf8').replace(/\/\/[^\n]*/g, '')

describe('🔴 ① 소유권 — 남의 상품 공구를 못 건드린다', () => {
  it('상품 조회가 `seller_id = ?` 로 **쿼리에서** 걸러진다', () => {
    // 조회 후 애플리케이션에서 비교하면 한 번만 빠뜨려도 남의 상품이 통과한다.
    expect(code).toMatch(/FROM products WHERE id = \? AND seller_id = \?/)
  })

  it('쓰기(PUT)와 읽기(GET) **둘 다** 소유권 확인을 거친다', () => {
    // 읽기만 열어두면 남의 공구 설정(가격·마감)이 새어나간다.
    const owned = (code.match(/ownedProduct\(/g) || []).length
    expect(owned, 'GET·PUT 각각의 호출 + 정의 = 3회 이상이어야 한다').toBeGreaterThanOrEqual(3)
  })

  it('없는 상품과 남의 상품이 **같은 404** — 존재 여부를 흘리지 않는다', () => {
    // 403 과 404 를 갈라 주면 남의 상품 id 를 열거해 존재를 알아낼 수 있다.
    expect(code).not.toMatch(/,\s*403\s*\)/)
  })

  it('정지·반려된 셀러의 토큰은 거부된다 — 서명 유효성만으로 통과시키지 않는다', () => {
    expect(code).toMatch(/status IN \('approved', 'active'\)/)
    expect(code).toContain('is_active = 1')
  })
})

describe('🔴 ② 검증 — 어드민 조종석과 **같은 함수**를 쓴다', () => {
  it('validateGbSession 을 상시가와 함께 호출한다', () => {
    // 인자에 상시가(p.price)가 들어가야 "공구가 < 상시가"가 실제로 강제된다.
    expect(code).toMatch(/validateGbSession\(session,\s*Number\(p\.price\)\)/)
  })

  it('저장도 SSOT — 새 저장 경로를 만들지 않는다', () => {
    expect(code).toContain('saveGbSession(')
    // product_supply_meta 를 직접 INSERT/UPDATE 하면 off 청소 등 SSOT 동작이 갈린다.
    expect(code).not.toMatch(/INSERT INTO product_supply_meta|UPDATE product_supply_meta/)
  })

  it('mode 는 화이트리스트 — 임의 문자열이 저장되지 않는다', () => {
    expect(code).toMatch(/MODES\.includes\(/)
  })
})

describe('배선', () => {
  it('워커에 마운트돼 있다 — 파일만 있고 안 붙으면 아무 일도 안 일어난다', () => {
    expect(worker).toContain("app.route('/api/seller/gb', sellerGbRoutes)")
  })
})
