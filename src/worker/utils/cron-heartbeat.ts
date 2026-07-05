/**
 * 🫀 2026-07-05: Cron heartbeat — "cron 침묵" dead-man's switch (1인 운영 관측 보강).
 *
 * 배경: cron_failures(실패 기록)·safeCron Discord 알림은 *실행됐는데 터진* 경우만 잡는다.
 * cron 시스템 자체가 조용히 멈추면(예: Workers cron 프로젝트 미배포 drift — Pages 와 이중 배포,
 * wrangler.toml triggers 누락, isolate 전면 장애) 아무 신호가 없다 — 백업/정산/KT 스위퍼가
 * 침묵 속에 멈춰도 아무도 모름.
 *
 * 처리:
 *   1. scheduled.ts `safeCron` (모든 cron 의 단일 관문) 이 매 실행 종료 시
 *      `recordCronHeartbeat()` 1 write — cron_heartbeats 에 이름별 최종 실행 시각/상태 upsert.
 *   2. `getCronHealth()` 가 핵심 cron(아래 CRITICAL_CRON_EXPECTATIONS) 의 최종 실행이
 *      허용 간격을 넘겼는지 판정.
 *   3. 외부 관측: GET /api/_healthcheck/cron (healthcheck.routes.ts) → uptime.yml (GitHub
 *      Actions, 10분마다) 이 ok:false 면 'uptime' 이슈 생성 → 이메일 알림.
 *      ⚠️ daily-self-diagnostic 의 stale 체크는 cron *내부* 실행이라 cron 전면 사망 시
 *      스스로 못 알림 — 반드시 외부(uptime.yml) 관측이 진짜 dead-man's switch.
 *
 * 정합성: 돈/상태 아님(관측 전용) — 기록 실패는 무조건 fail-soft (cron 본연 작업 불막음).
 * 쓰기 볼륨: cron 실행당 D1 write 1회 (KV 미사용 — 무료 1K/day 한도 무관).
 */

import { logError } from './logger'

export interface CronHeartbeatRow {
  cron_name: string
  last_status: string
  last_started_at: string | null
  last_finished_at: string | null
  last_duration_ms: number | null
  last_error: string | null
  run_count: number
}

export interface CronStaleEntry {
  name: string
  label: string
  max_gap_min: number
  last_finished_at: string | null
  age_min: number | null
}

export interface CronHealth {
  ok: boolean
  /** 아직 heartbeat 가 하나도 없음 (첫 배포 직후 등) — 오탐 방지 위해 ok:true 유지 */
  bootstrapping: boolean
  latest_heartbeat_at: string | null
  latest_age_min: number | null
  stale: CronStaleEntry[]
  /** 기록이 아예 없는 핵심 cron (정보성 — 주간 cron 은 첫 주 동안 자연스럽게 비어있음) */
  missing: string[]
}

/**
 * 침묵 감지 대상 핵심 cron + 허용 간격 (스케줄 주기 × 여유배수).
 * ❗ scheduled.ts 의 safeCron name 과 정확히 일치해야 함 (이름으로 매칭).
 * 새 핵심 cron 추가 시 여기에 등록 — daily-self-diagnostic + /api/_healthcheck/cron 이 자동 감시.
 */
export const CRITICAL_CRON_EXPECTATIONS: Array<{ name: string; label: string; maxGapMin: number }> = [
  // 5분 주기군 — 60분 내 미실행이면 cron 시스템 이상
  { name: 'scheduled-cleanup', label: '정리 배치(5분)', maxGapMin: 60 },
  { name: 'cache-prewarm', label: '캐시 프리웜(5분)', maxGapMin: 60 },
  { name: 'retry-alimtalk', label: '알림톡 재시도(5분)', maxGapMin: 60 },
  // 매시 주기군 — 3시간 여유
  { name: 'anomaly-detect', label: '이상치 탐지(매시)', maxGapMin: 180 },
  { name: 'kt-alpha-voucher-retry', label: 'KT 교환권 재발송 스위퍼(매시)', maxGapMin: 180 },
  { name: 'toss-refund-retry', label: 'Toss 환불 재시도(매시)', maxGapMin: 180 },
  // 일일 주기군 — 26시간 여유
  { name: 'auto-settlement', label: '자동 정산(일일)', maxGapMin: 26 * 60 },
  { name: 'daily-self-diagnostic', label: '자가진단(일일)', maxGapMin: 26 * 60 },
  { name: 'schema-repair-daily', label: '스키마 자동수리(일일)', maxGapMin: 26 * 60 },
  { name: 'ledger-reconcile', label: '원장 정합 검증(일일)', maxGapMin: 26 * 60 },
  { name: 'reconciliation', label: '대사(일일)', maxGapMin: 26 * 60 },
  // 주간 주기군 — 8일 여유
  { name: 'payouts-generate', label: '주간 정산 생성(월)', maxGapMin: 8 * 24 * 60 },
  { name: 'd1-backup', label: 'D1 주간 백업(일)', maxGapMin: 8 * 24 * 60 },
]

const _ensured = new WeakSet<object>()

async function ensureCronHeartbeats(DB: D1Database): Promise<void> {
  if (_ensured.has(DB)) return
  _ensured.add(DB)
  try {
    await DB.prepare(`
      CREATE TABLE IF NOT EXISTS cron_heartbeats (
        cron_name TEXT PRIMARY KEY,
        last_status TEXT NOT NULL DEFAULT 'ok',
        last_started_at DATETIME,
        last_finished_at DATETIME,
        last_duration_ms INTEGER,
        last_error TEXT,
        run_count INTEGER NOT NULL DEFAULT 0
      )
    `).run()
  } catch { /* 테이블 생성 실패해도 cron 본연 작업은 계속 — repair-schema 가 다음날 보장 */ }
}

/**
 * cron 실행 종료 시 1회 호출 (safeCron 관문). 실행당 D1 write 1회.
 * 어떤 실패도 삼킨다 — heartbeat 가 cron 을 죽이면 본말전도.
 */
export async function recordCronHeartbeat(
  DB: D1Database | undefined,
  name: string,
  status: 'ok' | 'fail',
  durationMs: number,
  error?: unknown,
): Promise<void> {
  if (!DB) return
  try {
    await ensureCronHeartbeats(DB)
    const startedIso = new Date(Date.now() - Math.max(0, durationMs)).toISOString()
    const errMsg = status === 'fail'
      ? ((error as Error)?.message || String(error ?? '')).slice(0, 500)
      : null
    await DB.prepare(`
      INSERT INTO cron_heartbeats (cron_name, last_status, last_started_at, last_finished_at, last_duration_ms, last_error, run_count)
      VALUES (?, ?, ?, datetime('now'), ?, ?, 1)
      ON CONFLICT(cron_name) DO UPDATE SET
        last_status = excluded.last_status,
        last_started_at = excluded.last_started_at,
        last_finished_at = excluded.last_finished_at,
        last_duration_ms = excluded.last_duration_ms,
        last_error = excluded.last_error,
        run_count = cron_heartbeats.run_count + 1
    `).bind(name, status, startedIso, Math.round(durationMs), errMsg).run()
  } catch (e) {
    logError('[cron-heartbeat] record failed', { name, error: String(e) })
  }
}

/** ISO/SQLite datetime → 경과 분. 파싱 불가면 null. */
function ageMinutes(datetime: string | null | undefined, nowMs: number): number | null {
  if (!datetime) return null
  // SQLite datetime('now') 는 'YYYY-MM-DD HH:MM:SS' (UTC, 타임존 표기 없음) — Z 보정
  const iso = datetime.includes('T') ? datetime : datetime.replace(' ', 'T') + 'Z'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return null
  return Math.floor((nowMs - t) / 60_000)
}

/**
 * 핵심 cron stale 판정.
 * ok:false 조건 = (기록된 핵심 cron 이 허용 간격 초과) OR (전체 heartbeat 최신값이 90분 초과
 * — 5분 주기군이 항상 돌아야 하므로 90분 침묵 = cron 시스템 전면 사망).
 * 기록이 하나도 없으면 bootstrapping (첫 배포 직후 5분 내 채워짐 — 오탐 방지 위해 ok:true).
 */
export async function getCronHealth(DB: D1Database): Promise<CronHealth> {
  const now = Date.now()
  let rows: CronHeartbeatRow[] = []
  try {
    await ensureCronHeartbeats(DB)
    const r = await DB.prepare(
      `SELECT cron_name, last_status, last_started_at, last_finished_at, last_duration_ms, last_error, run_count
       FROM cron_heartbeats`,
    ).all<CronHeartbeatRow>()
    rows = r.results || []
  } catch (e) {
    logError('[cron-heartbeat] health read failed', { error: String(e) })
    // 조회 자체가 실패하면 판정 불가 — DB 장애는 별도 프로브(/api/version 등)가 잡음
    return { ok: true, bootstrapping: true, latest_heartbeat_at: null, latest_age_min: null, stale: [], missing: [] }
  }

  if (rows.length === 0) {
    return { ok: true, bootstrapping: true, latest_heartbeat_at: null, latest_age_min: null, stale: [], missing: CRITICAL_CRON_EXPECTATIONS.map(x => x.name) }
  }

  const byName = new Map(rows.map(r => [r.cron_name, r]))
  const stale: CronStaleEntry[] = []
  const missing: string[] = []
  for (const exp of CRITICAL_CRON_EXPECTATIONS) {
    const row = byName.get(exp.name)
    if (!row || !row.last_finished_at) { missing.push(exp.name); continue }
    const age = ageMinutes(row.last_finished_at, now)
    if (age !== null && age > exp.maxGapMin) {
      stale.push({ name: exp.name, label: exp.label, max_gap_min: exp.maxGapMin, last_finished_at: row.last_finished_at, age_min: age })
    }
  }

  let latestAt: string | null = null
  let latestAge: number | null = null
  for (const r of rows) {
    const age = ageMinutes(r.last_finished_at, now)
    if (age !== null && (latestAge === null || age < latestAge)) { latestAge = age; latestAt = r.last_finished_at }
  }

  const systemSilent = latestAge !== null && latestAge > 90
  return {
    ok: stale.length === 0 && !systemSilent,
    bootstrapping: false,
    latest_heartbeat_at: latestAt,
    latest_age_min: latestAge,
    stale,
    missing,
  }
}
