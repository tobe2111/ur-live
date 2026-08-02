/**
 * 🏪 파트너 수집 — 소스 ① 소상공인 상가(상권)정보 (data.go.kr B553077 / 15090955) — 2026-07-22.
 *   전문서비스·인프라(tier3·5: 세무·회계·노무·간판/광고물·인테리어·상가부동산)를 **검색이 아닌 통째 조회**로 전국 발굴.
 *   operation/파라미터/필드/업종코드 전부 **공식 활용가이드(HWP)+업종분류표(2302, 247종)로 확정**(2026-07-22 검증).
 *   설계 SSOT: docs/design/partner-company-collection.md §11.
 *
 *   ⚠️ 상가정보 업종분류엔 **도매업이 없다**(소매·서비스 매장만) → tier2 주류/식자재 도매는 네이버(company-collect) 담당.
 *   ⚠️ 상가정보 API 는 **상호·업종·주소·좌표만** 준다(전화·이메일 없음). 그래서 "연락처 필수" 정책:
 *     상가정보 발굴 → 연락처 보강(네이버 지역검색 전화 역조회 + 홈페이지 이메일 크롤) →
 *     연락처 없는 리드는 active=0(보류). 보강이 채우면 active=1 승격. (company-discovery.saveCompanyLeads)
 *
 *   게이트: `ADS_STOREINFO_ENABLED`(cron 짝수시 — company-collect 홀수시와 분리, 예산 반토막 방지).
 *   키: `PUBLIC_DATA_SERVICE_KEY` → 없으면 `NTS_API_KEY`(동일 data.go.kr 계정 serviceKey) 폴백.
 *   활성 전 게이트 OFF. 첫 조회 결과는 stats.diag.sample(원응답 첫 항목)로 확인.
 */
import type { Env } from '@/worker/types/env'
import { type FetchBudget } from './influencer-discovery'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'
import { kakaoLocalLookup, naverLocalLookup, crawlContact } from './contact-enrich'
import { envSubreqCap, envLaneBudget } from './collect-budget'
import { isNoValue } from './public-data-diag'

const outOfBudget = (b?: FetchBudget) => !!b && b.left <= 0
const spendBudget = (b?: FetchBudget) => { if (b) b.left -= 1 }
const STOREINFO_BASE = 'https://apis.data.go.kr/B553077/api/open/sdsc2'
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()

/** 🗺️ 조회 대상 = 상가정보 업종**소분류코드**(indsSclsCd) × 시드. 코드는 공식 업종분류표(2302, 247종)에서 확정.
 *   ⚠️ 상가정보 업종분류엔 **도매업이 없다**(소매·서비스업 매장만) → tier2 주류/식자재 **도매**는 상가정보 미커버
 *   → 네이버 지역검색(company-collect)이 계속 담당. 상가정보는 **전문서비스·인프라(tier3·5)** 를 통째 확보.
 *   대행사(tier1)도 상가정보 광고대행과 겹치나 오탐 커 네이버 유지 — 여기선 간판/광고물 '제작'만. */
type StoreTarget = { code: string; divId?: string; category: string; subcategory: string; tier: number }
const STOREINFO_TARGETS: StoreTarget[] = [
  { code: 'M10402', category: '전문서비스', subcategory: '세무·기장', tier: 5 },
  { code: 'M10401', category: '전문서비스', subcategory: '회계', tier: 5 },
  { code: 'M10307', category: '전문서비스', subcategory: '노무', tier: 5 },
  { code: 'M11401', category: '간판', subcategory: '간판·광고물 제작', tier: 3 },
  { code: 'M10504', category: '간판', subcategory: '간판·광고물 제작', tier: 3 },
  { code: 'M10502', category: '간판', subcategory: '간판·광고물 제작', tier: 3 },
  { code: 'M11201', category: '인테리어', subcategory: '인테리어·시공', tier: 3 },
  { code: 'L10203', category: '부동산', subcategory: '상가부동산', tier: 3 },
  { code: 'M10703', category: '창업', subcategory: '창업컨설팅', tier: 1 },
]

/** data.go.kr 상가정보 원항목(필드명은 문서 기준 — 실응답으로 검증). 방어적 파싱. */
interface RawStore { bizesNm?: string; rdnmAdr?: string; lnoAdr?: string; indsSclsNm?: string; indsMclsNm?: string; ksicNm?: string; [k: string]: unknown }

function pickRegion(addr: string): string | null {
  // "서울특별시 서초구 …" → "서초" (시군구 앞 2~3자). 실패 시 null.
  const m = addr.match(/([가-힣]+?)(시|군|구)\s/)
  return m ? m[1].replace(/특별|광역|자치|도$/g, '').slice(0, 20) : null
}

/** 상가정보 1페이지 조회 → RawStore[]. 응답 봉투가 여러 형태라 방어적 추출. */
async function fetchStoreInfoPage(serviceKey: string, t: StoreTarget, page: number, budget?: FetchBudget): Promise<{ items: RawStore[]; total: number }> {
  if (outOfBudget(budget)) return { items: [], total: 0 }
  spendBudget(budget)
  const url = `${STOREINFO_BASE}/storeListInUpjong?serviceKey=${encodeURIComponent(serviceKey)}&type=json&numOfRows=50&pageNo=${page}&divId=${t.divId || 'indsSclsCd'}&key=${encodeURIComponent(t.code)}`
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) }).catch(() => null)
  if (!res || !res.ok) return { items: [], total: 0 }
  const data = await res.json().catch(() => null) as Record<string, unknown> | null
  if (!data) return { items: [], total: 0 }
  // 봉투: {response:{body:{items:[...], totalCount}}} | {body:{items}} | {items} — 모두 시도.
  const body = ((data.response as Record<string, unknown>)?.body ?? data.body ?? data) as Record<string, unknown>
  let items = (body?.items ?? (body?.item) ?? []) as unknown
  if (items && !Array.isArray(items) && typeof items === 'object') items = (items as Record<string, unknown>).item ?? []
  const arr = Array.isArray(items) ? items as RawStore[] : []
  const total = Number(body?.totalCount ?? body?.total ?? arr.length) || arr.length
  return { items: arr, total }
}

export interface StoreInfoStats { last_run: string; found: number; saved: number; enriched: number; target: string; page: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown; kakao?: boolean; naver?: boolean; enrich_note?: string } }
const STATS_KEY = 'ads_storeinfo_stats'
const CURSOR_KEY = 'ads_storeinfo_cursor' // 'targetIdx:page'

/** 상가정보 1틱(cron 짝수시 또는 수동). 게이트 체크는 호출부. 커서 순환(타깃×페이지)로 전국 커버. */
export async function runStoreInfoCollect(env: Env): Promise<StoreInfoStats> {
  const DB = env.DB
  const schemaSpent = await ensureCompanySchema(DB) // 스키마 DDL 실비(아래 예산에서 차감)
  const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ')
  const serviceKey = env.PUBLIC_DATA_SERVICE_KEY || (env as unknown as { NTS_API_KEY?: string }).NTS_API_KEY || ''
  const clientId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID || ''
  const clientSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET || ''
  const prevRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(STATS_KEY).first<{ value: string }>().catch(() => null)
  let prev: StoreInfoStats | null = null
  try { prev = prevRaw?.value ? JSON.parse(prevRaw.value) as StoreInfoStats : null } catch { prev = null }
  const base = (err?: string, sample?: unknown): StoreInfoStats => ({ last_run: stamp, found: 0, saved: 0, enriched: 0, target: '', page: 0, total_runs: (prev?.total_runs || 0) + 1, total_saved: prev?.total_saved || 0, diag: { configured: !err, error: err, sample } })
  const persist = async (s: StoreInfoStats) => { await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(STATS_KEY, JSON.stringify(s)).run().catch(() => null) }

  if (!serviceKey) { const s = base('NOT_CONFIGURED: PUBLIC_DATA_SERVICE_KEY/NTS_API_KEY 미설정'); await persist(s); return s }

  // 커서: 'targetIdx:page'. 페이지 소진(빈 결과) 시 다음 타깃·page1.
  const curRaw = await DB.prepare('SELECT value FROM platform_settings WHERE key = ?').bind(CURSOR_KEY).first<{ value: string }>().catch(() => null)
  let [ti, page] = (curRaw?.value || '0:1').split(':').map(n => parseInt(n, 10))
  if (!Number.isFinite(ti) || ti < 0) ti = 0
  if (!Number.isFinite(page) || page < 1) page = 1
  ti = ti % STOREINFO_TARGETS.length
  const t = STOREINFO_TARGETS[ti]

  const batch = Math.max(1, parseInt(env.ADS_STOREINFO_BATCH || '', 10) || 3)
  // 🧱 플랫폼 천장(2026-07-29) — env 값이 얼마든 인보케이션 한도를 넘을 수 없다. 넘으면 후반 fetch 가
  //   조용히 전멸하고(잡히는 예외 없이) 그 사실이 어디에도 안 남는다. collect-budget.ts 주석(기본 60·근거) 참조.
  const budget: FetchBudget = { left: Math.max(1, Math.min(envSubreqCap(env), Math.max(5, envLaneBudget(env.ADS_COMPANY_SUBREQUEST_BUDGET, 60, env))) - schemaSpent) }
  const requireContact = env.ADS_COMPANY_REQUIRE_CONTACT !== 'false'

  let found = 0, saved = 0, sample: unknown
  for (let i = 0; i < batch; i++) {
    if (outOfBudget(budget)) break
    const { items } = await fetchStoreInfoPage(serviceKey, t, page + i, budget)
    if (!sample && items[0]) sample = items[0] // 첫 원항목 → 필드 검증용 진단.
    if (!items.length) { page = 1; ti = (ti + 1) % STOREINFO_TARGETS.length; break } // 페이지 소진 → 다음 타깃.
    const leads: CompanyLead[] = items.map(it => {
      // ⚠️ `||` 로 이으면 앞 값이 '값 없음' 자리표시자여도 채택된다 — 뒤의 진짜 주소를 건너뛴다
      //   (통신판매 레인에서 그렇게 주소 31.7% 를 잃었다). 판정 SSOT 는 public-data-diag.
      const addr = stripTag(isNoValue(it.rdnmAdr) ? it.lnoAdr : it.rdnmAdr)
      return {
        company_name: stripTag(it.bizesNm), category: t.category, subcategory: t.subcategory, tier: t.tier,
        region: pickRegion(addr), address: addr || null, phone: null, email: null, website: null,
        description: stripTag([it.indsSclsNm, it.indsMclsNm, it.ksicNm].find(v => !isNoValue(v))) || null,
        source: 'storeinfo', source_keyword: t.code,
      }
    }).filter(l => l.company_name.length >= 2)
    found += leads.length
    saved += await saveCompanyLeads(DB, leads, { requireContact }).catch(() => 0)
  }
  const nextPage = page + batch
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, `${ti}:${nextPage}`).run().catch(() => null)

  // 📞📧 연락처 보강 — ⚠️ 네이버 지역검색 telephone 은 폐지(항상 빈값) → **카카오 로컬로 전화**(업체 등록 전화를
  //   준다) + 홈페이지 이메일 크롤(mailto 우선). 네이버는 홈페이지 link 발견용으로만. 상호+주소 완전일치만(허위 방지).
  let enriched = 0
  const kakaoKey = env.KAKAO_REST_API_KEY || ''
  const hasNaver = !!(clientId && clientSecret)
  if (kakaoKey || hasNaver) {
    const held = (await DB.prepare("SELECT id, company_name, region, website, address FROM ad_company_leads WHERE source = 'storeinfo' AND active = 0 AND merged_into IS NULL ORDER BY id DESC LIMIT 20")
      .all<{ id: number; company_name: string; region: string | null; website: string | null; address: string | null }>().catch(() => null))?.results || []
    for (const h of held) {
      if (outOfBudget(budget)) break
      let phone: string | null = null, email: string | null = null, website = h.website, source: string | null = null
      // ① 카카오 전화(업체 등록) — 상호+주소 완전일치만.
      if (kakaoKey) { const k = await kakaoLocalLookup(kakaoKey, h.company_name, h.region, h.address || '', budget); if (k.phone) { phone = k.phone; source = 'kakao' } }
      // ② 홈페이지 없으면 네이버 지역검색으로 link 발견(이메일 크롤의 관문). 전화도 없으면 부가 채택.
      if (!website && hasNaver && !outOfBudget(budget)) {
        const nv = await naverLocalLookup(clientId, clientSecret, h.company_name, h.region, h.address || '', budget)
        if (nv.website) website = nv.website
        if (!phone && nv.phone) { phone = nv.phone; source = 'naver' }
      }
      // ③ 홈페이지 크롤 — 이메일(mailto 우선) + 전화 보충.
      if (website && !outOfBudget(budget)) { const c = await crawlContact(website, budget); if (c.email) { email = c.email; source = 'homepage' } if (!phone && c.phone) phone = c.phone }
      if (phone || email || (website && website !== h.website)) {
        const r = await DB.prepare("UPDATE ad_company_leads SET phone = COALESCE(phone, ?), email = COALESCE(email, ?), website = COALESCE(website, ?), contact_source = COALESCE(contact_source, ?), active = CASE WHEN (COALESCE(phone, ?) IS NOT NULL OR COALESCE(email, ?) IS NOT NULL) THEN 1 ELSE active END WHERE id = ?")
          .bind(phone, email, website, source, phone, email, h.id).run().catch(() => null)
        if (((r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0 && (phone || email)) enriched++
      }
    }
  }
  const enrichNote = !kakaoKey && !hasNaver ? 'KAKAO_REST_API_KEY·NAVER 키 둘 다 미설정 — 연락처 보강 불가'
    : !kakaoKey ? 'KAKAO_REST_API_KEY 미설정 — 전화 보강 불가(네이버 telephone 은 폐지됨). 카카오 키 설정 권장'
      : undefined

  const s: StoreInfoStats = { last_run: stamp, found, saved, enriched, target: `${t.subcategory}(${t.code})`, page, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, sample, kakao: !!kakaoKey, naver: hasNaver, enrich_note: enrichNote } }
  await persist(s)
  return s
}
