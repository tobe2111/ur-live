/**
 * 🧾 2026-07-13 상권 쿠폰(영수증 페이백) 운영 — 어드민.
 *   캠페인 생성(예산·보상구간) → 매장 일괄 등록(PIN 자동 — 셀러 계정 불필요) → 영수증 승인 큐
 *   (사진 확인 → 승인=쿠폰 자동발급 / 반려) → 리포트(발급/사용/미사용·점포별) + 정산 CSV.
 *   백엔드: features/district/api/district-coupon-admin.routes.ts (/api/admin/district).
 */
import { useState, useEffect, useCallback } from 'react'
import api from '@/lib/api'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { toast } from '@/hooks/useToast'
import { formatNumber, formatWon } from '@/utils/format'
import { TicketPercent, RefreshCw, Store, FileDown, Check, X, ImageIcon } from 'lucide-react'

interface Campaign {
  id: number; slug: string; name: string; status: string; budget_total: number
  reward_tiers: string; coupon_expires_days: number
  store_count?: number; pending_receipts?: number; issued_total?: number; created_at?: string
}
interface StoreRow { id: number; name: string; store_code: string; address?: string | null; is_active: number; used_count?: number; used_amount?: number; bank_name?: string | null; bank_account?: string | null; account_holder?: string | null }
interface ReceiptRow { id: number; user_id: string; user_name?: string | null; store_name?: string | null; amount: number; card_approval_no: string; image_key: string; status: string; reject_reason?: string | null; created_at: string; user_approved_count?: number }
interface Report { totals?: Record<string, number> | null; by_store?: Array<Record<string, unknown>> }

export default function AdminDistrictCouponsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [tab, setTab] = useState<'receipts' | 'stores' | 'report'>('receipts')
  const [stores, setStores] = useState<StoreRow[]>([])
  const [receipts, setReceipts] = useState<ReceiptRow[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [form, setForm] = useState({ slug: '', name: '', budget_total: '', tier1_min: '30000', tier1_face: '3000', tier2_min: '50000', tier2_face: '10000', coupon_expires_days: '30', description: '' })
  const [bulkLines, setBulkLines] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/admin/district/campaigns')
      setCampaigns(r.data?.campaigns || [])
    } catch { toast.error('목록 조회 실패') } finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  const loadDetail = useCallback(async (id: number, which: 'receipts' | 'stores' | 'report') => {
    try {
      if (which === 'receipts') {
        const r = await api.get(`/api/admin/district/campaigns/${id}/receipts?status=submitted`)
        setReceipts(r.data?.receipts || [])
      } else if (which === 'stores') {
        const r = await api.get(`/api/admin/district/campaigns/${id}/stores`)
        setStores(r.data?.stores || [])
      } else {
        const r = await api.get(`/api/admin/district/campaigns/${id}/report`)
        setReport(r.data || null)
      }
    } catch { toast.error('조회 실패') }
  }, [])

  const openCampaign = async (id: number) => {
    if (expanded === id) { setExpanded(null); return }
    setExpanded(id); setTab('receipts'); setReceipts([]); setStores([]); setReport(null)
    await loadDetail(id, 'receipts')
  }
  const switchTab = async (id: number, t: 'receipts' | 'stores' | 'report') => { setTab(t); await loadDetail(id, t) }

  const createCampaign = async () => {
    const tiers = [
      { min_amount: Number(form.tier1_min), face_value: Number(form.tier1_face) },
      { min_amount: Number(form.tier2_min), face_value: Number(form.tier2_face) },
    ].filter((t) => t.min_amount > 0 && t.face_value > 0)
    if (!form.slug.trim() || !form.name.trim() || !tiers.length) { toast.error('slug·이름·보상구간은 필수입니다'); return }
    setBusy(true)
    try {
      const r = await api.post('/api/admin/district/campaigns', {
        slug: form.slug.trim(), name: form.name.trim(), description: form.description || undefined,
        budget_total: Number(form.budget_total) || 0, reward_tiers: tiers,
        coupon_expires_days: Number(form.coupon_expires_days) || 30,
      })
      if (r.data?.success) {
        toast.success(`캠페인 생성 — 소비자 링크: /district/${form.slug.trim()}`)
        setForm({ slug: '', name: '', budget_total: '', tier1_min: '30000', tier1_face: '3000', tier2_min: '50000', tier2_face: '10000', coupon_expires_days: '30', description: '' })
        void load()
      } else toast.error(r.data?.error || '생성 실패')
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '생성 실패') } finally { setBusy(false) }
  }

  const bulkStores = async (id: number) => {
    if (!bulkLines.trim()) { toast.error('한 줄에 한 매장씩 입력하세요 (이름|주소|전화|은행|계좌|예금주)'); return }
    setBusy(true)
    try {
      const r = await api.post(`/api/admin/district/campaigns/${id}/stores/bulk`, { lines: bulkLines })
      if (r.data?.success) { toast.success(`${r.data.inserted}개 매장 등록 (PIN 자동발급)`); setBulkLines(''); await loadDetail(id, 'stores') }
      else toast.error(r.data?.error || '등록 실패')
    } catch { toast.error('등록 실패') } finally { setBusy(false) }
  }

  const decide = async (campaignId: number, receiptId: number, action: 'approve' | 'reject') => {
    let reason: string | undefined
    if (action === 'reject') {
      reason = window.prompt('반려 사유 (사용자에게 표시됩니다)') || ''
      if (!reason.trim()) return
    } else if (!window.confirm('승인하면 쿠폰이 즉시 지급됩니다. 영수증 사진·금액·승인번호를 확인했나요?')) return
    try {
      const r = await api.post(`/api/admin/district/receipts/${receiptId}/${action === 'approve' ? 'approve' : 'reject'}`,
        action === 'reject' ? { reason } : {})
      if (r.data?.success) {
        toast.success(action === 'approve' ? `승인 — ${formatWon(r.data.face_value)} 쿠폰 지급됨` : '반려했습니다')
        await loadDetail(campaignId, 'receipts'); void load()
      } else toast.error(r.data?.error || '처리 실패')
    } catch (e) { toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '처리 실패') }
  }

  // 인증 헤더를 실은 blob 다운로드(평문 앵커는 Bearer 불가).
  const downloadCsv = async (id: number) => {
    try {
      const r = await api.get(`/api/admin/district/campaigns/${id}/report.csv`, { responseType: 'blob' })
      const url = URL.createObjectURL(r.data as Blob)
      const a = document.createElement('a')
      a.href = url; a.download = `district-${id}-settlement.csv`; a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch { toast.error('CSV 다운로드 실패') }
  }

  const toggleStatus = async (c: Campaign) => {
    const next = c.status === 'open' ? 'closed' : 'open'
    if (!window.confirm(`캠페인을 ${next === 'open' ? '재개' : '종료'}할까요?`)) return
    await api.post(`/api/admin/district/campaigns/${c.id}/status`, { status: next }).catch(() => null)
    void load()
  }

  return (
    <AdminLayout title="상권 쿠폰">
      <DashboardPageHeader
        title="상권 쿠폰 (영수증 페이백)"
        subtitle="참여 점포 구매 영수증 검수 → 무상 쿠폰 지급 → 상권 내 자유 사용 → 사용 매장 정산(수수료 0)."
        icon={<TicketPercent className="w-5 h-5" />}
        actions={<button type="button" onClick={() => void load()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-[12px] text-gray-700"><RefreshCw className="w-3.5 h-3.5" />새로고침</button>}
      />

      {/* 캠페인 생성 */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 mt-4 mb-5">
        <h3 className="text-[14px] font-bold text-gray-900 mb-3">새 캠페인</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <label className="text-[12px] text-gray-600">slug (소비자 URL)
            <input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="seocho-alley" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900 font-mono" />
          </label>
          <label className="text-[12px] text-gray-600">이름
            <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="○○ 골목형상점가 페이백" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600">총 예산 (원, 0=무제한)
            <input value={form.budget_total} onChange={(e) => setForm((f) => ({ ...f, budget_total: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600">쿠폰 유효기간(일)
            <input value={form.coupon_expires_days} onChange={(e) => setForm((f) => ({ ...f, coupon_expires_days: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600">구간1 기준액
            <input value={form.tier1_min} onChange={(e) => setForm((f) => ({ ...f, tier1_min: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600">구간1 쿠폰액
            <input value={form.tier1_face} onChange={(e) => setForm((f) => ({ ...f, tier1_face: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600">구간2 기준액
            <input value={form.tier2_min} onChange={(e) => setForm((f) => ({ ...f, tier2_min: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600">구간2 쿠폰액
            <input value={form.tier2_face} onChange={(e) => setForm((f) => ({ ...f, tier2_face: e.target.value.replace(/\D/g, '') }))} inputMode="numeric" className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
          <label className="text-[12px] text-gray-600 col-span-2 lg:col-span-4">설명(선택 — 소비자 랜딩에 노출)
            <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="mt-1 w-full px-3 py-2 border border-gray-200 rounded-xl text-[13px] text-gray-900" />
          </label>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" disabled={busy} onClick={createCampaign} className="px-4 py-2 rounded-xl bg-gray-900 text-white text-[13px] font-semibold disabled:opacity-50">캠페인 생성</button>
        </div>
      </div>

      {/* 캠페인 목록 */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-gray-400 text-[13px]">로딩 중…</div>
        : campaigns.length === 0 ? <div className="p-8 text-center text-gray-400 text-[13px]">캠페인이 없습니다.</div>
        : campaigns.map((c) => (
          <div key={c.id} className="border-t border-gray-100 first:border-t-0">
            <button type="button" onClick={() => void openCampaign(c.id)} className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-gray-900 truncate">{c.name} <span className="font-mono text-[11px] text-gray-400">/district/{c.slug}</span></p>
                <p className="text-[11px] text-gray-500">매장 {formatNumber(c.store_count)} · 발급 {formatWon(c.issued_total || 0)}{c.budget_total ? ` / 예산 ${formatWon(c.budget_total)}` : ''}</p>
              </div>
              {(c.pending_receipts || 0) > 0 && <span className="shrink-0 rounded-full bg-amber-100 text-amber-700 text-[11px] font-bold px-2 py-0.5">검수 대기 {c.pending_receipts}</span>}
              <span className={`shrink-0 text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.status === 'open' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{c.status === 'open' ? '진행중' : '종료'}</span>
            </button>
            {expanded === c.id && (
              <div className="px-4 pb-4 bg-gray-50/60">
                <div className="flex flex-wrap items-center gap-2 py-3">
                  {(['receipts', 'stores', 'report'] as const).map((tb) => (
                    <button key={tb} type="button" onClick={() => void switchTab(c.id, tb)}
                      className={`px-3 py-1.5 rounded-lg text-[12px] font-semibold ${tab === tb ? 'bg-gray-900 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}>
                      {tb === 'receipts' ? '영수증 검수' : tb === 'stores' ? '매장' : '리포트'}
                    </button>
                  ))}
                  <div className="flex-1" />
                  {/* 🛡️ 전수조사 MED fix: 평문 <a> 는 Bearer 미탑재(+듀얼로그인 시 user 쿠키 우선 403) → api blob 다운로드 */}
                  <button type="button" onClick={() => void downloadCsv(c.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-700 text-[12px]"><FileDown className="w-3.5 h-3.5" />정산 CSV</button>
                  <button type="button" onClick={() => void toggleStatus(c)} className="px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-[12px] text-gray-600">{c.status === 'open' ? '캠페인 종료' : '재개'}</button>
                </div>

                {tab === 'receipts' && (
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <p className="text-[12px] font-bold text-gray-900 px-3 py-2 border-b border-gray-100">검수 대기 ({receipts.length})</p>
                    {receipts.length === 0 ? <p className="p-3 text-[12px] text-gray-400">대기 중인 영수증이 없습니다</p> : (
                      <div className="max-h-[28rem] overflow-auto divide-y divide-gray-50">
                        {receipts.map((r) => (
                          <div key={r.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                            <a href={`/api/media/${r.image_key}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[11px] font-bold text-blue-600 underline shrink-0"><ImageIcon className="w-3.5 h-3.5" />사진</a>
                            <div className="flex-1 min-w-[180px]">
                              <p className="text-[12.5px] font-semibold text-gray-900">{formatWon(r.amount)} · {r.store_name || '매장?'} <span className="font-mono text-[10px] text-gray-400">{r.card_approval_no}</span></p>
                              <p className="text-[10.5px] text-gray-500">{r.user_name || r.user_id} · 기승인 {r.user_approved_count ?? 0}건 · {new Date(r.created_at).toLocaleString('ko-KR')}</p>
                            </div>
                            <button type="button" onClick={() => void decide(c.id, r.id, 'approve')} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-emerald-200 text-emerald-600 text-[11px] font-bold hover:bg-emerald-50"><Check className="w-3 h-3" />승인·지급</button>
                            <button type="button" onClick={() => void decide(c.id, r.id, 'reject')} className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-red-200 text-red-600 text-[11px] font-bold hover:bg-red-50"><X className="w-3 h-3" />반려</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {tab === 'stores' && (
                  <div className="space-y-3">
                    <div className="bg-white rounded-xl border border-gray-200 p-3">
                      <p className="text-[12px] font-bold text-gray-900 mb-1.5 flex items-center gap-1"><Store className="w-3.5 h-3.5" />매장 일괄 등록 — 한 줄에 한 매장, <code className="text-[10px]">이름|주소|전화|은행|계좌|예금주</code></p>
                      <textarea value={bulkLines} onChange={(e) => setBulkLines(e.target.value)} rows={4} placeholder={'김밥천국 서초점|서초대로 1|02-123-4567|국민|123-45|김밥천\n...'} className="w-full px-3 py-2 border border-gray-200 rounded-xl text-[12px] text-gray-900 font-mono" />
                      <div className="mt-2 flex justify-end"><button type="button" disabled={busy} onClick={() => void bulkStores(c.id)} className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-[12px] font-semibold disabled:opacity-50">등록 (PIN 자동발급)</button></div>
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <p className="text-[12px] font-bold text-gray-900 px-3 py-2 border-b border-gray-100">매장 ({stores.length}) — PIN 은 각 매장 카운터에 전달</p>
                      <div className="max-h-80 overflow-auto">
                        {stores.map((s) => (
                          <div key={s.id} className="flex items-center gap-2 px-3 py-1.5 text-[11.5px] border-t border-gray-50">
                            <span className={`flex-1 truncate ${s.is_active ? 'text-gray-800' : 'text-gray-300 line-through'}`}>{s.name}</span>
                            <code className="shrink-0 font-mono font-bold text-gray-900 bg-gray-100 rounded px-1.5 py-0.5">{s.store_code}</code>
                            <span className="shrink-0 text-gray-400">사용 {formatNumber(s.used_count)}건 · {formatWon(s.used_amount || 0)}</span>
                            <button type="button" onClick={async () => { await api.post(`/api/admin/district/stores/${s.id}/toggle`).catch(() => null); await loadDetail(c.id, 'stores') }} className="shrink-0 text-[10px] text-gray-400 underline">{s.is_active ? '비활성' : '활성'}</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {tab === 'report' && report?.totals && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                      {[['발급 총액', report.totals.issued_amount], ['사용(정산 대상)', report.totals.used_amount], ['미사용(유효)', report.totals.outstanding_amount], ['소멸(미집행액)', report.totals.lapsed_amount]].map(([l, v]) => (
                        <div key={String(l)} className="bg-white rounded-xl border border-gray-200 p-3 text-center">
                          <p className="text-[16px] font-black text-gray-900">{formatWon(Number(v) || 0)}</p>
                          <p className="text-[10px] text-gray-500">{l}</p>
                        </div>
                      ))}
                    </div>
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <p className="text-[12px] font-bold text-gray-900 px-3 py-2 border-b border-gray-100">점포별 정산 (사용 시점 귀속 · 수수료 0)</p>
                      <div className="max-h-80 overflow-auto">
                        {(report.by_store || []).map((s) => (
                          <div key={String(s.store_id)} className="flex items-center gap-2 px-3 py-1.5 text-[11.5px] border-t border-gray-50">
                            <span className="flex-1 truncate text-gray-800">{String(s.name)}</span>
                            <span className="shrink-0 text-gray-400">{formatNumber(Number(s.used_count) || 0)}건</span>
                            <span className="shrink-0 font-bold text-gray-900">{formatWon(Number(s.payable_amount) || 0)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </AdminLayout>
  )
}
