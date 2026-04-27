import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Plus, AlertCircle, MessageCircle, Star, Bell } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface CalendarStream {
  id: number
  title: string
  status: 'scheduled' | 'live' | 'ended'
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  current_viewers: number
  peak_viewers: number
  seller_id: number
  seller_name: string
  seller_business_name: string | null
  note_count: number
  issue_count: number
}

interface Note {
  id: number
  type: 'guidance' | 'issue' | 'highlight' | 'reminder'
  content: string
  live_timestamp_seconds: number | null
  visible_to_seller: number
  read_by_seller_at: string | null
  agent_member_id: number | null
  author_email: string | null
  created_at: string
}

const NOTE_TYPE_LABEL: Record<Note['type'], string> = {
  guidance: '가이드',
  issue: '이슈',
  highlight: '하이라이트',
  reminder: '리마인더',
}

const NOTE_TYPE_ICON: Record<Note['type'], any> = {
  guidance: MessageCircle,
  issue: AlertCircle,
  highlight: Star,
  reminder: Bell,
}

const NOTE_TYPE_COLOR: Record<Note['type'], string> = {
  guidance: 'bg-blue-100 text-blue-700',
  issue: 'bg-red-100 text-red-700',
  highlight: 'bg-yellow-100 text-yellow-700',
  reminder: 'bg-purple-100 text-purple-700',
}

const STATUS_LABEL: Record<CalendarStream['status'], string> = {
  scheduled: '예정',
  live: '🔴 진행 중',
  ended: '종료',
}

const STATUS_COLOR: Record<CalendarStream['status'], string> = {
  scheduled: 'bg-blue-50 text-blue-700 border-blue-200',
  live: 'bg-red-50 text-red-700 border-red-300',
  ended: 'bg-gray-50 text-gray-600 border-gray-200',
}

function ymToString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AgencyCalendarPage() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(ymToString(new Date()))
  const [streams, setStreams] = useState<CalendarStream[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedStream, setSelectedStream] = useState<CalendarStream | null>(null)
  const [streamNotes, setStreamNotes] = useState<Note[]>([])
  const [streamDetail, setStreamDetail] = useState<CalendarStream & { peak_viewers?: number; current_viewers?: number } | null>(null)
  const [addingNote, setAddingNote] = useState(false)

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  const [noteForm, setNoteForm] = useState({
    type: 'guidance' as Note['type'],
    content: '',
    visible_to_seller: false,
  })

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/api/agency/calendar?month=${month}`, { headers })
      .then(r => { if (r.data?.success) setStreams(r.data.data || []) })
      .catch(() => toast.error('캘린더 조회 실패'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month])

  useEffect(() => { load() }, [load])

  const openStream = async (s: CalendarStream) => {
    setSelectedStream(s)
    try {
      const r = await api.get(`/api/agency/calendar/streams/${s.id}`, { headers })
      if (r.data?.success) {
        setStreamDetail(r.data.data.stream)
        setStreamNotes(r.data.data.notes || [])
      }
    } catch {
      toast.error('상세 조회 실패')
    }
  }

  const submitNote = async () => {
    if (!selectedStream) return
    if (!noteForm.content.trim()) { toast.error('내용 필수'); return }
    try {
      await api.post(`/api/agency/calendar/streams/${selectedStream.id}/notes`,
        noteForm, { headers })
      toast.success('노트 추가됨')
      setAddingNote(false)
      setNoteForm({ type: 'guidance', content: '', visible_to_seller: false })
      openStream(selectedStream)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '추가 실패')
    }
  }

  const deleteNote = async (id: number) => {
    if (!confirm('이 노트를 삭제하시겠습니까?')) return
    try {
      await api.delete(`/api/agency/calendar/notes/${id}`, { headers })
      toast.info('삭제됨')
      if (selectedStream) openStream(selectedStream)
    } catch {
      toast.error('삭제 실패')
    }
  }

  const prevMonth = () => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    setMonth(ymToString(d))
  }

  const nextMonth = () => {
    const [y, m] = month.split('-').map(Number)
    const d = new Date(y, m, 1)
    setMonth(ymToString(d))
  }

  // 일별 그룹
  const byDate = streams.reduce((acc, s) => {
    const dateStr = (s.scheduled_at || s.started_at || '').slice(0, 10)
    if (!dateStr) return acc
    if (!acc[dateStr]) acc[dateStr] = []
    acc[dateStr].push(s)
    return acc
  }, {} as Record<string, CalendarStream[]>)
  const dates = Object.keys(byDate).sort()

  return (
    <AgencyLayout title="라이브 캘린더">
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="라이브 캘린더"
          subtitle="소속 셀러 라이브 일정 — 진행 중 가이드 / 종료 후 피드백 노트 작성"
          icon={<CalendarIcon className="h-5 w-5" />}
        />

        {/* 월 네비게이터 */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={prevMonth} className="p-2 hover:bg-gray-100 rounded">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-gray-900 min-w-[120px] text-center">
            {month.replace('-', '. ')}
          </h2>
          <button onClick={nextMonth} className="p-2 hover:bg-gray-100 rounded">
            <ChevronRight className="w-5 h-5" />
          </button>
          <button onClick={() => setMonth(ymToString(new Date()))}
            className="ml-2 text-xs text-blue-600 hover:underline">오늘</button>
        </div>

        {loading ? (
          <DashboardLoading />
        ) : streams.length === 0 ? (
          <DashboardEmptyState icon={<CalendarIcon className="h-7 w-7" />} title={`${month} 라이브 일정 없음`} />
        ) : (
          <div className="space-y-4">
            {dates.map(date => (
              <div key={date} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100">
                  <CalendarIcon className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-bold text-gray-900">
                    {new Date(date).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' })}
                  </p>
                  <span className="text-[10px] text-gray-400">{byDate[date].length}개</span>
                </div>
                <div className="space-y-2">
                  {byDate[date].map(s => (
                    <div key={s.id} onClick={() => openStream(s)}
                      className={`rounded-lg p-3 border cursor-pointer hover:shadow-sm transition-all ${STATUS_COLOR[s.status]}`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-0.5">
                            <p className="text-sm font-bold truncate">{s.title || '제목 없음'}</p>
                            <span className="text-[10px] font-bold">
                              {STATUS_LABEL[s.status]}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500">
                            {s.seller_business_name || s.seller_name}
                            {s.scheduled_at && ` · ${new Date(s.scheduled_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}`}
                            {s.peak_viewers > 0 && ` · 피크 ${s.peak_viewers}명`}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {s.note_count > 0 && (
                            <span className="text-[10px] bg-white px-1.5 py-0.5 rounded font-bold text-gray-600">
                              📝 {s.note_count}
                            </span>
                          )}
                          {s.issue_count > 0 && (
                            <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold">
                              ⚠️ {s.issue_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 라이브 상세 모달 */}
      {selectedStream && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedStream(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-bold text-gray-900 truncate">{selectedStream.title}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedStream.seller_business_name || selectedStream.seller_name} · {STATUS_LABEL[selectedStream.status]}
                </p>
                {streamDetail && (streamDetail.peak_viewers ?? 0) > 0 && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    현재 {streamDetail.current_viewers ?? 0}명 / 피크 {streamDetail.peak_viewers ?? 0}명
                  </p>
                )}
              </div>
              <button onClick={() => setSelectedStream(null)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-gray-500 uppercase">에이전트 노트 ({streamNotes.length})</h3>
              <button onClick={() => setAddingNote(true)}
                className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded">
                <Plus className="w-3.5 h-3.5" /> 노트 추가
              </button>
            </div>

            {addingNote && (
              <div className="bg-blue-50 rounded-xl p-3 mb-3 space-y-2">
                <select value={noteForm.type} onChange={e => setNoteForm({ ...noteForm, type: e.target.value as Note['type'] })}
                  className="w-full px-2 py-1 border border-gray-200 rounded text-xs text-gray-900 bg-white">
                  <option value="guidance">가이드</option>
                  <option value="issue">이슈</option>
                  <option value="highlight">하이라이트</option>
                  <option value="reminder">리마인더</option>
                </select>
                <textarea value={noteForm.content}
                  onChange={e => setNoteForm({ ...noteForm, content: e.target.value })}
                  placeholder="노트 내용 (예: '상품 클로즈업 시간 늘리세요', '시청자 질문 답변 누락')"
                  rows={3} maxLength={2000}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded text-xs text-gray-900 resize-none" />
                <label className="flex items-center gap-2 text-xs text-gray-700">
                  <input type="checkbox" checked={noteForm.visible_to_seller}
                    onChange={e => setNoteForm({ ...noteForm, visible_to_seller: e.target.checked })} />
                  셀러에게 표시 (대시보드 알림 발송)
                </label>
                <div className="flex justify-end gap-2">
                  <button onClick={() => { setAddingNote(false); setNoteForm({ type: 'guidance', content: '', visible_to_seller: false }) }}
                    className="px-3 py-1 text-gray-600 text-xs font-bold">취소</button>
                  <button onClick={submitNote}
                    className="px-3 py-1 bg-blue-600 text-white text-xs font-bold rounded">추가</button>
                </div>
              </div>
            )}

            {streamNotes.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">아직 노트 없음</p>
            ) : (
              <div className="space-y-2">
                {streamNotes.map(n => {
                  const Icon = NOTE_TYPE_ICON[n.type]
                  return (
                    <div key={n.id} className="bg-gray-50 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${NOTE_TYPE_COLOR[n.type]}`}>
                            <Icon className="w-3 h-3" />
                            {NOTE_TYPE_LABEL[n.type]}
                          </span>
                          {n.visible_to_seller === 1 && (
                            <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">
                              👁️ 셀러 공개
                              {n.read_by_seller_at && ' · 읽음'}
                            </span>
                          )}
                        </div>
                        <button onClick={() => deleteNote(n.id)} className="text-[10px] text-red-500 hover:underline">삭제</button>
                      </div>
                      <p className="text-xs text-gray-700 whitespace-pre-wrap">{n.content}</p>
                      <p className="text-[10px] text-gray-400 mt-1">
                        {n.author_email && `${n.author_email} · `}
                        {new Date(n.created_at).toLocaleString('ko-KR')}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AgencyLayout>
  )
}
