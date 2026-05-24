import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'

/**
 * 🛡️ 2026-05-23: 교환권 전용 detail 페이지.
 *
 * 정책 (사용자 명시):
 *   - / + /browse 의 상품 → Toss 결제 (공구 / 일반 쇼핑)
 *   - /vouchers + /vouchers/:id 의 상품 → 딜 결제 (교환권 전용)
 *
 * 분리 배경:
 *   GroupBuyDetailPage 가 voucher + group-buy 두 분류를 같은 UI 로 렌더 →
 *   교환권에 "참여하기" / 진행률 같은 group-buy UI 노출 사고. 페이지 자체 분리로 영구 차단.
 *
 * UI 책임 (group-buy 와 다름):
 *   - 가격 표시 단위: 딜 (group-buy 는 원)
 *   - 버튼: "딜로 교환하기" (group-buy 는 "참여하기")
 *   - 진행률 / 참여자 수 / 마감 카운트다운 없음 (즉시 교환)
 *   - 사용 기간 + 사용처 안내
 */

interface VoucherProduct {
  id: number
  name: string
  description: string | null
  price: number
  image_url: string | null
  category: string
  deal_only?: number
  voucher_expiry?: string | null
  restaurant_name?: string | null
  restaurant_address?: string | null
  seller_id?: number
  seller_name?: string | null
}

export default function VoucherDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<VoucherProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exchanging, setExchanging] = useState(false)
  const [quantity, setQuantity] = useState(1)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    api.get(`/api/group-buy/products/${id}`)
      .then(r => {
        if (cancelled) return
        if (r.data?.success) setProduct(r.data.data)
        else setError(r.data?.error || '교환권을 찾을 수 없습니다')
      })
      .catch(err => {
        if (cancelled) return
        const msg = err?.response?.data?.error || '교환권 로드 실패'
        setError(msg)
      })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [id])

  async function handleExchange() {
    if (!product) return
    const total = product.price * quantity
    const ok = window.confirm(
      `${product.name}\n${quantity}장 × ${formatNumber(product.price)}딜 = ${formatNumber(total)}딜\n\n딜로 교환하시겠습니까?`
    )
    if (!ok) return
    setExchanging(true)
    try {
      const { getTrackedSellerId } = await import('@/lib/seller-tracking')
      const ref = getTrackedSellerId() || undefined
      const res = await api.post(`/api/group-buy/join/${product.id}`, {
        quantity, payment_method: 'deal', ref,
      })
      if (res.data?.success) {
        toast.success('🎁 교환권 발급 완료')
        navigate('/my-vouchers')
      } else {
        toast.error(res.data?.error || '교환 실패')
      }
    } catch (err: unknown) {
      const e = err as { response?: { status?: number; data?: { error?: string; code?: string } } }
      const code = e?.response?.data?.code
      if (code === 'INSUFFICIENT_POINTS') {
        const charge = window.confirm('딜이 부족합니다. 충전 페이지로 이동할까요?')
        if (charge) {
          localStorage.setItem('loginReturnUrl', window.location.pathname)
          navigate('/points/charge')
        }
        return
      }
      toast.error(e?.response?.data?.error || '교환 실패')
    } finally {
      setExchanging(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white p-4">
        <button onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="w-5 h-5 text-gray-900" /></button>
        <div className="text-center mt-12">
          <p className="text-sm text-gray-700 mb-4">{error || '교환권을 찾을 수 없습니다'}</p>
          <button onClick={() => navigate('/vouchers')} className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-bold">교환권 목록으로</button>
        </div>
      </div>
    )
  }

  const total = product.price * quantity
  const label = getVoucherShortLabel(product.category)

  return (
    <div className="min-h-screen bg-white pb-24">
      <SEO title={`${product.name} 교환권 - 유어딜`} description={product.description || ''} url={`/vouchers/${product.id}`} noindex />

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} aria-label="뒤로"><ArrowLeft className="w-5 h-5 text-gray-900" /></button>
        <h1 className="text-[15px] font-bold text-gray-900">{label}</h1>
        <div className="w-5" />
      </header>

      {product.image_url && (
        <div className="w-full aspect-square bg-gray-50">
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
        </div>
      )}

      <div className="px-4 py-5 space-y-3">
        <div className="inline-block px-2 py-0.5 bg-pink-100 text-pink-700 text-[11px] font-bold rounded">{label}</div>
        <h2 className="text-[20px] font-extrabold text-gray-900 leading-snug">{product.name}</h2>
        <div className="flex items-baseline gap-1">
          <span className="text-[28px] font-extrabold text-pink-600">{formatNumber(product.price)}</span>
          <span className="text-[14px] font-bold text-pink-600">딜</span>
        </div>
        {product.restaurant_name && (
          <p className="text-[13px] text-gray-600">📍 {product.restaurant_name}{product.restaurant_address ? ` · ${product.restaurant_address}` : ''}</p>
        )}
        {product.description && (
          <p className="text-[13px] text-gray-700 leading-relaxed whitespace-pre-wrap mt-4">{product.description}</p>
        )}
      </div>

      <div className="mx-4 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-900 space-y-1">
        <p className="font-bold">📌 교환권 안내</p>
        <p>• 딜 결제 즉시 교환권이 발급됩니다 (마이 → 교환권 메뉴)</p>
        <p>• {product.voucher_expiry ? `유효 기간: ${product.voucher_expiry}` : '발급 후 사용 기간 적용'}</p>
        <p>• 교환권은 환불/취소가 제한될 수 있습니다</p>
      </div>

      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-30"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="ur-content-narrow px-4 pt-3 flex items-center gap-2">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg overflow-hidden shrink-0">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-9 h-10 text-gray-700">−</button>
            <span className="w-8 text-center text-sm font-bold text-gray-900">{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)} className="w-9 h-10 text-gray-700">+</button>
          </div>
          <button
            onClick={handleExchange}
            disabled={exchanging}
            className="flex-1 py-3 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[15px] font-bold rounded-full disabled:opacity-50"
          >
            {exchanging ? '교환 중…' : `${formatNumber(total)}딜로 교환하기`}
          </button>
        </div>
      </div>
    </div>
  )
}
