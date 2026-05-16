/**
 * 🛡️ 2026-05-16: 어드민 인플루언서 분쟁 조정 페이지.
 *
 * 인플이 신고한 분쟁 (부당 차단 / commission 분쟁 / 기타) 조정.
 * [resolved] → 결과 입력, optionally 차단 해제
 * [rejected] → 거절 사유 입력
 */

import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader, DashboardLoading } from '@/components/dashboard'
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react'

interface Dispute {
  id: number
  influencer_id: string
  seller_id: number | null
  seller_name: string | null
  type: 'unfair_block' | 'commission_dispute' | 'other'
  description: string
  status: 'open' | 'resolved' | 'rejected'
  resolution: string | null
  created_at: string
  resolved_at: string | null
}

const TYPE_LABEL: Record<string, string> = {
  unfair_block: '부당 차단',
  commission_dispute: 'Commission 분쟁',
  other: '기타',
}

export default function AdminInfluencerDisputesPage() {
  const [tab, setTab] = useState<'open' | 'resolved' | 'rejected'>('open')
  const [list, setList] = useState<Dispute[]>([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState<number | null>(null)

  useEffect(() => { load() }, [tab])

  function load() {
    setLoading(true)
    api.get('/api/admin-payouts/disputes', { params: { status: tab } })
      .then((r) => { if (r.data?.success) setList(r.data.data || []) })
      .catch(() => toast.error('로드 실패'))
      .finally(() => setLoading(false))
  }

  async function resolve(d: Dispute, action: 'resolved' | 'rejected') {
    const resolution = prompt(`${action === 'resolved' ? '조정 결과' : '거절 사유'} (필수, 최소 5자)`)
    if (!resolution || resolution.trim().length < 5) {
      toast.error('5자 이상 입력 필요')
      return
    }
    let unblockInfluencer = false
    if (action === 'resolved' && d.seller_id && d.type === 'unfair_block') {
      unblockInfluencer = confirm('매장의 차단도 함께 해제할까요? (인플 보호)')
    }
    setProcessing(d.id)
    try {
      await api.post(`/api/admin-payouts/disputes/${d.id}/resolve`, { action, resolution: resolution.trim(), unblock_influencer: unblockInfluencer })
      toast.success(action === 'resolved' ? '조정 완료' : '거절 처리')
      load()
    } catch { toast.error('처리 실패') }
    finally { setProcessing(null) }
  }

  return (
    <AdminLayout title="인플루언서 분쟁 조정">
      <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title="인플루언서 분쟁 조정"
          subtitle="인플이 신고한 부당 차단 / commission 분쟁 처리"
          icon={<AlertTriangle className="h-5 w-5" />}
        />

        <div className="flex gap-2">
          {(['open', 'resolved', 'rejected'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold ${tab === t ? 'bg-gray-900 text-white' : 'bg-white text-gray-700 border border-gray-200'}`}
            >
              {t === 'open' ? '대기 중' : t === 'resolved' ? '해결됨' : '거절됨'}
            </button>
          ))}
        </div>

        {loading ? <DashboardLoading /> : list.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
            <p className="text-sm text-gray-500">해당 상태의 분쟁이 없습니다.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map(d => (
              <li key={d.id} className="bg-white border border-gray-200 rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] px-2 py-0.5 bg-pink-100 text-pink-700 rounded font-bold">{TYPE_LABEL[d.type] || d.type}</span>
                      <span className="text-[10px] text-gray-500">{new Date(d.created_at).toLocaleString('ko-KR')}</span>
                    </div>
                    <p className="text-sm font-medium text-gray-900">인플: <span className="font-mono">{d.influencer_id}</span></p>
                    {d.seller_id && <p className="text-xs text-gray-500">vs 매장: {d.seller_name || `#${d.seller_id}`}</p>}
                  </div>
                </div>
                <p className="text-sm text-gray-700 bg-gray-50 rounded p-3 mb-3 whitespace-pre-wrap">{d.description}</p>
                {d.resolution && (
                  <p className="text-xs text-gray-600 italic mb-3">조정 결과: {d.resolution}</p>
                )}
                {d.status === 'open' && (
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => resolve(d, 'resolved')}
                      disabled={processing === d.id}
                      className="px-3 py-1.5 text-xs font-bold bg-emerald-500 text-white rounded-lg flex items-center gap-1 disabled:opacity-40"
                    >
                      <CheckCircle className="w-3 h-3" /> 해결
                    </button>
                    <button
                      onClick={() => resolve(d, 'rejected')}
                      disabled={processing === d.id}
                      className="px-3 py-1.5 text-xs font-bold bg-red-500 text-white rounded-lg flex items-center gap-1 disabled:opacity-40"
                    >
                      <XCircle className="w-3 h-3" /> 거절
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </AdminLayout>
  )
}
