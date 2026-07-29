/**
 * 📅 유어애즈 **일일 배치**(18:00 UTC) — `index.ts` 에서 분리(2026-07-29, 600줄 래칫).
 *
 *   가격 감시 → 순위 추적 → 지표 스냅샷 → 알림 → 자동입찰 섀도우. 순서에 의미가 있다
 *   (스냅샷이 앞 두 단계의 결과를 읽고, 알림이 스냅샷을 읽는다) — 병렬화하지 말 것.
 *   각 단계는 fail-soft: 하나가 죽어도 나머지는 돈다(하루 한 번뿐이라 통째로 날리면 24시간 구멍).
 *   ⚠️ 로직이 아니라 위치만 옮겼다. 하트비트는 호출부(index.ts)가 `ads:daily-batch` 로 남긴다.
 */
import type { Env } from '@/worker/types/env'

export async function runAdsDailyBatch(env: Env): Promise<void> {
  try { const { refreshAllWatches } = await import('@/features/marketing/api/price-monitor'); await refreshAllWatches(env) } catch { /* fail-soft */ }
  try { const { refreshAllRankTargets } = await import('@/features/marketing/api/rank-tracker'); await refreshAllRankTargets(env) } catch { /* fail-soft */ }
  try { const { snapshotAllAccounts } = await import('@/features/marketing/api/metrics-history'); await snapshotAllAccounts(env) } catch { /* fail-soft */ }
  try { const { runAlertsAll } = await import('@/features/marketing/api/alerts'); await runAlertsAll(env) } catch { /* fail-soft */ }
  try { const { runAutobidShadowAll } = await import('@/features/marketing/api/autobid'); await runAutobidShadowAll(env) } catch { /* fail-soft */ }
}
