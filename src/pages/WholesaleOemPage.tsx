/**
 * 🏭 2026-06-03 유통스타트 도매몰 — 유통회원 OEM/ODM 신청 페이지.
 * (스펙: 유통회원 OEM/ODM 신청 → 유통스타트가 제조사 매칭·생산 지원)
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import SEO from '@/components/SEO'
import { Factory, Loader2, Download } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'

interface OemRequest {
  id: number; kind: string; product_name: string; category: string | null
  target_qty: number | null; target_price: number | null; note: string | null
  status: string; admin_memo: string | null; matched: number | null; created_at: string
}

const sellerToken = () => (typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null)
const auth = () => { const t = sellerToken(); return { headers: t ? { Authorization: `Bearer ${t}` } : {} } }

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  open: { label: '접수', cls: 'bg-blue-100 text-blue-700' },
  matching: { label: '매칭중', cls: 'bg-amber-100 text-amber-700' },
  matched: { label: '매칭완료', cls: 'bg-emerald-100 text-emerald-700' },
  closed: { label: '종료', cls: 'bg-[#ECEEF1] text-[#4E5560]' },
  rejected: { label: '반려', cls: 'bg-red-100 text-red-700' },
}

async function downloadCsv(path: string, filename: string) {
  const t = sellerToken()
  const headers: Record<string, string> = t ? { Authorization: `Bearer ${t}` } : {}
  const res = await fetch(path, { headers })
  if (!res.ok) { toast.error('다운로드 실패'); return }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function WholesaleOemPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ kind: 'OEM', product_name: '', category: '', target_qty: '', target_price: '', note: '' })
  const [saving, setSaving] = useState(false)

  const listQ = useQuery<OemRequest[]>({
    queryKey: ['wholesale', 'oem-requests'],
    queryFn: () => api.get('/api/wholesale/oem-requests', auth()).then(r => (r.data?.success ? r.data.requests || [] : [])).catch(() => []),
    enabled: !!sellerToken(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  if (!sellerToken()) {
    return (
      <div className="min-h-screen bg-[#F4F5F7] flex flex-col items-center justify-center px-6 text-center">
        <SEO title="OEM/ODM 신청 — 유통스타트" description="유통사 OEM/ODM 제작 신청" url="/wholesale/oem" noindex />
        <Factory className="w-12 h-12 text-[#D1D6DB] mb-4" />
        <p className="text-[#4E5560] mb-6">유통사 로그인 후 이용할 수 있습니다.</p>
        <button onClick={() => navigate('/seller/login')} className="px-6 py-3 bg-[#17181C] text-white rounded-lg font-semibold">유통사 로그인</button>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.product_name.trim()) { toast.error('제품명을 입력해주세요'); return }
    setSaving(true)
    try {
      await api.post('/api/wholesale/oem-requests', {
        kind: form.kind, product_name: form.product_name.trim(), category: form.category.trim() || undefined,
        target_qty: form.target_qty ? Number(form.target_qty) : undefined,
        target_price: form.target_price ? Number(form.target_price) : undefined,
        note: form.note.trim() || undefined,
      }, auth())
      toast.success('OEM/ODM 신청이 접수되었습니다. 유통스타트가 제조사를 매칭해 연락드립니다.')
      setForm({ kind: 'OEM', product_name: '', category: '', target_qty: '', target_price: '', note: '' })
      listQ.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '신청 실패')
    } finally { setSaving(false) }
  }

  const requests = listQ.data ?? []
  const inputCls = 'w-full px-3 py-2.5 border border-[#D1D6DB] rounded-lg text-sm text-[#17181C] focus:ring-2 focus:ring-[#17181C]/15 outline-none'

  return (
    <div className="min-h-screen bg-[#F4F5F7]">
      <SEO title="OEM/ODM 신청 — 유통스타트" description="유통사 OEM/ODM 제작 신청" url="/wholesale/oem" noindex />
      <header className="bg-white border-b border-[#ECEEF1]">
        <div className="ur-content-medium px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Factory className="w-6 h-6 text-[#17181C]" />
            <span className="text-lg font-bold text-[#17181C]">OEM / ODM 신청</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadCsv('/api/wholesale/catalog-export', 'wholesale-catalog.xlsx')}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-[#D1D6DB] rounded-lg text-[#4E5560] hover:bg-[#F4F5F7]">
              <Download className="w-4 h-4" /> 카탈로그(등급가)
            </button>
            <button onClick={() => downloadCsv('/api/wholesale/order-template', 'wholesale-order-template.csv')}
              className="inline-flex items-center gap-1 px-3 py-2 text-sm border border-[#D1D6DB] rounded-lg text-[#4E5560] hover:bg-[#F4F5F7]">
              <Download className="w-4 h-4" /> 주문양식
            </button>
            <button onClick={() => navigate('/wholesale')} className="text-sm text-[#4E5560] hover:text-[#17181C]">← 도매몰</button>
          </div>
        </div>
      </header>

      <main className="ur-content-medium px-4 lg:px-8 py-6 space-y-6">
        <section className="bg-white rounded-2xl border border-[#ECEEF1] p-6">
          <h2 className="text-base font-bold text-[#17181C] mb-1">자사 브랜드 제품 제작 신청</h2>
          <p className="text-xs text-[#F4F5F7]0 mb-4">원하는 제품을 신청하면 유통스타트가 제조사를 찾아 연결하고 생산까지 지원합니다.</p>
          <form onSubmit={submit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#4E5560] mb-1">유형</label>
                <select value={form.kind} onChange={e => setForm(f => ({ ...f, kind: e.target.value }))} className={inputCls}>
                  <option value="OEM">OEM (제조자 생산)</option>
                  <option value="ODM">ODM (제조자 설계·생산)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4E5560] mb-1">카테고리</label>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inputCls} placeholder="예: 화장품" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4E5560] mb-1">제품명 / 사양 <span className="text-red-500">*</span></label>
              <input required value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} className={inputCls} placeholder="제작을 원하는 제품명" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-[#4E5560] mb-1">희망 수량</label>
                <input type="number" min={0} value={form.target_qty} onChange={e => setForm(f => ({ ...f, target_qty: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#4E5560] mb-1">희망 공급가(원)</label>
                <input type="number" min={0} value={form.target_price} onChange={e => setForm(f => ({ ...f, target_price: e.target.value }))} className={inputCls} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#4E5560] mb-1">상세 요청</label>
              <textarea rows={3} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} className={inputCls} placeholder="원료, 패키지, 인증, 납기 등" />
            </div>
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl bg-[#17181C] text-white font-semibold text-sm disabled:opacity-60">
              {saving ? '접수 중...' : '신청하기'}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-bold text-[#17181C] mb-3">내 신청 내역</h2>
          {listQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin text-[#B6BCC4]" /></div>
          ) : requests.length === 0 ? (
            <p className="text-center text-[#B6BCC4] py-10 text-sm bg-white rounded-2xl border border-[#ECEEF1]">신청 내역이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {requests.map(r => {
                const st = STATUS_LABEL[r.status] || { label: r.status, cls: 'bg-[#ECEEF1] text-[#4E5560]' }
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-[#ECEEF1] p-4">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-[#17181C] text-white">{r.kind}</span>
                        <p className="font-semibold text-[#17181C] text-sm">{r.product_name}</p>
                      </div>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-[#F4F5F7]0">
                      {r.category && `${r.category} · `}
                      {r.target_qty ? `${r.target_qty.toLocaleString('ko-KR')}개 · ` : ''}
                      {r.target_price ? `희망 ₩${r.target_price.toLocaleString('ko-KR')}` : ''}
                    </p>
                    {r.matched ? <p className="text-xs text-emerald-600 mt-1">✓ 제조사 매칭 완료 — 유통스타트가 생산·연결을 진행합니다</p> : null}
                    {r.admin_memo && <p className="text-xs text-[#4E5560] mt-1 bg-[#F4F5F7] rounded p-2">💬 {r.admin_memo}</p>}
                    <p className="text-[10px] text-[#B6BCC4] mt-1">{(r.created_at || '').slice(0, 10)}</p>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}
