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
 * `cron-heartbeat.ts` 의 `staleToleranceMinutes` 와 **같은 공식**을 쓴다.
 * 공식을 바꾸려면 두 곳이 아니라 이 함수 하나만 바꾸도록 유닛이 동치성을 고정한다.
 *
 * 🩸 2026-08-25: `× 2 + 30` 고정에서 **주기 비례**로 바뀌었다. 하루 1회 레인에 ×2 를 쓰면
 *   "하루를 통째로 건너뛰어도 조용하다"는 뜻이고, 실제로 그날 정산 cron 17개가 그렇게 빠졌다.
 *   근거·규칙은 `staleToleranceMinutes` docblock 참조(그쪽이 SSOT 서술).
 *
 * ⚠️ ur-ads 는 별도 워커라 여기 값을 **복제**한다. 갈라지면 `ads-lane-cadence.test.ts` 가 빨강.
 */
export const staleGapMinutes = (periodMinutes: number): number => {
  const base = Math.max(1, Math.floor(periodMinutes))
  if (base >= 60 * 24) return base + Math.min(Math.floor(base / 4), 6 * 60)
  return base * 2 + 30
}

/**
 * 매시간 레인 — `kick` 이 `gap` 없이 호출될 때의 기본값.
 * ⚠️ 이걸 안 주면 그 레인은 `missing`(판정 불가)으로 분류돼 **침묵 검사에서 통째로 빠진다**
 *   (자식 하트비트는 cron 식을 안 싣는다 — 근거는 `index.ts` 의 `kick` 주석).
 */
export const hourlyGapMinutes = (): number => staleGapMinutes(60)

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
  // 균등 순환은 "슬롯 i 에 단계 i" 인 배정표와 같다 — 아래 일반형에 위임(공식을 두 벌 두지 않는다).
  return maxScheduleGapHours(Array.from({ length: p }, (_, i) => i))
}

/**
 * **가중 배정표**(같은 단계가 여러 슬롯을 차지)에서 한 단계가 다시 돌아오기까지의 최대 간격(시간).
 *
 * ⚠️ 왜 `maxPhaseGapHours(schedule.length)` 로 대신하면 안 되나: 그건 슬롯이 전부 **서로 다른 단계**라고
 *   가정한 값이라, 가중 배정표에서는 실제보다 크게 나온다. 2026-07-29 정비 배정표(10슬롯)의 실제 최대
 *   간격은 **10시간**인데 슬롯 수 기준으로는 14시간이 나왔다 — 그대로 쓰면 stale 경보 창이 18.5h → 28.5h 로
 *   **느슨해진다**(멈춤을 그만큼 늦게 안다). 경보를 조용히 약화시키는 건 이 레포가 반복해 만난 실패 양식이라,
 *   배정표를 그대로 읽어 계산한다.
 * ⚠️ 24시간으로 닫아 계산하는 게 맞다 — `hourUTC` 는 매일 0 으로 리셋되므로 배정 패턴의 주기는 항상 하루다
 *   (슬롯 수가 24의 약수가 아니어도 마찬가지).
 *
 * `skipHours` — 그 시각을 **다른 레인에 양보**해 이 배정표가 안 도는 시간. 양보는 간격을 넓히므로
 *   경보 임계가 여전히 유효한지 계산으로 확인할 수 있어야 한다(유닛이 그걸 검사한다).
 */
export function maxScheduleGapHours(schedule: readonly unknown[], skipHours: readonly number[] = []): number {
  const n = schedule.length
  if (n < 1) return 24
  const skip = new Set(skipHours)
  let worst = 0
  for (const phase of new Set(schedule)) {
    const hours: number[] = []
    for (let h = 0; h < 24; h++) if (!skip.has(h) && schedule[h % n] === phase) hours.push(h)
    if (!hours.length) continue // 슬롯 수 > 24 — 24시간 안에 한 번도 안 오는 단계는 아래 폴백이 받는다
    for (let i = 0; i < hours.length; i++) {
      const next = i + 1 < hours.length ? hours[i + 1]! : hours[0]! + 24
      worst = Math.max(worst, next - hours[i]!)
    }
  }
  return worst || 24
}

/** 균등 단계 순환 레인의 stale 기준(분). */
export const phaseGapMinutes = (phaseCount: number): number => staleGapMinutes(maxPhaseGapHours(phaseCount) * 60)

/**
 * 가중 배정표 레인의 stale 기준(분) — 배정표를 그대로 넘긴다.
 * `skipHours` 는 다른 레인에 **양보한** 시각(간격이 그만큼 넓어지므로 임계도 함께 넓어져야 한다).
 */
export const scheduleGapMinutes = (schedule: readonly unknown[], skipHours: readonly number[] = []): number =>
  staleGapMinutes(maxScheduleGapHours(schedule, skipHours) * 60)

/**
 * `kick(path, fallback, opts?)` 과 같은 모양이면 무엇이든 받는다(테스트에서 스파이 주입).
 *   `gap`  — 이 레인의 실제 기대 간격(분). 없으면 워커 cron 식에서 유도(= 매시간).
 *   `beat` — 하트비트 이름 고정(경로가 바뀌어도 옛 행이 남아 영원히 stale 로 경보되는 것 방지).
 */
export interface KickOpts {
  /** 침묵 판정 임계(분) — `staleGapMinutes` 로 부풀린 값. 주기가 아니다. */
  gap?: number
  /** 이 레인의 **실제 주기**(분). 미루기 판정은 이 값으로 한다(`isDeferrable`). 생략 시 매시간. */
  period?: number
  beat?: string
}
export type KickFn = (path: string, fallback: () => Promise<unknown>, opts?: KickOpts) => void

/**
 * 🧭 레인 후보에 실을 **주기/임계 두 값** — `KickOpts` 옆에 두어 두 뜻이 한 화면에서 읽히게 한다.
 *
 * - `gapMin` … 침묵 판정 임계. `staleGapMinutes` = 주기×2+30 으로 **부풀린** 값이다(하트비트 `g`).
 *   안 주면 그 레인은 침묵 판정에서 통째로 빠지므로(#1006) 매시간 기본값을 채워 넣는다.
 * - `periodMin` … **실제 주기**. 미룰 수 있는지는 이 값으로만 판정한다(`isDeferrable`).
 *
 * ⚠️ **명시 `gap` 을 받은 레인(게이트: 일 1회·N시간·스케줄)엔 `periodMin` 을 일부러 안 싣는다.**
 *   그래야 `gapMin` 폴백으로 종전과 똑같이 `always` 로 남는다. 여기에 60 을 실으면 반대 사고가 난다 —
 *   미룰 수 있게 되고, 조 차례가 지정 시각이 아닌 때 걸리는 순간 **영영 안 돈다**(침묵이 아니라 부재라
 *   경보에도 안 잡힌다). 두 방향 다 주입 검증으로 고정돼 있다.
 */
export function laneCadenceFields(opts?: KickOpts): { gapMin: number; periodMin?: number } {
  const gapMin = opts?.gap ?? hourlyGapMinutes()
  if (opts?.period !== undefined) return { gapMin, periodMin: opts.period }
  return opts?.gap === undefined ? { gapMin, periodMin: 60 } : { gapMin }
}

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
  /**
   * @param path  `/__ads/...` 경로
   * @param beat  하트비트 이름을 경로와 **다르게** 쓰는 레인의 그 이름(`kick` 의 `opts.beat`).
   *
   * ⚠️ 2026-07-29 실측 버그 — 원래 `path` 만 받았다. 그런데 `kick` 은 beat 이름을 덮어쓸 수 있고
   *   실제로 덮어쓰는 레인이 있다(`/__ads/enrich-company-driver` → beat `enrich-company`).
   *   알려진 목록엔 경로 이름이, 하트비트엔 beat 이름이 들어가니 **같은 레인이 `never_fired`(경로 이름은
   *   기록이 없다)와 `orphan_lanes`(beat 이름은 알려진 목록에 없다) 양쪽에 동시에** 떴다.
   *   판정을 오도한다 — 이번 세션이 실제로 "enrich-company-driver 가 한 번도 안 돌았다"고 오진했다.
   */
  note(path: string, beat?: string): void
  /** 알려진 레인 이름(정렬·중복제거). */
  list(): string[]
}

export function createLaneRegistry(): LaneRegistry {
  const seen = new Set<string>()
  return {
    note(path: string, beat?: string) { const k = (beat || '').trim() || laneKey(path); if (k) seen.add(k) },
    list() { return [...seen].sort() },
  }
}

/**
 * 알려진 레인 중 **하트비트가 하나도 없는** 것 — 순수함수(테스트 가능).
 * 하트비트 이름은 `ads:` 접두가 붙어 있고 쿼리를 달 수 있으므로 접두/쿼리를 떼고 비교한다.
 */
export function neverFiredLanes(known: string[], beatNames: string[]): string[] {
  // 🔴 **양쪽을 같은 방식으로 정규화한다** (2026-08-03 라이브 오탐 수리).
  //   종전엔 하트비트 쪽만 쿼리를 뗐다. 그런데 `known` 은 **쿼리를 단 채로** 들어온다
  //   (`reclassify-company?passes=5` · `collect-localdata?mode=backfill` — 레지스트리가 beat 이름을 그대로 담는다).
  //   그래서 쿼리 있는 레인은 **하트비트가 멀쩡히 있어도 영원히 "한 번도 안 돌았다"** 로 찍혔다.
  //   실측(08-03 02:30 KST): `never_fired: ['collect-localdata?mode=backfill','reclassify-company?passes=5']`
  //   — 후자는 그 시각 하트비트가 존재했다(16:01 KST). 오탐이 경보 전체의 신뢰를 깎는다.
  const fired = new Set(beatNames.filter(n => n.startsWith('ads:')).map(baseLaneName))
  return known.filter(k => !fired.has(baseLaneName(k))).sort()
}

/** `ads:` 접두와 쿼리를 떼어 레인 이름을 한 형태로 만든다 — **비교하는 양쪽 모두** 이걸 통과해야 한다. */
const baseLaneName = (n: string): string =>
  (n.startsWith('ads:') ? n.slice('ads:'.length) : n).split('?')[0]

/**
 * 🪦 반대 방향 — **기록은 있는데 지금은 아무도 부르지 않는 레인**(고아 하트비트).
 *
 * ## 왜 (라이브 실측 2026-07-29)
 * `ads:sweep-kakao-phone` 이 `age 196분 · stale` 로 경보 중이었는데, 그 레인은 **이름이 바뀌었다**
 * (`sweep-kakao-chain`). 옛 이름의 행은 아무도 갱신하지 않으므로 **영원히 stale** 이다 —
 * 고칠 수 없는 경보는 곧 전체 경보를 무시하게 만든다.
 *
 * `never_fired`(알려졌는데 기록 없음)의 정확한 반대다. 둘을 같이 보면
 * "안 도는 것"과 "이제 없는 것"이 화면에서 갈린다.
 *
 * ⚠️ 해석 주의: 고아로 잡히는 이유는 **둘** 이다 — ① 레인이 없어짐/이름 바뀜 ② **게이트가 OFF**
 *   (알려진 목록에는 게이트 통과 레인만 담기므로). 둘 다 "지금은 돌 예정이 아님"이라 경보 대상이
 *   아니라는 점은 같지만, 지우기 전에 어느 쪽인지 확인할 것.
 *
 * ## 🔴 나이를 함께 본다 (2026-08-03 라이브 오탐 수리)
 * 종전엔 "알려진 목록에 없으면 고아" 였다. 그런데 **디스패처가 안 띄우는데도 정상적으로 도는 레인**이
 * 여럿이다 — DO 알람이 돌리는 보강·정비 레인(`#975` 이후), 예산 밖 우회 레인(`sheets-sync`).
 * 그 결과 실측에서 **16개가 고아로 찍혔고 그중 대부분이 그 순간 멀쩡히 돌고 있었다**:
 * ```
 *   maintenance?phase=* · enrich-influencer-driver · lane-alarm-boot · sheets-sync …
 * ```
 * 고칠 게 없는 경보 16줄은 **진짜 하나**(`sweep-kakao-phone`, 4일 정지)를 묻어 버린다.
 *
 * ⇒ **최근에 뛰고 있으면 고아가 아니다.** 목록에 없든 있든, 도는 레인은 도는 것이다.
 *   이 판정은 목록을 손으로 관리하지 않아도 되므로 새 실행 경로(알람·우회)가 생겨도 안 깨진다.
 *
 * @param beats 이름 + 마지막 기록 이후 경과(분). 나이를 모르면(`null`) **고아로 안 본다**(보수적).
 * @param staleMinutes 이 시간 넘게 기록이 없어야 고아 후보. 기본 24시간(어드민 `stale` 과 같은 기준).
 */
export function orphanLaneBeats(
  known: string[],
  beats: ReadonlyArray<{ name: string; age_minutes?: number | null }>,
  staleMinutes = 60 * 24,
): string[] {
  const k = new Set(known.map(baseLaneName))
  return beats
    .filter(b => typeof b?.name === 'string' && b.name.startsWith('ads:'))
    .filter(b => {
      const base = baseLaneName(b.name)
      if (base === 'scheduled') return false      // 레인이 아니라 스케줄러 자체 신호
      if (k.has(base)) return false               // 지금도 디스패처가 부르는 이름
      const age = b.age_minutes
      if (!Number.isFinite(age as number)) return false  // 나이를 모르면 단정하지 않는다
      return (age as number) > staleMinutes       // 🔴 최근에 뛰고 있으면 고아가 아니다
    })
    .map(b => b.name)
    .sort()
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
    dailyAt(hour: number, path: string, fallback: () => Promise<unknown>, beat?: string): void {
      registry?.note(path, beat)   // ⬅ 발화하지 않는 시각에도 '이 레인이 있다'는 사실은 남긴다(이름은 beat 우선)
      if (hourUTC === hour) kick(path, fallback, { gap: dailyGapMinutes(), ...(beat ? { beat } : {}) })
    },
    /** N시간마다 — `hourUTC % n === offset` 인 시각에만. */
    everyNHours(n: number, offset: number, path: string, fallback: () => Promise<unknown>, beat?: string): void {
      registry?.note(path, beat)
      if (n > 0 && hourUTC % n === offset) kick(path, fallback, { gap: everyNHoursGapMinutes(n), ...(beat ? { beat } : {}) })
    },
    /**
     * 매시간 **가중 배정표** 순환 — 단, `yieldHours` 의 시각은 다른 레인에 양보하고 건너뛴다.
     *
     * ⚠️ **양보 시각과 주기 신고를 한 자리에서 만드는 것이 이 메서드의 존재 이유다.**
     *   `if (hourUTC !== 19) { kick(…, { gap: scheduleGapMinutes(PHASES, [19]) }) }` 처럼 손으로 쓰면
     *   조건과 주기가 **두 군데**가 되고, 한쪽만 고치는 순간 *"안 도는데 경보는 안 울리는"* 상태가 된다 —
     *   위 회귀 차단 주석이 말하는 원래 버그와 **같은 모양**이다(그 유닛이 실제로 내 첫 판을 잡았다).
     *   양보를 늘리려면 `yieldHours` 에 더하기만 하면 주기 신고가 **자동으로 따라온다.**
     *
     * `beatOf` 를 주면 하트비트 이름을 고정한다(경로에 쿼리가 붙어 단계마다 이름이 갈리는 것 방지).
     */
    hourlySchedule<T>(
      schedule: readonly T[],
      yieldHours: readonly number[],
      pathOf: (phase: T) => string,
      fallbackOf: (phase: T) => () => Promise<unknown>,
      beatOf?: (phase: T) => string,
    ): void {
      if (!schedule.length) return
      const phase = schedule[hourUTC % schedule.length] as T
      const path = pathOf(phase)
      const beat = beatOf?.(phase)
      registry?.note(path, beat) // 양보한 시각에도 '이 레인이 있다'는 사실은 남긴다(dailyAt 과 같은 이유)
      if (yieldHours.includes(hourUTC)) return
      kick(path, fallbackOf(phase), { gap: scheduleGapMinutes(schedule, yieldHours), ...(beat ? { beat } : {}) })
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

/**
 * 🕐 **이 회차가 새 배포 직후인가** — 관측을 오염시키는 가장 흔한 원인을 하트비트가 스스로 말하게 한다.
 *
 * ## 왜 (2026-07-29, 같은 실수를 세 번)
 * 배포는 진행 중인 isolate 를 죽인다. 그래서 **배포 창에 걸린 정각 회차는 아무 일도 못 하고 사라진다** —
 * 하트비트엔 `ms=0`, 카운터는 `+0`. 그 모양은 **코드 결함과 구분되지 않는다.**
 * 실제로 이 세션은 그걸 보고
 *   ① "self-chain 이 수집을 죽였다"(11:00) ② "#880 의 바닥이 부족하다"(13:00)
 * 로 두 번 오진했고, 두 번 다 **GitHub 배포 로그를 파러 가서야** 사실을 알았다.
 * 그런데 그 정보는 워커가 이미 갖고 있다 — 자기 번들이 언제 만들어졌는지.
 *
 * ## 읽는 법
 * `build_age_min` 이 **0~2** 면 그 회차는 배포와 겹쳤을 가능성이 높다 ⇒ **판정 근거로 쓰지 말 것.**
 * 값이 없으면(로컬/테스트 번들) 스탬프가 주입되지 않은 것 — 그때도 조용히 비운다(관측이 실행을 막지 않는다).
 */
export function buildAgeInfo(nowMs: number = Date.now()): { build_age_min?: number } {
  try {
    const raw = (globalThis as { __ADS_BUILD_AT__?: string }).__ADS_BUILD_AT__
      ?? (typeof __ADS_BUILD_AT__ === 'string' ? __ADS_BUILD_AT__ : undefined)
    if (!raw) return {}
    const t = Date.parse(raw)
    if (!Number.isFinite(t)) return {}
    return { build_age_min: Math.max(0, Math.round((nowMs - t) / 60000)) }
  } catch { return {} }
}

/**
 * 🔁 **회전을 아는 침묵 기준** (2026-08-05 — 라이브 경보 6건 중 5건이 오탐이었다).
 *
 * ## 왜 — 이 파일이 고친 문제의 한 겹 아래
 * 위 `hourlyGapMinutes()` 는 "매시간 도는 레인"을 전제로 150분을 준다. 그런데 **매시간 도는 건
 * 부모**고, 레인은 회차마다 `lanesPerTick` 개만 **돌아가며** 뽑힌다. 즉 매시간 *자격이 있는* 레인도
 * 실제 차례는 몇 시간에 한 번이다 — 기준이 구조적으로 지킬 수 없는 값이라 **영원히 울린다.**
 *
 * 2026-08-05 라이브 실측(경보 6건):
 * ```
 *   collect-store-kakao 420분 · sweep-kakao-chain 300 · collect-hira 300
 *   collect-localdata   180분 · match-registry    180      ← 다섯 다 정상(마지막 결과 전부 성공)
 *   scan-notices       4139분                              ← 이것만 진짜(일 1회 레인, 3일 침묵)
 * ```
 * 배분 스냅샷이 답이었다: `prospect` 도메인은 **몫 1 에 레인 5개**라 한 레인의 차례가 **5시간**이다.
 * 기준 150분으로는 정상 동작이 매번 경보가 된다.
 *
 * 🔴 그리고 이게 왜 중요하냐면 — **오탐 다섯이 진짜 하나를 덮고 있었다.** 이 파일의 헤더가 이미
 *   경고한 그대로다: *"매일 울리는 오탐은 곧 아무도 경보를 안 보게 만든다."*
 *
 * ## 계산
 * 한 도메인에서 예산 슬롯을 두고 경쟁하는 레인 수 ÷ 그 도메인의 몫 = 회전(회차).
 * `always`(게이트가 지정 시각에만 여는 레인)는 예산과 무관하게 항상 도니까 **뺀다** —
 * 안 빼면 회전이 부풀어 기준이 필요 이상으로 느슨해진다.
 *
 * ⚠️ **`periodMin` 은 절대 안 건드린다.** 그 값은 *미룰 수 있는가*(`isDeferrable`)의 근거이고,
 *   여기서 키우면 일 1회 레인이 미룰 수 있게 되어 **영영 안 도는** 반대 사고가 난다(위 주석 참조).
 *   이 함수가 만지는 것은 **침묵 임계 하나**뿐이다.
 *
 * ⚠️ 이 완화가 **놓치는 것**: 매시간 레인이 진짜로 멈춰도 경보가 회전 배수만큼 늦어진다
 *   (`prospect` 면 150분 → 630분). 그 대가로 얻는 것이 "울리면 진짜"라는 신뢰다.
 *   일 1회·N시간 레인은 명시 `gap` 을 갖고 회전 대상도 아니라 **기준이 그대로**다 — 위 실측에서
 *   `scan-notices` 만 계속 울리는 이유이고, 그게 이 설계가 지키려는 성질이다.
 */
export function rotationTicks(d?: { budget?: number; run?: readonly unknown[]; deferred?: readonly unknown[]; always?: number } | null): number {
  const budget = Math.max(1, Math.floor(Number(d?.budget) || 0) || 1)
  const running = Math.max(0, (d?.run?.length ?? 0) - Math.max(0, Math.floor(Number(d?.always) || 0)))
  const compete = running + (d?.deferred?.length ?? 0)
  if (compete <= 0) return 1
  return Math.max(1, Math.ceil(compete / budget))
}

/**
 * 회전을 반영한 침묵 임계(분). **미루기 대상(= `periodMin` 을 가진 레인)에만** 쓴다 —
 * 명시 `gap` 레인은 회전을 안 타므로 부르지 않는다.
 */
export const rotatedGapMinutes = (periodMin: number, rotation: number): number =>
  staleGapMinutes(Math.max(1, periodMin) * Math.max(1, rotation))

/** esbuild `define` 이 주입하는 빌드 시각(ISO). 주입 안 된 환경(로컬·테스트)에선 존재하지 않는다. */
declare const __ADS_BUILD_AT__: string | undefined
