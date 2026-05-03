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
    <div className="ur-content-medium px-5 lg:px-8 py-3">
      <button
        type="button"
        onClick={() => navigate('/points/charge')}
        className="w-full text-left flex items-center justify-between bg-[#121212] rounded-2xl px-5 py-4 cursor-pointer active:scale-[0.98] transition-all border border-[#2A2A2A]"
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎁</span>
          <div>
            <p className="text-[11px] text-gray-500 font-medium">내 딜 잔액</p>
            <p className="text-lg font-bold text-white">
              {loading ? <span className="inline-block w-16 h-5 bg-gray-700 rounded animate-pulse" /> : `${formatNumber(balance)}딜`}
            </p>
          </div>
        </div>
        <span className="px-3 py-1.5 text-xs font-bold text-pink-400 bg-pink-500/10 rounded-lg border border-pink-500/30">
          충전
        </span>
      </button>
    </div>
  )
}
