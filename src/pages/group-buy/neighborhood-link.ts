/**
 * 🏘️ 이용권 상세 → 그 동네 이용권 모음 (2026-10-19 대표 "남은 3가지도 다 해줘" ③ 동네 집중 페이지).
 *
 * 동네 페이지(`/region/서울/서초구` 등 43곳)는 이미 색인·구조화 데이터를 다 갖고 있는데,
 * **이용권 상세 300여 장에서 그 동네로 가는 길이 0개**였다(빵부스러기는 `동네딜` 로 끝난다).
 * 손님에게는 "같은 동네 다른 이용권" 이고, 검색엔진에게는 동네 허브로 들어오는 내부 링크다.
 *
 * 규율:
 *   · 주소 → 지역 판정은 페이지·집계와 **같은 함수**(`parseRegionFromAddress`).
 *   · **색인 대상인 동네만** 가리킨다(`indexable`) — 딜 1~2개짜리 thin 페이지로 사람을 보내지 않는다.
 *   · 시군구가 색인 대상이면 시군구, 아니면 시/도, 둘 다 아니면 링크 없음.
 */
import {
  parseRegionFromAddress, regionPath, regionLabel, type SidoStat, type RegionRef,
} from '@/shared/constants/region-slugs'

export interface NeighborhoodTarget { href: string; label: string; count: number }

export function pickNeighborhood(address: string | null | undefined, regions: SidoStat[]): NeighborhoodTarget | null {
  const ref = parseRegionFromAddress(address)
  if (!ref) return null
  const sido = regions.find(r => r.sido === ref.sido)
  if (!sido) return null
  if (ref.sigungu) {
    const sg = sido.sigungu.find(s => s.sigungu === ref.sigungu)
    if (sg?.indexable) {
      const r: RegionRef = { sido: ref.sido, sigungu: ref.sigungu }
      return { href: regionPath(r), label: regionLabel(r), count: sg.count }
    }
  }
  if (sido.indexable) {
    const r: RegionRef = { sido: ref.sido }
    return { href: regionPath(r), label: regionLabel(r), count: sido.count }
  }
  return null
}
