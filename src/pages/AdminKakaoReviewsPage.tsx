/**
 * 🛡️ 2026-05-16: 카카오맵 후기 검증 + 보너스 지급 어드민 페이지.
 *
 * 사용자가 voucher 사용 후 카카오맵 후기 URL 제출 → 어드민 검증 (URL 클릭해서 확인) →
 * [승인] 클릭 시 즉시 보너스 딜 지급 + 사용자 알림.
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { Star, ExternalLink, CheckCircle, XCircle } from 'lucide-react'

interface Submission {
  id: number
  voucher_id: number
  user_id: string
  product_id: number
  seller_id: number
  product_name: string | null
  restaurant_name: string | null
  seller_name: string | null
  review_url: string
  bonus_amount: number
  status: string
  admin_notes: string | null
  created_at: string
  reviewed_at: string | null
}

export default function AdminKakaoReviewsPage() {
  const [tab, setTab] = useState<'submitted' | 'paid' | 'rejected'>('submitted')
  const [list, setList] = useState<Submission[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)

  useEffect(() => { load() }, [tab])

  function load() {
    setLoading(true)
    api.get('/api/admin-review-bonus/list', { params: { status: tab } })
      .then((r) => { if (r.data?.success) setList(r.data.data || []) })
      .catch(() => toast.error('로드 실패'))
      .finally(() => setLoading(false))
  }

  async function approve(id: number) {
    if (!confirm('승인 + 보너스 지급?')) return
    setProcessing(id)
    try {
      const res = await api.post(`/api/admin-review-bonus/${id}/approve`)
      if (res.data?.success) {
        toast.success(`${res.data.bonus.toLocaleString()}딜 지급됨`)
        load()
      } else toast.error(res.data?.error || '실패')
    } catch { toast.error('실패') }
    finally { setProcessing(null) }
  }

  async function reject(id: number) {
    const reason = prompt('거절 사유 (최소 5자)')
    if (!reason || reason.trim().length < 5) { toast.error('5자 이상'); return }
    setProcessing(id)
    try {
      await api.post(`/api/admin-review-bonus/${id}/reject`, { reason: reason.trim() })
      toast.success('거절됨')
      load()
    } catch { toast.error('실패') }
    finally { setProcessing(null) }
  }

  return (
    <AdminLayout title="카카오맵 후기 검증">
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="카카오맵 후기 검증"
          subtitle={`대기 중 ${list.length}건 · URL 클릭해서 실제 후기 작성 여부 확인 후 승인`}
          icon={<Star className="h-5 w-5" />}
        />

        <div className="flex gap-2">
          {(['submitted', 'paid', 'rejected'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${tab === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
            >
              {t === 'submitted' ? '검증 대기' : t === 'paid' ? '지급됨' : '거절됨'}
            </button>
          ))}
        </div>

        {loading ? <DashboardLoading /> : list.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500">해당 상태의 후기가 없습니다.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map(s => (
              <li key={s.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.restaurant_name || '-'} · {s.product_name || '-'}</p>
                    <p className="text-[10px] text-gray-500 font-mono mt-0.5">user: {s.user_id} · voucher: {s.voucher_id}</p>
                    <p className="text-[10px] text-gray-400">{new Date(s.created_at).toLocaleString('ko-KR')}</p>
                  </div>
                </div>
                <a href={s.review_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-pink-600 underline break-all mb-3">
                  <ExternalLink className="w-3 h-3" /> {s.review_url.slice(0, 60)}{s.review_url.length > 60 ? '...' : ''}
                </a>
                {s.admin_notes && (
                  <p className="text-xs text-gray-600 italic mb-3">거절 사유: {s.admin_notes}</p>
                )}
                {s.status === 'submitted' && (
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => approve(s.id)}
                      disabled={processing === s.id}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-500 text-white rounded-lg flex items-center gap-1 disabled:opacity-40"
                    >
                      <CheckCircle className="w-3 h-3" /> 승인 + 지급
                    </button>
                    <button
                      onClick={() => reject(s.id)}
                      disabled={processing === s.id}
                      className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-lg flex items-center gap-1 disabled:opacity-40"
                    >
                      <XCircle className="w-3 h-3" /> 거절
                    </button>
                  </div>
                )}
                {s.status === 'paid' && (
                  <p className="text-xs text-emerald-600 font-bold text-right">✓ {s.bonus_amount.toLocaleString()}딜 지급</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  )
}
