import { useEffect, useState } from 'react'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Swords, Plus, Trophy, X, Play, XCircle } from 'lucide-react'

interface Battle {
  id: number
  seller_a_id: number
  seller_b_id: number
  seller_a_name: string | null
  seller_b_name: string | null
  seller_a_image: string | null
  seller_b_image: string | null
  duration_minutes: number
  status: string
  started_at: string | null
  ends_at: string | null
  revenue_a: number
  revenue_b: number
  winner_seller_id: number | null
  created_at: string
}

interface Seller {
  id: number
  business_name: string
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '대기', cls: 'bg-gray-100 text-gray-600' },
  live: { label: '🔴 진행 중', cls: 'bg-red-100 text-red-700' },
  ended: { label: '종료', cls: 'bg-blue-100 text-blue-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-500' },
}

export default function AgencyPKBattlesPage() {
  const [items, setItems] = useState<Battle[]>([])
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [sellerA, setSellerA] = useState<number | ''>('')
  const [sellerB, setSellerB] = useState<number | ''>('')
  const [duration, setDuration] = useState(30)

  async function fetchAll() {
    setLoading(true)
    try {
      const token = localStorage.getItem('agency_token')
      const headers = { Authorization: `Bearer ${token}` }
      const [battlesRes, sellersRes] = await Promise.all([
        api.get('/api/agency/pk', { headers }),
        api.get('/api/agency/sellers', { headers }).catch(() => ({ data: { data: [] } })),
      ])
      if (battlesRes.data.success) setItems(battlesRes.data.data)
      if (sellersRes.data?.data) setSellers(sellersRes.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '불러오기 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  async function createBattle() {
    if (!sellerA || !sellerB || sellerA === sellerB) {
      toast.error('서로 다른 셀러 2명을 선택하세요')
      return
    }
    setCreating(true)
    try {
      const token = localStorage.getItem('agency_token')
      const r = await api.post('/api/agency/pk', {
        seller_a_id: Number(sellerA),
        seller_b_id: Number(sellerB),
        duration_minutes: duration,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (r.data.success) {
        toast.success('PK 매칭 생성 완료. 두 셀러가 라이브 시작 후 PK 시작 버튼을 누르세요.')
        setSellerA(''); setSellerB('')
        fetchAll()
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '생성 실패')
    } finally { setCreating(false) }
  }

  async function startBattle(id: number) {
    if (!confirm('PK 를 지금 시작하시겠습니까? 두 셀러가 모두 라이브 중이어야 합니다.')) return
    try {
      const token = localStorage.getItem('agency_token')
      await api.post(`/api/agency/pk/${id}/start`, {}, { headers: { Authorization: `Bearer ${token}` } })
      toast.success('PK 시작!')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '시작 실패')
    }
  }

  async function cancelBattle(id: number) {
    if (!confirm('PK 를 취소하시겠습니까?')) return
    try {
      const token = localStorage.getItem('agency_token')
      await api.post(`/api/agency/pk/${id}/cancel`, {}, { headers: { Authorization: `Bearer ${token}` } })
      toast.info('PK 취소됨')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '취소 실패')
    }
  }

  return (
    <AgencyLayout title="PK 이벤트">
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title="PK 이벤트"
          subtitle="셀러 vs 셀러 매출 경쟁. 시청자 응원=결제로 우승자 결정. 매출 평균 60% 증가."
          icon={<Swords className="h-5 w-5" />}
        />

        {/* 매칭 폼 */}
        <div className="bg-white rounded-xl p-5 border border-gray-100">
          <h3 className="text-sm font-bold text-gray-900 mb-3">새 PK 매칭</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs text-gray-600 mb-1">셀러 A</label>
              <select
                value={sellerA}
                onChange={(e) => setSellerA(e.target.value ? Number(e.target.value) : '')}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
              >
                <option value="">선택...</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id} disabled={s.id === sellerB}>{s.business_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">셀러 B</label>
              <select
                value={sellerB}
                onChange={(e) => setSellerB(e.target.value ? Number(e.target.value) : '')}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
              >
                <option value="">선택...</option>
                {sellers.map(s => (
                  <option key={s.id} value={s.id} disabled={s.id === sellerA}>{s.business_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-600 mb-1">지속 시간</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
              >
                <option value={15}>15분</option>
                <option value={30}>30분</option>
                <option value={60}>60분</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                onClick={createBattle}
                disabled={creating || !sellerA || !sellerB}
                className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 disabled:bg-gray-300 text-white text-sm font-bold rounded-lg"
              >
                <Plus className="w-4 h-4" /> 매칭 생성
              </button>
            </div>
          </div>
        </div>

        {/* 목록 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">PK 내역</h3>
            <span className="text-xs text-gray-500">{items.length}건</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">아직 PK 매칭이 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map(b => {
                const winner = b.winner_seller_id === b.seller_a_id ? 'A'
                  : b.winner_seller_id === b.seller_b_id ? 'B' : null
                const status = STATUS_LABEL[b.status] || STATUS_LABEL.pending
                return (
                  <div key={b.id} className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${status.cls}`}>
                        {status.label}
                      </span>
                      <span className="text-xs text-gray-500">
                        {b.duration_minutes}분 · {new Date(b.created_at).toLocaleDateString('ko-KR')}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 items-center gap-2">
                      <SellerCard
                        name={b.seller_a_name}
                        image={b.seller_a_image}
                        revenue={b.revenue_a}
                        isWinner={winner === 'A'}
                      />
                      <div className="text-center">
                        <div className="text-2xl font-bold text-red-500">VS</div>
                        {b.status === 'live' && (
                          <div className="text-xs text-red-600 mt-1 animate-pulse">진행 중</div>
                        )}
                      </div>
                      <SellerCard
                        name={b.seller_b_name}
                        image={b.seller_b_image}
                        revenue={b.revenue_b}
                        isWinner={winner === 'B'}
                      />
                    </div>
                    {b.status === 'pending' && (
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => startBattle(b.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg"
                        >
                          <Play className="w-3.5 h-3.5" /> PK 시작
                        </button>
                        <button
                          onClick={() => cancelBattle(b.id)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                    {b.status === 'live' && (
                      <button
                        onClick={() => cancelBattle(b.id)}
                        className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 text-xs rounded-lg"
                      >
                        <XCircle className="w-3.5 h-3.5" /> PK 중단
                      </button>
                    )}
                    {b.status === 'ended' && winner && (
                      <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800 text-center">
                        🏆 우승: <strong>{winner === 'A' ? b.seller_a_name : b.seller_b_name}</strong>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </AgencyLayout>
  )
}

function SellerCard(props: { name: string | null; image: string | null; revenue: number; isWinner: boolean }) {
  return (
    <div className={`text-center p-3 rounded-lg ${props.isWinner ? 'bg-yellow-50 border-2 border-yellow-400' : 'bg-gray-50'}`}>
      {props.isWinner && <Trophy className="w-5 h-5 text-yellow-500 mx-auto mb-1" />}
      <div className="w-12 h-12 mx-auto rounded-full overflow-hidden bg-gray-200 mb-2">
        {props.image ? <img src={props.image} alt={props.name || ''} className="w-full h-full object-cover" loading="lazy" /> : null}
      </div>
      <div className="text-xs font-medium text-gray-900 truncate">{props.name || '?'}</div>
      <div className="text-sm font-bold text-gray-900 mt-1">
        {(props.revenue / 10_000).toFixed(1)}만 딜
      </div>
    </div>
  )
}
