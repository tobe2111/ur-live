/**
 * 🛡️ 2026-05-25 (migration 0278): 상품 카드에 inject 되는 1탭 핀 버튼.
 *
 * 사용처: ProductCard / LiveProductCard / ReelProductCard / ProductDetailPage 등.
 * 카드 우상단 absolute 위치 (호버 시 강조).
 *
 * 비로그인 시 카카오 로그인 1탭 + pending_pin 저장 → 로그인 후 자동 핀 (useAutoPin).
 */

import { useEffect, useState } from 'react'
import { usePinAction } from '@/features/curator/hooks/usePinAction'
import { useAuthStore } from '@/client/stores/auth.store'
import { curatorApi } from '@/features/curator/api/curator-api'

interface PinButtonProps {
  productId: number
  /** 가격 — toast 의 simulator 계산 용 (optional) */
  price?: number
  /** 카드 컨텍스트에 따른 위치 조정 */
  variant?: 'card-overlay' | 'detail-floating' | 'inline'
  className?: string
  /** 아이콘 override — 상세 상단바처럼 **선 아이콘으로 통일해야 하는 자리**에서 쓴다.
   *  기본은 이모지(➕/📌)인데, 선 아이콘들 사이에 섞이면 그 버튼만 혼자 튄다(대표 지적 2026-08-31). */
  icon?: (pinned: boolean) => React.ReactNode
}

/**
 * 핀 상태는 본인 핀 목록 캐시에서 확인.
 * 비로그인 시 항상 unpinned 표시 (클릭 시 로그인 흐름).
 */
function useIsPinned(productId: number): { pinned: boolean; setPinned: (v: boolean) => void } {
  const [pinned, setPinned] = useState(false)
  const isAuthenticated = useAuthStore((s: any) => s.isAuthenticated)

  useEffect(() => {
    if (!isAuthenticated) {
      setPinned(false)
      return
    }
    // best-effort: 마이 핀 목록은 client 단 cache 미보유 → 일단 false 로 두고 클릭 시 ALREADY_PINNED 로 알림.
    // Phase 1-C 에서 react-query 등으로 캐시 도입 시 최적화.
  }, [isAuthenticated, productId])

  return { pinned, setPinned }
}

export default function PinButton({ productId, price, variant = 'card-overlay', className = '', icon: iconOverride }: PinButtonProps) {
  const { isPinning, togglePin } = usePinAction()
  const { pinned, setPinned } = useIsPinned(productId)

  async function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    await togglePin(productId, price)
    setPinned(true) // 낙관적 업데이트
  }

  const baseStyle =
    variant === 'card-overlay'
      ? 'absolute top-2 right-2 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-black/60 hover:bg-pink-500 backdrop-blur transition-all'
      : variant === 'detail-floating'
        ? 'flex items-center justify-center transition-all'  // chrome 은 호출부(상세 상단바)가 className 으로 준다 — 4개 버튼을 한 벌로 맞추기 위해
        : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition-colors'

  const icon = iconOverride ? iconOverride(pinned) : (pinned ? '📌' : '➕')
  const label = pinned ? '핀됨' : '핀'

  return (
    <button
      type="button"
      aria-label={pinned ? '내 유어샵에서 제거' : '내 유어샵에 핀 추가'}
      onClick={handleClick}
      disabled={isPinning}
      className={`${baseStyle} ${className} ${isPinning ? 'opacity-50 cursor-wait' : ''}`}
    >
      <span className={variant === 'inline' ? 'text-base' : 'text-lg'}>{icon}</span>
      {variant === 'inline' && <span>{label}</span>}
    </button>
  )
}

/**
 * 외부에서 호출 가능한 silent prefetch — 페이지 마운트 시 본인 핀 목록 미리 받기.
 * (Phase 1-C 에서 react-query 도입 시 대체)
 */
export async function prefetchMyPins(): Promise<Set<number>> {
  try {
    // /api/curator/me/pins/stats 사용 — pin_ids 만 필요하나 stats endpoint 가 가장 가까움
    const res = await curatorApi.getPinStats(1)
    return new Set((res.stats || []).map((s) => s.product_id))
  } catch {
    return new Set()
  }
}
