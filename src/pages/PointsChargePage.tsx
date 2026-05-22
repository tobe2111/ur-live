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

export default function PointsChargePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [balance, setBalance] = useState(0)
  const [options, setOptions] = useState<ChargeOption[]>([])
  const [selected, setSelected] = useState<ChargeOption | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showWidget, setShowWidget] = useState(false)
  const widgetsRef = useRef<unknown>(null)
  const orderRef = useRef<{ orderId: string; orderName: string } | null>(null)
  // 🛡️ 2026-05-19 perf: Toss SDK 사전 로드 — 페이지 진입 즉시 CDN 다운로드 시작.
  //   사용자 클릭 시점엔 이미 캐시되어 있음 → 1500ms 절감.
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
      // 🛡️ 2026-05-19 perf: 페이지 진입 즉시 Toss SDK eager-load (1500ms 절감).
      //   사용자 충전 클릭 시 cache hit → 즉시 widgets() 호출 가능.
      loadTossPayments(clientKey).then(sdk => {
        tossSdkRef.current = sdk
      }).catch((_e) => { if (import.meta.env.DEV) console.warn('[Toss] preload failed', _e) }),
    ]).finally(() => setLoading(false))
  }, [userId, navigate])

  // 🛡️ 2026-05-19 v6: 기존 인페이지 widget 렌더 useEffect 제거.
  //   handleCharge 가 payment() API 로 직접 redirect → 본 useEffect 가 트리거되지 않음.
  //   widget variant 의존성 ZERO → 더 이상 404 발생 불가.

  async function handleCharge() {
    if (!selected || !userId) return
    setProcessing(true)

    try {
      const initRes = await api.post('/api/points/charge/init', { amount: selected.amount })
      if (!initRes.data.success) {
        // 🛡️ 2026-05-22: 409 PENDING_CHARGE_EXISTS 자동 cleanup 후 1회 retry.
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

      const { orderId, amount, orderName, clientKey: serverClientKey } = initRes.data.data
      const effectiveKey = serverClientKey || clientKey

      // 🛡️ 2026-05-22 SDK 키 검증 — '결제위젯 연동 키' (_wt_) 는 payment() V2 API 거부.
      //   서버 환경변수 VITE_TOSS_CLIENT_KEY 가 'live_gck_' / 'test_gck_' (일반 클라이언트 키) 여야 함.
      //   잘못된 키 type 이면 SDK 에러 메시지 그대로 사용자 노출 → 친절한 안내로 교체.
      if (typeof effectiveKey === 'string' && /_wt_|_widget_/i.test(effectiveKey)) {
        toast.error('결제 시스템 설정 오류 — 관리자에게 문의해주세요. (TOSS_CLIENT_KEY 가 "API 개별 연동 키" 이어야 합니다)')
        await api.post('/api/points/charge/cancel').catch(() => null)
        setProcessing(false)
        return
      }

      const tossPayments = (tossSdkRef.current && (serverClientKey === clientKey || !serverClientKey))
        ? tossSdkRef.current
        : await loadTossPayments(effectiveKey)
      const sanitizedUserId = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)

      // V2 redirect API — Toss 호스팅 페이지로 이동, 결제 후 successUrl 복귀.
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
      // 🛡️ 2026-05-22: SDK / 결제 실패 시 pending row 즉시 cleanup → 사용자 갇힘 방지.
      await api.post('/api/points/charge/cancel').catch(() => null)
      const code = (err as { code?: string })?.code
      if (code === 'USER_CANCEL') {
        setProcessing(false)
        return  // 사용자 명시 취소는 토스트 X
      }
      const rawMsg = err instanceof Error ? err.message : ''
      // Toss SDK 키 type 에러 패턴 — 친절한 안내로 교체.
      if (/결제위젯 연동 키|widget.*key|개별 연동 키/i.test(rawMsg)) {
        toast.error('결제 시스템 설정 오류 — 관리자에게 문의해주세요.')
      } else {
        toast.error(rawMsg || '결제 준비에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
      setProcessing(false)
    }
  }

  async function handleConfirmPayment() {
    const widgets = widgetsRef.current as { requestPayment: Function } | null
    if (!widgets || !orderRef.current) return

    setProcessing(true)
    try {
      await widgets.requestPayment({
        orderId: orderRef.current.orderId,
        orderName: orderRef.current.orderName,
        successUrl: `${window.location.origin}/points/charge/success`,
        failUrl: `${window.location.origin}/points/charge/fail`,
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
  const bonusPoints = selected?.bonus ?? 0

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
              {/* 🛡️ 2026-05-22 사용자 요청: 효과 다 제거 — 통일된 단일 스타일.
                  - 보너스 badge 제거 (실제 지급 안 되던 표시)
                  - best/recommended 차별 색상 제거
                  - 선택된 카드만 pink 강조, 나머지는 default 동일.
                  - JSX 0 렌더 버그 (hasBonus && <span>) 도 자동 해결. */}
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

        {/* 결제 위젯 */}
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

      {/* 하단 고정 CTA — 🛡️ PC xl+ 사이드바 (224px) 우측부터 시작 */}
      <div
        className="fixed bottom-0 left-0 right-0 xl:left-56 bg-white dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-[#1A1A1A] z-30"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="ur-content-narrow px-4 pt-3">
          {showWidget ? (
            <div className="flex gap-2">
              <button
                onClick={() => { setShowWidget(false); widgetsRef.current = null; orderRef.current = null }}
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
