import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { Target, Check, Users } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

export default function AgencyTargetsPage() {
  const { t } = useTranslation()
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7))
  const [editId, setEditId] = useState<number | null>(null)
  const [editValue, setEditValue] = useState('')
  // 🛡️ 2026-06-01 Tier2(대시보드): 수동 페칭 → useApiQuery (month별 캐시). 저장 후 refetch.
  const { data: targets = [], isLoading: loading, refetch } = useApiQuery<any[]>(
    ['agency', 'targets', month], '/api/agency/targets',
    { params: { month }, select: (r: any) => (r?.success ? r.data || [] : []) },
  )

  const handleSave = async (sellerId: number) => {
    const amount = parseInt(editValue) || 0
    try {
      await api.put('/api/agency/targets', { seller_id: sellerId, month, target_amount: amount })
      toast.success('목표가 설정되었습니다')
      setEditId(null)
      refetch()
    } catch { toast.error('저장 실패') }
  }

  return (
    <AgencyLayout title={t('agency.targets')}>
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('agency.targets')}
          subtitle={t('agency.targetsSubtitle')}
          icon={<Target className="h-5 w-5" />}
          actions={
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900" />
          }
        />

        {loading ? (
          <DashboardLoading />
        ) : targets.length === 0 ? (
          <DashboardEmptyState icon={<Users className="h-7 w-7" />} title={t('agency.noSellers')} />
        ) : (
          <div className="space-y-3">
            {targets.map((t: { seller_id: number; seller_name: string; target_amount: number; current_amount: number }) => {
              const pct = t.target_amount > 0 ? Math.min(100, Math.round((t.current_amount / t.target_amount) * 100)) : 0
              return (
                <div key={t.seller_id} className="bg-white rounded-xl border border-gray-200 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Target className="w-4 h-4 text-blue-500" />
                      <span className="text-sm font-bold text-gray-900">{t.seller_name}</span>
                    </div>
                    {editId === t.seller_id ? (
                      <div className="flex items-center gap-2">
                        <input type="number" value={editValue} onChange={e => setEditValue(e.target.value)}
                          placeholder="목표 금액" className="w-32 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-900" />
                        <button onClick={() => handleSave(t.seller_id)} className="p-1.5 bg-blue-600 text-white rounded-lg">
                          <Check className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <button onClick={() => { setEditId(t.seller_id); setEditValue(String(t.target_amount || '')) }}
                        className="text-xs text-blue-600 font-medium">
                        {t.target_amount > 0 ? '수정' : '목표 설정'}
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-gray-500 mb-2">
                    <span>현재 매출: <b className="text-gray-900">{formatNumber(t.current_amount)}원</b></span>
                    {t.target_amount > 0 && <span>목표: <b className="text-gray-900">{formatNumber(t.target_amount)}원</b></span>}
                  </div>
                  {t.target_amount > 0 && (
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className={`h-2 rounded-full transition-all ${pct >= 100 ? 'bg-green-500' : pct >= 50 ? 'bg-blue-500' : 'bg-orange-400'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  )}
                  {t.target_amount > 0 && (
                    <p className={`text-xs mt-1 font-medium ${pct >= 100 ? 'text-green-600' : 'text-gray-500'}`}>
                      {pct >= 100 ? '목표 달성!' : `달성률 ${pct}%`}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </AgencyLayout>
  )
}
