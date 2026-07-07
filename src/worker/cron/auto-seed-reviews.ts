// 🛡️ 2026-05-24: 데일리 cron — 모든 신규 활성 상품에 자동 허위리뷰 시드.
//   사용자 요청: "공동구매 상품, 쇼핑 상품, 교환권 모두 다 가능하게끔 이상적이고 영구적".
//   정책 B: is_active=1 검수 통과 상품만 시드.
//
// 동작:
//   - is_active=1 AND review_count=0/NULL 인 상품 최대 200개 (1회 호출당) 조회.
//   - 각 상품에 5~25 개 리뷰 + sold_count 가산 + avg_rating/review_count 갱신.
//   - idempotent: 다음날 같은 상품 다시 처리해도 review_count > 0 이라 skip.
//
// 호출처: src/worker/scheduled.ts (18 UTC daily group).
//   필요시 cron 간격 변경 가능 (예: 6시간마다) — 신규 상품 노출 지연 단축.

import type { Env } from '../types/env'
import { autoSeedMissingReviews } from '../utils/auto-seed-fake-reviews'
import { seedMissingDemoReviews, refreshDemoReviews } from '../utils/demo-review-generator'
import { logError, logInfo } from '../utils/logger'

export async function handleAutoSeedReviews(env: Env): Promise<void> {
  // 🔄 2026-07-06 (대표 "기존 100개+ 데모도 다 새 리뷰로 · 토큰 없이 자동으로"): 옛 저품질 리뷰를
  //   새 composer 로 자동 교체. force=false 라 `review_gen_v='2'` 미표시분만 chunk(40)씩 처리 →
  //   cron 반복으로 전체 소진 후 자연 종료(remaining=0, 이후 no-op). 관리자 수동 트리거·토큰 불필요.
  try {
    const rf = await refreshDemoReviews(env, 40, false)
    if (rf.refreshed > 0) logInfo(`[cron] demo-reviews refresh: refreshed=${rf.refreshed} reviews=${rf.reviews} remaining=${rf.remaining}`)
  } catch (e) {
    logError('[cron] demo-reviews refresh FAILED', { error: String(e) })
  }
  // 🔒 2026-07-06 (대표 "리뷰 퀄리티 영구 유지"): 데모는 **매장특색 composer** 로 먼저 시드 —
  //   generic 템플릿(아래 autoSeedMissingReviews)은 데모를 제외하므로 데모 품질이 구조적으로 영구 유지.
  try {
    const d = await seedMissingDemoReviews(env)
    if (d.seeded > 0) logInfo(`[cron] demo-reviews(composer): seeded=${d.seeded}`)
  } catch (e) {
    logError('[cron] demo-reviews composer FAILED', { error: String(e) })
  }
  try {
    // 🛡️ 2026-05-27 (사용자 보고 — 카드 별점 미적용): maxBatch 200 → 1000.
    //   기존 일 200 한도라 신규 상품 + 기존 미처리 상품 적용 지연.
    //   1000 으로 늘려 1회 호출에 1000개 처리 (hourly 24회 × 1000 = 일 24,000 처리 가능).
    //   상품 수 적은 환경 (< 1000) 은 1회 호출로 전체 시드 완료.
    const result = await autoSeedMissingReviews(env, {
      maxBatch: 1000,
      seedMin: 5,
      seedMax: 25,
      seedRatingMin: 4.3,
      seedRatingMax: 4.8,
    })
    if (result.seeded_products > 0) {
      logInfo(`[cron] auto-seed-reviews: scanned=${result.scanned} seeded_products=${result.seeded_products} seeded_reviews=${result.seeded_reviews}`)
    }
    if (result.failed_products.length > 0) {
      logError('[cron] auto-seed-reviews partial failures', { count: result.failed_products.length, ids: result.failed_products.slice(0, 20) })
    }
  } catch (e) {
    logError('[cron] auto-seed-reviews FAILED', { error: String(e) })
  }
}
