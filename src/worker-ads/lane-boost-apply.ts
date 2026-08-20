/**
 * 📈 **보강 적용** — 유입 감시의 판정을 레인 보강값으로 옮긴다 (정책·근거는 `lane-boost.ts`).
 *
 * 여기 두는 이유: 정책(순수)과 배선(DO fetch)을 갈라 두면 정책만 따로 테스트할 수 있다.
 * ⚠️ 완전 fail-soft — 보강 실패가 정비를 멈추게 하면 안 된다.
 */
import type { DurableObjectNamespace } from '@cloudflare/workers-types'
import { COMPENSATORS, planBoostRuns } from './lane-boost'

interface VerdictLike { ratio: number | null; level: string }

export async function applyLaneBoost(env: unknown, verdicts: Record<string, VerdictLike>): Promise<void> {
  const ns = (env as { ADS_LANE?: DurableObjectNamespace } | undefined)?.ADS_LANE
  if (!ns) return
  for (const [axis, lanes] of Object.entries(COMPENSATORS)) {
    const v = verdicts[axis]
    // 판정이 없으면(근거 부족) 건드리지 않는다 — 모르는 상태에서 올리지도, 내리지도 않는다.
    if (!v) continue
    const runs = planBoostRuns(v.ratio ?? null)
    for (const lane of lanes) {
      // runs=1(기본)도 **보낸다** — 회복했을 때 보강을 걷어 주는 것이 이 호출의 절반이다.
      await ns.get(ns.idFromName(lane)).fetch(`https://ur-ads/boost?runs=${runs > 1 ? runs : 0}`, { method: 'POST' })
        .catch(() => undefined)
    }
  }
}
