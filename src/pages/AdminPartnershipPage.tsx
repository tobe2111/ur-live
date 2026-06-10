/**
 * 🤝 2026-06-10: 광고/제휴 문의 접수함 — /admin/partnership.
 *   공개 폼(/partnership) 접수 건 목록/상태 처리/메모. 라이트 테마 (대시보드 — dark: 금지).
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { Loader2, ExternalLink } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface InquiryRow {
  id: number
  type: string
  company: string | null
  name: string
  phone: string | null
  email: string | null
  message: string
  status: 'new' | 'in_progress' | 'done'
  admin_memo: string | null
  created_at: string
}

const TYPE_LABEL: Record<string, string> = { ad: '📣 광고', partnership: '🤝 제휴', store: '🏪 매장 입점', supply: '📦 상품 공급', other: '💬 기타' }
const STATUS_META: Record<string, { label: string; cls: string }> = {
  new: { label: '신규', cls: 'bg-red-50 text-red-600' },
  in_progress: { label: '진행 중', cls: 'bg-amber-50 text-amber-600' },
  done: { label: '완료', cls: 'bg-emerald-50 text-emerald-600' },
}

export default function AdminPartnershipPage() {
  const navigate = useNavigate()
  const [statusFilter, setStatusFilter] = useState('')
  const [openId, setOpenId] = useState<number | null>(null)
  const [memo, setMemo] = useState('')

  useEffect(() => { if (!localStorage.getItem('admin_token')) navigate('/admin/login', { replace: true }) }, [navigate])

  const queryClient = useQueryClient()
  const { data: rows = [], isLoading: loading } = useApiQuery<InquiryRow[]>(
    ['admin', 'partnership', statusFilter],
    '/api/admin/partnership-inquiries',
    {
      params: statusFilter ? { status: statusFilter } : undefined,
      select: (raw) => {
        const r = raw as { success?: boolean; inquiries?: InquiryRow[] }
        return r?.success ? (r.inquiries || []) : []
      },
    },
  )
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['admin', 'partnership'] })

  async function update(id: number, payload: { status?: string; admin_memo?: string }) {
    try {
      const res = await api.patch(`/api/admin/partnership-inquiries/${id}`, payload)
      if (res.data?.success) { toast.success('저장됐어요'); refresh() }
      else toast.error(res.data?.error || '저장 실패')
    } catch { toast.error('저장 실패') }
  }

  return (
    <AdminLayout title="광고·제휴 문의">
      <DashboardPageHeader
        title="광고·제휴 문의"
        subtitle="공개 접수 페이지: /partnership — 접수 시 벨 알림"
        actions={(
          <a href="/partnership" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[13px] font-bold text-gray-500">
            공개 페이지 <ExternalLink className="w-3.5 h-3.5" />
          </a>
        )}
      />

      <div className="flex gap-2 mb-4">
        {([['', '전체'], ['new', '신규'], ['in_progress', '진행 중'], ['done', '완료']] as const).map(([v, l]) => (
          <button key={v} onClick={() => setStatusFilter(v)}
            className={`px-3.5 h-9 rounded-full text-[13px] font-bold ${statusFilter === v ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {l}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 py-16 text-center text-sm text-gray-400">접수된 문의가 없어요</div>
      ) : (
        <div className="space-y-2">
          {rows.map(r => {
            const st = STATUS_META[r.status] || STATUS_META.new
            const open = openId === r.id
            return (
              <div key={r.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                <button onClick={() => { setOpenId(open ? null : r.id); setMemo(r.admin_memo || '') }}
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left">
                  <span className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-bold ${st.cls}`}>{st.label}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold text-gray-900 truncate">
                      {TYPE_LABEL[r.type] || r.type} · {r.company || r.name}
                    </p>
                    <p className="text-[12px] text-gray-400 mt-0.5 truncate">{r.message}</p>
                  </div>
                  <span className="shrink-0 text-[11px] text-gray-400">{(r.created_at || '').slice(0, 10)}</span>
                </button>
                {open && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
                    <p className="text-[13.5px] text-gray-700 whitespace-pre-wrap leading-relaxed">{r.message}</p>
                    <div className="text-[12.5px] text-gray-500 space-y-0.5">
                      <p>담당자: <span className="font-bold text-gray-900">{r.name}</span>{r.company ? ` (${r.company})` : ''}</p>
                      {r.phone && <p>연락처: <a href={`tel:${r.phone}`} className="font-bold text-gray-900 underline">{r.phone}</a></p>}
                      {r.email && <p>이메일: <a href={`mailto:${r.email}`} className="font-bold text-gray-900 underline">{r.email}</a></p>}
                    </div>
                    <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} maxLength={2000}
                      placeholder="처리 메모 (내부용)"
                      className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[13px] text-gray-900 resize-none" />
                    <div className="flex gap-2">
                      {(['in_progress', 'done'] as const).map(sv => (
                        <button key={sv} onClick={() => update(r.id, { status: sv, admin_memo: memo })}
                          className={`px-4 h-10 rounded-xl text-[13px] font-bold ${sv === 'done' ? 'bg-emerald-600 text-white' : 'bg-amber-500 text-white'}`}>
                          {sv === 'done' ? '완료 처리' : '진행 중으로'}
                        </button>
                      ))}
                      <button onClick={() => update(r.id, { admin_memo: memo })}
                        className="px-4 h-10 rounded-xl text-[13px] font-bold bg-gray-100 text-gray-700">
                        메모만 저장
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
