/**
 * 🛒 2026-06-12 네이버 커머스API Phase A — 순수 로직 단위 테스트.
 *   전자서명(bcrypt salt 방식)·상품 payload 빌더. 네트워크 호출부는 실계정 E2E 영역.
 */
import { describe, it, expect } from 'vitest'
import bcrypt from 'bcryptjs'
import { signClientSecret, buildNaverProductPayload, type ExportInput } from '../../features/supply/api/naver-commerce-core'

describe('signClientSecret (커머스API 전자서명)', () => {
  it('client_secret(bcrypt salt)으로 `${id}_${ts}` 를 해시 → base64 — 역검증 일치', async () => {
    const clientId = 'testClientId00'
    const clientSecret = bcrypt.genSaltSync(4) // 네이버 시크릿과 동일한 bcrypt salt 형식
    const ts = 1750000000000
    const sign = await signClientSecret(clientId, clientSecret, ts)
    // base64 디코드하면 bcrypt 해시 — 원문과 compare 일치해야 함
    const hashed = atob(sign)
    expect(hashed.startsWith('$2a$') || hashed.startsWith('$2b$')).toBe(true)
    expect(bcrypt.compareSync(`${clientId}_${ts}`, hashed)).toBe(true)
  })

  it('같은 입력 + 같은 salt → 결정적 출력 (재현 가능)', async () => {
    const secret = bcrypt.genSaltSync(4)
    const a = await signClientSecret('abc', secret, 123)
    const b = await signClientSecret('abc', secret, 123)
    expect(a).toBe(b)
  })

  it('잘못된 salt 형식이면 throw (라우트가 사용자 친화 에러로 변환)', async () => {
    await expect(signClientSecret('abc', 'not-a-bcrypt-salt', 123)).rejects.toThrow()
  })
})

describe('buildNaverProductPayload', () => {
  const base: ExportInput = {
    name: '테스트 상품',
    leafCategoryId: '50000123',
    salePrice: 12900,
    stockQuantity: 50,
    naverImageUrl: 'https://shop-phinf.pstatic.net/test.jpg',
    detailHtml: '<p>설명</p>',
    shippingFee: 0,
    asTelephone: '010-1234-5678',
    asGuide: '판매자에게 문의해주세요',
  }

  it('필수 구조: originProduct(SALE/카테고리/가격/재고/이미지) + 채널 노출 ON', () => {
    const p = buildNaverProductPayload(base) as any
    expect(p.originProduct.statusType).toBe('SALE')
    expect(p.originProduct.leafCategoryId).toBe('50000123')
    expect(p.originProduct.salePrice).toBe(12900)
    expect(p.originProduct.stockQuantity).toBe(50)
    expect(p.originProduct.images.representativeImage.url).toBe(base.naverImageUrl)
    expect(p.smartstoreChannelProduct.channelProductDisplayStatusType).toBe('ON')
    expect(p.smartstoreChannelProduct.naverShoppingRegistration).toBe(true)
  })

  it('배송비 0 → FREE, 양수 → PAID + baseFee', () => {
    const free = buildNaverProductPayload(base) as any
    expect(free.originProduct.deliveryInfo.deliveryFee.deliveryFeeType).toBe('FREE')
    const paid = buildNaverProductPayload({ ...base, shippingFee: 3000 }) as any
    expect(paid.originProduct.deliveryInfo.deliveryFee).toEqual({ deliveryFeeType: 'PAID', baseFee: 3000 })
    expect(paid.originProduct.deliveryInfo.claimDeliveryInfo.returnDeliveryFee).toBe(3000)
    expect(paid.originProduct.deliveryInfo.claimDeliveryInfo.exchangeDeliveryFee).toBe(6000)
  })

  it('상품명 100자 절단 (네이버 제한)', () => {
    const long = buildNaverProductPayload({ ...base, name: 'A'.repeat(150) }) as any
    expect(long.originProduct.name).toHaveLength(100)
  })

  it('A/S 정보 + 원산지 기본값(상세설명 참조) 포함', () => {
    const p = buildNaverProductPayload(base) as any
    expect(p.originProduct.detailAttribute.afterServiceInfo.afterServiceTelephoneNumber).toBe('010-1234-5678')
    expect(p.originProduct.detailAttribute.originAreaInfo.originAreaCode).toBe('04')
  })
})
