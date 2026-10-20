/**
 * 목록 → 상세 → 뒤로 에서 **목록을 처음부터 다시 만들지 않게** 하는 보관함.
 *
 * ## 왜 필요한가 (2026-09-13 대표 신고 — "교환권 상세 갔다 나오면 다시 새로고침됨")
 * `App.tsx` 는 경로가 바뀌면 페이지를 **통째로 리마운트**한다(`key={location.pathname}` —
 * 2026-07-10 에 쿼리-전용 이동의 리마운트를 막으려고 `location.key` 에서 옮겨온 것이라
 * 경로가 실제로 바뀌는 목록↔상세는 지금도 리마운트가 맞다). 그래서 목록이 `useState` 에
 * 들고 있던 **불러온 상품·페이지·'더보기'로 편 개수가 전부 사라지고**, 돌아오면 전체화면
 * 로더가 다시 뜬 뒤 첫 페이지만 남는다.
 *
 * 그리고 이게 **스크롤 복원까지 무력화한다.** `ScrollToTop` 은 POP 에서 저장된 offset 으로
 * 돌아가려 하지만 문서가 그만큼 길지 않으면 갈 수 있는 데까지만 간다(그 파일이 "못 하는 것"
 * 으로 이미 적어 둔 한계다). 실측(430px, 로컬 앱 + 라이브 데이터):
 *   행 24 → 8 · 문서높이 3186 → 1454 · 스크롤 1400 → 594 · 복귀 직후 전체화면 로더 재등장
 * ⇒ **높이를 되돌려 주는 것이 곧 스크롤 복원**이다. 둘은 별개 처방이 아니다.
 *
 * ## 메모리에만 둔다 (sessionStorage 아님)
 * 상품 배열은 수십~수백 KB 라 sessionStorage 에 넣으면 용량을 잡아먹고 직렬화 비용이 든다.
 * 그리고 **새로고침한 사용자는 새 목록을 기대한다** — 문서가 새로 뜨면 이 보관함도 비는 것이
 * 맞다. 탭 수명 동안의 SPA 이동만 덮으면 충분하고, 그게 정확히 이 사고의 범위다.
 *
 * ## 이 파일이 **못 하는 것**(정직하게)
 * - 새로고침·새 탭: 위 이유로 의도적으로 비운다.
 * - PUSH 로 다시 들어온 목록: 복원하지 않는다(하단바 '교환권'을 새로 누른 사람은 맨 위를
 *   기대한다). 복원 여부는 호출부가 `useNavigationType() === 'POP'` 로 정한다.
 * - 되살린 목록의 신선도: 되살린 뒤 재조회하지 않는다. 재조회하면 응답이 1페이지뿐이라
 *   **목록이 도로 짧아져** 고치려던 증상이 그대로 재발한다(가격은 상세·결제에서 서버가
 *   다시 정한다). 그래서 TTL 로 오래된 것만 버린다.
 */
type Entry = { at: number; value: unknown }

const STORE = new Map<string, Entry>()

/** 보관 개수 — 카테고리·브랜드·정렬 조합마다 키가 갈리므로 몇 개만 둔다(오래된 것부터 버림). */
const MAX_ENTRIES = 8
/** 30분. 뒤로가기는 보통 수초~수분 안에 일어나고, 그보다 오래 묵은 목록은 새로 받는 편이 낫다. */
const TTL_MS = 30 * 60_000

export function saveListView<T>(key: string, value: T): void {
  STORE.delete(key)                       // 재삽입해 '최근' 순서를 유지(Map 은 삽입순)
  STORE.set(key, { at: Date.now(), value })
  while (STORE.size > MAX_ENTRIES) {
    const oldest = STORE.keys().next().value
    if (oldest === undefined) break
    STORE.delete(oldest)
  }
}

export function readListView<T>(key: string): T | null {
  const hit = STORE.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > TTL_MS) { STORE.delete(key); return null }
  return hit.value as T
}

/** 테스트·필터 변경 등에서 특정 키를 버릴 때. */
export function dropListView(key: string): void {
  STORE.delete(key)
}
