// ============================================================
// Kakao Proxy Routes — /api/kakao/place/*
//
// 카카오 장소 검색 프록시 (브라우저 CORS 우회)
// ============================================================

import { Hono } from 'hono'
import type { Env } from '../types/env'

export const kakaoProxyRoutes = new Hono<{ Bindings: Env }>()

kakaoProxyRoutes.get('/api/kakao/place/search', async (c) => {
  const query = c.req.query('query')
  const category = c.req.query('category_group_code') || 'FD6,CE7'
  const size = c.req.query('size') || '15'
  if (!query) return c.json({ success: false, error: 'query required' }, 400)
  const KAKAO_REST_KEY = c.env.KAKAO_REST_API_KEY
  if (!KAKAO_REST_KEY) return c.json({ success: false, error: 'KAKAO_REST_API_KEY not configured' }, 500)
  try {
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=${size}${category && !category.includes(',') ? `&category_group_code=${category}` : ''}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } })
    const data = await res.json()
    return c.json({ success: true, data })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})

kakaoProxyRoutes.get('/api/kakao/place/address', async (c) => {
  const query = c.req.query('query')
  if (!query) return c.json({ success: false, error: 'query required' }, 400)
  const KAKAO_REST_KEY = c.env.KAKAO_REST_API_KEY
  if (!KAKAO_REST_KEY) return c.json({ success: false, error: 'KAKAO_REST_API_KEY not configured' }, 500)
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(query)}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${KAKAO_REST_KEY}` } })
    const data = await res.json()
    return c.json({ success: true, data })
  } catch (e) {
    return c.json({ success: false, error: (e as Error).message }, 500)
  }
})
