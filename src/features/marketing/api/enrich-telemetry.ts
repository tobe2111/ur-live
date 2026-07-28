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
