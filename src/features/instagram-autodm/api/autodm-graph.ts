/**
 * 💬 인스타 자동 DM — Instagram API(Instagram 로그인) 호출부.
 *
 * docs:
 *   - Private Reply: https://developers.facebook.com/docs/instagram-platform/private-replies
 *   - 웹훅 구독: https://developers.facebook.com/docs/instagram-platform/webhooks
 *   - 토큰 갱신: https://developers.facebook.com/docs/instagram-platform/reference/refresh_access_token
 *
 * 전부 throw 하지 않고 { ok, error } 로 돌려준다 — 웹훅 처리 중 예외로 다른 댓글까지 놓치지 않게.
 */

const GRAPH = 'https://graph.instagram.com'
const VERSION = 'v23.0'

export interface GraphResult<T = Record<string, unknown>> {
  ok: boolean
  data?: T
  error?: string
}

async function call<T>(url: string, init: RequestInit): Promise<GraphResult<T>> {
  try {
    const res = await fetch(url, init)
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok || body.error) {
      const err = (body.error || {}) as { message?: string; code?: number }
      return { ok: false, error: `${res.status} ${err.code ?? ''} ${err.message ?? '알 수 없는 오류'}`.trim().slice(0, 300) }
    }
    return { ok: true, data: body as T }
  } catch (e) {
    return { ok: false, error: `네트워크 오류: ${(e as Error).message}`.slice(0, 300) }
  }
}

const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' })

/** 토큰 주인 확인. user_id = 웹훅 entry.id 와 같은 값(프로페셔널 계정 ID). */
export function getMe(token: string) {
  return call<{ user_id?: string; id?: string; username?: string }>(
    `${GRAPH}/${VERSION}/me?fields=user_id,username`,
    { headers: authHeaders(token) },
  )
}

/** 이 계정의 댓글 웹훅 구독(앱 대시보드 설정과 별개로 계정 단위로도 켜야 한다). */
export function subscribeComments(token: string) {
  return call<{ success?: boolean }>(
    `${GRAPH}/${VERSION}/me/subscribed_apps?subscribed_fields=comments`,
    { method: 'POST', headers: authHeaders(token) },
  )
}

/** 댓글 단 사람에게 DM(Private Reply). 댓글당 1통 · 댓글 후 7일 이내만 허용. */
export function sendPrivateReply(token: string, accountId: string, commentId: string, text: string) {
  return call<{ recipient_id?: string; message_id?: string }>(
    `${GRAPH}/${VERSION}/${encodeURIComponent(accountId)}/messages`,
    {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ recipient: { comment_id: commentId }, message: { text } }),
    },
  )
}

/** 댓글에 공개 답글. */
export function replyToComment(token: string, commentId: string, message: string) {
  return call<{ id?: string }>(
    `${GRAPH}/${VERSION}/${encodeURIComponent(commentId)}/replies`,
    { method: 'POST', headers: authHeaders(token), body: JSON.stringify({ message }) },
  )
}

/** 장기 토큰(60일) 연장. 발급 후 24시간이 지나야 갱신된다. */
export function refreshLongLivedToken(token: string) {
  return call<{ access_token?: string; expires_in?: number }>(
    `${GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`,
    { method: 'GET' },
  )
}

/** 최근 게시물(규칙을 특정 게시물에 걸 때 고르는 용도). */
export function listRecentMedia(token: string, limit = 12) {
  return call<{ data?: Array<{ id: string; caption?: string; permalink?: string; thumbnail_url?: string; media_url?: string; media_type?: string; timestamp?: string }> }>(
    `${GRAPH}/${VERSION}/me/media?fields=id,caption,permalink,thumbnail_url,media_url,media_type,timestamp&limit=${Math.min(50, Math.max(1, limit))}`,
    { headers: authHeaders(token) },
  )
}
