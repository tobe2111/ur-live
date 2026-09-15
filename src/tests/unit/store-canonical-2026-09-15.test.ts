/**
 * 🔒 매장 확정 (2026-09-15, 대표 "매장을 등록해야 그 매장에 맞는 이용권만 만들지").
 *
 * 무엇을 지키는가: 이용권↔매장 결합의 유일한 키는 `products.seller_id`(제출 순간의 좌석)인데
 * 상호·주소·좌표는 폼에서 온 **검증 없는 텍스트 복사본**이라 둘이 갈릴 수 있었다 — 좌석 A 에서
 * 매장 B 상호를 타이핑하면 소비자에겐 B 로 보이고 정산·주문·통계는 A 로 가는 상품이 생긴다.
 * 등록 핸들러 전체에 그 대조가 **한 줄도 없었다**(2026-09-15 실측).
 *
 * 이 테스트는 순수 함수(`resolveStoreFieldsForProduct`)의 **동작을 실제로 돌려** 재고,
 * 배선(핸들러가 그 함수를 부르는가)은 소스로 고정한다.
 *
 * 주입 매니페스트: scripts/mutations/store-canonical.mjs
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { stripComments } from '../helpers/source-text'
import { resolveStoreFieldsForProduct } from '../../worker/utils/store-profile'

const read = (p: string) => readFileSync(p, 'utf8')

/** 최소 D1 스텁 — seller_meta 한 벌 + sellers 한 행. */
function makeDb(meta: Record<string, string>, seller: Record<string, unknown> | null) {
  return {
    prepare(sql: string) {
      const rows = () => ({ results: Object.entries(meta).map(([key, value]) => ({ seller_id: 1, key, value })) })
      return {
        // ensureSellerMetaTable 은 bind 없이 바로 run 한다(CREATE TABLE/INDEX) — 없으면 전체가 reject 된다
        async run() { return { meta: { changes: 0 } } },
        bind: (..._a: unknown[]) => ({
          async first() { return sql.includes('FROM sellers') ? seller : null },
          async all() { return rows() }, // getSellerMeta 는 (seller_id, key, value) 로 읽는다
          async run() { return { meta: { changes: 0 } } },
        }),
      }
    },
  } as never
}

const STORE = { name: '홍대돈까스', business_name: '홍대돈까스', phone: '021112222', address: '서울 마포구 1', seller_type: 'store_owner' }

describe('① 매장 프로필이 있으면 폼 값을 정정한다', () => {
  it('좌석 A 에서 매장 B 상호를 적어도 저장은 A 로 확정된다 (상호↔귀속 갈림 차단)', async () => {
    const db = makeDb({}, STORE)
    const r = await resolveStoreFieldsForProduct(db, 1, { restaurant_name: '남의가게', restaurant_address: '부산 어딘가' })
    expect(r.fields.restaurant_name).toBe('홍대돈까스')
    expect(r.fields.restaurant_address).toBe('서울 마포구 1')
    // 조용히 바꾸지 않는다 — 무엇이 정정됐는지 돌려준다
    expect(r.corrected).toContain('restaurant_name')
    expect(r.corrected).toContain('restaurant_address')
  })
  it('폼이 비어 있어도 채운다 — 빠른 등록(매장을 안 묻는 화면)이 지도에 뜨는 근거', async () => {
    const db = makeDb({ store_lat: '37.5', store_lng: '127.0' }, STORE)
    const r = await resolveStoreFieldsForProduct(db, 1, {})
    expect(r.fields.restaurant_name).toBe('홍대돈까스')
    expect(r.fields.restaurant_lat).toBe('37.5')
    expect(r.fields.restaurant_lng).toBe('127.0')
    expect(r.corrected).toEqual([]) // 덮어쓴 게 아니라 채운 것 — 경고할 일이 아니다
  })
  it("매장 겸 크리에이터('both') 좌석도 매장이다 — 직접 비교가 놓치던 자리", async () => {
    const db = makeDb({}, { ...STORE, seller_type: 'both' })
    const r = await resolveStoreFieldsForProduct(db, 1, { restaurant_name: '남의가게' })
    expect(r.fields.restaurant_name).toBe('홍대돈까스')
  })
  it('seller_meta.store_name 이 sellers 행보다 우선한다 (매장 관리에서 고친 값)', async () => {
    const db = makeDb({ store_name: '홍대돈까스 2호점' }, STORE)
    const r = await resolveStoreFieldsForProduct(db, 1, { restaurant_name: '아무거나' })
    expect(r.fields.restaurant_name).toBe('홍대돈까스 2호점')
  })
})

describe('② 매장 프로필이 없으면 손대지 않는다 (fail-open — lock-out 금지)', () => {
  it('첫 이용권 등록: 프로필이 비었으면 폼 값 그대로 (adopt 가 이 값을 프로필로 승격)', async () => {
    const db = makeDb({}, { name: null, business_name: null, phone: null, address: null, seller_type: 'store_owner' })
    const r = await resolveStoreFieldsForProduct(db, 1, { restaurant_name: '새로 여는 가게' })
    expect(r.fields).toEqual({})
  })
  it('개인 셀러(store_owner 아님)의 계정 이름은 매장명이 아니다 — 사람 이름이 상호가 되면 안 된다', async () => {
    const db = makeDb({}, { name: '김철수', business_name: null, phone: null, address: null, seller_type: 'influencer' })
    const r = await resolveStoreFieldsForProduct(db, 1, { restaurant_name: '내가 적은 가게' })
    expect(r.fields).toEqual({})
  })
  it('sellers 조회가 실패해도 등록을 막지 않는다', async () => {
    const db = {
      prepare: () => ({
        async run() { return { meta: { changes: 0 } } },
        bind: () => ({
          async first() { throw new Error('boom') },
          async all() { return { results: [] } },
          async run() { return { meta: { changes: 0 } } },
        }),
      }),
    } as never
    const r = await resolveStoreFieldsForProduct(db, 1, { restaurant_name: '가게' })
    expect(r.fields).toEqual({})
  })
})

describe('③ 확정 범위 — 좌표·PIN 의 신중 규칙', () => {
  it('프로필에 좌표가 없으면 폼 좌표를 버리지 않는다 (지도에서 처음 고른 값)', async () => {
    const db = makeDb({}, STORE)
    const r = await resolveStoreFieldsForProduct(db, 1, { restaurant_lat: '37.1', restaurant_lng: '127.1' })
    expect(r.fields.restaurant_lat).toBeUndefined()
    expect(r.fields.restaurant_lng).toBeUndefined()
  })
  it('PIN 은 절대 확정 대상이 아니다 (빈 값 전파 = 매장 검증 무장해제)', async () => {
    const db = makeDb({ store_verify_pin: '1234' }, STORE)
    const r = await resolveStoreFieldsForProduct(db, 1, { restaurant_name: 'x' })
    expect(Object.keys(r.fields)).not.toContain('store_verify_pin')
  })
})

describe('④ 배선 — 등록 핸들러가 실제로 부른다', () => {
  const SRC = stripComments(read('src/features/seller/api/seller-orders.routes.ts'))
  it('POST /products 가 매장 확정을 부르고 body 에 반영한다', () => {
    expect(SRC).toContain('resolveStoreFieldsForProduct')
    expect(SRC).toMatch(/Object\.assign\(body, fields\)/)
  })
  it('이용권이 아닌 상품(빠른 등록)도 매장 필드를 쓴다 — 안 쓰면 소비자 지도에서 사라진다', () => {
    expect(SRC).toMatch(/if \(!isVoucherCategory\(category\)\) await writeVoucherProductFields\(db, Number\(productId\), fields\)/)
  })
  it('확정은 이용권 writer **앞**에서 일어난다 — 뒤면 폼 값이 이미 저장된 뒤다', () => {
    const resolveAt = SRC.indexOf('resolveStoreFieldsForProduct')
    const writerAt = SRC.indexOf('await writeVoucherProductFields(db, Number(productId), body')
    expect(resolveAt).toBeGreaterThan(0)
    expect(writerAt).toBeGreaterThan(resolveAt)
  })
  it('실패해도 등록을 막지 않는다 (fail-soft)', () => {
    const at = SRC.indexOf('resolveStoreFieldsForProduct')
    expect(SRC.slice(at, at + 900)).toMatch(/catch \{/)
  })
})
