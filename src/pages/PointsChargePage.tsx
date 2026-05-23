import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import type { loadTossPayments } from '@tosspayments/tosspayments-sdk'
import { getTossPayments, getTossClientKey } from '@/lib/toss-preload'
import { ArrowLeft, Zap, Loader2, Info, Check } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { getUserIdSync } from '@/utils/auth'
import { formatNumber } from '@/utils/format'
import { useBalance } from '@/hooks/queries'

const clientKey = getTossClientKey()

interface ChargeOption {
  amount: number
  points: number
  label: string
  bonus?: number
  recommended?: boolean
  best?: boolean
}

// 🛡️ 2026-05-22 v3 진짜 영구 해결:
//   - widgets() API 경로 완전 제거 — variantKey 콘솔 등록에 의존해서 404 만들었음.
//   - payment() (V2 redirect) 만 사용 — variant 의존성 0, SDK 보장 동작.
//   - 키 type 검증은 서버가 담당. widget key 면 init 단계에서 'invalid' 반환.
//   - 운영자는 TOSS_CLIENT_KEY 를 'API 개별 연동 키' (live_gck_ / test_gck_) 사용 필수.

// 🛡️ 2026-05-22 v5: 공통 hook 마이그레이션 — useBalance() 사용.
//   localStorage cache / queryKey / mutation invalidation 모두 @/hooks/queries 에서 일원화.

export default function PointsChargePage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  // 공통 hook — 5분 stale + localStorage initialData + dedup.
  const { data: balance = 0 } = useBalance()
  const [options, setOptions] = useState<ChargeOption[]>([])
  const [selected, setSelected] = useState<ChargeOption | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  // SDK 사전 로드 — 페이지 진입 즉시 CDN 다운로드 시작.
  const tossSdkRef = useRef<Awaited<ReturnType<typeof loadTossPayments>> | null>(null)
  const userId = getUserIdSync()

  useEffect(() => {
    if (!userId) { navigate('/login'); return }
    Promise.all([
      api.get('/api/points/charge-options').then(r => {
        if (r.data.success) {
          setOptions(r.data.data)
          setSelected(r.data.data[1] ?? r.data.data[0])
        }
      }).catch((_e) => { if (import.meta.env.DEV) console.warn(_e) }),
      getTossPayments(clientKey).then(sdk => {
        tossSdkRef.current = sdk
      }).catch((_e) => { if (import.meta.env.DEV) console.warn('[Toss] preload failed', _e) }),
    ]).finally(() => setLoading(false))
  }, [userId, navigate])

  async function handleCharge() {
    if (!selected || !userId) return
    setProcessing(true)

    // 🛡️ catch 블록에서 initRes 참조 가능하도록 hoist (TS 스코프 에러 회피).
    let initData: { orderId: string; amount: number; orderName: string; clientKey?: string; flow?: 'widget' | 'redirect' | 'invalid' } | null = null

    // 🛡️ 2026-05-22 영구 해결: handleCharge 진입 시 항상 pending row 선제 cleanup.
    //   사용자 신고: 여전히 409. 원인 — 이전 시도가 SDK 에러로 종료됐지만 cleanup 안 됐을 수 있음.
    //   선제 cleanup → init 항상 깨끗한 상태에서 시작.
    await api.post('/api/points/charge/cancel').catch(() => null)

    try {
      // 첫 init 시도 + 409 자동 처리 + axios 가 던지는 예외 catch.
      const tryInit = async () => {
        try {
          const r = await api.post('/api/points/charge/init', { amount: selected.amount })
          return { ok: true as const, data: r.data }
        } catch (e: unknown) {
          // axios 가 status 4xx/5xx 를 throw — 우리는 응답 body 가 필요.
          const ax = e as { response?: { status?: number; data?: { success?: boolean; error?: string; code?: string } } }
          if (ax?.response?.status === 409) {
            return { ok: false as const, status: 409, data: ax.response?.data }
          }
          throw e
        }
      }

      let initRes = await tryInit()
      // 409 발생 시: 즉시 cancel + 재시도 (최대 2회).
      let retryCount = 0
      while (!initRes.ok || (initRes.data && initRes.data.success === false)) {
        const code = initRes.ok ? initRes.data?.code : initRes.data?.code
        if (code === 'PENDING_CHARGE_EXISTS' && retryCount < 2) {
          retryCount++
          await api.post('/api/points/charge/cancel').catch(() => null)
          // 짧은 backoff (DB 일관성 안정화 대기)
          await new Promise(r => setTimeout(r, 300))
          initRes = await tryInit()
          continue
        }
        const msg = initRes.data?.error || '충전 시작에 실패했습니다.'
        toast.error(msg)
        setProcessing(false)
        return
      }

      // 🛡️ 2026-05-22 v3 (진짜 영구 해결 — widgets() 경로 완전 제거):
      //   이전: 키가 'widget' type 이면 widgets() 호출 → variantKey 콘솔 미등록 시 404.
      //   문제: 어떤 variantKey 도 보장 X (운영자 콘솔 작업 필요). 사용자가 또 갇힘.
      //   해결:
      //     1) payment() (redirect) 만 사용 — variant 의존성 0, SDK 보장 동작.
      //     2) 서버가 key type 검증 후 redirect 가능 여부 반환.
      //     3) 'widget' key 면 init 단계에서 'invalid' 반환 → 즉시 명확한 에러.
      //     4) 사용자는 confusing fallback 없이 1번에 깔끔한 안내.
      initData = initRes.data?.data as { orderId: string; amount: number; orderName: string; clientKey?: string; flow?: 'widget' | 'redirect' | 'invalid'; flow_reason?: string }
      const { orderId, amount, orderName, clientKey: serverClientKey, flow: serverFlow } = initData

      if (serverFlow !== 'redirect' || !serverClientKey) {
        // widget 키 또는 invalid → 사용자에게 명확한 안내. 운영자 콘솔 액션 필요.
        const detail = serverFlow === 'widget'
          ? '결제 시스템 점검 중입니다. 관리자에게 문의해주세요. (Toss 키 type 불일치)'
          : '결제 시스템이 설정되지 않았습니다. 관리자에게 문의해주세요.'
        toast.error(detail)
        await api.post('/api/points/charge/cancel').catch(() => null)
        setProcessing(false)
        return
      }

      // 항상 서버 키로 SDK load (클라이언트 env 무시 — 영구 sync).
      const sdkKey = serverClientKey
      const tossPayments = (tossSdkRef.current && sdkKey === clientKey)
        ? tossSdkRef.current
        : await getTossPayments(sdkKey)
      const sanitizedUserId = String(userId).replace(/[^a-zA-Z0-9\-_=.@]/g, '').substring(0, 44)

      // 단일 경로 — payment() redirect (variant 의존성 0).
      const payment = tossPayments.payment({ customerKey: `user_${sanitizedUserId}` })
      await payment.requestPayment({
        method: 'CARD',
        amount: { currency: 'KRW', value: amount },
        orderId,
        orderName,
        successUrl: `${window.location.origin}/points/charge/success`,
        failUrl: `${window.location.origin}/points/charge?fail=1`,
      })
      // redirect 트리거 — 아래 라인 실행 안 됨.
    } catch (err: unknown) {
      // SDK / 결제 실패 시 pending row 즉시 cleanup → 사용자 갇힘 방지.
      await api.post('/api/points/charge/cancel').catch(() => null)
      const code = (err as { code?: string })?.code
      if (code === 'USER_CANCEL') {
        setProcessing(false)
        return  // 사용자 명시 취소는 토스트 X
      }
      const rawMsg = err instanceof Error ? err.message : ''
      // 키 type 에러 → 운영자 액션 필요. confusing fallback 없이 명확한 안내.
      if (/결제위젯 연동 키|widget.*key|개별 연동 키|widget-groups\/keys/i.test(rawMsg)) {
        toast.error('결제 시스템 점검 중입니다. 관리자에게 문의해주세요.')
      } else {
        toast.error(rawMsg || '결제 준비에 실패했습니다. 잠시 후 다시 시도해주세요.')
      }
      setProcessing(false)
    }
  }

  // 🛡️ handleConfirmPayment 제거 — widgets() in-page 결제 경로 폐기.

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

      {/* 헤더 — 🛡️ 2026-05-22: top-14 (md+) 제거. PC layout 위 빈 공간 깨짐 fix.
            /points/charge 는 fullScreenPrefixes 라 DesktopTopNav 없음 → top-0 통일. */}
      <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0A0A0A]/95 backdrop-blur border-b border-gray-100 dark:border-[#1A1A1A]">
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

        {/* 🛡️ 항상 옵션 카드 표시 — widgets() 경로 제거되어 inline widget UI 불필요. */}
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
      </main>

      {/* 하단 고정 CTA */}
      <div
        className="fixed bottom-0 left-0 right-0 xl:left-56 bg-white dark:bg-[#0A0A0A] border-t border-gray-100 dark:border-[#1A1A1A] z-30"
        style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
      >
        <div className="ur-content-narrow px-4 pt-3">
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
        </div>
      </div>
    </div>
  )
}
