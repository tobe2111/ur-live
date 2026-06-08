/**
 * 🏭 2026-06-08 유통스타트 도매몰 — 유통회원 견적/발주(Quote) 페이지 (BIZ-3).
 * (스펙: 대량/협상 주문은 견적요청 → 운영자 회신 → 수락 흐름. 기존 즉시 Toss 선결제와 병행.)
 *
 * 견적요청 제출 + 내 견적 목록(상태/회신단가) + 회신된 견적 수락/반려.
 * 라이트 B2B 테마(wholesale-theme.ts WT). 단일 라인 견적(v1).
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import SEO from '@/components/SEO'
import { FileText, Loader2, Check, X } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { WT, won, comma } from './wholesale-theme'

interface QuoteRow {
  id: number
  product_id: number | null
  product_name: string | null
  title: string
  request_text: string | null
  requested_qty: number
  target_unit_price: number | null
  status: string
  effective_status?: string
  quoted_unit_price: number | null
  quoted_moq: number | null
  quote_memo: string | null
  valid_until: string | null
  order_id: number | null
  created_at: string
}

const sellerToken = () => (typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null)
const auth = () => { const t = sellerToken(); return { headers: t ? { Authorization: `Bearer ${t}` } : {} } }

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  requested: { label: '요청접수', cls: 'bg-blue-100 text-blue-700' },
  quoted: { label: '회신완료', cls: 'bg-amber-100 text-amber-700' },
  accepted: { label: '수락됨', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려', cls: 'bg-red-100 text-red-700' },
  expired: { label: '기간만료', cls: 'bg-[#ECEEF1] text-[#4E5560]' },
  converted: { label: '발주전환', cls: 'bg-emerald-100 text-emerald-700' },
}

export default function WholesaleQuotesPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', product_id: '', requested_qty: '', target_unit_price: '', request_text: '' })
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)

  const listQ = useQuery<QuoteRow[]>({
    queryKey: ['wholesale', 'quotes'],
    queryFn: () => api.get('/api/wholesale/quotes', auth()).then(r => (r.data?.success ? r.data.quotes || [] : [])).catch(() => []),
    enabled: !!sellerToken(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  if (!sellerToken()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: WT.fill }}>
        <SEO title="견적요청 — 유통스타트" description="유통사 대량/협상 견적요청" url="/wholesale/quotes" noindex />
        <FileText className="w-12 h-12 mb-4" style={{ color: WT.ink4 }} />
        <p className="mb-6" style={{ color: WT.ink2 }}>유통사 로그인 후 이용할 수 있습니다.</p>
        <button onClick={() => navigate('/seller/login')} className="px-6 py-3 text-white rounded-lg font-semibold" style={{ background: WT.ink }}>유통사 로그인</button>
      </div>
    )
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { toast.error('견적 제목을 입력해주세요'); return }
    setSaving(true)
    try {
      await api.post('/api/wholesale/quotes', {
        title: form.title.trim(),
        product_id: form.product_id ? Number(form.product_id) : undefined,
        requested_qty: form.requested_qty ? Number(form.requested_qty) : undefined,
        target_unit_price: form.target_unit_price ? Number(form.target_unit_price) : undefined,
        request_text: form.request_text.trim() || undefined,
      }, auth())
      toast.success('견적요청이 접수되었습니다. 운영자가 단가를 회신합니다.')
      setForm({ title: '', product_id: '', requested_qty: '', target_unit_price: '', request_text: '' })
      listQ.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '요청 실패')
    } finally { setSaving(false) }
  }

  const act = async (id: number, action: 'accept' | 'reject') => {
    setBusyId(id)
    try {
      await api.post(`/api/wholesale/quotes/${id}/${action}`, {}, auth())
      toast.success(action === 'accept' ? '견적을 수락했습니다. 운영자가 발주를 진행합니다.' : '견적을 반려했습니다.')
      listQ.refetch()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '처리 실패')
    } finally { setBusyId(null) }
  }

  const quotes = listQ.data ?? []
  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2'
  const inputStyle = { borderColor: '#D1D6DB', color: WT.ink } as React.CSSProperties

  return (
    <div className="min-h-screen" style={{ background: WT.fill }}>
      <SEO title="견적요청 — 유통스타트" description="유통사 대량/협상 견적요청" url="/wholesale/quotes" noindex />
      <header className="bg-white" style={{ borderBottom: `1px solid ${WT.line}` }}>
        <div className="ur-content-medium px-4 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-6 h-6" style={{ color: WT.ink }} />
            <span className="text-lg font-bold" style={{ color: WT.ink }}>견적 / 발주요청</span>
          </div>
          <button onClick={() => navigate('/wholesale')} className="text-sm" style={{ color: WT.ink2 }}>← 도매몰</button>
        </div>
      </header>

      <main className="ur-content-medium px-4 lg:px-8 py-6 space-y-6">
        <section className="bg-white rounded-2xl p-6" style={{ border: `1px solid ${WT.line}` }}>
          <h2 className="text-base font-bold mb-1" style={{ color: WT.ink }}>대량 / 협상 견적요청</h2>
          <p className="text-xs mb-4" style={{ color: WT.ink2 }}>대량 주문이나 협상이 필요한 건은 견적을 요청하세요. 운영자가 단가·MOQ·유효기간을 회신합니다.</p>
          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: WT.ink2 }}>견적 제목 <span className="text-red-500">*</span></label>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} style={inputStyle} placeholder="예: A상품 1,000개 대량 견적" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: WT.ink2 }}>상품 ID (선택)</label>
                <input type="number" min={1} value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} className={inputCls} style={inputStyle} placeholder="카탈로그 상품번호" />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: WT.ink2 }}>희망 수량</label>
                <input type="number" min={1} value={form.requested_qty} onChange={e => setForm(f => ({ ...f, requested_qty: e.target.value }))} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: WT.ink2 }}>희망 단가(원)</label>
                <input type="number" min={0} value={form.target_unit_price} onChange={e => setForm(f => ({ ...f, target_unit_price: e.target.value }))} className={inputCls} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: WT.ink2 }}>상세 요청</label>
              <textarea rows={3} value={form.request_text} onChange={e => setForm(f => ({ ...f, request_text: e.target.value }))} className={inputCls} style={inputStyle} placeholder="납기, 결제조건, 포장 등" />
            </div>
            <button type="submit" disabled={saving} className="w-full py-3 rounded-xl text-white font-semibold text-sm disabled:opacity-60" style={{ background: WT.ink }}>
              {saving ? '접수 중...' : '견적요청 보내기'}
            </button>
          </form>
        </section>

        <section>
          <h2 className="text-sm font-bold mb-3" style={{ color: WT.ink }}>내 견적 내역</h2>
          {listQ.isLoading ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 animate-spin" style={{ color: WT.ink4 }} /></div>
          ) : quotes.length === 0 ? (
            <p className="text-center py-10 text-sm bg-white rounded-2xl" style={{ color: WT.ink4, border: `1px solid ${WT.line}` }}>견적 내역이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {quotes.map(q => {
                const eff = q.effective_status || q.status
                const st = STATUS_LABEL[eff] || { label: eff, cls: 'bg-[#ECEEF1] text-[#4E5560]' }
                const canAct = eff === 'quoted'
                return (
                  <div key={q.id} className="bg-white rounded-xl p-4" style={{ border: `1px solid ${WT.line}` }}>
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <p className="font-semibold text-sm" style={{ color: WT.ink }}>{q.title}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs" style={{ color: WT.ink2 }}>
                      {q.product_name ? `${q.product_name} · ` : ''}
                      {`수량 ${comma(q.requested_qty)}`}
                      {q.target_unit_price ? ` · 희망 ${won(q.target_unit_price)}` : ''}
                    </p>
                    {eff === 'quoted' || q.quoted_unit_price ? (
                      <div className="mt-2 rounded-lg p-3" style={{ background: WT.brandSoft }}>
                        <p className="text-sm font-bold" style={{ color: WT.brand }}>
                          회신 단가 {won(q.quoted_unit_price)}
                          {q.quoted_moq ? <span className="text-xs font-medium" style={{ color: WT.ink2 }}> · MOQ {comma(q.quoted_moq)}</span> : null}
                        </p>
                        {q.valid_until ? <p className="text-[11px] mt-0.5" style={{ color: WT.ink2 }}>유효기간 {String(q.valid_until).slice(0, 10)}</p> : null}
                        {q.quote_memo ? <p className="text-xs mt-1" style={{ color: WT.ink2 }}>💬 {q.quote_memo}</p> : null}
                      </div>
                    ) : null}
                    {canAct ? (
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => act(q.id, 'accept')} disabled={busyId === q.id}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg text-white text-sm font-semibold disabled:opacity-60" style={{ background: WT.pos }}>
                          <Check className="w-4 h-4" /> 수락
                        </button>
                        <button onClick={() => act(q.id, 'reject')} disabled={busyId === q.id}
                          className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg text-sm font-semibold disabled:opacity-60" style={{ border: `1px solid #D1D6DB`, color: WT.ink2 }}>
                          <X className="w-4 h-4" /> 반려
                        </button>
                      </div>
                    ) : null}
                    {q.order_id ? <p className="text-xs mt-2" style={{ color: WT.pos }}>✓ 발주 #{q.order_id} 로 전환됨</p> : null}
                    <p className="text-[10px] mt-1" style={{ color: WT.ink4 }}>{(q.created_at || '').slice(0, 10)}</p>
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
