/**
 * 🏨 숙소 상세(`/stays/:id`) 첫 화면의 **치수를 정하는 클래스** SSOT (2026-10-12, 대표 *"모두 다 진행해줘"*).
 *
 * 워커가 서버 첫 화면을 그리고(`worker/utils/stay-detail-ssr-body.ts`) React 가 마운트하며
 * `#root` 를 **통째로 갈아엎는다**(`createRoot` — 비-hydrate). 두 벌이 1px 이라도 어긋나면 그
 * 자리가 **튄다**. 종전 `/pass/:id` 는 inline style 을 손으로 옮겨 두고 시험으로 대조했는데,
 * 같은 상수를 import 하면 **갈릴 수가 없다**(2026-10-11 `PASS_HEAD` 가 그래서 생겼다).
 *
 * ⚠️ 여기 담는 것은 **치수를 정하는 클래스뿐**이다 — 호버·포커스 같은 상태 클래스는 쉬고 있을 때의
 *    박스를 안 바꾸므로 각자 둔다(여기에 넣으면 표가 커지면서 무엇이 치수인지 흐려진다).
 */
import { propertyTypeLabel } from './stay-property-type'
import { parseRegionFromAddress } from './constants/region-slugs'

export const STAY_HEAD = {
  /** 페이지 바탕·글자색. 루트는 이 앞에 `min-h-[100dvh]`, 뒤에 `pb-32 lg:pb-16` 을 붙인다. */
  pageBg: 'bg-warm text-gray-900 dark:text-white', // 🎨 2026-10-31 배경색 하나로(대표) → 🌙 2026-11-03 페이지 바탕(--bg). 이용권 상세가 11-02 에 카드색 → 페이지 바탕으로 옮겨 다크에서 숙소만 밝았다(대표 *"배경 색상도 지금 다르고"*). 라이트는 둘 다 흰색이라 무변화
  /** PC 중앙 정렬 셸(모바일은 아무 일도 안 한다). */
  shell: 'lg:max-w-[1200px] lg:mx-auto lg:px-8 lg:pt-5',
  /** 본문 좌우·위아래 여백 — 히어로의 음수 마진(`-mx-4 -mt-5`)이 **정확히 이 값을 되돌린다**. */
  gridPad: 'px-4 py-5',
  /** 히어로 래퍼. 📱 `-mx-4 -mt-5` 로 위 `gridPad` 를 빠져나가 풀블리드가 된다(`lg:` 되돌림까지 한 쌍). */
  heroWrap: 'relative -mx-4 -mt-5 lg:mx-0 lg:mt-0 bg-gray-100 dark:bg-[#1D1F29] lg:rounded-2xl lg:overflow-hidden lg:border lg:border-gray-100 dark:lg:border-[#2C2F35]',
  /** 제목 블록(모바일 전용 — PC 는 `DetailTitleHeader` 가 사진 **위**에 그린다). */
  titleBlock: 'mt-5 mb-5 lg:mt-0 lg:hidden',
  /** 📐 2026-11-11 가격 줄 자리 예약 — 객실 조회가 끝나기 전(처음 한 번)에 가격 줄 높이(mt-3 12 + 라벨 19.5 + 가격 36 ≈ 68px)를 잡아 둔다.
   *   라이브 rAF 추적: 머리 73 → 141px 로 커지며 '팔기' 줄·구역 탭·날짜 카드가 68px 내려갔다(CLS 0.03~0.045). */
  pricePending: 'mt-3 h-14',
  /**
   * 성급 줄. ⚠️ **값이 없어도 이 div 는 그린다** — `mb-1`(4px)이 그 자리에 남아야 한다.
   * 라이브 49건 중 별점이 있는 것은 **12건**(hotel 9 · resort 3)뿐이라, 빼먹으면 37건이 4px 튄다.
   */
  metaRow: 'mb-1 text-[13px] text-gray-500 dark:text-gray-400', // 🏨 2026-11-04 이용권 상세 머리(`PASS_HEAD.merchant`)와 같은 [유형 · 성급 · 지역] 한 줄 — 값은 `staySubLine()`(서버·화면 같은 함수)
  /** 제목(h1). 📏 2026-10-27: 폰도 24px — 이용권 상세 제목(`PASS_HEAD.h1`)과 같은 크기(대표 "통일할 건 통일"). */
  h1: 'text-[16px] leading-[1.4] font-semibold tracking-[-.02em]', // 📏 2026-11-02 이용권 상세 C안과 같이 24 → 17(숙소 제목 = 이용권 제목)
} as const

/**
 * 🏨 2026-11-04 (대표 *"왜 기존 이용권이랑 숙소 이용권이 서로 다른거야"* → *"합쳐줘"*): 제목 위 한 줄
 * `호텔 · 4성급 · 양양군` — 이용권 상세의 `passSubLine()`(`가게 · 종류 · 지역`)과 같은 자리·같은 크기.
 * 종전엔 성급만 12px 로 있었다(라이브 49건 중 37건은 빈 줄). 서버 첫 화면(`stay-detail-ssr-body`)과
 * 화면이 **같은 함수**를 쓴다 — 두 벌이면 마운트 때 그 줄이 바뀐다.
 * 지역은 **주소가 이긴다**(`stay-address.ts` 의 24% 사례) — 주소의 시군구, 없을 때만 지역 항목.
 */
export function staySubLine(d: { property_type?: string | null; star_rating?: number | null; address?: string | null; region_sido?: string | null; region_sigungu?: string | null }): string {
  const region = parseRegionFromAddress(d.address)
  const area = region ? (region.sigungu || region.sido) : ((d.region_sigungu || '').trim() || (d.region_sido || '').trim())
  return [
    d.property_type ? propertyTypeLabel(d.property_type) : '',
    Number(d.star_rating) > 0 ? `${Number(d.star_rating)}성급` : '',
    area,
  ].filter(Boolean).join(' · ')
}

/** 페이지 루트의 전체 클래스 — 화면과 서버가 같은 바탕에서 시작하게. */
export const STAY_PAGE_ROOT = `min-h-[100dvh] ${STAY_HEAD.pageBg} pb-32 lg:pb-16`
/** 본문 그리드 — 모바일은 여백만, PC 는 [본문 | 360px 예약 패널] 2열. */
export const STAY_GRID = `${STAY_HEAD.gridPad} lg:px-0 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-8 lg:items-start`

/**
 * 🧱 섹션 띠 — 📱 폰 폭 전체 흰 면 + 위 8px 회색 띠. 이용권 상세의 `PASS_CARD` 와 같은 모양
 * (2026-10-27 통일 — 숙소만 띠 안이 바탕색이라 같은 앱의 두 상세가 다른 종이처럼 보였다).
 * PC 는 띠·여백을 걷고 평면(숙소 PC 는 오른쪽 예약 패널 옆 한 열이다). 손으로 다시 적지 말고 이 상수를 쓸 것 —
 * 종전엔 같은 문자열이 일곱 곳에 사본으로 있었다.
 */
export const STAY_BAND = '-mx-4 px-4 py-6 border-t border-rule bg-warm lg:bg-transparent lg:mx-0 lg:px-0 lg:py-0 lg:border-t-0' // 🎨 2026-10-31 8px 회색 띠 → 가는 선(배경색 하나로)
