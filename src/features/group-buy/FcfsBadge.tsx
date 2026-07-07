/**
 * 🎯 추첨 모집 현황 배지 — 사회적 증거("N명 지원").
 * 🎨 2026-07-06 (대표 "검은 알약이 너무 튀어 가격을 누름" → A안 채택): 두 렌더 모드로 분리.
 *   · variant='inline'(기본) — **조용한 소셜증거 라인**(배경 없음, 흐린 텍스트 + 지원 숫자만 진하게).
 *     플레인 배경(RestaurantList·LocalTownPage)에서 가격이 주인공이 되게. 검은 알약 폐기.
 *   · variant='overlay' — 사진 위(GroupBuyFeedCard·GroupBuyGridCard, absolute)에선 배경 없는 텍스트가
 *     안 보이므로 **소프트 글래스 알약**(반투명 다크 + blur, 흰 글자)로 가독성 유지(솔리드 검정보다 가벼움).
 *   prelaunch(오픈 예정)는 판매중이 아닌 '상태' 신호라 소프트 앰버 알약으로 항상 구분.
 *   spots=모집 정원, appliedDisplay=지원자(굵게 강조).
 */
import { formatNumber } from '@/utils/format'
import type { FcfsInfo } from './useFcfs'

export default function FcfsBadge(
  { info, className = '', variant = 'inline' }: { info: FcfsInfo; className?: string; variant?: 'inline' | 'overlay' },
) {
  const applied = formatNumber(info.appliedDisplay)
  const spots = formatNumber(info.spots)

  // 🏷️ 오픈 예정형 — 판매 중이 아니라 '오픈 예정 + 사전 응모' 소구. 상태 신호라 소프트 앰버 알약 유지.
  if (info.prelaunch) {
    if (variant === 'overlay') {
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-amber-500/85 backdrop-blur-sm px-2 py-1 text-[10px] font-bold leading-none text-white shadow-sm ${className}`}>
          🔔 오픈 예정
        </span>
      )
    }
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-400/10 px-2.5 py-1 text-[10.5px] font-bold leading-none text-amber-800 dark:text-amber-300 ${className}`}>
        <span>🔔 오픈 예정</span>
        <span className="opacity-40">·</span>
        <span className="font-extrabold">{applied}명 사전응모</span>
      </span>
    )
  }

  // 🎯 추첨 응모 현황 — 사진 위(overlay)면 소프트 글래스 알약, 아니면 조용한 라인(A안).
  if (variant === 'overlay') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-black/55 backdrop-blur-sm px-2 py-1 text-[10px] font-bold leading-none text-white shadow-sm ${className}`}>
        🔥 <span className="font-extrabold">{applied}</span>명 지원
      </span>
    )
  }
  return (
    <span className={`inline-flex items-center gap-1 text-[12px] text-gray-400 dark:text-gray-500 ${className}`}>
      <span>🔥</span>
      <span>지금 <b className="font-extrabold text-gray-900 dark:text-white">{applied}명</b> 지원 중</span>
      <span className="opacity-70">· {spots}명 모집</span>
    </span>
  )
}
