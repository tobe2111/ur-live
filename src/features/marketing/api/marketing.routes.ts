/**
 * 🆕 2026-06-26 통합 마케팅 서비스(가칭) — 유어딜·도매몰에 이은 3번째 서비스. /api/ads/*
 *
 * 도매몰(/api/wholesale)처럼 유어딜 소비자와 완전 분리된 자체 API 네임스페이스.
 * 계획: 네이버 검색광고 자동입찰(쇼핑검색 포함) / 쇼핑몰 발주수집(네이버 커머스 API) / 키워드 도구.
 * 현재: 분리 골격(ping). 각 기능 구현 시 ad_* D1 테이블 + 엔진(Queue/Durable Object/Browser Rendering) 도입.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'

const marketingRoutes = new Hono<{ Bindings: Env }>()

// 스캐폴딩 헬스체크 — GET /api/ads/ping
marketingRoutes.get('/ping', (c) =>
  c.json({ success: true, service: 'marketing', status: 'scaffold' }),
)

// TODO(단계별 구현):
//   POST /naver/credentials  광고주/판매자 네이버 API 키 등록(encryptToken 재사용 → ad_accounts)
//   GET/PATCH /bid/keywords  자동입찰 키워드 목록 / 입찰설정(목표순위·최대입찰가)
//   GET  /orders/collect     쇼핑몰 발주수집(네이버 커머스 API 폴링 결과)

export { marketingRoutes }
