/**
 * 🛡️ 2026-05-15: Web Vitals + 공구 funnel 수집 (KV 카운터, 0원 운영)
 *
 * - POST /api/analytics/vitals  — { name: 'LCP'|'FID'|'CLS'|'INP'|'TTFB', value, id, page }
 * - POST /api/analytics/funnel  — { event: 'view'|'click'|'join'|'success', product_id, page }
 * - GET  /api/analytics/summary (admin) — KV 누적 값 dump
 *
 * 모두 KV 에 일별 카운터 (key = `vitals:YYYY-MM-DD:LCP:p75` 같은 식).
 * Cloudflare KV free: 100K read/day, 1K write/day. Sampling 으로 비용 0 유지.
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { requireAdmin } from '../middleware/auth'
import { type LcpPartsBody, lcpPartsTuple, summarizeLcpParts } from '../utils/lcp-parts'
import { CLS_SOURCE_MIN, sanitizeClsSource, topClsSources } from '../../shared/cls-source'

const analyticsRoutes = new Hono<{ Bindings: Env }>()

// 1% sampling — 100명 중 1명만 기록 (KV write 한도 보호)
// 📈 2026-09-02 (대표 "모두 다 진행" — 로딩 후속 ①): 0.01 → 0.25. 1% 표본으로는 **하루 1건**이 찍혀(실측: 8/30~9/2 LCP 표본 0)
//   실사용자 판정이 불가능했다. Workers 유료 전환(9/2)으로 KV 쓰기 한도가 월 100만이라 25% 표본(뷰당 ≤5 쓰기)은 여유.
//   ⚠️ 무료 요금제로 되돌리면(일 1K 쓰기) 다시 0.01 로 내릴 것.
const VITALS_SAMPLE_RATE = 0.25
// 🛡️ 2026-06-11 머니/무료티어 감사: 고볼륨 funnel(view/click) 5% 샘플 + inc 20 보정 →
//   KV free write 1K/day 한도 보호. join/success(저볼륨·고가치)는 항상 기록.
const FUNNEL_SAMPLE_RATE = 0.05

// 🛡️ analytics 쓰기는 ANALYTICS_KV 전용 — SESSION_KV(인증세션 저장소) 의 write 예산을 잠식해
//   세션이 끊기는 사고를 막기 위해 fallback 금지. 미바인딩이면 skip(0원, 무해). 읽기(summary)만 fallback 유지.
function analyticsWriteKv(env: unknown): KVNamespace | null {
  return (env as { ANALYTICS_KV?: KVNamespace }).ANALYTICS_KV || null
}

interface VitalsBody {
  name?: 'LCP' | 'FID' | 'CLS' | 'INP' | 'TTFB'
  value?: number
  page?: string
  /** LCP 일 때만 — 어디서 시간이 갔나(web-vitals-report `lcpBreakdown`). */
  parts?: LcpPartsBody
  /** CLS 일 때만 — 가장 큰 밀림의 요소(`shared/cls-source`). */
  src?: unknown
}


interface FunnelBody {
  event?: 'view' | 'click' | 'join' | 'success'
  product_id?: number
  page?: string
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
}

async function incrementCounter(kv: KVNamespace, key: string, increment: number = 1, ttlSec: number = 90 * 86400): Promise<void> {
  try {
    const cur = await kv.get(key)
    const n = (cur ? parseInt(cur, 10) : 0) + increment
    await kv.put(key, String(n), { expirationTtl: ttlSec })
  } catch { /* KV 미설정 / 한도 초과 시 silent */ }
}

async function appendSample(kv: KVNamespace, key: string, value: number | number[] | string, maxSamples: number = 100): Promise<void> {
  // 간단한 reservoir-ish: 기존 array (≤100) 에 push, 초과 시 무작위 교체
  try {
    const cur = await kv.get(key)
    const arr: Array<number | number[] | string> = cur ? JSON.parse(cur) : []
    if (arr.length < maxSamples) arr.push(value)
    else {
      const idx = Math.floor(Math.random() * (arr.length + 1))
      if (idx < maxSamples) arr[idx] = value
    }
    await kv.put(key, JSON.stringify(arr), { expirationTtl: 90 * 86400 })
  } catch { /* silent */ }
}

/**
 * 🌏 2026-10-14: 성능 표본은 **한국에서 온 요청만** 받는다.
 *   서비스가 한국 전용이고, 해외 표본은 사실상 우리 측정·테스트 트래픽이다(그날 `/map` LCP 표본의 데이터센터가
 *   전부 미국이었다). 섞이면 실사용자 숫자가 미국에서 한국 CDN 을 받는 시간으로 부풀어 엉뚱한 화면을 고치게 된다.
 *   헤더가 없으면(로컬·미지정) 막지 않는다 — 판정할 근거가 없을 때는 종전대로 받는다.
 */
export function isVitalsCountryAllowed(country: string | undefined | null): boolean {
  const cc = (country || '').trim().toUpperCase()
  return cc === '' || cc === 'KR'
}

analyticsRoutes.post('/vitals', async (c) => {
  if (!isVitalsCountryAllowed(c.req.header('cf-ipcountry'))) return c.json({ ok: true, skipped: 'country' })
  if (Math.random() > VITALS_SAMPLE_RATE) return c.json({ ok: true, sampled: false })
  const body = await c.req.json<VitalsBody>().catch(() => ({} as VitalsBody))
  if (!body.name || typeof body.value !== 'number' || !Number.isFinite(body.value)) {
    return c.json({ ok: false }, 400)
  }
  const validNames = ['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'CONN']
  if (!validNames.includes(body.name)) return c.json({ ok: false }, 400)
  if (body.value < 0 || body.value > 1_000_000) return c.json({ ok: false }, 400)
  const kv = analyticsWriteKv(c.env)
  if (!kv) return c.json({ ok: true, skipped: true })

  const day = todayKey()
  // 페이지 키워드 정규화 (group-buy/123 → group-buy)
  // 📡 `colo:XXX` 는 데이터센터별 표본(web-vitals-report) — 숫자 제거·자르기와 무관하게 대문자 4자만 받는다.
  const coloM = /^colo:([A-Z]{3,4})$/.exec(body.page || '')
  const page = coloM ? `colo:${coloM[1]}` : ((body.page || '').replace(/\/\d+/g, '').slice(0, 60) || 'unknown')
  const sampleKey = `vitals:${day}:${body.name}:${page}`
  await appendSample(kv, sampleKey, Math.round(body.value))
  // 🔬 2026-10-19: LCP 는 쪼갠 값도 **같은 표본**으로 남긴다(따로 보내면 표본이 따로 뽑혀 합이 안 맞는다).
  //   키 이름이 `LCPB` 라 SLO 판정(`vitals:{날}:LCP:` 접두)과 안 섞인다. 쓰기는 LCP 표본당 1번 더.
  if (body.name === 'LCP' && !coloM) {
    const tuple = lcpPartsTuple(body.parts)
    if (tuple) await appendSample(kv, `vitals:${day}:LCPB:${page}`, tuple)
  }
  // 🔬 2026-10-20: 큰 CLS 표본(≥0.05)은 **무엇이 밀렸는지**도 남긴다(`shared/cls-source`). 키 `CLSS` 는 SLO 판정
  //   접두(`vitals:{날}:CLS:`)와 안 섞이고, 0.0x 표본은 원인을 안 보내므로 쓰기는 큰 표본에만 1번 더.
  if (body.name === 'CLS' && !coloM && body.value >= CLS_SOURCE_MIN) {
    const src = sanitizeClsSource(body.src)
    if (src) await appendSample(kv, `vitals:${day}:CLSS:${page}`, src)
  }
  await incrementCounter(kv, `vitals_count:${day}:${body.name}`, 1)
  return c.json({ ok: true })
})

analyticsRoutes.post('/funnel', async (c) => {
  const body = await c.req.json<FunnelBody>().catch(() => ({} as FunnelBody))
  if (!body.event) return c.json({ ok: false }, 400)
  const validEvents = ['view', 'click', 'join', 'success']
  if (!validEvents.includes(body.event)) return c.json({ ok: false }, 400)
  const kv = analyticsWriteKv(c.env)
  if (!kv) return c.json({ ok: true, skipped: true })

  // 고볼륨 이벤트는 샘플링(5%) — write 한도 보호. 통과분은 inc=20 으로 보정해 합계 추정 유지.
  const highVolume = body.event === 'view' || body.event === 'click'
  if (highVolume && Math.random() > FUNNEL_SAMPLE_RATE) return c.json({ ok: true, sampled: false })
  const inc = highVolume ? Math.round(1 / FUNNEL_SAMPLE_RATE) : 1

  const day = todayKey()
  const page = (body.page || '').replace(/\/\d+/g, '').slice(0, 60) || 'unknown'
  await incrementCounter(kv, `funnel:${day}:${body.event}:${page}`, inc)
  if (body.product_id && Number.isFinite(body.product_id)) {
    await incrementCounter(kv, `funnel_product:${day}:${body.product_id}:${body.event}`, inc)
  }
  return c.json({ ok: true })
})

analyticsRoutes.get('/summary', requireAdmin(), async (c) => {
  const kv = (c.env as Env & { ANALYTICS_KV?: KVNamespace; SESSION_KV?: KVNamespace }).ANALYTICS_KV
    || (c.env as Env & { SESSION_KV?: KVNamespace }).SESSION_KV
  if (!kv) return c.json({ success: true, data: { vitals: {}, funnel: {} } })

  const day = c.req.query('day') || todayKey()
  const vitals: Record<string, { p50: number; p75: number; p95: number; samples: number }> = {}
  const funnel: Record<string, number> = {}

  for (const name of ['LCP', 'FID', 'CLS', 'INP', 'TTFB', 'CONN']) {
    try {
      const list = await kv.list({ prefix: `vitals:${day}:${name}:` })
      for (const k of list.keys) {
        const raw = await kv.get(k.name)
        if (!raw) continue
        const arr = JSON.parse(raw) as number[]
        if (arr.length === 0) continue
        const sorted = [...arr].sort((a, b) => a - b)
        const pct = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]
        vitals[k.name] = {
          p50: pct(0.5), p75: pct(0.75), p95: pct(0.95), samples: arr.length,
        }
      }
    } catch { /* skip */ }
  }

  try {
    const list = await kv.list({ prefix: `funnel:${day}:` })
    for (const k of list.keys) {
      const v = await kv.get(k.name)
      if (v) funnel[k.name.replace(`funnel:${day}:`, '')] = parseInt(v, 10) || 0
    }
  } catch { /* skip */ }

  // 🔬 LCP 쪼개기 — 화면별 부분 p75(어디서 시간이 갔나).
  const lcpParts: Record<string, ReturnType<typeof summarizeLcpParts>> = {}
  try {
    const list = await kv.list({ prefix: `vitals:${day}:LCPB:` })
    for (const k of list.keys) {
      const raw = await kv.get(k.name)
      if (!raw) continue
      lcpParts[k.name.slice(`vitals:${day}:LCPB:`.length)] = summarizeLcpParts(JSON.parse(raw) as number[][])
    }
  } catch { /* skip */ }

  // 🔬 CLS 원인 — 화면별로 자주 밀린 요소(2026-10-20).
  const clsSources: Record<string, ReturnType<typeof topClsSources>> = {}
  try {
    const list = await kv.list({ prefix: `vitals:${day}:CLSS:` })
    for (const k of list.keys) {
      const raw = await kv.get(k.name)
      if (!raw) continue
      clsSources[k.name.slice(`vitals:${day}:CLSS:`.length)] = topClsSources(JSON.parse(raw) as string[], 5)
    }
  } catch { /* skip */ }

  return c.json({ success: true, data: { day, vitals, funnel, lcp_parts: lcpParts, cls_sources: clsSources } })
})

export { analyticsRoutes }
