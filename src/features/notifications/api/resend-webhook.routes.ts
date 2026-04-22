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
 * Signature verification:
 *   TODO: Resend uses Svix (svix-signature header). Verifying requires the
 *   Resend webhook secret + timestamp tolerance. Add once RESEND_WEBHOOK_SECRET
 *   is provisioned in env.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

export const resendWebhookRoutes = new Hono<{ Bindings: Env }>()

interface ResendWebhookBody {
  type: string
  data?: {
    to?: string[] | string
    email_id?: string
    [key: string]: unknown
  }
}

resendWebhookRoutes.post('/', async (c) => {
  // TODO: verify svix-signature with Resend webhook secret
  const _signature = c.req.header('svix-signature')

  let body: ResendWebhookBody
  try {
    body = await c.req.json<ResendWebhookBody>()
  } catch {
    return c.json({ success: false, error: 'invalid_json' }, 400)
  }

  if (body.type === 'email.bounced' || body.type === 'email.complained') {
    const to = body.data?.to
    const email = Array.isArray(to) ? to[0] : to

    if (email) {
      try {
        // Ensure table exists (idempotent — will not overwrite existing data)
        await c.env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS email_suppressions (
            email TEXT PRIMARY KEY,
            reason TEXT,
            suppressed_at DATETIME DEFAULT (datetime('now'))
          )
        `).run()

        await c.env.DB.prepare(
          'INSERT OR IGNORE INTO email_suppressions (email, reason) VALUES (?, ?)'
        ).bind(email, body.type).run()
      } catch (err) {
        // Best-effort — return 200 even on DB failure so Resend doesn't retry forever
        console.error('[ResendWebhook] DB error:', err)
      }
    }
  }

  return c.json({ success: true })
})
