/**
 * 💬 2026-10-01 인스타 댓글 → 자동 DM 라우트 (유어딜 공식 계정 + 매장 계정).
 *
 * 공개(메타·인스타가 호출)
 *   GET  /api/instagram/webhook          — 웹훅 등록 확인(hub.challenge)
 *   POST /api/instagram/webhook          — 댓글 알림. 서명(X-Hub-Signature-256) 검증 후 계정별로 처리.
 *   GET  /api/instagram/oauth/callback   — "인스타로 연결" 로그인 뒤 돌아오는 자리. state 서명 검증.
 *   POST /api/instagram/oauth/deauthorize — 사용자가 인스타에서 우리 앱 권한을 뺐다(signed_request) → 연결 해제
 *   POST /api/instagram/oauth/data-deletion — 데이터 삭제 요청(signed_request) → 그 계정 규칙·기록 삭제
 *
 * 계정 API (같은 모양 두 벌 — 주인만 다르다)
 *   /api/admin/instagram-autodm/*        — 유어딜 공식 계정('platform'). adminApp 미들웨어 상속.
 *   /api/seller/instagram-dm/*           — 좌석 토큰의 매장('seller:{id}'). 사장님·중개사(운영자) 모두.
 *     GET /status · GET /connect-url · POST /refresh-token · POST /settings · POST /disconnect
 *     GET/POST /rules · PUT/DELETE /rules/:id · GET /sends · GET /media · POST /test-match
 *
 * 어드민 전용: POST /app(앱 ID·시크릿·매장 전체 스위치) · POST /connect(토큰 붙여 넣기) ·
 *             GET /accounts(매장 계정 감독) · POST /accounts/:id/off(매장 계정 강제 끄기)
 *
 * ⚡ 웹훅 경로는 전역 IP 레이트리밋에서 뺐다(worker/index.ts) — 메타 IP 몇 개에서 몰려 온다. 서명이 지킨다.
 * 🔒 게이트: 계정마다 '켜기'(기본 OFF) + 매장 계정은 앱 설정 sellers_enabled(기본 OFF)까지.
 */
import { Hono, type Context } from 'hono'
import type { Env } from '../../../worker/types/env'
import { safeError } from '../../../worker/utils/safe-error'
import { intParam } from '../../../shared/pagination'
import { getSellerIdFromToken } from '../../../lib/seller-shared'
import { isPayoutEligibleSellerStatus } from '../../../shared/seller-status'
import { verifyMetaSignature, pickRule, renderDm, pickPublicReply, isSafeLink, splitKeywords } from './autodm-core'
import {
  getAppConfig, ensureVerifyToken, saveAppConfig, getAccountByOwner, ensureAccountRow, saveConnection, setEnabled,
  disconnect, disconnectByIgUserId, purgeByIgUserId, listRules, countRules, createRule, updateRule, deleteRule, listSends, sendStats, listSellerAccounts,
  PLATFORM_OWNER, SELLER_DAILY_CAP_MAX, MAX_RULES_PER_ACCOUNT, sellerOwnerKey, type RuleInput,
} from './autodm-store'
import { getMe, subscribeComments, listRecentMedia } from './autodm-graph'
import { processWebhookPayload, maybeRefreshToken } from './autodm-service'
import { signState, verifyState, authorizeUrl, exchangeCode, expiresAtFrom, safeReturnPath, parseSignedRequest } from './autodm-oauth'
import { FROM_MY_PARAM, FROM_MY_VALUE } from '../../../lib/seller-return'

type E = { Bindings: Env }
type C = Context<E>

const WEBHOOK_PATH = '/api/instagram/webhook'
const CALLBACK_PATH = '/api/instagram/oauth/callback'

/** 메타 앱에 등록하는 주소는 하나여야 한다 — 구 도메인으로 들어와도 정본(urdeal.kr)을 쓴다. */
export function canonicalOrigin(reqUrl: string): string {
  const u = new URL(reqUrl)
  return /^(localhost|127\.0\.0\.1)$/.test(u.hostname) ? u.origin : 'https://urdeal.kr'
}

// ── 공개: 웹훅 + 로그인 콜백 ─────────────────────────────────────

export const instagramWebhookRoutes = new Hono<E>()

instagramWebhookRoutes.get(WEBHOOK_PATH, async (c) => {
  try {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge') || ''
    const app = await getAppConfig(c.env.DB, c.env.DATA_ENCRYPTION_KEY)
    if (mode === 'subscribe' && app.verify_token && token === app.verify_token && /^[\w-]{1,200}$/.test(challenge)) {
      return c.text(challenge, 200)
    }
    return c.text('forbidden', 403)
  } catch {
    return c.text('forbidden', 403)
  }
})

instagramWebhookRoutes.post(WEBHOOK_PATH, async (c) => {
  const raw = await c.req.text()
  if (raw.length > 256_000) return c.text('too large', 413)
  const app = await getAppConfig(c.env.DB, c.env.DATA_ENCRYPTION_KEY).catch(() => null)
  // 서명을 확인할 수 없으면(앱 시크릿 미등록 포함) 믿지 않는다.
  const valid = await verifyMetaSignature(raw, c.req.header('x-hub-signature-256'), app?.app_secret)
  if (!valid) return c.text('invalid signature', 401)

  let payload: unknown = null
  try { payload = JSON.parse(raw) } catch { return c.text('EVENT_RECEIVED', 200) }

  // 메타는 빨리 200 을 받아야 재전송하지 않는다 — 처리는 응답 뒤로.
  const DB = c.env.DB
  const kek = c.env.DATA_ENCRYPTION_KEY
  const work = (async () => {
    try {
      const r = await processWebhookPayload(DB, kek, payload)
      for (const acc of r.accounts) await maybeRefreshToken(DB, kek, acc).catch(() => null)
    } catch (e) {
      console.error('[ig-autodm] webhook 처리 실패', (e as Error).message)
    }
  })()
  try { c.executionCtx.waitUntil(work) } catch { await work }
  return c.text('EVENT_RECEIVED', 200)
})

instagramWebhookRoutes.get(CALLBACK_PATH, async (c) => {
  const origin = canonicalOrigin(c.req.url)
  let fromMy = false
  const back = (path: string, result: string, reason?: string) => {
    const q = new URLSearchParams({ ig: result })
    if (reason) q.set('reason', reason)
    if (fromMy) q.set(FROM_MY_PARAM, FROM_MY_VALUE)
    return c.redirect(`${origin}${path}?${q.toString()}`, 302)
  }
  try {
    const state = await verifyState(c.env.JWT_SECRET, c.req.query('state'))
    fromMy = !!state?.m
    if (!state) return back('/seller/instagram-dm', 'error', '연결 요청이 만료됐어요. 다시 시도해 주세요')
    if (c.req.query('error')) return back(state.r, 'cancelled')
    const code = c.req.query('code')
    if (!code) return back(state.r, 'error', '인스타에서 승인 코드를 받지 못했어요')

    const DB = c.env.DB
    const kek = c.env.DATA_ENCRYPTION_KEY
    const app = await getAppConfig(DB, kek)
    if (!app.app_id || !app.app_secret) return back(state.r, 'error', '유어딜 쪽 인스타 연동 설정이 아직 없어요')

    const ex = await exchangeCode(app.app_id, app.app_secret, `${origin}${CALLBACK_PATH}`, code)
    if (!ex.ok || !ex.access_token) return back(state.r, 'error', ex.error || '연결하지 못했어요')

    const me = await getMe(ex.access_token)
    const igUserId = me.data?.user_id || me.data?.id || ex.user_id
    if (!igUserId) return back(state.r, 'error', '인스타 계정 정보를 받지 못했어요')

    const saved = await saveConnection(DB, kek, {
      owner_key: state.o, seller_id: state.s, ig_user_id: String(igUserId), username: me.data?.username || null,
      access_token: ex.access_token, token_expires_at: expiresAtFrom(ex.expires_in), connected_by_user_id: state.u,
    })
    if (!saved.ok) return back(state.r, 'error', '이 인스타 계정은 이미 다른 가게에 연결돼 있어요')
    const sub = await subscribeComments(ex.access_token)
    return back(state.r, sub.ok ? 'connected' : 'connected_nosub')
  } catch (err) {
    console.error('[ig-autodm] oauth callback 실패', (err as Error).message)
    return back('/seller/instagram-dm', 'error', '연결 중 오류가 났어요')
  }
})

/** 메타가 form(signed_request=…)으로 보낸다. 서명이 안 맞으면 아무것도 하지 않는다. */
async function readSignedRequest(c: C): Promise<{ user_id?: string } | null> {
  const form = await c.req.parseBody().catch(() => ({} as Record<string, unknown>))
  const app = await getAppConfig(c.env.DB, c.env.DATA_ENCRYPTION_KEY)
  return parseSignedRequest(typeof form.signed_request === 'string' ? form.signed_request : null, app.app_secret)
}

instagramWebhookRoutes.post('/api/instagram/oauth/deauthorize', async (c) => {
  try {
    const req = await readSignedRequest(c)
    if (!req?.user_id) return c.json({ success: false }, 400)
    await disconnectByIgUserId(c.env.DB, req.user_id)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '처리하지 못했습니다', '[ig-autodm]')
  }
})

instagramWebhookRoutes.post('/api/instagram/oauth/data-deletion', async (c) => {
  try {
    const req = await readSignedRequest(c)
    if (!req?.user_id) return c.json({ success: false }, 400)
    await purgeByIgUserId(c.env.DB, req.user_id)
    const code = `ig-${req.user_id.slice(-6)}-${Date.now().toString(36)}`
    // 메타가 요구하는 응답 모양: 상태를 볼 수 있는 주소 + 확인 코드
    return c.json({ url: `${canonicalOrigin(c.req.url)}/privacy`, confirmation_code: code })
  } catch (err) {
    return safeError(c, err, '처리하지 못했습니다', '[ig-autodm]')
  }
})

// ── 계정 API (공용) ──────────────────────────────────────────────

interface Owner {
  ownerKey: string
  sellerId: number | null
  capMax: number
  /** 켤 수 없는 이유(없으면 켤 수 있다) */
  enableBlock?: string
}

type Resolve = (c: C) => Promise<Owner | Response>

function parseRule(body: Record<string, unknown>): { ok: true; rule: RuleInput } | { ok: false; error: string } {
  const s = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
  const keywords = s(body.keywords, 300)
  const dmText = s(body.dm_text, 900)
  const link = s(body.link_url, 500) || null
  const mediaId = s(body.media_id, 40) || null
  const mode = body.match_mode === 'exact' ? 'exact' : 'contains'
  if (!splitKeywords(keywords).length) return { ok: false, error: '키워드를 하나 이상 입력해 주세요' }
  if (!dmText) return { ok: false, error: 'DM 내용을 입력해 주세요' }
  if (!isSafeLink(link)) return { ok: false, error: '링크는 http(s) 주소만 넣을 수 있습니다' }
  if (mediaId && !/^\d{1,40}$/.test(mediaId)) return { ok: false, error: '게시물 ID 형식이 올바르지 않습니다' }
  return {
    ok: true,
    rule: {
      name: s(body.name, 60) || null,
      keywords, match_mode: mode, media_id: mediaId, dm_text: dmText, link_url: link,
      public_reply: s(body.public_reply, 1000) || null,
      is_active: body.is_active !== false,
    },
  }
}

function accountRoutes(resolve: Resolve, returnPath: string) {
  const r = new Hono<E>()
  const withOwner = (fn: (c: C, o: Owner) => Promise<Response>, failMsg: string) => async (c: C) => {
    try {
      const o = await resolve(c)
      if (o instanceof Response) return o
      return await fn(c, o)
    } catch (err) {
      return safeError(c, err, failMsg, '[ig-autodm]')
    }
  }
  const accountId = (c: C, o: Owner) => ensureAccountRow(c.env.DB, o.ownerKey, o.sellerId)

  r.get('/status', withOwner(async (c, o) => {
    const DB = c.env.DB
    const kek = c.env.DATA_ENCRYPTION_KEY
    const id = await accountId(c, o)
    let account = await getAccountByOwner(DB, kek, o.ownerKey)
    let refreshNote: string | null = null
    if (account?.access_token) {
      const rr = await maybeRefreshToken(DB, kek, account)
      if (rr.refreshed) account = await getAccountByOwner(DB, kek, o.ownerKey)
      else if (rr.error && rr.error !== '토큰 없음') refreshNote = rr.error
    }
    const app = await getAppConfig(DB, kek)
    const rules = await listRules(DB, id)
    return c.json({
      success: true,
      data: {
        available: !!(app.app_id && app.app_secret),
        sellers_enabled: o.ownerKey === PLATFORM_OWNER ? true : app.sellers_enabled,
        enable_block: o.enableBlock || null,
        connected: !!(account?.access_token && account.ig_user_id),
        username: account?.username || null,
        enabled: !!account?.enabled,
        daily_cap: account?.daily_cap ?? 200,
        cap_max: o.capMax,
        token_expires_at: account?.token_expires_at || null,
        token_refresh_error: refreshNote,
        active_rules: rules.filter(x => x.is_active).length,
        stats: await sendStats(DB, id),
      },
    })
  }, '자동 DM 상태를 불러오지 못했습니다'))

  r.get('/connect-url', withOwner(async (c, o) => {
    const app = await getAppConfig(c.env.DB, c.env.DATA_ENCRYPTION_KEY)
    if (!app.app_id || !app.app_secret) return c.json({ success: false, error: '인스타 연동이 아직 준비되지 않았어요' }, 400)
    const ret = safeReturnPath(c.req.query('return') || returnPath)
    const state = await signState(c.env.JWT_SECRET, { o: o.ownerKey, s: o.sellerId, u: null, r: ret, m: c.req.query('from') === FROM_MY_VALUE })
    return c.json({ success: true, data: { url: authorizeUrl(app.app_id, `${canonicalOrigin(c.req.url)}${CALLBACK_PATH}`, state) } })
  }, '연결 주소를 만들지 못했습니다'))

  r.post('/refresh-token', withOwner(async (c, o) => {
    const account = await getAccountByOwner(c.env.DB, c.env.DATA_ENCRYPTION_KEY, o.ownerKey)
    if (!account?.access_token) return c.json({ success: false, error: '연결된 계정이 없습니다' }, 400)
    const rr = await maybeRefreshToken(c.env.DB, c.env.DATA_ENCRYPTION_KEY, account, true)
    if (!rr.refreshed) return c.json({ success: false, error: rr.error || '갱신하지 못했습니다' }, 400)
    return c.json({ success: true })
  }, '토큰 갱신에 실패했습니다'))

  r.post('/settings', withOwner(async (c, o) => {
    const body = await c.req.json().catch(() => ({})) as { enabled?: unknown; daily_cap?: unknown }
    const enabled = body.enabled === true
    const id = await accountId(c, o)
    const account = await getAccountByOwner(c.env.DB, c.env.DATA_ENCRYPTION_KEY, o.ownerKey)
    if (enabled) {
      if (!account?.access_token || !account.ig_user_id) return c.json({ success: false, error: '먼저 인스타 계정을 연결해 주세요' }, 400)
      if (o.enableBlock) return c.json({ success: false, error: o.enableBlock }, 400)
      const app = await getAppConfig(c.env.DB, c.env.DATA_ENCRYPTION_KEY)
      if (!app.app_secret) return c.json({ success: false, error: '앱 시크릿이 없으면 웹훅 서명을 확인할 수 없어 켤 수 없습니다' }, 400)
    }
    const cap = body.daily_cap === undefined ? undefined : intParam(body.daily_cap, 200)
    await setEnabled(c.env.DB, id, enabled, cap, o.capMax)
    return c.json({ success: true })
  }, '설정을 저장하지 못했습니다'))

  r.post('/disconnect', withOwner(async (c, o) => {
    await disconnect(c.env.DB, await accountId(c, o))
    return c.json({ success: true })
  }, '연결을 해제하지 못했습니다'))

  r.get('/rules', withOwner(async (c, o) => c.json({ success: true, data: await listRules(c.env.DB, await accountId(c, o)) }), '규칙을 불러오지 못했습니다'))

  r.post('/rules', withOwner(async (c, o) => {
    const p = parseRule(await c.req.json().catch(() => ({})))
    if (!p.ok) return c.json({ success: false, error: p.error }, 400)
    const id = await accountId(c, o)
    if (await countRules(c.env.DB, id) >= MAX_RULES_PER_ACCOUNT) {
      return c.json({ success: false, error: `규칙은 ${MAX_RULES_PER_ACCOUNT}개까지 만들 수 있어요` }, 400)
    }
    return c.json({ success: true, data: { id: await createRule(c.env.DB, id, p.rule) } })
  }, '규칙을 저장하지 못했습니다'))

  r.put('/rules/:id', withOwner(async (c, o) => {
    const ruleId = intParam(c.req.param('id'), 0)
    if (ruleId <= 0) return c.json({ success: false, error: '잘못된 규칙입니다' }, 400)
    const p = parseRule(await c.req.json().catch(() => ({})))
    if (!p.ok) return c.json({ success: false, error: p.error }, 400)
    const ok = await updateRule(c.env.DB, await accountId(c, o), ruleId, p.rule)
    if (!ok) return c.json({ success: false, error: '규칙을 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  }, '규칙을 저장하지 못했습니다'))

  r.delete('/rules/:id', withOwner(async (c, o) => {
    const ruleId = intParam(c.req.param('id'), 0)
    if (ruleId <= 0) return c.json({ success: false, error: '잘못된 규칙입니다' }, 400)
    const ok = await deleteRule(c.env.DB, await accountId(c, o), ruleId)
    if (!ok) return c.json({ success: false, error: '규칙을 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  }, '규칙을 삭제하지 못했습니다'))

  r.get('/sends', withOwner(async (c, o) => {
    const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 100)))
    return c.json({ success: true, data: await listSends(c.env.DB, await accountId(c, o), limit) })
  }, '발송 기록을 불러오지 못했습니다'))

  r.get('/media', withOwner(async (c, o) => {
    const account = await getAccountByOwner(c.env.DB, c.env.DATA_ENCRYPTION_KEY, o.ownerKey)
    if (!account?.access_token) return c.json({ success: false, error: '연결된 계정이 없습니다' }, 400)
    const m = await listRecentMedia(account.access_token, 18)
    if (!m.ok) return c.json({ success: false, error: `게시물을 불러오지 못했습니다: ${m.error}` }, 502)
    return c.json({ success: true, data: m.data?.data || [] })
  }, '게시물을 불러오지 못했습니다'))

  /** 실제로 보내지 않고 "이 댓글이면 어떤 DM 이 나가나"만 보여 준다. */
  r.post('/test-match', withOwner(async (c, o) => {
    const body = await c.req.json().catch(() => ({})) as { text?: unknown; media_id?: unknown; username?: unknown }
    const text = typeof body.text === 'string' ? body.text.slice(0, 500) : ''
    const mediaId = typeof body.media_id === 'string' && body.media_id ? body.media_id : null
    const username = typeof body.username === 'string' && body.username ? body.username.slice(0, 60) : 'urdeal_tester'
    const rule = pickRule(await listRules(c.env.DB, await accountId(c, o), true), { text, mediaId })
    if (!rule) return c.json({ success: true, data: { matched: false } })
    return c.json({
      success: true,
      data: { matched: true, rule_id: rule.id, dm: renderDm(rule, username), public_reply: pickPublicReply(rule.public_reply, username) },
    })
  }, '테스트에 실패했습니다'))

  return r
}

// ── 어드민: 유어딜 공식 계정 + 앱 설정 + 매장 감독 ─────────────────

export const instagramAutoDmAdminRoutes = new Hono<E>()

instagramAutoDmAdminRoutes.get('/app', async (c) => {
  try {
    const DB = c.env.DB
    const kek = c.env.DATA_ENCRYPTION_KEY
    const verifyToken = await ensureVerifyToken(DB)
    const app = await getAppConfig(DB, kek)
    const origin = canonicalOrigin(c.req.url)
    return c.json({
      success: true,
      data: {
        app_id: app.app_id,
        has_app_secret: !!app.app_secret,
        sellers_enabled: app.sellers_enabled,
        verify_token: verifyToken,
        webhook_url: `${origin}${WEBHOOK_PATH}`,
        redirect_uri: `${origin}${CALLBACK_PATH}`,
        deauthorize_url: `${origin}/api/instagram/oauth/deauthorize`,
        data_deletion_url: `${origin}/api/instagram/oauth/data-deletion`,
        encryption_key_set: !!(kek && kek.length >= 16),
      },
    })
  } catch (err) {
    return safeError(c, err, '앱 설정을 불러오지 못했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.post('/app', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as { app_id?: unknown; app_secret?: unknown; sellers_enabled?: unknown }
    const appId = typeof body.app_id === 'string' ? body.app_id.trim() : ''
    const secret = typeof body.app_secret === 'string' ? body.app_secret.trim() : ''
    if (appId && !/^\d{5,25}$/.test(appId)) return c.json({ success: false, error: '앱 ID 는 숫자입니다' }, 400)
    if (secret && !/^[0-9a-f]{32}$/i.test(secret)) return c.json({ success: false, error: '앱 시크릿은 32자리 영문·숫자입니다' }, 400)
    await saveAppConfig(c.env.DB, c.env.DATA_ENCRYPTION_KEY, {
      app_id: appId || undefined,
      app_secret: secret || undefined,
      sellers_enabled: typeof body.sellers_enabled === 'boolean' ? body.sellers_enabled : undefined,
    })
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '앱 설정을 저장하지 못했습니다', '[ig-autodm]')
  }
})

/** 공식 계정만: 메타 화면에서 만든 토큰을 붙여 넣어 연결(로그인 연결의 대안). */
instagramAutoDmAdminRoutes.post('/connect', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as { access_token?: unknown }
    const token = typeof body.access_token === 'string' ? body.access_token.trim() : ''
    if (!token || token.length > 1000) return c.json({ success: false, error: '액세스 토큰을 입력해 주세요' }, 400)
    const me = await getMe(token)
    const igUserId = me.data?.user_id || me.data?.id
    if (!me.ok || !igUserId) return c.json({ success: false, error: `토큰 확인 실패: ${me.error || '계정 ID 를 받지 못했습니다'}` }, 400)
    const saved = await saveConnection(c.env.DB, c.env.DATA_ENCRYPTION_KEY, {
      owner_key: PLATFORM_OWNER, seller_id: null, ig_user_id: String(igUserId), username: me.data?.username || null,
      access_token: token, token_expires_at: expiresAtFrom(60 * 86_400),
    })
    if (!saved.ok) return c.json({ success: false, error: '이 인스타 계정은 이미 다른 가게에 연결돼 있습니다' }, 409)
    const sub = await subscribeComments(token)
    return c.json({ success: true, data: { username: me.data?.username || null, subscribed: sub.ok, subscribe_error: sub.ok ? null : sub.error } })
  } catch (err) {
    return safeError(c, err, '계정 연결에 실패했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.get('/accounts', async (c) => {
  try {
    return c.json({ success: true, data: await listSellerAccounts(c.env.DB) })
  } catch (err) {
    return safeError(c, err, '매장 계정을 불러오지 못했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.post('/accounts/:id/off', async (c) => {
  try {
    const id = intParam(c.req.param('id'), 0)
    if (id <= 0) return c.json({ success: false, error: '잘못된 계정입니다' }, 400)
    await setEnabled(c.env.DB, id, false)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '끄지 못했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.route('/', accountRoutes(async () => ({ ownerKey: PLATFORM_OWNER, sellerId: null, capMax: 5000 }), '/admin/instagram-autodm'))

// ── 매장: 좌석 토큰의 가게(사장님·중개사) ──────────────────────────

export const instagramAutoDmSellerRoutes = new Hono<E>()

instagramAutoDmSellerRoutes.route('/', accountRoutes(async (c) => {
  const sellerId = await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '가게 로그인이 필요합니다' }, 401)
  const row = await c.env.DB.prepare(`SELECT status FROM sellers WHERE id = ?`).bind(sellerId).first<{ status: string | null }>()
  if (!row) return c.json({ success: false, error: '가게를 찾을 수 없습니다' }, 404)
  return {
    ownerKey: sellerOwnerKey(sellerId),
    sellerId,
    capMax: SELLER_DAILY_CAP_MAX,
    enableBlock: isPayoutEligibleSellerStatus(row.status) ? undefined : '가게 승인이 끝난 뒤에 켤 수 있어요',
  }
}, '/seller/instagram-dm'))
