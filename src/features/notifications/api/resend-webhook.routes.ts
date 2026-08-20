/**
 * Resend Webhook Handler (v15-5)
 *
 * Receives email bounce / complaint notifications from Resend and maintains
 * a server-side suppression list so we stop sending to bad addresses.
 *
 * Endpoint: POST /api/webhooks/resend
 *
 * Events handled:
 *   - email.bounced    → recipient rejected (hard or soft bounce)
 *   - email.complained → recipient marked as spam
 *
 * Signature verification (2026-04-22 추가):
 *   Svix webhook signature (svix-id / svix-timestamp / svix-signature 헤더)를 검증한다.
 *   RESEND_WEBHOOK_SECRET 가 세팅되어 있으면 검증 필수. 없으면 경고 로그 + 통과 (dev 호환).
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

export const resendWebhookRoutes = new Hono<{ Bindings: Env }>()

interface ResendWebhookBody {
  type: string
  data?: {
    to?: string[] | string
    email_id?: string
    [key: string]: unknown
  }
}

/**
 * Svix signature verification (Resend webhook 형식).
 * 문서: https://docs.svix.com/receiving/verifying-payloads/how-manual
 * 헤더:
 *   svix-id: unique msg id
 *   svix-timestamp: unix seconds
 *   svix-signature: "v1,<base64-hmac-sha256>" (공백구분 다중 서명 가능)
 * payload = `${id}.${timestamp}.${body}`
 * secret prefix "whsec_" 는 제거 후 base64 디코드.
 */
async function verifySvixSignature(
  secret: string,
  id: string,
  timestamp: string,
  body: string,
  sigHeader: string,
): Promise<boolean> {
  try {
    const tsNum = Number(timestamp)
    if (!Number.isFinite(tsNum)) return false
    // 5분 tolerance (replay 방지)
    const nowSec = Math.floor(Date.now() / 1000)
    if (Math.abs(nowSec - tsNum) > 300) return false

    const keyB64 = secret.startsWith('whsec_') ? secret.slice(6) : secret
    const keyBytes = Uint8Array.from(atob(keyB64), c => c.charCodeAt(0))
    const payload = `${id}.${timestamp}.${body}`
    const key = await crypto.subtle.importKey(
      'raw', keyBytes,
      { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
    )
    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    const computed = btoa(String.fromCharCode(...new Uint8Array(mac)))

    // svix-signature 는 "v1,sig1 v1,sig2" 다중. 한 개라도 일치하면 통과.
    const sigs = sigHeader.split(' ').map(s => {
      const comma = s.indexOf(',')
      return comma > 0 ? s.slice(comma + 1) : s
    })
    return sigs.includes(computed)
  } catch {
    return false
  }
}

resendWebhookRoutes.post('/', async (c) => {
  const secret = (c.env as any).RESEND_WEBHOOK_SECRET as string | undefined
  const svixId = c.req.header('svix-id') || ''
  const svixTs = c.req.header('svix-timestamp') || ''
  const svixSig = c.req.header('svix-signature') || ''

  // 🔒 서명 검증 (secret 세팅된 경우 필수)
  const rawBody = await c.req.text()
  if (secret) {
    if (!svixId || !svixTs || !svixSig) {
      return c.json({ success: false, error: 'missing_svix_headers' }, 401)
    }
    const valid = await verifySvixSignature(secret, svixId, svixTs, rawBody, svixSig)
    if (!valid) {
      return c.json({ success: false, error: 'invalid_signature' }, 401)
    }
  } else {
    // secret 미세팅: 경고 로그만 (긴급 롤백/개발 환경 호환)
    console.warn('[ResendWebhook] RESEND_WEBHOOK_SECRET not configured — signature verification skipped')
  }

  let body: ResendWebhookBody
  try {
    body = JSON.parse(rawBody) as ResendWebhookBody
  } catch {
    return c.json({ success: false, error: 'invalid_json' }, 400)
  }

  if (body.type === 'email.bounced' || body.type === 'email.complained') {
    const to = body.data?.to
    const email = Array.isArray(to) ? to[0] : to

    if (email) {
      try {
        // Ensure table exists (idempotent — will not overwrite existing data)
        await adsLeadsDb(c.env).prepare(`
          CREATE TABLE IF NOT EXISTS email_suppressions (
            email TEXT PRIMARY KEY,
            reason TEXT,
            suppressed_at DATETIME DEFAULT (datetime('now'))
          )
        `).run()

        await adsLeadsDb(c.env).prepare(
          'INSERT OR IGNORE INTO email_suppressions (email, reason) VALUES (?, ?)'
        ).bind(email, body.type).run()
      } catch (err) {
        // Best-effort — return 200 even on DB failure so Resend doesn't retry forever
        console.error('[ResendWebhook] DB error:', err)
      }
    }
  }

  // 🆕 2026-07-21 유어애즈 아웃리치 자동 감지 — Resend 는 한 계정의 모든 이벤트를 이 단일 URL 로 보낸다.
  //   발신 이벤트(bounce/complain/open/delivered)를 공용 풀(account_id=0) 리드에 반영 + 인바운드 회신 승격.
  //   ⚖️ [LEGAL] 신규 발송 0 — 이미 보낸 메일의 결과만 소비. ad_influencer_leads 만 만짐(서비스 분리).
  try {
    const t = body.type || ''
    const { applyResendEventToPool, applyInboundReplyToPool } = await import('../../marketing/api/outreach-webhook')
    if (t === 'email.bounced' || t === 'email.complained' || t === 'email.opened' || t === 'email.delivered') {
      const to = body.data?.to
      const email = Array.isArray(to) ? to[0] : to
      if (email) await applyResendEventToPool(adsLeadsDb(c.env), t, email)
    } else if (/inbound|received|reply/i.test(t)) {
      // Resend Inbound(MX) 설정 시 도달 — 보낸사람(from) 기준으로 관심 리드 승격.
      //   ⚖️ 제목+본문을 함께 넘겨 수신거부 표현("보내지 마세요" 등) 감지 → rejected+억제(내용 무관 interested 승격 방지).
      const from = (body.data?.from as string | { email?: string } | undefined)
      const fromEmail = typeof from === 'string' ? from : (from?.email || '')
      const subj = typeof body.data?.subject === 'string' ? body.data.subject : ''
      const text = typeof body.data?.text === 'string' ? body.data.text : (typeof body.data?.html === 'string' ? body.data.html : '')
      if (fromEmail) await applyInboundReplyToPool(adsLeadsDb(c.env), fromEmail, `${subj}\n${String(text).slice(0, 4000)}`)
    }
  } catch (err) {
    console.error('[ResendWebhook] pool sync error:', err)
  }

  return c.json({ success: true })
})
