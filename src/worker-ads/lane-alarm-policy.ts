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
/**
 * 💳 **유료 기본 간격 — 1분**(2026-08-02).
 *
 *   이 레인이 **지금 실제로 보강을 돌리는 주체**다(cron 팬아웃이 아니라). 그런데 간격·상한이
 *   `ADS_PLAN` 을 몰라서, **유료로 바꿔도 처리량이 한 톨도 안 늘어난다** — 요금제 노브가 닿지 않는
 *   조임쇠가 하나 더 있었던 것이다(플랫폼 천장·벽시계에서 이미 한 번 겪은 것과 같은 클래스).
 *
 *   ⚠️ 1분/60회는 **추정**이다. 무료의 5분/12회도 *"한도를 모르므로 보수적으로"* 정한 값이었고,
 *     전환 후 하트비트로 다시 재야 한다(성공 max ↔ 실패 min 경계 — 이 레포의 판정 관용구).
 */
export const ALARM_INTERVAL_MS_PAID = 60_000
/** 간격 하한 — env 오타(0·음수)로 폭주하지 않게. */
export const ALARM_INTERVAL_MS_MIN = 60_000
/** 시간당 실행 상한 — 간격과 별개의 2중 안전장치(간격이 짧게 설정돼도 이 선에서 멎는다). */
export const RUNS_PER_HOUR_DEFAULT = 12
/** 💳 유료 상한 — 분당 1회(=간격 하한과 정합). 이것도 추정이며 전환 후 재측정 대상. */
export const RUNS_PER_HOUR_PAID = 60
/** 연속 실패 시 간격 배수(지수 백오프 상한 8배) — 죽은 체인도, 재시도 폭풍도 만들지 않는다. */
export const FAIL_BACKOFF_MAX = 8

export const LANE_ALARM_STAMP_KEY = 'ads_lane_alarm_last'

interface AlarmEnv {
  ADS_LANE_ALARM_ENABLED?: string
  ADS_LANE_ALARM_INTERVAL_MS?: string
  ADS_LANE_ALARM_RUNS_PER_HOUR?: string
  /** 💳 요금제 — 명시 env 가 없을 때의 **기본값만** 정한다(`dispatch-budget.resolvePlan` 과 같은 규약). */
  ADS_PLAN?: string
}

/** `ADS_PLAN` 해석 — 이 파일은 순수 정책이라 `dispatch-budget` 을 import 하지 않고 같은 규칙을 쓴다.
 *  ⚠️ 규칙이 두 벌이 되지 않도록 **유닛이 두 함수의 판정을 대조**한다(문자열 규약이 갈리면 빨간불). */
function paidPlan(env: unknown): boolean {
  return String((env as AlarmEnv | undefined)?.ADS_PLAN ?? '').trim().toLowerCase() === 'paid'
}

/** 알람이 켜져 있는가 — **기본 ON**(끄려면 명시적으로 'false'). 정비 레인과 같은 하우스 패턴. */
export function alarmEnabled(env: unknown): boolean {
  return (env as AlarmEnv | undefined)?.ADS_LANE_ALARM_ENABLED !== 'false'
}

/**
 * 간격(ms) — env 우선, 하한 클램프. 비숫자·0·음수는 **요금제 기본값**
 * (오타가 파이프라인을 멈추면 안 된다).
 */
export function resolveInterval(raw: string | undefined, env?: unknown): number {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || n <= 0) return paidPlan(env) ? ALARM_INTERVAL_MS_PAID : ALARM_INTERVAL_MS_DEFAULT
  return Math.max(ALARM_INTERVAL_MS_MIN, Math.floor(n))
}

/** 시간당 상한 — 1 이상. 0 을 주면 레인이 통째로 멈추므로 허용하지 않는다. 부재면 **요금제 기본값**. */
export function resolveRunsPerHour(raw: string | undefined, env?: unknown): number {
  const n = Number(String(raw ?? '').trim())
  if (!Number.isFinite(n) || n < 1) return paidPlan(env) ? RUNS_PER_HOUR_PAID : RUNS_PER_HOUR_DEFAULT
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


/* ────────────────────────────────────────────────────────────────────────────
 * 🫀 죽은 알람 체인 되살리기 — **"걸려 있다"와 "살아 있다"는 다르다**
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 지나간 알람을 **죽었다**고 볼 여유(ms). 예약 시각이 이만큼 지나도 안 깨어났으면 체인이 끊긴 것이다.
 *
 * 간격(5분)의 몇 배로 두는 이유: 런타임의 알람 발화는 **정확하지 않다**(수십 초~수 분 지연이 정상).
 * 너무 짧으면 정상 지연을 죽음으로 오판해 알람을 계속 덮어써서 **오히려 회차를 잃는다**.
 */
export const ALARM_DEAD_AFTER_MS = 30 * 60_000

/**
 * 🔴 **부트스트랩이 이 레인을 되살려야 하는가.**
 *
 * ## 왜 이 함수가 생겼나 (2026-08-09 라이브 실측 — 측정 갈래 하나가 6시간 죽어 있었다)
 * `/start` 는 `getAlarm()` 이 non-null 이면 *"이미 걸려 있다"* 며 아무것도 안 했다. 그런데
 * **예약 시각이 3.5시간 전인데 안 깨어난** 인스턴스가 바로 그 상태였다 — 값은 있는데 체인은 죽었다.
 * ```
 *   enrich-influencer     마지막 실행 16:24 · alarmAt 은 3.5h 과거   → 측정 0/시간
 *   lane-alarm-boot:…     ok=true started=false                     → 화면은 초록
 * ```
 * 그 파일 헤더는 *"알람 체인이 어떤 이유로든 끊겨도 다음 정각이 되살린다"* 고 약속했는데,
 * **매 정각 확인하면서 매 정각 못 살리고 있었다.** 자가치유가 자기가 고쳐야 할 상태를 건강으로 읽은 것이다
 * (이 레포가 반복해 만난 *"침묵이 성공처럼 보인다"* 의 알람 계층 판).
 *
 * ⚠️ **`null` 과 '과거'를 구분해서 돌려준다** — 호출부가 둘을 같은 로그로 뭉개면 다음 세션이
 *   "원래 없었다"와 "죽어서 되살렸다"를 또 구분 못 한다. 그게 이 사고를 6시간 안 보이게 만든 원인이다.
 *
 * @param cur `getAlarm()` 결과(없으면 null)
 * @param now 현재 ms
 * @returns `'none'` 처음 세움 · `'stale'` 죽어서 되살림 · `'alive'` 정상(건들지 않음)
 */
export function alarmReviveKind(
  cur: number | null | undefined, now: number, deadAfterMs = ALARM_DEAD_AFTER_MS,
): 'none' | 'stale' | 'alive' {
  if (cur == null || !Number.isFinite(cur)) return 'none'
  return now - cur > Math.max(0, deadAfterMs) ? 'stale' : 'alive'
}

/**
 * ⏳ **"N시간에 한 번"을 시각의 짝수성이 아니라 경과 시간으로 판정한다** (2026-08-17 라이브 실측).
 *
 * ## 무엇이 고장이었나 — 복구가 쓸모없는 시각에 착지한다
 * `collect-commerce`·`collect-storeinfo` 는 외부 API 호출량을 묶으려고 `UTCHours % 2 !== 0` 이면
 * 건너뛰었다. 그런데 알람은 **가끔 안 깨어난다**(런타임 특성). 그러면:
 *
 * ```
 *   짝수시 HH:00   알람 유실 → 수집 0
 *   HH+1:00        부트가 stale 판정 → 즉시 재무장 → 깨어남 → **홀수시라 그냥 skip**
 *   HH+2:00        정상 실행
 *   ⇒ 유실된 짝수시는 **영영 복구되지 않는다.** 자가치유가 돌았는데 아무것도 못 건졌다.
 * ```
 *
 * 실측(2026-08-17, 최근 5일 · UTC 짝수시 12칸): 각 칸이 **3~5일만** 채워졌다 — 특정 시간대가 아니라
 * **무작위로 1/4이 빈다**(시간대 제한이면 특정 칸이 통째로 비었을 것이다. 그래서 이 둘을 먼저 갈랐다).
 * commerce 는 회차당 ~990건이라 이 유실이 **하루 ~2,300건**이다.
 *
 * ## 고침
 * 짝수성 대신 **마지막 실행으로부터 N시간 경과**로 묻는다. 그러면 유실된 회차를 **다음 시간**이
 * 이어받는다(그때는 2시간이 지났으므로). 외부 호출량은 그대로 묶인다 — 시간당 상한이 1이라
 * 최악도 하루 12회로 같다.
 *
 * ⚠️ 첫 실행(기록 없음)은 **즉시 실행**한다. 여기서 막으면 배포 직후 그 레인이 N시간 굶는다.
 */
export function dueByElapsed(
  lastRunAt: number | null | undefined, now: number, minHours: number,
): boolean {
  if (!(minHours > 0)) return true
  if (lastRunAt == null || !Number.isFinite(lastRunAt)) return true   // 첫 실행은 막지 않는다
  // 알람 발화는 정확하지 않다(수십 초 지연이 정상) — 그 오차로 한 칸을 통째로 미루면 안 되므로
  // 1분의 여유를 둔다. 이게 없으면 HH:00:03 에 깨어난 회차가 "1시간 59분 57초"라 밀려 2시간을 더 기다린다.
  return now - lastRunAt >= minHours * 3_600_000 - 60_000
}
