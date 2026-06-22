/**
 * 🏬 2026-06-15 (사용자 요청 — sellpie형 제안/신고 게시판): 게시판 report 탭 본문.
 *   구성(시안): 상단 6개 아이콘 카드 + 카테고리 탭(전체+6) + 공개 테이블 목록(번호/카테고리/
 *   제목+답변완료/작성자 마스킹/작성일) + 페이지네이션 + 글쓰기(로그인 유통회원).
 *   목록은 공개(가입 유도) — 본문/작성자 실명은 비공개(비밀글 모델). 작성은 유통회원만.
 *   라이트 고정(WT).
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, Lock, CheckCircle2, PenLine, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { WT } from './wholesale-theme'
import { PROPOSAL_CATEGORIES, categoryLabel, categoryToType, type ProposalKind } from '@/shared/wholesale-proposal-categories'

interface BoardRow { id: number; category: string; subject: string; author: string; answered: boolean; created_at: string }
const sellerToken = () => (typeof window !== 'undefined' ? localStorage.getItem('seller_token') : null)
const auth = () => ({ headers: { Authorization: `Bearer ${sellerToken()}` } })
const fmtDate = (s: string) => (s || '').replace('T', ' ').slice(0, 16)

export default function WholesaleProposalBoard() {
  const navigate = useNavigate()
  const loggedIn = !!sellerToken()
  const [kind, setKind] = useState<'' | ProposalKind>('')  // '' = 전체 | 'proposal' = 제안 | 'report' = 신고
  const [page, setPage] = useState(1)
  const [rows, setRows] = useState<BoardRow[] | null>(null)
  const [total, setTotal] = useState(0)
  const [per, setPer] = useState(15)
  const [writeOpen, setWriteOpen] = useState(false)

  const load = useCallback(() => {
    setRows(null)
    const q = new URLSearchParams()
    if (kind) q.set('kind', kind)
    q.set('page', String(page))
    api.get(`/api/wholesale/proposal-tickets/board?${q.toString()}`)
      .then(r => {
        if (r.data?.success) { setRows(r.data.rows || []); setTotal(r.data.total || 0); setPer(r.data.per_page || 15) }
        else setRows([])
      })
      .catch(() => setRows([]))
  }, [kind, page])
  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(total / per))
  const startNo = total - (page - 1) * per

  return (
    <div>
      {/* 헤더 카피 */}
      <div className="text-center mb-7">
        <h2 className="text-[22px] lg:text-[26px] font-extrabold" style={{ color: WT.ink }}>유통스타트에 제안합니다</h2>
        <p className="text-[13px] mt-2 leading-relaxed" style={{ color: WT.ink3 }}>
          열려 있는 마음으로 파트너분들의 의견을 경청하고 있습니다.<br />
          상품 공급을 제안해 주시거나, 불공정행위가 발견되면 언제나 제안·신고해 주세요.
        </p>
      </div>

      {/* 6개 아이콘 카드 (시각 불변 — 클릭 시 해당 카테고리의 kind 로 필터) */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
        {PROPOSAL_CATEGORIES.map(c => {
          const cardKind = categoryToType(c.key)
          const cardActive = kind === cardKind
          return (
            <button key={c.key} onClick={() => { setKind(cardKind); setPage(1) }} className="flex flex-col items-center gap-2 group">
              <span className="flex h-16 w-16 lg:h-20 lg:w-20 items-center justify-center rounded-full text-[28px] lg:text-[34px] transition-transform group-hover:scale-105"
                style={{ background: cardActive ? WT.brandSoft : '#EAF2FB' }}>{c.emoji}</span>
              <span className="text-[11px] lg:text-[12px] font-bold text-center leading-tight whitespace-pre-line" style={{ color: cardActive ? WT.brand : WT.ink2 }}>{c.desc}</span>
            </button>
          )
        })}
      </div>

      {/* 필터 탭 3개(전체/제안/신고) + 글쓰기 */}
      <div className="flex items-center justify-between gap-2 border-b mb-0" style={{ borderColor: WT.line }}>
        <div className="flex gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {([['', '전체'], ['proposal', '제안'], ['report', '신고']] as const).map(([k, label]) => (
            <button key={k || 'all'} onClick={() => { setKind(k); setPage(1) }}
              className="shrink-0 px-3.5 h-11 text-[13.5px] font-bold whitespace-nowrap border-b-2"
              style={kind === k ? { color: WT.brand, borderColor: WT.brand } : { color: WT.ink3, borderColor: 'transparent' }}>{label}</button>
          ))}
        </div>
        {loggedIn && (
          <button onClick={() => setWriteOpen(true)}
            className="shrink-0 inline-flex items-center gap-1 px-3.5 h-9 rounded-lg text-[12.5px] font-bold text-white" style={{ background: WT.brand }}>
            <PenLine className="w-3.5 h-3.5" /> 글쓰기
          </button>
        )}
      </div>

      {/* 테이블 목록 */}
      <div className="overflow-hidden rounded-b-xl" style={{ border: '1px solid ' + WT.line, borderTop: 0 }}>
        {/* 헤더 (데스크톱) */}
        <div className="hidden sm:flex items-center text-[12px] font-bold px-4 py-2.5" style={{ background: WT.fill, color: WT.ink3 }}>
          <span className="w-14 shrink-0 text-center">번호</span>
          <span className="w-36 shrink-0">카테고리</span>
          <span className="flex-1">제목</span>
          <span className="w-24 shrink-0 text-center">작성자</span>
          <span className="w-28 shrink-0 text-center">작성일</span>
        </div>
        {rows === null ? (
          <div className="py-16 text-center text-[13px]" style={{ color: WT.ink4 }}><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center text-[13.5px]" style={{ color: WT.ink4 }}>
            아직 등록된 글이 없어요.{loggedIn ? ' 첫 글을 남겨보세요!' : ''}
          </div>
        ) : (
          rows.map((r, i) => (
            <div key={r.id} className="flex flex-col sm:flex-row sm:items-center px-4 py-3 text-[13px]" style={{ borderTop: '1px solid ' + WT.line }}>
              <span className="hidden sm:block w-14 shrink-0 text-center tabular-nums" style={{ color: WT.ink4 }}>{startNo - i}</span>
              <span className="w-36 shrink-0 text-[12px] font-semibold mb-1 sm:mb-0" style={{ color: WT.ink3 }}>{categoryLabel(r.category)}</span>
              <span className="flex-1 flex items-center gap-1.5 font-medium" style={{ color: WT.ink }}>
                <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: WT.ink4 }} />
                <span className="truncate">{r.subject}</span>
                {r.answered && (
                  <span className="shrink-0 inline-flex items-center gap-0.5 text-[10.5px] font-bold rounded px-1.5 py-0.5" style={{ background: WT.posBg, color: WT.pos }}>
                    <CheckCircle2 className="w-3 h-3" /> 답변완료
                  </span>
                )}
              </span>
              <span className="w-24 shrink-0 text-center text-[12px] mt-1 sm:mt-0" style={{ color: WT.ink3 }}>{r.author}</span>
              <span className="w-28 shrink-0 text-center text-[11.5px] tabular-nums" style={{ color: WT.ink4 }}>{fmtDate(r.created_at)}</span>
            </div>
          ))
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-5">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            className="px-2.5 h-8 rounded text-[13px] disabled:opacity-30" style={{ color: WT.ink3 }}>‹</button>
          {Array.from({ length: Math.min(10, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 4, totalPages - 9))
            const n = start + i
            if (n > totalPages) return null
            return (
              <button key={n} onClick={() => setPage(n)}
                className="min-w-8 h-8 px-2 rounded text-[13px] font-bold tabular-nums"
                style={n === page ? { background: WT.brand, color: '#fff' } : { color: WT.ink2 }}>{n}</button>
            )
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            className="px-2.5 h-8 rounded text-[13px] disabled:opacity-30" style={{ color: WT.ink3 }}>›</button>
        </div>
      )}

      {!loggedIn && (
        <div className="mt-6 rounded-2xl py-8 text-center" style={{ background: WT.fill }}>
          <p className="text-[13.5px] font-bold" style={{ color: WT.ink }}>글 작성은 유통사 전용이에요</p>
          <button onClick={() => navigate('/wholesale/login')} className="mt-3 px-6 h-10 rounded-xl text-[13px] font-bold text-white" style={{ background: WT.brand }}>로그인하기</button>
        </div>
      )}

      {writeOpen && <WriteModal onClose={() => setWriteOpen(false)} onDone={() => { setWriteOpen(false); setPage(1); load() }} />}
    </div>
  )
}

// ── 글쓰기 모달 ──
function WriteModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [category, setCategory] = useState(PROPOSAL_CATEGORIES[0].key)
  const [target, setTarget] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (saving) return
    if (!subject.trim()) { toast.error('제목을 입력해주세요'); return }
    if (!body.trim()) { toast.error('내용을 입력해주세요'); return }
    setSaving(true)
    try {
      const r = await api.post('/api/wholesale/proposal-tickets', { category, target: target.trim() || undefined, subject: subject.trim(), body: body.trim() }, auth())
      if (r.data?.success) { toast.success('접수되었습니다 — 운영팀이 검토 후 답변드려요'); onDone() }
      else toast.error(r.data?.error || '접수 실패')
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } })?.response?.data?.error || '접수 실패')
    } finally { setSaving(false) }
  }

  const inputCls = 'w-full h-11 rounded-xl px-3.5 text-[13.5px] text-gray-900 focus:outline-none'
  const inputStyle = { background: WT.fill, border: '1px solid ' + WT.line } as React.CSSProperties

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[16px] font-extrabold" style={{ color: WT.ink }}>제안·신고 작성</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
        </div>
        <label className="block text-[12px] font-bold mb-1" style={{ color: WT.ink2 }}>카테고리</label>
        <div className="grid grid-cols-2 gap-1.5 mb-3">
          {PROPOSAL_CATEGORIES.map(c => (
            <button key={c.key} onClick={() => setCategory(c.key)}
              className="h-10 rounded-lg text-[12px] font-bold transition-colors"
              style={category === c.key ? { background: WT.brandSoft, color: WT.brand, border: '1px solid ' + WT.brand } : { background: WT.fill, color: WT.ink2, border: '1px solid transparent' }}>
              {c.emoji} {c.label}
            </button>
          ))}
        </div>
        <input value={target} onChange={e => setTarget(e.target.value)} maxLength={200} placeholder="대상 상품/판매처 (선택)" className={inputCls} style={{ ...inputStyle, marginBottom: 8 }} />
        <input value={subject} onChange={e => setSubject(e.target.value)} maxLength={120} placeholder="제목" className={inputCls} style={{ ...inputStyle, marginBottom: 8 }} />
        <textarea value={body} onChange={e => setBody(e.target.value)} maxLength={4000} rows={6} placeholder="내용을 자세히 적어주세요 (위반 가격/캡처 링크, 제안 상세 등)"
          className="w-full rounded-xl px-3.5 py-3 text-[13.5px] text-gray-900 resize-none focus:outline-none" style={inputStyle} />
        <p className="text-[11px] mt-2" style={{ color: WT.ink4 }}>🔒 작성 내용·작성자 실명은 비공개로 처리되며, 운영팀만 확인합니다.</p>
        <button onClick={submit} disabled={saving} className="mt-3 w-full h-12 rounded-xl text-[14px] font-bold text-white disabled:opacity-50" style={{ background: WT.brand }}>
          {saving ? '접수 중…' : '접수하기'}
        </button>
      </div>
    </div>
  )
}
