/**
 * 🛡️ 2026-05-15: 동적 OG 이미지 generator (SVG → PNG/SVG response)
 *
 * 공동구매 detail page 의 카카오톡 / Twitter 공유용 1200x630 이미지.
 * Cloudflare Workers 는 native canvas 미지원 → SVG 직접 생성하여 image/svg+xml 응답.
 * 카카오/메타 OG 크롤러 모두 SVG 지원.
 *
 * GET /api/og/group-buy/:id  → image/svg+xml (1200x630)
 *
 * Edge cache: 1시간 (group_buy_current 가 자주 바뀌지만 OG image 는 share 시점만 중요)
 */

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { inlineImage } from '../utils/og-inline-image'
import { generateCuratorSVG, tileWidth, TILE_H, type CuratorForOG } from '../utils/og-curator-card'
import { generatePassCardSVG, PASS_PHOTO_W, PASS_PHOTO_H } from '../utils/og-pass-card'

const ogRoutes = new Hono<{ Bindings: Env }>()

interface ProductForOG {
  id: number
  name: string
  image_url: string | null
  restaurant_name: string | null
}

// ============================================================
// 큐레이터 OG image (migration 0278, 2026-05-25)
// 1200×630 SVG — 큐레이터 핸들 + 닉네임 + bio + 핀 thumbnail grid (top 4)
// ============================================================
ogRoutes.get('/curator/:handle', async (c) => {
  const { DB } = c.env
  const handleRaw = c.req.param('handle').replace(/\.(png|jpg|svg)$/, '').toLowerCase()

  try {
    const curator = await DB.prepare(
      `SELECT id, handle, name, bio, profile_image FROM users WHERE handle = ? LIMIT 1`,
    ).bind(handleRaw).first<CuratorForOG>()

    if (!curator) {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#11141C"/><text x="600" y="315" font-size="48" font-family="sans-serif" fill="#9CA3AF" text-anchor="middle">큐레이터를 찾을 수 없어요</text></svg>',
        { status: 404, headers: { 'Content-Type': 'image/svg+xml' } },
      )
    }

    const { results: pins } = await DB.prepare(
      `SELECT COALESCE(p.thumbnail, p.image_url) AS thumb
       FROM product_pins pp JOIN products p ON p.id = pp.product_id
       WHERE pp.user_id = ? AND p.is_active = 1
       ORDER BY pp.position ASC LIMIT 4`,
    ).bind(curator.id).all<{ thumb: string | null }>()
    const thumbs = (pins ?? []).map(r => r.thumb || '').filter(Boolean)

    // 🖼️ 2026-09-28: 사진을 **카드 안에 박아** 넣는다. 외부 `<image href>` 는 카톡이 안 그린다
    //   (그래서 라이브 카드가 새까맸다 — `og-inline-image.ts` 머리말에 실측을 적어 뒀다).
    //   전부 fail-soft: 못 받으면 null → 카드는 사진 없이 그려진다(빈 칸을 보여주지 않는다).
    const origin = new URL(c.req.url).origin
    //   받을 크기는 카드가 그릴 크기와 **같은 식**(`tileWidth`)으로 정한다 — 정사각으로 받아
    //   가로로 늘린 타일이 생기지 않게.
    const tw = Math.round(tileWidth(thumbs.length))
    const [profileUri, ...tileUris] = await Promise.all([
      inlineImage(curator.profile_image, origin, 232, 232),
      ...thumbs.map(t => inlineImage(t, origin, tw, TILE_H)),
    ])

    const svg = generateCuratorSVG(curator, profileUri, tileUris.filter((u): u is string => !!u))
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=1800, s-maxage=1800',
      },
    })
  } catch (err) {
    console.error('[og-image curator]', err)
    return c.text('error', 500)
  }
})

ogRoutes.get('/group-buy/:id', async (c) => {
  const { DB } = c.env
  const idRaw = c.req.param('id').replace(/\.(png|jpg|svg)$/, '')
  const id = Number(idRaw)
  if (!Number.isFinite(id) || id <= 0) {
    return c.text('invalid id', 400)
  }

  try {
    const product = await DB.prepare(`
      SELECT id, name, image_url, restaurant_name
      FROM products
      WHERE id = ? AND category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
    `).bind(id).first<ProductForOG>()

    if (!product) {
      // fallback: 빈 placeholder SVG
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#EAF1FE"/><text x="600" y="330" font-size="56" font-weight="800" font-family="sans-serif" fill="#16181C" text-anchor="middle">urdeal.</text></svg>',
        { status: 404, headers: { 'Content-Type': 'image/svg+xml' } }
      )
    }

    // 🦦 2026-10-09 (대표 확정 시안 ②): 사진을 카드 **안에** 박는다 — 외부 `<image href>` 는 카톡이 안 그린다
    //   (그래서 옛 카드의 사진 자리가 비어 있었다). 못 받으면 null → 사진 없는 판으로 그린다.
    const origin = new URL(c.req.url).origin
    const photoUri = await inlineImage(product.image_url, origin, PASS_PHOTO_W, PASS_PHOTO_H)
    const svg = generatePassCardSVG(product, photoUri)
    return new Response(svg, {
      headers: {
        'Content-Type': 'image/svg+xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    })
  } catch (err) {
    console.error('[og-image group-buy]', err)
    return c.text('error', 500)
  }
})

export { ogRoutes }
