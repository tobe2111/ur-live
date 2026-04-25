// ============================================================
// Naver Proxy Routes — /api/naver/*
//
// 네이버 검색 API 프록시 (식당 이미지/정보)
// 지역 검색: 식당명 + 주소 + 전화번호 + 카테고리
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../types/env'
import { rateLimit } from '../middleware/rate-limit'

export const naverProxyRoutes = new Hono<{ Bindings: Env }>()

// 지역 검색: 식당명 + 주소 + 전화번호 + 카테고리
naverProxyRoutes.get('/api/naver/place/search', rateLimit({ action: 'naver_place', max: 30, windowSec: 60 }), async (c) => {
  const query = c.req.query('query')
  const display = c.req.query('display') || '5'
  if (!query) return c.json({ success: false, error: 'query required' }, 400)
  const clientId = (c.env as Env).NAVER_CLIENT_ID
  const clientSecret = (c.env as Env).NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'NAVER API keys not configured' }, 500)
  try {
    const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=${display}&sort=comment`
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    })
    const data = await res.json()
    return c.json({ success: true, data })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

// 이미지 검색: 식당명으로 이미지 가져오기
naverProxyRoutes.get('/api/naver/image/search', rateLimit({ action: 'naver_image', max: 30, windowSec: 60 }), async (c) => {
  const query = c.req.query('query')
  const display = c.req.query('display') || '3'
  if (!query) return c.json({ success: false, error: 'query required' }, 400)
  const clientId = (c.env as Env).NAVER_CLIENT_ID
  const clientSecret = (c.env as Env).NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'NAVER API keys not configured' }, 500)
  try {
    const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query + ' 맛집')}&display=${display}&sort=sim&filter=large`
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
    })
    const data = await res.json()
    return c.json({ success: true, data })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

// 통합 식당 정보 (지역 검색 + 이미지 한번에)
naverProxyRoutes.get('/api/naver/restaurant', rateLimit({ action: 'naver_restaurant', max: 30, windowSec: 60 }), async (c) => {
  const query = c.req.query('query')
  if (!query) return c.json({ success: false, error: 'query required' }, 400)
  const clientId = (c.env as Env).NAVER_CLIENT_ID
  const clientSecret = (c.env as Env).NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret) return c.json({ success: false, error: 'NAVER API keys not configured' }, 500)

  const headers = { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }

  try {
    // 🛡️ 2026-04-22: Naver 느리면 5초 후 중단 (Worker CPU/메모리 보호)
    const [localRes, imageRes] = await Promise.all([
      fetch(`https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=1&sort=comment`, { headers, signal: AbortSignal.timeout(5000) }),
      fetch(`https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query + ' 맛집 음식')}&display=3&sort=sim&filter=large`, { headers, signal: AbortSignal.timeout(5000) }),
    ])

    const localData: any = await localRes.json()
    const imageData: any = await imageRes.json()

    const place = localData.items?.[0] || null
    const images = (imageData.items || []).map((img: any) => img.link)

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
    })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})
