/**
 * 🏭 유통스타트(도매몰) — **제조사(브랜드사) · 판매사 후보 풀** (2026-07-28 대표 "제조사·판매사 DB도 모아야지",
 *   "제조사, 브랜드사 같은 개념이지").
 *
 *   도매몰의 두 축을 각각 채우는 **격리 리드 풀**:
 *     · maker    = 제조사/브랜드사 — 자사 상품(브랜드)을 보유해 도매로 공급할 수 있는 주체(공급자측)
 *     · reseller = 판매사 후보 — 사입해 재판매하는 주체(구매자측). 통신판매사업자가 1차 모수.
 *
 *   ⚠️ **서비스 분리(CLAUDE.md)**: 소비자/유어애즈 파트너 풀(`ad_company_leads`)과 **완전 격리된 테이블**.
 *   한쪽 쿼리가 반대쪽 행을 건드리지 않는다. 유어애즈에서 가져오는 것은 **읽기 전용 1회 복사**(임포트)뿐이며
 *   원본 행은 무접촉(수정/삭제 없음).
 *
 *   ⚠️ 수집 ≠ 발송 — 공개된 *비즈니스* 연락처만 저장. 자동 발송 경로 부존재.
 */

/** 리드 종류 — 도매몰의 공급자측/구매자측. */
export type MakerKind = 'maker' | 'reseller'
export const MAKER_KINDS: MakerKind[] = ['maker', 'reseller']
export const MAKER_KIND_LABEL: Record<MakerKind, string> = { maker: '제조사·브랜드사', reseller: '판매사 후보' }

/** 품목군(도매 카탈로그 관점) — 제조사가 무엇을 만드는가. */
export const MAKER_CATEGORIES = [
  '식품·가공', '건강식품', '화장품·뷰티', '생활용품', '주방용품', '패션·의류', '잡화·액세서리',
  '반려동물', '유아·출산', '가전·디지털', '스포츠·레저', '문구·팬시', '기타',
]

/** B2B 아웃리치 파이프라인(파트너 풀과 동일 어휘 — 운영 일관성). */
export const MAKER_STATUSES = ['new', 'contacted', 'interested', 'contracted', 'rejected', 'hold']

export interface MakerLead {
  company_name: string
  kind: MakerKind
  category?: string | null
  brand_name?: string | null      // 보유 브랜드(있으면) — "제조사=브랜드사" 관점의 핵심 필드
  region?: string | null
  address?: string | null
  phone?: string | null
  email?: string | null
  website?: string | null
  business_no?: string | null
  description?: string | null
  contact_source?: string | null  // kakao / homepage / commerce(통신판매 원부) / manual
  source?: string | null          // 'local'(카카오) | 'commerce'(임포트) | 'manual'
  source_keyword?: string | null
}

export interface MakerLeadRow extends MakerLead {
  id: number; company_key: string; status: string; active: number
  memo: string | null; collected_at: string; last_verified_at: string | null
}

const SELECT_COLS = 'id, company_key, company_name, kind, category, brand_name, region, address, phone, email, website, business_no, description, contact_source, source, source_keyword, status, active, memo, collected_at, last_verified_at'

/* ── 스키마(런타임 보장 — 도매 트랙도 CI 마이그레이션 미작동) ─────────────────────── */
const _done = new WeakSet<object>()
export async function ensureMakerSchema(DB: D1Database): Promise<void> {
  if (_done.has(DB)) return
  _done.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS supply_maker_leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_key TEXT NOT NULL,
    company_name TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'maker',
    category TEXT,
    brand_name TEXT,
    region TEXT,
    address TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    business_no TEXT,
    description TEXT,
    contact_source TEXT,
    source TEXT NOT NULL DEFAULT 'manual',
    source_keyword TEXT,
    status TEXT NOT NULL DEFAULT 'new',
    active INTEGER NOT NULL DEFAULT 1,
    memo TEXT,
    enrich_checked_at DATETIME,
    last_verified_at DATETIME,
    collected_at DATETIME DEFAULT (datetime('now')),
    UNIQUE(company_key)
  )`).run().catch(() => null)
  // 기존 테이블 보강(CREATE IF NOT EXISTS 는 이미 있는 표를 안 고침) — 실패는 '이미 있음'이라 무시.
  await DB.prepare('ALTER TABLE supply_maker_leads ADD COLUMN enrich_checked_at DATETIME').run().catch(() => null)
  await DB.prepare('ALTER TABLE supply_maker_leads ADD COLUMN enrich_v INTEGER').run().catch(() => null) // 어느 버전 크롤러로 시도했나(< MAKER_CRAWL_VERSION 이면 재시도 대상)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_maker_leads_kind ON supply_maker_leads(kind, id)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_maker_leads_cat ON supply_maker_leads(category, id)').run().catch(() => null)
  await DB.prepare('CREATE INDEX IF NOT EXISTS idx_maker_leads_status ON supply_maker_leads(status, id)').run().catch(() => null)
}

/** 멱등 키 — 사업자번호 > 도메인 > 상호|지역 (파트너 풀과 동일 철학). */
function makerKey(l: MakerLead): string {
  const biz = (l.business_no || '').replace(/\D/g, '')
  if (biz.length === 10) return `b:${biz}`
  const web = (l.website || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase()
  if (web.length >= 4) return `w:${web}`
  const name = (l.company_name || '').trim().toLowerCase().replace(/\s+/g, '')
  const region = (l.region || '').trim().toLowerCase().replace(/\s+/g, '')
  return `n:${name}|${region}`.slice(0, 200)
}

/** 저장(멱등 upsert — 빈 연락처만 백필, 큐레이션 필드 불변). */
export async function saveMakerLeads(DB: D1Database, leads: MakerLead[]): Promise<number> {
  if (!leads.length) return 0
  await ensureMakerSchema(DB)
  const clamp = (v: unknown, n: number): string | null => { const s = v == null ? '' : String(v).trim(); return s ? s.slice(0, n) : null }
  const rows = leads.map(l => ({ ...l, company_name: (l.company_name || '').trim() })).filter(l => l.company_name.length >= 2)
  if (!rows.length) return 0
  let saved = 0
  for (let i = 0; i < rows.length; i += 50) {
    const slice = rows.slice(i, i + 50)
    const stmts = slice.map(l => DB.prepare(
      `INSERT INTO supply_maker_leads (company_key, company_name, kind, category, brand_name, region, address, phone, email, website, business_no, description, contact_source, source, source_keyword)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(company_key) DO UPDATE SET
         phone = COALESCE(supply_maker_leads.phone, excluded.phone),
         email = COALESCE(supply_maker_leads.email, excluded.email),
         website = COALESCE(supply_maker_leads.website, excluded.website),
         address = COALESCE(supply_maker_leads.address, excluded.address),
         brand_name = COALESCE(supply_maker_leads.brand_name, excluded.brand_name),
         business_no = COALESCE(supply_maker_leads.business_no, excluded.business_no),
         contact_source = COALESCE(supply_maker_leads.contact_source, excluded.contact_source)`
    ).bind(
      makerKey(l), l.company_name.slice(0, 120), l.kind === 'reseller' ? 'reseller' : 'maker',
      clamp(l.category, 40), clamp(l.brand_name, 80), clamp(l.region, 60), clamp(l.address, 300),
      clamp(l.phone, 40), clamp(l.email, 120), clamp(l.website, 200), clamp(l.business_no, 20),
      clamp(l.description, 500), clamp(l.contact_source, 20), clamp(l.source, 20) || 'manual', clamp(l.source_keyword, 60),
    ))
    const res = await DB.batch(stmts).catch(() => null)
    if (res) saved += slice.length
  }
  return saved
}

export interface MakerFilter { kind?: string; category?: string; status?: string; hasContact?: boolean; hasEmail?: boolean; q?: string; limit?: number; offset?: number }

function buildWhere(f: MakerFilter): { sql: string; binds: (string | number)[] } {
  const w: string[] = ['1=1']; const b: (string | number)[] = []
  if (f.kind && MAKER_KINDS.includes(f.kind as MakerKind)) { w.push('kind = ?'); b.push(f.kind) }
  if (f.category) { w.push('category = ?'); b.push(f.category) }
  if (f.status) { w.push('status = ?'); b.push(f.status) }
  if (f.hasEmail) w.push("email IS NOT NULL AND email != ''")
  else if (f.hasContact) w.push("((email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != ''))")
  if (f.q) {
    // 다단어 AND — 상호·브랜드·지역·품목·연락처 전 필드 검색(파트너 풀과 동일 UX).
    for (const t of f.q.split(/\s+/).filter(Boolean).slice(0, 5)) {
      w.push('(company_name LIKE ? OR brand_name LIKE ? OR region LIKE ? OR category LIKE ? OR phone LIKE ? OR email LIKE ? OR address LIKE ?)')
      const like = `%${t}%`; b.push(like, like, like, like, like, like, like)
    }
  }
  return { sql: w.join(' AND '), binds: b }
}

export async function listMakerLeads(DB: D1Database, f: MakerFilter = {}): Promise<MakerLeadRow[]> {
  await ensureMakerSchema(DB)
  const { sql, binds } = buildWhere(f)
  const limit = Math.min(500, Math.max(1, f.limit || 100))
  const offset = Math.max(0, f.offset || 0)
  const r = await DB.prepare(`SELECT ${SELECT_COLS} FROM supply_maker_leads WHERE ${sql} ORDER BY (CASE WHEN email IS NOT NULL AND email != '' THEN 0 ELSE 1 END), id DESC LIMIT ? OFFSET ?`)
    .bind(...binds, limit, offset).all<MakerLeadRow>().catch(() => null)
  return r?.results || []
}

export async function countMakerLeads(DB: D1Database, f: MakerFilter = {}): Promise<number> {
  await ensureMakerSchema(DB)
  const { sql, binds } = buildWhere(f)
  const r = await DB.prepare(`SELECT COUNT(*) AS n FROM supply_maker_leads WHERE ${sql}`).bind(...binds).first<{ n: number }>().catch(() => null)
  return Number(r?.n) || 0
}

export interface MakerStats { total: number; makers: number; resellers: number; with_contact: number; with_email: number; pipeline: number }
export async function makerStats(DB: D1Database): Promise<{ stats: MakerStats; byCategory: Array<{ k: string; n: number }> }> {
  await ensureMakerSchema(DB)
  const t = await DB.prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN kind = 'maker' THEN 1 ELSE 0 END) AS makers,
      SUM(CASE WHEN kind = 'reseller' THEN 1 ELSE 0 END) AS resellers,
      SUM(CASE WHEN (email IS NOT NULL AND email != '') OR (phone IS NOT NULL AND phone != '') THEN 1 ELSE 0 END) AS with_contact,
      SUM(CASE WHEN email IS NOT NULL AND email != '' THEN 1 ELSE 0 END) AS with_email,
      SUM(CASE WHEN status NOT IN ('new','rejected') THEN 1 ELSE 0 END) AS pipeline
    FROM supply_maker_leads`).first<Record<string, number>>().catch(() => null)
  const byCategory = (await DB.prepare("SELECT COALESCE(category,'?') AS k, COUNT(*) AS n FROM supply_maker_leads GROUP BY category ORDER BY n DESC LIMIT 20")
    .all<{ k: string; n: number }>().catch(() => null))?.results || []
  return {
    stats: {
      total: Number(t?.total) || 0, makers: Number(t?.makers) || 0, resellers: Number(t?.resellers) || 0,
      with_contact: Number(t?.with_contact) || 0, with_email: Number(t?.with_email) || 0, pipeline: Number(t?.pipeline) || 0,
    },
    byCategory,
  }
}

/** 큐레이션(상태·메모) — 도매 어드민 전용. */
export async function updateMakerLead(DB: D1Database, id: number, patch: { status?: string; memo?: string; category?: string | null; brand_name?: string | null }): Promise<{ ok: boolean; error?: string }> {
  await ensureMakerSchema(DB)
  const sets: string[] = []; const binds: (string | number | null)[] = []
  if (patch.status !== undefined) {
    if (!MAKER_STATUSES.includes(patch.status)) return { ok: false, error: '상태 값이 올바르지 않습니다' }
    sets.push('status = ?'); binds.push(patch.status)
  }
  if (patch.memo !== undefined) { sets.push('memo = ?'); binds.push((patch.memo || '').slice(0, 500) || null) }
  if (patch.category !== undefined) { sets.push('category = ?'); binds.push(patch.category || null) }
  if (patch.brand_name !== undefined) { sets.push('brand_name = ?'); binds.push(patch.brand_name || null) }
  if (!sets.length) return { ok: false, error: '변경할 항목이 없습니다' }
  const r = await DB.prepare(`UPDATE supply_maker_leads SET ${sets.join(', ')} WHERE id = ?`).bind(...binds, id).run().catch(() => null)
  if (!r || r.meta?.changes === 0) return { ok: false, error: '리드를 찾을 수 없습니다' }
  return { ok: true }
}
