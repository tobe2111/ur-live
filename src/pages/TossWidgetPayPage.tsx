import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import SEO from '@/components/SEO'
import { getTossPayments } from '@/lib/toss-preload'
import { getUserIdSync } from '@/utils/auth'
import { safeInternalPath } from '@/utils/safe-internal-path'

type TossWidgets = ReturnType<Awaited<ReturnType<typeof getTossPayments>>['widgets']>

/**
 * 🛡️ 2026-05-23: Toss 결제위젯 (_wt_ 키) 전용 공용 결제 페이지.
 *
 * 배경: PointsCharge / GroupBuyDetail 가 payment() V2 redirect 만 지원 →
 *   운영자 키가 _wt_ (widget) 면 결제 자체가 막힘.
 *   해결: init 응답 flow='widget' 인 경우 본 페이지로 navigate → widgets() API in-page 렌더.
 *
 * URL params:
 *   - orderId: server-issued orderId
 *   - amount: 결제 금액 (KRW)
 *   - orderName: 결제 상품명
 *   - successUrl / failUrl: Toss 가 redirect 할 URL (internal path 만 허용)
 *   - clientKey: server 가 반환한 토스 client key (env 와 sync 보장)
 *
 * 보안:
 *   - successUrl / failUrl 은 safeInternalPath() 통과 — open redirect 차단
 *   - amount / orderId 형식 검증
 */
export default function TossWidgetPayPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [state, setState] = useState<'loading' | 'ready' | 'processing' | 'error'>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const initializedRef = useRef(false)
  const widgetsRef = useRef<TossWidgets | null>(null)

  const orderId = searchParams.get('orderId') || ''
  const amountStr = searchParams.get('amount') || ''
  const orderName = searchParams.get('orderName') || ''
  const successUrlRaw = searchParams.get('successUrl') || ''
  const failUrlRaw = searchParams.get('failUrl') || ''
  const clientKey = searchParams.get('clientKey') || ''
  const amount = Number(amountStr)

  // safeInternalPath: 내부 경로만 허용 — open redirect 차단.
  const successUrl = `${window.location.origin}${safeInternalPath(successUrlRaw, '/')}`
  const failUrl = `${window.location.origin}${safeInternalPath(failUrlRaw, '/')}`

  useEffect(() => {
    if (initializedRef.current) return
    if (!orderId || !Number.isFinite(amount) || amount <= 0 || !orderName || !clientKey) {
      setErrorMsg('결제 정보가 올바르지 않습니다.')
      setState('error')
      return
    }
    const userId = getUserIdSync()
    if (!userId) {
      navigate('/login')
      return
    }
    initializedRef.current = true

    // 🛡️ 2026-05-23 영구 fix — 단계별 timeout (silent hang 방어).
    // ⚡ 2026-07-02 [UNLOCK] (대표 승인 — 결제 체감속도): 8000 → 4000ms — 주문 위젯(TossPaymentWidget:114)과 정합.
    const STEP_TIMEOUT_MS = 4000
    const withTimeout = <T,>(p: Promise<T>, label: string): Promise<T> =>
      Promise.race([
        p,
        new Promise<T>((_, rej) =>
          setTimeout(() => rej(new Error(`[TIMEOUT:${label}] ${STEP_TIMEOUT_MS}ms 초과`)), STEP_TIMEOUT_MS),
        ),
      ])

    let cancelled = false
    ;(async () => {
      try {
        // ⚡ 2026-07-02 [UNLOCK] (대표 승인 — 결제 체감속도): variantKey 조회를 SDK 로드와 **병렬** 시작.
        //   기존엔 렌더 시퀀스 중간에 직렬 await — 이 왕복(~200-400ms)이 renderPaymentMethods 를 막았음.
        //   응답 의미/fallback(빈값 → build-time VITE_TOSS_VARIANT_*) 불변 — 시작 시점만 앞당김.
        const variantPromise: Promise<{ p: string; a: string }> = (async () => {
          try {
            const r = await fetch('/api/payments/client-key', { cache: 'no-store' })
            const j = await r.json() as { data?: { variant_payment?: string; variant_agreement?: string } }
            return { p: String(j?.data?.variant_payment || ''), a: String(j?.data?.variant_agreement || '') }
          } catch { return { p: '', a: '' } /* server fetch 실패 — build-time fallback 사용 */ }
        })()

        const sdk = await withTimeout(getTossPayments(clientKey), 'SDK_LOAD')
        if (cancelled) return
        const sanitized = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)
        const widgets = sdk.widgets({ customerKey: `user_${sanitized}`.substring(0, 50) })
        if (!widgets) throw new Error('widgets() returned null')

        await withTimeout(widgets.setAmount({ currency: 'KRW', value: Math.round(amount) }), 'SET_AMOUNT')

        // 🛡️ 2026-05-24: server-side variantKey 우선 (TOSS_VARIANT_PAYMENT/AGREEMENT env) — 위에서 병렬 시작한
        //   variantPromise 를 여기서 소비 (SDK 로드/setAmount 와 이미 겹쳐 실행됨). 지연/실패 시 빈값 → build-time fallback.
        const sv = await withTimeout(variantPromise, 'VARIANT_KEY').catch(() => ({ p: '', a: '' }))
        const VK_PAYMENT = sv.p || ((import.meta.env.VITE_TOSS_VARIANT_PAYMENT as string) || '')
        const VK_AGREEMENT = sv.a || ((import.meta.env.VITE_TOSS_VARIANT_AGREEMENT as string) || '')

        // Toss V2 SDK: variantKey 옵션 — 미설정 시 SDK 내부 default ('DEFAULT') 사용.
        //   콘솔에 해당 variantKey 등록 안 됐으면 404 → 사용자가 콘솔에서 직접 추가 필요.
        const tryRender = async (
          method: 'renderPaymentMethods' | 'renderAgreement',
          selector: string,
          preferred: string,
        ) => {
          if (preferred) {
            try { await withTimeout(widgets[method]({ selector, variantKey: preferred }) as unknown as Promise<void>, `${method}:${preferred}`); return } catch { /* fallback to default */ }
          }
          await withTimeout(widgets[method]({ selector }) as unknown as Promise<void>, `${method}:default`)
        }
        await tryRender('renderPaymentMethods', '#toss-widget-pay-method', VK_PAYMENT)
        // ⚡ 2026-07-02 [UNLOCK] (대표 승인 — 결제 체감속도): 약관 위젯은 **비대기** — 주문 위젯
        //   (TossPaymentWidget:170)과 동일 패턴. 버튼은 결제수단 렌더 즉시 활성(이 페이지 버튼은 원래
        //   약관에 안 묶임 — 미동의 결제는 Toss requestPayment 가 NEED_AGREEMENT 로 강제 차단).
        tryRender('renderAgreement', '#toss-widget-pay-agreement', VK_AGREEMENT)
          .catch(() => { /* 백그라운드 렌더 실패 — requestPayment 의 Toss 강제가 백스톱 */ })

        if (cancelled) return
        widgetsRef.current = widgets
        setState('ready')
      } catch (err: unknown) {
        if (cancelled) return
        console.error('[TossWidgetPay] init failed:', err)
        const raw = err instanceof Error ? err.message : String(err)
        const baseMsg = /TIMEOUT/i.test(raw)
          ? '결제 위젯 로딩이 지연됩니다. 페이지를 새로고침해주세요.'
          : /not.*found|404|variant/i.test(raw)
          ? '결제 수단이 Toss 콘솔에 등록되어 있지 않습니다. Toss 콘솔 → 결제 → 결제수단 → "결제수단 활성화" 후 다시 시도해주세요.'
          : '결제 초기화 실패'
        setErrorMsg(`${baseMsg}\n\n[SDK 원본]: ${raw.slice(0, 200)}`)
        setState('error')
      }
    })()

    return () => { cancelled = true }
  }, [orderId, amount, orderName, clientKey, navigate])

  async function handlePay() {
    if (!widgetsRef.current || state !== 'ready') return
    setState('processing')
    try {
      // 🛡️ 2026-05-24: Toss V2 SDK 권장 — customer 정보 (가상계좌 안내 / 퀵계좌이체 자동완성).
      //   localStorage 에서 안전하게 추출 (XSS 방어 위해 길이 제한).
      const customerEmail = (localStorage.getItem('user_email') || '').slice(0, 100) || undefined
      const customerName = (localStorage.getItem('user_name') || '').slice(0, 100) || undefined
      // phone — '-' 제거 + 8-15 숫자만 (Toss V2 SDK 사양).
      const phoneRaw = (localStorage.getItem('user_phone') || '').replace(/\D/g, '')
      const customerMobilePhone = /^\d{8,15}$/.test(phoneRaw) ? phoneRaw : undefined

      await widgetsRef.current.requestPayment({
        orderId,
        orderName: orderName.length > 100 ? orderName.slice(0, 97) + '...' : orderName,
        successUrl,
        failUrl,
        ...(customerEmail ? { customerEmail } : {}),
        ...(customerName ? { customerName } : {}),
        ...(customerMobilePhone ? { customerMobilePhone } : {}),
      })
      // redirect — 아래 라인 실행 안 됨.
    } catch (err: unknown) {
      const errObj = err as { code?: string; message?: string }
      if (errObj?.code === 'USER_CANCEL') {
        setState('ready')
        return
      }
      setErrorMsg(errObj?.message || '결제 요청 실패')
      setState('error')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SEO title="결제 - 유어딜" description="안전한 결제" url="/pay/widget" noindex />

      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-gray-100">
        <div className="ur-content-narrow flex items-center justify-between px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center" aria-label="뒤로">
            <ArrowLeft className="w-5 h-5 text-gray-900" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900">결제</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 lg:px-8 py-5 space-y-4 pb-32">
        {/* 주문 요약 */}
        <section className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-[12px] text-gray-500 mb-1">결제 상품</p>
          <p className="text-[15px] font-bold text-gray-900">{orderName || '—'}</p>
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-[13px] text-gray-500">결제 금액</span>
            <span className="text-[20px] font-extrabold text-gray-900">
              {Number.isFinite(amount) ? amount.toLocaleString('ko-KR') : '0'}
              <span className="text-[14px] font-bold ml-0.5">원</span>
            </span>
          </div>
        </section>

        {/* 결제 위젯 mount points */}
        <div id="toss-widget-pay-method" className="min-h-[180px] bg-white rounded-2xl border border-gray-100 overflow-hidden" />
        <div id="toss-widget-pay-agreement" className="min-h-[60px] bg-white rounded-2xl border border-gray-100 overflow-hidden" />

        {state === 'error' && errorMsg && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
            <p className="text-[13px] font-medium text-red-800">{errorMsg}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-[12px] text-blue-600 underline font-medium">
              페이지 새로고침
            </button>
          </div>
        )}
      </main>

      {/* 하단 결제하기 버튼 */}
      <div
        className="fixed bottom-0 left-0 right-0 xl:left-56 app-frame-bar bg-white border-t border-gray-100 z-30"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="ur-content-narrow px-4 pt-3">
          <button
            onClick={handlePay}
            disabled={state !== 'ready'}
            className="w-full py-3.5 bg-gradient-to-r from-gray-800 to-gray-800 text-white text-[15px] font-bold rounded-full shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {state === 'loading' && (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                결제 시스템 로딩 중...
              </span>
            )}
            {state === 'processing' && (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                결제 진행 중...
              </span>
            )}
            {state === 'ready' && `${Number.isFinite(amount) ? amount.toLocaleString('ko-KR') : '0'}원 결제하기`}
            {state === 'error' && '결제 시스템 오류'}
          </button>
        </div>
      </div>
    </div>
  )
}
