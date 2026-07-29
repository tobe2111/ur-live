/**
 * ⏱️ ur-ads 레인의 **실제 주기**를 하트비트에 알려주는 순수 계산 — 2026-07-29 신설.
 *
 * ## 왜 (실측 — 추측 아님)
 * ur-ads 의 `adsBeat` 은 모든 레인에 **워커의 cron 식(`event.cron` = `0 * * * *`, 매시간)** 을
 * 붙여 기록했다. 그런데 실제 발화 주기는 레인마다 다르다:
 *   · 일 1회 레인 9개(`hourUTC === 15|16|17|19|20|21|22|23`) — NPS·고용24·나라장터·MX 스윕 …
 *   · 짝/홀수시 레인 4개(`hourUTC % 2`) — 상가정보·통신판매·기업수집 …
 *   · 유지보수 5단계 순환(`PHASES[hourUTC % 5]`) — 한 단계는 **최대 9시간** 만에 돌아온다.
 *
 * `expectedMaxAgeMinutes('0 * * * *')` = 150분이라, 이 레인들은 **정상 동작 중에도** 150분이 지나면
 * `stale` 로 찍힌다. 일 1회 레인은 **하루 21.5시간을 매일 '멈춤'으로** 보고하게 된다.
 * 그리고 그 판정은 `/api/_healthcheck/cron` → `uptime.yml`(10분) → **이슈 + 메일**로 나간다.
 *
 * 2026-07-29 라이브 실측에서 이미 발생 중이었다: `ads:maintenance?phase=quality` 가
 * `age 167분 · stale: true` — 5단계 순환이라 정상인데도 경보 대상이었다.
 *
 * `cron-heartbeat.ts` 의 주석은 **"확실히 이상한 것만 울리는 게 목적"** 이라고 못박고 있다.
 * 매일 울리는 오탐은 그 설계 의도를 정면으로 깨고, 곧 아무도 경보를 안 보게 만든다.
 *
 * ## 처방
 * 레인이 자기 주기를 **직접 신고**한다. 그리고 그 주기는 **발화 조건과 같은 자리에서** 나온다
 * (`makeHourGates`) — 조건과 주기를 따로 적으면 언젠가 어긋나고, 어긋나도 조용하다.
 */

/**
 * 주기(분) → "이만큼 지나면 이상하다" 기준(분).
 * `cron-heartbeat.ts` 의 `expectedMaxAgeMinutes` 와 **같은 공식**을 쓴다(기대주기 × 2 + 30분 여유).
 * 공식을 바꾸려면 두 곳이 아니라 이 함수 하나만 바꾸도록 유닛이 동치성을 고정한다.
 */
export const staleGapMinutes = (periodMinutes: number): number => Math.max(1, periodMinutes) * 2 + 30

/** 일 1회 레인. */
export const dailyGapMinutes = (): number => staleGapMinutes(24 * 60)

/** N시간마다 도는 레인. */
export const everyNHoursGapMinutes = (n: number): number => staleGapMinutes(Math.max(1, n) * 60)

/**
 * `PHASES[hourUTC % phaseCount]` 순환에서 **한 단계가 다시 돌아오기까지의 최대 간격(시간)**.
 *
 * ⚠️ 단순히 `phaseCount` 가 아니다. 24가 phaseCount 로 나누어떨어지지 않으면 **자정에서 간격이 벌어진다**.
 *   예) 5단계: 단계 4 는 4·9·14·19시에 돌고 다음은 **다음날 4시** → 간격 9시간(5가 아니라).
 *   단계를 6개로 늘리면 24 % 6 === 0 이라 정확히 6시간이 된다 — 개수를 바꿔도 자동으로 맞는다.
 */
export function maxPhaseGapHours(phaseCount: number): number {
  const p = Math.max(1, Math.floor(phaseCount))
  let worst = 0
  for (let phase = 0; phase < p; phase++) {
    const hours: number[] = []
    for (let h = 0; h < 24; h++) if (h % p === phase) hours.push(h)
    if (!hours.length) continue // 24시간 안에 한 번도 안 도는 단계(p > 24) — 아래 폴백이 받는다
    for (let i = 0; i < hours.length; i++) {
      const next = i + 1 < hours.length ? hours[i + 1] : hours[0] + 24
      worst = Math.max(worst, next - hours[i])
    }
  }
  return worst || 24
}

/** 단계 순환 레인의 stale 기준(분). */
export const phaseGapMinutes = (phaseCount: number): number => staleGapMinutes(maxPhaseGapHours(phaseCount) * 60)

/** `kick(path, fallback, maxGapMin?)` 과 같은 모양이면 무엇이든 받는다(테스트에서 스파이 주입). */
export type KickFn = (path: string, fallback: () => Promise<unknown>, maxGapMin?: number) => void

/**
 * 하트비트 이름 = `/__ads/` 접두와 쿼리를 뗀 것.
 *
 * ⚠️ 쿼리를 떼는 이유: 유지보수 레인은 `?phase=merge` 처럼 **매 시간 다른 이름**으로 기록된다.
 *   쿼리째로 비교하면 그 순간 안 도는 4개 단계가 전부 "한 번도 안 돌았다"로 잡힌다(오탐).
 */
export const laneKey = (path: string): string =>
  path.replace(/^\/__ads\//, '').split('?')[0]

/**
 * 🔭 이 스케줄 실행이 **알고 있는 레인** 모음 — "한 번도 발화하지 않은 레인"을 보이게 하려고 둔다.
 *
 * ## 왜 필요한가 (라이브 사례)
 * 하트비트는 **기록된 행**만 본다. 그래서 게이트는 켜져 있는데 한 번도 안 돈 레인은
 * `stale` 판정 대상 자체가 아니다 — 목록에 아예 없으니 아무도 눈치채지 못한다.
 * 2026-07-29 `ads:collect-nps` 가 정확히 그 상태였고, "안 도는 건지 원래 없는 건지"를
 * 화면에서 구분할 수 없어 세션 여러 개가 같은 질문을 반복했다.
 *
 * ## 어떻게 손복제를 피하나
 * 시각 게이트가 `makeHourGates` 안으로 들어간 덕에, **발화하지 않는 시각에도 헬퍼는 호출된다**
 * → 그 순간 레인 이름을 알 수 있다. 즉 이 목록은 손으로 관리하는 표가 아니라
 * **디스패치 코드가 그 자리에서 뱉는 사실**이다(레인을 추가/삭제하면 자동으로 따라온다).
 *
 * 담기는 것 = **env 게이트를 통과한 레인**(= 돌아야 하는 것). 게이트 OFF 는 의도적 정지이므로 제외.
 */
export interface LaneRegistry {
  note(path: string): void
  /** 알려진 레인 이름(정렬·중복제거). */
  list(): string[]
}

export function createLaneRegistry(): LaneRegistry {
  const seen = new Set<string>()
  return {
    note(path: string) { const k = laneKey(path); if (k) seen.add(k) },
    list() { return [...seen].sort() },
  }
}

/**
 * 알려진 레인 중 **하트비트가 하나도 없는** 것 — 순수함수(테스트 가능).
 * 하트비트 이름은 `ads:` 접두가 붙어 있고 쿼리를 달 수 있으므로 접두/쿼리를 떼고 비교한다.
 */
export function neverFiredLanes(known: string[], beatNames: string[]): string[] {
  const fired = new Set(
    beatNames
      .filter(n => n.startsWith('ads:'))
      .map(n => n.slice('ads:'.length).split('?')[0]),
  )
  return known.filter(k => !fired.has(k)).sort()
}

/**
 * **시각 게이트와 주기 신고를 한 자리에 묶는다.**
 *
 * 이전엔 호출부가 `if (hourUTC === 16 && gate) kick(...)` 처럼 조건만 쓰고 주기는 아무도 안 알렸다.
 * 여기에 묶어두면 "일 1회로 바꿨는데 주기 신고는 매시간 그대로" 같은 드리프트가 **구조적으로 불가능**하다.
 */
export function makeHourGates(hourUTC: number, kick: KickFn, registry?: LaneRegistry) {
  return {
    /** 일 1회 — 지정한 UTC 시각에만. */
    dailyAt(hour: number, path: string, fallback: () => Promise<unknown>): void {
      registry?.note(path)   // ⬅ 발화하지 않는 시각에도 '이 레인이 있다'는 사실은 남긴다
      if (hourUTC === hour) kick(path, fallback, dailyGapMinutes())
    },
    /** N시간마다 — `hourUTC % n === offset` 인 시각에만. */
    everyNHours(n: number, offset: number, path: string, fallback: () => Promise<unknown>): void {
      registry?.note(path)
      if (n > 0 && hourUTC % n === offset) kick(path, fallback, everyNHoursGapMinutes(n))
    },
  }
}

/**
 * 알려진 레인 목록을 `platform_settings` 에 한 줄로 남긴다(스케줄 실행당 D1 쓰기 1회).
 * 어드민이 하트비트와 대조해 "게이트는 ON 인데 기록이 없다"를 판정한다.
 * **절대 throw 하지 않는다** — 관측이 디스패치를 막으면 안 된다.
 */
export const KNOWN_LANES_KEY = 'ads_known_lanes'

export async function recordKnownLanes(env: unknown, lanes: string[]): Promise<void> {
  try {
    const DB = (env as { DB?: { prepare(q: string): { bind(...a: unknown[]): { run(): Promise<unknown> } } } }).DB
    if (!DB || !lanes.length) return
    const value = JSON.stringify({ at: new Date().toISOString(), lanes }).slice(0, 2000)
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(KNOWN_LANES_KEY, value).run()
  } catch { /* fail-soft */ }
}
