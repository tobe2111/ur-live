/**
 * 🏨 숙소 목록(`/stays`) 첫 화면 SSOT (2026-10-19 대표 *"모두 개선해줘"*).
 *
 * 라이브 실측(폰 · 느린 4G · CPU 4배): `/stays` 는 서버 첫 화면이 없어 **약 3초간 로딩 그림만** 보였고
 * 사진은 3.2초에야 출발했다(LCP 3.0~5.2초 — 홈·교환권·상세는 1~2초). 데이터는 HTML 직후 미리 받고 있었지만
 * (`shared/stays-early.ts`) 그릴 React 가 늦었다. 워커가 첫 화면을 그리면 사진이 HTML 직후 출발한다.
 *
 * 이 파일은 **화면(`StaysSearchPage`·`StayCurations`)과 워커(`worker/utils/stays-first-screen.ts`)가
 * 같이 import** 한다 — 치수를 정하는 클래스와 큐레이션 규칙이 두 벌이면 마운트 때 그 차이만큼 튄다
 * (`STAY_HEAD`·`PASS_HEAD` 와 같은 처방). React·라우터·아이콘을 import 하지 않는다(워커 번들).
 */

/** 검색 결과 한 줄(서버 `/api/group-buy/stays/search` 응답 원소의 부분집합). */
export interface StaySearchItem {
  id: number
  name: string
  image_url?: string
  property_type?: string
  star_rating?: number | null
  region_sido?: string
  region_sigungu?: string
  /** 📍 카드 지역 표기의 진실은 이쪽이다 — 라이브 50건 중 12건은 `region_*` 과 주소가 다르다(`shared/stay-address.ts`). */
  address?: string | null
  amenities?: string | null
  price_from?: number | null
  max_guests?: number | null
  avg_rating?: number | null
  review_count?: number
  /** 카드 대표색 — 서버가 이미 아는 값. 비어 있을 때만 카드가 뽑아 보고한다. */
  dominant_color?: string | null
}

/** 🔒 치수를 정하는 클래스 — 화면과 워커가 같은 상수를 쓴다(상태 클래스는 각자). */
const ROOT_BG = 'bg-white dark:bg-[#11141C] text-gray-900 dark:text-white'
export const STAYS_LIST = {
  /** 바탕·글자색 — 서버 첫 화면은 이것만(높이 100dvh 를 걸면 아래 로더가 화면 밖으로 밀린다). */
  rootBg: ROOT_BG,
  root: `min-h-[100dvh] ${ROOT_BG} pb-safe-nav`,
  bar: 'sticky top-0 z-30 bg-white/95 dark:bg-[#11141C]/95 backdrop-blur-md border-b border-gray-100 dark:border-[#2C2F35]',
  titleRow: 'ur-content-wide px-4 lg:px-8 py-3 flex items-center gap-3',
  back: 'text-[15px] font-bold',
  h1: 'text-[15px] font-bold flex-1 flex items-center gap-2',
  filterBtn: 'p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/[0.06]',
  chipRow: 'ur-content-wide px-4 lg:px-8 pb-2 flex gap-2 overflow-x-auto scrollbar-hide',
  chip: 'shrink-0 flex items-center gap-1 px-4 py-2 rounded-full text-[12px] font-medium whitespace-nowrap transition-all',
  chipOn: 'bg-brand text-white',
  chipOff: 'bg-white dark:bg-[#1D1F29] text-brand-text shadow-lift',
  quickRow: 'ur-content-wide px-4 lg:px-8 pb-3 flex gap-2 overflow-x-auto scrollbar-hide',
  quick: 'flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-white/[0.06] rounded-full text-[12px] whitespace-nowrap',
  results: 'ur-content-wide px-4 lg:px-8 py-4',
  curations: 'space-y-8 pb-2',
  rowTitle: 'text-[17px] sm:text-[17px] font-bold tracking-tight text-gray-900 dark:text-white px-1',
  row: 'mt-3 flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory -mx-4 px-4 lg:mx-0 lg:px-0',
  cell: 'shrink-0 snap-start w-[68%] sm:w-[42%] lg:w-[28%] xl:w-[23%]',
} as const

/**
 * 상단 카테고리 칩 글자 — 화면은 `MAP_VOUCHER_DEFS`(아이콘 포함이라 워커가 못 읽는다)의 한국어 값을 그린다.
 * 시험이 그 표·한국어 번역과 대조한다(두 벌이 갈리면 칩 폭이 달라진다).
 */
export const STAYS_CHIPS: ReadonlyArray<{ key: string; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'meal_voucher', label: '식사' },
  { key: 'beauty_voucher', label: '뷰티·헬스' },
  { key: 'stay_voucher', label: '숙소' },
  { key: 'home_voucher', label: '생활' },
  { key: 'etc_voucher', label: '기타' },
]

/** 아이콘 자리 크기(px) — 서버는 아이콘(SVG)을 안 그리고 **같은 크기의 빈 칸**만 세운다(두 벌 금지). */
export const STAYS_ICON = { title: 17, chip: 15, quick: 12, filter: 16 } as const

/** 카드 상세 링크 — 날짜·인원을 반드시 이어 보낸다(빠지면 상세가 오늘 날짜로 다시 잡아 요금이 달라진다). */
export function stayCardHref(id: number | string, checkIn: string, checkOut: string, guests: number): string {
  return `/stays/${id}?check_in=${checkIn}&check_out=${checkOut}&guests=${guests}`
}

/** 빠른 필터 날짜 칩 글자 — `MM-DD - MM-DD (N박)`. */
export function stayDateChipLabel(checkIn: string, checkOut: string): string {
  const nights = Math.max(1, Math.round((new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 86400000))
  return `${checkIn.slice(5)} - ${checkOut.slice(5)} (${nights}박)`
}

const MIN_PER_ROW = 3
const MAX_PER_ROW = 10

export interface StayCurationRow {
  key: string
  title: string
  items: StaySearchItem[]
}

/**
 * 🏨 2026-09-24 (대표 문서 ④) 큐레이션 줄 — 가격·지역·평점으로 묶고, 3개 미만 줄은 내지 않는다
 * (한두 장짜리 줄은 "큐레이션" 이 아니라 빈자리다).
 */
export function buildStayCurations(items: StaySearchItem[]): StayCurationRow[] {
  const rows: StayCurationRow[] = [
    { key: 'under-100k', title: '10만원 아래로 떠나는 하룻밤', items: items.filter(s => (s.price_from ?? 0) > 0 && (s.price_from as number) < 100000) },
    { key: 'gangwon', title: '강원, 바다와 산 사이', items: items.filter(s => s.region_sido === '강원') },
    { key: 'city', title: '도심에서 묵기 — 서울·부산', items: items.filter(s => s.region_sido === '서울' || s.region_sido === '부산') },
    { key: 'rated', title: '다녀온 사람들이 별을 많이 준 곳', items: items.filter(s => (s.review_count ?? 0) > 0 && (s.avg_rating ?? 0) >= 4.5) },
  ]
  return rows
    .map(r => ({ ...r, items: r.items.slice(0, MAX_PER_ROW) }))
    .filter(r => r.items.length >= MIN_PER_ROW)
}
