/**
 * 💓 cron 하트비트 — "안 돌았다"를 보이게 한다 (2026-07-28 신설)
 *
 * 왜 필요한가 — `safeCron` 은 작업이 **예외를 던질 때만** 기록한다(cron_failures + 어드민 벨 + Discord).
 *   그런데 실제로 아픈 정지는 예외가 없다:
 *     ① cron 이 아예 안 울림  ② 게이트 OFF 로 조용히 return
 *     ③ 내부에서 `.catch(() => null)` 로 전부 삼켜 **성공으로 집계**
 *   2026-07-28 유어애즈 자동 정비가 정확히 ③ 이었다 — 예산 소진으로 아무 일도 못 했는데 예외가 없어
 *   07-26 부터 멈춘 걸 아무도 몰랐다(#793). 당시 cron 70개 중 실행 기록을 남기는 건 3개뿐이었다.
 *
 * 무엇을 남기나 — 성공·실패 **무관하게** 매 실행마다 `platform_settings` 에 한 줄:
 *   `cron_hb:{name}` = {"at":ISO, "ok":bool, "ms":숫자}
 *   → 어드민이 "이 작업 마지막 실행 언제?" 를 pull 로 확인할 수 있다(GET /api/admin/cron-heartbeats).
 *
 * 왜 새 테이블이 아니라 platform_settings 인가 — 이 레포는 **D1 마이그레이션이 CI 에서 안 돈다**
 *   (TECHNICAL_DEBT 🔴). 새 테이블은 배포돼도 생성 보장이 없어 조용히 실패한다. 기존 스탬프들
 *   (`ads_maintenance_last`·`ads_autocollect_stats`)과 같은 자리에 두는 것이 확실하다.
 *
 * 비용 — 작업당 UPSERT 1회. cron 작업들은 이미 수십~수백 쿼리를 쓰므로 상대적으로 무시할 수준이고,
 *   대신 **기록 누락이 없다**(모아서 쓰면 waitUntil 이 먼저 끝나 유실될 수 있다).
 */
import type { Env } from '../types/env'
// 🔴 기대 목록 대조(트리거 미등록 탐지) — 정적 목록 vs 런타임 기록. 상세: cron-expected.ts
import { findNeverFired, type NeverFiredEntry } from './cron-expected'
import { classifyBeat, freshBaseNames, beatBaseName, type BeatVerdict } from './cron-beat-retirement'

/**
 * 실패 사유를 **짧은 분류 코드**로 (순수 — 유닛 잠금).
 *
 *   원래 이 함수가 생긴 이유는 아래 `summarizeResult` 가 **24자 초과 문자열을 버렸기** 때문이다
 *   (`Too many subrequests by single Worker invocation` = 47자 → 통째로 증발). 2026-07-29 에
 *   ur-ads 4개 레인이 동시에 `ok:false` 로 죽었는데 예산 고갈인지 다른 예외인지 화면에서 구분되지 않았다.
 *
 *   ⚠️ 같은 날 **그 24자 드롭 자체를 없앴다**(아래 ✂️ 주석 — 자르되 버리지 않는다). 그래도 이 함수는 유지한다:
 *   원문을 남기는 것과 **정규화된 코드로 분류**하는 것은 다른 일이다. `limit`/`timeout` 은 다음 행동
 *   (AIMD 감속 / 타임아웃 조정)을 바로 정해주고, 원문은 문구가 바뀌면 집계가 깨진다. 둘 다 남긴다.
 */
export function cronErrorCode(e: unknown): string {
  const msg = String((e as { message?: string } | null)?.message || e || '')
  if (/too many (subrequests|api requests)/i.test(msg)) return 'limit' // 예산 고갈 — AIMD 가 대응할 신호
  const name = (e as { name?: string } | null)?.name
  if (name === 'TimeoutError' || /timeout|aborted/i.test(msg)) return 'timeout'
  return (name || 'Error').slice(0, 24)
}

/**
 * 작업 반환값을 한 줄 요약으로. 평면 객체의 숫자·불리언·문자열만 추린다
 * (배열은 길이만, 중첩 객체는 길어지기만 하고 판단에 도움이 안 된다).
 * 유닛으로 고정하려고 export 한다 — **값이 조용히 사라지는 사고**를 실제로 겪었다(아래 ✂️ 주석).
 */
export function summarizeResult(v: unknown): string | null {
  // ✂️ 2026-08-01: **원시값을 통째로 버리던 자리.** 위 24자 드롭과 정확히 같은 클래스이고,
  //   같은 방식으로 물렸다 — `cron-env-missing`(없는 키 목록)과 `cron-unmatched`(매칭 안 된 cron 식)이
  //   둘 다 문자열을 반환했는데, 여기서 null 이 되어 **하트비트에 이름만 남고 내용이 사라졌다.**
  //   "무엇이 없는지"가 그 관측의 존재 이유였는데 정확히 그것만 증발한 것이다(라이브 실측).
  //   ⇒ 객체가 아니어도 사람이 읽을 수 있으면 남긴다. 상한은 아래 객체 경로와 동일(MAX_NOTE).
  if (typeof v === 'string') return v.trim() ? v.trim().slice(0, MAX_NOTE) : null
  if (typeof v === 'number' || typeof v === 'boolean') return String(v)
  if (Array.isArray(v)) return v.length ? `[${v.length}] ${v.map(String).join(' ')}`.slice(0, MAX_NOTE) : null
  if (!v || typeof v !== 'object') return null
  const parts: string[] = []
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'number' || typeof val === 'boolean') parts.push(`${k}=${val}`)
    // ✂️ 2026-07-29: 예전엔 24자를 넘는 문자열을 **통째로 버렸다.** 그런데 길어지는 문자열은 대개
    //   `error` 다 — 즉 **가장 알고 싶은 값이 정확히 그 이유로 사라졌다**(라운드 체인이 왜 멈췄는지가
    //   `round2: Error: Too many subrequests` 처럼 24자를 넘어 기록에서 증발). 버리지 말고 자른다.
    //   전체는 어차피 MAX_NOTE 로 묶여 있어 '한 줄 요약'이라는 성격은 그대로다.
    else if (typeof val === 'string' && val) parts.push(`${k}=${val.length <= 72 ? val : `${val.slice(0, 71)}…`}`)
    else if (Array.isArray(val)) parts.push(`${k}[${val.length}]`)
    if (parts.join(' ').length > MAX_NOTE) break
  }
  return parts.length ? parts.join(' ').slice(0, MAX_NOTE) : null
}

/** 값 상한 — 이름이 길거나 이상값이 와도 platform_settings 를 오염시키지 않게. */
const MAX_VALUE = 400
/** 결과 요약 상한 — 하트비트는 '무엇을 했나' 한 줄이지 로그가 아니다. */
const MAX_NOTE = 160

/**
 * 한 cron 작업의 실행 사실을 기록한다. **절대 throw 하지 않는다** — 하트비트 실패가
 * 본 작업을 망가뜨리면 안 된다(기록은 관측용이지 기능이 아니다).
 */
/**
 * 🔬 **`__tick` 진단 프로브** (2026-08-22) — `scheduled.ts` 가 인보케이션 **맨 앞**에서 찍는 한 건.
 *
 * 08-22 11:00(KST) 이후 하트비트 **129개가 동시에 침묵**했다. 그런데 작업은 계속 돌고 있었고
 * (`group_buy_feed_cache` 23:55 갱신) 같은 DB 의 다른 쓰기도 멀쩡했다(`ads_neis_cursor` 23:00).
 * ⇒ 멈춘 건 "쓰기"가 아니라 **작업 *끝*에 찍는 하트비트**뿐이다.
 *
 * 두 가설이 남는다. `__tick` 이 그걸 가른다 — 아직 아무도 예산을 안 쓴 시점에 찍기 때문이다:
 *
 * | `__tick` | 나머지 129개 | 결론 |
 * |---|---|---|
 * | 갱신됨 | 침묵 | **인보케이션당 서브리퀘스트 천장**(무료 50)에 닿아 뒤쪽 쓰기가 거부된다 |
 * | 침묵 | 침묵 | cron 이 **아예 안 돈다**(트리거/배포 문제) |
 *
 * ⚠️ 앞의 경우라면 처방은 이미 이 레포 안에 있다 — ur-ads 는 2026-07-29 에 같은 벽을 만나
 * 하트비트를 `DB.batch` **1회**로 묶어 `2N → N+1` 로 낮췄다(`worker-ads/beat-batch.ts`).
 * **ur-live 만 아직 작업마다 1건씩 쓴다**(12개 작업 = 12 서브리퀘스트).
 *
 * ⚠️ 그리고 이 프로브가 **비용을 1 늘린다**는 점을 잊지 말 것. 원인이 규명되면 제거하거나
 * 위 일괄 쓰기에 흡수시킨다 — 진단 도구를 영구 부채로 남기지 않는다.
 */
export async function recordCronBeat(
  env: Env,
  name: string,
  ok: boolean,
  ms: number,
  /**
   * 이번 실행을 유발한 cron 식(`event.cron`). **기대 주기를 손으로 관리하는 표를 만들지 않기 위해**
   * 여기 함께 기록한다 — 68개짜리 수동 표는 금방 낡아 오탐/누락을 만든다.
   * 경보(cron-stale-watch)가 이 값으로 "얼마나 안 돌면 이상한가"를 스스로 계산한다.
   */
  cronExpr?: string,
  /**
   * 작업이 반환한 결과 요약(선택). "돌았다"와 "무엇을 했다"는 다르다 —
   * 예: payouts-generate 가 0건으로 끝난 게 '할 일이 없어서'인지 '조용히 실패해서'인지 구분한다.
   * 작은 평면 객체만 받는다(로그가 아니라 한 줄 요약).
   */
  result?: unknown,
  /**
   * 이 작업의 **실제** 기대 간격(분). cron 식만으로는 알 수 없을 때 작업이 직접 신고한다.
   *
   * ⚠️ 2026-07-29 신설 — ur-ads 처럼 **하나의 cron 이 여러 주기의 레인을 디스패치**하면
   * `event.cron`(매시간) 이 실제 주기를 말해주지 못한다. 일 1회 레인이 매시간으로 기록돼
   * **정상 동작 중에도 하루 21.5시간을 `stale`** 로 보고했다(실측: `ads:maintenance?phase=quality`
   * age 167분 · stale). 그 판정은 uptime 프로브를 타고 이슈+메일로 나간다 — 매일 울리는 오탐은
   * "확실히 이상한 것만 울린다"는 이 모듈의 설계 의도를 깨고 경보 전체를 무력화한다.
   * 값이 있으면 cron 식보다 **우선**한다. 없으면 종전대로 cron 식에서 유도한다.
   */
  maxGapMin?: number,
): Promise<void> {
  try {
    const DB = (env as unknown as { DB?: D1Database }).DB
    if (!DB || !name) return
    const { key, value } = buildCronBeatRow(name, ok, ms, cronExpr, result, maxGapMin)
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(key, value).run()
    // 🩸 CPU 사망만 **따로** 누적한다 — 하트비트 행은 매 회차 덮어써지므로 다음 성공 한 번이면
    //   사망 기록이 사라진다(그래서 지금까지 "누가 실제로 죽는가"를 아무도 몰랐다).
    //   ⚠️ 성공 경로엔 읽기/쓰기가 **하나도 안 붙는다**(사망은 드물다) — 93레인 × 매시간이라 비용이 중요하다.
    if (!ok && CPU_DEATH_RE.test(summarizeResult(result) || '')) await bumpCpuDeath(DB, name)
  } catch { /* fail-soft — 관측 실패가 작업을 막지 않는다 */ }
}

/**
 * 하트비트 한 행의 (key, value) — **페이로드 모양의 SSOT**.
 *   단건 쓰기(`recordCronBeat`)와 일괄 쓰기(worker-ads `beat-batch`)가 **같은 것을 쓰도록** 분리했다.
 *   두 벌로 쓰면 한쪽만 필드가 추가되고, 그 어긋남은 조용하다(이 레포가 반복해 겪은 실패 양식).
 */
export function buildCronBeatRow(
  name: string, ok: boolean, ms: number, cronExpr?: string, result?: unknown, maxGapMin?: number,
): { key: string; value: string } {
  const value = JSON.stringify({
    at: new Date().toISOString(),
    ok,
    ms: Math.max(0, Math.round(ms)),
    ...(cronExpr ? { cron: cronExpr.slice(0, 40) } : {}),
    ...(Number.isFinite(maxGapMin) && (maxGapMin as number) > 0 ? { g: Math.round(maxGapMin as number) } : {}),
    ...(summarizeResult(result) ? { r: summarizeResult(result) } : {}),
  }).slice(0, MAX_VALUE)
  return { key: `cron_hb:${name.slice(0, 80)}`, value }
}

export interface CronHeartbeat {
  name: string
  at: string | null
  ok: boolean | null
  ms: number | null
  /** 마지막 실행 이후 경과(분). 오래될수록 '멈춤' 의심. */
  age_minutes: number | null
  /** 실행을 유발한 cron 식(있으면). 기대 주기 계산에 쓴다. */
  cron?: string | null
  /** 이 작업이 '멈춤'으로 보이는가(기대 주기 대비). 판단 불가면 null. */
  stale?: boolean | null
  /**
   * 🪦 `stale` 을 **사람이 읽어도 되는가** — 게이트·경보가 쓰던 판정을 목록에도 실어 준다.
   *
   *   `stale` 만으로는 "멈춘 레인"과 "개명돼 아무도 안 부르는 옛 이름"이 구분되지 않는다.
   *   게이트(`getCronHealth`)와 경보(`cron-stale-watch`)는 이미 `classifyBeat` 로 걸러서 조용한데,
   *   **사람이 보는 이 목록만 안 걸렀다** → 화면엔 12건이 뜨고 실제 알림은 2건이다.
   *   그 격차가 오진을 만들었다: 2026-08-08 에 두 세션이 이 목록을 읽고 *"레인 4개가 침묵 중"* 이라고
   *   보고했는데, 실제로 멈춘 건 `collect-nara-vendor` 하나였다(나머지는 승계된 옛 이름).
   *   ⇒ **`judge` 인 것만 진짜 침묵이다.** 유령도 계속 보여 주되 라벨로 구분한다(지우지 않는다).
   */
  verdict?: BeatVerdict
  /** 이 판정에 쓰인 기대 간격(분) — 작업이 신고했으면 그 값, 아니면 cron 식에서 유도. */
  max_gap_min?: number | null
  /** 마지막 실행이 '무엇을 했나' 한 줄 요약(작업이 결과를 반환한 경우). */
  result?: string | null
  /**
   * 🩸 이 작업이 **실제로 CPU 로 죽은 적이 있는가**(2026-08-09 재정의).
   *   `'danger'` = 최근 7일 내 사망 · `'warn'` = 30일 내 · `null` = **기록 없음(모른다 ≠ 안전하다)**.
   *   ⚠️ 종전엔 벽시계 ms 로 추측했는데 그건 I/O 시간이라 CPU 와 무관했다 — 실제로 반대로 찍혔다.
   */
  cpu_risk?: 'warn' | 'danger' | null
  /** 누적 CPU 사망 횟수(별도 키에 보존 — 하트비트는 다음 성공이 덮어쓴다). */
  cpu_deaths?: number
  /** 마지막 CPU 사망 시각(ISO). */
  last_cpu_death_at?: string | null
  /** ⏱️ 벽시계가 길다 = **I/O 가 느리다**(외부 API 지연 등). CPU 위험이 아니다. */
  io_slow?: 'warn' | 'danger' | null
}

/**
 * ⏱️ **죽기 전에 알린다** — CPU 한도 근접 판정 (2026-08-02 라이브 실측 후 신설). 순수함수.
 *
 * ## 왜
 * 08-02 01:00 KST 에 레인 셋이 `Worker exceeded CPU time limit` 로 죽었다(26.0~26.6초).
 * 그 셋은 고쳤지만 — **인플루언서 자동수집(`ads:collect`)이 15.4초**로 돌고 있다. 지금은 살아 있고
 * 화면 어디에도 경고가 없다. 데이터가 늘면 같은 벽에 닿을 텐데, **죽어야 알게 된다.**
 * 그건 이 레포가 반복해 만난 실패다: 부재는 침묵과 다르게 생겼는데, 여기선 *임박*이 정상과 같게 생겼다.
 *
 * ## 기준을 어디서 가져왔나 (추측 아님)
 * 실측 사망 지점 **26,027 / 26,039 / 26,563 ms** → 관측된 천장을 **26,000** 으로 잡는다.
 * 그 아래에서 성공한 최장은 21,026ms(`reclassify-company`) 이므로 warn 선을 그 사이에 둔다.
 *
 * ## ⚠️ 못 하는 것 (과신 금지)
 * - **벽시계는 CPU 가 아니다.** 외부 응답이 느려 벽시계만 긴 회차는 CPU 여유가 있어도 warn 이 뜬다
 *   (그건 오탐이 아니라 '알아둘 값'이다 — 그 회차도 죽을 자리에 가까이 있었다).
 * - 반대로 **짧은 벽시계인데 CPU 를 태우는** 경우는 못 잡는다(순수 계산 위주 레인). 워커 런타임이
 *   CPU 실측치를 주지 않으므로 이 근사가 현재 가능한 최선이다.
 */
export const CPU_WALL_MS = 26_000
/**
 * 경고선 = 벽의 **약 58%**. 18,000 으로 잡았다가 이 모듈의 유닛이 잡아냈다 — 정작 이걸 만든 이유였던
 * `ads:collect`(15,425ms)가 그 아래라 조용히 통과했다. 목표를 못 잡는 임계값은 임계값이 아니다.
 * 실측 정상군(2,374~10,418ms)은 이 아래로 충분히 떨어져 신호가 죽지 않는다.
 */
export const CPU_WARN_MS = 15_000

export function cpuRisk(ms: number | null | undefined): 'warn' | 'danger' | null {
  if (!Number.isFinite(ms as number) || (ms as number) <= 0) return null
  const v = ms as number
  if (v >= CPU_WALL_MS) return 'danger'
  return v >= CPU_WARN_MS ? 'warn' : null
}

/**
 * 🩸 **CPU 사망을 세는 것 — 이것만이 진짜 신호다** (2026-08-09).
 *
 * ## 왜 벽시계를 버렸나
 * 위 `cpuRisk(ms)` 는 **벽시계 ms 만** 본다. 그런데 워커에서 `Date.now()` 는 **I/O 에서만 흐른다**
 * (CPU 구간엔 시계가 멈춘다) ⇒ `ms` 는 **I/O 시간**이고 CPU 와는 무관하다. 라이브가 그걸 증명했다:
 *
 * ```
 * schema-repair-daily  159,066ms → danger   그런데 ok=true (멀쩡)
 * d1-backup            146,975ms → danger   그런데 ok=true (멀쩡)
 * collect-commerce      13,921ms → null     그런데 그 회차에 CPU 로 죽었다   ← 반대다
 * collect-storeinfo     13,833ms 에 죽고 → 20,668ms · 80,696ms 에 살았다     ← 같은 레인
 * ```
 *
 * **실제로 죽은 레인은 "위험 없음", 멀쩡한 백업은 "위험"** 으로 찍힌다. 이 지표를 읽고
 * *"문턱에 붙은 레인 6개"* 라는 잘못된 목록이 만들어졌고, 그 목록으로 작업이 나갈 뻔했다.
 *
 * ## 대신 무엇을 보나 — 추측 말고 **실제로 죽은 기록**
 * 워커는 CPU 시간을 안 준다. 그러니 "다가가고 있는가"는 **원리적으로 못 잰다.**
 * 잴 수 있는 것은 하나뿐 — **죽었는가.** 그건 이미 에러 원문에 남는다.
 *
 * ⚠️ **못 하는 것**: 이건 *예측이 아니라 사후 기록*이다. 한 번도 안 죽은 레인은 `null` 이고,
 *   그게 "안전하다"는 뜻은 **아니다**(측정 수단이 없다는 뜻이다).
 */
export const CPU_DEATH_RE = /exceeded CPU time limit/i

/** 하트비트가 남긴 사망 카운터 → 위험 등급. 최근일수록 위험. 기록이 없으면 `null`(모른다). */
export function cpuRiskFromDeaths(deaths?: number | null, lastAt?: string | null, nowMs = 0): 'warn' | 'danger' | null {
  const n = Number(deaths) || 0
  if (n <= 0) return null
  const t = lastAt ? Date.parse(lastAt) : NaN
  if (!Number.isFinite(t) || !nowMs) return 'warn'
  const days = (nowMs - t) / 86_400_000
  if (days <= 7) return 'danger'      // 최근 일주일에 죽었다 = 지금 위험하다
  return days <= 30 ? 'warn' : null   // 한 달 넘었으면 흘려보낸다(옛 사고가 영원히 붉게 남지 않도록)
}

/**
 * cron 식으로부터 **"이 시간을 넘기면 이상하다"** 기준(분)을 계산한다. 순수함수 — 테스트 가능.
 *
 * 넉넉하게 잡는다(기대주기 × 2 + 30분 여유): 배포·재시도·지연으로 한두 번 밀리는 것까지
 * 경보로 올리면 곧 아무도 안 본다. "확실히 이상한 것만" 울리는 게 목적이다.
 * 해석 불가한 식은 null → **경보하지 않는다**(모르면 조용히 있는 편이 오탐보다 낫다).
 */
/**
 * ⏰ **슬롯 작업의 오탐** (2026-08-13 실측 — 대표 "굳이 필요없는 알람은 없애줘").
 *
 *   소비자 cron 은 대부분 **5분 캐리어**(매 5분 트리거)에 얹혀 `slotDue(...)` 로 자기 시각에만 돈다.
 *   그런데 하트비트에 기록되는 건 캐리어 식이라 이 함수가 **40분**(5×2+30)을 기대치로 내놓고,
 *   하루 1회 작업은 그 뒤 23시간 내내 `stale` 이 된다. 라이브 실측: `cron 실패 24h 8건`이
 *   **전부** 이 오탐이었다(stay-reminder·meal-voucher-expire·district-coupon-expire 등 18:40 KST 일 1회).
 *   ⚠️ 매일 울리는 경보는 곧 아무도 안 읽는 경보가 된다 — 이 모듈이 반복해 경고하는 그 병이다.
 *   ⇒ `scheduled.ts` 의 `slotCron(expr)` 이 **자기 슬롯을 cron 식으로 표현해** 이 함수에 넘긴다.
 *     기대치 규칙은 여기 한 곳뿐이라 두 벌로 갈라지지 않는다.
 */
export function expectedMaxAgeMinutes(cronExpr?: string | null): number | null {
  if (!cronExpr || typeof cronExpr !== 'string') return null
  const f = cronExpr.trim().split(/\s+/)
  if (f.length !== 5) return null
  const [min, hour, dom, , dow] = f
  let base: number
  const everyN = /^\*\/(\d{1,3})$/.exec(min || '')
  if (everyN && hour === '*') base = Math.max(1, Number(everyN[1]))
  // 🕓 분 목록(`5,20,35,50 * * * *`)은 **시간당 그 개수만큼** 돈다. 예전엔 이걸 "매시 1회"로 읽어
  //   기대 간격이 4배 느슨해졌다 — 15분마다 도는 작업이 2시간 멈춰도 조용했다는 뜻이다.
  //   단일 분(`50 * * * *`)이면 목록 길이 1 이라 종전과 **같은 값**이 나온다(하위호환).
  else if (hour === '*') base = Math.max(1, Math.floor(60 / Math.max(1, (min || '').split(',').length)))
  else if (dow !== '*') base = 60 * 24 * 7      // 주간
  else if (dom !== '*') base = 60 * 24 * 31     // 월간
  else base = 60 * 24                           // 매일
  return base * 2 + 30
}

/** 사망 카운터 키 — 하트비트 행과 **분리**해야 다음 성공이 덮어쓰지 않는다. */
export const cpuDeathKey = (name: string): string => `cron_cpu_death:${name.slice(0, 80)}`

/** 사망 1회 누적(읽고 +1). fail-soft — 관측 실패가 작업을 막지 않는다. */
async function bumpCpuDeath(DB: D1Database, name: string): Promise<void> {
  try {
    const k = cpuDeathKey(name)
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(k).first<{ value: string }>()
    let n = 0
    try { n = Number((JSON.parse(row?.value || '{}') as { n?: number }).n) || 0 } catch { /* 깨진 값은 0 */ }
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(k, JSON.stringify({ n: n + 1, at: new Date().toISOString() })).run()
  } catch { /* fail-soft */ }
}

/** 어드민 조회용 — 오래된 것부터. 실패해도 빈 배열(화면이 죽지 않게). */
export async function listCronHeartbeats(DB: D1Database): Promise<CronHeartbeat[]> {
  try {
    const { results } = await DB.prepare(
      "SELECT key, value FROM platform_settings WHERE key LIKE 'cron_hb:%'",
    ).all<{ key: string; value: string }>()
    // 🩸 사망 기록은 별도 키에 산다(하트비트는 매 회차 덮어써진다). 한 번 더 읽는 값어치가 있다 —
    //   이 화면의 '위험' 표시가 여기서 나오고, 없으면 벽시계로 추측하게 된다(그게 반대로 찍혔다).
    const deaths = new Map<string, { n: number; at: string | null }>()
    try {
      const d = await DB.prepare(
        "SELECT key, value FROM platform_settings WHERE key LIKE 'cron_cpu_death:%'",
      ).all<{ key: string; value: string }>()
      for (const r of d.results || []) {
        try {
          const v = JSON.parse(r.value) as { n?: number; at?: string }
          deaths.set(r.key.slice('cron_cpu_death:'.length), { n: Number(v.n) || 0, at: v.at ?? null })
        } catch { /* 깨진 값 무시 */ }
      }
    } catch { /* 사망 기록을 못 읽어도 목록은 뜬다 */ }
    const now = Date.now()
    const rows: CronHeartbeat[] = (results || []).map((r) => {
      let at: string | null = null, ok: boolean | null = null, ms: number | null = null, cron: string | null = null, note: string | null = null
      let gap: number | null = null
      try {
        const v = JSON.parse(r.value) as { at?: string; ok?: boolean; ms?: number; cron?: string; r?: string; g?: number }
        at = v.at ?? null; ok = typeof v.ok === 'boolean' ? v.ok : null
        ms = typeof v.ms === 'number' ? v.ms : null; cron = v.cron ?? null; note = v.r ?? null
        gap = typeof v.g === 'number' && v.g > 0 ? v.g : null
      } catch { /* 깨진 값은 null 로 */ }
      const t = at ? Date.parse(at) : NaN
      const age = Number.isFinite(t) ? Math.round((now - t) / 60000) : null
      // 작업이 직접 신고한 주기가 있으면 그것이 진실 — cron 식은 폴백이다(위 maxGapMin 주석 참조).
      const limit = gap ?? expectedMaxAgeMinutes(cron)
      const name = r.key.slice('cron_hb:'.length)
      return {
        name,
        at, ok, ms, cron, result: note,
        age_minutes: age,
        max_gap_min: limit,
        stale: (limit != null && age != null) ? age > limit : null,
        // 🩸 2026-08-09: 위험 판정을 **실제 사망 기록**으로 바꿨다. 벽시계(ms)는 I/O 시간이라
        //   CPU 와 무관하고, 라이브에서 실제로 반대 방향을 가리켰다(위 cpuRiskFromDeaths 주석의 실측 4건).
        cpu_risk: cpuRiskFromDeaths(deaths.get(name)?.n, deaths.get(name)?.at, now),
        cpu_deaths: deaths.get(name)?.n ?? 0,
        last_cpu_death_at: deaths.get(name)?.at ?? null,
        // ⏱️ ms 기반 값은 버리지 않고 **정직한 이름**으로 남긴다 — '느리다'(I/O)는 그 자체로 쓸모가 있다
        //   (외부 API 지연·행 걸림). 다만 그건 CPU 위험이 **아니다**.
        io_slow: cpuRisk(ms),
      }
    })
    // 오래된 것 먼저 = 멈췄을 가능성이 높은 것 먼저.
    rows.sort((a, b) => (b.age_minutes ?? Number.MAX_SAFE_INTEGER) - (a.age_minutes ?? Number.MAX_SAFE_INTEGER))
    // 🪦 유령 판정을 목록에도 싣는다 — 근거는 `CronHeartbeat.verdict` 주석. 여기서 계산해 두면
    //   게이트·경보·어드민이 **같은 판정**을 쓰고, 화면과 알림이 갈라지지 않는다.
    const freshBases = freshBaseNames(rows)
    // 🪦 디스패처가 지금 아는 레인 목록 — 있으면 **코드에서 삭제된 레인을 즉시** 은퇴로 판정한다
    //   (없으면 나이 8배를 기다리느라 16일간 "진짜 침묵"으로 보인다 — 2026-08-10 오진의 원인).
    //   키 SSOT 는 `worker-ads/lane-cadence.ts KNOWN_LANES_KEY`. 계층을 넘지 않으려고 값만 읽는다.
    let knownBases: Set<string> | undefined
    try {
      const kr = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind('ads_known_lanes').first<{ value: string }>()
      const lanes = kr?.value ? (JSON.parse(kr.value) as { lanes?: string[] }).lanes : null
      // ⚠️ 정규화는 `beatBaseName` 에 위임한다 — 그게 비교하는 반대쪽에도 쓰이는 함수다.
      //   여기서 손으로 접두를 붙였다가 **양쪽 형태가 어긋나 살아 있는 레인이 은퇴로 찍혔다**(테스트가 잡음).
      if (Array.isArray(lanes) && lanes.length) knownBases = new Set(lanes.map(l => beatBaseName(String(l))))
    } catch { /* 목록이 없으면 종전대로 나이 기반만 — 판정을 넓히지 않는다 */ }
    for (const r of rows) r.verdict = classifyBeat({ name: r.name, age_minutes: r.age_minutes, max_gap_min: r.max_gap_min }, freshBases, knownBases)
    return rows
  } catch {
    return []
  }
}


/* ────────────────────────────────────────────────────────────────────────────
 * 🫀 외부 dead-man's switch — "cron 전체가 조용히 죽은 것"을 밖에서 잡는다
 *
 * `cron-stale-watch` 는 **cron 안에서** 도는 감시라, cron 시스템 자체가 멈추면 감시도 같이
 * 멈춘다(watchdog 의 고전적 한계). 그래서 밖에서 때리는 프로브가 하나 더 필요하다:
 *   `GET /api/_healthcheck/cron` → uptime.yml(GitHub Actions, 10분) → 실패 시 이슈+메일.
 *
 * 판정 두 가지:
 *   ① **개별 침묵** — 어떤 작업이 자기 기대주기를 넘겼다.
 *   ② **전면 침묵** — 가장 최근 하트비트조차 오래됐다(= cron 이 통째로 안 돈다).
 *      ①만으로는 못 잡는다. 아예 안 돌면 새 기록이 없어 낡은 기록만 남고 판정이 굳는다.
 *
 * ⚠️ 손으로 관리하는 '핵심 cron 기대표'는 두지 않는다 — 69개짜리 표는 금방 낡아
 * 오탐(이름 바뀜)과 누락(새 cron 미등록)을 **동시에** 만든다. 기록된 cron 식이 SSOT.
 * 그래서 `label` 은 작업 이름 그대로다(없는 친절함을 지어내지 않는다).
 *
 * 오탐 방지: 첫 배포 직후엔 기록이 0이라 '전면 침묵'처럼 보인다 → 추적 시작 시각(sentinel)을
 * 남겨, 유예 안에서는 `bootstrapping: true` 로 ok 를 유지한다.
 * ──────────────────────────────────────────────────────────────────────────── */

/** 추적 시작 시각 — "한 번도 안 돈 것"과 "이제 막 배포된 것"을 가른다. */
const TRACKING_KEY = 'cron_hb_tracking_since'
/** 전면 침묵 판정 유예(분). 가장 빈번한 cron 이 2분 주기라 넉넉하다. */
const TOTAL_SILENCE_MIN = 90

export interface CronStaleEntry {
  name: string
  /** 사람이 읽는 이름. 수동 표를 두지 않으므로 작업 이름과 같다. */
  label: string
  max_gap_min: number
  last_finished_at: string | null
  age_min: number | null
}

export interface CronHealth {
  ok: boolean
  /** 추적 유예 안(기록 없음) — 첫 배포 오탐 방지용. true 면 ok 를 신뢰하지 말 것. */
  bootstrapping: boolean
  latest_heartbeat_at: string | null
  latest_age_min: number | null
  stale: CronStaleEntry[]
  /**
   * 🪦 **은퇴/인수된 이름** — 낡았지만 `ok` 를 물지 **않는다**. 개명·DO 알람 인수로 아무도 안 부르는
   * 하트비트 행은 영원히 갱신되지 않아 게이트를 영구 빨간불로 만든다(2026-08-04 실측 6일·이슈 코멘트 84개).
   * 지우지 않고 여기 남겨 **보이게는** 한다 — 정리 대상 목록으로 쓰라고.
   */
  retired: CronStaleEntry[]
  /** cron 식이 없거나 해석 불가해 **판정을 못 한** 작업들(모르면 조용히 있는다). */
  missing: string[]
  /**
   * 🔴 **한 번도 안 뛴 cron 식** — 코드는 기대하는데 기록이 0인 것.
   * `stale`(뛰다가 멈춤)과 **다른 사고**다: 트리거 미등록은 침묵이 아니라 **부재**라 기존 판정에
   * 아예 안 잡혔다(2026-07-29 실사고 — 주간 정산 지급·백업이 한 번도 안 돌고 있었다).
   * 오탐 방지로 **추적 창이 그 주기보다 길 때만** 채워진다.
   */
  never_fired: NeverFiredEntry[]
}

export async function getCronHealth(DB: D1Database): Promise<CronHealth> {
  const beats = await listCronHeartbeats(DB)

  // 추적 시작 시각 (최초 1회만 기록 — 이후 갱신하지 않는다).
  let trackingSinceMs = NaN
  try {
    const row = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?')
      .bind(TRACKING_KEY).first<{ value: string }>()
    if (row?.value) trackingSinceMs = Date.parse(row.value)
    else {
      await DB.prepare('INSERT OR IGNORE INTO platform_settings (key, value) VALUES (?, ?)')
        .bind(TRACKING_KEY, new Date().toISOString()).run()
      trackingSinceMs = Date.now()
    }
  } catch { /* 관측용 — 실패해도 아래 판정은 계속한다 */ }
  const trackedMin = Number.isFinite(trackingSinceMs) ? (Date.now() - trackingSinceMs) / 60000 : 0

  const empty = (bootstrapping: boolean): CronHealth => ({
    ok: bootstrapping, bootstrapping, latest_heartbeat_at: null, latest_age_min: null,
    stale: bootstrapping ? [] : [{
      name: '(전체)', label: 'cron 전체', max_gap_min: TOTAL_SILENCE_MIN,
      last_finished_at: null, age_min: null,
    }],
    retired: [],
    missing: [],
    never_fired: [],
  })
  if (!beats.length) return empty(trackedMin < TOTAL_SILENCE_MIN)

  // listCronHeartbeats 는 오래된 순 정렬 → 마지막이 가장 최근.
  const withAge = beats.filter(b => b.age_minutes != null)
  const newest = withAge.length ? withAge[withAge.length - 1]! : null
  const latestAge = newest?.age_minutes ?? null

  // ② 전면 침묵 — 가장 최근 기록조차 오래됐다.
  if (latestAge != null && latestAge > TOTAL_SILENCE_MIN) {
    return {
      ok: false, bootstrapping: false,
      latest_heartbeat_at: newest?.at ?? null, latest_age_min: latestAge,
      stale: [{
        name: '(전체)', label: 'cron 전체 — 아무 작업도 안 돌고 있음',
        max_gap_min: TOTAL_SILENCE_MIN, last_finished_at: newest?.at ?? null, age_min: latestAge,
      }],
      retired: [],
      missing: [],
      never_fired: [],  // 전면 침묵이면 개별 부재는 노이즈 — 먼저 전체를 살려야 한다
    }
  }

  // ① 개별 침묵 — 기대주기(기록된 cron 식 기반)를 넘긴 작업.
  //   🪦 2026-08-04: **은퇴한 이름은 `ok` 를 물지 않는다.** 하트비트 행은 레인보다 오래 살아서,
  //     개명·인수된 이름은 영원히 안 갱신되고 영원히 stale 이다 → 게이트가 꺼질 수 없다(실측 6일).
  //     지우지 않고 `retired` 로 **계속 보여 주되** 판정에서만 뺀다. 근거: `cron-beat-retirement.ts`.
  const fresh = freshBaseNames(beats)
  const stale: CronStaleEntry[] = []
  const retired: CronStaleEntry[] = []
  const missing: string[] = []
  for (const b of beats) {
    const limit = b.max_gap_min ?? expectedMaxAgeMinutes(b.cron)
    if (limit == null || b.age_minutes == null) { missing.push(b.name); continue }
    if (b.age_minutes > limit) {
      const entry: CronStaleEntry = {
        name: b.name, label: b.name, max_gap_min: limit,
        last_finished_at: b.at, age_min: b.age_minutes,
      }
      const verdict = classifyBeat({ name: b.name, age_minutes: b.age_minutes, max_gap_min: limit }, fresh)
      if (verdict === 'judge') stale.push(entry)
      else retired.push({ ...entry, label: `${b.name} (${verdict === 'superseded' ? '같은 일이 새 이름으로 실행 중' : '아무도 안 부르는 이름'})` })
    }
  }

  // 🔴 기대 목록 대조 — "뛰다가 멈춤"이 아니라 **한 번도 안 뜀**.
  const neverFired = findNeverFired(beats.map(b => b.cron), trackedMin, expectedMaxAgeMinutes)

  return {
    // 부재도 ok 를 깬다 — 이걸 ok 로 두면 2026-07-29 사고가 그대로 반복된다(초록불인데 지급이 안 나감).
    ok: stale.length === 0 && neverFired.length === 0,
    bootstrapping: false,
    latest_heartbeat_at: newest?.at ?? null,
    latest_age_min: latestAge,
    stale,
    retired,
    missing,
    never_fired: neverFired,
  }
}
