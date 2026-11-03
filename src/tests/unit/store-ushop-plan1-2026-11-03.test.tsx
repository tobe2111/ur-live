/**
 * 🏪 사업자 유어샵 안 1 〔2026-11-03 대표 *"이거 페이지도 너무 별로인데"* → *"안1"*〕
 * 시안: https://claude.ai/artifact/2GXzdhYgQMESkFpfeuyZkt
 *
 * 지키는 것
 *   ① 큰 '이번 주 픽' 히어로가 없다(할인율 두 번·사진 위 배지의 출처)
 *   ② 이용권은 홈과 같은 줄 카드(`GroupBuyFeedCard row` + `DEAL_ROW.grid`)
 *   ③ 가게 정보 — 위치(이용권 매장 주소 우선 → 사업장 주소) · 전화 · 길찾기. 값 없으면 구역째 없음
 *   ④ 가게 사진이 비면 마스코트 대신 이용권 대표 사진이 얼굴
 * 못 보는 것: 실제 렌더 모양 — 그려서 본다.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import StoreInfoSection, { storeAddressOf } from '@/pages/seller-public/StoreInfoSection'
import type { Seller, Product } from '@/pages/seller-public/types'

const S = (x: Partial<Seller> = {}) => ({ id: 1, name: '홍대돈까스', created_at: '', ...x }) as Seller
const P = (x: Partial<Product> = {}) => ({ id: 1, name: 'v', price: 1, category: 'meal_voucher', ...x }) as Product
const page = readFileSync('src/pages/SellerPublicPage.tsx', 'utf8')
const tab = readFileSync('src/pages/seller-public/VouchersTab.tsx', 'utf8')

describe('사업자 유어샵 안 1', () => {
  it('① 큰 히어로가 없다', () => {
    expect(page).not.toMatch(/<FeaturedCard\b/)
  })
  it('② 이용권은 홈 줄 카드·같은 격자', () => {
    expect(tab).toMatch(/<GroupBuyFeedCard[^>]*\brow\b/)
    expect(tab).toMatch(/className=\{DEAL_ROW\.grid\}/)
  })
  it('③ 위치는 이용권 매장 주소 우선, 없으면 사업장 주소', () => {
    expect(storeAddressOf({ business_address: '사업장' }, [P({ restaurant_address: ' 서울 마포구 1 ' })])).toBe('서울 마포구 1')
    expect(storeAddressOf({ business_address: '사업장' }, [P()])).toBe('사업장')
  })
  it('③ 값이 하나도 없으면 구역을 안 그린다 / 있으면 위치·전화·길찾기', () => {
    expect(render(<StoreInfoSection seller={S()} vouchers={[P()]} />).container.innerHTML).toBe('')
    const { getByText } = render(<StoreInfoSection seller={S({ phone: '02-1', business_address: '서울 마포구' })} vouchers={[]} />)
    expect(getByText('서울 마포구')).toBeTruthy()
    expect(getByText('02-1').closest('a')?.getAttribute('href')).toBe('tel:02-1')
    expect(getByText('카카오맵에서 보기').closest('a')?.getAttribute('href')).toContain('map.kakao.com/link/search/')
  })
  it('③ 가게 정보 구역이 페이지에 배선돼 있다', () => {
    expect(page).toMatch(/<StoreInfoSection seller=\{seller\} vouchers=\{vouchers\} \/>/)
  })
  it('④ 가게 얼굴 폴백 — 이용권 대표 사진', () => {
    expect(page).toMatch(/profile_image: curator\?\.profile_image \|\| seller\?\.profile_image \|\| storeFaceFrom\(products\) \|\| null/)
  })
})
