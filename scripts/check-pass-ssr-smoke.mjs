#!/usr/bin/env node
/**
 * 🧊 이용권 상세 서버 렌더 번들 스모크 (2026-10-15 서버 렌더 3단계).
 *
 * `npm run build:ssr-pass` 가 만든 `dist/ssr-pass/pass-detail-entry.js` 를 **브라우저 전역 없이**(window·localStorage
 * 없음 — 워커와 같다) 불러 상품 하나를 실제로 그린다. 그려진 HTML 에 상품명·가격·구매하기·누름 기억 표시가 있는지 본다.
 *
 * 왜 필요한가: 워커는 번들이 없거나 렌더가 던지면 **조용히** 종전 손그림 첫 화면으로 폴백한다(무회귀가 목적이라).
 * 그 폴백이 영구화되면 서버 렌더가 꺼져 있는데 아무도 모른다 — 빌드도 화면도 초록이다. 이 검사가 그 상태를 빨간불로 만든다.
 *
 * ⚠️ 측정 대상이 없으면(번들 없음) 통과가 아니라 **실패**다.
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const BUNDLE = path.resolve('dist/ssr-pass/pass-detail-entry.js')
const fail = (m) => { console.error(`❌ pass-ssr-smoke: ${m}`); process.exit(1) }
if (!existsSync(BUNDLE)) fail(`번들 없음 — ${BUNDLE} (npm run build:ssr-pass 먼저)`)
if (typeof window !== 'undefined' || typeof localStorage !== 'undefined') fail('브라우저 전역이 있다 — 워커와 다른 조건이다')

const PRODUCT = {
  id: 2919, seller_id: 26, name: '스모크 닭도리탕', description: '스모크 이용권', price: 31000, original_price: 35000, discount_rate: 0,
  image_url: 'https://media.ur-team.com/uploads/x.jpg', images: '["https://media.ur-team.com/uploads/x.jpg"]',
  category: 'meal_voucher', stock: 99, is_active: 1, deal_only: 0, sold_count: 0, review_count: 0, avg_rating: 0,
  group_buy_current: 1, group_buy_status: 'active', group_buy_deadline: null, group_buy_tiers: null,
  restaurant_name: '스모크가게', restaurant_address: '서울 마포구 테스트로 1', restaurant_phone: '02-000-0000',
  restaurant_lat: 37.49, restaurant_lng: 126.98, voucher_expiry: null, voucher_terms: null,
  seller_name: '스모크가게', seller_username: 'smoke', current_discount_pct: 0, qty_cap: 10,
}

const mod = await import(pathToFileURL(BUNDLE).href)
if (typeof mod.renderPassDetail !== 'function') fail('renderPassDetail 가 없다')
let html = ''
try {
  html = mod.renderPassDetail(PRODUCT, '/pass/2919')
} catch (e) {
  fail(`렌더가 던졌다 — ${(e && e.stack) || e}`)
}
const need = [['상품명', '스모크 닭도리탕'], ['가격', '31,000'], ['구매하기', '구매하기'], ['누름 기억 표시', 'data-early-tap="buy"'], ['가게', '스모크가게']]
const missing = need.filter(([, s]) => !html.includes(s)).map(([k]) => k)
if (html.length < 5000) fail(`HTML 이 너무 짧다(${html.length}) — 로더나 빈 화면이 그려졌다`)
if (missing.length) fail(`빠진 것: ${missing.join(', ')}`)
if (/페이지 로딩/.test(html)) fail('로딩 화면이 그려졌다')
console.log(`✅ pass-ssr-smoke: ${html.length}자 — 상품명·가격·구매하기·누름 기억 표시 확인`)
process.exit(0) // 번들 안 모듈이 타이머를 남겨도 기다리지 않는다
