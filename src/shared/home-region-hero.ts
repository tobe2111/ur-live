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
  /** 위·경도 사각형 [남, 북, 서, 동] — 여러 개면 어느 하나에 들면 된다. **표 순서대로 먼저 맞는 것**이 이긴다(광역시를 도보다 위에). */
  boxes: Array<[number, number, number, number]>
}> = [
  { slug: 'seoul', label: '서울', version: 3, regionKeys: ['서울'], boxes: [[37.43, 37.70, 126.80, 127.18]] },
  { slug: 'busan', label: '부산', version: 3, regionKeys: ['부산'], boxes: [[35.00, 35.38, 128.85, 129.30]] },
  { slug: 'daegu', label: '대구', version: 3, regionKeys: ['대구'], boxes: [[35.75, 36.00, 128.45, 128.75]] },
  { slug: 'jeju', label: '제주', version: 3, regionKeys: ['제주'], boxes: [[33.10, 33.60, 126.10, 127.00]] },
  // 2026-11-01 추가. 인천 상자는 서울 상자(서 126.80)와 겹치지 않게 그 서쪽까지만.
  { slug: 'incheon', label: '인천', version: 2, regionKeys: ['인천'], boxes: [[37.35, 37.60, 126.35, 126.79]] },
  // 2026-11-01 대표 *"16개잖아 우리 1차 도시 필터링은. 그거 다 해야지"* — 지역 고르기 16칸 전부에 사진.
  //   '충남세종' 칸은 세종 사진(충남 사진이 오면 바꾼다).
  { slug: 'sejong', label: '세종', version: 2, regionKeys: ['충남세종'], boxes: [[36.45, 36.62, 127.20, 127.35]] },
  { slug: 'daejeon', label: '대전', version: 1, regionKeys: ['대전'], boxes: [[36.20, 36.50, 127.25, 127.55]] },
  // 지역 키 '전북'의 화면 이름이 '전주/전북'이라 전주 사진을 쓴다(좌표는 전주 시내 + 전북 대략).
  { slug: 'jeonju', label: '전주', version: 2, regionKeys: ['전북'], boxes: [[35.76, 35.90, 127.05, 127.20], [35.40, 36.10, 126.40, 127.90]] },
  // 도 단위는 대략 사각형 — 경계 근처는 이웃 도로 판정될 수 있다(광역시는 위에서 먼저 잡힌다).
  { slug: 'gyeonggi', label: '경기', version: 1, regionKeys: ['경기'], boxes: [[36.90, 38.30, 126.40, 127.85]] },
  { slug: 'gangwon', label: '강원', version: 1, regionKeys: ['강원'], boxes: [[37.00, 38.62, 127.85, 129.40]] },
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
    const h = HEROES.find(({ boxes }) => boxes.some(([s, n, w, e]) => loc.lat >= s && loc.lat <= n && loc.lng >= w && loc.lng <= e))
    return h ? toHero(h) : null
  }
  return null
}

/**
 * 🌤️ 2026-11-01 대표 *"밝은 사진들로 해서 그라데이션도 넣고 … 지금은 어둡기만 하네"* — 남색 막을 걷고 **밝게**.
 * 라이트: 사진은 그대로 밝게 두고 아래로 갈수록 흰색으로 녹아 목록과 이어진다(글자는 잉크색 그대로).
 *   왼쪽에 옅은 흰 막을 한 겹 더 깔아 로고·지역 이름이 사진 위에서도 읽힌다.
 * 다크: 같은 사진 위에 어두운 막을 얹고 아래로 다크 바탕색(`--bg`)으로 녹인다(글자는 흰색 — 테마 그대로).
 */
export const REGION_HERO_FADE_LIGHT =
  'linear-gradient(90deg,rgba(255,255,255,.72),rgba(255,255,255,.35) 30%,rgba(255,255,255,0) 58%),linear-gradient(180deg,rgba(255,255,255,.35),rgba(255,255,255,0) 28%,rgba(255,255,255,0) 52%,rgba(255,255,255,.8) 82%,white)'
export const REGION_HERO_FADE_DARK =
  'linear-gradient(180deg,rgba(17,20,28,.55),rgba(17,20,28,.35) 40%,rgba(17,20,28,.72) 75%,var(--bg))'

/**
 * 🗺️ 정규화된 시·도(`normalizeSido` — '서울'·'세종'·'충남'…) → 홈 머리와 **같은** 지역 사진.
 *   2026-11-02 대표 *"이 부분들도 같이 적용되는걸로"* — PC 홈 「어디로 갈까요?」 타일이 그 지역 이용권 사진
 *   (헬스장 광고 같은)을 쓰고 있었다. 머리와 같은 사진을 1순위로 쓴다.
 *   세종·충남은 고르기 칸이 '충남세종' 하나라 같은 사진이다.
 */
export function regionHeroForSido(sido: string | null | undefined): RegionHero | null {
  if (!sido) return null
  const key = sido === '세종' || sido === '충남' ? '충남세종' : sido
  return regionHeroFor({ regionKey: key })
}
