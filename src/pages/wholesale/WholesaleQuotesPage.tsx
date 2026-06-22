/**
 * 🏭 2026-06-08 유통스타트 도매몰 — 유통회원 견적/발주(Quote) 페이지 (BIZ-3).
 * (스펙: 대량/협상 주문은 견적요청 → 운영자 회신 → 수락 흐름. 기존 즉시 Toss 선결제와 병행.)
 *
 * 견적요청 제출 + 내 견적 목록(상태/회신단가) + 회신된 견적 수락/반려.
 * 🎨 2026-06-16 (서브페이지 시안): 로고 브레드크럼 + 제목/CTA + 상태 칩 + 표(확장 상세) + 요청 모달.
 * 라이트 B2B 테마(wholesale-theme.ts WT). 단일 라인 견적(v1).
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import SEO from '@/components/SEO'
import { FileText, Loader2, Check, X, Plus, ChevronRight, ChevronDown } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { WT, won, comma } from './wholesale-theme'
import { WholesaleWordmark } from '@/pages/wholesale-catalog/WholesaleLogo'
import { useIsWholesaleViewer, ViewerNotice } from './ViewerGate'

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

// 상태 배지 — WT 라이트 팔레트(주문 배지와 톤 일치).
const STATUS_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  requested: { label: '요청접수', bg: '#E7F0FF', color: '#1f2937' },
  quoted:    { label: '회신완료', bg: WT.brandSoft, color: WT.brand },
  accepted:  { label: '수락됨', bg: '#E3F6EC', color: WT.pos },
  rejected:  { label: '반려', bg: '#FDE8E8', color: '#D14343' },
  expired:   { label: '기간만료', bg: WT.fill, color: WT.ink3 },
  converted: { label: '발주전환', bg: '#E3F6EC', color: WT.pos },
}
const badgeOf = (s: string) => STATUS_BADGE[s] || { label: s, bg: WT.fill, color: WT.ink3 }

export default function WholesaleQuotesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', product_id: '', requested_qty: '', target_unit_price: '', request_text: '' })
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [tab, setTab] = useState<'all' | 'progress' | 'done'>('all')
  const [openId, setOpenId] = useState<number | null>(null)
  // 👥 2026-06-12 (감사 부채): viewer 직원 — 견적 요청 서버 403 전 UI 사전 안내.
  const isViewer = useIsWholesaleViewer()
  const [busyId, setBusyId] = useState<number | null>(null)

  const listQ = useQuery<QuoteRow[]>({
    queryKey: ['wholesale', 'quotes'],
    queryFn: () => api.get('/api/wholesale/quotes', auth()).then(r => (r.data?.success ? r.data.quotes || [] : [])).catch(() => []),
    enabled: !!sellerToken(),
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  })

  const quotes = listQ.data ?? []
  const counts = useMemo(() => {
    let progress = 0, done = 0
    for (const q of quotes) {
      const eff = q.effective_status || q.status
      if (eff === 'requested' || eff === 'quoted') progress++
      else if (eff === 'accepted' || eff === 'converted') done++
    }
    return { all: quotes.length, progress, done }
  }, [quotes])

  const filtered = useMemo(() => quotes.filter(q => {
    const eff = q.effective_status || q.status
    if (tab === 'progress') return eff === 'requested' || eff === 'quoted'
    if (tab === 'done') return eff === 'accepted' || eff === 'converted'
    return true
  }), [quotes, tab])

  if (!embedded && !sellerToken()) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center" style={{ background: WT.fill }}>
        <SEO title="견적함 — 유통스타트" description="판매사 대량/협상 견적요청" url="/wholesale/quotes" noindex />
        <FileText className="w-12 h-12 mb-4" style={{ color: WT.ink4 }} />
        <p className="mb-6" style={{ color: WT.ink2 }}>판매사 로그인 후 이용할 수 있습니다.</p>
        <button onClick={() => navigate('/wholesale/login')} className="px-6 py-3 text-white rounded-lg font-semibold" style={{ background: WT.ink }}>판매사 로그인</button>
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
      setShowForm(false)
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

  const inputCls = 'w-full px-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 text-gray-900'
  const inputStyle = { borderColor: '#D1D6DB' } as React.CSSProperties
  const TABS: { id: 'all' | 'progress' | 'done'; label: string; n: number }[] = [
    { id: 'all', label: '전체', n: counts.all },
    { id: 'progress', label: '진행중', n: counts.progress },
    { id: 'done', label: '완료', n: counts.done },
  ]

  // 콘텐츠(견적함 본문) — embedded/standalone 공유.
  const content = (
    <>
        {/* 제목 + CTA */}
        <div className="flex items-end justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-[22px] lg:text-[24px] font-extrabold tracking-[-0.02em]" style={{ color: WT.ink }}>견적함</h1>
            <p className="text-[13px] mt-1" style={{ color: WT.ink3 }}>카탈로그 단가 대신 협의 단가로 대량 발주하세요</p>
          </div>
          <button onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-xl text-white font-bold text-[13.5px]" style={{ background: WT.brand }}>
            <Plus className="w-4 h-4" /> 새 견적 요청
          </button>
        </div>

        {/* 상태 칩 */}
        <div className="flex gap-1.5 flex-wrap">
          {TABS.map(tb => {
            const on = tab === tb.id
            return (
              <button key={tb.id} onClick={() => setTab(tb.id)}
                className="text-[12.5px] font-semibold rounded-full px-3.5 py-1.5 transition-colors"
                style={on ? { background: WT.ink, color: '#fff' } : { background: '#fff', color: WT.ink2, border: '1px solid ' + WT.line2 }}>
                {tb.label} {tb.n}
              </button>
            )
          })}
        </div>

        {/* 견적 표 */}
        <div className="rounded-xl overflow-hidden bg-white" style={{ border: '1px solid ' + WT.line2 }}>
          <div className="hidden lg:grid grid-cols-[1.8fr_.7fr_.9fr_.9fr_.8fr] gap-3 px-4 py-3 text-[11.5px] font-bold" style={{ color: WT.ink3, background: WT.trustBg, borderBottom: '1px solid ' + WT.line }}>
            <span>상품 / 견적번호</span><span className="text-right">요청수량</span><span className="text-right">희망단가</span><span className="text-right">제시단가</span><span className="text-center">상태</span>
          </div>
          {listQ.isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin" style={{ color: WT.ink4 }} /></div>
          ) : filtered.length === 0 ? (
            <div className="py-14 text-center" style={{ color: WT.ink3 }}>
              <FileText className="w-6 h-6 mx-auto mb-2" style={{ color: WT.ink4 }} />
              <p className="text-[13px]">{tab === 'all' ? '견적 내역이 없어요' : '해당 견적이 없어요'}</p>
              {tab === 'all' && (
                <button onClick={() => setShowForm(true)} className="mt-3 inline-flex items-center gap-1 rounded-full px-4 py-2 text-[12px] font-bold text-white" style={{ background: WT.brand }}>
                  <Plus className="w-3.5 h-3.5" /> 첫 견적 요청하기
                </button>
              )}
            </div>
          ) : (
            <ul>
              {filtered.map(q => {
                const eff = q.effective_status || q.status
                const st = badgeOf(eff)
                const canAct = eff === 'quoted'
                const open = openId === q.id
                const hasDetail = !!(q.quoted_unit_price || q.quote_memo || q.request_text || q.order_id)
                return (
                  <li key={q.id} style={{ borderTop: '1px solid ' + WT.line }}>
                    <button onClick={() => hasDetail && setOpenId(open ? null : q.id)}
                      className="w-full flex lg:grid lg:grid-cols-[1.8fr_.7fr_.9fr_.9fr_.8fr] items-center gap-3 px-4 py-3.5 text-left">
                      <div className="min-w-0 flex-1 lg:flex-none flex items-center gap-2">
                        {hasDetail && <ChevronDown className={`w-3.5 h-3.5 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: WT.ink4 }} />}
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-semibold truncate" style={{ color: WT.ink }}>{q.product_name || q.title}</div>
                          <div className="text-[11px] mt-0.5" style={{ color: WT.ink3 }}>#{q.id} · {(q.created_at || '').slice(0, 10)}</div>
                        </div>
                      </div>
                      <span className="hidden lg:block text-right text-[13.5px] font-semibold" style={{ color: WT.ink }}>{comma(q.requested_qty)}</span>
                      <span className="hidden lg:block text-right text-[13.5px]" style={{ color: WT.ink2 }}>{q.target_unit_price ? won(q.target_unit_price) : '—'}</span>
                      <span className="text-right text-[14px] lg:text-[13.5px] font-extrabold shrink-0" style={{ color: q.quoted_unit_price ? WT.brand : WT.ink4 }}>{q.quoted_unit_price ? won(q.quoted_unit_price) : '—'}</span>
                      <span className="hidden lg:flex justify-center"><span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span></span>
                      <span className="lg:hidden"><span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold whitespace-nowrap" style={{ background: st.bg, color: st.color }}>{st.label}</span></span>
                    </button>
                    {open && hasDetail && (
                      <div className="px-4 pb-4 pt-1" style={{ background: WT.fill2 }}>
                        <div className="lg:hidden flex gap-4 text-[12px] mb-2" style={{ color: WT.ink2 }}>
                          <span>요청수량 <b style={{ color: WT.ink }}>{comma(q.requested_qty)}</b></span>
                          {q.target_unit_price ? <span>희망단가 <b style={{ color: WT.ink }}>{won(q.target_unit_price)}</b></span> : null}
                        </div>
                        {q.request_text && <p className="text-[12.5px] mb-2" style={{ color: WT.ink2 }}>📝 {q.request_text}</p>}
                        {(eff === 'quoted' || q.quoted_unit_price) && (
                          <div className="rounded-lg p-3" style={{ background: WT.brandSoft }}>
                            <p className="text-[13.5px] font-bold" style={{ color: WT.brand }}>
                              회신 단가 {won(q.quoted_unit_price)}
                              {q.quoted_moq ? <span className="text-[12px] font-medium" style={{ color: WT.ink2 }}> · MOQ {comma(q.quoted_moq)}</span> : null}
                            </p>
                            {q.valid_until ? <p className="text-[11px] mt-0.5" style={{ color: WT.ink2 }}>유효기간 {String(q.valid_until).slice(0, 10)}</p> : null}
                            {q.quote_memo ? <p className="text-[12px] mt-1" style={{ color: WT.ink2 }}>💬 {q.quote_memo}</p> : null}
                          </div>
                        )}
                        {canAct && (
                          <div className="flex gap-2 mt-3">
                            <button onClick={() => act(q.id, 'accept')} disabled={busyId === q.id}
                              className="flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-lg text-white text-[13px] font-semibold disabled:opacity-60" style={{ background: WT.pos }}>
                              <Check className="w-4 h-4" /> 수락
                            </button>
                            <button onClick={() => act(q.id, 'reject')} disabled={busyId === q.id}
                              className="flex-1 inline-flex items-center justify-center gap-1 h-10 rounded-lg text-[13px] font-semibold disabled:opacity-60" style={{ border: '1px solid #D1D6DB', color: WT.ink2 }}>
                              <X className="w-4 h-4" /> 반려
                            </button>
                          </div>
                        )}
                        {q.order_id ? <p className="text-[12px] mt-2 font-semibold" style={{ color: WT.pos }}>✓ 발주 #{q.order_id} 로 전환됨</p> : null}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
    </>
  )

  // 새 견적 요청 모달 — embedded/standalone 공유.
  const formModal = (
    <>
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4" onClick={() => setShowForm(false)}>
          <div className="w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid ' + WT.line }}>
              <h2 className="text-[16px] font-extrabold" style={{ color: WT.ink }}>새 견적 요청</h2>
              <button onClick={() => setShowForm(false)} aria-label="닫기" className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" style={{ color: WT.ink2 }} /></button>
            </div>
            <div className="p-5">
              <p className="text-[12.5px] mb-4" style={{ color: WT.ink2 }}>대량 주문이나 협상이 필요한 건은 견적을 요청하세요. 운영자가 단가·MOQ·유효기간을 회신합니다.</p>
              {isViewer && <div className="mb-3"><ViewerNotice action="견적 요청" /></div>}
              <form onSubmit={submit} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: WT.ink2 }}>견적 제목 <span className="text-red-500">*</span></label>
                  <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className={inputCls} style={inputStyle} placeholder="예: A상품 1,000개 대량 견적" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: WT.ink2 }}>상품 ID (선택)</label>
                    <input type="number" min={1} value={form.product_id} onChange={e => setForm(f => ({ ...f, product_id: e.target.value }))} className={inputCls} style={inputStyle} placeholder="상품번호" />
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
                <button type="submit" disabled={saving || isViewer} className="w-full h-12 rounded-xl text-white font-bold text-sm disabled:opacity-60" style={{ background: WT.brand }}>
                  {saving ? '접수 중...' : isViewer ? '조회 전용 계정 — 요청 불가' : '견적요청 보내기'}
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )

  // 대시보드 탭 임베드 — 외곽 래퍼/SEO/헤더 생략, 본문만(+모달).
  if (embedded) {
    return (
      <div className="space-y-5">
        {content}
        {formModal}
      </div>
    )
  }

  return (
    <div className="min-h-screen pb-20" style={{ background: WT.fill }}>
      <SEO title="견적함 — 유통스타트" description="카탈로그 단가 대신 협의 단가로 대량 발주" url="/wholesale/quotes" noindex />

      {/* 로고 브레드크럼 헤더 */}
      <header className="sticky top-0 z-30" style={{ background: '#fff', borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 flex items-center gap-3 h-14">
          <button onClick={() => navigate('/wholesale')} aria-label="도매몰 홈" className="shrink-0">
            <WholesaleWordmark height={26} />
          </button>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: WT.ink4 }} />
          <span className="text-[14px] font-bold" style={{ color: WT.ink }}>견적함</span>
        </div>
      </header>

      <main className="ur-content-wide px-5 lg:px-8 pt-6 space-y-5">
        {content}
      </main>

      {formModal}
    </div>
  )
}
