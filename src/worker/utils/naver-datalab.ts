/**
 * 📊 2026-06-12 (사용자 요청 ②④): 네이버 데이터랩 — 수요 신호.
 *
 *   ② 쇼핑인사이트(카테고리 내 키워드 클릭 추이): 제조사가 상품을 올릴 때
 *      "이 상품 수요가 오르는 중인지" — 최근 6개월 월별 클릭 상대지수로 상승/하락/보합 판정.
 *   ④ 검색어트렌드(시즌성): 최근 24개월 월별 검색 상대지수로 성수기 월 추출 —
 *      "성수기: 6·7·8월, 지금이 진입 시점" 같은 시즌 안내.
 *
 *   API (developers.naver.com — 검색 API 와 같은 앱/키):
 *     POST /v1/datalab/shopping/category/keywords  (쇼핑인사이트)
 *     POST /v1/datalab/search                      (검색어트렌드)
 *   ⚠️ 데이터랩 쿼터는 일 1,000회 (검색 25,000회보다 작음) — (키워드,카테고리)당 12시간
 *   모듈 캐시 + 데이터가 일 단위 갱신이라 충분. ratio 는 요청 구간 내 상대지수(0~100) —
 *   같은 시리즈 안에서의 비교만 의미 있음(분석 함수들이 그 전제로 동작).
 *
 *   fail-soft: 키 미설정 → configured:false (UI 숨김). 부분 실패 허용(쇼핑/검색 독립).
 */

// 우리 도매 카테고리 → 네이버쇼핑 1depth 카테고리 ID (쇼핑인사이트 필수 파라미터).
//   네이버 공개 분류 체계의 고정 ID — 비즈니스 설정값이 아니라 외부 택소노미 매핑.
export const WHOLESALE_TO_NAVER_CATEGORY: Record<string, { catId: string; label: string }> = {
  food: { catId: '50000006', label: '식품' },
  beauty: { catId: '50000002', label: '화장품/미용' },
  living: { catId: '50000004', label: '가구/인테리어' },
  fashion: { catId: '50000000', label: '패션의류' },
  digital: { catId: '50000003', label: '디지털/가전' },
  lifestyle: { catId: '50000008', label: '생활/건강' },
}

export interface TrendPoint { period: string; ratio: number }

/** 최근 N개월 추이 판정 — 마지막 2개월 평균 vs 그 이전 평균 (순수, 테스트 가능). */
export function analyzeTrend(points: TrendPoint[]): { trend: 'up' | 'down' | 'flat'; changePct: number } {
  if (points.length < 4) return { trend: 'flat', changePct: 0 }
  const recent = points.slice(-2)
  const before = points.slice(0, -2)
  const avg = (arr: TrendPoint[]) => arr.reduce((s, p) => s + p.ratio, 0) / arr.length
  const a = avg(before)
  const b = avg(recent)
  if (a <= 0) return { trend: 'flat', changePct: 0 }
  const changePct = Math.round(((b - a) / a) * 100)
  if (changePct >= 10) return { trend: 'up', changePct }
  if (changePct <= -10) return { trend: 'down', changePct }
  return { trend: 'flat', changePct }
}

/**
 * 시즌성 판정 — 월별(1~12) 평균 ratio 를 구해 평균 대비 25%+ 높은 달을 성수기로.
 * (순수, 테스트 가능.) 성수기가 3개월 이하일 때만 '시즌 상품'으로 본다 — 연중 고른 상품은 null.
 */
export function analyzeSeasonality(points: TrendPoint[]): { peakMonths: number[]; isSeasonal: boolean } {
  if (points.length < 12) return { peakMonths: [], isSeasonal: false }
  const byMonth = new Map<number, number[]>()
  for (const p of points) {
    const m = Number(p.period.slice(5, 7))
    if (!Number.isFinite(m) || m < 1 || m > 12) continue
    const arr = byMonth.get(m) || []
    arr.push(p.ratio)
    byMonth.set(m, arr)
  }
  const monthAvg = new Map<number, number>()
  let total = 0
  for (const [m, arr] of byMonth) {
    const avg = arr.reduce((s, v) => s + v, 0) / arr.length
    monthAvg.set(m, avg)
    total += avg
  }
  if (monthAvg.size < 12) return { peakMonths: [], isSeasonal: false }
  const mean = total / monthAvg.size
  if (mean <= 0) return { peakMonths: [], isSeasonal: false }
  const peaks = [...monthAvg.entries()]
    .filter(([, avg]) => avg >= mean * 1.25)
    .map(([m]) => m)
    .sort((a, b) => a - b)
  // 1~3개월 피크 = 뚜렷한 시즌 상품. 4개월+ 면 시즌성 약함으로 취급.
  return { peakMonths: peaks, isSeasonal: peaks.length >= 1 && peaks.length <= 3 }
}

// ── API 호출 ──────────────────────────────────────────────────────────────

function dateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

async function datalabPost(
  clientId: string, clientSecret: string, path: string, body: Record<string, unknown>,
): Promise<{ ok: boolean; results?: Array<{ data?: TrendPoint[] }>; error?: string; quotaExhausted?: boolean }> {
  const res = await fetch(`https://openapi.naver.com${path}`, {
    method: 'POST',
    headers: {
      'X-Naver-Client-Id': clientId,
      'X-Naver-Client-Secret': clientSecret,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  }).catch(() => null)
  if (!res) return { ok: false, error: '네이버 데이터랩 호출 실패 (네트워크)' }
  const data = (await res.json().catch(() => null)) as { results?: Array<{ data?: TrendPoint[] }>; errorMessage?: string; errorCode?: string } | null
  if (!res.ok) {
    // 일 쿼터(1,000회) 소진 — 429 또는 한도 에러코드. 수요 신호는 '보너스 정보'라
    // 에러를 띄우지 않고 자정(KST)까지 호출을 멈추고 UI 는 박스 자체를 숨긴다.
    const quotaExhausted = res.status === 429 || /quota|limit/i.test(data?.errorMessage || '')
    return { ok: false, error: data?.errorMessage || `데이터랩 오류 (HTTP ${res.status})`, quotaExhausted }
  }
  return { ok: true, results: data?.results || [] }
}

// 쿼터 소진 시 KST 자정까지 데이터랩 호출 차단 (재시도 폭주 방지 — 검색 API 와 별개).
let _quotaBlockedUntil = 0
function nextKstMidnight(): number {
  const nowKst = Date.now() + 9 * 60 * 60_000
  const midnightKst = Math.ceil(nowKst / 86_400_000) * 86_400_000
  return midnightKst - 9 * 60 * 60_000
}

// (키워드,카테고리)당 12시간 캐시 — 일 1,000회 쿼터 보호. 데이터는 일 단위 갱신.
const _cache = new Map<string, { at: number; value: unknown }>()
const CACHE_TTL = 12 * 60 * 60_000
const CACHE_MAX = 300
function cacheGet<T>(key: string): T | null {
  const hit = _cache.get(key)
  return hit && Date.now() - hit.at < CACHE_TTL ? (hit.value as T) : null
}
function cacheSet(key: string, value: unknown): void {
  if (_cache.size >= CACHE_MAX) _cache.clear()
  _cache.set(key, { at: Date.now(), value })
}

export interface DemandSignal {
  configured: boolean
  shopping?: { trend: 'up' | 'down' | 'flat'; changePct: number } | null
  season?: { peakMonths: number[]; isSeasonal: boolean } | null
}

/** 수요 신호 — 쇼핑인사이트(6개월 클릭 추이) + 검색어트렌드(24개월 시즌성). 부분 실패 허용. */
export async function fetchDemandSignal(
  clientId: string | undefined,
  clientSecret: string | undefined,
  keyword: string,
  wholesaleCategory: string,
): Promise<DemandSignal> {
  if (!clientId || !clientSecret) return { configured: false }
  const kw = keyword.trim().slice(0, 30)
  if (kw.length < 2) return { configured: true, shopping: null, season: null }

  const cat = WHOLESALE_TO_NAVER_CATEGORY[wholesaleCategory]
  const cacheKey = `${wholesaleCategory}:${kw}`
  const hit = cacheGet<DemandSignal>(cacheKey)
  if (hit) return hit

  // 쿼터 소진 중 — 캐시에 있던 것만 답하고 신규 호출은 자정까지 skip (UI 는 자연스럽게 숨김).
  if (Date.now() < _quotaBlockedUntil) return { configured: true, shopping: null, season: null }

  const now = new Date()
  const end = dateStr(new Date(now.getTime() - 24 * 60 * 60_000)) // 어제 (당일 데이터 미집계)
  const start6m = dateStr(new Date(now.getFullYear(), now.getMonth() - 6, 1))
  const start24m = dateStr(new Date(now.getFullYear() - 2, now.getMonth(), 1))

  const [shoppingRes, searchRes] = await Promise.all([
    // ② 쇼핑인사이트 — 카테고리 매핑이 있을 때만 (cat 필수 파라미터).
    cat
      ? datalabPost(clientId, clientSecret, '/v1/datalab/shopping/category/keywords', {
          startDate: start6m, endDate: end, timeUnit: 'month',
          category: cat.catId,
          keyword: [{ name: kw, param: [kw] }],
        })
      : Promise.resolve({ ok: false as const, error: 'no-category' }),
    // ④ 검색어트렌드 — 카테고리 무관.
    datalabPost(clientId, clientSecret, '/v1/datalab/search', {
      startDate: start24m, endDate: end, timeUnit: 'month',
      keywordGroups: [{ groupName: kw, keywords: [kw] }],
    }),
  ])

  // 쿼터 소진 감지 → 자정(KST)까지 데이터랩 신규 호출 차단.
  if ((!shoppingRes.ok && (shoppingRes as { quotaExhausted?: boolean }).quotaExhausted) ||
      (!searchRes.ok && (searchRes as { quotaExhausted?: boolean }).quotaExhausted)) {
    _quotaBlockedUntil = nextKstMidnight()
  }

  const shoppingPoints = shoppingRes.ok ? (shoppingRes.results?.[0]?.data || []) : []
  const searchPoints = searchRes.ok ? (searchRes.results?.[0]?.data || []) : []

  const signal: DemandSignal = {
    configured: true,
    shopping: shoppingPoints.length >= 4 ? analyzeTrend(shoppingPoints) : null,
    season: searchPoints.length >= 12 ? analyzeSeasonality(searchPoints) : null,
  }
  // 둘 다 실패(쿼터/장애)면 캐시하지 않음 — 복구 후 첫 요청이 다시 채움.
  if (signal.shopping !== null || signal.season !== null) cacheSet(cacheKey, signal)
  return signal
}
