/**
 * 🏪 사업자 유어샵 '가게 정보' 구역 — 2026-11-03 대표 확정 **안 1**
 *   (시안 https://claude.ai/artifact/2GXzdhYgQMESkFpfeuyZkt · 대표 *"이거 페이지도 너무 별로인데"* → *"안1"*).
 *
 * 가게 유어샵인데 손님이 제일 먼저 찾는 **어디 있는 가게인가**가 화면에 한 줄도 없었다.
 * 맨 아래 접힌 '사업자 정보 더보기'(법적 고지)는 그 일을 못 한다.
 *
 * - 값이 있는 줄만 그린다. 둘 다 없으면 구역 자체를 안 그린다(빈 제목 금지).
 * - 위치는 이용권의 매장 주소가 먼저(손님이 갈 곳) · 없으면 사업장 주소.
 * - 영업시간은 저장 칸이 없어 **안 그린다**(지어내지 않는다).
 * - 카카오맵 길찾기는 외부 링크(SDK 를 이 화면에 싣지 않는다 — 첫 화면 무게).
 */
import { SectionTitle } from '@/pages/user-profile/list-grammar'
import type { Product, Seller } from './types'

export function storeAddressOf(seller: Pick<Seller, 'business_address'>, vouchers: Pick<Product, 'restaurant_address'>[]): string {
  const fromVoucher = vouchers.map((v) => (v.restaurant_address || '').trim()).find(Boolean)
  return fromVoucher || (seller.business_address || '').trim()
}

const ROW = 'flex items-center gap-4 min-h-[48px] py-3 border-b border-rule last:border-b-0'
const LABEL = 'shrink-0 text-[15px] text-gray-900 dark:text-white'
const VALUE = 'ml-auto min-w-0 text-right text-[13px] text-gray-500 dark:text-gray-400'

export default function StoreInfoSection({ seller, vouchers }: { seller: Seller; vouchers: Product[] }) {
  const address = storeAddressOf(seller, vouchers)
  const phone = (seller.phone || '').trim()
  if (!address && !phone) return null
  return (
    <section aria-label="가게 정보" data-testid="store-info">
      <SectionTitle>가게 정보</SectionTitle>
      <div>
        {address && (
          <div className={ROW}>
            <span className={LABEL}>위치</span>
            <span className={VALUE}>{address}</span>
          </div>
        )}
        {phone && (
          <a href={`tel:${phone}`} className={ROW}>
            <span className={LABEL}>전화</span>
            <span className={`${VALUE} text-brand-text`}>{phone}</span>
          </a>
        )}
        {address && (
          <a
            href={`https://map.kakao.com/link/search/${encodeURIComponent(address)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={ROW}
          >
            <span className={LABEL}>길찾기</span>
            <span className={`${VALUE} text-brand-text`}>카카오맵에서 보기</span>
          </a>
        )}
      </div>
    </section>
  )
}
