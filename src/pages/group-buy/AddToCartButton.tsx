/**
 * 🧺 담기 — 이용권을 장바구니에 넣는다 (2026-09-15 대표 *"장바구니쪽도 진행해줘"*)
 *
 * ## 왜 주 버튼이 아닌가
 * 이 화면의 주 행동은 **사는 것**이다(바로 위 큰 버튼). 담기는 "지금 말고, 다른 것과 같이" 일 때 쓰는
 * 보조 경로라 텍스트 버튼으로 둔다. 둘 다 채운 버튼으로 두면 무엇을 눌러야 할지 화면이 안 알려 준다.
 *
 * ## 로그인
 * 장바구니는 서버에 저장한다(`cart_items`) — 기기를 바꿔도 남아야 하고, 결제 시작 때 서버가 값을
 * 다시 매기기 때문이다. 그래서 비로그인이면 로그인으로 보내되 **돌아올 자리를 들고 간다.**
 *
 * ⚠️ 담았다고 가격이 고정되는 게 아니다 — 결제 시작(`/cart/init`)에서 서버가 **그 시점의 티어가**로
 *    다시 계산한다. 담을 때 값을 붙잡아 두면 며칠 뒤 결제에서 화면과 청구가 갈린다.
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from '@/hooks/useToast'
import { ShoppingCart } from 'lucide-react'
import api from '@/lib/api'
import { hasConsumerSession } from '@/utils/auth'
import { useInvalidateCart } from '@/hooks/queries/useCartCount'
import { queryKeys } from '@/hooks/queries/queryKeys'
import { useQueryClient } from '@tanstack/react-query'

export default function AddToCartButton({ productId, qty, show }: { productId: number; qty: number; show: boolean }) {
  const navigate = useNavigate()
  const invalidateCart = useInvalidateCart()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  if (!show) return null

  const add = async () => {
    if (!hasConsumerSession()) {
      navigate(`/login?returnUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`)
      return
    }
    setBusy(true)
    try {
      const res = await api.post('/api/cart', { product_id: productId, quantity: Math.max(1, qty) })
      if (res.data?.success === false) { toast.error(res.data?.error || '담지 못했습니다'); return }
      // 뱃지(개수)와 목록 둘 다 새로 읽는다 — 하나만 갱신하면 담았는데 숫자가 안 바뀐다.
      invalidateCart()
      qc.invalidateQueries({ queryKey: queryKeys.cartCount() })
      // 담고 나서 자동으로 장바구니로 끌고 가지 않는다 — 계속 둘러보려던 사람의 흐름이 끊긴다.
      // 헤더 장바구니 아이콘의 숫자가 방금 올라갔으므로 "어디에 담겼는지" 는 화면이 이미 말한다.
      toast.success('장바구니에 담았어요')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || '담지 못했습니다')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={add}
      disabled={busy}
      style={{
        width: '100%', height: 40, marginTop: 6, border: 'none', background: 'transparent',
        color: 'var(--gbd-ink2)', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: busy ? 0.5 : 1,
      }}
    >
      <ShoppingCart style={{ width: 16, height: 16 }} strokeWidth={1.8} aria-hidden="true" />
      {busy ? '담는 중…' : '장바구니에 담기'}
    </button>
  )
}
