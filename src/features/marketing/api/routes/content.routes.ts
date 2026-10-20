/**
 * 유어애즈(/api/ads) AI 콘텐츠 스튜디오 라우터 — content/* (2026-07-02).
 *   블로그/인스타/틱톡/광고문구 생성 · 댓글답변 초안 · 성과분석 · 라이브러리.
 *   전부 초안(읽기 전용) · AI 미터링(ADS_BILLING_ENFORCED 집행) · ANTHROPIC 키 필요.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { adsAccountIdFrom } from '../ads-account'
import { meterDaily, refundDaily } from '../ads-entitlements'
import {
  generateContent, generateRepurpose, generateReply, analyzeContentPerformance,
  saveContent, listContent, deleteContent, type ContentType, type PerfContext,
} from '../content-studio'
import { loadSearchAdConnection } from '../searchad-connection'
import { accountStats, keywordEfficiency } from '../searchad-client'
import { mediaStatus, generateImage, generateVoice, submitVideo, pollVideo, listMediaJobs } from '../media-gateway'

const adsContentRoutes = new Hono<{ Bindings: Env }>()

const CONTENT_TYPES: ContentType[] = ['blog', 'instagram', 'tiktok', 'ad_copy']

// POST /api/ads/content/generate  body: { type, topic, brand?, audience?, tone?, keywords? }
adsContentRoutes.post('/content/generate', rateLimit({ action: 'ads-content-gen', max: 20, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  const meter = await meterDaily(c.env, id, 'content_per_day')
  if (!meter.ok) return c.json({ success: false, error: meter.error, plan: meter.plan }, 429)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const type = String(b.type || '') as ContentType
  if (!CONTENT_TYPES.includes(type)) return c.json({ success: false, error: '지원하지 않는 콘텐츠 유형입니다' }, 400)
  const r = await generateContent(c.env.ANTHROPIC_API_KEY, type, {
    topic: String(b.topic || '').slice(0, 120),
    brand: b.brand ? String(b.brand).slice(0, 60) : undefined,
    audience: b.audience ? String(b.audience).slice(0, 80) : undefined,
    tone: b.tone ? String(b.tone).slice(0, 40) : undefined,
    keywords: b.keywords ? String(b.keywords).slice(0, 120) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, content: r.content })
})

// POST /api/ads/content/repurpose  body: { source, brand?, keywords? } — 원문 1개 → 멀티플랫폼 팩
adsContentRoutes.post('/content/repurpose', rateLimit({ action: 'ads-content-repurpose', max: 12, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  const meter = await meterDaily(c.env, id, 'content_per_day')
  if (!meter.ok) return c.json({ success: false, error: meter.error, plan: meter.plan }, 429)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await generateRepurpose(c.env.ANTHROPIC_API_KEY, {
    source: String(b.source || ''), brand: b.brand ? String(b.brand).slice(0, 60) : undefined, keywords: b.keywords ? String(b.keywords).slice(0, 120) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, pack: r.pack })
})

// POST /api/ads/content/reply  body: { comment, tone?, brand? } — 댓글/리뷰 답변 초안
adsContentRoutes.post('/content/reply', rateLimit({ action: 'ads-content-reply', max: 30, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  const meter = await meterDaily(c.env, id, 'content_per_day')
  if (!meter.ok) return c.json({ success: false, error: meter.error, plan: meter.plan }, 429)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await generateReply(c.env.ANTHROPIC_API_KEY, {
    comment: String(b.comment || ''), tone: b.tone ? String(b.tone) : undefined, brand: b.brand ? String(b.brand).slice(0, 60) : undefined,
  })
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, reply: r.reply })
})

// POST /api/ads/content/analyze — 실적 근거 콘텐츠 성과 분석(연동 시)
adsContentRoutes.post('/content/analyze', rateLimit({ action: 'ads-content-analyze', max: 10, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  if (!c.env.ANTHROPIC_API_KEY) return c.json({ success: false, error: 'NOT_CONFIGURED' }, 503)
  const meter = await meterDaily(c.env, id, 'content_per_day')
  if (!meter.ok) return c.json({ success: false, error: meter.error, plan: meter.plan }, 429)
  const ctx: PerfContext = { connected: false }
  const creds = await loadSearchAdConnection(c.env.DB, id, c.env.DATA_ENCRYPTION_KEY).catch(() => null)
  if (creds) {
    ctx.connected = true
    const st = await accountStats(creds, 30).catch(() => null)
    if (st?.ok && st.data) { const t = st.data.totals; ctx.stats = { days: st.data.days, ...t } }
    const eff = await keywordEfficiency(creds, 30, 60).catch(() => null)
    if (eff?.ok && eff.items?.length) {
      ctx.topKeywords = eff.items.filter(k => k.conv > 0).slice(0, 6).map(k => ({ keyword: k.keyword, conv: k.conv, roas: k.roas }))
      ctx.wasteKeywords = eff.items.filter(k => k.waste).slice(0, 6).map(k => ({ keyword: k.keyword, cost: k.cost }))
    }
  }
  const r = await analyzeContentPerformance(c.env.ANTHROPIC_API_KEY, ctx)
  if (!r.ok) return c.json({ success: false, error: r.error }, r.error === 'NOT_CONFIGURED' ? 503 : 400)
  return c.json({ success: true, analysis: r.analysis, connected: ctx.connected })
})

// 라이브러리 — 저장/목록/삭제
adsContentRoutes.post('/content/save', rateLimit({ action: 'ads-content-save', max: 60, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await saveContent(c.env.DB, id, { type: String(b.type || 'blog'), title: b.title != null ? String(b.title) : null, body: String(b.body || ''), meta: b.meta })
  if (!r.ok) return c.json({ success: false, error: r.error }, 400)
  return c.json({ success: true, items: await listContent(c.env.DB, id) })
})

adsContentRoutes.get('/content/list', async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const type = (c.req.query('type') || '').trim() || undefined
  return c.json({ success: true, items: await listContent(c.env.DB, id, type) })
})

adsContentRoutes.delete('/content', rateLimit({ action: 'ads-content-del', max: 30, windowSec: 60 }), async (c) => {
  const id = await adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const cid = Number(c.req.query('id'))
  if (!Number.isFinite(cid)) return c.json({ success: false, error: 'id 가 필요합니다' }, 400)
  await deleteContent(c.env.DB, id, cid)
  return c.json({ success: true, items: await listContent(c.env.DB, id) })
})

// ── 미디어 생성(이미지/음성/영상) — provider 게이트웨이. 킬스위치+키 없으면 NOT_CONFIGURED. ──
const adsId = (c: { req: { header: (k: string) => string | undefined }; env: Env }) => adsAccountIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)

// GET /api/ads/content/media/status — 어떤 미디어가 켜져 있는지(키 비노출)
adsContentRoutes.get('/content/media/status', async (c) => {
  const id = await adsId(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  return c.json({ success: true, status: mediaStatus(c.env), jobs: await listMediaJobs(c.env.DB, id, 30) })
})

// POST /api/ads/content/media/image  body: { prompt, size? }
adsContentRoutes.post('/content/media/image', rateLimit({ action: 'ads-media-image', max: 10, windowSec: 60 }), async (c) => {
  const id = await adsId(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const meter = await meterDaily(c.env, id, 'media_per_day')
  if (!meter.ok) return c.json({ success: false, error: meter.error, plan: meter.plan }, 429)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  // size 화이트리스트 — 임의/고가 사이즈로 유료 API 비용/에러 유발 방지.
  const ALLOWED_SIZES = ['1024x1024', '1024x1536', '1536x1024']
  const size = b.size ? String(b.size) : undefined
  if (size && !ALLOWED_SIZES.includes(size)) { await refundDaily(c.env, id, 'media_per_day'); return c.json({ success: false, error: '지원하지 않는 이미지 크기입니다' }, 400) }
  const r = await generateImage(c.env, id, String(b.prompt || ''), { size })
  // 실제 비용 0(비활성/미설정)이면 미리 차감한 일일 슬롯 환불.
  if (!r.ok && (r.error === 'NOT_CONFIGURED' || r.error === 'DISABLED')) await refundDaily(c.env, id, 'media_per_day')
  if (!r.ok) return c.json({ success: false, error: r.error === 'NOT_CONFIGURED' ? '이미지 생성이 아직 설정되지 않았습니다' : r.error === 'DISABLED' ? '미디어 생성이 비활성화되어 있습니다' : r.error }, r.error === 'NOT_CONFIGURED' || r.error === 'DISABLED' ? 503 : 400)
  return c.json({ success: true, url: r.url, jobId: r.jobId })
})

// POST /api/ads/content/media/voice  body: { text, voiceId? }
adsContentRoutes.post('/content/media/voice', rateLimit({ action: 'ads-media-voice', max: 10, windowSec: 60 }), async (c) => {
  const id = await adsId(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const meter = await meterDaily(c.env, id, 'media_per_day')
  if (!meter.ok) return c.json({ success: false, error: meter.error, plan: meter.plan }, 429)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await generateVoice(c.env, id, String(b.text || ''), { voiceId: b.voiceId ? String(b.voiceId) : undefined })
  if (!r.ok && (r.error === 'NOT_CONFIGURED' || r.error === 'DISABLED')) await refundDaily(c.env, id, 'media_per_day')
  if (!r.ok) return c.json({ success: false, error: r.error === 'NOT_CONFIGURED' ? '음성 생성이 아직 설정되지 않았습니다' : r.error === 'DISABLED' ? '미디어 생성이 비활성화되어 있습니다' : r.error }, r.error === 'NOT_CONFIGURED' || r.error === 'DISABLED' ? 503 : 400)
  return c.json({ success: true, url: r.url, jobId: r.jobId })
})

// POST /api/ads/content/media/video  body: { prompt } — 비동기 잡 제출
adsContentRoutes.post('/content/media/video', rateLimit({ action: 'ads-media-video', max: 6, windowSec: 60 }), async (c) => {
  const id = await adsId(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const meter = await meterDaily(c.env, id, 'media_per_day')
  if (!meter.ok) return c.json({ success: false, error: meter.error, plan: meter.plan }, 429)
  const b = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const r = await submitVideo(c.env, id, String(b.prompt || ''))
  if (!r.ok && (r.error === 'NOT_CONFIGURED' || r.error === 'DISABLED')) await refundDaily(c.env, id, 'media_per_day')
  if (!r.ok) return c.json({ success: false, error: r.error === 'NOT_CONFIGURED' ? '영상 생성이 아직 설정되지 않았습니다' : r.error === 'DISABLED' ? '미디어 생성이 비활성화되어 있습니다' : r.error }, r.error === 'NOT_CONFIGURED' || r.error === 'DISABLED' ? 503 : 400)
  return c.json({ success: true, jobId: r.jobId, status: r.status })
})

// GET /api/ads/content/media/video/:id — 영상 잡 상태 폴링
adsContentRoutes.get('/content/media/video/:id', async (c) => {
  const id = await adsId(c)
  if (!id) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const jobId = Number(c.req.param('id'))
  if (!Number.isFinite(jobId)) return c.json({ success: false, error: '잘못된 작업 ID' }, 400)
  const r = await pollVideo(c.env, id, jobId)
  if (!r.ok) return c.json({ success: false, error: r.error }, 404)
  return c.json({ success: true, status: r.status, url: r.url })
})

export { adsContentRoutes }
