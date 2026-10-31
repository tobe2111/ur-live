/**
 * 🌆 홈 상단 지역 배경 사진 (2026-10-31 대표 시안 8 — *"지역을 선택하면 그 지역 사진, 도시별로"*).
 *
 * 고른 지역(시·도 키) 또는 현재 위치(좌표)로 도시를 정하고, 그 도시 사진이 있으면 주소를 돌려준다.
 * 사진이 없는 도시는 `null` — 종전 흰 헤더 그대로다(억지로 다른 도시 사진을 쓰지 않는다).
 *
 * 사진은 `public/assets/region-hero/{slug}-v{n}.webp`(1080×360, 장당 30~70KB). `/assets` 는 1년 캐시라
 * **사진을 바꿀 때는 파일 이름의 버전을 올린다**(덮어쓰면 이미 받은 사람은 옛 사진을 1년 본다).
 * 새 도시 추가 = 파일 하나 + 아래 표 한 줄.
 *
 * ⚠️ 좌표 판정은 **사각형 근사**다(행정 경계가 아니다). 경계 근처는 옆 도시로 판정될 수 있고, 그때 틀린 도시
 *   사진보다는 사진 없음이 낫도록 사각형을 도심 쪽으로 좁게 잡았다.
 */
export interface RegionHero { slug: string; label: string; src: string }

const HEROES: ReadonlyArray<{
  slug: string
  label: string
  version: number
  /** 고른 지역의 시·도 키(`KOREA_REGIONS.key`). */
  regionKeys: string[]
  /** 위·경도 사각형 [남, 북, 서, 동]. */
  box: [number, number, number, number]
}> = [
  { slug: 'seoul', label: '서울', version: 1, regionKeys: ['서울'], box: [37.43, 37.70, 126.80, 127.18] },
  { slug: 'busan', label: '부산', version: 1, regionKeys: ['부산'], box: [35.00, 35.38, 128.85, 129.30] },
  { slug: 'daegu', label: '대구', version: 1, regionKeys: ['대구'], box: [35.75, 36.00, 128.45, 128.75] },
  { slug: 'jeju', label: '제주', version: 1, regionKeys: ['제주'], box: [33.10, 33.60, 126.10, 127.00] },
]

const toHero = (h: (typeof HEROES)[number]): RegionHero => ({
  slug: h.slug, label: h.label, src: `/assets/region-hero/${h.slug}-v${h.version}.webp`,
})

/** 고른 지역이 우선, 없으면 좌표. 둘 다 없거나 사진이 없는 도시면 null. */
export function regionHeroFor(input: { regionKey?: string | null; loc?: { lat: number; lng: number } | null }): RegionHero | null {
  if (input.regionKey) {
    const h = HEROES.find(x => x.regionKeys.includes(input.regionKey as string))
    return h ? toHero(h) : null
  }
  const loc = input.loc
  if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)) {
    const h = HEROES.find(({ box: [s, n, w, e] }) => loc.lat >= s && loc.lat <= n && loc.lng >= w && loc.lng <= e)
    return h ? toHero(h) : null
  }
  return null
}

/** 사진 위 글자를 읽히게 하는 남색 막(대표 "배경을 조금 어둡게" — 2026-10-31 시안에서 확정한 값). */
export const REGION_HERO_SHADE =
  'linear-gradient(180deg,rgba(8,12,28,.62),rgba(8,12,28,.45) 35%,rgba(8,12,28,.55) 60%,rgba(8,12,28,.8))'
