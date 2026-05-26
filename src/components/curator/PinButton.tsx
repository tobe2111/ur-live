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

export default function PinButton({ productId, price, variant = 'card-overlay', className = '' }: PinButtonProps) {
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
        ? 'w-11 h-11 rounded-full flex items-center justify-center bg-white dark:bg-[#1A1A1A] border border-gray-200 dark:border-[#2A2A2A] hover:border-pink-500 transition-all'
        : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-pink-500 hover:bg-pink-600 text-white text-sm font-bold transition-colors'

  const icon = pinned ? '📌' : '➕'
  const label = pinned ? '핀됨' : '핀'

  return (
    <button
      type="button"
      aria-label={pinned ? '내 링크샵에서 제거' : '내 링크샵에 핀 추가'}
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
