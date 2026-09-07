/**
 * 🎁 2026-07-12 체험 캠페인 관리 (어드민 대행 생성 = 1순위, 서초 산출물).
 *   백엔드: src/features/group-buy/api/experience-campaign.routes.ts
 *   라이트 테마 고정(AdminLayout). 대행 생성 → 응모자 조회 → 공정추첨(시드/이력) → 리포트.
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatNumber } from '@/utils/format'
import { Gift, RefreshCw, Dice5, FileDown, ShieldCheck } from 'lucide-react'
import { formatKST } from '@/utils/date'

interface Campaign {
  id: number; title: string; status: string; slots: number
  product_id: number; product_name?: string; restaurant_name?: string
  seller_id: number; entry_count?: number; selected_count?: number
  apply_start?: string | null; apply_end?: string | null; created_at?: string
}
interface Entry { id: number; user_id: string; status: string; voucher_id: number | null; created_at: string; selected_at: string | null; user_name?: string }
interface DrawLog { id: number; admin_id: string | null; method: string; seed: string; pool_size: number; requested_count: number | null; winners: string; created_at: string }
interface Report { campaign: Record<string, unknown> | null; metrics: { applied?: number; selected?: number; visited?: number; conversion_orders?: number; conversion_commission?: number } | null }

export default function AdminExperienceCampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [draws, setDraws] = useState<DrawLog[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [form, setForm] = useState({ seller_id: '', product_id: '', title: '', description: '', slots: '3', apply_end: '', mission: '' })
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/admin/experience-campaigns')
      setCampaigns(r.data?.campaigns || [])
    } catch { toast.error('목록 조회 실패') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const openDetail = async (id: number) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id); setEntries([]); setDraws([]); setReport(null)
    try {
      const [e, d, rp] = await Promise.all([
        api.get(`/api/admin/experience-campaigns/${id}/entries`),
        api.get(`/api/admin/experience-campaigns/${id}/draws`),
        api.get(`/api/admin/experience-campaigns/${id}/report`),
      ])
      setEntries(e.data?.entries || []); setDraws(d.data?.draws || []); setReport(rp.data || null)
    } catch { toast.error('상세 조회 실패') }
  }

  const create = async () => {
    if (!form.seller_id || !form.product_id || !form.title.trim()) { toast.error('매장ID·상품ID·제목은 필수입니다'); return }
    setCreating(true)
    try {
      await api.post('/api/admin/experience-campaigns', {
        seller_id: Number(form.seller_id), product_id: Number(form.product_id), title: form.title.trim(),
        description: form.description || undefined, slots: Number(form.slots) || 1,
        apply_end: form.apply_end || undefined, mission: form.mission || undefined,
      })
      toast.success('캠페인이 생성되었습니다')
      setForm({ seller_id: '', product_id: '', title: '', description: '', slots: '3', apply_end: '', mission: '' })
      void load()
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '생성 실패') } finally { setCreating(false) }
  }

  const draw = async (id: number, slots: number) => {
    const cnt = window.prompt(`추첨할 인원 수 (모집 ${slots}명)`, String(slots))
    if (cnt == null) return
    if (!window.confirm(`추첨을 실행합니다. 선정자에게 0원 체험권이 자동 발급됩니다.\n(공정 추첨 — 시드·풀·결과가 영구 기록되어 되돌릴 수 없습니다.)`)) return
    try {
      const r = await api.post(`/api/admin/experience-campaigns/${id}/draw`, { count: Number(cnt) || slots })
      toast.success(`추첨 완료 — 응모 ${r.data?.pool_size}명 중 ${r.data?.winners}명 선정, 체험권 ${r.data?.vouchers_issued}건 발급`)
      void load(); await openDetail(id); if (expanded !== id) await openDetail(id)
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '추첨 실패') }
  }

  // 🛡️ 전수조사 fix: 평문 <a> 는 Bearer 미탑재(듀얼로그인 시 403) → api blob 다운로드.
  const downloadCsv = async (id: number) => {
    try {
      const r = await api.get(`/api/admin/experience-campaigns/${id}/report.csv`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data as Blob)
      const a = document.createElement('a')
      a.href = url; a.download = `campaign-${id}-report.csv`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch { toast.error('CSV 다운로드 실패') }
  }

  const statusBadge = (s: string) => {
    const m: Record<string, { t: string; c: string }> = {
      open: { t: '모집중', c: 'bg-tone-ok-bg text-tone-ok' },
      drawn: { t: '추첨완료', c: 'bg-tone-info-bg text-tone-info' },
      closed: { t: '종료', c: 'bg-gray-100 text-gray-600' },
    }
    const x = m[s] || { t: s, c: 'bg-gray-100 text-gray-600' }
    return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${x.c}`}>{x.t}</span>
  }

  return (
    <AdminLayout title="체험 캠페인">
      <DashboardPageHeader
        title="체험 캠페인 관리 (대행 생성)"
        subtitle="매장을 대신해 무료 응모·공정 추첨 체험단을 개설합니다. 선정자에게 0원 체험권이 자동 발급됩니다."
        icon={<Gift className="w-5 h-5" />}
        actions={<button type="button" onClick={() => void load()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[12px] text-gray-700"><RefreshCw className="w-3.5 h-3.5" />새로고침</button>}
      />

      {/* 대행 생성 폼 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-4 mb-5">
        <h3 className="text-[14px] font-bold text-gray-900 mb-3">새 체험 캠페인 (대행 개설)</h3>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          <label className="text-[12px] text-gray-600">매장 ID(seller_id)
            <input value={form.seller_id} onChange={e => setForm(f => ({ ...f, seller_id: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" placeholder="예: 42" />
          </label>
          <label className="text-[12px] text-gray-600">제공 이용권 상품 ID
            <input value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" placeholder="그 매장 상품 ID" />
          </label>
          <label className="text-[12px] text-gray-600">모집 인원
            <input value={form.slots} onChange={e => setForm(f => ({ ...f, slots: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600 col-span-2">캠페인 제목
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" placeholder="예: OO카페 아메리카노 체험단" />
          </label>
          <label className="text-[12px] text-gray-600">응모 마감(선택)
            <input type="datetime-local" value={form.apply_end} onChange={e => setForm(f => ({ ...f, apply_end: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600 col-span-2 lg:col-span-2">미션(선택 — 예: 블로그 후기 게시)
            <input value={form.mission} onChange={e => setForm(f => ({ ...f, mission: e.target.value }))} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" placeholder="선정자 미션" />
          </label>
          <label className="text-[12px] text-gray-600 col-span-2 lg:col-span-3">설명(선택)
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={creating} onClick={create} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-[13px] font-semibold disabled:opacity-50">{creating ? '생성 중…' : '캠페인 개설'}</button>
        </div>
      </div>

      {/* 캠페인 목록 */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400 text-[13px]">로딩 중…</div>
        : campaigns.length === 0 ? <div className="p-8 text-center text-gray-400 text-[13px]">개설된 캠페인이 없습니다.</div>
        : campaigns.map(c => (
          <div key={c.id} className="border-t border-gray-100 first:border-t-0">
            <button type="button" onClick={() => void openDetail(c.id)} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{c.title}</p>
                <p className="text-[11px] text-gray-500">#{c.id} · {c.restaurant_name || c.product_name || `상품 ${c.product_id}`} · 매장 {c.seller_id}</p>
              </div>
              <div className="text-right text-[11px] text-gray-500">응모 {formatNumber(c.entry_count)} / 선정 {formatNumber(c.selected_count)} · 모집 {c.slots}</div>
              {statusBadge(c.status)}
            </button>
            {expanded === c.id && (
              <div className="px-4 pb-4 bg-gray-50/60">
                {/* 액션 */}
                <div className="flex flex-wrap gap-2 py-3">
                  {c.status === 'open' && <button type="button" onClick={() => void draw(c.id, c.slots)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold"><Dice5 className="w-3.5 h-3.5" />공정 추첨 실행</button>}
                  <button type="button" onClick={() => void downloadCsv(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-[12px]"><FileDown className="w-3.5 h-3.5" />리포트 CSV</button>
                </div>
                {/* 리포트 요약 */}
                {report?.metrics && (
                  <div className="grid grid-cols-4 gap-2 mb-3">
                    {[['응모', report.metrics.applied], ['선정', report.metrics.selected], ['방문(사용)', report.metrics.visited], ['링크전환', report.metrics.conversion_orders]].map(([l, v]) => (
                      <div key={String(l)} className="bg-white rounded-xl border border-gray-200 p-3 text-center"><p className="text-[18px] font-black text-gray-900">{formatNumber(v as number)}</p><p className="text-[10px] text-gray-500">{l}</p></div>
                    ))}
                  </div>
                )}
                {/* 추첨 이력 (B2G 증빙) */}
                {draws.length > 0 && (
                  <div className="bg-white rounded-xl border border-gray-200 p-3 mb-3">
                    <p className="text-[12px] font-bold text-gray-900 flex items-center gap-1 mb-2"><ShieldCheck className="w-3.5 h-3.5 text-blue-600" />추첨 이력 (조작불가 증빙)</p>
                    {draws.map(d => (
                      <div key={d.id} className="text-[11px] text-gray-600 border-t border-gray-100 py-1.5 first:border-t-0">
                        <span className="text-gray-400">{formatKST(d.created_at)}</span> · 방식 {d.method} · 풀 {d.pool_size}명 · 당첨 {(() => { try { return JSON.parse(d.winners).length } catch { return '?' } })()}명
                        <div className="text-[10px] text-gray-400 font-mono break-all">seed: {d.seed}</div>
                      </div>
                    ))}
                  </div>
                )}
                {/* 응모자 */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  <p className="text-[12px] font-bold text-gray-900 px-3 py-2 border-b border-gray-100">응모자 ({entries.length})</p>
                  <div className="max-h-64 overflow-auto">
                    {entries.length === 0 ? <p className="p-3 text-[12px] text-gray-400">응모자 없음</p> : entries.map(e => (
                      <div key={e.id} className="flex items-center justify-between px-3 py-1.5 text-[11px] border-t border-gray-50">
                        <span className="text-gray-700">{e.user_name || `user ${e.user_id}`}</span>
                        <span className={e.status === 'selected' ? 'text-blue-600 font-semibold' : 'text-gray-400'}>{e.status === 'selected' ? `선정 (체험권 #${e.voucher_id})` : e.status === 'applied' ? '응모' : e.status}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
