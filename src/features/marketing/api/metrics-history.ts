/**
 * 🆕 2026-06-30 유어애즈(UR Ads) — 일별 메트릭 히스토리(추세 저장 레이어).
 *
 *   현재 검색광고 실적은 매번 라이브 조회만 해 '시계열/추세'가 없음. 일일 cron 이
 *   연결된 모든 계정의 '어제'(완전한 날) 합계를 ad_daily_metrics 에 1행/계정/일 기록.
 *   → 대시보드 홈의 30일 추세 그래프 + 전주 대비(WoW) 증감의 데이터 원천.
 *   읽기 전용·돈 변경 0. 테넌트 = ad_accounts.id (ad_searchad_tenants.seller_id 컬럼).
 *   ⚠️ 이 환경 egress 차단 → 라이브(배포) 후 실데이터 적재.
 */
import type { Env } from '@/worker/types/env'
import { loadSearchAdConnection } from './searchad-connection'
import { accountStatsForDate, type SearchAdCreds } from './searchad-client'

const _schemaDone = new WeakSet<object>()
export async function ensureMetricsHistorySchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_daily_metrics (
    account_id INTEGER NOT NULL,
    snap_date TEXT NOT NULL,
    cost INTEGER DEFAULT 0,
    conv_amt INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    conv INTEGER DEFAULT 0,
    imp INTEGER DEFAULT 0,
    roas REAL,
    avg_rnk REAL,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(account_id, snap_date)
  )`).run().catch(() => null)
}

function ymd(ms: number): string { return new Date(ms).toISOString().slice(0, 10) }

export interface DailyMetric {
  snap_date: string; cost: number; conv_amt: number; clicks: number; conv: number; imp: number
  roas: number | null; avg_rnk: number | null
}

/** 특정 날짜의 계정 합계를 ad_daily_metrics 에 UPSERT(1행/계정/일). creds 없으면 skip(연동 전). */
export async function snapshotAccountMetricsForDate(env: Env, accountId: number, dateYmd: string, creds?: SearchAdCreds | null): Promise<{ ok: boolean; reason?: string }> {
  await ensureMetricsHistorySchema(env.DB)
  const c = creds || await loadSearchAdConnection(env.DB, accountId, env.DATA_ENCRYPTION_KEY).catch(() => null)
  if (!c) return { ok: false, reason: 'no_creds' }
  const st = await accountStatsForDate(c, dateYmd).catch(() => ({ ok: false as const }))
  if (!st.ok || !('data' in st) || !st.data) return { ok: false, reason: 'stats_failed' }
  const T = st.data.totals
  // 계정 평균순위(클릭 가중) — 클릭 0 캠페인은 1로 최소 가중(노출만 있는 캠페인 무시 방지).
  const camps = st.data.campaigns.filter(x => x.avgRnk > 0)
  const wsum = camps.reduce((s, x) => s + x.avgRnk * (x.clkCnt || 1), 0)
  const wcnt = camps.reduce((s, x) => s + (x.clkCnt || 1), 0)
  const avgRnk = wcnt > 0 ? Math.round((wsum / wcnt) * 10) / 10 : null
  const roas = T.salesAmt > 0 ? Math.round((T.convAmt / T.salesAmt) * 100) : null
  await env.DB.prepare(`INSERT INTO ad_daily_metrics (account_id, snap_date, cost, conv_amt, clicks, conv, imp, roas, avg_rnk)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(account_id, snap_date) DO UPDATE SET cost = excluded.cost, conv_amt = excluded.conv_amt, clicks = excluded.clicks, conv = excluded.conv, imp = excluded.imp, roas = excluded.roas, avg_rnk = excluded.avg_rnk`)
    .bind(accountId, dateYmd, Math.round(T.salesAmt), Math.round(T.convAmt), Math.round(T.clkCnt), Math.round(T.ccnt), Math.round(T.impCnt), roas, avgRnk)
    .run().catch(() => null)
  return { ok: true }
}

/** 자기 계정 즉시 기록(대시보드 '지금 갱신'/첫 진입) — 어제(완전) + 오늘(부분) 2일. */
export async function snapshotAccountRecent(env: Env, accountId: number, nowMs?: number): Promise<{ ok: boolean; reason?: string }> {
  const now = nowMs ?? Date.now()
  const creds = await loadSearchAdConnection(env.DB, accountId, env.DATA_ENCRYPTION_KEY).catch(() => null)
  if (!creds) return { ok: false, reason: 'no_creds' }
  await snapshotAccountMetricsForDate(env, accountId, ymd(now - 86400000), creds).catch(() => null)
  await snapshotAccountMetricsForDate(env, accountId, ymd(now), creds).catch(() => null)
  return { ok: true }
}

/** cron — 연결된 모든 계정의 '어제' 실적 스냅샷(완전한 날 1행/계정/일). */
export async function snapshotAllAccounts(env: Env, nowMs?: number, cap = 300): Promise<{ accounts: number; snapped: number; date: string }> {
  await ensureMetricsHistorySchema(env.DB)
  const now = nowMs ?? Date.now()
  const dateYmd = ymd(now - 86400000) // 어제(완전한 하루)
  const rows = (await env.DB.prepare('SELECT DISTINCT seller_id FROM ad_searchad_tenants LIMIT ?')
    .bind(cap).all<{ seller_id: number }>().catch(() => null))?.results || []
  let snapped = 0
  for (const r of rows) {
    const res = await snapshotAccountMetricsForDate(env, r.seller_id, dateYmd).catch(() => ({ ok: false as const }))
    if (res.ok) snapped++
  }
  return { accounts: rows.length, snapped, date: dateYmd }
}

/** 최근 N일 시계열(오름차순) — 차트 입력. */
export async function getMetricsHistory(DB: D1Database, accountId: number, days = 30): Promise<DailyMetric[]> {
  await ensureMetricsHistorySchema(DB)
  const span = Math.min(120, Math.max(1, Math.round(days)))
  const rows = (await DB.prepare(`SELECT snap_date, cost, conv_amt, clicks, conv, imp, roas, avg_rnk FROM ad_daily_metrics
    WHERE account_id = ? ORDER BY snap_date DESC LIMIT ?`).bind(accountId, span).all<DailyMetric>().catch(() => null))?.results || []
  return rows.reverse() // 차트는 오름차순(과거→현재)
}

export interface MetricsDelta { cost: number; conv_amt: number; roas: number | null }

/** 최근 7일 vs 직전 7일 합계 비교(WoW). 데이터 14일 미만이면 가능한 만큼. */
export function computeWoW(series: DailyMetric[]): { recent: MetricsDelta; prev: MetricsDelta; costPct: number | null; convPct: number | null } {
  const last14 = series.slice(-14)
  const recent = last14.slice(-7)
  const prev = last14.slice(0, Math.max(0, last14.length - 7))
  const sum = (rows: DailyMetric[]): MetricsDelta => {
    const cost = rows.reduce((s, r) => s + (Number(r.cost) || 0), 0)
    const conv_amt = rows.reduce((s, r) => s + (Number(r.conv_amt) || 0), 0)
    return { cost, conv_amt, roas: cost > 0 ? Math.round((conv_amt / cost) * 100) : null }
  }
  const r = sum(recent), p = sum(prev)
  const pct = (a: number, b: number): number | null => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : null)
  return { recent: r, prev: p, costPct: pct(r.cost, p.cost), convPct: pct(r.conv_amt, p.conv_amt) }
}
