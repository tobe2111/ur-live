/**
 * 🏭 2026-06-10 (사용자 요청 — Sellpie 형 통합 게시판): /wholesale/board
 *   탭: 공지사항 / 상품 자료실(이미지 다운로드) / 배송 안내 / 신고·제안(최저가 미준수 등).
 *   공지·자료실 = 공개 읽기(어드민 작성: /admin/wholesale-board), 신고·제안 = 유통회원 전용
 *   (기존 wholesale_proposal_tickets 재사용 — 어드민 큐 /admin/wholesale-proposals 그대로).
 *   라이트 고정(WT) — dark: 없음.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Pin, Download, Megaphone, FolderDown, Truck, MessageSquareWarning, ExternalLink, PenLine } from 'lucide-react'
import api from '@/lib/api'
import SEO from '@/components/SEO'
import { toast } from '@/hooks/useToast'
import { cfImage } from '@/utils/cf-image'
import { WT } from './wholesale-theme'
import { WholesaleWordmark } from '@/pages/wholesale-catalog/WholesaleLogo'
import WholesaleShippingGuide from './WholesaleShippingGuide'
import WholesaleProposalBoard from './WholesaleProposalBoard'

type Tab = 'notice' | 'archive' | 'shipping' | 'report'
const TABS: { key: Tab; label: string; icon: typeof Megaphone }[] = [
  { key: 'notice', label: '공지사항', icon: Megaphone },
  { key: 'archive', label: '상품 자료실', icon: FolderDown },
  { key: 'shipping', label: '배송 안내', icon: Truck },
  { key: 'report', label: '신고·제안', icon: MessageSquareWarning },
]

interface BoardPost {
  id: number
  board_type: string
  title: string
  body?: string | null
  is_pinned: number
  view_count: number
  created_at: string
  product_id?: number | null
  product_name?: string | null
  product_image?: string | null
}

interface Ticket { id: number; type: string; target: string | null; subject: string; status: string; created_at: string; admin_memo?: string | null }

const sellerToken = () => (typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null)
const isAdminUser = () => (typeof window !== 'undefined' && !!localStorage.getItem('admin_token'))
const auth = () => { const t = sellerToken(); return { headers: t ? { Authorization: `Bearer ${t}` } : {} } }

const TICKET_STATUS: Record<string, { label: string; color: string }> = {
  open: { label: '접수됨', color: '#1f2937' },
  in_progress: { label: '처리 중', color: '#6b7280' },
  resolved: { label: '처리 완료', color: '#4b5563' },
  rejected: { label: '반려', color: '#dc2626' },
}

function fmtDate(iso: string): string {
  try { return new Date(iso.includes('T') ? iso : iso + 'Z').toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) } catch { return iso }
}

export default function WholesaleBoardPage() {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const tab = (TABS.some(t => t.key === sp.get('tab')) ? sp.get('tab') : 'notice') as Tab
  const setTab = (t: Tab) => setSp(prev => { const n = new URLSearchParams(prev); n.set('tab', t); n.delete('post'); return n }, { replace: true })

  // ── 게시글 목록/상세 (notice/archive 공용) ──
  const [posts, setPosts] = useState<BoardPost[] | null>(null)
  const postId = Number(sp.get('post')) || null
  const [detail, setDetail] = useState<{ post: BoardPost & { body?: string }; downloads: string[] } | null>(null)

  useEffect(() => {
    // 🛡️ 2026-06-13: shipping 도 운영자 게시물(board_type='shipping')을 가질 수 있음 — 없으면 기본 안내 컴포넌트.
    if (tab !== 'notice' && tab !== 'archive' && tab !== 'shipping') return
    setPosts(null)
    api.get(`/api/wholesale/board/posts?type=${tab}`)
      .then(r => setPosts(r.data?.success ? r.data.posts || [] : []))
      .catch(() => setPosts([]))
  }, [tab])

  useEffect(() => {
    if (!postId) { setDetail(null); return }
    setDetail(null)
    api.get(`/api/wholesale/board/posts/${postId}`)
      .then(r => { if (r.data?.success) setDetail({ post: r.data.post, downloads: r.data.downloads || [] }) })
      .catch(() => toast.error('게시글을 불러오지 못했어요'))
  }, [postId])

  const openPost = (id: number) => setSp(prev => { const n = new URLSearchParams(prev); n.set('post', String(id)); return n })
  const closePost = () => setSp(prev => { const n = new URLSearchParams(prev); n.delete('post'); return n })

  // ── 신고·제안 ──
  const loggedIn = !!sellerToken()
  const isAdmin = isAdminUser()
  const [tickets, setTickets] = useState<Ticket[] | null>(null)

  // 내 접수 내역(본인 글의 운영팀 답변 확인). 작성 폼은 WholesaleProposalBoard 가 담당.
  const loadTickets = useCallback(() => {
    if (!sellerToken()) return
    api.get('/api/wholesale/proposal-tickets', auth())
      .then(r => setTickets(r.data?.success ? r.data.tickets || r.data.proposals || [] : []))
      .catch(() => setTickets([]))
  }, [])
  useEffect(() => { if (tab === 'report' && loggedIn) loadTickets() }, [tab, loggedIn, loadTickets])

  return (
    <div className="min-h-screen pb-24" style={{ background: WT.fill }}>
      <SEO title="게시판 - 유통스타트" description="공지사항, 상품 자료실, 배송 안내, 신고·제안" url="/wholesale/board" noindex />

      {/* 헤더 */}
      <header className="sticky top-0 z-30" style={{ background: '#fff', borderBottom: '1px solid ' + WT.line }}>
        <div className="ur-content-wide px-5 lg:px-8 flex items-center gap-3 h-14">
          <button onClick={() => navigate('/wholesale')} aria-label="도매몰 홈" className="shrink-0">
            <WholesaleWordmark height={26} />
          </button>
          <ChevronRight className="w-4 h-4 shrink-0" style={{ color: WT.ink4 }} />
          <span className="text-[14px] font-bold" style={{ color: WT.ink }}>공지 · 자료실</span>
          {/* 🛡️ 2026-06-11 (사용자 요청): 관리자에게만 작성 버튼 — /admin/wholesale-board (공지/자료실 CRUD) */}
          {isAdmin && (
            <button onClick={() => navigate('/admin/wholesale-board')}
              className="ml-auto inline-flex items-center gap-1 px-3 h-9 rounded-xl text-[12.5px] font-bold text-white"
              style={{ background: WT.ink }}>
              <PenLine className="w-3.5 h-3.5" /> 공지 작성
            </button>
          )}
        </div>
        <div className="ur-content-wide px-5 lg:px-8 flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map(ti => (
            <button key={ti.key} onClick={() => setTab(ti.key)}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 h-11 text-[14px] font-bold whitespace-nowrap border-b-2 transition-colors"
              style={tab === ti.key ? { color: WT.brand, borderColor: WT.brand } : { color: WT.ink2, borderColor: 'transparent' }}>
              <ti.icon className="w-4 h-4" /> {ti.label}
            </button>
          ))}
        </div>
      </header>

      <main className="ur-content-wide px-5 lg:px-8 pt-5">
        {/* ── 배송 안내 ── 운영자 게시물 없으면 기본 4단계 가이드(이미지 없음 — 깨짐 0). */}
        {tab === 'shipping' && !postId && (!posts || posts.length === 0) && <WholesaleShippingGuide />}

        {/* ── 공지/자료실/배송 상세 ── */}
        {(tab === 'notice' || tab === 'archive' || tab === 'shipping') && postId && (
          <div className="rounded-2xl p-5 lg:p-7" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
            {!detail ? (
              <div className="py-16 text-center text-[13px]" style={{ color: WT.ink4 }}>불러오는 중…</div>
            ) : (
              <>
                <button onClick={closePost} className="text-[12px] font-bold mb-3 inline-flex items-center gap-1" style={{ color: WT.ink3 }}>
                  <ChevronLeft className="w-3.5 h-3.5" /> 목록으로
                </button>
                <h2 className="text-[18px] font-extrabold leading-snug" style={{ color: WT.ink }}>
                  {!!detail.post.is_pinned && <Pin className="w-4 h-4 inline mr-1" style={{ color: WT.brand }} />}
                  {detail.post.title}
                </h2>
                <p className="text-[12px] mt-1.5" style={{ color: WT.ink4 }}>{fmtDate(detail.post.created_at)} · 조회 {detail.post.view_count ?? 0}</p>
                {detail.post.body && (() => {
                  // 🛡️ 2026-06-13: 본문의 이미지 URL(http(s) …png/jpg/gif/webp) 은 세로 이미지로 렌더,
                  //   나머지 텍스트는 그대로 — 배송안내/공지에 운영자가 이미지 첨부(URL 붙여넣기) 가능.
                  const lines = detail.post.body.split(/\r?\n/)
                  const imgRe = /^https?:\/\/\S+\.(?:png|jpe?g|gif|webp)(?:\?\S*)?$/i
                  const blocks: Array<{ t: 'text'; v: string } | { t: 'img'; v: string }> = []
                  let buf: string[] = []
                  const flush = () => { if (buf.length) { blocks.push({ t: 'text', v: buf.join('\n') }); buf = [] } }
                  for (const ln of lines) {
                    if (imgRe.test(ln.trim())) { flush(); blocks.push({ t: 'img', v: ln.trim() }) }
                    else buf.push(ln)
                  }
                  flush()
                  return (
                    <div className="mt-4 space-y-3">
                      {blocks.map((b, i) => b.t === 'img'
                        ? <img key={i} src={cfImage(b.v, { width: 900, format: 'auto' }) || b.v} alt="" loading="lazy" decoding="async"
                            className="w-full rounded-xl" style={{ border: '1px solid ' + WT.line }}
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }} />
                        : b.v.trim() ? <p key={i} className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: WT.ink2 }}>{b.v}</p> : null)}
                    </div>
                  )
                })()}
                {/* 자료실: 이미지 다운로드 그리드 */}
                {detail.post.board_type === 'archive' && (
                  detail.downloads.length === 0 ? (
                    <p className="text-[13px] mt-5" style={{ color: WT.ink4 }}>다운로드 가능한 이미지가 아직 없어요.</p>
                  ) : (
                    <div className="mt-5">
                      <p className="text-[13px] font-bold mb-2" style={{ color: WT.ink }}>상품 이미지 {detail.downloads.length}장 — 상세페이지/마케팅에 자유롭게 사용하세요</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                        {detail.downloads.map((u, i) => (
                          <div key={u} className="rounded-xl overflow-hidden" style={{ border: '1px solid ' + WT.line }}>
                            <div className="aspect-square" style={{ background: WT.fill }}>
                              <img src={cfImage(u, { width: 300, format: 'auto' }) || u} alt={`자료 ${i + 1}`} loading="lazy" decoding="async" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = 'hidden' }} />
                            </div>
                            <a href={u} target="_blank" rel="noopener noreferrer" download
                              className="flex items-center justify-center gap-1 h-9 text-[12px] font-bold" style={{ color: WT.ink, background: WT.fill2 }}>
                              <Download className="w-3.5 h-3.5" /> 원본 다운로드
                            </a>
                          </div>
                        ))}
                      </div>
                      {detail.post.product_id && (
                        <button onClick={() => navigate(`/wholesale/product/${detail.post.product_id}`)}
                          className="mt-4 inline-flex items-center gap-1 text-[13px] font-bold" style={{ color: WT.brand }}>
                          상품 보러가기 <ExternalLink className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                )}
              </>
            )}
          </div>
        )}

        {/* ── 공지/자료실/배송 목록 ── (shipping 은 게시물 있을 때만 목록, 없으면 위 기본 가이드) */}
        {(tab === 'notice' || tab === 'archive' || (tab === 'shipping' && posts && posts.length > 0)) && !postId && (
          posts === null ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-2xl animate-pulse" style={{ background: '#fff' }} />)}</div>
          ) : posts.length === 0 ? (
            <div className="rounded-2xl py-20 text-center" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
              <p className="text-[14px]" style={{ color: WT.ink4 }}>{tab === 'notice' ? '등록된 공지사항이 없어요.' : tab === 'shipping' ? '등록된 배송 안내가 없어요.' : '등록된 자료가 없어요.'}</p>
              {isAdmin && (
                <button onClick={() => navigate('/admin/wholesale-board')}
                  className="mt-4 px-5 h-11 rounded-xl text-[13px] font-bold text-white" style={{ background: WT.ink }}>
                  ✏️ 첫 게시글 작성하기 (관리자)
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl overflow-hidden" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
              {posts.map((p, i) => (
                <button key={p.id} onClick={() => openPost(p.id)}
                  className="w-full flex items-center gap-3 px-4 lg:px-5 py-3.5 text-left transition-colors hover:bg-black/[0.02]"
                  style={i ? { borderTop: '1px solid ' + WT.line } : undefined}>
                  {tab === 'archive' && (
                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0" style={{ background: WT.fill }}>
                      {p.product_image && <img src={cfImage(p.product_image, { width: 96, format: 'auto' }) || p.product_image} alt="" loading="lazy" className="w-full h-full object-cover" />}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] font-bold truncate" style={{ color: WT.ink }}>
                      {!!p.is_pinned && <Pin className="w-3.5 h-3.5 inline mr-1 -mt-0.5" style={{ color: WT.brand }} />}
                      {p.title}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ color: WT.ink4 }}>
                      {fmtDate(p.created_at)} · 조회 {p.view_count ?? 0}
                      {tab === 'archive' && p.product_name ? ` · ${p.product_name}` : ''}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        )}

        {/* ── 신고·제안 (sellpie형 공개 게시판) ── */}
        {tab === 'report' && (
          <div className="space-y-5">
            <WholesaleProposalBoard />

            {/* 내 접수 내역 — 로그인 유통회원만(본인 글의 운영팀 답변 확인용). */}
            {loggedIn && (
              <div className="rounded-2xl p-5" style={{ background: '#fff', border: '1px solid ' + WT.line }}>
                <h3 className="text-[15px] font-extrabold mb-3" style={{ color: WT.ink }}>내 접수 내역</h3>
                {tickets === null ? (
                  <p className="text-[13px] py-6 text-center" style={{ color: WT.ink4 }}>불러오는 중…</p>
                ) : tickets.length === 0 ? (
                  <p className="text-[13px] py-6 text-center" style={{ color: WT.ink4 }}>접수한 내역이 없어요.</p>
                ) : (
                  <div>
                    {tickets.map((tk, i) => {
                      const st = TICKET_STATUS[tk.status] || TICKET_STATUS.open
                      return (
                        <div key={tk.id} className="py-3" style={i ? { borderTop: '1px solid ' + WT.line } : undefined}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-[13.5px] font-bold truncate" style={{ color: WT.ink }}>
                              {tk.type === 'report' ? '🚨' : '💡'} {tk.subject}
                            </p>
                            <span className="shrink-0 text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ color: st.color, background: st.color + '14' }}>{st.label}</span>
                          </div>
                          <p className="text-[11.5px] mt-0.5" style={{ color: WT.ink4 }}>{fmtDate(tk.created_at)}{tk.target ? ` · ${tk.target}` : ''}</p>
                          {tk.admin_memo && <p className="text-[12px] mt-1 rounded-lg px-2.5 py-1.5" style={{ color: WT.ink2, background: WT.fill }}>운영팀: {tk.admin_memo}</p>}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
