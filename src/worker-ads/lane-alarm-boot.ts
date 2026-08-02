/**
 * ⏰ **알람 레인 부트스트랩 + cron 게이트** — 엔트리(`index.ts`)에서 쓰는 두 조각.
 *
 * ⚠️ **알람이 이 레인을 몰면 cron 은 손을 뗀다.** 이 큐의 SELECT 는 선점(claim)이 아니라 정렬+LIMIT 이라,
 *   두 경로가 같이 돌면 **같은 사람을 두 번 재고** 예산만 태운다. 그래서 게이트는 한 곳(`laneAlarmDrivesEnrich`)
 *   에서만 판단한다 — 두 군데서 각자 판단하면 한쪽만 고쳐져 겹친다.
 *
 * 🫀 부트스트랩은 **매 정각 멱등 호출**이다. 알람 체인이 어떤 이유로든 끊겨도 다음 정각이 되살린다.
 *   그리고 그 결과를 하트비트로 남긴다 — 여기가 조용히 실패하면 알람이 안 서고 cron 킥은 게이트로
 *   꺼져 있어 **이 레인이 통째로 사라진다**(이 레포가 반복해 만난 '관측 밖 레인'의 정확한 실패 양식).
 *
 * 근거(왜 알람인가)·롤백: `lane-alarm-policy.ts` 헤더.
 */
import { alarmEnabled } from './lane-alarm-policy'

type BeatFn = (
  name: string, ok: boolean, ms: number, err?: unknown, maxGapMin?: number, extra?: Record<string, unknown>,
) => Promise<void>

/** 알람이 보강 레인을 모는가 — 킬스위치 OFF 이거나 DO 바인딩이 없으면 기존 cron 경로가 그대로 돈다. */
export function laneAlarmDrivesEnrich(env: unknown): boolean {
  return alarmEnabled(env) && !!(env as { ADS_LANE?: DurableObjectNamespace } | undefined)?.ADS_LANE
}

/** 알람 체인을 세운다(멱등). 💥 throw 하지 않는다 — 부트스트랩 실패가 다른 레인을 끌고 가면 안 된다. */
export async function bootstrapLaneAlarm(env: unknown, beat: BeatFn): Promise<void> {
  const t0 = Date.now()
  try {
    const ns = (env as { ADS_LANE: DurableObjectNamespace }).ADS_LANE
    const res = await ns.get(ns.idFromName('enrich-influencer')).fetch('https://ur-ads/start', { method: 'POST' })
    const body = await res.json().catch(() => null)
    await beat('lane-alarm-boot', res.ok, Date.now() - t0, undefined, undefined, (body ?? {}) as Record<string, unknown>)
  } catch (err) {
    await beat('lane-alarm-boot', false, Date.now() - t0, err).catch(() => undefined)
  }
}
