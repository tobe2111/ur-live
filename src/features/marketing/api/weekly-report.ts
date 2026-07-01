/**
 * 🆕 2026-06-27 유어애즈 — AI 주간 리포트 자동 생성.
 *
 *   매주(월요일 cron) 연결된 각 고객사의 최근 7일 검색광고 실적을 모아 AI 마케터 진단을
 *   생성·저장한다. 대시보드에서 열람(GET /reports), 수동 생성(POST /reports/generate)도 가능.
 *   이메일(Resend)은 best-effort(설정 + 셀러 이메일 있을 때만).
 *
 *   ⚠️ 읽기 전용 — 입찰/키워드 변경 없음(ai-marketer 와 동일). AI 미설정 시 통계 요약만 저장.
 *   비용 가드: 1회 cron 당 최대 MAX_TENANTS_PER_RUN 명, 주(週)당 1회 멱등(period_key UNIQUE).
 */
import { swallow } from '@/worker/utils/swallow'
import type { Env } from '@/worker/types/env'
import { accountStats, type AccountStats } from './searchad-client'
import { loadSearchAdConnection, getActiveTenantId } from './searchad-connection'
import { aiMarketerAdvice, type AiMarketerContext } from './ai-marketer'
import { getMetricsHistory, trendContextFrom } from './metrics-history'

const MAX_TENANTS_PER_RUN = 30

const _schemaDone = new WeakSet<object>()
export async function ensureReportSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_weekly_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    period_key TEXT NOT NULL,
    summary_json TEXT,
    advice_md TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(seller_id, period_key)
  )`).run().catch(swallow('adsreport:table'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_ads_report_seller ON ad_weekly_reports(seller_id, id)').run().catch(swallow('adsreport:idx'))
}

/** KST 기준 이번 주 월요일 'YYYY-MM-DD'(주 단위 멱등 키). */
export function kstWeekKey(nowMs: number): string {
  const k = new Date(nowMs + 9 * 3600_000)
  const back = (k.getUTCDay() + 6) % 7 // 월요일까지 며칠 전
  const mon = new Date(k.getTime() - back * 86400_000)
  return `${mon.getUTCFullYear()}-${String(mon.getUTCMonth() + 1).padStart(2, '0')}-${String(mon.getUTCDate()).padStart(2, '0')}`
}

function statsToContext(data: AccountStats): AiMarketerContext {
  return {
    connected: true,
    stats: {
      days: data.days,
      impCnt: data.totals.impCnt, clkCnt: data.totals.clkCnt, salesAmt: data.totals.salesAmt,
      ccnt: data.totals.ccnt, ctr: data.totals.ctr, cpc: data.totals.cpc,
      topCampaigns: (data.campaigns || []).slice(0, 5).map(c => ({ name: c.name, salesAmt: c.salesAmt, clkCnt: c.clkCnt, ccnt: c.ccnt })),
    },
  }
}

/** 한 고객사의 주간 리포트 생성·저장. replace=true 면 같은 주 재생성(수동). 반환: 저장 여부. */
export async function generateWeeklyReport(env: Env, sellerId: number, opts?: { replace?: boolean; nowMs?: number }): Promise<{ ok: boolean; error?: string; advice?: string }> {
  await ensureReportSchema(env.DB)
  const creds = await loadSearchAdConnection(env.DB, sellerId, env.DATA_ENCRYPTION_KEY).catch(() => null)
  if (!creds) return { ok: false, error: 'NOT_CONNECTED' }
  const st = await accountStats(creds, 7).catch(() => ({ ok: false as const }))
  if (!st.ok || !('data' in st) || !st.data) return { ok: false, error: '실적 조회 실패' }
  const ctx = statsToContext(st.data)
  // 전주 대비 추세(적재된 시계열 있을 때만) — AI 진단 + summary 에 반영(활성 고객사 기준).
  const trendTenant = await getActiveTenantId(env.DB, sellerId).catch(() => null)
  const trend = trendContextFrom(await getMetricsHistory(env.DB, sellerId, 14, trendTenant).catch(() => []))
  if (trend) ctx.trend = trend
  const ai = await aiMarketerAdvice(env.ANTHROPIC_API_KEY, ctx).catch(() => ({ ok: false as const, error: 'AI 호출 실패' }))
  const advice = ai.ok && 'advice' in ai ? ai.advice || '' : ''
  const periodKey = kstWeekKey(opts?.nowMs ?? Date.now())
  const verb = opts?.replace ? 'INSERT OR REPLACE' : 'INSERT OR IGNORE'
  await env.DB.prepare(`${verb} INTO ad_weekly_reports (seller_id, period_key, summary_json, advice_md) VALUES (?, ?, ?, ?)`)
    .bind(sellerId, periodKey, JSON.stringify({ ...(ctx.stats || {}), trend: ctx.trend || null }), advice).run().catch(() => null)
  // 이메일(best-effort) — Resend + 유어애즈 계정 이메일 있을 때만.
  //   ⚠️ 2026-06-28: 테넌트는 이제 ad_accounts.id(독립 계정) — sellers.email 아님(독립 계정 분리 후속 정정).
  if (advice && env.RESEND_API_KEY && env.RESEND_FROM) {
    const acc = await env.DB.prepare('SELECT email FROM ad_accounts WHERE id = ?').bind(sellerId).first<{ email: string | null }>().catch(() => null)
    if (acc?.email) await sendReportEmail(env, acc.email, periodKey, advice).catch(() => {})
  }
  return { ok: true, advice }
}

async function sendReportEmail(env: Env, to: string, periodKey: string, adviceMd: string): Promise<void> {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: env.RESEND_FROM, to,
      subject: `[유어애즈] 주간 광고 리포트 (${periodKey})`,
      text: `유어애즈 주간 리포트\n기간 시작: ${periodKey}\n\n${adviceMd}\n\n— 유어애즈 UR Ads`,
    }),
  })
}

export interface WeeklyReport { id: number; period_key: string; summary_json: string | null; advice_md: string | null; created_at: string }
export async function listReports(DB: D1Database, sellerId: number, limit = 12): Promise<WeeklyReport[]> {
  await ensureReportSchema(DB)
  const r = await DB.prepare('SELECT id, period_key, summary_json, advice_md, created_at FROM ad_weekly_reports WHERE seller_id = ? ORDER BY id DESC LIMIT ?')
    .bind(sellerId, Math.min(50, limit)).all<WeeklyReport>().catch(() => null)
  return r?.results || []
}

/** cron 엔트리 — 연결된 고객사들의 주간 리포트 자동 생성(주당 1회 멱등). */
export async function handleAdsWeeklyReport(env: Env): Promise<{ tenants: number; generated: number }> {
  await ensureReportSchema(env.DB)
  // 검색광고 연결이 있는 셀러만(멀티테넌트 — 활성 고객사 기준 리포트). 읽기 실적 필요.
  const rows = (await env.DB.prepare('SELECT DISTINCT seller_id FROM ad_searchad_tenants LIMIT ?')
    .bind(MAX_TENANTS_PER_RUN).all<{ seller_id: number }>().catch(() => null))?.results || []
  let generated = 0
  for (const row of rows) {
    const r = await generateWeeklyReport(env, row.seller_id).catch(() => ({ ok: false as const }))
    if (r.ok) generated++
  }
  return { tenants: rows.length, generated }
}
