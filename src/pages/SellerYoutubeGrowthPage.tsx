import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import SellerLayout from '@/components/SellerLayout'
import { TrendingUp, Youtube, Loader2, CheckCircle, Clock, XCircle } from 'lucide-react'

interface GrowthRequest {
  id: number
  channel_url: string
  current_subscribers: number
  target_subscribers: number
  status: string
  admin_memo: string | null
  requested_at: string
  completed_at: string | null
}

const STATUS_STYLES: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: '검토 중', icon: Clock, color: 'text-amber-600 bg-amber-50' },
  processing: { label: '진행 중', icon: Loader2, color: 'text-blue-600 bg-blue-50' },
  completed: { label: '완료', icon: CheckCircle, color: 'text-green-600 bg-green-50' },
  rejected: { label: '거부됨', icon: XCircle, color: 'text-red-600 bg-red-50' },
}

export default function SellerYoutubeGrowthPage() {
  const navigate = useNavigate()
  const [requests, setRequests] = useState<GrowthRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [channelUrl, setChannelUrl] = useState('')
  const [currentSubs, setCurrentSubs] = useState(0)
  const [targetSubs, setTargetSubs] = useState(1000)

  const token = localStorage.getItem('seller_token')

  useEffect(() => {
    if (!token) { navigate('/seller/login'); return }
    loadRequests()
  }, [])

  async function loadRequests() {
    try {
      const res = await api.get('/api/youtube-growth/my', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (res.data.success) setRequests(res.data.data || [])
    } catch {} finally { setLoading(false) }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!channelUrl.trim()) { toast.error('YouTube 채널 URL을 입력해주세요'); return }
    setSubmitting(true)
    try {
      const res = await api.post('/api/youtube-growth/request', {
        channel_url: channelUrl,
        current_subscribers: currentSubs,
        target_subscribers: targetSubs,
      }, { headers: { Authorization: `Bearer ${token}` } })
      if (res.data.success) {
        toast.success(res.data.message)
        setChannelUrl('')
        setCurrentSubs(0)
        loadRequests()
      } else {
        toast.error(res.data.error)
      }
    } catch (err: unknown) {
      toast.error((err as Record<string, Record<string, Record<string, string>>>)?.response?.data?.error || '신청에 실패했습니다')
    } finally { setSubmitting(false) }
  }

  const hasPending = requests.some(r => r.status === 'pending' || r.status === 'processing')

  return (
    <SellerLayout title="구독자 늘리기">
      <div className="space-y-6">
        {/* 안내 */}
        <div className="bg-gradient-to-r from-red-50 to-pink-50 rounded-xl p-5 border border-red-100">
          <div className="flex items-start gap-3">
            <Youtube className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold text-gray-900">YouTube 구독자 늘리기 서비스</h3>
              <p className="text-xs text-gray-600 mt-1">
                YouTube 라이브 방송을 위해 구독자 1,000명 이상이 필요합니다.<br />
                신청하시면 관리자가 확인 후 처리해드립니다.
              </p>
            </div>
          </div>
        </div>

        {/* 신청 폼 */}
        {!hasPending && (
          <div className="bg-white rounded-xl shadow-sm p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              구독자 늘리기 신청
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">YouTube 채널 URL *</label>
                <input
                  type="text"
                  value={channelUrl}
                  onChange={e => setChannelUrl(e.target.value)}
                  placeholder="https://youtube.com/@your-channel"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">현재 구독자 수</label>
                  <input
                    type="number"
                    value={currentSubs || ''}
                    onChange={e => setCurrentSubs(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">목표 구독자 수</label>
                  <input
                    type="number"
                    value={targetSubs}
                    onChange={e => setTargetSubs(parseInt(e.target.value) || 1000)}
                    min={1000}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-red-500 text-white text-sm font-bold rounded-lg hover:bg-red-600 disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : '구독자 늘리기 신청'}
              </button>
            </form>
          </div>
        )}

        {/* 신청 목록 */}
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">신청 내역</h3>
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto" /></div>
          ) : requests.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">신청 내역이 없습니다</p>
          ) : (
            <div className="space-y-3">
              {requests.map(req => {
                const style = STATUS_STYLES[req.status] || STATUS_STYLES.pending
                const Icon = style.icon
                return (
                  <div key={req.id} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full ${style.color}`}>
                        <Icon className="w-3 h-3" /> {style.label}
                      </span>
                      <span className="text-xs text-gray-400">{new Date(req.requested_at).toLocaleDateString('ko-KR')}</span>
                    </div>
                    <p className="text-sm text-gray-900 truncate">{req.channel_url}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      현재 {req.current_subscribers.toLocaleString()}명 → 목표 {req.target_subscribers.toLocaleString()}명
                    </p>
                    {req.admin_memo && (
                      <p className="text-xs text-blue-600 mt-2 bg-blue-50 px-2 py-1 rounded">{req.admin_memo}</p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </SellerLayout>
  )
}
