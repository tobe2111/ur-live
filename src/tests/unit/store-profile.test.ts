/**
 * 🏪 매장 프로필 단일화 불변식 (2026-08-23 대표 "그냥 지금 하자 끝까지 신중하게")
 *
 * 지키는 것:
 *   R1 전파 스코프 — products UPDATE 는 반드시 `WHERE seller_id = ?` + 기존 복사본
 *      (`restaurant_name` 보유)만. 빠지면 남의 매장/쇼핑 상품까지 덮는 대형사고.
 *   R2 채택(adopt)은 fill-if-empty — 상품 등록이 기존 매장 프로필을 절대 덮지 않는다.
 *   R3 PIN 은 비어 있지 않을 때만 전파 — 빈 값 전파는 매장 검증(2026-07-03 방어) 무장해제.
 *   R4 프로필 PATCH 는 canOperateStore 통과 후에만 저장 — 남의 매장 정보 수정 차단.
 *   R5 병합 우선순위 — 최근 상품 > seller_meta > sellers 행 (전파가 이 불변을 유지시킨다).
 *   R6 채택이 상품 등록 경로에 실제로 배선돼 있다 (fail-soft).
 *
 * 이 테스트가 못 막는 것: 실제 D1 UPDATE 실행 결과(라이브 staging 판정).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { mergeStoreProfile } from '@/worker/utils/store-profile'

const read = (p: string) => readFileSync(p, 'utf-8')
const SSOT = 'src/worker/utils/store-profile.ts'
const ROUTES = 'src/features/seller/api/seller-stores.routes.ts'
const PRODUCT_CREATE = 'src/features/seller/api/seller-orders.routes.ts'

describe('R5 mergeStoreProfile — 최근 상품 > meta > sellers', () => {
  it('세 소스가 다 있으면 상품이 이긴다', () => {
    const m = mergeStoreProfile({
      product: { restaurant_name: '상품이름', restaurant_phone: '02-111' },
      meta: { store_name: '메타이름', store_phone: '02-222', store_address: '메타주소' },
      seller: { business_name: '셀러상호', address: '셀러주소', phone: '02-333' },
    })
    expect(m.name).toBe('상품이름')
    expect(m.phone).toBe('02-111')
    // 상품에 없는 필드는 다음 소스로 흐른다
    expect(m.address).toBe('메타주소')
  })
  it('상품이 없으면 meta, meta 도 없으면 sellers 행', () => {
    const m = mergeStoreProfile({ meta: { store_name: '메타이름' }, seller: { business_name: '셀러상호', phone: '02-333' } })
    expect(m.name).toBe('메타이름')
    expect(m.phone).toBe('02-333')
    const m2 = mergeStoreProfile({ seller: { business_name: '셀러상호' } })
    expect(m2.name).toBe('셀러상호')
  })
  it('빈 문자열은 값이 아니다 (다음 소스로 흐름)', () => {
    const m = mergeStoreProfile({ product: { restaurant_name: '' }, meta: { store_name: '메타이름' } })
    expect(m.name).toBe('메타이름')
  })
})

describe('R1·R3 전파 SQL 계약', () => {
  const s = read(SSOT)
  const prop = s.slice(s.indexOf('UPDATE products SET'))
  it('R1 전파는 seller_id 스코프 + 기존 복사본 한정', () => {
    expect(prop, '스코프가 빠지면 전 매장 상품이 덮인다').toContain('WHERE seller_id = ?')
    expect(prop, '쇼핑 상품에 매장 필드를 새로 만들면 안 된다').toContain("restaurant_name IS NOT NULL AND restaurant_name != ''")
  })
  it('R3 PIN 은 비어 있지 않을 때만 전파', () => {
    // pin 이 truthy 가드 안에서만 SET 목록에 들어가는지 — 무가드 push 로 바뀌면 실패해야 한다.
    expect(s).toMatch(/if \(pin\) \{ set\.push\('store_verify_pin = \?'\)/)
  })
})

describe('R2 채택은 fill-if-empty', () => {
  it('기존 meta 값이 있으면 건너뛴다', () => {
    const s = read(SSOT)
    const adopt = s.slice(s.indexOf('adoptStoreProfileFromProduct'))
    expect(adopt, 'fill 가드가 사라지면 상품 수정이 매장 프로필을 덮는다').toContain('if (!meta[key]')
  })
})

describe('R4 프로필 PATCH 권한', () => {
  it('canOperateStore 통과 후에만 saveStoreProfileAndPropagate', () => {
    const s = read(ROUTES)
    const block = s.slice(s.indexOf("app.patch('/stores/:id/profile'"))
    const authAt = block.indexOf('canOperateStore')
    const saveAt = block.indexOf('saveStoreProfileAndPropagate')
    expect(authAt, 'PATCH 에 권한 검사가 없다').toBeGreaterThan(-1)
    expect(saveAt).toBeGreaterThan(authAt)
  })
})

describe('R6 채택 배선 (상품 등록 경로)', () => {
  it('POST /products 성공 경로가 adoptStoreProfileFromProduct 를 부른다 (fail-soft)', () => {
    const s = read(PRODUCT_CREATE)
    const at = s.indexOf('adoptStoreProfileFromProduct')
    expect(at, '배선이 빠지면 첫 등록이 매장 프로필을 만들지 못한다').toBeGreaterThan(-1)
    // fail-soft — swallow/catch 로 감싸져 등록을 못 막는다
    expect(s.slice(at, at + 600)).toMatch(/catch/)
  })
})

describe('R7~R9 매장 등록 선행 게이트 (2026-08-24 대표 — "무조건 선행")', () => {
  it('R7 서버가 store_ready 를 판정하고, **운영 중인**(is_active) 좌석은 통과한다', () => {
    const s = read(ROUTES)
    // grandfather 가 빠지면 게이트 신설이 기존 실운영 셀러를 잠근다(lock-out 사고 클래스).
    expect(s).toMatch(/store_ready = !!\(seller\?\.address \|\| meta\.store_channel \|\| meta\.store_lat \|\| Number\(liveStore\?\.n\) > 0\)/)
    expect(s, '응답에 store_ready 미노출이면 클라 게이트가 판정 근거를 잃는다').toContain('store_ready,')
  })

  it('R7b grandfather 는 판매중지를 존중한다 — 전부 내리면 온보딩으로 돌아갈 수 있다', () => {
    const s = read(ROUTES)
    const q = s.slice(s.indexOf('SELECT COUNT(*) AS n FROM products'))
    expect(q, 'is_active 를 안 보면 판매중지해도 영원히 매장으로 남는다').toContain('is_active = 1')
    expect(q).toContain("restaurant_name != ''")
    // 프리필(lastProduct)은 판매중지분도 계속 쓴다 — 게이트 신호와 분리돼야 한다.
    expect(s, '프리필까지 is_active 로 좁히면 매장 정보 자동입력이 사라진다')
      .toMatch(/loadLatestProductCopy\(DB, sellerId\)/)
  })
  it('R8 대시보드 게이트는 fail-open — 판정 실패(null)로는 절대 잠그지 않는다', () => {
    const p = read('src/pages/SellerPage.tsx')
    expect(p, '느슨한 truthy 게이트는 로딩/실패 중 정상 셀러를 잠근다').toContain('storeGated === true ?')
    const panel = read('src/pages/seller-page/MyStoresPanel.tsx')
    expect(panel, '좌석 판정 실패는 게이트 아님(fail-open)').toContain('seatReady === false')
  })
  it('R9 위저드도 등록 매장 없이는 다음 단계 차단 + 등록 즉시 좌석 전환', () => {
    const w = read('src/pages/SellerMealVoucherNewPage.tsx')
    expect(w, '위저드 게이트가 빠지면 매장 없이 이용권이 만들어진다').toContain("s === 0 && storeReady === false")
    const step = read('src/pages/seller-meal-voucher/StoreStep.tsx')
    expect(step, '등록 후 좌석 전환이 없으면 이용권이 옛 좌석으로 귀속된다').toContain('onStoreReady?.()')
  })
})
