/**
 * 🚚 2026-06-10 (도매 생애주기 감사 갭#4): 택배사명 → 배송조회 URL.
 *
 * 운송장 번호만 표시하고 끝나던 것을 1탭 조회 링크로. 매칭 실패 시 null — 호출측은 복사 동작만 유지.
 * 택배사명은 자유 입력이라 includes 기반 관대 매칭 (예: 'CJ대한통운', 'cj', '대한통운' 모두 CJ).
 */
const CARRIERS: Array<{ keys: string[]; url: (t: string) => string }> = [
  { keys: ['cj', '대한통운'], url: (t) => `https://trace.cjlogistics.com/next/tracking.html?wblNo=${t}` },
  { keys: ['롯데', 'lotte'], url: (t) => `https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo=${t}` },
  { keys: ['한진', 'hanjin'], url: (t) => `https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2=${t}` },
  { keys: ['로젠', 'logen'], url: (t) => `https://www.ilogen.com/web/personal/trace/${t}` },
  { keys: ['우체국', 'epost', '우편'], url: (t) => `https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1=${t}` },
  { keys: ['경동', 'kdexp'], url: (t) => `https://kdexp.com/service/delivery/etc/delivery.do?barcode=${t}` },
  { keys: ['대신', 'ds3211'], url: (t) => `https://www.ds3211.co.kr/freight/internalFreightSearch.ht?billno=${t}` },
  { keys: ['gs', '지에스'], url: (t) => `https://www.gspostbox.com/onlineDelivery?invoice_no=${t}` },
  { keys: ['cu', '씨유'], url: (t) => `https://www.cupost.co.kr/postbox/delivery/localResult.cupost?invoice_no=${t}` },
]

/** 택배사명 + 운송장으로 조회 URL 생성. 매칭 실패/번호 비정상 시 null. */
export function courierTrackingUrl(courier: string | null | undefined, trackingNumber: string | null | undefined): string | null {
  const num = (trackingNumber || '').replace(/[^0-9A-Za-z]/g, '')
  if (!num || num.length < 8) return null
  const name = (courier || '').toLowerCase()
  if (!name) return null
  for (const c of CARRIERS) {
    if (c.keys.some((k) => name.includes(k))) return c.url(num)
  }
  return null
}
