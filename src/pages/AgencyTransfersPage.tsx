import { useEffect, useState } from 'react'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { ArrowRightLeft, ArrowRight, Check, X, Send } from 'lucide-react'

interface Transfer {
  id: number
  seller_id: number
  seller_name: string | null
  from_agency_id: number
  from_agency_name: string | null
  to_agency_id: number
  to_agency_name: string | null
  reason: string | null
  status: string
  rejection_reason: string | null
  created_at: string
  to_response_at: string | null
  seller_response_at: string | null
  completed_at: string | null
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pending: { label: '응답 대기', cls: 'bg-yellow-100 text-yellow-800' },
  accepted_by_to: { label: '수락됨 — 셀러 동의 대기', cls: 'bg-blue-100 text-blue-700' },
  approved_by_seller: { label: '셀러 동의 — 처리 중', cls: 'bg-purple-100 text-purple-700' },
  completed: { label: '완료', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '거절', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-500' },
}

export default function AgencyTransfersPage() {
  const [items, setItems] = useState<Transfer[]>([])
  const [myAgencyId, setMyAgencyId] = useState<number | null>(null)
  const [loading, setLoading] = useState(true)

  async function fetchAll() {
    setLoading(true)
    try {
      const token = localStorage.getItem('agency_token')
      const r = await api.get('/api/agency/transfers', { headers: { Authorization: `Bearer ${token}` } })
      if (r.data.success) {
        setItems(r.data.data)
        // 첫 transfer 의 from/to 중 하나가 본인일 텐데 직접 확인 어려움 → 전체 ID 뽑기
        // 간단히 from_agency_id 가 가장 많이 나오는 거를 본인으로 추정 — 또는 별도 endpoint
      }
      // me 조회
      try {
        const me = await api.get('/api/agency/me', { headers: { Authorization: `Bearer ${token}` } })
        if (me.data?.data?.id) setMyAgencyId(Number(me.data.data.id))
      } catch { /* skip */ }
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '불러오기 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  async function respondToIncoming(id: number, response: 'accept' | 'reject') {
    const reason = response === 'reject' ? prompt('거절 사유 (선택):') || '' : undefined
    try {
      const token = localStorage.getItem('agency_token')
      await api.post(`/api/agency/transfers/${id}/respond`,
        { response, reason },
        { headers: { Authorization: `Bearer ${token}` } })
      toast.success(response === 'accept' ? '수락됨 — 셀러 동의 대기 중' : '거절 완료')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '실패')
    }
  }

  async function submitSellerApproval(id: number, approved: boolean) {
    const msg = approved
      ? '셀러가 이전에 동의했음을 확인하셨습니까? 매핑이 즉시 변경됩니다.'
      : '셀러가 이전을 거부했습니까?'
    if (!confirm(msg)) return
    const reason = approved ? undefined : prompt('거부 사유 (선택):') || ''
    try {
      const token = localStorage.getItem('agency_token')
      await api.post(`/api/agency/transfers/${id}/seller-approve`,
        { approved, reason },
        { headers: { Authorization: `Bearer ${token}` } })
      toast.success(approved ? '이전 완료!' : '거부됨')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '실패')
    }
  }

  async function cancelOutgoing(id: number) {
    if (!confirm('이 신청을 취소하시겠습니까?')) return
    try {
      const token = localStorage.getItem('agency_token')
      await api.post(`/api/agency/transfers/${id}/cancel`, {},
        { headers: { Authorization: `Bearer ${token}` } })
      toast.info('취소됨')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '실패')
    }
  }

  const incoming = myAgencyId ? items.filter(t => t.to_agency_id === myAgencyId) : []
  const outgoing = myAgencyId ? items.filter(t => t.from_agency_id === myAgencyId) : items

  return (
    <AgencyLayout title="셀러 이전">
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title="셀러 이전 (Network)"
          subtitle="에이전시 간 셀러 이전. 3자 동의 (보내는 쪽 → 받는 쪽 → 셀러)"
          icon={<ArrowRightLeft className="h-5 w-5" />}
        />

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
          ⚠️ 이전 흐름: ① 보내는 에이전시가 신청 → ② 받는 에이전시 수락 → ③ 셀러 본인 동의 (보내는 쪽이 대행 입력) → 매핑 변경.
          이전 후 30일 cooldown.
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-12">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-12 bg-white rounded-xl border border-gray-100">
            아직 이전 내역이 없습니다.
          </div>
        ) : (
          <>
            {/* 받은 신청 */}
            {incoming.length > 0 && (
              <Section title="받은 신청">
                {incoming.map(t => (
                  <TransferCard key={t.id} t={t} kind="incoming"
                    onAction={(r) => respondToIncoming(t.id, r)} />
                ))}
              </Section>
            )}
            {/* 보낸 신청 */}
            <Section title={incoming.length > 0 ? '보낸 신청' : '신청 내역'}>
              {outgoing.map(t => (
                <TransferCard key={t.id} t={t} kind="outgoing"
                  onSellerApprove={(approved) => submitSellerApproval(t.id, approved)}
                  onCancel={() => cancelOutgoing(t.id)} />
              ))}
              {outgoing.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4">없음</div>
              )}
            </Section>
          </>
        )}
      </div>
    </AgencyLayout>
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

function TransferCard(props: {
  t: Transfer
  kind: 'incoming' | 'outgoing'
  onAction?: (response: 'accept' | 'reject') => void
  onSellerApprove?: (approved: boolean) => void
  onCancel?: () => void
}) {
  const { t } = props
  const status = STATUS_LABEL[t.status] || STATUS_LABEL.pending
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${status.cls}`}>
          {status.label}
        </span>
        <span className="text-xs text-gray-500">
          {new Date(t.created_at).toLocaleDateString('ko-KR')}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-gray-900">{t.from_agency_name || '?'}</span>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <span className="font-medium text-gray-900">{t.to_agency_name || '?'}</span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        셀러: <strong>{t.seller_name || `#${t.seller_id}`}</strong>
      </div>
      {t.reason && <div className="text-xs text-gray-500 mt-1 italic">"{t.reason}"</div>}
      {t.rejection_reason && (
        <div className="text-xs text-red-500 mt-1">거절 사유: {t.rejection_reason}</div>
      )}

      {/* 액션 */}
      {props.kind === 'incoming' && t.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => props.onAction?.('accept')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg">
            <Check className="w-3.5 h-3.5" /> 수락
          </button>
          <button onClick={() => props.onAction?.('reject')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg">
            <X className="w-3.5 h-3.5" /> 거절
          </button>
        </div>
      )}
      {props.kind === 'outgoing' && t.status === 'accepted_by_to' && (
        <div className="mt-3 space-y-2">
          <div className="text-[11px] text-blue-700 bg-blue-50 p-2 rounded">
            받는 에이전시가 수락했습니다. 셀러에게 동의 의사를 확인 후 아래 버튼을 눌러주세요.
          </div>
          <div className="flex gap-2">
            <button onClick={() => props.onSellerApprove?.(true)}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-500 hover:bg-purple-600 text-white text-xs font-bold rounded-lg">
              <Send className="w-3.5 h-3.5" /> 셀러 동의함 → 매핑 변경
            </button>
            <button onClick={() => props.onSellerApprove?.(false)}
              className="flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded-lg">
              셀러 거부
            </button>
          </div>
        </div>
      )}
      {props.kind === 'outgoing' && t.status === 'pending' && (
        <button onClick={props.onCancel}
          className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded">
          신청 취소
        </button>
      )}
    </div>
  )
}
