/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 의 딜 잔액 카드.
 */
import { useEffect, useState } from 'react'
import { Coins, ScrollText } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { formatNumber } from '@/utils/format'
import { TOPUP_DISABLED } from '@/shared/feature-flags'

export default function TeamPointsCard() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [balance, setBalance] = useState(0)
  // 💸 2026-07-05 버킷: 무상(리워드) 딜 — 사용은 자유, 현금 환급 제외 (약관). 0 이면 표기 생략.
  const [freeBalance, setFreeBalance] = useState(0)
  const [loading, setLoading] = useState(true)
  // 🛡️ 2026-07-02: 에러 구분 — 실패를 "0딜"로 위장하지 않음(— 표시 + 재시도).
  const [error, setError] = useState(false)

  const fetchBalance = () => {
    import('@/lib/api').then(({ default: api }) => {
      setError(false)
      api.get('/api/points/balance')
        .then(r => {
          if (r.data.success) {
            setBalance(r.data.data.balance)
            setFreeBalance(Math.max(0, Number(r.data.data.free_balance ?? 0)))
          } else setError(true)
        })
        .catch(() => { setError(true) })
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    fetchBalance()
    const handler = () => fetchBalance()
    window.addEventListener('pointsBalanceChanged', handler)
    return () => window.removeEventListener('pointsBalanceChanged', handler)
  }, [])

  const isEmpty = !loading && !error && balance === 0

  return (
    <div className="ur-content-medium px-4 lg:px-8 py-3">
      {/* 🎯 2026-08-30: 마이에서 **강조는 이것 하나**다.
          바탕이 웜 화이트로 내려가고 나머지 그룹이 흰 카드가 됐으므로, 자산(딜 잔액)만
          잉크 배경으로 띄운다. 이전엔 여덟 블록이 전부 같은 회색이라 화면이 무엇을
          먼저 보라고 말하지 않았다 — 강조가 없는 게 아니라 **전부 강조**여서 그랬다. */}
      <div className="bg-ink dark:bg-[#1A1C21] rounded-2xl px-5 py-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <Coins className="w-6 h-6 text-white/60 dark:text-gray-400" aria-hidden="true" />
            <div>
              <p className="text-[11px] text-white/60 dark:text-gray-400 font-medium">{t('my.dealBalance', { defaultValue: '내 딜 잔액' })}</p>
              <p className="text-lg font-bold text-white">
                {loading ? (
                  <span className="inline-block w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                ) : error ? (
                  <button type="button" onClick={fetchBalance} className="text-sm font-semibold text-white/70 dark:text-gray-400 underline underline-offset-2">
                    {t('my.balanceRetry', { defaultValue: '잔액 다시 불러오기' })}
                  </button>
                ) : `${formatNumber(balance)}딜`}
              </p>
              {!loading && !error && freeBalance > 0 && (
                <p className="text-[10px] text-white/50 dark:text-gray-500 mt-0.5">
                  {t('my.freeDealNote', {
                    defaultValue: '무상 리워드 {{free}}딜 포함 · 환급 가능 {{paid}}딜',
                    free: formatNumber(freeBalance),
                    paid: formatNumber(Math.max(0, balance - freeBalance)),
                  })}
                </p>
              )}
            </div>
          </div>
        </div>
        {/* 🛡️ 2026-05-24: 충전 + 내역 보기 2버튼
            🛡️ 2026-07-18 (대표 "충전 자체를 빼자"): TOPUP_DISABLED 시 충전 버튼 숨김 → 내역 풀폭. */}
        <div className={`grid ${TOPUP_DISABLED ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
          {!TOPUP_DISABLED && (
          <button
            type="button"
            onClick={() => navigate('/points/charge')}
            className="ur-btn ur-btn-sm ur-btn-block text-ink dark:text-gray-900 bg-white dark:bg-white"
          >
            {t('my.charge', { defaultValue: '충전하기' })}
          </button>
          )}
          {/* 💤 2026-08-31: 잔액이 0 인데 화면에서 **가장 강한 검정 카드**가 그 0 을 강조하고,
              버튼은 '사용 내역'(볼 내역이 없다)이었다. 값이 없을 때 자산 카드가 할 일은
              숫자를 크게 보여 주는 게 아니라 **채우러 가는 길**을 주는 것이다. */}
          <button
            type="button"
            onClick={() => navigate(isEmpty ? '/map' : '/my-deal-history')}
            className="ur-btn ur-btn-sm ur-btn-block text-white dark:text-gray-200 bg-white/[0.14] dark:bg-white/[0.06]"
          >
            {isEmpty ? (
              t('my.earnDeal', { defaultValue: '딜 모으러 가기' })
            ) : (
              <>
                <ScrollText className="w-3.5 h-3.5 inline-block align-[-2px] mr-1" aria-hidden="true" />{t('my.dealHistory', { defaultValue: '사용 내역' })}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
