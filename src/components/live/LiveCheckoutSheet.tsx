/**
 * LiveCheckoutSheet — 라이브 시청 중 영상 끊김 없는 결제 sheet.
 *
 * 🛡️ 2026-05-13 (Phase A1 — Bottomsheet 결제):
 *   기존: 바로구매 → /checkout 페이지 navigate → 영상 unmount → 결제 후 복귀 → 영상 재로드
 *   현재: 라이브 화면 위에 슬라이드업 sheet → 영상 그대로 진행 → 결제 → sheet 닫힘
 *
 * 결제 경로:
 *   - 딜 잔액 >= 총액 → 1탭 "딜로 결제" (외부 redirect 없음, 영상 유지)
 *   - 딜 부족 / 사용자가 카드 결제 원함 → "카드 결제" 클릭 시 /checkout 페이지로 fallback
 *     (기존 흐름 그대로 — regression 0)
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { X, MapPin, Wallet, CreditCard, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface Product {
  id: number
  name: string
  price: number
  image_url?: string | null
  seller_id?: number | null
  seller_name?: string | null
}

interface ShippingAddress {
  id: number
  recipient_name: string
  phone: string
  postal_code: string
  address: string
  address_detail?: string
  is_default?: boolean
}

interface LiveCheckoutSheetProps {
  open: boolean
  product: Product | null
  streamId: number
  sellerShippingFee?: number
  onClose: () => void
  onSuccess: (orderNumber: string) => void
}

export default function LiveCheckoutSheet({
  open, product, streamId, sellerShippingFee = 3000, onClose, onSuccess,
}: LiveCheckoutSheetProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [paying, setPaying] = useState(false)
  const [addresses, setAddresses] = useState<ShippingAddress[]>([])
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null)
  const [dealBalance, setDealBalance] = useState(0)
  // 🛡️ 2026-05-13: 1-탭 자동 결제 — TikTok Shop / Whatnot 패턴.
  //   sheet 열림 + 딜 충분 + 주소 있음 → 3초 카운트다운 → 자동 결제. "취소" 버튼으로 abort.
  //   초기값: 사용자가 이전에 토글 켰는지 (localStorage live_autoconfirm_v1).
  const [autoConfirmEnabled, setAutoConfirmEnabled] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('live_autoconfirm_v1') === '1'
  })
  const [autoConfirmCountdown, setAutoConfirmCountdown] = useState<number | null>(null)

  // Fetch addresses + deal balance on open
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    Promise.all([
      api.get('/api/shipping-addresses').catch(() => ({ data: { data: [] } })),
      api.get('/api/points/balance').catch(() => ({ data: { data: { balance: 0 } } })),
    ]).then(([addrRes, balRes]) => {
      if (cancelled) return
      const addrList: ShippingAddress[] = addrRes.data?.data || []
      setAddresses(addrList)
      const defaultAddr = addrList.find(a => a.is_default) || addrList[0]
      setSelectedAddressId(defaultAddr?.id ?? null)
      setDealBalance(balRes.data?.data?.balance ?? 0)
    }).finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [open])

  // 🛡️ 2026-05-13: 자동 결제 카운트다운 — sheet 열림 + 토글 ON + 모든 조건 충족 시.
  useEffect(() => {
    if (!open || loading || paying) { setAutoConfirmCountdown(null); return }
    if (!autoConfirmEnabled) return
    if (!product || !addresses.length) return
    const addr = addresses.find(a => a.id === selectedAddressId)
    if (!addr) return
    const total = product.price + sellerShippingFee
    if (dealBalance < total) return  // 딜 부족 시 카운트다운 없음

    setAutoConfirmCountdown(3)
    const interval = setInterval(() => {
      setAutoConfirmCountdown(prev => {
        if (prev === null) return null
        if (prev <= 1) {
          clearInterval(interval)
          // 자동 결제 트리거 (handlePayWithDeals 가 paying 가드)
          void handlePayWithDealsRef.current?.()
          return null
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, loading, paying, autoConfirmEnabled, addresses.length, selectedAddressId, dealBalance])

  // handlePayWithDeals 를 ref 로 (effect dependency 회피 + 최신 값 사용)
  const handlePayWithDealsRef = useRef<(() => Promise<void>) | null>(null)

  if (!open || !product) return null

  const subtotal = product.price
  const shipping = sellerShippingFee
  const total = subtotal + shipping
  const canPayWithDeals = dealBalance >= total
  const selectedAddress = addresses.find(a => a.id === selectedAddressId) || null

  const handlePayWithDeals = async () => {
    if (!selectedAddress) {
      toast.error(t('liveCheckout.addressRequired', { defaultValue: '배송지를 선택해주세요' }))
      return
    }
    if (!canPayWithDeals) return
    setPaying(true)
    try {
      const orderNumber = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
      // 라이브 진입 정보 기록 (PR #336 의 social proof 와 연계)
      localStorage.setItem('lastViewedLiveId', String(streamId))
      localStorage.setItem('lastViewedLiveAt', String(Date.now()))
      sessionStorage.setItem('directPurchase', 'true')
      const res = await api.post('/api/points/pay', {
        order_number: orderNumber,
        live_stream_id: streamId,  // ← social proof broadcast 트리거
        items: [{
          product_id: String(product.id),
          product_name: product.name,
          quantity: 1,
          seller_id: product.seller_id ? String(product.seller_id) : undefined,
        }],
        shipping: {
          name: selectedAddress.recipient_name,
          phone: selectedAddress.phone,
          postal_code: selectedAddress.postal_code,
          address1: selectedAddress.address,
          address2: selectedAddress.address_detail || '',
        },
      })
      if (res.data?.success) {
        toast.success(t('liveCheckout.paymentSuccess', { defaultValue: '결제 완료! 시청 계속하세요.' }))
        onSuccess(orderNumber)
      } else {
        toast.error(res.data?.error || t('liveCheckout.paymentFailed', { defaultValue: '결제 실패' }))
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e.response?.data?.error || t('liveCheckout.paymentFailed', { defaultValue: '결제 실패' }))
    } finally {
      setPaying(false)
    }
  }
  // 🛡️ 2026-05-13: ref 갱신 — auto-confirm effect 에서 최신 handlePayWithDeals 호출.
  handlePayWithDealsRef.current = handlePayWithDeals

  const handleFallbackToCheckout = () => {
    // 카드 결제 / 신규 주소 / 쿠폰 등 풍부한 UX 필요 시 기존 페이지로 이동
    onClose()
    navigate('/checkout', {
      state: {
        returnUrl: `/live/${streamId}`,
        directPurchase: [{
          id: `live_${product.id}_${Date.now()}`,
          product_id: product.id,
          product_name: product.name,
          product_price: product.price,
          product_image: product.image_url,
          image_url: product.image_url,
          quantity: 1,
          price_snapshot: product.price,
          price: product.price,
          item_total: product.price,
          seller_id: product.seller_id ?? null,
          seller_name: product.seller_name ?? null,
          shipping_fee: shipping,
        }],
      },
    })
  }

  const fmt = (n: number) => `₩${n.toLocaleString('ko-KR')}`

  return (
    <div className="fixed inset-0 z-[200] flex items-end" onClick={onClose}>
      {/* Backdrop — 영상이 살짝 보이도록 80% opacity */}
      <div className="absolute inset-0 bg-black/70" />
      {/* Sheet */}
      <div
        className="relative w-full bg-white rounded-t-3xl shadow-2xl max-h-[85vh] overflow-y-auto animate-sheet-up"
        onClick={e => e.stopPropagation()}
        style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom))' }}
      >
        {/* Drag handle + close */}
        <div className="sticky top-0 bg-white z-10 px-5 pt-3 pb-2 border-b border-gray-100 dark:border-[#1A1A1A]">
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto mb-3" />
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">{t('liveCheckout.title', { defaultValue: '바로 결제' })}</h3>
            <button onClick={onClose} className="p-1 -mr-1 text-gray-500 hover:text-gray-900">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* 상품 */}
          <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
            {product.image_url && (
              <img src={product.image_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">{product.name}</p>
              <p className="text-base font-bold text-gray-900 mt-0.5">{fmt(product.price)}</p>
            </div>
          </div>

          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              {/* 배송지 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5" /> {t('liveCheckout.shippingTo', { defaultValue: '받는 곳' })}
                  </p>
                  {addresses.length > 1 && (
                    <button onClick={handleFallbackToCheckout} className="text-xs text-blue-600 hover:text-blue-700">
                      {t('liveCheckout.changeAddress', { defaultValue: '변경' })}
                    </button>
                  )}
                </div>
                {selectedAddress ? (
                  <div className="text-sm text-gray-900">
                    <p className="font-semibold">{selectedAddress.recipient_name} <span className="text-gray-500 font-normal">{selectedAddress.phone}</span></p>
                    <p className="text-gray-600 text-xs mt-0.5">[{selectedAddress.postal_code}] {selectedAddress.address} {selectedAddress.address_detail || ''}</p>
                  </div>
                ) : (
                  <button onClick={handleFallbackToCheckout} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600">
                    + {t('liveCheckout.addAddress', { defaultValue: '배송지 등록하기' })}
                  </button>
                )}
              </div>

              {/* 금액 */}
              <div className="border-t border-gray-100 dark:border-[#1A1A1A] pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-gray-600">
                  <span>{t('liveCheckout.subtotal', { defaultValue: '상품 금액' })}</span>
                  <span>{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-600">
                  <span>{t('liveCheckout.shipping', { defaultValue: '배송비' })}</span>
                  <span>{fmt(shipping)}</span>
                </div>
                <div className="flex justify-between font-bold text-gray-900 pt-1.5 border-t border-gray-100 dark:border-[#1A1A1A]">
                  <span>{t('liveCheckout.total', { defaultValue: '총 결제 금액' })}</span>
                  <span className="text-pink-600">{fmt(total)}</span>
                </div>
              </div>

              {/* 결제 수단 */}
              <div className="space-y-2">
                {canPayWithDeals ? (
                  <button
                    onClick={handlePayWithDeals}
                    disabled={paying || !selectedAddress}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wallet className="w-4 h-4" />}
                    <span>
                      {paying
                        ? t('liveCheckout.paying', { defaultValue: '결제 중...' })
                        : t('liveCheckout.payWithDeals', { defaultValue: '딜로 결제 — {{total}}', total: fmt(total) })}
                    </span>
                  </button>
                ) : (
                  <div className="text-center py-2 text-xs text-amber-600 bg-amber-50 rounded-lg">
                    {t('liveCheckout.dealInsufficient', {
                      defaultValue: '딜 잔액 부족 ({{balance}}원). 카드 결제로 진행하세요.',
                      balance: fmt(dealBalance),
                    })}
                  </div>
                )}
                <button
                  onClick={handleFallbackToCheckout}
                  className="w-full py-3 rounded-xl border border-gray-300 hover:border-gray-400 text-gray-700 font-semibold text-sm flex items-center justify-center gap-2"
                >
                  <CreditCard className="w-4 h-4" />
                  {t('liveCheckout.payWithCard', { defaultValue: '카드 / 다른 결제 수단' })}
                </button>
              </div>

              {dealBalance > 0 && canPayWithDeals && (
                <p className="text-[11px] text-gray-500 text-center">
                  {t('liveCheckout.dealNote', { defaultValue: '결제 후 영상 그대로 시청 계속됩니다.' })}
                </p>
              )}

              {/* 🛡️ 2026-05-13: 1-탭 자동 결제 토글 — 다음부터 sheet 열리면 3초 카운트다운 후 자동 결제. */}
              {canPayWithDeals && selectedAddress && (
                <label className="flex items-center gap-2 text-[11px] text-gray-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoConfirmEnabled}
                    onChange={(e) => {
                      const v = e.target.checked
                      setAutoConfirmEnabled(v)
                      try { localStorage.setItem('live_autoconfirm_v1', v ? '1' : '0') } catch { /* ignore */ }
                    }}
                    className="w-3.5 h-3.5"
                  />
                  <span>⚡ 다음부터 1-탭 자동 결제 (3초 카운트다운 + 취소 가능)</span>
                </label>
              )}
            </>
          )}
        </div>

        {/* 🛡️ 2026-05-13: auto-confirm 카운트다운 오버레이 — 큰 "취소" 버튼 */}
        {autoConfirmCountdown !== null && (
          <div className="absolute inset-x-0 bottom-0 bg-pink-500 text-white px-5 py-4 flex items-center justify-between gap-3 rounded-t-2xl shadow-2xl"
            style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">⚡ {autoConfirmCountdown}초 후 자동 결제</p>
              <p className="text-[11px] opacity-90">총 {fmt(total)} · 딜 결제</p>
            </div>
            <button
              onClick={() => setAutoConfirmCountdown(null)}
              className="shrink-0 px-4 py-2 bg-white text-pink-600 rounded-lg text-sm font-bold hover:bg-pink-50 transition-colors"
            >
              취소
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
