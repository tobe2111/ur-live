/**
 * 🔄 2026-07-05 (대표 "마감하면 그 이용권 계속 업데이트 — 사라지면 안 됨, 콜드스타트"):
 *   데모 이용권(slug demo-deal-*)의 추첨 마감(fcfs_deadline)이 지나면 **자동으로 기간을 연장**해
 *   피드가 비지 않게 유지. 실 사업자 상품(seller_id 있음)은 대상 아님 — 데모 전용.
 *
 * 동작(매시간, idempotent):
 *   - 마감 지난 활성 데모의 fcfs_deadline 을 지금+5~10일(랜덤)로 롤링 — 매번 같은 날짜로 안 몰림.
 *   - 실제 응모 기록/표시 지원자 수는 건드리지 않음(누적 유지 — "계속 업데이트"의 자연스러운 모습).
 *   - 피드 캐시는 TTL(300s)로 자연 갱신 — 마감 표시는 fcfs 메타를 읽는 시점에 새 값 반영.
 */
import type { Env } from '../types/env'

const DEMO_SLUG_PREFIX = 'demo-deal-'

export async function renewDemoFcfs(env: Env): Promise<{ renewed: number }> {
  const DB = env.DB
  const nowIso = new Date().toISOString()
  const rows = await DB.prepare(
    `SELECT m.product_id FROM product_supply_meta m
       JOIN products p ON p.id = m.product_id
      WHERE m.key = 'fcfs_deadline'
        AND p.slug LIKE ?
        AND COALESCE(p.is_active, 1) = 1
        AND m.value < ?
      LIMIT 200`
  ).bind(DEMO_SLUG_PREFIX + '%', nowIso)
    .all<{ product_id: number }>().catch(() => ({ results: [] as { product_id: number }[] }))

  let renewed = 0
  for (const r of (rows.results || [])) {
    const days = 5 + Math.floor(Math.random() * 6) // 5~10일 — 갱신 주기 분산
    const next = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    const res = await DB.prepare(
      `UPDATE product_supply_meta SET value = ? WHERE product_id = ? AND key = 'fcfs_deadline'`
    ).bind(next, r.product_id).run().catch(() => null)
    if (res?.meta?.changes) renewed++
  }
  return { renewed }
}
