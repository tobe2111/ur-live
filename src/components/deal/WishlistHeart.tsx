import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { Heart } from 'lucide-react'
import api from '@/lib/api'
import { isLoggedInSync } from '@/utils/auth'
import { useWishlist } from '@/hooks/queries/useWishlist'
import { queryKeys } from '@/hooks/queries/queryKeys'
import { toast } from '@/hooks/useToast'

/**
 * 💗 2026-08-19 (대표 시안 — 그루폰 카드 우상단 하트): 카드에서 바로 찜하기.
 *
 * - 목록은 `useWishlist`(기존 훅) 재사용 → 카드가 50개여도 **네트워크는 1회**(React Query dedupe).
 * - 토글은 낙관적으로 먼저 칠하고, 실패하면 되돌린다 — 찜은 실패해도 되돌리기 쉬운 동작이라
 *   기다리게 하는 편이 더 나쁘다.
 * - **비로그인은 막지 않고 로그인으로 보낸다**(returnUrl 유지) — 여기서 조용히 실패하면
 *   "눌러도 아무 일도 안 일어난다" 가 된다.
 *
 * ⚠️ 카드의 `<Link>` **안**에 놓이므로 `preventDefault + stopPropagation` 이 필수다.
 *    빠지면 찜하려던 클릭이 상세 페이지로 튄다(캐러셀 화살표와 같은 함정).
 */
export default function WishlistHeart({ productId, className = '' }: { productId: number; className?: string }) {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { data: items } = useWishlist()
  const serverOn = (items ?? []).some((i) => Number(i.product_id) === Number(productId))
  const [override, setOverride] = useState<boolean | null>(null)
  const [popping, setPopping] = useState(false)
  const on = override ?? serverOn

  async function toggle(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!isLoggedInSync()) {
      navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    const next = !on
    setOverride(next)
    if (next) { setPopping(true); window.setTimeout(() => setPopping(false), 340) }
    try {
      await api.post('/api/wishlists/toggle', { product_id: productId })
      qc.invalidateQueries({ queryKey: queryKeys.wishlist() })
    } catch {
      setOverride(!next) // 실패 → 되돌린다(칠해 놓고 저장 안 된 상태가 제일 나쁘다)
      toast.error('찜 처리에 실패했어요. 잠시 후 다시 시도해주세요')
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? '찜 해제' : '찜하기'}
      aria-pressed={on}
      /* 찜된 카드의 하트는 **항상 보인다**(is-on) — 안 그러면 내가 찜했는지 hover 해야 알 수 있다. */
      className={`ur-appear ${on ? 'is-on' : ''} w-8 h-8 rounded-full bg-white/85 dark:bg-black/55 backdrop-blur-sm shadow-sm flex items-center justify-center hover:bg-white dark:hover:bg-black/75 ${className}`}
    >
      <Heart
        className={`w-[17px] h-[17px] ${popping ? 'ur-pop' : ''} ${on ? 'text-brand' : 'text-gray-500 dark:text-gray-300'}`}
        fill={on ? 'currentColor' : 'none'}
        strokeWidth={on ? 0 : 2}
        aria-hidden="true"
      />
    </button>
  )
}
