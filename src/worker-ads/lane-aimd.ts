/**
 * 🎚️ **회차당 레인 수를 스스로 잰다** — 손으로 잰 상수를 학습으로 바꾼다 (2026-08-02).
 *
 * ## 왜 — 그 상수는 **하루 만에 낡았고, 지금 또 낡아 있다**
 * `FREE_LANES_PER_TICK` 는 사람이 "한 정각의 `ok=true` 개수"를 세어 넣은 값이다. 그 파일 주석이
 * 스스로 *"이 값은 이론이 아니라 실측이다 … 레인이 무거워지면 또 내려야 한다"* 고 적어 두었고,
 * 실제로 **08-01 에 8 이었다가 08-02 에 6 으로** 내려갔다(풀이 42k 로 커지며 레인이 무거워졌다).
 *
 * 그런데 6 으로 내린 **당일 라이브가 다시 이렇다**(KST 08-02, 어드민 `cron-heartbeats` 실측):
 * ```
 *   14:00 collect-neis            err=Worker exceeded CPU time limit
 *   16:01 reclassify-company      err=Worker exceeded CPU time limit
 *   17:01 maintenance?phase=quality  err=…
 *   18:01 collect-company         err=…
 * ```
 * ⇒ 6 도 이미 높다. **사람이 재는 한 항상 한 발 늦는다** — 풀은 계속 커지고 레인은 계속 무거워지는데
 *   측정은 누군가 이상을 눈치챈 날에만 일어난다. 이 레포가 반복해 만난 *"실패가 아니라 조용한 낭비"* 다
 *   (죽은 레인의 그 회차 일은 통째로 버려지는데 에러 알림은 아무 데도 안 간다).
 *
 * ## 💰 그리고 유료 전환에서 **같은 상수가 더 크게 틀린다**
 * `PAID_LANES_PER_TICK = 64` 에는 *"사실상 상한 없음"* 이라고 적혀 있다. 그런데 이 축의 한도는
 * 요금제가 아니라 **인보케이션당 CPU** 이고, 유료 기본값도 30초다(올리려면 `limits.cpu_ms` 를 따로
 * 올려야 한다). 서비스 바인딩 피호출자의 CPU 는 **호출자 몫**이므로 부모 비용은
 * `동시 레인 수 × 각자의 CPU` 로 쌓인다 — 즉 **유료로 바꾸는 것만으로 64 가 되면 첫 정각에 무너진다.**
 *
 * ⇒ 그래서 이 학습기는 요금제로 **시작값을 바꾸지 않는다**. 바뀌는 건 **천장**뿐이고,
 *   값은 **직전에 배운 자리에서 이어서 올라간다**. 유료 전환 시 붕괴 없이 하루~이틀에 걸쳐
 *   *그 계정에서 실제로 가능한* 지점을 스스로 찾는다. 대표가 기다리기 싫으면 `ADS_LANES_PER_TICK`
 *   명시값이 학습을 통째로 우회한다(= 킬 스위치).
 *
 * ## 제어 규칙 — AIMD (같은 레포의 서브리퀘스트 학습과 같은 모양)
 * ```
 *   해로운 회차(죽음·기록없음 발생)  →  ×0.75 (최소 1 은 반드시 줄인다)   ← 빠르게 물러난다
 *   깨끗한 회차 2연속                →  +1 (천장까지)                     ← 천천히 되찾는다
 * ```
 * ⚠️ **톱니는 설계다.** 가끔 한 번 죽어야 천장이 어디인지 알 수 있다. 대신 죽음이 *신호*가 되어
 *   다음 회차가 즉시 물러난다 — 지금처럼 매일 같은 시각에 조용히 4개씩 버리는 것과 다르다.
 *
 * ⚠️ **이 파일이 정하는 건 총량뿐이다.** 도메인 비율(`DOMAIN_SHARE`)·측정 몫(`MEASURE_SHARE`)은
 *   대표가 정하는 값이고 여기서 건드리지 않는다(*"총량은 플랫폼 한도가 정하고 비율은 대표가 정한다"*).
 */
import type { TickSummary } from './tick-history'

/** 저장 키 — `platform_settings`. */
export const LANE_LEARN_KEY = 'ads_lanes_learned'

/**
 * 바닥. **2 미만으로 내리지 않는다** — 1 이면 `domainBudgets` 가 도메인 하나만 돌려
 * 나머지 3개가 회차마다 통째로 굶는다(회전으로 완화되지만 주기가 4배가 된다).
 */
export const MIN_LANES_PER_TICK = 2
/** Free 천장 — 레인이 가벼워지면 여기까지 탐색한다. 무료에서 이 위는 관측된 적이 없다. */
export const FREE_LANES_CEILING = 12
/** Paid 천장 — `PAID_LANES_PER_TICK` 과 같은 값. 여기까지 *올라갈 수 있다*는 뜻이지 시작값이 아니다. */
export const PAID_LANES_CEILING = 64

/** 되찾기 전 요구하는 연속 깨끗한 회차 수. 1 이면 매시간 탐색해 톱니가 잦고, 크면 회복이 느리다. */
export const RECOVER_CLEAN_TICKS = 2
/** 물러날 때의 배수. */
export const BACKOFF_FACTOR = 0.75
/**
 * 바닥에서 계속 해로우면 **원인이 부하가 아니다**(예: 하트비트를 아예 안 남기는 레인이 하나 있으면
 * `miss` 가 영구히 1 이다). 그때 더 줄일 수도 없으므로 바닥에 영원히 눌린다 — 그러면 학습기가
 * 처리량을 스스로 반으로 깎아 놓고 아무도 모른다. 이 횟수만큼 눌려 있으면 **한 칸 올려 본다**.
 */
export const PROBE_AFTER_PINNED = 6

/** 회차 간격(정각 cron). 빈 회차 수를 세는 기준. */
export const TICK_INTERVAL_MS = 60 * 60 * 1000
/**
 * 간격 판정의 여유. cron 발화 지연·flush 지연으로 1시간을 조금 넘는 건 흔하다.
 * 이만큼은 "빠진 회차"로 세지 않는다(오탐을 만들면 학습기가 계속 물러난다).
 */
export const GAP_GRACE_MS = 30 * 60 * 1000

/**
 * 🕳️ **기록조차 없는 회차 수** — 이 학습기의 가장 아픈 사각지대를 메운다.
 *
 * ## 왜 필요한가 (2026-08-03 00:45 KST 실측으로 발견)
 * 학습기의 입력은 회차 요약인데, **부모가 flush 전에 죽으면 그 회차는 요약이 없다.**
 * 즉 **가장 심하게 무너진 회차일수록 기록이 안 남는다** — 학습기는 *살아남은 회차만* 보고,
 * 그건 정의상 덜 해로운 회차들이다. ⇒ **물러나야 할 때 신호를 못 받는 편향**이 생긴다.
 *
 * 실측이 정확히 그랬다: `ads_dispatch_last` 는 15:00:35Z 에 디스패치를 기록했는데
 * 그 회차의 요약도 `ads:scheduled` 하트비트도 **둘 다 없었다**. 관측된 회차는 5회 중 2회꼴.
 *
 * ⇒ **빈자리 자체를 신호로 쓴다.** 이력의 시각 간격이 한 회차를 넘으면 그 사이 회차들은
 *   "띄웠는데 기록조차 못 남긴" 회차이고, 그건 `fail` 보다 더 강한 붕괴 신호다.
 *
 * ⚠️ **오탐 원인을 알고 쓴다**: 간격은 **배포로도 생긴다**(배포는 돌고 있는 isolate 를 즉시 죽인다 —
 *   이 레포는 머지가 잦아 그게 일상이다). 다만 그 오탐의 대가는 *한 칸 물러났다가 깨끗한 2회차에
 *   되찾는 것*이라 가볍고 자기교정된다. 반면 편향의 대가는 **영영 안 물러나는 것**이다.
 *
 * @param prevAt 직전 이력 항목의 ISO 시각(없으면 0 — 첫 회차를 해로 몰지 않는다).
 */
export function missedTicks(prevAt: string | null | undefined, nowAt: string): number {
  if (!prevAt || !nowAt) return 0
  const a = Date.parse(prevAt), b = Date.parse(nowAt)
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0
  return Math.max(0, Math.floor((b - a - GAP_GRACE_MS) / TICK_INTERVAL_MS))
}

/**
 * 🕳️ **직전 회차가 '결과 미상'이면 빈자리를 세지 않는다** (2026-08-06).
 *
 * 잠정 항목(`p:1`)은 **디스패치는 됐고 꼬리만 못 돌았다**는 뜻이다. 그 회차의 레인들은 자기
 * 인보케이션에서 계속 돌아 자기 하트비트를 남긴다(라이브 실측: 빈자리 9회차 동안 레인 하트비트
 * 전부 `ok=true`). 그러니 그건 붕괴가 아니라 **관측 실패**다.
 *
 * ⚠️ 그런데 잠정 항목이 이력에 있으면 `missedTicks` 는 그 시각을 기준으로 재므로 간격이 0 이 된다 —
 *   즉 이 함수가 없어도 대개는 맞는다. 이 함수가 필요한 건 **잠정 항목조차 못 쓴 회차가 섞일 때**로,
 *   그때 직전 확정 회차까지 거슬러 세면 *관측만 죽은 회차*까지 해로 잡힌다.
 *
 * @returns 해로 셀 빈자리 수. 직전이 잠정이면 0(판정 보류).
 */
export function missedTicksJudged(
  prev: { at: string; p?: 1 } | null | undefined, nowAt: string,
): number {
  if (!prev) return 0
  if (prev.p === 1) return 0
  return missedTicks(prev.at, nowAt)
}

export interface LaneLearnState {
  /** 다음 회차에 쓸 레인 수. */
  cap: number
  /** 연속 깨끗한 회차 수. */
  clean: number
  /** 바닥에서 연속으로 해로웠던 회차 수 — 구조적 원인 탈출용. */
  pinned: number
}

/** 저장값 → 상태. 깨진 값·부재는 `null`(= 아직 안 배움 → 요금제 기본값에서 시작). */
export function readLaneLearn(raw: unknown): LaneLearnState | null {
  let v: unknown = raw
  if (typeof v === 'string') {
    const s = v.trim()
    if (!s) return null
    // 구 포맷 호환: 숫자 하나만 저장돼 있어도 받아준다.
    if (/^\d+$/.test(s)) return { cap: clampCap(Number(s), PAID_LANES_CEILING), clean: 0, pinned: 0 }
    try { v = JSON.parse(s) } catch { return null }
  }
  const o = v as Partial<LaneLearnState> | null
  if (!o || !Number.isFinite(o.cap as number)) return null
  return {
    cap: clampCap(Number(o.cap), PAID_LANES_CEILING),
    clean: Number.isFinite(o.clean as number) ? Math.max(0, Number(o.clean)) : 0,
    pinned: Number.isFinite(o.pinned as number) ? Math.max(0, Number(o.pinned)) : 0,
  }
}

function clampCap(n: number, ceiling: number): number {
  if (!Number.isFinite(n)) return MIN_LANES_PER_TICK
  return Math.max(MIN_LANES_PER_TICK, Math.min(Math.floor(ceiling), Math.floor(n)))
}

/** 요금제별 천장. **시작값이 아니라 상한**이다(위 주석 참조 — 유료 전환에 시작값을 올리면 무너진다). */
export const laneCeiling = (plan: 'free' | 'paid'): number =>
  plan === 'paid' ? PAID_LANES_CEILING : FREE_LANES_CEILING

/**
 * 한 회차를 '해로웠다'고 부르는 최소 건수. **1 이 아니라 2 인 이유가 이 파일에서 제일 미묘하다.**
 *
 * 레인은 CPU 와 무관하게 **스스로** `ok=false` 를 남기기도 한다. 라이브에 지금 그런 게 있다:
 * ```
 *   ads:enrich-influencer-fanout  ok=false  ms=0  why=직전 팬아웃이 안 착지함
 * ```
 * 이건 그 레인의 자기 판단이지 함대가 과하다는 신호가 아니다. 1 로 두면 이런 자기신고 하나가
 * **매번 전체 레인 수를 깎는다.**
 *
 * 반면 CPU 고갈은 **떼로** 죽인다(부모가 끊기며 매달린 자식을 다 끌고 간다). 실측 3회가 전부 그랬다:
 * `사망 5 · 사망 2 · 사망 4` — 게다가 ms 값이 서로 같다(= 같은 순간에 끊김).
 *
 * ⚠️ **이 문턱이 못 보는 것**: 진짜 CPU 사망이 그 회차에 **딱 하나뿐**이면 물러나지 않는다.
 *   위 근거상 드물다고 보지만, 라이브에서 단독 사망이 반복되면 이 값을 1 로 내려야 한다
 *   (판정: `ads_tick_history` 에서 `fail:1` 인 회차가 이어지는지).
 */
export const HARM_MIN_LANES = 2

/**
 * 🔴 **이 회차가 해로웠는가.** 두 가지를 같게 센다:
 *  - `fail` … 하트비트를 남겼는데 `ok=false`(CPU 한도 문자열이 실제로 여기 들어온다)
 *  - `miss` … 띄웠는데 하트비트가 **아예 없다**(기록도 못 남기고 끊긴 것)
 *
 * ⚠️ `off`(예산 밖에서 기록을 남긴 레인)는 해가 아니다 — DO 알람·우회 레인의 정상 동작이고
 *   라이브에서 실제로 `띄운 7 · 기록 9` 가 나온다. 이걸 해로 세면 학습기가 영원히 바닥에 눌린다.
 */
export const tickHarmed = (t: TickSummary): boolean =>
  Math.max(0, t.fail || 0) + Math.max(0, t.miss || 0) >= HARM_MIN_LANES

/**
 * 회차 결과 하나를 반영해 다음 회차의 레인 수를 낸다.
 *
 * @param prev 직전 상태(없으면 `start` 에서 시작).
 * @param tick 방금 끝난 회차의 요약.
 * @param ceiling 요금제 천장.
 * @param start 아직 배운 게 없을 때의 시작값(= 요금제 기본 상수).
 */
export function learnLanes(
  prev: LaneLearnState | null, tick: TickSummary, ceiling: number, start: number,
  /**
   * 🕳️ 직전 기록 이후 **기록조차 없는 회차 수**(`missedTicks`). 1 이상이면 무조건 해다 —
   *   그 회차들은 부모가 flush 전에 죽은 것이고, 그게 이 학습기가 원래 못 보던 최악의 경우다.
   */
  missed = 0,
): LaneLearnState {
  const top = Math.max(MIN_LANES_PER_TICK, Math.floor(ceiling))
  const base = clampCap(prev?.cap ?? start, top)

  if (!tickHarmed(tick) && missed <= 0) {
    const clean = (prev?.clean ?? 0) + 1
    if (clean < RECOVER_CLEAN_TICKS) return { cap: base, clean, pinned: 0 }
    return { cap: Math.min(top, base + 1), clean: 0, pinned: 0 }
  }

  // 해로웠다 — 물러난다. **최소 1 은 반드시 줄인다**(×0.75 가 반올림으로 제자리가 되면 학습이 멈춘다).
  const backed = Math.min(base - 1, Math.floor(base * BACKOFF_FACTOR))
  const cap = clampCap(backed, top)

  if (cap > MIN_LANES_PER_TICK) return { cap, clean: 0, pinned: 0 }

  // 바닥이다. 계속 해로우면 원인이 부하가 아니므로 한 칸 올려 본다(위 `PROBE_AFTER_PINNED` 주석).
  const pinned = (prev?.pinned ?? 0) + 1
  if (pinned >= PROBE_AFTER_PINNED) return { cap: Math.min(top, MIN_LANES_PER_TICK + 1), clean: 0, pinned: 0 }
  return { cap, clean: 0, pinned }
}
