/**
 * 🆕 2026-06-26 유어애즈(UR Ads) — 키워드 도구 (네이버 오픈API 재사용, 고정IP/서버 불필요).
 *
 *   - 검색어 트렌드: POST /v1/datalab/search (데이터랩) — 키워드별 상대 검색량 추이.
 *   - 쇼핑 경쟁:    GET  /v1/search/shop.json (쇼핑검색) — 상품 수(경쟁강도) + 가격대 + 상위 몰.
 *   둘 다 X-Naver-Client-Id/Secret(오픈API 앱) 사용 — 대표님이 이미 보유(검색/데이터랩 활성).
 *   ⚠️ 일 쿼터(데이터랩 1,000 / 검색 25,000) → 라우트에서 rate limit. 캐시 권장.
 *   ※ '연관키워드 추천(검색량)'은 검색광고 API(RelKwdStat) 필요 — 키 발급 후 추가.
 */
import { stripNaverTitle } from '../../../worker/utils/naver-shopping-price'

const OPENAPI = 'https://openapi.naver.com'
const hdr = (id: string, secret: string) => ({ 'X-Naver-Client-Id': id, 'X-Naver-Client-Secret': secret })

export interface TrendResult { keyword: string; points: Array<{ period: string; ratio: number }>; latest: number; changePct: number }

/** 검색어 트렌드 — 키워드(최대 5개) 상대 검색량 추이(최근 90일, 주 단위). */
export async function keywordTrend(clientId: string | undefined, clientSecret: string | undefined, keywords: string[]): Promise<{ ok: boolean; results?: TrendResult[]; error?: string }> {
  if (!clientId || !clientSecret) return { ok: false, error: 'NOT_CONFIGURED' }
  const groups = keywords.map(k => k.trim()).filter(Boolean).slice(0, 5)
  if (!groups.length) return { ok: false, error: '키워드를 입력해주세요' }
  const today = new Date()
  const endDate = today.toISOString().slice(0, 10)
  const startDate = new Date(today.getTime() - 90 * 86400000).toISOString().slice(0, 10)
  const res = await fetch(`${OPENAPI}/v1/datalab/search`, {
    method: 'POST',
    headers: { ...hdr(clientId, clientSecret), 'content-type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, timeUnit: 'week', keywordGroups: groups.map(k => ({ groupName: k, keywords: [k] })) }),
  }).catch(() => null)
  if (!res) return { ok: false, error: '데이터랩 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { results?: Array<{ title?: string; data?: Array<{ period: string; ratio: number }> }>; errorMessage?: string } | null
  if (!res.ok) return { ok: false, error: data?.errorMessage || `데이터랩 오류 (HTTP ${res.status})` }
  const results: TrendResult[] = (data?.results || []).map(r => {
    const points = (r.data || []).map(p => ({ period: p.period, ratio: Number(p.ratio) || 0 }))
    const latest = points.length ? points[points.length - 1].ratio : 0
    const first = points.length ? points[0].ratio : 0
    const changePct = first > 0 ? Math.round(((latest - first) / first) * 100) : 0
    return { keyword: r.title || '', points, latest, changePct }
  })
  return { ok: true, results }
}

export interface ShoppingResult { total: number; items: Array<{ title: string; lprice: number; mallName: string; brand?: string }> }

/** 쇼핑 경쟁 — 키워드 검색 결과 상품 수(경쟁) + 상위 상품 가격/몰. */
export async function keywordShopping(clientId: string | undefined, clientSecret: string | undefined, rawQuery: string): Promise<{ ok: boolean; data?: ShoppingResult; error?: string }> {
  if (!clientId || !clientSecret) return { ok: false, error: 'NOT_CONFIGURED' }
  const query = rawQuery.trim()
  if (query.length < 2) return { ok: false, error: '검색어가 너무 짧습니다' }
  const url = `${OPENAPI}/v1/search/shop.json?query=${encodeURIComponent(query)}&display=10&sort=sim`
  const res = await fetch(url, { headers: hdr(clientId, clientSecret) }).catch(() => null)
  if (!res) return { ok: false, error: '쇼핑검색 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { total?: number; items?: Array<{ title?: string; lprice?: string; mallName?: string; brand?: string }>; errorMessage?: string } | null
  if (!res.ok) return { ok: false, error: data?.errorMessage || `쇼핑검색 오류 (HTTP ${res.status})` }
  const items = (data?.items || []).map(it => ({
    title: stripNaverTitle(String(it.title || '')),
    lprice: Math.floor(Number(it.lprice)) || 0,
    mallName: String(it.mallName || ''),
    brand: it.brand ? String(it.brand) : undefined,
  })).filter(it => it.lprice > 0)
  return { ok: true, data: { total: Number(data?.total) || 0, items } }
}

// ── 소싱 리포트 (데이터랩 쇼핑인사이트 — 분야별 트렌드) ──────────────────────
//   "뜨는 카테고리" 발굴 → 도매몰 소싱 시너지. 각 카테고리 자체 시계열의 증감률(정규화 내 유효).
export interface CategoryTrend { name: string; changePct: number; latest: number }
// 네이버쇼핑 1-depth 대표 카테고리(cid).
const SHOPPING_CATEGORIES: Array<{ name: string; cid: string }> = [
  { name: '패션의류', cid: '50000000' }, { name: '패션잡화', cid: '50000001' },
  { name: '화장품/미용', cid: '50000002' }, { name: '디지털/가전', cid: '50000003' },
  { name: '가구/인테리어', cid: '50000004' }, { name: '출산/육아', cid: '50000005' },
  { name: '식품', cid: '50000006' }, { name: '스포츠/레저', cid: '50000007' },
  { name: '생활/건강', cid: '50000008' }, { name: '여가/생활편의', cid: '50000009' },
]

/** 분야별 쇼핑 트렌드(최근 12개월, 월단위) — 증감률 내림차순. 소싱 우선순위. */
export async function shoppingCategoryTrends(clientId: string | undefined, clientSecret: string | undefined): Promise<{ ok: boolean; results?: CategoryTrend[]; error?: string }> {
  if (!clientId || !clientSecret) return { ok: false, error: 'NOT_CONFIGURED' }
  const today = new Date()
  const endDate = today.toISOString().slice(0, 10)
  const startDate = new Date(today.getTime() - 365 * 86400000).toISOString().slice(0, 10)
  const res = await fetch(`${OPENAPI}/v1/datalab/shopping/categories`, {
    method: 'POST',
    headers: { ...hdr(clientId, clientSecret), 'content-type': 'application/json' },
    body: JSON.stringify({ startDate, endDate, timeUnit: 'month', category: SHOPPING_CATEGORIES.map(c => ({ name: c.name, param: [c.cid] })) }),
  }).catch(() => null)
  if (!res) return { ok: false, error: '쇼핑인사이트 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { results?: Array<{ title?: string; data?: Array<{ period: string; ratio: number }> }>; errorMessage?: string } | null
  if (!res.ok) return { ok: false, error: data?.errorMessage || `쇼핑인사이트 오류 (HTTP ${res.status})` }
  const results: CategoryTrend[] = (data?.results || []).map(r => {
    const pts = (r.data || []).map(p => Number(p.ratio) || 0)
    const latest = pts.length ? pts[pts.length - 1] : 0
    const first = pts.length ? pts[0] : 0
    return { name: r.title || '', changePct: first > 0 ? Math.round(((latest - first) / first) * 100) : 0, latest }
  }).filter(c => c.name).sort((a, b) => b.changePct - a.changePct)
  return { ok: true, results }
}

export interface LowestPrice { lowest: number; mall: string; title: string; total: number }

/** 최저가 1건 — 쇼핑검색 가격오름차순(sort=asc) 1위. 가격 모니터링용. */
export async function lowestPrice(clientId: string | undefined, clientSecret: string | undefined, rawQuery: string): Promise<{ ok: boolean; data?: LowestPrice; error?: string }> {
  if (!clientId || !clientSecret) return { ok: false, error: 'NOT_CONFIGURED' }
  const query = rawQuery.trim()
  if (query.length < 2) return { ok: false, error: '검색어가 너무 짧습니다' }
  const url = `${OPENAPI}/v1/search/shop.json?query=${encodeURIComponent(query)}&display=1&sort=asc`
  const res = await fetch(url, { headers: hdr(clientId, clientSecret) }).catch(() => null)
  if (!res) return { ok: false, error: '쇼핑검색 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { total?: number; items?: Array<{ title?: string; lprice?: string; mallName?: string }>; errorMessage?: string } | null
  if (!res.ok) return { ok: false, error: data?.errorMessage || `쇼핑검색 오류 (HTTP ${res.status})` }
  const it = (data?.items || [])[0]
  if (!it) return { ok: true, data: { lowest: 0, mall: '', title: '', total: Number(data?.total) || 0 } }
  return { ok: true, data: { lowest: Math.floor(Number(it.lprice)) || 0, mall: String(it.mallName || ''), title: stripNaverTitle(String(it.title || '')), total: Number(data?.total) || 0 } }
}

// ── 브랜드 평판 모니터링 (블로그 + 카페 + 뉴스 언급량) ───────────────────────
export interface ReputationChannel { channel: 'blog' | 'cafe' | 'news'; total: number; items: Array<{ title: string; link: string; date: string; source: string }> }
export interface ReputationResult { query: string; channels: ReputationChannel[]; totalMentions: number }

const REP_ENDPOINTS: Array<{ channel: 'blog' | 'cafe' | 'news'; path: string }> = [
  { channel: 'blog', path: '/v1/search/blog.json' },
  { channel: 'cafe', path: '/v1/search/cafearticle.json' },
  { channel: 'news', path: '/v1/search/news.json' },
]

/** YYYYMMDD(블로그) / RFC822(뉴스) → YYYY-MM-DD 표준화. */
function normDate(raw: string): string {
  const s = String(raw || '').trim()
  if (/^\d{8}$/.test(s)) return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`
  const d = new Date(s)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10)
}

/** 브랜드/상호 검색어의 블로그·카페·뉴스 언급량 + 최근 글 3건씩. 오픈API(키 보유)로 즉시 — 연동 불필요. */
export async function brandReputation(clientId: string | undefined, clientSecret: string | undefined, rawQuery: string): Promise<{ ok: boolean; data?: ReputationResult; error?: string }> {
  if (!clientId || !clientSecret) return { ok: false, error: 'NOT_CONFIGURED' }
  const query = rawQuery.trim()
  if (query.length < 2) return { ok: false, error: '검색어가 너무 짧습니다' }
  const settled = await Promise.allSettled(REP_ENDPOINTS.map(async ({ channel, path }) => {
    const url = `${OPENAPI}${path}?query=${encodeURIComponent(query)}&display=3&sort=date`
    const res = await fetch(url, { headers: hdr(clientId, clientSecret) }).catch(() => null)
    if (!res || !res.ok) return { channel, total: 0, items: [] } as ReputationChannel
    const d = (await res.json().catch(() => null)) as { total?: number; items?: Array<{ title?: string; link?: string; postdate?: string; pubDate?: string; bloggername?: string; cafename?: string }> } | null
    const items = (d?.items || []).map(it => ({
      title: stripNaverTitle(String(it.title || '')),
      link: String(it.link || ''),
      date: normDate(it.postdate || it.pubDate || ''),
      source: String(it.bloggername || it.cafename || (channel === 'news' ? '뉴스' : '')),
    }))
    return { channel, total: Number(d?.total) || 0, items } as ReputationChannel
  }))
  const channels = settled.map((r, i) => r.status === 'fulfilled' ? r.value : ({ channel: REP_ENDPOINTS[i].channel, total: 0, items: [] } as ReputationChannel))
  const totalMentions = channels.reduce((s, ch) => s + ch.total, 0)
  return { ok: true, data: { query, channels, totalMentions } }
}

// ── 자동완성 키워드 확장 (네이버 자동완성 — 키 불필요) ──────────────────────
/** 검색창 자동완성 후보 → 롱테일 키워드 발굴(키워드확장 보강). best-effort(실패 시 빈 배열). */
export async function keywordAutocomplete(rawQuery: string): Promise<{ ok: boolean; suggestions?: string[]; error?: string }> {
  const query = rawQuery.trim()
  if (query.length < 1) return { ok: false, error: '검색어를 입력해주세요' }
  const url = `https://ac.search.naver.com/nx/ac?q=${encodeURIComponent(query)}&con=0&frm=nv&ans=2&r_format=json&r_enc=UTF-8&st=100`
  const res = await fetch(url).catch(() => null)
  if (!res || !res.ok) return { ok: true, suggestions: [] } // best-effort
  const d = (await res.json().catch(() => null)) as { items?: unknown[][] } | null
  const groups = Array.isArray(d?.items) ? d!.items : []
  const out: string[] = []
  const seen = new Set<string>()
  for (const group of groups) {
    if (!Array.isArray(group)) continue
    for (const entry of group) {
      const term = Array.isArray(entry) ? String(entry[0] ?? '') : ''
      const t = term.trim()
      if (t && t.toLowerCase() !== query.toLowerCase() && !seen.has(t)) { seen.add(t); out.push(t) }
      if (out.length >= 20) break
    }
    if (out.length >= 20) break
  }
  return { ok: true, suggestions: out }
}
