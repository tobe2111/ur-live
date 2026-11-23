/**
 * 전화(매장에 전화 걸기) — 비스듬한 수화기. 2026-11-23 전화 예약형 이용권의 주 행동.
 * 유어딜 선 아이콘과 같은 문법(24 그리드 · 획 1.6 · 둥근 끝 · `filled` = 면). `urdeal-icons.tsx` 가 파일 크기 한도(600줄)에
 * 닿아 있어 이 한 개만 따로 둔다 — 세트에 자리가 생기면 그리로 옮긴다.
 */
import { forwardRef, type SVGProps } from 'react'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'size'> & { size?: number | string; filled?: boolean }

export const PhoneIcon = forwardRef<SVGSVGElement, IconProps>(function PhoneIcon({ size = 24, filled, ...props }, ref) {
  return (
    <svg ref={ref} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden
      width={size} height={size} {...props}>
      <path
        d="M7.2 4.2h2.5l1.3 3.6-1.7 1.3a10.4 10.4 0 0 0 5.6 5.6l1.3-1.7 3.6 1.3v2.5a1.9 1.9 0 0 1-2.1 1.9A14.6 14.6 0 0 1 5.3 6.3a1.9 1.9 0 0 1 1.9-2.1Z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  )
})
