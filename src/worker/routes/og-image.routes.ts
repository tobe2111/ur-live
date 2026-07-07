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
  etc_voucher: '🎫',
}

// 🏷️ 2026-07-07: 카테고리 라벨(이용권 명칭 SSOT 대칭 — "식사/미용/…")
const CATEGORY_LABEL: Record<string, string> = {
  meal_voucher: '식사 이용권',
  beauty_voucher: '미용 이용권',
  health_voucher: '건강 이용권',
  pet_voucher: '반려 이용권',
  stay_voucher: '숙소 이용권',
  activity_voucher: '액티비티 이용권',
  etc_voucher: '이용권',
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

/** 상대 이미지 URL → 절대 (Kakao/OG 스크래퍼가 fetch 가능하게). http 아니면 origin 접두. */
function absImageUrl(raw: string | null, origin: string): string {
  const s = String(raw || '')
  if (!s) return ''
  if (s.startsWith('http')) return s
  if (s.startsWith('/')) return `${origin}${s}`
  return ''
}

/**
 * 🔎 2026-07-07 (대표 "이용권 메인 이미지 + 이용권 문구로"): 즉시판매 이용권 모델에 맞춰 재설계.
 *   좌측 = 매장 실사진(네이버지도/사장 업로드) 히어로 + 우측 = 이용권 라벨·매장명·상품명·가격·할인.
 *   폐기: 공동구매 진행바/목표 N명/참여중/딜~ (동적 tier 모델 잔재 — 즉시판매엔 부정확).
 */
function generateSVG(p: ProductForOG, imageAbs: string): string {
  const emoji = CATEGORY_EMOJI[p.category] || '🎫'
  const label = CATEGORY_LABEL[p.category] || '이용권'
  const maxDiscount = getMaxTierDiscount(p.group_buy_tiers)
  // 상품명 2줄 wrap (한 줄 ~13자)
  const name = p.name
  const line1 = name.length > 13 ? name.slice(0, 13) : name
  const line2 = name.length > 13 ? (name.length > 25 ? name.slice(13, 24) + '…' : name.slice(13)) : ''
  const store = (p.restaurant_name || '').length > 22 ? (p.restaurant_name || '').slice(0, 21) + '…' : (p.restaurant_name || '')
  const hasPhoto = !!imageAbs

  const photoPanel = hasPhoto
    ? `<clipPath id="photoClip"><rect x="0" y="0" width="520" height="630"/></clipPath>
       <image href="${escapeXml(imageAbs)}" x="0" y="0" width="520" height="630" clip-path="url(#photoClip)" preserveAspectRatio="xMidYMid slice"/>`
    : `<rect x="0" y="0" width="520" height="630" fill="#F3F4F6"/>
       <text x="260" y="345" font-size="140" text-anchor="middle" font-family="-apple-system,system-ui,sans-serif">${emoji}</text>`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <!-- 배경 -->
  <rect width="1200" height="630" fill="#FFFFFF"/>

  <!-- 좌측 매장 실사진 히어로 -->
  ${photoPanel}

  <!-- 우측 텍스트 패널 -->
  <g>
    <!-- 이용권 라벨 pill -->
    <rect x="580" y="80" width="${170 + label.length * 6}" height="52" rx="26" fill="#111827"/>
    <text x="606" y="115" font-size="26" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#FFFFFF">${emoji} ${escapeXml(label)}</text>

    <!-- 매장명 -->
    ${store ? `<text x="580" y="200" font-size="30" font-family="-apple-system,system-ui,sans-serif" font-weight="600" fill="#6B7280">${escapeXml(store)}</text>` : ''}

    <!-- 상품명 (최대 2줄) -->
    <text x="580" y="278" font-size="60" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#111827">${escapeXml(line1)}</text>
    ${line2 ? `<text x="580" y="348" font-size="60" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#111827">${escapeXml(line2)}</text>` : ''}

    <!-- 가격 + 할인 배지 -->
    <text x="580" y="${line2 ? 450 : 420}" font-size="58" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#111827">${p.price.toLocaleString('ko-KR')}<tspan font-size="34" font-weight="700" fill="#6B7280">원</tspan></text>
    ${maxDiscount > 0 ? `<rect x="${580 + String(p.price.toLocaleString('ko-KR')).length * 34 + 60}" y="${line2 ? 408 : 378}" width="164" height="54" rx="27" fill="#DC2626"/>
    <text x="${580 + String(p.price.toLocaleString('ko-KR')).length * 34 + 142}" y="${line2 ? 446 : 416}" font-size="28" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#FFFFFF" text-anchor="middle">${maxDiscount}% 할인</text>` : ''}

    <!-- 사용 안내 -->
    <text x="580" y="${line2 ? 520 : 490}" font-size="26" font-family="-apple-system,system-ui,sans-serif" font-weight="600" fill="#374151">📍 매장에서 QR·코드로 바로 사용</text>
  </g>

  <!-- 하단 브랜드 -->
  <text x="580" y="588" font-size="24" font-family="-apple-system,system-ui,sans-serif" font-weight="800" fill="#9CA3AF">유어딜 · live.ur-team.com</text>
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
  const safeBio = escapeXml((curator.bio || `${curator.name}의 큐레이션 링크샵`).slice(0, 80))
  const profile = curator.profile_image
    ? `<image href="${escapeXml(curator.profile_image)}" x="80" y="80" width="160" height="160" clip-path="url(#cprofile)" preserveAspectRatio="xMidYMid slice"/>`
    : `<circle cx="160" cy="160" r="80" fill="#1A1A1A"/>
       <text x="160" y="180" font-size="60" font-family="sans-serif" font-weight="800" fill="#6b7280" text-anchor="middle">${escapeXml((curator.name || '?').slice(0, 1))}</text>`

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

  <text x="80" y="540" font-size="20" font-family="-apple-system,system-ui,sans-serif" font-weight="700" fill="#6b7280">유어딜 링크샵</text>
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
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#f3f4f6"/><text x="600" y="315" font-size="48" font-family="sans-serif" fill="#6b7280" text-anchor="middle">유어딜 공동구매</text></svg>',
        { status: 404, headers: { 'Content-Type': 'image/svg+xml' } }
      )
    }

    const origin = new URL(c.req.url).origin
    const svg = generateSVG(product, absImageUrl(product.image_url, origin))
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
