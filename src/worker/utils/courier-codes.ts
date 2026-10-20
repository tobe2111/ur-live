/**
 * 🛡️ 2026-05-25 (migration 0279): 한국 택배사 코드 SSOT.
 *
 * 사용자 입력 (다양한 표기) → tracker.delivery 표준 코드 + 외부 페이지 URL 양쪽 매핑.
 * 변경 시 본 파일만 수정 → 전체 시스템 자동 반영.
 *
 * tracker.delivery carrier ID 참조: https://tracker.delivery
 */

export interface CourierInfo {
  /** 한글 정식 명칭 */
  name: string
  /** tracker.delivery GraphQL carrier ID */
  trackerCode: string
  /** 외부 추적 페이지 URL template — `{number}` 가 송장번호로 치환 */
  externalUrl: string
  /** 사용자 입력 alias (정규화 매핑용). lowercase. */
  aliases: string[]
}

/**
 * 한국 주요 택배사 매트릭스.
 * 정렬: 점유율 / 사용 빈도 순.
 */
export const COURIERS: Record<string, CourierInfo> = {
  cj: {
    name: 'CJ대한통운',
    trackerCode: 'kr.cjlogistics',
    externalUrl: 'https://trace.cjlogistics.com/web/detail.jsp?slipno={number}',
    aliases: ['cj', 'cjlogistics', 'cj대한통운', 'cj 대한통운', '대한통운', 'cj logistics'],
  },
  hanjin: {
    name: '한진택배',
    trackerCode: 'kr.hanjin',
    externalUrl: 'https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&wblnumText2={number}',
    aliases: ['hanjin', '한진', '한진택배'],
  },
  lotte: {
    name: '롯데택배',
    trackerCode: 'kr.lotte',
    externalUrl: 'https://www.lotteglogis.com/home/reservation/tracking/index?InvNo={number}',
    aliases: ['lotte', '롯데', '롯데택배', '롯데글로벌로지스', 'lotteglogis'],
  },
  kr_post: {
    name: '우체국택배',
    trackerCode: 'kr.epost',
    externalUrl: 'https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1={number}',
    aliases: ['epost', 'kr_post', 'krpost', '우체국', '우체국택배', '우편'],
  },
  logen: {
    name: '로젠택배',
    trackerCode: 'kr.logen',
    externalUrl: 'https://www.ilogen.com/web/personal/trace/{number}',
    aliases: ['logen', '로젠', '로젠택배'],
  },
  cu: {
    name: 'CU편의점택배',
    trackerCode: 'kr.cupost',
    externalUrl: 'https://www.cupost.co.kr/postbox/delivery/localResult.cupost?invoice_no={number}',
    aliases: ['cu', 'cupost', 'cu편의점택배', 'cu택배'],
  },
  gs: {
    name: 'GS편의점택배',
    trackerCode: 'kr.gspostbox',
    externalUrl: 'https://www.cvsnet.co.kr/invoice/tracking.do?invoice_no={number}',
    aliases: ['gs', 'gspostbox', 'gs편의점택배', 'gs택배', 'gs25', 'cvsnet'],
  },
  daesin: {
    name: '대신택배',
    trackerCode: 'kr.daesin',
    externalUrl: 'https://www.ds3211.co.kr/freight/internalFreightSearch.ht?billno={number}',
    aliases: ['daesin', '대신', '대신택배'],
  },
  ilyang: {
    name: '일양로지스',
    trackerCode: 'kr.ilyanglogis',
    externalUrl: 'https://www.ilyanglogis.com/functionality/transit_html.asp?hawb_no={number}',
    aliases: ['ilyang', '일양', '일양로지스', '일양택배'],
  },
  kdexp: {
    name: '경동택배',
    trackerCode: 'kr.kdexp',
    externalUrl: 'https://kdexp.com/service/delivery/etc/inquiry/cargoTrack.kd?barcode={number}',
    aliases: ['kdexp', '경동', '경동택배'],
  },
  chunilps: {
    name: '천일택배',
    trackerCode: 'kr.chunilps',
    externalUrl: 'https://www.chunil.co.kr/HTrace/HTrace.jsp?transNo={number}',
    aliases: ['chunilps', '천일', '천일택배'],
  },
  cway: {
    name: 'CWAY (씨웨이)',
    trackerCode: 'kr.cway',
    externalUrl: 'https://www.cwayexpress.com/page/tracking/?bdId={number}',
    aliases: ['cway', 'cwayexpress', '씨웨이'],
  },
}

/**
 * 사용자 입력 (다양한 표기) → 표준 키 ('cj', 'hanjin', ...) 정규화.
 * 매칭 실패 시 null.
 */
export function normalizeCourierKey(input: string | null | undefined): string | null {
  if (!input) return null
  const raw = String(input).toLowerCase().trim().replace(/[\s_-]+/g, '')
  for (const [key, info] of Object.entries(COURIERS)) {
    const keyNorm = key.toLowerCase().replace(/[\s_-]+/g, '')
    if (keyNorm === raw) return key
    for (const alias of info.aliases) {
      const aliasNorm = alias.toLowerCase().replace(/[\s_-]+/g, '')
      if (aliasNorm === raw) return key
    }
  }
  return null
}

/**
 * 표준 키 → tracker.delivery carrier ID.
 */
export function getTrackerCode(courierKey: string | null | undefined): string | null {
  if (!courierKey) return null
  return COURIERS[courierKey]?.trackerCode ?? null
}

/**
 * 표준 키 + 송장번호 → 외부 추적 페이지 URL.
 */
export function getExternalTrackingUrl(courierKey: string | null | undefined, trackingNumber: string): string | null {
  if (!courierKey || !trackingNumber) return null
  const info = COURIERS[courierKey]
  if (!info) return null
  return info.externalUrl.replace('{number}', encodeURIComponent(trackingNumber.replace(/\s+/g, '')))
}

/**
 * 클라이언트 표시용 — 한글 정식 명칭.
 */
export function getCourierDisplayName(courierKey: string | null | undefined): string {
  if (!courierKey) return '택배사 미지정'
  return COURIERS[courierKey]?.name ?? courierKey
}

/**
 * 클라이언트가 사용 가능한 택배사 옵션 목록.
 */
export function listCourierOptions(): Array<{ key: string; name: string }> {
  return Object.entries(COURIERS).map(([key, info]) => ({ key, name: info.name }))
}
