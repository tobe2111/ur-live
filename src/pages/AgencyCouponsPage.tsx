import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import AgencyLayout from '@/components/AgencyLayout'
import { DashboardPageHeader, DashboardLoading, DashboardEmptyState } from '@/components/dashboard'
import { Ticket, Plus, X, BarChart3, ChevronRight } from 'lucide-react'
import { toast } from '@/hooks/useToast'
import { swallow } from '@/shared/utils/swallow'
import { formatNumber } from '@/utils/format'

interface Distribution {
  parent_coupon_id: number
  coupon_name: string
  parent_code: string
  type: 'percent' | 'fixed'
  value: number
  expires_at: string | null
  distributed_to_sellers: number
  total_quantity: number
  total_used: number
  first_distributed_at: string
}

interface SellerStat {
  seller_id: number
  seller_name: string
  quantity_per_seller: number
  used_count: number
  usage_pct: number
}

interface SellerOption {
  id: number
  name: string
  email?: string
}

export default function AgencyCouponsPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [distributions, setDistributions] = useState<Distribution[]>([])
  const [sellers, setSellers] = useState<SellerOption[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [statsParentId, setStatsParentId] = useState<number | null>(null)
  const [sellerStats, setSellerStats] = useState<SellerStat[]>([])

  const token = localStorage.getItem('agency_token')
  const headers = { Authorization: `Bearer ${token}` }

  const [form, setForm] = useState({
    name: '',
    type: 'percent' as 'percent' | 'fixed',
    value: 10,
    min_order_amount: 0,
    expires_at: '',
    quantity_per_seller: 50,
    selectedSellerIds: [] as number[],
  })

  useEffect(() => {
    if (!token) { navigate('/agency/login', { replace: true }); return }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const load = useCallback(() => {
    setLoading(true)
    api.get('/api/agency/coupons/distributions', { headers })
      .then(r => { if (r.data?.success) setDistributions(r.data.data || []) })
      .catch(() => toast.error('배포 이력 조회 실패'))
      .finally(() => setLoading(false))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => { load() }, [load])

  const loadSellers = () => {
    api.get('/api/agency/sellers', { headers })
      .then(r => { if (r.data?.success) setSellers(r.data.data || []) })
      .catch(swallow('agency:coupons-fetch-sellers'))
  }

  const distribute = async () => {
    if (!form.name) { toast.error('쿠폰 이름 필수'); return }
    if (form.selectedSellerIds.length === 0) { toast.error('셀러 1명 이상 선택'); return }
    if (form.quantity_per_seller < 1) { toast.error('수량 1 이상'); return }
    if (form.type === 'percent' && (form.value < 1 || form.value > 100)) { toast.error('할인율 1~100'); return }

    try {
      const r = await api.post('/api/agency/coupons/distribute', {
        name: form.name,
        type: form.type,
        value: form.value,
        min_order_amount: form.min_order_amount || undefined,
        expires_at: form.expires_at || undefined,
        seller_ids: form.selectedSellerIds,
        quantity_per_seller: form.quantity_per_seller,
      }, { headers })
      if (r.data?.success) {
        const d = r.data.data
        toast.success(`${d.distributed}/${d.total_sellers}명에게 배포됨 (총 ${d.distributed * form.quantity_per_seller}장)`)
        setCreating(false)
        setForm({ name: '', type: 'percent', value: 10, min_order_amount: 0, expires_at: '', quantity_per_seller: 50, selectedSellerIds: [] })
        load()
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.error || '배포 실패')
    }
  }

  const openStats = async (d: Distribution) => {
    setStatsParentId(d.parent_coupon_id)
    try {
      const r = await api.get(`/api/agency/coupons/distributions/${d.parent_coupon_id}/stats`, { headers })
      if (r.data?.success) setSellerStats(r.data.data.by_seller || [])
    } catch {
      toast.error('통계 조회 실패')
    }
  }

  return (
    <AgencyLayout title={t('agency.coupons.layoutTitle', { defaultValue: '쿠폰 배포' })}>
      <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('agency.coupons.pageTitle', { defaultValue: '쿠폰 캐스케이드' })}
          subtitle={t('agency.coupons.subtitle', { defaultValue: '에이전시 → 셀러 → 시청자 3단 쿠폰 배포. 셀러별 사용율 분석 가능.' })}
          icon={<Ticket className="h-5 w-5" />}
          actions={
            <button onClick={() => { loadSellers(); setCreating(true) }}
              className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg">
              <Plus className="w-4 h-4" /> {t('agency.coupons.distributeBtn', { defaultValue: '쿠폰 배포' })}
            </button>
          }
        />

        {loading ? (
          <DashboardLoading />
        ) : distributions.length === 0 ? (
          <DashboardEmptyState icon={<Ticket className="h-7 w-7" />} title={t('agency.coupons.noHistory', { defaultValue: '배포 이력 없음' })} />
        ) : (
          <div className="space-y-2">
            {distributions.map(d => {
              const usagePct = d.total_quantity > 0 ? Math.round((d.total_used / d.total_quantity) * 100) : 0
              return (
                <div key={d.parent_coupon_id}
                  onClick={() => openStats(d)}
                  className="bg-white rounded-xl border border-gray-200 p-4 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-sm font-bold text-gray-900 truncate">{d.coupon_name}</p>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold">
                          {d.type === 'percent' ? `${d.value}%` : `${formatNumber(d.value)}원`}
                        </span>
                      </div>
                      <p className="text-[10px] text-gray-400 font-mono">{d.parent_code}</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mt-2">
                        <span>셀러 {d.distributed_to_sellers}명</span>
                        <span>총 {d.total_quantity}장</span>
                        <span className="font-bold text-emerald-600">사용 {d.total_used}장 ({usagePct}%)</span>
                        {d.expires_at && <span>만료: {new Date(d.expires_at).toLocaleDateString('ko-KR')}</span>}
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2">
                        <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${usagePct}%` }} />
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0 mt-1" />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 배포 모달 */}
      {creating && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setCreating(false)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-lg w-full max-h-[90dvh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">{t('agency.coupons.modalTitle', { defaultValue: '쿠폰 배포' })}</h2>
              <button onClick={() => setCreating(false)} aria-label="닫기"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-gray-700">{t('agency.coupons.labelName', { defaultValue: '쿠폰 이름 *' })}</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700">{t('agency.coupons.labelType', { defaultValue: '유형' })}</label>
                  <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value as 'percent' | 'fixed' })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900">
                    <option value="percent">% 할인</option>
                    <option value="fixed">정액 할인</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">{form.type === 'percent' ? t('agency.coupons.labelDiscountPct', { defaultValue: '할인율 (%)' }) : t('agency.coupons.labelDiscountAmt', { defaultValue: '할인 금액 (원)' })}</label>
                  <input type="number" value={form.value} min={form.type === 'percent' ? 1 : 100} max={form.type === 'percent' ? 100 : undefined}
                    onChange={e => setForm({ ...form, value: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-gray-700">{t('agency.coupons.labelMinOrder', { defaultValue: '최소 주문액 (원)' })}</label>
                  <input type="number" value={form.min_order_amount} min={0}
                    onChange={e => setForm({ ...form, min_order_amount: Number(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-700">{t('agency.coupons.labelExpiry', { defaultValue: '만료일' })}</label>
                  <input type="date" value={form.expires_at}
                    onChange={e => setForm({ ...form, expires_at: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                </div>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">{t('agency.coupons.labelQuantity', { defaultValue: '셀러당 발급 가능 수량 *' })}</label>
                <input type="number" value={form.quantity_per_seller} min={1}
                  onChange={e => setForm({ ...form, quantity_per_seller: Number(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900" />
                <p className="text-[10px] text-gray-400 mt-1">각 셀러가 본인 시청자에게 발급할 수 있는 한도</p>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-700">{t('agency.coupons.labelSellers', { defaultValue: '받을 셀러 (1~100명) *' })}</label>
                <div className="flex items-center gap-2 mb-1">
                  <button onClick={() => setForm({ ...form, selectedSellerIds: sellers.map(s => s.id) })}
                    className="text-xs text-blue-600 hover:underline">{t('agency.coupons.selectAll', { defaultValue: '전체 선택' })}</button>
                  <button onClick={() => setForm({ ...form, selectedSellerIds: [] })}
                    className="text-xs text-gray-500 hover:underline">{t('agency.coupons.deselectAll', { defaultValue: '전체 해제' })}</button>
                  <span className="text-xs text-gray-400 ml-auto">{form.selectedSellerIds.length}명 선택</span>
                </div>
                <div className="border border-gray-200 rounded-lg max-h-40 overflow-y-auto p-2 space-y-1">
                  {sellers.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-3">{t('agency.coupons.noSellers', { defaultValue: '소속 셀러 없음' })}</p>
                  ) : sellers.map(s => (
                    <label key={s.id} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50 rounded cursor-pointer">
                      <input type="checkbox"
                        checked={form.selectedSellerIds.includes(s.id)}
                        onChange={e => setForm({
                          ...form,
                          selectedSellerIds: e.target.checked
                            ? [...form.selectedSellerIds, s.id]
                            : form.selectedSellerIds.filter(id => id !== s.id)
                        })} />
                      <span className="text-xs text-gray-700">{s.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-900">
                💡 총 발행 예정: <strong>{form.selectedSellerIds.length * form.quantity_per_seller}장</strong> ({form.selectedSellerIds.length}명 × {form.quantity_per_seller}장)
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setCreating(false)} className="px-4 py-2 text-gray-600 text-sm font-bold">{t('agency.coupons.cancelBtn', { defaultValue: '취소' })}</button>
                <button onClick={distribute}
                  disabled={!form.name || form.selectedSellerIds.length === 0}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed">
                  {t('agency.coupons.distributeConfirmBtn', { defaultValue: '배포' })}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 통계 모달 */}
      {statsParentId !== null && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setStatsParentId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl max-w-2xl w-full max-h-[90dvh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-gray-900">{t('agency.coupons.statsTitle', { defaultValue: '셀러별 사용 현황' })}</h2>
              </div>
              <button onClick={() => setStatsParentId(null)} aria-label="닫기"><X className="w-5 h-5 text-gray-500" /></button>
            </div>
            {sellerStats.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">데이터 없음</p>
            ) : (
              <div className="space-y-2">
                {sellerStats.map(s => (
                  <div key={s.seller_id} className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-bold text-gray-900">{s.seller_name || `#${s.seller_id}`}</p>
                      <p className="text-sm font-bold text-emerald-600">
                        {s.used_count} / {s.quantity_per_seller}장 ({s.usage_pct ?? 0}%)
                      </p>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-1.5">
                      <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${s.usage_pct ?? 0}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </AgencyLayout>
  )
}
