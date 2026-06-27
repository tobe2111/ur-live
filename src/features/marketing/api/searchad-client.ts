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

/** 검색광고 API GET 호출 (서명 헤더 자동). path = 쿼리 제외 경로, query = 쿼리 객체. */
async function searchAdGet(creds: SearchAdCreds, path: string, query: Record<string, string>): Promise<{ ok: boolean; status: number; data: unknown; error?: string }> {
  const timestamp = String(Date.now())
  let signature: string
  try {
    signature = await sign(creds.secretKey, timestamp, 'GET', path)
  } catch {
    return { ok: false, status: 0, data: null, error: '검색광고 서명 생성 실패 (비밀키 형식을 확인해주세요)' }
  }
  const qs = new URLSearchParams(query).toString()
  const res = await fetch(`${SEARCHAD_BASE}${path}${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    headers: {
      'X-Timestamp': timestamp,
      'X-API-KEY': creds.accessLicense,
      'X-Customer': creds.customerId,
      'X-Signature': signature,
    },
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
