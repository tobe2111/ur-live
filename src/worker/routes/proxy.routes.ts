/**
 * External Service Proxy Routes
 *
 * 브라우저 CORS 우회 + 외부 API 키 보호용 server-side 프록시.
 *
 * - GET /api/kakao/place/search       — 카카오 키워드 검색 (식당/카페 분류)
 * - GET /api/kakao/place/address      — 카카오 주소 검색
 * - GET /api/naver/place/search       — 네이버 지역 검색
 * - GET /api/naver/image/search       — 네이버 이미지 검색
 * - GET /api/naver/restaurant         — 네이버 통합 식당 정보 (local + image)
 *
 * 분리 배경: worker/index.ts 가 2353줄 비대 → 외부 프록시 분리 (TD-006 부분 해소).
 * 이전: worker/index.ts:1942~2056 인라인. 2026-04-26 추출.
 */

import { Hono } from 'hono';
import type { Env } from '../types/env';
import { rateLimit } from '../middleware/rate-limit';

const app = new Hono<{ Bindings: Env }>();

// ── 카카오 장소 검색 (키워드) ──
app.get('/kakao/place/search', async (c) => {
  const query = c.req.query('query');
  const category = c.req.query('category_group_code') || 'FD6,CE7';
  const size = c.req.query('size') || '15';
  if (!query) return c.json({ success: false, error: 'query required' }, 400);
  const KAKAO_REST_KEY = c.env.KAKAO_REST_API_KEY;
  if (!KAKAO_REST_KEY) return c.json({ success: false, error: 'KAKAO_REST_API_KEY not configured' }, 500);
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=${size}${category && !category.includes(',') ? `&category_group_code=${category}` : ''}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } });
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500);
  }
});

// ── 카카오 주소 검색 ──
app.get('/kakao/place/address', async (c) => {
  const query = c.req.query('query');
  if (!query) return c.json({ success: false, error: 'query required' }, 400);
  const KAKAO_REST_KEY = c.env.KAKAO_REST_API_KEY;
  if (!KAKAO_REST_KEY) return c.json({ success: false, error: 'KAKAO_REST_API_KEY not configured' }, 500);
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } });
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500);
  }
});

// ── 네이버 지역 검색 ──
app.get('/naver/place/search', rateLimit({ action: 'naver_place', max: 30, windowSec: 60 }), async (c) => {
  const query = c.req.query('query');
  const display = c.req.query('display') || '5';
  if (!query) return c.json({ success: false, error: 'query required' }, 400);
  const clientId = (c.env as Env).NAVER_CLIENT_ID;
  const clientSecret = (c.env as Env).NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'NAVER API keys not configured' }, 500);
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}&sort=comment`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500);
  }
});

// ── 네이버 이미지 검색 ──
// 🛡️ 2026-04-27: query 에 '맛집' 자동 append 제거. 프론트가 보낸 query 를 그대로 사용해
//               place_name 일치도 향상 (중복 키워드로 dilution 되던 문제).
app.get('/naver/image/search', rateLimit({ action: 'naver_image', max: 30, windowSec: 60 }), async (c) => {
  const query = c.req.query('query');
  const display = c.req.query('display') || '6';
  if (!query) return c.json({ success: false, error: 'query required' }, 400);
  const clientId = (c.env as Env).NAVER_CLIENT_ID;
  const clientSecret = (c.env as Env).NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'NAVER API keys not configured' }, 500);
  try {
    const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${display}&sort=sim&filter=large`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500);
  }
});

// ── 네이버 통합 식당 정보 (local + image) ──
app.get('/naver/restaurant', rateLimit({ action: 'naver_restaurant', max: 30, windowSec: 60 }), async (c) => {
  const query = c.req.query('query');
  if (!query) return c.json({ success: false, error: 'query required' }, 400);
  const clientId = (c.env as Env).NAVER_CLIENT_ID;
  const clientSecret = (c.env as Env).NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'NAVER API keys not configured' }, 500);

  const headers = { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret };

  try {
    // 🛡️ 2026-04-22: Naver 느리면 5초 후 중단 (Worker CPU/메모리 보호)
    const [localRes, imageRes] = await Promise.all([
      fetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=1&sort=comment`, { headers, signal: AbortSignal.timeout(5000) }),
      fetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query + ' 맛집 음식')}&display=3&sort=sim&filter=large`, { headers, signal: AbortSignal.timeout(5000) }),
    ]);

    const localData: any = await localRes.json();
    const imageData: any = await imageRes.json();

    const place = localData.items?.[0] || null;
    const images = (imageData.items || []).map((img: any) => img.link);

    return c.json({
      success: true,
      data: {
        place: place ? {
          title: place.title?.replace(/<[^>]*>/g, ''),
          address: place.roadAddress || place.address,
          phone: place.telephone,
          category: place.category,
          link: place.link,
          mapx: place.mapx,
          mapy: place.mapy,
        } : null,
        images,
      },
    });
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500);
  }
});

export const proxyRoutes = app;
