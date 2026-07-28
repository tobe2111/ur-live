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
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap } from './collect-budget'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'

// 서브리퀘스트 예산 헬퍼(influencer-discovery 내부와 동일 — 그쪽은 미export 라 인라인).
const outOfBudget = (b?: FetchBudget) => !!b && (b.left <= 0 || (!!b.deadline && Date.now() >= b.deadline))
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
  { kw: '주류 도매', category: '식자재·납품', subcategory: '주류 도매', tier: 2 },
  { kw: '주류도매상', category: '식자재·납품', subcategory: '주류도매상', tier: 2 },
  { kw: '식자재 유통', category: '식자재·납품', subcategory: '식자재 유통', tier: 2 },
  { kw: '업소용 식자재', category: '식자재·납품', subcategory: '업소용 식자재', tier: 2 },
  { kw: '식자재 마트', category: '식자재·납품', subcategory: '식자재 마트', tier: 2 },
  { kw: '커피 원두 납품', category: '식자재·납품', subcategory: '커피 원두 납품', tier: 2 },
  { kw: '상가 전문 부동산', category: '부동산', subcategory: '상가부동산', tier: 3 },
  { kw: '상가 임대', category: '부동산', subcategory: '상가부동산', tier: 3 },
  { kw: '간판 제작', category: '간판', subcategory: '간판·광고물 제작', tier: 3 },
  { kw: '상업 인테리어', category: '인테리어', subcategory: '인테리어·시공', tier: 3 },
  { kw: '주방설비', category: '인테리어', subcategory: '주방설비', tier: 3 },
  { kw: '포스 대리점', category: 'POS·단말기', subcategory: '포스 대리점', tier: 4 },
  { kw: '카드단말기', category: 'POS·단말기', subcategory: '카드단말기', tier: 4 },
  { kw: 'VAN 대리점', category: 'POS·단말기', subcategory: 'VAN 대리점', tier: 4 },
  { kw: '키오스크 설치', category: 'POS·단말기', subcategory: '키오스크 설치', tier: 4 },
  { kw: '테이블오더', category: 'POS·단말기', subcategory: '테이블오더', tier: 4 },
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
  { kw: '창업 컨설팅', category: '창업', subcategory: '창업 컨설팅', tier: 1 },
  { kw: '상권분석', category: '창업', subcategory: '상권분석', tier: 1 },
  // 🎯 2026-07-27 대표 "아인종합기획과 유사한 업체" — 지역 **종합광고기획사** 어휘(광고기획·판촉·인쇄·행사).
  //   소상공인을 실제로 상대하는 오프라인 대행 생태계 — 온라인 마케팅 어휘만으론 못 긁던 본류.
  { kw: '종합광고기획', category: '대행사', subcategory: '종합광고기획', tier: 1 },
  { kw: '광고기획사', category: '대행사', subcategory: '종합광고기획', tier: 1 },
  { kw: '광고대행사', category: '대행사', subcategory: '마케팅 대행사', tier: 1 },
  { kw: '이벤트 대행사', category: '대행사', subcategory: '행사·이벤트', tier: 1 },
  { kw: '행사 대행', category: '대행사', subcategory: '행사·이벤트', tier: 1 },
  { kw: '판촉물 제작', category: '간판', subcategory: '간판·광고물 제작', tier: 2 },
  { kw: '옥외광고', category: '간판', subcategory: '간판·광고물 제작', tier: 2 },
  { kw: '인쇄기획', category: '간판', subcategory: '간판·광고물 제작', tier: 2 },
  // 간판·현수막을 전국 그리드로 승격(기존 S1 4개 지역 한정 → 아인종합기획형이 그 밖이면 미발굴이던 갭)
  { kw: '간판 제작', category: '간판', subcategory: '간판·광고물 제작', tier: 2 },
  { kw: '현수막 제작', category: '간판', subcategory: '간판·광고물 제작', tier: 2 },
]

/** 🟡 카카오 로컬 수집 레인(2026-07-27) — 네이버 지역검색은 키워드당 5건 한도인데 카카오는 **15건×3페이지=45건**
 *   + 전화·주소가 응답에 직접 실림(무료 일 10만 쿼터, 네이버와 별도). 아인종합기획형(지도 등록 오프라인 업체)
 *   발굴량의 주력 레버. place_url 은 지도페이지라 website 로 저장하지 않음(크롤 불가 — realSite 규칙과 일치). */
async function searchKakaoLocal(kakaoKey: string, kw: CompanyKeyword, budget?: FetchBudget): Promise<CompanyLead[]> {
  if (!kakaoKey) return []
  const out: CompanyLead[] = []
  for (let page = 1; page <= 3; page++) {
    if (outOfBudget(budget)) break
    spendBudget(budget)
    const url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(kw.keyword)}&size=15&page=${page}`
    const res = await fetch(url, { headers: { Authorization: `KakaoAK ${kakaoKey}` }, signal: AbortSignal.timeout(12000) }).catch(() => null)
    if (!res || !res.ok) break
    const data = await res.json().catch(() => null) as { documents?: Array<{ place_name?: string; phone?: string; road_address_name?: string; address_name?: string; category_name?: string }>; meta?: { is_end?: boolean } } | null
    for (const d of (data?.documents || [])) {
      const name = stripTag(d.place_name)
      if (name.length < 2) continue
      out.push({
        company_name: name, category: kw.category, subcategory: kw.subcategory, tier: kw.tier, region: kw.region,
        phone: (d.phone || '').trim() || null,
        address: stripTag(d.road_address_name || d.address_name) || null,
        description: stripTag(d.category_name) || null, // 카카오 업종 경로("서비스,산업 > 광고,인쇄 > …") — 분류 근거로 활용
        contact_source: (d.phone || '').trim() ? 'kakao' : null,
        source: 'local', source_keyword: kw.keyword,
      })
    }
    if (data?.meta?.is_end) break
  }
  return out
}

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
  const { THIRD_PARTY_HOST, NEWS_MEDIA_HOST } = await import('./contact-enrich')
  const { NON_BUSINESS_HOST } = await import('./company-classify')
  const url = `${NAVER_OPENAPI}/v1/search/webkr.json?query=${encodeURIComponent(kw.keyword)}&display=30`
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
    // 제3자/UGC + **정부·학교 도메인** 제외 — 구청 공고 페이지가 '대행사' 리드로 저장되던 오염원(2026-07-27 대표 신고).
    if (THIRD_PARTY_HOST.test(u.hostname) || NON_BUSINESS_HOST.test(u.hostname) || seen.has(host)) continue
    // 📰 언론사 = 기사제목 리드로 버리지 않고 **'미디어' 카테고리로 별도 수집**(2026-07-27 대표
    //   "언론사도 따로 수집을 하던가" — 지역 언론은 소상공인 접점 큰 잠재 광고제휴 파트너).
    //   이름은 도메인 placeholder(기사제목 오염 방지) → 보강 크롤 og:site_name 치유가 실명으로 교체.
    if (NEWS_MEDIA_HOST.test(u.hostname)) {
      seen.add(host)
      out.push({
        company_name: host, category: '미디어', subcategory: '지역신문·매거진', tier: 3, region: kw.region,
        website: u.origin, phone: null, email: null, address: null,
        description: stripTag(it.description).slice(0, 200) || null,
        source: 'webkr', source_keyword: kw.keyword,
      })
      continue
    }
    // 뉴스 기사 URL 제외(비언론 호스트의 기사 CMS 경로 — 보도자료/미디어 섹션 페이지는 업체 홈이 아님).
    if (/(\/news|\/article|articleview|newsview|\/press\/|\/media\/)/i.test((u.pathname + u.search).toLowerCase())) continue
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

// (구 crawlCompanyEmail 삭제 — 홈 1페이지만 보던 약한 크롤. 이제 전 경로가 crawlContact(contact-enrich SSOT,
//  root + /contact,/about + 홈 내 문의링크 추적) 하나로 통일 — 같은 업체를 두 함수가 다르게 크롤하던 드리프트 제거.)

// 📇 연락처 보강 레인은 `enrich-lane.ts` 로 분리(2026-07-28, 600줄 한도) — 기존 import 경로 유지용 re-export.
export { enrichHeldLeads } from './enrich-lane'

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

  const batch = Math.min(kws.length, Math.max(1, parseInt(env.ADS_COMPANY_BATCH || '', 10) || 12))
  const requireContact = env.ADS_COMPANY_REQUIRE_CONTACT !== 'false' // 기본 ON — 연락처 없는 리드는 보류.
  let cursor = prev?.cursor || 0
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0
  const budget: FetchBudget = { left: Math.max(5, parseInt(env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 110) } // 카카오 레인 추가로 60→110(12kw×4콜+webkr)

  let found = 0, saved = 0
  const used: string[] = []
  for (let i = 0; i < batch; i++) {
    if (outOfBudget(budget)) break
    const kw = kws[(cursor + i) % kws.length]
    used.push(kw.keyword)
    const leads = await searchNaverLocal(clientId, clientSecret, kw, budget)
    // 🟡 카카오 로컬 병행(45건/키워드 — 네이버 5건의 9배, 전화 직접) — 지도 등록 업체 발굴 주력.
    const kakaoKeyLane = env.KAKAO_REST_API_KEY || ''
    if (kakaoKeyLane && !outOfBudget(budget)) {
      const kkLeads = await searchKakaoLocal(kakaoKeyLane, kw, budget)
      leads.push(...kkLeads)
    }
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
  //   2026-07-27 최종 점검: ① source='local' 한정 → **webkr(웹검색 발굴 대행사 — 주력 레인) 포함**
  //   ② 홈 1페이지 크롤(crawlCompanyEmail) → **crawlContact**(root+/contact+홈 문의링크 추적)로 통일.
  let emailed = 0
  if (!outOfBudget(budget)) {
    const { crawlContact } = await import('./contact-enrich')
    // 대행사(tier 1)는 phone 보다 이메일 접촉이 핵심 → 이메일 크롤 우선(대표 "2단계 이메일 크롤 우선").
    const targets = (await DB.prepare("SELECT id, website, phone, category FROM ad_company_leads WHERE source IN ('local','webkr') AND website IS NOT NULL AND website != '' AND (email IS NULL OR email = '') ORDER BY (CASE WHEN tier = 1 THEN 0 ELSE 1 END), id DESC LIMIT 15")
      .all<{ id: number; website: string; phone: string | null; category: string | null }>().catch(() => null))?.results || []
    for (const t of targets) {
      if (outOfBudget(budget)) break
      const c = await crawlContact(t.website, budget, undefined, t.category === '미디어') // 등록/자체 사이트라 requireName 불필요(발견 사이트만 가드)
      if (c.email || (c.phone && !t.phone)) {
        // 이메일(또는 없던 전화) 확보 → 연락처 생김 → active=1 승격("연락처 필수" 정책). 기존값 보존 COALESCE.
        const r = await DB.prepare("UPDATE ad_company_leads SET email = COALESCE(email, ?), phone = COALESCE(phone, ?), contact_source = COALESCE(contact_source, 'homepage'), active = 1 WHERE id = ?")
          .bind(c.email, c.phone, t.id).run().catch(() => null)
        if (c.email && ((r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0) emailed++
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

/* ── ☎️ 카카오 전용 전화 스윕(2026-07-27 대표 "더 빠르고 정확히는?") ──────────────────
 *   보류 10만+ 의 대부분은 오프라인 업체 = 목표가 **전화**인데, 통합 보강은 예산 1/3 만 전화에 써서
 *   카카오 무료 쿼터(10만/일)가 크게 놀았음. 이 레인은 카카오만(1건=1콜, 네이버·크롤 무접촉) 대량 순회:
 *   시간당 기본 600건 → 일 1.4만+ — 보류 전화 1차 순회를 단독으로 ~일주일에 끝냄.
 *   id 커서 랩(한 바퀴 돌면 0 리셋) — enrich_checked_at 무접촉(이메일 보강 흐름과 독립).
 *   허위 0: kakaoLocalLookup 은 상호+주소 매칭 실패 시 null(기존 SSOT 그대로). */
export async function runKakaoPhoneSweep(env: Env): Promise<{ scanned: number; found: number; cursor: number; done: boolean }> {
  const DB = env.DB
  await ensureCompanySchema(DB)
  const { kakaoLocalLookup } = await import('./contact-enrich')
  const key = env.KAKAO_REST_API_KEY || ''
  const CUR = 'ads_kakao_sweep_cursor'
  if (!key) return { scanned: 0, found: 0, cursor: 0, done: false }
  const cap = Math.min(600, Math.max(50, parseInt((env as unknown as { ADS_KAKAO_SWEEP_CAP?: string }).ADS_KAKAO_SWEEP_CAP || '', 10) || 600))
  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CUR).first<{ value: string }>().catch(() => null)
  let cursor = parseInt(curRaw?.value || '0', 10); if (!Number.isFinite(cursor) || cursor < 0) cursor = 0
  const rows = (await DB.prepare(
    `SELECT id, company_name, region, address FROM ad_company_leads
     WHERE id > ? AND (phone IS NULL OR phone = '') AND address IS NOT NULL AND address != '' ORDER BY id ASC LIMIT ?`)
    .bind(cursor, cap).all<{ id: number; company_name: string; region: string | null; address: string }>().catch(() => null))?.results || []
  if (!rows.length) { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CUR, '0').run().catch(() => null); return { scanned: 0, found: 0, cursor: 0, done: true } }
  // 🩹 2026-07-28 근본수리(실측: "주소는 있는데 전화가 없는" 리드 1만+): 이 스윕은 예산 객체를 안 넘겨
  //   회당 600 fetch 를 무통제로 쏘았고, 서브리퀘스트 한도를 넘으면 이후 조회가 전부 조용히 실패했다.
  //   그런데 커서는 **무조건 마지막 행까지 전진**해서, 한 건도 못 받은 라운드의 600건이 통째로 건너뛰어졌다
  //   (`id > cursor` 라 커서가 한 바퀴 돌 때까지 영구 방치 — 백로그 규모상 8일+). 스윕이 '지나갔지만
  //   실제로는 조회한 적 없는' 행이 계속 쌓인 이유. → ① 학습 상한 안에서만 쏘고 ② **실제 처리한 행까지만
  //   커서를 전진**시킨다(시도 못 한 행은 다음 라운드에 다시 잡히게).
  const learnedCap = Math.max(0, parseInt((await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(subreqCapKey('kakao_sweep'))
    .first<{ value: string }>().catch(() => null))?.value || '', 10) || 0)
  const budget: FetchBudget = { left: resolveSubreqBudget(cap, learnedCap) }
  let found = 0, lastDone = cursor
  for (const r of rows) {
    if (budget.left <= 0 || budget.limitHit) break // 여기서 멈추면 남은 행은 커서가 안 넘어가 다음 라운드 대상
    const k = await kakaoLocalLookup(key, r.company_name, r.region, r.address, budget)
    if (budget.limitHit) break // 한도 도달 — 이 행은 조회된 적 없으므로 커서를 전진시키지 않는다
    lastDone = r.id
    if (k.phone) {
      found++
      await DB.prepare("UPDATE ad_company_leads SET phone = COALESCE(phone, ?), contact_source = COALESCE(contact_source, 'kakao'), active = 1 WHERE id = ?")
        .bind(k.phone, r.id).run().catch(() => null)
    }
  }
  const nextCap = nextSubreqCap(budget.left <= 0 ? cap : cap - budget.left, !!budget.limitHit, budget.left <= 0, learnedCap, cap)
  if (nextCap != null) await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(subreqCapKey('kakao_sweep'), String(nextCap)).run().catch(() => null)
  const nextCursor = lastDone
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CUR, String(nextCursor)).run().catch(() => null)
  const prevRaw = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_kakao_sweep_stats'").first<{ value: string }>().catch(() => null)
  let totalFound = 0; try { totalFound = Number((prevRaw?.value ? JSON.parse(prevRaw.value) : {}).total_found) || 0 } catch { /* 초기 */ }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind('ads_kakao_sweep_stats', JSON.stringify({
    last_run: new Date().toISOString().slice(0, 19).replace('T', ' '), scanned: rows.length, found, cursor: nextCursor, total_found: totalFound + found,
    limit_hit: !!budget.limitHit, // 한도로 조기 중단했는가 — true 면 남은 행은 커서 미전진(다음 라운드 재시도)
  })).run().catch(() => null)
  return { scanned: rows.length, found, cursor: nextCursor, done: false }
}
