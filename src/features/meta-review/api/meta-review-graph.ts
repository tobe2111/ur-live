/**
 * 🎬 2026-11-18 메타 앱 검수 시연 — 로그인(OAuth)과 그래프 API 호출.
 *
 * 스레드: https://developers.facebook.com/docs/threads/get-started/get-access-tokens-and-permissions
 *         keyword_search · reply(media_type=TEXT + reply_to_id) · /{id}/replies
 * 인스타(페이스북 로그인): https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login
 *         ig_hashtag_search(Instagram Public Content Access) · business_discovery · comments/replies · 페이지 conversations/messages
 *
 * 전부 throw 하지 않고 { ok, data | error } 를 돌려준다 — 화면이 메타의 에러 문장을 그대로 보여 줘야
 * 녹화 중에 무엇이 막혔는지 바로 안다.
 */
import type { MetaProvider } from './meta-review-store'

export const FB_V = 'v21.0'
const FB = `https://graph.facebook.com/${FB_V}`
const TH = 'https://graph.threads.net/v1.0'

export const THREADS_SCOPES = [
  'threads_basic', 'threads_content_publish', 'threads_read_replies', 'threads_manage_replies',
  'threads_manage_mentions', 'threads_manage_insights', 'threads_keyword_search',
] as const

export const FB_SCOPES = [
  'instagram_basic', 'instagram_manage_comments', 'instagram_manage_messages', 'instagram_manage_insights',
  'instagram_content_publish', 'pages_show_list', 'pages_read_engagement', 'pages_manage_metadata', 'business_management',
] as const

export interface G<T = any> { ok: boolean; data?: T; error?: string }

async function call<T = any>(url: string, init?: RequestInit): Promise<G<T>> {
  try {
    const r = await fetch(url, init)
    const b = (await r.json().catch(() => ({}))) as any
    if (!r.ok || b?.error) return { ok: false, error: String(b?.error?.message || b?.error_message || `HTTP ${r.status}`).slice(0, 300) }
    return { ok: true, data: b as T }
  } catch (e) {
    return { ok: false, error: `네트워크 오류: ${(e as Error).message}`.slice(0, 300) }
  }
}
const qs = (o: Record<string, string>) => new URLSearchParams(o).toString()
const form = (o: Record<string, string>): RequestInit => ({
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: qs(o),
})

// ── 로그인 ──────────────────────────────────────────────

export function authorizeUrl(p: MetaProvider, appId: string, redirectUri: string, state: string): string {
  if (p === 'threads') {
    return `https://threads.net/oauth/authorize?${qs({ client_id: appId, redirect_uri: redirectUri, scope: THREADS_SCOPES.join(','), response_type: 'code', state })}`
  }
  return `https://www.facebook.com/${FB_V}/dialog/oauth?${qs({ client_id: appId, redirect_uri: redirectUri, scope: FB_SCOPES.join(','), response_type: 'code', state })}`
}

export interface Exchanged { access_token: string; expires_in?: number; user_id?: string }

/** code → 단기 → 장기 토큰. */
export async function exchange(p: MetaProvider, appId: string, secret: string, redirectUri: string, code: string): Promise<G<Exchanged>> {
  code = code.replace(/#_$/, '')
  if (p === 'threads') {
    const s = await call<{ access_token: string; user_id: string | number }>('https://graph.threads.net/oauth/access_token',
      form({ client_id: appId, client_secret: secret, grant_type: 'authorization_code', redirect_uri: redirectUri, code }))
    if (!s.ok || !s.data?.access_token) return { ok: false, error: `코드 교환 실패: ${s.error || '토큰 없음'}` }
    const l = await call<{ access_token: string; expires_in: number }>(`https://graph.threads.net/access_token?${qs({ grant_type: 'th_exchange_token', client_secret: secret, access_token: s.data.access_token })}`)
    if (!l.ok || !l.data?.access_token) return { ok: false, error: `장기 토큰 교환 실패: ${l.error}` }
    return { ok: true, data: { access_token: l.data.access_token, expires_in: l.data.expires_in, user_id: String(s.data.user_id ?? '') } }
  }
  const s = await call<{ access_token: string }>(`${FB}/oauth/access_token?${qs({ client_id: appId, client_secret: secret, redirect_uri: redirectUri, code })}`)
  if (!s.ok || !s.data?.access_token) return { ok: false, error: `코드 교환 실패: ${s.error || '토큰 없음'}` }
  const l = await call<{ access_token: string; expires_in?: number }>(`${FB}/oauth/access_token?${qs({ grant_type: 'fb_exchange_token', client_id: appId, client_secret: secret, fb_exchange_token: s.data.access_token })}`)
  if (!l.ok || !l.data?.access_token) return { ok: false, error: `장기 토큰 교환 실패: ${l.error}` }
  return { ok: true, data: { access_token: l.data.access_token, expires_in: l.data.expires_in } }
}

export const threadsMe = (t: string) => call<{ id: string; username: string }>(`${TH}/me?${qs({ fields: 'id,username', access_token: t })}`)

/** 페이스북 로그인 뒤 — 인스타 비즈니스 계정이 붙은 첫 페이지를 찾는다. */
export async function findIgAccount(userToken: string): Promise<G<{ page_id: string; page_token: string; ig_id: string; username: string | null }>> {
  const r = await call<{ data: any[] }>(`${FB}/me/accounts?${qs({ fields: 'id,name,access_token,instagram_business_account{id,username}', access_token: userToken })}`)
  if (!r.ok) return { ok: false, error: r.error }
  const page = (r.data?.data || []).find(p => p?.instagram_business_account?.id)
  if (!page) return { ok: false, error: '인스타 비즈니스 계정이 연결된 페이스북 페이지를 찾지 못했어요' }
  return { ok: true, data: { page_id: page.id, page_token: page.access_token, ig_id: page.instagram_business_account.id, username: page.instagram_business_account.username || null } }
}

// ── 스레드 ──────────────────────────────────────────────

const TH_POST_FIELDS = 'id,text,username,permalink,timestamp,media_type'

export const threadsKeywordSearch = (t: string, q: string, type: 'TOP' | 'RECENT') =>
  call<{ data: any[] }>(`${TH}/keyword_search?${qs({ q, search_type: type, fields: TH_POST_FIELDS, access_token: t })}`)

export const threadsMyPosts = (t: string) =>
  call<{ data: any[] }>(`${TH}/me/threads?${qs({ fields: 'id,text,permalink,timestamp', limit: '10', access_token: t })}`)

export const threadsReplies = (t: string, mediaId: string) =>
  call<{ data: any[] }>(`${TH}/${encodeURIComponent(mediaId)}/replies?${qs({ fields: `${TH_POST_FIELDS},hide_status`, access_token: t })}`)

export const threadsHideReply = (t: string, replyId: string, hide: boolean) =>
  call(`${TH}/${encodeURIComponent(replyId)}/manage_reply`, form({ hide: hide ? 'true' : 'false', access_token: t }))

/** 답글 게시 — 컨테이너를 만들고, 준비되면 발행한다. */
export async function threadsReply(t: string, userId: string, replyToId: string, text: string): Promise<G<{ id: string }>> {
  const c = await call<{ id: string }>(`${TH}/${encodeURIComponent(userId)}/threads`, form({ media_type: 'TEXT', text, reply_to_id: replyToId, access_token: t }))
  if (!c.ok || !c.data?.id) return { ok: false, error: c.error || '답글 컨테이너를 만들지 못했어요' }
  let last: G<{ id: string }> = { ok: false, error: '발행하지 못했어요' }
  for (let i = 0; i < 4; i++) {
    if (i) await new Promise(r => setTimeout(r, 1500))
    last = await call<{ id: string }>(`${TH}/${encodeURIComponent(userId)}/threads_publish`, form({ creation_id: c.data.id, access_token: t }))
    if (last.ok) return last
  }
  return last
}

// ── 인스타(페이스북 로그인) ──────────────────────────────

const IG_MEDIA_FIELDS = 'id,caption,media_type,permalink,like_count,comments_count,timestamp'

export async function igHashtagMedia(t: string, igId: string, tag: string, edge: 'top_media' | 'recent_media'): Promise<G<{ hashtag_id: string; data: any[] }>> {
  const h = await call<{ data: { id: string }[] }>(`${FB}/ig_hashtag_search?${qs({ user_id: igId, q: tag, access_token: t })}`)
  const id = h.data?.data?.[0]?.id
  if (!h.ok || !id) return { ok: false, error: h.error || '해시태그를 찾지 못했어요' }
  const m = await call<{ data: any[] }>(`${FB}/${id}/${edge}?${qs({ user_id: igId, fields: IG_MEDIA_FIELDS, limit: '24', access_token: t })}`)
  if (!m.ok) return { ok: false, error: m.error }
  return { ok: true, data: { hashtag_id: id, data: m.data?.data || [] } }
}

/** 공개 비즈니스·크리에이터 계정 프로필(인플루언서 확인용). */
export const igBusinessDiscovery = (t: string, igId: string, username: string) =>
  call<any>(`${FB}/${igId}?${qs({ fields: `business_discovery.username(${username}){username,name,biography,followers_count,media_count,website,profile_picture_url}`, access_token: t })}`)

export const igMyMedia = (t: string, igId: string) =>
  call<{ data: any[] }>(`${FB}/${igId}/media?${qs({ fields: 'id,caption,permalink,comments_count,timestamp', limit: '10', access_token: t })}`)

export const igComments = (t: string, mediaId: string) =>
  call<{ data: any[] }>(`${FB}/${encodeURIComponent(mediaId)}/comments?${qs({ fields: 'id,text,username,timestamp', access_token: t })}`)

export const igReplyComment = (t: string, commentId: string, message: string) =>
  call<{ id: string }>(`${FB}/${encodeURIComponent(commentId)}/replies`, form({ message, access_token: t }))

export const igConversations = (pageToken: string, pageId: string) =>
  call<{ data: any[] }>(`${FB}/${pageId}/conversations?${qs({ platform: 'instagram', fields: 'id,updated_time,participants,messages.limit(1){message,from,created_time}', access_token: pageToken })}`)

export const igSendMessage = (pageToken: string, pageId: string, recipientId: string, text: string) =>
  call<{ message_id: string }>(`${FB}/${pageId}/messages?${qs({ access_token: pageToken })}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipient: { id: recipientId }, message: { text } }),
  })
