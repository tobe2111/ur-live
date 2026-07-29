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

/** 값 상한 — 이름이 길거나 이상값이 와도 platform_settings 를 오염시키지 않게. */
const MAX_VALUE = 300

/**
 * 한 cron 작업의 실행 사실을 기록한다. **절대 throw 하지 않는다** — 하트비트 실패가
 * 본 작업을 망가뜨리면 안 된다(기록은 관측용이지 기능이 아니다).
 */
export async function recordCronBeat(
  env: Env,
  name: string,
  ok: boolean,
  ms: number,
): Promise<void> {
  try {
    const DB = (env as unknown as { DB?: D1Database }).DB
    if (!DB || !name) return
    const value = JSON.stringify({
      at: new Date().toISOString(),
      ok,
      ms: Math.max(0, Math.round(ms)),
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
}

/** 어드민 조회용 — 오래된 것부터. 실패해도 빈 배열(화면이 죽지 않게). */
export async function listCronHeartbeats(DB: D1Database): Promise<CronHeartbeat[]> {
  try {
    const { results } = await DB.prepare(
      "SELECT key, value FROM platform_settings WHERE key LIKE 'cron_hb:%'",
    ).all<{ key: string; value: string }>()
    const now = Date.now()
    const rows = (results || []).map((r) => {
      let at: string | null = null, ok: boolean | null = null, ms: number | null = null
      try {
        const v = JSON.parse(r.value) as { at?: string; ok?: boolean; ms?: number }
        at = v.at ?? null; ok = typeof v.ok === 'boolean' ? v.ok : null; ms = typeof v.ms === 'number' ? v.ms : null
      } catch { /* 깨진 값은 null 로 */ }
      const t = at ? Date.parse(at) : NaN
      return {
        name: r.key.slice('cron_hb:'.length),
        at, ok, ms,
        age_minutes: Number.isFinite(t) ? Math.round((now - t) / 60000) : null,
      }
    })
    // 오래된 것 먼저 = 멈췄을 가능성이 높은 것 먼저.
    rows.sort((a, b) => (b.age_minutes ?? Number.MAX_SAFE_INTEGER) - (a.age_minutes ?? Number.MAX_SAFE_INTEGER))
    return rows
  } catch {
    return []
  }
}
