/**
 * 🖼️ 네이버 이미지검색 API — 쿼리에 맞는 "제대로 된" 실사진 URL 1개 반환. graceful(키 없으면 null).
 *
 * 배경(2026-07-01 대표): 동네딜 "데모 채우기" 실사진. 네이버 *장소검색*(search/local)은 사진을
 * 반환하지 않으므로 *이미지검색*(search/image) 사용. 키는 openapi.naver.com 공용(NAVER_SEARCH_* 우선).
 *
 * ⚠️ "이상한 이미지" 방지(대표 지시): 첫 링크를 무조건 쓰지 않고 —
 *   1) 충분히 큰 실사진(가로/세로 ≥ 임계) + 정상 비율(아이콘/배너/롱스크린샷 제외)만 채택,
 *   2) https 원본 링크 우선(품질), 없으면
 *   3) 네이버 자체 CDN 썸네일(search.pstatic.net — 핫링크 차단 없어 항상 로드)로 폴백.
 * 데모/시드 전용 best-effort — 실패하면 호출측이 기존 이미지로 폴백.
 */
import type { Env } from '../types/env'

interface NaverImageItem { link?: string; thumbnail?: string; sizewidth?: string; sizeheight?: string }

function isProperPhoto(it: NaverImageItem): boolean {
  // 원본 스킴 무관 — 반환 전 search.pstatic 프록시로 감싸므로(서버측 fetch) http 도 안전.
  const link = it.link || ''
  if (!/^https?:\/\//.test(link)) return false
  const w = parseInt(String(it.sizewidth || '0'), 10) || 0
  const h = parseInt(String(it.sizeheight || '0'), 10) || 0
  if (w < 500 || h < 400) return false // 너무 작음 = 아이콘/썸네일/로고
  const ratio = w / h
  if (ratio < 0.6 || ratio > 2.2) return false // 세로 롱스크린샷/가로 배너 회피 → 카드용 정상 비율만
  return true
}

// 🎯 2026-07-20 (대표 — "연관없는 사진 가끔 나옴, 가장 이상적으로"): 관련도 스코어링.
//   네이버 이미지검색은 sort=sim 이어도 스톡사진/무관 블로그 이미지가 섞임 → 후보 30개를 점수화:
//   ① 제목(HTML 태그 제거·공백 정규화)에 매장명 토큰 포함 +3/토큰 (전 토큰 +1 보너스)
//   ② 원본 호스트가 네이버 플레이스/블로그 CDN(실방문 사진 출처) +2
//   ③ 스톡/클립아트 도메인 −6 (연관없는 '분위기 사진'의 주범)
//   ④ 실사진 판정(isProperPhoto) +1
interface ScoredItem extends NaverImageItem { title?: string; _score: number }

const STOCK_HOSTS = /shutterstock|gettyimages|istockphoto|123rf|dreamstime|alamy|depositphotos|freepik|crowdpic|utoimage|clipartkorea|pixabay|pexels|stock\.adobe/i
const NAVER_UGC_HOSTS = /(?:ldb-phinf|shop-phinf|blogfiles|mblogthumb-phinf|postfiles|naverbooking-phinf)\.pstatic\.net|blogpfthumb/i

function normalizeKo(s: string): string {
  return s.replace(/<[^>]+>/g, '').replace(/&[a-z]+;/gi, ' ').replace(/[^0-9a-zA-Z가-힣]/g, '').toLowerCase()
}

function scoreItems(items: (NaverImageItem & { title?: string })[], nameTokens: string[]): ScoredItem[] {
  return items.map((it) => {
    let score = 0
    const title = normalizeKo(String(it.title || ''))
    let hit = 0
    for (const tk of nameTokens) if (tk && title.includes(tk)) { score += 3; hit++ }
    if (nameTokens.length > 1 && hit === nameTokens.length) score += 1
    const link = String(it.link || '')
    if (NAVER_UGC_HOSTS.test(link)) score += 2
    if (STOCK_HOSTS.test(link)) score -= 6
    if (isProperPhoto(it)) score += 1
    return { ...it, _score: score }
  })
}

/**
 * 🖼️ 관련도 스코어 상위 N장 반환 (search.pstatic 프록시 랩 — 항상 로드 가능한 URL).
 * @param opts.count   최대 장수 (기본 1)
 * @param opts.nameQuery 매장/숙소명 — 제목 토큰 매칭 기준(±스코어). 미지정 시 query 사용.
 * @param opts.pickIndex 후보 로테이션(같은 쿼리 반복 시드에서 다른 사진) — 동점 상위권 안에서 회전.
 */
export async function fetchNaverImageUrls(
  env: Env,
  query: string,
  opts: { count?: number; nameQuery?: string; pickIndex?: number } = {},
): Promise<string[]> {
  const clientId = env.NAVER_SEARCH_CLIENT_ID || env.NAVER_CLIENT_ID
  const clientSecret = env.NAVER_SEARCH_CLIENT_SECRET || env.NAVER_CLIENT_SECRET
  if (!clientId || !clientSecret || !query) return []
  const count = Math.max(1, Math.min(8, opts.count ?? 1))
  const pickIndex = opts.pickIndex ?? 0
  try {
    // display 넉넉히(30) 받아 필터 통과분 확보. filter=large 로 저해상도 원천 배제 + sort=sim(관련도).
    const url = `https://openapi.naver.com/v1/search/image?query=${encodeURIComponent(query)}&display=30&sort=sim&filter=large`
    const res = await fetch(url, {
      headers: { 'X-Naver-Client-Id': clientId, 'X-Naver-Client-Secret': clientSecret },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return []
    const data = (await res.json()) as { items?: (NaverImageItem & { title?: string })[] }
    const items = data.items || []
    if (!items.length) return []
    // 🛡️ 2026-07-02 (대표 "영구적으로 해결"): 네이버 원본 호스트는 https 여도 인증서 불일치
    //    (shop1.phinf.naver.net ERR_CERT_COMMON_NAME_INVALID)로 깨짐 → **원본 직접 채택 전면 금지**.
    //    모든 단계를 search.pstatic.net 프록시(toNaverSafeImageUrl)로 변환해 반환.
    const { toNaverSafeImageUrl } = await import('../../shared/naver-safe-image')
    // 매장명 토큰(공백 분리, 2자+) — 제목 매칭 기준.
    const nameTokens = String(opts.nameQuery ?? query).split(/\s+/).map(normalizeKo).filter((t) => t.length >= 2)
    const scored = scoreItems(items, nameTokens)
    // 스톡사진(음수) 배제 → 점수 내림차순(동점은 관련도 원순서 유지). 실사진 필터 통과분 우선.
    const eligible = scored.filter((i) => i._score >= 0 && (i.link || i.thumbnail))
    const propers = eligible.filter(isProperPhoto)
    const pool = propers.length >= count ? propers : [...propers, ...eligible.filter((i) => !isProperPhoto(i))]
    pool.sort((a, b) => b._score - a._score)
    // pickIndex 로테이션: 시작 오프셋만 회전(상위권 우선 유지) + 링크 중복 제거.
    const out: string[] = []
    const seen = new Set<string>()
    for (let i = 0; i < pool.length && out.length < count; i++) {
      const it = pool[(i + pickIndex) % pool.length]
      const key = String(it.link || it.thumbnail)
      if (seen.has(key)) continue
      seen.add(key)
      const safe = toNaverSafeImageUrl(it.link, it.thumbnail)
      if (safe) out.push(safe)
    }
    return out
  } catch {
    return []
  }
}

/**
 * @param pickIndex 후보 로테이션 인덱스(기본 0 = 기존과 동일). 데모 누적 시드처럼 같은 쿼리를
 *   반복 호출할 때 배치마다 다른 사진을 고르게 → 동일 카드 중복 노출 완화. 후보 수로 mod.
 *   (2026-07-20 부터 fetchNaverImageUrls 스코어링 위임 — 기존 시그니처/호출부 불변.)
 */
export async function fetchNaverImageUrl(env: Env, query: string, pickIndex = 0): Promise<string | null> {
  const urls = await fetchNaverImageUrls(env, query, { count: 1, pickIndex })
  return urls[0] ?? null
}
