import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { cfImage, cfSrcSet } from '@/utils/cf-image'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { getVoucherShortLabel } from '@/shared/constants/voucher-categories'
import { formatPhone } from '@/utils/format-phone'
import { useInvalidateMyVouchers } from '@/hooks/queries'

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
  const invalidateVouchers = useInvalidateMyVouchers()
  const [product, setProduct] = useState<VoucherProduct | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [exchanging, setExchanging] = useState(false)
  const [quantity, setQuantity] = useState(1)
  const [showPhoneModal, setShowPhoneModal] = useState(false)
  const [phoneInput, setPhoneInput] = useState('')
  const [phoneConsent, setPhoneConsent] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false

    // 🛡️ 2026-05-27 (loading P0): SSR inject 즉시 사용 — worker HTMLRewriter 가 head 에 inject.
    //   /group-buy/:id 와 /vouchers/:id 둘 다 같은 endpoint → 같은 __SSR_INITIAL_DETAIL__ slot.
    //   효과: 첫 paint 부터 상품 표시 (axios fetch waterfall ~200-500ms 제거).
    try {
      if (typeof document !== 'undefined') {
        const el = document.getElementById('__SSR_INITIAL_DETAIL__')
        if (el?.textContent) {
          const parsed = JSON.parse(el.textContent)
          if (parsed?.success && String(parsed?.data?.id) === String(id)) {
            setProduct(parsed.data)
            setLoading(false)
          }
        }
      }
    } catch { /* SSR 누락 — fallback */ }

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
      `${product.name}\n${quantity}장 × ${formatNumber(product.price)}딜 = ${formatNumber(total)}딜\n\n⚠️ 교환 후 환불 불가\n진행할까요?`
    )
    if (!ok) return
    setExchanging(true)
    try {
      const { getTrackedSellerId } = await import('@/lib/seller-tracking')
      const ref = getTrackedSellerId() || undefined
      // 🛡️ 2026-05-23: idempotency_key — 중복 클릭 / 네트워크 retry 시 중복 차감 영구 차단.
      //   server 가 같은 key 발견하면 기존 voucher 반환 (no double charge).
      const idempotency_key = `voucher_${product.id}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
      const res = await api.post(`/api/group-buy/join/${product.id}`, {
        quantity, payment_method: 'deal', ref, idempotency_key,
      })
      if (res.data?.success) {
        toast.success('🎁 교환권 발급 완료')
        invalidateVouchers()
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
      // 🛡️ 2026-05-24: KT Alpha 상품 phone 미등록 → 즉시 입력 모달.
      if (code === 'PHONE_REQUIRED') {
        setShowPhoneModal(true)
        return
      }
      toast.error(e?.response?.data?.error || '교환 실패')
    } finally {
      setExchanging(false)
    }
  }

  // 🛡️ 2026-05-24: phone 입력 후 자동 retry — 사용자가 모달 닫고 다시 클릭하지 않아도 됨.
  //   개인정보보호법: 수집·이용 동의 필수 (체크박스).
  async function savePhoneAndRetry(phoneInput: string) {
    if (!phoneConsent) {
      toast.error('개인정보 수집·이용 동의 후 진행 가능합니다')
      return
    }
    const clean = phoneInput.replace(/[-\s]/g, '')
    if (!/^01\d{8,9}$/.test(clean)) {
      toast.error('010 으로 시작하는 휴대폰 번호를 입력하세요')
      return
    }
    try {
      const res = await api.patch('/api/auth/profile', { phone: clean })
      if (!res.data?.success) {
        toast.error(res.data?.error || '전화번호 저장 실패')
        return
      }
      toast.success('전화번호 저장 완료')
      setShowPhoneModal(false)
      // 자동 retry
      handleExchange()
    } catch (err) {
      // 🛡️ React #31 — server 가 { error: { code, message } } 반환 시 string 만 추출.
      const e = err as { response?: { data?: { error?: string | { message?: string } } } }
      const errRaw = e?.response?.data?.error
      const errMsg = typeof errRaw === 'string' ? errRaw
        : (errRaw && typeof errRaw === 'object' && typeof errRaw.message === 'string') ? errRaw.message
        : '전화번호 저장 실패'
      toast.error(errMsg)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500" />
      </div>
    )
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] p-4">
        <button onClick={() => navigate(-1)} className="mb-4"><ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" /></button>
        <div className="text-center mt-12">
          <p className="text-sm text-gray-700 dark:text-gray-200 mb-4">{error || '교환권을 찾을 수 없습니다'}</p>
          <button onClick={() => navigate('/vouchers')} className="px-4 py-2 bg-pink-500 text-white rounded-lg text-sm font-bold">교환권 목록으로</button>
        </div>
      </div>
    )
  }

  const total = product.price * quantity
  const label = getVoucherShortLabel(product.category)

  return (
    <div className="min-h-screen bg-white dark:bg-[#0A0A0A] pb-44 lg:pb-32">
      <SEO title={`${product.name} 교환권 - 유어딜`} description={product.description || ''} url={`/vouchers/${product.id}`} noindex />

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100 px-4 py-3 flex items-center justify-between">
        <button onClick={() => navigate(-1)} aria-label="뒤로"><ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" /></button>
        <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">{label}</h1>
        <div className="w-5" />
      </header>

      {product.image_url && (
        <div className="w-full aspect-square bg-gray-50 dark:bg-[#121212]">
          {/* 🛡️ 2026-05-27 (loading P0): cfImage 변환 — 원본 (1MB+) → WebP 80KB.
                LCP 우선 이미지 → eager + fetchPriority=high. */}
          <img
            src={cfImage(product.image_url, { width: 800, format: 'auto' }) || product.image_url}
            srcSet={cfSrcSet(product.image_url, 800) || undefined}
            sizes="(max-width: 640px) 100vw, 800px"
            alt={product.name}
            loading="eager"
            fetchPriority="high"
            decoding="async"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="px-4 py-5 space-y-3">
        <div className="inline-block px-2 py-0.5 bg-pink-100 text-pink-700 text-[11px] font-bold rounded">{label}</div>
        <h2 className="text-[20px] font-extrabold text-gray-900 dark:text-white leading-snug">{product.name}</h2>
        <div className="flex items-baseline gap-1">
          <span className="text-[28px] font-extrabold text-pink-600">{formatNumber(product.price)}</span>
          <span className="text-[14px] font-bold text-pink-600">딜</span>
        </div>
        {product.restaurant_name && (
          <p className="text-[13px] text-gray-600 dark:text-gray-300">📍 {product.restaurant_name}{product.restaurant_address ? ` · ${product.restaurant_address}` : ''}</p>
        )}
        {product.description && (
          <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed whitespace-pre-wrap mt-4">{product.description}</p>
        )}
      </div>

      <div className="mx-4 mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl text-[12px] text-amber-900 space-y-1">
        <p className="font-bold">📌 교환권 안내</p>
        <p>• 딜 결제 즉시 교환권이 발급됩니다 (마이 → 교환권 메뉴)</p>
        <p>• {product.voucher_expiry ? `유효 기간: ${product.voucher_expiry}` : '발급 후 사용 기간 적용'}</p>
        <p>• 교환권은 환불/취소가 제한될 수 있습니다</p>
      </div>

      {/* 🛡️ 2026-05-23: BottomNav (h-14 + safe-area) 위에 표시. z-[10002] = nav (z-9999) 위. */}
      <div
        className="fixed bottom-14 left-0 right-0 bg-white dark:bg-[#0A0A0A] border-t border-gray-100 z-[10002] lg:bottom-0"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="ur-content-narrow px-4 pt-3 flex items-center gap-2">
          <div className="flex items-center gap-2 border border-gray-200 rounded-lg overflow-hidden shrink-0">
            <button onClick={() => setQuantity(q => Math.max(1, q - 1))} className="w-9 h-10 text-gray-700 dark:text-gray-200">−</button>
            <span className="w-8 text-center text-sm font-bold text-gray-900 dark:text-white">{quantity}</span>
            <button onClick={() => setQuantity(q => q + 1)} className="w-9 h-10 text-gray-700 dark:text-gray-200">+</button>
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

      {/* 🛡️ 2026-05-24: KT Alpha 상품 phone 미등록 시 입력 모달 */}
      {showPhoneModal && (
        <div className="fixed inset-0 z-[10100] bg-black/60 flex items-end sm:items-center justify-center p-4" onClick={() => setShowPhoneModal(false)}>
          <div className="bg-white dark:bg-[#0A0A0A] rounded-t-2xl sm:rounded-2xl w-full max-w-sm p-5" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">📱 휴대폰 번호 등록</h3>
            <p className="text-xs text-gray-600 dark:text-gray-300 mb-4">
              기프티쇼 교환권은 휴대폰 MMS 로 발송됩니다.<br/>
              발송 받을 번호를 입력해주세요.
            </p>
            <input
              type="tel" inputMode="numeric" maxLength={13}
              value={phoneInput}
              onChange={(e) => setPhoneInput(formatPhone(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') savePhoneAndRetry(phoneInput) }}
              placeholder="010-1234-5678"
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-base text-gray-900 dark:text-white mb-3"
              autoFocus
            />

            {/* 🛡️ 2026-05-24: 개인정보보호법 — 수집·이용 동의 + 보유기간 명시. */}
            <label className="flex items-start gap-2 mb-3 cursor-pointer">
              <input
                type="checkbox"
                checked={phoneConsent}
                onChange={(e) => setPhoneConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 accent-pink-500"
              />
              <span className="text-[11px] text-gray-700 dark:text-gray-200 leading-relaxed">
                <b>휴대폰 번호 수집·이용에 동의</b>합니다 (필수)
                <br/>
                <span className="text-gray-500 dark:text-gray-400">
                  · 수집 항목: 휴대폰 번호<br/>
                  · 이용 목적: 기프티쇼 교환권 MMS 발송 / 알림톡 발송<br/>
                  · 보유 기간: 회원 탈퇴 시까지 (탈퇴 후 즉시 파기)
                </span>
              </span>
            </label>

            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => { setShowPhoneModal(false); setPhoneConsent(false) }}
                className="py-2.5 border border-gray-200 rounded-lg text-sm font-bold text-gray-700 dark:text-gray-200"
              >
                취소
              </button>
              <button
                onClick={() => savePhoneAndRetry(phoneInput)}
                disabled={!phoneInput || !phoneConsent}
                className="py-2.5 bg-pink-500 text-white rounded-lg text-sm font-bold disabled:opacity-40"
              >
                저장 후 교환
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
