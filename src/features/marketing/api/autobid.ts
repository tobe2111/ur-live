/**
 * 🆕 2026-06-27 유어애즈 — 자동입찰 자율 엔진(목표순위 → 입찰가 자동조정).
 *   설계: docs/design/urads-boraware-reference.md §1.
 *
 *   ⚠️ 자율 money 루프 — 안전레일 다중:
 *     1) 규칙 기본 OFF(enabled=0) — 사용자가 켜야만 동작.
 *     2) **사용자 설정 max_bid 하드 클램프** — 엔진은 절대 max_bid 초과 입찰 불가(추정가가 폭주해도).
 *     3) 글로벌 킬스위치 env `ADS_AUTOBID_ENABLED` — 'true' 아니면 cron 전체 skip(라이브검증 전 OFF).
 *     4) 변경 로그(ad_autobid_log) — 모든 입찰 변경 추적.
 *     5) 최소 변경폭 threshold — 미세 변동으로 매 주기 PUT 남발 방지.
 */
import { swallow } from '@/worker/utils/swallow'
import type { Env } from '@/worker/types/env'
import { BID_MIN, BID_MAX, estimateBidForPositions, updateKeywordBid, type SearchAdCreds } from './searchad-client'
import { loadSearchAdConnection } from './searchad-connection'

const MIN_STEP = 10            // 현재가와 목표가 차이가 이보다 작으면 변경 안 함(PUT 남발 방지)
const MAX_RULES_PER_RUN = 50   // seller 당 1회 처리 상한
const MAX_SELLERS_PER_RUN = 100

const _schemaDone = new WeakSet<object>()
export async function ensureAutobidSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_autobid_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    keyword_id TEXT NOT NULL,
    adgroup_id TEXT,
    keyword_text TEXT,
    target_rank INTEGER NOT NULL,
    max_bid INTEGER NOT NULL,
    device TEXT NOT NULL DEFAULT 'PC',
    enabled INTEGER NOT NULL DEFAULT 0,
    last_applied_bid INTEGER,
    last_run_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(seller_id, keyword_id)
  )`).run().catch(swallow('autobid:rules'))
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_autobid_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id INTEGER NOT NULL,
    keyword_id TEXT NOT NULL,
    old_bid INTEGER, new_bid INTEGER, target_rank INTEGER, est_bid INTEGER,
    reason TEXT,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(swallow('autobid:log'))
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_autobid_log_seller ON ad_autobid_log(seller_id, created_at)').run().catch(swallow('autobid:logidx'))
}

// ── 순수 결정 로직 (테스트 가능 — 안전 클램프의 핵심) ────────────────────────
export interface BidPlan { bid: number; change: boolean; reason: string }

/** 추정가 + 사용자 max_bid + 현재가 → 적용할 입찰가. **절대 max_bid·BID_MAX 초과 불가.** */
export function planBid(estBid: number, maxBid: number, currentBid: number): BidPlan {
  if (!Number.isFinite(estBid) || estBid <= 0) return { bid: currentBid, change: false, reason: 'no_estimate' }
  const ceiling = Math.min(Math.max(BID_MIN, Math.min(BID_MAX, maxBid)), BID_MAX)
  let target = Math.min(estBid, ceiling)        // 추정가가 ceiling 넘으면 ceiling 으로 캡
  target = Math.max(BID_MIN, Math.round(target)) // 최소 입찰가 보장
  if (Math.abs(target - currentBid) < MIN_STEP) return { bid: currentBid, change: false, reason: 'within_threshold' }
  return { bid: target, change: true, reason: estBid > ceiling ? 'capped_at_max' : 'matched_estimate' }
}

// ── 규칙 CRUD ────────────────────────────────────────────────────────────
export interface AutobidRule {
  keyword_id: string; adgroup_id: string | null; keyword_text: string | null
  target_rank: number; max_bid: number; device: string; enabled: number
  last_applied_bid: number | null; last_run_at: string | null
}

export async function listRules(DB: D1Database, sellerId: number): Promise<AutobidRule[]> {
  await ensureAutobidSchema(DB)
  const r = await DB.prepare(`SELECT keyword_id, adgroup_id, keyword_text, target_rank, max_bid, device, enabled, last_applied_bid, last_run_at
    FROM ad_autobid_rules WHERE seller_id = ? ORDER BY id DESC LIMIT 500`).bind(sellerId).all<AutobidRule>().catch(() => null)
  return r?.results || []
}

export async function upsertRule(DB: D1Database, sellerId: number, rule: { keyword_id: string; adgroup_id?: string; keyword_text?: string; target_rank: number; max_bid: number; device?: string; enabled?: boolean }): Promise<{ ok: boolean; error?: string }> {
  await ensureAutobidSchema(DB)
  const kid = String(rule.keyword_id || '').trim()
  if (!kid) return { ok: false, error: '키워드를 지정해주세요' }
  const rank = Math.round(Number(rule.target_rank))
  if (!Number.isFinite(rank) || rank < 1 || rank > 15) return { ok: false, error: '목표순위는 1~15 사이여야 합니다' }
  const maxBid = Math.round(Number(rule.max_bid))
  if (!Number.isFinite(maxBid) || maxBid < BID_MIN || maxBid > BID_MAX) return { ok: false, error: `최대 입찰가는 ${BID_MIN}~${BID_MAX.toLocaleString()}원 범위여야 합니다` }
  const device = rule.device === 'MOBILE' ? 'MOBILE' : 'PC'
  const enabled = rule.enabled ? 1 : 0
  await DB.prepare(`INSERT INTO ad_autobid_rules (seller_id, keyword_id, adgroup_id, keyword_text, target_rank, max_bid, device, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(seller_id, keyword_id) DO UPDATE SET adgroup_id=excluded.adgroup_id, keyword_text=excluded.keyword_text,
      target_rank=excluded.target_rank, max_bid=excluded.max_bid, device=excluded.device, enabled=excluded.enabled`)
    .bind(sellerId, kid, rule.adgroup_id || null, rule.keyword_text || null, rank, maxBid, device, enabled).run()
  return { ok: true }
}

export async function deleteRule(DB: D1Database, sellerId: number, keywordId: string): Promise<void> {
  await ensureAutobidSchema(DB)
  await DB.prepare('DELETE FROM ad_autobid_rules WHERE seller_id = ? AND keyword_id = ?').bind(sellerId, keywordId).run()
}

export async function recentLog(DB: D1Database, sellerId: number, limit = 30): Promise<Array<{ keyword_id: string; old_bid: number; new_bid: number; target_rank: number; est_bid: number; reason: string; created_at: string }>> {
  await ensureAutobidSchema(DB)
  const r = await DB.prepare(`SELECT keyword_id, old_bid, new_bid, target_rank, est_bid, reason, created_at
    FROM ad_autobid_log WHERE seller_id = ? ORDER BY id DESC LIMIT ?`).bind(sellerId, Math.min(100, limit)).all().catch(() => null)
  return (r?.results || []) as Array<{ keyword_id: string; old_bid: number; new_bid: number; target_rank: number; est_bid: number; reason: string; created_at: string }>
}

// ── 엔진 ─────────────────────────────────────────────────────────────────
export interface RuleRunResult { keyword_id: string; keyword_text: string | null; estBid: number; plan: BidPlan; applied: boolean; error?: string }

/** 한 seller 의 활성 규칙 실행. dryRun=true 면 PUT 안 하고 계획만 반환(미리보기). */
export async function runAutobidForSeller(DB: D1Database, creds: SearchAdCreds, sellerId: number, opts?: { dryRun?: boolean; onlyKeywordId?: string }): Promise<RuleRunResult[]> {
  await ensureAutobidSchema(DB)
  const dryRun = !!opts?.dryRun
  const where = opts?.onlyKeywordId ? 'AND keyword_id = ?' : 'AND enabled = 1'
  const stmt = DB.prepare(`SELECT keyword_id, keyword_text, target_rank, max_bid, device, last_applied_bid
    FROM ad_autobid_rules WHERE seller_id = ? ${where} LIMIT ${MAX_RULES_PER_RUN}`)
  const bound = opts?.onlyKeywordId ? stmt.bind(sellerId, opts.onlyKeywordId) : stmt.bind(sellerId)
  const rules = (await bound.all<{ keyword_id: string; keyword_text: string | null; target_rank: number; max_bid: number; device: string; last_applied_bid: number | null }>().catch(() => null))?.results || []
  const out: RuleRunResult[] = []
  for (const rule of rules) {
    const kwText = rule.keyword_text || ''
    const est = await estimateBidForPositions(creds, kwText, [rule.target_rank], rule.device === 'MOBILE' ? 'MOBILE' : 'PC').catch(() => ({ ok: false as const }))
    const estBid = est.ok && 'estimates' in est ? (est.estimates?.[0]?.bid || 0) : 0
    const current = Number(rule.last_applied_bid) || 0
    const plan = planBid(estBid, rule.max_bid, current)
    let applied = false, error: string | undefined
    if (!dryRun && plan.change) {
      const up = await updateKeywordBid(creds, rule.keyword_id, plan.bid)
      if (up.ok) {
        applied = true
        await DB.prepare(`INSERT INTO ad_autobid_log (seller_id, keyword_id, old_bid, new_bid, target_rank, est_bid, reason) VALUES (?, ?, ?, ?, ?, ?, ?)`)
          .bind(sellerId, rule.keyword_id, current, plan.bid, rule.target_rank, estBid, plan.reason).run().catch(() => null)
        await DB.prepare('UPDATE ad_autobid_rules SET last_applied_bid = ?, last_run_at = datetime(\'now\') WHERE seller_id = ? AND keyword_id = ?')
          .bind(plan.bid, sellerId, rule.keyword_id).run().catch(() => null)
      } else error = up.error
    }
    out.push({ keyword_id: rule.keyword_id, keyword_text: rule.keyword_text, estBid, plan, applied, error })
  }
  return out
}

/** cron 엔트리 — 전체 seller 의 활성 규칙 실행. 글로벌 킬스위치(ADS_AUTOBID_ENABLED) gate. */
export async function runAutobidAll(env: Env): Promise<{ sellers: number; applied: number }> {
  if (env.ADS_AUTOBID_ENABLED !== 'true') return { sellers: 0, applied: 0 } // 킬스위치 OFF
  await ensureAutobidSchema(env.DB)
  const sellers = (await env.DB.prepare(`SELECT DISTINCT seller_id FROM ad_autobid_rules WHERE enabled = 1 LIMIT ${MAX_SELLERS_PER_RUN}`)
    .all<{ seller_id: number }>().catch(() => null))?.results || []
  let applied = 0
  for (const s of sellers) {
    const creds = await loadSearchAdConnection(env.DB, s.seller_id, env.DATA_ENCRYPTION_KEY).catch(() => null)
    if (!creds) continue
    const res = await runAutobidForSeller(env.DB, creds, s.seller_id).catch(() => [] as RuleRunResult[])
    applied += res.filter(r => r.applied).length
  }
  return { sellers: sellers.length, applied }
}
