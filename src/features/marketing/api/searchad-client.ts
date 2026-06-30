/**
 * 🆕 2026-06-27 유어애즈(UR Ads) — 네이버 검색광고 API 클라이언트 (searchad.naver.com).
 *
 *   오픈API(developers.naver.com)·커머스API(commerce.naver.com)와 **별개 플랫폼**.
 *   인증: HMAC-SHA256 서명 — sign = base64(HMAC(secretKey, `${timestamp}.${method}.${path}`)).
 *   헤더: X-Timestamp / X-API-KEY(액세스라이선스) / X-Customer(고객ID) / X-Signature.
 *   ⚠️ 고정 IP 불필요(커머스API 와 달리 IP 허용목록 없음). 키는 Cloudflare Secrets 에만 보관.
 *
 *   현재 사용처:
 *     - RelKwdStat(연관키워드 추천 + 월 검색량) — 광고계정 0개여도 관리계정 customer-level 로 동작.
 *   향후: Estimate(목표순위 입찰추정) · StatReport(실적) — 고객사 광고계정 연동 후.
 *
 *   ⚠️ 이 환경은 외부 egress 차단 — 라이브 호출은 운영(배포) 후 검증 필요.
 */

const SEARCHAD_BASE = 'https://api.searchad.naver.com'

export interface SearchAdCreds {
  customerId: string
  accessLicense: string
  secretKey: string
}

/** env 에서 검색광고 자격증명 추출 — 셋 다 있어야 활성. */
export function searchAdCredsFrom(env: {
  NAVER_SEARCHAD_CUSTOMER_ID?: string
  NAVER_SEARCHAD_ACCESS_LICENSE?: string
  NAVER_SEARCHAD_SECRET_KEY?: string
}): SearchAdCreds | null {
  const customerId = (env.NAVER_SEARCHAD_CUSTOMER_ID || '').trim()
  const accessLicense = (env.NAVER_SEARCHAD_ACCESS_LICENSE || '').trim()
  const secretKey = (env.NAVER_SEARCHAD_SECRET_KEY || '').trim()
  if (!customerId || !accessLicense || !secretKey) return null
  return { customerId, accessLicense, secretKey }
}

/** HMAC-SHA256(secretKey, `${timestamp}.${method}.${path}`) → base64. path 는 쿼리스트링 제외. */
async function sign(secretKey: string, timestamp: string, method: string, path: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secretKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const msg = `${timestamp}.${method}.${path}`
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg))
  // base64(raw bytes)
  let bin = ''
  const bytes = new Uint8Array(sig)
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin)
}

/** 검색광고 API 호출 (서명 헤더 자동). path = 쿼리 제외 경로(서명 대상). */
async function searchAdRequest(creds: SearchAdCreds, method: 'GET' | 'POST' | 'PUT', path: string, query: Record<string, string>, body?: unknown): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const timestamp = String(Date.now())
  let signature: string
  try {
    signature = await sign(creds.secretKey, timestamp, method, path)
  } catch {
    return { ok: false, status: 0, data: null, error: '검색광고 서명 생성 실패 (비밀키 형식을 확인해주세요)' }
  }
  const qs = new URLSearchParams(query).toString()
  const headers: Record<string, string> = {
    'X-Timestamp': timestamp,
    'X-API-KEY': creds.accessLicense,
    'X-Customer': creds.customerId,
    'X-Signature': signature,
  }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await fetch(`${SEARCHAD_BASE}${path}${qs ? `?${qs}` : ''}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  }).catch(() => null)
  if (!res) return { ok: false, status: 0, data: null, error: '검색광고 API 호출 실패 (네트워크)' }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    const d = data as { title?: string; detail?: string; message?: string } | null
    const detail = d?.detail || d?.title || d?.message
    return { ok: false, status: res.status, data, error: detail || `검색광고 API 오류 (HTTP ${res.status})` }
  }
  return { ok: true, status: res.status, data }
}

/** GET 단축. */
function searchAdGet(creds: SearchAdCreds, path: string, query: Record<string, string>) {
  return searchAdRequest(creds, 'GET', path, query)
}

// ── 연관키워드 추천 (RelKwdStat) ────────────────────────────────────────────
export interface RelatedKeyword {
  keyword: string          // 연관 키워드
  monthlyPc: number        // 월간 PC 검색수 (< 10 이면 '< 10')
  monthlyMobile: number    // 월간 모바일 검색수
  monthlyTotal: number     // PC + 모바일
  compIdx: string          // 경쟁정도: '낮음' | '중간' | '높음'
  monthlyAvgClick: number  // 월평균 클릭수(PC+모바일 합)
  plAvgDepth: number       // 월평균 노출광고수
}

/** '< 10' 같은 문자열/숫자 모두를 안전한 정수로. */
function num(v: unknown): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = parseInt(String(v ?? '').replace(/[^0-9]/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

/** RelKwdStat 응답(keywordList) → RelatedKeyword[] (순수 — 테스트 가능). 총 검색량 내림차순. */
export function parseRelatedKeywords(keywordList: Array<Record<string, unknown>> | undefined | null): RelatedKeyword[] {
  const results: RelatedKeyword[] = (keywordList || []).map(row => {
    const pc = num(row.monthlyPcQcCnt)
    const mo = num(row.monthlyMobileQcCnt)
    return {
      keyword: String(row.relKeyword || ''),
      monthlyPc: pc,
      monthlyMobile: mo,
      monthlyTotal: pc + mo,
      compIdx: String(row.compIdx || ''),
      monthlyAvgClick: Math.round(num(row.monthlyAvePcClkCnt) + num(row.monthlyAveMobileClkCnt)),
      plAvgDepth: num(row.plAvgDepth),
    }
  }).filter(k => k.keyword)
  results.sort((a, b) => b.monthlyTotal - a.monthlyTotal)
  return results.slice(0, 100)
}

/**
 * 연관키워드 추천 — GET /keywordstool?hintKeywords=a,b&showDetail=1.
 *   광고계정이 0개여도 관리/대행 계정(customer-level)로 동작. 힌트당 최대 5개 권장(API 자체는 더 허용).
 *   월 검색량 → 키워드 발굴 + 광고 타겟팅 핵심 데이터.
 */
export async function relatedKeywords(creds: SearchAdCreds, hints: string[]): Promise<{ ok: boolean; results?: RelatedKeyword[]; error?: string }> {
  const list = hints.map(k => k.trim().replace(/\s+/g, '')).filter(Boolean).slice(0, 5)
  if (!list.length) return { ok: false, error: '키워드를 입력해주세요' }
  const r = await searchAdGet(creds, '/keywordstool', { hintKeywords: list.join(','), showDetail: '1' })
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data as { keywordList?: Array<Record<string, unknown>> } | null
  return { ok: true, results: parseRelatedKeywords(d?.keywordList) }
}

// ── 광고 구조 조회 (캠페인 → 광고그룹 → 키워드) ─────────────────────────────
//   per-advertiser 읽기 — 연결된 고객사 자격증명 필요(관리계정으론 못 봄). 자동입찰/실적 UI 토대.
export interface AdCampaign { id: string; name: string; type: string; status: string; dailyBudget: number }
export interface AdGroup { id: string; name: string; status: string; bidAmt: number; campaignId: string }
export interface AdKeyword { id: string; keyword: string; bidAmt: number; useGroupBid: boolean; status: string }

/** 캠페인 목록 — GET /ncc/campaigns. 연결 검증에도 사용(200 OK = 유효한 키). */
export async function listCampaigns(creds: SearchAdCreds): Promise<{ ok: boolean; campaigns?: AdCampaign[]; error?: string }> {
  const r = await searchAdGet(creds, '/ncc/campaigns', {})
  if (!r.ok) return { ok: false, error: r.error }
  const arr = Array.isArray(r.data) ? (r.data as Array<Record<string, unknown>>) : []
  const campaigns: AdCampaign[] = arr.map(c => ({
    id: String(c.nccCampaignId || ''),
    name: String(c.name || ''),
    type: String(c.campaignTp || ''),
    status: String(c.status || c.statusReason || ''),
    dailyBudget: num(c.dailyBudget),
  })).filter(c => c.id)
  return { ok: true, campaigns }
}

/** 광고그룹 목록 — GET /ncc/adgroups?nccCampaignId=. */
export async function listAdgroups(creds: SearchAdCreds, campaignId: string): Promise<{ ok: boolean; adgroups?: AdGroup[]; error?: string }> {
  const r = await searchAdGet(creds, '/ncc/adgroups', { nccCampaignId: campaignId })
  if (!r.ok) return { ok: false, error: r.error }
  const arr = Array.isArray(r.data) ? (r.data as Array<Record<string, unknown>>) : []
  const adgroups: AdGroup[] = arr.map(g => ({
    id: String(g.nccAdgroupId || ''),
    name: String(g.name || ''),
    status: String(g.status || ''),
    bidAmt: num(g.bidAmt),
    campaignId: String(g.nccCampaignId || campaignId),
  })).filter(g => g.id)
  return { ok: true, adgroups }
}

/** 키워드 목록(현재 입찰가 포함) — GET /ncc/keywords?nccAdgroupId=. 자동입찰의 입력. */
export async function listKeywords(creds: SearchAdCreds, adgroupId: string): Promise<{ ok: boolean; keywords?: AdKeyword[]; error?: string }> {
  const r = await searchAdGet(creds, '/ncc/keywords', { nccAdgroupId: adgroupId })
  if (!r.ok) return { ok: false, error: r.error }
  const arr = Array.isArray(r.data) ? (r.data as Array<Record<string, unknown>>) : []
  const keywords: AdKeyword[] = arr.map(k => ({
    id: String(k.nccKeywordId || ''),
    keyword: String(k.keyword || ''),
    bidAmt: num(k.bidAmt),
    useGroupBid: !!k.useGroupBidAmt,
    status: String(k.status || ''),
  })).filter(k => k.id)
  return { ok: true, keywords }
}

// ── 목표순위 예상 입찰가 (Estimate — 읽기, 돈 변경 없음) ──────────────────────
//   "이 키워드를 N위에 노출하려면 예상 입찰가 얼마?" = 자동입찰의 핵심 입력(원하는 순위, 원하는 CPC).
//   POST /estimate/average-position-bid/keyword — auction 기반 추정, 계정 무관(고객레벨).
export interface BidEstimate { position: number; bid: number }

/** 키워드의 목표순위(positions)별 예상 입찰가. device 'PC' | 'MOBILE'. */
export async function estimateBidForPositions(creds: SearchAdCreds, keyword: string, positions: number[], device: 'PC' | 'MOBILE' = 'PC'): Promise<{ ok: boolean; estimates?: BidEstimate[]; error?: string }> {
  const kw = keyword.trim().replace(/\s+/g, '')
  if (kw.length < 1) return { ok: false, error: '키워드를 입력해주세요' }
  const pos = positions.filter(p => Number.isFinite(p) && p >= 1 && p <= 15)
  if (!pos.length) return { ok: false, error: '목표순위를 지정해주세요' }
  const body = { device, items: pos.map(position => ({ key: kw, position })) }
  const r = await searchAdRequest(creds, 'POST', '/estimate/average-position-bid/keyword', {}, body)
  if (!r.ok) return { ok: false, error: r.error }
  // 응답 형태 방어적 파싱: { estimate: [{ position, bid }] } 또는 배열.
  const d = r.data as { estimate?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null
  const rows = Array.isArray(d) ? d : (d?.estimate || [])
  const estimates: BidEstimate[] = rows.map(row => ({
    position: num(row.position),
    bid: num(row.bid),
  })).filter(e => e.position > 0).sort((a, b) => a.position - b.position)
  return { ok: true, estimates }
}

// ── 키워드 입찰가 변경 (WRITE — 실제 광고비 영향) ─────────────────────────────
//   ⚠️ 돈 변경. 호출 전 라우트에서 범위 검증 필수. 네이버 최소 입찰가 70원.
export const BID_MIN = 70
export const BID_MAX = 100_000 // 절대 상한(오타/폭주 방지 하드캡) — 광고주가 더 높이려면 검색광고센터에서 직접.

/** 단일 키워드 입찰가 설정 — PUT /ncc/keywords/{id}?fields=bidAmt. useGroupBidAmt=false(개별입찰). */
export async function updateKeywordBid(creds: SearchAdCreds, keywordId: string, bidAmt: number): Promise<{ ok: boolean; error?: string }> {
  const id = String(keywordId || '').trim()
  if (!id) return { ok: false, error: '키워드 ID 가 없습니다' }
  if (!Number.isFinite(bidAmt) || bidAmt < BID_MIN || bidAmt > BID_MAX) return { ok: false, error: `입찰가는 ${BID_MIN}~${BID_MAX.toLocaleString()}원 범위여야 합니다` }
  const bid = Math.round(bidAmt)
  const body = { nccKeywordId: id, bidAmt: bid, useGroupBidAmt: false }
  const r = await searchAdRequest(creds, 'PUT', `/ncc/keywords/${encodeURIComponent(id)}`, { fields: 'bidAmt' }, body)
  if (!r.ok) return { ok: false, error: r.error }
  return { ok: true }
}

// ── 키워드 자동등록 (키워드확장 write — 광고그룹에 키워드 추가) ──────────────
//   ⚠️ write. 그룹입찰 상속(useGroupBidAmt=true)이라 키워드별 별도 입찰 surprise 없음(안전).
export const KW_ADD_MAX = 20 // 1회 등록 상한(폭주 방지)

/** 광고그룹에 키워드 추가 — POST /ncc/keywords?nccAdgroupId=. 그룹입찰 사용. */
export async function addKeywordsToAdgroup(creds: SearchAdCreds, adgroupId: string, keywords: string[]): Promise<{ ok: boolean; added?: number; error?: string }> {
  const gid = String(adgroupId || '').trim()
  if (!gid) return { ok: false, error: '광고그룹 ID 가 없습니다' }
  const clean = Array.from(new Set(
    keywords.map(k => k.trim().replace(/\s+/g, '')).filter(k => k.length >= 1 && k.length <= 25)
  )).slice(0, KW_ADD_MAX)
  if (!clean.length) return { ok: false, error: '추가할 키워드가 없습니다' }
  const body = clean.map(keyword => ({ keyword, useGroupBidAmt: true }))
  const r = await searchAdRequest(creds, 'POST', '/ncc/keywords', { nccAdgroupId: gid }, body)
  if (!r.ok) return { ok: false, error: r.error }
  const arr = Array.isArray(r.data) ? r.data : []
  return { ok: true, added: arr.length || clean.length }
}

// ── 통합실적 (StatService /stats — 읽기) ─────────────────────────────────────
//   캠페인별 노출/클릭/비용/전환 + 계정 합계. 평균노출순위까지 공식 지표(스크래핑 아님).
export interface CampaignStat { id: string; name: string; impCnt: number; clkCnt: number; salesAmt: number; ccnt: number; convAmt: number; ctr: number; cpc: number; avgRnk: number }
export interface AccountStats { days: number; totals: { impCnt: number; clkCnt: number; salesAmt: number; ccnt: number; convAmt: number; ctr: number; cpc: number }; campaigns: CampaignStat[] }

function ymd(d: Date): string { return d.toISOString().slice(0, 10) }

/** 명시 날짜범위(since~until, YMD)의 캠페인별 실적 + 합계. accountStats / accountStatsForDate 공용 코어. */
async function accountStatsRangeImpl(creds: SearchAdCreds, sinceYmd: string, untilYmd: string, days: number): Promise<{ ok: boolean; data?: AccountStats; error?: string }> {
  const camp = await listCampaigns(creds)
  if (!camp.ok) return { ok: false, error: camp.error }
  const idToName = new Map((camp.campaigns || []).map(c => [c.id, c.name]))
  const ids = [...idToName.keys()].slice(0, 30)
  if (!ids.length) return { ok: true, data: { days, totals: { impCnt: 0, clkCnt: 0, salesAmt: 0, ccnt: 0, convAmt: 0, ctr: 0, cpc: 0 }, campaigns: [] } }
  const r = await searchAdGet(creds, '/stats', {
    ids: JSON.stringify(ids),
    // convAmt = 전환매출(ROAS 계산용). 전환추적 미설정 계정은 0 으로 옴.
    fields: JSON.stringify(['impCnt', 'clkCnt', 'salesAmt', 'ccnt', 'convAmt', 'avgRnk']),
    timeRange: JSON.stringify({ since: sinceYmd, until: untilYmd }),
  })
  if (!r.ok) return { ok: false, error: r.error }
  // 응답 방어적 파싱: { data: [{ id, impCnt, clkCnt, salesAmt, ccnt, convAmt, avgRnk }] } 또는 배열.
  const d = r.data as { data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null
  const rows = Array.isArray(d) ? d : (d?.data || [])
  const campaigns: CampaignStat[] = rows.map(row => {
    const id = String(row.id ?? '')
    const impCnt = num(row.impCnt), clkCnt = num(row.clkCnt), salesAmt = num(row.salesAmt), ccnt = num(row.ccnt), convAmt = num(row.convAmt)
    return { id, name: idToName.get(id) || id, impCnt, clkCnt, salesAmt, ccnt, convAmt, ctr: impCnt ? clkCnt / impCnt : 0, cpc: clkCnt ? Math.round(salesAmt / clkCnt) : 0, avgRnk: num(row.avgRnk) }
  }).filter(c => c.id).sort((a, b) => b.salesAmt - a.salesAmt)
  const T = campaigns.reduce((s, c) => ({ impCnt: s.impCnt + c.impCnt, clkCnt: s.clkCnt + c.clkCnt, salesAmt: s.salesAmt + c.salesAmt, ccnt: s.ccnt + c.ccnt, convAmt: s.convAmt + c.convAmt }), { impCnt: 0, clkCnt: 0, salesAmt: 0, ccnt: 0, convAmt: 0 })
  const totals = { ...T, ctr: T.impCnt ? T.clkCnt / T.impCnt : 0, cpc: T.clkCnt ? Math.round(T.salesAmt / T.clkCnt) : 0 }
  return { ok: true, data: { days, totals, campaigns } }
}

/** 연결 계정의 최근 N일 캠페인별 실적 + 합계. days 기본 7. */
export async function accountStats(creds: SearchAdCreds, days = 7): Promise<{ ok: boolean; data?: AccountStats; error?: string }> {
  const span = Math.min(90, Math.max(1, Math.round(days)))
  const until = new Date()
  const since = new Date(until.getTime() - (span - 1) * 86400000)
  return accountStatsRangeImpl(creds, ymd(since), ymd(until), span)
}

/** 특정 날짜(YMD) 하루의 계정 합계. 일별 메트릭 스냅샷(metrics-history)용. */
export async function accountStatsForDate(creds: SearchAdCreds, dateYmd: string): Promise<{ ok: boolean; data?: AccountStats; error?: string }> {
  return accountStatsRangeImpl(creds, dateYmd, dateYmd, 1)
}

// ── 키워드 효율 분석 (ROAS·CPA·낭비 키워드 발굴) ─────────────────────────────
export interface KeywordEff { id: string; keyword: string; cost: number; clicks: number; conv: number; convAmt: number; cpa: number | null; roas: number | null; waste: boolean }

/** 키워드별 효율(최근 N일). 캠페인→광고그룹→키워드 일부를 크롤(쿼터 보호 cap)해 /stats 일괄 조회.
 *  낭비 = 비용>임계 & 전환 0. ROAS=전환매출/비용, CPA=비용/전환. 비용 내림차순.
 *  ⚠️ 쿼터 보호: 캠페인 4 × 광고그룹 6, 키워드 최대 cap(기본 100) 까지만 — UI 에 '상위 N개 기준' 명시. */
export async function keywordEfficiency(creds: SearchAdCreds, days = 30, cap = 100): Promise<{ ok: boolean; items?: KeywordEff[]; scanned?: number; error?: string }> {
  const span = Math.min(90, Math.max(1, Math.round(days)))
  const camp = await listCampaigns(creds)
  if (!camp.ok) return { ok: false, error: camp.error }
  const idToText = new Map<string, string>()
  outer: for (const c of (camp.campaigns || []).slice(0, 4)) {
    const ag = await listAdgroups(creds, c.id).catch(() => ({ ok: false as const }))
    if (!ag.ok || !('adgroups' in ag)) continue
    for (const g of (ag.adgroups || []).slice(0, 6)) {
      const kw = await listKeywords(creds, g.id).catch(() => ({ ok: false as const }))
      if (!kw.ok || !('keywords' in kw)) continue
      for (const k of kw.keywords || []) {
        if (idToText.size >= cap) break outer
        idToText.set(k.id, k.keyword)
      }
    }
  }
  const ids = [...idToText.keys()]
  if (!ids.length) return { ok: true, items: [], scanned: 0 }
  const until = new Date()
  const since = new Date(until.getTime() - (span - 1) * 86400000)
  const r = await searchAdGet(creds, '/stats', {
    ids: JSON.stringify(ids),
    fields: JSON.stringify(['salesAmt', 'clkCnt', 'ccnt', 'convAmt']),
    timeRange: JSON.stringify({ since: ymd(since), until: ymd(until) }),
  })
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data as { data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null
  const rows = Array.isArray(d) ? d : (d?.data || [])
  const avgCost = rows.length ? rows.reduce((s, row) => s + num(row.salesAmt), 0) / rows.length : 0
  const wasteThreshold = Math.max(1000, avgCost) // 평균 비용 이상 쓰면서 전환 0 → 낭비
  const items: KeywordEff[] = rows.map(row => {
    const id = String(row.id ?? '')
    const cost = num(row.salesAmt), clicks = num(row.clkCnt), conv = num(row.ccnt), convAmt = num(row.convAmt)
    return {
      id, keyword: idToText.get(id) || id, cost, clicks, conv, convAmt,
      cpa: conv > 0 ? Math.round(cost / conv) : null,
      roas: cost > 0 ? Math.round((convAmt / cost) * 100) / 100 : null,
      waste: cost >= wasteThreshold && conv === 0,
    }
  }).filter(k => k.id).sort((a, b) => b.cost - a.cost)
  return { ok: true, items, scanned: ids.length }
}

// ── 예산 페이싱 (오늘 소진 vs 일예산) ────────────────────────────────────────
export interface CampaignPacing { id: string; name: string; dailyBudget: number; todaySpend: number; pacePct: number; status: 'over' | 'ok' | 'under' | 'no_budget' }

/** 오늘 캠페인별 소진률 — dailyBudget(캠페인) vs 오늘 salesAmt(/stats). 과속/과소 플래그. */
export async function budgetPacing(creds: SearchAdCreds): Promise<{ ok: boolean; campaigns?: CampaignPacing[]; error?: string }> {
  const camp = await listCampaigns(creds)
  if (!camp.ok) return { ok: false, error: camp.error }
  const list = (camp.campaigns || []).slice(0, 30)
  if (!list.length) return { ok: true, campaigns: [] }
  const today = ymd(new Date())
  const r = await searchAdGet(creds, '/stats', {
    ids: JSON.stringify(list.map(c => c.id)),
    fields: JSON.stringify(['salesAmt']),
    timeRange: JSON.stringify({ since: today, until: today }),
  })
  if (!r.ok) return { ok: false, error: r.error }
  const d = r.data as { data?: Array<Record<string, unknown>> } | Array<Record<string, unknown>> | null
  const rows = Array.isArray(d) ? d : (d?.data || [])
  const spendById = new Map(rows.map(row => [String(row.id ?? ''), num(row.salesAmt)]))
  const campaigns: CampaignPacing[] = list.map(c => {
    const todaySpend = spendById.get(c.id) || 0
    const pacePct = c.dailyBudget > 0 ? todaySpend / c.dailyBudget : 0
    const status: CampaignPacing['status'] = c.dailyBudget <= 0 ? 'no_budget' : pacePct >= 0.95 ? 'over' : pacePct < 0.3 ? 'under' : 'ok'
    return { id: c.id, name: c.name, dailyBudget: c.dailyBudget, todaySpend, pacePct, status }
  }).sort((a, b) => b.pacePct - a.pacePct)
  return { ok: true, campaigns }
}
