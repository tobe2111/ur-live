/**
 * 🌐 유통스타트 — 바이어 풀 북마클릿 인제스트 (2026-07-21).
 *   ⚠️ requireAdmin 밖(크로스오리진) — buyKorea 등에서 북마클릿이 POST. **토큰 인증 + CORS**.
 *   대표 브라우저가 세션으로 읽은 상세 HTML 을 받아 파싱·저장. 유어딜 무관. /api/buyer-ingest 에 마운트.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { verifyIngestToken, ingestHtmls } from './buyer-autofetch'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
}

const app = new Hono<{ Bindings: Env }>()

app.options('*', () => new Response(null, { status: 204, headers: CORS }))

app.post('/', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { token?: string; htmls?: string[]; text?: string }
  const ok = await verifyIngestToken(c.env, String(b.token || '')).catch(() => false)
  if (!ok) return c.json({ success: false, error: 'INVALID_TOKEN' }, 401, CORS)
  const htmls = Array.isArray(b.htmls) ? b.htmls.filter(h => typeof h === "string").slice(0, 80) : (b.text ? [String(b.text)] : [])
  if (!htmls.length) return c.json({ success: false, error: 'NO_HTML' }, 400, CORS)
  const result = await ingestHtmls(c.env, htmls).catch((e) => ({ parsed: 0, saved: 0, error: String(e) }))
  return c.json({ success: true, result }, 200, CORS)
})

export { app as buyerIngestRoutes }
