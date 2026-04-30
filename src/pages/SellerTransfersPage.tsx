import { useEffect, useState } from 'react'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { ArrowRightLeft, Check, X, ArrowRight, Building2 } from 'lucide-react'

/**
 * 🛡️ 2026-04-30 TD-016 CRITICAL: 셀러 본인이 직접 동의/거부하는 페이지.
 *   기존엔 from_agency 가 셀러 동의를 대행하던 위험 endpoint 였는데
 *   /api/seller/transfers/:id/respond 로 셀러 본인 토큰 인증 후 응답.
 */

interface Transfer {
  id: number
  seller_id: number
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
  pending: { label: '받는 에이전시 응답 대기', cls: 'bg-yellow-100 text-yellow-800' },
  accepted_by_to: { label: '✋ 본인 동의 필요', cls: 'bg-blue-100 text-blue-700' },
  completed: { label: '이전 완료', cls: 'bg-green-100 text-green-700' },
  rejected: { label: '거절', cls: 'bg-red-100 text-red-700' },
  cancelled: { label: '취소', cls: 'bg-gray-100 text-gray-500' },
}

export default function SellerTransfersPage() {
  const [items, setItems] = useState<Transfer[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState<number | null>(null)

  async function fetchAll() {
    setLoading(true)
    try {
      const r = await api.get('/api/seller/transfers')
      if (r.data.success) setItems(r.data.data)
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '불러오기 실패')
    } finally { setLoading(false) }
  }

  useEffect(() => { fetchAll() }, [])

  async function respond(id: number, approved: boolean) {
    const msg = approved
      ? '본 에이전시 이전에 동의하시겠습니까? 동의 시 즉시 매핑이 변경되며, 30일간 재이전이 제한됩니다.'
      : '이전을 거부하시겠습니까?'
    if (!confirm(msg)) return
    const reason = approved ? undefined : prompt('거부 사유 (선택):') || ''
    setSubmitting(id)
    try {
      await api.post(`/api/seller/transfers/${id}/respond`, { approved, reason })
      toast.success(approved ? '이전이 완료됐습니다.' : '거부 완료')
      fetchAll()
    } catch (err: any) {
      toast.error(err?.response?.data?.error || '실패')
    } finally { setSubmitting(null) }
  }

  const pending = items.filter(t => t.status === 'accepted_by_to')
  const others = items.filter(t => t.status !== 'accepted_by_to')

  return (
    <SellerLayout title="에이전시 이전">
      <div className="p-6 space-y-6">
        <DashboardPageHeader
          title="에이전시 이전 요청"
          subtitle="본인 동의가 필요한 에이전시 이전 요청을 확인하고 응답하세요."
          icon={<ArrowRightLeft className="h-5 w-5" />}
        />

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
          ⓘ 보내는 에이전시 → 받는 에이전시 → <strong>본인 동의</strong> 3단계 후 매핑이 변경됩니다.
          본인 동의 없이는 어떤 에이전시도 임의로 이전할 수 없습니다 (보안). 이전 후 30일 cooldown.
        </div>

        {loading ? (
          <div className="text-center text-sm text-gray-400 py-12">불러오는 중...</div>
        ) : items.length === 0 ? (
          <div className="text-center text-sm text-gray-400 py-12 bg-white rounded-xl border border-gray-100">
            아직 이전 요청이 없습니다.
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <Section title={`✋ 동의 필요 (${pending.length})`} highlight>
                {pending.map(t => (
                  <TransferCard
                    key={t.id} t={t} actionable
                    submitting={submitting === t.id}
                    onApprove={() => respond(t.id, true)}
                    onReject={() => respond(t.id, false)}
                  />
                ))}
              </Section>
            )}
            <Section title="전체 내역">
              {others.length === 0 ? (
                <div className="text-xs text-gray-400 text-center py-4">없음</div>
              ) : others.map(t => (
                <TransferCard key={t.id} t={t} />
              ))}
            </Section>
          </>
        )}
      </div>
    </SellerLayout>
  )
}

function Section({ title, children, highlight }: { title: string; children: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border overflow-hidden ${
      highlight ? 'bg-blue-50/30 border-blue-200' : 'bg-white border-gray-100'
    }`}>
      <div className={`px-5 py-3 border-b ${highlight ? 'border-blue-200' : 'border-gray-100'}`}>
        <h3 className="text-sm font-bold text-gray-900">{title}</h3>
      </div>
      <div className="divide-y divide-gray-100">{children}</div>
    </div>
  )
}

function TransferCard({
  t, actionable, submitting, onApprove, onReject,
}: {
  t: Transfer
  actionable?: boolean
  submitting?: boolean
  onApprove?: () => void
  onReject?: () => void
}) {
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
        <Building2 className="w-4 h-4 text-gray-400" />
        <span className="font-medium text-gray-900">{t.from_agency_name || '?'}</span>
        <ArrowRight className="w-4 h-4 text-gray-400" />
        <span className="font-medium text-gray-900">{t.to_agency_name || '?'}</span>
      </div>
      {t.reason && <div className="text-xs text-gray-500 mt-1 italic">"{t.reason}"</div>}
      {t.rejection_reason && (
        <div className="text-xs text-red-500 mt-1">거절 사유: {t.rejection_reason}</div>
      )}

      {actionable && (
        <div className="mt-3 flex gap-2">
          <button onClick={onApprove} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-lg disabled:opacity-50">
            <Check className="w-3.5 h-3.5" /> 동의
          </button>
          <button onClick={onReject} disabled={submitting}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg disabled:opacity-50">
            <X className="w-3.5 h-3.5" /> 거부
          </button>
        </div>
      )}
    </div>
  )
}
