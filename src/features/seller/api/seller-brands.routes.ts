/**
 * 🏷️ 브랜드로 묶기 — 셀러(본사·점주) 쪽 API (2026-10-17 대표 "응응 다 해줘")
 *
 *   GET    /brands/mine                 — 내가 만든 브랜드 + 지점 id
 *   POST   /brands                      — 브랜드 만들기 { name, slug? }
 *   POST   /brands/:id/stores           — 지점 넣기 { seller_id }
 *   DELETE /brands/stores/:sellerId     — 지점 빼기(브랜드 만든 사람 또는 그 지점 주인)
 *   GET    /products/:id/brand-wide     — 🏷️ 2026-10-18 이 이용권을 같은 주인 지점에서도 쓰게 할 수 있나 + 지금 값
 *   PUT    /products/:id/brand-wide     — 켜기/끄기 { enabled } (판 지점 주인만)
 *   GET    /cross-owner-accept          — 🏷️ 3단계 지금 좌석의 지점이 다른 점주 이용권을 받나 + 게이트 상태
 *   PUT    /cross-owner-accept          — 켜기/끄기 { enabled } (그 지점 주인만 — 결재 ①)
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
import { BRAND_WIDE_META_KEY, checkBrandWideSettable, isBrandWideEnabled, STORE_OWNER_SQL } from '@/worker/utils/brand-wide-redeem'
import { CROSS_OWNER_ACCEPT_META, isCrossOwnerAccepting, isCrossOwnerRedeemEnabled } from '@/worker/utils/brand-cross-owner'
import { setSellerMeta } from '@/worker/utils/seller-meta'
import { getSellerIdFromToken } from '@/lib/seller-shared'
import { setSupplyMeta } from '@/worker/utils/product-supply-meta'

type Ctx = Context<{ Bindings: Env }>

const BRAND_WIDE_ERRORS: Record<string, string> = {
  NOT_OWNER: '이 지점의 주인만 바꿀 수 있어요',
  NO_BRAND: '먼저 매장 관리에서 지점들을 한 브랜드로 묶어 주세요',
  NO_SAME_OWNER_BRANCH: '받아 줄 지점이 없어요. 주인이 같은 지점이나, "다른 점주 이용권 받기"를 켠 가맹점이 있어야 해요',
}

/** 이용권과 그 판 지점 — 없거나 지점이 없는 상품(플랫폼 상품)은 null. */
async function voucherStore(db: D1Database, productId: number): Promise<number | null> {
  if (!Number.isFinite(productId) || productId <= 0) return null
  const r = await db.prepare('SELECT seller_id FROM products WHERE id = ? LIMIT 1').bind(productId)
    .first<{ seller_id: number | null }>().catch(() => null)
  return r?.seller_id ? Number(r.seller_id) : null
}

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

  app.get('/products/:id/brand-wide', async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const productId = Number(c.req.param('id'))
      const sellerId = await voucherStore(c.env.DB, productId)
      if (!sellerId) return c.json({ success: false, error: '이용권을 찾을 수 없습니다' }, 404)
      const [enabled, settable] = await Promise.all([
        isBrandWideEnabled(c.env.DB, productId),
        checkBrandWideSettable(c.env.DB, userId, sellerId),
      ])
      return c.json({
        success: true,
        data: settable.ok
          ? { enabled, settable: true, accepting_count: settable.acceptingCount,
              same_owner_count: settable.sameOwnerCount, cross_owner_count: settable.crossOwnerCount }
          : { enabled, settable: false, code: settable.code, reason: BRAND_WIDE_ERRORS[settable.code] },
      })
    } catch (err) {
      return safeError(c, err, '설정을 불러오지 못했습니다', '[seller-brands]')
    }
  })

  app.put('/products/:id/brand-wide', rateLimit({ action: 'brand_wide_set', max: 60, windowSec: 3600 }), async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const productId = Number(c.req.param('id'))
      const sellerId = await voucherStore(c.env.DB, productId)
      if (!sellerId) return c.json({ success: false, error: '이용권을 찾을 수 없습니다' }, 404)
      const b = await c.req.json<{ enabled?: unknown }>().catch(() => ({} as { enabled?: unknown }))
      if (typeof b.enabled !== 'boolean') return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
      const settable = await checkBrandWideSettable(c.env.DB, userId, sellerId)
      // 끄는 것도 주인만 — 켜기와 같은 결정권(그 지점의 손님 약속을 바꾸는 일이다).
      if (!settable.ok && (b.enabled || settable.code === 'NOT_OWNER')) {
        return c.json({ success: false, code: settable.code, error: BRAND_WIDE_ERRORS[settable.code] }, settable.code === 'NOT_OWNER' ? 403 : 409)
      }
      await setSupplyMeta(c.env.DB, productId, { [BRAND_WIDE_META_KEY]: b.enabled ? '1' : '0' })
      return c.json({ success: true, data: { enabled: b.enabled } })
    } catch (err) {
      return safeError(c, err, '설정을 바꾸지 못했습니다', '[seller-brands]')
    }
  })

  /** 이 지점의 주인인가 — 받기 동의(①)는 그 지점 주인만 정한다(운영자 X). */
  async function isStoreOwner(db: D1Database, sellerId: number, userId: number): Promise<boolean> {
    if (!Number.isFinite(sellerId) || sellerId <= 0) return false
    const r = await db.prepare(`SELECT ${STORE_OWNER_SQL} AS owner_id FROM sellers s WHERE s.id = ? LIMIT 1`)
      .bind(sellerId).first<{ owner_id: number | null }>().catch(() => null)
    return r?.owner_id != null && Number(r.owner_id) === Number(userId)
  }

  app.get('/cross-owner-accept', async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      // 지점은 지금 좌석(셀러 토큰)의 지점 — 화면이 id 를 따로 들고 다니지 않는다(낡은 localStorage 로 남의 지점을 보지 않게).
      const sellerId = Number(await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET))
      if (!(await isStoreOwner(c.env.DB, sellerId, userId))) return c.json({ success: false, error: '이 지점의 주인만 볼 수 있어요' }, 403)
      const [enabled, gate] = await Promise.all([isCrossOwnerAccepting(c.env.DB, sellerId), isCrossOwnerRedeemEnabled(c.env.DB)])
      // gate=false 면 화면은 토글을 숨긴다 — 켜 둬도 아무 일도 안 하는 스위치를 보여 주지 않는다.
      return c.json({ success: true, data: { enabled, available: gate } })
    } catch (err) {
      return safeError(c, err, '설정을 불러오지 못했습니다', '[seller-brands]')
    }
  })

  app.put('/cross-owner-accept', rateLimit({ action: 'cross_owner_accept_set', max: 30, windowSec: 3600 }), async (c) => {
    try {
      const userId = await resolveActorUserId(c)
      if (!userId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
      const sellerId = Number(await getSellerIdFromToken(c.req.header('Authorization'), c.env.JWT_SECRET))
      const b = await c.req.json<{ enabled?: unknown }>().catch(() => ({} as { enabled?: unknown }))
      if (typeof b.enabled !== 'boolean') return c.json({ success: false, error: '잘못된 요청입니다' }, 400)
      if (!(await isStoreOwner(c.env.DB, sellerId, userId))) return c.json({ success: false, error: '이 지점의 주인만 바꿀 수 있어요' }, 403)
      // 켜는 것은 게이트가 열려 있을 때만. 끄는 것은 언제나 된다(점주가 빠져나갈 길은 막지 않는다).
      if (b.enabled && !(await isCrossOwnerRedeemEnabled(c.env.DB))) {
        return c.json({ success: false, code: 'NOT_AVAILABLE', error: '아직 열리지 않은 기능이에요' }, 409)
      }
      await setSellerMeta(c.env.DB, sellerId, { [CROSS_OWNER_ACCEPT_META]: b.enabled ? '1' : '0' })
      return c.json({ success: true, data: { enabled: b.enabled } })
    } catch (err) {
      return safeError(c, err, '설정을 바꾸지 못했습니다', '[seller-brands]')
    }
  })
}
