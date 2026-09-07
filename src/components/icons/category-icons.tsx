/**
 * 🎨 카테고리·서비스 아이콘 — 유어딜 아이콘 컨셉 SSOT (2026-09-02 대표 확정)
 *
 * ■ 컨셉 (대표: *"앞으로 아이콘은 모두 저 컨셉이야 명심해줘"*)
 *   코레일톡 "이용가능한 서비스" 줄(`docs/design/assets/korailtalk-payment-complete-ref.jpg` 하단):
 *   **어두운 원 타일 위에 납작한(flat) 두 톤 채색 일러스트**. 렌터카=빨간 차, 숙박=분홍 건물,
 *   레저=파란 곤돌라, 택시=노란 차, 짐배송=주황 캐리어. 선(line) 아이콘이 아니라 **물건 그 자체**를
 *   색으로 그린다. 하나당 색 하나(+명암 한 단계)이고 윤곽선이 없다.
 *
 * ■ 두 벌이 있다 — 자리가 다르다
 *   · 하단 탭 5개: `urdeal-icons.tsx` (24 그리드, 선 1.6 / 활성 면). 탭은 단색이어야 라벨과 한 덩어리로 읽힌다.
 *   · **카테고리·서비스 타일**(이 파일): 채색 flat. 홈 카테고리 칩, 결제 완료의 "이런 서비스도", 지갑 필터.
 *   유틸리티(화살표·닫기·검색·복사)는 lucide 그대로.
 *
 * ■ 그리기 규칙
 *   - 32 그리드(`viewBox 0 0 32 32`), 윤곽선 없음, `fill` 만. 색은 아래 팔레트에서 **하나** 고르고
 *     명암은 같은 색의 어두운 단계 하나로만 낸다(코레일: 차체 빨강 + 창 어두운 빨강).
 *   - 타일(`<CategoryTile>`)이 원과 배경을 그린다. 아이콘은 타일 없이도 쓸 수 있다.
 *   - 다크/라이트에서 아이콘 색은 **같다**(시안: 다크 타일 위 원색). 타일 배경만 테마를 따른다.
 */
import { forwardRef, type SVGProps, type ReactNode } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'size'> & { size?: number | string }

/** 팔레트 — 코레일 서비스 줄 실측 계열. 새 아이콘은 여기서 고른다(새 색 추가 금지). */
export const CATEGORY_PALETTE = {
  red:    { main: '#E8433F', dark: '#A8262A' },
  pink:   { main: '#F0607A', dark: '#B93A55' },
  blue:   { main: '#3B82F6', dark: '#1F55B8' },
  yellow: { main: '#F5B63B', dark: '#B97E14' },
  orange: { main: '#F28C28', dark: '#B55F0F' },
  green:  { main: '#3CB371', dark: '#22794A' },
  teal:   { main: '#2BB3A3', dark: '#177A70' },
  purple: { main: '#8B6CF6', dark: '#5B41B8' },
} as const
export type CategoryHue = keyof typeof CATEGORY_PALETTE

const base = { viewBox: '0 0 32 32', 'aria-hidden': true, fill: 'none' as const }

/** 식사 — 밥그릇에 젓가락. (빨강) */
export const MealIcon = forwardRef<SVGSVGElement, IconProps>(function MealIcon({ size = 32, ...p }, ref) {
  const c = CATEGORY_PALETTE.red
  return (
    <svg ref={ref} {...base} width={size} height={size} {...p}>
      <path d="M5 14h22a11 11 0 0 1-11 11A11 11 0 0 1 5 14z" fill={c.main} />
      <path d="M8 21.5a11 11 0 0 0 16 0c-2.6 1.9-5.3 2.5-8 2.5s-5.4-.6-8-2.5z" fill={c.dark} />
      <rect x="20" y="4" width="2.2" height="12" rx="1.1" transform="rotate(20 21 10)" fill={c.dark} />
      <rect x="24" y="4" width="2.2" height="12" rx="1.1" transform="rotate(20 25 10)" fill={c.dark} />
    </svg>
  )
})

/** 카페·음료 — 손잡이 달린 컵과 김. (주황) */
export const CafeIcon = forwardRef<SVGSVGElement, IconProps>(function CafeIcon({ size = 32, ...p }, ref) {
  const c = CATEGORY_PALETTE.orange
  return (
    <svg ref={ref} {...base} width={size} height={size} {...p}>
      <path d="M7 12h15v8a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6z" fill={c.main} />
      <path d="M22 14h2.5a3.5 3.5 0 0 1 0 7H22v-2.5h2.5a1 1 0 0 0 0-2H22z" fill={c.dark} />
      <path d="M7 12h15v3H7z" fill={c.dark} />
      <path d="M12 4c-1.5 1.5-1.5 3 0 4.5S13.5 11 12 12.5M17 4c-1.5 1.5-1.5 3 0 4.5S18.5 11 17 12.5" stroke={c.main} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
})

/** 미용 — 가위. (분홍) */
export const BeautyIcon = forwardRef<SVGSVGElement, IconProps>(function BeautyIcon({ size = 32, ...p }, ref) {
  const c = CATEGORY_PALETTE.pink
  return (
    <svg ref={ref} {...base} width={size} height={size} {...p}>
      <circle cx="10" cy="22" r="4.5" fill={c.main} />
      <circle cx="22" cy="22" r="4.5" fill={c.main} />
      <circle cx="10" cy="22" r="2" fill={c.dark} />
      <circle cx="22" cy="22" r="2" fill={c.dark} />
      <path d="M12.5 19 24 5.5l2 1.6L14.6 21.5zM19.5 19 8 5.5l-2 1.6 11.4 14.4z" fill={c.dark} />
    </svg>
  )
})

/** 숙소 — 창이 켜진 건물. (파랑) */
export const StayIcon = forwardRef<SVGSVGElement, IconProps>(function StayIcon({ size = 32, ...p }, ref) {
  const c = CATEGORY_PALETTE.blue
  return (
    <svg ref={ref} {...base} width={size} height={size} {...p}>
      <path d="M8 6h16a2 2 0 0 1 2 2v20H6V8a2 2 0 0 1 2-2z" fill={c.main} />
      <path d="M13 21h6v7h-6z" fill={c.dark} />
      {[10, 15, 20].map((x) => [10, 15].map((y) => <rect key={`${x}${y}`} x={x} y={y} width="2.6" height="2.6" rx=".5" fill="#fff" opacity=".9" />))}
    </svg>
  )
})

/** 교환권 — 리본 묶인 선물 상자. (노랑) */
export const GiftIcon = forwardRef<SVGSVGElement, IconProps>(function GiftIcon({ size = 32, ...p }, ref) {
  const c = CATEGORY_PALETTE.yellow
  return (
    <svg ref={ref} {...base} width={size} height={size} {...p}>
      <rect x="6" y="13" width="20" height="14" rx="2" fill={c.main} />
      <rect x="4" y="9" width="24" height="5" rx="1.5" fill={c.dark} />
      <rect x="14.5" y="9" width="3" height="18" fill="#fff" opacity=".85" />
      <path d="M16 9c-3 0-5-2-4-3.5S15.5 6 16 9zm0 0c3 0 5-2 4-3.5S16.5 6 16 9z" fill={c.dark} />
    </svg>
  )
})

/** 편의점 — 차양 있는 작은 가게. (초록) */
export const StoreIcon = forwardRef<SVGSVGElement, IconProps>(function StoreIcon({ size = 32, ...p }, ref) {
  const c = CATEGORY_PALETTE.green
  return (
    <svg ref={ref} {...base} width={size} height={size} {...p}>
      <path d="M7 14h18v13H7z" fill={c.main} />
      <path d="M13 27v-7h6v7z" fill={c.dark} />
      <path d="M5 8h22l2 6H3z" fill={c.dark} />
      <path d="M3 14a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0v-1H3z" fill="#fff" opacity=".85" />
    </svg>
  )
})

/** 치킨·피자 — 피자 한 조각. (빨강 계열이 식사와 겹치므로 주황) */
export const PizzaIcon = forwardRef<SVGSVGElement, IconProps>(function PizzaIcon({ size = 32, ...p }, ref) {
  const c = CATEGORY_PALETTE.orange
  return (
    <svg ref={ref} {...base} width={size} height={size} {...p}>
      <path d="M16 28 4 9c7-5 17-5 24 0z" fill={c.main} />
      <path d="M16 28 5.5 11.3c6.4-4 14.6-4 21 0z" fill="#F7C55A" />
      <circle cx="13" cy="15" r="2" fill={c.dark} /><circle cx="19" cy="17" r="2" fill={c.dark} /><circle cx="15.5" cy="21" r="1.6" fill={c.dark} />
    </svg>
  )
})

/** 레저·액티비티 — 티켓. (보라) */
export const LeisureIcon = forwardRef<SVGSVGElement, IconProps>(function LeisureIcon({ size = 32, ...p }, ref) {
  const c = CATEGORY_PALETTE.purple
  return (
    <svg ref={ref} {...base} width={size} height={size} {...p}>
      <path d="M4 11a2 2 0 0 1 2-2h20a2 2 0 0 1 2 2v3a2.5 2.5 0 0 0 0 5v3a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-3a2.5 2.5 0 0 0 0-5z" fill={c.main} />
      <path d="M12 10v13" stroke="#fff" strokeWidth="1.6" strokeDasharray="2 2" opacity=".9" />
      <path d="M16 13.5h8v5h-8z" fill={c.dark} />
    </svg>
  )
})

/** 택시·이동 — 옆에서 본 차. (노랑) */
export const TaxiIcon = forwardRef<SVGSVGElement, IconProps>(function TaxiIcon({ size = 32, ...p }, ref) {
  const c = CATEGORY_PALETTE.yellow
  return (
    <svg ref={ref} {...base} width={size} height={size} {...p}>
      <path d="M4 20a2 2 0 0 1 2-2l2.5-6.5A2 2 0 0 1 10.4 10h11.2a2 2 0 0 1 1.9 1.5L26 18a2 2 0 0 1 2 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" fill={c.main} />
      <path d="M9.5 17.5 11 13h10l1.5 4.5z" fill={c.dark} />
      <circle cx="9" cy="24" r="2.6" fill={c.dark} /><circle cx="23" cy="24" r="2.6" fill={c.dark} />
      <rect x="13" y="7.5" width="6" height="2.5" rx="1" fill={c.dark} />
    </svg>
  )
})

/** 원 타일 — 시안의 서비스 줄 한 칸. 아이콘 + 라벨. 다크: 카드보다 한 톤 밝은 원, 라이트: 카드색 원. */
export function CategoryTile({ icon, label, onClick, size = 56 }: { icon: ReactNode; label: string; onClick?: () => void; size?: number }) {
  const inner = (
    <>
      <span className="flex items-center justify-center rounded-full bg-[#F1F1F6] dark:bg-[#262A36]" style={{ width: size, height: size }}>
        {icon}
      </span>
      <span className="text-[12px] leading-tight text-center text-gray-800 dark:text-gray-200 whitespace-pre-line">{label}</span>
    </>
  )
  const cls = 'flex flex-col items-center gap-2 min-w-0 active:opacity-70'
  return onClick ? <button type="button" onClick={onClick} className={cls}>{inner}</button> : <div className={cls}>{inner}</div>
}
