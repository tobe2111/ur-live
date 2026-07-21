/**
 * 🌐 유통스타트(도매/수출) — 해외 수출 바이어 발굴/자격심사/매칭 (2026-07-20).
 *   대표 확정: ① **최대한 무료**(유료 provider 없음 — 공개 피드/무료 오픈API 만) ② **유어딜과 무관**
 *   (소비자 유어딜/유어애즈 코드·워커에서 완전 분리 — 이 모듈은 features/supply 자립, 외부 의존 0).
 *
 *   인플루언서 엔진과 결이 다르다 — 영입 깔때기가 아니라 **매칭·자격심사 파이프라인**(소수 고가치 B2B):
 *     ① 의도 티어링 — RFQ/구매리드/수입실적(강) > 전시회 > 디렉토리(약). 강한 구매 신호 우선.
 *     ② 행동 증거 — imports_from_korea(실제 한국 수입 여부)·target_market·est_volume.
 *     ③ 회사 → 구매담당자(MD) 2단 컨택.
 *     ④ 매칭 스코어(0~100) — 우리 타깃(수출카테고리×시장)과의 적합도. 타깃 테이블이 SSOT(자기완결).
 *     ⑤ BD 파이프라인 — lead→qualified→sampling→negotiating→won/lost.
 *
 *   소스(전부 무료): `BUYER_FEED_URLS`(쉼표구분) — 대표가 **합법 수집분**(KOTRA BuyKorea 바이어
 *   인콰이어리·TradeKorea 구매리드·전시회 공개명단·정부 무역 오픈데이터[data.go.kr, 무료 serviceKey])을
 *   JSON 으로 게시/직결하면 코드변경 0 편입. 임의 스크래핑 안 함(수집 근거를 대표가 통제).
 *
 *   ⚠️ [LEGAL] 공개된 *비즈니스* 컨택만. 콜드 아웃리치는 GDPR·CAN-SPAM·CASL 별도 — 수집 ≠ 발송.
 *   게이트: env `BUYER_AUTO_COLLECT_ENABLED === 'true'`(미설정=no-op). 설계: docs/design/overseas-buyer-collection.md
 */
import type { Env } from '@/worker/types/env'

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

/** BD 파이프라인 — 자격심사·샘플·협상 단계. */
export const BUYER_STAGES = ['lead', 'qualified', 'sampling', 'negotiating', 'won', 'lost', 'hold']

export interface BuyerLead {
  source: string
  intent_signal: string
  company: string
  country: string | null
  target_market: string | null
  category: string | null
  imports_from_korea: number | null
  website: string | null
  email: string | null
  phone: string | null
  decision_maker: string | null
  decision_maker_title: string | null
  decision_maker_email: string | null
  est_volume: string | null
  description: string
  source_keyword: string | null
}

/* ── 컨택 추출(자립 — 유어애즈 의존 제거, 인라인) ───────────────────────────── */

const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/g
const NOT_EMAIL_SUFFIX = /\.(png|jpg|jpeg|gif|webp|svg|mp4|webm)$/i
const BIZ_CONTEXT_RE = /(구매|수입|바이어|문의|담당|business|inquir|contact|purchas|import|sourcing|procurement|이메일|메일)/i
const NON_OWNER_EMAIL_RE = /^(no-?reply|noreply|support|help|admin|webmaster|cs|care|hello|team)@/i

/** 공개 텍스트에서 회사 컨택 이메일 1개 선택(문맥 가점) — 순수함수. */
export function pickBusinessEmail(text: string): string | null {
  const t = String(text || '')
  const raw = Array.from(new Set((t.match(EMAIL_RE) || []).map(e => e.trim().toLowerCase()).filter(e => e && !NOT_EMAIL_SUFFIX.test(e)))).slice(0, 12)
  if (!raw.length) return null
  const lower = t.toLowerCase()
  let best: string | null = null, bestScore = -Infinity, bestIdx = Infinity
  for (const email of raw) {
    const idx = lower.indexOf(email)
    const around = idx >= 0 ? t.slice(Math.max(0, idx - 40), idx + email.length + 10) : ''
    let score = 0
    if (BIZ_CONTEXT_RE.test(around)) score += 3
    if (NON_OWNER_EMAIL_RE.test(email)) score -= 2
    if (score > bestScore || (score === bestScore && idx < bestIdx)) { best = email; bestScore = score; bestIdx = idx }
  }
  return best
}

const PHONE_RE = /(?:\+?\d[\d\s().\-]{7,}\d)/g
export function pickPhone(text: string): string | null {
  const t = String(text || '')
  const cands = (t.match(PHONE_RE) || []).map(s => s.trim()).filter(s => { const d = s.replace(/\D/g, ''); return d.length >= 8 && d.length <= 15 })
  if (!cands.length) return null
  cands.sort((a, b) => b.replace(/\D/g, '').length - a.replace(/\D/g, '').length)
  return cands[0].slice(0, 32)
}

/* ── 매칭 스코어(순수함수) ───────────────────────────────────────────────── */

export interface ActiveTarget { category: string; country: string }

export function scoreBuyerFit(lead: Pick<BuyerLead, 'intent_signal' | 'category' | 'country' | 'target_market' | 'imports_from_korea' | 'decision_maker_email'>, targets: ActiveTarget[]): number {
  let s = INTENT_TIERS[lead.intent_signal]?.weight ?? INTENT_TIERS.directory.weight
  const cat = (lead.category || '').toLowerCase()
  const markets = [lead.target_market, lead.country].filter(Boolean).map(m => String(m).toLowerCase())
  if (targets.some(t => t.category.toLowerCase() === cat && markets.includes(t.country.toLowerCase()))) s += 25
  if (lead.imports_from_korea === 1) s += 20
  if (lead.decision_maker_email) s += 10
  return Math.max(0, Math.min(100, Math.round(s)))
}

/* ── 정규화 ─────────────────────────────────────────────────────────────── */

export function normalizeCompanyKey(company: string, country?: string | null): string {
  const base = String(company || '').toLowerCase()
    .replace(/\b(co\.?,?\s*ltd\.?|ltd\.?|inc\.?|llc|corp\.?|corporation|gmbh|s\.?a\.?|pvt\.?|company|limited|trading|import(?:s|er|ers)?|distribution|distributor)\b/g, '')
    .replace(/[^a-z0-9가-힣]/g, '').trim()
  const c = String(country || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
  return `${base}|${c}`.slice(0, 160)
}

/* ── 스키마 (격리 테이블) ─────────────────────────────────────────────────── */

const _schemaDone = new WeakSet<object>()
export async function ensureBuyerSchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS overseas_buyer_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_key TEXT NOT NULL,
    source TEXT NOT NULL DEFAULT 'feed',
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
}

export interface BuyerTarget { id: number; category: string; country: string; keyword: string | null; active: number; hits: number; source: string; found_total: number; saved_total: number; last_run_at: string | null; created_at: string }

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
    DB.prepare("INSERT OR IGNORE INTO buyer_discovery_targets (category, country, active, source) VALUES (?, ?, 1, 'seed')").bind(cat, ctry)))
  await DB.batch(stmts).catch(() => null)
}

export async function listBuyerTargets(DB: D1Database): Promise<BuyerTarget[]> {
  await ensureBuyerTargets(DB)
  const r = await DB.prepare('SELECT id, category, country, keyword, active, hits, source, found_total, saved_total, last_run_at, created_at FROM buyer_discovery_targets ORDER BY active DESC, saved_total DESC, id ASC LIMIT 1000').all<BuyerTarget>().catch(() => null)
  return r?.results || []
}

export async function addBuyerTarget(DB: D1Database, category: string, country: string, keyword?: string): Promise<{ ok: boolean; error?: string }> {
  const cat = (category || '').trim().slice(0, 40), ctry = (country || '').trim().slice(0, 40)
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

/* ── 저장(멱등 upsert — 빈 컨택/담당자만 백필, 더 높은 score 만) ─────────────────── */

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

/* ── 무료 피드/오픈API 어댑터(유일 소스 — 유료 provider 없음) ─────────────────────── */

export interface FetchBudget { left: number }

const truthy = (v: unknown): number | null => {
  if (v === true || v === 1 || v === '1') return 1
  if (v === false || v === 0 || v === '0') return 0
  const s = String(v ?? '').toLowerCase()
  if (['yes', 'y', 'true', 'korea', 'kr'].includes(s)) return 1
  return null
}

/** 응답에서 항목 배열을 찾는다 — 최상위 배열 / data|items|list|results / data.go.kr response.body.items 형태. */
function digArray(root: unknown): Record<string, unknown>[] {
  if (Array.isArray(root)) return root as Record<string, unknown>[]
  if (root && typeof root === 'object') {
    const o = root as Record<string, unknown>
    for (const k of ['data', 'items', 'list', 'results', 'rows', 'buyers']) if (Array.isArray(o[k])) return o[k] as Record<string, unknown>[]
    // data.go.kr 표준: { response: { body: { items: [...] | { item: [...] } } } }
    const body = (o.response as Record<string, unknown>)?.['body'] as Record<string, unknown> | undefined
    const items = body?.['items']
    if (Array.isArray(items)) return items as Record<string, unknown>[]
    if (items && typeof items === 'object' && Array.isArray((items as Record<string, unknown>).item)) return (items as Record<string, unknown>).item as Record<string, unknown>[]
    // 마지막 폴백: 첫 배열-값 속성.
    for (const v of Object.values(o)) if (Array.isArray(v)) return v as Record<string, unknown>[]
  }
  return []
}

/**
 * 무료 피드/오픈API — `BUYER_FEED_URLS`(쉼표구분)의 각 URL 을 fetch(JSON 배열/NDJSON/오픈API 응답).
 *   대표가 무료 소스(KOTRA/TradeKorea/전시회/data.go.kr 무료 serviceKey URL)를 그대로 등록하면 편입.
 *   각 항목이 intent 를 명시하면 그 티어로, 미명시면 directory. 담당자/수입이력 필드도 흡수.
 */
export async function fetchFeeds(env: Env, budget: FetchBudget, target: { category: string; country: string }): Promise<BuyerLead[]> {
  const urls = (env.BUYER_FEED_URLS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!urls.length) return []
  // 무료 API 키 헤더(ITA api.trade.gov 의 subscription-key 등) — "이름: 값; 이름2: 값2" 파싱.
  const headers: Record<string, string> = { accept: 'application/json,application/x-ndjson,text/plain' }
  for (const pair of (env.BUYER_FEED_HEADER || '').split(';').map(s => s.trim()).filter(Boolean)) {
    const idx = pair.indexOf(':')
    if (idx > 0) headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim()
  }
  const out: BuyerLead[] = []
  for (const url of urls) {
    if (budget.left <= 0) break
    budget.left -= 1
    const text = await fetch(url, { headers })
      .then(r => (r.ok ? r.text() : '')).catch(() => '')
    if (!text) continue
    let items: Record<string, unknown>[] = []
    const trimmed = text.trim()
    try {
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) items = digArray(JSON.parse(trimmed))
      else items = trimmed.split('\n').map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l))
    } catch { items = [] }
    for (const it of items.slice(0, 500)) {
      // 회사명 — 일반 피드는 company/name, 미국 ITA Trade Leads 는 title(입찰/기관명)이 회사 자리.
      const company = String(it.company || it.name || it.company_name || it.corpNm || it.buyerNm || it.title || '').trim()
      if (!company) continue
      const description = String(it.description || it.inquiry || it.note || it.product || it.item || '')
      let email = it.email ? String(it.email) : null
      if (!email && description) email = pickBusinessEmail(description)
      // intent — 항목이 명시하면 그 값. 없고 입찰/계약 날짜(ITA 조달리드 신호)가 있으면 buying_lead, 아니면 directory.
      const intent = INTENT_KEYS.includes(String(it.intent)) ? String(it.intent)
        : (it.tender_start_date || it.tender_end_date || it.contract_start_date) ? 'buying_lead' : 'directory'
      out.push({
        source: 'feed', intent_signal: intent, company: company.slice(0, 200),
        country: it.country ? String(it.country) : (it.country_code ? String(it.country_code) : target.country),
        target_market: it.target_market ? String(it.target_market) : null,
        category: it.category ? String(it.category) : target.category,
        imports_from_korea: truthy(it.imports_from_korea ?? it.imports_korea),
        website: it.website ? String(it.website) : (it.homepage ? String(it.homepage) : (it.url ? String(it.url) : null)),
        email, phone: it.phone ? String(it.phone) : (it.tel ? String(it.tel) : (description ? pickPhone(description) : null)),
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

/* ── 붙여넣기 일괄 파싱(buyKorea 바이어 목록 복붙 → 리드) ───────────────────────── */

// 열 이름 별칭 → 표준 필드(한/영, 소문자 비교). buyKorea/엑셀/시트 복붙 헤더를 유연 매핑.
const COL_ALIAS: Record<string, string> = {
  company: 'company', 회사: 'company', 회사명: 'company', buyer: 'company', name: 'company', company_name: 'company', 바이어: 'company',
  country: 'country', 국가: 'country', 국가명: 'country',
  category: 'category', 카테고리: 'category', 품목: 'category', product: 'category', item: 'category',
  target_market: 'target_market', market: 'target_market', 시장: 'target_market',
  intent: 'intent', 의도: 'intent',
  imports_from_korea: 'imports_from_korea', korea: 'imports_from_korea', 수입이력: 'imports_from_korea', 한국수입: 'imports_from_korea',
  email: 'email', 이메일: 'email', 'e-mail': 'email',
  phone: 'phone', tel: 'phone', 전화: 'phone', 연락처: 'phone',
  contact: 'decision_maker', contact_name: 'decision_maker', 담당자: 'decision_maker', decision_maker: 'decision_maker', 담당자명: 'decision_maker',
  title: 'decision_maker_title', 직책: 'decision_maker_title', position: 'decision_maker_title',
  contact_email: 'decision_maker_email', 담당자이메일: 'decision_maker_email',
  website: 'website', url: 'website', 홈페이지: 'website', homepage: 'website', link: 'website', linkedin: 'website',
  volume: 'est_volume', 물량: 'est_volume', 규모: 'est_volume', est_volume: 'est_volume',
  description: 'description', note: 'description', memo: 'description', 메모: 'description', 요청: 'description', 요청사항: 'description', inquiry: 'description',
}

/** 탭/쉼표 구분 복붙 텍스트를 리드로 파싱(첫 줄=헤더). 순수함수 — 회사명 없는 행 skip, 최대 500. */
export function parseBulkBuyers(text: string): BuyerLead[] {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const delim = lines[0].includes('\t') ? '\t' : ','
  const split = (line: string) => line.split(delim).map(c => c.trim().replace(/^"|"$/g, ''))
  const header = split(lines[0]).map(h => COL_ALIAS[h.toLowerCase()] || '')
  if (!header.includes('company')) return []
  const out: BuyerLead[] = []
  for (const line of lines.slice(1, 501)) {
    const cells = split(line)
    const row: Record<string, string> = {}
    header.forEach((f, i) => { if (f && cells[i] != null) row[f] = cells[i] })
    const company = (row.company || '').trim()
    if (company.length < 2) continue
    const ik = (row.imports_from_korea || '').toLowerCase()
    const intent = INTENT_KEYS.includes(row.intent) ? row.intent : 'buying_lead'
    out.push({
      source: 'buykorea', intent_signal: intent, company: company.slice(0, 200),
      country: row.country || null, target_market: row.target_market || null, category: row.category || null,
      imports_from_korea: ['1', 'y', 'yes', 'true', 'o', '수입', 'korea'].includes(ik) ? 1 : (ik ? 0 : null),
      website: row.website || null, email: row.email || null, phone: row.phone || null,
      decision_maker: row.decision_maker || null, decision_maker_title: row.decision_maker_title || null,
      decision_maker_email: row.decision_maker_email || null, est_volume: row.est_volume || null,
      description: (row.description || '').slice(0, 800), source_keyword: 'buykorea-paste',
    })
  }
  return out
}

/* ── 오케스트레이터 ─────────────────────────────────────────────────────────── */

export interface BuyerCollectResult { ran: boolean; reason?: string; saved: number; found: number; targets: string[]; diag: { feed: number } }

export async function runBuyerCollection(env: Env, opts: { force?: boolean } = {}): Promise<BuyerCollectResult> {
  const DB = env.DB
  const empty: BuyerCollectResult = { ran: false, saved: 0, found: 0, targets: [], diag: { feed: 0 } }
  if (!opts.force && env.BUYER_AUTO_COLLECT_ENABLED !== 'true') return { ...empty, reason: 'DISABLED' }
  await ensureBuyerSchema(DB); await ensureBuyerTargets(DB)

  const batch = Math.min(10, Math.max(1, parseInt(env.BUYER_AUTOCOLLECT_BATCH || '3', 10) || 3))
  const budget: FetchBudget = { left: Math.max(5, parseInt(env.BUYER_SUBREQUEST_BUDGET || '60', 10) || 60) }

  const cursorRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'buyer_collect_cursor'").first<{ value: string }>().catch(() => null)
  let cursor = parseInt(cursorRow?.value || '0', 10) || 0
  const active = (await DB.prepare('SELECT id, category, country FROM buyer_discovery_targets WHERE active = 1 ORDER BY id ASC')
    .all<{ id: number; category: string; country: string }>().catch(() => null))?.results || []
  if (!active.length) return { ...empty, ran: true, reason: 'NO_TARGETS' }
  const activeKeys: ActiveTarget[] = active.map(t => ({ category: t.category, country: t.country }))

  let saved = 0, found = 0, feed = 0
  const picked: string[] = []
  for (let i = 0; i < batch; i++) {
    if (budget.left <= 0) break
    const t = active[(cursor + i) % active.length]
    picked.push(`${t.category} · ${t.country}`)
    const leads = await fetchFeeds(env, budget, t).catch(() => [])
    feed += leads.length; found += leads.length
    const s = await saveBuyerLeads(DB, leads, activeKeys).catch(() => 0); saved += s
    await DB.prepare("UPDATE buyer_discovery_targets SET hits = hits + 1, found_total = found_total + ?, saved_total = saved_total + ?, last_run_at = datetime('now') WHERE id = ?")
      .bind(leads.length, s, t.id).run().catch(() => null)
  }
  cursor = (cursor + batch) % active.length
  await DB.prepare("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('buyer_collect_cursor', ?)").bind(String(cursor)).run().catch(() => null)

  return { ran: true, saved, found, targets: picked, diag: { feed } }
}
