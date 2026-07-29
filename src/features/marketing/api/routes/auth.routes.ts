/**
 * 유어애즈(/api/ads) 인증 라우터 — auth/* (marketing.routes.ts 에서 분리, 2026-07-01).
 *   자체 이메일/비밀번호 계정(셀러/카카오와 무관). same-origin JSON 200 → iOS-safe.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { adsAccountIdFrom, createAdsAccount, loginAdsAccount, getAdsAccount, signAdsToken, ensureAdsAccountSchema, updateAdsAccount, changeAdsPassword, requestPasswordReset, resetPasswordWithToken, unlockAdsAccount, requestAdsAccess, getAdsAccessRequest } from '../ads-account'
import { sendDiscordAlert } from '@/worker/utils/discord-alert'
import { adsAccessCode } from './helpers'

const adsAuthRoutes = new Hono<{ Bindings: Env }>()

// ── 유어애즈 독립 계정 인증 (셀러/카카오와 무관 — 자체 이메일/비밀번호) ───────────
//   2026-06-28 대표 결정: "유어애즈는 유어딜·도매몰과 전혀 무관" → 자체 가입/로그인.
//   same-origin JSON 200(XHR) → iOS-safe(쿠키 의존 X). 토큰은 ads_token(클라 localStorage).

// POST /api/ads/auth/signup — 신규 유어애즈 계정
adsAuthRoutes.post('/auth/signup', rateLimit({ action: 'ads-signup', max: 10, windowSec: 600 }), async (c) => {
  if (!c.env.JWT_SECRET) return c.json({ success: false, error: '서버 설정 오류(JWT_SECRET)' }, 500)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await createAdsAccount(c.env.DB, {
    email: String(body.email || ''),
    password: String(body.password || ''),
    company_name: String(body.company_name || ''),
    phone: body.phone ? String(body.phone) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400 | 409 | 500)
  const token = await signAdsToken(r.account.id, c.env.JWT_SECRET)
  return c.json({ success: true, token, account: r.account })
})

// POST /api/ads/auth/login — 이메일/비밀번호 로그인
adsAuthRoutes.post('/auth/login', rateLimit({ action: 'ads-login', max: 20, windowSec: 300 }), async (c) => {
  if (!c.env.JWT_SECRET) return c.json({ success: false, error: '서버 설정 오류(JWT_SECRET)' }, 500)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await loginAdsAccount(c.env.DB, String(body.email || ''), String(body.password || ''))
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400 | 401 | 403)
  const token = await signAdsToken(r.account.id, c.env.JWT_SECRET)
  return c.json({ success: true, token, account: r.account })
})

// GET /api/ads/auth/me — 현재 계정 정보(토큰 검증)
adsAuthRoutes.get('/auth/me', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureAdsAccountSchema(c.env.DB)
  const account = await getAdsAccount(c.env.DB, id)
  if (!account) return c.json({ success: false, error: '계정을 찾을 수 없습니다' }, 404)
  return c.json({ success: true, account })
})

// PATCH /api/ads/auth/account — 회사명/연락처 수정
adsAuthRoutes.patch('/auth/account', rateLimit({ action: 'ads-account-patch', max: 20, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await updateAdsAccount(c.env.DB, id, {
    company_name: body.company_name !== undefined ? String(body.company_name) : undefined,
    phone: body.phone !== undefined ? String(body.phone) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400 | 404)
  return c.json({ success: true, account: r.account })
})

// POST /api/ads/auth/password — 비밀번호 변경(현재 비번 확인)
adsAuthRoutes.post('/auth/password', rateLimit({ action: 'ads-pw', max: 10, windowSec: 600, sensitive: true }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await changeAdsPassword(c.env.DB, id, String(body.current_password || ''), String(body.new_password || ''))
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400 | 401 | 404)
  return c.json({ success: true })
})

// POST /api/ads/auth/unlock — 베타 액세스 코드 입력 → 계정 잠금 해제(1회)
adsAuthRoutes.post('/auth/unlock', rateLimit({ action: 'ads-unlock', max: 10, windowSec: 300, sensitive: true }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  // env 코드 미설정 = 코드 입력 경로 자체가 닫힘(어떤 코드도 실패) → 승인제 안내로 명확화(무한 재시도 방지).
  if (!adsAccessCode(c.env)) return c.json({ success: false, error: '지금은 승인제로만 운영됩니다 — 아래 "입장 요청하기"를 눌러주세요. 승인되면 자동 입장됩니다.' }, 400)
  const r = await unlockAdsAccount(c.env.DB, id, String(body.code || ''), adsAccessCode(c.env))
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, unlocked: true })
})

// POST /api/ads/auth/request-access — 📥 액세스 입장 요청(코드 없는 가입자 데드엔드 해소).
//   어드민 승인 큐(/admin/ads-accounts)로 접수 + 디스코드 알림(best-effort). 멱등 — 중복 요청 무해.
adsAuthRoutes.post('/auth/request-access', rateLimit({ action: 'ads-access-req', max: 5, windowSec: 600 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await requestAdsAccess(c.env.DB, id, body.note ? String(body.note) : undefined)
  if (r === 'unlocked') return c.json({ success: true, unlocked: true })
  if (r === 'created') {
    const acc = await getAdsAccount(c.env.DB, id)
    const who = `${acc?.company_name || '?'} (${acc?.email || `#${id}`})`
    // 🔔 어드민 벨 — Discord 미설정/미확인이어도 요청이 조용히 묻히지 않게(승인 큐의 존재 이유).
    //    partner-pool.routes 와 동일 패턴(같은 D1 공유 — ads 워커에서도 호출 가능).
    await import('../../../notifications/api/dashboard-notifications.routes')
      .then(({ createDashboardNotification }) => createDashboardNotification(
        c.env.DB, 'admin', null, 'ads_access_request', '🔑 유어애즈 입장 요청',
        `${who} — 승인 대기 중`, '/admin/ads-accounts'))
      .catch(() => null)
    if (c.env.DISCORD_WEBHOOK_URL) {
      await sendDiscordAlert(c.env.DISCORD_WEBHOOK_URL, '🔑 유어애즈 입장 요청',
        `${who} — /admin/ads-accounts 에서 승인/거절`, 'warn').catch(() => null)
    }
  }
  return c.json({ success: true, requested: true })
})

// GET /api/ads/auth/request-access — 내 요청 상태(pending/approved/rejected 또는 없음)
adsAuthRoutes.get('/auth/request-access', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const req = await getAdsAccessRequest(c.env.DB, id)
  return c.json({ success: true, request: req })
})

// POST /api/ads/auth/forgot — 비밀번호 재설정 요청(이메일 링크). 열거 방지 → 항상 success.
adsAuthRoutes.post('/auth/forgot', rateLimit({ action: 'ads-forgot', max: 5, windowSec: 600, sensitive: true }), async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const reset = await requestPasswordReset(c.env.DB, String(body.email || '')).catch(() => null)
  if (reset) {
    // 이메일 발송 인프라(Resend)가 없으면 재설정 토큰은 발급됐는데 링크가 영영 안 감(무음 데드엔드).
    //   → 운영자가 알 수 있게 서버 로그로 경보(응답은 여전히 열거방지 위해 동일).
    if (!c.env.RESEND_API_KEY || !c.env.RESEND_FROM) {
      console.error('[ads-forgot] RESEND_API_KEY/RESEND_FROM 미설정 — 재설정 링크를 발송하지 못했습니다. 어드민 비번 재설정 도구(/admin/ads-accounts)로 처리하세요.')
    } else {
      const origin = new URL(c.req.url).origin
      const link = `${origin}/ads/reset?token=${reset.token}`
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${c.env.RESEND_API_KEY}` },
        body: JSON.stringify({
          from: c.env.RESEND_FROM, to: reset.email,
          subject: '[유어애즈] 비밀번호 재설정',
          text: `아래 링크에서 비밀번호를 재설정하세요(1시간 유효):\n\n${link}\n\n본인이 요청하지 않았다면 이 메일을 무시하세요.\n\n— 유어애즈 UR Ads`,
        }),
      }).catch(() => null)
      // Resend 가 4xx/5xx(키 만료·쿼터초과·도메인 미인증)를 반환하면 조용히 삼키지 말고 로그.
      if (!res || !res.ok) {
        console.error('[ads-forgot] 재설정 메일 발송 실패', { status: res?.status ?? 'network-error' })
      }
    }
  }
  // 이메일 존재 여부 노출 금지 — 항상 동일 응답.
  return c.json({ success: true, message: '가입된 이메일이면 재설정 링크를 보냈습니다.' })
})

// POST /api/ads/auth/reset — 토큰으로 새 비밀번호 설정
adsAuthRoutes.post('/auth/reset', rateLimit({ action: 'ads-reset', max: 10, windowSec: 600, sensitive: true }), async (c) => {
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await resetPasswordWithToken(c.env.DB, String(body.token || ''), String(body.new_password || ''))
  if (!r.ok) return c.json({ success: false, error: r.error }, r.status as 400)
  return c.json({ success: true })
})

export { adsAuthRoutes }
