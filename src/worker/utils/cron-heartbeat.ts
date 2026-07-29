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
function summarizeResult(v: unknown): string | null {
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
): Promise<void> {
  try {
    const DB = (env as unknown as { DB?: D1Database }).DB
    if (!DB || !name) return
    const value = JSON.stringify({
      at: new Date().toISOString(),
      ok,
      ms: Math.max(0, Math.round(ms)),
      ...(cronExpr ? { cron: cronExpr.slice(0, 40) } : {}),
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
      try {
        const v = JSON.parse(r.value) as { at?: string; ok?: boolean; ms?: number; cron?: string; r?: string }
        at = v.at ?? null; ok = typeof v.ok === 'boolean' ? v.ok : null
        ms = typeof v.ms === 'number' ? v.ms : null; cron = v.cron ?? null; note = v.r ?? null
      } catch { /* 깨진 값은 null 로 */ }
      const t = at ? Date.parse(at) : NaN
      const age = Number.isFinite(t) ? Math.round((now - t) / 60000) : null
      const limit = expectedMaxAgeMinutes(cron)
      return {
        name: r.key.slice('cron_hb:'.length),
        at, ok, ms, cron, result: note,
        age_minutes: age,
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
