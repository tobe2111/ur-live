/**
 * 🏠 생활(`/life`) 화면의 **모양 SSOT** — 화면(`pages/life/LifePage.tsx` · `LifeHero.tsx`)과 워커 첫 화면
 * (`worker/utils/life-first-screen.ts`)이 같은 묶음·문구·클래스를 쓴다(2026-11-08 대표 *"모두 최적화"*).
 * 두 벌이면 마운트 때 첫 화면이 튄다. React·아이콘을 import 하지 않는다(워커 번들).
 */
import type { HomeServiceCategory } from './home-service-categories'

export interface LifeGroupDef { title: string; keys: readonly HomeServiceCategory[]; big?: boolean }

/** 상황별 묶음(2026-10-25 오늘의집 문법). */
export const LIFE_GROUPS: readonly LifeGroupDef[] = [
  { title: '가게 문 열 때', keys: ['signage', 'store_interior'], big: true },
  { title: '가게 운영 중이라면', keys: ['store_pest', 'kitchen_hood', 'store_repair', 'store_fridge', 'store_aircon', 'store_clean', 'store_drain'] },
  { title: '숙소 운영 중이라면', keys: ['lodging_clean', 'lodging_pool'] },
  { title: '이사·집 일이 생기면', keys: ['move', 'move_in_clean', 'aircon_clean', 'home_interior', 'home_grout', 'home_pest'] },
]

/** 큰 줄의 한 줄 부제(오늘의집 "오늘의집이 시공하자, A/S 보장" 자리). */
export const LIFE_BIG_SUB: Partial<Record<HomeServiceCategory, string>> = {
  signage: '새 간판·교체·LED 수리까지 견적 비교',
  store_interior: '오픈·리뉴얼 공사, 근처 업체 견적 비교',
}

/** 아이콘 줄 한 줄 최대 칸 — 넘치면 4개 + 자세히. */
export const LIFE_ICON_ROW_MAX = 5

/** 타일 짧은 이름(줄바꿈 `\n` 포함 — 두 줄 타일은 높이가 다르다). 그림은 `pages/life/life-tiles.tsx`. */
export const LIFE_TILE_LABEL: Record<HomeServiceCategory, string> = {
  signage: '간판',
  store_interior: '인테리어',
  store_pest: '방역·소독',
  kitchen_hood: '후드·덕트\n청소',
  store_repair: '시설 수리',
  store_fridge: '냉장·냉동\n설비',
  store_aircon: '에어컨\n청소·수리',
  store_clean: '매장 청소',
  store_drain: '배수구\n정화조',
  lodging_clean: '객실 청소\n침구',
  lodging_pool: '수영장\n온수 설비',
  move: '이사',
  move_in_clean: '입주청소',
  aircon_clean: '에어컨 청소',
  home_interior: '인테리어',
  home_grout: '줄눈·탄성',
  home_pest: '해충 방역',
}

export const LIFE_COPY = {
  eyebrow: '사장님 생활 견적 서비스',
  myRequests: '내 견적 요청',
  title1: '사장님, 가게 일은',
  title2: ' 여기서 맡기세요',
  sub: '간판·방역·설비 수리까지, 근처 업체 견적을 무료로 비교해요.',
  cta: '무료로 견적 받기',
  more: '자세히',
} as const

/** 클래스 — 화면과 글자 하나까지 같다(시험이 대조). */
export const LIFE_CLS = {
  page: 'min-h-[100dvh] bg-warm text-ink pb-safe-nav',
  wrap: 'mx-auto w-full max-w-[720px] space-y-3 px-5 pb-10 pt-5 lg:max-w-[1120px] lg:px-8 lg:pt-8',
  hero: 'pt-1 pb-2',
  heroTop: 'flex items-center justify-between gap-3',
  eyebrow: 'text-[13px] font-medium text-brand-text',
  myLink: 'flex shrink-0 items-center text-[13px] font-medium text-ink active:opacity-70',
  h1: 'mt-2 text-[20px] font-semibold leading-snug tracking-tight lg:text-[34px]',
  sub: 'mt-2 text-[15px] leading-relaxed text-gray-600 dark:text-gray-300',
  cta: 'ur-btn ur-btn-lg ur-btn-primary mt-5 flex w-full justify-center disabled:opacity-50 lg:w-auto lg:px-10',
  cols: 'space-y-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start lg:gap-5 lg:space-y-0',
  left: 'space-y-3',
  card: 'rounded-2xl py-5',
  cardTitle: 'text-[16px] font-semibold',
  bigList: 'mt-2 divide-y divide-rule',
  bigLink: 'flex items-center gap-3 py-3 active:opacity-70',
  bigText: 'min-w-0 flex-1',
  bigLabel: 'block text-[15px] font-bold',
  bigSub: 'mt-1 block truncate text-[13px] text-gray-500 dark:text-gray-400',
  iconGrid: 'mt-5 grid grid-cols-5 gap-x-1 gap-y-5',
  tileLi: 'ur-life-tile',
  tile: 'flex flex-col items-center gap-2 active:opacity-70',
  tileIc: 'ur-life-ic flex h-12 w-12 items-center justify-center',
  tileLabel: 'whitespace-pre-line text-center text-[13px] leading-tight',
  moreIc: 'flex h-12 w-12 items-center justify-center rounded-full bg-warm',
  moreLabel: 'text-center text-[13px] leading-tight',
} as const
