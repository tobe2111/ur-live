/**
 * 📡 2026-07-05 유입 소스 어트리뷰션 API — 규격/모델은 worker/utils/acquisition.ts 헤더 참조.
 *
 *  - POST /api/acquisition/landing  (공개, rate-limit): 첫 접촉 랜딩 이벤트 1회 기록 —
 *    클라(lib/acquisition.ts)가 first-touch 캡처 시점에만 발사(페이지뷰마다 아님 → write 예산 보호).
 *  - POST /api/acquisition/claim    (인증): 가입/로그인 후 localStorage 의 first-touch 를 유저에 귀속.
 *    UNIQUE(user_id) INSERT OR IGNORE — 첫 소스가 이기고 이후 재클레임은 무해한 no-op (first-touch 고정).
 */
import { Hono } from 'hono'
import { requireAuth, getCurrentUser } from '../middleware/auth'
import { rateLimit } from '../middleware/rate-limit'
import type { Env } from '../types/env'
import { ensureAcquisitionTables, normalizeAcqSource } from '../utils/acquisition'

export const acquisitionRoutes = new Hono<{ Bindings: Env }>()

acquisitionRoutes.post('/landing', rateLimit({ action: 'acq_landing', max: 10, windowSec: 60 }), async (c) => {
  const body = await c.req.json<{ src?: string; code?: string }>().catch(() => ({} as Record<string, never>))
  const src = normalizeAcqSource(body.src)
  if (!src) return c.json({ success: false, error: '소스 식별자는 소문자/숫자/하이픈 1~40자' }, 400)
  const code = /^\d{5,12}$/.test(String(body.code || '')) ? String(body.code) : null
  const { DB } = c.env
  await ensureAcquisitionTables(DB)
  await DB.prepare('INSERT INTO acquisition_landings (src, region_code) VALUES (?, ?)')
    .bind(src, code).run().catch(() => null)
  return c.json({ success: true })
})

acquisitionRoutes.post('/claim', rateLimit({ action: 'acq_claim', max: 10, windowSec: 300 }), requireAuth(), async (c) => {
  const user = getCurrentUser(c)
  if (!user) return c.json({ success: false, error: '로그인 필요' }, 401)
  const body = await c.req.json<{ src?: string; code?: string; landed_at?: string }>().catch(() => ({} as Record<string, never>))
  const src = normalizeAcqSource(body.src)
  if (!src) return c.json({ success: false, error: '소스 식별자는 소문자/숫자/하이픈 1~40자' }, 400)
  const code = /^\d{5,12}$/.test(String(body.code || '')) ? String(body.code) : null
  // landed_at 은 클라 first-touch 시각 (검증: ISO 형태 앞 25자만, 미래/쓰레기는 서버시각 폴백)
  const landedRaw = String(body.landed_at || '').slice(0, 25)
  const landedAt = /^\d{4}-\d{2}-\d{2}/.test(landedRaw) ? landedRaw : null
  const { DB } = c.env
  await ensureAcquisitionTables(DB)
  const r = await DB.prepare(
    `INSERT OR IGNORE INTO user_acquisition (user_id, src, region_code, landed_at)
     VALUES (?, ?, ?, COALESCE(?, datetime('now')))`,
  ).bind(String(user.id), src, code, landedAt).run().catch(() => null)
  return c.json({ success: true, data: { claimed: (r?.meta?.changes ?? 0) > 0 } })
})
