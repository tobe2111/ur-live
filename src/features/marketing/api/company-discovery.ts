/**
 * 🤝 유어애즈 B2B 파트너(업체) 수집 트랙 — 격리 테이블 `ad_company_leads` 스키마 + CRUD (2026-07-21).
 *   목적: 유어딜 매장 입점을 대신 데려올 업체(마케팅 대행사 + 소상공인 접점 업체)의 **공개 연락처 DB**.
 *   인플루언서 트랙과 **같은 결**(영입 깔때기)이지만 **별도 격리 테이블**(한쪽 쿼리가 반대쪽 행 무접촉).
 *
 *   3레인(설계 SSOT docs/design/partner-company-collection.md):
 *     A 자동수집(네이버 지역검색) · B 레지스트리 배치(공정위 정보공개서) · C 수동 큐레이션 — `source` 로 구분.
 *   1단계(이 모듈+어드민): 테이블 + 수동입력 + 아웃리치 상태머신. 수집엔진(레인 A/B)은 후속.
 *
 *   ⚠️ 수집 ≠ 발송 — 공개된 *비즈니스* 연락처만. 자동 발송 경로 부존재(✉는 mailto 초안만).
 */
import type { Env } from '@/worker/types/env'

/* ── 접점 분류 (수집 카테고리 SSOT — 소상공인을 반복·신뢰로 만나는 업체) ───────────── */
//   category(접점 성격) × subcategory(구체 업종). UI 가 이 맵으로 셀렉트를 구성.
export const COMPANY_CATEGORIES: Record<string, string[]> = {
  '매장인프라': ['POS·카드단말기', '테이블오더', '키오스크', 'CCTV·보안', '간판', '인테리어', '주방설비'],
  '정기납품': ['주류도매', '식자재유통', '원두납품', '유제품배송', '배달대행'],
  '전문서비스': ['세무·기장', '노무', '정책자금컨설팅', '상가부동산'],
  '창업생태계': ['창업컨설팅', '상권분석', '창업박람회', '프랜차이즈본사', '소상공인교육'],
  '지역조직': ['상인회', '소상공인연합회', '협동조합', '청년몰', '상권활성화재단', '새마을금고·신협'],
  '미디어': ['지역신문·매거진', '아파트게시판', '체험단·플레이스마케팅'],
  '대행사': ['마케팅대행', '병원·뷰티마케팅'],
}
export const COMPANY_CATEGORY_KEYS = Object.keys(COMPANY_CATEGORIES)

/** 아웃리치 상태머신(인플루언서 트랙과 동일 — B2B 영업 파이프라인). */
export const COMPANY_STATUSES = ['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold']
/** 첫 접촉 채널 — 파트너 업체는 전화·방문 중심. */
export const COMPANY_CONTACT_CHANNELS = ['call', 'email', 'visit', 'sms', 'kakao', 'other']
/** tier 1~5 = 대표 우선순위(어드민 수동 조정). 1=최우선(주류도매·식자재), 5=후순위(프랜차이즈 본사). */
export const COMPANY_TIER_MIN = 1
export const COMPANY_TIER_MAX = 5

export interface CompanyLead {
  company_name: string
  category?: string | null
  subcategory?: string | null
  tier?: number | null
  region?: string | null
  website?: string | null
  email?: string | null
  phone?: string | null
  address?: string | null
  description?: string | null
  source?: string | null        // 'manual' | 'local' | 'webkr' | 'registry'
  source_keyword?: string | null
}

export interface CompanyLeadRow {
  id: number; company_key: string; company_name: string
  category: string | null; subcategory: string | null; tier: number | null; region: string | null
  website: string | null; email: string | null; phone: string | null; address: string | null
  description: string | null; source: string; source_keyword: string | null
  status: string; memo: string | null; contact_channel: string | null
  contacted_at: string | null; follow_up_at: string | null; collected_at: string
}

const SELECT_COLS = 'id, company_key, company_name, category, subcategory, tier, region, website, email, phone, address, description, source, source_keyword, status, memo, contact_channel, contacted_at, follow_up_at, collected_at'

/* ── 스키마 (런타임 보장 — ur-ads 는 CI 마이그레이션 미작동, repair-schema 패턴) ─────── */
const _schemaDone = new WeakSet<object>()
export async function ensureCompanySchema(DB: D1Database): Promise<void> {
  if (_schemaDone.has(DB)) return
  _schemaDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_company_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_key TEXT NOT NULL,
    company_name TEXT NOT NULL,
    category TEXT,
    subcategory TEXT,
    tier INTEGER,
    region TEXT,
    website TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    description TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    source_keyword TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    memo TEXT,
    contact_channel TEXT,
    contacted_at DATETIME,
    follow_up_at DATETIME,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(company_key)
  )`).run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_company_leads_tier ON ad_company_leads(tier, id)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_company_leads_region ON ad_company_leads(region, id)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_company_leads_cat ON ad_company_leads(category, id)').run().catch(() => null)
}

/** 중복 차단 키 — 웹사이트(정규화) 우선, 없으면 회사명|지역(소문자). SQLite NULL-distinct 회피용 결정 키. */
export function companyKey(lead: Pick<CompanyLead, 'company_name' | 'website' | 'region'>): string {
  const web = (lead.website || '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/+$/, '')
  if (web.length >= 4) return `w:${web}`.slice(0, 200)
  const name = (lead.company_name || '').trim().toLowerCase().replace(/\s+/g, '')
  const region = (lead.region || '').trim().toLowerCase().replace(/\s+/g, '')
  return `n:${name}|${region}`.slice(0, 200)
}

/* ── 저장(멱등 upsert — 빈 컨택만 백필, 큐레이션 필드 불변) ────────────────────────── */
export async function saveCompanyLeads(DB: D1Database, leads: CompanyLead[]): Promise<number> {
  if (!leads.length) return 0
  await ensureCompanySchema(DB)
  const clamp = (v: unknown, n: number): string | null => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, n) : null }
  const tierOf = (v: unknown): number | null => { const t = Math.round(Number(v)); return Number.isFinite(t) && t >= COMPANY_TIER_MIN && t <= COMPANY_TIER_MAX ? t : null }
  const rows = leads.map(l => ({ ...l, company_name: (l.company_name || '').trim() })).filter(l => l.company_name.length >= 2)
  if (!rows.length) return 0
  const CHUNK = 50
  let saved = 0
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const stmts = slice.map(l => DB.prepare(
      `INSERT INTO ad_company_leads (company_key, company_name, category, subcategory, tier, region, website, email, phone, address, description, source, source_keyword)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(company_key) DO UPDATE SET
         email = COALESCE(ad_company_leads.email, excluded.email),
         phone = COALESCE(ad_company_leads.phone, excluded.phone),
         website = COALESCE(ad_company_leads.website, excluded.website),
         address = COALESCE(ad_company_leads.address, excluded.address)`
    ).bind(
      companyKey(l), l.company_name.slice(0, 120),
      clamp(l.category, 40), clamp(l.subcategory, 40), tierOf(l.tier), clamp(l.region, 60),
      clamp(l.website, 200), clamp(l.email, 120), clamp(l.phone, 40), clamp(l.address, 300),
      clamp(l.description, 800), clamp(l.source, 20) || 'manual', clamp(l.source_keyword, 60),
    ))
    const res = await DB.batch(stmts).catch(() => null)
    if (res) saved += slice.length
  }
  return saved
}

/* ── 붙여넣기 임포트(레인 B 공정위 정보공개서 · C 상인회 명부 등) ─────────────────── */
//   헤더 행이 있는 표(CSV/TSV)를 붙여넣으면 컬럼을 한글/영문 헤더로 매핑 → CompanyLead[]. source='registry'.
const IMPORT_HEADER_MAP: { keys: string[]; field: keyof CompanyLead }[] = [
  { keys: ['회사명', '상호', '업체명', '브랜드', '영업표지', 'company', 'name'], field: 'company_name' },
  { keys: ['전화', '연락처', '대표번호', '전화번호', 'tel', 'phone'], field: 'phone' },
  { keys: ['이메일', '메일', 'email', 'e-mail'], field: 'email' },
  { keys: ['홈페이지', '사이트', 'website', 'url', 'homepage'], field: 'website' },
  { keys: ['주소', '소재지', 'address'], field: 'address' },
  { keys: ['지역', 'region'], field: 'region' },
  { keys: ['업종', '카테고리', 'category'], field: 'category' },
  { keys: ['세부', 'subcategory'], field: 'subcategory' },
]
export function parsePartnerPaste(text: string): CompanyLead[] {
  const lines = String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) return []
  const delim = (lines[0].match(/\t/g) || []).length >= (lines[0].match(/,/g) || []).length ? '\t' : ','
  const header = lines[0].split(delim).map(h => h.trim().toLowerCase())
  const col: Partial<Record<keyof CompanyLead, number>> = {}
  header.forEach((h, i) => {
    for (const m of IMPORT_HEADER_MAP) if (col[m.field] === undefined && m.keys.some(k => h.includes(k.toLowerCase()))) col[m.field] = i
  })
  if (col.company_name === undefined) return []
  const out: CompanyLead[] = []
  for (const line of lines.slice(1)) {
    const cells = line.split(delim)
    const get = (f: keyof CompanyLead): string => col[f] !== undefined ? String(cells[col[f] as number] || '').trim() : ''
    const name = get('company_name')
    if (name.length < 2) continue
    out.push({
      company_name: name,
      phone: get('phone') || null, email: get('email') || null, website: get('website') || null,
      address: get('address') || null, region: get('region') || null,
      category: get('category') || null, subcategory: get('subcategory') || null,
      source: 'registry', source_keyword: 'import',
    })
    if (out.length >= 2000) break
  }
  return out
}

/* ── 목록/필터 ─────────────────────────────────────────────────────────────── */
export async function listCompanyLeads(DB: D1Database, filter: {
  category?: string; subcategory?: string; region?: string; tier?: number
  status?: string; hasContact?: boolean; hasEmail?: boolean; q?: string; limit?: number
} = {}): Promise<CompanyLeadRow[]> {
  await ensureCompanySchema(DB)
  const where: string[] = ['1=1']
  const binds: (string | number)[] = []
  if (filter.category) { where.push('category = ?'); binds.push(filter.category) }
  if (filter.subcategory) { where.push('subcategory = ?'); binds.push(filter.subcategory) }
  if (filter.region) { where.push('region LIKE ?'); binds.push(`%${filter.region}%`) }
  if (typeof filter.tier === 'number') { where.push('tier = ?'); binds.push(filter.tier) }
  if (filter.status && COMPANY_STATUSES.includes(filter.status)) { where.push('status = ?'); binds.push(filter.status) }
  if (filter.hasEmail) where.push("(email IS NOT NULL AND email != '')")
  else if (filter.hasContact) where.push("((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))")
  if (filter.q) {
    where.push('(LOWER(company_name) LIKE ? OR LOWER(COALESCE(source_keyword,\'\')) LIKE ? OR LOWER(COALESCE(region,\'\')) LIKE ? OR COALESCE(phone,\'\') LIKE ?)')
    const like = `%${filter.q.toLowerCase()}%`; binds.push(like, like, like, `%${filter.q}%`)
  }
  const limit = Math.min(2000, Math.max(1, filter.limit || 500))
  // 정렬: tier 우선(1=최우선, NULL 은 뒤) → 최근 수집순.
  const r = await DB.prepare(
    `SELECT ${SELECT_COLS} FROM ad_company_leads WHERE ${where.join(' AND ')}
     ORDER BY (tier IS NULL) ASC, tier ASC, collected_at DESC, id DESC LIMIT ?`)
    .bind(...binds, limit).all<CompanyLeadRow>().catch(() => null)
  return r?.results || []
}

/* ── 큐레이션(상태머신·tier·메모·팔로업·채널) ──────────────────────────────────── */
export async function updateCompanyLead(DB: D1Database, id: number, patch: {
  status?: string; memo?: string; tier?: number | null; follow_up_at?: string | null; contact_channel?: string | null
}): Promise<{ ok: boolean; error?: string }> {
  await ensureCompanySchema(DB)
  const sets: string[] = []
  const binds: (string | number | null)[] = []
  if (patch.status !== undefined) {
    if (!COMPANY_STATUSES.includes(patch.status)) return { ok: false, error: '상태 값이 올바르지 않습니다' }
    sets.push('status = ?'); binds.push(patch.status)
    if (['contacted', 'interested', 'contracted'].includes(patch.status)) sets.push("contacted_at = COALESCE(contacted_at, datetime('now'))")
  }
  if (patch.memo !== undefined) { sets.push('memo = ?'); binds.push((patch.memo || '').slice(0, 500) || null) }
  if (patch.tier !== undefined) {
    if (patch.tier === null) sets.push('tier = NULL')
    else {
      const t = Math.round(Number(patch.tier))
      if (!Number.isFinite(t) || t < COMPANY_TIER_MIN || t > COMPANY_TIER_MAX) return { ok: false, error: 'tier 는 1~5 입니다' }
      sets.push('tier = ?'); binds.push(t)
    }
  }
  if (patch.contact_channel !== undefined) {
    const ch = patch.contact_channel
    if (ch === null || ch === '') sets.push('contact_channel = NULL')
    else if (COMPANY_CONTACT_CHANNELS.includes(ch)) { sets.push('contact_channel = ?'); binds.push(ch) }
    else return { ok: false, error: '접촉 채널 값이 올바르지 않습니다' }
  }
  if (patch.follow_up_at !== undefined) {
    const f = patch.follow_up_at
    if (f === null || f === '') sets.push('follow_up_at = NULL')
    else if (/^\d{4}-\d{2}-\d{2}$/.test(f)) { sets.push('follow_up_at = ?'); binds.push(f) }
    else return { ok: false, error: '날짜 형식(YYYY-MM-DD)이 올바르지 않습니다' }
  }
  if (!sets.length) return { ok: false, error: '변경할 항목이 없습니다' }
  const r = await DB.prepare(`UPDATE ad_company_leads SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}

export async function deleteCompanyLead(DB: D1Database, id: number): Promise<{ ok: boolean; error?: string }> {
  await ensureCompanySchema(DB)
  const r = await DB.prepare('DELETE FROM ad_company_leads WHERE id = ?').bind(id).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}

/* ── 통계(어드민 대시보드 스트립) ──────────────────────────────────────────────── */
export interface CompanyStats { total: number; with_contact: number; with_email: number; active_pipeline: number; recent7: number }
export async function companyStats(DB: D1Database): Promise<{ stats: CompanyStats; byCategory: Array<{ k: string; n: number }>; byTier: Array<{ k: number | null; n: number }> }> {
  await ensureCompanySchema(DB)
  const t = await DB.prepare(`SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '') THEN 1 ELSE 0 END) AS with_contact,
      SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS with_email,
      SUM(CASE WHEN status NOT IN ('new','rejected') THEN 1 ELSE 0 END) AS active_pipeline,
      SUM(CASE WHEN collected_at >= datetime('now','-7 days') THEN 1 ELSE 0 END) AS recent7
    FROM ad_company_leads`).first<Record<string, number>>().catch(() => null)
  const byCategory = (await DB.prepare("SELECT COALESCE(category,'?') AS k, COUNT(*) AS n FROM ad_company_leads GROUP BY category ORDER BY n DESC LIMIT 20").all<{ k: string; n: number }>().catch(() => null))?.results || []
  const byTier = (await DB.prepare('SELECT tier AS k, COUNT(*) AS n FROM ad_company_leads GROUP BY tier ORDER BY (tier IS NULL) ASC, tier ASC').all<{ k: number | null; n: number }>().catch(() => null))?.results || []
  return {
    stats: {
      total: Number(t?.total) || 0, with_contact: Number(t?.with_contact) || 0, with_email: Number(t?.with_email) || 0,
      active_pipeline: Number(t?.active_pipeline) || 0, recent7: Number(t?.recent7) || 0,
    },
    byCategory, byTier,
  }
}
