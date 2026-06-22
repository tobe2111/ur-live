import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import SEO from '@/components/SEO'
import { ArrowLeft, Loader2, Package, Truck, AlertTriangle, MessageSquare, ChevronDown, Send, Download } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { useWholesaleOrders } from '@/hooks/queries/useWholesale'
import { WT, won, wholesaleOrderStatusBadge } from './wholesale/wholesale-theme'
import WholesaleClaimModal from './wholesale/WholesaleClaimModal'
import { useWholesaleBack } from '@/hooks/useWholesaleBack'
import { courierTrackingUrl } from '@/utils/courier-tracking'

// 인증 헤더로 xlsx 다운로드 → blob 저장 (anchor href 는 토큰 미첨부라 fetch 사용).
async function downloadWholesaleXlsx(path: string, filename: string) {
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const res = await fetch(path, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  if (!res.ok) { toast.error('다운로드 실패'); return }
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// 🏭 NOTI-1 (2026-06-08): 주문별 메모/문의 스레드 — 판매사 ↔ 공급자 ↔ 어드민 소통.
//   서버: GET/POST /api/wholesale/orders/:id/notes (당사자 검증 + 작성 시 상대 통지).
interface OrderNote { id: number; author_type: string; author_id: number | null; body: string; created_at: string }
const AUTHOR_LABEL: Record<string, string> = { distributor: '판매사', supplier: '제조사', admin: '관리자' }

function OrderNotesThread({ orderId }: { orderId: number }) {
  const { t } = useTranslation()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const h = { headers: token ? { Authorization: `Bearer ${token}` } : {} }
  const [open, setOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [notes, setNotes] = useState<OrderNote[]>([])
  const [myRole, setMyRole] = useState<string>('')
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)

  function load() {
    setLoading(true)
    api.get(`/api/wholesale/orders/${orderId}/notes`, h)
      .then((r) => {
        if (r.data?.success) {
          setNotes((r.data.notes ?? []) as OrderNote[])
          setMyRole(String(r.data.my_role || ''))
        }
      })
      .catch(() => { /* 조용히 무시 — 빈 스레드로 표시 */ })
      .finally(() => { setLoading(false); setLoaded(true) })
  }

  function toggle() {
    const next = !open
    setOpen(next)
    if (next && !loaded) load()
  }

  async function submit() {
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    try {
      const r = await api.post(`/api/wholesale/orders/${orderId}/notes`, { body }, h)
      if (r.data?.success && r.data.note) {
        setNotes((prev) => [...prev, r.data.note as OrderNote])
        setDraft('')
      } else {
        toast.error(r.data?.error || t('wholesale.noteFailed', { defaultValue: '메모 등록에 실패했어요' }))
      }
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || t('wholesale.noteFailed', { defaultValue: '메모 등록에 실패했어요' }))
    } finally { setSending(false) }
  }

  return (
    <div className="mt-3 rounded-xl overflow-hidden" style={{ border: '1px solid ' + WT.line }}>
      <button onClick={toggle} className="w-full flex items-center justify-between px-3.5 h-11" style={{ background: WT.fill2 }}>
        <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold" style={{ color: WT.ink2 }}>
          <MessageSquare className="w-4 h-4" style={{ color: WT.ink3 }} />
          {t('wholesale.orderNotes', { defaultValue: '메모/문의' })}
          {loaded && notes.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[11px] font-bold text-white" style={{ background: WT.ink }}>{notes.length}</span>
          )}
        </span>
        <ChevronDown className="w-4 h-4 transition-transform" style={{ color: WT.ink3, transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>
      {open && (
        <div className="px-3.5 py-3" style={{ borderTop: '1px solid ' + WT.line }}>
          {loading ? (
            <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" style={{ color: WT.ink4 }} /></div>
          ) : notes.length === 0 ? (
            <p className="text-center py-3 text-[12px]" style={{ color: WT.ink4 }}>{t('wholesale.noteEmpty', { defaultValue: '아직 메모가 없어요. 첫 메모를 남겨보세요.' })}</p>
          ) : (
            <ul className="space-y-2.5 mb-3">
              {notes.map((n) => {
                const mine = n.author_type === myRole
                return (
                  <li key={n.id} className={'flex flex-col ' + (mine ? 'items-end' : 'items-start')}>
                    <div className="max-w-[85%] rounded-2xl px-3 py-2" style={mine ? { background: WT.ink, color: '#fff' } : { background: WT.fill, color: WT.ink }}>
                      <span className="block text-[13px] leading-[1.45] whitespace-pre-wrap break-words">{n.body}</span>
                    </div>
                    <span className="mt-1 text-[11px] tabular-nums" style={{ color: WT.ink4 }}>
                      {AUTHOR_LABEL[n.author_type] || n.author_type} · {new Date(n.created_at).toLocaleString('ko-KR')}
                    </span>
                  </li>
                )
              })}
            </ul>
          )}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit() } }}
              rows={1}
              maxLength={1000}
              placeholder={t('wholesale.notePlaceholder', { defaultValue: '메모를 입력하세요 (제조사·관리자에게 전달돼요)' })}
              className="flex-1 resize-none rounded-xl px-3 py-2.5 text-[13px] outline-none"
              style={{ background: WT.fill, color: WT.ink, minHeight: 42, maxHeight: 120 }}
            />
            <button onClick={submit} disabled={sending || !draft.trim()}
              className="shrink-0 h-[42px] w-[42px] rounded-xl flex items-center justify-center text-white disabled:opacity-40"
              style={{ background: WT.brand }} aria-label={t('wholesale.noteSend', { defaultValue: '전송' })}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// 🏭 BIZ-1: 클레임(RMA) 제기 가능한 주문 상태 — 결제완료 이후.
const CLAIMABLE = new Set(['PAID', 'SHIPPED', 'PARTIAL_REFUNDED', 'DONE', 'ON_CREDIT'])

// 🏭 2026-06-04 유통스타트 도매 주문 내역 — TDS 라이트 시안 정비. 라이트 고정 B2B.

// 🏭 2026-06-12 (감사 부채): 주문 상태 뱃지 → wholesale-theme.ts SSOT 로 통합 (대시보드와 동일 정의).

export default function WholesaleOrdersPage({ embedded = false }: { embedded?: boolean } = {}) {
  const navigate = useNavigate()
  const goBack = useWholesaleBack()
  const token = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
  const { data: orders = [], isLoading: loading, refetch } = useWholesaleOrders()
  const [claimOrderId, setClaimOrderId] = useState<number | null>(null)

  // 🧭 2026-06-10 (생애주기 감사 갭#2): 내가 제기한 클레임 상태 추적 — 제기만 되고 볼 곳이 없던 갭.
  type MyClaim = { id: number; wholesale_order_id: number; reason_code: string; reason_text: string | null; status: string; admin_memo: string | null; created_at: string }
  const [claims, setClaims] = useState<MyClaim[]>([])
  const [claimsOpen, setClaimsOpen] = useState(false)
  const loadClaims = () => {
    const tk = typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null
    if (!tk) return
    api.get('/api/wholesale/claims', { headers: { Authorization: `Bearer ${tk}` } })
      .then((r) => { if (r.data?.success) setClaims(r.data.claims || []) })
      .catch(() => { /* 표시 전용 — 실패 시 섹션 미노출 */ })
  }
  useEffect(() => { loadClaims() }, [])
  const CLAIM_STATUS: Record<string, { t: string; c: string; bg: string }> = {
    open: { t: '접수됨 · 심사 중', c: '#4b5563', bg: '#f3f4f6' },
    approved: { t: '승인 — 환불 처리', c: '#374151', bg: '#D1FAE5' },
    rejected: { t: '반려', c: '#B91C1C', bg: '#FEE2E2' },
  }

  useEffect(() => { if (!embedded && !token) navigate('/wholesale/login') }, [embedded, token, navigate])

  function copyTrack(track: string) {
    navigator.clipboard?.writeText(track).then(() => toast.success('운송장 번호를 복사했어요')).catch(() => { /* noop */ })
  }

  // 콘텐츠(주문 내역 본문) — embedded/standalone 공유. 데이터/핸들러는 위에서 동일.
  const content = (
    <>
        {claims.length > 0 && (
          <div className="mb-4 rounded-2xl bg-white" style={{ border: '1px solid ' + WT.line }}>
            <button onClick={() => setClaimsOpen(v => !v)} className="w-full flex items-center justify-between px-4 h-12">
              <span className="text-[13px] font-bold" style={{ color: WT.ink }}>
                내 클레임 {claims.length}건
                {claims.some(cl => cl.status === 'open') && <span className="ml-1.5 text-[11px] font-semibold" style={{ color: '#4b5563' }}>· 심사 중 {claims.filter(cl => cl.status === 'open').length}</span>}
              </span>
              <span className="text-[12px]" style={{ color: WT.ink4 }}>{claimsOpen ? '접기' : '펼치기'}</span>
            </button>
            {claimsOpen && (
              <div className="px-4 pb-3 space-y-2">
                {claims.map(cl => {
                  const cs = CLAIM_STATUS[cl.status] || { t: cl.status, c: WT.ink2, bg: WT.fill }
                  return (
                    <div key={cl.id} className="rounded-xl px-3 py-2.5" style={{ background: WT.fill2 }}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium truncate" style={{ color: WT.ink2 }}>주문 #{cl.wholesale_order_id} · {cl.reason_text || cl.reason_code}</span>
                        <span className="text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap" style={{ color: cs.c, background: cs.bg }}>{cs.t}</span>
                      </div>
                      {cl.admin_memo && <p className="text-[11px] mt-1" style={{ color: WT.ink3 }}>운영자: {cl.admin_memo}</p>}
                      <p className="text-[10px] mt-0.5 tabular-nums" style={{ color: WT.ink4 }}>{new Date(cl.created_at).toLocaleString('ko-KR')}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="w-7 h-7 animate-spin" style={{ color: WT.ink4 }} /></div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center py-24 text-center">
            <Package className="w-12 h-12 mb-4" style={{ color: WT.ink4 }} />
            <p className="text-[15px] font-medium mb-1" style={{ color: WT.ink2 }}>주문 내역이 없어요</p>
            <button onClick={() => navigate('/wholesale')} className="mt-5 px-6 h-12 rounded-xl font-bold text-white" style={{ background: WT.ink }}>상품 둘러보기</button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {orders.map(o => {
              const badge = wholesaleOrderStatusBadge(o.status)
              const st = { t: badge.label, c: badge.color, bg: badge.bg }
              return (
                <div key={o.id} className="rounded-2xl bg-white p-4" style={{ border: '1px solid ' + WT.line }}>
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[12px] tabular-nums" style={{ color: WT.ink4 }}>{new Date(o.created_at).toLocaleString('ko-KR')}</span>
                    <span className="text-[12px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap" style={{ color: st.c, background: st.bg }}>{st.t}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium tabular-nums" style={{ color: WT.ink2 }}>주문 #{o.id}{o.grade ? ` · ${o.grade}등급가` : ''}</span>
                    <span className="text-[17px] font-extrabold tabular-nums tracking-[-0.01em]" style={{ color: WT.ink }}>{won(o.subtotal)}</span>
                  </div>
                  {o.tracking_number && (
                    <div className="mt-3 flex items-stretch gap-2">
                      <button onClick={() => copyTrack(o.tracking_number!)} className="flex-1 flex items-center justify-between rounded-xl px-3.5 h-11" style={{ background: WT.fill2 }}>
                        <span className="inline-flex items-center gap-1.5 text-[13px] font-medium" style={{ color: WT.ink2 }}><Truck className="w-4 h-4" /> {o.courier || '택배'}</span>
                        <span className="text-[13px] font-bold tabular-nums" style={{ color: WT.ink }}>{o.tracking_number} <span className="text-[11px] font-medium" style={{ color: WT.ink4 }}>복사</span></span>
                      </button>
                      {/* 🚚 2026-06-10 갭#4: 택배사 매칭되면 1탭 배송조회 (외부 새 탭) */}
                      {courierTrackingUrl(o.courier, o.tracking_number) && (
                        <a
                          href={courierTrackingUrl(o.courier, o.tracking_number)!}
                          target="_blank" rel="noopener noreferrer"
                          className="shrink-0 inline-flex items-center px-3.5 rounded-xl text-[13px] font-bold"
                          style={{ background: WT.ink, color: '#fff' }}
                        >배송조회</a>
                      )}
                    </div>
                  )}
                  {CLAIMABLE.has(o.status) && (
                    <button onClick={() => setClaimOrderId(o.id)} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 rounded-xl h-11 text-[13px] font-semibold" style={{ background: WT.fill, color: WT.ink2, border: '1px solid ' + WT.line }}>
                      <AlertTriangle className="w-4 h-4" style={{ color: WT.brand }} /> 클레임 제기
                    </button>
                  )}
                  <OrderNotesThread orderId={o.id} />
                </div>
              )
            })}
          </div>
        )}

      {claimOrderId != null && (
        <WholesaleClaimModal orderId={claimOrderId} onClose={() => setClaimOrderId(null)} onSubmitted={() => { refetch(); loadClaims(); setClaimsOpen(true) }} />
      )}
    </>
  )

  // 대시보드 탭 임베드 — 외곽 래퍼/SEO/헤더 생략, 본문만(standalone <main> 과 동일 흐름).
  if (embedded) return <div>{content}</div>

  return (
    <div className="min-h-screen" style={{ background: '#fff', color: WT.ink }}>
      <SEO title="도매 주문 내역 - 유통스타트" description="판매사 도매 주문 내역" url="/wholesale/orders" noindex />
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur" style={{ borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide flex items-center gap-3 px-5 lg:px-8 h-[52px]">
          <button onClick={goBack} aria-label="뒤로"><ArrowLeft className="w-5 h-5" style={{ color: WT.ink }} /></button>
          <h1 className="text-[15px] font-bold flex-1" style={{ color: WT.ink }}>주문 내역</h1>
          <button
            onClick={() => downloadWholesaleXlsx('/api/wholesale/orders/export', `wholesale-orders-${new Date().toISOString().slice(0, 10)}.xlsx`)}
            className="inline-flex items-center gap-1.5 px-3 h-9 rounded-xl border text-[13px] font-medium"
            style={{ borderColor: WT.line, color: WT.ink2, background: WT.fill }}
            title="엑셀 다운로드"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">엑셀 다운로드</span>
          </button>
        </div>
      </header>

      <main className="ur-content-narrow px-5 lg:px-8 py-6">
        {content}
      </main>
    </div>
  )
}
