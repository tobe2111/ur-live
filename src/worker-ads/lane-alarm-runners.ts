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
  /**
   * 🎯 **인플루언서 발굴** — 대표의 유일한 우선순위인데 34개 레인 중 가장 굶고 있었다 (2026-08-03 실측).
   *
   * ## 왜 얹는가 (위 "얹을 근거" 둘 중 **둘 다** 해당)
   * ```
   *   KST 09:00 회차 (per_tick 3 · 무료)
   *     influencer  budget 1 → run:[inbound-onboarding]
   *                            deferred:[collect, consented-reminder, social-maintenance]
   * ```
   * 인플루언서 도메인은 **레인 4개가 시간당 예산 1칸**을 나눠 쓴다 → collect 는 잘해야 4시간에 한 번.
   * 그리고 그 한 번마저 죽는다:
   * ```
   *   22:00:35  디스패치 (run:['collect'])
   *   22:00:38  ads:collect  Worker exceeded CPU time limit.   ← 3초 뒤
   * ```
   * 자식 CPU 는 부모에게 청구되므로 B2B 29개와 같은 벽에 부딪힌다. 실측 결과: **마지막 성공 KST 03:01,
   * 6시간 20분 정지** — 그동안 리드 0건, 커서 0전진.
   * ⇒ 예산 재분배로는 못 푼다(누가 굶느냐만 바뀌고 벽은 그대로다). 자기 인보케이션이 있어야 한다.
   *
   * ## ⚠️ `runsPerHour: 1` 인 이유 — 처리량을 미는 게 아니라 **고장을 고치는 것**
   * cron 이 원래 `0 * * * *`(시간당 1회)다. 기본 12회/시간을 그대로 받으면 그건 **설계 의도를 넘는**
   * 증설이고, 대표가 경계한 네이버 부하 증가가 된다. 여기서는 **의도한 값으로 복원만** 한다.
   *   · YT 검색은 `ytBudgetTotal`(하루 90~100)이 하드캡이라 회차 수와 무관하게 총량이 같다.
   *   · 네이버는 하루 25,000 쿼터에 실사용 ~2%.
   * ⚠️ 이 값을 올리려면 **네이버 차단 리스크를 다시 판단**할 것 — 대표 확인 사항이다.
   *
   * 🔒 이중 실행은 리스(`ads_collect_lease`)가 막는다 — 알람과 cron 이 겹쳐도 한쪽만 잡는다.
   *   그래도 부모 쪽 디스패치는 게이트로 끈다(겹치면 순수 낭비이고, 부모 CPU 를 또 먹는다).
   */
  collect: {
    runsPerHour: 1,
    run: async (env) => {
      const { runInfluencerAutoCollect } = await import('@/features/marketing/api/influencer-auto-collect')
      return runInfluencerAutoCollect(env)
    },
  },
}

export const ALARM_LANE_NAMES = Object.keys(ALARM_LANES)

/** 이름 → 레인. 모르는 이름이면 null(알람은 다음 회차를 걸지 않고 조용히 멎는다 — 유령 인스턴스 방지). */
export const lookupAlarmLane = (name: string | null | undefined): AlarmLane | null =>
  (name && Object.prototype.hasOwnProperty.call(ALARM_LANES, name) ? ALARM_LANES[name]! : null)
