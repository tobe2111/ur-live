import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { RotateCcw } from 'lucide-react'
import { formatNumber } from '@/utils/format'

export default function AgencyReturnsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [returns, setReturns] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token || ''}` }

  useEffect(() => {
    if (!token) {
      navigate('/agency/login', { replace: true })
    }
  }, [token, navigate])

  useEffect(() => {
    api.get('/api/agency/returns', { headers })
      .then(r => { if (r.data.success) setReturns(r.data.data || []) })
      .catch((_e) => { if (import.meta.env.DEV) console.warn(_e) })
      .finally(() => setLoading(false))
  }, [])

  const statusLabels: Record<string, { label: string; color: string }> = {
    requested: { label: '신청', color: 'bg-yellow-100 text-yellow-700' },
    approved: { label: '승인', color: 'bg-blue-100 text-blue-700' },
    shipped: { label: '반송중', color: 'bg-purple-100 text-purple-700' },
    inspected: { label: '검수완료', color: 'bg-orange-100 text-orange-700' },
    refunded: { label: '환불완료', color: 'bg-green-100 text-green-700' },
    rejected: { label: '거부', color: 'bg-red-100 text-red-700' },
  }

  return (
    <AgencyLayout title={t('agency.returns')}>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('agency.returns')}
          subtitle={t('agency.returnsSubtitle')}
          icon={<RotateCcw className="h-5 w-5" />}
        />

        {loading ? (
          <DashboardLoading />
        ) : returns.length === 0 ? (
          <DashboardEmptyState icon={<RotateCcw className="h-7 w-7" />} title={t('agency.noReturns')} />
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">주문번호</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">셀러</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">사유</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-700">환불금액</th>
                  <th className="text-center px-4 py-3 font-medium text-gray-700">상태</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-700">날짜</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {returns.map((r: { id: number; order_number: string; seller_name: string; reason: string; refund_amount?: number; status: string; created_at: string }) => {
                  const st = statusLabels[r.status] || { label: r.status, color: 'bg-gray-100 text-gray-700' }
                  return (
                    <tr key={r.id}>
                      <td className="px-4 py-3 font-mono text-xs">{r.order_number}</td>
                      <td className="px-4 py-3">{r.seller_name}</td>
                      <td className="px-4 py-3 text-xs text-gray-600 max-w-[200px] truncate">{r.reason}</td>
                      <td className="px-4 py-3 text-right font-bold">{formatNumber(r.refund_amount || 0)}원</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${st.color}`}>{st.label}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString('ko-KR')}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
