/**
 * 🛡️ 2026-05-22: 공구 토스 결제 confirm 페이지 — Toss success URL 에서 도달.
 *
 * 흐름:
 *   1) Toss 호스팅 결제 페이지에서 결제 완료 → redirect /group-buy/confirm-payment?paymentKey=...&orderId=...&amount=...&productId=...&qty=...
 *   2) 본 페이지 mount → /api/group-buy/confirm-toss 호출 → 서버가 Toss 승인 + voucher 발급
 *   3) 성공 시 **결제 완료 티켓 화면**(PaymentCompleteTicket) — 실패 시 에러 표시 + 고객센터 안내
 *
 * 🧺 2026-09-15 (대표 *"장바구니쪽도 진행해줘"*): `?cart=1` 이면 **장바구니 결제**다 — 확정 엔드포인트가
 *   `/cart/confirm-toss` 로 갈리고, 품목은 URL 이 아니라 **서버 기록**(`gb_cart_intents`)에서 온다.
 *   그래서 이 화면은 `productId·qty` 를 안 받는다(받으면 그게 곧 바꿔치기 통로다 — `cart-intent.ts`).
 *
 * 🎫 2026-09-02 (대표 시안 — 코레일톡 "결제가 완료되었어요"): 성공 직후 1.5초 뒤 /my-vouchers 로 자동 이동하던
 *   것을 폐기했다. 사용자가 "완료되었어요"를 한 번도 못 봤다. 이제 티켓 한 장을 보여 주고 '이용권 확인'으로 지갑에 간다.
 *   confirm 호출·퍼널 계측·추천 적립·지갑 invalidate·gb_just_joined 기록은 그대로다(실행 시점·순서 불변).
 */

import { useEffect, useState, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BrandLoader from '@/components/brand/BrandLoader'
import { trackFunnel } from '@/lib/funnel'
import api from '@/lib/api'
import { fireAffiliateTrack } from '@/utils/affiliate-track'
import SEO from '@/components/SEO'
import { useInvalidateMyVouchers } from '@/hooks/queries'
import PaymentCompleteTicket from './group-buy/PaymentCompleteTicket'
import CartComplete from './group-buy/CartComplete'

export default function GroupBuyConfirmPaymentPage() {
  const navigate = useNavigate()
  const invalidateVouchers = useInvalidateMyVouchers()
  const [params] = useSearchParams()
  const [state, setState] = useState<'processing' | 'success' | 'error'>('processing')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const processedRef = useRef(false)
  /** 장바구니 결제의 결과 — 품목이 여럿일 수 있어 서버가 알려 준 것만 쓴다. */
  const [cartDone, setCartDone] = useState<{ qty: number; productIds: number[] } | null>(null)

  const paymentKey = params.get('paymentKey') || ''
  const orderId = params.get('orderId') || ''
  const amount = Number(params.get('amount') || 0)
  const isCart = params.get('cart') === '1'
  const productId = Number(params.get('productId') || 0)
  const qty = Math.max(1, Number(params.get('qty') || 1))

  useEffect(() => {
    if (processedRef.current) return
    if (!paymentKey || !orderId || !amount || (!isCart && !productId)) {
      setErrorMsg('결제 정보가 올바르지 않습니다.')
      setState('error')
      return
    }
    processedRef.current = true

    // 🛡️ 2026-06-11 (갭#3b): success URL 의 ref 를 서버로 — 카드 결제도 추천 적립 동작.
    const ref = params.get('ref') || undefined
    // 🧺 장바구니는 품목을 **안 보낸다** — 서버가 주문번호로 기억하고 있다(`cart-intent.ts`).
    const req = isCart
      ? api.post('/api/group-buy/cart/confirm-toss', { paymentKey, orderId, amount, ref })
      : api.post('/api/group-buy/confirm-toss', { paymentKey, orderId, amount, productId, qty, ref })
    req
      .then((r) => {
        if (r.data?.success) {
          setState('success')
          if (isCart) {
            const d = r.data?.data as { qty?: number; product_ids?: number[] } | undefined
            setCartDone({ qty: Number(d?.qty ?? 0), productIds: Array.isArray(d?.product_ids) ? d!.product_ids! : [] })
          }
          trackFunnel('payment_succeeded', { type: 'group_buy' }) // 🆕 퍼널 계측 (이용권 결제 완료)
          fireAffiliateTrack(r.data?.data?.order_id, Number(productId), undefined) // 큐레이터 적립 (fail-soft)
          invalidateVouchers()
          // 상세로 돌아갔을 때 "방금 샀다" 를 보여 주는 표식 — 단일 구매에만 의미가 있다.
          if (!isCart) {
            try {
              localStorage.setItem('gb_just_joined', JSON.stringify({
                product_id: productId,
                timestamp: Date.now(),
              }))
            } catch { /* */ }
          }
        } else {
          setErrorMsg(r.data?.error || '결제 처리 실패')
          setState('error')
        }
      })
      .catch((err) => {
        const msg = err?.response?.data?.error || err?.message || '결제 승인 중 오류'
        setErrorMsg(msg)
        setState('error')
      })
  }, [paymentKey, orderId, amount, productId, qty, isCart, navigate])

  if (state === 'success') {
    // 🧺 장바구니에서 **한 상품만** 샀으면 기존 티켓 그대로(같은 화면을 두 벌로 만들지 않는다).
    const singleId = cartDone && cartDone.productIds.length === 1 ? cartDone.productIds[0]! : 0
    const ticketId = isCart ? singleId : productId
    return (
      <>
        <SEO title="결제 완료 - 유어딜" url="/group-buy/confirm-payment" noindex />
        {ticketId
          ? <PaymentCompleteTicket productId={ticketId} qty={isCart ? (cartDone?.qty ?? qty) : qty} amount={amount} />
          : <CartComplete qty={cartDone?.qty ?? 0} kinds={cartDone?.productIds.length ?? 0} amount={amount} />}
      </>
    )
  }

  return (
    <div className="min-h-[100dvh] bg-warm flex items-center justify-center px-4">
      <SEO title="공구 결제 처리" url="/group-buy/confirm-payment" noindex />
      <div className="text-center max-w-sm">
        {state === 'processing' && (
          <>
            <BrandLoader label="결제 승인 중" />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">잠시만 기다려주세요</p>
          </>
        )}
        {state === 'error' && (
          <>
            {/* 🎫 아이콘 없이 제목 한 줄 — 시안의 "없는 것을 지킨다"(빨간 X 원 폐기). */}
            <p className="text-[20px] font-extrabold tracking-[-0.02em] text-gray-900 dark:text-white">결제를 완료하지 못했어요</p>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">{errorMsg}</p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-3">고객센터에 문의해주세요.<br/>결제 정보: {orderId.slice(0, 20)}</p>
            <button
              onClick={() => navigate(isCart ? '/cart' : `/pass/${productId}`)}
              className="mt-6 px-6 py-3 bg-brand text-white rounded-full text-sm font-bold active:opacity-80"
            >
              {isCart ? '장바구니로 돌아가기' : '상품 페이지로 돌아가기'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
