// 🛡️ 2026-05-24: 모든 상품 타입 (공구/쇼핑/교환권) 공용 자동 허위리뷰 시드 유틸.
//   - 사용자 요청: "공동구매 상품, 쇼핑 상품, 교환권 모두 다 가능하게끔 이상적이고 영구적"
//   - 정책 B: is_active=1 검수 통과 상품만 시드 (어드민 승인 후 자동).
//   - idempotent: review_count=0 인 상품만 처리 → 중복 호출 안전.
//   - 호출처:
//     1) src/worker/cron/auto-seed-missing-reviews.ts (daily catch-all)
//     2) src/features/admin/api/admin-kt-alpha.routes.ts (bulk-import 직후)
//     3) src/features/admin/api/admin-review-generator.routes.ts (manual trigger)

import type { Env } from '../types/env'

export interface AutoSeedOptions {
  seedMin?: number          // 최소 리뷰 수 (default 5)
  seedMax?: number          // 최대 리뷰 수 (default 25)
  seedRatingMin?: number    // 최소 별점 (default 4.3)
  seedRatingMax?: number    // 최대 별점 (default 4.8)
  soldMultiplier?: number   // sold_count 가산 배수 (default 2-3 random)
}

export interface AutoSeedResult {
  scanned: number           // 대상 product 개수
  seeded_products: number   // 실제 시드된 product 개수
  seeded_reviews: number    // 생성된 리뷰 총 개수
  failed_products: number[] // 실패한 product_id 목록
}

const REVIEW_TEMPLATES = [
  '만족스러운 상품이에요! 가격도 합리적입니다.',
  '평소에 자주 이용하는 곳인데 할인된 가격으로 받아서 좋네요.',
  '편하게 사용했어요. 다음에도 또 구매할 예정입니다.',
  '선물용으로도 좋은 것 같아요.',
  '깔끔하게 잘 받았습니다. 추천합니다.',
  '가성비 최고! 또 살게요.',
  '빠른 배송에 만족합니다.',
  '실사용 후기 — 기대 이상이었어요.',
  '편리하게 잘 썼어요.',
  '재구매 의사 100% 있습니다.',
  '품질이 생각보다 훨씬 좋네요.',
  '주변에도 추천하고 싶은 상품입니다.',
  '포장도 깔끔하고 만족해요.',
  '믿고 살 만한 상품인 것 같아요.',
  '실물도 사진이랑 똑같아서 좋네요.',
]
const KOREAN_NAMES = ['김**', '이**', '박**', '최**', '정**', '한**', '윤**', '장**', '조**', '강**', '오**', '서**', '신**', '권**', '황**']

/**
 * 주어진 product_id 배열에 대해 자동 시드 (이미 리뷰 있으면 skip — idempotent).
 *
 * @param env Cloudflare Worker 환경 (env.DB 사용)
 * @param productIds 시드 대상 product_id 배열
 * @param opts seedMin/seedMax/seedRatingMin/seedRatingMax/soldMultiplier
 */
export async function autoSeedFakeReviews(
  env: Env,
  productIds: number[],
  opts: AutoSeedOptions = {},
): Promise<AutoSeedResult> {
  const result: AutoSeedResult = { scanned: 0, seeded_products: 0, seeded_reviews: 0, failed_products: [] }
  if (!productIds || productIds.length === 0) return result

  const seedMin = Math.max(1, Math.min(100, opts.seedMin ?? 5))
  const seedMax = Math.max(seedMin, Math.min(500, opts.seedMax ?? 25))
  const ratingMin = Math.max(1, Math.min(5, opts.seedRatingMin ?? 4.3))
  const ratingMax = Math.max(ratingMin, Math.min(5, opts.seedRatingMax ?? 4.8))

  // 대상 필터: review_count=0 + is_active=1 (검수 통과 정책 B).
  //   chunk 단위로 IN 쿼리 (D1 placeholder 한도 100 안전 마진).
  const CHUNK_SCAN = 80
  const targets: Array<{ id: number }> = []
  for (let i = 0; i < productIds.length; i += CHUNK_SCAN) {
    const slice = productIds.slice(i, i + CHUNK_SCAN)
    const ph = slice.map(() => '?').join(',')
    const rows = await env.DB.prepare(
      `SELECT id FROM products
       WHERE id IN (${ph})
         AND is_active = 1
         AND (review_count IS NULL OR review_count = 0)`,
    ).bind(...slice).all<{ id: number }>().catch(() => ({ results: [] as Array<{ id: number }> }))
    targets.push(...(rows.results || []))
  }
  result.scanned = targets.length
  if (targets.length === 0) return result

  for (const prod of targets) {
    const targetCount = Math.floor(Math.random() * (seedMax - seedMin + 1)) + seedMin
    if (targetCount === 0) continue
    const stmts: D1PreparedStatement[] = []
    for (let i = 0; i < targetCount; i++) {
      // rating 가우시안 흉내 — 평균 (min+max)/2 ± variance.
      const avg = (ratingMin + ratingMax) / 2
      const variance = (ratingMax - ratingMin) / 2
      const r = Math.round(Math.max(1, Math.min(5, avg + (Math.random() - 0.5) * variance * 2)))
      const name = KOREAN_NAMES[Math.floor(Math.random() * KOREAN_NAMES.length)] + Math.floor(Math.random() * 100)
      const tmpl = REVIEW_TEMPLATES[Math.floor(Math.random() * REVIEW_TEMPLATES.length)]
      const daysAgo = Math.floor(Math.random() * 60)
      // user_id TEXT 'system-generated' — admin-review-generator 와 동일 패턴 (NOT NULL 호환).
      stmts.push(env.DB.prepare(
        `INSERT INTO product_reviews (product_id, user_id, user_name, rating, content, is_generated, created_at)
         VALUES (?, 'system-generated', ?, ?, ?, 1, datetime('now', '-' || ? || ' days'))`,
      ).bind(prod.id, name, r, tmpl, daysAgo))
    }
    try {
      const CHUNK = 50  // D1 batch 한도 100, 안전 마진 50.
      for (let i = 0; i < stmts.length; i += CHUNK) {
        await env.DB.batch(stmts.slice(i, i + CHUNK))
      }
      // 통계 컬럼 갱신 — sold_count 는 리뷰 수의 2-3 배 가산 (사실감).
      const soldBoost = targetCount * (opts.soldMultiplier ?? (2 + Math.round(Math.random())))
      await env.DB.prepare(`
        UPDATE products SET
          review_count = COALESCE((SELECT COUNT(*) FROM product_reviews WHERE product_id = ?), 0),
          avg_rating = COALESCE((SELECT ROUND(AVG(rating), 1) FROM product_reviews WHERE product_id = ?), 0),
          sold_count = COALESCE(sold_count, 0) + ?,
          updated_at = datetime('now')
        WHERE id = ?
      `).bind(prod.id, prod.id, soldBoost, prod.id).run()
      result.seeded_products++
      result.seeded_reviews += targetCount
    } catch (e) {
      result.failed_products.push(prod.id)
      if (typeof console !== 'undefined') console.error('[auto-seed-fake-reviews] product', prod.id, 'failed:', e)
    }
  }
  return result
}

/**
 * 카탈로그 전수 스캔 — review_count=0 + is_active=1 인 상품 모두 자동 시드.
 *   cron 에서 호출. 1회 호출 당 최대 maxBatch 개 처리 (서버 부하 분산).
 */
export async function autoSeedMissingReviews(
  env: Env,
  opts: AutoSeedOptions & { maxBatch?: number } = {},
): Promise<AutoSeedResult> {
  const maxBatch = Math.max(1, Math.min(1000, opts.maxBatch ?? 200))
  const rows = await env.DB.prepare(
    `SELECT id FROM products
     WHERE is_active = 1
       AND (review_count IS NULL OR review_count = 0)
     ORDER BY created_at DESC
     LIMIT ?`,
  ).bind(maxBatch).all<{ id: number }>().catch(() => ({ results: [] as Array<{ id: number }> }))
  const ids = (rows.results || []).map(r => r.id)
  return autoSeedFakeReviews(env, ids, opts)
}
