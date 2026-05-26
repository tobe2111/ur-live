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

const ogRoutes = new Hono<{ Bindings: Env }>()

interface ProductForOG {
  id: number
  name: string
  category: string
  image_url: string | null
  price: number
  restaurant_name: string | null
  group_buy_target: number
  group_buy_current: number
  group_buy_status: string
  group_buy_tiers: string | null
}

const CATEGORY_EMOJI: Record<string, string> = {
  meal_voucher: '🍽️',
  beauty_voucher: '💇',
  health_voucher: '💪',
  pet_voucher: '🐶',
  stay_voucher: '🏨',
  activity_voucher: '🎯',
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

function getMaxTierDiscount(tiersJson: string | null): number {
  if (!tiersJson) return 0
  try {
    const arr = JSON.parse(tiersJson) as Array<{ min: number; discount_pct: number }>
    if (!Array.isArray(arr) || arr.length === 0) return 0
    return Math.max(...arr.map(t => t.discount_pct || 0))
  } catch { return 0 }
}

function generateSVG(p: ProductForOG): string {
  const emoji = CATEGORY_EMOJI[p.category] || '🎫'
  const progress = p.group_buy_target > 0
    ? Math.min(100, Math.round((p.group_buy_current / p.group_buy_target) * 100))
    : 0
  const maxDiscount = getMaxTierDiscount(p.group_buy_tiers)
  const isAchieved = p.group_buy_status === 'achieved'
  const remaining = Math.max(0, p.group_buy_target - p.group_buy_current)
  const truncatedName = p.name.length > 32 ? p.name.slice(0, 30) + '…' : p.name
  const truncatedRestaurant = (p.restaurant_name || '').length > 28
    ? (p.restaurant_name || '').slice(0, 26) + '…'
    : (p.restaurant_name || '')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#FCE7F3"/>
      <stop offset="100%" stop-color="#FFFFFF"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#EC4899"/>
      <stop offset="100%" stop-color="#F43F5E"/>
    </linearGradient>
  </defs>

  <!-- 배경 -->
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- 좌측 80px 핑크 바 -->
  <rect x="0" y="0" width="14" height="630" fill="url(#accent)"/>

  <!-- 카테고리 emoji + 라벨 -->
  <text x="80" y="120" font-size="80" font-family="-apple-system,BlinkMacSystemFont,system-ui,sans-serif">${emoji}</text>
  <text x="190" y="100" font-size="20" font-family="-apple-system,system-ui,sans-serif" font-weight="700" fill="#EC4899" letter-spacing="3">공동구매</text>
  ${truncatedRestaurant ? `<text x="190" y="130" font-size="22" font-family="-apple-system,system-ui,sans-serif" font-weight="500" fill="#6B7280">${escapeXml(truncatedRestaurant)}</text>` : ''}

  <!-- 상품명 (큰 글씨) -->
  <text x="80" y="220" font-size="62" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#111827">${escapeXml(truncatedName)}</text>

  <!-- 가격 + 할인 -->
  <text x="80" y="310" font-size="56" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="url(#accent)">${p.price.toLocaleString('ko-KR')}<tspan font-size="32" font-weight="700">딜~</tspan></text>
  ${maxDiscount > 0 ? `
  <rect x="380" y="265" width="180" height="56" rx="28" fill="#EC4899"/>
  <text x="470" y="304" font-size="28" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#FFFFFF" text-anchor="middle">최대 ${maxDiscount}% 할인</text>` : ''}

  <!-- 진행 현황 박스 -->
  <rect x="80" y="380" width="1040" height="160" rx="20" fill="#FFFFFF" stroke="#FBCFE8" stroke-width="2"/>

  <text x="110" y="425" font-size="24" font-family="-apple-system,system-ui,sans-serif" font-weight="700" fill="#374151">
    ${isAchieved ? '🎉 공구 성공!' : remaining === 1 ? '🔥 1명만 더 모이면 성공!' : `${p.group_buy_current}명 참여중 · ${remaining}명 남음`}
  </text>
  <text x="1090" y="425" font-size="40" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#EC4899" text-anchor="end">${progress}%</text>

  <!-- 진행 바 -->
  <rect x="110" y="450" width="980" height="20" rx="10" fill="#F3F4F6"/>
  <rect x="110" y="450" width="${Math.max(20, 980 * progress / 100)}" height="20" rx="10" fill="${isAchieved ? '#10B981' : 'url(#accent)'}"/>

  <!-- 목표 텍스트 -->
  <text x="110" y="510" font-size="18" font-family="-apple-system,system-ui,sans-serif" fill="#9CA3AF">목표 ${p.group_buy_target}명</text>

  <!-- 우측 하단 브랜드 -->
  <text x="1120" y="600" font-size="22" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#9CA3AF" text-anchor="end">유어딜 · live.ur-team.com</text>
</svg>`
}

// ============================================================
// 큐레이터 OG image (migration 0278, 2026-05-25)
// 1200×630 SVG — 큐레이터 핸들 + 닉네임 + bio + 핀 thumbnail grid (top 4)
// ============================================================
interface CuratorForOG {
  id: number
  handle: string
  name: string
  bio: string | null
  profile_image: string | null
}

function generateCuratorSVG(curator: CuratorForOG, pinThumbs: string[]): string {
  const safeName = escapeXml(curator.name || curator.handle)
  const safeHandle = escapeXml(curator.handle)
  const safeBio = escapeXml((curator.bio || `${curator.name} 의 큐레이션 링크샵`).slice(0, 80))
  const profile = curator.profile_image
    ? `<image href="${escapeXml(curator.profile_image)}" x="80" y="80" width="160" height="160" clip-path="url(#cprofile)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="160" cy="160" r="80" fill="#1A1A1A"/>
       <text x="160" y="180" font-size="60" font-family="sans-serif" font-weight="800" fill="#EC4899" text-anchor="middle">${escapeXml((curator.name || '?').slice(0, 1))}</text>`

  // 핀 thumbnail grid — 우측 4칸 (2x2)
  const tiles = [0, 1, 2, 3].map(i => {
    const url = pinThumbs[i]
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 720 + col * 240
    const y = 80 + row * 240
    return url
      ? `<image href="${escapeXml(url)}" x="${x}" y="${y}" width="220" height="220" preserveAspectRatio="xMidYMid slice"/>`
      : `<rect x="${x}" y="${y}" width="220" height="220" fill="#121212" rx="12"/>`
  }).join('\n  ')

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <clipPath id="cprofile"><circle cx="160" cy="160" r="80"/></clipPath>
  </defs>
  <rect width="1200" height="630" fill="#020202"/>
  <rect x="40" y="40" width="1120" height="550" fill="#0A0A0A" rx="24" stroke="#1A1A1A" stroke-width="2"/>

  ${profile}

  <text x="280" y="140" font-size="44" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#FFFFFF">${safeName}</text>
  <text x="280" y="180" font-size="24" font-family="-apple-system,system-ui,sans-serif" fill="#9CA3AF">@${safeHandle}</text>
  <text x="280" y="240" font-size="20" font-family="-apple-system,system-ui,sans-serif" fill="#D1D5DB">${safeBio}</text>

  ${tiles}

  <text x="80" y="540" font-size="20" font-family="-apple-system,system-ui,sans-serif" font-weight="700" fill="#EC4899">유어딜 링크샵</text>
  <text x="1120" y="540" font-size="18" font-family="-apple-system,system-ui,sans-serif" fill="#9CA3AF" text-anchor="end">live.ur-team.com/u/${safeHandle}</text>
</svg>`
}

ogRoutes.get('/curator/:handle', async (c) => {
  const { DB } = c.env
  const handleRaw = c.req.param('handle').replace(/\.(png|jpg|svg)$/, '').toLowerCase()

  try {
    const curator = await DB.prepare(
      `SELECT id, handle, name, bio, profile_image FROM users WHERE handle = ? LIMIT 1`,
    ).bind(handleRaw).first<CuratorForOG>()

    if (!curator) {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#020202"/><text x="600" y="315" font-size="48" font-family="sans-serif" fill="#9CA3AF" text-anchor="middle">큐레이터를 찾을 수 없어요</text></svg>',
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

    const svg = generateCuratorSVG(curator, thumbs)
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
      SELECT id, name, category, image_url, price, restaurant_name,
             group_buy_target, group_buy_current, group_buy_status, group_buy_tiers
      FROM products
      WHERE id = ? AND category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
    `).bind(id).first<ProductForOG>()

    if (!product) {
      // fallback: 빈 placeholder SVG
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#FCE7F3"/><text x="600" y="315" font-size="48" font-family="sans-serif" fill="#EC4899" text-anchor="middle">유어딜 공동구매</text></svg>',
        { status: 404, headers: { 'Content-Type': 'image/svg+xml' } }
      )
    }

    const svg = generateSVG(product)
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
