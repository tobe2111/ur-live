import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { DollarSign, CheckCircle, Clock, Loader2, ArrowRight, Banknote } from 'lucide-react'

export default function AgencySettlementsPage() {
  const { t } = useTranslation()
  const [data, setData] = useState<any[]>([])
  const [summary, setSummary] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)

  function load() {
    api.get('/api/agency/settlements')
      .then(r => { if (r.data.success) { setData(r.data.data || []); setSummary(r.data.summary || {}) } })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const payableAmount = summary.total_agency_commission || 0
  const confirmedCount = summary.confirmed || 0

  async function requestPayout() {
    if (confirmedCount === 0) { toast.error('정산 가능한 주문이 없습니다'); return }
    if (!confirm(`${payableAmount.toLocaleString()}원 정산을 신청하시겠습니까?`)) return
    setRequesting(true)
    try {
      const res = await api.post('/api/agency/settlements/request')
      if (res.data.success) {
        toast.success(`정산 신청 완료! ${res.data.data.commission_amount.toLocaleString()}원`)
        load()
      } else {
        toast.error(res.data.error || '정산 신청 실패')
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '정산 신청에 실패했습니다')
    } finally { setRequesting(false) }
  }

  return (
    <AgencyLayout title={t('agency.settlements')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        {/* 🛡️ 2026-04-22 배치 130: 디자인 시스템 적용 */}
        <DashboardPageHeader
          title={t('agency.settlements')}
          subtitle={t('agency.settlementsSubtitle')}
          icon={<DollarSign className="h-5 w-5" />}
        />

        {/* 정산 신청 CTA */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm opacity-80">정산 가능 금액</p>
              <p className="text-3xl font-extrabold mt-1">{payableAmount.toLocaleString()}원</p>
              <p className="text-xs opacity-70 mt-2">확정 주문 {confirmedCount}건 · 수수료율 {summary.agency_commission_rate || 2}%</p>
            </div>
            <button
              onClick={requestPayout}
              disabled={requesting || confirmedCount === 0}
              className="flex items-center gap-2 px-6 py-3 bg-white text-blue-700 font-bold rounded-xl text-sm disabled:opacity-50 active:scale-95 transition-all"
            >
              <Banknote className="w-5 h-5" />
              {requesting ? '신청 중...' : '정산 신청'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 통계 카드 */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[
            { label: '전체', value: summary.total || 0, icon: DollarSign, color: 'text-gray-700', bg: 'bg-gray-50' },
            { label: '대기', value: summary.pending || 0, icon: Clock, color: 'text-yellow-600', bg: 'bg-yellow-50' },
            { label: '확정', value: summary.confirmed || 0, icon: CheckCircle, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: '완료', value: summary.completed || 0, icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4`}>
              <s.icon className={`w-5 h-5 ${s.color} mb-2`} />
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">주문번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">셀러</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">금액</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">정산상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">날짜</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((r: { id: number; order_number: string; seller_name: string; total_amount?: number; settlement_status: string; created_at: string }) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 font-mono text-xs">{r.order_number}</td>
                    <td className="px-4 py-3">{r.seller_name}</td>
                    <td className="px-4 py-3 text-right font-bold">{r.total_amount?.toLocaleString()}원</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        r.settlement_status === 'completed' ? 'bg-green-100 text-green-700' :
                        r.settlement_status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                        'bg-yellow-100 text-yellow-700'
                      }`}>{r.settlement_status === 'completed' ? '완료' : r.settlement_status === 'confirmed' ? '확정' : '대기'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
