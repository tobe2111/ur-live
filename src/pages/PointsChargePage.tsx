import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { ArrowLeft, Zap, Loader2, Info, Check } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'
import { formatNumber } from '@/utils/format'

const clientKey = import.meta.env.VITE_TOSS_CLIENT_KEY

interface ChargeOption {
  amount: number
  points: number
  label: string
  bonus?: number
  recommended?: boolean
  best?: boolean
}

// 🛡️ 2026-05-22 영구 해결: Toss 키 type 자동 감지 → API 자동 분기.
//   - '_wt_' / '_widget_' prefix = 결제위젯 연동 키 → widgets() API (in-page)
//   - '_gck_' / '_ck_' / 그 외 = 일반 클라이언트 키 → payment() API (redirect)
//   운영자가 Toss 콘솔에서 어떤 키 type 발급해도 코드 변경 없이 동작.
function detectKeyType(key: string | undefined): 'widget' | 'general' {
  if (!key) return 'general'
  return /_wt_|_widget_/i.test(key) ? 'widget' : 'general'
}

export default function PointsChargePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [balance, setBalance] = useState(0)
  const [options, setOptions] = useState<ChargeOption[]>([])
  const [selected, setSelected] = useState<ChargeOption | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showWidget, setShowWidget] = useState(false)
  const widgetsRef = useRef<{
    requestPayment: (p: { orderId: string; orderName: string; successUrl: string; failUrl: string }) => Promise<void>
    setAmount?: (a: { currency: string; value: number }) => Promise<void>
    renderPaymentMethods?: (p: { selector: string; variantKey?: string }) => Promise<void>
    renderAgreement?: (p: { selector: string; variantKey?: string }) => Promise<void>
  } | null>(null)
  const orderRef = useRef<{ orderId: string; orderName: string } | null>(null)
  // SDK 사전 로드 — 페이지 진입 즉시 CDN 다운로드 시작.
  const tossSdkRef = useRef<Awaited<ReturnType<typeof loadTossPayments>> | null>(null)
  const userId = getUserIdSync()

  useEffect(() => {
    if (!userId) { navigate('/login'); return }
    Promise.all([
      api.get('/api/points/balance').then(r => {
        if (r.data.success) setBalance(r.data.data.balance)
      }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }),
      api.get('/api/points/charge-options').then(r => {
        if (r.data.success) {
          setOptions(r.data.data)
          setSelected(r.data.data[1] ?? r.data.data[0])
        }
      }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }),
      loadTossPayments(clientKey).then(sdk => {
        tossSdkRef.current = sdk
      }).catch((_e) => { if (import.meta.env.DEV) console.warn('[Toss] preload failed', _e) }),
    ]).finally(() => setLoading(false))
  }, [userId, navigate])

  // 🛡️ 2026-05-22 영구 해결 (사용자 명령 "영구적이고 이상적으로"):
  //   widget 키 + showWidget 상태일 때 widgets() API 로 in-page 결제 위젯 렌더.
  //   variant 미등록 콘솔도 'DEFAULT' fallback 으로 동작 (Toss V2 SDK 자동 생성).
  useEffect(() => {
    if (!showWidget || !selected || !userId || !tossSdkRef.current) return
    if (!orderRef.current) return

    const sanitizedUserId = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)
    let cancelled = false

    ;(async () => {
      try {
        // V2 widgets API.
        const sdk = tossSdkRef.current!
        const widgets = (sdk as unknown as {
          widgets: (p: { customerKey: string }) => {
            setAmount: (a: { currency: string; value: number }) => Promise<void>
            renderPaymentMethods: (p: { selector: string; variantKey?: string }) => Promise<void>
            renderAgreement: (p: { selector: string; variantKey?: string }) => Promise<void>
            requestPayment: (p: { orderId: string; orderName: string; successUrl: string; failUrl: string }) => Promise<void>
          }
        }).widgets({ customerKey: `user_${sanitizedUserId}` })

        await widgets.setAmount({ currency: 'KRW', value: selected.amount })

        // variantKey 'DEFAULT' — Toss V2 가 콘솔 미등록 시 자동 생성하는 기본 variant.
        // 실패 시 variantKey 생략 (legacy fallback).
        try {
          await widgets.renderPaymentMethods({ selector: '#charge-payment-method', variantKey: 'DEFAULT' })
        } catch {
          if (cancelled) return
          await widgets.renderPaymentMethods({ selector: '#charge-payment-method' })
        }
        try {
          await widgets.renderAgreement({ selector: '#charge-agreement', variantKey: 'AGREEMENT' })
        } catch {
          if (cancelled) return
          await widgets.renderAgreement({ selector: '#charge-agreement' })
        }

        if (!cancelled) widgetsRef.current = widgets
      } catch (err) {
        if (cancelled) return
        console.error('[Toss widgets] render failed', err)
        toast.error('결제 위젯 로드 실패. 페이지를 새로고침해주세요.')
        setShowWidget(false)
        await api.post('/api/points/charge/cancel').catch(() => null)
      }
    })()

    return () => { cancelled = true }
  }, [showWidget, selected, userId])

  async function handleCharge() {
    if (!selected || !userId) return
    setProcessing(true)

    // 🛡️ catch 블록에서 initRes 참조 가능하도록 hoist (TS 스코프 에러 회피).
    let initData: { orderId: string; amount: number; orderName: string; clientKey?: string } | null = null

    try {
      const initRes = await api.post('/api/points/charge/init', { amount: selected.amount })
      if (!initRes.data.success) {
        // 409 PENDING_CHARGE_EXISTS 자동 cleanup 후 1회 retry.
        if (initRes.data.code === 'PENDING_CHARGE_EXISTS') {
          await api.post('/api/points/charge/cancel').catch(() => null)
          const retry = await api.post('/api/points/charge/init', { amount: selected.amount }).catch(() => null)
          if (!retry?.data?.success) {
            toast.error('이전 충전 시도가 끝나지 않았습니다. 1분 후 다시 시도해주세요.')
            setProcessing(false)
            return
          }
          initRes.data = retry.data
        } else {
          toast.error(initRes.data.error || '충전 시작에 실패했습니다.')
          setProcessing(false)
          return
        }
      }

      initData = initRes.data.data as { orderId: string; amount: number; orderName: string; clientKey?: string }
      const { orderId, amount, orderName, clientKey: serverClientKey } = initData
      const effectiveKey = serverClientKey || clientKey
      const keyType = detectKeyType(effectiveKey)

      // 🛡️ 2026-05-22 영구 해결 분기:
      //   - widget 키 → in-page 위젯 렌더링 (useEffect 가 처리)
      //   - general 키 → V2 redirect API (Toss 호스팅 페이지)
      //   양쪽 다 결제 성공 후 successUrl 로 복귀 동일.
      if (keyType === 'widget') {
        orderRef.current = { orderId, orderName }
        setShowWidget(true)
        setProcessing(false)
        return
      }

      // general 키 — redirect 흐름.
      const tossPayments = (tossSdkRef.current && (serverClientKey === clientKey || !serverClientKey))
        ? tossSdkRef.current
        : await loadTossPayments(effectiveKey)
      const sanitizedUserId = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)
      const payment = tossPayments.payment({ customerKey: `user_${sanitizedUserId}` })
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: amount },
        orderId,
        orderName,
        successUrl: `${window.location.origin}/points/charge/success`,
        failUrl: `${window.location.origin}/points/charge?fail=1`,
      })
      // requestPayment 가 redirect 트리거 — 아래 라인은 실행 안 됨.
    } catch (err: unknown) {
      // SDK / 결제 실패 시 pending row 즉시 cleanup → 사용자 갇힘 방지.
      await api.post('/api/points/charge/cancel').catch(() => null)
      const code = (err as { code?: string })?.code
      if (code === 'USER_CANCEL') {
        setProcessing(false)
        return  // 사용자 명시 취소는 토스트 X
      }
      const rawMsg = err instanceof Error ? err.message : ''
      // Toss SDK 키 type 에러 → 위젯 모드로 자동 전환 시도 (사용자 갇힘 영구 차단).
      if (/결제위젯 연동 키|widget.*key|개별 연동 키/i.test(rawMsg) && initData) {
        toast.error('결제 위젯 모드로 전환합니다…')
        orderRef.current = { orderId: initData.orderId, orderName: initData.orderName }
        setShowWidget(true)
      } else {
        toast.error(rawMsg || '결제 준비에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
      setProcessing(false)
    }
  }

  async function handleConfirmPayment() {
    const widgets = widgetsRef.current
    if (!widgets || !orderRef.current) return

    setProcessing(true)
    try {
      await widgets.requestPayment({
        orderId: orderRef.current.orderId,
        orderName: orderRef.current.orderName,
        successUrl: `${window.location.origin}/points/charge/success`,
        failUrl: `${window.location.origin}/points/charge?fail=1`,
      })
    } catch (err: unknown) {
      setProcessing(false)
      const code = (err as Record<string, string>)?.code
      if (code === 'USER_CANCEL') return
      const msg = err instanceof Error ? err.message : '결제 요청에 실패했습니다.'
      toast.error(msg)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-[#0A0A0A] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400 dark:text-gray-500" />
      </div>
    )
  }

  const pointsPreview = selected?.points ?? 0

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#121212]">
      <SEO title={t('pointsCharge.seoTitle', { defaultValue: '딜 충전 - 유어딜' })} description={t('pointsCharge.seoDesc', { defaultValue: '딜 포인트를 충전하세요' })} url="/points/charge" noindex />

      {/* 헤더 */}
      <header className="sticky top-0 md:top-14 z-40 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
        <div className="ur-content-narrow flex items-center justify-between px-4 lg:px-8 h-[52px]">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center"
            aria-label={t('pointsCharge.back', { defaultValue: '뒤로가기' })}
          >
            <ArrowLeft className="w-5 h-5 text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-[15px] font-bold text-gray-900 dark:text-white">{t('pointsCharge.title', { defaultValue: '딜 충전' })}</h1>
          <div className="w-9" />
        </div>
      </header>

      <main className="ur-content-narrow px-4 lg:px-8 pt-5 pb-28 space-y-4">
        {/* 현재 잔액 카드 */}
        <section className="relative overflow-hidden rounded-2xl p-5 bg-gradient-to-br from-pink-500 via-rose-500 to-red-500 text-white shadow-md">
          <div className="absolute -right-6 -top-6 w-28 h-28 rounded-full bg-white dark:bg-[#0A0A0A]/10" aria-hidden="true" />
          <div className="absolute -right-10 -bottom-10 w-32 h-32 rounded-full bg-white dark:bg-[#0A0A0A]/5" aria-hidden="true" />
          <div className="relative">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-4 h-4 fill-white" strokeWidth={0} />
              <span className="text-[12px] font-semibold opacity-90">{t('pointsCharge.balance', { defaultValue: '내 딜 잔액' })}</span>
            </div>
            <p className="text-[32px] font-extrabold leading-none tracking-tight">
              {formatNumber(balance)}
              <span className="text-[16px] font-bold ml-1">딜</span>
            </p>
            <p className="text-[11px] font-medium opacity-80 mt-2">{t('pointsCharge.rate', { defaultValue: '1원 = 1딜 · 수수료 없음' })}</p>
          </div>
        </section>

        {!showWidget && (
          <>
            {/* 충전 금액 선택 */}
            <section>
              <div className="flex items-baseline justify-between mb-3 px-1">
                <h2 className="text-[14px] font-bold text-gray-900 dark:text-white">{t('pointsCharge.selectTitle', { defaultValue: '충전 금액' })}</h2>
                <span className="text-[11px] text-gray-500 dark:text-gray-400">{t('pointsCharge.selectHint', { defaultValue: '원하는 금액을 선택하세요' })}</span>
              </div>
              {/* 사용자 요청: 효과 다 제거 — 통일된 단일 스타일. */}
              <div className="grid grid-cols-2 gap-2">
                {options.map(opt => {
                  const isSelected = selected?.amount === opt.amount
                  return (
                    <button
                      key={opt.amount}
                      onClick={() => setSelected(opt)}
                      className={`relative flex flex-col items-center justify-center py-5 rounded-2xl border-2 transition-all ${
                        isSelected
                          ? 'border-pink-500 bg-pink-50 dark:bg-pink-500/10 ring-2 ring-pink-200 dark:ring-pink-500/30'
                          : 'border-gray-200 dark:border-[#2A2A2A] bg-white dark:bg-[#0A0A0A] hover:border-gray-300 dark:hover:border-[#3A3A3A]'
                      }`}
                      aria-label={`${formatNumber(opt.amount)}원 충전`}
                    >
                      {isSelected && (
                        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-pink-500 flex items-center justify-center">
                          <Check className="w-3 h-3 text-white" strokeWidth={3} />
                        </span>
                      )}
                      <p className={`text-[18px] font-extrabold ${isSelected ? 'text-pink-600' : 'text-gray-900 dark:text-white'}`}>
                        {formatNumber(opt.amount)}
                        <span className="text-[12px] font-bold ml-0.5">원</span>
                      </p>
                      <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 mt-1">
                        {formatNumber(opt.points)}딜
                      </p>
                    </button>
                  )
                })}
              </div>
            </section>

            {/* 충전 후 잔액 미리보기 */}
            {selected && (
              <section className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-4">
                <div className="flex items-center justify-between text-[13px]">
                  <span className="text-gray-500 dark:text-gray-400">{t('pointsCharge.currentBalance', { defaultValue: '현재 잔액' })}</span>
                  <span className="font-semibold text-gray-900 dark:text-white">{formatNumber(balance)}딜</span>
                </div>
                <div className="flex items-center justify-between text-[13px] mt-2">
                  <span className="text-gray-500 dark:text-gray-400">{t('pointsCharge.chargeDeals', { defaultValue: '충전 딜' })}</span>
                  <span className="font-semibold text-pink-600">+{formatNumber(pointsPreview)}딜</span>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-[#1A1A1A] flex items-center justify-between">
                  <span className="text-[13px] font-bold text-gray-900 dark:text-white">{t('pointsCharge.afterBalance', { defaultValue: '충전 후 잔액' })}</span>
                  <span className="text-[18px] font-extrabold text-gray-900 dark:text-white">
                    {formatNumber(balance + pointsPreview)}
                    <span className="text-[13px] font-bold ml-0.5">딜</span>
                  </span>
                </div>
              </section>
            )}

            {/* 안내 */}
            <section className="flex gap-2.5 px-3 py-3 rounded-xl bg-amber-50 border border-amber-100">
              <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" strokeWidth={2} />
              <div className="text-[12px] leading-relaxed">
                <p className="font-semibold text-amber-800">{t('pointsCharge.noRefund', { defaultValue: '충전된 딜은 환불이 불가합니다' })}</p>
                <p className="text-amber-700 mt-0.5">
                  {t('pointsCharge.usageNote', { defaultValue: '라이브 방송 후원 및 상품 결제에만 사용 가능합니다.' })}
                </p>
              </div>
            </section>
          </>
        )}

        {/* 결제 위젯 (widget 키 type 일 때만 in-page 렌더) */}
        {showWidget && (
          <>
            <section className="bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-4">
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-gray-500 dark:text-gray-400">{t('pointsCharge.chargeHistory', { defaultValue: '충전 내역' })}</span>
                <div className="text-right">
                  <p className="text-[16px] font-extrabold text-gray-900 dark:text-white">
                    {formatNumber(selected?.amount)}
                    <span className="text-[12px] font-bold ml-0.5">원</span>
                  </p>
                  <p className="text-[11px] font-semibold text-pink-600">
                    → {formatNumber(selected?.points)}딜
                  </p>
                </div>
              </div>
            </section>

            <div id="charge-payment-method" className="min-h-[200px] bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-2" />
            <div id="charge-agreement" className="min-h-[80px] bg-white dark:bg-[#0A0A0A] rounded-2xl border border-gray-100 dark:border-[#1A1A1A] p-2" />

            <p className="text-[11px] text-center text-amber-700 font-semibold">
              {t('pointsCharge.paymentNoRefund', { defaultValue: '결제 완료 시 충전된 딜은 환불이 불가합니다.' })}
            </p>
          </>
        )}
      </main>

      {/* 하단 고정 CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 xl:left-56 bg-white dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-[#1A1A1A] z-30"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="ur-content-narrow px-4 pt-3">
          {showWidget ? (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  setShowWidget(false)
                  widgetsRef.current = null
                  orderRef.current = null
                  await api.post('/api/points/charge/cancel').catch(() => null)
                }}
                className="w-24 py-3.5 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 text-[14px] font-bold rounded-full hover:bg-gray-200 dark:hover:bg-[#2A2A2A] transition-colors"
              >
                {t('pointsCharge.prev', { defaultValue: '이전' })}
              </button>
              <button
                onClick={handleConfirmPayment}
                disabled={processing}
                className="flex-1 py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[15px] font-bold rounded-full shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all"
              >
                {processing ? (
                  <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                ) : (
                  t('pointsCharge.payBtn', { amount: formatNumber(selected?.amount), defaultValue: '{{amount}}원 결제' })
                )}
              </button>
            </div>
          ) : (
            <button
              onClick={handleCharge}
              disabled={!selected || processing}
              className="w-full py-3.5 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[15px] font-bold rounded-full shadow-sm disabled:opacity-50 active:scale-[0.98] transition-all"
            >
              {processing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('pointsCharge.preparing', { defaultValue: '결제 준비 중…' })}
                </span>
              ) : (
                t('pointsCharge.chargeBtn', { deals: formatNumber(pointsPreview), defaultValue: '{{deals}}딜 충전하기' })
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
