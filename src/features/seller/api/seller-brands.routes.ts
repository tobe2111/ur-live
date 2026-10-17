/**
 * 🏷️ 브랜드로 묶기 — 셀러(본사·점주) 쪽 API (2026-10-17 대표 "응응 다 해줘")
 *
 *   GET    /brands/mine                 — 내가 만든 브랜드 + 지점 id
 *   POST   /brands                      — 브랜드 만들기 { name, slug? }
 *   POST   /brands/:id/stores           — 지점 넣기 { seller_id }
 *   DELETE /brands/stores/:sellerId     — 지점 빼기(브랜드 만든 사람 또는 그 지점 주인)
 *
 * 규칙은 `store-brands.ts` 머리말(대표 확정 — 지점 단위, 그 지점 주인이 정한다). 이 파일은 배선뿐이다.
 * 💰 돈 안 움직임.
 */
import type { Hono, Context } from 'hono'
import type { Env } from '@/worker/types/env'
import { safeError } from '@/worker/utils/safe-error'
import { rateLimit } from '@/worker/middleware/rate-limit'
import {
  addStoreToBrand, createBrand, listMyBrands, normalizeBrandName, normalizeBrandSlug, randomBrandSlug, removeStoreFromBrand,
} from '@/worker/utils/store-brands'

type Ctx = Context<{ Bindings: Env }>

const ADD_ERRORS: Record<string, [number, string]> = {
  NO_BRAND: [404, '브랜드를 찾을 수 없습니다'],
  NOT_BRAND_OWNER: [403, '브랜드를 만든 사람만 지점을 넣을 수 있어요'],
  NOT_OPERATOR: [403, '운영 권한이 있는 지점만 넣을 수 있어요. 가맹점은 점주가 먼저 운영자로 들여야 해요'],
  IN_OTHER_BRAND: [409, '이미 다른 브랜드에 묶인 지점이에요. 그 지점 주인이 먼저 빼야 해요'],
}

export function registerBrandRoutes(app: Hono<{ Bindings: Env }>, resolveActorUserId: (c: Ctx) => Promise<number | null>) {
  app.get('/brands/mine', async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      return c.json({ success: true, data: await listMyBrands(c.env.DB, userId) })
    } catch (err) {
      return safeError(c, err, '브랜드를 불러오지 못했습니다', '[seller-brands]')
    }
  })

  app.post('/brands', rateLimit({ action: 'brand_create', max: 10, windowSec: 3600 }), async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const b = await c.req.json<{ name?: string; slug?: string }>().catch(() => ({} as { name?: string; slug?: string }))
      const name = normalizeBrandName(b.name)
      if (!name) return c.json({ success: false, error: '브랜드 이름을 입력해 주세요 (40자 이내)' }, 400)
      const wanted = String(b.slug ?? '').trim()
      const slug = wanted ? normalizeBrandSlug(wanted) : randomBrandSlug()
      if (!slug) return c.json({ success: false, error: '주소는 영문 소문자·숫자·하이픈 3~30자예요' }, 400)
      const r = await createBrand(c.env.DB, userId, name, slug)
      if (!r.ok) return c.json({ success: false, code: 'SLUG_TAKEN', error: '이미 쓰는 주소예요. 다른 주소를 골라 주세요' }, 409)
      return c.json({ success: true, data: r.brand }, 201)
    } catch (err) {
      return safeError(c, err, '브랜드를 만들지 못했습니다', '[seller-brands]')
    }
  })

  app.post('/brands/:id/stores', async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const brandId = Number(c.req.param('id'))
      const b = await c.req.json<{ seller_id?: number }>().catch(() => ({} as { seller_id?: number }))
      const sellerId = Number(b.seller_id)
      if (!Number.isFinite(brandId) || brandId <= 0 || !Number.isFinite(sellerId) || sellerId <= 0) {
        return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
      }
      const r = await addStoreToBrand(c.env.DB, userId, brandId, sellerId)
      if (!r.ok) {
        const [status, error] = ADD_ERRORS[r.code] ?? [400, '지점을 넣지 못했어요']
        return c.json({ success: false, code: r.code, error }, status as 400 | 403 | 404 | 409)
      }
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '지점을 넣지 못했습니다', '[seller-brands]')
    }
  })

  app.delete('/brands/stores/:sellerId', async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const sellerId = Number(c.req.param('sellerId'))
      if (!Number.isFinite(sellerId) || sellerId <= 0) return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
      const r = await removeStoreFromBrand(c.env.DB, userId, sellerId)
      if (!r.ok) {
        return r.code === 'FORBIDDEN'
          ? c.json({ success: false, error: '브랜드를 만든 사람이나 그 지점 주인만 뺄 수 있어요' }, 403)
          : c.json({ success: false, error: '브랜드에 묶인 지점이 아니에요' }, 404)
      }
      return c.json({ success: true })
    } catch (err) {
      return safeError(c, err, '지점을 빼지 못했습니다', '[seller-brands]')
    }
  })
}
