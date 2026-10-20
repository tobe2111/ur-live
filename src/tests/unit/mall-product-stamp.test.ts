/**
 * 🔴 **운영자 상품은 운영자의 몰에 꽂혀야 한다** 〔세션 ③-b, O4〕
 *
 * `products.mall_id` 는 `DEFAULT 1`(본진)이다. 셀러 상품 생성이 이 값을 **스탬프하지 않으면**
 * 운영자가 올린 상품이 전부 **본진(1)** 으로 들어가고, 그 운영자의 몰 화면은 **영원히 비어 있다.**
 *
 * ## 🔴 이게 조용한 실패인 이유
 * 등록은 **성공한다.** 셀러 대시보드 목록에도 **보인다.** 에러도 경고도 없다.
 * 비어 있는 건 **소비자 몰 화면 하나뿐**이고, 그건 운영자가 자기 링크를 열어봐야 안다.
 * ⇒ 이 레포가 반복해 만난 *"실패가 아니라 조용한 부재"* 클래스라 값으로 고정한다.
 *
 * ⚠️ 이 테스트가 **못** 막는 것:
 *   - 최소 스키마 fallback 경로(`mall_id` 컬럼 없는 옛 DB) — 거기로 떨어지면 본진에 꽂힌다.
 *     실환경은 repair-schema 가 컬럼을 보장하므로 도달하지 않지만, **도달했다면 스키마 복구가 먼저**다.
 *   - `sellers.mall_id` 자체가 틀린 경우(운영자 계정 생성 시점의 문제 — 세션 ⑤)
 *   - 어드민/KT/큐레이터 생성 경로(그건 본진 상품이 맞다 — 스탬프 대상이 아니다)
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { mallIdForSeller, MAIN_MALL } from '@/shared/mall/resolve'

const SELLER_ROUTES = 'src/features/seller/api/seller-orders.routes.ts'

/** `//` 주석 제거 — 주석에만 남은 심볼을 코드로 착각하지 않기 위해(이 레포의 반복 함정). */
function codeOf(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), 'utf8').replace(/\/\/[^\n]*/g, '')
}

describe('🔴 셀러 상품 생성은 mall_id 를 스탬프한다', () => {
  const code = codeOf(SELLER_ROUTES)

  it('기본 INSERT 의 컬럼 목록에 mall_id 가 있다', () => {
    const inserts = [...code.matchAll(/INSERT INTO products\s*\(([^)]*)\)/g)].map((m) => m[1])
    expect(inserts.length, '셀러 상품 INSERT 를 못 찾았다 — 경로가 바뀌었는지 확인할 것').toBeGreaterThan(0)
    // 첫 INSERT 가 정상 경로다(두 번째는 옛 스키마 fallback).
    expect(inserts[0]).toContain('mall_id')
  })

  it('값은 **셀러의 몰**에서 온다 — 서버가 sellers 에서 읽는다', () => {
    // body 에서 받으면 셀러가 **남의 몰에 상품을 꽂을 수 있다**(권한 상승).
    expect(code).toMatch(/SELECT mall_id FROM sellers WHERE id = \?/)
    // 판정(NULL→본진 등)은 순수함수가 갖는다 — 아래 describe 가 그 함수를 직접 검증한다.
    expect(code).toContain('mallIdForSeller(')
  })

  it('🔴 클라이언트가 보낸 mall_id 를 신뢰하지 않는다', () => {
    // 🔴 요청 **body 타입 블록만** 본다. 핸들러 전체를 보면 서버측 조회의 타입 주석
    //   (`first<{ mall_id: number | null }>`)까지 걸려 **오탐**이 난다 — 실제로 그랬다.
    // 🔴 **핸들러부터 앵커한다.** 이 파일엔 `c.req.json<{` 가 여러 번 나와서, 파일 처음부터 찾으면
    //   **다른 엔드포인트의 body** 를 검사하게 된다 — 되돌려-검증에서 실제로 그래서 빨강이 안 떴다.
    const handler = code.indexOf(`post('/products'`)
    expect(handler, '/products POST 핸들러를 못 찾았다').toBeGreaterThan(-1)
    const start = code.indexOf('c.req.json<{', handler)
    expect(start, 'body 타입 블록을 못 찾았다').toBeGreaterThan(-1)
    const bodyType = code.slice(start, code.indexOf('}>', start))
    expect(bodyType).not.toMatch(/\bmall_id\b/)
  })
})

/**
 * 판정 자체는 순수함수가 갖는다 — 라우트 안에 있으면 D1 없이는 못 돈다.
 */
describe('mallIdForSeller — 몰 없는 셀러는 본진', () => {
  it('셀러의 몰을 그대로', () => {
    expect(mallIdForSeller(3)).toBe(3)
    expect(mallIdForSeller(7)).toBe(7)
  })

  it('NULL·undefined·0·음수·NaN 은 본진(1)', () => {
    // 기존 본진 셀러는 `mall_id` 가 NULL 이다. 그들 상품은 본진이 맞는 자리다.
    for (const v of [null, undefined, 0, -1, NaN, Infinity]) expect(mallIdForSeller(v as number)).toBe(MAIN_MALL)
  })

  it('소수는 내림 — 몰 id 는 정수다', () => {
    expect(mallIdForSeller(3.9)).toBe(3)
  })
})
