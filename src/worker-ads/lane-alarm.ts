/**
 * ⏰ **레인 알람 DO** — 정책·근거는 `lane-alarm-policy.ts` 헤더에 있다(이 파일은 실행만).
 *
 * 🗂️ **클래스 하나로 여러 레인을 몬다.** 인스턴스는 이름(`idFromName(lane)`)으로 갈리므로, 레인을
 *   늘려도 `wrangler-ads.toml` 마이그레이션은 그대로다. 무엇을 돌릴지는 `lane-alarm-runners.ts` 표.
 * ⚠️ **레인당 인스턴스는 하나만** — 같은 레인에 두 인스턴스를 만들면 같은 큐를 동시에 집어 중복 측정이
 *   된다(이 큐는 선점이 아니라 정렬+LIMIT).
 */
import { DurableObject } from 'cloudflare:workers'
import type { Env } from '@/worker/types/env'
import {
  alarmEnabled, resolveInterval, resolveRunsPerHour, nextWakeAt, hourBucket, LANE_ALARM_STAMP_KEY,
  alarmReviveKind,
} from './lane-alarm-policy'
import { lookupAlarmLane } from './lane-alarm-runners'
import { dueByElapsed } from './lane-alarm-policy'
import { buildCronBeatRow } from '@/worker/utils/cron-heartbeat'
import { withMeteredEnv, newMeter, type ReadMeter } from '@/worker/utils/d1-read-meter'
import { lanesPaused } from './lane-pause'
import { readBudgetState, reportReadUsage, handleBudgetRequest, budgetBlocked, READ_BUDGET_PATH } from './read-budget'
import { staleGapMinutes } from './lane-cadence'
import { summarizeLaneRun, appendRunHistory, serializeRunHistory, serializeLaneStamp, LANE_RUNS_KEY } from './lane-run-history'
import type { LaneRunEntry } from './lane-run-history'
import { adaptiveIntervalHours, RETRY_MAX_FAIL_STREAK, failStreakFromHistory } from './lane-adaptive-interval'
import { readBoost, laneCanAbsorb, MAX_BOOST_RUNS_PER_HOUR, BOOST_TTL_MS } from './lane-boost'

interface AlarmEnv {
  ADS_LANE_ALARM_INTERVAL_MS?: string
  ADS_LANE_ALARM_RUNS_PER_HOUR?: string
}

export class AdsLaneDurableObject extends DurableObject<Env> {
  /** 📏 이번 알람 회차가 읽은 D1 행 수 — `alarm()` 진입마다 새로 잡고 스탬프에 싣는다. */
  private meter: ReadMeter = newMeter()

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    // 📏 DO 는 자기 env 를 따로 받으므로 엔트리의 래핑이 안 미친다 — 여기서 감싼다(sink 가 회차별 계량기를 본다).
    this.env = withMeteredEnv(env, () => this.meter)
  }

  /** 이 인스턴스가 모는 레인 = DO 이름. `idFromName` 으로 만든 id 만 이름을 갖는다. */
  private get lane(): string { return this.ctx.id.name || 'enrich-influencer' }

  /** 부트스트랩 — 알람이 없으면 건다. **멱등**이라 cron 이 매 정각 불러도 안전하다. */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)
    // 📈 부족분 보강 — 하루 1회 판정이 여기로 값을 밀어 넣는다. **DO 저장소**에 두므로 알람 핫패스에
    //   D1 읽기가 안 생긴다(러너가 같은 인보케이션의 서브리퀘스트 예산을 쓴다 — 근거는 `lane-boost` docblock).
    if (url.pathname === '/boost') {
      const runs = Math.max(0, Math.min(MAX_BOOST_RUNS_PER_HOUR, Math.floor(Number(url.searchParams.get('runs')) || 0)))
      // 🔒 **자기가 건강할 때만** 받는다 — 실패 중인 레인을 3배로 돌리면 실패가 3배다.
      const hist = appendRunHistory(await this.ctx.storage.get<unknown>('runHistory'), null) as LaneRunEntry[]
      const accept = runs > 0 && laneCanAbsorb(hist)
      await this.ctx.storage.put('boost', accept ? { runs, until: Date.now() + BOOST_TTL_MS } : { runs: 0, until: 0 }).catch(() => undefined)
      return Response.json({ ok: true, lane: this.lane, accepted: accept, runs: accept ? runs : 0 })
    }
    // 📉 읽기 예산 원장 — `idFromName('read-budget')` 인스턴스가 받는다(레인 인스턴스가 받아도 무해 — 저장 키가 다르다).
    //   처리는 순수 함수(`read-budget.ts`)에 있다 — 여기선 저장소만 넘긴다.
    if (url.pathname === READ_BUDGET_PATH) return Response.json(await handleBudgetRequest(url, this.ctx.storage, this.env))
    if (url.pathname !== '/start') return new Response('Not Found', { status: 404 })
    if (!alarmEnabled(this.env)) return Response.json({ ok: true, enabled: false })
    const cur = await this.ctx.storage.getAlarm()
    // 🫀 **"걸려 있다"와 "살아 있다"는 다르다** — 예약 시각이 한참 지났는데 안 깨어났으면 체인이 죽은 것이다.
    //   판정 근거·실측(2026-08-09 측정 갈래 6시간 사망)은 `alarmReviveKind` docblock.
    const kind = alarmReviveKind(cur, Date.now())
    if (kind !== 'alive') {
      await this.ctx.storage.setAlarm(Date.now() + 1_000)
      // ⚠️ `revived` 를 따로 남긴다 — "원래 없었다"와 "죽어서 되살렸다"를 같은 값으로 뭉개면
      //   다음 세션이 사고를 또 못 본다(이번 사고가 6시간 안 보인 이유가 정확히 그것이다).
      return Response.json({ ok: true, lane: this.lane, started: true, revived: kind === 'stale', staleAt: kind === 'stale' ? cur : undefined })
    }
    return Response.json({ ok: true, lane: this.lane, started: false, alarmAt: cur })
  }

  /**
   * 한 회차 = 그 레인 1라운드. **호출부가 없다** — 런타임이 예약 시각에 독립 인보케이션으로 깨운다.
   * 💥 절대 throw 하지 않는다: throw 하면 다음 알람을 못 걸어 체인이 영구히 멎는다.
   */
  async alarm(): Promise<void> {
    const t0 = Date.now()
    this.meter = newMeter()
    if (!alarmEnabled(this.env)) return // 킬스위치 — 다음 알람을 안 걸면 체인이 멎는다
    // ⏸️ 일시정지 — 킬스위치와 달리 **체인은 살린다**(다음 알람만 걸고 레인은 안 돌린다). runs/failStreak/
    //   runHistory 를 안 건드리므로 재개 첫 회차가 실패 이력에서 시작하지 않는다. 근거: `lane-pause.ts`.
    if (lanesPaused(this.env)) {
      await this.ctx.storage.setAlarm(t0 + resolveInterval(undefined, this.env)).catch(() => undefined)
      return
    }
    // 📉 읽기 예산 — 오늘 몫을 넘겼으면 일시정지와 같은 동작(체인은 잇고 레인은 안 돌림). 근거: `read-budget.ts` 헤더.
    if (budgetBlocked(await readBudgetState(this.env))) {
      await this.ctx.storage.setAlarm(t0 + resolveInterval(undefined, this.env)).catch(() => undefined)
      return
    }
    // 등록부에 없는 이름 = 이름이 바뀐 유령 인스턴스 → 이어 걸지 않고 스스로 소멸시킨다.
    const lane = lookupAlarmLane(this.lane)
    if (!lane) return

    const e = this.env as unknown as AlarmEnv
    // 우선순위: 레인별 override → env → 요금제 기본값(policy 가 `env` 로 판단). 셋이 한 줄에 있어야
    // "어디서 온 값인가"가 한눈에 보인다 — 나눠 쓰면 한쪽만 고쳐진다.
    const interval = resolveInterval(lane.intervalMs != null ? String(lane.intervalMs) : e.ADS_LANE_ALARM_INTERVAL_MS, e)
    const baseCap = resolveRunsPerHour(lane.runsPerHour != null ? String(lane.runsPerHour) : e.ADS_LANE_ALARM_RUNS_PER_HOUR, e)
    // 📈 보강분 — 기한이 지났으면 자동으로 0 이다(켜진 채 잊히지 않는다).
    const cap = Math.max(baseCap, readBoost(await this.ctx.storage.get<unknown>('boost'), t0))

    const bucket = hourBucket(t0)
    const prevBucket = (await this.ctx.storage.get<number>('bucket')) ?? -1
    const runs = prevBucket === bucket ? ((await this.ctx.storage.get<number>('runs')) ?? 0) : 0
    const failStreak = (await this.ctx.storage.get<number>('failStreak')) ?? 0

    // ⏳ 최소 간격은 **경과 시간**으로 본다(시각의 짝수성이 아니라) — 유실된 회차를 다음 시간이
    //   이어받게 하는 것이 요점이다. 근거·실측은 `dueByElapsed` docblock.
    const lastRunAt = (await this.ctx.storage.get<number>('lastRunAt')) ?? null
    // 🔁 주기는 고정이 아니라 **최근 성적으로 조율**한다 — 잘 돌고 신규율이 높으면 조이고, 삐끗하면
    //   기본으로 되돌아간다. 왜 상수를 그냥 올리지 않는지(공공 API 일일 한도 미상)는 모듈 docblock.
    const prevHistory = appendRunHistory(await this.ctx.storage.get<unknown>('runHistory'), null) as LaneRunEntry[]
    const due = dueByElapsed(lastRunAt, t0, adaptiveIntervalHours(lane.minIntervalHours ?? 0, prevHistory))

    let stats: unknown = null
    let error: string | undefined
    if (runs < cap && due) {
      try {
        stats = await lane.run(this.env)
      } catch (err) {
        error = `${(err as Error)?.name || 'Error'}: ${String((err as Error)?.message || '').slice(0, 200)}`
      }
    } else if (!due) {
      stats = { skipped: 'min_interval', last_run_at: lastRunAt }
    }

    // 📉 이 회차가 읽은 만큼 원장에 더한다 — 실제로 돈 회차만(skip 은 0 이라 어차피 안 보낸다).
    this.ctx.waitUntil(reportReadUsage(this.env, this.meter.rr, this.meter.rw))
    const ran = runs < cap ? runs + 1 : runs
    const nextFail = error ? failStreak + 1 : 0
    // 🎞️ 회차 이력 — 마지막 1건만 남기면 "안 돌았나 / 돌았는데 실패했나"를 못 가른다(근거는 모듈 docblock).
    //   skip 회차는 `summarizeLaneRun` 이 null 을 줘서 이력을 밀어내지 않는다.
    const entry = summarizeLaneRun(stats, error, t0)
    const runHistory = appendRunHistory(prevHistory, entry)
    // 🅿️ 상태를 먼저 저장한다 — 알람 예약 전에 죽어도 다음 부트스트랩이 이어받는다.
    //   ⚠️ `lastRunAt` 은 **실제로 돈 회차만** 기록한다 — skip 에도 찍으면 간격이 영원히 안 차서
    //     그 레인이 통째로 멎는다(간격 게이트를 스스로 잠그는 꼴).
    // 🕳️ **실패한 회차도 자리를 안 먹는다** — 스탬프를 찍으면 다음 간격까지 그 슬롯이 통째로 버려진다.
    //   실측(2026-08-18): 00:00 회차가 외부 API 네트워크 오류로 0건 → 01:00 유휴 → 02:00 에야 982건.
    //   안 찍으면 다음 시간이 곧바로 재시도한다(시간당 1회 상한 `cap` 이 폭주를 막는다).
    // ⚠️ **다만 무한 재시도는 안 된다.** `nextWakeAt` 은 회차를 쓴 뒤엔 다음 정시로 잡으므로
    //   `failStreak` 백오프가 이 경로엔 안 걸린다 — 영구 장애면 하루 24번을 계속 두드리게 된다.
    //   `RETRY_MAX_FAIL_STREAK` 회를 넘기면 재시도를 접고 **기본 주기로 돌아간다**(일시적 실패만 즉시
    //   되찾고, 고장 난 소스는 조용히 두는 것 — 서브리퀘스트는 이 시스템의 희소 자원이다).
    // ⚠️ **`nextFail` 이 아니라 이력으로 센다** — `failStreak` 은 예외를 던진 회차만 세는데, 실제 장애는
    //   예외 없이 `diag.error` 로만 온다(실측: 4회 연속 실패인데 `fail_streak: 0`). 근거는 그 함수 docblock.
    const retryable = failStreakFromHistory(runHistory) <= RETRY_MAX_FAIL_STREAK
    const put: Record<string, unknown> = { bucket, runs: ran, failStreak: nextFail, runHistory }
    if (runs < cap && due && (!entry || entry.ok || !retryable)) put.lastRunAt = t0
    await this.ctx.storage.put(put).catch(() => undefined)

    const at = nextWakeAt(Date.now(), interval, ran, cap, nextFail)
    await this.ctx.storage.setAlarm(at).catch(() => undefined)

    // 📊 스탬프 — **이 시범의 목적이 측정이다.** 한도에 닿는지, 회차가 실제로 이어지는지 여기서만 보인다.
    //   ⚠️ 키를 레인별로 가른다 — 한 키를 공유하면 나중 레인이 앞 레인의 기록을 덮어써 둘 다 못 본다.
    try {
      const DB = (this.env as { DB?: D1Database }).DB
      if (DB) {
        const put = DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
        // 🫀 **침묵 판정이 보는 곳에도 남긴다** (2026-08-04 라이브에서 잡음).
        //   알람으로 옮긴 레인은 부모가 더 이상 kick 하지 않으므로 `cron_hb:ads:{레인}` 이 그 시점에
        //   멈춘다 — 실측: `collect` 가 매시간 정상 실행 중인데 하트비트는 **27시간 전** 값이었다.
        //   `getCronHealth` 는 그 키로 판정하므로, 이 레인은 **죽어도 침묵 경보가 안 울린다**
        //   (#1006 이 고친 "판정 대상에서 빠짐" 과 같은 클래스가 알람 이전으로 되살아난 것).
        //   ⚠️ 페이로드는 `buildCronBeatRow`(SSOT)를 쓴다 — 손으로 모양을 맞추면 두 벌이 갈린다.
        //   ⚠️ 같은 batch = **서브리퀘스트 1개**. 낱개로 쓰면 가장 빠듯한 지점에 하나를 더 얹는 셈이다.
        const hb = buildCronBeatRow(`ads:${this.lane}`, !error, Date.now() - t0, undefined, stats,
          staleGapMinutes(Math.max(1, Math.round(60 / Math.max(1, cap)))), this.meter) // 📏 이 회차의 D1 읽기량
        await DB.batch([
          // ⚠️ 자르지 않는다 — `.slice(0, 2000)` 은 라이브에서 실제로 JSON 을 중간에서 끊어
          //   두 레인의 스탬프를 파싱 불가로 만들었다(`serializeLaneStamp` docblock 의 실측).
          put.bind(`${LANE_ALARM_STAMP_KEY}:${this.lane}`, serializeLaneStamp({
            at: new Date().toISOString(), lane: this.lane, ms: Date.now() - t0, runs_this_hour: ran, cap,
            interval_ms: interval, next_at: new Date(at).toISOString(), fail_streak: nextFail,
            /**
             * 📏 **이 회차가 읽고 쓴 행**(2026-09-05) — 계측기는 원래 있었는데 공용 원장에 더하고
             *   레인별 값은 버렸다. 그래서 "하루 37만 쓰기·2억 읽기가 **어느 레인** 것인가"에
             *   아무도 답을 못 했고, 나는 그 자리를 추측으로 메우다 두 번 틀렸다(재측정 필터·재조우
             *   백필 — 둘 다 배포 후 감소 0). 값은 이미 손에 있으니 버리지만 않으면 된다.
             *   비용 0: 같은 batch 의 같은 JSON 에 숫자 두 개를 더할 뿐이다.
             */
            rr: this.meter.rr || 0, rw: this.meter.rw || 0,
            ...(error ? { error: error.slice(0, 200) } : {}),
          }, stats ? JSON.parse(JSON.stringify(stats)) : null)),
          put.bind(hb.key, hb.value),
          // 🎞️ 같은 batch = 서브리퀘스트 1개 그대로(낱개로 쓰면 가장 빠듯한 지점에 하나를 더 얹는다).
          put.bind(`${LANE_RUNS_KEY}:${this.lane}`, serializeRunHistory(runHistory)),
        ])
      }
    } catch { /* 관측 실패가 체인을 끊지 않는다 */ }
  }
}
