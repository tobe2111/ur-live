/**
 * 🛡️ 2026-05-19: 한국어 친화 Levenshtein edit distance.
 *
 * 사용 시나리오: 검색어 오타 보정.
 *   사용자가 "아매리카노" 검색 → FTS5 0 results → popular_searches 후보 중
 *   "아메리카노" 가 distance 1 → "혹시 '아메리카노' 를 찾으세요?" 제안.
 *
 * 한국어 특수성:
 *   - 자모 단위 비교가 가장 정확 (NFD 분해 후 비교) 하지만 모든 case 에서 필요 X
 *   - 음절 단위 (Hangul precomposed) 비교가 80% case 커버 + 단순 구현
 *   - 본 구현은 음절 단위 + 동등 가중치 (insert/delete/substitute=1)
 *
 * 성능: O(m*n). 입력이 짧고 (대부분 <10자) candidates 가 popular_searches (top 100)
 *   라 brute-force 도 충분.
 */

/** 표준 음절 단위 Levenshtein. */
export function editDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  // 1차원 배열 — 메모리 O(min(m,n)).
  const prev = new Array<number>(n + 1)
  const curr = new Array<number>(n + 1)
  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    curr[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      curr[j] = Math.min(
        curr[j - 1] + 1,        // insertion
        prev[j] + 1,            // deletion
        prev[j - 1] + cost,     // substitution
      )
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j]
  }
  return prev[n]
}

/**
 * 후보 중 가장 가까운 키워드 찾기.
 *   - distance ≤ maxDistance 인 후보 중 distance 최소.
 *   - distance/length 비율 < 0.5 (50% 이상 다르면 의미 없음).
 *   - 동률이면 candidates 의 첫 등장 우선 (popular 가 인기순 정렬 가정).
 *
 * @param query    사용자 입력
 * @param candidates 후보 키워드 list (예: popular_searches)
 * @param maxDistance 허용 거리 (default 2 — 2글자 차이까지)
 * @returns 가장 가까운 후보 또는 null
 */
export function findClosestKeyword(
  query: string,
  candidates: string[],
  maxDistance: number = 2,
): string | null {
  const q = query.trim().toLowerCase()
  if (!q || candidates.length === 0) return null

  let best: { word: string; distance: number } | null = null
  for (const cand of candidates) {
    const c = cand.trim().toLowerCase()
    if (!c || c === q) continue  // 완전 일치는 건너뜀 (오타가 아니므로)
    const d = editDistance(q, c)
    if (d > maxDistance) continue
    // 길이 대비 50% 이상 다르면 의미 없음 (예: "차" vs "치킨")
    if (d / Math.max(q.length, c.length) >= 0.5) continue
    if (!best || d < best.distance) {
      best = { word: cand, distance: d }
      // distance 0은 위에서 skip, distance 1 보다 좋을 수 없음 → early exit.
      if (d === 1) break
    }
  }
  return best?.word || null
}
