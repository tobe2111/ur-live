/**
 * 🎯 2026-07-01 (대표 — 동네딜 추첨 응모): "추첨 {지원}/{정원}명" 소셜 증거 배지.
 *   카드 이미지 위 오버레이(잉크 pill). 기존 할인/달성 배지와 동일 스타일(bg-gray-900 text-white).
 */
import { formatNumber } from '@/utils/format'
import type { FcfsInfo } from './useFcfs'

export default function FcfsBadge({ info, className = '' }: { info: FcfsInfo; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 bg-gray-900 text-white text-[10px] font-extrabold px-2 py-0.5 rounded-md shadow ${className}`}>
      🎯 추첨 {formatNumber(info.appliedDisplay)}/{formatNumber(info.spots)}명
    </span>
  )
}
