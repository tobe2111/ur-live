import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { ArrowRightLeft, ArrowRight, Check, X } from 'lucide-react'

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

const STATUS_CLS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  accepted_by_to: 'bg-blue-100 text-blue-700',
  approved_by_seller: 'bg-purple-100 text-purple-700',
  completed: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-500',
}

export default function AgencyTransfersPage() {
  const { t } = useTranslation()
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
      toast.error(err?.response?.data?.error || t('agency.transfers.loadFailed', { defaultValue: '불러오기 실패' }))
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  async function respondToIncoming(id: number, response: 'accept' | 'reject') {
    const reason = response === 'reject' ? prompt(t('agency.transfers.rejectReasonPrompt', { defaultValue: '거절 사유 (선택):' })) || '' : undefined
    try {
      const token = localStorage.getItem('agency_token')
      await api.post(`/api/agency/transfers/${id}/respond`,
        { response, reason },
        { headers: { Authorization: `Bearer ${token}` } })
      toast.success(response === 'accept' ? t('agency.transfers.accepted', { defaultValue: '수락됨 — 셀러 동의 대기 중' }) : t('agency.transfers.rejected', { defaultValue: '거절 완료' }))
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('common.failed', { defaultValue: '실패' }))
    }
  }

  // 🛡️ 2026-04-30 TD-016 CRITICAL: agency 가 셀러 동의를 대행하던 위험 endpoint 제거.
  //   대신 셀러에게 알림이 자동 발송되고, 셀러는 /seller/transfers 에서 직접 응답함.

  async function cancelOutgoing(id: number) {
    if (!confirm(t('agency.transfers.confirmCancel', { defaultValue: '이 신청을 취소하시겠습니까?' }))) return
    try {
      const token = localStorage.getItem('agency_token')
      await api.post(`/api/agency/transfers/${id}/cancel`, {},
        { headers: { Authorization: `Bearer ${token}` } })
      toast.info(t('agency.transfers.cancelled', { defaultValue: '취소됨' }))
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || t('common.failed', { defaultValue: '실패' }))
    }
  }

  const incoming = myAgencyId ? items.filter(tr => tr.to_agency_id === myAgencyId) : []
  const outgoing = myAgencyId ? items.filter(tr => tr.from_agency_id === myAgencyId) : items

  return (
    <AgencyLayout title={t('agency.transfers.title', { defaultValue: '셀러 이전' })}>
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title={t('agency.transfers.pageTitle', { defaultValue: '셀러 이전 (Network)' })}
          subtitle={t('agency.transfers.pageSubtitle', { defaultValue: '에이전시 간 셀러 이전. 3자 동의 (보내는 쪽 → 받는 쪽 → 셀러)' })}
          icon={<ArrowRightLeft className="h-5 w-5" />}
        />

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
          {t('agency.transfers.flowDesc', { defaultValue: '⚠️ 이전 흐름: ① 보내는 에이전시 신청 → ② 받는 에이전시 수락 → ③ 셀러 본인이 셀러 대시보드에서 직접 동의 → 매핑 변경. 이전 후 30일 cooldown. 셀러에게 알림이 자동 발송되며, 에이전시가 셀러 대신 동의할 수 없습니다 (보안).' })}
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-12">{t('agency.transfers.loading', { defaultValue: '불러오는 중...' })}</div>
        ) : items.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-12 bg-white rounded-xl border border-gray-100">
            {t('agency.transfers.empty', { defaultValue: '아직 이전 내역이 없습니다.' })}
          </div>
        ) : (
          <>
            {/* 받은 신청 */}
            {incoming.length > 0 && (
              <Section title={t('agency.transfers.incomingSection', { defaultValue: '받은 신청' })}>
                {incoming.map(tr => (
                  <TransferCard key={tr.id} transfer={tr} kind="incoming"
                    onAction={(r) => respondToIncoming(tr.id, r)} />
                ))}
              </Section>
            )}
            {/* 보낸 신청 */}
            <Section title={incoming.length > 0 ? t('agency.transfers.outgoingSection', { defaultValue: '보낸 신청' }) : t('agency.transfers.historySection', { defaultValue: '신청 내역' })}>
              {outgoing.map(tr => (
                <TransferCard key={tr.id} transfer={tr} kind="outgoing"
                  onCancel={() => cancelOutgoing(tr.id)} />
              ))}
              {outgoing.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4">{t('agency.transfers.noOutgoing', { defaultValue: '없음' })}</div>
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
  transfer: Transfer
  kind: 'incoming' | 'outgoing'
  onAction?: (response: 'accept' | 'reject') => void
  onCancel?: () => void
}) {
  const { t } = useTranslation()
  const { transfer } = props
  const statusCls = STATUS_CLS[transfer.status] || STATUS_CLS.pending
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-2">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${statusCls}`}>
          {t(`agency.transfers.status.${transfer.status}`, { defaultValue: transfer.status })}
        </span>
        <span className="text-xs text-gray-500">
          {new Date(transfer.created_at).toLocaleDateString('ko-KR')}
        </span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        <span className="font-medium text-gray-900">{transfer.from_agency_name || '?'}</span>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <span className="font-medium text-gray-900">{transfer.to_agency_name || '?'}</span>
      </div>
      <div className="text-xs text-gray-600 mt-1">
        {t('agency.transfers.seller', { defaultValue: '셀러' })}: <strong>{transfer.seller_name || `#${transfer.seller_id}`}</strong>
      </div>
      {transfer.reason && <div className="text-xs text-gray-500 mt-1 italic">"{transfer.reason}"</div>}
      {transfer.rejection_reason && (
        <div className="text-xs text-red-500 mt-1">{t('agency.transfers.rejectionReason', { defaultValue: '거절 사유' })}: {transfer.rejection_reason}</div>
      )}

      {/* 액션 */}
      {props.kind === 'incoming' && transfer.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          <button onClick={() => props.onAction?.('accept')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-xs font-bold rounded-lg">
            <Check className="w-3.5 h-3.5" /> {t('agency.transfers.accept', { defaultValue: '수락' })}
          </button>
          <button onClick={() => props.onAction?.('reject')}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg">
            <X className="w-3.5 h-3.5" /> {t('agency.transfers.reject', { defaultValue: '거절' })}
          </button>
        </div>
      )}
      {props.kind === 'outgoing' && transfer.status === 'accepted_by_to' && (
        <div className="mt-3 text-[11px] text-blue-700 bg-blue-50 p-2.5 rounded">
          {t('agency.transfers.sellerConsentNote', { defaultValue: '✅ 받는 에이전시가 수락했습니다. 셀러 본인이 직접 동의해야 매핑이 변경됩니다. 셀러에게 마이페이지 → 셀러 대시보드 → "에이전시 이전" 메뉴에서 응답 요청해주세요.' })}
        </div>
      )}
      {props.kind === 'outgoing' && transfer.status === 'pending' && (
        <button onClick={props.onCancel}
          className="mt-3 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 text-xs rounded">
          {t('agency.transfers.cancelRequest', { defaultValue: '신청 취소' })}
        </button>
      )}
    </div>
  )
}
