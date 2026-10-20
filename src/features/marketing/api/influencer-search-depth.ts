/**
 * 📖 **검색 깊이 커서** — 같은 페이지를 반복해서 긁던 것을 멈춘다
 *   (2026-08-19 대표 *"왜 줄어드는지 원인을 파악하고 해결해줘 영구적으로"*).
 *
 * ## 진단 — 그물은 멀쩡했다. 같은 사람을 다시 건지고 있었다
 * 최근 12회차 원본(`funnel.recent`):
 * ```
 *   네이버 블로그 found   555 ~ 793     ← 12회차 내내 거의 일정. 수집량은 안 줄었다
 *   그중 새 사람 saved     50 ~ 258
 *   신규율                8.4% ~ 38.6%  ← 찾아온 사람의 62~92% 가 이미 DB 에 있다
 * ```
 * 원인은 호출 한 줄에 있었다 — `discoverNaverBloggers` 의 검색 URL 에 **`start` 가 없었다**:
 * ```
 *   /v1/search/blog.json?query=...&display=100&sort=sim      ← start 기본값 1, 항상
 * ```
 * 네이버 검색 API 는 `start` 를 1~1000 까지 받는다. 즉 **한 키워드에 1,000건이 열려 있는데
 * 우리는 상위 100건만 반복**해서 봤다. `sort` 가 sim↔date 로 번갈아 바뀌니 창이 두 개일 뿐,
 * 여전히 *1페이지 두 장*이다.
 *
 * ⇒ **키워드가 고갈된 게 아니라 우리가 같은 페이지를 계속 봤다.** 그래서 지금까지의 대응
 *   (정원 확대 · 은퇴 · 새 축 추가)이 전부 *새 키워드를 더 넣는* 방향이었고 며칠씩만 갔다 —
 *   새 키워드도 1페이지를 훑고 나면 똑같이 마른다. 이건 키워드 수로는 못 고치는 문제였다.
 *
 * ## 처방 — 회차마다 다음 페이지로
 * 키워드마다 커서를 두고 `sim` 회차에서 100씩 민다(1 → 101 → … → 901 → 1).
 *
 * ⚠️ **`date` 회차는 1페이지에 고정한다.** 거긴 새 글이 계속 올라오는 *움직이는 창*이라 깊이
 *   파면 오히려 오래된 글로 내려간다. 신규 유입 채널을 그대로 두고, **정체된 `sim` 쪽만** 판다.
 *
 * 💸 **추가 비용 0** — 호출 *횟수*가 그대로다(같은 1회, 위치만 다름). 무료 티어의 진짜 제약인
 *   회차당 서브리퀘스트(56)에 전혀 안 닿는다. 네이버 쿼터도 하루 25,000 중 163건(0.7%)만 쓴다.
 *
 * ⚠️ **이 모듈이 못 하는 것**(정직하게): 깊이는 1,000건에서 끝난다. 다 캐면 그 키워드는 **그때**
 *   진짜 고갈이고, 그때부터는 다시 새 키워드 유입이 병목이다. 다만 지금은 그 지점의 **10분의 1**
 *   에서 마르고 있다. 그리고 한 키워드가 회차를 배정받는 주기가 며칠이라(활성 약 540개 ÷ 회차당
 *   8개 × 하루 12회차) 한 바퀴 도는 데 수개월이 걸린다 — 즉 당분간은 사실상 마르지 않는다.
 */

/** 네이버 검색 API 의 `start` 상한(문서값). 넘기면 400 이 온다. */
export const NAVER_SEARCH_MAX_START = 1000
/** 한 번에 받는 개수(`display` 상한). 이 값만큼 커서를 민다. */
export const NAVER_SEARCH_DISPLAY = 100

/**
 * 유효한 마지막 시작 위치. `start + display - 1 <= 1000` 이어야 하므로 display=100 이면 901.
 * (901 → 901~1000 까지 정확히 받는다.)
 */
export function lastValidStart(display = NAVER_SEARCH_DISPLAY): number {
  const d = Math.max(1, Math.min(NAVER_SEARCH_DISPLAY, Math.floor(display) || NAVER_SEARCH_DISPLAY))
  return Math.max(1, NAVER_SEARCH_MAX_START - d + 1)
}

/** 저장된 커서를 안전한 시작 위치로 정규화 — 손상/부재/범위 밖은 전부 1페이지로(수집이 멎지 않는 쪽으로 실패). */
export function normalizeStart(raw: unknown, display = NAVER_SEARCH_DISPLAY): number {
  const v = Math.floor(Number(raw))
  if (!Number.isFinite(v) || v < 1) return 1
  return v > lastValidStart(display) ? 1 : v
}

export interface SearchDepthPlan {
  /** 이번 호출에 쓸 `start`(1-기반). */
  start: number
  /** 다음 회차용으로 저장할 커서. `date` 회차면 **바뀌지 않는다**. */
  nextStart: number
  /** 한 바퀴를 다 돌아 1페이지로 되감겼는가(관측용 — 그때가 진짜 고갈 신호다). */
  wrapped: boolean
}

/**
 * 이번 회차의 시작 위치와 다음 커서를 정한다 — **순수**(유닛으로 고정).
 *
 * @param sort 이 회차의 정렬. `date` = 최신(움직이는 창) / `sim` = 정확도(정체된 창)
 * @param cursor 이 키워드에 저장돼 있던 커서(없으면 1)
 * @param display 한 번에 받는 개수
 */
export function planSearchDepth(
  sort: 'sim' | 'date',
  cursor: unknown,
  display = NAVER_SEARCH_DISPLAY,
): SearchDepthPlan {
  const start = normalizeStart(cursor, display)
  // 🕐 최신순은 **항상 1페이지** — 새 글이 올라오는 front 다. 여기서 깊이 파면 신규 유입을 놓친다.
  if (sort === 'date') return { start: 1, nextStart: start, wrapped: false }
  const d = Math.max(1, Math.min(NAVER_SEARCH_DISPLAY, Math.floor(display) || NAVER_SEARCH_DISPLAY))
  const next = start + d
  const wrapped = next > lastValidStart(d)
  return { start, nextStart: wrapped ? 1 : next, wrapped }
}
