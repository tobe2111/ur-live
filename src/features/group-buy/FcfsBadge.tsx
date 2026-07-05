/**
 * 🎯 추첨 모집 현황 배지 — "N명 모집 · M명 지원" (사회적 증거).
 * 🎨 2026-07-03 (대표 선택): 다크 잉크 알약(검정·흰 글자) — 브랜드 B&W 정체성 정합, 할인 빨강과 구분.
 *   다크 테마에선 검정 카드에 묻히지 않게 자동 반전(흰 알약·검정 글자). 사진 오버레이(GroupBuyGridCard)·
 *   플레인 배경(RestaurantList) 양쪽에서 선명. spots=모집 정원, appliedDisplay=지원자(굵게 강조).
 */
import { formatNumber } from '@/utils/format'
import type { FcfsInfo } from './useFcfs'

export default function FcfsBadge({ info, className = '' }: { info: FcfsInfo; className?: string }) {
  // 🏷️ 2026-07-05 (대표 "옵션으로 선택"): 오픈 예정형 — 판매 중이 아니라 '오픈 예정 + 사전 응모' 소구.
  if (info.prelaunch) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-gray-900 dark:bg-white px-2.5 py-1 text-[10px] font-bold leading-none text-white dark:text-gray-900 shadow-sm ${className}`}>
        <span className="opacity-80">🔔 오픈 예정</span>
        <span className="opacity-40">·</span>
        <span className="font-extrabold">{formatNumber(info.appliedDisplay)}명 사전응모</span>
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-gray-900 dark:bg-white px-2.5 py-1 text-[10px] font-bold leading-none text-white dark:text-gray-900 shadow-sm ${className}`}>
      <span className="opacity-80">🎯 {formatNumber(info.spots)}명 모집</span>
      <span className="opacity-40">·</span>
      <span className="font-extrabold">{formatNumber(info.appliedDisplay)}명 지원</span>
    </span>
  )
}
