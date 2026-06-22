// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-09 Wave 4b — 판매사↔제조사 채팅 위젯 (lazy chunk).
//   ⚡ 이 파일 + 의존성은 별도 chunk — 위젯을 "열" 때만 fetch.
//      (WholesaleChatButton / SupplierDashboardPage 가 React.lazy 로 import)
//   슬라이드인 패널: 스레드 목록 → 스레드 열기 → 메시지 + 작성창.
//   • 본문은 textContent 로만 렌더 (HTML 주입 X — XSS 방어).
//   • 메시지 폴링(adaptive ~3s, focus 한정)은 useChatPoll.
//   • optimistic append + 전송 후 새로고침.
//   • 라이트 고정(WT 토큰) — dark: 없음.
// ──────────────────────────────────────────────────────────────
import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { X, ArrowLeft, Send, MessageCircle, Loader2, Factory } from 'lucide-react'
import { WT } from './wholesale-theme'
import { useChatPoll } from '@/hooks/useChatPoll'
import {
  wholesaleChatApi,
  type ChatThread,
  type ChatMessage,
  type ChatRole,
} from '@/hooks/queries/useWholesaleChat'

interface Props {
  onClose: () => void
  /** 열자마자 특정 제조사 스레드를 get-or-create 후 진입(상품 상세 "제조사 문의"). */
  initialCounterpartId?: number | null
  /**
   * 열자마자 특정 상품 기준으로 스레드를 get-or-create 후 진입(상품 상세 "제조사에 문의").
   * 🛡️ 서버가 product_id → 제조사를 서버사이드로 해석 — 클라는 제조사 신원/ID 를 모름.
   */
  initialProductId?: number | null
  /** 열자마자 특정 스레드(이미 알고 있는 thread_id)로 바로 진입. */
  initialThreadId?: number | null
  /** 부모 배지 동기화 — 읽음 처리 직후 unread 갱신 유도. */
  onUnreadChange?: (n: number) => void
  /** 제조사 대시보드 탭 임베드 모드 — slide-in 대신 컨테이너 채움. */
  embedded?: boolean
}

// ── 상대 시간(가벼움) ──
function timeAgo(dateStr: string, fallback: string): string {
  if (!dateStr) return ''
  const then = new Date((dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr + 'Z')).getTime()
  if (!Number.isFinite(then)) return fallback
  const diff = Math.max(0, Date.now() - then)
  const m = Math.floor(diff / 60000)
  if (m < 1) return fallback
  if (m < 60) return `${m}분 전`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}시간 전`
  return `${Math.floor(h / 24)}일 전`
}

export default function WholesaleChatWidget({ onClose, initialCounterpartId = null, initialProductId = null, initialThreadId = null, onUnreadChange, embedded = false }: Props) {
  const { t } = useTranslation()
  const [role, setRole] = useState<ChatRole | null>(null)
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [threadsLoading, setThreadsLoading] = useState(true)
  const [activeId, setActiveId] = useState<number | null>(null)
  const [counterpartName, setCounterpartName] = useState('')
  // 🛡️ 2026-06-13 (채팅 버그 fix): 상품 기준 진입 해석 중/실패 상태 — 빈 목록으로 조용히 끝나지 않게.
  const [resolving, setResolving] = useState(initialProductId != null && initialProductId > 0)
  const [resolveError, setResolveError] = useState<string | null>(null)

  // ── 스레드 목록 로드 ──
  const loadThreads = useCallback(async () => {
    try {
      const r = await wholesaleChatApi.threads()
      setRole(r.role)
      setThreads(r.threads)
    } catch { /* 조용 — 빈 목록 유지 */ }
    finally { setThreadsLoading(false) }
  }, [])

  useEffect(() => { loadThreads() }, [loadThreads])

  // ── 특정 제조사/상품/스레드로 바로 진입 ──
  //   우선순위: 이미 아는 thread_id > 상품 기준(서버가 제조사 해석) > 상대 id 기준.
  //   🛡️ 상품 기준은 product_id 만 보냄 — 제조사 신원/ID 는 클라가 모른 채 스레드 진입.
  useEffect(() => {
    let cancelled = false
    if (initialThreadId != null && initialThreadId > 0) {
      setActiveId(initialThreadId)
      return () => { cancelled = true }
    }
    if (initialProductId != null && initialProductId > 0) {
      setResolving(true); setResolveError(null)
      wholesaleChatApi.openThreadByProduct(initialProductId).then(({ id, error }) => {
        if (cancelled) return
        if (id != null) setActiveId(id)
        else setResolveError(error || '이 상품은 문의할 수 있는 제조사가 연결되어 있지 않아요.')
      }).finally(() => { if (!cancelled) setResolving(false) })
    } else if (initialCounterpartId != null) {
      wholesaleChatApi.openThread(initialCounterpartId).then((id) => {
        if (!cancelled && id != null) setActiveId(id)
      }).catch(() => { /* noop */ })
    }
    return () => { cancelled = true }
  }, [initialThreadId, initialProductId, initialCounterpartId])

  const openThread = (th: ChatThread) => {
    setActiveId(th.id)
    setCounterpartName(th.counterpart_name)
    // 낙관적으로 목록의 해당 스레드 unread 0 (GET messages 가 실제 읽음 처리).
    setThreads((prev) => prev.map((x) => (x.id === th.id ? { ...x, unread: 0 } : x)))
  }

  const backToList = () => {
    setActiveId(null)
    setCounterpartName('')
    loadThreads() // 목록 unread/미리보기 갱신
  }

  // 패널 본문 — 스레드 뷰 / 상품 해석중 / 해석 실패 안내 / 목록 뷰.
  const body = activeId != null ? (
    <ThreadView
      key={activeId}
      threadId={activeId}
      role={role}
      counterpartName={counterpartName}
      onBack={backToList}
      onRead={() => {
        // 읽음 후 전체 unread 재계산 신호(부모 배지).
        wholesaleChatApi.unread().then((u) => onUnreadChange?.(u.unread)).catch(() => { /* noop */ })
      }}
      t={t}
    />
  ) : resolving ? (
    // 🛡️ 상품 기준 진입 — 제조사 스레드 여는 중 (빈 목록 깜빡임 방지).
    <div className="flex-1 flex items-center justify-center text-[13px]" style={{ color: WT.ink3 }}>
      {t('wholesaleChat.opening', { defaultValue: '제조사에 연결 중...' })}
    </div>
  ) : resolveError ? (
    // 🛡️ 제조사 미연결 상품 등 — 빈 목록 대신 명확한 안내 + 목록으로.
    <div className="flex-1 flex flex-col items-center justify-center text-center px-8 gap-3">
      <p className="text-[14px] font-bold" style={{ color: WT.ink }}>문의를 시작할 수 없어요</p>
      <p className="text-[12.5px] leading-relaxed" style={{ color: WT.ink3 }}>{resolveError}</p>
      <button onClick={() => { setResolveError(null); loadThreads() }} className="mt-1 px-4 h-9 rounded-lg text-[12.5px] font-bold" style={{ background: WT.fill, color: WT.ink2 }}>
        {t('wholesaleChat.viewList', { defaultValue: '내 문의 목록 보기' })}
      </button>
    </div>
  ) : (
    <ThreadList
      threads={threads}
      loading={threadsLoading}
      role={role}
      onOpen={openThread}
      t={t}
    />
  )

  // ── 임베드(제조사 탭) — slide-in 없이 콘텐츠만 ──
  if (embedded) {
    return (
      <div className="rounded-2xl border overflow-hidden flex flex-col" style={{ borderColor: WT.line, background: '#fff', height: 'min(72vh, 640px)' }}>
        {body}
      </div>
    )
  }

  // ── slide-in 패널(판매사 floating) ──
  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label={t('wholesaleChat.title', { defaultValue: '문의 채팅' })}>
      <div className="absolute inset-0" style={{ background: 'rgba(20,22,28,0.4)' }} onClick={onClose} />
      <div
        className="relative w-full sm:max-w-md h-full flex flex-col animate-[slideInRight_0.22s_ease-out]"
        style={{ background: '#fff', boxShadow: WT.shCard }}
      >
        {/* slide-in 키프레임 — 인라인 style 태그(스코프 작음) */}
        <style>{`@keyframes slideInRight{from{transform:translateX(24px);opacity:.6}to{transform:translateX(0);opacity:1}}`}</style>
        {activeId == null && (
          <div className="flex items-center justify-between px-4 h-14 border-b flex-shrink-0" style={{ borderColor: WT.line }}>
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" style={{ color: WT.brand }} />
              <span className="text-[15px] font-bold" style={{ color: WT.ink }}>
                {t('wholesaleChat.title', { defaultValue: '문의 채팅' })}
              </span>
            </div>
            <button type="button" onClick={onClose} aria-label={t('common.close', { defaultValue: '닫기' })} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5" style={{ color: WT.ink2 }} />
            </button>
          </div>
        )}
        {body}
      </div>
    </div>
  )
}

// ── 스레드 목록 ──────────────────────────────────────────────
function ThreadList({ threads, loading, role, onOpen, t }: {
  threads: ChatThread[]
  loading: boolean
  role: ChatRole | null
  onOpen: (th: ChatThread) => void
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const cpLabel = role === 'supplier'
    ? t('wholesaleChat.distributorLabel', { defaultValue: '판매사' })
    : t('wholesaleChat.supplierLabel', { defaultValue: '제조사' })

  if (loading) {
    return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: WT.ink4 }} /></div>
  }
  if (threads.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
        <Factory className="w-10 h-10 mb-3" style={{ color: WT.ink4 }} />
        <p className="text-sm font-semibold" style={{ color: WT.ink2 }}>{t('wholesaleChat.empty', { defaultValue: '아직 대화가 없어요' })}</p>
        <p className="text-xs mt-1" style={{ color: WT.ink3 }}>
          {role === 'supplier'
            ? t('wholesaleChat.emptySupplier', { defaultValue: '판매사가 문의하면 여기에 표시됩니다.' })
            : t('wholesaleChat.emptyDistributor', { defaultValue: '상품 상세에서 제조사에게 문의해보세요.' })}
        </p>
      </div>
    )
  }
  return (
    <div className="flex-1 overflow-y-auto">
      <ul className="divide-y" style={{ borderColor: WT.line }}>
        {threads.map((th) => (
          <li key={th.id}>
            <button
              type="button"
              onClick={() => onOpen(th)}
              className="w-full text-left px-4 py-3.5 flex items-center gap-3 hover:bg-gray-50 transition-colors"
            >
              <div className="h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: WT.fill }}>
                <Factory className="w-5 h-5" style={{ color: WT.ink3 }} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold truncate" style={{ color: WT.ink }}>{th.counterpart_name || cpLabel}</span>
                  {th.last_message_at && <span className="text-[11px] flex-shrink-0" style={{ color: WT.ink4 }}>{timeAgo(th.last_message_at, t('wholesaleChat.justNow', { defaultValue: '방금' }))}</span>}
                </div>
                <p className="text-xs truncate mt-0.5" style={{ color: WT.ink3 }}>{th.last_preview || t('wholesaleChat.noPreview', { defaultValue: '대화를 시작하세요' })}</p>
              </div>
              {th.unread > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 flex items-center justify-center rounded-full text-[11px] font-extrabold flex-shrink-0" style={{ background: WT.brand, color: '#fff' }}>
                  {th.unread > 99 ? '99+' : th.unread}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── 스레드 뷰(메시지 + 작성창) ──────────────────────────────
function ThreadView({ threadId, role, counterpartName, onBack, onRead, t }: {
  threadId: number
  role: ChatRole | null
  counterpartName: string
  onBack: () => void
  onRead: () => void
  t: (k: string, o?: Record<string, unknown>) => string
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [name, setName] = useState(counterpartName)
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef(0)
  // optimistic 임시 메시지 id(음수) — 서버 응답으로 교체.
  const tmpIdRef = useRef(-1)

  const scrollToBottom = useCallback((smooth = false) => {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: smooth ? 'smooth' : 'auto' })
  }, [])

  // 증분 머지 — after=lastId 로 받은 새 메시지를 append(중복 id 제거).
  const mergeMessages = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return
    setMessages((prev) => {
      const seen = new Set(prev.filter((m) => m.id > 0).map((m) => m.id))
      const fresh = incoming.filter((m) => !seen.has(m.id))
      if (fresh.length === 0) return prev
      // optimistic(음수 id) 항목 중, 같은 body 의 서버 메시지가 도착하면 제거.
      const freshBodies = new Set(fresh.map((m) => m.body))
      const cleaned = prev.filter((m) => !(m.id < 0 && freshBodies.has(m.body)))
      const merged = [...cleaned, ...fresh].sort((a, b) => {
        if (a.id > 0 && b.id > 0) return a.id - b.id
        return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0
      })
      const maxId = Math.max(lastIdRef.current, ...fresh.map((m) => m.id))
      lastIdRef.current = maxId
      return merged
    })
  }, [])

  // 초기 로드(전체) — read 처리됨.
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    wholesaleChatApi.messages(threadId, 0).then((r) => {
      if (cancelled) return
      setMessages(r.messages)
      if (r.counterpart_name) setName(r.counterpart_name)
      lastIdRef.current = r.messages.reduce((mx, m) => Math.max(mx, m.id), 0)
      setLoading(false)
      onRead()
      requestAnimationFrame(() => scrollToBottom(false))
    }).catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadId])

  // adaptive 폴링 — 열린 스레드는 focus 한정 ~3s, 백오프 30s. useChatPoll 가 hidden 이면 중단.
  useChatPoll(
    async () => {
      try {
        const r = await wholesaleChatApi.messages(threadId, lastIdRef.current)
        if (r.messages.length > 0) {
          mergeMessages(r.messages)
          requestAnimationFrame(() => scrollToBottom(true))
          onRead()
        }
        return true
      } catch {
        return false
      }
    },
    { baseInterval: 3_000, maxInterval: 30_000, enabled: !loading },
  )

  const myRole: ChatRole = role ?? 'distributor'

  const send = async () => {
    const text = draft.trim()
    if (!text || sending) return
    setSending(true)
    const optimistic: ChatMessage = {
      id: tmpIdRef.current--,
      sender_role: myRole,
      body: text,
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, optimistic])
    setDraft('')
    requestAnimationFrame(() => scrollToBottom(true))
    try {
      const saved = await wholesaleChatApi.send(threadId, text)
      if (saved) {
        // optimistic → 실제 메시지로 교체.
        setMessages((prev) => prev.map((m) => (m.id === optimistic.id ? saved : m)))
        lastIdRef.current = Math.max(lastIdRef.current, saved.id)
      }
    } catch {
      // 실패 — optimistic 제거 + draft 복원.
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id))
      setDraft(text)
    } finally {
      setSending(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* 헤더 */}
      <div className="flex items-center gap-2 px-2 h-14 border-b flex-shrink-0" style={{ borderColor: WT.line }}>
        <button type="button" onClick={onBack} aria-label={t('common.back', { defaultValue: '뒤로' })} className="p-2 rounded-lg hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5" style={{ color: WT.ink2 }} />
        </button>
        <div className="h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: WT.fill }}>
          <Factory className="w-4 h-4" style={{ color: WT.ink3 }} />
        </div>
        <span className="text-sm font-bold truncate" style={{ color: WT.ink }}>
          {name || (role === 'supplier' ? t('wholesaleChat.distributorLabel', { defaultValue: '판매사' }) : t('wholesaleChat.supplierLabel', { defaultValue: '제조사' }))}
        </span>
      </div>

      {/* 메시지 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-2.5" style={{ background: WT.fill2 }}>
        {loading ? (
          <div className="h-full flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin" style={{ color: WT.ink4 }} /></div>
        ) : messages.length === 0 ? (
          <div className="h-full flex items-center justify-center text-center">
            <p className="text-xs" style={{ color: WT.ink3 }}>{t('wholesaleChat.threadEmpty', { defaultValue: '첫 메시지를 보내보세요.' })}</p>
          </div>
        ) : (
          messages.map((m) => {
            const mine = m.sender_role === myRole
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[78%]">
                  {/* body 는 텍스트 노드로만 렌더 — HTML 주입 차단 */}
                  <div
                    className="px-3 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words"
                    style={mine
                      ? { background: WT.brand, color: '#fff', borderBottomRightRadius: 4 }
                      : { background: '#fff', color: WT.ink, border: `1px solid ${WT.line}`, borderBottomLeftRadius: 4 }}
                  >
                    {m.body}
                  </div>
                  <div className={`text-[10px] mt-0.5 ${mine ? 'text-right' : 'text-left'}`} style={{ color: WT.ink4 }}>
                    {timeAgo(m.created_at, t('wholesaleChat.justNow', { defaultValue: '방금' }))}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* 🛡️ 안전거래 안내 — 연락처/외부결제 정보는 자동 차단(disintermediation 방지) */}
      <div className="px-3 pt-2 text-[11px] leading-snug text-gray-400" style={{ background: '#fff' }}>
        {t('wholesaleChat.safetyNotice', { defaultValue: '🛡️ 안전거래를 위해 전화번호·이메일·계좌·메신저 ID 등 연락처와 외부 결제 정보는 자동으로 가려집니다. 직거래는 정책상 제한됩니다.' })}
      </div>
      {/* 작성창 */}
      <div className="flex items-end gap-2 p-3 border-t flex-shrink-0" style={{ borderColor: WT.line, background: '#fff' }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder={t('wholesaleChat.composerPh', { defaultValue: '메시지를 입력하세요' })}
          aria-label={t('wholesaleChat.composerPh', { defaultValue: '메시지를 입력하세요' })}
          className="flex-1 resize-none px-3 py-2.5 rounded-xl text-sm outline-none max-h-28"
          style={{ background: WT.fill, color: WT.ink, border: `1px solid ${WT.line}` }}
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || !draft.trim()}
          aria-label={t('wholesaleChat.send', { defaultValue: '보내기' })}
          className="h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
          style={{ background: WT.brand, color: '#fff' }}
        >
          {sending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  )
}
