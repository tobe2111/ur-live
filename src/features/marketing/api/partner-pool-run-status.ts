/**
 * 🔔 **작업 완료 감지 전용 경량 API** (2026-08-31 — 라이브 실측이 시킨 분리).
 *
 * ## 왜 만들었나
 * 관리자가 레인 실행 버튼을 누르면 화면이 완료를 감지하려고 **5초마다 36번** `/stats` 를 부른다.
 * 그런데 `/stats` 는 `ad_company_leads` **전수 집계를 8번** 돈다 — 통제 실험으로 잰 값이
 * **호출 1회에 3,317,537행**이다.
 * ```
 *   36회 × 3,317,537행  =  약 1억 1,900만 행   ← 버튼 한 번
 *   업체 DB 실제 하루 읽기 ≈ 1억 행
 * ```
 * **하루치가 버튼 한 번에서 나왔다.**
 *
 * ## 그런데 폴러는 그 집계를 **한 글자도 안 쓴다**
 * 완료 판정이 보는 것은 `platform_settings` 의 레인 상태 블롭(`last_run`/`at`)뿐이다
 * (`src/pages/admin/partner-pool/job-completion.ts` 의 `STAT_PICK`). ⇒ 그것만 주는 문을 따로 낸다.
 *
 * ```
 *   /stats       전수 집계 8번 + 상태 20키   →  3,317,537행
 *   /run-status  상태 20키 한 번에           →  ~20행
 * ```
 *
 * 🔑 `/stats` 의 TTL 캐시(`company-stats-cache.ts`)는 **피해 상한**이고, 이 분리는 **근본**이다.
 *   캐시가 만료돼 있든 말든 폴링은 이제 그 경로를 아예 안 탄다.
 *
 * ⚠️ **응답 모양은 `/stats` 와 같아야 한다** — `STAT_PICK` 이 두 응답에 똑같이 붙기 때문이다.
 *   여기서 필드 이름을 바꾸면 완료 감지가 **조용히** 안 된다(에러 없이 "아직 진행 중"만 뜬다).
 *   그래서 아래 표가 SSOT 이고, 유닛이 `STAT_PICK` 과 대조한다.
 */
import { Hono } from 'hono'
import type { Env } from '@/worker/types/env'
import { adsLeadsDb } from '../../../shared/ads/leads-db'

/**
 * 상태 키 → 응답 필드. **`{ run: … }` 로 감싸는 것과 아닌 것이 갈린다** — `/stats` 가 그렇게 주고
 * `STAT_PICK` 이 그 모양에 맞춰져 있다(`pick()` 은 `d[path].run`, 나머지는 `d[field]` 직접).
 */
export const RUN_STATUS_FIELDS: Array<{ key: string; field: string; wrap: boolean }> = [
  { key: 'ads_company_stats', field: 'collect', wrap: true },
  { key: 'ads_storeinfo_stats', field: 'storeinfo', wrap: true },
  { key: 'ads_commerce_stats', field: 'commerce', wrap: true },
  { key: 'ads_franchise_stats', field: 'franchise', wrap: true },
  { key: 'ads_naracontract_stats', field: 'nara', wrap: true },
  { key: 'ads_nps_stats', field: 'nps', wrap: true },
  { key: 'ads_ntsstatus_stats', field: 'nts', wrap: true },
  { key: 'ads_mxsweep_stats', field: 'mx', wrap: true },
  { key: 'ads_localdata_stats', field: 'localdata', wrap: true },
  { key: 'ads_reclassify_stats', field: 'reclassify', wrap: true },
  { key: 'ads_enrich_last', field: 'enrichLast', wrap: false },
  { key: 'ads_enrich_burst_last', field: 'enrichBurst', wrap: false },
  { key: 'ads_reclassify_burst_last', field: 'reclassifyBurst', wrap: false },
  { key: 'ads_runall_last', field: 'runAll', wrap: false },
  { key: 'ads_kakao_sweep_stats', field: 'kakaoSweep', wrap: false },
  { key: 'ads_registry_match_stats', field: 'registryMatch', wrap: false },
]

/** 진행 중 표시용 잠금 키 — 하트비트 4분 이내면 살아있는 작업(`/stats` 와 같은 기준). */
const LOCK_FIELDS: Array<{ key: string; field: string }> = [
  { key: 'ads_runall_lock', field: 'runAll' },
  { key: 'ads_enrich_burst_lock', field: 'enrich' },
  { key: 'ads_reclassify_burst_lock', field: 'reclassify' },
]

const LIVE_MS = 240_000

/**
 * 상태 키를 **한 번의 쿼리**로 읽는다. 키마다 따로 물으면 20 왕복이고, 그건 폴링에서 다시 비용이 된다.
 * ⚠️ D1 은 문장당 바인딩 100개까지 — 아래 목록이 그보다 훨씬 작다(현재 19).
 */
export async function readRunStatus(DB: D1Database): Promise<Record<string, unknown>> {
  const keys = [...RUN_STATUS_FIELDS.map(f => f.key), ...LOCK_FIELDS.map(f => f.key)]
  const rows = (await DB.prepare(
    `SELECT key, value FROM platform_settings WHERE key IN (${keys.map(() => '?').join(',')})`,
  ).bind(...keys).all<{ key: string; value: string }>().catch(() => null))?.results || []
  const byKey = new Map(rows.map(r => [r.key, r.value]))
  const parse = (k: string): unknown => {
    const v = byKey.get(k)
    try { return v ? JSON.parse(v) : null } catch { return null }
  }
  const out: Record<string, unknown> = {}
  for (const f of RUN_STATUS_FIELDS) {
    const v = parse(f.key)
    out[f.field] = f.wrap ? { run: v } : v
  }
  const live = (v: unknown): boolean => {
    const at = (v as { at?: string } | null)?.at
    return !!at && Date.now() - Date.parse(at) < LIVE_MS
  }
  const running: Record<string, boolean> = {}
  for (const f of LOCK_FIELDS) running[f.field] = live(parse(f.key))
  out.running = running
  return out
}

const app = new Hono<{ Bindings: Env }>()

// GET /api/admin/partner-pool/run-status — 폴링 전용. 집계 없음(그게 요점이다).
app.get('/run-status', async (c) => c.json({ success: true, ...await readRunStatus(adsLeadsDb(c.env)) }))

export const partnerPoolRunStatusRoutes = app
