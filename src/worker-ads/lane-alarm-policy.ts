/**
 * ⏰ **DO 알람 레인** — cron 부모의 CPU 천장을 우회하는 유일한 무료 경로 (2026-08-02 대표 승인 "한 레인 시범").
 *
 * ## 왜 필요한가 — 오늘 하루가 증명한 천장
 * 유어애즈 레인은 전부 부모 cron 하나가 `SELF.fetch` 로 띄우고 `await` 한다. 그런데 **피호출자의 CPU 는
 * 호출자 몫에서 나간다.** 그래서 부모 CPU = 동시 레인 수 × 각자의 시간이고, 라이브에서 이렇게 끝났다:
 *
 * ```
 *   KST 16:00  디스패치 8 → 완주 2 · 사망 4(ms 3,880~4,152, 값이 같다 = 같은 순간에 끌려감)
 *   KST 17:00  디스패치 6 → 완주 3 · 사망 3(ms 3,649~3,701)      ← per_tick 을 줄여도 사망률 50% 그대로
 * ```
 * ⚠️ **레인을 싸게 만드는 것으로는 못 고친다**가 이 관측의 핵심이다. 사망 목록의 `sheets-sync` 는
 *   같은 날 커서로 잘라 12,000행만 보게 해 둔 레인인데도 죽었다 — 자기 일을 하다 지친 게 아니라
 *   **부모가 죽으며 끌려간** 것이다. 부모가 있는 한 자식은 부모보다 오래 못 산다.
 *
 * ## 알람이 다른 이유
 * DO 알람은 **부모가 없다.** 스토리지에 예약된 시각이 오면 런타임이 **독립 인보케이션**으로 깨운다 —
 * 자기 CPU 예산(30초)과 자기 서브리퀘스트 예산을 그대로 받는다. 그리고 알람 안에서 **다음 알람을 걸어**
 * 스스로 이어진다(정각을 기다리지 않는다).
 *
 * ```
 *   cron 경로 : 시간당 30초 CPU 를 전 레인이 나눠 씀   → 이 레인 몫 ≈ 1회/시간
 *   알람 경로 : 회차마다 자기 30초                      → 이 레인 12회/시간(기본 5분 간격)
 * ```
 *
 * ## 🛡️ 무료 한도를 모르는 채로 켜므로, 스스로를 제한한다
 * 무료 플랜 DO 알람의 정확한 한도를 이 환경에서 확인할 수 없었다(대시보드·요금 페이지 프록시 차단).
 * 그래서 **추측으로 안전하다고 하지 않고, 코드가 상한을 갖게** 했다:
 *   - 시간당 실행 상한(`RUNS_PER_HOUR_DEFAULT`) — 넘으면 다음 정시까지 쉰다.
 *   - 최소 간격 하한 — env 오타로 0 이 들어와도 폭주하지 않는다.
 *   - 실패해도 **간격을 늘려** 다음 알람을 건다(죽은 체인이 되지 않게, 그러나 재시도 폭풍도 아니게).
 *   - 매 회차 `platform_settings` 에 스탬프 → **한도가 실제로 어떤지 라이브에서 측정**한다(이게 시범의 목적).
 *
 * ## ⚠️ 중복 방지
 * 알람이 켜져 있으면 **cron 쪽 같은 레인은 발화하지 않는다**(`index.ts` 에서 게이트). 이 큐의 SELECT 는
 * 선점(claim)이 아니라 정렬+LIMIT 이라, 두 경로가 같이 돌면 같은 사람을 두 번 재고 예산만 태운다.
 *
 * 🔻 롤백: env `ADS_LANE_ALARM_ENABLED='false'` → 알람이 다음 회차를 안 걸고 체인이 멎으며,
 *   cron 게이트가 풀려 기존 경로로 되돌아간다(코드 변경 0).
 *
 * 📦 **이 파일은 정책(순수함수)만** 담는다 — DO 클래스는 `lane-alarm.ts`.
 *   왜 갈랐나: `cloudflare:workers` 를 import 하는 모듈은 vitest 가 해석하지 못해 **유닛을 못 붙인다**
 *   (이 레포의 기존 DO 3개가 전부 그래서 무테스트다). 폭주 방지 상한을 테스트 못 하는 채로
 *   무료 한도가 미확인인 알람을 켜는 건 받아들일 수 없어서, 안전장치를 이쪽으로 뺐다.
 */

/** 기본 간격(ms) — 5분. 시간당 12회. 무료 한도를 모르므로 보수적으로 시작한다. */
export const ALARM_INTERVAL_MS_DEFAULT = 5 * 60_000
/** 간격 하한 — env 오타(0·음수)로 폭주하지 않게. */
export const ALARM_INTERVAL_MS_MIN = 60_000
/** 시간당 실행 상한 — 간격과 별개의 2중 안전장치(간격이 짧게 설정돼도 이 선에서 멎는다). */
export const RUNS_PER_HOUR_DEFAULT = 12
/** 연속 실패 시 간격 배수(지수 백오프 상한 8배) — 죽은 체인도, 재시도 폭풍도 만들지 않는다. */
export const FAIL_BACKOFF_MAX = 8

export const LANE_ALARM_STAMP_KEY = 'ads_lane_alarm_last'

interface AlarmEnv {
  ADS_LANE_ALARM_ENABLED?: string
  ADS_LANE_ALARM_INTERVAL_MS?: string
  ADS_LANE_ALARM_RUNS_PER_HOUR?: string
}

/** 알람이 켜져 있는가 — **기본 ON**(끄려면 명시적으로 'false'). 정비 레인과 같은 하우스 패턴. */
export function alarmEnabled(env: unknown): boolean {
  return (env as AlarmEnv | undefined)?.ADS_LANE_ALARM_ENABLED !== 'false'
}

/** 간격(ms) — env 우선, 하한 클램프. 비숫자·0·음수는 기본값(오타가 파이프라인을 멈추면 안 된다). */
export function resolveInterval(raw: string | undefined): number {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return ALARM_INTERVAL_MS_DEFAULT
  return Math.max(ALARM_INTERVAL_MS_MIN, Math.floor(n))
}

/** 시간당 상한 — 1 이상. 0 을 주면 레인이 통째로 멈추므로 허용하지 않는다. */
export function resolveRunsPerHour(raw: string | undefined): number {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || n < 1) return RUNS_PER_HOUR_DEFAULT
  return Math.min(60, Math.floor(n))
}

/** 이번 회차 뒤 언제 깨울까 — 상한을 넘겼으면 **다음 정시**, 아니면 간격 뒤(실패면 백오프). */
export function nextWakeAt(
  now: number, interval: number, runsThisHour: number, cap: number, failStreak: number,
): number {
  if (runsThisHour >= cap) {
    const topOfNextHour = Math.floor(now / 3_600_000) * 3_600_000 + 3_600_000
    return Math.max(topOfNextHour, now + interval)
  }
  const mult = Math.min(FAIL_BACKOFF_MAX, Math.max(1, failStreak + 1))
  return now + interval * mult
}

/** 시간 버킷 키 — 상한 카운터를 정시마다 리셋하기 위한 값. */
export const hourBucket = (ms: number): number => Math.floor(ms / 3_600_000)

