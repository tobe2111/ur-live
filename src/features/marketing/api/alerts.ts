/**
 * 🆕 2026-06-28 유어애즈(UR Ads) — 임계값 알림 (예산 소진 임박 · 최저가 역전).
 *
 *   계정별 알림 설정(켜기/임계값) → 일일 cron 이 검색광고 페이싱 + 가격 워치를 점검해
 *   임계 초과 시 계정 이메일(Resend)로 1일 1회 발송(account+date 멱등). 읽기 전용·돈 변경 0.
 *   테넌트 = ad_accounts.id (searchad-connection / price-watches 의 seller_id 컬럼).
 *   ⚠️ 순위 하락 알림은 키워드 순위 시계열 저장이 필요 → 후속(현재 예산·가격 2종).
 */
import type { Env } from '@/worker/types/env'
import { loadSearchAdConnection } from './searchad-connection'
import { budgetPacing } from './searchad-client'
import { getAdsAccount } from './ads-account'

const _schemaDone = new WeakSet<object>()
export async function ensureAlertsSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_alert_settings (
    account_id INTEGER PRIMARY KEY,
    enabled INTEGER DEFAULT 0,
    budget_pace_pct INTEGER DEFAULT 90,
    price_undercut INTEGER DEFAULT 1,
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  // account+종류+날짜 멱등(같은 날 중복 발송 방지).
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_alert_sent (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    dedup_key TEXT NOT NULL,
    sent_date TEXT NOT NULL,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(account_id, dedup_key, sent_date)
  )`).run().catch(() => null)
}

export interface AlertSettings { enabled: number; budget_pace_pct: number; price_undercut: number }
const DEFAULTS: AlertSettings = { enabled: 0, budget_pace_pct: 90, price_undercut: 1 }

export async function getAlertSettings(DB: D1Database, accountId: number): Promise<AlertSettings> {
  await ensureAlertsSchema(DB)
  const r = await DB.prepare('SELECT enabled, budget_pace_pct, price_undercut FROM ad_alert_settings WHERE account_id = ?')
    .bind(accountId).first<AlertSettings>().catch(() => null)
  return r || { ...DEFAULTS }
}

export async function saveAlertSettings(DB: D1Database, accountId: number, patch: { enabled?: boolean; budget_pace_pct?: number; price_undercut?: boolean }): Promise<AlertSettings> {
  await ensureAlertsSchema(DB)
  const cur = await getAlertSettings(DB, accountId)
  const next: AlertSettings = {
    enabled: patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : cur.enabled,
    budget_pace_pct: patch.budget_pace_pct !== undefined ? Math.min(100, Math.max(50, Math.round(patch.budget_pace_pct))) : cur.budget_pace_pct,
    price_undercut: patch.price_undercut !== undefined ? (patch.price_undercut ? 1 : 0) : cur.price_undercut,
  }
  await DB.prepare(`INSERT INTO ad_alert_settings (account_id, enabled, budget_pace_pct, price_undercut, updated_at)
    VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(account_id) DO UPDATE SET enabled = excluded.enabled, budget_pace_pct = excluded.budget_pace_pct, price_undercut = excluded.price_undercut, updated_at = datetime('now')`)
    .bind(accountId, next.enabled, next.budget_pace_pct, next.price_undercut).run().catch(() => null)
  return next
}

export interface AlertItem { kind: 'budget' | 'price'; title: string; detail: string }

/** 현재 임계 초과 항목 계산(발송 X) — 미리보기 + cron 공용. */
export async function computeAlerts(env: Env, accountId: number, settings: AlertSettings): Promise<AlertItem[]> {
  const items: AlertItem[] = []
  // 예산 소진 임박 — 검색광고 연결 있을 때만.
  try {
    const creds = await loadSearchAdConnection(env.DB, accountId, env.DATA_ENCRYPTION_KEY).catch(() => null)
    if (creds) {
      const p = await budgetPacing(creds).catch(() => ({ ok: false as const }))
      if (p.ok && 'campaigns' in p && p.campaigns) {
        for (const c of p.campaigns) {
          if (c.dailyBudget > 0 && Math.round(c.pacePct * 100) >= settings.budget_pace_pct) {
            items.push({ kind: 'budget', title: `예산 소진 임박 · ${c.name}`, detail: `오늘 ${Math.round(c.pacePct * 100)}% 소진 (₩${c.todaySpend.toLocaleString()} / ₩${c.dailyBudget.toLocaleString()})` })
          }
        }
      }
    }
  } catch { /* graceful */ }
  // 최저가 역전 — 내 판매가 > 최저가인 워치.
  if (settings.price_undercut) {
    try {
      const rows = await env.DB.prepare('SELECT query, my_price, last_lowest, last_mall FROM ad_price_watches WHERE seller_id = ? AND my_price IS NOT NULL AND last_lowest IS NOT NULL AND last_lowest > 0 AND my_price > last_lowest')
        .bind(accountId).all<{ query: string; my_price: number; last_lowest: number; last_mall: string | null }>().catch(() => null)
      for (const w of rows?.results || []) {
        items.push({ kind: 'price', title: `최저가 역전 · ${w.query}`, detail: `내 ₩${Number(w.my_price).toLocaleString()} > 최저 ₩${Number(w.last_lowest).toLocaleString()}${w.last_mall ? ` (${w.last_mall})` : ''}` })
      }
    } catch { /* graceful */ }
  }
  return items
}

async function sendAlertEmail(env: Env, to: string, items: AlertItem[]): Promise<void> {
  const lines = items.map(i => `• ${i.title}\n  ${i.detail}`).join('\n\n')
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from: env.RESEND_FROM, to,
      subject: `[유어애즈] 광고 알림 ${items.length}건`,
      text: `유어애즈 임계값 알림\n\n${lines}\n\n대시보드에서 확인: https://live.ur-team.com/ads/dashboard\n\n— 유어애즈 UR Ads`,
    }),
  })
}

/** cron 엔트리 — 알림 켠 계정들 점검 후 이메일(계정+날짜 멱등 1일 1회). */
export async function runAlertsAll(env: Env, nowMs?: number): Promise<{ accounts: number; sent: number }> {
  await ensureAlertsSchema(env.DB)
  const rows = (await env.DB.prepare('SELECT account_id, enabled, budget_pace_pct, price_undercut FROM ad_alert_settings WHERE enabled = 1 LIMIT 200')
    .all<{ account_id: number } & AlertSettings>().catch(() => null))?.results || []
  const today = new Date(nowMs ?? Date.now()).toISOString().slice(0, 10)
  let sent = 0
  for (const s of rows) {
    const items = await computeAlerts(env, s.account_id, s).catch(() => [] as AlertItem[])
    if (!items.length) continue
    // 멱등: 같은 계정·같은 날 1회만. INSERT OR IGNORE 의 changes 로 winner 판정.
    const ins = await env.DB.prepare('INSERT OR IGNORE INTO ad_alert_sent (account_id, dedup_key, sent_date) VALUES (?, ?, ?)')
      .bind(s.account_id, 'daily', today).run().catch(() => null)
    if (!ins || ins.meta?.changes === 0) continue
    if (env.RESEND_API_KEY && env.RESEND_FROM) {
      const acc = await getAdsAccount(env.DB, s.account_id).catch(() => null)
      if (acc?.email) await sendAlertEmail(env, acc.email, items).catch(() => { /* 발송 실패는 다음날 재시도 — 이미 멱등 기록됨이라 같은날 재발송 안 함(허용) */ })
    }
    sent++
  }
  return { accounts: rows.length, sent }
}
