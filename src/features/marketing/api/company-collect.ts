/**
 * 🤝 파트너(업체) 수집엔진 — 레인 A: 네이버 지역검색(local.json) 자동 발굴 (2026-07-21).
 *   유어딜 매장 입점을 대신 데려올 업체(마케팅 대행사·POS·간판·세무사·주류도매 등)를 공개 API 로 발굴 →
 *   격리 테이블 `ad_company_leads` 누적. 인플루언서 트랙과 **같은 결·별도 격리**(테이블/키워드/커서 분리).
 *
 *   ⚠️ 수집 ≠ 발송: 공개된 *비즈니스* 연락처(지역검색이 스스로 공개한 전화·주소·홈페이지)만 저장.
 *   자동 발송 경로 부존재. 게이트 `ADS_COMPANY_COLLECT_ENABLED`(cron 호출부에서 체크, 수동 트리거는 무관).
 *
 *   phone-first: 지역검색은 전화·주소·홈페이지링크를 바로 준다(수용기준 40% = 전화만으로 충족).
 *   홈페이지 이메일 크롤(robots.txt fetcher)은 후속 additive 슬라이스(설계 §7 결정 대기).
 *   설계 SSOT: docs/design/partner-company-collection.md §3 레인 A.
 */
import type { Env } from '@/worker/types/env'
import { type FetchBudget, outOfBudget, spendBudget } from './influencer-discovery'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'

const NAVER_OPENAPI = 'https://openapi.naver.com'
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()

/** 🗺️ 방배 상권 우선 시드(대표) — 지역 × 접점 업종 그리드 + 지역무관 대행사. category/subcategory=COMPANY_CATEGORIES 정합. */
const REGIONS = ['방배', '서초', '강남']
const TRADES: { kw: string; category: string; subcategory: string }[] = [
  { kw: '마케팅 대행', category: '대행사', subcategory: '마케팅대행' },
  { kw: 'POS', category: '매장인프라', subcategory: 'POS·카드단말기' },
  { kw: '키오스크', category: '매장인프라', subcategory: '키오스크' },
  { kw: '간판', category: '매장인프라', subcategory: '간판' },
  { kw: '인테리어', category: '매장인프라', subcategory: '인테리어' },
  { kw: '세무사', category: '전문서비스', subcategory: '세무·기장' },
  { kw: '노무사', category: '전문서비스', subcategory: '노무' },
  { kw: '주류 도매', category: '정기납품', subcategory: '주류도매' },
  { kw: '식자재', category: '정기납품', subcategory: '식자재유통' },
  { kw: '상가 부동산', category: '전문서비스', subcategory: '상가부동산' },
  { kw: '창업 컨설팅', category: '창업생태계', subcategory: '창업컨설팅' },
  { kw: '배달대행', category: '정기납품', subcategory: '배달대행' },
]
const GENERAL: { kw: string; category: string; subcategory: string }[] = [
  { kw: '마케팅 대행사', category: '대행사', subcategory: '마케팅대행' },
  { kw: '퍼포먼스 마케팅 대행사', category: '대행사', subcategory: '마케팅대행' },
  { kw: '바이럴 마케팅 대행사', category: '대행사', subcategory: '마케팅대행' },
  { kw: '소상공인 마케팅', category: '대행사', subcategory: '마케팅대행' },
  { kw: '병원 마케팅 대행', category: '대행사', subcategory: '병원·뷰티마케팅' },
]
interface CompanyKeyword { id: number; keyword: string; category: string | null; subcategory: string | null; region: string | null }

const _kwDone = new WeakSet<object>()
export async function ensureCompanyKeywords(DB: D1Database): Promise<void> {
  if (_kwDone.has(DB)) return
  _kwDone.add(DB)
  await DB.prepare(`CREATE TABLE IF NOT EXISTS ad_company_keywords (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    keyword TEXT NOT NULL UNIQUE,
    category TEXT,
    subcategory TEXT,
    region TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'seed',
    found_total INTEGER NOT NULL DEFAULT 0,
    saved_total INTEGER NOT NULL DEFAULT 0,
    last_run_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  const rows: { keyword: string; category: string; subcategory: string; region: string | null }[] = [
    ...REGIONS.flatMap(r => TRADES.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r }))),
    ...GENERAL.map(g => ({ keyword: g.kw, category: g.category, subcategory: g.subcategory, region: null })),
  ]
  const stmts = rows.map(r => DB.prepare("INSERT OR IGNORE INTO ad_company_keywords (keyword, category, subcategory, region, active, source) VALUES (?, ?, ?, ?, 1, 'seed')")
    .bind(r.keyword, r.category, r.subcategory, r.region))
  await DB.batch(stmts).catch(() => null)
}

export async function listCompanyKeywords(DB: D1Database): Promise<Array<CompanyKeyword & { active: number; found_total: number; saved_total: number; last_run_at: string | null }>> {
  await ensureCompanyKeywords(DB)
  const r = await DB.prepare('SELECT id, keyword, category, subcategory, region, active, found_total, saved_total, last_run_at FROM ad_company_keywords ORDER BY active DESC, saved_total DESC, id ASC LIMIT 500')
    .all<CompanyKeyword & { active: number; found_total: number; saved_total: number; last_run_at: string | null }>().catch(() => null)
  return r?.results || []
}

export async function addCompanyKeyword(DB: D1Database, keyword: string, category?: string, subcategory?: string, region?: string): Promise<{ ok: boolean; error?: string }> {
  const kw = (keyword || '').trim()
  if (kw.length < 2 || kw.length > 40) return { ok: false, error: 'INVALID' }
  await ensureCompanyKeywords(DB)
  await DB.prepare("INSERT OR IGNORE INTO ad_company_keywords (keyword, category, subcategory, region, active, source) VALUES (?, ?, ?, ?, 1, 'manual')")
    .bind(kw, (category || '').slice(0, 40) || null, (subcategory || '').slice(0, 40) || null, (region || '').slice(0, 40) || null).run().catch(() => null)
  return { ok: true }
}

/** 네이버 지역검색(local.json) 1키워드 → CompanyLead[]. display 최대 5(네이버 로컬 API 제약). */
async function searchNaverLocal(clientId: string, clientSecret: string, kw: CompanyKeyword, budget?: FetchBudget): Promise<CompanyLead[]> {
  if (outOfBudget(budget)) return []
  spendBudget(budget)
  const url = `${NAVER_OPENAPI}/v1/search/local.json?query=${encodeURIComponent(kw.keyword)}&display=5&sort=random`
  const res = await fetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, signal: AbortSignal.timeout(12000) }).catch(() => null)
  if (!res || !res.ok) return []
  const data = (await res.json().catch(() => null)) as { items?: Array<{ title?: string; category?: string; telephone?: string; address?: string; roadAddress?: string; link?: string; description?: string }> } | null
  const out: CompanyLead[] = []
  for (const it of (data?.items || [])) {
    const name = stripTag(it.title)
    if (name.length < 2) continue
    out.push({
      company_name: name,
      category: kw.category,
      subcategory: kw.subcategory,
      region: kw.region,
      website: (it.link || '').trim() || null,
      phone: (it.telephone || '').trim() || null,
      address: (it.roadAddress || it.address || '').trim() || null,
      description: stripTag(it.description) || (it.category ? `[${stripTag(it.category)}]` : null),
      source: 'local',
      source_keyword: kw.keyword,
    })
  }
  return out
}

export interface CompanyCollectStats { last_run: string; found: number; saved: number; keywords: string[]; cursor: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string } }
const STATS_KEY = 'ads_company_stats'
const CURSOR_KEY = 'ads_company_cursor'

/** 한 번의 업체 자동수집(cron 홀수시 틱 또는 수동). 게이트 체크는 호출부. 커서 순환으로 며칠에 걸쳐 전 키워드 커버. */
export async function runCompanyAutoCollect(env: Env): Promise<CompanyCollectStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  await ensureCompanyKeywords(DB)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const clientId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
  const clientSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: CompanyCollectStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as CompanyCollectStats : null } catch { prev = null }

  if (!clientId || !clientSecret) {
    const s: CompanyCollectStats = { last_run: stamp, found: 0, saved: 0, keywords: [], cursor: prev?.cursor || 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: false, error: 'NOT_CONFIGURED: NAVER_SEARCH_CLIENT_ID/SECRET 미설정' } }
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
    return s
  }

  const active = await DB.prepare('SELECT id, keyword, category, subcategory, region FROM ad_company_keywords WHERE active = 1 ORDER BY id ASC').all<CompanyKeyword>().catch(() => null)
  const kws = active?.results || []
  if (!kws.length) {
    const s: CompanyCollectStats = { last_run: stamp, found: 0, saved: 0, keywords: [], cursor: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: true } }
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
    return s
  }

  const batch = Math.min(kws.length, Math.max(1, parseInt(env.ADS_COMPANY_BATCH || '', 10) || 8))
  let cursor = prev?.cursor || 0
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0
  const budget: FetchBudget = { left: Math.max(5, parseInt(env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 60) }

  let found = 0, saved = 0
  const used: string[] = []
  for (let i = 0; i < batch; i++) {
    if (outOfBudget(budget)) break
    const kw = kws[(cursor + i) % kws.length]
    used.push(kw.keyword)
    const leads = await searchNaverLocal(clientId, clientSecret, kw, budget)
    found += leads.length
    const n = await saveCompanyLeads(DB, leads).catch(() => 0)
    saved += n
    await DB.prepare("UPDATE ad_company_keywords SET found_total = found_total + ?, saved_total = saved_total + ?, last_run_at = datetime('now') WHERE id = ?")
      .bind(leads.length, n, kw.id).run().catch(() => null)
  }
  const nextCursor = (cursor + batch) % kws.length

  const s: CompanyCollectStats = {
    last_run: stamp, found, saved, keywords: used, cursor: nextCursor,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    diag: { configured: true },
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(nextCursor)).run().catch(() => null)
  return s
}
