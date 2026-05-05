import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { Award, Plus, Trash2, Eye, X, BarChart3 } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'

type Metric = 'sales' | 'rating' | 'streams' | 'orders' | 'viewers'

interface Rule {
  id: number
  name: string
  metric: Metric
  threshold: number
  bonus_rate: number
  is_active: number
  priority: number
  created_at: string
}

interface Payout {
  id: number
  seller_id: number
  seller_name?: string
  month: string
  rule_id: number | null
  rule_name?: string
  metric_value: number
  base_commission: number
  bonus_commission: number
  total: number
  status: 'calculated' | 'paid' | 'cancelled'
  paid_at: string | null
}

interface Preview {
  agency_id: number
  month: string
  evaluated: number
  total_base: number
  total_bonus: number
  payouts: Array<{
    seller_id: number
    metric_value: number
    matched_rule_name?: string
    base_commission: number
    bonus_commission: number
    total: number
  }>
}

const METRIC_LABEL: Record<Metric, string> = {
  sales: '매출 (원)',
  rating: '평균 별점',
  streams: '라이브 횟수',
  orders: '주문 수',
  viewers: '누적 시청자',
}

const METRIC_OPTIONS: Metric[] = ['sales', 'rating', 'streams', 'orders', 'viewers']

const ymNow = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AgencyIncentivesPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'rules' | 'payouts' | 'preview'>('rules')
  const [rules, setRules] = useState<Rule[]>([])
  const [payouts, setPayouts] = useState<Payout[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [loading, setLoading] = useState(true)
  const [previewMonth, setPreviewMonth] = useState(ymNow())
  const [creating, setCreating] = useState(false)

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  const [form, setForm] = useState({
    name: '',
    metric: 'sales' as Metric,
    threshold: 0,
    bonus_rate: 0,
    priority: 0,
  })

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadRules = useCallback(() => {
    setLoading(true)
    api.get('/api/agency/incentives/rules', { headers })
      .then(r => { if (r.data?.success) setRules(r.data.data || []) })
      .catch(() => toast.error(t('agency.incentives.loadRulesFailed', { defaultValue: '규칙 조회 실패' })))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadPayouts = useCallback((month?: string) => {
    setLoading(true)
    const url = month ? `/api/agency/incentives/payouts?month=${month}` : '/api/agency/incentives/payouts'
    api.get(url, { headers })
      .then(r => { if (r.data?.success) setPayouts(r.data.data || []) })
      .catch(() => toast.error(t('agency.incentives.loadPayoutsFailed', { defaultValue: '지급 이력 조회 실패' })))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadPreview = useCallback((month: string) => {
    setLoading(true)
    api.get(`/api/agency/incentives/preview?month=${month}`, { headers })
      .then(r => { if (r.data?.success) setPreview(r.data.data) })
      .catch(() => toast.error(t('agency.incentives.previewFailed', { defaultValue: 'Preview 실패' })))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (tab === 'rules') loadRules()
    else if (tab === 'payouts') loadPayouts()
    else if (tab === 'preview') loadPreview(previewMonth)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  const submit = async () => {
    if (!form.name) { toast.error(t('agency.incentives.nameRequired', { defaultValue: '이름 필수' })); return }
    if (form.bonus_rate < 0 || form.bonus_rate > 100) { toast.error(t('agency.incentives.bonusRateRange', { defaultValue: '보너스율 0~100' })); return }
    try {
      await api.post('/api/agency/incentives/rules', form, { headers })
      toast.success(t('agency.incentives.ruleAdded', { defaultValue: '규칙 추가됨' }))
      setCreating(false)
      setForm({ name: '', metric: 'sales', threshold: 0, bonus_rate: 0, priority: 0 })
      loadRules()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t('agency.incentives.createFailed', { defaultValue: '생성 실패' }))
    }
  }

  const toggleActive = async (rule: Rule) => {
    try {
      await api.patch(`/api/agency/incentives/rules/${rule.id}`, { is_active: !rule.is_active }, { headers })
      loadRules()
    } catch {
      toast.error(t('agency.incentives.statusChangeFailed', { defaultValue: '상태 변경 실패' }))
    }
  }

  const deleteRule = async (id: number) => {
    if (!confirm(t('agency.incentives.confirmDeactivate', { defaultValue: '이 규칙을 비활성화하시겠습니까?' }))) return
    try {
      await api.delete(`/api/agency/incentives/rules/${id}`, { headers })
      toast.info(t('agency.incentives.deactivated', { defaultValue: '비활성화됨' }))
      loadRules()
    } catch { toast.error(t('agency.incentives.deleteFailed', { defaultValue: '삭제 실패' })) }
  }

  return (
    <AgencyLayout title={t('agency.incentives.title', { defaultValue: '인센티브 규칙' })}>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('agency.incentives.engineTitle', { defaultValue: '인센티브 규칙 엔진' })}
          subtitle={t('agency.incentives.engineSubtitle', { defaultValue: '매출/평점/라이브 등 KPI 기반 셀러 보너스 자동 계산' })}
          icon={<Award className="h-5 w-5" />}
        />

        <div className="flex gap-2 border-b border-gray-200">
          {[
            { key: 'rules', label: t('agency.incentives.tabRules', { defaultValue: '규칙' }) },
            { key: 'payouts', label: t('agency.incentives.tabPayouts', { defaultValue: '지급 이력' }) },
            { key: 'preview', label: t('agency.incentives.tabPreview', { defaultValue: 'Preview (시뮬레이션)' }) },
          ].map(({ key, label }) => (
            <button key={key} onClick={() => setTab(key as any)}
              className={`px-4 py-2 text-sm font-bold ${tab === key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}>
              {label}
            </button>
          ))}
        </div>

        {/* === 규칙 탭 === */}
        {tab === 'rules' && (
          <>
            <div className="flex justify-end">
              <button onClick={() => setCreating(true)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg">
                <Plus className="w-4 h-4" /> {t('agency.incentives.addRule', { defaultValue: '규칙 추가' })}
              </button>
            </div>
            {loading ? <DashboardLoading /> : rules.length === 0 ? (
              <DashboardEmptyState icon={<Award className="h-7 w-7" />} title={t('agency.incentives.noRules', { defaultValue: '규칙이 없습니다 — 추가해보세요' })} />
            ) : (
              <div className="space-y-2">
                {rules.map(r => (
                  <div key={r.id} className={`bg-white rounded-xl border p-4 flex items-center justify-between ${r.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-900">{r.name}</p>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-bold">
                          {METRIC_LABEL[r.metric as Metric]}
                        </span>
                        {r.priority > 0 && (
                          <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-bold">
                            {t('agency.incentives.priority', { defaultValue: '우선순위' })} {r.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">
                        {METRIC_LABEL[r.metric as Metric]} <strong className="text-gray-700">{formatNumber(r.threshold)}</strong> {t('agency.incentives.orMore', { defaultValue: '이상' })}
                        →  {t('agency.incentives.bonus', { defaultValue: '보너스' })} <strong className="text-emerald-600">+{r.bonus_rate}%</strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => toggleActive(r)}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg ${r.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {r.is_active ? t('agency.incentives.active', { defaultValue: '활성' }) : t('agency.incentives.inactive', { defaultValue: '비활성' })}
                      </button>
                      <button onClick={() => deleteRule(r.id)} className="p-2 text-red-500 hover:bg-red-50 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* === 지급 이력 탭 === */}
        {tab === 'payouts' && (
          <>
            <div className="flex items-center gap-2">
              <input type="month" defaultValue={ymNow()}
                onChange={e => loadPayouts(e.target.value || undefined)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
            </div>
            {loading ? <DashboardLoading /> : payouts.length === 0 ? (
              <DashboardEmptyState icon={<BarChart3 className="h-7 w-7" />} title={t('agency.incentives.noPayouts', { defaultValue: '지급 이력 없음' })} />
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2 text-left">{t('agency.incentives.colMonth', { defaultValue: '월' })}</th>
                      <th className="px-4 py-2 text-left">{t('agency.incentives.colSeller', { defaultValue: '셀러' })}</th>
                      <th className="px-4 py-2 text-left">{t('agency.incentives.colRule', { defaultValue: '규칙' })}</th>
                      <th className="px-4 py-2 text-right">{t('agency.incentives.colBase', { defaultValue: '기본' })}</th>
                      <th className="px-4 py-2 text-right">{t('agency.incentives.colBonus', { defaultValue: '보너스' })}</th>
                      <th className="px-4 py-2 text-right">{t('agency.incentives.colTotal', { defaultValue: '합계' })}</th>
                      <th className="px-4 py-2 text-center">{t('agency.incentives.colStatus', { defaultValue: '상태' })}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {payouts.map(p => (
                      <tr key={p.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">{p.month}</td>
                        <td className="px-4 py-2 font-bold text-gray-900">{p.seller_name || `#${p.seller_id}`}</td>
                        <td className="px-4 py-2 text-gray-500">{p.rule_name || '-'}</td>
                        <td className="px-4 py-2 text-right text-gray-700">{formatNumber(p.base_commission)}</td>
                        <td className="px-4 py-2 text-right text-emerald-600 font-bold">+{formatNumber(p.bonus_commission)}</td>
                        <td className="px-4 py-2 text-right font-bold text-gray-900">{formatNumber(p.total)}</td>
                        <td className="px-4 py-2 text-center">
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                            p.status === 'paid' ? 'bg-green-100 text-green-700' :
                            p.status === 'cancelled' ? 'bg-red-100 text-red-600' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {p.status === 'paid' ? t('agency.incentives.statusPaid', { defaultValue: '지급완료' }) : p.status === 'cancelled' ? t('common.cancel', { defaultValue: '취소' }) : t('agency.incentives.statusCalculated', { defaultValue: '계산됨' })}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {/* === Preview 탭 === */}
        {tab === 'preview' && (
          <>
            <div className="flex items-center gap-2">
              <input type="month" value={previewMonth}
                onChange={e => setPreviewMonth(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
              <button onClick={() => loadPreview(previewMonth)}
                className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg">
                <Eye className="w-4 h-4" /> {t('agency.incentives.simulate', { defaultValue: '시뮬레이션' })}
              </button>
            </div>
            {loading ? <DashboardLoading /> : preview && (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <div className="bg-blue-50 rounded-xl p-4">
                    <p className="text-xs text-blue-700 font-bold uppercase">{t('agency.incentives.evaluatedSellers', { defaultValue: '평가 셀러' })}</p>
                    <p className="text-2xl font-extrabold text-gray-900">{preview.evaluated}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-xs text-gray-600 font-bold uppercase">{t('agency.incentives.totalBaseCommission', { defaultValue: '기본 수수료 합계' })}</p>
                    <p className="text-2xl font-extrabold text-gray-900">{formatNumber(preview.total_base)}{t('common.won', { defaultValue: '원' })}</p>
                  </div>
                  <div className="bg-emerald-50 rounded-xl p-4">
                    <p className="text-xs text-emerald-700 font-bold uppercase">{t('agency.incentives.totalBonus', { defaultValue: '보너스 합계' })}</p>
                    <p className="text-2xl font-extrabold text-emerald-600">+{formatNumber(preview.total_bonus)}{t('common.won', { defaultValue: '원' })}</p>
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  💡 {t('agency.incentives.simulationNote', { defaultValue: '이 화면은 시뮬레이션입니다. 실제 지급은 매월 첫 월요일 cron 으로 자동 계산됩니다.' })}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* 규칙 생성 모달 */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{t('agency.incentives.addRuleTitle', { defaultValue: '인센티브 규칙 추가' })}</h2>
              <button onClick={() => setCreating(false)}><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700">{t('agency.incentives.fieldName', { defaultValue: '이름' })} *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">{t('agency.incentives.fieldMetric', { defaultValue: '평가 metric' })} *</label>
                <select value={form.metric} onChange={e => setForm({ ...form, metric: e.target.value as Metric })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
                  {METRIC_OPTIONS.map(m => <option key={m} value={m}>{METRIC_LABEL[m]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700">{t('agency.incentives.fieldThreshold', { defaultValue: '임계값 (이상)' })}</label>
                  <input type="number" value={form.threshold} step="any"
                    onChange={e => setForm({ ...form, threshold: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">{t('agency.incentives.fieldBonusRate', { defaultValue: '보너스율 (%)' })}</label>
                  <input type="number" value={form.bonus_rate} min={0} max={100} step={0.1}
                    onChange={e => setForm({ ...form, bonus_rate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">{t('agency.incentives.fieldPriority', { defaultValue: '우선순위 (높은 순으로 매칭)' })}</label>
                <input type="number" value={form.priority} min={0}
                  onChange={e => setForm({ ...form, priority: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setCreating(false)} className="px-4 py-2 text-gray-600 text-sm font-bold">{t('common.cancel', { defaultValue: '취소' })}</button>
                <button onClick={submit} className="px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg">{t('common.create', { defaultValue: '생성' })}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </AgencyLayout>
  )
}
