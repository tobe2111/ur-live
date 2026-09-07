/**
 * 🧪 QA 1라운드 결함 3건 (2026-09-03, 대표 "QA 시작해야 해. 이제 정말로")
 *
 * 라이브(`urdeal.kr`)를 모바일 브라우저로 34개 화면 돌면서 찾은 것들이다. 셋 다 **에러가 안 나서**
 * 아무도 몰랐다 — 화면은 멀쩡히 그려지고, 값만 틀리거나 클릭해야 죽는다.
 *
 * ① 유어샵 핀이 소비자 API 에 없는 상품을 가리킨다 (`/u/jongmun` → 클릭 시 404)
 * ② `/vouchers/:id` 가 카드 결제 상품을 딜 결제 화면으로 그린다 (2887 → "209,000 딜")
 * ③ 가입 화면에 폐기된 브랜드명 "UR LIVE"
 *
 * ⚠️ 이 테스트가 **못 막는 것**: 실제 렌더·라우팅 동작. 여기서 고정하는 것은 **배선**이다
 *   (어떤 조건이 어떤 쿼리·컴포넌트에 들어 있는가). 화면 판정은 대표의 손 QA 몫이다.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const CURATOR = readFileSync('src/worker/routes/curator.routes.ts', 'utf8')
const VOUCHER = readFileSync('src/pages/VoucherDetailPage.tsx', 'utf8')
const REGISTER = readFileSync('src/pages/RegisterPage.tsx', 'utf8')
const HELPER = readFileSync('src/shared/db/consumer-visible-product.ts', 'utf8')

describe('① 유어샵 핀 — 소비자에게 못 파는 상품은 안 보인다', () => {
  it('핀 목록 쿼리가 도매 원본을 뺀다', () => {
    // 핀 목록 쿼리(= 유어샵에 그려지는 것 + 헤더 카운트의 출처)를 앵커로 잡는다.
    const at = CURATOR.indexOf('FROM product_pins pp\n         JOIN products p ON p.id = pp.product_id')
    expect(at, '핀 목록 쿼리를 못 찾았다 — 쿼리가 옮겨졌으면 이 앵커를 갱신할 것').toBeGreaterThan(-1)
    const block = CURATOR.slice(at, at + 600)
    expect(block).toContain("consumerVisibleProductSql('p')")
  })

  it('같은 파일 안에 인라인 복사본이 남아 있지 않다', () => {
    // 담을 상품을 고르는 쿼리엔 조건이 있고 담긴 것을 보여 주는 쿼리엔 없었던 것이 이 사고다.
    // 두 벌로 두면 반드시 다시 갈린다 → 이 파일 안에서는 상수 하나만 쓴다.
    expect(CURATOR).not.toMatch(/NOT \(COALESCE\(p\.is_supply_product,0\) = 1/)
  })

  it('술어는 도매 **원본**만 가린다 — 재판매 복제본은 보인다', () => {
    // supply_source_id 가 있으면(판매사 복제본) 소비자에게 정상 노출돼야 한다.
    expect(HELPER).toContain('is_supply_product,0) = 1')
    expect(HELPER).toContain('supply_source_id,0) = 0')
  })
})

describe('② /vouchers/:id — 딜 결제 화면은 딜 결제 상품에만', () => {
  it('흐름이 voucher_deal 이 아니면 SSOT 가 준 경로로 넘긴다', () => {
    expect(VOUCHER).toContain('getProductFlow(product)')
    expect(VOUCHER).toMatch(/flow !== 'voucher_deal'/)
    expect(VOUCHER).toContain('FLOW_CONFIG[flow].detailPath')
  })

  it('가드가 본문 렌더 **전에** 있다 — 뒤에 있으면 틀린 화면이 한 프레임 보인다', () => {
    // ⚠️ 앵커 주의: `const total = ...` 은 구매 핸들러 안에도 있어(같은 문자열) 그걸 잡으면 늘 통과한다.
    //   실제로 지켜야 하는 것은 "딜 화면을 그리기 전에 넘긴다"이므로 렌더의 <SEO> 를 앵커로 쓴다.
    const guard = VOUCHER.indexOf("flow !== 'voucher_deal'")
    const render = VOUCHER.indexOf('교환권 - 유어딜')
    expect(guard, '가드를 못 찾았다').toBeGreaterThan(-1)
    expect(render, '렌더 앵커를 못 찾았다 — SEO title 이 바뀌었으면 갱신할 것').toBeGreaterThan(-1)
    expect(guard).toBeLessThan(render)
  })

  it('조건을 베껴 쓰지 않는다 — deal_only 직접 비교로 분기하지 않는다', () => {
    // 결제 흐름 판정은 product-flow SSOT 한 곳이다(카테고리에 _voucher 가 붙는다고 딜 결제가 아니다).
    // ⚠️ 두 번 헛돌 뻔했다: ① 끝 앵커를 `const total = ...` 로 잡으니 **가드보다 앞의** 것을 찾아
    //   slice 가 비어 영원히 통과했고 ② 렌더 앵커까지 넓히니 배지 라벨의 **정당한** `deal_only` 사용
    //   (`deal_only === 1 ? '교환권' : ...`)이 잡혔다. 검사 대상은 **분기문 자체**다.
    const from = VOUCHER.indexOf('const flow = getProductFlow')
    expect(from, '가드를 못 찾았다').toBeGreaterThan(-1)
    const to = VOUCHER.indexOf('\n  }', VOUCHER.indexOf('FLOW_CONFIG[flow].detailPath'))
    expect(to, '가드 분기의 끝을 못 찾았다').toBeGreaterThan(from)
    const guardBlock = VOUCHER.slice(from, to)
    expect(guardBlock.length, '가드 구간이 비었다 — 앵커가 낡았다').toBeGreaterThan(50)
    expect(guardBlock).not.toContain('deal_only')
  })
})

describe('③ 가입 화면 브랜드', () => {
  it('폐기된 옛 브랜드명이 화면 문자열로 남아 있지 않다', () => {
    // ⚠️ 주석은 뺀다 — 왜 걷어냈는지 적어 둔 설명이 위반으로 잡히면 그 설명을 지우게 된다
    //   (이 레포가 이미 한 번 밟은 함정).
    const code = REGISTER.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
    expect(code).not.toContain('UR' + ' LIVE')
  })
  it('워드마크는 SSOT 컴포넌트를 쓴다 — 문자열을 다시 박으면 또 갈린다', () => {
    expect(REGISTER).toContain('UrDealLogo')
  })
})
