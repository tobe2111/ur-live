import { useEffect, useState, useRef } from 'react'
import { safeInternalPath } from '@/utils/safe-internal-path'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import BrandLoader from '@/components/brand/BrandLoader'
import { CheckCircle, Zap, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { formatNumber } from '@/utils/format'
import { useSetBalance } from '@/hooks/queries'
import { TOPUP_DISABLED } from '@/shared/feature-flags'

export default function PointsChargeSuccessPage() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const setBalance = useSetBalance()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ points_added: number; balance: number } | null>(null)
  const isProcessingRef = useRef(false)

  const paymentKey = searchParams.get('paymentKey')
  const orderId = searchParams.get('orderId')
  const amount = searchParams.get('amount')

  useEffect(() => {
    if (!paymentKey || !orderId || !amount) {
      setError(t('pointsCharge.invalidPayment', { defaultValue: '결제 정보가 유효하지 않습니다.' }))
      setLoading(false)
      return
    }
    if (isProcessingRef.current) return
    isProcessingRef.current = true

    async function confirm() {
      try {
        const res = await api.post('/api/points/charge/confirm', {
          paymentKey,
          orderId,
          amount: Number(amount),
        })
        if (res.data.success) {
          setResult(res.data.data)
          // 🛡️ 2026-05-22 v5: 공통 hook setBalance — React Query cache + localStorage 동시 갱신.
          //   다음 페이지 진입 시 새 잔액 즉시 반영 (서버 호출 X).
          setBalance(Number(res.data.data?.balance ?? 0))
        } else {
          setError(res.data.error || t('pointsCharge.confirmFailed', { defaultValue: '충전 확인에 실패했습니다.' }))
        }
      } catch (err: unknown) {
        const err_ = err as { response?: { data?: { error?: string }; status?: number } }
        setError(err_.response?.data?.error || t('pointsCharge.processingError', { defaultValue: '충전 처리 중 오류가 발생했습니다.' }))
      } finally {
        setLoading(false)
        isProcessingRef.current = false
      }
    }

    confirm()
  }, [paymentKey, orderId, amount])

  if (loading) {
    // 🎯 2026-07-18 로딩 단일화 — 유어딜 BrandLoader(SEO 는 head 로 렌더되므로 형제 배치).
    return (
      <>
        <SEO title={t('pointsCharge.processingTitle', { defaultValue: '딜 충전 처리' })} description={t('pointsCharge.processingDesc', { defaultValue: '딜 포인트 충전 처리 중' })} url="/points/charge/success" noindex />
        <BrandLoader fullScreen label={t('pointsCharge.processingMsg', { defaultValue: '충전을 처리하는 중...' })} />
      </>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0D0F12] flex items-center justify-center p-4">
        <SEO title={t('pointsCharge.failTitle', { defaultValue: '딜 충전 실패' })} description={t('pointsCharge.failDesc', { defaultValue: '딜 포인트 충전에 실패했습니다' })} url="/points/charge/success" noindex />
        <div className="max-w-md w-full text-center bg-white dark:bg-[#0D0F12] rounded-2xl p-8 shadow-lg border border-gray-100 dark:border-[#2C2F35]">
          <p className="text-red-600 mb-4">{error}</p>
          {/* 🚪 2026-08-11 (AB 스윕): 이 화면은 **막다른 길**이었다 — 헤더·네비 없이 텍스트 한 줄과
              `다시 시도` 버튼뿐인데, 그 버튼이 보내는 `/points/charge` 는 2026-07-18 딜 충전 종료
              (`TOPUP_DISABLED`) 이후 "충전이 종료됐어요" 안내만 띄운다. 즉 실패한 사람이 누를 수 있는
              유일한 버튼이 또 다른 막다른 화면이었다. 충전이 살아 있을 때만 재시도를 권하고,
              **어느 경우든 나갈 문(메인)은 항상 둔다.** */}
          <div className="flex flex-col gap-2">
            {!TOPUP_DISABLED && (
              <button onClick={() => navigate('/points/charge')} className="px-6 py-3 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white rounded-xl font-bold">
                {t('common.retry', { defaultValue: '다시 시도' })}
              </button>
            )}
            <button onClick={() => navigate('/')} className={TOPUP_DISABLED
              ? 'px-6 py-3 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white rounded-xl font-bold'
              : 'px-6 py-3 text-gray-600 dark:text-gray-300 font-semibold'}>
              {t('common.goHome', { defaultValue: '메인으로' })}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fbfbfd] dark:bg-[#0D0F12] flex items-center justify-center p-4">
      <SEO title={t('pointsCharge.successTitle', { defaultValue: '딜 충전 완료' })} description={t('pointsCharge.successDesc', { defaultValue: '딜 포인트 충전이 완료되었습니다' })} url="/points/charge/success" noindex />
      <div className="max-w-md w-full bg-white dark:bg-[#0D0F12] rounded-2xl p-8 shadow-lg text-center border border-gray-100 dark:border-[#2C2F35]">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
          <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
        </div>
        <h1 className="text-2xl font-extrabold text-gray-900 dark:text-white mb-2">{t('pointsCharge.successHeading', { defaultValue: '충전 완료!' })}</h1>
        {/* 🎨 2026-06-17: 분홍 그라데이션 → 프리미엄 다크 카드(교환권/잔액 카드 톤) + 브랜드 옐로우 액센트 */}
        <div className="rounded-2xl p-5 my-6" style={{ background: 'linear-gradient(135deg,#211d3a 0%,#15131f 45%,#050505 100%)' }}>
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Zap className="w-4 h-4 text-[#d1d5db]" />
            <span className="text-[12px] text-white/55">{t('pointsCharge.chargedDeals', { defaultValue: '충전된 딜' })}</span>
          </div>
          <p className="text-[34px] font-extrabold text-white leading-none tracking-tight">+{formatNumber(result?.points_added)}<span className="text-[20px] font-bold ml-0.5">딜</span></p>
          <p className="text-[12px] text-white/55 mt-2.5">{t('pointsCharge.successBalance', { balance: formatNumber(result?.balance), defaultValue: '현재 잔액: {{balance}}딜' })}</p>
        </div>
        {/* 🔗 2026-07-03 [UNLOCK_LOADING] (대표 승인 "1~4번 전부, 가장 이상적으로" — 딜포인트 락인 강화):
              충전 직후는 float→spend 전환의 최적 순간인데 기존 CTA(이전 화면/추가 충전)엔 '쓰러 가기'가
              없어 잔액이 유휴로 남았음(소진 유인 0 = 락인 약화). 방금 충전한 딜을 즉시 이용권/교환권
              카탈로그에서 쓰도록 유도 → 소비 습관 형성. **가짜 보너스 없음**(2026-05-22 대표의 '맞지도 않는
              보너스 제거' 방침 준수) — 이미 보유한 실잔액을 쓰라는 정직한 넛지만. 충전 confirm/잔액 로직
              byte-불변(additive CTA). 단, '딜 부족→충전' 복귀 루프(loginReturnUrl)면 원래 결제로 돌아가야
              하므로 그 경우엔 이 스팬드 CTA 대신 복귀를 우선(끊기지 않게). */}
        {(() => { try { return !localStorage.getItem('loginReturnUrl') } catch { return true } })() && (
          <button
            onClick={() => navigate('/vouchers')}
            className="w-full py-3.5 mb-3 bg-gray-900 hover:bg-black dark:bg-white dark:text-gray-900 text-white rounded-xl font-bold"
          >
            {t('pointsCharge.spendNow', { defaultValue: '지금 이용권 사러 가기 →' })}
          </button>
        )}
        <div className="flex gap-3">
          <button
            onClick={() => {
              // 🛡️ 2026-06-11 (플로우 감사 갭#4): '딜 부족 → 충전' 진입 시 저장된 복귀 경로 우선 —
              //   기존 navigate(-2) 고정은 히스토리 깊이에 따라 비결정(이어서-참여 루프 끊김).
              const saved = (() => { try { return localStorage.getItem('loginReturnUrl') } catch { return null } })()
              if (saved) {
                try { localStorage.removeItem('loginReturnUrl') } catch { /* */ }
                navigate(safeInternalPath(saved, '/'))
                return
              }
              navigate(-2)
            }}
            className="flex-1 py-3 bg-gray-100 dark:bg-[#1A1C21] text-gray-700 dark:text-gray-200 rounded-xl font-bold"
          >
            {t('pointsCharge.goBack', { defaultValue: '이전 화면으로' })}
          </button>
          <button
            onClick={() => navigate('/points/charge')}
            className="flex-1 py-3 bg-gray-100 dark:bg-[#1A1A1A] text-gray-700 dark:text-gray-200 rounded-xl font-bold"
          >
            {t('pointsCharge.chargeMore', { defaultValue: '추가 충전' })}
          </button>
        </div>
      </div>
    </div>
  )
}
