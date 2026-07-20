/**
 * 🌐 유통스타트 — 해외 수출 바이어 발굴/연락처 수집 (2026-07-20, 대표 A안 확정 "유통스타트 수출 바이어").
 *
 *   유어애즈 인플루언서 엔진(`influencer-discovery.ts` / `influencer-auto-collect.ts`)의 **B2B 아날로그**.
 *   한국 상품(K-뷰티/K-푸드 등)을 사입할 **해외 수입상·유통사·리테일러**를 발굴해 격리 풀
 *   `overseas_buyer_leads` 에 멱등 누적한다. 소비자/도매 트랜잭션 테이블 무접촉(신규 격리 테이블만).
 *
 *   ⚖️ 소스(무료 우선 하이브리드):
 *     ① 공개 디렉토리 어댑터 — 대표가 **합법적으로 수집 가능한 공개 데이터**(KOTRA BuyKorea·TradeKorea
 *        바이어 인콰이어리, 전시회 공개 참가사, 정부 무역 오픈데이터)를 CSV→JSON 으로 정제해 URL 로 게시하면
 *        (`BUYER_DIRECTORY_URLS`) 코드 변경 없이 편입. 각 항목의 공개 소개/설명 텍스트에서 비즈니스 컨택 추출.
 *     ② 유료 provider 어댑터(Apollo 등) — `BUYER_PROVIDER_KEY` 있으면 firmographic 검색으로 자동 편입,
 *        없으면 skip(인플루언서 `INFLUENCER_PROVIDER_KEY` 패턴 동일).
 *
 *   ⚠️ [LEGAL] 수집은 **공개된 비즈니스 컨택**만(개인정보 최소화 — 원시 IP/UA 미저장). 활용(콜드 아웃리치)은
 *   국가별 규제(GDPR·CAN-SPAM·CASL)가 갈리므로 **수집 ≠ 발송** — 이 모듈은 수집·정리까지만 담당한다.
 *
 *   게이트: env `BUYER_AUTO_COLLECT_ENABLED === 'true'`. 미설정이면 전 경로 no-op(머지 = 라이브 영향 0).
 *   설계 SSOT: docs/design/overseas-buyer-collection.md
 */
import type { Env } from '@/worker/types/env'
import { extractContacts, pickBusinessEmail } from './influencer-discovery'

/** 공용 풀 계정 센티넬 — 인플루언서 풀(account_id=0)과 다른 테이블이라 충돌 없음(가독성용 상수). */
export const BUYER_POOL_ID = 0

export interface BuyerLead {
  source: string          // 어댑터 출처: 'directory' | 'apollo' | 수기 등
  company: string         // 회사명(정규화 전 표기)
  country: string | null  // ISO 국가명/코드(예: 'US', 'Japan')
  category: string | null // 취급 품목 카테고리(K-beauty/K-food/…)
  website: string | null
  email: string | null    // 공개 비즈니스 이메일(추출/제공)
  phone: string | null
  contact_name: string | null
  description: string     // 공개 소개/바이어 인콰이어리 텍스트(요약)
  source_keyword: string | null
}

/* ── 정규화 ─────────────────────────────────────────────────────────────── */

/** 회사명 dedup 키 — 소문자·법인 접미사/특수문자 제거(같은 회사 표기 흔들림 흡수). */
export function normalizeCompanyKey(company: string, country?: string | null): string {
  const base = String(company || '')
    .toLowerCase()
    .replace(/\b(co\.?,?\s*ltd\.?|ltd\.?|inc\.?|llc|corp\.?|corporation|gmbh|s\.?a\.?|pvt\.?|company|limited)\b/g, '')
    .replace(/[^a-z0-9가-힣]/g, '')
    .trim()
  const c = String(country || '').toLowerCase().replace(/[^a-z0-9가-힣]/g, '')
  return `${base}|${c}`.slice(0, 160)
}

const PHONE_RE = /(?:\+?\d[\d\s().\-]{7,}\d)/g
/** 공개 텍스트에서 국제전화 형태 후보 1개(가장 그럴듯한 길이) — 순수함수. */
export function pickPhone(text: string): string | null {
  const t = String(text || '')
  const cands = (t.match(PHONE_RE) || []).map(s => s.trim()).filter(s => {
    const digits = s.replace(/\D/g, '')
    return digits.length >= 8 && digits.length <= 15
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
    company TEXT NOT NULL,
    country TEXT,
    category TEXT,
    website TEXT,
    email TEXT,
    phone TEXT,
    contact_name TEXT,
    description TEXT,
    source_keyword TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    memo TEXT,
    contacted_at DATETIME,
    follow_up_at DATETIME,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(company_key)
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_buyer_leads_ctry ON overseas_buyer_leads(country, id)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_buyer_leads_cat ON overseas_buyer_leads(category, id)').run().catch(() => null)
}

export interface BuyerTarget { id: number; category: string; country: string; keyword: string | null; active: number; hits: number; source: string; found_total: number; saved_total: number; last_run_at: string | null; created_at: string }

// 타깃 = 취급 카테고리 × 타깃 국가(선택 키워드). 인플루언서 키워드 테이블의 B2B 판.
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

/* ── 저장(멱등 upsert — 빈 컨택만 백필, 수동 큐레이션 불변) ─────────────────────── */

export async function saveBuyerLeads(DB: D1Database, leads: BuyerLead[]): Promise<number> {
  if (!leads.length) return 0
  await ensureBuyerSchema(DB)
  const sql = `INSERT INTO overseas_buyer_leads
    (company_key, source, company, country, category, website, email, phone, contact_name, description, source_keyword)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(company_key) DO UPDATE SET
      email = COALESCE(overseas_buyer_leads.email, excluded.email),
      phone = COALESCE(overseas_buyer_leads.phone, excluded.phone),
      website = COALESCE(overseas_buyer_leads.website, excluded.website),
      contact_name = COALESCE(overseas_buyer_leads.contact_name, excluded.contact_name)
    WHERE (overseas_buyer_leads.email IS NULL AND excluded.email IS NOT NULL)
       OR (overseas_buyer_leads.phone IS NULL AND excluded.phone IS NOT NULL)
       OR (overseas_buyer_leads.website IS NULL AND excluded.website IS NOT NULL)
       OR (overseas_buyer_leads.contact_name IS NULL AND excluded.contact_name IS NOT NULL)`
  let saved = 0
  const CHUNK = 50
  for (let i = 0; i < leads.length; i += CHUNK) {
    const stmts = leads.slice(i, i + CHUNK).map(l => DB.prepare(sql).bind(
      normalizeCompanyKey(l.company, l.country), l.source, l.company.slice(0, 200),
      l.country, l.category, l.website, l.email, l.phone, l.contact_name,
      (l.description || '').slice(0, 800), l.source_keyword,
    ))
    const rs = await DB.batch(stmts).catch(() => null)
    if (rs) for (const r of rs) if (r?.meta?.changes === 1) saved++
  }
  return saved
}

export interface BuyerLeadRow {
  id: number; company_key: string; source: string; company: string; country: string | null
  category: string | null; website: string | null; email: string | null; phone: string | null
  contact_name: string | null; description: string | null; source_keyword: string | null
  status: string; memo: string | null; contacted_at: string | null; follow_up_at: string | null; collected_at: string
}

const VALID_STATUS = ['new', 'contacted', 'interested', 'negotiating', 'contracted', 'rejected', 'hold']

export async function listBuyerLeads(DB: D1Database, filter: { status?: string; country?: string; category?: string; hasContact?: boolean; q?: string; limit?: number } = {}): Promise<BuyerLeadRow[]> {
  await ensureBuyerSchema(DB)
  const where: string[] = ['1=1']
  const binds: (string | number)[] = []
  if (filter.status && VALID_STATUS.includes(filter.status)) { where.push('status = ?'); binds.push(filter.status) }
  if (filter.country) { where.push('country = ?'); binds.push(filter.country) }
  if (filter.category) { where.push('category = ?'); binds.push(filter.category) }
  if (filter.hasContact) where.push('(email IS NOT NULL OR phone IS NOT NULL)')
  if (filter.q) { where.push('(LOWER(company) LIKE ? OR LOWER(email) LIKE ?)'); const like = `%${filter.q.toLowerCase()}%`; binds.push(like, like) }
  const limit = Math.min(1000, Math.max(1, filter.limit || 500))
  const r = await DB.prepare(`SELECT id, company_key, source, company, country, category, website, email, phone, contact_name, description, source_keyword, status, memo, contacted_at, follow_up_at, collected_at
    FROM overseas_buyer_leads WHERE ${where.join(' AND ')} ORDER BY collected_at DESC, id DESC LIMIT ?`)
    .bind(...binds, limit).all<BuyerLeadRow>().catch(() => null)
  return r?.results || []
}

export async function updateBuyerLead(DB: D1Database, id: number, patch: { status?: string; memo?: string; follow_up_at?: string | null }): Promise<{ ok: boolean; error?: string }> {
  await ensureBuyerSchema(DB)
  const sets: string[] = []
  const binds: (string | number | null)[] = []
  if (patch.status !== undefined) {
    if (!VALID_STATUS.includes(patch.status)) return { ok: false, error: '상태 값이 올바르지 않습니다' }
    sets.push('status = ?'); binds.push(patch.status)
    if (['contacted', 'interested', 'negotiating', 'contracted'].includes(patch.status)) sets.push("contacted_at = COALESCE(contacted_at, datetime('now'))")
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

/* ── 어댑터 ───────────────────────────────────────────────────────────────── */

export interface FetchBudget { left: number }

/** 공개 텍스트/필드에서 컨택 보강 — 제공 필드 우선, 없으면 description 에서 추출. */
function enrichContact(raw: Partial<BuyerLead> & { description?: string }): { email: string | null; phone: string | null } {
  const text = String(raw.description || '')
  let email = raw.email || null
  if (!email && text) {
    const picked = pickBusinessEmail(text)
    email = picked || extractContacts(text).emails[0] || null
  }
  const phone = raw.phone || (text ? pickPhone(text) : null)
  return { email, phone }
}

/**
 * ① 공개 디렉토리 어댑터 — `BUYER_DIRECTORY_URLS`(쉼표구분)의 각 URL 을 fetch.
 *   응답은 JSON 배열([{company,country,category,website,email,phone,contact_name,description}]) 또는
 *   NDJSON(줄당 1객체). 대표가 합법 공개 데이터를 정제해 게시한 파일을 그대로 편입(코드 변경 0).
 *   ⚠️ 이 모듈은 임의 스크래핑을 하지 않는다 — 등록된 정제 파일만 읽음(수집 근거를 대표가 통제).
 */
export async function fetchDirectory(env: Env, budget: FetchBudget, targetCategory?: string, targetCountry?: string): Promise<BuyerLead[]> {
  const urls = (env.BUYER_DIRECTORY_URLS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!urls.length) return []
  const out: BuyerLead[] = []
  for (const url of urls) {
    if (budget.left <= 0) break
    budget.left -= 1
    const text = await fetch(url, { headers: { 'accept': 'application/json,application/x-ndjson,text/plain' } })
      .then(r => (r.ok ? r.text() : '')).catch(() => '')
    if (!text) continue
    let items: Record<string, unknown>[] = []
    const trimmed = text.trim()
    try {
      if (trimmed.startsWith('[')) items = JSON.parse(trimmed)
      else items = trimmed.split('\n').map(l => l.trim()).filter(Boolean).map(l => JSON.parse(l))
    } catch { items = [] }
    for (const it of items.slice(0, 500)) {
      const company = String(it.company || it.name || it.company_name || '').trim()
      if (!company) continue
      const country = (it.country ? String(it.country) : targetCountry || null) as string | null
      const category = (it.category ? String(it.category) : targetCategory || null) as string | null
      const description = String(it.description || it.inquiry || it.note || '')
      const { email, phone } = enrichContact({
        email: it.email ? String(it.email) : null,
        phone: it.phone ? String(it.phone) : null,
        description,
      })
      out.push({
        source: 'directory', company, country, category,
        website: it.website ? String(it.website) : null,
        email, phone,
        contact_name: it.contact_name ? String(it.contact_name).slice(0, 80) : null,
        description, source_keyword: targetCategory && targetCountry ? `${targetCategory} · ${targetCountry}` : null,
      })
    }
  }
  return out
}

/**
 * ② 유료 provider 어댑터(Apollo.io 예시) — `BUYER_PROVIDER_KEY` 있을 때만. 없으면 [] (skip).
 *   firmographic 검색으로 타깃 카테고리(키워드)×국가에 맞는 회사를 조회. 인플루언서 provider 패턴과 동일하게
 *   미설정=자동 비활성. ⚠️ 실제 provider 스키마는 계약 시 확정 — 여기선 가장 흔한 Apollo mixed_companies 형태.
 */
export async function fetchProvider(env: Env, budget: FetchBudget, category: string, country: string): Promise<BuyerLead[]> {
  const key = env.BUYER_PROVIDER_KEY
  if (!key || (env.BUYER_PROVIDER || 'apollo') !== 'apollo') return []
  if (budget.left <= 0) return []
  budget.left -= 1
  const body = {
    q_organization_keyword_tags: [category, 'importer', 'distributor'],
    organization_locations: [country],
    page: 1, per_page: 25,
  }
  const res = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache', 'X-Api-Key': key },
    body: JSON.stringify(body),
  }).then(r => (r.ok ? r.json() : null)).catch(() => null) as { organizations?: Record<string, unknown>[] } | null
  const orgs = res?.organizations || []
  return orgs.map(o => {
    const description = String(o.short_description || o.description || '')
    return {
      source: 'apollo',
      company: String(o.name || '').trim(),
      country,
      category,
      website: o.website_url ? String(o.website_url) : null,
      email: null, // Apollo 회사검색은 개별 이메일 미반환 — enrich 별 API(별도 비용) — 여기선 회사 컨택만.
      phone: o.phone ? String(o.phone) : null,
      contact_name: null,
      description,
      source_keyword: `${category} · ${country}`,
    } as BuyerLead
  }).filter(l => l.company)
}

/* ── 오케스트레이터 ─────────────────────────────────────────────────────────── */

export interface BuyerCollectResult { ran: boolean; reason?: string; saved: number; found: number; targets: string[]; diag: { directory: number; provider: number } }

/**
 * 🚀 1회 수집 실행 — 게이트 검사 → 타깃 순환(커서) → 어댑터 → 멱등 저장 → 타깃 성과 업데이트.
 *   ⚠️ 게이트 OFF(BUYER_AUTO_COLLECT_ENABLED !== 'true')면 `ran:false` 즉시 반환(no-op).
 *   전부 fail-soft — 어댑터/저장 실패가 다른 타깃 수집을 막지 않는다.
 */
export async function runBuyerCollection(env: Env, opts: { force?: boolean } = {}): Promise<BuyerCollectResult> {
  const DB = env.DB
  const empty: BuyerCollectResult = { ran: false, saved: 0, found: 0, targets: [], diag: { directory: 0, provider: 0 } }
  if (!opts.force && env.BUYER_AUTO_COLLECT_ENABLED !== 'true') return { ...empty, reason: 'DISABLED' }
  await ensureBuyerSchema(DB)
  await ensureBuyerTargets(DB)

  const batch = Math.min(10, Math.max(1, parseInt(env.BUYER_AUTOCOLLECT_BATCH || '3', 10) || 3))
  const budget: FetchBudget = { left: Math.max(5, parseInt(env.BUYER_SUBREQUEST_BUDGET || '60', 10) || 60) }

  // 커서 순환(platform_settings 저장) — 활성 타깃을 몇 개씩 돌아가며 소진.
  const cursorRow = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'buyer_collect_cursor'").first<{ value: string }>().catch(() => null)
  let cursor = parseInt(cursorRow?.value || '0', 10) || 0
  const active = (await DB.prepare('SELECT id, category, country, keyword FROM buyer_discovery_targets WHERE active = 1 ORDER BY id ASC')
    .all<{ id: number; category: string; country: string; keyword: string | null }>().catch(() => null))?.results || []
  if (!active.length) return { ...empty, ran: true, reason: 'NO_TARGETS' }

  let saved = 0, found = 0, directory = 0, provider = 0
  const picked: string[] = []
  for (let i = 0; i < batch; i++) {
    if (budget.left <= 0) break
    const t = active[(cursor + i) % active.length]
    picked.push(`${t.category} · ${t.country}`)
    const leads: BuyerLead[] = []
    const dir = await fetchDirectory(env, budget, t.category, t.country).catch(() => [])
    directory += dir.length; leads.push(...dir)
    const prov = await fetchProvider(env, budget, t.keyword || t.category, t.country).catch(() => [])
    provider += prov.length; leads.push(...prov)
    found += leads.length
    const s = await saveBuyerLeads(DB, leads).catch(() => 0)
    saved += s
    await DB.prepare("UPDATE buyer_discovery_targets SET hits = hits + 1, found_total = found_total + ?, saved_total = saved_total + ?, last_run_at = datetime('now') WHERE id = ?")
      .bind(leads.length, s, t.id).run().catch(() => null)
  }
  cursor = (cursor + batch) % active.length
  await DB.prepare("INSERT OR REPLACE INTO platform_settings (key, value) VALUES ('buyer_collect_cursor', ?)").bind(String(cursor)).run().catch(() => null)

  return { ran: true, saved, found, targets: picked, diag: { directory, provider } }
}
