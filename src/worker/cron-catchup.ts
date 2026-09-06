/**
 * 🩹 **놓친 하루치를 같은 날 안에 만회한다** (2026-08-31, 대표 "고칠 수 있는 거 영구적으로 고쳐").
 *
 * ## 무엇이 문제였나 (라이브 실측)
 *
 * 무료 플랜은 cron 트리거를 **계정당 5개**만 준다. 그래서 이 레포는 작업 40여 개를 5분 캐리어
 * 하나에 얹고 `slotDue` 로 "하루 중 이 5분 틱 하나"에 각각 배치했다. 그 설계의 대가가 이것이다:
 *
 * > **그 한 틱을 놓치면 하루를 통째로 잃는다.**
 *
 * 놓치는 길은 둘이고 **둘 다 조용하다**:
 *   1. 그 틱이 아예 안 울린다 — 무료 cron 은 전달 보장이 없다.
 *   2. 울렸는데 **서브리퀘스트 예산(무료 ~50)이 먼저 마른다** — 같은 인보케이션의 앞 작업들이
 *      다 쓰면 뒤 작업은 **에러 없이 잘린다**(2026-08-25 에 일간 블록을 네 레인으로 쪼갠 이유).
 *
 * 2026-08-31 실측:
 * ```
 * 이용권 만료 알림 · 예약 리마인더 · 숙박 체크아웃 전환   94시간 전   (마지막 08-27 09:40)
 * growth-daily-batch · 별점 시드                        120시간 전  (마지막 08-25 18:40)
 * reconciliation · influencer-payout · 원장 정합          격일꼴     (6일 중 3일)
 * kt-alpha-voucher-retry(결제됐는데 안 간 교환권 복구)     72시간 전
 * ```
 *
 * ## 처방 — 시간당 한 번, 그날 안 돈 것만
 *
 * 정시 틱에 더해 **매시 :55 틱**을 만회 기회로 쓴다. 그 틱에서:
 *   1. 하트비트를 **한 번** 읽는다(질의 1회 = 서브리퀘스트 1). 실패하면 **만회를 포기한다**(fail-closed).
 *   2. 오늘 주기가 이미 시작된 일간·주간 블록을 연다.
 *   3. 블록 안의 각 작업은 **이번 주기에 이미 돌았으면 스스로 건너뛴다** — 그래서 정상인 날의
 *      만회 틱은 비용이 사실상 0 이고, 절반만 돌다 잘린 날은 **남은 것만** 돈다.
 *   4. 한 틱에 새로 시작하는 작업은 `CATCHUP_MAX_JOBS` 개까지 — 만회가 예산을 또 말리는 것을 막는다.
 *
 * ⇒ 하루 1회였던 기회가 **최대 24회**가 된다. 새 트리거도, 새 테이블도, 새 쓰기도 필요 없다.
 *
 * ## ⚠️ 이 모듈이 **못 하는 것** (과신 금지)
 *
 * - **정시 경로는 한 바이트도 안 바뀐다.** 만회는 :55 틱에서만 켜진다 — 즉 최악의 경우가 '현행 그대로'다.
 * - **어제 것은 만회하지 않는다.** 주기는 그날(UTC) 안으로 닫는다. 18시 블록이 통째로 죽으면
 *   만회 창은 18:55~23:55 다섯 번뿐이고, 자정을 넘기면 다음 정시를 기다린다. 경계가 있는 편이
 *   "언제 두 번 도는지 모르는" 것보다 낫다.
 * - **CPU 한도는 못 넘는다.** 유어애즈 보강 레인이 죽는 원인은 이것이고, 코드로 해결되지 않는다.
 * - **중복 실행을 원자적으로 막지 않는다.** 판단 근거가 *선점*이 아니라 *하트비트*(완료 후 기록)라,
 *   어떤 작업이 5분 넘게 돌면 다음 만회 틱이 다시 시작할 수 있다. 여기 얹힌 작업은 전부 초 단위이고
 *   자체 멱등이라 실익이 위험을 넘는다고 판단했다. 오래 도는 작업(예: 분할 백업)은 **얹지 말 것** —
 *   그건 전용 트리거를 쓴다.
 */

import type { SlotSpec } from './cron-slot'

/** 만회를 시도하는 분. 다른 어떤 슬롯 게이트도 쓰지 않는 분이어야 한다(가장 한산한 인보케이션). */
export const CATCHUP_MINUTE = 55

/**
 * 만회 틱 하나가 **새로** 시작할 수 있는 작업 수.
 *
 * 만회가 예산을 말려 버리면 고치려던 병을 그대로 재현한다. 시간당 기회가 24번이라
 * 작게 잡아도 하루 회복량은 넉넉하다(4 × 24 = 96).
 */
export const CATCHUP_MAX_JOBS = 4

/**
 * `'40 9 * * *'` 같은 **단일 슬롯 식**을 파싱한다. 슬롯이 아니면 `null`.
 *
 * 만회 대상은 "하루(또는 한 주)에 한 번" 도는 것뿐이다 — 시간당 이하로 도는 작업은 이미
 * 기회가 24번 이상이라 만회할 것이 없다. 그래서 `hour` 가 `*` 이면 여기서 걸러진다.
 */
export function parseSlotExpr(expr: string | null | undefined): SlotSpec | null {
  if (!expr || typeof expr !== 'string') return null
  const f = expr.trim().split(/\s+/)
  if (f.length !== 5) return null
  const [min, hour, dom, , dow] = f
  if (!/^\d{1,2}$/.test(min) || !/^\d{1,2}$/.test(hour)) return null
  if (dom !== '*') return null // 월간은 다루지 않는다(주기가 길어 그날 안에 닫는 규칙과 안 맞는다)
  const spec: SlotSpec = { minute: Number(min), hour: Number(hour) }
  if (dow !== '*') {
    if (!/^\d$/.test(dow)) return null
    spec.dow = Number(dow)
  }
  if (spec.minute > 59 || (spec.hour ?? 0) > 23) return null
  return spec
}

/**
 * 이 슬롯의 **이번 주기 시작 시각**(epoch ms). 아직 안 왔으면 `null`.
 *
 * 일간이면 오늘 그 시각, 주간이면 오늘이 그 요일일 때만. 지난 주기는 **돌아보지 않는다**
 * (위 "못 하는 것" 참조 — 경계를 그날 안으로 닫는다).
 */
export function periodStartMs(nowMs: number, spec: SlotSpec): number | null {
  if (!Number.isFinite(nowMs) || spec.hour === undefined) return null
  const d = new Date(nowMs)
  if (spec.dow !== undefined && d.getUTCDay() !== spec.dow) return null
  const start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), spec.hour, spec.minute, 0, 0)
  return nowMs >= start ? start : null
}

/** 이번 주기에 이미 돌았나. 하트비트가 없으면 "안 돌았다"로 본다(그게 만회의 취지다). */
export function ranThisPeriod(lastRunMs: number | undefined, periodStart: number): boolean {
  return typeof lastRunMs === 'number' && Number.isFinite(lastRunMs) && lastRunMs >= periodStart
}

/**
 * 하트비트에서 **작업별 마지막 실행 시각**을 한 번에 읽는다(질의 1회).
 *
 * 실패하면 `null` — 호출부는 그때 **만회를 하지 않는다.** 빈 맵을 돌려주면 "아무도 안 돌았다"로
 * 읽혀 이미 끝난 작업을 다시 돌린다. 모르는 상태에서 돈을 만지는 작업을 재실행하느니 쉬는 게 낫다.
 */
export async function loadLastRunMs(DB: D1Database | undefined): Promise<Map<string, number> | null> {
  if (!DB) return null
  try {
    const { results } = await DB.prepare(
      "SELECT key, value FROM platform_settings WHERE key LIKE 'cron_hb:%'",
    ).all<{ key: string; value: string }>()
    const map = new Map<string, number>()
    for (const r of results || []) {
      try {
        const at = (JSON.parse(r.value) as { at?: string }).at
        const ms = at ? Date.parse(at) : NaN
        if (Number.isFinite(ms)) map.set(r.key.slice('cron_hb:'.length), ms)
      } catch { /* 깨진 값은 '기록 없음'과 같게 다룬다 */ }
    }
    return map
  } catch {
    return null
  }
}

/**
 * 만회 틱 한 번의 상태. `scheduled.ts` 가 인보케이션마다 하나 만들어 슬롯 게이트와
 * 작업 래퍼가 함께 참조한다.
 */
export interface CatchupState {
  lastRun: Map<string, number>
  /** 이번 틱에서 새로 시작한 작업 수 — `CATCHUP_MAX_JOBS` 로 막는다. */
  started: number
  /** 이번 주기에 이미 돌아서 건너뛴 수. **관측용** — 아래 `summarizeCatchup` 참조. */
  skipped: number
  /** 시작 한도에 걸려 다음 시간으로 미룬 수. */
  deferred: number
}

/**
 * 만회 틱인가 판정하고, 맞으면 상태를 만든다. 아니면 `null`(= 정시 경로 그대로).
 *
 * @param scheduledTime `ScheduledEvent.scheduledTime`
 */
export async function beginCatchup(
  scheduledTime: number | undefined | null,
  DB: D1Database | undefined,
): Promise<CatchupState | null> {
  if (typeof scheduledTime !== 'number' || !Number.isFinite(scheduledTime)) return null
  const tick = new Date(Math.round(scheduledTime / 300_000) * 300_000)
  if (tick.getUTCMinutes() !== CATCHUP_MINUTE) return null
  const lastRun = await loadLastRunMs(DB)
  if (!lastRun) return null // 읽기 실패 = 만회 안 함(fail-closed)
  return { lastRun, started: 0, skipped: 0, deferred: 0 }
}

/**
 * 이 슬롯 블록을 만회로 **열 것인가**. 여는 것 자체는 싸다 — 안의 작업들이 각자
 * `claimCatchupJob` 으로 자기 차례를 판단하고, 이미 돈 것은 비용 0 으로 건너뛴다.
 */
export function catchupOpens(state: CatchupState | null, nowMs: number, spec: SlotSpec): boolean {
  return state !== null && periodStartMs(nowMs, spec) !== null
}

/**
 * 만회 틱에서 이 작업을 **실제로 돌릴 것인가**.
 *
 * - 이번 주기에 이미 돌았으면 `false`(정상인 날의 만회는 여기서 전부 걸러진다)
 * - 이번 틱의 시작 한도를 넘었으면 `false`(다음 시간에 다시 온다)
 * - 그 외에는 `true` 이고 카운터를 올린다
 *
 * ⚠️ 슬롯 식을 못 읽으면 `false` — 만회는 **아는 것에만** 한다.
 */
export function claimCatchupJob(state: CatchupState, name: string, expr: string, nowMs: number): boolean {
  const spec = parseSlotExpr(expr)
  if (!spec) return false
  const start = periodStartMs(nowMs, spec)
  if (start === null) return false
  if (ranThisPeriod(state.lastRun.get(name), start)) { state.skipped += 1; return false }
  if (state.started >= CATCHUP_MAX_JOBS) { state.deferred += 1; return false }
  state.started += 1
  return true
}

/**
 * 만회 한 틱의 결과 요약 — **이 기능의 유일한 관측 지점**이다.
 *
 * ## 왜 이게 필요한가 (2026-09-01, 배포 첫날 실측으로 알게 됨)
 *
 * 만회는 **정상인 날엔 아무 흔적도 안 남긴다.** 밀린 게 없으면 각 작업이 조용히 건너뛰고 끝난다.
 * 설계 의도대로지만, 그 결과 **"돌았는데 할 일이 없었다"와 "아예 안 돌았다"가 구분되지 않는다.**
 * 배포 이틀 동안 모든 레인이 정시에 돌아서 만회를 한 번도 못 봤는데, 그때 내가 답할 수 없던
 * 질문이 정확히 이것이었다 — *"이게 실제로 돌고는 있나?"*
 *
 * 이 레포가 반복해 당한 **"실패가 아니라 조용한 부재"** 클래스이고, 하필 그걸 고치려고 만든
 * 기능이 같은 병을 앓고 있었다. 그래서 회차마다 한 줄을 남긴다.
 *
 * 비용: 만회 틱에서만 1 write — 하루 24회. (작업이 아니라 관측이므로 `safeCron` 으로 감싸지 않는다.)
 */
export function summarizeCatchup(state: CatchupState): { started: number; skipped: number; deferred: number; known: number } {
  return { started: state.started, skipped: state.skipped, deferred: state.deferred, known: state.lastRun.size }
}
