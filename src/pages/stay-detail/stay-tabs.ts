/**
 * 📑 숙소 상세 구역 탭 목록 (2026-11-03 숙소·예약 통일 ②) — 이용권 상세의 폰 구역 탭(`DetailSectionTabs`, C안)과
 * 같은 부품을 쓰고, 구역 id 만 숙소 것이다. 내용이 없으면 사라지는 구역(소개·위치)은 탭도 같이 뺀다
 * (2026-09-25 이용권 상세가 겪은 "눌러도 안 가는 탭" 을 되풀이하지 않게).
 */
import type { DetailSectionTab } from '../group-buy/DetailSectionTabs'

export function stayTabs(has: { intro: boolean; map: boolean }): DetailSectionTab[] {
  return [
    { id: 'stay-sec-dates', label: '객실' },
    { id: 'stay-sec-amenity', label: '시설' },
    ...(has.intro ? [{ id: 'stay-sec-intro', label: '소개' }] : []),
    { id: 'stay-sec-policy', label: '이용 안내' },
    ...(has.map ? [{ id: 'stay-sec-map', label: '위치' }] : []),
    { id: 'stay-sec-reviews', label: '후기' },
  ]
}
