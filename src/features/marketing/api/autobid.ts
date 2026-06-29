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
import { loadSearchAdConnection, loadSearchAdConnectionByTenant } from './searchad-connection'

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
    schedule_json TEXT,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(seller_id, keyword_id)
  )`).run().catch(swallow('autobid:rules'))
  // 기존 테이블에 schedule_json 컬럼 보강(이미 있으면 무해 — 시간대·요일 입찰 전략).
  await DB.prepare("ALTER TABLE ad_autobid_rules ADD COLUMN schedule_json TEXT").run().catch(swallow('autobid:rules-sched'))
  // 🆕 멀티테넌트: 규칙을 고객사(customer_id)별 격리 — 활성 고객사 기준으로만 보이고/실행.
  await DB.prepare("ALTER TABLE ad_autobid_rules ADD COLUMN tenant TEXT").run().catch(swallow('autobid:rules-tenant'))
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

// ── 시간대·요일 입찰 전략 (schedule) ───────────────────────────────────────
//   추정가에 곱하는 가중치(weight)로 시간대/요일별 공격성을 조절. weight=0 → 그 시간 일시정지.
//   ⚠️ 안전: max_bid 하드캡은 planBid 가 그대로 강제 → weight>1 이어도 절대 max_bid·BID_MAX 초과 불가.
const WEIGHT_MIN = 0, WEIGHT_MAX = 2
export function clampWeight(w: number): number { return Math.max(WEIGHT_MIN, Math.min(WEIGHT_MAX, Number(w) || 0)) }

export interface Daypart { days: number[]; start: number; end: number; weight: number; label?: string }
export interface BidSchedule { dayparts: Daypart[]; default_weight?: number }

/** UI/CSV 공용 프리셋. days: 0=일 … 6=토. start/end: 시(0–24, end 미포함, start>end 면 자정 wrap). */
export const SCHEDULE_PRESETS: Record<string, { label: string; schedule: BidSchedule | null }> = {
  always: { label: '항상 동일', schedule: null },
  peak: { label: '피크 강화 · 평일 9–18시 ×1.2', schedule: { dayparts: [{ days: [1, 2, 3, 4, 5], start: 9, end: 18, weight: 1.2, label: '피크' }], default_weight: 1 } },
  closing: { label: '마감 부스트 · 매일 20–24시 ×1.3', schedule: { dayparts: [{ days: [0, 1, 2, 3, 4, 5, 6], start: 20, end: 24, weight: 1.3, label: '마감' }], default_weight: 1 } },
  weekend: { label: '주말 강화 · 토·일 ×1.25', schedule: { dayparts: [{ days: [0, 6], start: 0, end: 24, weight: 1.25, label: '주말' }], default_weight: 1 } },
  night_save: { label: '야간 절약 · 매일 0–7시 ×0.6', schedule: { dayparts: [{ days: [0, 1, 2, 3, 4, 5, 6], start: 0, end: 7, weight: 0.6, label: '야간' }], default_weight: 1 } },
}

/** KST(UTC+9) 요일(0=일)·시각. nowMs=Date.now(). */
export function kstWeekdayHour(nowMs: number): { weekday: number; hour: number } {
  const k = new Date(nowMs + 9 * 3600_000)
  return { weekday: k.getUTCDay(), hour: k.getUTCHours() }
}

/** 현재 KST 요일·시각에 적용할 입찰 가중치. 매칭 daypart 없으면 default_weight(기본 1). 순수 함수(테스트). */
export function scheduleWeight(scheduleJson: string | null | undefined, weekday: number, hour: number): { weight: number; label: string } {
  if (!scheduleJson) return { weight: 1, label: '' }
  let sched: BidSchedule | null = null
  try { sched = JSON.parse(scheduleJson) } catch { return { weight: 1, label: '' } }
  if (!sched || !Array.isArray(sched.dayparts)) return { weight: 1, label: '' }
  for (const dp of sched.dayparts) {
    if (!Array.isArray(dp.days) || !dp.days.includes(weekday)) continue
    const s = Number(dp.start), e = Number(dp.end)
    const inWindow = s <= e ? (hour >= s && hour < e) : (hour >= s || hour < e) // 자정 wrap 지원
    if (inWindow) return { weight: clampWeight(dp.weight), label: dp.label || '' }
  }
  const dw = sched.default_weight == null ? 1 : clampWeight(sched.default_weight)
  return { weight: dw, label: '' }
}

/** schedule 입력(JSON 문자열/객체/프리셋키)을 정규화·검증 → 저장용 문자열 또는 null. */
export function normalizeSchedule(raw: unknown): string | null {
  if (raw == null || raw === '' || raw === 'always') return null
  if (typeof raw === 'string' && raw in SCHEDULE_PRESETS) {
    const p = SCHEDULE_PRESETS[raw].schedule
    return p ? JSON.stringify(p) : null
  }
  let obj: unknown = raw
  if (typeof raw === 'string') { try { obj = JSON.parse(raw) } catch { return null } }
  const o = obj as { dayparts?: unknown; default_weight?: unknown }
  if (!o || !Array.isArray(o.dayparts)) return null
  const dayparts: Daypart[] = []
  for (const item of o.dayparts.slice(0, 12)) {
    const dp = item as Partial<Daypart>
    const days = Array.isArray(dp.days) ? dp.days.map((d) => Math.round(Number(d))).filter((d) => d >= 0 && d <= 6) : []
    const start = Math.round(Number(dp.start)), end = Math.round(Number(dp.end))
    if (!days.length || !Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > 24 || end < 0 || end > 24) continue
    dayparts.push({ days, start, end, weight: clampWeight(dp.weight as number), label: dp.label ? String(dp.label).slice(0, 20) : undefined })
  }
  if (!dayparts.length) return null
  const default_weight = o.default_weight == null ? 1 : clampWeight(o.default_weight as number)
  return JSON.stringify({ dayparts, default_weight })
}

/** CSV 텍스트 → 규칙 행 배열(헤더 자동 스킵). 열: keyword_id,keyword_text,target_rank,max_bid,device,schedule_preset */
export function parseCsvRules(csv: string): Array<{ keyword_id: string; keyword_text?: string; target_rank: number; max_bid: number; device?: string; schedule?: string }> {
  const out: Array<{ keyword_id: string; keyword_text?: string; target_rank: number; max_bid: number; device?: string; schedule?: string }> = []
  const lines = String(csv || '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const line of lines.slice(0, 500)) {
    const cols = line.split(',').map((c) => c.trim())
    if (!cols[0] || cols[0].toLowerCase() === 'keyword_id') continue // 헤더/빈행 스킵
    const target_rank = Math.round(Number(cols[2]))
    const max_bid = Math.round(Number(cols[3]))
    if (!Number.isFinite(target_rank) || !Number.isFinite(max_bid)) continue
    out.push({
      keyword_id: cols[0], keyword_text: cols[1] || undefined, target_rank, max_bid,
      device: cols[4] === 'MOBILE' ? 'MOBILE' : 'PC', schedule: cols[5] || undefined,
    })
  }
  return out
}

// ── 규칙 CRUD ────────────────────────────────────────────────────────────
export interface AutobidRule {
  keyword_id: string; adgroup_id: string | null; keyword_text: string | null
  target_rank: number; max_bid: number; device: string; enabled: number
  last_applied_bid: number | null; last_run_at: string | null; schedule_json: string | null
}

export async function listRules(DB: D1Database, sellerId: number, tenant?: string): Promise<AutobidRule[]> {
  await ensureAutobidSchema(DB)
  // 활성 고객사(tenant)의 규칙만 + 레거시(tenant NULL) 흡수. tenant 미지정이면 전체(하위호환).
  const tClause = tenant ? 'AND (tenant = ? OR tenant IS NULL)' : ''
  const stmt = DB.prepare(`SELECT keyword_id, adgroup_id, keyword_text, target_rank, max_bid, device, enabled, last_applied_bid, last_run_at, schedule_json
    FROM ad_autobid_rules WHERE seller_id = ? ${tClause} ORDER BY id DESC LIMIT 500`)
  const r = await (tenant ? stmt.bind(sellerId, tenant) : stmt.bind(sellerId)).all<AutobidRule>().catch(() => null)
  return r?.results || []
}

export async function upsertRule(DB: D1Database, sellerId: number, rule: { keyword_id: string; adgroup_id?: string; keyword_text?: string; target_rank: number; max_bid: number; device?: string; enabled?: boolean; schedule?: unknown; tenant?: string | null }): Promise<{ ok: boolean; error?: string }> {
  await ensureAutobidSchema(DB)
  const kid = String(rule.keyword_id || '').trim()
  if (!kid) return { ok: false, error: '키워드를 지정해주세요' }
  const rank = Math.round(Number(rule.target_rank))
  if (!Number.isFinite(rank) || rank < 1 || rank > 15) return { ok: false, error: '목표순위는 1~15 사이여야 합니다' }
  const maxBid = Math.round(Number(rule.max_bid))
  if (!Number.isFinite(maxBid) || maxBid < BID_MIN || maxBid > BID_MAX) return { ok: false, error: `최대 입찰가는 ${BID_MIN}~${BID_MAX.toLocaleString()}원 범위여야 합니다` }
  const device = rule.device === 'MOBILE' ? 'MOBILE' : 'PC'
  const enabled = rule.enabled ? 1 : 0
  // schedule 미지정(undefined)=기존 값 유지 / 지정(string|null)=덮어씀('always'→null=항상으로 초기화).
  const provided = rule.schedule === undefined ? 0 : 1
  const scheduleJson = provided ? normalizeSchedule(rule.schedule) : null
  const tenant = rule.tenant ? String(rule.tenant).slice(0, 40) : null // 활성 고객사 격리 키(없으면 NULL=레거시)
  await DB.prepare(`INSERT INTO ad_autobid_rules (seller_id, keyword_id, adgroup_id, keyword_text, target_rank, max_bid, device, enabled, schedule_json, tenant)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(seller_id, keyword_id) DO UPDATE SET adgroup_id=excluded.adgroup_id, keyword_text=excluded.keyword_text,
      target_rank=excluded.target_rank, max_bid=excluded.max_bid, device=excluded.device, enabled=excluded.enabled,
      schedule_json=CASE WHEN ?=1 THEN excluded.schedule_json ELSE ad_autobid_rules.schedule_json END,
      tenant=COALESCE(excluded.tenant, ad_autobid_rules.tenant)`)
    .bind(sellerId, kid, rule.adgroup_id || null, rule.keyword_text || null, rank, maxBid, device, enabled, scheduleJson, tenant, provided).run()
  return { ok: true }
}

/** CSV/배열 일괄 등록. 행마다 upsert. 결과 {count, errors}. cap 200. */
export async function bulkUpsertRules(DB: D1Database, sellerId: number, rows: Array<{ keyword_id: string; keyword_text?: string; target_rank: number; max_bid: number; device?: string; schedule?: unknown; enabled?: boolean }>, tenant?: string | null): Promise<{ count: number; errors: Array<{ keyword_id: string; error: string }> }> {
  await ensureAutobidSchema(DB)
  let count = 0
  const errors: Array<{ keyword_id: string; error: string }> = []
  for (const row of rows.slice(0, 200)) {
    const r = await upsertRule(DB, sellerId, { ...row, tenant }).catch((e) => ({ ok: false as const, error: String((e as Error)?.message || 'fail') }))
    if (r.ok) count++
    else errors.push({ keyword_id: String(row.keyword_id || ''), error: r.error || '실패' })
  }
  return { count, errors }
}

export async function deleteRule(DB: D1Database, sellerId: number, keywordId: string): Promise<void> {
  await ensureAutobidSchema(DB)
  await DB.prepare('DELETE FROM ad_autobid_rules WHERE seller_id = ? AND keyword_id = ?').bind(sellerId, keywordId).run()
}

/** 고객사(tenant) 연결 해제 시 그 고객사의 자동입찰 규칙도 제거 — 재연결 시 옛 규칙이 몰래 부활하지 않도록(돈 안전). */
export async function deleteRulesForTenant(DB: D1Database, sellerId: number, tenant: string): Promise<void> {
  await ensureAutobidSchema(DB)
  await DB.prepare('DELETE FROM ad_autobid_rules WHERE seller_id = ? AND tenant = ?').bind(sellerId, tenant).run().catch(() => null)
}

export async function recentLog(DB: D1Database, sellerId: number, limit = 30): Promise<Array<{ keyword_id: string; old_bid: number; new_bid: number; target_rank: number; est_bid: number; reason: string; created_at: string }>> {
  await ensureAutobidSchema(DB)
  const r = await DB.prepare(`SELECT keyword_id, old_bid, new_bid, target_rank, est_bid, reason, created_at
    FROM ad_autobid_log WHERE seller_id = ? ORDER BY id DESC LIMIT ?`).bind(sellerId, Math.min(100, limit)).all().catch(() => null)
  return (r?.results || []) as Array<{ keyword_id: string; old_bid: number; new_bid: number; target_rank: number; est_bid: number; reason: string; created_at: string }>
}

// ── 엔진 ─────────────────────────────────────────────────────────────────
export interface RuleRunResult { keyword_id: string; keyword_text: string | null; estBid: number; plan: BidPlan; applied: boolean; error?: string }

/** 한 seller 의 활성 규칙 실행. dryRun=true 면 PUT 안 하고 계획만 반환(미리보기).
 *   opts.tenant: 고객사 격리. string=그 고객사 규칙(+inclusive 면 레거시 NULL 흡수), null=레거시만, undefined=전체.
 *   ⚠️ cron 은 strict(정확히 그 tenant)로 호출 → 한 규칙이 두 고객사 계정에 이중 적용되는 일 없음. */
export async function runAutobidForSeller(DB: D1Database, creds: SearchAdCreds, sellerId: number, opts?: { dryRun?: boolean; onlyKeywordId?: string; tenant?: string | null; strict?: boolean }): Promise<RuleRunResult[]> {
  await ensureAutobidSchema(DB)
  const dryRun = !!opts?.dryRun
  const binds: Array<string | number> = [sellerId]
  let where = opts?.onlyKeywordId ? 'AND keyword_id = ?' : 'AND enabled = 1'
  if (opts?.onlyKeywordId) binds.push(opts.onlyKeywordId)
  if (opts && 'tenant' in opts) {
    if (opts.tenant === null) where += ' AND tenant IS NULL'
    else if (typeof opts.tenant === 'string') {
      where += opts.strict ? ' AND tenant = ?' : ' AND (tenant = ? OR tenant IS NULL)'
      binds.push(opts.tenant)
    }
  }
  const rules = (await DB.prepare(`SELECT keyword_id, keyword_text, target_rank, max_bid, device, last_applied_bid, schedule_json
    FROM ad_autobid_rules WHERE seller_id = ? ${where} LIMIT ${MAX_RULES_PER_RUN}`).bind(...binds)
    .all<{ keyword_id: string; keyword_text: string | null; target_rank: number; max_bid: number; device: string; last_applied_bid: number | null; schedule_json: string | null }>().catch(() => null))?.results || []
  const { weekday, hour } = kstWeekdayHour(Date.now()) // 현재 KST 요일·시각(전 규칙 공통)
  const out: RuleRunResult[] = []
  for (const rule of rules) {
    const sw = scheduleWeight(rule.schedule_json, weekday, hour)
    const current = Number(rule.last_applied_bid) || 0
    if (sw.weight === 0) { // 스케줄 일시정지 시간대 → 변경 안 함
      out.push({ keyword_id: rule.keyword_id, keyword_text: rule.keyword_text, estBid: 0, plan: { bid: current, change: false, reason: 'schedule_paused' }, applied: false })
      continue
    }
    const kwText = rule.keyword_text || ''
    const est = await estimateBidForPositions(creds, kwText, [rule.target_rank], rule.device === 'MOBILE' ? 'MOBILE' : 'PC').catch(() => ({ ok: false as const }))
    const estBid = est.ok && 'estimates' in est ? (est.estimates?.[0]?.bid || 0) : 0
    // ⚠️ 스케줄 가중치는 *추정가*에만 곱함 → planBid 의 max_bid 하드캡이 여전히 상한을 강제(초과입찰 불가).
    const weightedEst = estBid > 0 ? estBid * sw.weight : estBid
    const plan = planBid(weightedEst, rule.max_bid, current)
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

/** cron 엔트리 — (seller, tenant=고객사)별 활성 규칙 실행. 글로벌 킬스위치(ADS_AUTOBID_ENABLED) gate.
 *   ⚠️ 멀티테넌트: 각 (seller, tenant) 쌍을 **그 고객사 자격증명**으로 strict 실행 → 규칙이
 *   엉뚱한 고객사 계정에 적용되는 일 없음. tenant NULL(레거시) 은 활성 자격증명으로 실행. */
export async function runAutobidAll(env: Env): Promise<{ sellers: number; applied: number }> {
  if (env.ADS_AUTOBID_ENABLED !== 'true') return { sellers: 0, applied: 0 } // 킬스위치 OFF
  await ensureAutobidSchema(env.DB)
  const pairs = (await env.DB.prepare(`SELECT DISTINCT seller_id, tenant FROM ad_autobid_rules WHERE enabled = 1 LIMIT ${MAX_SELLERS_PER_RUN}`)
    .all<{ seller_id: number; tenant: string | null }>().catch(() => null))?.results || []
  let applied = 0
  for (const p of pairs) {
    const creds = p.tenant
      ? await loadSearchAdConnectionByTenant(env.DB, p.seller_id, p.tenant, env.DATA_ENCRYPTION_KEY).catch(() => null)
      : await loadSearchAdConnection(env.DB, p.seller_id, env.DATA_ENCRYPTION_KEY).catch(() => null)
    if (!creds) continue
    const res = await runAutobidForSeller(env.DB, creds, p.seller_id, { tenant: p.tenant, strict: true }).catch(() => [] as RuleRunResult[])
    applied += res.filter(r => r.applied).length
  }
  return { sellers: pairs.length, applied }
}
