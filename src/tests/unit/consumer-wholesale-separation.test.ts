/**
 * 🧱 유어딜 소비자 ↔ 도매몰(유통스타트) 분리 불변식 (정적 가드)
 *
 * 2026-06-26 분리 전수감사: 도매 카탈로그 마스터(is_supply_product=1, supply_source_id 없음)가
 *   소비자 상품쿼리 여러 곳으로 누수(쇼핑/검색/sitemap/링크샵추천/공구피드). 전 소비자 상품쿼리에
 *   동일 제외절을 강제. 도매몰(/api/wholesale/*)은 별도 엔드포인트로 항상 is_supply_product=1 만 봄.
 *
 * 불변식:
 *   ① 모든 소비자 상품쿼리(리스트/카운트/검색/sitemap/추천/공구피드/cron)는 도매 마스터를 제외한다.
 *   ② 도매몰 카탈로그는 여전히 도매 상품(is_supply_product=1)만 노출한다(반대 방향).
 *   ③ 계정 전환 시 도매/셀러/에이전시/관리자 토큰을 모두 wipe 한다(공유기기 누출 차단).
 * 깨지면(제외절 제거/토큰 wipe 누락) CI 빨강.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8')

// 도매 마스터 제외절 — 공백/별칭(p.) 무관 매칭.
const EXCL = /NOT\s*\(\s*COALESCE\(\s*[a-z]*\.?is_supply_product\s*,\s*0\s*\)\s*=\s*1\s+AND\s+COALESCE\(\s*[a-z]*\.?supply_source_id\s*,\s*0\s*\)\s*=\s*0\s*\)/gi
const count = (s: string) => (s.match(EXCL) || []).length

// [파일, 최소 제외절 개수] — 소비자에게 상품을 노출하는 전 경로.
const CONSUMER_PRODUCT_QUERIES: Array<[string, number]> = [
  ['src/features/products/repositories/ProductRepository.ts', 3], // 리스트 + 카운트 + FTS
  ['src/features/products/api/products.routes.ts', 3],            // /count + 자동완성 ×2
  ['src/worker/routes/sitemap.routes.ts', 2],                     // 공구 + 일반상품
  ['src/worker/routes/curator.routes.ts', 1],                     // 링크샵 추천 피드
  ['src/features/group-buy/api/group-buy-public.routes.ts', 2],   // gift-catalog + fallback
  ['src/worker/cron/group-buy-feed-cache.ts', 1],                 // 홈/공구 피드 cron
]

describe('유어딜 소비자 ↔ 도매몰 분리 불변식', () => {
  for (const [file, min] of CONSUMER_PRODUCT_QUERIES) {
    it(`① ${file} — 도매 마스터 제외절 ${min}회+`, () => {
      expect(count(read(file))).toBeGreaterThanOrEqual(min)
    })
  }

  it('② 도매몰 카탈로그는 여전히 is_supply_product=1 만 노출(반대 방향)', () => {
    expect(/is_supply_product\s*=\s*1/.test(read('src/features/supply/api/wholesale.routes.ts'))).toBe(true)
  })

  it('③ 계정 전환 시 도매/셀러/에이전시/관리자 토큰 모두 wipe (KakaoCallbackPage)', () => {
    const cb = read('src/pages/KakaoCallbackPage.tsx')
    for (const k of ['supplier_token', 'admin_token', 'seller_token', 'agency_token']) {
      expect(cb.includes(`'${k}'`)).toBe(true)
    }
  })
})
