import { useEffect, useState } from 'react'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Rocket, Zap, Clock } from 'lucide-react'

interface Boost {
  id: number
  agency_id: number
  agency_name: string | null
  seller_id: number
  tier: 'bronze' | 'silver' | 'gold'
  duration_hours: number
  status: 'unused' | 'active' | 'consumed' | 'expired'
  issued_at: string
  expires_at: string
  used_at: string | null
  used_live_id: number | null
  boost_ends_at: string | null
  note: string | null
}

interface ActiveLive {
  id: number
  title: string
}

const TIER_META: Record<string, { label: string; emoji: string; bg: string; hours: number }> = {
  bronze: { label: '브론즈', emoji: '🥉', bg: 'bg-amber-50 border-amber-300', hours: 12 },
  silver: { label: '실버',   emoji: '🥈', bg: 'bg-slate-50 border-slate-300', hours: 24 },
  gold:   { label: '골드',   emoji: '🥇', bg: 'bg-yellow-50 border-yellow-400', hours: 48 },
}

export default function SellerPromoteBoostsPage() {
  const [items, setItems] = useState<Boost[]>([])
  const [loading, setLoading] = useState(true)
  const [activeLive, setActiveLive] = useState<ActiveLive | null>(null)

  async function fetchAll() {
    setLoading(true)
    try {
      const token = localStorage.getItem('seller_token')
      const headers = { Authorization: `Bearer ${token}` }
      const r = await api.get('/api/seller/promote-boosts', { headers })
      if (r.data?.success) setItems(r.data.data)
      // 활성 라이브 조회
      try {
        const live = await api.get('/api/seller/streams?status=live', { headers })
        if (live.data?.data?.[0]) setActiveLive({ id: live.data.data[0].id, title: live.data.data[0].title })
      } catch { /* skip */ }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '불러오기 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  async function activate(boost: Boost) {
    if (!activeLive) {
      return toast.error('활성 라이브가 필요합니다. 먼저 라이브를 시작하세요.')
    }
    if (!confirm(`${TIER_META[boost.tier].emoji} ${TIER_META[boost.tier].label} 쿠폰을 "${activeLive.title}" 라이브에 ${boost.duration_hours}시간 활성화하시겠습니까?`)) return
    try {
      const token = localStorage.getItem('seller_token')
      await api.post(`/api/seller/promote-boosts/${boost.id}/activate`,
        { live_id: activeLive.id },
        { headers: { Authorization: `Bearer ${token}` } })
      toast.success('🚀 부스팅 활성화! 메인 피드 상단 노출 시작.')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '활성화 실패')
    }
  }

  const unused = items.filter(b => b.status === 'unused')
  const others = items.filter(b => b.status !== 'unused')

  return (
    <SellerLayout title="노출 부스팅">
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title="노출 부스팅 쿠폰"
          subtitle="에이전시가 발급한 부스팅 쿠폰. 라이브 시작 시 활성화하면 메인 피드 상단 노출!"
          icon={<Rocket className="h-5 w-5" />}
        />

        {!activeLive && unused.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
            ⚠️ 부스팅 쿠폰을 사용하려면 먼저 <strong>라이브를 시작</strong>해주세요.
          </div>
        )}

        {/* 사용 가능 쿠폰 */}
        {unused.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">📨 사용 가능 ({unused.length}건)</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {unused.map(b => {
                const meta = TIER_META[b.tier]
                return (
                  <div key={b.id} className={`rounded-xl p-4 border-2 ${meta.bg}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl">{meta.emoji}</span>
                      <span className="text-xs text-gray-500">{b.duration_hours}시간</span>
                    </div>
                    <div className="text-sm font-bold text-gray-900 mb-1">{meta.label} 부스팅</div>
                    <div className="text-xs text-gray-500 mb-3">발급: {b.agency_name || '에이전시'} · {b.expires_at?.slice(0, 10)} 만료</div>
                    {b.note && <div className="text-xs text-gray-600 mb-3 italic">"{b.note}"</div>}
                    <button
                      onClick={() => activate(b)}
                      disabled={!activeLive}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-300 disabled:to-gray-400 text-white text-xs font-bold rounded-lg"
                    >
                      <Zap className="w-3.5 h-3.5" />
                      {activeLive ? '지금 활성화' : '라이브 필요'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* 사용 / 만료 내역 */}
        {others.length > 0 && (
          <div>
            <h3 className="text-sm font-bold text-gray-900 mb-3">📋 사용/만료 ({others.length}건)</h3>
            <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-100">
              {others.map(b => {
                const meta = TIER_META[b.tier]
                return (
                  <div key={b.id} className="p-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span>{meta.emoji}</span>
                      <span className="font-medium">{meta.label}</span>
                      <span className="text-gray-500">· {b.duration_hours}h</span>
                    </div>
                    <div className="text-gray-500">
                      {b.status === 'active' ? <span className="text-red-600 font-bold">🔴 활성 중</span> : b.status === 'consumed' ? '사용 완료' : '만료'}
                      <span className="ml-2">{(b.used_at || b.expires_at)?.slice(0, 10)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {!loading && items.length === 0 && (
          <div className="text-center text-sm text-gray-400 py-12 bg-white rounded-xl border border-gray-100">
            아직 받은 부스팅 쿠폰이 없습니다. 에이전시에 문의해보세요.
          </div>
        )}
      </div>
    </SellerLayout>
  )
}
