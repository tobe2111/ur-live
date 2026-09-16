/**
 * 🔎 인기 검색어 — `popular_searches` 테이블 기반의 **실제** 검색어.
 *
 * ## 왜 훅으로 묶었나
 * 이 값을 쓰는 자리가 둘인데 **한쪽만 진짜였다**:
 *   · 빈 검색 화면(`SearchStates`) → `/api/search/popular` 를 실제로 불렀다.
 *   · 검색 결과 화면(`SearchPage`) → *"함께 검색된 키워드"* 라는 이름으로 **하드코딩 6개**
 *     (`인기상품 · 신상품 · 할인특가 · 무료배송 · 베스트셀러 · 한정판`)를 띄웠다.
 *     검색어와 아무 상관이 없었고, 누르면 **0건**이 나왔다. 게다가 `무료배송` 은
 *     이용권 서비스에 **개념 자체가 없다**(`SortFilterBar` 가 같은 이유로 칩을 걷어냈다).
 *
 * ⇒ 하드코딩을 지우고 두 화면이 **같은 값**을 본다. 누르면 결과가 나오는 것만 보여준다.
 *
 * ⚠️ 이건 연관검색어가 아니라 **인기 검색어**다 — 화면 라벨도 그렇게 쓴다.
 *   "함께 검색된" 이라고 쓰면 그 자체가 사실이 아니다.
 */
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'

/** 서버가 비었거나 실패하면 **빈 배열** — 없는 걸 지어내지 않는다(호출부가 섹션을 감춘다). */
export function usePopularSearches(limit = 10) {
  const { data } = useQuery({
    queryKey: ['popularSearches'],
    queryFn: async () => {
      const r = await api.get('/api/search/popular')
      const rows = r.data?.success && Array.isArray(r.data.data) ? r.data.data : []
      return rows
        .map((x: { keyword?: string }) => String(x?.keyword || '').trim())
        .filter(Boolean) as string[]
    },
    // 인기 검색어는 자주 안 바뀐다. 서버도 60s 엣지 캐시라 여기서 더 조인다.
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  })
  return (data || []).slice(0, limit)
}
