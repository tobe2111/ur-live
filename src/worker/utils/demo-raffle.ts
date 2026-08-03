/**
 * 🎭 데모 상품 추첨 설정 seed — 생성 경로와 자가치유 cron 이 **같은 규칙**을 쓰게 하는 한 곳.
 *
 * 2026-08-03: 동네딜 데모는 생성 시 추첨이 붙는데 숙박 데모는 안 붙어, 72개가 소비자에게
 * **89,000원짜리 판매 상품**으로 보였다(배지 렌더가 `{fcfs && ...}` 라 설정이 없으면 아무것도 안 뜬다).
 * 규칙이 두 파일에 따로 있으면 또 갈린다 ⇒ 여기 하나로.
 */
import { setSupplyMeta } from './product-supply-meta'
import { demoRaffleDefaults } from '../../shared/constants/demo-products'

/** 정원 3~8 · 표시 응모자 ×3~6 · 마감 5~10일 뒤. best-effort(실패해도 시드 흐름을 막지 않는다). */
export async function seedDemoRaffle(DB: D1Database, productId: number): Promise<boolean> {
  const { spots, appliedSeed, deadlineMs } = demoRaffleDefaults()
  return setSupplyMeta(DB, productId, {
    fcfs_enabled: '1',
    fcfs_spots: spots,
    fcfs_applied_seed: appliedSeed,
    fcfs_deadline: new Date(Date.now() + deadlineMs).toISOString(),
  }).then(() => true).catch(() => false)
}
