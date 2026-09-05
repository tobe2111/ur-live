/**
 * 🛡️ 2026-05-25 (migration 0278): 상품 카드에 inject 되는 1탭 핀 버튼.
 *
 * 사용처: ProductCard / LiveProductCard / ReelProductCard / ProductDetailPage 등.
 * 카드 우상단 absolute 위치 (호버 시 강조).
 *
 * 비로그인 시 카카오 로그인 1탭 + pending_pin 저장 → 로그인 후 자동 핀 (useAutoPin).
 */

import { useEffect, useState } from 'react'
import { Pin, Plus } from 'lucide-react'
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
  /** 아이콘 override — 상세 상단바처럼 자기 크기·굵기를 강제하는 자리에서 쓴다.
   *  기본도 2026-09-03 부터 선 아이콘(Pin/Plus)이라 더는 이 자리만 튀지 않는다. */
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
      /* 🧷 2026-09-03: 찜 하트가 우상단(`top-2 right-2`)을 쓰므로 핀은 **그 아래**로 내린다.
         이전엔 둘이 같은 자리에 겹쳐 z-index 가 큰 핀이 하트를 덮었다(검색 결과 카드). */
      ? 'absolute top-11 right-2 z-[3] w-9 h-9 rounded-full flex items-center justify-center bg-black/55 hover:bg-brand backdrop-blur transition-all text-white'
      : variant === 'detail-floating'
        ? 'flex items-center justify-center transition-all'  // chrome 은 호출부(상세 상단바)가 className 으로 준다 — 4개 버튼을 한 벌로 맞추기 위해
        : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-sm font-bold transition-colors'

  /* 🎨 2026-09-03: 이모지(📌/➕) → 선 아이콘. 이모지는 OS 마다 다른 그림이 뜨고
     "임시로 채워 둔 것"으로 읽힌다(카드 폴백 아이콘을 2026-08-30 에 같은 이유로 바꿨다). */
  const icon = iconOverride
    ? iconOverride(pinned)
    : (pinned ? <Pin className="w-4 h-4 fill-current" aria-hidden="true" /> : <Plus className="w-4 h-4" aria-hidden="true" />)
  const label = pinned ? '핀됨' : '핀'

  return (
    <button
      type="button"
      aria-label={pinned ? '내 유어샵에서 제거' : '내 유어샵에 핀 추가'}
      onClick={handleClick}
      disabled={isPinning}
      className={`${baseStyle} ${className} ${isPinning ? 'opacity-50 cursor-wait' : ''}`}
    >
      <span className="inline-flex items-center justify-center">{icon}</span>
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
