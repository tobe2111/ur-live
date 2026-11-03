/**
 * 💬 고르기 전 질문 — 견적 하나의 짧은 대화 (2026-10-26). 손님 견적 카드와 사장님 요청 화면이 같이 쓴다.
 * 연락처(전화번호·카톡 아이디)는 서버가 거절한다 — 번호는 고른 뒤에만 열린다(`shared/home-service-chat.ts`).
 * 열려 있는 동안만 20초마다 새 줄을 확인한다(닫으면 멈춘다).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import api from '@/lib/api'
import { toast } from '@/hooks/useToast'
import { formatKSTTime } from '@/utils/date'
import { CHAT_BODY_MAX } from '@/shared/home-service-chat'
import { sellerHeaders } from './life-shared'
const injectMotionCss = (id: string, css: string) => { if (typeof document !== 'undefined' && !document.getElementById(id)) document.head.appendChild(Object.assign(document.createElement('style'), { id, textContent: css })) } // 움직임 CSS 를 이 부품이 불러올 때 한 번 꽂는다 — 공유 모듈로 빼면 묶음기가 화면마다 청크를 하나 더 만든다(2026-11-02 실측)
// 🎬 2026-11-02 10차 ⑤ — 처음 연 뒤에 **새로 생긴** 말풍선만: 내 것은 보내기 쪽(오른쪽 아래)에서 날아들고, 상대 것은 아래에서 떠오른다.
injectMotionCss('ur-m-chat', `@keyframes ur-msg-fly { from { opacity: 0; transform: translate(20px, 16px) scale(.75); } }@keyframes ur-msg-in { from { opacity: 0; transform: translateY(12px); } }.ur-msg-fly { transform-origin: right bottom; animation: ur-msg-fly .36s cubic-bezier(.2,1,.3,1) backwards; }.ur-msg-in { animation: ur-msg-in .34s cubic-bezier(.2,.9,.3,1) backwards; }@media (prefers-reduced-motion: reduce){.ur-msg-fly,.ur-msg-in{animation:none!important}}`)

interface Msg { id: number; sender: 'customer' | 'pro'; body: string; created_at: string }

export default function QuoteChat({ base, me, canSend, otherName }: {
  /** 예: `/api/home-service/requests/12/quotes/34/messages` */
  base: string
  me: 'customer' | 'pro'
  canSend: boolean
  otherName: string
}) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const end = useRef<HTMLLIElement>(null)
  // 처음 받아 온 줄들은 그대로 — 그 뒤에 생긴 줄만 움직인다.
  const firstIds = useRef<Set<number> | null>(null)
  if (msgs && !firstIds.current) firstIds.current = new Set(msgs.map((m) => m.id))

  // 사장님 쪽은 매장 좌석 토큰으로 — 렌더마다 새 객체를 만들면 effect 가 계속 다시 돌므로 호출 때 읽는다.
  const auth = () => (me === 'pro' ? sellerHeaders() : undefined)
  const load = useCallback(() => {
    api.get(base, auth()).then((r) => setMsgs(r.data?.success ? r.data.data || [] : [])).catch(() => setMsgs((m) => m ?? []))
  }, [base, me]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    load()
    const t = window.setInterval(load, 20000)
    return () => window.clearInterval(t)
  }, [load])
  useEffect(() => { end.current?.scrollIntoView({ block: 'nearest' }) }, [msgs?.length])

  async function send() {
    if (!text.trim()) return
    setBusy(true)
    try {
      const r = await api.post(base, { body: text }, auth())
      if (r.data?.success) { setText(''); load() } else toast.error(r.data?.error || '보내지 못했어요')
    } catch (e: unknown) {
      toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error || '보내지 못했어요')
    } finally { setBusy(false) }
  }

  return (
    <div className="mt-3 rounded-xl bg-warm p-3">
      {msgs === null ? (
        <p className="py-2 text-center text-[13px] text-gray-500 dark:text-gray-400">불러오는 중</p>
      ) : msgs.length === 0 ? (
        <p className="py-2 text-[13px] text-gray-500 dark:text-gray-400">
          {me === 'customer' ? '가능한 날짜, 포함 내용 같은 걸 고르기 전에 물어보세요.' : '손님이 질문을 남기면 여기 보여요.'}
        </p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {msgs.map((m) => {
            const mine = m.sender === me
            const fresh = !firstIds.current?.has(m.id)
            return (
              <li key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 ${mine ? 'bg-brand text-white' : 'bg-surface text-ink'}${fresh ? (mine ? ' ur-msg-fly' : ' ur-msg-in') : ''}`}>
                  {!mine && <p className="text-[12px] font-medium text-gray-500 dark:text-gray-400">{otherName}</p>}
                  <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{m.body}</p>
                  <p className={`mt-1 text-right text-[12px] ${mine ? 'text-white/70' : 'text-gray-400 dark:text-gray-500'}`}>{formatKSTTime(m.created_at)}</p>
                </div>
              </li>
            )
          })}
          <li ref={end} aria-hidden="true" />
        </ul>
      )}
      {canSend && (
        <div className="mt-3 flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={CHAT_BODY_MAX}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) void send() }}
            placeholder={me === 'customer' ? '사장님께 물어보기' : '손님에게 답하기'}
            className="min-w-0 flex-1 rounded-xl border border-rule bg-surface px-3 py-2 text-[15px] text-ink outline-none focus:border-brand" />
          <button type="button" disabled={busy || !text.trim()} onClick={send}
            className="shrink-0 rounded-xl bg-brand px-4 text-[13px] font-medium text-white disabled:opacity-50">보내기</button>
        </div>
      )}
      {canSend && <p className="mt-2 text-[12px] text-gray-500 dark:text-gray-400">연락처는 고른 뒤에 서로 공개돼요. 번호는 적지 말아 주세요.</p>}
    </div>
  )
}
