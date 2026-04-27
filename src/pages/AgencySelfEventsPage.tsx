import { useEffect, useState } from 'react'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Trophy, Plus, X, TrendingUp, Users, Eye } from 'lucide-react'

interface SelfEvent {
  id: number
  agency_id: number
  title: string
  description: string | null
  start_date: string
  end_date: string
  metric: 'revenue' | 'live_count' | 'viewer_peak'
  target_value: number
  reward_deal: number
  max_winners: number
  status: string
  participant_count: number
  achieved_count: number
  created_at: string
}

const METRIC_LABEL: Record<string, { label: string; icon: React.ElementType; suffix: string }> = {
  revenue: { label: '매출', icon: TrendingUp, suffix: '딜' },
  live_count: { label: '라이브 횟수', icon: Users, suffix: '회' },
  viewer_peak: { label: '피크 시청자', icon: Eye, suffix: '명' },
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  active: { label: '진행 중', cls: 'bg-green-100 text-green-700' },
  ended: { label: '종료', cls: 'bg-gray-100 text-gray-600' },
  cancelled: { label: '취소', cls: 'bg-red-100 text-red-700' },
}

export default function AgencySelfEventsPage() {
  const [items, setItems] = useState<SelfEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [endDate, setEndDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString().slice(0, 10)
  })
  const [metric, setMetric] = useState<'revenue' | 'live_count' | 'viewer_peak'>('revenue')
  const [targetValue, setTargetValue] = useState(1_000_000)
  const [rewardDeal, setRewardDeal] = useState(50_000)

  async function fetchAll() {
    setLoading(true)
    try {
      const token = localStorage.getItem('agency_token')
      const r = await api.get('/api/agency/self-events', { headers: { Authorization: `Bearer ${token}` } })
      if (r.data.success) setItems(r.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '불러오기 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  async function createEvent() {
    if (!title.trim()) return toast.error('제목을 입력하세요')
    if (targetValue <= 0) return toast.error('목표값 입력')
    try {
      const token = localStorage.getItem('agency_token')
      await api.post('/api/agency/self-events',
        { title, description, start_date: startDate, end_date: endDate, metric, target_value: targetValue, reward_deal: rewardDeal },
        { headers: { Authorization: `Bearer ${token}` } })
      toast.success('이벤트 생성 완료')
      setTitle(''); setDescription(''); setCreating(false)
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '생성 실패')
    }
  }

  async function cancelEvent(id: number) {
    if (!confirm('이 이벤트를 취소하시겠습니까?')) return
    try {
      const token = localStorage.getItem('agency_token')
      await api.post(`/api/agency/self-events/${id}/cancel`, {},
        { headers: { Authorization: `Bearer ${token}` } })
      toast.info('취소 완료')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '실패')
    }
  }

  return (
    <AgencyLayout title="자사 이벤트">
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title="자사 이벤트 (매출 챌린지)"
          subtitle="셀러들이 참여하는 매출/라이브/시청자 챌린지. 달성 시 자동 보상 (딜)"
          icon={<Trophy className="h-5 w-5" />}
        />

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-xs text-yellow-800">
          💡 <strong>팁</strong>: 짧은 기간 (1~4주) + 명확한 목표 + 적절한 보상 의 조합이 효과적.
          TikTok 데이터: 이벤트 참여 셀러 매출 평균 60% 증가.
        </div>

        {/* 생성 폼 */}
        {!creating ? (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold rounded-lg"
          >
            <Plus className="w-4 h-4" /> 새 이벤트 만들기
          </button>
        ) : (
          <div className="bg-white rounded-xl p-5 border border-gray-100 space-y-3">
            <h3 className="text-sm font-bold text-gray-900">새 이벤트</h3>
            <input
              type="text" placeholder="제목 (예: 4월 매출 챌린지)"
              value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100}
              className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
            />
            <textarea
              placeholder="설명 (선택, 1000자)"
              value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={1000}
              className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900"
            />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">시작일</label>
                <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">종료일</label>
                <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-gray-600 mb-1">메트릭</label>
                <select value={metric} onChange={(e) => setMetric(e.target.value as any)}
                  className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900">
                  <option value="revenue">매출 (딜)</option>
                  <option value="live_count">라이브 횟수</option>
                  <option value="viewer_peak">피크 시청자</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">목표값</label>
                <input type="number" value={targetValue} min={1}
                  onChange={(e) => setTargetValue(Number(e.target.value) || 0)}
                  className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900" />
              </div>
              <div>
                <label className="block text-xs text-gray-600 mb-1">달성 보상 (딜)</label>
                <input type="number" value={rewardDeal} min={0}
                  onChange={(e) => setRewardDeal(Number(e.target.value) || 0)}
                  className="w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 text-gray-900" />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={createEvent}
                className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white text-sm font-bold rounded-lg">
                생성
              </button>
              <button onClick={() => setCreating(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm rounded-lg">
                취소
              </button>
            </div>
          </div>
        )}

        {/* 목록 */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-bold text-gray-900">이벤트 내역</h3>
            <span className="text-xs text-gray-500">{items.length}건</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-sm text-gray-400">불러오는 중...</div>
          ) : items.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400">아직 이벤트가 없습니다.</div>
          ) : (
            <div className="divide-y divide-gray-100">
              {items.map(e => {
                const meta = METRIC_LABEL[e.metric]
                const status = STATUS_LABEL[e.status] || STATUS_LABEL.active
                const Icon = meta.icon
                return (
                  <div key={e.id} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-gray-900 truncate">{e.title}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{e.start_date} ~ {e.end_date}</p>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${status.cls}`}>
                        {status.label}
                      </span>
                    </div>
                    {e.description && (
                      <p className="text-xs text-gray-600 mt-1 mb-2 whitespace-pre-wrap">{e.description}</p>
                    )}
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-[10px] text-gray-500 flex items-center gap-1">
                          <Icon className="w-3 h-3" /> 목표
                        </div>
                        <div className="font-bold text-gray-900">
                          {e.target_value.toLocaleString()}{meta.suffix}
                        </div>
                      </div>
                      <div className="bg-purple-50 rounded p-2">
                        <div className="text-[10px] text-gray-500">참여 셀러</div>
                        <div className="font-bold text-purple-700">{e.participant_count} / {e.max_winners}</div>
                      </div>
                      <div className="bg-green-50 rounded p-2">
                        <div className="text-[10px] text-gray-500">달성</div>
                        <div className="font-bold text-green-700">{e.achieved_count}명</div>
                      </div>
                    </div>
                    <div className="mt-2 text-[11px] text-gray-500">
                      🎁 보상: <strong className="text-purple-700">{e.reward_deal.toLocaleString()}딜</strong>
                    </div>
                    {e.status === 'active' && (
                      <button onClick={() => cancelEvent(e.id)}
                        className="mt-2 flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 text-[11px] rounded">
                        <X className="w-3 h-3" /> 취소
                      </button>
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
