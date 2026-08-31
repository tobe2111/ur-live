/**
 * 🎁 2026-07-12 체험 캠페인 — 셀러 셀프 관리 (WP-A 2순위 · 게이트 뒤).
 *   생성은 platform_settings.experience_campaign_seller_create='true' 일 때만(기본 OFF). 게이트 OFF 여도
 *   어드민이 대행 개설한 내 캠페인은 조회·추첨·리포트 가능(관리 도구는 항상 노출).
 *   백엔드: src/features/group-buy/api/experience-campaign.routes.ts sellerApp (/api/seller-experience-campaigns)
 *   라이트 테마 고정(SellerLayout).
 */
import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import api from '@/lib/api'
import SellerLayout from '@/components/SellerLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { getSellerToken } from '@/lib/seller-auth'
import { formatNumber } from '@/utils/format'
import { Gift, RefreshCw, Dice5, ShieldCheck, Lock } from 'lucide-react'

interface Campaign {
  id: number; title: string; status: string; slots: number
  product_id: number; product_name?: string; restaurant_name?: string
  entry_count?: number; selected_count?: number; created_at?: string
}
interface Entry { id: number; user_id: string; status: string; voucher_id: number | null; user_name?: string }
interface Report { metrics: { applied?: number; selected?: number; visited?: number; conversion_orders?: number } | null }

export default function SellerExperienceCampaignsPage() {
  const { t } = useTranslation()
  const headers = { Authorization: `Bearer ${getSellerToken() || ''}` }
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [enabled, setEnabled] = useState(false)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [form, setForm] = useState({ product_id: '', title: '', description: '', slots: '3', apply_end: '', mission: '' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/seller-experience-campaigns', { headers })
      setCampaigns(r.data?.campaigns || [])
      setEnabled(!!r.data?.seller_create_enabled)
    } catch { toast.error(t('seller.expCampaigns.listFailed', { defaultValue: '목록 조회 실패' })) } finally { setLoading(false) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => { void load() }, [load])

  const openDetail = async (id: number) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id); setEntries([]); setReport(null)
    try {
      const [e, rp] = await Promise.all([
        api.get(`/api/seller-experience-campaigns/${id}/entries`, { headers }),
        api.get(`/api/seller-experience-campaigns/${id}/report`, { headers }),
      ])
      setEntries(e.data?.entries || []); setReport(rp.data || null)
    } catch { toast.error(t('seller.expCampaigns.detailFailed', { defaultValue: '상세 조회 실패' })) }
  }

  const create = async () => {
    if (!form.product_id || !form.title.trim()) { toast.error(t('seller.expCampaigns.required', { defaultValue: '상품 ID·제목은 필수입니다' })); return }
    setCreating(true)
    try {
      await api.post('/api/seller-experience-campaigns', {
        product_id: Number(form.product_id), title: form.title.trim(),
        description: form.description || undefined, slots: Number(form.slots) || 1,
        apply_end: form.apply_end || undefined, mission: form.mission || undefined,
      }, { headers })
      toast.success(t('seller.expCampaigns.created', { defaultValue: '캠페인이 생성되었습니다' }))
      setForm({ product_id: '', title: '', description: '', slots: '3', apply_end: '', mission: '' })
      void load()
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || t('seller.expCampaigns.createFailed', { defaultValue: '생성 실패' })) } finally { setCreating(false) }
  }

  const draw = async (id: number, slots: number) => {
    const cnt = window.prompt(t('seller.expCampaigns.drawPrompt', { defaultValue: '추첨할 인원 수 (모집 {{slots}}명)', slots }), String(slots))
    if (cnt == null) return
    if (!window.confirm(t('seller.expCampaigns.drawConfirm', { defaultValue: '추첨을 실행합니다. 선정자에게 0원 체험권이 자동 발급됩니다.\n(공정 추첨 — 시드·풀·결과가 영구 기록되어 되돌릴 수 없습니다.)' }))) return
    try {
      const r = await api.post(`/api/seller-experience-campaigns/${id}/draw`, { count: Number(cnt) || slots }, { headers })
      toast.success(t('seller.expCampaigns.drawDone', { defaultValue: '추첨 완료 — 응모 {{pool}}명 중 {{winners}}명 선정, 체험권 {{issued}}건 발급', pool: r.data?.pool_size, winners: r.data?.winners, issued: r.data?.vouchers_issued }))
      void load(); await openDetail(id)
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || t('seller.expCampaigns.drawFailed', { defaultValue: '추첨 실패' })) }
  }

  const statusBadge = (s: string) => {
    const m: Record<string, { t: string; c: string }> = {
      open: { t: t('seller.expCampaigns.statusOpen', { defaultValue: '모집중' }), c: 'bg-green-100 text-green-700' },
      drawn: { t: t('seller.expCampaigns.statusDrawn', { defaultValue: '추첨완료' }), c: 'bg-blue-100 text-blue-700' },
      closed: { t: t('seller.expCampaigns.statusClosed', { defaultValue: '종료' }), c: 'bg-gray-100 text-gray-600' },
    }
    const x = m[s] || { t: s, c: 'bg-gray-100 text-gray-600' }
    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${x.c}`}>{x.t}</span>
  }

  return (
    <SellerLayout title={t('seller.nav.experienceCampaigns', { defaultValue: '체험 캠페인' })}>
      <div className="mx-auto max-w-4xl p-4 sm:p-6 lg:p-8">
        <DashboardPageHeader
          title={t('seller.nav.experienceCampaigns', { defaultValue: '체험 캠페인' })}
          subtitle={t('seller.expCampaigns.subtitle', { defaultValue: '무료 응모·공정 추첨 체험단. 선정자에게 0원 체험권이 자동 발급됩니다 (매장 자기부담 · 정산·수수료 무관).' })}
          icon={<Gift className="w-5 h-5" />}
          actions={<button type="button" onClick={() => void load()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[12px] text-gray-700"><RefreshCw className="w-3.5 h-3.5" />{t('common.refresh', { defaultValue: '새로고침' })}</button>}
        />

        {/* 생성 폼 — 게이트 ON 일 때만. OFF 면 안내 배너 */}
        {enabled ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-4 mb-5">
            <h3 className="text-[14px] font-bold text-gray-900 mb-3">{t('seller.expCampaigns.newTitle', { defaultValue: '새 체험 캠페인' })}</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              <label className="text-[12px] text-gray-600">{t('seller.expCampaigns.productId', { defaultValue: '제공 이용권 상품 ID' })}
                <input value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" placeholder={t('seller.expCampaigns.productIdPh', { defaultValue: '내 상품 ID' })} />
              </label>
              <label className="text-[12px] text-gray-600">{t('seller.expCampaigns.slots', { defaultValue: '모집 인원' })}
                <input value={form.slots} onChange={e => setForm(f => ({ ...f, slots: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
              </label>
              <label className="text-[12px] text-gray-600">{t('seller.expCampaigns.applyEnd', { defaultValue: '응모 마감(선택)' })}
                <input type="datetime-local" value={form.apply_end} onChange={e => setForm(f => ({ ...f, apply_end: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
              </label>
              <label className="text-[12px] text-gray-600 col-span-2 lg:col-span-3">{t('seller.expCampaigns.titleLabel', { defaultValue: '캠페인 제목' })}
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" placeholder={t('seller.expCampaigns.titlePh', { defaultValue: '예: 아메리카노 체험단' })} />
              </label>
              <label className="text-[12px] text-gray-600 col-span-2 lg:col-span-2">{t('seller.expCampaigns.mission', { defaultValue: '미션(선택 — 예: 블로그 후기 게시)' })}
                <input value={form.mission} onChange={e => setForm(f => ({ ...f, mission: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" placeholder={t('seller.expCampaigns.missionPh', { defaultValue: '선정자 미션' })} />
              </label>
              <label className="text-[12px] text-gray-600 col-span-2 lg:col-span-3">{t('seller.expCampaigns.desc', { defaultValue: '설명(선택)' })}
                <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <button type="button" disabled={creating} onClick={create} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-[13px] font-semibold disabled:opacity-50">{creating ? t('seller.expCampaigns.creating', { defaultValue: '생성 중…' }) : t('seller.expCampaigns.createBtn', { defaultValue: '캠페인 개설' })}</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 mb-5 flex items-start gap-2.5 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
            <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-[12px] leading-relaxed text-amber-800">
              {t('seller.expCampaigns.gateNotice', { defaultValue: '셀러 셀프 캠페인 개설은 준비 중입니다. 지금은 유어딜 담당자가 대신 개설해 드립니다 — 개설을 원하시면 관리자에게 문의해주세요. (개설된 캠페인의 응모자 조회·추첨·리포트는 아래에서 가능합니다.)' })}
            </p>
          </div>
        )}

        {/* 캠페인 목록 */}
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? <div className="p-8 text-center text-gray-400 text-[13px]">{t('seller.expCampaigns.loading', { defaultValue: '로딩 중…' })}</div>
          : campaigns.length === 0 ? <div className="p-8 text-center text-gray-400 text-[13px]">{t('seller.expCampaigns.empty', { defaultValue: '개설된 캠페인이 없습니다.' })}</div>
          : campaigns.map(c => (
            <div key={c.id} className="border-t border-gray-100 first:border-t-0">
              <button type="button" onClick={() => void openDetail(c.id)} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-gray-900 truncate">{c.title}</p>
                  <p className="text-[11px] text-gray-500">#{c.id} · {c.restaurant_name || c.product_name || t('seller.expCampaigns.productN', { defaultValue: '상품 {{id}}', id: c.product_id })}</p>
                </div>
                <div className="text-right text-[11px] text-gray-500">{t('seller.expCampaigns.counts', { defaultValue: '응모 {{e}} / 선정 {{s}} · 모집 {{n}}', e: formatNumber(c.entry_count), s: formatNumber(c.selected_count), n: c.slots })}</div>
                {statusBadge(c.status)}
              </button>
              {expanded === c.id && (
                <div className="px-4 pb-4 bg-gray-50/60">
                  <div className="flex flex-wrap gap-2 py-3">
                    {c.status === 'open' && <button type="button" onClick={() => void draw(c.id, c.slots)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold"><Dice5 className="w-3.5 h-3.5" />{t('seller.expCampaigns.drawBtn', { defaultValue: '공정 추첨 실행' })}</button>}
                  </div>
                  {report?.metrics && (
                    <div className="grid grid-cols-4 gap-2 mb-3">
                      {[[t('seller.expCampaigns.mApplied', { defaultValue: '응모' }), report.metrics.applied], [t('seller.expCampaigns.mSelected', { defaultValue: '선정' }), report.metrics.selected], [t('seller.expCampaigns.mVisited', { defaultValue: '방문(사용)' }), report.metrics.visited], [t('seller.expCampaigns.mConv', { defaultValue: '링크전환' }), report.metrics.conversion_orders]].map(([l, v]) => (
                        <div key={String(l)} className="bg-white rounded-xl border border-gray-200 p-3 text-center"><p className="text-[18px] font-black text-gray-900">{formatNumber(v as number)}</p><p className="text-[10px] text-gray-500">{l}</p></div>
                      ))}
                    </div>
                  )}
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <p className="text-[12px] font-bold text-gray-900 px-3 py-2 border-b border-gray-100 flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-blue-600" />{t('seller.expCampaigns.entrants', { defaultValue: '응모자' })} ({entries.length})</p>
                    <div className="max-h-64 overflow-auto">
                      {entries.length === 0 ? <p className="p-3 text-[12px] text-gray-400">{t('seller.expCampaigns.noEntrants', { defaultValue: '응모자 없음' })}</p> : entries.map(e => (
                        <div key={e.id} className="flex items-center justify-between px-3 py-1.5 text-[11px] border-t border-gray-50">
                          <span className="text-gray-700">{e.user_name || `user ${e.user_id}`}</span>
                          <span className={e.status === 'selected' ? 'text-blue-600 font-semibold' : 'text-gray-400'}>{e.status === 'selected' ? t('seller.expCampaigns.selectedWith', { defaultValue: '선정 (체험권 #{{id}})', id: e.voucher_id }) : e.status === 'applied' ? t('seller.expCampaigns.mApplied', { defaultValue: '응모' }) : e.status}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </SellerLayout>
  )
}
