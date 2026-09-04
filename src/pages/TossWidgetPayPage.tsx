import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Loader2, ArrowLeft } from 'lucide-react'
import SEO from '@/components/SEO'
import { getTossPayments } from '@/lib/toss-preload'
import { getUserIdSync } from '@/utils/auth'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { cfImage, cfImageOnError } from '@/utils/cf-image'
import { readPaySummary, displayDiscountPct } from '@/shared/pay-summary'

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
 *   - image / merchant / origAmount / qty / dealUsed: **표시 전용** 요약 (2026-09-03 대표 확정 "안 2-D").
 *       금액 판단에 쓰지 않는다 — 실제 청구액은 /confirm 이 서버 값으로 재검증한다.
 *       SSOT·이유: `src/shared/pay-summary.ts`
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
  // 🧾 표시 전용 요약(사진·매장·정가·수량). 없으면 그 항목만 생략되고 화면은 그대로 뜬다.
  const summary = readPaySummary((k) => searchParams.get(k))
  const discountPct = displayDiscountPct(amount, summary.origAmount)
  /**
   * 표시 전용 — 딜이 섞였을 때의 **상품 금액**(카드 청구액 + 딜 사용액).
   * ⚠️ 이름이 `display` 로 시작하는 건 규약이다: 요약에서 파생된 숫자는 화면용이고
   *   청구액은 끝까지 `amount` 하나다(테스트가 그 이름 규약을 강제한다).
   */
  const displayGoodsAmount = summary.dealUsed ? amount + summary.dealUsed : 0

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
        // 🧾 2026-09-01 [UNLOCK] (대표 승인 "허가 — 문구만 수정"): 소비자 문장만 교체.
        //   이 화면은 **이용권 결제의 유일한 화면**이다(상세 → /pay/widget → confirm-payment).
        //   여기서 영문 SDK 원본과 운영자용 콘솔 지시를 보여 주면, 결제가 막힌 사람이
        //   할 수 있는 일이 하나도 없다. 원인 값은 위 console.error 가 남긴다.
        //   ⚠️ 분기 조건·상태 전이는 그대로 — 문자열만.
        setErrorMsg(
          /TIMEOUT/i.test(raw)
            ? '결제창을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
            : /not.*found|404|variant/i.test(raw)
            ? '지금은 결제를 진행할 수 없습니다. 잠시 후 다시 시도하거나 다른 결제 수단을 이용해주세요.'
            : '결제를 시작하지 못했습니다. 잠시 후 다시 시도해주세요.',
        )
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
    <div className="min-h-screen bg-gray-50 dark:bg-[#11141C]">
      <SEO title="결제 - 유어딜" description="안전한 결제" url="/pay/widget" noindex />

      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#1D1F29]/95 backdrop-blur border-b border-gray-100 dark:border-[#2C2F35]">
        <div className="ur-content-narrow flex items-center justify-between px-4 lg:px-8 h-[52px]">
          <button onClick={() => navigate(-1)} className="w-9 h-9 flex items-center justify-center" aria-label="뒤로">
            <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">결제</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 lg:px-8 py-5 space-y-4 pb-32">
        {/* 🧾 주문 요약 — 2026-09-03 대표 확정 "안 2-D"
            사진 + 매장·상품·할인, 그 아래 **큰 숫자로 결제 금액**. 결제 화면에서 사람이 마지막으로
            확인하는 것은 "얼마인가" 하나인데, 종전엔 그 숫자가 상품명보다 작고 아래에 있었다.
            요약 값이 하나도 안 넘어오면(구 링크·셀러 결제) 사진 칸이 사라지고 예전 모양으로 내려앉는다.
            표면 규칙(09-02): 흰 카드 + 들림 하나, 카드 테두리 0. */}
        <section className="bg-white dark:bg-[#1D1F29] rounded-2xl shadow-lift p-4">
          <div className="flex items-start gap-3">
            {summary.image && (
              <div className="w-[76px] h-[76px] shrink-0 rounded-xl overflow-hidden bg-gray-100 dark:bg-[#222225]">
                <img
                  src={cfImage(summary.image, { width: 200, format: 'auto' }) || summary.image}
                  alt=""
                  width={200}
                  height={200}
                  loading="eager"
                  decoding="async"
                  className="w-full h-full object-cover"
                  onError={(e) => cfImageOnError(e.currentTarget, summary.image)}
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              {summary.merchant
                ? <p className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{summary.merchant}</p>
                : <p className="text-[11px] text-gray-400 dark:text-gray-500">결제 상품</p>}
              <p className="text-[14px] font-bold leading-snug text-gray-900 dark:text-white line-clamp-2">{orderName || '—'}</p>
              {(discountPct > 0 || summary.qty) && (
                <p className="mt-1 flex items-baseline gap-1 text-[12px]">
                  {discountPct > 0 && <span className="font-extrabold text-brand-text">{discountPct}%</span>}
                  {discountPct > 0 && summary.origAmount && (
                    <span className="line-through text-gray-400 dark:text-gray-500">{summary.origAmount.toLocaleString('ko-KR')}원</span>
                  )}
                  {summary.qty && <span className="text-gray-400 dark:text-gray-500">· {summary.qty}개</span>}
                </p>
              )}
            </div>
          </div>
          {/* 🪙 부분결제 — 왜 청구액이 상품값보다 적은지 화면이 말한다.
              값은 서버 `/join` 이 계산해 준 것이고(화면 추정 아님), 없으면 이 블록 자체가 안 뜬다.
              합이 딱 맞는 게 이 화면의 계약이다: 딜 + 카드 = 상품 금액. */}
          {summary.dealUsed ? (
            <div className="mt-3 pt-3 border-t border-rule space-y-1">
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="text-gray-400 dark:text-gray-500">상품 금액</span>
                <span className="tabular-nums text-gray-600 dark:text-gray-300">{displayGoodsAmount.toLocaleString('ko-KR')}원</span>
              </div>
              <div className="flex items-baseline justify-between text-[12.5px]">
                <span className="text-gray-400 dark:text-gray-500">딜 사용</span>
                <span className="tabular-nums font-semibold text-brand-text">−{summary.dealUsed.toLocaleString('ko-KR')}딜</span>
              </div>
            </div>
          ) : null}
          <div className="mt-3 pt-3 border-t border-rule flex items-baseline justify-between">
            <span className="text-[12.5px] text-gray-400 dark:text-gray-500">{summary.dealUsed ? '카드 결제' : '결제 금액'}</span>
            <span className="text-[27px] font-extrabold tracking-tight tabular-nums text-gray-900 dark:text-white">
              {Number.isFinite(amount) ? amount.toLocaleString('ko-KR') : '0'}
              <span className="text-[17px] font-bold ml-0.5">원</span>
            </span>
          </div>
          <p className="mt-2.5 pt-2.5 border-t border-rule text-[11.5px] text-gray-500 dark:text-gray-400">
            토스로 안전결제 · 미사용 시 100% 자동환불
          </p>
        </section>

        {/* 결제 위젯 mount points
            🧾 2026-09-01 [UNLOCK] (대표 승인 "허가 — 상자만 숨김"): SDK 가 못 뜨면 이 두 자리가 **빈 테두리
            상자**로 남아 비활성 버튼 위에 떠 있었다. error 일 때만 숨긴다 — id·순서·loading/ready 렌더는 그대로라
            SDK 마운트 계약 불변. */}
        {/* 🏝️ 토스 위젯 자리 — **늘 밝다.** 위젯은 토스가 자기 마크업으로 흰색으로 그리고,
            우리 코드가 넘기는 건 selector 와 variantKey 뿐이라 테마 옵션이 없다(2026-09-03 실측).
            그래서 다크에서도 이 상자만 흰 카드로 남는다 — `light-island` 로 **의도임을 못 박는다**:
            ① 안쪽 `dark:` 유틸이 꺼지고 ② 전역 `.dark input`(특이도 0,5,1)이 위젯의 이메일 입력을
            흰 글자로 덮는 것을 막는다(2026-09-03 지도 검색창이 정확히 그 사고였다).
            ⚠️ id·순서·hidden 은 SDK 마운트 계약 — byte-불변. */}
        <div id="toss-widget-pay-method" hidden={state === 'error'} className="light-island min-h-[180px] bg-white rounded-2xl shadow-lift overflow-hidden" />
        <div id="toss-widget-pay-agreement" hidden={state === 'error'} className="light-island min-h-[60px] bg-white rounded-2xl shadow-lift overflow-hidden" />

        {state === 'error' && errorMsg && (
          <div className="p-4 bg-tone-bad-bg rounded-2xl">
            <p className="text-[13px] font-medium text-tone-bad">{errorMsg}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-[12px] text-brand-text underline font-medium">
              페이지 새로고침
            </button>
          </div>
        )}
      </main>

      {/* 하단 결제하기 버튼 */}
      <div
        className="fixed bottom-0 left-0 right-0 xl:left-56 app-frame-bar bg-white dark:bg-[#1D1F29] border-t border-gray-100 dark:border-[#2C2F35] z-30"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="ur-content-narrow px-4 pt-3">
          <button
            onClick={handlePay}
            disabled={state !== 'ready'}
            /* 🎨 2026-09-03 (대표 확정 안 2-D): 검정 → 브랜드 블루.
               화면에서 가장 강한 행동이 브랜드 색이어야 한다(표면 규칙 ②).
               ⚠️ 색만 바뀐다 — onClick·disabled·상태별 라벨 전부 byte-불변. */
            className="w-full py-3.5 bg-brand hover:bg-brand-dark text-white text-[15px] font-bold rounded-full disabled:opacity-50 active:scale-[0.98] transition-all"
          >
            {state === 'loading' && (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                결제창을 준비하고 있어요
              </span>
            )}
            {state === 'processing' && (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                결제 진행 중...
              </span>
            )}
            {state === 'ready' && `${Number.isFinite(amount) ? amount.toLocaleString('ko-KR') : '0'}원 결제하기`}
            {state === 'error' && '지금은 결제할 수 없어요'}
          </button>
        </div>
      </div>
    </div>
  )
}
