/**
 * 🌐 유통스타트 — 바이어 풀 북마클릿 인제스트 (2026-07-21).
 *   ⚠️ requireAdmin 밖(크로스오리진) — buyKorea 등에서 북마클릿이 POST. **토큰 인증 + CORS**.
 *   대표 브라우저가 세션으로 읽은 상세 HTML 을 받아 파싱·저장. 유어딜 무관. /api/buyer-ingest 에 마운트.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { verifyIngestToken, ingestHtmls } from './buyer-autofetch'
import { listKnownRefs } from './buyer-discovery'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
  'Access-Control-Max-Age': '86400',
}

const app = new Hono<{ Bindings: Env }>()

app.options('*', () => new Response(null, { status: 204, headers: CORS }))

app.post('/', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { token?: string; htmls?: string[]; refs?: string[]; text?: string }
  const ok = await verifyIngestToken(c.env, String(b.token || '')).catch(() => false)
  if (!ok) return c.json({ success: false, error: 'INVALID_TOKEN' }, 401, CORS)
  // ⚠️ htmls 를 여기서 filter 하면 refs[i] 정렬이 깨짐(비문자 제거 시 인덱스 시프트 → 엉뚱한 ref 태깅).
  //   ingestHtmls 가 비문자를 continue 로 in-place 스킵(인덱스 보존)하므로 slice 만 하고 정렬은 유지.
  const htmls = Array.isArray(b.htmls) ? b.htmls.slice(0, 200) : (b.text ? [String(b.text)] : [])
  if (!htmls.length) return c.json({ success: false, error: 'NO_HTML' }, 400, CORS)
  // refs[i] = htmls[i] 의 소스 상세 참조(재수집 건너뛰기 태깅). 없으면 무시.
  const refs = Array.isArray(b.refs) ? b.refs.map(r => String(r || '').slice(0, 200)).slice(0, 200) : undefined
  // 내부 에러 문자열을 크로스오리진 응답에 노출하지 않음(safe-error 룰) — 카운트만 반환.
  const result = await ingestHtmls(c.env, htmls, refs).catch(() => ({ parsed: 0, saved: 0 }))
  return c.json({ success: true, result }, 200, CORS)
})

// POST /api/buyer-ingest/known { token, refs:[] } — 이미 저장된 상세 참조 반환(북마클릿이 재수집 시 건너뛰기). 토큰 인증.
app.post('/known', async (c) => {
  const b = await c.req.json().catch(() => ({})) as { token?: string; refs?: string[] }
  const ok = await verifyIngestToken(c.env, String(b.token || '')).catch(() => false)
  if (!ok) return c.json({ success: false, error: 'INVALID_TOKEN' }, 401, CORS)
  const refs = Array.isArray(b.refs) ? b.refs.map(r => String(r || '').slice(0, 200)).filter(Boolean).slice(0, 2000) : []
  const known = await listKnownRefs(c.env.DB, refs).catch(() => [])
  return c.json({ success: true, known }, 200, CORS)
})

export { app as buyerIngestRoutes }
