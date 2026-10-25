/**
 * 🏠 생활 서비스 타일 — 카테고리마다 짧은 이름 + 채색 일러스트 (2026-10-25 대표 "A안이 낫다").
 *
 * 그림 규칙은 `components/icons/category-icons.tsx` 와 같다: 32 그리드 · 윤곽선 없음 ·
 * 팔레트(`shared/category-palette.ts`)에서 한 색 + 그 어두운 단계 하나. 새 색을 만들지 않는다.
 * 카테고리가 늘면 여기에도 한 줄 — 시험이 빠진 카테고리를 잡는다.
 */
import type { ReactElement } from 'react'
import { CATEGORY_PALETTE, type CategoryHue } from '@/shared/category-palette'
import type { HomeServiceCategory } from '@/shared/home-service'

type Draw = (c: { main: string; dark: string }) => ReactElement

const W = 'white'

const sign: Draw = (c) => (<>
  <rect x="4" y="5" width="24" height="15" rx="2.5" fill={c.main} />
  <rect x="7.5" y="9" width="17" height="3" rx="1.2" fill={W} opacity=".9" />
  <rect x="7.5" y="14" width="10" height="2.5" rx="1.2" fill={W} opacity=".6" />
  <rect x="8" y="20" width="2.6" height="8" rx="1" fill={c.dark} />
  <rect x="21.4" y="20" width="2.6" height="8" rx="1" fill={c.dark} />
</>)

const roller: Draw = (c) => (<>
  <rect x="4" y="4" width="20" height="9" rx="2.5" fill={c.main} />
  <rect x="4" y="10" width="20" height="3" rx="1.5" fill={c.dark} opacity=".55" />
  <path d="M24 8.5h3.2v7.5H16v3.5" stroke={c.dark} strokeWidth="2.4" strokeLinejoin="round" fill="none" />
  <rect x="14" y="18.5" width="4" height="10" rx="1.6" fill={c.dark} />
</>)

const spray: Draw = (c) => (<>
  <path d="M10.5 13h9a2.5 2.5 0 0 1 2.5 2.5V26a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 8 26V15.5a2.5 2.5 0 0 1 2.5-2.5z" fill={c.main} />
  <rect x="12" y="8.5" width="6" height="4.5" fill={c.dark} />
  <path d="M10.5 4.5h9.5l3 3.5H10.5z" fill={c.dark} />
  <rect x="10.5" y="17" width="9" height="6" rx="1.2" fill={W} opacity=".85" />
  <circle cx="26" cy="5" r="1.3" fill={c.main} /><circle cx="28.3" cy="8.2" r="1.3" fill={c.main} /><circle cx="26" cy="11" r="1.3" fill={c.main} />
</>)

const hood: Draw = (c) => (<>
  <path d="M12.5 3.5h7v7.5l8.5 7H4l8.5-7z" fill={c.main} />
  <rect x="3.5" y="17.5" width="25" height="3.5" rx="1.5" fill={c.dark} />
  <path d="M10 25c1-1 1-2 0-3M16 26c1-1 1-2.5 0-4M22 25c1-1 1-2 0-3" stroke={c.main} strokeWidth="1.8" strokeLinecap="round" fill="none" />
</>)

const wrench: Draw = (c) => (<>
  <path d="M20.6 4.2a6.4 6.4 0 0 0-7.3 8.6L4.6 21.5a3 3 0 0 0 4.2 4.2l8.7-8.7a6.4 6.4 0 0 0 8.6-7.3l-3.8 3.8-3.6-1-1-3.6z" fill={c.main} />
  <circle cx="6.8" cy="23.5" r="1.4" fill={c.dark} />
</>)

const fridge: Draw = (c) => (<>
  <rect x="8" y="3" width="16" height="26" rx="2.8" fill={c.main} />
  <rect x="8" y="12" width="16" height="1.8" fill={c.dark} />
  <rect x="10.6" y="6" width="2" height="4" rx="1" fill={W} opacity=".9" />
  <rect x="10.6" y="16" width="2" height="6.5" rx="1" fill={W} opacity=".9" />
  <rect x="8" y="26" width="16" height="3" rx="1.4" fill={c.dark} />
</>)

const aircon: Draw = (c) => (<>
  <rect x="3" y="6" width="26" height="12" rx="3.2" fill={c.main} />
  <rect x="6" y="13.5" width="20" height="2" rx="1" fill={c.dark} />
  <circle cx="24.5" cy="9.5" r="1.2" fill={W} opacity=".9" />
  <path d="M9.5 21.5c0 2-1.5 3-1.5 5M16 21.5v5M22.5 21.5c0 2 1.5 3 1.5 5" stroke={c.main} strokeWidth="1.9" strokeLinecap="round" fill="none" />
</>)

const bucket: Draw = (c) => (<>
  <path d="M7 13h18l-2.1 13.6a2.4 2.4 0 0 1-2.4 2H11.5a2.4 2.4 0 0 1-2.4-2z" fill={c.main} />
  <rect x="5" y="10.5" width="22" height="3.6" rx="1.6" fill={c.dark} />
  <circle cx="11" cy="7" r="2.4" fill={c.main} opacity=".7" /><circle cx="17" cy="5" r="3" fill={c.main} opacity=".7" /><circle cx="22.5" cy="7.5" r="1.9" fill={c.main} opacity=".7" />
</>)

const drain: Draw = (c) => (<>
  <path d="M3.5 7h14a6.5 6.5 0 0 1 6.5 6.5V17h-5v-3.5a1.5 1.5 0 0 0-1.5-1.5h-14z" fill={c.main} />
  <rect x="17" y="16" width="9" height="2.6" rx="1.2" fill={c.dark} />
  <path d="M21.5 21.2c1.7 2.1 2.6 3.5 2.6 4.7a2.6 2.6 0 0 1-5.2 0c0-1.2.9-2.6 2.6-4.7z" fill={c.dark} />
</>)

const bed: Draw = (c) => (<>
  <rect x="3" y="9" width="4" height="19" rx="1.4" fill={c.dark} />
  <rect x="3" y="16" width="26" height="7.5" rx="1.8" fill={c.main} />
  <rect x="9" y="11.5" width="7" height="5" rx="2.2" fill={W} opacity=".9" />
  <rect x="16" y="13" width="13" height="4.5" rx="1.8" fill={c.dark} />
  <rect x="25.5" y="22" width="3.5" height="6" rx="1.2" fill={c.dark} />
</>)

const pool: Draw = (c) => (<>
  <path d="M11 4v15M19 4v15" stroke={c.dark} strokeWidth="2.4" strokeLinecap="round" fill="none" />
  <path d="M11 9h8M11 14h8" stroke={c.dark} strokeWidth="2" fill="none" />
  <path d="M3 21.5c2.2 0 2.2-1.6 4.4-1.6s2.2 1.6 4.4 1.6 2.2-1.6 4.4-1.6 2.2 1.6 4.4 1.6 2.2-1.6 4.4-1.6 2.2 1.6 4.4 1.6V28H3z" fill={c.main} />
</>)

const truck: Draw = (c) => (<>
  <rect x="3" y="8" width="17" height="14" rx="1.8" fill={c.main} />
  <path d="M20 12.5h5l4 5V22h-9z" fill={c.dark} />
  <path d="M21.6 14.4h2.6l2.4 3.1h-5z" fill={W} opacity=".85" />
  <circle cx="9" cy="24" r="3.1" fill={c.dark} /><circle cx="23.5" cy="24" r="3.1" fill={c.dark} />
  <circle cx="9" cy="24" r="1.2" fill={W} /><circle cx="23.5" cy="24" r="1.2" fill={W} />
</>)

const tiles: Draw = (c) => (<>
  <rect x="4" y="4" width="24" height="24" rx="3" fill={c.main} />
  <rect x="5.8" y="5.8" width="9.3" height="9.3" rx="1.6" fill={c.dark} />
  <rect x="16.9" y="16.9" width="9.3" height="9.3" rx="1.6" fill={c.dark} />
  <path d="M16 4v24M4 16h24" stroke={W} strokeWidth="1.8" />
</>)

/** 카테고리 → [짧은 이름, 그림, 색]. 짧은 이름은 타일 두 줄 안에 들어가야 한다(`\n` 으로 끊는다). */
export const LIFE_TILES: Record<HomeServiceCategory, readonly [string, Draw, CategoryHue]> = {
  signage: ['간판', sign, 'purple'],
  store_interior: ['인테리어', roller, 'orange'],
  store_pest: ['방역·소독', spray, 'green'],
  kitchen_hood: ['후드·덕트\n청소', hood, 'yellow'],
  store_repair: ['시설 수리', wrench, 'blue'],
  store_fridge: ['냉장·냉동\n설비', fridge, 'teal'],
  store_aircon: ['에어컨\n청소·수리', aircon, 'blue'],
  store_clean: ['매장 청소', bucket, 'pink'],
  store_drain: ['배수구\n정화조', drain, 'teal'],
  lodging_clean: ['객실 청소\n침구', bed, 'blue'],
  lodging_pool: ['수영장\n온수 설비', pool, 'teal'],
  move: ['이사', truck, 'yellow'],
  move_in_clean: ['입주청소', bucket, 'green'],
  aircon_clean: ['에어컨 청소', aircon, 'blue'],
  home_interior: ['인테리어', roller, 'orange'],
  home_grout: ['줄눈·탄성', tiles, 'purple'],
  home_pest: ['해충 방역', spray, 'green'],
}

export function LifeTileIcon({ category, size = 32 }: { category: HomeServiceCategory; size?: number }) {
  const [, draw, hue] = LIFE_TILES[category]
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} fill="none" aria-hidden="true">
      {draw(CATEGORY_PALETTE[hue])}
    </svg>
  )
}
