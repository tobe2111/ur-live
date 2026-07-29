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
