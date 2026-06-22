/**
 * 🏭 2026-06-08 유통스타트 도매몰 — 어드민 견적/발주 관리 (BIZ-3).
 * (유통회원 견적요청 목록 + 단가/MOQ/유효기간/메모 회신 → 유통회원 수락/반려.)
 *
 * 라이트 고정 대시보드 테마(AdminLayout). dark: variant 없음.
 * ⚠️ 라우트/네비 등록은 오케스트레이터가 처리 (admin.routes.tsx / AdminLayout 미편집).
 *   권장 경로: /admin/wholesale-quotes
 */
import { useState } from 'react'
import api from '@/lib/api'
import { useApiQuery } from '@/hooks/queries/useApiQuery'
import AdminLayout from '@/components/AdminLayout'
import { DashboardPageHeader } from '@/components/dashboard'
import { FileText, Loader2, Send } from 'lucide-react'
import { toast } from '@/hooks/useToast'

interface QuoteRow {
  id: number
  distributor_seller_id: number
  supplier_id: number | null
  product_id: number | null
  product_name: string | null
  supplier_name: string | null
  title: string
  request_text: string | null
  requested_qty: number
  target_unit_price: number | null
  status: string
  quoted_unit_price: number | null
  quoted_moq: number | null
  quote_memo: string | null
  valid_until: string | null
  order_id: number | null
  distributor_business_name: string | null
  distributor_name: string | null
  distributor_username: string | null
  created_at: string
}

const won = (n: number | null | undefined) => '₩' + Number(n || 0).toLocaleString('ko-KR')

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  requested: { label: '요청접수', cls: 'bg-blue-100 text-blue-700' },
  quoted: { label: '회신완료', cls: 'bg-amber-100 text-amber-700' },
  accepted: { label: '수락됨', cls: 'bg-emerald-100 text-emerald-700' },
  rejected: { label: '반려', cls: 'bg-red-100 text-red-700' },
  expired: { label: '기간만료', cls: 'bg-gray-100 text-gray-600' },
  converted: { label: '발주전환', cls: 'bg-emerald-100 text-emerald-700' },
}

const STATUS_FILTERS = ['', 'requested', 'quoted', 'accepted', 'rejected', 'converted'] as const

export default function AdminWholesaleQuotesPage() {
  const h = { headers: { Authorization: `Bearer ${typeof window !== 'undefined' ? localStorage.getItem('admin_token') : ''}` } }
  const [statusFilter, setStatusFilter] = useState('')
  const [respondId, setRespondId] = useState<number | null>(null)
  const [resp, setResp] = useState({ quoted_unit_price: '', quoted_moq: '', valid_until: '', quote_memo: '' })
  const [busy, setBusy] = useState(false)

  const quotesQ = useApiQuery<QuoteRow[]>(
    ['admin', 'wholesale-quotes', statusFilter], '/api/wholesale/admin/quotes',
    {
      params: statusFilter ? { status: statusFilter } : {},
      headers: h.headers,
      select: (r: any) => (r?.success ? r.quotes || [] : []),
    },
  )
  const quotes = quotesQ.data ?? []

  const openRespond = (q: QuoteRow) => {
    setRespondId(q.id)
    setResp({
      quoted_unit_price: q.quoted_unit_price ? String(q.quoted_unit_price) : (q.target_unit_price ? String(q.target_unit_price) : ''),
      quoted_moq: q.quoted_moq ? String(q.quoted_moq) : '',
      valid_until: q.valid_until ? String(q.valid_until).slice(0, 10) : '',
      quote_memo: q.quote_memo || '',
    })
  }

  const submitRespond = async (id: number) => {
    if (!resp.quoted_unit_price || Number(resp.quoted_unit_price) <= 0) { toast.error('회신 단가를 입력해주세요'); return }
    setBusy(true)
    try {
      await api.patch(`/api/wholesale/admin/quotes/${id}/respond`, {
        quoted_unit_price: Number(resp.quoted_unit_price),
        quoted_moq: resp.quoted_moq ? Number(resp.quoted_moq) : undefined,
        valid_until: resp.valid_until || undefined,
        quote_memo: resp.quote_memo.trim() || undefined,
      }, h)
      toast.success('견적을 회신했습니다.')
      setRespondId(null)
      quotesQ.refetch()
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } }
      toast.error(e?.response?.data?.error || (err instanceof Error ? err.message : '회신 실패'))
    } finally { setBusy(false) }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-500/30'

  return (
    <AdminLayout title="견적/발주 관리">
      <DashboardPageHeader
        title="견적 / 발주 관리"
        subtitle="유통사 견적요청에 단가·MOQ·유효기간을 회신합니다. 수락 시 알림을 받아 기존 발주 흐름으로 주문을 생성하세요."
        icon={<FileText className="w-5 h-5" />}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_FILTERS.map(s => (
          <button key={s || 'all'} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${statusFilter === s ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 border border-gray-200'}`}>
            {s === '' ? '전체' : (STATUS_LABEL[s]?.label || s)}
          </button>
        ))}
      </div>

      {quotesQ.isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : quotes.length === 0 ? (
        <p className="text-center text-gray-400 py-16 text-sm bg-white rounded-xl border border-gray-100">견적이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          {quotes.map(q => {
            const st = STATUS_LABEL[q.status] || { label: q.status, cls: 'bg-gray-100 text-gray-600' }
            const distLabel = q.distributor_business_name || q.distributor_name || q.distributor_username || `셀러 #${q.distributor_seller_id}`
            const isOpen = respondId === q.id
            const canRespond = ['requested', 'quoted', 'expired'].includes(q.status)
            return (
              <div key={q.id} className="bg-white rounded-xl border border-gray-100 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-semibold text-gray-900 text-sm truncate">{q.title}</p>
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium shrink-0 ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {distLabel}
                      {q.product_name ? ` · ${q.product_name}` : (q.product_id ? ` · 상품#${q.product_id}` : '')}
                      {` · 수량 ${q.requested_qty.toLocaleString('ko-KR')}`}
                      {q.target_unit_price ? ` · 희망 ${won(q.target_unit_price)}` : ''}
                    </p>
                    {q.request_text ? <p className="text-xs text-gray-600 mt-1 bg-gray-50 rounded p-2 whitespace-pre-wrap">{q.request_text}</p> : null}
                    {q.quoted_unit_price ? (
                      <p className="text-xs text-gray-700 mt-1">
                        회신 단가 <span className="font-semibold">{won(q.quoted_unit_price)}</span>
                        {q.quoted_moq ? ` · MOQ ${q.quoted_moq.toLocaleString('ko-KR')}` : ''}
                        {q.valid_until ? ` · 유효 ${String(q.valid_until).slice(0, 10)}` : ''}
                      </p>
                    ) : null}
                    {q.order_id ? <p className="text-xs text-emerald-600 mt-1">✓ 발주 #{q.order_id} 전환됨</p> : null}
                    <p className="text-[10px] text-gray-400 mt-1">{(q.created_at || '').slice(0, 16).replace('T', ' ')}</p>
                  </div>
                  {canRespond && !isOpen ? (
                    <button onClick={() => openRespond(q)}
                      className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-lg bg-gray-900 text-white text-sm font-semibold">
                      <Send className="w-4 h-4" /> {q.status === 'quoted' ? '재회신' : '회신'}
                    </button>
                  ) : null}
                </div>

                {isOpen ? (
                  <div className="mt-3 border-t border-gray-100 pt-3 grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">회신 단가(원) *</label>
                      <input type="number" min={1} value={resp.quoted_unit_price} onChange={e => setResp(r => ({ ...r, quoted_unit_price: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">MOQ</label>
                      <input type="number" min={1} value={resp.quoted_moq} onChange={e => setResp(r => ({ ...r, quoted_moq: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">유효기간</label>
                      <input type="date" value={resp.valid_until} onChange={e => setResp(r => ({ ...r, valid_until: e.target.value }))} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">메모</label>
                      <input value={resp.quote_memo} onChange={e => setResp(r => ({ ...r, quote_memo: e.target.value }))} className={inputCls} placeholder="조건 안내" />
                    </div>
                    <div className="sm:col-span-4 flex gap-2 justify-end">
                      <button onClick={() => setRespondId(null)} className="px-4 py-2 rounded-lg border border-gray-200 text-gray-600 text-sm font-medium">취소</button>
                      <button onClick={() => submitRespond(q.id)} disabled={busy}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-60">
                        {busy ? '회신 중...' : '견적 회신'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      )}
    </AdminLayout>
  )
}
