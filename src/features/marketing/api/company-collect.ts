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
import { type FetchBudget } from './influencer-discovery'
import { extractEmailFromHtml } from './contact-enrich'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'

// 서브리퀘스트 예산 헬퍼(influencer-discovery 내부와 동일 — 그쪽은 미export 라 인라인).
const outOfBudget = (b?: FetchBudget) => !!b && b.left <= 0
const spendBudget = (b?: FetchBudget) => { if (b) b.left -= 1 }

const NAVER_OPENAPI = 'https://openapi.naver.com'
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()

/** 🗺️ 파트너 키워드 그리드(대표 플레이북 8종 — 2026-07-22). subcategory=업종명, tier=플레이북 순위
 *   (대행사1·주류식자재2·부동산간판3·POS4·세무5 — 어드민 수동 조정 가능). 1단계(방배 실전) 먼저 시드
 *   → 낮은 id = 커서 우선. ⚠️ 향후 공공데이터 API(상가정보) 전환 대상 = tier 2~5(설계 §5). 대행사(tier1)만 네이버 유지. */
type Trade = { kw: string; category: string; subcategory: string; tier: number }
// 1단계 — 지역 {서초·방배·강남·동작} × tier 2~5 업종.
const S1_REGIONS = ['서초', '방배', '강남', '동작']
const S1_TRADES: Trade[] = [
  { kw: '주류 도매', category: '정기납품', subcategory: '주류 도매', tier: 2 },
  { kw: '주류도매상', category: '정기납품', subcategory: '주류도매상', tier: 2 },
  { kw: '식자재 유통', category: '정기납품', subcategory: '식자재 유통', tier: 2 },
  { kw: '업소용 식자재', category: '정기납품', subcategory: '업소용 식자재', tier: 2 },
  { kw: '식자재 마트', category: '정기납품', subcategory: '식자재 마트', tier: 2 },
  { kw: '커피 원두 납품', category: '정기납품', subcategory: '커피 원두 납품', tier: 2 },
  { kw: '상가 전문 부동산', category: '전문서비스', subcategory: '상가 전문 부동산', tier: 3 },
  { kw: '상가 임대', category: '전문서비스', subcategory: '상가 임대', tier: 3 },
  { kw: '간판 제작', category: '매장인프라', subcategory: '간판 제작', tier: 3 },
  { kw: '상업 인테리어', category: '매장인프라', subcategory: '상업 인테리어', tier: 3 },
  { kw: '주방설비', category: '매장인프라', subcategory: '주방설비', tier: 3 },
  { kw: '포스 대리점', category: '매장인프라', subcategory: '포스 대리점', tier: 4 },
  { kw: '카드단말기', category: '매장인프라', subcategory: '카드단말기', tier: 4 },
  { kw: 'VAN 대리점', category: '매장인프라', subcategory: 'VAN 대리점', tier: 4 },
  { kw: '키오스크 설치', category: '매장인프라', subcategory: '키오스크 설치', tier: 4 },
  { kw: '테이블오더', category: '매장인프라', subcategory: '테이블오더', tier: 4 },
  { kw: '세무사무소', category: '전문서비스', subcategory: '세무사무소', tier: 5 },
  { kw: '기장 세무사', category: '전문서비스', subcategory: '기장 세무사', tier: 5 },
  { kw: '노무사 사무소', category: '전문서비스', subcategory: '노무사 사무소', tier: 5 },
]
// 2단계 — 대행사 전국(tier 1, 이메일 크롤 우선). 서울 25구 + 6 광역시.
const S2_REGIONS = ['강남', '서초', '송파', '강동', '마포', '용산', '성동', '광진', '영등포', '동작', '관악', '강서', '양천', '구로', '금천', '종로', '중구', '성북', '동대문', '중랑', '노원', '도봉', '강북', '은평', '서대문', '부산', '대구', '인천', '광주', '대전', '울산']
const S2_TRADES: Trade[] = [
  { kw: '마케팅 대행사', category: '대행사', subcategory: '마케팅 대행사', tier: 1 },
  { kw: '퍼포먼스 마케팅 대행사', category: '대행사', subcategory: '퍼포먼스 마케팅 대행사', tier: 1 },
  { kw: '바이럴 마케팅 대행사', category: '대행사', subcategory: '바이럴 마케팅 대행사', tier: 1 },
  { kw: '소상공인 마케팅', category: '대행사', subcategory: '소상공인 마케팅', tier: 1 },
  { kw: '창업 컨설팅', category: '창업생태계', subcategory: '창업 컨설팅', tier: 1 },
  { kw: '상권분석', category: '창업생태계', subcategory: '상권분석', tier: 1 },
]
interface CompanyKeyword { id: number; keyword: string; category: string | null; subcategory: string | null; region: string | null; tier: number | null }

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
    tier INTEGER,
    active INTEGER NOT NULL DEFAULT 1,
    source TEXT NOT NULL DEFAULT 'seed',
    found_total INTEGER NOT NULL DEFAULT 0,
    saved_total INTEGER NOT NULL DEFAULT 0,
    last_run_at DATETIME,
    created_at DATETIME DEFAULT (datetime('now'))
  )`).run().catch(() => null)
  await DB.prepare('ALTER TABLE ad_company_keywords ADD COLUMN tier INTEGER').run().catch(() => null)
  // 1단계 먼저(낮은 id = 커서 우선) → 2단계. 262행이라 100씩 청크 batch.
  const rows: { keyword: string; category: string; subcategory: string; region: string; tier: number }[] = [
    ...S1_REGIONS.flatMap(r => S1_TRADES.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
    ...S2_REGIONS.flatMap(r => S2_TRADES.map(t => ({ keyword: `${r} ${t.kw}`, category: t.category, subcategory: t.subcategory, region: r, tier: t.tier }))),
  ]
  for (let i = 0; i < rows.length; i += 100) {
    const stmts = rows.slice(i, i + 100).map(r => DB.prepare("INSERT OR IGNORE INTO ad_company_keywords (keyword, category, subcategory, region, tier, active, source) VALUES (?, ?, ?, ?, ?, 1, 'seed')")
      .bind(r.keyword, r.category, r.subcategory, r.region, r.tier))
    await DB.batch(stmts).catch(() => null)
  }
}

export async function listCompanyKeywords(DB: D1Database): Promise<Array<CompanyKeyword & { active: number; found_total: number; saved_total: number; last_run_at: string | null }>> {
  await ensureCompanyKeywords(DB)
  const r = await DB.prepare('SELECT id, keyword, category, subcategory, region, tier, active, found_total, saved_total, last_run_at FROM ad_company_keywords ORDER BY active DESC, (tier IS NULL) ASC, tier ASC, saved_total DESC, id ASC LIMIT 1000')
    .all<CompanyKeyword & { active: number; found_total: number; saved_total: number; last_run_at: string | null }>().catch(() => null)
  return r?.results || []
}

export async function addCompanyKeyword(DB: D1Database, keyword: string, category?: string, subcategory?: string, region?: string, tier?: number): Promise<{ ok: boolean; error?: string }> {
  const kw = (keyword || '').trim()
  if (kw.length < 2 || kw.length > 40) return { ok: false, error: 'INVALID' }
  await ensureCompanyKeywords(DB)
  const t = Number(tier); const tierVal = Number.isFinite(t) && t >= 1 && t <= 5 ? Math.round(t) : null
  await DB.prepare("INSERT OR IGNORE INTO ad_company_keywords (keyword, category, subcategory, region, tier, active, source) VALUES (?, ?, ?, ?, ?, 1, 'manual')")
    .bind(kw, (category || '').slice(0, 40) || null, (subcategory || '').slice(0, 40) || null, (region || '').slice(0, 40) || null, tierVal).run().catch(() => null)
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
      tier: kw.tier,
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

/** 🌐 레인 A-웹: 네이버 **웹문서 검색**으로 대행사 자체 사이트 발굴 (2026-07-27 — 대표 "대행사 많이 모집").
 *   대행사는 사무실업이라 지도(지역검색) 미등록이 많고 display=5 제약도 큼 — 반면 **웹엔 자기 사이트가 반드시 있음**.
 *   사이트 자체가 리드(도메인이 dedup 키) → 보강 크롤이 그 사이트에서 이메일/전화 확보(대행사 이메일 수율 최고 경로).
 *   제3자/UGC/구인 플랫폼 도메인 제외. 상호는 페이지 제목에서 유도(표시 라벨용 — 정체성 키는 도메인). */
async function searchNaverWeb(clientId: string, clientSecret: string, kw: CompanyKeyword, budget?: FetchBudget): Promise<CompanyLead[]> {
  if (outOfBudget(budget)) return []
  spendBudget(budget)
  const { THIRD_PARTY_HOST } = await import('./contact-enrich')
  const url = `${NAVER_OPENAPI}/v1/search/webkr.json?query=${encodeURIComponent(kw.keyword)}&display=10`
  const res = await fetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, signal: AbortSignal.timeout(12000) }).catch(() => null)
  if (!res || !res.ok) return []
  const data = (await res.json().catch(() => null)) as { items?: Array<{ title?: string; link?: string; description?: string }> } | null
  const out: CompanyLead[] = []
  const seen = new Set<string>()
  for (const it of (data?.items || [])) {
    const link = (it.link || '').trim()
    if (!/^https?:\/\//i.test(link)) continue
    let u: URL
    try { u = new URL(link) } catch { continue }
    const host = u.hostname.replace(/^www\./, '')
    if (THIRD_PARTY_HOST.test(u.hostname) || seen.has(host)) continue
    seen.add(host)
    // 상호 라벨: 제목 첫 구획(구분자 앞) — 정체성은 도메인(company_key=w:host)이라 라벨 오차 무해.
    const name = stripTag(it.title).split(/[|\-–—:·]/)[0].trim().slice(0, 60) || host
    if (name.length < 2) continue
    out.push({
      company_name: name, category: kw.category, subcategory: kw.subcategory, tier: kw.tier, region: kw.region,
      website: u.origin, // origin 만 저장 — 도메인 dedup + 크롤 진입점
      phone: null, email: null, address: null,
      description: stripTag(it.description).slice(0, 200) || null,
      source: 'webkr', source_keyword: kw.keyword,
    })
  }
  return out
}

/** 📧 홈페이지 이메일 크롤(레인 A 보충 — 옵션 a) — robots.txt 존중, 홈 1페이지 1회(재시도 없음), 예산 합산.
 *   website 는 네이버 지역검색이 준 업체 등록 홈페이지(사용자 입력 아님) — http(s) 만, pickBusinessEmail 재사용. */
export async function crawlCompanyEmail(website: string, budget?: FetchBudget): Promise<string | null> {
  let url: URL
  try { url = new URL(/^https?:\/\//i.test(website) ? website : `https://${website}`) } catch { return null }
  if (!/^https?:$/.test(url.protocol)) return null
  // robots.txt 존중(간이) — User-agent:* 에 Disallow:/ (전면차단)면 크롤 안 함.
  if (outOfBudget(budget)) return null
  spendBudget(budget)
  const robots = await fetch(`${url.origin}/robots.txt`, { signal: AbortSignal.timeout(6000) }).then(r => r.ok ? r.text() : '').catch(() => '')
  if (robots) {
    const star = robots.split(/user-agent:/i).find(b => /^\s*\*/.test(b)) || ''
    if (/(^|\n)\s*disallow:\s*\/\s*(#|$|\n)/i.test(star)) return null
  }
  if (outOfBudget(budget)) return null
  spendBudget(budget)
  const html = await fetch(url.origin, { signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'urdeal-partner-bot (+https://urdeal.kr)' } })
    .then(r => r.ok ? r.text() : '').catch(() => '')
  if (!html) return null
  return extractEmailFromHtml(html.slice(0, 200000)) // mailto: 우선 → 본문 문맥선별

}

/** 📇 연락처 보강 폭포수 — 보류(active=0) 리드에 [카카오 로컬 전화 → 홈페이지 이메일/전화] 순차 시도.
 *   카카오 로컬 API 는 상호+주소로 **전화를 준다**(네이버는 빈값) → 홈페이지 없는 보류도 전화 확보 가능.
 *   전부 업체 공개 데이터만, 출처(contact_source) 기록. 못 찾으면 비워둠(허위 0). tier1 우선. */
export async function enrichHeldLeads(env: Env): Promise<{ processed: number; enriched: number; remaining: number }> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const { kakaoLocalLookup, naverLocalLookup, naverHomepageSearch, crawlContact } = await import('./contact-enrich')
  const kakaoKey = env.KAKAO_REST_API_KEY || ''
  const nvId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID || ''
  const nvSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET || ''
  // 카카오 조회는 1건당 서브요청 1개(저렴) → 한 번에 많이. 크롤은 3~4개(비쌈) → 잔여 예산에서만.
  //   보강 전용 예산(ADS_ENRICH_BUDGET, 기본 100) — 수집 예산과 분리해 백로그를 시간당 대량 소진(대표 "보류없이 다 진행").
  const budget: FetchBudget = { left: Math.max(20, parseInt(env.ADS_ENRICH_BUDGET || env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 100) }
  // 대상 = 보류(연락처 없음) + 이메일 없는 기존 리드(전화만 있어도 이메일 소급).
  //   정렬 = **홈페이지 보유 우선**(크롤 즉시 가능 = 이메일 수율 최고 — 대표 "이메일이 전화보다 중요") → 보류 → tier1.
  const targets = (await DB.prepare("SELECT id, company_name, region, address, website, phone, email FROM ad_company_leads WHERE active = 0 OR email IS NULL OR email = '' ORDER BY (CASE WHEN website IS NOT NULL AND website != '' THEN 0 ELSE 1 END), active ASC, (CASE WHEN tier = 1 THEN 0 ELSE 1 END), id DESC LIMIT 200")
    .all<{ id: number; company_name: string; region: string | null; address: string | null; website: string | null; phone: string | null; email: string | null }>().catch(() => null))?.results || []
  let enriched = 0, processed = 0
  // 카카오 place_url(지도페이지)은 홈페이지가 아니라 크롤 대상 아님 — 실제 홈페이지만 크롤.
  const realSite = (w: string | null): string | null => (w && !/kakao\.|place\.map|map\.naver|naver\.me/i.test(w)) ? w : null
  // 통합 저장 — 전화/이메일 생기면 active=1 승격(기존값 보존 COALESCE). 허위 0(값 있을 때만 호출).
  const save = async (id: number, phone: string | null, email: string | null, website: string | null, source: string) => {
    if (!phone && !email && !website) return
    const r = await DB.prepare(
      `UPDATE ad_company_leads SET phone = COALESCE(phone, ?), email = COALESCE(email, ?), website = COALESCE(website, ?),
         contact_source = COALESCE(contact_source, ?),
         active = CASE WHEN COALESCE(phone, ?) IS NOT NULL OR COALESCE(email, ?) IS NOT NULL THEN 1 ELSE active END
       WHERE id = ?`
    ).bind(phone, email, website, source || null, phone, email, id).run().catch(() => null)
    if (((r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0 && (phone || email)) enriched++
  }

  // ── Phase 1: 카카오 전화(1건 1요청, 저렴·광범위) — 전화 없는 리드만. place_url 무시 ──
  //   ⚠️ 예산 분할: Phase1 이 전체 예산을 독식하면 Phase2(이메일 — 대표 최우선)가 0건 처리되므로
  //     전화 조회는 예산의 절반까지만. ⚠️ 주소 없는 리드(프랜차이즈 본사 등)는 카카오 스킵 —
  //     상호만으로는 동명 지점/타업체 전화 오귀속 위험(허위 방지). 그런 리드는 홈페이지 크롤이 담당.
  const phoneCap = Math.floor(budget.left / 3) // 전화는 예산 1/3까지만 — 2/3 는 이메일(크롤/발견)에(대표 "이메일 우선")
  let phoneSpent = 0
  for (const t of targets) {
    if (outOfBudget(budget) || phoneSpent >= phoneCap) break
    processed++
    if (t.phone || !kakaoKey || !t.address) continue
    phoneSpent++
    const k = await kakaoLocalLookup(kakaoKey, t.company_name, t.region, t.address, budget)
    if (k.phone) { await save(t.id, k.phone, null, null, 'kakao'); t.phone = k.phone }
  }
  // ── Phase 2: 이메일(비쌈, 좁게) — 실홈페이지 크롤 / 없으면 네이버로 홈페이지 발견 후 크롤 ──
  //   홈페이지 없는 보류 리드(상가정보 B2B 사무실 등)를 네이버 link/웹검색 발견으로 구제 → 이메일/전화 확보.
  for (const t of targets) {
    if (budget.left <= 2) break
    if (t.email) continue // 이미 이메일 있음
    let site = realSite(t.website)
    let discovered = false // 검색으로 발견한 사이트(등록 링크 아님) → 상호 존재 가드 필요
    if (!site && nvId && nvSecret && budget.left > 3) {
      const nv = await naverLocalLookup(nvId, nvSecret, t.company_name, t.region, t.address || '', budget)
      if (nv.website) site = nv.website // 지역검색 등록 링크(업체가 등록) — 신뢰
      if (!t.phone && nv.phone && t.address) { await save(t.id, nv.phone, null, nv.website, 'naver'); t.phone = nv.phone }
      // 지역검색에 홈페이지 없으면 웹문서 검색으로 발견(크롤 관문 확장 → 이메일↑). 제3자 도메인 제외 + 상호가드.
      if (!site && budget.left > 3) { site = await naverHomepageSearch(nvId, nvSecret, t.company_name, t.region, budget); discovered = !!site }
    }
    if (site && budget.left > 2) {
      const c = await crawlContact(site, budget, discovered ? t.company_name : undefined)
      if (c.email || (c.phone && !t.phone)) await save(t.id, t.phone ? null : c.phone, c.email, site, 'homepage')
    }
  }

  const rem = await DB.prepare("SELECT COUNT(*) AS n FROM ad_company_leads WHERE active = 0").first<{ n: number }>().catch(() => null)
  return { processed, enriched, remaining: Number(rem?.n) || 0 }
}

export interface CompanyCollectStats { last_run: string; found: number; saved: number; emailed?: number; keywords: string[]; cursor: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string } }
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

  const active = await DB.prepare('SELECT id, keyword, category, subcategory, region, tier FROM ad_company_keywords WHERE active = 1 ORDER BY id ASC').all<CompanyKeyword>().catch(() => null)
  const kws = active?.results || []
  if (!kws.length) {
    const s: CompanyCollectStats = { last_run: stamp, found: 0, saved: 0, keywords: [], cursor: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: true } }
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
    return s
  }

  const batch = Math.min(kws.length, Math.max(1, parseInt(env.ADS_COMPANY_BATCH || '', 10) || 8))
  const requireContact = env.ADS_COMPANY_REQUIRE_CONTACT !== 'false' // 기본 ON — 연락처 없는 리드는 보류.
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
    // 🌐 tier1(대행사·창업생태계) 키워드는 **웹문서 검색 병행** — 지도 미등록 대행사를 자체 사이트로 발굴
    //   (대표 "대행사 많이 모집" — 대행사는 웹이 주 서식지, 사이트 크롤로 이메일 수율 최고).
    if (kw.tier === 1 && !outOfBudget(budget)) {
      const webLeads = await searchNaverWeb(clientId, clientSecret, kw, budget)
      leads.push(...webLeads)
    }
    found += leads.length
    // 연락처 필수(기본 ON): 전화·이메일 없는 리드는 active=0(보류) 로 저장 → 보강이 채우면 승격.
    const n = await saveCompanyLeads(DB, leads, { requireContact }).catch(() => 0)
    saved += n
    await DB.prepare("UPDATE ad_company_keywords SET found_total = found_total + ?, saved_total = saved_total + ?, last_run_at = datetime('now') WHERE id = ?")
      .bind(leads.length, n, kw.id).run().catch(() => null)
  }

  // 📧 이메일 보충(옵션 a) — 홈페이지 있고 이메일 없는 최근 리드를 예산 내에서 크롤. phone-first 위 additive.
  let emailed = 0
  if (!outOfBudget(budget)) {
    // 대행사(tier 1)는 phone 보다 이메일 접촉이 핵심 → 이메일 크롤 우선(대표 "2단계 이메일 크롤 우선").
    const targets = (await DB.prepare("SELECT id, website FROM ad_company_leads WHERE source = 'local' AND website IS NOT NULL AND website != '' AND (email IS NULL OR email = '') ORDER BY (CASE WHEN tier = 1 THEN 0 ELSE 1 END), id DESC LIMIT 15")
      .all<{ id: number; website: string }>().catch(() => null))?.results || []
    for (const t of targets) {
      if (outOfBudget(budget)) break
      const email = await crawlCompanyEmail(t.website, budget)
      if (email) {
        // 이메일 확보 → 연락처 생김 → active=1 승격("연락처 필수" 정책).
        const r = await DB.prepare("UPDATE ad_company_leads SET email = ?, active = 1 WHERE id = ? AND (email IS NULL OR email = '')").bind(email, t.id).run().catch(() => null)
        if (((r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0) emailed++
      }
    }
  }
  const nextCursor = (cursor + batch) % kws.length

  const s: CompanyCollectStats = {
    last_run: stamp, found, saved, emailed, keywords: used, cursor: nextCursor,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    diag: { configured: true },
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(nextCursor)).run().catch(() => null)
  return s
}
