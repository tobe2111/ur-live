/**
 * 📝 2026-07-01 블로그 SEO 보조 라우트 (공개, 최상위 경로 — /api 아님 = robots Allow).
 *   - GET /blog/og/:slug  → 글별 동적 공유 배너(SVG 1200x630). og:image 용.
 *   - GET /blog/rss       → 발행 글 RSS 2.0 피드(구독·수집기·검색 노출).
 * 사이트 기본 OG 가 이미 SVG(og-image.svg)라 SVG 배너는 동일 호환 + 글별로 개선.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

const app = new Hono<{ Bindings: Env }>()

function xmlEscape(s: string): string {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

// 제목을 줄당 최대 글자수로 접기(한글 폭 고려). 최대 maxLines, 넘치면 말줄임.
function wrapTitle(title: string, perLine = 16, maxLines = 3): string[] {
  const words = String(title || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    if (!cur) { cur = w }
    else if ((cur + ' ' + w).length <= perLine) { cur += ' ' + w }
    else { lines.push(cur); cur = w }
    if (lines.length >= maxLines) break
  }
  if (cur && lines.length < maxLines) lines.push(cur)
  if (lines.length >= maxLines) {
    // 남은 단어가 있으면 마지막 줄 말줄임
    const consumed = lines.join(' ').split(/\s+/).length
    if (consumed < words.length) lines[maxLines - 1] = (lines[maxLines - 1] || '').replace(/.{0,2}$/, '…')
  }
  return lines.slice(0, maxLines)
}

// ── 글별 동적 공유 배너 (SVG) ──────────────────────────────────
app.get('/blog/og/:slug', async (c) => {
  const slug = c.req.param('slug').replace(/\.svg$/i, '')
  let title = '유어딜 블로그'
  let tags: string[] = []
  try {
    const row = await c.env.DB.prepare(
      `SELECT title, tags FROM blog_posts WHERE slug = ? AND is_published = 1`
    ).bind(slug).first<{ title: string; tags: string }>()
    if (row?.title) title = row.title
    if (row?.tags) { try { tags = JSON.parse(row.tags) } catch { tags = [] } }
  } catch { /* fallback 기본값 */ }

  const lines = wrapTitle(title, 16, 3)
  const tagText = tags.slice(0, 3).map((t) => `#${t}`).join('   ')
  const titleSvg = lines
    .map((ln, i) => `<text x="90" y="${260 + i * 84}" font-size="66" font-weight="800" fill="#ffffff">${xmlEscape(ln)}</text>`)
    .join('')

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0b0b0d"/>
  <rect x="0" y="0" width="12" height="630" fill="#ec4899"/>
  <text x="90" y="140" font-size="34" font-weight="700" fill="#ec4899" letter-spacing="2">유어딜 블로그</text>
  ${titleSvg}
  <text x="90" y="560" font-size="30" font-weight="600" fill="#9ca3af">${xmlEscape(tagText)}</text>
  <text x="1110" y="560" font-size="28" font-weight="700" fill="#6b7280" text-anchor="end">live.ur-team.com</text>
</svg>`

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
})

// ── 블로그 RSS 2.0 피드 ────────────────────────────────────────
app.get('/blog/rss', async (c) => {
  const origin = new URL(c.req.url).origin
  let items = ''
  try {
    const rows = await c.env.DB.prepare(
      `SELECT slug, title, summary, published_at FROM blog_posts WHERE is_published = 1 ORDER BY published_at DESC LIMIT 30`
    ).all<{ slug: string; title: string; summary: string; published_at: string }>()
    items = (rows.results || []).map((p) => {
      const link = `${origin}/blog/${p.slug}`
      const date = p.published_at ? new Date(p.published_at).toUTCString() : ''
      return `    <item>
      <title>${xmlEscape(p.title)}</title>
      <link>${xmlEscape(link)}</link>
      <guid isPermaLink="true">${xmlEscape(link)}</guid>
      <description>${xmlEscape(p.summary || '')}</description>${date ? `\n      <pubDate>${date}</pubDate>` : ''}
    </item>`
    }).join('\n')
  } catch { /* 비어도 유효한 피드 반환 */ }

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>유어딜 블로그</title>
    <link>${origin}/blog</link>
    <description>이용권·교환권·동네딜·링크샵 가이드와 서비스 소식</description>
    <language>ko</language>
${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
    },
  })
})

export { app as blogSeoRoutes }
