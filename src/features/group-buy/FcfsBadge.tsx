/**
 * 🎯 추첨 모집 현황 배지 — "N명 모집 · M명 지원" (사회적 증거).
 * 🎨 2026-07-03 (대표 — "칙칙해 + 디자인 변경"): 흐린 회색 pill → 로즈→레드 그라데이션 solid pill(흰 글자).
 *   사진 위 오버레이(GroupBuyGridCard)·플레인 배경(RestaurantList) 양쪽에서 선명.
 *   spots=모집 정원, appliedDisplay=지원자 수. 지원자 수를 굵게 강조(경쟁률 = 사회적 증거).
 */
import { formatNumber } from '@/utils/format'
import type { FcfsInfo } from './useFcfs'

export default function FcfsBadge({ info, className = '' }: { info: FcfsInfo; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 to-red-500 px-2.5 py-1 text-[10px] font-bold leading-none text-white shadow-sm ${className}`}>
      <span className="opacity-90">🎯 {formatNumber(info.spots)}명 모집</span>
      <span className="opacity-50">·</span>
      <span className="font-extrabold">{formatNumber(info.appliedDisplay)}명 지원</span>
    </span>
  )
}
