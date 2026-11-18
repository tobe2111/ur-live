/**
 * 🎬 2026-11-18 메타 앱 검수 시연 화면의 API.
 *
 *   공개: GET /api/meta-review/oauth/:provider/callback  — 메타 로그인에서 돌아오는 곳(서명된 state 필수)
 *   어드민: /api/admin/meta-review/*                     — 상태·앱 설정·검색·답글·DM
 *
 * 🔒 바깥으로 나가는 행동(답글·댓글 답글·DM)은 전부 사람이 화면에서 누를 때만 나가고,
 *    본문에 approved:true 가 없으면 거절한다(자동 발송 경로 없음 — 프로젝트 규칙: DM 은 승인 후).
 */
import { Hono, type Context } from 'hono'
import type { Env } from '../../../worker/types/env'
import { safeError } from '../../../worker/utils/safe-error'
import { getConn, saveApp, saveToken, clearToken, isProvider, type MetaProvider } from './meta-review-store'
import * as g from './meta-review-graph'

type E = { Bindings: Env }
type C = Context<E>

export const callbackPath = (p: MetaProvider) => `/api/meta-review/oauth/${p}/callback`
const PAGE = '/admin/meta-review'

function origin(reqUrl: string): string {
  const u = new URL(reqUrl)
  return /^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? u.origin : 'https://urdeal.kr'
}

// ── state 서명(10분) ──
const enc = new TextEncoder()
const b64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
async function hmac(secret: string, data: string) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return b64(new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(data))))
}
export async function signState(secret: string, p: MetaProvider, now = Date.now()) {
  const body = `${p}.${now + 600_000}.${b64(crypto.getRandomValues(new Uint8Array(9)))}`
  return `${body}.${await hmac(secret, body)}`
}
export async function verifyState(secret: string, p: MetaProvider, token: string | undefined, now = Date.now()) {
  if (!secret || !token) return false
  const parts = token.split('.')
  if (parts.length !== 4 || parts[0] !== p || Number(parts[1]) < now) return false
  const sig = await hmac(secret, parts.slice(0, 3).join('.'))
  if (sig.length !== parts[3].length) return false
  let d = 0
  for (let i = 0; i < sig.length; i++) d |= sig.charCodeAt(i) ^ parts[3].charCodeAt(i)
  return d === 0
}

const expiresAt = (s?: number) => (s ? new Date(Date.now() + s * 1000).toISOString().slice(0, 19).replace('T', ' ') : null)

// ── 공개: 로그인 콜백 ─────────────────────────────────────

export const metaReviewPublicRoutes = new Hono<E>()

metaReviewPublicRoutes.get('/api/meta-review/oauth/:provider/callback', async (c) => {
  const o = origin(c.req.url)
  const p = c.req.param('provider')
  const back = (result: string, reason?: string) => {
    const q = new URLSearchParams({ meta: result, p: String(p) })
    if (reason) q.set('reason', reason)
    return c.redirect(`${o}${PAGE}?${q.toString()}`, 302)
  }
  if (!isProvider(p)) return back('error', '알 수 없는 로그인')
  try {
    if (!(await verifyState(c.env.JWT_SECRET, p, c.req.query('state')))) return back('error', '로그인 요청이 만료됐어요. 다시 눌러 주세요')
    if (c.req.query('error')) return back('cancelled')
    const code = c.req.query('code')
    if (!code) return back('error', '승인 코드를 받지 못했어요')
    const DB = c.env.DB, kek = c.env.DATA_ENCRYPTION_KEY
    const conn = await getConn(DB, kek, p)
    if (!conn.app_id || !conn.app_secret) return back('error', '앱 ID·시크릿을 먼저 저장해 주세요')
    const ex = await g.exchange(p, conn.app_id, conn.app_secret, `${o}${callbackPath(p)}`, code)
    if (!ex.ok || !ex.data) return back('error', ex.error)
    if (p === 'threads') {
      const me = await g.threadsMe(ex.data.access_token)
      await saveToken(DB, kek, p, {
        access_token: ex.data.access_token, account_id: me.data?.id || ex.data.user_id || null,
        username: me.data?.username || null, expires_at: expiresAt(ex.data.expires_in),
      })
    } else {
      const ig = await g.findIgAccount(ex.data.access_token)
      if (!ig.ok || !ig.data) return back('error', ig.error)
      await saveToken(DB, kek, p, {
        access_token: ex.data.access_token, account_id: ig.data.ig_id, username: ig.data.username,
        page_id: ig.data.page_id, page_token: ig.data.page_token, expires_at: expiresAt(ex.data.expires_in),
      })
    }
    return back('connected')
  } catch (err) {
    console.error('[meta-review] callback 실패', (err as Error).message)
    return back('error', '연결 중 오류가 났어요')
  }
})

// ── 어드민 ─────────────────────────────────────────────

export const metaReviewAdminRoutes = new Hono<E>()

const ID = /^[\w.-]{1,80}$/
const USERNAME = /^[A-Za-z0-9._]{1,30}$/
const TAG = /^[\p{L}\p{N}_]{1,60}$/u
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim() : '').slice(0, max)
const fail = (c: C, msg: string, status: 400 | 409 | 502 = 400) => c.json({ success: false, error: msg }, status)
const out = (c: C, r: g.G) => (r.ok ? c.json({ success: true, data: r.data }) : fail(c, r.error || '메타 API 오류', 502))

async function need(c: C, p: MetaProvider) {
  const conn = await getConn(c.env.DB, c.env.DATA_ENCRYPTION_KEY, p)
  return conn.access_token && conn.account_id ? conn : null
}
const notConnected = (c: C, p: MetaProvider) => fail(c, p === 'threads' ? '스레드 로그인을 먼저 해 주세요' : '페이스북 로그인을 먼저 해 주세요', 409)

metaReviewAdminRoutes.get('/status', async (c) => {
  try {
    const o = origin(c.req.url)
    const data: Record<string, unknown> = {}
    for (const p of ['threads', 'facebook'] as const) {
      const conn = await getConn(c.env.DB, c.env.DATA_ENCRYPTION_KEY, p)
      data[p] = {
        app_id: conn.app_id, app_secret_set: !!conn.app_secret, connected: !!conn.access_token,
        username: conn.username, account_id: conn.account_id, expires_at: conn.expires_at,
        redirect_uri: `${o}${callbackPath(p)}`, scopes: p === 'threads' ? g.THREADS_SCOPES : g.FB_SCOPES,
      }
    }
    return c.json({ success: true, data })
  } catch (err) { return safeError(c, err, '상태를 불러오지 못했습니다', '[meta-review]') }
})

metaReviewAdminRoutes.put('/app/:provider', async (c) => {
  const p = c.req.param('provider')
  if (!isProvider(p)) return fail(c, '알 수 없는 로그인')
  try {
    const b = await c.req.json<{ app_id?: string; app_secret?: string }>().catch(() => ({} as any))
    const appId = text(b.app_id, 40)
    if (!/^\d{5,30}$/.test(appId)) return fail(c, '앱 ID 는 숫자예요')
    const secret = text(b.app_secret, 100)
    if (secret && !/^[A-Za-z0-9]{16,100}$/.test(secret)) return fail(c, '앱 시크릿 형식이 아니에요')
    await saveApp(c.env.DB, c.env.DATA_ENCRYPTION_KEY, p, appId, secret || undefined)
    return c.json({ success: true })
  } catch (err) { return safeError(c, err, '저장하지 못했습니다', '[meta-review]') }
})

metaReviewAdminRoutes.get('/connect/:provider', async (c) => {
  const p = c.req.param('provider')
  if (!isProvider(p)) return fail(c, '알 수 없는 로그인')
  try {
    const conn = await getConn(c.env.DB, c.env.DATA_ENCRYPTION_KEY, p)
    if (!conn.app_id || !conn.app_secret) return fail(c, '앱 ID·시크릿을 먼저 저장해 주세요', 409)
    const url = g.authorizeUrl(p, conn.app_id, `${origin(c.req.url)}${callbackPath(p)}`, await signState(c.env.JWT_SECRET, p))
    return c.json({ success: true, data: { url } })
  } catch (err) { return safeError(c, err, '로그인 주소를 만들지 못했습니다', '[meta-review]') }
})

metaReviewAdminRoutes.post('/disconnect/:provider', async (c) => {
  const p = c.req.param('provider')
  if (!isProvider(p)) return fail(c, '알 수 없는 로그인')
  try { await clearToken(c.env.DB, p); return c.json({ success: true }) } catch (err) { return safeError(c, err, '해제하지 못했습니다', '[meta-review]') }
})

// 스레드
metaReviewAdminRoutes.get('/threads/search', async (c) => {
  const conn = await need(c, 'threads'); if (!conn) return notConnected(c, 'threads')
  const q = text(c.req.query('q'), 100)
  if (!q) return fail(c, '검색어를 넣어 주세요')
  return out(c, await g.threadsKeywordSearch(conn.access_token, q, c.req.query('type') === 'RECENT' ? 'RECENT' : 'TOP'))
})
metaReviewAdminRoutes.get('/threads/mine', async (c) => {
  const conn = await need(c, 'threads'); if (!conn) return notConnected(c, 'threads')
  return out(c, await g.threadsMyPosts(conn.access_token))
})
metaReviewAdminRoutes.get('/threads/replies/:id', async (c) => {
  const conn = await need(c, 'threads'); if (!conn) return notConnected(c, 'threads')
  const id = c.req.param('id'); if (!ID.test(id)) return fail(c, '잘못된 글 id')
  return out(c, await g.threadsReplies(conn.access_token, id))
})
metaReviewAdminRoutes.post('/threads/reply', async (c) => {
  const conn = await need(c, 'threads'); if (!conn) return notConnected(c, 'threads')
  const b = await c.req.json<any>().catch(() => ({}))
  const id = text(b.reply_to_id, 80), body = text(b.text, 500)
  if (b.approved !== true) return fail(c, '사람이 확인(승인)해야 보낼 수 있어요')
  if (!ID.test(id) || !body) return fail(c, '답글 대상과 내용을 확인해 주세요')
  return out(c, await g.threadsReply(conn.access_token, conn.account_id!, id, body))
})
metaReviewAdminRoutes.post('/threads/hide', async (c) => {
  const conn = await need(c, 'threads'); if (!conn) return notConnected(c, 'threads')
  const b = await c.req.json<any>().catch(() => ({}))
  const id = text(b.reply_id, 80); if (!ID.test(id)) return fail(c, '잘못된 답글 id')
  return out(c, await g.threadsHideReply(conn.access_token, id, b.hide !== false))
})

// 인스타(페이스북 로그인)
metaReviewAdminRoutes.get('/ig/hashtag', async (c) => {
  const conn = await need(c, 'facebook'); if (!conn) return notConnected(c, 'facebook')
  const tag = text(c.req.query('q'), 60).replace(/^#/, '')
  if (!TAG.test(tag)) return fail(c, '해시태그는 # 없이 한 단어로 넣어 주세요')
  return out(c, await g.igHashtagMedia(conn.access_token, conn.account_id!, tag, c.req.query('edge') === 'recent' ? 'recent_media' : 'top_media'))
})
metaReviewAdminRoutes.get('/ig/profile', async (c) => {
  const conn = await need(c, 'facebook'); if (!conn) return notConnected(c, 'facebook')
  const u = text(c.req.query('username'), 30).replace(/^@/, '')
  if (!USERNAME.test(u)) return fail(c, '인스타 아이디 형식이 아니에요')
  return out(c, await g.igBusinessDiscovery(conn.access_token, conn.account_id!, u))
})
metaReviewAdminRoutes.get('/ig/media', async (c) => {
  const conn = await need(c, 'facebook'); if (!conn) return notConnected(c, 'facebook')
  return out(c, await g.igMyMedia(conn.access_token, conn.account_id!))
})
metaReviewAdminRoutes.get('/ig/comments/:id', async (c) => {
  const conn = await need(c, 'facebook'); if (!conn) return notConnected(c, 'facebook')
  const id = c.req.param('id'); if (!ID.test(id)) return fail(c, '잘못된 게시물 id')
  return out(c, await g.igComments(conn.access_token, id))
})
metaReviewAdminRoutes.post('/ig/comment-reply', async (c) => {
  const conn = await need(c, 'facebook'); if (!conn) return notConnected(c, 'facebook')
  const b = await c.req.json<any>().catch(() => ({}))
  const id = text(b.comment_id, 80), body = text(b.text, 1000)
  if (b.approved !== true) return fail(c, '사람이 확인(승인)해야 보낼 수 있어요')
  if (!ID.test(id) || !body) return fail(c, '댓글과 내용을 확인해 주세요')
  return out(c, await g.igReplyComment(conn.access_token, id, body))
})
metaReviewAdminRoutes.get('/ig/conversations', async (c) => {
  const conn = await need(c, 'facebook'); if (!conn || !conn.page_id || !conn.page_token) return notConnected(c, 'facebook')
  return out(c, await g.igConversations(conn.page_token, conn.page_id))
})
metaReviewAdminRoutes.post('/ig/message', async (c) => {
  const conn = await need(c, 'facebook'); if (!conn || !conn.page_id || !conn.page_token) return notConnected(c, 'facebook')
  const b = await c.req.json<any>().catch(() => ({}))
  const id = text(b.recipient_id, 80), body = text(b.text, 1000)
  if (b.approved !== true) return fail(c, '사람이 확인(승인)해야 보낼 수 있어요')
  if (!ID.test(id) || !body) return fail(c, '받는 사람과 내용을 확인해 주세요')
  return out(c, await g.igSendMessage(conn.page_token, conn.page_id, id, body))
})
