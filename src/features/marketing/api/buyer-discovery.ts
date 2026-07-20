/**
 * 🌐 유통스타트 — 해외 수출 바이어 발굴/자격심사/매칭 (2026-07-20, 대표 "인플루언서랑 바이어는 결이 다르다").
 *
 *   ❗ 인플루언서 엔진(영입 깔때기 — 많이 긁어 큐레이션)과 **성격이 다르다**. 바이어는 소수 고가치 B2B 관계:
 *   "의도 있는 회사를 **자격심사**해서 우리 수출품과 **매칭**"하는 파이프라인. 그래서 이 엔진의 축은:
 *     ① 의도 티어링 — RFQ/구매리드/수입실적(강) > 전시회 참가사 > 단순 디렉토리(약). 강한 신호 우선.
 *     ② 자격/행동 증거 — imports_from_korea(실제 한국 수입 여부)·target_market·est_volume.
 *     ③ 회사 → 구매담당자(MD) **2단** 컨택(회사 발견 후 담당자 enrichment).
 *     ④ 매칭 스코어 — 우리 발굴 타깃(미는 카테고리×시장)과의 적합도(0~100). 타깃 테이블이 "무엇을 어디로
 *        수출하려는가"의 SSOT 라 별도 카탈로그 없이 자기완결.
 *     ⑤ BD 파이프라인 — lead→qualified→sampling→negotiating→won/lost (단순 '수집 상태'가 아님).
 *
 *   ⚠️ [LEGAL] 공개된 *비즈니스* 컨택만(개인정보 최소화). 콜드 아웃리치는 GDPR·CAN-SPAM·CASL 별도
 *   — 수집 ≠ 발송. 게이트: env `BUYER_AUTO_COLLECT_ENABLED === 'true'`(미설정=no-op).
 *   설계 SSOT: docs/design/overseas-buyer-collection.md
 */
import type { Env } from '@/worker/types/env'
import { extractContacts, pickBusinessEmail } from './influencer-discovery'

export const BUYER_POOL_ID = 0

/** 의도 신호 티어 — 바이어가 얼마나 강하게 "사고 싶다"를 드러냈는가(매칭 스코어 기저). */
export const INTENT_TIERS: Record<string, { label: string; weight: number }> = {
  rfq: { label: 'RFQ(견적요청)', weight: 50 },
  buying_lead: { label: '구매 리드/인콰이어리', weight: 48 },
  import_record: { label: '수입 실적(거래데이터)', weight: 45 },
  exhibitor: { label: '전시회 참가/방문', weight: 30 },
  enriched: { label: '담당자 보강', weight: 20 },
  directory: { label: '디렉토리 등재', weight: 15 },
}
const INTENT_KEYS = Object.keys(INTENT_TIERS)

/** BD 파이프라인 — 자격심사·샘플·협상 단계(인플루언서의 '컨택/관심'과 다른 트레이드 결). */
export const BUYER_STAGES = ['lead', 'qualified', 'sampling', 'negotiating', 'won', 'lost', 'hold']

export interface BuyerLead {
  source: string            // 어댑터 출처: 'directory' | 'apollo' | 수기 등
  intent_signal: string     // INTENT_TIERS 키 — 의도 강도
  company: string
  country: string | null    // 회사 소재국
  target_market: string | null // 바이어가 판매하는 시장(소재국과 다를 수 있음 — 예: 두바이 상사→GCC 전역)
  category: string | null   // 우리 수출 카테고리(그들이 취급할)
  imports_from_korea: number | null // 1=한국 수입 이력 확인(행동 증거) / 0=아님 / null=미상
  website: string | null
  email: string | null      // 회사 대표 컨택
  phone: string | null
  decision_maker: string | null       // 구매담당자/MD 이름
  decision_maker_title: string | null  // 직책
  decision_maker_email: string | null  // 담당자 직통(2단 enrichment)
  est_volume: string | null // 추정 규모/연간 물량(텍스트)
  description: string
  source_keyword: string | null
}

/* ── 매칭 스코어(순수함수 — 단위테스트 잠금 후보) ─────────────────────────────── */

export interface ActiveTarget { category: string; country: string }

/**
 * 바이어 적합도(0~100) = 의도 티어 가중 + 우리 타깃 부합 + 행동 증거 + 담당자 확보.
 *   타깃 부합 = 바이어의 (카테고리 × 시장/소재국)이 우리 활성 타깃에 있는가(= 실제 밀고 싶은 조합).
 */
export function scoreBuyerFit(lead: Pick<BuyerLead, 'intent_signal' | 'category' | 'country' | 'target_market' | 'imports_from_korea' | 'decision_maker_email'>, targets: ActiveTarget[]): number {
  let s = INTENT_TIERS[lead.intent_signal]?.weight ?? INTENT_TIERS.directory.weight
  const cat = (lead.category || '').toLowerCase()
  const markets = [lead.target_market, lead.country].filter(Boolean).map(m => String(m).toLowerCase())
  const matched = targets.some(t => t.category.toLowerCase() === cat && markets.includes(t.country.toLowerCase()))
  if (matched) s += 25
  if (lead.imports_from_korea === 1) s += 20
  if (lead.decision_maker_email) s += 10
  return Math.max(0, Math.min(100, Math.round(s)))
}

/* ── 정규화 ─────────────────────────────────────────────────────────────── */

export function normalizeCompanyKey(company: string, country?: string | null): string {
  const base = String(company || '')
    .toLowerCase()
    .replace(/\b(co\.?,?\s*ltd\.?|ltd\.?|inc\.?|llc|corp\.?|corporation|gmbh|s\.?a\.?|pvt\.?|company|limited|trading|import(?:s|er|ers)?|distribution|distributor)\b/g, '')
    .replace(/[^a-z0-9가-힣]/g, '')
    .trim()
  const c = String(country || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
  return `${base}|${c}`.slice(0, 160)
}

const PHONE_RE = /(?:\+?\d[\d\s().\-]{7,}\d)/g
export function pickPhone(text: string): string | null {
  const t = String(text || '')
  const cands = (t.match(PHONE_RE) || []).map(s => s.trim()).filter(s => {
    const d = s.replace(/\D/g, ''); return d.length >= 8 && d.length <= 15
  })
  if (!cands.length) return null
  cands.sort((a, b) => b.replace(/\D/g, '').length - a.replace(/\D/g, '').length)
  return cands[0].slice(0, 32)
}

/* ── 스키마 (격리 테이블) ─────────────────────────────────────────────────── */

const _schemaDone = new WeakSet<object>()
export async function ensureBuyerSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS overseas_buyer_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_key TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'directory',
    intent_signal TEXT NOT NULL DEFAULT 'directory',
    company TEXT NOT NULL,
    country TEXT,
    target_market TEXT,
    category TEXT,
    imports_from_korea INTEGER,
    website TEXT,
    email TEXT,
    phone TEXT,
    decision_maker TEXT,
    decision_maker_title TEXT,
    decision_maker_email TEXT,
    est_volume TEXT,
    match_score INTEGER,
    description TEXT,
    source_keyword TEXT,
    status TEXT NOT NULL DEFAULT 'lead',
    memo TEXT,
    contacted_at DATETIME,
    follow_up_at DATETIME,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(company_key)
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_buyer_leads_score ON overseas_buyer_leads(match_score DESC, id DESC)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_buyer_leads_ctry ON overseas_buyer_leads(country, id)').run().catch(() => null)
  // 구버전(초기 draft) 테이블 대비 컬럼 보강 — 이미 있으면 catch 무시.
  for (const col of ['intent_signal TEXT', 'target_market TEXT', 'imports_from_korea INTEGER', 'decision_maker TEXT', 'decision_maker_title TEXT', 'decision_maker_email TEXT', 'est_volume TEXT', 'match_score INTEGER']) {
    await DB.prepare(`ALTER TABLE overseas_buyer_leads ADD COLUMN ${col}`).run().catch(() => null)
  }
}

export interface BuyerTarget { id: number; category: string; country: string; keyword: string | null; active: number; hits: number; source: string; found_total: number; saved_total: number; last_run_at: string | null; created_at: string }

// 타깃 = 우리 수출 카테고리 × 타깃 시장 — "무엇을 어디로 미는가"의 SSOT(매칭 기준).
const CATEGORY_SEED = ['K-beauty', 'K-food', 'health supplement', 'fashion', 'baby & kids', 'home & living']
const COUNTRY_SEED = ['United States', 'Japan', 'China', 'Vietnam', 'Indonesia', 'Thailand', 'Singapore', 'United Arab Emirates']

const _targetsDone = new WeakSet<object>()
export async function ensureBuyerTargets(DB: D1Database): Promise<void> {
  if (_targetsDone.has(DB)) return
  _targetsDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS buyer_discovery_targets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    country TEXT NOT NULL,
    keyword TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    hits INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL DEFAULT 'seed',
    found_total INTEGER NOT NULL DEFAULT 0,
    saved_total INTEGER NOT NULL DEFAULT 0,
    last_run_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(category, country)
  )`).run().catch(() => null)
  const stmts = CATEGORY_SEED.flatMap(cat => COUNTRY_SEED.map(ctry =>
    DB.prepare("INSERT OR IGNORE INTO buyer_discovery_targets (category, country, active, source) VALUES (?, ?, 1, 'seed')")
      .bind(cat, ctry)))
  await DB.batch(stmts).catch(() => null)
}

export async function listBuyerTargets(DB: D1Database): Promise<BuyerTarget[]> {
  await ensureBuyerTargets(DB)
  const r = await DB.prepare('SELECT id, category, country, keyword, active, hits, source, found_total, saved_total, last_run_at, created_at FROM buyer_discovery_targets ORDER BY active DESC, saved_total DESC, id ASC LIMIT 1000')
    .all<BuyerTarget>().catch(() => null)
  return r?.results || []
}

export async function addBuyerTarget(DB: D1Database, category: string, country: string, keyword?: string): Promise<{ ok: boolean; error?: string }> {
  const cat = (category || '').trim().slice(0, 40)
  const ctry = (country || '').trim().slice(0, 40)
  if (cat.length < 2 || ctry.length < 2) return { ok: false, error: 'INVALID' }
  await ensureBuyerTargets(DB)
  await DB.prepare("INSERT OR IGNORE INTO buyer_discovery_targets (category, country, keyword, active, source) VALUES (?, ?, ?, 1, 'manual')")
    .bind(cat, ctry, (keyword || '').trim().slice(0, 60) || null).run().catch(() => null)
  return { ok: true }
}

export async function setBuyerTargetActive(DB: D1Database, id: number, active: boolean): Promise<{ ok: boolean }> {
  await DB.prepare('UPDATE buyer_discovery_targets SET active = ? WHERE id = ?').bind(active ? 1 : 0, id).run().catch(() => null)
  return { ok: true }
}

async function getActiveTargets(DB: D1Database): Promise<ActiveTarget[]> {
  const r = await DB.prepare('SELECT category, country FROM buyer_discovery_targets WHERE active = 1').all<ActiveTarget>().catch(() => null)
  return r?.results || []
}

/* ── 저장(멱등 upsert — 빈 컨택/담당자만 백필, 수동 큐레이션 불변) ─────────────────── */

export async function saveBuyerLeads(DB: D1Database, leads: BuyerLead[], targets?: ActiveTarget[]): Promise<number> {
  if (!leads.length) return 0
  await ensureBuyerSchema(DB)
  const active = targets ?? await getActiveTargets(DB)
  const sql = `INSERT INTO overseas_buyer_leads
    (company_key, source, intent_signal, company, country, target_market, category, imports_from_korea, website, email, phone, decision_maker, decision_maker_title, decision_maker_email, est_volume, match_score, description, source_keyword)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_key) DO UPDATE SET
      email = COALESCE(overseas_buyer_leads.email, excluded.email),
      phone = COALESCE(overseas_buyer_leads.phone, excluded.phone),
      website = COALESCE(overseas_buyer_leads.website, excluded.website),
      decision_maker = COALESCE(overseas_buyer_leads.decision_maker, excluded.decision_maker),
      decision_maker_title = COALESCE(overseas_buyer_leads.decision_maker_title, excluded.decision_maker_title),
      decision_maker_email = COALESCE(overseas_buyer_leads.decision_maker_email, excluded.decision_maker_email),
      imports_from_korea = COALESCE(overseas_buyer_leads.imports_from_korea, excluded.imports_from_korea),
      match_score = MAX(COALESCE(overseas_buyer_leads.match_score, 0), COALESCE(excluded.match_score, 0))
    WHERE (overseas_buyer_leads.email IS NULL AND excluded.email IS NOT NULL)
       OR (overseas_buyer_leads.decision_maker_email IS NULL AND excluded.decision_maker_email IS NOT NULL)
       OR (overseas_buyer_leads.phone IS NULL AND excluded.phone IS NOT NULL)
       OR (overseas_buyer_leads.website IS NULL AND excluded.website IS NOT NULL)
       OR (overseas_buyer_leads.imports_from_korea IS NULL AND excluded.imports_from_korea IS NOT NULL)
       OR (COALESCE(excluded.match_score,0) > COALESCE(overseas_buyer_leads.match_score,0))`
  let saved = 0
  const CHUNK = 50
  for (let i = 0; i < leads.length; i += CHUNK) {
    const stmts = leads.slice(i, i + CHUNK).map(l => {
      const intent = INTENT_KEYS.includes(l.intent_signal) ? l.intent_signal : 'directory'
      const score = scoreBuyerFit({ ...l, intent_signal: intent }, active)
      return DB.prepare(sql).bind(
        normalizeCompanyKey(l.company, l.country), l.source, intent, l.company.slice(0, 200),
        l.country, l.target_market, l.category, l.imports_from_korea, l.website, l.email, l.phone,
        l.decision_maker, l.decision_maker_title, l.decision_maker_email, l.est_volume, score,
        (l.description || '').slice(0, 800), l.source_keyword,
      )
    })
    const rs = await DB.batch(stmts).catch(() => null)
    if (rs) for (const r of rs) if (r?.meta?.changes === 1) saved++
  }
  return saved
}

export interface BuyerLeadRow {
  id: number; company_key: string; source: string; intent_signal: string; company: string
  country: string | null; target_market: string | null; category: string | null; imports_from_korea: number | null
  website: string | null; email: string | null; phone: string | null
  decision_maker: string | null; decision_maker_title: string | null; decision_maker_email: string | null
  est_volume: string | null; match_score: number | null; description: string | null; source_keyword: string | null
  status: string; memo: string | null; contacted_at: string | null; follow_up_at: string | null; collected_at: string
}

const SELECT_COLS = 'id, company_key, source, intent_signal, company, country, target_market, category, imports_from_korea, website, email, phone, decision_maker, decision_maker_title, decision_maker_email, est_volume, match_score, description, source_keyword, status, memo, contacted_at, follow_up_at, collected_at'

export async function listBuyerLeads(DB: D1Database, filter: { status?: string; country?: string; category?: string; intent?: string; minScore?: number; hasContact?: boolean; q?: string; limit?: number } = {}): Promise<BuyerLeadRow[]> {
  await ensureBuyerSchema(DB)
  const where: string[] = ['1=1']
  const binds: (string | number)[] = []
  if (filter.status && BUYER_STAGES.includes(filter.status)) { where.push('status = ?'); binds.push(filter.status) }
  if (filter.country) { where.push('country = ?'); binds.push(filter.country) }
  if (filter.category) { where.push('category = ?'); binds.push(filter.category) }
  if (filter.intent && INTENT_KEYS.includes(filter.intent)) { where.push('intent_signal = ?'); binds.push(filter.intent) }
  if (typeof filter.minScore === 'number') { where.push('COALESCE(match_score,0) >= ?'); binds.push(filter.minScore) }
  if (filter.hasContact) where.push('(email IS NOT NULL OR decision_maker_email IS NOT NULL OR phone IS NOT NULL)')
  if (filter.q) { where.push('(LOWER(company) LIKE ? OR LOWER(email) LIKE ? OR LOWER(decision_maker) LIKE ?)'); const like = `%${filter.q.toLowerCase()}%`; binds.push(like, like, like) }
  const limit = Math.min(1000, Math.max(1, filter.limit || 500))
  // 매칭 우선 정렬 — 스코어 높은(의도 강·타깃 부합·수입이력) 바이어 먼저.
  const r = await DB.prepare(`SELECT ${SELECT_COLS} FROM overseas_buyer_leads WHERE ${where.join(' AND ')} ORDER BY COALESCE(match_score,0) DESC, collected_at DESC, id DESC LIMIT ?`)
    .bind(...binds, limit).all<BuyerLeadRow>().catch(() => null)
  return r?.results || []
}

export async function updateBuyerLead(DB: D1Database, id: number, patch: { status?: string; memo?: string; follow_up_at?: string | null }): Promise<{ ok: boolean; error?: string }> {
  await ensureBuyerSchema(DB)
  const sets: string[] = []
  const binds: (string | number | null)[] = []
  if (patch.status !== undefined) {
    if (!BUYER_STAGES.includes(patch.status)) return { ok: false, error: '단계 값이 올바르지 않습니다' }
    sets.push('status = ?'); binds.push(patch.status)
    if (['qualified', 'sampling', 'negotiating', 'won'].includes(patch.status)) sets.push("contacted_at = COALESCE(contacted_at, datetime('now'))")
  }
  if (patch.memo !== undefined) { sets.push('memo = ?'); binds.push((patch.memo || '').slice(0, 500) || null) }
  if (patch.follow_up_at !== undefined) {
    const f = patch.follow_up_at
    if (f === null || f === '') sets.push('follow_up_at = NULL')
    else if (/^\d{4}-\d{2}-\d{2}$/.test(f)) { sets.push('follow_up_at = ?'); binds.push(f) }
    else return { ok: false, error: '날짜 형식(YYYY-MM-DD)이 올바르지 않습니다' }
  }
  if (!sets.length) return { ok: false, error: '변경할 항목이 없습니다' }
  const r = await DB.prepare(`UPDATE overseas_buyer_leads SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}

export async function deleteBuyerLead(DB: D1Database, id: number): Promise<{ ok: boolean; error?: string }> {
  await ensureBuyerSchema(DB)
  const r = await DB.prepare('DELETE FROM overseas_buyer_leads WHERE id = ?').bind(id).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}

/** 활성 타깃 변경 후 전체 재스코어(매칭 기준이 바뀌면 기존 풀도 반영). */
export async function rescoreBuyerLeads(DB: D1Database): Promise<number> {
  await ensureBuyerSchema(DB)
  const targets = await getActiveTargets(DB)
  const rows = (await DB.prepare('SELECT id, intent_signal, category, country, target_market, imports_from_korea, decision_maker_email FROM overseas_buyer_leads')
    .all<Pick<BuyerLeadRow, 'id' | 'intent_signal' | 'category' | 'country' | 'target_market' | 'imports_from_korea' | 'decision_maker_email'>>().catch(() => null))?.results || []
  let n = 0
  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const stmts = rows.slice(i, i + CHUNK).map(r => DB.prepare('UPDATE overseas_buyer_leads SET match_score = ? WHERE id = ?').bind(scoreBuyerFit(r, targets), r.id))
    const rs = await DB.batch(stmts).catch(() => null)
    if (rs) n += rs.length
  }
  return n
}

/* ── 어댑터 ───────────────────────────────────────────────────────────────── */

export interface FetchBudget { left: number }

const truthy = (v: unknown): number | null => {
  if (v === true || v === 1 || v === '1') return 1
  if (v === false || v === 0 || v === '0') return 0
  const s = String(v ?? '').toLowerCase()
  if (['yes', 'y', 'true', 'korea', 'kr'].includes(s)) return 1
  return null
}

/**
 * ① 공개 디렉토리/의도 피드 어댑터 — `BUYER_DIRECTORY_URLS`(쉼표구분)의 JSON 배열/NDJSON 을 fetch.
 *   각 항목이 의도 신호를 스스로 명시(item.intent: 'rfq'|'buying_lead'|'import_record'|'exhibitor'|'directory')하면
 *   그대로 티어링. 대표가 **합법 수집분**(KOTRA 바이어 인콰이어리·전시회 명단·거래데이터 export)을 정제해 게시하면
 *   코드변경 0 편입 — 임의 스크래핑 안 함(수집 근거를 대표가 통제). 담당자 필드(contact_name/title/email)도 흡수.
 */
export async function fetchDirectory(env: Env, budget: FetchBudget, target: { category: string; country: string }): Promise<BuyerLead[]> {
  const urls = (env.BUYER_DIRECTORY_URLS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!urls.length) return []
  const out: BuyerLead[] = []
  for (const url of urls) {
    if (budget.left <= 0) break
    budget.left -= 1
    const text = await fetch(url, { headers: { accept: 'application/json,application/x-ndjson,text/plain' } })
      .then(r => (r.ok ? r.text() : '')).catch(() => '')
    if (!text) continue
    let items: Record<string, unknown>[] = []
    const trimmed = text.trim()
    try { items = trimmed.startsWith('[') ? JSON.parse(trimmed) : trimmed.split('\n').map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l)) } catch { items = [] }
    for (const it of items.slice(0, 500)) {
      const company = String(it.company || it.name || it.company_name || '').trim()
      if (!company) continue
      const description = String(it.description || it.inquiry || it.note || it.product || '')
      let email = it.email ? String(it.email) : null
      if (!email && description) email = pickBusinessEmail(description) || extractContacts(description).emails[0] || null
      const intent = INTENT_KEYS.includes(String(it.intent)) ? String(it.intent) : 'directory'
      out.push({
        source: 'directory', intent_signal: intent, company,
        country: it.country ? String(it.country) : target.country,
        target_market: it.target_market ? String(it.target_market) : null,
        category: it.category ? String(it.category) : target.category,
        imports_from_korea: truthy(it.imports_from_korea ?? it.imports_korea),
        website: it.website ? String(it.website) : null,
        email, phone: it.phone ? String(it.phone) : (description ? pickPhone(description) : null),
        decision_maker: it.contact_name ? String(it.contact_name).slice(0, 80) : null,
        decision_maker_title: it.contact_title ? String(it.contact_title).slice(0, 80) : null,
        decision_maker_email: it.contact_email ? String(it.contact_email) : null,
        est_volume: it.est_volume ? String(it.est_volume).slice(0, 60) : null,
        description, source_keyword: `${target.category} · ${target.country}`,
      })
    }
  }
  return out
}

/**
 * ② 유료 provider — 회사 발견(firmographic). `BUYER_PROVIDER_KEY` 없으면 skip. Apollo mixed_companies 예시.
 *   담당자(구매 MD) 2단 enrichment 는 `enrichDecisionMakers`(별도, people search — 건당 크레딧).
 */
export async function fetchProvider(env: Env, budget: FetchBudget, target: { category: string; country: string; keyword?: string | null }): Promise<BuyerLead[]> {
  const key = env.BUYER_PROVIDER_KEY
  if (!key || (env.BUYER_PROVIDER || 'apollo') !== 'apollo') return []
  if (budget.left <= 0) return []
  budget.left -= 1
  const body = { q_organization_keyword_tags: [target.keyword || target.category, 'importer', 'distributor', 'retail buyer'], organization_locations: [target.country], page: 1, per_page: 25 }
  const res = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': key }, body: JSON.stringify(body),
  }).then(r => (r.ok ? r.json() : null)).catch(() => null) as { organizations?: Record<string, unknown>[] } | null
  return (res?.organizations || []).map(o => ({
    source: 'apollo', intent_signal: 'directory', company: String(o.name || '').trim(),
    country: target.country, target_market: null, category: target.category,
    imports_from_korea: null, website: o.website_url ? String(o.website_url) : null,
    email: null, phone: o.phone ? String(o.phone) : null,
    decision_maker: null, decision_maker_title: null, decision_maker_email: null,
    est_volume: o.estimated_num_employees ? `~${o.estimated_num_employees} employees` : null,
    description: String(o.short_description || o.description || ''), source_keyword: `${target.category} · ${target.country}`,
  } as BuyerLead)).filter(l => l.company)
}

/* ── 오케스트레이터 ─────────────────────────────────────────────────────────── */

export interface BuyerCollectResult { ran: boolean; reason?: string; saved: number; found: number; targets: string[]; diag: { directory: number; provider: number } }

/**
 * 🚀 1회 수집 — 게이트 검사 → 타깃 순환(커서) → 어댑터(의도 피드 우선) → 매칭 스코어 → 멱등 저장.
 *   fail-soft. 게이트 OFF(force 아님 + env≠'true')면 `ran:false` 즉시 반환(no-op).
 */
export async function runBuyerCollection(env: Env, opts: { force?: boolean } = {}): Promise<BuyerCollectResult> {
  const DB = env.DB
  const empty: BuyerCollectResult = { ran: false, saved: 0, found: 0, targets: [], diag: { directory: 0, provider: 0 } }
  if (!opts.force && env.BUYER_AUTO_COLLECT_ENABLED !== 'true') return { ...empty, reason: 'DISABLED' }
  await ensureBuyerSchema(DB); await ensureBuyerTargets(DB)

  const batch = Math.min(10, Math.max(1, parseInt(env.BUYER_AUTOCOLLECT_BATCH || '3', 10) || 3))
  const budget: FetchBudget = { left: Math.max(5, parseInt(env.BUYER_SUBREQUEST_BUDGET || '60', 10) || 60) }

  const cursorRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'buyer_collect_cursor'").first<{ value: string }>().catch(() => null)
  let cursor = parseInt(cursorRow?.value || '0', 10) || 0
  const active = (await DB.prepare('SELECT id, category, country, keyword FROM buyer_discovery_targets WHERE active = 1 ORDER BY id ASC')
    .all<{ id: number; category: string; country: string; keyword: string | null }>().catch(() => null))?.results || []
  if (!active.length) return { ...empty, ran: true, reason: 'NO_TARGETS' }
  const activeKeys: ActiveTarget[] = active.map(t => ({ category: t.category, country: t.country }))

  let saved = 0, found = 0, directory = 0, provider = 0
  const picked: string[] = []
  for (let i = 0; i < batch; i++) {
    if (budget.left <= 0) break
    const t = active[(cursor + i) % active.length]
    picked.push(`${t.category} · ${t.country}`)
    const leads: BuyerLead[] = []
    const dir = await fetchDirectory(env, budget, t).catch(() => []); directory += dir.length; leads.push(...dir)
    const prov = await fetchProvider(env, budget, t).catch(() => []); provider += prov.length; leads.push(...prov)
    found += leads.length
    const s = await saveBuyerLeads(DB, leads, activeKeys).catch(() => 0); saved += s
    await DB.prepare("UPDATE buyer_discovery_targets SET hits = hits + 1, found_total = found_total + ?, saved_total = saved_total + ?, last_run_at = datetime('now') WHERE id = ?")
      .bind(leads.length, s, t.id).run().catch(() => null)
  }
  cursor = (cursor + batch) % active.length
  await DB.prepare("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('buyer_collect_cursor', ?)").bind(String(cursor)).run().catch(() => null)

  return { ran: true, saved, found, targets: picked, diag: { directory, provider } }
}
