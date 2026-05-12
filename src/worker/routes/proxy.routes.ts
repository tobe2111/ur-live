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
import type { KVNamespace } from '@cloudflare/workers-types';
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

// ── 카카오 주변 음식점 검색 (좌표 기반) ──
// 🛡️ 2026-04-28: restaurant-map 페이지가 우리 식사권 외에 카카오 맛집도 표시할 때 사용.
// 사용자 lat/lng + radius (m) → FD6 (음식점) + CE7 (카페) 자동 검색.
app.get('/kakao/place/nearby', async (c) => {
  const x = c.req.query('lng'); // longitude
  const y = c.req.query('lat'); // latitude
  const radius = c.req.query('radius') || '1000'; // meters (max 20000)
  const category = c.req.query('category') || 'FD6'; // FD6=음식점, CE7=카페
  const size = c.req.query('size') || '15';
  if (!x || !y) return c.json({ success: false, error: 'lat,lng required' }, 400);
  const KAKAO_REST_KEY = c.env.KAKAO_REST_API_KEY;
  if (!KAKAO_REST_KEY) return c.json({ success: false, error: 'KAKAO_REST_API_KEY not configured' }, 500);
  try {
    const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=${category}&x=${x}&y=${y}&radius=${Math.min(20000, Number(radius) || 1000)}&size=${size}&sort=distance`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } });
    const data = await res.json();
    return c.json({ success: true, data });
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500);
  }
});

// ── 카카오 주소 검색 (영구 캐시) ──
// 🛡️ 2026-05-07: 같은 주소를 반복 변환하지 않도록 RATE_LIMIT_KV 에 30일 캐시.
// 한 번 변환된 좌표는 거의 바뀌지 않으므로 Kakao API quota 대폭 절감.
app.get('/kakao/place/address', async (c) => {
  const query = c.req.query('query');
  if (!query) return c.json({ success: false, error: 'query required' }, 400);
  const KAKAO_REST_KEY = c.env.KAKAO_REST_API_KEY;
  if (!KAKAO_REST_KEY) return c.json({ success: false, error: 'KAKAO_REST_API_KEY not configured' }, 500);

  const KV = (c.env as Env & { RATE_LIMIT_KV?: KVNamespace }).RATE_LIMIT_KV;
  const cacheKey = `geocode:kakao:${query.slice(0, 200)}`;

  // 캐시 hit
  if (KV) {
    const cached = await KV.get(cacheKey, 'json').catch(() => null);
    if (cached) return c.json({ success: true, data: cached, cached: true });
  }

  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } });
    const data = await res.json();

    // 결과 있을 때만 30일 캐시 — waitUntil로 백그라운드 write (응답 지연 방지)
    if (KV && (data as { documents?: unknown[] })?.documents?.length) {
      c.executionCtx?.waitUntil?.(
        KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 30 * 24 * 60 * 60 }).catch(() => {})
      );
    }
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

  const KV = (c.env as Env & { RATE_LIMIT_KV?: KVNamespace }).RATE_LIMIT_KV;
  const cacheKey = `naver:place:${query.slice(0, 200)}:${display}`;
  if (KV) {
    const cached = await KV.get(cacheKey, 'json').catch(() => null);
    if (cached) return c.json({ success: true, data: cached, cached: true });
  }

  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}&sort=comment`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    const data = await res.json();
    if (KV && (data as { items?: unknown[] })?.items?.length) {
      c.executionCtx?.waitUntil?.(
        KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 24 * 60 * 60 }).catch(() => {})
      );
    }
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

  const KV = (c.env as Env & { RATE_LIMIT_KV?: KVNamespace }).RATE_LIMIT_KV;
  const cacheKey = `naver:img:${query.slice(0, 200)}`;
  if (KV) {
    const cached = await KV.get(cacheKey, 'json').catch(() => null);
    if (cached) return c.json({ success: true, data: cached, cached: true });
  }

  try {
    const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=${display}&sort=sim&filter=large`;
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    });
    const data = await res.json();
    if (KV && (data as { items?: unknown[] })?.items?.length) {
      c.executionCtx?.waitUntil?.(
        KV.put(cacheKey, JSON.stringify(data), { expirationTtl: 7 * 24 * 60 * 60 }).catch(() => {})
      );
    }
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

  const KV = (c.env as Env & { RATE_LIMIT_KV?: KVNamespace }).RATE_LIMIT_KV;
  const cacheKey = `naver:restaurant:${query.slice(0, 200)}`;
  if (KV) {
    const cached = await KV.get(cacheKey, 'json').catch(() => null);
    if (cached) return c.json({ success: true, data: cached, cached: true });
  }

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

    const result = {
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
    };

    if (KV && (result.place || result.images.length)) {
      c.executionCtx?.waitUntil?.(
        KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 24 * 60 * 60 }).catch(() => {})
      );
    }

    return c.json({
      success: true,
      data: result,
    });
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500);
  }
});

export const proxyRoutes = app;
