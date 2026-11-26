/**
 * 🌍 해외 거주 소개자 — 받는 곳 등록 (2026-11-26). SSOT `worker/utils/overseas-payee.ts`.
 *   GET    /api/influencer-settlement/overseas   등록 상태(가린 값만) + 적용 원천징수율
 *   PUT    /api/influencer-settlement/overseas   {country, legal_name_en, method, currency, destination} — 암호화 저장(키 없으면 503)
 *   DELETE /api/influencer-settlement/overseas   국내로 받기로 돌아간다
 * influencerApp(requireAuth) 인스턴스에 얹는다 — 본인 것만(user id = 토큰).
 */
import type { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { saveOverseasPayee, getOverseasPayee, removeOverseasPayee, loadOverseasWithholdingPct, OverseasPayeeError } from '@/worker/utils/overseas-payee'
import { safeError } from '@/worker/utils/safe-error'

type Vars = { user?: { id: string | number } }

export function registerOverseasPayeeRoutes(influencerApp: Hono<{ Bindings: Env; Variables: Vars }>) {
  influencerApp.get('/overseas', async (c) => {
    try {
      const uid = String(c.get('user')?.id ?? '')
      if (!uid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const [status, pct] = await Promise.all([getOverseasPayee(c.env.DB, 'influencer', uid), loadOverseasWithholdingPct(c.env.DB)])
      return c.json({ success: true, data: { ...status, withholding_pct: pct } })
    } catch (err) {
      return safeError(c, err, '정보를 불러오지 못했습니다', '[overseas-payee]')
    }
  })
  influencerApp.put('/overseas', rateLimit({ action: 'influencer_overseas_payee', max: 10, windowSec: 3600 }), async (c) => {
    try {
      const uid = String(c.get('user')?.id ?? '')
      if (!uid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const b = await c.req.json().catch(() => ({})) as { country?: unknown; legal_name_en?: unknown; method?: unknown; currency?: unknown; destination?: Record<string, unknown> }
      const r = await saveOverseasPayee(c.env.DB, c.env.DATA_ENCRYPTION_KEY, 'influencer', uid, {
        country: b.country, legalNameEn: b.legal_name_en, method: b.method, currency: b.currency, destination: b.destination,
      })
      return c.json({ success: true, data: r })
    } catch (err) {
      if (err instanceof OverseasPayeeError) return c.json({ success: false, code: err.code, error: err.message }, err.code === 'NO_KEY' ? 503 : 400)
      return safeError(c, err, '저장하지 못했습니다', '[overseas-payee]')
    }
  })
  influencerApp.delete('/overseas', async (c) => {
    try {
      const uid = String(c.get('user')?.id ?? '')
      if (!uid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      await removeOverseasPayee(c.env.DB, 'influencer', uid)
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '처리하지 못했습니다', '[overseas-payee]')
    }
  })
}
