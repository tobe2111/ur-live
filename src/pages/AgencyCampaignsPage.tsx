import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { Megaphone, Plus, Calendar, Target, Users, RefreshCw, X, ChevronRight } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { swallow } from '@/shared/utils/swallow'

interface Campaign {
  id: number
  name: string
  description: string | null
  start_date: string
  end_date: string
  status: 'scheduled' | 'active' | 'ended' | 'cancelled'
  base_incentive_rate: number | null
  target_amount: number | null
  category: string | null
  participant_count?: number
  total_revenue?: number
  created_at: string
}

interface Participant {
  id: number
  campaign_id: number
  seller_id: number
  seller_name: string
  seller_email: string
  target_amount: number | null
  bonus_rate: number | null
  current_amount: number
  current_orders: number
  status: string
}

interface SellerOption {
  id: number
  name: string
  email?: string
}

const STATUS_TABS: Array<{ key: 'all' | Campaign['status']; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'scheduled', label: '예정' },
  { key: 'active', label: '진행 중' },
  { key: 'ended', label: '종료' },
  { key: 'cancelled', label: '취소' },
]

const STATUS_BADGE: Record<Campaign['status'], string> = {
  scheduled: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  ended: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-600',
}

const STATUS_LABEL: Record<Campaign['status'], string> = {
  scheduled: '예정', active: '진행 중', ended: '종료', cancelled: '취소',
}

export default function AgencyCampaignsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [tab, setTab] = useState<typeof STATUS_TABS[number]['key']>('all')
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [sellers, setSellers] = useState<SellerOption[]>([])

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  // 폼 state
  const [form, setForm] = useState({
    name: '', description: '', start_date: '', end_date: '',
    base_incentive_rate: 0, target_amount: 0, category: '',
    selectedSellerIds: [] as number[],
  })

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    api.get(`/api/agency/campaigns?status=${tab}`, { headers })
      .then(r => { if (r.data?.success) setCampaigns(r.data.data || []) })
      .catch((e: any) => {
        if (e?.response?.status === 401) { navigate('/agency/login', { replace: true }); return }
        toast.error(t('agency.campaigns.loadFailed', { defaultValue: '캠페인 조회 실패' }))
      })
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  useEffect(() => { load() }, [load])

  const loadSellers = () => {
    api.get('/api/agency/sellers', { headers })
      .then(r => { if (r.data?.success) setSellers(r.data.data || []) })
      .catch(swallow('agency:campaigns-fetch-sellers'))
  }

  const openCampaignDetail = async (c: Campaign) => {
    setSelectedCampaign(c)
    try {
      const r = await api.get(`/api/agency/campaigns/${c.id}`, { headers })
      if (r.data?.success) setParticipants(r.data.data.participants || [])
    } catch {
      toast.error(t('agency.campaigns.detailLoadFailed', { defaultValue: '상세 조회 실패' }))
    }
  }

  const submit = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      toast.error(t('agency.campaigns.requiredFields', { defaultValue: '이름/시작일/종료일은 필수' }))
      return
    }
    if (form.end_date < form.start_date) {
      toast.error(t('agency.campaigns.endDateError', { defaultValue: '종료일이 시작일보다 빠를 수 없음' }))
      return
    }
    try {
      const r = await api.post('/api/agency/campaigns', {
        name: form.name,
        description: form.description || undefined,
        start_date: form.start_date,
        end_date: form.end_date,
        base_incentive_rate: form.base_incentive_rate || 0,
        target_amount: form.target_amount || undefined,
        category: form.category || undefined,
        seller_ids: form.selectedSellerIds.length > 0 ? form.selectedSellerIds : undefined,
      }, { headers })
      if (r.data?.success) {
        toast.success(t('agency.campaigns.created', { defaultValue: '캠페인 생성됨 (id: {{id}})', id: r.data.data.id }))
        setCreating(false)
        setForm({ name: '', description: '', start_date: '', end_date: '', base_incentive_rate: 0, target_amount: 0, category: '', selectedSellerIds: [] })
        load()
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t('agency.campaigns.createFailed', { defaultValue: '생성 실패' }))
    }
  }

  const cancel = async (id: number) => {
    if (!confirm(t('agency.campaigns.confirmCancel', { defaultValue: '이 캠페인을 취소하시겠습니까?' }))) return
    try {
      await api.post(`/api/agency/campaigns/${id}/cancel`, {}, { headers })
      toast.info(t('agency.campaigns.cancelled', { defaultValue: '취소됨' }))
      setSelectedCampaign(null)
      load()
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t('agency.campaigns.cancelFailed', { defaultValue: '취소 실패' }))
    }
  }

  const refresh = async (id: number) => {
    try {
      await api.post(`/api/agency/campaigns/${id}/refresh`, {}, { headers })
      toast.success(t('agency.campaigns.refreshed', { defaultValue: '재집계 완료' }))
      if (selectedCampaign?.id === id) openCampaignDetail(selectedCampaign)
    } catch (e: any) {
      toast.error(e?.response?.data?.error || t('agency.campaigns.refreshFailed', { defaultValue: '재집계 실패' }))
    }
  }

  return (
    <AgencyLayout title={t('agency.campaigns.title', { defaultValue: '캠페인' })}>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('agency.campaigns.title', { defaultValue: '캠페인' })}
          subtitle={t('agency.campaigns.subtitle', { defaultValue: '에이전시 주도의 매출 캠페인 — 셀러별 KPI/보너스 설정' })}
          icon={<Megaphone className="h-5 w-5" />}
          actions={
            <button
              onClick={() => { loadSellers(); setCreating(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg"
            >
              <Plus className="w-4 h-4" /> {t('agency.campaigns.create', { defaultValue: '캠페인 만들기' })}
            </button>
          }
        />

        {/* 탭 */}
        <div className="flex gap-2 border-b border-gray-200 overflow-x-auto">
          {STATUS_TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-2 text-sm font-bold whitespace-nowrap transition-colors ${
                tab === key ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {loading ? (
          <DashboardLoading />
        ) : campaigns.length === 0 ? (
          <DashboardEmptyState icon={<Megaphone className="h-7 w-7" />} title={t('agency.campaigns.noCampaigns', { defaultValue: '캠페인이 없습니다' })} />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {campaigns.map(c => (
              <div
                key={c.id}
                onClick={() => openCampaignDetail(c)}
                className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-gray-900 truncate">{c.name}</p>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${STATUS_BADGE[c.status]}`}>
                        {STATUS_LABEL[c.status]}
                      </span>
                    </div>
                    {c.description && <p className="text-xs text-gray-500 line-clamp-1">{c.description}</p>}
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </div>

                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{c.start_date} ~ {c.end_date}</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.participant_count ?? 0}{t('agency.campaigns.participants', { defaultValue: '명 참여' })}</span>
                  {c.base_incentive_rate ? <span className="flex items-center gap-1"><Target className="w-3 h-3" />{c.base_incentive_rate}%</span> : null}
                </div>

                {c.total_revenue !== undefined && c.total_revenue > 0 && (
                  <p className="text-xs font-bold text-emerald-600 mt-2">
                    누적 매출: {(c.total_revenue / 10_000).toFixed(0)}만원
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 생성 모달 */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{t('agency.campaigns.create', { defaultValue: '캠페인 만들기' })}</h2>
              <button onClick={() => setCreating(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700">{t('agency.campaigns.fieldName', { defaultValue: '이름' })} *</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" maxLength={100} />
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">{t('agency.campaigns.fieldDesc', { defaultValue: '설명' })}</label>
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700">{t('agency.campaigns.fieldStartDate', { defaultValue: '시작일' })} *</label>
                  <input type="date" value={form.start_date} onChange={e => setForm({ ...form, start_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">{t('agency.campaigns.fieldEndDate', { defaultValue: '종료일' })} *</label>
                  <input type="date" value={form.end_date} onChange={e => setForm({ ...form, end_date: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700">{t('agency.campaigns.fieldIncentiveRate', { defaultValue: '기본 인센티브율 (%)' })}</label>
                  <input type="number" value={form.base_incentive_rate} min={0} max={100} step={0.1}
                    onChange={e => setForm({ ...form, base_incentive_rate: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">{t('agency.campaigns.fieldTargetAmount', { defaultValue: '목표 금액 (원)' })}</label>
                  <input type="number" value={form.target_amount} min={0}
                    onChange={e => setForm({ ...form, target_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">{t('agency.campaigns.fieldSellers', { defaultValue: '참여 셀러 (옵션 — 나중에 추가 가능)' })}</label>
                <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                  {sellers.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">{t('agency.campaigns.noAffiliateSellers', { defaultValue: '소속 셀러 없음' })}</p>
                  ) : sellers.map(s => (
                    <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox"
                        checked={form.selectedSellerIds.includes(s.id)}
                        onChange={e => {
                          const next = e.target.checked
                            ? [...form.selectedSellerIds, s.id]
                            : form.selectedSellerIds.filter(id => id !== s.id)
                          setForm({ ...form, selectedSellerIds: next })
                        }}
                      />
                      <span className="text-xs text-gray-700">{s.name}</span>
                      {s.email && <span className="text-[10px] text-gray-400">{s.email}</span>}
                    </label>
                  ))}
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{t('agency.campaigns.selectedSellers', { defaultValue: '{{count}}명 선택', count: form.selectedSellerIds.length })}</p>
              </div>
              <div className="flex justify-end gap-2 pt-3">
                <button onClick={() => setCreating(false)} className="px-4 py-2 text-gray-600 text-sm font-bold">{t('common.cancel', { defaultValue: '취소' })}</button>
                <button onClick={submit} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg">{t('common.create', { defaultValue: '생성' })}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 상세 모달 */}
      {selectedCampaign && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedCampaign(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-3xl w-full max-h-[90dvh] overflow-y-auto p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{selectedCampaign.name}</h2>
                <p className="text-xs text-gray-500">{selectedCampaign.start_date} ~ {selectedCampaign.end_date}</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => refresh(selectedCampaign.id)} title="누적 재집계"
                  className="p-2 hover:bg-gray-100 rounded">
                  <RefreshCw className="w-4 h-4 text-gray-500" />
                </button>
                {(selectedCampaign.status === 'scheduled' || selectedCampaign.status === 'active') && (
                  <button onClick={() => cancel(selectedCampaign.id)}
                    className="px-3 py-1.5 bg-red-100 text-red-600 text-xs font-bold rounded-lg hover:bg-red-200">
                    {t('agency.campaigns.cancelAction', { defaultValue: '캠페인 취소' })}
                  </button>
                )}
                <button onClick={() => setSelectedCampaign(null)} className="p-1 hover:bg-gray-100 rounded">
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            {selectedCampaign.description && (
              <p className="text-sm text-gray-600 mb-4">{selectedCampaign.description}</p>
            )}

            <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">{t('agency.campaigns.participantSellers', { defaultValue: '참여 셀러' })} ({participants.length}{t('agency.campaigns.personCount', { defaultValue: '명' })})</h3>
            {participants.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6">{t('agency.campaigns.noParticipants', { defaultValue: '참여 셀러 없음' })}</p>
            ) : (
              <div className="space-y-2">
                {participants.map(p => {
                  const target = p.target_amount || selectedCampaign.target_amount || 0
                  const pct = target > 0 ? Math.min(100, Math.round((p.current_amount / target) * 100)) : 0
                  return (
                    <div key={p.id} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-bold text-gray-900">{p.seller_name}</p>
                        <p className="text-sm font-bold text-emerald-600">
                          {(p.current_amount / 10_000).toFixed(0)}만원
                          {target > 0 && <span className="text-xs text-gray-400 font-normal"> / {(target / 10_000).toFixed(0)}만원</span>}
                        </p>
                      </div>
                      {target > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-1.5">
                          <div className="bg-blue-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      )}
                      <p className="text-[10px] text-gray-400 mt-1">
                        주문 {p.current_orders}건
                        {p.bonus_rate ? ` · 보너스 ${p.bonus_rate}%` : ''}
                      </p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </AgencyLayout>
  )
}
