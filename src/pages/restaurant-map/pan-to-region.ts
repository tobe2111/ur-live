/**
 * 🗺️ 2026-07-15 (대표 — 홈=지도 + "필터로 위치 설정하면 그거에 맞게 지도가 최대한 정확하게"):
 *   지역/세부지역 선택 시 지도를 그 위치로 **최대한 정확히** 이동. 우선순위:
 *     1. 선택 필터에 매칭되는 딜 핀(좌표 보유)들 → 그 핀들 bounds 로 fit — 실제 딜 위치라 가장 정확.
 *     2. 핀 없음 → Kakao Geocoder/Places(services 라이브러리)로 지명 지오코딩 → 이동.
 *     3. 지오코더 실패/미지원 → 17개 시/도 대표 중심 좌표표 폴백(REGIONS 9개 → 전 시/도 커버).
 *   services 라이브러리는 kakao-sdk 가 `libraries=services` 로 이미 로드(Geocoder + Places 포함).
 */
import { findRegionByKey, findDistrictGroup } from '@/shared/constants/korea-regions'

type LL = { lat: number; lng: number }

// 17개 시/도 대표 중심 + 카카오 줌 레벨. constants.ts 의 REGIONS(9개)에 없던 시/도까지 폴백 커버.
export const PROVINCE_CENTERS: Record<string, { lat: number; lng: number; level: number }> = {
  서울: { lat: 37.5665, lng: 126.978, level: 8 },
  경기: { lat: 37.4138, lng: 127.5183, level: 10 },
  인천: { lat: 37.4563, lng: 126.7052, level: 9 },
  강원: { lat: 37.8228, lng: 128.1555, level: 11 },
  충북: { lat: 36.6357, lng: 127.4917, level: 10 },
  충남세종: { lat: 36.5184, lng: 126.8, level: 10 },
  대전: { lat: 36.3504, lng: 127.3845, level: 8 },
  부산: { lat: 35.1796, lng: 129.0756, level: 8 },
  울산: { lat: 35.5384, lng: 129.3114, level: 9 },
  경남: { lat: 35.2383, lng: 128.6924, level: 11 },
  대구: { lat: 35.8714, lng: 128.6014, level: 8 },
  경북: { lat: 36.2486, lng: 128.6647, level: 11 },
  광주: { lat: 35.1595, lng: 126.8526, level: 8 },
  전남: { lat: 34.8161, lng: 126.4629, level: 11 },
  전북: { lat: 35.7175, lng: 127.153, level: 10 },
  제주: { lat: 33.489, lng: 126.4983, level: 9 },
}

// 지오코더 질의어: 시/도 + 세부지역 대표 지명. '충남세종'/'전북' 은 지오코딩 잘 되는 표기로 정규화.
function geocoderQuery(regionKey: string, districtKey: string): string {
  const regionName =
    regionKey === '충남세종' ? '충청남도' : regionKey === '전북' ? '전라북도' : regionKey
  if (districtKey) {
    const dg = findDistrictGroup(regionKey, districtKey)
    const primary = dg?.keywords?.[0] || dg?.label?.split('/')[0] || ''
    return `${regionKey} ${primary}`.trim()
  }
  // region-only: findRegionByKey 존재 확인(택소노미 정합) 후 정규화 지명 반환.
  return findRegionByKey(regionKey) ? regionName : regionKey
}

/** Kakao services(Places 우선 → Geocoder 폴백)로 지명 → 좌표. 미지원/실패 시 null. */
function geocode(query: string): Promise<LL | null> {
  return new Promise((resolve) => {
    try {
      const kakao = (window as unknown as { kakao?: any }).kakao
      const svc = kakao?.maps?.services
      if (!svc || !query) { resolve(null); return }
      const pick = (arr: any[]): LL | null => {
        const hit = arr?.[0]
        if (!hit) return null
        const lat = Number(hit.y), lng = Number(hit.x)
        return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null
      }
      const tryGeocoder = () => {
        if (!svc.Geocoder) { resolve(null); return }
        new svc.Geocoder().addressSearch(query, (r: any[], s: string) =>
          resolve(s === svc.Status.OK ? pick(r) : null),
        )
      }
      if (svc.Places) {
        new svc.Places().keywordSearch(query, (r: any[], s: string) => {
          const ll = s === svc.Status.OK ? pick(r) : null
          if (ll) resolve(ll)
          else tryGeocoder() // 지명 검색 실패 → 주소 검색 폴백
        })
      } else tryGeocoder()
    } catch {
      resolve(null)
    }
  })
}

/** 핀들이 다 보이도록 지도를 맞춘다. 핀이 하나면 그 자리로 동네 줌. */
export function fitToPins(map: any, pins: LL[], singleLevel = 5): boolean {
  const kakao = (window as unknown as { kakao?: any }).kakao
  const coords = (pins || []).filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
  if (!map || !kakao?.maps || coords.length === 0) return false
  if (coords.length === 1) {
    map.setCenter(new kakao.maps.LatLng(coords[0].lat, coords[0].lng))
    map.setLevel(singleLevel)
    return true
  }
  const b = new kakao.maps.LatLngBounds()
  for (const p of coords) b.extend(new kakao.maps.LatLng(p.lat, p.lng))
  map.setBounds(b)
  return true
}

/**
 * 🔴 2026-09-03 (대표 신고 — **"검색을 했을 때 무관한 지도 위치가 떠. 심각한 문제야"**)
 *
 *   실측: `커트` 를 치면 결과 딜 2건은 **동탄**인데 지도는 **인천 부평**으로 갔다. 원인은
 *   `panToPlaceQuery` 가 검색어를 **무조건 지명으로 지오코딩**했기 때문이다 — 카카오 장소검색이
 *   "커트"에 걸리는 아무 상호나 하나 물어다 주고, 지도는 거기로 날아간다. 그러면 화면 왼쪽 목록과
 *   오른쪽 지도가 **서로 다른 도시**를 가리킨다.
 *
 *   ⚠️ 이 파일 안에 이미 올바른 규칙이 있었다 — `panToRegionAccurate` 는 **딜 핀 먼저, 지오코딩은
 *   폴백**이다(그게 "가장 정확"하다고 주석이 말한다). 검색 경로만 그 1단계를 건너뛰고 있었다.
 *   ⇒ 지도는 **검색 결과를 따라간다.** 결과가 하나도 없을 때만 지명으로 해석한다
 *     (그때는 "부산" 같은 지역어일 가능성이 높고, 어차피 보여 줄 딜이 없다).
 */
export async function panToSearchResults(map: any, query: string, pins: LL[]): Promise<boolean> {
  if (fitToPins(map, pins)) return true
  return panToPlaceQuery(map, query)
}

/**
 * 🔎 2026-07-20 (대표 — "지도에서 검색하면 지도에서 계속 나와야"): 자유 검색어(예 "부산", "해운대",
 *   "강남역")를 지오코딩해 지도를 그 위치로 이동. 지역/장소명이면 이동, 매칭 실패 시 no-op(딜 텍스트 필터만).
 *   ⚠️ **직접 부르지 말 것** — 검색 경로는 `panToSearchResults`(결과 우선)를 쓴다. 이 함수는 그 폴백이다.
 *   @returns 이동했으면 true(지역/장소로 해석됨), 실패 시 false.
 */
export async function panToPlaceQuery(map: any, query: string): Promise<boolean> {
  const kakao = (window as unknown as { kakao?: any }).kakao
  const q = (query || '').trim()
  if (!map || !kakao?.maps || q.length < 2) return false
  // 시/도 표기 정규화(부산→부산, 전북→전라북도 등)만 가볍게 — 그 외는 원문 지오코딩.
  const norm = q === '전북' ? '전라북도' : q === '충남' ? '충청남도' : q === '경남' ? '경상남도'
    : q === '경북' ? '경상북도' : q === '전남' ? '전라남도' : q === '충북' ? '충청북도' : q
  const geo = await geocode(norm)
  if (!geo) return false
  map.setCenter(new kakao.maps.LatLng(geo.lat, geo.lng))
  // 시/도 단독이면 넓게, 그 외(구/동/역/장소)면 동네 줌.
  const isProvince = /^(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충청|전라|경상|제주)/.test(norm) && norm.length <= 5
  map.setLevel(isProvince ? (PROVINCE_CENTERS[q]?.level ?? 8) : 5)
  return true
}

/**
 * 지도(map)를 regionKey/districtKey 위치로 정확히 이동.
 * @param pins 이 필터에 매칭되는 딜(좌표 보유). 있으면 그 bounds 에 fit(가장 정확).
 */
export async function panToRegionAccurate(
  map: any,
  regionKey: string,
  districtKey: string,
  pins: LL[],
): Promise<void> {
  const kakao = (window as unknown as { kakao?: any }).kakao
  if (!map || !kakao?.maps || !regionKey) return

  // 1) 매칭 딜 핀에 fit — 실제 딜 위치라 가장 정확. (검색 경로도 같은 헬퍼를 쓴다.)
  if (fitToPins(map, pins, districtKey ? 5 : 7)) return

  // 2) 딜 없음 → 지오코딩으로 지명 중심 이동.
  const geo = await geocode(geocoderQuery(regionKey, districtKey))
  if (geo) {
    map.setCenter(new kakao.maps.LatLng(geo.lat, geo.lng))
    map.setLevel(districtKey ? 5 : (PROVINCE_CENTERS[regionKey]?.level ?? 8))
    return
  }

  // 3) 폴백 — 시/도 대표 중심.
  const c = PROVINCE_CENTERS[regionKey]
  if (c) {
    map.setCenter(new kakao.maps.LatLng(c.lat, c.lng))
    map.setLevel(c.level)
  }
}
