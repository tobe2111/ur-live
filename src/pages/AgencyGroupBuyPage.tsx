import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AgencyLayout from '@/components/AgencyLayout'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Users, ShoppingBag, Handshake, CheckCircle, X, FileDown } from 'lucide-react'

interface GroupBuy {
  id: number
  restaurant_name: string
  restaurant_address: string
  participant_count: number
  target_participants: number
  total_deposit_deals: number
  status: 'proposed' | 'negotiating' | 'confirmed' | 'achieved' | 'failed'
  expires_at: string
  confirmed_price?: number
  confirmed_discount_percent?: number
}

interface Stats {
  active: number
  total_participants: number
  negotiating: number
  confirmed: number
}

function StatCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string; icon: React.ComponentType<{ className?: string }>; color: string; sub?: string
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] sm:text-xs font-medium text-gray-500 mb-0.5 sm:mb-1">{label}</p>
          <p className="text-lg sm:text-2xl font-bold text-gray-900">{value}</p>
          {sub && <p className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">{sub}</p>}
        </div>
        <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
        </div>
      </div>
    </div>
  )
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; cls: string }> = {
    proposed:    { label: '제안됨',  cls: 'bg-blue-100 text-blue-700' },
    negotiating: { label: '협상 중', cls: 'bg-amber-100 text-amber-700' },
    confirmed:   { label: '확정',   cls: 'bg-green-100 text-green-700' },
    achieved:    { label: '달성',   cls: 'bg-emerald-100 text-emerald-700' },
    failed:      { label: '실패',   cls: 'bg-red-100 text-red-700' },
  }
  const s = map[status] || { label: status, cls: 'bg-gray-100 text-gray-600' }
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>{s.label}</span>
}

function ConfirmModal({ groupBuy, onClose, onConfirm }: {
  groupBuy: GroupBuy
  onClose: () => void
  onConfirm: (price: number, discount: number) => void
}) {
  const [price, setPrice] = useState('')
  const [discount, setDiscount] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = () => {
    const p = Number(price)
    const d = Number(discount)
    if (!p || p <= 0) { toast.error('확정 가격을 입력해주세요.'); return }
    if (!d || d <= 0 || d > 100) { toast.error('할인율을 1~100% 범위로 입력해주세요.'); return }
    setSubmitting(true)
    onConfirm(p, d)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-gray-900">딜 확정</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <span className="font-semibold text-gray-900">{groupBuy.restaurant_name}</span> 공구를 확정합니다.
        </p>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">확정 가격 (원)</label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="예: 15000"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">할인율 (%)</label>
            <input
              type="number"
              value={discount}
              onChange={e => setDiscount(e.target.value)}
              placeholder="예: 25"
              min={1}
              max={100}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? '처리 중...' : '확정'}
          </button>
        </div>
      </div>
    </div>
  )
}

function generateContract(groupBuy: GroupBuy) {
  const html = `
    <html><head><meta charset="utf-8"><style>body{font-family:sans-serif;padding:40px;} h1{text-align:center;} table{width:100%;border-collapse:collapse;} td,th{border:1px solid #ddd;padding:8px;}</style></head>
    <body>
      <h1>식사권 공동구매 계약서</h1>
      <p>계약일: ${new Date().toLocaleDateString('ko-KR')}</p>
      <table>
        <tr><th>항목</th><th>내용</th></tr>
        <tr><td>식당명</td><td>${groupBuy.restaurant_name}</td></tr>
        <tr><td>확정 가격</td><td>${groupBuy.confirmed_price?.toLocaleString()}원</td></tr>
        <tr><td>할인율</td><td>${groupBuy.confirmed_discount_percent}%</td></tr>
        <tr><td>참여 인원</td><td>${groupBuy.participant_count}명</td></tr>
        <tr><td>총 거래액</td><td>${(groupBuy.total_deposit_deals || 0).toLocaleString()}딜</td></tr>
      </table>
      <p style="margin-top:40px">양 당사자는 위 내용에 동의합니다.</p>
      <div style="display:flex;justify-content:space-between;margin-top:60px">
        <div>에이전시 서명: ___________</div>
        <div>식당 대표 서명: ___________</div>
      </div>
    </body></html>
  `
  const blob = new Blob([html], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `계약서_${groupBuy.restaurant_name}_${new Date().toISOString().slice(0, 10)}.html`
  a.click()
  URL.revokeObjectURL(url)
}

type TabKey = 'popular' | 'all' | 'negotiating' | 'confirmed'

export default function AgencyGroupBuyPage() {
  const navigate = useNavigate()
  const [groupBuys, setGroupBuys] = useState<GroupBuy[]>([])
  const [stats, setStats] = useState<Stats>({ active: 0, total_participants: 0, negotiating: 0, confirmed: 0 })
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<TabKey>('popular')
  const [confirmTarget, setConfirmTarget] = useState<GroupBuy | null>(null)

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  const fetchData = (currentTab: TabKey) => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
    setLoading(true)

    let listUrl: string
    if (currentTab === 'popular') {
      listUrl = '/api/community-group-buy/popular'
    } else if (currentTab === 'negotiating') {
      listUrl = '/api/community-group-buy/list?status=negotiating&sort=popular'
    } else if (currentTab === 'confirmed') {
      listUrl = '/api/community-group-buy/list?status=confirmed&sort=popular'
    } else {
      listUrl = '/api/community-group-buy/list?sort=popular'
    }

    Promise.all([
      api.get(listUrl, { headers }),
      api.get('/api/community-group-buy/list?sort=popular', { headers }),
    ])
      .then(([listRes, allRes]) => {
        setGroupBuys(listRes.data.data || [])
        const all: GroupBuy[] = allRes.data.data || []
        setStats({
          active: all.filter(g => ['proposed', 'negotiating'].includes(g.status)).length,
          total_participants: all.reduce((sum, g) => sum + (g.participant_count || 0), 0),
          negotiating: all.filter(g => g.status === 'negotiating').length,
          confirmed: all.filter(g => g.status === 'confirmed').length,
        })
      })
      .catch(() => {
        toast.error('데이터를 불러오는데 실패했습니다.')
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchData(tab)
  }, [token, tab])

  const changeStatus = (id: number, status: string) => {
    if (!token) return
    api.patch(`/api/community-group-buy/${id}/status`, { status }, { headers })
      .then(() => {
        toast.success(status === 'negotiating' ? '협상이 시작되었습니다.' : '상태가 변경되었습니다.')
        fetchData(tab)
      })
      .catch(() => toast.error('상태 변경에 실패했습니다.'))
  }

  const confirmDeal = (id: number, confirmed_price: number, confirmed_discount_percent: number) => {
    if (!token) return
    api.patch(`/api/community-group-buy/${id}/confirm`, { confirmed_price, confirmed_discount_percent }, { headers })
      .then(() => {
        toast.success('딜이 확정되었습니다!')
        setConfirmTarget(null)
        fetchData(tab)
      })
      .catch(() => toast.error('딜 확정에 실패했습니다.'))
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'popular', label: '인기 공구 (50+)' },
    { key: 'all', label: '전체' },
    { key: 'negotiating', label: '협상 중' },
    { key: 'confirmed', label: '확정' },
  ]

  return (
    <AgencyLayout title="공동구매 관리">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
        <StatCard label="진행중 공구 수" value={String(stats.active)} icon={ShoppingBag} color="bg-blue-600" />
        <StatCard label="총 참여자 수" value={stats.total_participants.toLocaleString()} icon={Users} color="bg-emerald-500" sub="명" />
        <StatCard label="협상 중" value={String(stats.negotiating)} icon={Handshake} color="bg-amber-500" />
        <StatCard label="확정된 딜" value={String(stats.confirmed)} icon={CheckCircle} color="bg-green-600" />
      </div>

      {/* Tabs + Table */}
      <div className="bg-white rounded-xl border border-gray-200">
        {/* Tabs */}
        <div className="flex items-center gap-1 px-4 pt-4 pb-0 border-b border-gray-100">
          {tabs.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['맛집', '주소', '참여자', '총 예치 딜', '상태', '만료일', '액션'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">불러오는 중...</td></tr>
              ) : groupBuys.length === 0 ? (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">해당하는 공구가 없습니다.</td></tr>
              ) : groupBuys.map(g => (
                <tr key={g.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{g.restaurant_name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs max-w-[200px] truncate">{g.restaurant_address || '-'}</td>
                  <td className="px-4 py-3 text-gray-700">
                    <span className="font-semibold">{g.participant_count}</span>
                    <span className="text-gray-400"> / {g.target_participants}</span>
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{(g.total_deposit_deals || 0).toLocaleString()} 딜</td>
                  <td className="px-4 py-3">{statusBadge(g.status)}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {g.expires_at
                      ? new Date(g.expires_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
                      : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      {g.status === 'proposed' && (
                        <button
                          onClick={() => changeStatus(g.id, 'negotiating')}
                          className="px-2.5 py-1 bg-amber-100 text-amber-700 rounded-lg text-xs font-medium hover:bg-amber-200"
                        >
                          협상 시작
                        </button>
                      )}
                      {(g.status === 'proposed' || g.status === 'negotiating') && (
                        <button
                          onClick={() => setConfirmTarget(g)}
                          className="px-2.5 py-1 bg-green-100 text-green-700 rounded-lg text-xs font-medium hover:bg-green-200"
                        >
                          딜 확정
                        </button>
                      )}
                      {(g.status === 'proposed' || g.status === 'negotiating') && (
                        <button
                          onClick={() => {
                            if (window.confirm('이 공구를 실패 처리하시겠습니까?')) {
                              changeStatus(g.id, 'failed')
                            }
                          }}
                          className="px-2.5 py-1 bg-red-100 text-red-600 rounded-lg text-xs font-medium hover:bg-red-200"
                        >
                          실패 처리
                        </button>
                      )}
                      {g.status === 'confirmed' && (
                        <button
                          onClick={() => generateContract(g)}
                          className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded-lg text-xs font-medium hover:bg-blue-200 flex items-center gap-1"
                        >
                          <FileDown className="w-3 h-3" />
                          계약서 다운로드
                        </button>
                      )}
                      {(g.status === 'achieved' || g.status === 'failed') && (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirm Modal */}
      {confirmTarget && (
        <ConfirmModal
          groupBuy={confirmTarget}
          onClose={() => setConfirmTarget(null)}
          onConfirm={(price, discount) => confirmDeal(confirmTarget.id, price, discount)}
        />
      )}
    </AgencyLayout>
  )
}
