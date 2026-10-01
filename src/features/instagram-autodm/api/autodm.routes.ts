/**
 * 💬 2026-10-01 인스타 댓글 → 자동 DM 라우트 (유어딜 자체 홍보 계정).
 *
 * 공개(메타가 호출)
 *   GET  /api/instagram/webhook   — 웹훅 등록 확인(hub.challenge 되돌려 주기)
 *   POST /api/instagram/webhook   — 댓글 알림 수신. 서명(X-Hub-Signature-256) 검증 후 처리.
 *
 * 어드민 (adminApp 아래 /api/admin/instagram-autodm — requireAdmin·IP 화이트리스트·감사로그 상속)
 *   GET  /status · POST /connect · POST /refresh-token · POST /settings · POST /disconnect
 *   GET/POST /rules · PUT/DELETE /rules/:id · GET /sends · GET /media · POST /test-match
 *
 * ⚡ 웹훅 경로는 전역 IP 레이트리밋에서 뺐다(worker/index.ts) — 요청이 메타 IP 몇 개에서 몰려 온다.
 *    대신 서명 검증이 지킨다.
 *
 * 🔒 게이트: 어드민 '자동 DM 켜기' — 기본 OFF. 켜기 전엔 웹훅이 와도 DM 0통.
 */
import { Hono } from 'hono'
import type { Env } from '../../../worker/types/env'
import { safeError } from '../../../worker/utils/safe-error'
import { intParam } from '../../../shared/pagination'
import { verifyMetaSignature, pickRule, renderDm, pickPublicReply, isSafeLink, splitKeywords } from './autodm-core'
import {
  getAccount, ensureVerifyToken, saveConnection, setEnabled, disconnect,
  listRules, createRule, updateRule, deleteRule, listSends, sendStats, type RuleInput,
} from './autodm-store'
import { getMe, subscribeComments, listRecentMedia } from './autodm-graph'
import { processWebhookPayload, maybeRefreshToken } from './autodm-service'

type E = { Bindings: Env }

const WEBHOOK_PATH = '/api/instagram/webhook'

// ── 공개 웹훅 ────────────────────────────────────────────────────

export const instagramWebhookRoutes = new Hono<E>()

instagramWebhookRoutes.get(WEBHOOK_PATH, async (c) => {
  try {
    const mode = c.req.query('hub.mode')
    const token = c.req.query('hub.verify_token')
    const challenge = c.req.query('hub.challenge') || ''
    const account = await getAccount(c.env.DB, c.env.DATA_ENCRYPTION_KEY)
    if (mode === 'subscribe' && account?.verify_token && token === account.verify_token && /^[\w-]{1,200}$/.test(challenge)) {
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
  const account = await getAccount(c.env.DB, c.env.DATA_ENCRYPTION_KEY).catch(() => null)
  // 서명을 확인할 수 없으면(앱 시크릿 미등록 포함) 믿지 않는다.
  const valid = await verifyMetaSignature(raw, c.req.header('x-hub-signature-256'), account?.app_secret)
  if (!valid) return c.text('invalid signature', 401)

  let payload: unknown = null
  try { payload = JSON.parse(raw) } catch { return c.text('EVENT_RECEIVED', 200) }

  // 메타는 빨리 200 을 받아야 재전송하지 않는다 — 처리는 응답 뒤로.
  const DB = c.env.DB
  const kek = c.env.DATA_ENCRYPTION_KEY
  const work = (async () => {
    try {
      await processWebhookPayload(DB, kek, payload)
      if (account?.enabled) await maybeRefreshToken(DB, kek, account)
    } catch (e) {
      console.error('[ig-autodm] webhook 처리 실패', (e as Error).message)
    }
  })()
  try { c.executionCtx.waitUntil(work) } catch { await work }
  return c.text('EVENT_RECEIVED', 200)
})

// ── 어드민 ────────────────────────────────────────────────────────

export const instagramAutoDmAdminRoutes = new Hono<E>()

function webhookUrl(c: { req: { url: string } }): string {
  return `${new URL(c.req.url).origin}${WEBHOOK_PATH}`
}

instagramAutoDmAdminRoutes.get('/status', async (c) => {
  try {
    const DB = c.env.DB
    const kek = c.env.DATA_ENCRYPTION_KEY
    const verifyToken = await ensureVerifyToken(DB)
    let account = await getAccount(DB, kek)
    let refreshNote: string | undefined
    if (account?.access_token) {
      const r = await maybeRefreshToken(DB, kek, account)
      if (r.refreshed) account = await getAccount(DB, kek)
      else if (r.error && r.error !== '토큰 없음') refreshNote = r.error
    }
    const rules = await listRules(DB)
    return c.json({
      success: true,
      data: {
        connected: !!(account?.access_token && account.ig_user_id),
        username: account?.username || null,
        ig_user_id: account?.ig_user_id || null,
        has_app_secret: !!account?.app_secret,
        enabled: !!account?.enabled,
        daily_cap: account?.daily_cap ?? 500,
        token_expires_at: account?.token_expires_at || null,
        token_refreshed_at: account?.token_refreshed_at || null,
        token_refresh_error: refreshNote || null,
        encryption_key_set: !!(kek && kek.length >= 16),
        verify_token: verifyToken,
        webhook_url: webhookUrl(c),
        active_rules: rules.filter(r => r.is_active).length,
        stats: await sendStats(DB),
      },
    })
  } catch (err) {
    return safeError(c, err, '자동 DM 상태를 불러오지 못했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.post('/connect', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as { access_token?: unknown; app_secret?: unknown }
    const token = typeof body.access_token === 'string' ? body.access_token.trim() : ''
    const secret = typeof body.app_secret === 'string' ? body.app_secret.trim() : ''
    const existing = await getAccount(c.env.DB, c.env.DATA_ENCRYPTION_KEY)
    const useToken = token || existing?.access_token || ''
    if (!useToken) return c.json({ success: false, error: '액세스 토큰을 입력해 주세요' }, 400)
    if (token && token.length > 1000) return c.json({ success: false, error: '토큰 형식이 올바르지 않습니다' }, 400)
    if (secret && !/^[0-9a-f]{32}$/i.test(secret)) return c.json({ success: false, error: '앱 시크릿은 32자리 영문·숫자입니다' }, 400)

    const me = await getMe(useToken)
    const igUserId = me.data?.user_id || me.data?.id
    if (!me.ok || !igUserId) return c.json({ success: false, error: `토큰 확인 실패: ${me.error || '계정 ID 를 받지 못했습니다'}` }, 400)

    await saveConnection(c.env.DB, c.env.DATA_ENCRYPTION_KEY, {
      ig_user_id: String(igUserId),
      username: me.data?.username || null,
      access_token: token || undefined,
      app_secret: secret || undefined,
      // 새로 넣은 장기 토큰은 60일. 정확한 만료는 다음 갱신 응답이 알려 준다.
      token_expires_at: token ? new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 19).replace('T', ' ') : null,
    })
    const sub = await subscribeComments(useToken)
    return c.json({
      success: true,
      data: { username: me.data?.username || null, ig_user_id: String(igUserId), subscribed: sub.ok, subscribe_error: sub.ok ? null : sub.error },
    })
  } catch (err) {
    return safeError(c, err, '계정 연결에 실패했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.post('/refresh-token', async (c) => {
  try {
    const account = await getAccount(c.env.DB, c.env.DATA_ENCRYPTION_KEY)
    if (!account?.access_token) return c.json({ success: false, error: '연결된 계정이 없습니다' }, 400)
    const r = await maybeRefreshToken(c.env.DB, c.env.DATA_ENCRYPTION_KEY, account, true)
    if (!r.refreshed) return c.json({ success: false, error: r.error || '갱신하지 못했습니다' }, 400)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '토큰 갱신에 실패했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.post('/settings', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as { enabled?: unknown; daily_cap?: unknown }
    const enabled = body.enabled === true
    const account = await getAccount(c.env.DB, c.env.DATA_ENCRYPTION_KEY)
    if (enabled) {
      if (!account?.access_token || !account.ig_user_id) return c.json({ success: false, error: '먼저 인스타 계정을 연결해 주세요' }, 400)
      if (!account.app_secret) return c.json({ success: false, error: '앱 시크릿이 없으면 웹훅 서명을 확인할 수 없어 켤 수 없습니다' }, 400)
    }
    const cap = body.daily_cap === undefined ? undefined : intParam(body.daily_cap, 500)
    await setEnabled(c.env.DB, enabled, cap)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '설정을 저장하지 못했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.post('/disconnect', async (c) => {
  try {
    await disconnect(c.env.DB)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '연결을 해제하지 못했습니다', '[ig-autodm]')
  }
})

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

instagramAutoDmAdminRoutes.get('/rules', async (c) => {
  try {
    return c.json({ success: true, data: await listRules(c.env.DB) })
  } catch (err) {
    return safeError(c, err, '규칙을 불러오지 못했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.post('/rules', async (c) => {
  try {
    const p = parseRule(await c.req.json().catch(() => ({})))
    if (!p.ok) return c.json({ success: false, error: p.error }, 400)
    const id = await createRule(c.env.DB, p.rule)
    return c.json({ success: true, data: { id } })
  } catch (err) {
    return safeError(c, err, '규칙을 저장하지 못했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.put('/rules/:id', async (c) => {
  try {
    const id = intParam(c.req.param('id'), 0)
    if (id <= 0) return c.json({ success: false, error: '잘못된 규칙입니다' }, 400)
    const p = parseRule(await c.req.json().catch(() => ({})))
    if (!p.ok) return c.json({ success: false, error: p.error }, 400)
    const ok = await updateRule(c.env.DB, id, p.rule)
    if (!ok) return c.json({ success: false, error: '규칙을 찾을 수 없습니다' }, 404)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '규칙을 저장하지 못했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.delete('/rules/:id', async (c) => {
  try {
    const id = intParam(c.req.param('id'), 0)
    if (id <= 0) return c.json({ success: false, error: '잘못된 규칙입니다' }, 400)
    await deleteRule(c.env.DB, id)
    return c.json({ success: true })
  } catch (err) {
    return safeError(c, err, '규칙을 삭제하지 못했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.get('/sends', async (c) => {
  try {
    const limit = Math.min(500, Math.max(1, intParam(c.req.query('limit'), 100)))
    return c.json({ success: true, data: await listSends(c.env.DB, limit) })
  } catch (err) {
    return safeError(c, err, '발송 기록을 불러오지 못했습니다', '[ig-autodm]')
  }
})

instagramAutoDmAdminRoutes.get('/media', async (c) => {
  try {
    const account = await getAccount(c.env.DB, c.env.DATA_ENCRYPTION_KEY)
    if (!account?.access_token) return c.json({ success: false, error: '연결된 계정이 없습니다' }, 400)
    const r = await listRecentMedia(account.access_token, 18)
    if (!r.ok) return c.json({ success: false, error: `게시물을 불러오지 못했습니다: ${r.error}` }, 502)
    return c.json({ success: true, data: r.data?.data || [] })
  } catch (err) {
    return safeError(c, err, '게시물을 불러오지 못했습니다', '[ig-autodm]')
  }
})

/** 실제로 보내지 않고 "이 댓글이면 어떤 DM 이 나가나"만 보여 준다. */
instagramAutoDmAdminRoutes.post('/test-match', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({})) as { text?: unknown; media_id?: unknown; username?: unknown }
    const text = typeof body.text === 'string' ? body.text.slice(0, 500) : ''
    const mediaId = typeof body.media_id === 'string' && body.media_id ? body.media_id : null
    const username = typeof body.username === 'string' && body.username ? body.username.slice(0, 60) : 'urdeal_tester'
    const rule = pickRule(await listRules(c.env.DB, true), { text, mediaId })
    if (!rule) return c.json({ success: true, data: { matched: false } })
    return c.json({
      success: true,
      data: {
        matched: true, rule_id: rule.id,
        dm: renderDm(rule, username),
        public_reply: pickPublicReply(rule.public_reply, username),
      },
    })
  } catch (err) {
    return safeError(c, err, '테스트에 실패했습니다', '[ig-autodm]')
  }
})
