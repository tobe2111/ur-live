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

/**
 * 작업 반환값을 한 줄 요약으로. 평면 객체의 숫자·불리언·짧은 문자열만 추린다
 * (배열·중첩 객체는 길어지기만 하고 판단에 도움이 안 된다).
 */
/**
 * 실패 사유를 **짧은 분류 코드**로 (순수 — 유닛 잠금).
 *
 *   왜 필요한가: 아래 `summarizeResult` 는 **24자 초과 문자열을 버린다**. 실패 원문
 *   (`Too many subrequests by single Worker invocation` = 47자)을 그대로 넘기면 통째로 사라져
 *   어드민에는 `result: null` 만 남는다 — 실제로 2026-07-29 에 ur-ads 4개 레인이 동시에
 *   `ok:false` 로 죽었는데 예산 고갈인지 다른 예외인지 화면에서 구분되지 않았다.
 *   한도/타임아웃 구분이면 다음 행동을 정하기에 충분하고, 전체 원문은 Discord 통지에 실린다.
 */
export function cronErrorCode(e: unknown): string {
  const msg = String((e as { message?: string } | null)?.message || e || '')
  if (/too many (subrequests|api requests)/i.test(msg)) return 'limit' // 예산 고갈 — AIMD 가 대응할 신호
  const name = (e as { name?: string } | null)?.name
  if (name === 'TimeoutError' || /timeout|aborted/i.test(msg)) return 'timeout'
  return (name || 'Error').slice(0, 24)
}

/**
 * 결과 요약(순수 — 유닛 잠금). ⚠️ **24자 초과 문자열은 버린다** — `cronErrorCode`(위)가 존재하는 이유가
 *   이 제한이다. 제한을 바꾸려면 그 함수와 유닛(ads-cron-beat-errcode)을 함께 보라.
 */
export function summarizeResult(v: unknown): string | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null
  const parts: string[] = []
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'number' || typeof val === 'boolean') parts.push(`${k}=${val}`)
    else if (typeof val === 'string' && val.length <= 24) parts.push(`${k}=${val}`)
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
    const value = JSON.stringify({
      at: new Date().toISOString(),
      ok,
      ms: Math.max(0, Math.round(ms)),
      ...(cronExpr ? { cron: cronExpr.slice(0, 40) } : {}),
      ...(Number.isFinite(maxGapMin) && (maxGapMin as number) > 0 ? { g: Math.round(maxGapMin as number) } : {}),
      ...(summarizeResult(result) ? { r: summarizeResult(result) } : {}),
    }).slice(0, MAX_VALUE)
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(`cron_hb:${name.slice(0, 80)}`, value)
      .run()
  } catch { /* fail-soft — 관측 실패가 작업을 막지 않는다 */ }
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
  /** 이 판정에 쓰인 기대 간격(분) — 작업이 신고했으면 그 값, 아니면 cron 식에서 유도. */
  max_gap_min?: number | null
  /** 마지막 실행이 '무엇을 했나' 한 줄 요약(작업이 결과를 반환한 경우). */
  result?: string | null
}

/**
 * cron 식으로부터 **"이 시간을 넘기면 이상하다"** 기준(분)을 계산한다. 순수함수 — 테스트 가능.
 *
 * 넉넉하게 잡는다(기대주기 × 2 + 30분 여유): 배포·재시도·지연으로 한두 번 밀리는 것까지
 * 경보로 올리면 곧 아무도 안 본다. "확실히 이상한 것만" 울리는 게 목적이다.
 * 해석 불가한 식은 null → **경보하지 않는다**(모르면 조용히 있는 편이 오탐보다 낫다).
 */
export function expectedMaxAgeMinutes(cronExpr?: string | null): number | null {
  if (!cronExpr || typeof cronExpr !== 'string') return null
  const f = cronExpr.trim().split(/\s+/)
  if (f.length !== 5) return null
  const [min, hour, dom, , dow] = f
  let base: number
  const everyN = /^\*\/(\d{1,3})$/.exec(min || '')
  if (everyN && hour === '*') base = Math.max(1, Number(everyN[1]))
  else if (hour === '*') base = 60              // 매시 (분 고정)
  else if (dow !== '*') base = 60 * 24 * 7      // 주간
  else if (dom !== '*') base = 60 * 24 * 31     // 월간
  else base = 60 * 24                           // 매일
  return base * 2 + 30
}

/** 어드민 조회용 — 오래된 것부터. 실패해도 빈 배열(화면이 죽지 않게). */
export async function listCronHeartbeats(DB: D1Database): Promise<CronHeartbeat[]> {
  try {
    const { results } = await DB.prepare(
      "SELECT key, value FROM platform_settings WHERE key LIKE 'cron_hb:%'",
    ).all<{ key: string; value: string }>()
    const now = Date.now()
    const rows = (results || []).map((r) => {
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
      return {
        name: r.key.slice('cron_hb:'.length),
        at, ok, ms, cron, result: note,
        age_minutes: age,
        max_gap_min: limit,
        stale: (limit != null && age != null) ? age > limit : null,
      }
    })
    // 오래된 것 먼저 = 멈췄을 가능성이 높은 것 먼저.
    rows.sort((a, b) => (b.age_minutes ?? Number.MAX_SAFE_INTEGER) - (a.age_minutes ?? Number.MAX_SAFE_INTEGER))
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
  /** cron 식이 없거나 해석 불가해 **판정을 못 한** 작업들(모르면 조용히 있는다). */
  missing: string[]
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
    missing: [],
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
      missing: [],
    }
  }

  // ① 개별 침묵 — 기대주기(기록된 cron 식 기반)를 넘긴 작업.
  const stale: CronStaleEntry[] = []
  const missing: string[] = []
  for (const b of beats) {
    const limit = b.max_gap_min ?? expectedMaxAgeMinutes(b.cron)
    if (limit == null || b.age_minutes == null) { missing.push(b.name); continue }
    if (b.age_minutes > limit) {
      stale.push({
        name: b.name, label: b.name, max_gap_min: limit,
        last_finished_at: b.at, age_min: b.age_minutes,
      })
    }
  }

  return {
    ok: stale.length === 0,
    bootstrapping: false,
    latest_heartbeat_at: newest?.at ?? null,
    latest_age_min: latestAge,
    stale,
    missing,
  }
}
