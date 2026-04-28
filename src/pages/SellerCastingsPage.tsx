import { useCallback, useEffect, useState } from 'react'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { Megaphone, Check, X, Calendar, DollarSign } from 'lucide-react'

interface Casting {
  id: number
  advertiser_id: number
  advertiser_name: string | null
  campaign_title: string
  campaign_brief: string | null
  product_category: string | null
  proposed_fee: number
  expected_revenue: number | null
  proposed_live_date: string | null
  status: string
  rejection_reason: string | null
  created_at: string
  seller_response_at: string | null
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  sent_to_seller: { label: '응답 대기', cls: 'bg-yellow-100 text-yellow-800' },
  accepted: { label: '수락 — 진행 중', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '거절', cls: 'bg-red-100 text-red-700' },
  completed: { label: '완료', cls: 'bg-blue-100 text-blue-700' },
}

export default function SellerCastingsPage() {
  const [items, setItems] = useState<Casting[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const token = localStorage.getItem('seller_token')
      const r = await api.get('/api/seller/castings', { headers: { Authorization: `Bearer ${token}` } })
      if (r.data.success) setItems(r.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '불러오기 실패')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  async function respond(id: number, response: 'accept' | 'reject') {
    const reason = response === 'reject' ? prompt('거절 사유 (선택):') || '' : undefined
    if (response === 'accept' && !confirm('이 캐스팅을 수락하시겠습니까?')) return
    try {
      const token = localStorage.getItem('seller_token')
      await api.post(`/api/seller/castings/${id}/respond`,
        { response, reason },
        { headers: { Authorization: `Bearer ${token}` } })
      toast.success(response === 'accept' ? '수락 완료. 광고주가 곧 연락드릴 예정입니다.' : '거절 완료')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '실패')
    }
  }

  const pending = items.filter(c => c.status === 'sent_to_seller')
  const others = items.filter(c => c.status !== 'sent_to_seller')

  return (
    <SellerLayout title="캐스팅 신청">
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title="캐스팅 신청"
          subtitle="광고주가 보낸 캠페인 신청을 검토하고 수락/거절하세요."
          icon={<Megaphone className="h-5 w-5" />}
        />

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-12">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-12 bg-white rounded-xl border border-gray-100">
            아직 캐스팅 신청이 없습니다. 라이브 활동을 늘리면 광고주의 관심을 받을 가능성이 높아집니다.
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <Section title={`📨 응답 대기 (${pending.length})`}>
                {pending.map(c => (
                  <CastingCard key={c.id} c={c} onRespond={(r) => respond(c.id, r)} />
                ))}
              </Section>
            )}
            {others.length > 0 && (
              <Section title="📋 응답 기록">
                {others.map(c => <CastingCard key={c.id} c={c} />)}
              </Section>
            )}
          </>
        )}
      </div>
    </SellerLayout>
  )
}

function Section(props: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h3 className="text-sm font-bold text-gray-900">{props.title}</h3>
      </div>
      <div className="divide-y divide-gray-100">{props.children}</div>
    </div>
  )
}

function CastingCard(props: { c: Casting; onRespond?: (response: 'accept' | 'reject') => void }) {
  const { c } = props
  const status = STATUS_LABEL[c.status]
  return (
    <div className="p-4">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-bold text-gray-900">{c.campaign_title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">광고주: {c.advertiser_name || '?'}</p>
        </div>
        {status && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${status.cls}`}>
            {status.label}
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 mt-3">
        <div className="bg-gray-50 rounded-lg p-2">
          <div className="text-[10px] text-gray-500 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> 제안 비용
          </div>
          <div className="text-sm font-bold text-gray-900 mt-0.5">{c.proposed_fee.toLocaleString()}원</div>
        </div>
        {c.proposed_live_date && (
          <div className="bg-gray-50 rounded-lg p-2">
            <div className="text-[10px] text-gray-500 flex items-center gap-1">
              <Calendar className="w-3 h-3" /> 제안 라이브 일자
            </div>
            <div className="text-sm font-bold text-gray-900 mt-0.5">
              {new Date(c.proposed_live_date).toLocaleDateString('ko-KR')}
            </div>
          </div>
        )}
      </div>

      {c.product_category && (
        <div className="mt-2 text-xs text-gray-600">
          카테고리: <strong>{c.product_category}</strong>
        </div>
      )}
      {c.campaign_brief && (
        <div className="mt-2 p-2 bg-gray-50 rounded text-xs text-gray-700 leading-relaxed whitespace-pre-wrap">
          {c.campaign_brief}
        </div>
      )}
      {c.rejection_reason && (
        <div className="mt-2 text-xs text-red-500">거절 사유: {c.rejection_reason}</div>
      )}

      {c.status === 'sent_to_seller' && props.onRespond && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => props.onRespond?.('accept')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg">
            <Check className="w-3.5 h-3.5" /> 수락
          </button>
          <button onClick={() => props.onRespond?.('reject')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-red-50 hover:text-red-600 text-gray-600 text-xs rounded-lg">
            <X className="w-3.5 h-3.5" /> 거절
          </button>
        </div>
      )}
    </div>
  )
}
