import { Hono } from 'hono';
import type { Env } from '../types/env';

export const fallbackRoutes = new Hono<{ Bindings: Env }>();

const BOT_UA_REGEX = /googlebot|bingbot|yandex|baiduspider|twitterbot|facebookexternalhit|rogerbot|linkedinbot|embedly|quora link|showyoubot|outbrain|pinterest|slackbot|vkshare|w3c_validator|kakaotalk|kakaostory|naver|daumoa|daum|telegram|whatsapp|discord/i;

const BASE_URL = 'https://live.ur-team.com';
const DEFAULT_OG = {
  title: '유어딜 - 라이브 커머스 & 맛집 공동구매',
  desc: '라이브 방송으로 만나는 최저가 특가 상품. 인플루언서 추천 맛집 공동구매, 실시간 라이브 쇼핑',
  image: `${BASE_URL}/og-image.png`,
};

fallbackRoutes.get('*', async (c) => {
  const ua = c.req.header('user-agent') || '';
  const url = new URL(c.req.url);
  const path = url.pathname;

  if (path.startsWith('/api/') || path.startsWith('/auth/')) return c.notFound();

  if (!BOT_UA_REGEX.test(ua)) {
    const assetUrl = new URL('/', c.req.url);
    const res = await (c.env as any).ASSETS?.fetch?.(assetUrl.toString())
      || await fetch(assetUrl.toString());
    return new Response(res.body, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  }

  const { DB } = c.env;
  let og = { ...DEFAULT_OG };
  const canonical = `${BASE_URL}${path}`;

  try {
    const productMatch = path.match(/^\/products\/(\d+)/);
    if (productMatch) {
      const p = await DB.prepare('SELECT name, description, price, image_url FROM products WHERE id = ?')
        .bind(productMatch[1]).first<any>();
      if (p) {
        og.title = `${p.name} - 유어딜`;
        og.desc = p.description?.slice(0, 200) || `${p.name} ${p.price?.toLocaleString()}원 - 유어딜에서 구매하세요`;
        if (p.image_url) og.image = p.image_url;
      }
    }

    const sellerMatch = path.match(/^\/(profile|s)\/(.+)/);
    if (sellerMatch) {
      const param = sellerMatch[2];
      const isNum = /^\d+$/.test(param);
      const s = isNum
        ? await DB.prepare('SELECT name, bio, profile_image FROM sellers WHERE id = ?').bind(param).first<any>()
        : await DB.prepare('SELECT name, bio, profile_image FROM sellers WHERE slug = ? OR username = ?').bind(param, param).first<any>();
      if (s) {
        og.title = `${s.name} - 유어딜`;
        og.desc = s.bio?.slice(0, 200) || `${s.name}의 스토어 - 유어딜`;
        if (s.profile_image) og.image = s.profile_image;
      }
    }

    const liveMatch = path.match(/^\/live\/(\d+)/);
    if (liveMatch) {
      const s = await DB.prepare('SELECT title, youtube_video_id FROM live_streams WHERE id = ?')
        .bind(liveMatch[1]).first<any>();
      if (s) {
        og.title = `🔴 ${s.title} - 유어딜 라이브`;
        og.desc = `지금 라이브 중! ${s.title} - 유어딜에서 실시간으로 시청하세요`;
        if (s.youtube_video_id) og.image = `https://img.youtube.com/vi/${s.youtube_video_id}/maxresdefault.jpg`;
      }
    }

    const blogMatch = path.match(/^\/blog\/([a-z0-9-]+)$/);
    if (blogMatch) {
      const b = await DB.prepare('SELECT title, summary, thumbnail_url FROM blog_posts WHERE slug = ? AND is_published = 1')
        .bind(blogMatch[1]).first<any>();
      if (b) {
        og.title = `${b.title} - 유어딜 블로그`;
        og.desc = b.summary?.slice(0, 200) || '';
        if (b.thumbnail_url) og.image = b.thumbnail_url;
      }
    }

    if (path === '/blog') {
      og.title = '유어딜 블로그 — 라이브 커머스 가이드';
      og.desc = '셀러 가이드, 트렌드, 서비스 소식. 유어딜에서 라이브 커머스를 시작하세요.';
    }
  } catch {}

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
<title>${og.title}</title>
<meta name="description" content="${og.desc}" />
<link rel="canonical" href="${canonical}" />
<meta property="og:type" content="website" />
<meta property="og:title" content="${og.title}" />
<meta property="og:description" content="${og.desc}" />
<meta property="og:image" content="${og.image}" />
<meta property="og:url" content="${canonical}" />
<meta property="og:site_name" content="유어딜" />
<meta property="og:locale" content="ko_KR" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${og.title}" />
<meta name="twitter:description" content="${og.desc}" />
<meta name="twitter:image" content="${og.image}" />
<meta name="robots" content="index, follow" />
<meta name="naver-site-verification" content="7be066f6c7f451d994e3a5482aa76f87e96c3c2f" />
</head>
<body>
<div id="root"></div>
<script>window.location.href="${canonical}";</script>
</body>
</html>`;

  return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
});
