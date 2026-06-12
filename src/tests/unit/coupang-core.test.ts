/**
 * 🛒 2026-06-12 쿠팡 코어 — 순수 로직 단위 테스트 (HMAC 서명·payload 빌더·signed-date 형식).
 *   네트워크 호출부는 실계정 E2E 영역 — 여기선 서명 결정성/형식과 등록 payload 구조를 고정.
 */
import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { coupangSignedDate, coupangSign, coupangAuthHeader, buildCoupangProductPayload, type CoupangExportInput } from '../../features/supply/api/coupang-core'

describe('coupangSignedDate', () => {
  it("UTC yyMMdd'T'HHmmss'Z' 형식", () => {
    const d = new Date(Date.UTC(2026, 5, 12, 3, 4, 5)) // 2026-06-12 03:04:05Z
    expect(coupangSignedDate(d)).toBe('260612T030405Z')
  })
})

describe('coupangSign (HMAC-SHA256)', () => {
  it('node:crypto 참조 구현과 동일 (Web Crypto 경로 검증)', async () => {
    const secret = 'test-secret-key-1234567890'
    const signedDate = '260612T030405Z'
    const method = 'GET'
    const path = '/v2/providers/seller_api/apis/api/v1/marketplace/seller-products'
    const query = 'vendorId=A00012345&maxPerPage=50'
    const ours = await coupangSign(secret, signedDate, method, path, query)
    const ref = createHmac('sha256', secret).update(`${signedDate}${method}${path}${query}`).digest('hex')
    expect(ours).toBe(ref)
  })

  it('Authorization 헤더 형식 — CEA algorithm=HmacSHA256, access-key, signed-date, signature', async () => {
    const h = await coupangAuthHeader('ak-123', 'sk-1234567890', 'GET', '/path', '', new Date(Date.UTC(2026, 0, 1)))
    expect(h).toMatch(/^CEA algorithm=HmacSHA256, access-key=ak-123, signed-date=260101T000000Z, signature=[0-9a-f]{64}$/)
  })
})

describe('buildCoupangProductPayload', () => {
  const base: CoupangExportInput = {
    vendorId: 'A00012345',
    vendorUserId: 'wing_user',
    displayCategoryCode: '12345',
    name: '테스트 상품',
    brand: '브랜드A',
    salePrice: 12900,
    originalPrice: 19900,
    stock: 50,
    imageUrl: 'https://live.ur-team.com/api/media/x.jpg',
    detailHtml: '<p>설명</p>',
    outboundShippingPlaceCode: '777',
    returnCenterCode: 'RC1',
    returnChargeName: '본사 반품지',
    returnAddress: { zipCode: '06236', address: '서울', addressDetail: '1층', phone: '02-000-0000' },
    deliveryChargeType: 'FREE',
    deliveryCharge: 0,
    notices: [
      { noticeCategoryName: '기타 재화', noticeCategoryDetailName: '품명 및 모델명', required: true },
      { noticeCategoryName: '기타 재화', noticeCategoryDetailName: '제조국', required: true },
      { noticeCategoryName: '기타 재화', noticeCategoryDetailName: 'A/S 책임자', required: false },
    ],
  }

  it('필수 구조 — vendorId/카테고리/판매가/이미지/반품지/출고지/승인요청', () => {
    const p = buildCoupangProductPayload(base) as any
    expect(p.vendorId).toBe('A00012345')
    expect(p.displayCategoryCode).toBe(12345)
    expect(p.requested).toBe(true)
    expect(p.returnCenterCode).toBe('RC1')
    expect(p.outboundShippingPlaceCode).toBe(777)
    expect(p.items).toHaveLength(1)
    expect(p.items[0].salePrice).toBe(12900)
    expect(p.items[0].maximumBuyCount).toBe(50)
    expect(p.items[0].images[0]).toEqual({ imageOrder: 0, imageType: 'REPRESENTATION', vendorPath: base.imageUrl })
  })

  it('필수 고시정보만 같은 분류로 — content는 상세페이지 참조', () => {
    const p = buildCoupangProductPayload(base) as any
    const notices = p.items[0].notices
    expect(notices).toHaveLength(2) // required 만
    expect(notices.every((n: { content: string }) => n.content === '상세페이지 참조')).toBe(true)
    expect(notices.every((n: { noticeCategoryName: string }) => n.noticeCategoryName === '기타 재화')).toBe(true)
  })

  it('배송비 — FREE 면 0, NOT_FREE 면 금액 반영', () => {
    const free = buildCoupangProductPayload(base) as any
    expect(free.deliveryChargeType).toBe('FREE')
    expect(free.deliveryCharge).toBe(0)
    const paid = buildCoupangProductPayload({ ...base, deliveryChargeType: 'NOT_FREE', deliveryCharge: 3000 }) as any
    expect(paid.deliveryCharge).toBe(3000)
    expect(paid.deliveryChargeOnReturn).toBe(3000)
  })

  it('상품명 100자 절단 + 브랜드 공백 시 기타', () => {
    const p = buildCoupangProductPayload({ ...base, name: 'A'.repeat(150), brand: '' }) as any
    expect(p.sellerProductName).toHaveLength(100)
    expect(p.brand).toBe('기타')
  })
})
