/**
 * 📬 오늘의 컨택 패널 — "누구부터 접촉?"의 원버튼 답 (2026-07-27, 대표 "이메일이 전화보다 중요").
 *   업체(ad_company_leads) + 매장 후보(store_prospects)를 **이메일 보유 우선** → 전화만 순으로,
 *   미접촉(status=new)만 추려 보여준다. 행에서 바로 mailto/tel + '컨택함' 처리(리스트에서 제거).
 */
import { useCallback, useEffect, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface CompanyRow { id: number; company_name: string; category: string | null; subcategory: string | null; tier: number | null; region: string | null; email: string | null; phone: string | null; website: string | null }
interface StoreRow { id: number; biz_name: string; category: string | null; region: string | null; email: string | null; phone: string | null; website: string | null; is_new_open: number }

export default function ContactListPanel() {
  const [companies, setCompanies] = useState<CompanyRow[]>([])
  const [stores, setStores] = useState<StoreRow[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await api.get('/api/admin/partner-pool/contact-list?limit=10')
      if (r.data?.success) { setCompanies(r.data.companies || []); setStores(r.data.stores || []) }
    } catch { /* noop — 패널은 보조 UI */ } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  async function markContacted(kind: 'company' | 'store', id: number) {
    try {
      const url = kind === 'company' ? `/api/admin/partner-pool/${id}` : `/api/admin/store-prospects/${id}`
      const r = await api.patch(url, { status: 'contacted' })
      if (r.data?.success) {
        if (kind === 'company') setCompanies(prev => prev.filter(x => x.id !== id))
        else setStores(prev => prev.filter(x => x.id !== id))
      } else toast.error(r.data?.error || '처리 실패')
    } catch { toast.error('처리 실패') }
  }

  const row = (kind: 'company' | 'store', id: number, name: string, sub: string, region: string | null, email: string | null, phone: string | null, badge?: string) => (
    <div key={`${kind}-${id}`} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 last:border-0 text-sm">
      <div className="min-w-0 flex-1">
        <div className="text-gray-900 truncate">
          {badge && <span className="mr-1 text-[10px] px-1.5 py-0.5 rounded bg-rose-100 text-rose-600 font-semibold">{badge}</span>}
          {name}
          <span className="ml-1.5 text-[11px] text-gray-400">{[sub, region].filter(Boolean).join(' · ')}</span>
        </div>
        <div className="text-[12px] mt-0.5">
          {email
            ? <a href={`mailto:${email}`} className="text-indigo-600 font-medium hover:underline break-all">📧 {email}</a>
            : <span className="text-gray-400">이메일 없음</span>}
          {phone && <a href={`tel:${phone}`} className="ml-3 text-gray-600 hover:underline">📞 {phone}</a>}
        </div>
      </div>
      <button onClick={() => markContacted(kind, id)} className="shrink-0 px-2.5 py-1 rounded-lg border border-gray-300 bg-white text-[12px] text-gray-600 hover:bg-gray-50" title="접촉 완료 처리(리스트에서 제거, 상태=컨택함)">컨택함 ✓</button>
    </div>
  )

  const emailCount = companies.filter(c => c.email).length + stores.filter(s => s.email).length
  return (
    <div className="mb-4 rounded-xl border border-indigo-200 bg-indigo-50/40 overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center gap-2 px-4 py-2.5 text-left">
        <span className="text-sm font-semibold text-gray-900">📬 오늘의 컨택</span>
        <span className="text-[11px] text-gray-500">이메일 우선 · 미접촉만 · 이메일 {emailCount}건</span>
        <span className="ml-auto text-gray-400 text-xs">{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>
      {open && (
        <div className="grid md:grid-cols-2 gap-0 md:gap-3 px-2 pb-2">
          <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 bg-gray-50">🤝 업체 (파트너)</div>
            {loading ? <div className="px-3 py-4 text-xs text-gray-400">불러오는 중…</div>
              : companies.length === 0 ? <div className="px-3 py-4 text-xs text-gray-400">미접촉 업체 없음 — 수집/보강이 채우는 중</div>
                : companies.map(cRow => row('company', cRow.id, cRow.company_name, cRow.subcategory || cRow.category || '', cRow.region, cRow.email, cRow.phone, cRow.tier === 1 ? '1순위' : undefined))}
          </div>
          <div className="rounded-lg bg-white border border-gray-200 overflow-hidden">
            <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-500 bg-gray-50">🏪 매장 후보</div>
            {loading ? <div className="px-3 py-4 text-xs text-gray-400">불러오는 중…</div>
              : stores.length === 0 ? <div className="px-3 py-4 text-xs text-gray-400">미접촉 매장 없음 — 수집/보강이 채우는 중</div>
                : stores.map(sRow => row('store', sRow.id, sRow.biz_name, sRow.category || '', sRow.region, sRow.email, sRow.phone, sRow.is_new_open === 1 ? '개업' : undefined))}
          </div>
        </div>
      )}
    </div>
  )
}
