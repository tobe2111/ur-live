/**
 * 📟 보강 레인 계측 — `ads_enrich_last` 기록 전담 (2026-07-28 분리).
 *
 *   왜 별 모듈인가: 2026-07-28 라이브에서 보강 라운드가 **한 번도 정상 종료되지 않는데**
 *   (`partial:true` 고정 · `crawls:0` · `limit_hit:false`) **왜 안 끝나는지 알 신호가 어디에도 없었다.**
 *   호출부(ur-ads)는 예외를 `catch { 'FAILED' }` 로 버렸고, 스냅샷엔 단계 표식이 없었으며,
 *   대상 1건당 도는 `stamp()` 의 D1 오류는 `.catch(() => null)` 이 삼켰다
 *   (**D1 쿼리도 서브리퀘스트를 소모**하므로 그 신호를 잃으면 한도 도달을 영영 못 본다).
 *   ⇒ 계측을 수집 로직에서 떼어내 "증거를 남기는 책임"을 한곳에 모은다.
 *
 *   원칙: 기록 실패가 **원래 작업이나 원래 예외를 가리지 않는다**(전부 fail-soft).
 */
import type { Env } from '@/worker/types/env'

/** 보강 스냅샷 키 — 어드민 상태줄(`/api/admin/partner-pool/stats` → `enrichLast`)이 그대로 읽는다. */
export const ENRICH_SNAPSHOT_KEY = 'ads_enrich_last'
/** 📝 인플루언서 풀 보강 레인 스냅샷 키(2026-07-28 신설 — `influencer-enrich-lane.ts`).
 *  ⚠️ 키만 여기 두는 이유: 어드민 통계 모듈이 **수집 엔진을 import 하지 않고** 이 값을 읽어야 한다
 *  (메인 번들 경량 유지 — `admin-ads-influencers.routes.ts` 헤더 규칙). */
export const INFLUENCER_ENRICH_SNAPSHOT_KEY = 'ads_influencer_enrich_last'

const nowStamp = () => new Date().toISOString().slice(0, 19).replace('T', ' ')

/** 🧮 누적 집계 키 — 스냅샷은 **라운드마다 덮이므로** 이것 없이는 아래를 구분할 수 없다(2026-07-29 신설):
 *    ⓐ 모든 라운드가 3건에서 죽는다  ⓑ 마지막 라운드만 부모 크론 종료에 잘렸다
 *  둘의 처방이 정반대인데(코드 수리 vs 스케줄 수리) 스냅샷 한 장으로는 **판정 자체가 불가능**했다. */
export const ENRICH_ROLLUP_KEY = 'ads_enrich_rollup'
/** 매장 후보 보강 레인의 누적(같은 구조, 다른 키). */
export const PROSPECT_ROLLUP_KEY = 'ads_prospect_enrich_rollup'

export interface EnrichRollup {
  /** KST 기준 하루 — 날짜가 바뀌면 카운터가 리셋된다(하루 단위 추세를 본다). */
  day: string
  rounds: number; partial: number; deadline: number; limit: number; crash: number
  processed: number; enriched: number; crawls: number; fetches: number; d1: number; spent: number
  /** 라운드가 **어디서 끝났는지**의 분포(p1_done/p2/p3_done…) — ⓐ/ⓑ 판정의 핵심. */
  phase: Record<string, number>
  last_run_id?: string; updated_at?: string
}

/** KST 하루 경계 — 워커 TZ 는 UTC 라 +9h 후 날짜를 취한다(`docs/CURRENT_WORK.md` KST 규약). */
export const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3_600_000).toISOString().slice(0, 10)

const emptyRollup = (day: string): EnrichRollup => ({
  day, rounds: 0, partial: 0, deadline: 0, limit: 0, crash: 0,
  processed: 0, enriched: 0, crawls: 0, fetches: 0, d1: 0, spent: 0, phase: {},
})

/**
 * 직전 라운드의 **마지막 스냅샷**을 누적에 접는다(순수 함수 — I/O 없음, 그래서 단위 검증 가능).
 *
 *   왜 '직전'인가: 중도 사망한 라운드는 자기 종료 코드에 도달하지 못하므로 **스스로는 누적할 수 없다.**
 *   그 라운드가 남긴 마지막 부분 스냅샷은 다음 라운드가 시작할 때까지 살아 있다 → 다음 라운드가 접는다.
 *   ⇒ 죽은 라운드도 빠짐없이 세어진다(그게 이 계측의 존재 이유다).
 *
 *   @returns 갱신된 누적 · 접을 것이 없으면 `null`(= 쓰지 않음, 서브리퀘스트 절약)
 */
export function foldRound(rollup: EnrichRollup | null, snap: Record<string, unknown> | null, day = kstDay()): EnrichRollup | null {
  if (!snap) return null
  const runId = typeof snap.run_id === 'string' ? snap.run_id : ''
  if (!runId) return null // run_id 없는 구형 스냅샷 — 중복 접기를 막을 수 없으므로 접지 않는다
  // 멱등: 같은 라운드를 두 번 세지 않는다. **날짜 경계와 무관하게** 검사한다
  //   (자정 직후 리셋 때 같은 스냅샷이 새 버킷에 다시 접히던 이중계상 방지).
  if (rollup?.last_run_id === runId) return null
  const r: EnrichRollup = rollup && rollup.day === day
    ? { ...rollup, phase: { ...rollup.phase } }
    : emptyRollup(day)
  const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0)
  r.rounds++
  if (snap.partial === true) r.partial++
  if (snap.deadline_hit === true) r.deadline++
  if (snap.limit_hit === true) r.limit++
  if (snap.crash) r.crash++
  r.processed += n(snap.processed); r.enriched += n(snap.enriched); r.crawls += n(snap.crawls)
  r.fetches += n(snap.fetches); r.d1 += n(snap.d1); r.spent += n(snap.spent)
  const ph = typeof snap.phase === 'string' && snap.phase ? snap.phase : 'unknown'
  r.phase[ph] = (r.phase[ph] || 0) + 1
  r.last_run_id = runId
  r.updated_at = nowStamp()
  return r
}

/** `foldRound` 의 I/O 래퍼 — 원본 JSON 은 **호출부가 이미 읽은 것**을 넘긴다(추가 SELECT 0).
 *  @returns 실제로 썼으면 true(호출부가 서브리퀘스트 1을 계상하도록) */
export async function foldEnrichRollup(DB: Env['DB'], rollupKey: string, snapRaw: string | null, rollupRaw: string | null): Promise<boolean> {
  let snap: Record<string, unknown> | null = null
  let prev: EnrichRollup | null = null
  try { snap = snapRaw ? JSON.parse(snapRaw) as Record<string, unknown> : null } catch { snap = null }
  try { prev = rollupRaw ? JSON.parse(rollupRaw) as EnrichRollup : null } catch { prev = null }
  const next = foldRound(prev, snap)
  if (!next) return false
  const ok = await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(rollupKey, JSON.stringify(next)).run().then(() => true).catch(() => false)
  return ok
}

/** 스냅샷 1회 기록. 부분(`partial:true`)/최종(`false`) 모두 이 경로. */
export async function writeEnrichSnapshot(DB: Env['DB'], payload: Record<string, unknown>): Promise<void> {
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(ENRICH_SNAPSHOT_KEY, JSON.stringify({ last_run: nowStamp(), ...payload })).run().catch(() => null)
}

/**
 * 💥 예외를 **증거로 남긴다** — 마지막 부분 스냅샷을 보존한 채 `crash` 원문만 덧붙인다.
 *   → 다음 조회 한 번으로 "라운드가 왜 안 끝났는가"의 사인이 드러난다(추측 금지 룰의 도구).
 */
export async function recordEnrichCrash(DB: Env['DB'], err: unknown): Promise<void> {
  const e = err as { name?: string; message?: string } | null
  const crash = `${e?.name || 'Error'}: ${String(e?.message || '').slice(0, 200)}`
  try {
    const row = await DB.prepare(`SELECT value FROM platform_settings WHERE key = '${ENRICH_SNAPSHOT_KEY}'`).first<{ value: string }>()
    const prev = row?.value ? JSON.parse(row.value) as Record<string, unknown> : {}
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(ENRICH_SNAPSHOT_KEY, JSON.stringify({ ...prev, crash, crash_at: nowStamp() })).run()
  } catch { /* 기록 실패가 원래 예외를 가리지 않게 */ }
}
