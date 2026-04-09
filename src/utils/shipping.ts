// 배송 관련 상수 및 유틸리티
export const SHIPPING = {
  DEFAULT_FEE: 3000,
  FREE_THRESHOLD: 50000,
  COURIERS: {
    'CJ대한통운': 'https://www.cjlogistics.com/ko/tool/parcel/tracking',
    '한진택배': 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do',
    '로젠택배': 'https://www.ilogen.com/web/personal/trace',
    '우체국택배': 'https://service.epost.go.kr/trace.RetrieveDomRi498.postal',
    '롯데택배': 'https://www.lotteglogis.com/home/reservation/tracking/index',
  } as Record<string, string>,
} as const

// shipping_address 파싱 (JSON 객체 or 문자열 모두 지원)
export function parseShippingAddress(
  address: unknown,
  postalCode?: string,
  detail?: string
): { postal_code: string; address1: string; address2: string } {
  if (typeof address === 'object' && address !== null) {
    const a = address as Record<string, string>
    return {
      postal_code: a.postal_code || postalCode || '',
      address1: a.address1 || a.address || '',
      address2: a.address2 || a.address_detail || detail || '',
    }
  }
  return {
    postal_code: postalCode || '',
    address1: String(address || ''),
    address2: detail || '',
  }
}
