/**
 * 🆕 2026-06-26 통합 마케팅 서비스(가칭) — 유어딜·도매몰에 이은 3번째 서비스. /api/ads/*
 *
 * 도매몰(/api/wholesale)처럼 유어딜 소비자와 완전 분리된 자체 API 네임스페이스.
 * 계획: 네이버 검색광고 자동입찰(쇼핑검색 포함) / 쇼핑몰 발주수집(네이버 커머스 API) / 키워드 도구.
 * 현재: 분리 골격(ping). 각 기능 구현 시 ad_* D1 테이블 + 엔진(Queue/Durable Object/Browser Rendering) 도입.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { sellerIdFrom } from '../../supply/api/wholesale-helpers'
import { loadNaverConnection, saveNaverConnection, issueNaverToken, ensureNaverConnectionSchema } from '../../supply/api/naver-commerce-core'
import { collectAndStore, listCollectedOrders } from './order-collection'

const marketingRoutes = new Hono<{ Bindings: Env }>()

// 스캐폴딩 헬스체크 — GET /api/ads/ping
marketingRoutes.get('/ping', (c) =>
  c.json({ success: true, service: 'marketing', status: 'scaffold' }),
)

// ── 멀티테넌트 입점: 고객사별 스마트스토어 연동 (SELF 방식) ──────────────────
//   tenant = 인증된 계정(seller_id). owner_type='marketing' 으로 도매(supplier/distributor)와 데이터 격리.
//   각 고객사가 커머스 API센터에서 자기 앱(상품주문/배송 권한 포함) 발급 → client_id/secret 입력.
//   ⚠️ 라이브: 주문권한 스코프 + 엔드포인트 현행문서 검증 후(이 환경 egress 차단 미검증).

// POST /api/ads/naver/connect — 고객사 스토어 연결(토큰 발급으로 즉시 검증 후 암호화 저장)
marketingRoutes.post('/naver/connect', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const body = await c.req.json().catch(() => ({} as Record<string, unknown>))
  const clientId = String(body.client_id || '').trim()
  const clientSecret = String(body.client_secret || '').trim()
  if (!/^[A-Za-z0-9]{10,64}$/.test(clientId)) return c.json({ success: false, error: '애플리케이션 ID 형식을 확인해주세요' }, 400)
  if (clientSecret.length < 20 || clientSecret.length > 128) return c.json({ success: false, error: '애플리케이션 시크릿을 확인해주세요' }, 400)
  const tok = await issueNaverToken(clientId, clientSecret)  // 실제 발급으로 검증 — 잘못된 키 저장 방지
  if (!tok.ok) return c.json({ success: false, error: tok.error }, 400)
  await saveNaverConnection(c.env.DB, sellerId, clientId, clientSecret, c.env.DATA_ENCRYPTION_KEY, 'marketing')
  return c.json({ success: true, message: '스마트스토어가 연결되었습니다' })
})

// GET /api/ads/naver/status — 이 고객사 연결 상태
marketingRoutes.get('/naver/status', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureNaverConnectionSchema(c.env.DB)
  const row = await c.env.DB.prepare(
    'SELECT client_id, connected_at FROM naver_commerce_connections WHERE owner_type = ? AND seller_id = ?'
  ).bind('marketing', sellerId).first<{ client_id: string; connected_at: string }>().catch(() => null)
  return c.json({ success: true, connected: !!row, client_id_masked: row ? `****${row.client_id.slice(-4)}` : null, connected_at: row?.connected_at || null })
})

// DELETE /api/ads/naver/connect — 연결 해제(marketing 스코프만)
marketingRoutes.delete('/naver/connect', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  await ensureNaverConnectionSchema(c.env.DB)
  await c.env.DB.prepare("DELETE FROM naver_commerce_connections WHERE owner_type = 'marketing' AND seller_id = ?").bind(sellerId).run()
  return c.json({ success: true })
})

// ── 발주수집 (네이버 커머스 API 재사용) ─────────────────────────────────────
//   기존 스마트스토어 연동(naver_commerce_connections, supplier/distributor)을 그대로 재사용.
//   ⚠️ 라이브 동작은 ① 커머스 앱에 '상품주문/배송' 권한 ② 엔드포인트 현행 문서 검증 후(egress 차단 환경 미검증).

// POST /api/ads/orders/sync — 연결된 스마트스토어 최근 주문 수집(본인)
marketingRoutes.post('/orders/sync', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  // 마케팅 입점 연결(owner_type='marketing')만 사용 — 도매(supplier/distributor) 연결과 격리.
  const conn = await loadNaverConnection(c.env.DB, sellerId, c.env.DATA_ENCRYPTION_KEY, 'marketing')
  if (!conn) return c.json({ success: false, error: '스마트스토어가 연결되어 있지 않습니다. 먼저 연동해주세요.', code: 'NOT_CONNECTED' }, 400)
  const sinceISO = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() // 최근 24h(향후 param 화)
  const r = await collectAndStore(c.env.DB, sellerId, conn, sinceISO)
  if (!r.ok) return c.json({ success: false, error: r.error || '발주 수집 실패' }, 502)
  return c.json({ success: true, collected: r.collected })
})

// GET /api/ads/orders — 수집된 발주 목록(본인)
marketingRoutes.get('/orders', async (c) => {
  const sellerId = await sellerIdFrom(c.req.header('Authorization'), c.env.JWT_SECRET)
  if (!sellerId) return c.json({ success: false, error: '로그인이 필요합니다' }, 401)
  const orders = await listCollectedOrders(c.env.DB, sellerId)
  return c.json({ success: true, orders })
})

// TODO(자동입찰 — 블록됨): 검색광고 API 키(별도 등록) + 순위측정 합법성 검토(2026-04-22 스크래퍼 제거 이력) 선행.
//   GET/PATCH /bid/keywords  자동입찰 키워드/입찰설정(목표순위·최대입찰가) — 공식 검색광고 API only.

export { marketingRoutes }
