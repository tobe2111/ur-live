// ──────────────────────────────────────────────────────────────
// 🏭 2026-06-09 Wave 4b — 유통사↔제조사 채팅 (D1 폴링 기반).
//   양방향 호출자:
//     • 유통사(distributor) = seller_token + is_distributor → @/lib/api (seller_token)
//     • 제조사(supplier)     = supplier_token → @/lib/supplier-api
//   백엔드가 토큰으로 role 을 auto-resolve. 같은 엔드포인트, 다른 토큰.
//
//   ⚡ 성능(필수): 무거운 채팅 UI 는 전부 lazy. 항상 떠 있는 건 unread 배지뿐.
//     배지 폴링 + 스레드 폴링은 adaptive (visible/hidden/open-thread) — useChatPoll.
//
//   ⚠️ 이 파일은 fetch 헬퍼만 — RQ hook 은 unread 배지 1개만(가벼움).
//     스레드/메시지는 위젯이 열릴 때만(lazy chunk) 직접 호출 → 초기 번들 0.
// ──────────────────────────────────────────────────────────────
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import { getSupplierToken } from '@/lib/supplier-api'
import { queryKeys } from './queryKeys'

// ── 호출자(역할) 판별 ───────────────────────────────────────────
//   제조사면 supplier_token, 유통사면 seller_token(+is_distributor).
//   둘 다 있으면 supplier_token 우선(제조사 대시보드 컨텍스트).
export type ChatRole = 'distributor' | 'supplier'

function readToken(): { token: string | null; role: ChatRole | null } {
  if (typeof window === 'undefined') return { token: null, role: null }
  const sup = getSupplierToken()
  if (sup) return { token: sup, role: 'supplier' }
  try {
    // 🛡️ 2026-06-15: 유통사 채팅은 is_distributor 인 셀러만 — 일반 셀러가 /wholesale 둘러볼 때
    //   seller_token 만 보고 unread 폴링 → 서버 401(is_distributor 가드) 콘솔/Sentry 노이즈 방지.
    const seller = localStorage.getItem('seller_token')
    if (seller && localStorage.getItem('is_distributor') === '1') return { token: seller, role: 'distributor' }
  } catch { /* noop */ }
  return { token: null, role: null }
}

export function hasChatToken(): boolean {
  return !!readToken().token
}

export function chatRole(): ChatRole | null {
  return readToken().role
}

function authHeaders(): Record<string, string> {
  const { token } = readToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

// ── 타입(API 계약) ──────────────────────────────────────────────
export interface ChatUnread {
  unread: number
  latest_thread_id: number | null
}

export interface ChatThread {
  id: number
  counterpart_id: number
  counterpart_name: string
  last_preview: string | null
  last_message_at: string | null
  unread: number
}

export interface ChatMessage {
  id: number
  sender_role: ChatRole
  body: string
  created_at: string
}

export interface ChatMessagesResult {
  messages: ChatMessage[]
  counterpart_name: string
}

// ── 가벼운 fetch 헬퍼 (위젯이 lazy 로 import) ────────────────────
export const wholesaleChatApi = {
  /** CHEAP — 배지용. unread 카운트 + 최신 스레드 id. */
  async unread(): Promise<ChatUnread> {
    const r = await api.get('/api/wholesale/chat/unread', { headers: authHeaders() })
    const d = r.data
    return {
      unread: Number(d?.unread) || 0,
      latest_thread_id: d?.latest_thread_id != null ? Number(d.latest_thread_id) : null,
    }
  },

  /** 스레드 목록 (위젯 열 때만). */
  async threads(): Promise<{ role: ChatRole | null; threads: ChatThread[] }> {
    const r = await api.get('/api/wholesale/chat/threads', { headers: authHeaders() })
    const d = r.data
    if (!d?.success) return { role: null, threads: [] }
    const threads: ChatThread[] = (d.threads || []).map((x: Record<string, unknown>) => ({
      id: Number(x.id),
      counterpart_id: Number(x.counterpart_id),
      counterpart_name: String(x.counterpart_name ?? ''),
      last_preview: x.last_preview != null ? String(x.last_preview) : null,
      last_message_at: x.last_message_at != null ? String(x.last_message_at) : null,
      unread: Number(x.unread) || 0,
    }))
    return { role: (d.role as ChatRole) ?? null, threads }
  },

  /** get-or-create 스레드 → thread_id. (유통사가 특정 제조사에게 문의 시) */
  async openThread(counterpartId: number): Promise<number | null> {
    const r = await api.post('/api/wholesale/chat/threads', { counterpart_id: counterpartId }, { headers: authHeaders() })
    const d = r.data
    return d?.success && d.thread_id != null ? Number(d.thread_id) : null
  },

  /**
   * 상품 기준 get-or-create → thread_id. (유통사가 상품 상세에서 "제조사에 문의")
   * 🛡️ 서버가 product_id → supplier_id 를 서버사이드로 해석. 클라는 제조사 신원/ID 를 모름.
   */
  // 🛡️ 2026-06-13 (채팅 버그 fix): 실패 사유를 반환 — 위젯이 빈 목록으로 조용히 끝내지 않고 안내.
  //   서버 4xx(제조사 미연결 상품 등)는 axios throw → catch 에서 메시지 추출.
  async openThreadByProduct(productId: number): Promise<{ id: number | null; error?: string }> {
    try {
      const r = await api.post('/api/wholesale/chat/threads/by-product', { product_id: productId }, { headers: authHeaders() })
      const d = r.data
      if (d?.success && d.thread_id != null) return { id: Number(d.thread_id) }
      return { id: null, error: d?.error || '문의를 시작할 수 없습니다' }
    } catch (e) {
      const err = e as { response?: { data?: { error?: string } } }
      return { id: null, error: err?.response?.data?.error || '문의를 시작할 수 없습니다' }
    }
  },

  /** 메시지 목록 (after=lastId 증분). 이 GET 이 읽음 처리도 함. */
  async messages(threadId: number, after?: number): Promise<ChatMessagesResult> {
    const qs = after != null && after > 0 ? `?after=${after}` : ''
    const r = await api.get(`/api/wholesale/chat/threads/${threadId}/messages${qs}`, { headers: authHeaders() })
    const d = r.data
    if (!d?.success) return { messages: [], counterpart_name: '' }
    const messages: ChatMessage[] = (d.messages || []).map((x: Record<string, unknown>) => ({
      id: Number(x.id),
      sender_role: (x.sender_role as ChatRole) ?? 'distributor',
      body: String(x.body ?? ''),
      created_at: String(x.created_at ?? ''),
    }))
    return { messages, counterpart_name: String(d.thread?.counterpart_name ?? '') }
  },

  /** 메시지 전송 → 생성된 message. */
  async send(threadId: number, body: string): Promise<ChatMessage | null> {
    const r = await api.post(`/api/wholesale/chat/threads/${threadId}/messages`, { body }, { headers: authHeaders() })
    const d = r.data
    if (!d?.success || !d.message) return null
    const m = d.message as Record<string, unknown>
    return {
      id: Number(m.id),
      sender_role: (m.sender_role as ChatRole) ?? 'distributor',
      body: String(m.body ?? ''),
      created_at: String(m.created_at ?? ''),
    }
  },
}

// ── unread 배지 전용 RQ hook (유일한 always-present 채팅 쿼리) ───
//   refetch 는 폴링(useChatPoll)이 담당하므로 RQ 자동 refetch 끔.
//   배지 컴포넌트가 mount 될 때만 enabled.
export function useWholesaleChatUnread(enabled = true) {
  return useQuery<ChatUnread>({
    queryKey: queryKeys.wholesale('chat-unread'),
    queryFn: () => wholesaleChatApi.unread().catch(() => ({ unread: 0, latest_thread_id: null })),
    enabled: enabled && hasChatToken(),
    staleTime: 20 * 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  })
}
