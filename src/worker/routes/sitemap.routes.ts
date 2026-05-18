/**
 * Sitemap routes
 *
 * GET /sitemap.xml — SEO 검색엔진용 사이트맵 (정적 + 동적 URL)
 *
 * 🛡️ 2026-04-27: TD-006 partial split — worker/index.ts 인라인 핸들러 제거.
 */
import { Hono } from 'hono';
import type { Env } from '@/worker/types/env';

const sitemapRoutes = new Hono<{ Bindings: Env }>();

sitemapRoutes.get('/sitemap.xml', async (c) => {
  const origin = new URL(c.req.url).origin;
  const DB = c.env.DB as D1Database | undefined;
  const urls: Array<{ loc: string; priority: number; changefreq: string; image?: string; lastmod?: string }> = [
    // 정적 페이지
    { loc: '/', priority: 1.0, changefreq: 'daily' },
    { loc: '/browse', priority: 0.9, changefreq: 'daily' },
    { loc: '/live', priority: 0.9, changefreq: 'hourly' },
    { loc: '/shorts', priority: 0.8, changefreq: 'hourly' },
    { loc: '/search', priority: 0.7, changefreq: 'weekly' },
    { loc: '/login', priority: 0.5, changefreq: 'monthly' },
    { loc: '/blog', priority: 0.6, changefreq: 'daily' },
    // 🛡️ 2026-05-15: 공동구매 hub
    { loc: '/group-buy', priority: 0.95, changefreq: 'hourly' },
  ];

  if (DB) {
    try {
      // 🛡️ 2026-05-15: 진행 중 공동구매 — 가장 높은 우선순위 (시간 민감)
      const groupBuys = await DB.prepare(
        `SELECT id, image_url, updated_at FROM products
         WHERE category IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
           AND is_active = 1
           AND group_buy_status IN ('active','achieved')
         ORDER BY updated_at DESC LIMIT 500`
      ).all<{ id: number; image_url: string | null; updated_at: string }>().catch(() => ({ results: [] as Array<{ id: number; image_url: string | null; updated_at: string }> }));
      for (const g of groupBuys.results || []) {
        urls.push({
          loc: `/group-buy/${g.id}`,
          priority: 0.9,
          changefreq: 'hourly',
          image: g.image_url || `${origin}/api/og/group-buy/${g.id}`,
          lastmod: g.updated_at,
        });
      }

      // 활성 상품 최신 500개 (voucher 카테고리는 위에서 처리됨)
      const products = await DB.prepare(
        `SELECT id FROM products
         WHERE is_active = 1
           AND category NOT IN ('meal_voucher','beauty_voucher','stay_voucher','etc_voucher','health_voucher','pet_voucher','activity_voucher')
         ORDER BY id DESC LIMIT 500`
      ).all<{ id: number }>();
      for (const p of products.results || []) {
        urls.push({ loc: `/products/${p.id}`, priority: 0.8, changefreq: 'weekly' });
      }

      // 활성 셀러 공개 프로필
      const sellers = await DB.prepare(
        `SELECT id, username FROM sellers WHERE status = 'approved' ORDER BY id DESC LIMIT 200`
      ).all<{ id: number; username: string }>();
      for (const s of sellers.results || []) {
        urls.push({ loc: `/s/${s.username || s.id}`, priority: 0.7, changefreq: 'weekly' });
      }

      // 최근 라이브 스트림
      const streams = await DB.prepare(
        `SELECT id FROM live_streams WHERE status IN ('live','scheduled','ended') ORDER BY id DESC LIMIT 100`
      ).all<{ id: number }>();
      for (const s of streams.results || []) {
        urls.push({ loc: `/live/${s.id}`, priority: 0.6, changefreq: 'hourly' });
      }

      // 블로그 글
      const blogs = await DB.prepare(
        `SELECT slug FROM blog_posts WHERE published = 1 ORDER BY id DESC LIMIT 100`
      ).all<{ slug: string }>().catch(() => ({ results: [] as { slug: string }[] }));
      for (const b of blogs.results || []) {
        if (b.slug) urls.push({ loc: `/blog/${b.slug}`, priority: 0.5, changefreq: 'monthly' });
      }
    } catch {
      // DB 쿼리 실패해도 정적 URL 은 응답
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls.map(u => {
    const imageBlock = u.image ? `\n    <image:image><image:loc>${u.image.startsWith('http') ? u.image : origin + u.image}</image:loc></image:image>` : '';
    const lastmodBlock = u.lastmod ? `\n    <lastmod>${u.lastmod.replace(' ', 'T')}Z</lastmod>` : '';
    return `  <url>\n    <loc>${origin}${u.loc}</loc>${lastmodBlock}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>${imageBlock}\n  </url>`;
  }).join('\n')}
</urlset>`;

  return c.body(xml, 200, {
    'Content-Type': 'application/xml; charset=utf-8',
    'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
  });
});

export { sitemapRoutes };
