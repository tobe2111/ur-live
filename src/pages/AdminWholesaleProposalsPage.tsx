import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { MessageSquareWarning, Loader2, Check, X, Lightbulb, Flag } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import AdminMallSelect from '@/components/admin/AdminMallSelect'
import { safeDate } from '@/utils/safe-date'

// 🏭 2026-06-09 Wave 2 — 어드민 도매 제안/신고 처리 큐.
//   판매사 제안(상품 요청)·신고(문제) 접수 → 검토/처리/반려 + 메모. 라이트 테마.

type FeedbackType = 'proposal' | 'report'
type FeedbackStatus = 'open' | 'in_progress' | 'resolved' | 'rejected'

interface FeedbackRow {
  id: number
  seller_id: number
  business_name: string | null
  type: FeedbackType
  target: string | null
  subject: string
  body: string
  status: FeedbackStatus
  admin_memo: string | null
  created_at: string
  resolved_at: string | null
}

const STATUS: Record<FeedbackStatus, { t: string; c: string }> = {
  open: { t: '접수', c: 'bg-amber-50 text-amber-700' },
  in_progress: { t: '검토중', c: 'bg-blue-50 text-blue-700' },
  resolved: { t: '처리완료', c: 'bg-emerald-50 text-emerald-700' },
  rejected: { t: '반려', c: 'bg-rose-50 text-rose-700' },
}

const FILTERS: { id: string; label: string }[] = [
  { id: 'open', label: '접수' },
  { id: 'in_progress', label: '검토중' },
  { id: 'resolved', label: '처리완료' },
  { id: 'rejected', label: '반려' },
  { id: 'all', label: '전체' },
]

export default function AdminWholesaleProposalsPage() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('open')
  const [actingId, setActingId] = useState<number | null>(null)
  // 🏬 멀티-몰: '' = 전 몰(기존 무필터 뷰 보존). 특정 몰 선택 시 ?mall_id= 로 스코프.
  const [mallId, setMallId] = useState('')

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])

  // 🛡️ 2026-06-10: 수동 useState+useEffect+api.get → useApiQuery (RQ SSOT).
  //   인증=api 인터셉터 자동(admin_token). filter/mallId 변경 시 queryKey 로 자동 재조회.
  const queryClient = useQueryClient()
  const queryKey = ['admin', 'wholesale-proposals', filter, mallId] as const
  const { data: rows = [], isLoading: loading, refetch } = useApiQuery<FeedbackRow[]>(
    queryKey,
    '/api/admin/wholesale-proposals',
    {
      params: {
        status: filter !== 'all' ? filter : undefined,
        mall_id: mallId || undefined,
      },
      select: (raw) => {
        const r = raw as { success?: boolean; proposals?: FeedbackRow[]; items?: FeedbackRow[] }
        return r?.success ? (r.proposals || r.items || []) : []
      },
    },
  )
  const load = () => { void refetch() }
  const setRows = (updater: (prev: FeedbackRow[]) => FeedbackRow[]) =>
    queryClient.setQueryData<FeedbackRow[]>(queryKey, (prev) => updater(prev ?? []))

  async function resolve(row: FeedbackRow, status: FeedbackStatus) {
    const memo = window.prompt(status === 'rejected' ? '반려 사유(선택)' : '처리 메모(선택, 판매사에게 표시)', row.admin_memo || '')
    if (memo === null) return
    setActingId(row.id)
    try {
      const r = await api.post(`/api/admin/wholesale-proposals/${row.id}/resolve`, { status, memo: memo || undefined })
      if (r.data?.success) {
        toast.success(status === 'rejected' ? '반려 처리했습니다' : status === 'resolved' ? '처리 완료했습니다' : '상태를 변경했습니다')
        if (filter !== 'all') load()
        else setRows((prev) => prev.map((x) => x.id === row.id ? { ...x, status, admin_memo: memo || x.admin_memo } : x))
      } else { toast.error(r.data?.error || '처리 실패') }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '오류가 발생했습니다')
    } finally { setActingId(null) }
  }

  return (
    <AdminLayout title="도매 제안/신고">
      <div className="ur-content-full px-4 lg:px-8 py-6">
        <DashboardPageHeader icon={<MessageSquareWarning className="w-5 h-5" />} title="도매 제안 / 신고" subtitle="판매사가 보낸 상품 제안과 문제 신고를 검토하고 처리합니다." />

        <div className="flex items-center gap-2 my-4 flex-wrap">
          {FILTERS.map((f) => (
            <button key={f.id} onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium ${filter === f.id ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-700'}`}>
              {f.label}
            </button>
          ))}
          <div className="ml-auto"><AdminMallSelect value={mallId} onChange={setMallId} /></div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin text-gray-400" /></div>
        ) : rows.length === 0 ? (
          <p className="text-center text-gray-400 py-20">해당 상태의 제안/신고가 없습니다.</p>
        ) : (
          <div className="grid gap-3">
            {rows.map((row) => (
              <div key={row.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${row.type === 'report' ? 'bg-rose-50 text-rose-700' : 'bg-pink-50 text-pink-700'}`}>
                    {row.type === 'report' ? <Flag className="w-3 h-3" /> : <Lightbulb className="w-3 h-3" />}
                    {row.type === 'report' ? '신고' : '제안'}
                  </span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS[row.status]?.c || 'bg-gray-100 text-gray-600'}`}>{STATUS[row.status]?.t || row.status}</span>
                  <span className="text-xs text-gray-400 ml-auto">{safeDate(row.created_at)?.toLocaleString('ko-KR') ?? ''}</span>
                </div>
                <div className="text-sm font-bold text-gray-900">{row.subject}</div>
                <div className="text-xs text-gray-500 mt-0.5">{row.business_name || `판매사 #${row.seller_id}`}{row.target ? ` · 대상: ${row.target}` : ''}</div>
                <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">{row.body}</p>
                {row.admin_memo && (
                  <div className="mt-2 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
                    <span className="font-bold text-gray-800">운영팀 메모: </span>{row.admin_memo}
                  </div>
                )}
                {(row.status === 'open' || row.status === 'in_progress') && (
                  <div className="flex items-center gap-2 mt-3 flex-wrap">
                    {row.status === 'open' && (
                      <button onClick={() => resolve(row, 'in_progress')} disabled={actingId === row.id}
                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                        검토 시작
                      </button>
                    )}
                    <button onClick={() => resolve(row, 'resolved')} disabled={actingId === row.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium disabled:opacity-50">
                      {actingId === row.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />} 처리 완료
                    </button>
                    <button onClick={() => resolve(row, 'rejected')} disabled={actingId === row.id}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 text-gray-600 rounded-lg text-xs font-medium disabled:opacity-50">
                      <X className="w-3.5 h-3.5" /> 반려
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  )
}
