/**
 * 🪪 소개자(개인) 주민등록번호 등록 — 간이지급명세서 제출용 (2026-11-25). SSOT `worker/utils/payee-tax-id.ts`.
 *   GET /api/influencer-settlement/tax-id   등록 여부(가린 값만)
 *   PUT /api/influencer-settlement/tax-id   {legal_name, rrn} — 암호화 저장(키 없으면 503, 평문 저장 안 함)
 * influencerApp(requireAuth) 인스턴스에 얹는다 — 본인 것만 읽고 쓴다(user id = 토큰).
 */
import type { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { rateLimit } from '@/worker/middleware/rate-limit'
import { saveTaxId, getTaxIdStatus, TaxIdError } from '@/worker/utils/payee-tax-id'
import { safeError } from '@/worker/utils/safe-error'

type Vars = { user?: { id: string | number } }

export function registerTaxIdRoutes(influencerApp: Hono<{ Bindings: Env; Variables: Vars }>) {
  influencerApp.get('/tax-id', async (c) => {
    try {
      const uid = String(c.get('user')?.id ?? '')
      if (!uid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      return c.json({ success: true, data: await getTaxIdStatus(c.env.DB, 'influencer', uid) })
    } catch (err) {
      return safeError(c, err, '정보를 불러오지 못했습니다', '[tax-id]')
    }
  })
  influencerApp.put('/tax-id', rateLimit({ action: 'influencer_tax_id', max: 10, windowSec: 3600 }), async (c) => {
    try {
      const uid = String(c.get('user')?.id ?? '')
      if (!uid) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const body = await c.req.json().catch(() => ({})) as { legal_name?: unknown; rrn?: unknown }
      const r = await saveTaxId(c.env.DB, c.env.DATA_ENCRYPTION_KEY, 'influencer', uid, body.legal_name, body.rrn)
      return c.json({ success: true, data: r })
    } catch (err) {
      if (err instanceof TaxIdError) return c.json({ success: false, code: err.code, error: err.message }, err.code === 'NO_KEY' ? 503 : 400)
      return safeError(c, err, '저장하지 못했습니다', '[tax-id]')
    }
  })
}
