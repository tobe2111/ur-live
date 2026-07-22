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
import { type FetchBudget, pickBusinessEmail } from './influencer-discovery'
import { saveCompanyLeads, ensureCompanySchema, type CompanyLead } from './company-discovery'
import { crawlCompanyEmail } from './company-collect'

const outOfBudget = (b?: FetchBudget) => !!b && b.left <= 0
const spendBudget = (b?: FetchBudget) => { if (b) b.left -= 1 }
const NAVER_OPENAPI = 'https://openapi.naver.com'
const STOREINFO_BASE = 'https://apis.data.go.kr/B553077/api/open/sdsc2'
const stripTag = (s: unknown): string => String(s || '').replace(/<[^>]+>/g, '').trim()

/** 🗺️ 조회 대상 = 상가정보 업종**소분류코드**(indsSclsCd) × 시드. 코드는 공식 업종분류표(2302, 247종)에서 확정.
 *   ⚠️ 상가정보 업종분류엔 **도매업이 없다**(소매·서비스업 매장만) → tier2 주류/식자재 **도매**는 상가정보 미커버
 *   → 네이버 지역검색(company-collect)이 계속 담당. 상가정보는 **전문서비스·인프라(tier3·5)** 를 통째 확보.
 *   대행사(tier1)도 상가정보 광고대행과 겹치나 오탐 커 네이버 유지 — 여기선 간판/광고물 '제작'만. */
type StoreTarget = { code: string; divId?: string; category: string; subcategory: string; tier: number }
const STOREINFO_TARGETS: StoreTarget[] = [
  { code: 'M10402', category: '전문서비스', subcategory: '세무사', tier: 5 },
  { code: 'M10401', category: '전문서비스', subcategory: '공인회계사', tier: 5 },
  { code: 'M10307', category: '전문서비스', subcategory: '공인노무사', tier: 5 },
  { code: 'M11401', category: '매장인프라', subcategory: '명함·간판·광고물 제작', tier: 3 },
  { code: 'M10504', category: '매장인프라', subcategory: '광고물 설계·제작', tier: 3 },
  { code: 'M10502', category: '매장인프라', subcategory: '옥외·전시 광고', tier: 3 },
  { code: 'M11201', category: '매장인프라', subcategory: '인테리어 디자인', tier: 3 },
  { code: 'L10203', category: '전문서비스', subcategory: '상가 부동산 중개', tier: 3 },
  { code: 'M10703', category: '창업생태계', subcategory: '경영 컨설팅', tier: 1 },
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

/** 📞 네이버 지역검색으로 전화 역조회(상가정보엔 전화 없음). "상호 지역" 1건 → 이름 근접 시 전화·홈페이지 채택. */
async function lookupPhoneViaLocal(clientId: string, clientSecret: string, name: string, region: string | null, budget?: FetchBudget): Promise<{ phone: string | null; website: string | null }> {
  if (outOfBudget(budget)) return { phone: null, website: null }
  spendBudget(budget)
  const q = `${name} ${region || ''}`.trim()
  const url = `${NAVER_OPENAPI}/v1/search/local.json?query=${encodeURIComponent(q)}&display=1&sort=random`
  const res = await fetch(url, { headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret }, signal: AbortSignal.timeout(10000) }).catch(() => null)
  if (!res || !res.ok) return { phone: null, website: null }
  const data = await res.json().catch(() => null) as { items?: Array<{ title?: string; telephone?: string; link?: string }> } | null
  const it = data?.items?.[0]
  if (!it) return { phone: null, website: null }
  const hit = stripTag(it.title).replace(/\s+/g, '')
  const want = name.replace(/\s+/g, '')
  // 이름 근접(포함) 시에만 채택 — 오매칭 방지.
  if (!hit || (!hit.includes(want.slice(0, 4)) && !want.includes(hit.slice(0, 4)))) return { phone: null, website: null }
  return { phone: (it.telephone || '').trim() || null, website: (it.link || '').trim() || null }
}

export interface StoreInfoStats { last_run: string; found: number; saved: number; enriched: number; target: string; page: number; total_runs: number; total_saved: number; diag: { configured: boolean; error?: string; sample?: unknown } }
const STATS_KEY = 'ads_storeinfo_stats'
const CURSOR_KEY = 'ads_storeinfo_cursor' // 'targetIdx:page'

/** 상가정보 1틱(cron 짝수시 또는 수동). 게이트 체크는 호출부. 커서 순환(타깃×페이지)로 전국 커버. */
export async function runStoreInfoCollect(env: Env): Promise<StoreInfoStats> {
  const DB = env.DB
  await ensureCompanySchema(DB)
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
  const budget: FetchBudget = { left: Math.max(5, parseInt(env.ADS_COMPANY_SUBREQUEST_BUDGET || '', 10) || 60) }
  const requireContact = env.ADS_COMPANY_REQUIRE_CONTACT !== 'false'

  let found = 0, saved = 0, sample: unknown
  for (let i = 0; i < batch; i++) {
    if (outOfBudget(budget)) break
    const { items } = await fetchStoreInfoPage(serviceKey, t, page + i, budget)
    if (!sample && items[0]) sample = items[0] // 첫 원항목 → 필드 검증용 진단.
    if (!items.length) { page = 1; ti = (ti + 1) % STOREINFO_TARGETS.length; break } // 페이지 소진 → 다음 타깃.
    const leads: CompanyLead[] = items.map(it => {
      const addr = stripTag(it.rdnmAdr || it.lnoAdr)
      return {
        company_name: stripTag(it.bizesNm), category: t.category, subcategory: t.subcategory, tier: t.tier,
        region: pickRegion(addr), address: addr || null, phone: null, email: null, website: null,
        description: stripTag(it.indsSclsNm || it.indsMclsNm || it.ksicNm) || null,
        source: 'storeinfo', source_keyword: t.code,
      }
    }).filter(l => l.company_name.length >= 2)
    found += leads.length
    saved += await saveCompanyLeads(DB, leads, { requireContact }).catch(() => 0)
  }
  const nextPage = page + batch
  await DB.prepare('INSERT OR REPLACE INTO platform_settings (key, value) VALUES (?, ?)').bind(CURSOR_KEY, `${ti}:${nextPage}`).run().catch(() => null)

  // 📞📧 연락처 보강 — 상가정보 리드(연락처 없어 보류 active=0)를 네이버 전화 역조회 + 이메일 크롤로 채움.
  let enriched = 0
  if (clientId && clientSecret) {
    const held = (await DB.prepare("SELECT id, company_name, region, website FROM ad_company_leads WHERE source = 'storeinfo' AND active = 0 ORDER BY id DESC LIMIT 20")
      .all<{ id: number; company_name: string; region: string | null; website: string | null }>().catch(() => null))?.results || []
    for (const h of held) {
      if (outOfBudget(budget)) break
      let website = h.website
      const { phone, website: w } = await lookupPhoneViaLocal(clientId, clientSecret, h.company_name, h.region, budget)
      if (w && !website) website = w
      let email: string | null = null
      if (!phone && website && !outOfBudget(budget)) email = await crawlCompanyEmail(website, budget)
      if (phone || email || (website && website !== h.website)) {
        // 연락처(전화/이메일) 생기면 active=1 승격. website 만 갱신 시엔 유지.
        const r = await DB.prepare("UPDATE ad_company_leads SET phone = COALESCE(phone, ?), email = COALESCE(email, ?), website = COALESCE(website, ?), active = CASE WHEN (COALESCE(phone, ?) IS NOT NULL OR COALESCE(email, ?) IS NOT NULL) THEN 1 ELSE active END WHERE id = ?")
          .bind(phone, email, website, phone, email, h.id).run().catch(() => null)
        if (((r as { meta?: { changes?: number } } | null)?.meta?.changes ?? 0) > 0 && (phone || email)) enriched++
      }
    }
  }

  const s: StoreInfoStats = { last_run: stamp, found, saved, enriched, target: `${t.subcategory}(${t.code})`, page, total_runs: (prev?.total_runs || 0) + 1, total_saved: (prev?.total_saved || 0) + saved, diag: { configured: true, sample } }
  await persist(s)
  return s
}
