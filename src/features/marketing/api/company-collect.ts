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
import { subreqCapKey, resolveSubreqBudget, nextSubreqCap, envSubreqCap, envLaneBudget, envPlanValue, rowsWorthReading, companyRunDeadlineMs } from './collect-budget'
import { noteNaverCall, flushNaverCalls } from './naver-api-usage'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'
// 🗺️ 지역×업종 그리드는 `company-keyword-grid.ts` SSOT (2026-07-28 전국 시군구 전면 확장 시 분리).
import { buildKeywordRows, rotationWindow, resumeSeedIndex, seedPrefixHash } from './company-keyword-grid'

// 서브리퀘스트 예산 헬퍼(influencer-discovery 내부와 동일 — 그쪽은 미export 라 인라인).
const outOfBudget = (b?: FetchBudget) => !!b && (b.left <= 0 || (!!b.deadline && Date.now() >= b.deadline))
const spendBudget = (b?: FetchBudget) => { if (b) b.left -= 1 }

/**
 * 🚨 2026-07-28: 이 레인의 검색 fetch 3종이 전부 `.catch(() => null)` 로 **플랫폼 한도 오류를 삼켰다**.
 *   "Too many subrequests" 가 나도 그냥 빈 결과로 보여서, 라운드 중간에 한도를 넘으면 **남은 키워드가
 *   조용히 0건**이 되고 아무 신호도 안 남는다(집계만 보면 "그 키워드는 결과가 없었나 보다" 로 읽힌다).
 *   → 한도 신호를 잡아 `budget.limitHit` 을 세우고, 상태줄(diag)에 노출해 판독 가능하게 한다.
 *   ⚠️ 이 레인은 학습 상한을 쓰지 않지만(고정 예산), limitHit 이 서면 루프가 즉시 멈춰 헛돈을 막는다.
 */
async function laneFetch(url: string, init: RequestInit & { timeoutMs?: number }, budget?: FetchBudget): Promise<Response | null> {
  const { timeoutMs = 12000, ...rest } = init
  noteNaverCall(url) // 📟 네이버 오픈API 계측(호스트 아니면 no-op) — 실패분도 쿼터를 먹으므로 호출 전에 센다
  try {
    return await fetch(url, { ...rest, signal: AbortSignal.timeout(timeoutMs) })
  } catch (err) {
    const msg = String((err as { message?: string } | null)?.message || '')
    if (/too many subrequests/i.test(msg) && budget) budget.limitHit = true
    return null
  }
}

/**
 * 📍 실제 소재지에서 지역을 뽑는다 — **키워드 지역을 그대로 박으면 안 된다**.
 *
 *   실사고(2026-07-28 실측): 카카오 지도는 "중랑 행사 대행" 검색에 중랑에 없는 업체도 반환한다.
 *   그런데 `region: kw.region` 으로 키워드 지역을 박아 넣어, **같은 업체(전화번호까지 동일)가
 *   8개 구 키워드에서 각각 저장**됐다 — dedup 키가 `n:이름|지역` 이라 지역이 갈리면 별개 행이 된다.
 *   표본 2,000행에서 **회사명 중복 38.4%**(326개 업체가 768행), 중복군의 85%가 region 차이였다.
 *   ⚠️ 지역이 31→235 로 늘어난 지금 그대로 두면 중복이 배수로 폭증한다.
 *   → 주소가 있으면 주소에서 도출(진실), 없을 때만 키워드 지역으로 폴백.
 */
export function regionFromAddress(addr: string | null | undefined, fallback: string | null): string | null {
  const hits = [...String(addr || '').matchAll(/([가-힣]{2,10}?)(시|군|구)(?:\s|$)/g)]
    .map(m => m[1].replace(/특별|광역|자치/g, '').slice(0, 20))
    .filter(Boolean)
  if (!hits.length) return fallback
  // 서울은 **구 단위**가 키워드 어휘라 '서울'로 뭉개면 granularity 를 잃는다(강북/성북/…).
  //   그 외(광역시·도)는 첫 매치가 곧 시 이름이고 그게 키워드 어휘와 맞는다(부산/성남/춘천…).
  if (hits[0] === '서울' && hits.length > 1) return hits[1]
  return hits[0]
}

const NAVER_OPENAPI = 'https://openapi.naver.com'
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()

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
    const res = await laneFetch(url, { headers: { Authorization: `KakaoAK ${kakaoKey}` } }, budget)
    if (!res || !res.ok) break
    const data = await res.json().catch(() => null) as { documents?: Array<{ place_name?: string; phone?: string; road_address_name?: string; address_name?: string; category_name?: string }>; meta?: { is_end?: boolean } } | null
    for (const d of (data?.documents || [])) {
      const name = stripTag(d.place_name)
      if (name.length < 2) continue
      const addr = stripTag(d.road_address_name || d.address_name) || null
      out.push({
        company_name: name, category: kw.category, subcategory: kw.subcategory, tier: kw.tier,
        region: regionFromAddress(addr, kw.region), // 키워드 지역이 아니라 실제 소재지 — 중복 폭증 방지
        phone: (d.phone || '').trim() || null,
        address: addr,
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

/** 키워드 시드 버전 — 그리드(지역/업종)를 늘렸으면 +1 해야 기존 배포에 새 키워드가 들어간다. */
const KEYWORD_SEED_VERSION = 3 // 2026-07-29: 공동구매 생태계 추가(창고형 ×235 지역 + 전국 총판·벤더 8)
const KEYWORD_SEED_KEY = 'ads_company_kw_seed'
const KEYWORD_SEED_CHUNK = 500 // 1회 실행당 시드 상한(=5 batch) — 첫 시드가 수집 예산을 잡아먹지 않게

const _kwDone = new WeakSet<object>()
/** @returns 이번 호출이 **실제로 쓴 D1 쿼리 수** — 시드도 서브리퀘스트를 쓴다. 호출부가 예산에서 빼야
 *  시드 라운드에만 조용히 천장을 넘는 일이 없다(2026-07-29: 시드 5배치 + 예산 45 = 50 = 무료 한도 정확히). */
export async function ensureCompanyKeywords(DB: D1Database): Promise<number> {
  if (_kwDone.has(DB)) return 0
  _kwDone.add(DB)
  let spent = 0
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
  spent += 2
  // ⚠️ 2026-07-28 전국 시군구 전면 확장(31→235 지역, 시드 3,800행+) — 예전처럼 **매 실행마다 전량 재시드**하면
  //   실행당 39 batch 가 되어 서브리퀘스트를 통째로 잡아먹는다(수집할 예산이 안 남음). 그래서
  //   ① 버전 게이트로 완료 후엔 platform_settings 조회 1회로 끝내고 ② 첫 시드는 회당 SEED_CHUNK 행씩 나눠 넣는다.
  //   진행값 형식 `"<version>:<seededCount>"` — 중단/재개 안전(INSERT OR IGNORE 라 재실행 무해).
  const rows = buildKeywordRows()
  const cur = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(KEYWORD_SEED_KEY).first<{ value: string }>().catch(() => null)
  //   ③ 버전이 올라도 **앞부분이 그대로면 이어받는다**(2026-07-29) — 새 키워드는 배열 끝에 붙는데
  //      매번 0 부터 다시 훑으면 회당 500행 × 10회 = 반나절 뒤에야 새 업종이 들어간다(앞 3,600행은 무변화인데).
  //      지문이 어긋나면(재정렬·삭제) 안전하게 0 으로 — 덧붙이기라고 *가정*하지 않는다. 상세는 grid 파일 주석.
  spent += 1 // 위 진행값 SELECT
  let done = resumeSeedIndex(cur?.value, KEYWORD_SEED_VERSION, rows)
  if (done >= rows.length) {
    // 이어받아 이미 완료 상태면 진행값만 새 버전으로 각인(다음 실행부터 조회 1회로 종료).
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
      .bind(KEYWORD_SEED_KEY, `${KEYWORD_SEED_VERSION}:${done}:${seedPrefixHash(rows, done)}`).run().catch(() => null)
    return spent + 1
  }
  const end = Math.min(rows.length, done + KEYWORD_SEED_CHUNK)
  for (let i = done; i < end; i += 100) {
    const stmts = rows.slice(i, Math.min(end, i + 100)).map(r => DB.prepare("INSERT OR IGNORE INTO ad_company_keywords (keyword, category, subcategory, region, tier, active, source) VALUES (?, ?, ?, ?, ?, 1, 'seed')")
      .bind(r.keyword, r.category, r.subcategory, r.region, r.tier))
    await DB.batch(stmts).catch(() => null)
    spent += 1
  }
  done = end
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(KEYWORD_SEED_KEY, `${KEYWORD_SEED_VERSION}:${done}:${seedPrefixHash(rows, done)}`).run().catch(() => null)
  return spent + 1
}

export async function listCompanyKeywords(DB: D1Database): Promise<Array<CompanyKeyword & { active: number; found_total: number; saved_total: number; last_run_at: string | null }>> {
  await ensureCompanyKeywords(DB)
  // ⚠️ 전국 확장(3,800개+) 후 LIMIT 1000 이면 어드민 화면에서 뒤쪽 키워드가 조용히 안 보인다.
  //   (수집 회전은 별도 쿼리라 영향 없음 — 이건 표시 전용.)
  const r = await DB.prepare('SELECT id, keyword, category, subcategory, region, tier, active, found_total, saved_total, last_run_at FROM ad_company_keywords ORDER BY active DESC, (tier IS NULL) ASC, tier ASC, saved_total DESC, id ASC LIMIT 5000')
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

/**
 * 키워드 on/off — **수집 대상**만 바꾼다(이미 모인 리드는 그대로).
 * ⚠️ 존재하지 않는 id 면 `ok:false` 로 알린다. `.run()` 결과의 `meta.changes` 로 판정하는 이유는,
 *   조용히 성공을 반환하면 화면이 "껐다"고 표시하는데 실제로는 아무것도 안 꺼진 상태가 되기 때문이다
 *   (이 레포가 반복해 만난 "실패가 아니라 조용한 부재" 클래스).
 */
export async function setCompanyKeywordActive(DB: D1Database, id: number, active: 0 | 1): Promise<{ ok: boolean; error?: string }> {
  await ensureCompanyKeywords(DB)
  const r = await DB.prepare('UPDATE ad_company_keywords SET active = ? WHERE id = ?').bind(active, id).run().catch(() => null)
  return r?.meta?.changes ? { ok: true } : { ok: false, error: 'NOT_FOUND' }
}

/** 네이버 지역검색(local.json) 1키워드 → CompanyLead[]. display 최대 5(네이버 로컬 API 제약). */
async function searchNaverLocal(clientId: string, clientSecret: string, kw: CompanyKeyword, budget?: FetchBudget): Promise<CompanyLead[]> {
  if (outOfBudget(budget)) return []
  spendBudget(budget)
  const url = `${NAVER_OPENAPI}/v1/search/local.json?query=${encodeURIComponent(kw.keyword)}&display=5&sort=random`
  const res = await laneFetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret } }, budget)
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
      region: regionFromAddress(it.roadAddress || it.address, kw.region), // 실제 소재지 우선(중복 방지)
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
async function searchNaverWeb(clientId: string, clientSecret: string, kw: CompanyKeyword, budget?: FetchBudget, pages = 1): Promise<CompanyLead[]> {
  if (outOfBudget(budget)) return []
  const { THIRD_PARTY_HOST, NEWS_MEDIA_HOST } = await import('./contact-enrich')
  const { NON_BUSINESS_HOST } = await import('./company-classify')
  // 📄 2026-07-28: 이 레인이 **이메일 수율 최고**(라이브 실측 webkr 75% vs 지도 2%)인데 1페이지(30건)만 봤다.
  //   start=1,31,61… 로 더 깊게 판다. dedup(seen)이 페이지 간에도 유지돼 중복 도메인은 1건으로 접힌다.
  const items: Array<{ title?: string; link?: string; description?: string }> = []
  for (let p = 0; p < Math.max(1, pages); p++) {
    if (outOfBudget(budget)) break
    spendBudget(budget)
    const url = `${NAVER_OPENAPI}/v1/search/webkr.json?query=${encodeURIComponent(kw.keyword)}&display=30&start=${p * 30 + 1}`
    const res = await laneFetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret } }, budget)
    if (!res || !res.ok) break
    const data = (await res.json().catch(() => null)) as { items?: Array<{ title?: string; link?: string; description?: string }> } | null
    const got = data?.items || []
    items.push(...got)
    if (got.length < 30) break // 마지막 페이지
  }
  const out: CompanyLead[] = []
  const seen = new Set<string>()
  for (const it of items) {
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

export interface CompanyCollectStats { last_run: string; found: number; saved: number; emailed?: number; keywords: string[]; cursor: number; total_runs: number; total_saved: number; total_keywords?: number; spent?: number; limit_hit?: boolean; run_ms?: number; deadline_hit?: boolean; diag: { configured: boolean; error?: string } }
const STATS_KEY = 'ads_company_stats'
const CURSOR_KEY = 'ads_company_cursor'

/** 한 번의 업체 자동수집(cron 홀수시 틱 또는 수동). 게이트 체크는 호출부. 커서 순환으로 며칠에 걸쳐 전 키워드 커버. */
export async function runCompanyAutoCollect(env: Env): Promise<CompanyCollectStats> {
  const DB = env.DB
  const schemaSpent = await ensureCompanySchema(DB) // 스키마 DDL 실비 — 아래 예산에서 차감
  const seedSpent = await ensureCompanyKeywords(DB)
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

  // 🔁 커서 회전 — 전국 확장으로 키워드가 수천 개라 **전량 로드 대신 OFFSET 창**만 읽는다.
  //   정렬은 `tier ASC, id ASC`(둘 다 불변) — 안정 정렬이라야 OFFSET 창에 건너뜀/중복이 없다.
  //   ⚠️ tier 우선인 이유: 새로 추가된 전국 지역의 tier1(대행사) 키워드가 id 기준으로는 전부 뒤에 붙어
  //   한 바퀴(수천 개)를 다 돈 뒤에야 도달한다 — 대행사가 목표인데 2주를 기다리게 된다.
  const totalRow = await DB.prepare('SELECT COUNT(*) AS n FROM ad_company_keywords WHERE active = 1').first<{ n: number }>().catch(() => null)
  const total = Number(totalRow?.n) || 0
  let cursor = prev?.cursor || 0
  if (!Number.isFinite(cursor) || cursor < 0) cursor = 0
  const batchSize = Math.max(1, parseInt(env.ADS_COMPANY_BATCH || '', 10) || 12)
  const kws: CompanyKeyword[] = []
  for (const w of rotationWindow(total, cursor, batchSize)) {
    const rs = await DB.prepare('SELECT id, keyword, category, subcategory, region, tier FROM ad_company_keywords WHERE active = 1 ORDER BY (tier IS NULL) ASC, tier ASC, id ASC LIMIT ? OFFSET ?')
      .bind(w.limit, w.offset).all<CompanyKeyword>().catch(() => null)
    kws.push(...(rs?.results || []))
  }
  if (!kws.length) {
    // ⚠️ 커서를 0 으로 되감지 않는다 — D1 일시 실패로 창이 비었을 뿐인데 리셋하면 진행분(수천 키워드)을 잃는다.
    const s: CompanyCollectStats = { last_run: stamp, found: 0, saved: 0, keywords: [], cursor, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: true } }
    await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
    return s
  }

  const batch = kws.length // 회전 창이 이미 batchSize 만큼(끝에서 감김 포함) 읽어왔다
  const requireContact = env.ADS_COMPANY_REQUIRE_CONTACT !== 'false' // 기본 ON — 연락처 없는 리드는 보류.
  // 시작값을 상수로 고정 — 소비량을 다른 기준으로 재면 백오프/관측이 통째로 틀어진다(2026-07-28 kakao_sweep 실사고).
  const envBudgetRaw = Math.max(5, envLaneBudget(env.ADS_COMPANY_SUBREQUEST_BUDGET, 110, env)) // 카카오 레인 추가로 60→110(12kw×4콜+webkr)
  // 🧱 2026-07-29 — 이 레인만 **천장도 학습도 없이** 110 을 그대로 썼다(무료 플랜 인보케이션 한도는 50).
  //   그래서 매 라운드 후반 fetch 가 조용히 전멸했고, 학습 루프가 없어 그 사실이 어디에도 안 남았다.
  //   ⚠️ 시드 비용도 뺀다 — 시드가 도는 라운드에만 천장을 넘는 '가끔 죽는' 패턴은 원인 규명이 가장 어렵다.
  const budgetTotal = Math.max(1, Math.min(envBudgetRaw, envSubreqCap(env)) - seedSpent - schemaSpent)
  const budget: FetchBudget = { left: budgetTotal }

  let found = 0, saved = 0
  const used: string[] = []
  // ⏱️ 회차 벽시계 마감선 — 실측 27,410ms(사망선 26,000 초과인데 "성공"). 근거·한계·커버리지 불변식은 `companyRunDeadlineMs` 헤더.
  const startedAt = Date.now(), runDeadlineMs = companyRunDeadlineMs(env)
  for (let i = 0; i < batch; i++) {
    if (outOfBudget(budget) || budget.limitHit || Date.now() - startedAt > runDeadlineMs) break // 한도/마감 도달 시 즉시 중단
    const kw = kws[i]
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
    //   ⚠️ 2026-07-28: 이 조건이 `kw.tier === 1` 이라 **대행사만 웹을 봤다** → 나머지 카테고리는 전량 지도
    //   전용 = 사이트 미보유 = 이메일 구조적 0. 라이브 실측이 정확히 그 모양이었다:
    //   간판 2,448행 중 이메일 **2건(0.1%)** · 부동산/POS 0% · 전문서비스 3.9%.
    //   (반면 온라인판매 99.6% 는 크롤 성과가 아니라 통신판매 등록부가 대표이메일을 직접 주기 때문.)
    //   간판·판촉물·인쇄·현수막(tier2)은 대행사와 같은 생태계라 자체 사이트 보유율이 높다 → tier2 까지 확장.
    //   깊이는 tier1 만 여러 페이지(수율 최고 레인), tier2 는 1페이지로 예산을 아낀다.
    const webTierMax = Math.min(5, Math.max(1, parseInt(env.ADS_COMPANY_WEB_TIER_MAX || '', 10) || 2))
    if ((kw.tier ?? 9) <= webTierMax && !outOfBudget(budget)) {
      const deepPages = Math.min(5, Math.max(1, parseInt(env.ADS_COMPANY_WEB_PAGES || '', 10) || 2))
      const webPages = kw.tier === 1 ? deepPages : 1
      const webLeads = await searchNaverWeb(clientId, clientSecret, kw, budget, webPages)
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
  if (!outOfBudget(budget) && Date.now() - startedAt < runDeadlineMs) {
    const { crawlContact, CRAWL_RULES_VERSION, realSite, PLATFORM_URL_SQL_EXCLUDE } = await import('./contact-enrich')
    // 대행사(tier 1)는 phone 보다 이메일 접촉이 핵심 → 이메일 크롤 우선(대표 "2단계 이메일 크롤 우선").
    // 🔁 2026-07-28 재시도 쿨다운 추가 — 보강 레인(enrich-lane:75)이 이미 쓰는 패턴인데 이 블록만 빠져 있었다.
    //   쿨다운이 없으면 이메일이 안 나온 리드가 `email IS NULL` 이라 **다음 회차에도 또 선두**에 온다 →
    //   매시간 같은 15건을 다시 크롤(회당 최대 ~45 서브리퀘스트를 통째로 낭비)하고, 그 아래로 밀린 백로그는
    //   **영영 도달하지 못한다**. 시도 즉시 도장(성공·실패 무관) + 7일 쿨다운으로 예산이 백로그를 흐르게 한다.
    //   ⚠️ 전국 확장으로 사이트 보유 리드가 급증하면 이 낭비가 그대로 커진다(그래서 지금 고친다).
    // 🚮 크롤 불가 URL(인스타·블로그·카페·유튜브·구인 플랫폼)을 **선정 단계에서** 제외한다.
    //   실측(2026-07-28): 사이트 보유 행의 22.9% 가 이런 플랫폼 URL — 크롤해도 업체 이메일이 안 나온다.
    //   LIMIT 15 라 이런 URL 이 슬롯을 차지하면 **진짜 사이트가 영영 안 뽑힌다**(예산과 슬롯 이중 낭비).
    const platformNot = PLATFORM_URL_SQL_EXCLUDE.map(() => 'website NOT LIKE ?').join(' AND ')
    const targets = (await DB.prepare(`SELECT id, website, phone, category FROM ad_company_leads
        WHERE source IN ('local','webkr') AND merged_into IS NULL AND website IS NOT NULL AND website != '' AND (email IS NULL OR email = '')
          AND (enrich_checked_at IS NULL OR enrich_checked_at < datetime('now', '-7 days') OR COALESCE(enrich_v, 0) < ${CRAWL_RULES_VERSION})
          AND ${platformNot}
        ORDER BY (CASE WHEN tier = 1 THEN 0 ELSE 1 END), id DESC LIMIT 15`)
      .bind(...PLATFORM_URL_SQL_EXCLUDE)
      .all<{ id: number; website: string; phone: string | null; category: string | null }>().catch(() => null))?.results || []
    // 도장은 크롤 **전에** 배치 1회 — 중간에 예산이 끊겨도 시도분이 앞줄에 다시 눌러앉지 않는다.
    if (targets.length) {
      const ids = targets.map(t => t.id).filter(n => Number.isFinite(n)).join(',')
      if (ids) await DB.prepare(`UPDATE ad_company_leads SET enrich_checked_at = datetime('now'), enrich_v = ${CRAWL_RULES_VERSION} WHERE id IN (${ids})`).run().catch(() => null)
    }
    for (const t of targets) {
      if (outOfBudget(budget) || budget.limitHit) break
      const site = realSite(t.website) // 최종 판정 — SQL LIKE 를 빠져나간 변종(서브도메인 등) 차단
      if (!site) continue
      const c = await crawlContact(site, budget, undefined, t.category === '미디어') // 등록/자체 사이트라 requireName 불필요(발견 사이트만 가드)
      if (c.email || (c.phone && !t.phone)) {
        // 이메일(또는 없던 전화) 확보 → 연락처 생김 → active=1 승격("연락처 필수" 정책). 기존값 보존 COALESCE.
        const r = await DB.prepare("UPDATE ad_company_leads SET email = COALESCE(email, ?), phone = COALESCE(phone, ?), contact_source = COALESCE(contact_source, 'homepage'), active = 1 WHERE id = ?")
          .bind(c.email, c.phone, t.id).run().catch(() => null)
        if (c.email && ((r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0) emailed++
      }
    }
  }
  /**
   * 커서는 **실제로 돈 만큼**만 전진한다(계획한 창 크기가 아니라). total 이 0 이면 0.
   *
   *   🚨 2026-08-02 실측으로 고친 것 — 전에는 `cursor + batch`(=계획 12)였다. 그런데 이 레인은
   *   거의 매 회차 예산이 먼저 마른다: `keywords 11개 · limit_hit true · spent 51`.
   *   **11개 돌고 12칸 전진**하면 못 돈 1개가 다음 회차로 넘어가는 게 아니라 **건너뛰어진다.**
   *   게다가 전진폭이 창 크기와 같아 창 경계가 `[0..11] [12..23] …` 로 **영원히 고정**된다 ⇒
   *   매 회전 **같은 자리**가 빠진다. 지연이 아니라 **영영 조회되지 않는 사각지대**다
   *   (4,546 키워드 기준 한 바퀴 379칸 — 그 자리들은 몇 달이 지나도 한 번도 안 돈다).
   *
   *   ⚠️ 소비량으로 감으면 창이 매 회전 **밀리므로** 모든 키워드가 결국 차례를 받는다. 그게 요점이다.
   *   ⚠️ `consumed === 0`(첫 키워드 전에 예산 고갈)이면 전진 0 — 맞는 동작이다. 아무것도 안 봤으니
   *      전진할 근거가 없다(전진시키면 안 본 것을 본 것으로 표시하게 된다).
   */
  const consumed = used.length
  const nextCursor = total > 0 ? (cursor + consumed) % total : 0

  const s: CompanyCollectStats = {
    last_run: stamp, found, saved, emailed, keywords: used, cursor: nextCursor,
    total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved,
    // 📊 관측 필드 — 예산이 실제로 얼마나 쓰였고 한도에 닿았는지, 전국 확장 후 한 바퀴가 얼마나 되는지.
    //   (전국 확장 + webkr 페이지네이션으로 키워드당 비용이 올라 예산이 먼저 마를 수 있다 → 눈에 보이게.)
    total_keywords: total, spent: budgetTotal - budget.left, limit_hit: !!budget.limitHit,
    run_ms: Date.now() - startedAt, deadline_hit: Date.now() - startedAt > runDeadlineMs,
    diag: { configured: true },
  }
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null)
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, String(nextCursor)).run().catch(() => null)
  // 📟 네이버 오픈API 사용량 flush — **쿼터는 앱 단위라 B2B 몫도 같은 통에 들어가야** 총계가 의미를 갖는다.
  //   여기서 안 비우면 이 인보케이션의 누적은 그대로 사라진다(아이솔레이트가 다르면 인플루언서 레인이 못 걷어간다).
  //   이 레인은 settings batch 가 없어 읽기1+쓰기1을 쓴다 — 누적 0이면 왕복도 0이다.
  await flushNaverCalls(DB, Date.now())
  return s
}

/* ── ☎️ 카카오 전용 전화 스윕(2026-07-27 대표 "더 빠르고 정확히는?") ──────────────────
 *   보류 10만+ 의 대부분은 오프라인 업체 = 목표가 **전화**인데, 통합 보강은 예산 1/3 만 전화에 써서
 *   카카오 무료 쿼터(10만/일)가 크게 놀았음. 이 레인은 카카오만(1건=1콜, 네이버·크롤 무접촉) 대량 순회:
 *   허위 0: kakaoLocalLookup 은 상호+주소 매칭 실패 시 null(기존 SSOT 그대로).
 *
 *   🎯 2026-07-28 **우선순위 전환** — 라이브 실측이 시킨 변경:
 *     tier1·2(실제 콜드 접촉할 풀) 5,218곳 중 전화 없는 행이 **2,594곳뿐**인데, 이 스윕은 `ORDER BY id ASC`
 *     로 12만 행을 **입고 순서대로** 훑고 있었다. 무료 플랜 실효 처리량이 시간당 ~50건이라 tier1 에 닿는 데
 *     몇 달이 걸린다("일주일이면 끝난다"던 위 주석은 600건/시간을 전제한 것으로, 그 전제가 틀렸다).
 *     → **tier 오름차순**으로 훑는다. tier1·2 는 이틀이면 채워지고, 접촉 가능 풀이 2,624 → 5,200 으로 2배가 된다.
 *
 *   🔁 진행 방식도 id 커서 → **시도 도장(`kakao_checked_at`) + 30일 쿨다운** 으로 바꾼다.
 *     id 커서는 정렬이 id 순일 때만 성립한다 — 우선순위 정렬과 함께 쓰면 커서가 tier1 을 지나쳐 버린다.
 *     도장 방식은 보강 레인(`enrich_checked_at`)이 이미 쓰는 검증된 패턴이고, 실패한 행이 앞줄을 영원히
 *     막지 않게 해준다(그 사고가 `check-crawl-cooldown` 가드의 유래다).
 *
 *   🧮 D1 도 서브리퀘스트다 — 예전엔 kakao fetch 만 세고 UPDATE 는 공짜로 쳤다(보강 레인에서 이미 고친 결함).
 *     도장·전화저장을 **배치 1회씩**으로 묶고 예산에 계상한다. */
/**
 * @returns `tried`/`limit_hit` 는 **self-chain 판정용**(2026-07-29) — 체인이 "진전이 있었나"를 알아야
 *   한 건도 못 한 라운드를 40번 반복하는 헛돌기를 막는다. `done`=대상 소진.
 */
/**
 * 🧾 **루프가 남겨야 하는 부기(簿記) 몫** — 2026-07-29 라이브 실측 후 정정.
 *
 * 루프 뒤에는 D1 쓰기/읽기가 **5회** 따라온다:
 *   ① 전화 확보분 배치 저장 ② 시도 도장 배치 ③ 학습 상한 갱신 ④ 직전 통계 조회 ⑤ **자기 스탬프**
 * 그런데 루프는 `left <= 2` 에서 멈췄다 — 2만 남기고 5를 쓰려 했으니 뒤쪽 3개가 예산 밖이다.
 * D1 도 서브리퀘스트라 예산을 넘기면 던지고, 전부 `.catch(() => null)` 이라 **조용히 사라진다.**
 * 그리고 하필 마지막이 자기 스탬프다 ⇒ **레인이 돌았는데 "안 돈 것"처럼 보인다.**
 *
 * 실측(2026-07-29): 이 레인은 매시간 디스패치되는데 `ads_kakao_sweep_stats.last_run` 이 13:01 에
 * 멈춰 있었다. 같은 블록의 `reclassify` 는 매시간 갱신됐다 — 차이는 그쪽이 예산을 안 쓴다는 것뿐이다.
 *
 * ⚠️ 이 상수는 **아래 실제 쓰기 횟수와 맞물려 있다.** 쓰기를 추가하면 이 값도 함께 올릴 것
 *   (안 올리면 또 조용히 마지막 것부터 잘린다 — 그게 이 주석이 존재하는 이유다).
 * ⚠️ 이것으로도 못 막는 경우: **플랫폼 한도**(`budget.limitHit`)를 실제로 친 회차는 이후 어떤
 *   서브리퀘스트도 못 쓴다. 그건 예약으로 해결되지 않는다(그래서 한도 자체를 학습해 낮춘다).
 */
const SWEEP_BOOKKEEPING_RESERVE = 6

/**
 * ⏱️ **회차 벽시계 마감선** (2026-08-03 — 대표 승인 "다른 고비용 레인도 같은 방식으로")
 *
 * 이 스윕은 실측 **31초**를 썼다(`cpu_risk=danger`, 침묵 목록 1위). 예산(`budget.left`)은
 * **요청 수**만 세는데, 카카오 조회 한 번의 *응답 시간*은 아무도 안 본다 — 예산이 남아 있는 한
 * 느린 응답이 계속 쌓여 부모 cron 의 CPU 를 태운다(`dispatch-budget.ts` 가 기록한 그 구조:
 * 부모가 죽으면 매달린 자식이 전부 끌려간다).
 *
 * ⚠️ **"기아 걱정 없다"던 옛 주석은 틀렸다**(2026-08-04 실측이 반증) — 도장은 시도분에만 찍히지만
 *   30일 쿨다운이 **한 바퀴(411일)보다 짧아** 앞줄이 계속 재적격됐다. 수리: 아래 `ORDER BY` 주석.
 */
const SWEEP_RUN_DEADLINE_MS = 12_000
const SWEEP_RUN_DEADLINE_MS_PAID = 24_000

export async function runKakaoPhoneSweep(env: Env): Promise<{ scanned: number; found: number; cursor: number; done: boolean; tried?: number; limit_hit?: boolean; day_lookups?: number }> {
  const DB = env.DB
  const schemaSpent = await ensureCompanySchema(DB) // 스키마 DDL 실비(아래 예산에서 차감)
  const { kakaoLocalLookup } = await import('./contact-enrich')
  const key = env.KAKAO_REST_API_KEY || ''
  if (!key) return { scanned: 0, found: 0, cursor: 0, done: false }
  const cap = Math.min(600, Math.max(50, parseInt((env as unknown as { ADS_KAKAO_SWEEP_CAP?: string }).ADS_KAKAO_SWEEP_CAP || '', 10) || 600))
  // 🩹 2026-07-28 근본수리(실측: "주소는 있는데 전화가 없는" 리드 1만+): 이 스윕은 예산 객체를 안 넘겨
  //   회당 600 fetch 를 무통제로 쏘았고, 서브리퀘스트 한도를 넘으면 이후 조회가 전부 조용히 실패했다.
  //   그런데 커서는 **무조건 마지막 행까지 전진**해서, 한 건도 못 받은 라운드의 600건이 통째로 건너뛰어졌다
  //   (`id > cursor` 라 커서가 한 바퀴 돌 때까지 영구 방치 — 백로그 규모상 8일+). 스윕이 '지나갔지만
  //   실제로는 조회한 적 없는' 행이 계속 쌓인 이유. → ① 학습 상한 안에서만 쏘고 ② **실제 처리한 행까지만
  //   커서를 전진**시킨다(시도 못 한 행은 다음 라운드에 다시 잡히게).
  const learnedCap = Math.max(0, parseInt((await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(subreqCapKey('kakao_sweep'))
    .first<{ value: string }>().catch(() => null))?.value || '', 10) || 0)
  // ⚠️ 2026-07-28: 예산은 `cap`(env 천장 600)이 아니라 **학습 상한과의 더 작은 쪽**에서 시작한다.
  //   소비량을 `cap - budget.left` 로 계산하면(예전 코드) 학습값 63 으로 시작했는데 600 기준으로 재서
  //   실제의 ~10배가 나온다 → 한도 오류 시 백오프가 `floor(590*0.8)=472` 로 **상한을 오히려 폭등**시켰다
  //   (되내려와야 할 안전판이 거꾸로 작동). 시작값을 명시 상수로 잡아 두 곳이 어긋날 수 없게 한다.
  // 🧱 플랫폼 천장 — 학습 상한이 이 값을 넘지 못한다(기본 60, 근거·조정법은 collect-budget 주석).
  const pcap = envSubreqCap(env)
  const budgetTotal = resolveSubreqBudget(cap, learnedCap, pcap)
  const budget: FetchBudget = { left: budgetTotal - schemaSpent }
  // 🧮 **예산이 못 쓸 행은 읽지도 않는다** (2026-08-04). 예전엔 `LIMIT cap`(최대 600)을 읽고 나서
  //   예산을 셌는데 천장이 무료 캡(기본 60)이라 시도 가능한 행은 ~50개뿐 — 550행은 역직렬화만
  //   되고 아래 `break` 에 버려졌다. 실측: 이 레인이 6,640ms 에 CPU 한도로 사망(벽시계 마감 12s 는
  //   닿지도 못했다 — CPU 는 벽시계를 못 넘으니 그건 대기가 아니라 계산이다).
  //   ⚠️ 대상 불변(잘린 꼬리는 원래 안 쓰던 행, 도장은 시도분에만). 근거·한계: `rowsWorthReading` 헤더.
  const rowCap = rowsWorthReading(budget.left - SWEEP_BOOKKEEPING_RESERVE, cap)
  // 🎯 정렬 = ① 미조회 → ② 연락처 없음 → ③ tier(접촉 가치) → id. 🩹 2026-08-04 기아 수리(실측: storeinfo
  //   17,979건이 주소를 갖고도 카카오 조회 **0건** — 앞의 tier4 12.9만을 하루 360조회로 지나는 데만 358일).
  //   ②는 이미 이메일 있는 리드에 희소한 조회를 안 쓰기 위함(목표는 조회 수가 아니라 *부를 수 있는 사람
  //   수*). tier 정의는 불변, 축만 늘렸다. 근거·한계: `tests/unit/kakao-sweep-order.test.ts`.
  const rows = (await DB.prepare(
    `SELECT id, company_name, region, address FROM ad_company_leads
     WHERE merged_into IS NULL AND (phone IS NULL OR phone = '') AND address IS NOT NULL AND address != ''
       AND (kakao_checked_at IS NULL OR kakao_checked_at < datetime('now', '-30 days'))
     ORDER BY (kakao_checked_at IS NOT NULL) ASC, (email IS NOT NULL AND email <> '') ASC, (tier IS NULL) ASC, tier ASC, id ASC LIMIT ?`)
    .bind(rowCap).all<{ id: number; company_name: string; region: string | null; address: string }>().catch(() => null))?.results || []
  if (!rows.length) return { scanned: 0, found: 0, cursor: 0, done: true }
  let found = 0
  const startedAt = Date.now()
  const runDeadlineMs = envPlanValue(undefined, SWEEP_RUN_DEADLINE_MS, SWEEP_RUN_DEADLINE_MS_PAID, env)
  let stoppedBy: string | undefined
  const tried: number[] = []                                   // 시도한 행 → 도장(배치 1회)
  const hits: Array<{ id: number; phone: string }> = []        // 전화 확보분 → 저장(배치 1회)
  for (const r of rows) {
    if (budget.left <= SWEEP_BOOKKEEPING_RESERVE || budget.limitHit) { stoppedBy = 'budget'; break } // 아래 부기 몫을 남겨둔다(상수 주석 참조)
    if (Date.now() - startedAt > runDeadlineMs) { stoppedBy = 'deadline'; break }
    const k = await kakaoLocalLookup(key, r.company_name, r.region, r.address, budget)
    if (budget.limitHit) break // 한도 도달 — 이 행은 조회된 적 없으므로 도장도 찍지 않는다(다음 라운드 재시도)
    tried.push(r.id)
    if (k.phone) { found++; hits.push({ id: r.id, phone: k.phone }) }
  }
  // 💾 쓰기는 배치로 — 건건이 쓰면 부기(簿記)가 예산을 먹어 크롤 기회를 줄인다(보강 레인과 동일 교훈).
  if (hits.length) {
    budget.left -= 1
    await DB.batch(hits.map(h => DB.prepare(
      "UPDATE ad_company_leads SET phone = COALESCE(phone, ?), contact_source = COALESCE(contact_source, 'kakao'), active = 1 WHERE id = ?",
    ).bind(h.phone, h.id))).catch(() => null)
  }
  if (tried.length) {
    budget.left -= 1
    // 숫자 id 만 보간 — 바인딩 개수 가변 회피(D1 문장당 100개 제한과 무관하게 안전).
    await DB.prepare(`UPDATE ad_company_leads SET kakao_checked_at = datetime('now') WHERE id IN (${tried.join(',')})`)
      .run().catch(() => null)
  }
  const nextCap = nextSubreqCap(budgetTotal - budget.left, !!budget.limitHit, learnedCap, cap, pcap)
  if (nextCap != null) await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)')
    .bind(subreqCapKey('kakao_sweep'), String(nextCap)).run().catch(() => null)
  const prevRaw = await DB.prepare("SELECT value FROM platform_settings WHERE key = 'ads_kakao_sweep_stats'").first<{ value: string }>().catch(() => null)
  let totalFound = 0; let prevDay = ''; let prevDayLookups = 0
  try {
    const pj = prevRaw?.value ? JSON.parse(prevRaw.value) as Record<string, unknown> : {}
    totalFound = Number(pj.total_found) || 0
    prevDay = String(pj.day || ''); prevDayLookups = Number(pj.day_lookups) || 0
  } catch { /* 초기 */ }
  // 📊 하루 조회량(2026-07-29) — self-chain 으로 처리량을 올리기 전에 **카카오 일일 쿼터 소비를 눈으로 보고**
  //   판단하기 위한 계수기. 같은 stats 블롭에 얹으므로 추가 쿼리 0. KST 기준으로 리셋.
  const kstToday = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10)
  const dayLookups = prevDay === kstToday ? prevDayLookups : 0
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind('ads_kakao_sweep_stats', JSON.stringify({
    last_run: new Date().toISOString().slice(0, 19).replace('T', ' '), scanned: rows.length, found, tried: tried.length, total_found: totalFound + found,
    day: kstToday, day_lookups: dayLookups + tried.length,
    limit_hit: !!budget.limitHit, // 한도로 조기 중단했는가 — true 면 남은 행은 커서 미전진(다음 라운드 재시도)
    // 📟 왜 멈췄는지 — 'deadline' 이면 예산이 아니라 시간이 병목이다(둘의 처방이 다르다).
    stopped_by: stoppedBy,
  })).run().catch(() => null)
  return { scanned: rows.length, found, cursor: 0, done: false, tried: tried.length, limit_hit: !!budget.limitHit, day_lookups: dayLookups + tried.length }
}
