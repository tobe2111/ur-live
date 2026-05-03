import { useState, useEffect } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { Ticket, CheckCircle, Clock, XCircle, Loader2, Lock } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'

interface StoreStats {
  product_name: string
  restaurant_name: string
  total_vouchers: number
  used: number
  unused: number
  expired: number
  group_buy_current: number
  group_buy_target: number
}

export default function StoreStatsPage() {
  const { productId } = useParams<{ productId: string }>()
  const [searchParams] = useSearchParams()
  const magicToken = searchParams.get('t')?.trim() || ''
  const [pin, setPin] = useState('')
  const [authenticated, setAuthenticated] = useState(false)
  const [stats, setStats] = useState<StoreStats | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function authenticate(opts?: { token?: string }) {
    const useToken = opts?.token || magicToken
    if (!useToken && !pin.trim()) return
    setLoading(true)
    setError('')
    try {
      const url = useToken
        ? `/api/group-buy/store-stats/${productId}?t=${encodeURIComponent(useToken)}`
        : `/api/group-buy/store-stats/${productId}`
      const res = await api.post(url, useToken ? {} : { pin: pin.trim() })
      if (res.data.success) {
        setStats(res.data.data)
        setAuthenticated(true)
      } else {
        setError(res.data.error || '인증 실패')
      }
    } catch (err: unknown) {
      const err_ = err as { response?: { data?: { error?: string }; status?: number } }
      setError(err_.response?.data?.error || '인증에 실패했습니다')
    } finally {
      setLoading(false)
    }
  }

  // 🛡️ 2026-04-27: Magic Link — ?t=token 이 있으면 자동 인증.
  useEffect(() => {
    if (magicToken && !authenticated && !loading && !stats) {
      authenticate({ token: magicToken })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [magicToken])

  // Magic Link 토큰으로 자동 인증 중 — 로딩 화면
  if (magicToken && !authenticated && !error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-5">
        <SEO title="식당 통계" description="공동구매 식당 통계 페이지" url={`/store/stats/${productId ?? ''}`} noindex />
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-orange-500 animate-spin mx-auto mb-4" />
          <p className="text-sm text-gray-500">매장 인증 중...</p>
        </div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-5">
        <SEO title="식당 통계" description="공동구매 식당 통계 페이지" url={`/store/stats/${productId ?? ''}`} noindex />
        <div className="w-full max-w-sm text-center">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-orange-100 flex items-center justify-center">
            <Lock className="w-7 h-7 text-orange-600" />
          </div>
          <h1 className="text-lg font-extrabold text-gray-900 mb-1">식당 통계</h1>
          <p className="text-sm text-gray-500 mb-2">사장님께 알림톡으로 발송된 링크로 접속하시면 비밀번호 없이 바로 확인할 수 있어요.</p>
          <p className="text-xs text-gray-400 mb-6">또는 인플루언서에게 받은 비밀번호를 입력하세요</p>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg p-3 mb-4">{error}</p>}

          <input
            value={pin}
            onChange={e => setPin(e.target.value)}
            type="password"
            placeholder="비밀번호 입력"
            className="w-full px-4 py-3.5 border border-gray-300 rounded-xl text-center text-lg text-gray-900 tracking-widest focus:border-orange-400 focus:outline-none focus:ring-2 focus:ring-orange-100 mb-4"
            onKeyDown={e => e.key === 'Enter' && authenticate()}
          />
          <button
            onClick={() => authenticate()}
            disabled={!pin.trim() || loading}
            className="w-full py-3.5 bg-gradient-to-r from-orange-500 to-pink-500 text-white font-bold rounded-xl disabled:opacity-40"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : '확인'}
          </button>
        </div>
      </div>
    )
  }

  if (!stats) return null

  const usedPercent = stats.total_vouchers > 0 ? Math.round((stats.used / stats.total_vouchers) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-50 px-5 py-8">
      <SEO title={`${stats.restaurant_name || '식당'} 통계`} description={`${stats.product_name} 공동구매 식당 통계`} url={`/store/stats/${productId ?? ''}`} noindex />
      <div className="ur-content-narrow">
        {/* 헤더 */}
        <div className="text-center mb-6">
          <h1 className="text-xl font-extrabold text-gray-900">{stats.restaurant_name || '식당'}</h1>
          <p className="text-sm text-gray-500 mt-1">{stats.product_name}</p>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-2 gap-3 mb-5">
          {[
            { label: '사용 완료', value: stats.used, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
            { label: '미사용', value: stats.unused, icon: Ticket, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '만료됨', value: stats.expired, icon: XCircle, color: 'text-gray-500', bg: 'bg-gray-100' },
            { label: '총 발급', value: stats.total_vouchers, icon: Clock, color: 'text-orange-600', bg: 'bg-orange-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-500">{s.label}</span>
                <div className={`w-7 h-7 ${s.bg} rounded-lg flex items-center justify-center`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
              </div>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* 사용률 바 */}
        <div className="bg-white rounded-xl p-5 border border-gray-200 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-gray-900">바우처 사용률</span>
            <span className="text-sm font-bold text-green-600">{usedPercent}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${usedPercent}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-2">{stats.used}장 사용 / {stats.total_vouchers}장 발급</p>
        </div>

        {/* 공동구매 현황 */}
        <div className="bg-white rounded-xl p-5 border border-gray-200">
          <h3 className="text-sm font-bold text-gray-900 mb-3">공동구매 현황</h3>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-gray-500">참여자</span>
            <span className="text-sm font-bold text-pink-600">{stats.group_buy_current}/{stats.group_buy_target}명</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="h-full bg-pink-500 rounded-full" style={{ width: `${stats.group_buy_target > 0 ? Math.min(100, (stats.group_buy_current / stats.group_buy_target) * 100) : 0}%` }} />
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">유어딜 · 식당 공동구매 서비스</p>
      </div>
    </div>
  )
}
