/**
 * 🛡️ 2026-05-01: TD-018 분할 — UserProfilePage 의 딜 잔액 카드.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatNumber } from '@/utils/format'

export default function TeamPointsCard() {
  const navigate = useNavigate()
  const [balance, setBalance] = useState(0)
  const [loading, setLoading] = useState(true)

  const fetchBalance = () => {
    import('@/lib/api').then(({ default: api }) => {
      api.get('/api/points/balance')
        .then(r => { if (r.data.success) setBalance(r.data.data.balance) })
        .catch(() => { setLoading(false) })
        .finally(() => setLoading(false))
    })
  }

  useEffect(() => {
    fetchBalance()
    const handler = () => fetchBalance()
    window.addEventListener('pointsBalanceChanged', handler)
    return () => window.removeEventListener('pointsBalanceChanged', handler)
  }, [])

  return (
    <div className="ur-content-medium px-4 lg:px-8 py-3">
      <div className="bg-gray-50 dark:bg-[#121212] rounded-2xl px-5 py-4 border border-gray-200 dark:border-[#2A2A2A]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🎁</span>
            <div>
              <p className="text-[11px] text-gray-500 font-medium">내 딜 잔액</p>
              <p className="text-lg font-bold text-gray-900 dark:text-white">
                {loading ? <span className="inline-block w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" /> : `${formatNumber(balance)}딜`}
              </p>
            </div>
          </div>
        </div>
        {/* 🛡️ 2026-05-24: 충전 + 내역 보기 2버튼 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => navigate('/points/charge')}
            className="py-2 text-xs font-bold text-white dark:text-gray-900 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 rounded-lg active:scale-[0.98] transition-all"
          >
            충전하기
          </button>
          <button
            type="button"
            onClick={() => navigate('/my-deal-history')}
            className="py-2 text-xs font-bold text-gray-700 dark:text-gray-200 bg-white dark:bg-white/[0.06] hover:bg-gray-100 dark:hover:bg-white/[0.12] rounded-lg border border-gray-200 dark:border-[#2A2A2A] active:scale-[0.98] transition-all"
          >
            📋 사용 내역
          </button>
        </div>
      </div>
    </div>
  )
}
