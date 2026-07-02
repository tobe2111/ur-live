/**
 * 🆕 2026-07-01 유어애즈 — 수익화 엔타이틀먼트(플랜) 뼈대.
 *   설계: docs/design/urads-services-monetization.md §B-3. 대표가 모델/가격 확정 전이므로
 *   **집행은 킬스위치 기본 OFF** — `ADS_BILLING_ENFORCED === 'true'` 일 때만 한도 강제.
 *   OFF(현행)면 전 기능 무제한(byte-동일 동작). 인프라(플랜 저장·한도표·사용량 미터링)만 선행.
 *
 *   - 플랜 저장: ad_entitlements(account_id UNIQUE). 어드민이 지정(/api/admin/ads PATCH), 결제 연동은 후속.
 *   - 한도표: PLAN_LIMITS — 기능별 수량 한도(-1 = 무제한). 가격/한도 숫자는 대표 결정 시 이 표만 수정.
 *   - 사용량: ad_usage_daily(계정×일×기능 카운터) — AI 호출 등 일일 한도용. UNIQUE 멱등 upsert.
 *   - period_end 지나면 free 로 강등(체험/구독 만료).
 */
import type { Env } from '@/worker/types/env'

export type AdsPlan = 'free' | 'starter' | 'pro'

export interface PlanLimits {
  autobid_rules: number      // 자동입찰 규칙 수(계정 총)
  clickguard_sites: number   // 부정클릭 사이트 수
  rank_targets: number       // 쇼핑 순위 추적 키워드 수
  price_watches: number      // 가격 모니터링 워치 수
  ai_per_day: number         // AI 마케터 호출/일
}

/** 한도 SSOT — 숫자만 바꾸면 전 게이트 반영(-1 = 무제한). ⚠️ 집행은 ADS_BILLING_ENFORCED 게이트. */
export const PLAN_LIMITS: Record<AdsPlan, PlanLimits> = {
  free: { autobid_rules: 10, clickguard_sites: 1, rank_targets: 20, price_watches: 10, ai_per_day: 5 },
  starter: { autobid_rules: 100, clickguard_sites: 3, rank_targets: 100, price_watches: 50, ai_per_day: 30 },
  pro: { autobid_rules: -1, clickguard_sites: -1, rank_targets: -1, price_watches: -1, ai_per_day: 200 },
}

const _schemaDone = new WeakSet<object>()
export async function ensureEntitlementSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_entitlements (
    account_id INTEGER PRIMARY KEY,
    plan TEXT NOT NULL DEFAULT 'free',
    period_end DATETIME,
    note TEXT,
    updated_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_usage_daily (
    account_id INTEGER NOT NULL,
    day TEXT NOT NULL,
    feature TEXT NOT NULL,
    count INTEGER NOT NULL DEFAULT 0,
    UNIQUE(account_id, day, feature)
  )`).run().catch(() => null)
}

/** 현재 플랜 — 행 없음/만료(period_end 과거)면 free. */
export async function getPlan(DB: D1Database, accountId: number): Promise<AdsPlan> {
  await ensureEntitlementSchema(DB)
  const row = await DB.prepare("SELECT plan, period_end FROM ad_entitlements WHERE account_id = ?")
    .bind(accountId).first<{ plan: string; period_end: string | null }>().catch(() => null)
  if (!row) return 'free'
  if (row.period_end && new Date(row.period_end).getTime() < Date.now()) return 'free'
  return (row.plan === 'starter' || row.plan === 'pro') ? row.plan : 'free'
}

/** 어드민용 플랜 지정(멱등 upsert). periodEnd: ISO 또는 null(무기한). */
export async function setPlan(DB: D1Database, accountId: number, plan: AdsPlan, periodEnd?: string | null, note?: string): Promise<void> {
  await ensureEntitlementSchema(DB)
  await DB.prepare(`INSERT INTO ad_entitlements (account_id, plan, period_end, note, updated_at) VALUES (?, ?, ?, ?, datetime('now'))
    ON CONFLICT(account_id) DO UPDATE SET plan = excluded.plan, period_end = excluded.period_end, note = excluded.note, updated_at = datetime('now')`)
    .bind(accountId, plan, periodEnd || null, note?.slice(0, 200) || null).run().catch(() => null)
}

const enforced = (env: Env): boolean => (env as unknown as { ADS_BILLING_ENFORCED?: string }).ADS_BILLING_ENFORCED === 'true'

export type CapacityResult = { ok: true } | { ok: false; error: string; limit: number; plan: AdsPlan }

/** 수량 한도 검사 — 집행 OFF(기본)면 항상 ok. currentCount 는 호출측이 이미 아는 값(추가 쿼리 회피). */
export async function checkCapacity(env: Env, accountId: number, feature: keyof PlanLimits, currentCount: number): Promise<CapacityResult> {
  if (!enforced(env)) return { ok: true }
  const plan = await getPlan(env.DB, accountId)
  const limit = PLAN_LIMITS[plan][feature]
  if (limit < 0 || currentCount < limit) return { ok: true }
  return { ok: false, error: `현재 플랜(${plan}) 한도(${limit}개)에 도달했습니다. 업그레이드가 필요합니다.`, limit, plan }
}

/** 일일 사용량 +1 후 한도 검사 — 집행 OFF 면 카운트만 적재(미래 분석용)하고 항상 ok. */
export async function meterDaily(env: Env, accountId: number, feature: keyof PlanLimits): Promise<CapacityResult> {
  await ensureEntitlementSchema(env.DB)
  const day = new Date().toISOString().slice(0, 10)
  await env.DB.prepare(`INSERT INTO ad_usage_daily (account_id, day, feature, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(account_id, day, feature) DO UPDATE SET count = count + 1`)
    .bind(accountId, day, feature).run().catch(() => null)
  if (!enforced(env)) return { ok: true }
  const plan = await getPlan(env.DB, accountId)
  const limit = PLAN_LIMITS[plan][feature]
  if (limit < 0) return { ok: true }
  const row = await env.DB.prepare('SELECT count FROM ad_usage_daily WHERE account_id = ? AND day = ? AND feature = ?')
    .bind(accountId, day, feature).first<{ count: number }>().catch(() => null)
  if ((Number(row?.count) || 0) <= limit) return { ok: true }
  return { ok: false, error: `오늘 사용 한도(${limit}회)에 도달했습니다. 내일 다시 시도하거나 업그레이드해주세요.`, limit, plan }
}
