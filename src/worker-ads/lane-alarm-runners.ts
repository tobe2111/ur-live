/**
 * 🗂️ **알람이 모는 레인 등록부** — "어떤 이름의 DO 가 무엇을 돌리는가" 한 곳.
 *
 * ## 왜 등록부인가
 * 시범(2026-08-02 `enrich-influencer`)이 통과하자 남은 레인으로 넓힐 차례가 됐는데, DO 클래스를 레인마다
 * 새로 만들면 `wrangler-ads.toml` 마이그레이션이 레인 수만큼 늘어난다. DO **인스턴스**는 이름으로 갈리므로
 * (`idFromName(lane)`), **클래스 하나 + 이름별 인스턴스**면 바인딩 변경 없이 레인을 늘릴 수 있다.
 * ⇒ DO 는 자기 이름(`ctx.id.name`)으로 이 표를 찾아 실행한다.
 *
 * ## 🩺 왜 이 두 레인부터인가 (라이브 근거)
 * ```
 *   enrich-influencer  알람 전: 마지막 실행 4시간 전 · 알람 후: 12회/시간, 시간당 ~150명 측정
 *   maintenance        커서가 KST 10:00 이후 13시간 제자리 · region_pending 32,761 불변
 *                      KST 21:00 사망(CPU) · 22:00 디스패치됐는데 성공·실패 어느 기록도 없음
 * ```
 * 정비는 단계가 `hourUTC` 에 묶여 **하루 3~4회차**뿐이라, 한 번 죽으면 다음 기회가 6~12시간 뒤다.
 * 알람으로 옮기면 회차가 시간당 12회가 되고 **검증 주기도 12시간 → 5분**이 된다.
 *
 * ⚠️ **아무 레인이나 얹지 말 것.** 알람은 자기 인보케이션을 쓰므로 무료 한도를 레인 수만큼 곱한다.
 *   얹을 근거는 "cron 회차를 못 받아 굶는다" 또는 "회차가 죽어 진도가 안 나간다" 여야 한다 —
 *   하루 1회면 충분한 배치(주간 리포트 등)는 cron 이 맞다.
 */
import type { Env } from '@/worker/types/env'

export interface AlarmLane {
  /** 기본 간격 override(ms). 미지정이면 정책 기본(5분). */
  intervalMs?: number
  /** 시간당 상한 override. 미지정이면 정책 기본(12). */
  runsPerHour?: number
  run: (env: Env) => Promise<unknown>
}

/**
 * 🔑 키가 곧 DO 인스턴스 이름이다. 이름을 바꾸면 **다른 인스턴스**가 되어 저장된 알람·카운터가 끊긴다
 *   (옛 인스턴스의 알람이 계속 깨어나 같은 큐를 두 번 집는다) — 이름은 함부로 바꾸지 말 것.
 */
export const ALARM_LANES: Record<string, AlarmLane> = {
  'enrich-influencer': {
    run: async (env) => {
      const { runInfluencerEnrich } = await import('@/features/marketing/api/influencer-enrich-lane')
      return runInfluencerEnrich(env)
    },
  },
  maintenance: {
    run: async (env) => {
      const { runNextMaintenancePhase } = await import('@/features/marketing/api/influencer-maintenance')
      return runNextMaintenancePhase(env)
    },
  },
}

export const ALARM_LANE_NAMES = Object.keys(ALARM_LANES)

/** 이름 → 레인. 모르는 이름이면 null(알람은 다음 회차를 걸지 않고 조용히 멎는다 — 유령 인스턴스 방지). */
export const lookupAlarmLane = (name: string | null | undefined): AlarmLane | null =>
  (name && Object.prototype.hasOwnProperty.call(ALARM_LANES, name) ? ALARM_LANES[name]! : null)
