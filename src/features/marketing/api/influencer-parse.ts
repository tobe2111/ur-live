/**
 * 🧩 순수 파서 — `influencer-performance.ts` 에서 분리(2026-07-29).
 *   RSS pubDate/제목, 네이버 이웃수 파싱. 외부 의존 0·부수효과 0이라 유닛으로 고정하기 쉽고,
 *   원본은 오늘만 두 번 손댄 핫스팟이라 600줄 캡에 계속 부딪힌다 — 순수 조각을 밖으로 뺀다.
 */

/** RSS pubDate 목록 → 최근 N일 내 포스팅 수. 파싱 불가 날짜는 무시. */
export function countRecentPosts(pubDates: string[], nowMs: number, days = 30): number {
  const cutoff = nowMs - days * 86400_000
  let n = 0
  for (const d of pubDates) { const t = Date.parse(d); if (Number.isFinite(t) && t >= cutoff && t <= nowMs + 86400_000) n++ }
  return n
}

/** RSS XML 에서 pubDate 텍스트 추출(정규식 — 외부 파서 없음). */
export function extractPubDates(xml: string): string[] {
  const out: string[] = []
  const re = /<pubDate>([^<]{5,60})<\/pubDate>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) out.push(m[1].trim())
  return out
}

/** RSS XML 에서 글 제목 추출(채널 자체 title 은 제외 — <item> 안의 것만). CDATA/일반 둘 다.
 *  블로그 카테고리 분류의 핵심 신호 — 검색 스니펫 1건보다 최근 글 제목 묶음이 훨씬 정확. */
export function extractRssTitles(xml: string, max = 6): string[] {
  const out: string[] = []
  const itemRe = /<item>([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(xml)) !== null && out.length < max) {
    const t = /<title>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]{1,120}))<\/title>/i.exec(m[1])
    const title = (t?.[1] || t?.[2] || '').trim()
    if (title) out.push(title.slice(0, 80))
  }
  return out
}

/**
 * 🏷️ 분류 전용으로 description 꼬리에 붙인 세그먼트를 떼어낸다(원래 소개글만 남김).
 *   `influencer-discovery.ts` 에 있던 것을 여기로 옮겼다(순수 파서 자리) — discovery 는 재수출한다.
 *   ⚠️ 마커 목록은 **붙이는 쪽(`buildNaverDescription`)과 반드시 짝**이다. 하나라도 빠지면 그 세그먼트가
 *   매 측정마다 누적돼 500자 캡을 잡아먹고, `extractContacts` 가 **남의 연락처**(글 제목 속)를 본인 것으로 줍는다.
 */
export const stripVideoTitles = (s: string): string =>
  String(s || '').replace(/\s\|\s(?:영상|글|소개|분류):[\s\S]*$/, '')

/** XML/HTML → 평문. RSS 본문은 HTML 이 통째로 들어 있어 태그를 안 떼면 분류 신호가 마크업에 묻힌다. */
export function stripXmlText(s: string): string {
  return String(s || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#0*39;/g, "'").replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')   // ⚠️ 반드시 마지막 — 먼저 풀면 `&amp;lt;` 가 `<` 로 이중 해제된다
    .replace(/\s+/g, ' ').trim()
}

/**
 * 📇 **채널 레벨** `<description>` = 블로그 소개글(본인이 쓴 것).
 *   `<item>` 이전 구간에서만 찾는다 — 글 본문 description 과 섞이면 **남의 연락처**를 본인 것으로 줍는다.
 */
export function extractRssChannelDescription(xml: string, maxChars = 400): string {
  if (!xml) return ''
  const head = xml.split(/<item[\s>]/i)[0] || ''
  const m = /<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/i.exec(head)
  return stripXmlText(m?.[1] || m?.[2] || '').slice(0, maxChars)
}

/** `<category>` — 블로거가 **직접 붙인** 분류명. 수집 키워드 상속보다 훨씬 정직한 신호(추가 fetch 0). */
export function extractRssCategories(xml: string, max = 6): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const re = /<category>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([^<]{1,60}))<\/category>/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null && out.length < max) {
    const v = stripXmlText(m[1] || m[2] || '').slice(0, 24)
    if (!v || seen.has(v)) continue
    seen.add(v); out.push(v)
  }
  return out
}

/**
 * 글 **본문** 텍스트 묶음 — **분류 전용**.
 * 🚫 여기서 연락처를 뽑지 말 것: 본문엔 협찬 문의처·업체 정보 등 **남의 연락처**가 섞인다
 *    (본인 연락처의 안전한 출처는 홈 프로필과 채널 소개글뿐).
 */
export function extractRssItemText(xml: string, maxItems = 8, maxChars = 4000): string {
  const parts: string[] = []
  const itemRe = /<item[\s>]([\s\S]*?)<\/item>/gi
  let m: RegExpExecArray | null
  let total = 0
  while ((m = itemRe.exec(xml)) !== null && parts.length < maxItems && total < maxChars) {
    const d = /<description>(?:<!\[CDATA\[([\s\S]*?)\]\]>|([\s\S]*?))<\/description>/i.exec(m[1])
    const t = stripXmlText(d?.[1] || d?.[2] || '')
    if (!t) continue
    const chunk = t.slice(0, 700)
    parts.push(chunk); total += chunk.length
  }
  return parts.join(' ').slice(0, maxChars)
}

/** 저장용 description 조립 — 꼬리 마커는 `stripVideoTitles` 와 짝(누적 방지). */
export function buildNaverDescription(prior: string, intro: string, cats: string[], titles: string[]): string {
  const bare = stripVideoTitles(prior).trim()
  const tail: string[] = []
  if (titles.length) tail.push(`글: ${titles.join(' · ')}`)
  if (intro) tail.push(`소개: ${intro.slice(0, 160)}`)
  if (cats.length) tail.push(`분류: ${cats.join(' · ')}`)
  if (!tail.length) return ''
  return [bare.slice(0, 240), ...tail].filter(Boolean).join(' | ').slice(0, 500)
}

/**
 * 🎁 한 번 받은 RSS 에서 **뽑을 수 있는 모든 신호**를 한 자리에서 — 추가 fetch 0.
 *
 * ## 왜 (2026-07-29 대표 방향: DB 수집·카테고리화·필터링·정보 최대 수집)
 * 이 레인은 이미 블로그당 RSS 를 최대 120KB 받아 놓고 **제목과 날짜만** 쓰고 나머지를 버렸다.
 * 실측상 네이버 블로거의 84%가 `category_source='keyword'`(발굴 키워드 상속)인데,
 * 같은 응답 안에 블로거가 **직접 붙인 분류명**과 **본인이 쓴 소개글**이 들어 있다.
 * 서브리퀘스트가 이 파이프라인의 천장(무료 50/인보케이션)이므로, **이미 산 데이터를 더 쓰는 것**이
 * 처리량을 안 건드리고 품질을 올리는 유일한 방향이다.
 *
 * ⚠️ **이 환경에서 RSS 실물을 못 봤다**(에이전트 프록시가 `rss.blog.naver.com` CONNECT 403).
 *    그래서 전부 **있으면 쓰고 없으면 조용히 빈 값**이고, 호출부가 `rss_cat`/`rss_intro` 카운터를
 *    남긴다 — 다음 세션은 그 카운터로 "필드가 실제로 오는가"를 **추측 없이** 판정할 것.
 */
export function deriveNaverRssSignals(xml: string, priorDescription: string): {
  description: string; intro: string; body: string; cats: string[]; titles: string[]
} {
  const titles = extractRssTitles(xml)
  const cats = extractRssCategories(xml)
  const intro = extractRssChannelDescription(xml)
  return { description: buildNaverDescription(priorDescription, intro, cats, titles), intro, body: extractRssItemText(xml), cats, titles }
}

/** 네이버 검색 API postdate(YYYYMMDD) → 'YYYY-MM-DD'. 형식 불일치는 null. */
export function naverPostdateToIso(postdate?: string | null): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})$/.exec(String(postdate || '').trim())
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}

/** 네이버 블로그 홈 HTML 에서 이웃수(규모 프록시) 파싱 — best-effort. 네이버 오픈API 는 구독/이웃수를
 *  안 줘서(비공개) 이미 받는 홈 HTML 에서 긁는 게 무료 최선. 여러 레이아웃 대비 다중 패턴, 못 찾으면 0. */
export function parseNaverNeighborCount(html: string): number {
  if (!html) return 0
  const pats: RegExp[] = [
    /"buddyCount"\s*:\s*"?(\d{1,9})"?/i,         // 상태 JSON blob
    /buddyCount['"]?\s*[:=]\s*['"]?(\d{1,9})/i,
    /이웃\s*<[^>]*>\s*([\d,]{1,12})/,            // "이웃 <em>1,234</em>"
    /이웃[^0-9]{0,6}([\d,]{2,12})\s*명/,         // "이웃 1,234명"
    /([\d,]{2,12})\s*명의?\s*이웃/,              // "1,234명의 이웃"
  ]
  for (const re of pats) {
    const m = html.match(re)
    if (m) { const n = parseInt(m[1].replace(/,/g, ''), 10); if (Number.isFinite(n) && n > 0 && n < 100_000_000) return n }
  }
  return 0
}

// ── 순수 계산(테스트 가능) ──────────────────────────────────────────────────
export function avgStats(videos: { views: number; comments: number }[]): { avgViews: number; avgComments: number } {
  if (!videos.length) return { avgViews: 0, avgComments: 0 }
  const s = videos.reduce((a, v) => ({ v: a.v + (v.views || 0), c: a.c + (v.comments || 0) }), { v: 0, c: 0 })
  return { avgViews: Math.round(s.v / videos.length), avgComments: Math.round(s.c / videos.length) }
}

/** ISO-8601 duration(PT#H#M#S) → 초. 파싱 불가/빈값은 0(=길이 미상 → 롱폼 판정에서 제외). */
export function parseIsoDurationSec(iso?: string | null): number {
  const m = /^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?$/i.exec(String(iso || '').trim())
  if (!m) return 0
  const [, d, h, mi, s] = m
  const sec = (parseInt(d || '0', 10) * 86400) + (parseInt(h || '0', 10) * 3600) + (parseInt(mi || '0', 10) * 60) + Math.round(parseFloat(s || '0'))
  return Number.isFinite(sec) ? sec : 0
}

/** 쇼츠 판정 임계(초) — 유튜브 쇼츠 최대 길이(3분) 기준. 이보다 길면 롱폼으로 본다. */
export const SHORTS_MAX_SEC = 180

/** 숫자 배열의 중앙값(정수 반올림). 빈 배열은 0. */
export function medianOf(nums: number[]): number {
  if (!nums.length) return 0
  const a = [...nums].sort((x, y) => x - y)
  const mid = a.length >> 1
  return Math.round(a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2)
}

/**
 * 📈 채널 성과 지표(2026-07-27 개선) — 기존 '전체 평균 조회수'는 **쇼츠/롱폼 혼합 + 산술평균**이라
 *   쇼츠 몇 개가 터진 채널이 과대평가됐다(협찬 단가 오판). 롱폼만의 **중앙값**을 별도로 계산해
 *   실제 콘텐츠 도달력을 보수적으로 추정하고, 쇼츠 비중도 함께 노출한다.
 *   ⚠️ avgViews/avgComments 는 기존 표시·정렬 호환을 위해 그대로 유지(제거 아님).
 */
export function videoMetrics(videos: { views: number; comments: number; durationSec?: number }[]): {
  avgViews: number; avgComments: number; medianLongViews: number; shortsRatio: number
} {
  const { avgViews, avgComments } = avgStats(videos)
  const withLen = videos.filter(v => (v.durationSec || 0) > 0)
  const longs = withLen.filter(v => (v.durationSec || 0) > SHORTS_MAX_SEC)
  const shorts = withLen.length - longs.length
  return {
    avgViews, avgComments,
    // 길이를 못 잰 경우(전부 0초)엔 롱폼 중앙값을 0 으로 두고 호출부가 avg 로 폴백하게 한다.
    medianLongViews: medianOf(longs.map(v => v.views || 0)),
    shortsRatio: withLen.length ? Math.round((shorts / withLen.length) * 100) : 0,
  }
}
