/**
 * 🔄 2026-07-05 (대표 "마감하면 그 이용권 계속 업데이트 — 사라지면 안 됨, 콜드스타트"):
 *   데모 이용권의 추첨 마감(fcfs_deadline)이 지나면 **자동으로 기간을 연장**해 피드가 비지 않게 유지.
 *   실 사업자 상품(seller_id 있음)은 대상 아님 — 데모 전용.
 *
 * 🎭 2026-08-03 (대표 "숙박 데모도 추첨 가능해야지 · 같은 규칙으로"): **두 가지가 바뀌었다.**
 *   1. 대상을 `demo-deal-` 접두사 → **`demo-` 전체**(SSOT `demo-products.ts`)로. 그 사이 생긴
 *      `demo-stay-*` 72개가 접두사 불일치로 **한 번도 안 걸리고 있었다.**
 *   2. 마감 연장뿐 아니라 **추첨 설정이 아예 없는 데모에 seed** 를 넣는다(B단계). 숙박 데모는
 *      생성 경로(`admin-stays.routes.ts`)에 그 블록이 없어 `fcfs_enabled` 가 0 이었고,
 *      배지는 `{fcfs && <FcfsBadge/>}` 라 **소비자에겐 그냥 89,000원짜리 판매 상품**으로 보였다.
 *      ⇒ 생성 경로도 함께 고쳤지만, **이미 만들어진 것들은 여기서 자가치유**된다(일회성 SQL 대신 코드 경로).
 *
 * 동작(매시간, idempotent):
 *   - A. 마감 지난 활성 데모의 `fcfs_deadline` 을 지금+5~10일(랜덤)로 롤링 — 같은 날짜로 안 몰림.
 *   - B. 추첨 설정이 없는 **voucher 카테고리** 데모에 기본값 seed(정원 3~8 · 응모자 ×3~6 · 마감 5~10일).
 *        배송 데모(링크샵 food)는 제외 — 배송 상품에 "응모"는 화면이 성립하지 않는다.
 *   - 실제 응모 기록/표시 응모자 수는 건드리지 않음(누적 유지).
 *   - 피드 캐시는 TTL(300s)로 자연 갱신.
 */
import type { Env } from '../types/env'
import { seedDemoRaffle } from '../utils/demo-raffle'
import { DEMO_SLUG_LIKE, demoRaffleDefaults } from '../../shared/constants/demo-products'
import { VOUCHER_CATEGORIES } from '../../shared/constants/voucher-categories'

export async function renewDemoFcfs(env: Env): Promise<{ renewed: number; seeded: number }> {
  const DB = env.DB
  const nowIso = new Date().toISOString()

  // ── A. 마감 지난 것 연장 ────────────────────────────────────────────
  const rows = await DB.prepare(
    `SELECT m.product_id FROM product_supply_meta m
       JOIN products p ON p.id = m.product_id
      WHERE m.key = 'fcfs_deadline'
        AND COALESCE(p.slug,'') LIKE ?
        AND COALESCE(p.is_active, 1) = 1
        AND m.value < ?
      LIMIT 200`
  ).bind(DEMO_SLUG_LIKE, nowIso)
    .all<{ product_id: number }>().catch(() => ({ results: [] as { product_id: number }[] }))

  let renewed = 0
  for (const r of (rows.results || [])) {
    const { deadlineMs } = demoRaffleDefaults()
    const next = new Date(Date.now() + deadlineMs).toISOString()
    const res = await DB.prepare(
      `UPDATE product_supply_meta SET value = ? WHERE product_id = ? AND key = 'fcfs_deadline'`
    ).bind(next, r.product_id).run().catch(() => null)
    if (res?.meta?.changes) renewed++
  }

  // ── B. 추첨 설정이 없는 데모에 seed(자가치유) ──────────────────────
  //   ⚠️ voucher 카테고리만. 배송 데모에 응모를 붙이면 소비자가 무슨 화면인지 알 수 없다.
  const catPlaceholders = VOUCHER_CATEGORIES.map(() => '?').join(',')
  const missing = await DB.prepare(
    `SELECT p.id FROM products p
      WHERE COALESCE(p.slug,'') LIKE ?
        AND COALESCE(p.is_active, 1) = 1
        AND p.category IN (${catPlaceholders})
        AND NOT EXISTS (
          SELECT 1 FROM product_supply_meta m
           WHERE m.product_id = p.id AND m.key = 'fcfs_enabled' AND m.value = '1')
      LIMIT 100`
  ).bind(DEMO_SLUG_LIKE, ...VOUCHER_CATEGORIES)
    .all<{ id: number }>().catch(() => ({ results: [] as { id: number }[] }))

  let seeded = 0
  for (const r of (missing.results || [])) {
    if (await seedDemoRaffle(DB, r.id)) seeded++
  }

  return { renewed, seeded }
}
