// 🧭 2026-07-06: 동네딜 어드민 지역 파라미터 헬퍼 (SSOT) — 시드 채우기(AdminDongnedealImportPage)와
//   목록 필터(DealList)가 공유. 소비자 홈 지역필터와 동일 SSOT(KOREA_REGIONS)를 1차(시/도)·2차(동네)로.
import { findRegionByKey } from '@/shared/constants/korea-regions'

/** '전주/전북' → '전주', '충남\n세종' → '충남', '서울' → '서울' */
export function cleanSido(label: string): string {
  return label.replace(/\n[\s\S]*/, '').split('/')[0].trim()
}

/** (시/도 key, 동네그룹 key) → 카카오 지오코딩·주소매칭용 검색어. 예: "서울 강남" / "서울" / "". */
export function buildRegionParam(sidoKey: string, districtKey: string): string {
  const region = findRegionByKey(sidoKey)
  if (!region) return ''
  const sido = cleanSido(region.label)
  if (districtKey) {
    const dg = region.districtGroups.find((g) => g.key === districtKey)
    if (dg && dg.keywords.length) return `${sido} ${dg.keywords[0]}`.trim()
  }
  return sido
}
